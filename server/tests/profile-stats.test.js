const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { loadUploadedBookCount } = require('../profile-stats');

test('profiles count only books attributed to the account that uploaded them', async t => {
  const connection = new sqlite3.Database(':memory:');
  t.after(() => new Promise(resolve => connection.close(resolve)));
  const db = { query: query => new Promise((resolve,reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error,rows) => error ? reject(error) : resolve(rows))) };
  const sql = (parts,...values) => ({ text:parts.join('?'), values });
  await db.query("CREATE TABLE books(id TEXT PRIMARY KEY, title TEXT, uploaded_by TEXT)");
  await db.query("INSERT INTO books VALUES ('one','First','Caio'),('two','Second','caio'),('three','Third','Marina'),('import','General catalog',''),('legacy','Old book',NULL)");
  assert.equal(await loadUploadedBookCount({db,sql,username:'CAIO'}),2);
  assert.equal(await loadUploadedBookCount({db,sql,username:'Marina'}),1);
  assert.equal(await loadUploadedBookCount({db,sql,username:'OtherReader'}),0);
  await db.query("UPDATE books SET title='Edited by another reader' WHERE id='three'");
  assert.equal(await loadUploadedBookCount({db,sql,username:'Caio'}),2);
  await db.query("DELETE FROM books WHERE id='one'");
  assert.equal(await loadUploadedBookCount({db,sql,username:'Caio'}),1);
});
