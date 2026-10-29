const test = require('node:test');
const assert = require('node:assert/strict');
const { badgeCodesForStats } = require('../badges');
const sqlite3 = require('sqlite3');
const { createBadgeService } = require('../badges');
const { ensureProgressionSchema } = require('../progression-service');

test('badge milestones include pioneer, reading, publishing and level achievements', () => {
  assert.deepEqual(badgeCodesForStats({ registrationOrder: 3, finished: 50, published: 10, level: 20, approvedThemes: 1 }), [
    'pioneer-3', 'pioneer-10', 'pioneer-100', 'published-10', 'read-10', 'read-50', 'theme-first', 'level-10', 'level-20',
  ]);
});

test('manually granted badges are visible, removable and audited', async (t) => {
  const connection = new sqlite3.Database(':memory:');
  const db = { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows))) };
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE, registration_order INTEGER, created_at INTEGER)');
  await db.query("INSERT INTO users VALUES('Ana',1,1)");
  await db.query('CREATE TABLE reading_sessions(username TEXT, rewarded INTEGER)');
  await db.query('CREATE TABLE books(uploaded_by TEXT)');
  await ensureProgressionSchema(db);
  const service = createBadgeService({ db, sql, now: () => 6_000 });
  await service.ready();
  let badges = await service.grantBadge({ username: 'Ana', code: 'level-100', admin: 'Admin', reason: 'Reconhecimento especial' });
  assert.equal(badges.find((badge) => badge.code === 'level-100').manual, 1);
  assert.equal((await db.query("SELECT * FROM admin_audit_log WHERE action='grant_badge'")).length, 1);
  badges = await service.revokeBadge({ username: 'Ana', code: 'level-100', admin: 'Admin', reason: 'Correção' });
  assert.equal(badges.some((badge) => badge.code === 'level-100'), false);
  assert.equal((await db.query("SELECT * FROM admin_audit_log WHERE action='revoke_badge'")).length, 1);
});
