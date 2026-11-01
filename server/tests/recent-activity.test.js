const {test}=require('node:test');const assert=require('node:assert/strict');const sqlite3=require('sqlite3');
const {createRecentActivityPrivacy}=require('../recent-activity');
async function setup(t){const connection=new sqlite3.Database(':memory:');t.after(()=>new Promise(resolve=>connection.close(resolve)));const sql=(parts,...values)=>({text:parts.join('?'),values});const db={query:query=>new Promise((resolve,reject)=>connection.all(typeof query==='string'?query:query.text,query.values||[],(error,rows)=>error?reject(error):resolve(rows)))};
 await db.query('CREATE TABLE follows(follower TEXT,following TEXT)');await db.query('CREATE TABLE books(id TEXT,is_public INTEGER)');await db.query('CREATE TABLE reading_progress(username TEXT,book_id TEXT,status TEXT,progress REAL,last_read_at INTEGER)');const service=createRecentActivityPrivacy({db,sql});await service.ready();return {db,sql,service};}
test('defaults off and requires both follows plus the activity owner opt-in, including case-insensitive accounts',async t=>{
 const {db,service}=await setup(t);assert.deepEqual(await service.get('Bob'),{shareRecentActivity:false});
 await db.query("INSERT INTO follows VALUES('Alice','Bob'),('Bob','Alice'),('Alice','Carol'),('Dave','Alice')");
 assert.deepEqual(await service.visibleAuthors('Alice'),[]);await service.set('Bob',true);await service.set('Carol',true);await service.set('Dave',true);
 assert.deepEqual(await service.visibleAuthors('ALICE'),['Bob']);assert.deepEqual(await service.visibleAuthors(null),[]);
 await service.set('bob',false);assert.deepEqual(await service.visibleAuthors('Alice'),[]);await service.set('Bob',true);
 await db.query("DELETE FROM follows WHERE follower='Bob'");assert.deepEqual(await service.visibleAuthors('Alice'),[]);
});
test('filters before limiting and never shares reading of private books',async t=>{
 const {db,service}=await setup(t);await db.query("INSERT INTO books VALUES('public',1),('private',0)");
 await db.query("INSERT INTO reading_progress VALUES('Bob','public','lendo',25,1),('Bob','private','lendo',50,1000),('Outsider','public','lendo',80,2000)");
 assert.equal((await service.reading(['bob'],'lendo',1))[0].book_id,'public');assert.deepEqual(await service.reading([],'lendo',10),[]);
});
