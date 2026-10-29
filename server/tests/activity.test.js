const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { createActivityService } = require('../activity');

function memoryDb() {
  const connection = new sqlite3.Database(':memory:');
  return { connection, db: { query: (q) => new Promise((resolve, reject) => connection.all(typeof q === 'string' ? q : q.text, q.values || [], (e, rows) => e ? reject(e) : resolve(rows))) }, sql: (p, ...v) => ({ text: p.join('?'), values: v }) };
}

test('heartbeats are capped and reading needs forty minutes plus every page', async (t) => {
  const { connection, db, sql } = memoryDb();
  t.after(() => new Promise((resolve) => connection.close(resolve)));
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY)');
  await db.query('CREATE TABLE book_pages(id INTEGER PRIMARY KEY,book_id TEXT,page_num INTEGER,content TEXT)');
  await db.query("INSERT INTO books VALUES('b1')");
  await db.query("INSERT INTO book_pages(book_id,page_num,content) VALUES('b1',1,'a'),('b1',2,'b')");
  const awards = [];
  const service = createActivityService({ db, sql, now: () => Date.UTC(2026, 9, 29), progression: { awardXp: async (event) => awards.push(event) } });
  await service.ready();
  assert.equal((await service.recordHeartbeat('Ana', { scope: 'reader', bookId: 'b1', page: 1, clientElapsedSeconds: 9999 })).creditedSeconds, 45);
  assert.equal((await service.readingEligibility('Ana', 'b1')).eligible, false);
  await db.query("UPDATE reading_sessions SET active_seconds=2399 WHERE username='Ana' AND book_id='b1'");
  await service.recordHeartbeat('Ana', { scope: 'reader', bookId: 'b1', page: 2, clientElapsedSeconds: 1 });
  assert.equal((await service.readingEligibility('Ana', 'b1')).eligible, true);
  assert.equal(awards.length, 1);
  await service.recordHeartbeat('Ana', { scope: 'reader', bookId: 'b1', page: 2, clientElapsedSeconds: 30 });
  assert.equal(awards.length, 1);
});
