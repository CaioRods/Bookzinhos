const test = require('node:test');
const assert = require('node:assert/strict');
const { badgeCodesForStats } = require('../badges');

test('badge milestones include pioneer, reading, publishing and level achievements', () => {
  assert.deepEqual(badgeCodesForStats({ registrationOrder: 3, finished: 50, published: 10, level: 20, approvedThemes: 1 }), [
    'pioneer-3', 'pioneer-10', 'pioneer-100', 'published-10', 'read-10', 'read-50', 'theme-first', 'level-10', 'level-20',
  ]);
});
