# Curated MEC Public-Domain Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar um lote curado de obras conhecidas do MEC com PDF oficial, metadados organizados e IPR interno, sem duplicar ou publicar registros incompletos.

**Architecture:** Uma migração aditiva prepara os campos internos. Um manifesto versionado contém somente obras conhecidas; um adaptador restrito aos domínios oficiais resolve metadados e downloads, e um comando administrativo executa validação, upload e criação atômica do registro. O comando oferece `--dry-run`, checkpoint e relatório para que produção só seja alterada depois da simulação.

**Tech Stack:** Node.js CommonJS, SQLite/Turso, Supabase Storage, `node:test`, APIs nativas `fetch`, `crypto` e streams.

**Spec:** `docs/superpowers/specs/2026-10-29-mec-public-domain-import-design.md`

## Global Constraints

- Aceitar somente `meclivros.mec.gov.br` e `dominiopublico.mec.gov.br`, inclusive após redirecionamentos.
- Cadastrar somente depois de validar e armazenar um PDF oficial completo.
- Nunca copiar títulos contemporâneos sujeitos a login ou empréstimo controlado.
- IPR permanece interno: existentes em `80–100`, importados em `10–29`.
- Importação é repetível, retoma após falhas e não gera XP de publicação.
- Descrição é opcional; título, autor, gênero, PDF, fonte, licença e hash são obrigatórios.

## Review Focus

- Redirecionamento oficial que termina em domínio externo deve ser rejeitado antes do download.
- Resposta `200` com HTML disfarçado de PDF deve ser descartada sem upload ou registro.
- Mesmo PDF com título grafado de outro modo deve ser detectado pelo SHA-256.
- Falha após upload e antes do INSERT deve remover o objeto órfão ou registrá-lo para limpeza.
- Reexecução depois de sucesso parcial deve pular itens concluídos e retomar os restantes.

---

### Task 1: Migração interna e cálculo inicial do IPR

**Files:**
- Create: `server/catalog-schema.js`
- Create: `server/tests/catalog-schema.test.js`
- Modify: `server/db.js`

**Interfaces:**
- Consumes: `db.query(query)` e a tag `sql` existentes em `server/db.js`.
- Produces: `ensureCatalogImportSchema({ db, sql, now }): Promise<void>` e `backfillExistingIpr({ db, sql }): Promise<void>`.

- [ ] **Step 1: Write the failing migration tests**

```js
test('catalog schema migration is repeatable and keeps IPR internal', async () => {
  const { db, close } = memoryDatabase();
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT,author TEXT,added_at INTEGER)');
  await db.query("INSERT INTO books VALUES ('a','Dom Casmurro','Machado de Assis',1)");
  await ensureCatalogImportSchema({ db, sql, now: 1000 });
  await ensureCatalogImportSchema({ db, sql, now: 1000 });
  const [book] = await db.query('SELECT ipr,source_name,source_url,pdf_sha256,license_status FROM books');
  assert.equal(book.ipr >= 80 && book.ipr <= 100, true);
  await close();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd server && node --test tests/catalog-schema.test.js`
Expected: FAIL because `catalog-schema.js` does not exist.

- [ ] **Step 3: Implement the repeatable schema and deterministic backfill**

```js
async function ensureCatalogImportSchema({ db, sql, now = Date.now() }) {
  const columns = [
    ['ipr', 'INTEGER NOT NULL DEFAULT 90'],
    ['source_name', "TEXT NOT NULL DEFAULT ''"],
    ['source_url', "TEXT NOT NULL DEFAULT ''"],
    ['license_status', "TEXT NOT NULL DEFAULT ''"],
    ['pdf_sha256', "TEXT NOT NULL DEFAULT ''"],
    ['imported_at', 'INTEGER'],
  ];
  const info = await db.query('PRAGMA table_info(books)');
  for (const [name, definition] of columns) {
    if (!info.some((column) => column.name === name)) {
      await db.query({ text: `ALTER TABLE books ADD COLUMN ${name} ${definition}`, values: [] });
    }
  }
  await db.query(sql`UPDATE books SET ipr = 80 + (ABS(LENGTH(title) * 7 + LENGTH(author) * 3) % 21) WHERE imported_at IS NULL`);
  await db.query({ text: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_books_pdf_sha256 ON books(pdf_sha256) WHERE pdf_sha256 <> \'\'', values: [] });
}
```

- [ ] **Step 4: Wire the migration into `initDB` after `books` exists and run tests**

Run: `cd server && node --test tests/catalog-schema.test.js tests/security.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/catalog-schema.js server/tests/catalog-schema.test.js server/db.js
git commit -m "feat: add internal catalog import metadata"
```

