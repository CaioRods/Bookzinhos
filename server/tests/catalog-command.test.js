const test = require('node:test');
const assert = require('node:assert/strict');

const done = { title: 'Done', author: 'Author', detailUrl: 'https://dominiopublico.mec.gov.br/pesquisa/DetalheObraForm.do?co_obra=1' };
const pending = { title: 'Pending', author: 'Author', detailUrl: 'https://dominiopublico.mec.gov.br/pesquisa/DetalheObraForm.do?co_obra=2' };

function fakeDeps() {
  return {
    uploadCalls: 0,
    insertCalls: 0,
    checkpoints: [],
    resolve: async (candidate) => ({ ...candidate, pdfUrl: `https://dominiopublico.mec.gov.br/download/${candidate.title}.pdf` }),
    download: async () => ({ bytes: Buffer.from('%PDF-test'), sha256: 'hash' }),
    findByMetadata: async () => null,
    findByHash: async () => null,
    upload: async function () { this.uploadCalls += 1; },
    publicUrl: (key) => `https://storage.example/${key}`,
    insert: async function () { this.insertCalls += 1; return 'new-book'; },
    remove: async () => {},
    saveCheckpoint: async function (checkpoint) { this.checkpoints.push(structuredClone(checkpoint)); },
  };
}

test('dry-run validates every candidate without upload or insertion', async () => {
  const { runCatalogImport } = require('../catalog-report');
  const deps = fakeDeps();
  const result = await runCatalogImport({ dryRun: true, manifest: [pending], deps });
  assert.equal(result.validated, 1);
  assert.equal(result.imported, 0);
  assert.equal(deps.uploadCalls, 0);
  assert.equal(deps.insertCalls, 0);
});

test('resume skips completed IDs and continues pending work', async () => {
  const { candidateId, runCatalogImport } = require('../catalog-report');
  const deps = fakeDeps();
  const checkpoint = { completed: [candidateId(done)] };
  const result = await runCatalogImport({ resume: true, manifest: [done, pending], checkpoint, deps });
  assert.deepEqual(result.attemptedIds, [candidateId(pending)]);
  assert.equal(result.imported, 1);
  assert.ok(checkpoint.completed.includes(candidateId(pending)));
  assert.equal(deps.checkpoints.length, 1);
});

test('continues after a candidate failure and reports sanitized errors', async () => {
  const { runCatalogImport } = require('../catalog-report');
  const deps = fakeDeps();
  deps.resolve = async (candidate) => {
    if (candidate === done) throw new Error('Página indisponível');
    return { ...candidate, pdfUrl: 'https://dominiopublico.mec.gov.br/download/test.pdf' };
  };
  const result = await runCatalogImport({ dryRun: true, manifest: [done, pending], deps });
  assert.equal(result.failed, 1);
  assert.equal(result.validated, 1);
  assert.deepEqual(result.errors, [{ id: result.attemptedIds[0], message: 'Página indisponível' }]);
});
