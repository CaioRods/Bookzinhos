const test = require('node:test');
const assert = require('node:assert/strict');

test('curated manifest contains only known official works with low IPR', () => {
  const { loadCuratedManifest } = require('../catalog-manifest');
  const books = loadCuratedManifest();
  assert.ok(books.length >= 20);
  assert.ok(books.every((book) => book.title && book.author && book.genre));
  assert.ok(books.every((book) => book.ipr >= 10 && book.ipr <= 29));
  assert.ok(books.every((book) => book.licenseStatus === 'dominio-publico'));
  assert.ok(books.every((book) => ['meclivros.mec.gov.br', 'dominiopublico.mec.gov.br'].includes(new URL(book.detailUrl).hostname)));
  assert.ok(books.every((book) => new URL(book.pdfUrl).hostname === 'dominiopublico.mec.gov.br'));
  assert.equal(new Set(books.map((book) => `${book.title}|${book.author}`.toLocaleLowerCase('pt-BR'))).size, books.length);
});

test('manifest entries are immutable copies', () => {
  const { loadCuratedManifest } = require('../catalog-manifest');
  const first = loadCuratedManifest()[0];
  assert.equal(Object.isFrozen(first), true);
  assert.throws(() => {
    'use strict';
    first.ipr = 99;
  }, TypeError);
});
