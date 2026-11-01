const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {allowedCoverHost,extractCoverPalette,paletteFromPixels}=require('../cover-palette');
test('extracts a real red accent from a mostly gray PNG with no browser CORS dependency',async()=>{
 const pixels=Buffer.alloc(24*36*4);for(let i=0;i<pixels.length;i+=4){const red=i<pixels.length*.15;pixels[i]=red?180:130;pixels[i+1]=red?25:130;pixels[i+2]=red?30:130;pixels[i+3]=255;}
 const png=await sharp(pixels,{raw:{width:24,height:36,channels:4}}).png().toBuffer();
 const palette=await extractCoverPalette('https://books.supabase.co/storage/v1/object/public/covers/gray-red.png',{fetchImpl:async(url,options)=>{assert.equal(url.hostname,'books.supabase.co');assert.equal(options.redirect,'error');return new Response(png);}});
 assert.equal(palette.base,'#b4191e');assert.equal(palette.ink,'#ffffff');
 assert.equal(paletteFromPixels(Buffer.from([130,130,130,255])).base,'#828282');
});
test('does not fetch arbitrary hosts, credentials, ports, or non-HTTPS destinations',async()=>{
 let calls=0;const options={env:{},fetchImpl:async()=>{calls++;throw new Error('Unexpected');}};
 for(const url of ['http://127.0.0.1/secret','https://example.com/cover','https://user:secret@books.supabase.co/cover','https://books.supabase.co:9999/cover','https://evil.supabase.co.attacker.test/cover'])await assert.rejects(extractCoverPalette(url,options),/autorizado/);
 assert.equal(calls,0);assert.equal(allowedCoverHost('cdn.library.test',{S3_PUBLIC_URL_PREFIX:'https://cdn.library.test/books'}),true);
});
test('rejects oversized responses, unsupported content and broken source images',async()=>{
 const url='https://books.supabase.co/cover';
 await assert.rejects(extractCoverPalette(url,{fetchImpl:async()=>new Response('x',{headers:{'content-length':String(9*1024*1024)}})}),/grande/);
 await assert.rejects(extractCoverPalette(url,{fetchImpl:async()=>new Response('not an image')}));
});
