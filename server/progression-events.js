const REWARDS = {
  book_publish: { amount: 120 }, book_like: { amount: 4, external: true }, book_save: { amount: 6, external: true },
  book_finish: { amount: 18, external: true }, share_author: { amount: 3, external: true }, share_actor: { amount: 1, dailyLimit: 10 },
  reading_complete: { amount: 80 }, review: { amount: 12 }, comment: { amount: 8, dailyLimit: 5 },
  chat_block: { amount: 2, dailyLimit: 10 }, theme_approved: { amount: 250 },
};

function rewardDefinition({ type, actor, beneficiary, dailyCount = 0 }) {
  const rule = REWARDS[type];
  if (!rule) return null;
  if (rule.external && String(actor).toLowerCase() === String(beneficiary).toLowerCase()) return null;
  if (rule.dailyLimit && Number(dailyCount) >= rule.dailyLimit) return null;
  return rule;
}

function createProgressionEvents({ progression }) {
  return { rewardForAction: async (action) => {
    const rule = rewardDefinition(action);
    if (!rule) return null;
    return progression.awardXp({ username: action.beneficiary, type: action.type, baseAmount: rule.amount, actor: action.actor, entityType: action.entityType, entityId: action.entityId, idempotencyKey: action.idempotencyKey, metadata: action.metadata });
  } };
}

module.exports = { REWARDS, rewardDefinition, createProgressionEvents };
