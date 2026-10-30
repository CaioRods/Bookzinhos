const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const candidate = {
  title: 'Dom Casmurro',
  author: 'Machado de Assis',
  genre: 'Romance realista',
  detailUrl: 'https://dominiopublico.mec.gov.br/pesquisa/DetalheObraForm.do?co_obra=1888&select_action=',
  licenseStatus: 'dominio-publico',
  ipr: 29,
};

function responseFor(body, status = 200) {
  return async () => new Response(body, { status, headers: { 'content-type': 'text/html; charset=UTF-8' } });
}

test('extracts required metadata and the official PDF link from a detail page', async () => {
  const { resolveMecBook } = require('../mec-catalog-adapter');
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/mec-detail.html'), 'utf8');
  const resolved = await resolveMecBook(candidate, { fetchImpl: responseFor(fixture) });
  assert.equal(resolved.title, 'Dom Casmurro');
  assert.equal(resolved.author, 'Machado de Assis');
  assert.equal(resolved.genre, 'Romance realista');
  assert.equal(resolved.description, '');
  assert.equal(resolved.pdfUrl, 'https://dominiopublico.mec.gov.br/pesquisa/DetalheObraDownload.do?co_midia=2&co_obra=1888&select_action=');
  assert.equal(resolved.sourceUrl, candidate.detailUrl);
});

test('prefers a useful official description when the page provides one', async () => {
  const { resolveMecBook } = require('../mec-catalog-adapter');
  const html = '<meta name="description" content="Um clássico sobre memória, ciúme e ambiguidade."><a href="/pesquisa/DetalheObraDownload.do?co_midia=2&amp;co_obra=1888">PDF</a>';
  const resolved = await resolveMecBook(candidate, { fetchImpl: responseFor(html) });
  assert.equal(resolved.description, 'Um clássico sobre memória, ciúme e ambiguidade.');
});

test('rejects pages without an official PDF and controlled-access pages', async () => {
  const { resolveMecBook } = require('../mec-catalog-adapter');
  await assert.rejects(resolveMecBook(candidate, { fetchImpl: responseFor('<html>sem download</html>') }), /PDF oficial não encontrado/);
  const controlled = '<p>Faça login para empréstimo controlado</p><a href="DetalheObraDownload.do?co_obra=1888">Baixar</a>';
  await assert.rejects(resolveMecBook(candidate, { fetchImpl: responseFor(controlled) }), /Acesso controlado/);
});

test('rejects unavailable detail pages', async () => {
  const { resolveMecBook } = require('../mec-catalog-adapter');
  await assert.rejects(resolveMecBook(candidate, { fetchImpl: responseFor('indisponível', 503) }), /Página MEC indisponível: 503/);
});
