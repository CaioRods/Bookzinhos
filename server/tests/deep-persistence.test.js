const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

test('application persistence, permissions and concurrent requests with an isolated database', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bookzinhos-deep-'));
  const settings = { DATA_DIR: dir, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '', DOTENV_CONFIG_PATH: path.join(dir, 'no-env'), VERCEL: '1', ADMIN_INITIAL_PASSWORD: '', S3_ACCESS_KEY_ID: '', SUPABASE_URL: '', NODE_ENV: 'test', SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAMESITE: 'lax' };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(dir, { recursive: true, force: true });
  });
  const app = require('../index');
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/health')).status, 200);
  const { db, sql, initDB } = require('../db');
  const { createSessionStore, buildSessionCookie } = require('../auth-session');
  const store = createSessionStore({ db });
  await db.query(sql`INSERT INTO users (username, password) VALUES ('Ana', 'test'), ('Bia', 'test')`);
  await db.query(sql`INSERT INTO books (id,title,added_at,uploaded_by,is_public)
    VALUES ('public','Público',1,'Ana',1), ('private','Privado',2,'Ana',0)`);
  const cookie = buildSessionCookie((await store.create('Ana')).rawToken);
  const request = async (route, method = 'GET', body, selectedCookie = cookie) => {
    const response = await fetch(base + route, { method, headers: { cookie: selectedCookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const progress = (page, recordedAt) => ({ currentPage: page, totalPages: 20, progress: Math.round((page + 1) / 20 * 100), status: 'lendo', ...(recordedAt ? { _offlineRecordedAt: recordedAt } : {}) });

  await t.test('startup preserves duplicate editions and their attached records', async () => {
    await db.query(sql`INSERT INTO books (id,title,author,added_at,uploaded_by) VALUES ('edition-a','Mesmo título','Autor',3,'Ana'),('edition-b','Mesmo título','Autor',4,'Bia')`);
    await db.query(sql`INSERT INTO saved_books(username,book_id,saved_at) VALUES ('Bia','edition-b',1)`);
    await initDB();
    await initDB();
    assert.equal((await db.query(sql`SELECT id FROM books WHERE id IN ('edition-a','edition-b')`)).length, 2);
    assert.equal((await db.query(sql`SELECT book_id FROM saved_books WHERE username='Bia'`))[0].book_id, 'edition-b');
  });

  await t.test('later offline progress survives an earlier synchronization', async () => {
    const first = Date.now() - 10000;
    assert.equal((await request('/progress/public', 'PUT', progress(2, first))).status, 200);
    const latest = await request('/progress/public', 'PUT', progress(7, first + 1000));
    assert.equal(latest.status, 200);
    assert.equal(latest.body.currentPage, 7);
    const older = await request('/progress/public', 'PUT', progress(1, first));
    assert.equal(older.body.currentPage, 7);
  });

  await t.test('concurrent first progress writes do not fail with unique key conflicts', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, page) => request('/progress/edition-a', 'PUT', progress(page))));
    assert.ok(results.every(result => result.status === 200), JSON.stringify(results));
    assert.equal((await db.query(sql`SELECT * FROM reading_progress WHERE book_id='edition-a'`)).length, 1);
  });

  await t.test('invalid progress is rejected without corrupting the existing position', async () => {
    const initial = await request('/progress/public');
    for (const invalid of [ { currentPage: -1 }, { currentPage: 20 }, { currentPage: 1.5 }, { totalPages: 0 }, { totalPages: null }, { status: 'inventado' }, { progress: 101 } ]) {
      assert.equal((await request('/progress/public', 'PUT', { ...progress(3), ...invalid })).status, 400, JSON.stringify(invalid));
    }
    assert.equal((await request('/progress/public')).body.currentPage, initial.body.currentPage);
  });

  await t.test('private and missing books cannot be mutated by another reader', async () => {
    const otherCookie = buildSessionCookie((await store.create('Bia')).rawToken);
    for (const id of ['private', 'missing']) {
      const cases = [ [`/progress/${id}`, 'PUT', progress(1)], [`/saved/${id}`, 'POST', {}], ['/notes', 'POST', { bookId: id, feedback: 'Anotação', rating: 5 }], [`/books/${id}/reviews`, 'POST', { rating: 5, comment: 'Review' }], [`/books/${id}/open`, 'POST', {}] ];
      for (const [route, method, body] of cases) assert.equal((await request(route, method, body, otherCookie)).status, 404, route);
    }
    assert.equal((await db.query(sql`SELECT id FROM notes WHERE username='Bia'`)).length, 0);
  });

  await t.test('invalid ratings do not enter the diary or public averages', async () => {
    for (const rating of [-1, 0, 6, 'NaN', null]) {
      assert.equal((await request('/books/public/reviews', 'POST', { rating, comment: 'invalid' })).status, 400);
      assert.equal((await request('/notes', 'POST', { bookId: 'public', rating, feedback: 'invalid' })).status, 400);
    }
  });

  await t.test('private review interactions and reading activity require access to the book', async () => {
    await db.query(sql`INSERT INTO book_reviews(book_id,username,rating,comment,created_at,updated_at) VALUES ('private','Ana',5,'Privado',1,1)`);
    const [review] = await db.query(sql`SELECT id FROM book_reviews WHERE book_id='private'`);
    const otherCookie = buildSessionCookie((await store.create('Bia')).rawToken);
    for (const [route, body] of [[`/reviews/${review.id}/like`, {}], [`/reviews/${review.id}/comments`, {content:'Comentário'}], ['/activity/heartbeat', {scope:'reader',bookId:'private',page:1,clientElapsedSeconds:30}]]) {
      assert.equal((await request(route, 'POST', body, otherCookie)).status, 404, route);
    }
    assert.equal((await request('/reviews/999999/like', 'POST', {})).status, 404);
    assert.equal((await request(`/reviews/${review.id}/like`, 'POST', {})).status, 200);
  });

  await t.test('visitors can open public books without triggering an authentication error', async () => {
    assert.equal((await request('/books/public/open', 'POST', {}, '')).status, 200);
    assert.equal((await request('/books/private/open', 'POST', {}, '')).status, 404);
  });

  await t.test('concurrent uploads get unique IDs even in the same millisecond', async () => {
    const originalNow = Date.now;
    Date.now = () => 1800000000000;
    try {
      const results = await Promise.all(Array.from({ length: 8 }, (_, index) => request('/books', 'POST', { title: `Livro concorrente ${index}`, author: 'Autor teste', pdfUrl: 'https://example.invalid/test.pdf', isPublic: false })));
      assert.ok(results.every(result => result.status === 201), JSON.stringify(results));
      assert.equal(new Set(results.map(result => result.body.id)).size, 8);
    } finally { Date.now = originalNow; }
  });

  await t.test('revoking sessions matches usernames case-insensitively', async () => {
    const session = await store.create('aNa');
    await store.revokeAll('ANA');
    assert.equal(await store.resolve(session.rawToken), null);
  });

  await t.test('a deleted account cannot keep an authenticated session', async () => {
    await db.query(sql`INSERT INTO users(username,password) VALUES ('Deleted','test')`);
    const session = await store.create('Deleted');
    await db.query(sql`DELETE FROM users WHERE username='Deleted'`);
    assert.equal(await store.resolve(session.rawToken), null);
    assert.equal((await request('/saved', 'GET', undefined, buildSessionCookie(session.rawToken))).status, 401);
  });
});