### Task 2: Validador de fontes e PDFs oficiais

**Files:**
- Create: `server/catalog-source.js`
- Create: `server/tests/catalog-source.test.js`

**Interfaces:**
- Consumes: URL de detalhe/download e `fetchImpl` injetável.
- Produces: `assertAllowedSource(url): URL`, `downloadOfficialPdf({ url, fetchImpl, maxBytes }): Promise<{ bytes, sha256, contentType, finalUrl }>`.

- [ ] **Step 1: Write failing tests for allowlist, redirects, MIME, signature and size**

```js
test('rejects a redirect from MEC to a foreign host', async () => {
  const fetchImpl = async () => new Response(Buffer.from('%PDF-1.7'), {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
  });
  await assert.rejects(
    downloadOfficialPdf({ url: 'https://evil.example/book.pdf', fetchImpl }),
    /Fonte não permitida/,
  );
});

test('rejects HTML returned as PDF', async () => {
  const fetchImpl = async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(
    downloadOfficialPdf({ url: 'https://dominiopublico.mec.gov.br/download/texto/teste.pdf', fetchImpl }),
    /PDF inválido/,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd server && node --test tests/catalog-source.test.js`
Expected: FAIL because the source module does not exist.

- [ ] **Step 3: Implement strict URL and PDF validation**

```js
const ALLOWED_HOSTS = new Set(['meclivros.mec.gov.br', 'dominiopublico.mec.gov.br']);
function assertAllowedSource(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('Fonte não permitida');
  return url;
}
async function downloadOfficialPdf({ url, fetchImpl = fetch, maxBytes = 80 * 1024 * 1024 }) {
  assertAllowedSource(url);
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  assertAllowedSource(response.url || url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || bytes.length > maxBytes || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF inválido');
  return { bytes, sha256: require('crypto').createHash('sha256').update(bytes).digest('hex'), contentType: 'application/pdf', finalUrl: response.url || url };
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && node --test tests/catalog-source.test.js`
Expected: PASS for official PDF; PASS for every rejection case.

- [ ] **Step 5: Commit**

```bash
git add server/catalog-source.js server/tests/catalog-source.test.js
git commit -m "feat: validate official MEC PDF sources"
```

### Task 3: Manifesto curado de obras conhecidas

**Files:**
- Create: `server/catalog/mec-known-books.json`
- Create: `server/catalog-manifest.js`
- Create: `server/tests/catalog-manifest.test.js`

**Interfaces:**
- Consumes: JSON versionado com `title`, `author`, `genre`, `detailUrl`, `licenseStatus`, `ipr`.
- Produces: `loadCuratedManifest(): CuratedBook[]` validado e sem duplicatas.

- [ ] **Step 1: Write the failing manifest contract test**

```js
test('curated manifest contains only known official works with low IPR', () => {
  const books = loadCuratedManifest();
  assert.ok(books.length >= 20);
  assert.ok(books.every((book) => book.title && book.author && book.genre));
  assert.ok(books.every((book) => book.ipr >= 10 && book.ipr <= 29));
  assert.ok(books.every((book) => ['meclivros.mec.gov.br', 'dominiopublico.mec.gov.br'].includes(new URL(book.detailUrl).hostname)));
  assert.equal(new Set(books.map((book) => `${book.title}|${book.author}`.toLowerCase())).size, books.length);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd server && node --test tests/catalog-manifest.test.js`
Expected: FAIL because the manifest loader does not exist.

- [ ] **Step 3: Add the initial known-work candidates and strict loader**

The initial JSON must include only candidates verified on an official detail page, prioritizing: `Dom Casmurro`, `Memórias Póstumas de Brás Cubas`, `O Alienista`, `Helena`, `O Cortiço`, `O Guarani`, `A Pata da Gazela`, `Clara dos Anjos`, `Triste Fim de Policarpo Quaresma`, `A Falência`, `A Alma Encantadora das Ruas`, `O Navio Negreiro`, `Canção do Exílio`, `A Metamorfose`, `A Divina Comédia`, `Drácula`, `Frankenstein`, `Alice no País das Maravilhas`, `A Ilha do Tesouro` e `Viagens de Gulliver`. A obra entra no JSON somente após confirmar URL de detalhe, autoria, licença e download oficial; itens não confirmados são omitidos, não deixados incompletos.

```js
function loadCuratedManifest() {
  const books = require('./catalog/mec-known-books.json');
  const seen = new Set();
  return books.map((book) => {
    assertAllowedSource(book.detailUrl);
    if (!book.title || !book.author || !book.genre || book.ipr < 10 || book.ipr > 29) throw new Error('Manifesto inválido');
    const key = `${book.title.trim()}|${book.author.trim()}`.toLocaleLowerCase('pt-BR');
    if (seen.has(key)) throw new Error('Livro duplicado no manifesto');
    seen.add(key);
    return Object.freeze({ ...book });
  });
}
```

