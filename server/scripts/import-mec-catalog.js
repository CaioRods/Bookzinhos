#!/usr/bin/env node
require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { db, sql, initDB } = require('../db');
const { loadCuratedManifest } = require('../catalog-manifest');
const { resolveMecBook } = require('../mec-catalog-adapter');
const { downloadOfficialPdf } = require('../catalog-source');
const { candidateId, runCatalogImport } = require('../catalog-report');

const STATE_PATH = path.join(__dirname, '..', 'data', 'catalog-import-state.json');
const BUCKET = process.env.S3_BUCKET_NAME || 'bookzinhos';

function parseOptions(argv) {
  const limitArg = argv.find((value) => value.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit deve ser um inteiro positivo');
  return { dryRun: argv.includes('--dry-run'), resume: argv.includes('--resume'), limit };
}

async function readCheckpoint() {
  try {
    return JSON.parse(await fs.readFile(STATE_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { completed: [] };
    throw error;
  }
}

async function saveCheckpoint(checkpoint) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

function createStorage(env = process.env) {
  if (env.S3_ACCESS_KEY_ID) {
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      forcePathStyle: true,
    });
    return {
      upload: async (key, bytes, contentType) => {
        try {
          await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable', IfNoneMatch: '*' }));
          return { created: true };
        } catch (error) {
          if (error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed') return { created: false };
          throw error;
        }
      },
      remove: (key) => client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
      publicUrl: (key) => env.S3_PUBLIC_URL_PREFIX ? `${env.S3_PUBLIC_URL_PREFIX}/${key}` : `${env.S3_ENDPOINT}/${BUCKET}/${key}`,
    };
  }
  if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY)) {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY);
    return {
      upload: async (key, bytes, contentType) => {
        const { error } = await client.storage.from(BUCKET).upload(key, bytes, { contentType, cacheControl: '31536000', upsert: false });
        if (error && (String(error.statusCode) === '409' || /duplicate|already exists/i.test(error.message))) return { created: false };
        if (error) throw new Error(`Erro no upload para o Supabase: ${error.message}`);
        return { created: true };
      },
      remove: async (key) => {
        const { error } = await client.storage.from(BUCKET).remove([key]);
        if (error) throw new Error(`Erro ao remover do Supabase: ${error.message}`);
      },
      publicUrl: (key) => client.storage.from(BUCKET).getPublicUrl(key).data.publicUrl,
    };
  }
  return {
    upload: async () => { throw new Error('Armazenamento em nuvem não configurado'); },
    remove: async () => {},
    publicUrl: () => { throw new Error('Armazenamento em nuvem não configurado'); },
  };
}

function createProductionDeps(storage = createStorage()) {
  return {
    resolve: (candidate) => resolveMecBook(candidate),
    download: (url) => downloadOfficialPdf({ url }),
    findByMetadata: async (title, author) => {
      const [row] = await db.query(sql`SELECT id FROM books WHERE LOWER(TRIM(title))=LOWER(TRIM(${title})) AND LOWER(TRIM(author))=LOWER(TRIM(${author})) LIMIT 1`);
      return row || null;
    },
    findByHash: async (sha256) => {
      const [row] = await db.query(sql`SELECT id FROM books WHERE pdf_sha256=${sha256} LIMIT 1`);
      return row || null;
    },
    upload: storage.upload,
    remove: storage.remove,
    publicUrl: storage.publicUrl,
    insert: async (book) => {
      const officialId = new URL(book.sourceUrl).searchParams.get('co_obra');
      const id = officialId ? `mec-${officialId}` : `mec-${book.pdfSha256.slice(0, 16)}`;
      await db.query(sql`
        INSERT INTO books (
          id,title,author,description,genre,publisher,published_year,rating,review_count,is_public,
          cover_color,added_at,pdf_path,cover_image_path,is_user_book,uploaded_by,
          ipr,source_name,source_url,license_status,pdf_sha256,imported_at
        ) VALUES (
          ${id},${book.title},${book.author},${book.description || ''},${book.genre},${'MEC — Domínio Público'},${''},0,0,1,
          ${'lavender-mint'},${Date.now()},${book.pdfPath},${book.coverUrl || null},0,${''},
          ${book.ipr},${'MEC Domínio Público'},${book.sourceUrl},${book.licenseStatus},${book.pdfSha256},${Date.now()}
        )
      `);
      return id;
    },
    saveCheckpoint,
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  await initDB();
  const allCandidates = loadCuratedManifest();
  const manifest = options.limit ? allCandidates.slice(0, options.limit) : allCandidates;
  const checkpoint = options.resume ? await readCheckpoint() : { completed: [] };
  const report = await runCatalogImport({
    ...options,
    manifest,
    checkpoint,
    deps: createProductionDeps(),
    onItem: (item) => console.log(JSON.stringify(item)),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { STATE_PATH, parseOptions, readCheckpoint, saveCheckpoint, createStorage, createProductionDeps, main, candidateId };
