// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {loadProfileImage,profileImageFallback} from './profileImage';
afterEach(()=>vi.unstubAllGlobals());
it('retries a storage image rejected by canvas CORS through a public ID route',async()=>{
 const sources:string[]=[];
 class FakeImage {crossOrigin='';naturalWidth=300;naturalHeight=450;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){sources.push(value);queueMicrotask(()=>{if(value.includes('/images/'))this.onload?.();else this.onerror?.();});}}
 vi.stubGlobal('Image',FakeImage);
 const fallback=profileImageFallback('Ana Leitora','cover','book/1');
 const image=await loadProfileImage('https://storage.test/cover.png',fallback);
 expect(image?.naturalWidth).toBe(300);expect(sources).toEqual(['https://storage.test/cover.png',fallback]);expect(fallback).toContain('/public/profiles/Ana%20Leitora/images/cover/book%2F1');
});
it('keeps working local assets and does not request the fallback',async()=>{
 const sources:string[]=[];class FakeImage {naturalWidth=1536;naturalHeight=1024;onload:(()=>void)|null=null;set src(value:string){sources.push(value);queueMicrotask(()=>this.onload?.());}}
 vi.stubGlobal('Image',FakeImage);expect(await loadProfileImage('/scenery/landscapes.webp','/unused')).toBeTruthy();expect(sources).toEqual(['/scenery/landscapes.webp']);
});
