import { useEffect, useState } from "react";
import { Check, FolderPlus } from "lucide-react";
import { fetchBooklists, addBookToBooklist, type Booklist } from "../lib/booklists";
import type { Book } from "../lib/types";
import { FolderArtwork } from "./FolderArtwork";
import { Modal, toast } from "./Ui";
export function AddToBooklist({ book, onClose }: { book: Book; onClose:()=>void }) {
  const [lists,setLists]=useState<Booklist[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  useEffect(()=>{let alive=true;fetchBooklists().then(value=>{if(alive)setLists(value);}).catch(()=>{if(alive)setError("Não foi possível carregar suas Booklists.");}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
  return <Modal open title="Adicionar à Booklist" description={book.title} onClose={onClose} size="lg">
    {loading ? <p role="status">Carregando suas Booklists…</p> : <div className="mb-add-booklist-grid">{lists.map(list=>{const included=list.bookIds.includes(book.id);return <button key={list.id} disabled={included || busy!==null} className={included?"already-included":""} aria-label={included?`${list.name}: livro já adicionado`:`Adicionar a ${list.name}`} onClick={async()=>{setBusy(list.id);setError("");try{const saved=await addBookToBooklist(list.id,book.id);setLists(previous=>previous.map(item=>item.id===list.id?saved:item));toast(`Livro adicionado a ${list.name}.`);}catch(error){setError(error instanceof Error?error.message:"Não foi possível adicionar.");}finally{setBusy(null);}}}><FolderArtwork list={list}/><span>{included?<><Check size={15}/> Já está nesta Booklist</>:busy===list.id?"Adicionando…":<><FolderPlus size={15}/> Adicionar livro</>}</span></button>})}</div>}
    {!loading&&!lists.length&&!error&&<p>Você ainda não tem Booklists. Crie sua primeira pasta em Meus livros.</p>}{error&&<p role="alert" className="mb-editor-error">{error}</p>}
  </Modal>;
}
