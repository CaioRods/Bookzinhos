import {safeFileName} from './download';
export function profileShareUrl(origin:string,username:string):string{
 return new URL(`/user/${encodeURIComponent(username)}`,origin).href;
}
export function downloadProfileImage(blob:Blob,name:string):void{
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=safeFileName(`perfil-${name.replace(/[\u0000-\u001f]/g,'')}`,'png');
 document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
export async function shareProfileImage(blob:Blob,name:string):Promise<'shared'|'downloaded'|'cancelled'>{
 if(typeof File==='function'&&navigator.share&&navigator.canShare){
  const file=new File([blob],safeFileName(`perfil-${name.replace(/[\u0000-\u001f]/g,'')}`,'png'),{type:'image/png'});
  try{if(navigator.canShare({files:[file]})){await navigator.share({title:`Perfil de ${name}`,files:[file]});return 'shared';}}
  catch(error){if((error as Error).name==='AbortError')return 'cancelled';}
 }
 downloadProfileImage(blob,name);return 'downloaded';
}
