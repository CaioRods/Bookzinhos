import { API_BASE_URL } from "../config";
import { getUsername } from "../session";
import { read, rows, write, keys } from "../offline/db";
import type { Note } from "../types";
import type { Notebook, NotebookPage, PageSummary, Share } from "./model";
interface RecordValue<T> { value:T; dirty:boolean; deleted?:boolean; baseRevision:string }
interface Pending { key:string; revision:string }
const identity=()=>getUsername()?.toLowerCase()||"";
const prefix=(user:string)=>`${user}::notebook::`;
const metaKey=(user:string,id:string)=>`${prefix(user)}meta:${id}`;
const pageKey=(user:string,id:string,page:string)=>`${prefix(user)}page:${id}:${page}`;
const summaryKey=(key:string)=>key.replace("::page:","::summary:");
const pendingKey=(key:string)=>{const split=key.indexOf("::notebook::")+12;return key.slice(0,split)+"pending:"+key.slice(split);};
const summary=(page:NotebookPage):PageSummary=>({id:page.id,title:page.title,paper:page.paper,position:page.position,revision:page.revision,updatedAt:page.updatedAt});
export const NOTEBOOK_EVENT="mybooks:notebook-sync";
const errors=new Map<string,string>();
export const notebookSyncError=()=>errors.get(identity())||"";
const emit=()=>window.dispatchEvent(new Event(NOTEBOOK_EVENT));
const chains=new Map<string,Promise<unknown>>();
async function serial<T>(key:string,action:()=>Promise<T>):Promise<T>{const previous=chains.get(key)||Promise.resolve(),pending=previous.catch(()=>{}).then(action);chains.set(key,pending);try{return await pending;}finally{if(chains.get(key)===pending)chains.delete(key);}}
export async function notebookCall<T>(path:string,options:RequestInit={},user=identity()):Promise<T>{
 if(!user||identity()!==user)throw new Error("Entre na sua conta para abrir suas anotações.");
 const response=await fetch(API_BASE_URL+path,{...options,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json","X-Notebook-Account":user,...options.headers}});
 if(response.status===404&&options.method==="DELETE")return {ok:true} as T;
 if(!response.ok){const message=await response.json().catch(()=>null);throw Object.assign(new Error(message?.error||(response.status===404?"Caderno ou página indisponível.":"Não foi possível sincronizar suas anotações.")),{status:response.status});}
 if(identity()!==user)throw new Error("A conta mudou. Reabra as anotações.");
 return response.json();
}
let syncing:Promise<void>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>{void syncNotebooks().catch(()=>emit());},1000);}
function records<T extends Notebook|NotebookPage>(key:string,value:RecordValue<T>){return [{key,value},...("elements" in value.value?[{key:summaryKey(key),value:{...value,value:summary(value.value as NotebookPage)}}]:[])];}
async function persist<T extends Notebook|NotebookPage>(key:string,value:RecordValue<T>,extra:{key:string;value:unknown}[]=[],remove:string[]=[]){
 if (!("elements" in value.value)) { await write([...records(key,value),...extra],remove);return; }
 const parts=key.split("::page:");const notebookId=parts[1].split(":")[0],indexKey=`${parts[0]}::index:${notebookId}`;
 await serial(indexKey,async()=>{const current=await read<PageSummary[]>(indexKey)||[],map=new Map(current.map(page=>[page.id,page]));if(value.deleted)map.delete(value.value.id);else map.set(value.value.id,summary(value.value as NotebookPage));await write([...records(key,value),...extra,{key:indexKey,value:[...map.values()]}],remove);});
}
export async function syncNotebooks(){
 clearTimeout(timer);if(syncing)return syncing;
 const user=identity();if(!user||!navigator.onLine)return;
 syncing=(async()=>{
  // Queue entries contain only IDs. Large pages are read and uploaded one at a time.
  const pending=(await rows<Pending>(`${prefix(user)}pending:`)).sort((a,b)=>Number(a.value.key.includes("::page:"))-Number(b.value.key.includes("::page:")));
  for(const marker of pending){
   if(identity()!==user)return;
   const key=marker.value.key,value=await read<RecordValue<Notebook|NotebookPage>>(key);
   if(!value?.dirty){await write([],[marker.key]);continue;}
   const parts=key.slice(prefix(user).length).split(":"),path=parts[0]==="meta"?`/notebooks/${parts[1]}`:`/notebooks/${parts[1]}/pages/${parts[2]}`;
   if(value.deleted){await notebookCall(path,{method:"DELETE"},user);await serial(key,async()=>{const latest=await read<RecordValue<Notebook|NotebookPage>>(key);if(latest?.deleted&&latest.value.revision===value.value.revision)await write([],[key,marker.key,...(parts[0]==="page"?[summaryKey(key)]:[])]);});emit();continue;}
   const saved=await notebookCall<Notebook|NotebookPage>(path,{method:"PUT",body:JSON.stringify({...value.value,baseRevision:value.baseRevision})},user);
   await serial(key,async()=>{const latest=await read<RecordValue<Notebook|NotebookPage>>(key);if(!latest)return;const unchanged=latest.value.revision===value.value.revision;const next:RecordValue<Notebook|NotebookPage>=unchanged?{value:saved,dirty:false,baseRevision:saved.revision}:{...latest,baseRevision:saved.revision};await persist(key,next,[],unchanged?[marker.key]:[]);});emit();
  }
  errors.delete(user);if(identity()===user&&await pendingCount())schedule();
 })().catch(error=>{errors.set(user,error.message);throw error;}).finally(()=>{syncing=undefined;emit();});return syncing;
}
async function saveLocal<T extends Notebook|NotebookPage>(key:string,value:T){
 if(JSON.stringify(value).length>3500000)throw new Error("Esta folha ficou grande demais. Remova uma imagem ou divida o conteúdo em outra página.");
 await serial(key,async()=>{const previous=await read<RecordValue<T>>(key);await persist(key,{value,dirty:true,baseRevision:previous?.baseRevision||""},[{key:pendingKey(key),value:{key,revision:value.revision}}]);});emit();schedule();
}
export async function saveNotebook(value:Notebook,user=identity()){if(!user)throw new Error("Entre para criar um caderno.");await saveLocal(metaKey(user,value.id),value);}
export async function savePage(id:string,value:NotebookPage,user=identity()){if(!user)throw new Error("Entre para escrever.");await saveLocal(pageKey(user,id,value.id),value);}
async function importCachedDiary(user:string,onlyIds?:Set<string>){
 const marker=`${prefix(user)}legacy-import`;
 if(!onlyIds&&await read(marker))return;
 const cached=await rows<Note[]>(`${user}::snapshot::/notes/book/`),notes=new Map<string,Note>();
 for(const row of cached)for(const note of row.value||[])if((!onlyIds||onlyIds.has(note.id))&&(!note.username||note.username.toLowerCase()===user))notes.set(note.id,note);
 if(notes.size){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(user));
  const hash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
  const id=`legacy-${hash.slice(0,24)}`,key=metaKey(user,id);
  if(!await read(key)){const value:Notebook={id,name:"Anotações anteriores",description:"",color:"#657b72",icon:"book",image:"",revision:"legacy",updatedAt:Date.now()};await persist(key,{value,dirty:true,baseRevision:"legacy"},[{key:pendingKey(key),value:{key,revision:value.revision}}]);}
  for(const note of notes.values()){
   const pageId=`legacy-${note.id}`,key=pageKey(user,id,pageId);if(await read(key))continue;
   const installed=await read<{book:{title:string}}>(`${user}::book::${note.bookId}`);
   const value:NotebookPage={id:pageId,title:`${installed?.book.title||"Leitura"} · ${note.date||"Anotação"}`,paper:"ruled",revision:"legacy",updatedAt:note.createdAt||Date.now(),position:note.createdAt||Date.now(),elements:[{id:"legacy-text",type:"text",x:65,y:80,width:670,height:900,text:`${note.feedback}\n\nAvaliação na época: ${note.rating}/5`,color:"#354d49",size:22,font:"sans",bold:false,italic:false,underline:false,align:"left"}]};
   await persist(key,{value,dirty:true,baseRevision:"legacy"},[{key:pendingKey(key),value:{key,revision:value.revision}}]);
  }
 }
 if(!onlyIds)await write([{key:marker,value:true}]);
 if(notes.size&&navigator.onLine)schedule();
}
export async function listNotebooks():Promise<Notebook[]>{
 const user=identity();if(!user)return [];
 if(!navigator.onLine)await importCachedDiary(user);
 if(navigator.onLine)try{
  await syncNotebooks();const server=await notebookCall<Notebook[]>("/notebooks",{},user);
  for(const value of server)await serial(metaKey(user,value.id),async()=>{const previous=await read<RecordValue<Notebook>>(metaKey(user,value.id));if(!previous?.dirty)await write([{key:metaKey(user,value.id),value:{value,dirty:false,baseRevision:value.revision}}]);});
  const oldQueue=await rows<{path:string;body:{clientId?:string}}>(`${user}::queue::`),oldIds=new Set(oldQueue.filter(row=>row.value.path==="/notes"&&row.value.body?.clientId).map(row=>row.value.body.clientId!));if(oldIds.size)await importCachedDiary(user,oldIds);
  const ids=new Set(server.map(n=>n.id)),existing=await rows<RecordValue<Notebook>>(`${prefix(user)}meta:`);await write([],existing.filter(row=>!row.value.dirty&&!ids.has(row.value.value.id)).map(row=>row.key));
 }catch(error){if(!(await rows(`${prefix(user)}meta:`)).length)throw error;}
 if(identity()!==user)throw new Error("A conta mudou. Reabra as anotações.");
 const notebooks=(await rows<RecordValue<Notebook>>(`${prefix(user)}meta:`)).filter(row=>!row.value.deleted).map(row=>row.value.value);
 return (await Promise.all(notebooks.map(async notebook=>{
  const index=await read<PageSummary[]>(`${prefix(user)}index:${notebook.id}`),local=await rows<RecordValue<PageSummary>>(`${prefix(user)}summary:${notebook.id}:`);
  if(index){const ids=new Set(index.map(page=>page.id));local.forEach(row=>{if(row.value.deleted)ids.delete(row.value.value.id);else if(row.value.dirty)ids.add(row.value.value.id);});return {...notebook,pageCount:ids.size};}
  return {...notebook,pageCount:notebook.pageCount||local.filter(row=>!row.value.deleted).length};
 }))).sort((a,b)=>b.updatedAt-a.updatedAt);
}
export async function listPages(id:string):Promise<PageSummary[]>{
 const user=identity(),local=await rows<RecordValue<PageSummary>>(`${prefix(user)}summary:${id}:`),indexKey=`${prefix(user)}index:${id}`;
 if(navigator.onLine)try{const server=await notebookCall<PageSummary[]>(`/notebooks/${id}/pages`,{},user),map=new Map(server.map(p=>[p.id,p]));for(const row of local)if(row.value.deleted)map.delete(row.value.value.id);else if(row.value.dirty)map.set(row.value.value.id,row.value.value);await write([{key:indexKey,value:[...map.values()]}]);return [...map.values()].sort((a,b)=>a.position-b.position);}catch{/* private local summaries remain available */}
 const saved=await read<PageSummary[]>(indexKey),map=new Map((saved||[]).map(p=>[p.id,p]));local.forEach(row=>{if(row.value.deleted)map.delete(row.value.value.id);else if(row.value.dirty||!saved||map.has(row.value.value.id))map.set(row.value.value.id,row.value.value);});return [...map.values()].sort((a,b)=>a.position-b.position);
}
export async function getPage(id:string,page:string):Promise<NotebookPage>{
 const user=identity(),key=pageKey(user,id,page),local=await read<RecordValue<NotebookPage>>(key);
 if(local?.deleted)throw new Error("Esta página foi excluída neste aparelho.");if(local?.dirty)return local.value;
 const index=await read<PageSummary[]>(`${prefix(user)}index:${id}`);if(local&&index?.find(p=>p.id===page)?.revision===local.value.revision)return local.value;
 if(navigator.onLine)try{const value=await notebookCall<NotebookPage>(`/notebooks/${id}/pages/${page}`,{},user);await serial(key,async()=>{const latest=await read<RecordValue<NotebookPage>>(key);if(!latest?.dirty)await persist(key,{value,dirty:false,baseRevision:value.revision});});return (await read<RecordValue<NotebookPage>>(key))!.value;}catch(error){if(!local||(error as {status?:number}).status===404)throw error;}
 if(!local)throw new Error("Instale esta página com internet para guardá-la neste aparelho.");return local.value;
}
export async function pendingCount(){return (await keys(`${prefix(identity())}pending:`)).length;}
export async function deleteNotebook(id:string){
 const user=identity(),key=metaKey(user,id);await serial(key,async()=>{const previous=await read<RecordValue<Notebook>>(key);if(!previous)throw new Error("Caderno não encontrado neste aparelho.");const pages=await keys(`${prefix(user)}page:${id}:`),summaries=await keys(`${prefix(user)}summary:${id}:`),value={...previous,value:{...previous.value,revision:crypto.randomUUID()},dirty:true,deleted:true};await write([{key,value},{key:pendingKey(key),value:{key,revision:value.value.revision}}],[`${prefix(user)}index:${id}`,...pages,...pages.map(pendingKey),...summaries]);});emit();schedule();
}
export async function deletePage(id:string,page:string){
 const user=identity(),key=pageKey(user,id,page);if(!await read(key))await getPage(id,page);
 await serial(key,async()=>{const previous=await read<RecordValue<NotebookPage>>(key);if(!previous)throw new Error("Página não instalada neste aparelho.");const value={...previous,value:{...previous.value,elements:[],revision:crypto.randomUUID()},dirty:true,deleted:true};await persist(key,value,[{key:pendingKey(key),value:{key,revision:value.value.revision}}]);});
 const index=await read<PageSummary[]>(`${prefix(user)}index:${id}`)||[];await write([{key:`${prefix(user)}index:${id}`,value:index.filter(p=>p.id!==page)}]);emit();schedule();
}
async function privateRead<T>(path:string):Promise<T>{
 const user=identity(),key=`${prefix(user)}shared:${path}`;
 if(navigator.onLine)try{const value=await notebookCall<T>(path,{},user);await write([{key,value}]);return value;}catch(error){if(identity()!==user)throw error;const cached=await read<T>(key);if(cached!==undefined&&(error instanceof TypeError||!(error as {status?:number}).status))return cached;await write([],[key]);throw error;}
 if(identity()!==user)throw new Error("A conta mudou. Reabra as anotações.");
 const cached=await read<T>(key);if(cached===undefined)throw new Error("Instale este compartilhamento com conexão para abrir offline.");return cached;
}
export const listShares=()=>privateRead<Share[]>("/notebook-shares");
export async function shareNotebook(id:string,recipient:string,pageId?:string){if(!navigator.onLine)throw new Error("Conecte-se para compartilhar.");await syncNotebooks();return notebookCall<{id:string}>(`/notebooks/${id}/shares`,{method:"POST",body:JSON.stringify({recipient,pageId})});}
export const getShare=(id:string)=>privateRead<{notebook:Notebook;pages:PageSummary[];owner:string}>(`/notebook-shares/${id}`);
export const getSharedPage=(share:string,page:string)=>privateRead<NotebookPage>(`/notebook-shares/${share}/pages/${page}`);
