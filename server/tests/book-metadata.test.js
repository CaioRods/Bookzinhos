const test = require('node:test');
const assert = require('node:assert/strict');
const { createBookMetadata, mapGenres, plain, validIsbn, metadataFields } = require('../integrations/book-metadata');
const response = data => ({ok:true,text:async()=>JSON.stringify(data)});
test('maps categories, sanitizes descriptions and validates ISBN checksums',()=>{
  assert.deepEqual(mapGenres(['Fiction / Fantasy / Romance']),['Fantasia','Romance']);
  assert.equal(plain('<script>bad()</script><p>Uma &amp; outra</p>'),'Uma & outra');
  assert.equal(validIsbn('978-85-359-0277-8'),'9788535902778'); assert.equal(validIsbn('9788535902779'),null); assert.equal(validIsbn('0-306-40615-2'),'0306406152');
  assert.equal(metadataFields({metadataSource:'google',metadataId:'../../x',isbn:'invalid'}).source,'');
});
test('queries only Google Books with encoded parameters and caches searches',async()=>{
  const calls=[];const client=createBookMetadata({fetchImpl:async(url,options)=>{calls.push([url,options]);return response({items:[{id:'volume_1',volumeInfo:{title:'Livro',authors:['Autora'],categories:['Fantasy'],description:'<p>Sinopse</p>',industryIdentifiers:[{identifier:'0306406152'}]}}]});}});
  const books=await client.search({q:'Livro & outro',author:'Autora'}); assert.equal(books[0].description,'Sinopse'); assert.deepEqual(books[0].genres,['Fantasia']);
  await client.search({q:'Livro & outro',author:'Autora'}); assert.equal(calls.length,1); assert.equal(calls[0][0].hostname,'www.googleapis.com'); assert.ok(calls[0][0].searchParams.get('q').includes('Livro & outro')); assert.equal(calls[0][1].redirect,'error');
});
test('keeps Open Library work metadata distinct from edition-specific data',async()=>{
  const urls=[];const client=createBookMetadata({fetchImpl:async url=>{urls.push(url);return response(url.pathname.includes('search')?{docs:[{key:'/works/OL123W',title:'Obra',author_name:['Autor'],subject:['Mystery'],isbn:['0306406152'],publisher:['Editora de uma edição'],first_publish_year:1900}]}:{description:{value:'<p>Descrição da obra</p>'},subjects:['Mystery']});}});
  const [book]=await client.search({source:'openlibrary',q:'Obra'});assert.equal(book.isbn,null);assert.equal(book.publisher,'');
  const detail=await client.detail('openlibrary','OL123W');assert.equal(detail.description,'Descrição da obra');
  await assert.rejects(client.detail('openlibrary','https://example.invalid'),/inválida/);assert.ok(urls.every(url=>url.hostname==='openlibrary.org'));
});
test('handles quota and timeout without guessing metadata',async()=>{
  const quota=createBookMetadata({fetchImpl:async()=>({ok:false,status:429})});await assert.rejects(quota.search({q:'Livro'}),/limite/);
  const timeout=createBookMetadata({fetchImpl:async()=>{throw new DOMException('Timeout','TimeoutError');}});await assert.rejects(timeout.search({q:'Livro'}),{name:'TimeoutError'});
});
