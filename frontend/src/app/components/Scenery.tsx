import { useCropSurfaceSize } from "../lib/useCropSurfaceSize";
import { ThemeProfilePreview } from "./ThemeProfilePreview";
import { useProfileBannerSize } from "../lib/useProfileBannerSize";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, Palette, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { DEFAULT_SCENE, type SceneId } from "../lib/scenery";
import { useSettings } from "../lib/settings";
import { useThemeCatalog, DEFAULT_THEMES } from "../lib/themeCatalog";
import { getUsername, isAdmin } from "../lib/session";
import { fetchBooks } from "../lib/api";
import { requireAuth } from "../lib/authGate";
import { deleteTheme, saveProfileTheme } from "../lib/appearanceApi";
import { CENTER_CROP } from "../lib/appearance";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage, sourceSize } from "./ThemeImage";
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
const DEFAULT_SIDEBAR_PREVIEW = { width: 231, height: 606 };
const DEFAULT_PROFILE_PREVIEW = { width: 1400, height: 420 };
export function ScenePicker({ book }: { book?: Book } = {}) {
  const [settings, update] = useSettings();
  useEffect(()=>{if (book) return; const open=()=>setOpen(true);window.addEventListener("mybooks:open-personalization",open);return()=>window.removeEventListener("mybooks:open-personalization",open)},[book]);
  const [books, setBooks] = useState<Book[]>([]), [open, setOpen] = useState(false);
  const profileSize = useProfileBannerSize(open) || DEFAULT_PROFILE_PREVIEW;
  const sidebarSize = useCropSurfaceSize("sidebar", open) || DEFAULT_SIDEBAR_PREVIEW;
  useEffect(() => { if (!open || book) return; let alive = true; fetchBooks().then(value => { if (alive) setBooks(value); }).catch(() => {}); return () => { alive = false; }; }, [open, book]);
  const { themes, error, upsert, remove } = useThemeCatalog();
  const [editing, setEditing] = useState<SceneTheme | null | undefined>(undefined), [deleting, setDeleting] = useState<SceneTheme | null>(null), [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<SceneTheme | null>(null);
  useEffect(() => {
    if (book) return;
    const edit = () => {
      if (!getUsername()) return toast("Entre para editar o cenário.", "error");
      const current = themes.find(theme => theme.id === settings.scene);
      setOpen(true); setEditing(current?.id === "none" ? null : current || null);
    };
    window.addEventListener("mybooks:edit-current-theme", edit);
    return () => window.removeEventListener("mybooks:edit-current-theme", edit);
  }, [themes, settings.scene, book]);
  const mine = themes.filter(theme => theme.scope === "personal"), admin = isAdmin(), member = !!getUsername();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const groups = useMemo(() => open ? groupThemesByBook(themes.filter(theme => theme.id !== "none"), books) : [], [open, themes, books]);
  const erase = async () => { if (!deleting) return; setBusy(true); try { await deleteTheme(deleting.id); remove(deleting.id); if (settings.scene === deleting.id) update({ scene: DEFAULT_SCENE }); setDeleting(null); toast("Tema removido. Os temas do sistema voltam ao padrão quando restaurados."); } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível remover.", "error"); } finally { setBusy(false); } };
  const linked = book ? themes.filter(theme => theme.id !== "none" && theme.reference?.bookId === book.id) : [];
  const group = book ? { id: book.id, title: book.title, themes: linked } : groups.find(entry => entry.id === selectedGroup);
  const choose = async (theme: SceneTheme) => {
    if (!book) { update({ scene: theme.id as SceneId }); return; }
    if (!requireAuth("usar este tema no perfil") || busy) return;
    setBusy(true);
    try {
      const identity = getUsername();
      await saveProfileTheme(theme.id);
      if (getUsername() !== identity) return;
      update({ scene: theme.id as SceneId }); setOpen(false); toast("Tema aplicado ao seu perfil.");
    } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível aplicar o tema.", "error"); }
    finally { setBusy(false); }
  };
  return <>
    {book && linked.length > 0 && <button className="mb-btn mb-btn-outline" onClick={() => setOpen(true)}><Palette size={17}/> Temas deste livro</button>}
    <Modal open={open && editing === undefined && !deleting && !viewing} onClose={() => { setOpen(false); setSelectedGroup(null); }} title={book ? `Temas de ${book.title}` : "Escolha seu cenário"} description={book ? "Escolha um tema vinculado a este livro para usar no seu perfil." : "Encontre um universo para chamar de seu."} size="xl">
      <div className="mb-theme-library">
        {!book && <div className="mb-theme-toolbar"><button className="mb-btn mb-btn-soft" aria-pressed={settings.scene === "none"} onClick={() => update({ scene: "none" })}>Sem tema · cores padrão</button><button className="mb-btn mb-btn-outline" onClick={() => setEditing(null)} disabled={!member || (mine.length >= 40 && !admin)}><Plus size={16} /> Criar tema <small>{mine.length}{admin ? " pessoais · sem limite" : "/40 pessoais"}</small></button></div>}
        {error && <p role="status" className="mb-editor-error">Não foi possível carregar os temas: {error}</p>}
        {group ? <>
          {!book && <button className="mb-btn mb-btn-ghost mb-theme-back" onClick={() => setSelectedGroup(null)}><ArrowLeft size={16}/> Todos os livros</button>}
          <h3 className="mb-theme-group-title">{group.title}</h3>
          <div className="mb-theme-banner-grid">{group.themes.map(theme => <article className="mb-theme-banner-card" key={theme.id}>
            <button data-banner-src={theme.imageUrl} data-banner-name={theme.name} className="mb-theme-banner" disabled={busy} onClick={() => choose(theme)} aria-label={`Usar tema ${theme.name}`} aria-pressed={settings.scene === theme.id}><ThemeProfilePreview theme={theme} profileSize={profileSize} sidebarSize={sidebarSize}/>{settings.scene === theme.id && <span className="mb-theme-check"><Check size={15}/> Selecionado</span>}</button>
            <h4>{theme.name}</h4><button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Ver imagem completa de ${theme.name}`} onClick={() => setViewing(theme)}><ImageIcon size={14}/> Ver imagem completa</button><footer><small>{theme.scope === "personal" ? "Pessoal" : "Sistema"}</small>{member && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Editar tema ${theme.name}`} onClick={() => setEditing(theme)}><Pencil size={13}/>{admin || theme.scope === "personal" ? "Editar" : "Personalizar"}</button>}{(theme.scope === "personal" || (admin && theme.updatedAt)) && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Excluir ou restaurar tema ${theme.name}`} onClick={() => setDeleting(theme)}><Trash2 size={13}/></button>}</footer>
          </article>)}</div>
        </> : <div className="mb-theme-book-grid">{groups.map(entry => <button className="mb-theme-book-card" key={entry.id} onClick={() => setSelectedGroup(entry.id)}>
          <span className="mb-theme-book-art">{entry.coverImagePath ? <img src={getFullUrl(entry.coverImagePath) || ""} alt="" loading="lazy" decoding="async"/> : <BookOpen size={44}/>}</span><strong>{entry.title}</strong><small>{entry.themes.length} {entry.themes.length === 1 ? "tema disponível" : "temas disponíveis"}</small>
        </button>)}</div>}
      </div>
    </Modal>
    <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Imagem completa · ${viewing.name}` : "Imagem completa"} size="xl">
      {viewing && <div style={{ aspectRatio: `${sourceSize(viewing).width}/${sourceSize(viewing).height}`, width: `min(100%, ${65 * sourceSize(viewing).width / sourceSize(viewing).height}vh)`, margin: "0 auto" }}><ThemeImage theme={viewing} crop={CENTER_CROP} referenceSize={sourceSize(viewing)}/></div>}
    </Modal>
    {editing !== undefined && <ThemeEditor theme={editing} onClose={() => setEditing(undefined)} onSaved={theme => { upsert(theme); update({ scene: theme.id as SceneId }); setEditing(undefined); }} />}
    <ConfirmDialog open={!!deleting} title={deleting?.scope === "system" ? "Remover personalização do sistema?" : "Excluir tema pessoal?"} description={deleting?.scope === "system" ? "O tema deixará de ser publicado. Se for um dos seis originais, ele voltará ao padrão para todos." : "O tema será excluído da sua conta e liberará uma das 40 vagas."} confirmLabel={busy ? "Removendo…" : "Remover"} destructive onConfirm={() => { if (!busy) erase(); }} onCancel={() => { if (!busy) setDeleting(null); }} />
  </>;
}
