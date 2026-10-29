const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const register = require('../characters');

function database() {
  const connection = new sqlite3.Database(':memory:');
  return {
    connection,
    db: { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows))) },
  };
}

test('one character identity can be linked to several ordered saga volumes', async (t) => {
  const { connection, db } = database();
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY, title TEXT, cover_image_path TEXT, series_id TEXT, series_name TEXT, series_order INTEGER)');
  await db.query("INSERT INTO books VALUES ('cruel','O Príncipe Cruel','/cruel.jpg','folk','O povo do ar',1),('wicked','O Rei Perverso','/wicked.jpg','folk','O povo do ar',2),('queen','A Rainha do Nada','/queen.jpg','folk','O povo do ar',3)");
  const app = express();
  app.use(express.json());
  const requireAdmin = (req, res, next) => req.get('x-user-id') === 'Admin' ? next() : res.sendStatus(403);
  const characters = register({ app, db, sql, upload: multer(), requireAdmin, uploadFileToCloud: async () => '/uploads/cardan.webp' });
  await characters.ready();
  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await new Promise((resolve) => connection.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  const create = new FormData();
  create.set('name', 'Cardan Greenbriar');
  create.set('bookIds', JSON.stringify(['cruel', 'queen']));
  create.set('image', new Blob(['image'], { type: 'image/webp' }), 'cardan.webp');
  assert.equal((await fetch(base + '/characters', { method: 'POST', headers: { 'x-user-id': 'Admin' }, body: create })).status, 201);

  const catalog = await (await fetch(base + '/characters')).json();
  assert.deepEqual(catalog.characters[0].bookIds.sort(), ['cruel', 'queen']);
  assert.equal(catalog.groups[0].seriesName, 'O povo do ar');
  assert.deepEqual(catalog.groups[0].books.map((book) => book.id), ['cruel', 'wicked', 'queen']);
  assert.equal(catalog.groups[0].books[0].coverImagePath, '/cruel.jpg');
  assert.equal(catalog.groups[0].characterIds.filter((id) => id === catalog.characters[0].id).length, 1);

  const reuse = new FormData();
  reuse.set('characterId', catalog.characters[0].id);
  reuse.set('name', 'Cardan Greenbriar');
  reuse.set('bookIds', JSON.stringify(['cruel', 'wicked', 'queen']));
  assert.equal((await fetch(base + '/characters', { method: 'POST', headers: { 'x-user-id': 'Admin' }, body: reuse })).status, 200);
  const reused = await (await fetch(base + '/characters')).json();
  assert.equal(reused.characters.length, 1);
  assert.deepEqual(reused.characters[0].bookIds.sort(), ['cruel', 'queen', 'wicked']);
});

test('legacy book link backfill is repeatable and invalid books are rejected', async (t) => {
  const { connection, db } = database();
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY, title TEXT, cover_image_path TEXT, series_id TEXT, series_name TEXT, series_order INTEGER)');
  await db.query("INSERT INTO books VALUES ('cruel','O Príncipe Cruel','/cruel.jpg','folk','O povo do ar',1)");
  await db.query('CREATE TABLE character_avatars(id TEXT PRIMARY KEY,name TEXT,book_id TEXT,image_url TEXT,created_at INTEGER)');
  await db.query("INSERT INTO character_avatars VALUES ('jude','Jude Duarte','cruel','/jude.webp',1)");
  const app = express();
  app.use(express.json());
  const requireAdmin = (_req, _res, next) => next();
  const characters = register({ app, db, sql, upload: multer(), requireAdmin, uploadFileToCloud: async () => '/new.webp' });
  await characters.ready();
  await characters.ready();
  assert.equal((await db.query("SELECT * FROM character_books WHERE character_id='jude' AND book_id='cruel'")).length, 1);

  const server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await new Promise((resolve) => connection.close(resolve)); });
  const body = new FormData(); body.set('name', 'Fantasma'); body.set('bookIds', JSON.stringify(['missing'])); body.set('image', new Blob(['x'], { type: 'image/webp' }), 'x.webp');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/characters`, { method: 'POST', body });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Livro não encontrado/);
});
