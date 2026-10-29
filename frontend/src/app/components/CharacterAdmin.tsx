import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { createCharacter, deleteCharacter, fetchBooks, fetchCharacters } from "../lib/api";
import { getFullUrl, type Book, type CharacterAvatar } from "../lib/types";
import { AvatarCropper, cropAvatar } from "./AvatarCropper";
import { EmptyState, Modal, toast } from "./Ui";

export function CharacterAdmin() {
  const [items, setItems] = useState<CharacterAvatar[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [reuseId, setReuseId] = useState("");
  const [source, setSource] = useState("");
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => Promise.all([fetchCharacters(undefined, true), fetchBooks()]).then(([catalog, allBooks]) => { setItems(catalog.characters); setBooks(allBooks); }), []);
  useEffect(() => { load(); }, [load]);

  const selectedSeries = useMemo(() => new Set(books.filter((book) => bookIds.includes(book.id) && book.seriesId).map((book) => book.seriesId)), [bookIds, books]);
  const reusable = useMemo(() => items.filter((item) => item.bookIds.some((id) => {
    const book = books.find((entry) => entry.id === id);
    return bookIds.includes(id) || (!!book?.seriesId && selectedSeries.has(book.seriesId));
  })), [bookIds, books, items, selectedSeries]);
  const reset = () => { setOpen(false); setName(""); setBookIds([]); setReuseId(""); setSource(""); };
  const save = async () => {
    if (!reuseId && (!source || name.trim().length < 2)) return toast("Escolha a imagem e informe o personagem.", "error");
    setSaving(true);
    try {
      const image = source && !reuseId ? await cropAvatar(source, crop.x, crop.y, crop.zoom) : undefined;
      const existing = items.find((item) => item.id === reuseId);
      await createCharacter({ name: existing?.name || name.trim(), characterId: reuseId || undefined, bookIds, image });
      await load(); reset(); toast(reuseId ? "Personagem vinculado aos volumes." : "Personagem disponível para todos.");
    } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível salvar.", "error"); }
    finally { setSaving(false); }
  };

  return <section><div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-xl font-semibold">Personagens</h2><p className="text-sm text-[var(--text-3)]">Uma identidade pode pertencer a vários volumes da mesma saga.</p></div><button onClick={() => setOpen(true)} className="mb-btn mb-btn-primary"><Plus size={16} /> Adicionar</button></div>
    {items.length === 0 ? <EmptyState emoji="📷" title="Nenhum personagem" description="Adicione a primeira foto de perfil da comunidade." /> : <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">{items.map((item) => <article key={item.id} className="mb-card p-3 text-center relative group"><img src={getFullUrl(item.imageUrl) || item.imageUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto" /><strong className="block text-sm mt-2 truncate">{item.name}</strong><small className="block text-[var(--text-3)]">{item.bookIds.length} {item.bookIds.length === 1 ? "livro" : "livros"}</small><button aria-label="Excluir" onClick={async () => { await deleteCharacter(item.id); setItems((old) => old.filter((entry) => entry.id !== item.id)); }} className="absolute top-2 right-2 mb-btn mb-btn-danger mb-btn-icon mb-btn-sm opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></article>)}</div>}
    <Modal open={open} onClose={reset} title="Adicionar personagem" description="Vincule a identidade a um ou mais volumes." footer={<><button onClick={reset} className="mb-btn mb-btn-outline">Cancelar</button><button onClick={save} disabled={saving || (!reuseId && (!source || !name.trim()))} className="mb-btn mb-btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {reuseId ? "Vincular" : "Salvar avatar"}</button></>}>
      <div className="space-y-4"><label className="mb-label">Livros vinculados<select multiple className="mb-input mt-1 min-h-36" value={bookIds} onChange={(event) => setBookIds([...event.currentTarget.selectedOptions].map((option) => option.value))}>{books.map((book) => <option key={book.id} value={book.id}>{book.seriesName ? `${book.seriesName} · Vol. ${book.seriesOrder} · ` : ""}{book.title}</option>)}</select><small className="block mt-1 text-[var(--text-3)]">Use Ctrl/Cmd para selecionar vários volumes.</small></label>
      {reusable.length > 0 && <label className="mb-label">Usar personagem existente<select className="mb-input mt-1" value={reuseId} onChange={(event) => { setReuseId(event.target.value); if (event.target.value) setName(items.find((item) => item.id === event.target.value)?.name || ""); }}><option value="">Criar uma identidade nova</option>{reusable.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {!reuseId && <><label className="mb-label">Personagem<input className="mb-input mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Jude Duarte" /></label><label className="mb-label">Foto<input type="file" accept="image/*" className="mb-input mt-1" onChange={(event) => { const file = event.target.files?.[0]; if (file) setSource(URL.createObjectURL(file)); }} /></label>{source && <AvatarCropper source={source} onChange={setCrop} />}</>}</div>
    </Modal>
  </section>;
}
