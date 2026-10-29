const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HANDLE_CHANGE_DAYS,
  normalizeHandle,
  canChangeHandle,
  normalizeGenres,
} = require('../profile-rules');

test('normalizeHandle removes @ and lowercases a valid handle', () => {
  assert.equal(normalizeHandle('  @Jude.LeItora  '), 'jude.leitora');
  assert.equal(normalizeHandle('nome com espaço'), null);
});

test('handle can change initially and only after thirty days', () => {
  const now = Date.UTC(2026, 9, 29);
  assert.equal(canChangeHandle(0, now), true);
  assert.equal(canChangeHandle(now - (HANDLE_CHANGE_DAYS * 86400000 - 1), now), false);
  assert.equal(canChangeHandle(now - HANDLE_CHANGE_DAYS * 86400000, now), true);
});

test('normalizeGenres deduplicates, trims and limits preferences', () => {
  assert.deepEqual(normalizeGenres(['Fantasia', ' fantasia ', 'Romance', '', 'Mistério']), ['Fantasia', 'Romance', 'Mistério']);
  assert.equal(normalizeGenres(Array.from({ length: 20 }, (_, i) => `Gênero ${i}`)).length, 12);
});
