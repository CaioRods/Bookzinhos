const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');
const express = require('express');
const { registerPublicProfileRoutes } = require('../public-profiles');

async function fixture(t) {
  const connection = new sqlite3.Database(':memory:');
  const queries = [];
  const db = { query: query => { queries.push(query); return new Promise((resolve,reject) => connection.all(typeof query === 'string' ? query : query.text, query.values || [], (error,rows) => error ? reject(error) : resolve(rows))); } };
  const sql = (parts,...values) => ({text:parts.join('?'),values});
  await db.query(`CREATE TABLE users(username TEXT, display_name TEXT, full_name TEXT, handle TEXT, bio TEXT, avatar TEXT, favorite_genres TEXT, instagram_handle TEXT, tiktok_handle TEXT, profile_theme_id TEXT, shelf TEXT, pandinhas INTEGER, email TEXT, password TEXT, is_admin INTEGER)`);
  await db.query(`INSERT INTO users VALUES ('Reader','<script>alert(1)</script>','Name','reader','Bio','avatar.png','["Fantasy"]','insta','tik','forest','["public","private"]',42,'secret@example.com','credential-secret',1)`);
  await db.query(`CREATE TABLE books(id TEXT,title TEXT,author TEXT,description TEXT,genre TEXT,rating REAL,review_count INTEGER,is_public INTEGER,cover_color TEXT,cover_image_path TEXT,uploaded_by TEXT,pdf_path TEXT,epub_path TEXT)`);
  await db.query(`INSERT INTO books VALUES ('public','Public title','Author','Description','Fantasy',4,1,1,'mint','cover.png','Reader','full-secret.pdf','full-secret.epub'),('private','PRIVATE TITLE','Author','PRIVATE CONTENT','Fantasy',5,1,0,'mint','PRIVATE ASSET','Reader','PRIVATE PDF','PRIVATE EPUB'),('unrelated','Unrelated','Author','','',0,0,1,'mint',null,'Other',null,null)`);
  await db.query(`CREATE TABLE follows(follower TEXT,following TEXT)`);
  await db.query(`INSERT INTO follows VALUES ('Someone','Reader'),('Reader','Other')`);
  await db.query(`CREATE TABLE saved_books(username TEXT,book_id TEXT)`);
  await db.query(`INSERT INTO saved_books VALUES ('Reader','public'),('Reader','private')`);
  await db.query(`CREATE TABLE reading_progress(username TEXT,book_id TEXT,status TEXT,progress REAL,last_read_at INTEGER)`);
  await db.query(`INSERT INTO reading_progress VALUES ('Reader','public','finalizado',100,123),('Reader','private','lendo',37,456)`);
  const app = express();
  let reviewArgs;
  registerPublicProfileRoutes({app,db,sql,loadReviews:async args => { reviewArgs=args; return [{id:1,bookId:'public',username:'Reader',rating:4,comment:'Review',createdAt:1,likes:2,comments:[],isAdmin:true,email:'hidden'}, {id:2,bookId:'private',comment:'PRIVATE REVIEW'}]; }});
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => connection.close(resolve)); });
  return {get: name => fetch(`http://127.0.0.1:${server.address().port}/public/profiles/${encodeURIComponent(name)}`), args:()=>reviewArgs, db, queries};
}

test('anonymous HTTP profile exposes an allowlisted public identity and only public books', async t => {
  const f=await fixture(t); const res=await f.get('rEaDeR'); assert.equal(res.status,200); assert.equal(res.headers.get('cache-control'),'no-store');
  const body=await res.json(); const {profile,books}=body;
  assert.equal(profile.username,'Reader'); assert.equal(profile.displayName,'<script>alert(1)</script>');
  assert.equal(profile.themeId,'forest'); assert.equal(profile.pandinhas,42); assert.equal(profile.followers,1); assert.equal(profile.following,1);
  assert.deepEqual(profile.favoriteGenres,['Fantasy']); assert.equal(profile.instagram,'insta'); assert.equal(profile.tiktok,'tik');
  assert.deepEqual(profile.shelf,['public']); assert.deepEqual(profile.savedIds,['public']); assert.deepEqual(profile.finishedIds,['public']); assert.deepEqual(profile.reading,[]);
  assert.deepEqual(profile.stats,{uploaded:1,finished:1,reading:0,reviews:1,saved:1});
  const metadataQueries=f.queries.filter(q => typeof q === 'object' && /SELECT id, title, author, description/.test(q.text));
  assert.ok(metadataQueries.length > 0);
  assert.ok(metadataQueries.every(q => /id IN \(/.test(q.text)), 'book metadata query must restrict catalog IDs');
  assert.deepEqual(books.map(b=>b.id),['public']); assert.equal(profile.reviews.length,1); assert.equal(profile.reviews[0].comment,'Review');
  assert.deepEqual(f.args(),{username:'Reader',me:null,limit:30});
  const serialized=JSON.stringify(body);
  for (const secret of ['private','PRIVATE','secret@example.com','credential-secret','full-secret','email','password','isAdmin','followerNames','followingNames','progress','lastReadAt','pdfPath','epubPath']) assert.ok(!serialized.includes(secret),secret);
});

test('missing and SQL-shaped usernames are data, never queries', async t => {
  const f=await fixture(t);
  assert.equal((await f.get('missing')).status,404);
  assert.equal((await f.get("Reader' OR 1=1 --")).status,404);
  await f.db.query({text:'UPDATE users SET username=?, handle=?',values:['<img src=x onerror=alert(1)>','evil']});
  const res=await f.get('<img src=x onerror=alert(1)>'); assert.equal(res.status,200); assert.match(res.headers.get('content-type'),/application\/json/); assert.equal((await res.json()).profile.username,'<img src=x onerror=alert(1)>');
});

test('malformed shelf/genres cannot introduce fields and errors never expose database details', async t => {
  const f=await fixture(t);
  await f.db.query(`UPDATE users SET shelf='{"private":"PRIVATE TITLE"}',favorite_genres='not json'`);
  let res=await f.get('Reader'); let body=await res.json();
  assert.deepEqual(body.profile.shelf,[]); assert.deepEqual(body.profile.favoriteGenres,[]);
  await f.db.query('DROP TABLE saved_books');
  res=await f.get('Reader'); assert.equal(res.status,500); assert.equal(res.headers.get('cache-control'),'no-store');
  body=await res.json(); assert.deepEqual(body,{error:'Não foi possível carregar o perfil público.'});
});

test('shelf IDs are bound parameters and unrelated catalog books stay excluded', async t => {
  const f=await fixture(t);
  const malicious="public') OR 1=1 --";
  await f.db.query({text:'UPDATE users SET shelf=?',values:[JSON.stringify([malicious])]});
  await f.get('Reader');
  const query=f.queries.find(q => typeof q === 'object' && /SELECT id, title, author, description/.test(q.text));
  assert.ok(query.values.includes(malicious)); assert.ok(!query.text.includes(malicious));
  await f.db.query('DELETE FROM saved_books'); await f.db.query('DELETE FROM reading_progress');
  await f.db.query("UPDATE users SET shelf='[]'");
  // Fixture still supplies a public reviewed book, so exactly that ID remains eligible.
  const body=await (await f.get('Reader')).json();
  assert.deepEqual(body.books.map(book=>book.id),['public']);
  assert.ok(!JSON.stringify(body).includes('Unrelated'));
});