- [ ] **Step 4: Run tests**

Run: `cd server && node --test tests/catalog-manifest.test.js`
Expected: PASS with at least 20 verified candidates.

- [ ] **Step 5: Commit**

```bash
git add server/catalog/mec-known-books.json server/catalog-manifest.js server/tests/catalog-manifest.test.js
git commit -m "feat: add curated MEC classics manifest"
```

### Task 4: Resolver metadados e downloads das páginas oficiais

**Files:**
- Create: `server/mec-catalog-adapter.js`
- Create: `server/tests/mec-catalog-adapter.test.js`
- Create: `server/tests/fixtures/mec-detail.html`

**Interfaces:**
- Consumes: `CuratedBook.detailUrl` e HTML oficial.
- Produces: `resolveMecBook(candidate, { fetchImpl }): Promise<{ title, author, genre, description, pdfUrl, coverUrl, sourceUrl, licenseStatus, ipr }>`.

- [ ] **Step 1: Save a sanitized official-page fixture and write failing extraction tests**

```js
test('extracts required metadata and optional description from an official detail page', async () => {
  const resolved = await resolveMecBook(candidate, { fetchImpl: fixtureFetch('mec-detail.html') });
  assert.equal(resolved.title, 'Dom Casmurro');
  assert.equal(resolved.author, 'Machado de Assis');
  assert.equal(resolved.genre, 'Clássicos');
  assert.match(resolved.pdfUrl, /^https:\/\/dominiopublico\.mec\.gov\.br\//);
  assert.equal(typeof resolved.description, 'string');
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `cd server && node --test tests/mec-catalog-adapter.test.js`
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement extraction from embedded JSON/metadata before DOM fallback**

```js
async function resolveMecBook(candidate, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(assertAllowedSource(candidate.detailUrl), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Página MEC indisponível: ${response.status}`);
  const html = await response.text();
  const metadata = extractStructuredMetadata(html);
  const pdfUrl = metadata.pdfUrl || extractOfficialDownloadLink(html);
  assertAllowedSource(pdfUrl);
  return { ...candidate, description: metadata.description || '', pdfUrl, coverUrl: metadata.coverUrl || '', sourceUrl: candidate.detailUrl };
}
```

- [ ] **Step 4: Add tests for missing PDF and controlled-loan pages, then run tests**

Run: `cd server && node --test tests/mec-catalog-adapter.test.js tests/catalog-source.test.js`
Expected: PASS; controlled access and missing downloads are rejected.

- [ ] **Step 5: Commit**

```bash
git add server/mec-catalog-adapter.js server/tests/mec-catalog-adapter.test.js server/tests/fixtures/mec-detail.html
git commit -m "feat: resolve public MEC book metadata"
```

### Task 5: Armazenamento e importação atômica

**Files:**
- Create: `server/catalog-importer.js`
- Create: `server/tests/catalog-importer.test.js`
- Modify: `server/index.js` (export a reusable server-side storage uploader without adding a public route)

**Interfaces:**
- Consumes: `resolveMecBook`, `downloadOfficialPdf`, `uploadCatalogAsset`, `db`, `sql`.
- Produces: `importCatalogBook(candidate, deps): Promise<{ status: 'imported'|'duplicate'|'skipped', bookId?: string, reason?: string }>`.

- [ ] **Step 1: Write failing tests for atomic success, metadata duplicate, hash duplicate and upload cleanup**

```js
test('does not create a book until its PDF is uploaded', async () => {
  const events = [];
  const result = await importCatalogBook(candidate, fakeDeps({ events }));
  assert.deepEqual(events, ['resolve', 'download', 'hash-check', 'upload-pdf', 'insert-book']);
  assert.equal(result.status, 'imported');
});

test('removes an uploaded object when database insertion fails', async () => {
  const deps = fakeDeps({ insertError: new Error('db offline') });
  await assert.rejects(importCatalogBook(candidate, deps), /db offline/);
  assert.equal(deps.deletedKeys.length, 1);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd server && node --test tests/catalog-importer.test.js`
Expected: FAIL because the importer does not exist.

- [ ] **Step 3: Implement duplicate checks and atomic ordering**

```js
async function importCatalogBook(candidate, deps) {
  const resolved = await deps.resolve(candidate);
  const metadataMatch = await deps.findByMetadata(resolved.title, resolved.author);
  if (metadataMatch) return { status: 'duplicate', bookId: metadataMatch.id };
  const pdf = await deps.download(resolved.pdfUrl);
  const hashMatch = await deps.findByHash(pdf.sha256);
  if (hashMatch) return { status: 'duplicate', bookId: hashMatch.id };
  const key = `catalog/${pdf.sha256}.pdf`;
  await deps.upload(key, pdf.bytes, 'application/pdf');
  try {
    const bookId = await deps.insert({ ...resolved, pdfPath: deps.publicUrl(key), pdfSha256: pdf.sha256 });
    return { status: 'imported', bookId };
  } catch (error) {
    await deps.remove(key);
    throw error;
  }
}
```

- [ ] **Step 4: Run importer and regression tests**

Run: `cd server && node --test tests/catalog-importer.test.js tests/catalog-source.test.js tests/catalog-schema.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/catalog-importer.js server/tests/catalog-importer.test.js server/index.js
git commit -m "feat: import validated catalog books atomically"
```

### Task 6: Comando administrativo, dry-run e checkpoint

**Files:**
- Create: `server/scripts/import-mec-catalog.js`
- Create: `server/catalog-report.js`
- Create: `server/tests/catalog-command.test.js`
- Modify: `server/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `loadCuratedManifest`, `importCatalogBook`, opções `--dry-run`, `--limit=N`, `--resume`.
- Produces: `server/data/catalog-import-state.json` local ignorado e relatório JSON/console.

- [ ] **Step 1: Write failing command tests**

```js
test('dry-run validates every candidate without upload or insertion', async () => {
  const result = await runCatalogImport({ dryRun: true, manifest: [candidate], deps });
  assert.equal(result.validated, 1);
  assert.equal(deps.uploadCalls, 0);
  assert.equal(deps.insertCalls, 0);
});

test('resume skips completed IDs and continues failed work', async () => {
  const result = await runCatalogImport({ resume: true, manifest: [done, pending], checkpoint, deps });
  assert.deepEqual(result.attemptedIds, [pending.id]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd server && node --test tests/catalog-command.test.js`
Expected: FAIL because command functions do not exist.

- [ ] **Step 3: Implement command and package script**

```json
{
  "scripts": {
    "catalog:mec": "node scripts/import-mec-catalog.js",
    "catalog:mec:dry": "node scripts/import-mec-catalog.js --dry-run"
  }
}
```

The command prints one line per item and a final JSON summary with `validated`, `imported`, `duplicates`, `skipped`, `failed` and `errors`.

- [ ] **Step 4: Run unit suite and local dry-run**

Run: `cd server && node --test tests/*.test.js`
Expected: all tests PASS.

Run: `cd server && npm run catalog:mec:dry -- --limit=5`
Expected: five official candidates validated; zero uploads and zero inserts.

- [ ] **Step 5: Commit**

```bash
git add server/scripts/import-mec-catalog.js server/catalog-report.js server/tests/catalog-command.test.js server/package.json .gitignore
git commit -m "feat: add resumable MEC catalog command"
```

### Task 7: Production simulation, import and verification

**Files:**
- Create: `docs/catalog-imports/2026-10-29-mec-part-1.json`
- Modify only if defects are found: importer files owned by Tasks 2–6

**Interfaces:**
- Consumes: production environment variables already configured for Turso/Supabase and the administrative command.
- Produces: immutable import report with no secrets and a verified production catalog.

- [ ] **Step 1: Run the full verification gate**

Run: `cd server && node --test tests/*.test.js`
Expected: all tests PASS.

Run: `cd frontend && npm run test:run && npm run typecheck && npm run build`
Expected: all commands PASS.

- [ ] **Step 2: Run production dry-run with the entire curated manifest**

Run in the deployment environment: `npm run catalog:mec:dry`
Expected: zero writes; every candidate classified as valid, duplicate or skipped with an explicit reason.

- [ ] **Step 3: Review dry-run output and execute the import**

Run in the deployment environment: `npm run catalog:mec -- --resume`
Expected: only validated non-duplicates are uploaded and inserted.

- [ ] **Step 4: Verify production records and files**

Check that every imported record has non-empty `pdf_path`, official `source_url`, `pdf_sha256`, `license_status`, `ipr BETWEEN 10 AND 29`, and that the PDF URL returns `%PDF-`. Confirm that public `/books` responses do not expose `ipr`, `pdf_sha256` or license internals.

- [ ] **Step 5: Save the sanitized report and commit**

```bash
git add docs/catalog-imports/2026-10-29-mec-part-1.json
git commit -m "docs: record first MEC catalog import"
```

- [ ] **Step 6: Fetch, rebase without force, and push**

```bash
git fetch origin
git rebase origin/main
git push origin main
```
