import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { createCharacter, deleteCharacter, fetchBooks, fetchCharacters } from "../lib/api";
import { getFullUrl, type Book, type CharacterAvatar } from "../lib/types";
import { AvatarCropper, cropAvatar } from "./AvatarCropper";
import { EmptyState, Modal, toast } from "./Ui";

export function CharacterAdmin() {
  const [items, setItems] = useState<CharacterAvatar[]>([]); const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [bookId, setBookId] = useState("");
  const [source, setSource] = useState(""); const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 }); const [saving, setSaving] = useState(false);
  const load = useCallback(() => Promise.all([fetchCharacters(undefined, true), fetchBooks()]).then(([characters, allBooks]) => { setItems(characters); setBooks(allBooks); }), []);
  useEffect(() => { load(); }, [load]);
  const names = useMemo(() => [...new Set(items.filter((item) => !bookId || item.bookId === bookId).map((item) => item.name))], [items, bookId]);
  const reset = () => { setOpen(false); setName(""); setBookId(""); setSource(""); };
  const save = async () => { if (!source || name.trim().length < 2) return toast("Escolha a imagem e informe o personagem.", "error"); setSaving(true); try { const image = await cropAvatar(source, crop.x, crop.y, crop.zoom); await createCharacter({ name: name.trim(), bookId, image }); await load(); reset(); toast("Personagem disponível para todos."); } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível salvar.", "error"); } finally { setSaving(false); } };
  return <section><div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-xl font-semibold">Personagens</h2><p className="text-sm text-[var(--text-3)]">Avatares oficiais disponíveis para toda a comunidade.</p></div><button onClick={() => setOpen(true)} className="mb-btn mb-btn-primary"><Plus size={16} /> Adicionar</button></div>
    {items.length === 0 ? <EmptyState emoji="📷" title="Nenhum personagem" description="Adicione a primeira foto de perfil da comunidade." /> : <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">{items.map((item) => <article key={item.id} className="mb-card p-3 text-center relative group"><img src={getFullUrl(item.imageUrl) || item.imageUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto" /><strong className="block text-sm mt-2 truncate">{item.name}</strong><small className="block text-[var(--text-3)] truncate">{item.bookTitle || "Sem livro"}</small><button aria-label="Excluir" onClick={async () => { await deleteCharacter(item.id); setItems((old) => old.filter((entry) => entry.id !== item.id)); }} className="absolute top-2 right-2 mb-btn mb-btn-danger mb-btn-icon mb-btn-sm opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></article>)}</div>}
    <Modal open={open} onClose={reset} title="Novo personagem" description="A foto será recortada em formato de avatar." footer={<><button onClick={reset} className="mb-btn mb-btn-outline">Cancelar</button><button onClick={save} disabled={saving || !source || !name.trim()} className="mb-btn mb-btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Salvar avatar</button></>}>
      <div className="space-y-4"><label className="mb-label">Livro vinculado<select className="mb-input mt-1" value={bookId} onChange={(event) => { setBookId(event.target.value); setName(""); }}><option value="">Sem livro específico</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label className="mb-label">Personagem<input className="mb-input mt-1" list="character-names" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Jude Duarte" /><datalist id="character-names">{names.map((item) => <option key={item} value={item} />)}</datalist></label><label className="mb-label">Foto<input type="file" accept="image/*" className="mb-input mt-1" onChange={(event) => { const file = event.target.files?.[0]; if (file) setSource(URL.createObjectURL(file)); }} /></label>{source && <AvatarCropper source={source} onChange={setCrop} />}</div>
    </Modal>
  </section>;
}
