const test = require('node:test');
const assert = require('node:assert/strict');

const OFFICIAL_PDF = 'https://dominiopublico.mec.gov.br/download/texto/teste.pdf';

test('accepts only HTTPS URLs on the two official MEC hosts', () => {
  const { assertAllowedSource } = require('../catalog-source');
  assert.equal(assertAllowedSource(OFFICIAL_PDF).hostname, 'dominiopublico.mec.gov.br');
  assert.equal(assertAllowedSource('https://meclivros.mec.gov.br/livro').hostname, 'meclivros.mec.gov.br');
  assert.throws(() => assertAllowedSource('http://dominiopublico.mec.gov.br/teste.pdf'), /Fonte não permitida/);
  assert.throws(() => assertAllowedSource('https://evil.example/teste.pdf'), /Fonte não permitida/);
  assert.throws(() => assertAllowedSource('not a url'), /Fonte não permitida/);
});

test('rejects a redirect from MEC to a foreign host', async () => {
  const { downloadOfficialPdf } = require('../catalog-source');
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    url: 'https://evil.example/book.pdf',
    headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: async () => Buffer.from('%PDF-1.7 valid'),
  });
  await assert.rejects(downloadOfficialPdf({ url: OFFICIAL_PDF, fetchImpl }), /Fonte não permitida/);
});

test('rejects HTML returned as PDF', async () => {
  const { downloadOfficialPdf } = require('../catalog-source');
  const fetchImpl = async () => new Response('<html>login</html>', {
    headers: { 'content-type': 'text/html' },
  });
  await assert.rejects(downloadOfficialPdf({ url: OFFICIAL_PDF, fetchImpl }), /PDF inválido/);
});

test('rejects oversized and non-successful PDF responses', async () => {
  const { downloadOfficialPdf } = require('../catalog-source');
  const oversized = async () => new Response(Buffer.from('%PDF-123456789'), {
    headers: { 'content-type': 'application/pdf' },
  });
  await assert.rejects(downloadOfficialPdf({ url: OFFICIAL_PDF, fetchImpl: oversized, maxBytes: 8 }), /PDF inválido/);
  const missing = async () => new Response(Buffer.from('%PDF-1.7'), {
    status: 404,
    headers: { 'content-type': 'application/pdf' },
  });
  await assert.rejects(downloadOfficialPdf({ url: OFFICIAL_PDF, fetchImpl: missing }), /PDF inválido/);
});

test('returns verified PDF bytes, hash and final official URL', async () => {
  const { createHash } = require('node:crypto');
  const { downloadOfficialPdf } = require('../catalog-source');
  const body = Buffer.from('%PDF-1.7 known classic');
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    url: OFFICIAL_PDF,
    headers: new Headers({ 'content-type': 'application/pdf; charset=binary' }),
    arrayBuffer: async () => body,
  });
  const result = await downloadOfficialPdf({ url: OFFICIAL_PDF, fetchImpl });
  assert.deepEqual(result.bytes, body);
  assert.equal(result.sha256, createHash('sha256').update(body).digest('hex'));
  assert.equal(result.contentType, 'application/pdf');
  assert.equal(result.finalUrl, OFFICIAL_PDF);
});
