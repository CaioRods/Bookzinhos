const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const sharp=require('sharp');
const {readProfileImage,registerPublicProfileImages}=require('../public-profile-images');
test('returns a real PNG from storage without browser CORS and refuses unsafe destinations',async()=>{
 const png=await sharp({create:{width:20,height:10,channels:3,background:'#e43a28'}}).png().toBuffer();
 const result=await readProfileImage('https://books.supabase.co/cover.png',{fetchImpl:async(url,options)=>{assert.equal(options.redirect,'error');return new Response(png);}});
 assert.equal((await sharp(result).metadata()).format,'png');
 for(const source of ['https://bookzinhos-production.up.railway.app/public/profiles/Ana/images/avatar','https://bookzinhos-server.vercel.app/api/public/profiles/Ana/images/banner','http://127.0.0.1/a','https://evil.test/a','https://books.supabase.co:999/a','https://a:b@books.supabase.co/a'])await assert.rejects(readProfileImage(source,{env:{},fetchImpl:()=>{throw new Error('must not fetch');}}),/autorizada/);
 await assert.rejects(readProfileImage('https://books.supabase.co/a',{fetchImpl:async()=>new Response('<svg/>')}));
 await assert.rejects(readProfileImage('https://books.supabase.co/a',{fetchImpl:async()=>new Response('x',{headers:{'content-length':String(9*1024*1024)}})}));
});
test('resolves banner, avatar and public cover from stored records, never a user URL or private book',async t=>{
 const calls=[];const app=express();
 const sql=(parts,...values)=>({text:parts.join('?'),values});
 const db={query:async({text,values})=>{
  if(text.includes('FROM users'))return values[0]==='missing'?[]:[{username:'Ana',avatar:'https://books.supabase.co/avatar.png',profile_theme_id:'theme1'}];
  if(text.includes('FROM books')){assert.match(text,/is_public=1/);return values[0]==='private'?[]:[{cover_image_path:'https://books.supabase.co/cover.png'}];}
  assert.match(text,/owner='' OR owner=/);return [{data:JSON.stringify({imageUrl:'https://books.supabase.co/banner.png'})}];
 }};
 registerPublicProfileImages({app,db,sql,readImage:async source=>{calls.push(source);return Buffer.from('PNG');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const get=path=>fetch(`http://127.0.0.1:${server.address().port}/public/profiles/${path}`);
 for(const kind of ['banner','avatar','cover/public']){const res=await get(`Ana/images/${kind}?url=https://evil.test`);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/image\/png/);}
 assert.deepEqual(calls,['https://books.supabase.co/banner.png','https://books.supabase.co/avatar.png','https://books.supabase.co/cover.png']);
 assert.equal((await get('Ana/images/cover/private')).status,404);assert.equal((await get('missing/images/avatar')).status,404);assert.equal(calls.length,3);
});
