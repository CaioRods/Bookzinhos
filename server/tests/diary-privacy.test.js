const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

test('diaries and private books stay isolated by account across application routes', async (t) => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'bookzinhos-diary-'));
  const settings = {
    DATA_DIR: dataDir, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '',
    DOTENV_CONFIG_PATH: path.join(dataDir, 'no-env-file'),
    VERCEL: '1', ADMIN_INITIAL_PASSWORD: '', S3_ACCESS_KEY_ID: '', SUPABASE_URL: '',
    NODE_ENV: 'test', SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAMESITE: 'lax',
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dataDir, { recursive: true, force: true });
  });
  const app = require('../index');
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/health')).status, 200);
  const { db, sql, initDB } = require('../db');
  const { createSessionStore, buildSessionCookie } = require('../auth-session');
  await db.query(sql`INSERT INTO users (username, password) VALUES ('Ana', 'test'), ('Bia', 'test')`);
  await db.query(sql`INSERT INTO books (id, title, added_at) VALUES ('diary-book', 'Livro', 1)`);
  await db.query(sql`INSERT INTO notes (id, username, book_id, date_label, feedback, rating, created_at)
    VALUES ('ana-note', 'Ana', 'diary-book', '02/11', 'Segredo da Ana', 5, 1),
           ('bia-note', 'Bia', 'diary-book', '02/11', 'Segredo da Bia', 4, 2)`);
  const store = createSessionStore({ db });
  for (const [username, noteId] of [['ana', 'ana-note'], ['BIA', 'bia-note']]) {
    const { rawToken } = await store.create(username);
    const response = await fetch(base + '/notes/book/diary-book', { headers: { cookie: buildSessionCookie(rawToken) } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map(note => note.id), [noteId]);
  }
  assert.equal((await fetch(base + '/notes/book/diary-book')).status, 401);
  await db.query(sql`INSERT INTO book_reviews (book_id, username, rating, comment, created_at, updated_at)
    VALUES ('diary-book', 'Bia', 4, 'Resenha publicada por escolha', 2, 2)`);
  await initDB();
  await initDB();
  const reviews = await db.query(sql`SELECT username, comment FROM book_reviews`);
  assert.deepEqual(reviews, [{ username: 'Bia', comment: 'Resenha publicada por escolha' }]);
  assert.equal((await db.query(sql`SELECT id FROM notes`)).length, 2);

  await t.test('catalog, home, details, chapters and reviews respect book visibility', async () => {
    await db.query(sql`UPDATE users SET is_admin = 1 WHERE username = 'Bia'`);
    await db.query(sql`INSERT INTO users (username, password) VALUES ('Carol', 'test')`);
    await db.query(sql`INSERT INTO books (id, title, added_at, is_public, uploaded_by)
      VALUES ('private-book', 'Privado da Ana', 2, 0, 'Ana')`);
    await db.query(sql`INSERT INTO book_reviews (book_id, username, rating, comment, created_at, updated_at)
      VALUES ('private-book', 'Ana', 5, 'Resenha do livro privado', 3, 3)`);
    await db.query(sql`INSERT INTO review_comments (review_id, username, content, created_at)
      SELECT id, 'Carol', 'Comentário público', 4 FROM book_reviews WHERE book_id = 'diary-book'`);
    for (const [username, canRead] of [[null, false], ['Carol', false], ['ana', true], ['BIA', true]]) {
      const headers = username ? { cookie: buildSessionCookie((await store.create(username)).rawToken) } : {};
      const catalog = await (await fetch(base + '/books', { headers })).json();
      assert.equal(catalog.some(book => book.id === 'private-book'), canRead, `catalog for ${username}`);
      const home = await (await fetch(base + '/home', { headers })).json();
      assert.equal(home.books.some(book => book.id === 'private-book'), canRead, `home for ${username}`);
      assert.equal(home.recentReviews.some(review => review.bookId === 'private-book'), canRead, `reviews for ${username}`);
      const publicReview = home.recentReviews.find(review => review.bookId === 'diary-book');
      assert.equal(publicReview.book.title, 'Livro');
      assert.equal(publicReview.comments[0].username, 'Carol');
      for (const suffix of ['', '/chapters', '/reviews']) {
        assert.equal((await fetch(base + '/books/private-book' + suffix, { headers })).status, canRead ? 200 : 404, `${username}: ${suffix}`);
      }
    }
  });
});
