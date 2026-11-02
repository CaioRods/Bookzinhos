import { useEffect, useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { fetchCharacters, updateProfile } from "../lib/api";
import { requireAuth } from "../lib/authGate";
import { getAvatar, getUsername, saveSession } from "../lib/session";
import { getFullUrl, type Book, type CharacterAvatar } from "../lib/types";
import { useOffline } from "../lib/offline/device";
import { ScenePicker } from "./Scenery";
import { Modal, toast } from "./Ui";

export function BookPersonalization({ book }: { book: Book }) {
  const username = getUsername(), offline = useOffline();
  const [catalog, setCatalog] = useState<{ bookId: string; username: string | null; items: CharacterAvatar[] } | null>(null);
  const [open, setOpen] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setOpen(false); setCatalog(null);
    fetchCharacters(book.id).then(result => {
      if (active) setCatalog({ bookId: book.id, username, items: result.characters.filter(item => item.bookIds.includes(book.id)) });
    }).catch(() => {});
    return () => { active = false; };
  }, [book.id, username]);
  const characters = catalog?.bookId === book.id && catalog.username === username ? catalog.items : [];
  const choose = async (character: CharacterAvatar) => {
    if (saving || offline || !requireAuth("usar esta foto de perfil")) return;
    setSaving(true);
    try {
      const identity = getUsername();
      const profile = await updateProfile({ avatar: character.imageUrl });
      if (getUsername() !== identity) return;
      saveSession(profile); setOpen(false); toast("Foto de perfil atualizada.");
    } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível atualizar a foto.", "error"); }
    finally { setSaving(false); }
  };
  return <>
    <ScenePicker book={book}/>
    {characters.length > 0 && <button className="mb-btn mb-btn-outline mb-btn-icon" aria-label="Fotos de perfil deste livro" title="Fotos de perfil deste livro" onClick={() => setOpen(true)}><UserRound size={19}/></button>}
    <Modal open={open && characters.length > 0} onClose={() => { if (!saving) setOpen(false); }} title={`Fotos de perfil de ${book.title}`} description="Escolha um personagem deste livro para usar como sua foto de perfil." size="lg">
      {offline && <p role="status">Conecte-se para alterar sua foto de perfil.</p>}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">{characters.map(character => <button key={character.id} disabled={saving || offline} aria-label={`Usar foto de ${character.name}`} aria-pressed={getAvatar() === character.imageUrl} className="text-center" onClick={() => choose(character)}><img src={getFullUrl(character.imageUrl) || character.imageUrl} alt="" loading="lazy" className="aspect-square w-full rounded-full object-cover border-2 border-[var(--primary)]"/><span className="block text-sm mt-2">{character.name}</span></button>)}</div>
      {saving && <p role="status" className="flex gap-2 mt-4"><Loader2 className="animate-spin" size={16}/> Salvando foto…</p>}
    </Modal>
  </>;
}
