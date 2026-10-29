const test = require('node:test');
const assert = require('node:assert/strict');
const { rewardDefinition } = require('../progression-events');

test('reward definitions block self-actions and apply daily limits', () => {
  assert.equal(rewardDefinition({ type: 'book_like', actor: 'Ana', beneficiary: 'Ana' }), null);
  assert.equal(rewardDefinition({ type: 'book_save', actor: 'Bia', beneficiary: 'Ana' }).amount, 6);
  assert.equal(rewardDefinition({ type: 'comment', actor: 'Bia', beneficiary: 'Bia', dailyCount: 5 }), null);
  assert.equal(rewardDefinition({ type: 'review', actor: 'Bia', beneficiary: 'Bia' }).amount, 12);
});
