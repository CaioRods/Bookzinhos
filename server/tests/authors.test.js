const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const { createAuthorRegistry, normalizeAuthor, authorNames } = require('../authors');
async function setup(t) {
  const connection = new sqlite3.Database(':memory:');
  t.after(() => new Promise(resolve => connection.close(resolve)));
  const db = { query: query => new Promise((resolve,reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error,rows) => error ? reject(error) : resolve(rows))) };
  await db.query('PRAGMA foreign_keys = ON');
  await db.query('CREATE TABLE books(id TEXT PRIMARY KEY, title TEXT, author TEXT, uploaded_by TEXT, is_public INTEGER, cover_image_path TEXT, added_at INTEGER)');
  await db.query("INSERT INTO books VALUES ('one','Livro um','José  Saramago','Alice',1,'/cover1.jpg',1),('two','Livro dois','jose saramago','Bob',1,'/cover2.jpg',2),('private','Privado','Autora privada','Alice',0,'/private.jpg',3)");
  const registry = createAuthorRegistry({ db }); await registry.ready(); return { db, registry };
}
test('backfills authors without duplicates and only exposes visible linked books', async t => {
  const { registry, db } = await setup(t); await createAuthorRegistry({db}).ready();
  assert.equal(normalizeAuthor(' José   Saramago '),'jose saramago');
  assert.deepEqual(authorNames('Autora A; Autor B; autora a'),['autora a','Autor B']);
  const bob = await registry.list('Bob'); assert.equal(bob.length,1); assert.equal(bob[0].bookCount,2);
  assert.ok(bob[0].books.every(book=>!book.title.includes('Privado')));
  const alice = await registry.list('Alice'); assert.equal(alice.length,2); assert.equal(alice.find(author=>author.name==='Autora privada').books[0].coverImagePath,'/private.jpg');
});
test('updates links and keeps the author available after books are removed', async t => {
  const { registry, db } = await setup(t);
  await db.query("UPDATE books SET author='Outra autora; Coautor' WHERE id='one'");
  await registry.replace('one','Outra autora; Coautor','Alice');
  const authors = await registry.list('Alice');
  assert.equal(authors.find(author=>normalizeAuthor(author.name)==='jose saramago').bookCount,1);
  assert.equal(authors.find(author=>author.name==='Coautor').books[0].id,'one');
  await db.query("DELETE FROM books WHERE id='one'");
  const after = await registry.list('Alice'); assert.equal(after.find(author=>author.name==='Coautor').bookCount,0);
  assert.ok(!(await registry.list('Bob')).some(author=>author.name==='Coautor'));
});
