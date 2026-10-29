const crypto = require('crypto');
const { xpForLevel, levelForXp, readerTitle } = require('./progression-rules');

async function ensureProgressionSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS user_progression (
    username TEXT PRIMARY KEY COLLATE NOCASE, total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS xp_events (
    id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE, type TEXT NOT NULL,
    base_amount INTEGER NOT NULL, multiplier REAL NOT NULL DEFAULT 1, amount INTEGER NOT NULL,
    actor TEXT COLLATE NOCASE, entity_type TEXT, entity_id TEXT, idempotency_key TEXT NOT NULL UNIQUE,
    metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS xp_boosts (
    id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE, multiplier REAL NOT NULL,
    starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, source TEXT NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id TEXT PRIMARY KEY, admin_username TEXT NOT NULL COLLATE NOCASE, target_username TEXT NOT NULL COLLATE NOCASE,
    action TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_xp_events_user_date ON xp_events(username,created_at DESC)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_xp_boosts_user_end ON xp_boosts(username,ends_at)');
  await db.query(`INSERT OR IGNORE INTO user_progression(username,total_xp,level,updated_at)
    SELECT username,0,1,0 FROM users`);
}

function createProgressionService({ db, sql, now = Date.now }) {
  let pending;
  const ready = () => pending ||= ensureProgressionSchema(db);
  const summary = async (username, oldLevel = null, eventId = null) => {
    const [row] = await db.query(sql`SELECT * FROM user_progression WHERE username=${username} COLLATE NOCASE`);
    const totalXp = Number(row?.total_xp || 0);
    const level = levelForXp(totalXp);
    return { eventId, username, totalXp, oldLevel: oldLevel ?? level, newLevel: level, level, title: readerTitle(level), currentLevelXp: xpForLevel(level), nextLevelXp: level < 100 ? xpForLevel(level + 1) : xpForLevel(100) };
  };

  const awardXp = async (event) => {
    await ready();
    if (!event.username || !event.idempotencyKey) throw new Error('Usuário e chave idempotente são obrigatórios.');
    await db.query(sql`INSERT OR IGNORE INTO user_progression(username,total_xp,level,updated_at) VALUES(${event.username},0,1,${now()})`);
    const [before] = await db.query(sql`SELECT total_xp,level FROM user_progression WHERE username=${event.username} COLLATE NOCASE`);
    const existing = await db.query(sql`SELECT id FROM xp_events WHERE idempotency_key=${event.idempotencyKey}`);
    if (existing.length) return summary(event.username, Number(before.level), existing[0].id);
    const timestamp = now();
    const [boost] = await db.query(sql`SELECT MAX(multiplier) AS multiplier FROM xp_boosts WHERE username=${event.username} COLLATE NOCASE AND starts_at<=${timestamp} AND ends_at>${timestamp}`);
    const multiplier = event.ignoreBoost ? 1 : Math.max(1, Number(boost?.multiplier || 1));
    const baseAmount = Math.trunc(Number(event.baseAmount) || 0);
    const amount = Math.trunc(baseAmount * multiplier);
    const id = crypto.randomUUID();
    try {
      await db.query(sql`INSERT INTO xp_events(id,username,type,base_amount,multiplier,amount,actor,entity_type,entity_id,idempotency_key,metadata,created_at)
        VALUES(${id},${event.username},${event.type},${baseAmount},${multiplier},${amount},${event.actor || ''},${event.entityType || ''},${event.entityId || ''},${event.idempotencyKey},${JSON.stringify(event.metadata || {})},${timestamp})`);
    } catch (error) {
      if (!/unique|constraint/i.test(error.message)) throw error;
      return summary(event.username, Number(before.level));
    }
    const nextTotal = Math.max(0, Number(before.total_xp || 0) + amount);
    const nextLevel = levelForXp(nextTotal);
    await db.query(sql`UPDATE user_progression SET total_xp=${nextTotal},level=${nextLevel},updated_at=${timestamp} WHERE username=${event.username} COLLATE NOCASE`);
    return summary(event.username, Number(before.level), id);
  };

  const audit = async ({ admin, username, action, amount, reason, metadata = {} }) => {
    if (!String(reason || '').trim()) throw new Error('Informe o motivo do ajuste.');
    await db.query(sql`INSERT INTO admin_audit_log(id,admin_username,target_username,action,amount,reason,metadata,created_at)
      VALUES(${crypto.randomUUID()},${admin},${username},${action},${amount},${String(reason).trim()},${JSON.stringify(metadata)},${now()})`);
  };

  const adjustXpByAdmin = async ({ admin, username, amount, reason }) => {
    await ready();
    const [current] = await db.query(sql`SELECT total_xp FROM user_progression WHERE username=${username} COLLATE NOCASE`);
    const requested = Math.trunc(Number(amount) || 0);
    const actual = Math.max(-Number(current?.total_xp || 0), requested);
    const result = await awardXp({ username, type: 'admin_adjustment', baseAmount: actual, actor: admin, entityType: 'user', entityId: username, idempotencyKey: `admin:${crypto.randomUUID()}`, metadata: { reason }, ignoreBoost: true });
    await audit({ admin, username, action: 'adjust_xp', amount: actual, reason });
    return result;
  };

  const setLevelByAdmin = async ({ admin, username, level, reason }) => {
    const target = Math.trunc(Number(level));
    if (target < 1 || target > 100) throw new Error('O nível deve estar entre 1 e 100.');
    await ready();
    const [current] = await db.query(sql`SELECT total_xp FROM user_progression WHERE username=${username} COLLATE NOCASE`);
    const amount = xpForLevel(target) - Number(current?.total_xp || 0);
    const result = await awardXp({ username, type: 'admin_set_level', baseAmount: amount, actor: admin, entityType: 'user', entityId: username, idempotencyKey: `admin:${crypto.randomUUID()}`, metadata: { reason, target }, ignoreBoost: true });
    await audit({ admin, username, action: 'set_level', amount, reason, metadata: { target } });
    return result;
  };

  return { ready, awardXp, adjustXpByAdmin, setLevelByAdmin, summary };
}

module.exports = { createProgressionService, ensureProgressionSchema };
