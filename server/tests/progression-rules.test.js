const test = require('node:test');
const assert = require('node:assert/strict');
const { xpForLevel, levelForXp, readerTitle } = require('../progression-rules');

test('progression curve is monotonic and round-trips every level', () => {
  let previous = -1;
  for (let level = 1; level <= 100; level += 1) {
    const requirement = xpForLevel(level);
    assert.ok(requirement > previous);
    assert.equal(levelForXp(requirement), level);
    previous = requirement;
  }
  assert.equal(levelForXp(xpForLevel(100) + 999999), 100);
});

test('reader titles change at approved decade boundaries', () => {
  assert.equal(readerTitle(1), 'Iniciante');
  assert.equal(readerTitle(10), 'Aprendiz');
  assert.equal(readerTitle(30), 'Curte leitura');
  assert.equal(readerTitle(100), 'Lenda literária');
});
