import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { DEFAULT_SCENE, type SceneId } from "../lib/scenery";
import { useSettings } from "../lib/settings";
import { useThemeCatalog, DEFAULT_THEMES } from "../lib/themeCatalog";
import { getUsername, isAdmin } from "../lib/session";
import { fetchBooks } from "../lib/api";
import { deleteTheme } from "../lib/appearanceApi";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage } from "./ThemeImage";
import { ThemeEditor } from "./ThemeEditor";
import { ConfirmDialog, toast } from "./Ui";
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
  const [books, setBooks] = useState<Book[]>([]), [open, setOpen] = useState(true);
  useEffect(() => { let alive = true; fetchBooks().then(value => { if (alive) setBooks(value); }).catch(() => {}); return () => { alive = false; }; }, []);
  const { themes, error, upsert, remove } = useThemeCatalog();
  const [editing, setEditing] = useState<SceneTheme | null | undefined>(undefined), [deleting, setDeleting] = useState<SceneTheme | null>(null), [busy, setBusy] = useState(false);
  const mine = themes.filter(theme => theme.scope === "personal"), admin = isAdmin(), member = !!getUsername();
  const groups = groupThemesByBook(themes.filter(theme => theme.id !== "none"), books);
  const erase = async () => { if (!deleting) return; setBusy(true); try { await deleteTheme(deleting.id); remove(deleting.id); if (settings.scene === deleting.id) update({ scene: DEFAULT_SCENE }); setDeleting(null); toast("Tema removido. Os temas do sistema voltam ao padrão quando restaurados."); } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível remover.", "error"); } finally { setBusy(false); } };
  return <section id="profile-scenery" className="mb-scene-section" aria-labelledby="scene-heading"><div className="mb-scene-section-heading"><div><h2 id="scene-heading">Personalização</h2><p>Banner, menu e cores do seu espaço literário.</p></div><button className="mb-btn mb-btn-outline" onClick={() => setOpen(value => !value)} aria-expanded={open}><ChevronDown size={16} className={open ? "rotate-180" : ""} /> {open ? "Fechar" : "Personalização"}</button></div>
    {open && <div className="mb-personalization-panel"><div className="flex justify-between gap-3 flex-wrap mb-4"><button className="mb-btn mb-btn-soft" aria-pressed={settings.scene === "none"} onClick={() => update({ scene: "none" })}>Sem tema · usar cores padrão</button><button className="mb-btn mb-btn-outline" onClick={() => setEditing(null)} disabled={!member || (mine.length >= 4 && !admin)}><Plus size={16} /> Criar tema</button></div>
    {error && <p className="mb-editor-error" role="status">Os temas salvos não puderam ser carregados: {error}</p>}
    {groups.map(group => <section className="mb-theme-book-group" key={group.id}><header>{group.id !== "general" && <Link to={`/book/${encodeURIComponent(group.id)}`}><span>{group.coverImagePath ? <img src={getFullUrl(group.coverImagePath) || ""} alt="" /> : "📖"}</span><strong>{group.title}</strong></Link>}{group.id === "general" && <h3>{group.title}</h3>}</header><div className="mb-scene-grid">{group.themes.map(theme => <div key={theme.id} className="mb-theme-tile"><button onClick={() => update({ scene: theme.id as SceneId })} aria-pressed={settings.scene === theme.id} className="mb-scene-option"><ThemeImage theme={theme} crop={theme.profile} /><span className="mb-scene-name">{theme.name}</span>{settings.scene === theme.id && <span className="mb-scene-selected"><Check size={15} /> Selecionado</span>}</button><footer><span>{theme.scope === "personal" ? "Pessoal" : "Sistema"}</span>{member && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Editar tema ${theme.name}`} onClick={() => setEditing(theme)}><Pencil size={13} />{admin || theme.scope === "personal" ? "Editar" : "Personalizar"}</button>}{(theme.scope === "personal" || (admin && theme.updatedAt)) && <button className="mb-btn mb-btn-ghost mb-btn-sm" aria-label={`Excluir ou restaurar tema ${theme.name}`} onClick={() => setDeleting(theme)}><Trash2 size={13} /></button>}</footer></div>)}</div></section>)}
    </div>}
    {editing !== undefined && <ThemeEditor theme={editing} onClose={() => setEditing(undefined)} onSaved={theme => { upsert(theme); update({ scene: theme.id as SceneId }); setEditing(undefined); }} />}
    <ConfirmDialog open={!!deleting} title={deleting?.scope === "system" ? "Remover personalização do sistema?" : "Excluir tema pessoal?"} description={deleting?.scope === "system" ? "O tema deixará de ser publicado. Se for um dos seis originais, ele voltará ao padrão para todos." : "O tema será excluído da sua conta e liberará uma das quatro vagas."} confirmLabel={busy ? "Removendo…" : "Remover"} destructive onConfirm={() => { if (!busy) erase(); }} onCancel={() => { if (!busy) setDeleting(null); }} />
  </section>;
}
