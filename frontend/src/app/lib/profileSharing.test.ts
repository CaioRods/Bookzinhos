// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {profileShareUrl,shareProfileImage} from './profileSharing';
afterEach(()=>vi.restoreAllMocks());
it('creates a stable direct profile link with safe path encoding',()=>{
 expect(profileShareUrl('https://mybookzinhos.vercel.app','Ana Leitora')).toBe('https://mybookzinhos.vercel.app/user/Ana%20Leitora');
 expect(profileShareUrl('http://localhost:5173','ana?auth=login')).toBe('http://localhost:5173/user/ana%3Fauth%3Dlogin');
});
it('shares the prepared PNG as a file from a user action',async()=>{
 let content:File|undefined;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async(data:ShareData)=>{content=data.files?.[0];}});
 const blob=new Blob(['PNG'],{type:'image/png'});expect(await shareProfileImage(blob,'Ana')).toBe('shared');expect(content?.type).toBe('image/png');expect(content?.name).toBe('perfil-Ana.png');expect(content?.size).toBe(blob.size);
});
it('treats canceled native sharing as a cancellation without downloading',async()=>{
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelado','AbortError');}});const clicked=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 expect(await shareProfileImage(new Blob(['PNG'],{type:'image/png'}),'Ana')).toBe('cancelled');expect(clicked).not.toHaveBeenCalled();
});
it('downloads the image when native file sharing is unavailable',async()=>{
 Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=> 'blob:test'});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});const clicked=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 expect(await shareProfileImage(new Blob(['PNG'],{type:'image/png'}),'Ana')).toBe('downloaded');expect(clicked).toHaveBeenCalledOnce();
});
