import {useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router';
import {Check,Copy,Download,Image as ImageIcon,Link as LinkIcon,Loader2,Share2} from 'lucide-react';
import {fetchPublicProfile} from '../lib/api';
import {fetchProfileTheme} from '../lib/appearanceApi';
import type {SceneTheme} from '../lib/appearance';
import type {ProgressionSummary,UserProfile} from '../lib/types';
import {getUsername} from '../lib/session';
import {renderProfileCard} from '../lib/profileCard';
import {downloadProfileImage,profileShareUrl,shareProfileImage} from '../lib/profileSharing';
import {shareReading} from '../lib/readingExports';
import {Modal,toast} from './Ui';

export function ProfileShare({profile,theme,progression}:{profile:UserProfile;theme:SceneTheme;progression?:ProgressionSummary|null}){
 const navigate=useNavigate(),[open,setOpen]=useState(false),[mode,setMode]=useState<'link'|'image'>('link');
 const [copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const url=useMemo(()=>profileShareUrl(window.location.origin,profile.username),[profile.username]);
 useEffect(()=>{
  if(!open||mode!=='image')return;
  let active=true,objectUrl='';setBusy(true);setBlob(null);setPreview('');setError('');
  // Generate from the public DTO, including when sharing one's own profile.
  Promise.all([fetchPublicProfile(profile.username,true),fetchProfileTheme(profile.username).catch(()=>null)]).then(async([data,remoteTheme])=>{
   const image=await renderProfileCard({profile:data.profile,books:data.books,theme:remoteTheme&&'mainColor' in remoteTheme?remoteTheme:theme,progression,url});
   if(!active)return;objectUrl=URL.createObjectURL(image);setBlob(image);setPreview(objectUrl);
  }).catch(()=>{if(active)setError('Não foi possível preparar a imagem do perfil. Tente novamente.');}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[open,mode,profile.username,theme,progression,url,attempt]);
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setError('Não foi possível copiar. Selecione o link e copie manualmente.');}};
 return <>
  <button type="button" className="mb-btn" onClick={()=>{if(!getUsername()){navigate(`/user/${encodeURIComponent(profile.username)}?auth=login`);return;}setCopied(false);setError('');setMode('link');setOpen(true);}}><Share2 size={17}/>Compartilhar perfil</button>
  <Modal open={open} onClose={()=>setOpen(false)} title="Compartilhar perfil" description="Leve sua estante e suas histórias para outras pessoas." size="lg">
   <div className="mb-profile-share">
    <div className="mb-profile-share-modes" role="group" aria-label="Formato do compartilhamento"><button className="mb-btn" aria-pressed={mode==='link'} onClick={()=>{setError('');setMode('link');}}><LinkIcon size={17}/>Link do perfil</button><button className="mb-btn" aria-pressed={mode==='image'} onClick={()=>{setError('');setMode('image');}}><ImageIcon size={17}/>Imagem do perfil</button></div>
    {mode==='link'?<div className="mb-profile-share-link"><p>Quem abrir este link poderá ver o perfil. Para interagir, será preciso entrar na conta.</p><label className="mb-label" htmlFor="profile-share-url">Link direto</label><div className="mb-profile-share-url"><input id="profile-share-url" className="mb-input" value={url} readOnly onFocus={event=>event.target.select()}/><button className="mb-btn mb-btn-outline" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'Copiado':'Copiar'}</button></div><button className="mb-btn mb-btn-primary" onClick={async()=>{try{const result=await shareReading({title:`Perfil de ${profile.displayName||profile.username}`,text:'Conheça esta estante no myBooks.',url});if(result==='copied'){setCopied(true);toast('Link do perfil copiado.');}}catch{setError('Não foi possível compartilhar. Você também pode copiar o link.');}}}><Share2 size={18}/>Compartilhar link</button></div>:<div className="mb-profile-share-image">
     {busy&&<div className="mb-profile-share-preparing" role="status"><Loader2 size={30} className="animate-spin"/><strong>Preparando seu perfil em imagem…</strong><p>Reunindo cenário, foto, estante e conquistas.</p></div>}
     {preview&&<><div className="mb-profile-share-preview"><img src={preview} alt={`Prévia da imagem do perfil de ${profile.displayName||profile.username}`}/></div><p className="mb-profile-share-caption">Imagem em alta resolução com as informações públicas do perfil.</p><div className="mb-profile-share-image-actions"><button className="mb-btn mb-btn-primary" disabled={!blob||busy} onClick={async()=>{if(!blob)return;try{const result=await shareProfileImage(blob,profile.displayName||profile.username);if(result==='downloaded')toast('Imagem preparada para salvar no aparelho.');}catch{setError('Não foi possível compartilhar a imagem. Use Baixar PNG.');}}}><Share2 size={18}/>Compartilhar imagem</button><button className="mb-btn mb-btn-outline" disabled={!blob||busy} onClick={()=>blob&&downloadProfileImage(blob,profile.displayName||profile.username)}><Download size={18}/>Baixar PNG</button></div></>}
     {!busy&&error&&<button className="mb-btn mb-btn-outline" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</button>}
    </div>}
    {error&&<p className="mb-profile-share-error" role="alert">{error}</p>}
   </div>
  </Modal>
 </>;
}
