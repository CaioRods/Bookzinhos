import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { DEFAULT_SCENE, type SceneId } from "../lib/scenery";
import { useSettings } from "../lib/settings";
import { useThemeCatalog, DEFAULT_THEMES } from "../lib/themeCatalog";
import { getUsername, isAdmin } from "../lib/session";
import { fetchBooks } from "../lib/api";
import { deleteTheme } from "../lib/appearanceApi";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage } from "./ThemeImage";
import { ThemeEditor } from "./ThemeEditor";
import { ConfirmDialog, Modal, toast } from "./Ui";
import { groupThemesByBook } from "../lib/themeGrouping";
import { getFullUrl, type Book } from "../lib/types";
export function Scenery({ scene, className = "", surface = "profile" }: { scene: SceneId; className?: string; surface?: "profile" | "sidebar" | "card" }) {
  const { themes } = useThemeCatalog();
  const theme = themes.find(theme => theme.id === scene) || DEFAULT_THEMES[0];
  if (theme.id === "none") return null;
  return <ThemeImage theme={theme} crop={surface === "sidebar" ? theme.sidebar : theme.profile} className={className} />;
}
export function ScenePicker() {
  const [settings, update] = useSettings();
  useEffect(()=>{const open=()=>setOpen(true);window.addEventListener("mybooks:open-personalization",open);return()=>window.removeEventListener("mybooks:open-personalization",open)},[]);
  const [books, setBooks] = useState<Book[]>([]), [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; let alive = true; fetchBooks().then(value => { if (alive) setBooks(value); }).catch(() => {}); return () => { alive = false; }; }, [open]);
  const { themes, error, upsert, remove } = useThemeCatalog();
  const [editing, setEditing] = useState<SceneTheme | null | undefined>(undefined), [deleting, setDeleting] = useState<SceneTheme | null>(null), [busy, setBusy] = useState(false);
  const mine = themes.filter(theme => theme.scope === "personal"), admin = isAdmin(), member = !!getUsername();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const groups = groupThemesByBook(themes.filter(theme => theme.id !== "none"), books);
  const erase = async () => { if (!deleting) return; setBusy(true); try { await deleteTheme(deleting.id); remove(deleting.id); if (settings.scene === deleting.id) update({ scene: DEFAULT_SCENE }); setDeleting(null); toast("Tema removido. Os temas do sistema voltam ao padrão quando restaurados."); } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível remover.", "error"); } finally { setBusy(false); } };
  const group = groups.find(entry => entry.id === selectedGroup);
  return <>
    <Modal open={open} onClose={() => { setOpen(false); setSelectedGroup(null); }} title="Escolha seu cenário" description="Encontre um universo para chamar de seu." size="xl">
      <div className="mb-theme-library">
        <div className="mb-theme-toolbar"><button className="mb-btn mb-btn-soft" aria-pressed={settings.scene === "none"} onClick={() => update({ scene: "none" })}>Sem tema · cores padrão</button><button className="mb-btn mb-btn-outline" onClick={() => setEditing(null)} disabled={!member || (mine.length >= 40 && !admin)}><Plus size={16} /> Criar tema <small>{mine.length}{admin ? " pessoais · sem limite" : "/40 pessoais"}</small></button></div>
        {error && <p role="status" className="mb-editor-error">Não foi possível carregar os temas: {error}</p>}
        {group ? <>
          <button className="mb-btn mb-btn-ghost mb-theme-back" onClick={() => setSelectedGroup(null)}><ArrowLeft size={16}/> Todos os livros</button>
          <h3 className="mb-theme-group-title">{group.title}</h3>
          <div className="mb-theme-banner-grid">{group.themes.map(theme => <article className="mb-theme-banner-card" key={theme.id}>
            <button className="mb-theme-banner" onClick={() => update({ scene: theme.id as SceneId })} aria-label={`Usar tema ${theme.name}`} aria-pressed={settings.scene === theme.id}><ThemeImage theme={theme} crop={theme.profile}/>{settings.scene === theme.id && <span className="mb-theme-check"><Check size={15}/> Selecionado</span>}</button>
            <h4>{theme.name}</h4><footer><small>{theme.scope === "personal" ? "Pessoal" : "Sistema"}</small>{member && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Editar tema ${theme.name}`} onClick={() => setEditing(theme)}><Pencil size={13}/>{admin || theme.scope === "personal" ? "Editar" : "Personalizar"}</button>}{(theme.scope === "personal" || (admin && theme.updatedAt)) && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Excluir ou restaurar tema ${theme.name}`} onClick={() => setDeleting(theme)}><Trash2 size={13}/></button>}</footer>
          </article>)}</div>
        </> : <div className="mb-theme-book-grid">{groups.map(entry => <button className="mb-theme-book-card" key={entry.id} onClick={() => setSelectedGroup(entry.id)}>
          <span className="mb-theme-book-art">{entry.coverImagePath ? <img src={getFullUrl(entry.coverImagePath) || ""} alt=""/> : <BookOpen size={44}/>}</span><strong>{entry.title}</strong><small>{entry.themes.length} {entry.themes.length === 1 ? "tema disponível" : "temas disponíveis"}</small>
        </button>)}</div>}
      </div>
    </Modal>
    {editing !== undefined && <ThemeEditor theme={editing} onClose={() => setEditing(undefined)} onSaved={theme => { upsert(theme); update({ scene: theme.id as SceneId }); setEditing(undefined); }} />}
    <ConfirmDialog open={!!deleting} title={deleting?.scope === "system" ? "Remover personalização do sistema?" : "Excluir tema pessoal?"} description={deleting?.scope === "system" ? "O tema deixará de ser publicado. Se for um dos seis originais, ele voltará ao padrão para todos." : "O tema será excluído da sua conta e liberará uma das 40 vagas."} confirmLabel={busy ? "Removendo…" : "Remover"} destructive onConfirm={() => { if (!busy) erase(); }} onCancel={() => { if (!busy) setDeleting(null); }} />
  </>;
}
