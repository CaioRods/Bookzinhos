const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { createProgressionService } = require('../progression-service');

function memoryDb() {
  const connection = new sqlite3.Database(':memory:');
  return {
    connection,
    db: { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows))) },
    sql: (parts, ...values) => ({ text: parts.join('?'), values }),
  };
}

test('award ledger is idempotent and applies an active boost once', async (t) => {
  const { connection, db, sql } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE)');
  await db.query("INSERT INTO users VALUES ('Ana')");
  const service = createProgressionService({ db, sql, now: () => 1_000 });
  await service.ready();
  await db.query("INSERT INTO xp_boosts(id,username,multiplier,starts_at,ends_at,source) VALUES('boost','Ana',2,0,2000,'theme')");
  const event = { username: 'Ana', type: 'review', baseAmount: 12, actor: 'Ana', entityType: 'book', entityId: 'b1', idempotencyKey: 'review:ana:b1' };
  const first = await service.awardXp(event);
  const duplicate = await service.awardXp(event);
  assert.equal(first.totalXp, 24);
  assert.equal(duplicate.totalXp, 24);
  assert.equal((await db.query("SELECT * FROM xp_events WHERE idempotency_key='review:ana:b1'")).length, 1);
});

test('admin level changes are audited and invalid levels are rejected', async (t) => {
  const { connection, db, sql } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE)');
  await db.query("INSERT INTO users VALUES ('Ana')");
  const service = createProgressionService({ db, sql, now: () => 2_000 });
  await service.ready();
  await assert.rejects(() => service.setLevelByAdmin({ admin: 'Admin', username: 'Ana', level: 101, reason: 'teste' }), /entre 1 e 100/);
  const result = await service.setLevelByAdmin({ admin: 'Admin', username: 'Ana', level: 30, reason: 'migração' });
  assert.equal(result.newLevel, 30);
  assert.equal((await db.query('SELECT * FROM admin_audit_log')).length, 1);
});
