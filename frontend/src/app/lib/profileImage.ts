import {API_BASE_URL} from './config';
/** Retry through the API's ID-based public image route when storage disallows canvas CORS. */
export function profileImageFallback(username:string,kind:'banner'|'avatar'|'cover',bookId?:string):string {
 return `${API_BASE_URL}/public/profiles/${encodeURIComponent(username)}/images/${kind}${kind==='cover'?`/${encodeURIComponent(bookId||'')}`:''}`;
}
export function loadProfileImage(url:string|null,fallback?:string):Promise<HTMLImageElement|null>{
 if(!url)return Promise.resolve(null);
 const attempt=(source:string,timeout:number)=>new Promise<HTMLImageElement|null>(resolve=>{
  const img=new Image();let done=false;
  const finish=(value:HTMLImageElement|null)=>{if(done)return;done=true;clearTimeout(timer);img.onload=null;img.onerror=null;resolve(value);};
  const timer=setTimeout(()=>{finish(null);img.src='';},timeout);
  img.crossOrigin='anonymous';img.onload=()=>finish(img.naturalWidth&&img.naturalHeight?img:null);img.onerror=()=>finish(null);img.src=source;
 });
 return attempt(url,6000).then(image=>{if(image)return image;return fallback&&fallback!==url?attempt(fallback,12000):null;});
}
