const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const sqlite3=require('sqlite3');
const register=require('../book-share');
test('shared books render a safe read-only public page, metadata and account handoff',async t=>{
 const connection=new sqlite3.Database(':memory:');
 const db={query:q=>new Promise((resolve,reject)=>connection.all(typeof q==='string'?q:q.text,q.values||[],(e,rows)=>e?reject(e):resolve(rows)))};
 const sql=(parts,...values)=>({text:parts.join('?'),values});
 await db.query('CREATE TABLE books(id TEXT,title TEXT,author TEXT,description TEXT,genre TEXT,publisher TEXT,published_year TEXT,cover_image_path TEXT,is_public INTEGER,pdf_path TEXT)');
 await db.query(sql`INSERT INTO books VALUES ('public','Livro <script>alert(1)</script>','Autor','Uma sinopse <img src=x onerror=alert(1)>','Fantasia','Editora','2026','https://covers.example/cover.jpg',1,'SECRET-PDF')`);
 await db.query("INSERT INTO books(id,title,is_public) VALUES ('private','SECRET-TITLE',0)");
 await db.query('CREATE TABLE book_pages(book_id TEXT,content TEXT)');
 await db.query("INSERT INTO book_pages VALUES ('public','SECRET-FULL-BOOK'),('public','SECRET-PAGE-2')");
 await db.query('CREATE TABLE book_reviews(book_id TEXT,username TEXT,rating REAL,comment TEXT,has_spoiler INTEGER,created_at INTEGER)');
 await db.query(sql`INSERT INTO book_reviews VALUES ('public','Ana',5,'Comentário <script>evil()</script>',0,1),('public','Bia',4,'O final é surpresa',1,2)`);
 const app=express();register({app,db,sql,currentUser:req=>req.get('x-test-user'),appOrigin:'https://app.example',assetOrigin:'https://api.example'});
 const listener=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
 t.after(async()=>{await new Promise(resolve=>listener.close(resolve));await new Promise(resolve=>connection.close(resolve));});
 const base='http://127.0.0.1:'+listener.address().port;
 const response=await fetch(base+'/share/book/public/livro-personalizado');const html=await response.text();
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.match(html,/og:image.*https:\/\/covers.example\/cover.jpg/);assert.match(html,/2 páginas/);assert.match(html,/4.5 · 2 avaliações/);
 assert.match(html,/Uma sinopse &lt;img/);assert.match(html,/Comentário &lt;script&gt;/);assert.match(html,/<details><summary>Este comentário contém spoilers/);
 assert.match(html,/auth=signup/);assert.match(html,/auth=login/);assert.doesNotMatch(html,/SECRET|<script|<iframe|\/read\/|download=|pdf_path|pdfPath/);
 assert.match(response.headers.get('content-security-policy'),/script|default-src 'none'/);
 assert.match(response.headers.get('content-security-policy'),/https:\/\/covers.example/);
 for(const id of ['private','missing']){const r=await fetch(base+'/share/book/'+id);assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/SECRET-TITLE/);}
 const logged=await fetch(base+'/share/book/public',{headers:{'x-test-user':'Ana'},redirect:'manual'});assert.equal(logged.status,302);assert.equal(logged.headers.get('location'),'https://app.example/book/public');
});
test('missing metadata and invalid cover scheme render graceful fallbacks',()=>{
 const html=register.renderPreview({book:{id:'x',title:'Sem capa',cover_image_path:'javascript:alert(1)'},reviews:[],stats:{},pageCount:0,appOrigin:'https://app.example',assetOrigin:'https://api.example'});
 assert.match(html,/Páginas não informadas/);assert.match(html,/não tem uma sinopse/);assert.match(html,/primeiros comentários/);assert.doesNotMatch(html,/javascript:|og:image/);
});
