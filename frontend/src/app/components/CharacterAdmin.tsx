import { useCallback, useEffect, useState } from "react";
import { Camera, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { createCharacter, decideCharacter, deleteCharacter, fetchBooks, fetchCharacters, submitCharacter } from "../lib/api";
import { getFullUrl, type Book, type CharacterAvatar } from "../lib/types";
import { getUsername, isAdmin } from "../lib/session";
import { AvatarCropper, cropAvatar } from "./AvatarCropper";
import { CharacterBookSelector } from "./CharacterBookSelector";
import { ConfirmDialog, EmptyState, Modal, toast } from "./Ui";

export function CharacterAdmin({ personal = false, onChanged }: { personal?: boolean; onChanged?: () => void }) {
  const admin = isAdmin();
  const [items, setItems] = useState<CharacterAvatar[]>([]), [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<CharacterAvatar | null>(null);
  const [name, setName] = useState(""), [bookIds, setBookIds] = useState<string[]>([]);
  const [source, setSource] = useState(""), [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [saving, setSaving] = useState(false), [requestPublication, setRequestPublication] = useState(false);
  const [deleting, setDeleting] = useState<CharacterAvatar | null>(null);
  useEffect(() => () => { if (source.startsWith("blob:")) URL.revokeObjectURL(source); }, [source]);
  const load = useCallback(() => Promise.all([fetchCharacters(undefined, true), fetchBooks()]).then(([catalog, allBooks]) => { setItems(catalog.characters); setBooks(allBooks); }), []);
  useEffect(() => { load().catch(error => toast(error.message, "error")); }, [load]);
  const reset = () => { setOpen(false); setEditing(null); setName(""); setBookIds([]); setSource(""); setRequestPublication(false); setCrop({ x: 50, y: 50, zoom: 1 }); };
  const refresh = async () => { await load(); onChanged?.(); };
  const action = async (operation: () => Promise<unknown>, message: string) => {
    setSaving(true);
    try { await operation(); await refresh(); toast(message); }
    catch (error) { toast(error instanceof Error ? error.message : "Não foi possível salvar.", "error"); }
    finally { setSaving(false); }
  };
  const save = async () => {
    if ((!editing && !source) || name.trim().length < 2) return toast("Escolha a imagem e informe o personagem.", "error");
    setSaving(true);
    try {
      const image = source ? await cropAvatar(source, crop.x, crop.y, crop.zoom) : undefined;
      await createCharacter({ name: name.trim(), characterId: editing?.id, bookIds, image, scope: editing?.scope || (admin && !personal ? "system" : "personal"), requestPublication });
      await refresh(); reset(); toast(editing ? "Personagem atualizado." : requestPublication ? "Avatar pessoal criado e enviado para aprovação." : admin && !personal ? "Personagem disponível para todos." : "Avatar salvo só para você.");
    } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível salvar.", "error"); }
    finally { setSaving(false); }
  };
  const visible = personal ? items.filter(item => item.scope === "personal" && item.owner?.toLowerCase() === getUsername()?.toLowerCase()) : items;
  return <section><div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-xl font-semibold">{personal ? "Meus avatares" : "Personagens"}</h2><p className="text-sm text-[var(--text-3)]">{personal ? "Crie para você e, se quiser, solicite a publicação para todos." : "Edite personagens e aprove os pedidos da comunidade."}</p></div><button onClick={() => setOpen(true)} className="mb-btn mb-btn-primary"><Plus size={16}/> Adicionar</button></div>
    {visible.length === 0 ? <EmptyState emoji="📷" title="Nenhum personagem" description="Adicione uma foto de perfil de personagem."/> : <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{visible.map(item => <article key={item.id} className="mb-card p-3 text-center"><img src={getFullUrl(item.imageUrl) || item.imageUrl} alt="" loading="lazy" className="w-20 h-20 rounded-full object-cover mx-auto"/><strong className="block text-sm mt-2">{item.name}</strong><small className="block text-[var(--text-3)]">{item.bookIds.length} livros · {item.scope === "personal" ? "Pessoal" : "Para todos"}</small>
    {item.scope === "personal" && <small className="block text-[var(--text-3)]">{item.publicationStatus === "pending" ? "Aguardando aprovação" : item.publicationStatus === "rejected" ? "Publicação recusada" : "Uso pessoal"}</small>}
    <div className="flex flex-wrap justify-center gap-1 mt-2">{admin && <button className="mb-btn mb-btn-outline mb-btn-sm" aria-label={`Editar ${item.name}`} onClick={() => { setEditing(item); setName(item.name); setBookIds(item.bookIds); setOpen(true); }}><Pencil size={13}/> Editar</button>}
    {(admin || item.scope === "personal") && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Excluir ${item.name}`} disabled={saving} onClick={() => setDeleting(item)}><Trash2 size={13}/></button>}
    {item.scope === "personal" && item.publicationStatus !== "pending" && item.owner?.toLowerCase() === getUsername()?.toLowerCase() && <button disabled={saving} className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => action(() => submitCharacter(item.id), "Pedido enviado ao admin.")}>Solicitar publicação</button>}
    {admin && item.scope === "personal" && item.publicationStatus === "pending" && <><small className="w-full">Enviado por {item.owner}</small><button disabled={saving} className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => action(() => decideCharacter(item.id, "approved"), "Avatar liberado para todos.")}>Aprovar</button><button disabled={saving} className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => action(() => decideCharacter(item.id, "rejected"), "Solicitação recusada.")}>Recusar</button></>}
    </div></article>)}</div>}
    <Modal open={open} onClose={() => { if (!saving) reset(); }} title={editing ? "Editar personagem" : "Adicionar personagem"} description="Vincule a foto a um ou mais livros." footer={<><button onClick={reset} disabled={saving} className="mb-btn mb-btn-outline">Cancelar</button><button onClick={save} disabled={saving || (!editing && !source) || name.trim().length < 2} className="mb-btn mb-btn-primary">{saving ? <Loader2 size={16} className="animate-spin"/> : <Camera size={16}/>} Salvar avatar</button></>}>
      <div className="space-y-4"><CharacterBookSelector books={books} value={bookIds} onChange={setBookIds}/>
      <label className="mb-label">Personagem<input className="mb-input mt-1" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Jude Duarte" maxLength={60}/></label>
      {editing && !source && <img className="w-24 h-24 rounded-full object-cover" src={getFullUrl(editing.imageUrl) || editing.imageUrl} alt="Foto atual"/>}
      <label className="mb-label">{editing ? "Trocar foto (opcional)" : "Foto"}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="mb-input mt-1" onChange={event => { const file = event.target.files?.[0]; if (file) { setSource(URL.createObjectURL(file)); setCrop({ x: 50, y: 50, zoom: 1 }); } }}/></label>
      {source && <AvatarCropper key={source} source={source} onChange={setCrop}/>}
      {!editing && (!admin || personal) && <label className="flex gap-2 text-sm"><input type="checkbox" checked={requestPublication} onChange={event => setRequestPublication(event.target.checked)}/> Solicitar ao admin que libere este avatar para todos</label>}
      </div>
    </Modal>
    <ConfirmDialog open={!!deleting} title="Excluir avatar?" description="O avatar será removido do catálogo." destructive confirmLabel="Excluir" onCancel={() => { if (!saving) setDeleting(null); }} onConfirm={() => { if (deleting && !saving) action(async () => { await deleteCharacter(deleting.id); setDeleting(null); }, "Avatar excluído."); }}/>
  </section>;
}
