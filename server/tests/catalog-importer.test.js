const test = require('node:test');
const assert = require('node:assert/strict');

const candidate = { title: 'Dom Casmurro' };

function fakeDeps(options = {}) {
  const events = options.events || [];
  const deletedKeys = [];
  return {
    events,
    deletedKeys,
    resolve: async () => {
      events.push('resolve');
      return { title: 'Dom Casmurro', author: 'Machado de Assis', pdfUrl: 'https://dominiopublico.mec.gov.br/book.pdf' };
    },
    findByMetadata: async () => {
      events.push('metadata-check');
      return options.metadataMatch || null;
    },
    download: async () => {
      events.push('download');
      return { bytes: Buffer.from('%PDF-valid'), sha256: 'abc123' };
    },
    findByHash: async () => {
      events.push('hash-check');
      return options.hashMatch || null;
    },
    upload: async () => events.push('upload-pdf'),
    publicUrl: (key) => `https://storage.example/${key}`,
    insert: async (book) => {
      events.push('insert-book');
      assert.equal(book.pdfSha256, 'abc123');
      if (options.insertError) throw options.insertError;
      return 'mec-dom-casmurro';
    },
    remove: async (key) => {
      events.push('remove-pdf');
      deletedKeys.push(key);
    },
  };
}

test('does not create a book until its verified PDF is uploaded', async () => {
  const events = [];
  const { importCatalogBook } = require('../catalog-importer');
  const result = await importCatalogBook(candidate, fakeDeps({ events }));
  assert.deepEqual(events, ['resolve', 'metadata-check', 'download', 'hash-check', 'upload-pdf', 'insert-book']);
  assert.deepEqual(result, { status: 'imported', bookId: 'mec-dom-casmurro' });
});

test('returns duplicate before upload for metadata and PDF hash matches', async () => {
  const { importCatalogBook } = require('../catalog-importer');
  const metadataDeps = fakeDeps({ metadataMatch: { id: 'existing-meta' } });
  assert.deepEqual(await importCatalogBook(candidate, metadataDeps), { status: 'duplicate', bookId: 'existing-meta' });
  assert.deepEqual(metadataDeps.events, ['resolve', 'metadata-check']);

  const hashDeps = fakeDeps({ hashMatch: { id: 'existing-hash' } });
  assert.deepEqual(await importCatalogBook(candidate, hashDeps), { status: 'duplicate', bookId: 'existing-hash' });
  assert.deepEqual(hashDeps.events, ['resolve', 'metadata-check', 'download', 'hash-check']);
});

test('removes an uploaded object when database insertion fails', async () => {
  const { importCatalogBook } = require('../catalog-importer');
  const deps = fakeDeps({ insertError: new Error('db offline') });
  await assert.rejects(importCatalogBook(candidate, deps), /db offline/);
  assert.deepEqual(deps.deletedKeys, ['catalog/abc123.pdf']);
  assert.equal(deps.events.at(-1), 'remove-pdf');
});

test('rejects incomplete dependency contracts without writing', async () => {
  const { importCatalogBook } = require('../catalog-importer');
  await assert.rejects(importCatalogBook(candidate, {}), /Dependência ausente: resolve/);
});
