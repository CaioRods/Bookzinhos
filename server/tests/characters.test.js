const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const register = require('../characters');

test('characters are public, grouped by book and writable only by admin', async (t) => {
  const connection = new sqlite3.Database(':memory:');
  const db = { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows))) };
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY, title TEXT)');
  await db.query("INSERT INTO books VALUES ('folk-air', 'O Povo do Ar')");
  const app = express();
  const requireAdmin = (req, res, next) => req.get('x-user-id') === 'Admin' ? next() : res.sendStatus(403);
  await register({ app, db, sql, upload: multer(), requireAdmin, uploadFileToCloud: async () => '/uploads/jude.webp' }).ready();
  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await new Promise((resolve) => connection.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const body = new FormData(); body.set('name', 'Jude Duarte'); body.set('bookId', 'folk-air'); body.set('image', new Blob(['image'], { type: 'image/webp' }), 'jude.webp');
  assert.equal((await fetch(base + '/characters', { method: 'POST', body })).status, 403);
  assert.equal((await fetch(base + '/characters', { method: 'POST', headers: { 'x-user-id': 'Admin' }, body })).status, 201);
  const list = await (await fetch(base + '/characters?bookId=folk-air')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Jude Duarte');
  assert.equal(list[0].bookTitle, 'O Povo do Ar');
});
