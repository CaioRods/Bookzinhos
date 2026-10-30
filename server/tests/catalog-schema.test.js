const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');

function database() {
  const connection = new sqlite3.Database(':memory:');
  const db = { query: (query) => new Promise((resolve, reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error, rows) => error ? reject(error) : resolve(rows || []))) };
  return { db, close: () => new Promise((resolve) => connection.close(resolve)) };
}
const sql = (parts, ...values) => ({ text: parts.join('?'), values });

test('catalog migration is repeatable and backfills existing books to IPR 80-100', async () => {
  const { ensureCatalogImportSchema } = require('../catalog-schema');
  const { db, close } = database();
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT,author TEXT,added_at INTEGER)');
  await db.query("INSERT INTO books VALUES ('a','Dom Casmurro','Machado de Assis',1)");
  await ensureCatalogImportSchema({ db, sql });
  await ensureCatalogImportSchema({ db, sql });
  const [book] = await db.query('SELECT ipr,source_name,source_url,pdf_sha256,license_status FROM books');
  assert.ok(book.ipr >= 80 && book.ipr <= 100);
  assert.equal(book.source_name, '');
  await close();
});

test('imported books keep their curated low IPR during a replay', async () => {
  const { ensureCatalogImportSchema } = require('../catalog-schema');
  const { db, close } = database();
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT,author TEXT,added_at INTEGER)');
  await ensureCatalogImportSchema({ db, sql });
  await db.query("INSERT INTO books(id,title,author,added_at,ipr,imported_at) VALUES('mec-1','Helena','Machado de Assis',1,22,100)");
  await ensureCatalogImportSchema({ db, sql });
  const [book] = await db.query("SELECT ipr FROM books WHERE id='mec-1'");
  assert.equal(book.ipr, 22);
  await close();
});
