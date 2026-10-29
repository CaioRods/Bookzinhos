const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sqlite3 = require('sqlite3');
const registerProgressionRoutes = require('../progression-routes');
const { createProgressionService, ensureProgressionSchema } = require('../progression-service');

function memoryDb() {
  const connection = new sqlite3.Database(':memory:');
  const db = { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows))) };
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  return { connection, db, sql };
}

test('admin progression endpoints reject readers and audit valid changes', async (t) => {
  const { connection, db, sql } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE)');
  await db.query("INSERT INTO users VALUES ('Ana')");
  const progression = createProgressionService({ db, sql, now: () => 4_000 });
  await progression.ready();
  const app = express();
  app.use(express.json());
  const currentUser = (req) => req.get('x-user-id');
  const requireAdmin = (req, res, next) => currentUser(req) === 'Admin' ? next() : res.sendStatus(403);
  registerProgressionRoutes({ app, db, sql, currentUser, requireAdmin, progression, badges: { evaluateBadges: async () => [] } });
  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const payload = JSON.stringify({ amount: 50, reason: 'Bônus editorial' });
  assert.equal((await fetch(`${base}/admin/users/Ana/xp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': 'Ana' }, body: payload })).status, 403);
  const response = await fetch(`${base}/admin/users/Ana/xp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': 'Admin' }, body: payload });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).totalXp, 50);
  assert.equal((await db.query('SELECT * FROM admin_audit_log')).length, 1);
});

test('progression schema migration can be replayed safely', async (t) => {
  const { connection, db } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE)');
  await db.query("INSERT INTO users VALUES ('Legado')");
  await ensureProgressionSchema(db);
  await ensureProgressionSchema(db);
  const [row] = await db.query("SELECT * FROM user_progression WHERE username='Legado'");
  assert.equal(row.level, 1);
  assert.equal(row.total_xp, 0);
});

test('admin can grant and remove a badge with an audited reason', async (t) => {
  const { connection, db, sql } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE users(username TEXT PRIMARY KEY COLLATE NOCASE)');
  await db.query("INSERT INTO users VALUES ('Ana')");
  const progression = createProgressionService({ db, sql, now: () => 5_000 });
  await progression.ready();
  await db.query("INSERT INTO badge_definitions(code,name,description,category,threshold) VALUES('special','Especial','Concedido pela curadoria','manual',0)");
  const badges = {
    evaluateBadges: async () => [],
    listDefinitions: async () => db.query('SELECT * FROM badge_definitions'),
    grantBadge: async ({ username, code, admin, reason }) => {
      await db.query(sql`INSERT INTO admin_badges(username,badge_code,granted_by,reason,granted_at) VALUES(${username},${code},${admin},${reason},5000)`);
    },
    revokeBadge: async ({ username, code }) => db.query(sql`DELETE FROM admin_badges WHERE username=${username} AND badge_code=${code}`),
  };
  const app = express(); app.use(express.json());
  const currentUser = (req) => req.get('x-user-id');
  const requireAdmin = (req, res, next) => currentUser(req) === 'Admin' ? next() : res.sendStatus(403);
  registerProgressionRoutes({ app, db, sql, currentUser, requireAdmin, progression, badges });
  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const grant = await fetch(`${base}/admin/users/Ana/badges/special`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': 'Admin' }, body: JSON.stringify({ reason: 'Contribuição à comunidade' }) });
  assert.equal(grant.status, 200);
  assert.equal((await db.query("SELECT * FROM admin_badges WHERE username='Ana'")).length, 1);
  const revoke = await fetch(`${base}/admin/users/Ana/badges/special`, { method: 'DELETE', headers: { 'content-type': 'application/json', 'x-user-id': 'Admin' }, body: JSON.stringify({ reason: 'Correção administrativa' }) });
  assert.equal(revoke.status, 200);
  assert.equal((await db.query("SELECT * FROM admin_badges WHERE username='Ana'")).length, 0);
});
