import { getSpineColor } from "../lib/coverColor";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, Bookmark, BookOpen, Castle, Check, Coffee, DownloadCloud, Flower2, Heart, Library, Moon, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, X, Zap } from "lucide-react";
import { fetchBooks } from "../lib/api";
import { type Booklist, deleteBooklist, fetchBooklists, saveBooklist } from "../lib/booklists";
import { getFullUrl, type Book, type ReadingProgress } from "../lib/types";
import { accentVariables, colorToHex, type SceneTheme } from "../lib/appearance";
import { inspectImage } from "../lib/imageFile";
import { installBooklist, stopBooklistInstall, useBooklistInstall } from "../lib/offline/batch";
import { useInstalled, useOffline } from "../lib/offline/device";
import { BookGrid } from "./BookGrid";
import { ThemeImage } from "./ThemeImage";
import { ConfirmDialog, Modal, toast } from "./Ui";
const ICONS = { heart: Heart, sparkles: Sparkles, bookmark: Bookmark, castle: Castle, coffee: Coffee, zap: Zap, book: BookOpen, moon: Moon, flower: Flower2, library: Library };
const COLORS = ["#c9aaa1", "#66a3f5", "#cf86ea", "#94b87a", "#efa66e", "#6eaeb9", "#b58ba9", "#a7a8cf"];
function blank(): Booklist { return { id: "", name: "", color: COLORS[0], icon: "heart", imageUrl: "", imageWidth: 1000, imageHeight: 1000, crop: { x: 50, y: 50, zoom: 1 }, bookIds: [], updatedAt: 0 }; }
export function FolderArtwork({ list }: { list: Booklist }) {
  const artId = useId().replace(/:/g, "");
  const Icon = ICONS[list.icon as keyof typeof ICONS] || Heart;
  const theme: SceneTheme = { id: list.id, name: list.name, scope: "personal", imageUrl: list.imageUrl, width: list.imageWidth, height: list.imageHeight, mainColor: list.color, profile: list.crop, sidebar: list.crop, sidebarOpacity: 1 };
  return <div className={`mb-folder-art ${list.imageUrl ? "has-image" : ""}`} style={{ "--folder-color": list.color } as CSSProperties}>
    {list.imageUrl && <ThemeImage theme={theme} crop={list.crop}/>}
    <div className="mb-folder-glow"/><svg className="mb-folder-shape" viewBox="0 0 280 300" aria-hidden="true"><defs>
      <linearGradient id={`${artId}-back`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .16 : .85}/><stop offset="1" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .04 : .5}/></linearGradient>
      <linearGradient id={`${artId}-glass`} x1="0" y1="0" x2="1" y2=".35"><stop stopColor="#ffffff" stopOpacity={list.imageUrl ? .15 : .55}/><stop offset=".2" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .05 : .5}/><stop offset=".75" stopColor={list.imageUrl ? "#ffffff" : list.color} stopOpacity={list.imageUrl ? .01 : .7}/><stop offset="1" stopColor="#ffffff" stopOpacity={list.imageUrl ? .13 : .65}/></linearGradient>
    </defs><path className="mb-folder-back" style={{fill:`url(#${artId}-back)`}} d="M12 56Q12 27 39 27H86Q98 27 107 39L126 62Q132 69 146 69H241Q269 69 269 96V251Q269 278 242 278H39Q12 278 12 251Z"/><rect className="mb-folder-paper" x="20" y="77" width="239" height="203" rx="24"/><rect className="mb-folder-front" style={{fill:`url(#${artId}-glass)`}} x="16" y="91" width="251" height="194" rx="25"/></svg>
    <div className="mb-folder-copy"><strong>{list.name || "Minha Booklist"}</strong><span>{list.bookIds.length} {list.bookIds.length === 1 ? "livro" : "livros"}</span><Icon size={29} fill="currentColor" strokeWidth={1.2}/></div>
  </div>;
}
function BatchDownload({ list }: { list: Booklist }) {
  const state = useBooklistInstall(list.id), offline = useOffline(), { ids, download } = useInstalled(state?.current);
  const installed = list.bookIds.filter(id => ids.has(id)).length;
  return <div className="mb-booklist-download">
    <button className="mb-btn mb-btn-primary" disabled={offline || !list.bookIds.length || state?.running} onClick={() => { void installBooklist(list.id, list.bookIds).catch(error => toast(error.message, "error")); }}><DownloadCloud size={17}/>{state?.running ? `Instalando ${Math.min(state.completed+1,state.total)} de ${state.total}` : installed === list.bookIds.length && installed ? "Todos instalados" : "Instalar todos"}</button>
    {state?.running && <button className="mb-btn mb-btn-ghost" onClick={() => stopBooklistInstall(list.id)}><X size={16}/> Cancelar</button>}
    <small>{installed} de {list.bookIds.length} disponíveis offline{state?.failed.length ? ` · ${state.failed.length} não puderam ser instalados. Toque em instalar para tentar novamente.` : ""}</small>
    {state && <progress aria-label="Instalação da Booklist" max={state.total || 1} value={state.completed + (state.running ? (download?.percent || 0)/100 : 0)}/>}
  </div>;
}
export function Booklists({ books, progressOf, savedIds, onSavedChange, heading, children }: { books: Book[]; progressOf: Map<string, ReadingProgress>; savedIds: string[]; onSavedChange: (id: string, saved: boolean) => void; heading?: React.ReactNode; children: React.ReactNode }) {
  const [lists, setLists] = useState<Booklist[]>([]), [params, setParams] = useSearchParams(), offline = useOffline();
  const [editing, setEditing] = useState<Booklist | null>(null), [selection, setSelection] = useState<Booklist | null>(null), [menu, setMenu] = useState<Booklist | null>(null), [deleting, setDeleting] = useState<Booklist | null>(null);
  const active = lists.find(list => list.id === params.get("booklist"));
  const load = () => fetchBooklists().then(setLists).catch(error => toast(error.message, "error"));
  useEffect(() => { void load(); }, [offline]);
  const saved = async () => { await load(); setEditing(null); setSelection(null); };
  const open = (id?: string) => { const next = new URLSearchParams(params); if (id) next.set("booklist", id); else next.delete("booklist"); setParams(next); requestAnimationFrame(() => document.getElementById("main-content")?.scrollTo({ top: 0, behavior: document.documentElement.dataset.reduceMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })); };
  if (active) {
    const ordered = active.bookIds.map(id => books.find(book => book.id === id)).filter(Boolean) as Book[];
    return <section className="mb-booklist-room" key={active.id} style={{ ...accentVariables(active.color), "--folder-color": active.color } as CSSProperties}>
      <button className="mb-btn mb-btn-ghost mb-booklist-back" onClick={() => open()}><ArrowLeft size={17}/> Meus livros</button>
      <header className="mb-booklist-hero"><div className="mb-booklist-hero-art"><FolderArtwork list={active}/></div><div><p className="mb-eyebrow">SUA BOOKLIST</p><h1>{active.name}</h1><p>{active.bookIds.length} livros{offline ? ` · ${ordered.length} instalados neste aparelho` : " · Cada história no seu lugar"}</p><BatchDownload list={active}/><button className="mb-btn mb-btn-outline" onClick={() => setMenu(active)}><MoreHorizontal size={18}/> Opções da Booklist</button></div></header>
      {!ordered.length ? <div className="mb-booklist-empty"><BookOpen size={30}/><p>{offline ? "Nenhum livro desta Booklist está instalado neste aparelho." : "Sua próxima coleção começa com um livro."}</p>{!offline && <button className="mb-btn mb-btn-primary" onClick={() => setSelection(active)}><Plus size={16}/> Adicionar livros</button>}</div> : <BookGrid books={ordered} progressOf={progressOf} savedIds={savedIds} onSavedChange={onSavedChange}/>}
      {dialogs()}
    </section>;
  }
  function dialogs() { return <>
    {menu && <Modal open title={menu.name} onClose={() => setMenu(null)} size="sm"><div className="mb-booklist-actions"><button className="mb-btn mb-btn-ghost" disabled={offline} onClick={() => { setEditing(menu); setMenu(null); }}><Pencil size={17}/> Editar Booklist</button><button className="mb-btn mb-btn-ghost" disabled={offline} onClick={() => { setSelection(menu); setMenu(null); }}><Plus size={17}/> Adicionar ou remover livros</button><BatchDownload list={menu}/><button className="mb-btn mb-btn-ghost" disabled={offline} onClick={() => { setDeleting(menu); setMenu(null); }}><Trash2 size={17}/> Excluir Booklist</button></div></Modal>}
    {editing && <BooklistEditor list={editing} onClose={() => setEditing(null)} onSaved={saved}/>}
    {selection && <BooklistBooks list={selection} onClose={() => setSelection(null)} onSaved={saved}/>}
    <ConfirmDialog open={!!deleting} title="Excluir Booklist?" description="Os livros e as instalações permanecem na sua biblioteca. Apenas a pasta será excluída." confirmLabel="Excluir" destructive onCancel={() => setDeleting(null)} onConfirm={async () => { if (!deleting) return; try { await deleteBooklist(deleting.id); if (active?.id === deleting.id) open(); setDeleting(null); await load(); } catch (error) { toast(error instanceof Error ? error.message : "Não foi possível excluir.", "error"); } }}/>
  </>; }
  return <>{heading}<section className="mb-booklists"><header><div><p className="mb-eyebrow">HISTÓRIAS QUE COMBINAM</p><h2>Suas Booklists</h2><p>Pequenas coleções. Infinitos universos.</p></div><button className="mb-btn mb-btn-primary" disabled={offline} onClick={() => setEditing(blank())}><Plus size={17}/> Criar Booklist</button></header>
    <div className="mb-booklist-grid">{lists.map(list => <article className="mb-booklist-card" key={list.id}><button className="mb-booklist-open" data-context-menu aria-label={`Abrir Booklist ${list.name}`} onClick={() => open(list.id)} onContextMenu={event => { event.preventDefault(); setMenu(list); }}><FolderArtwork list={list}/></button><button className="mb-booklist-more" aria-label={`Opções de ${list.name}`} onClick={() => setMenu(list)}><MoreHorizontal size={21}/></button></article>)}{!lists.length && <button className="mb-booklist-create" disabled={offline} onClick={() => setEditing(blank())}><Plus size={30}/><strong>Sua primeira Booklist</strong><span>Crie uma pasta para cada momento.</span></button>}</div>
  </section>{children}{dialogs()}</>;
}
function BooklistEditor({ list, onClose, onSaved }: { list: Booklist; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(list), [file, setFile] = useState<File>(), [preview, setPreview] = useState(""), [remove, setRemove] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const object = useRef("");
  useEffect(() => () => { if (object.current) URL.revokeObjectURL(object.current); }, []);
  const pick = async (candidate?: File) => { if (!candidate) return; try { if (candidate.size > 5*1024*1024) throw new Error("Use uma imagem de até 5 MB."); const image = await inspectImage(candidate); if (object.current) URL.revokeObjectURL(object.current); object.current = image.url; setPreview(image.url); setFile(candidate); setRemove(false); setDraft(current => ({ ...current, imageWidth: image.width, imageHeight: image.height, crop: { x: 50, y: 50, zoom: 1 } })); const palette = await getSpineColor(image.url); if (object.current === image.url) setDraft(current => ({ ...current, color: colorToHex(palette.base) })); } catch (error) { setError(error instanceof Error ? error.message : "Imagem inválida."); } };
  return <Modal open title={list.id ? "Editar Booklist" : "Criar Booklist"} description="Uma coleção com a sua identidade." onClose={onClose} size="lg" footer={<><button className="mb-btn mb-btn-outline" onClick={onClose}>Cancelar</button><button className="mb-btn mb-btn-primary" disabled={busy || !draft.name.trim()} onClick={async () => { setBusy(true); setError(""); try { await saveBooklist(draft, file, remove); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Salvar Booklist"}</button></>}>
    <div className="mb-booklist-editor"><div className="mb-booklist-preview"><FolderArtwork list={{ ...draft, imageUrl: remove ? "" : preview || draft.imageUrl }}/></div><div className="mb-booklist-fields">
      <label>Nome<input className="mb-input" aria-label="Nome da Booklist" maxLength={80} placeholder="Ex.: Meus favoritos" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
      <label>Cor da pasta<input aria-label="Cor da Booklist" type="color" value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })}/></label><div className="mb-booklist-colors">{COLORS.map(color => <button aria-label={`Usar cor ${color}`} aria-pressed={draft.color === color} key={color} style={{ background: color }} onClick={() => setDraft({ ...draft, color })}/>)}</div>
      <label>Ícone</label><div className="mb-booklist-icons">{Object.entries(ICONS).map(([key, Icon]) => <button aria-label={`Ícone ${key}`} aria-pressed={draft.icon === key} key={key} onClick={() => setDraft({ ...draft, icon: key })}><Icon size={20}/></button>)}</div>
      <label className="mb-btn mb-btn-outline">Imagem de capa (opcional)<input aria-label="Imagem da Booklist" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={event => void pick(event.target.files?.[0])}/></label>
      {(preview || draft.imageUrl) && !remove && <><button className="mb-btn mb-btn-ghost" onClick={() => { setRemove(true); setFile(undefined); setPreview(""); }}>Remover imagem</button>{([{ key: "x", label: "Horizontal", min: 0, max: 100, step: 1 }, { key: "y", label: "Vertical", min: 0, max: 100, step: 1 }, { key: "zoom", label: "Zoom", min: 1, max: 4, step: .05 }] as const).map(control => <label key={control.key}>{control.label}<input aria-label={`Capa: ${control.label}`} type="range" {...{ min: control.min, max: control.max, step: control.step }} value={draft.crop[control.key]} onChange={event => setDraft({ ...draft, crop: { ...draft.crop, [control.key]: Number(event.target.value) } })}/></label>)}</>}
      {error && <p role="alert" className="mb-editor-error">{error}</p>}
    </div></div>
  </Modal>;
}
function BooklistBooks({ list, onClose, onSaved }: { list: Booklist; onClose: () => void; onSaved: () => void }) {
  const [books, setBooks] = useState<Book[]>([]), [selected, setSelected] = useState(list.bookIds), [search, setSearch] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { fetchBooks().then(setBooks).catch(() => setError("Não foi possível carregar os livros.")); }, []);
  const filtered = books.filter(book => `${book.title} ${book.author} ${book.seriesName || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <Modal open title={`Livros de ${list.name}`} onClose={onClose} size="xl" description="Selecione ou desmarque vários livros. A ordem de seleção será a ordem da Booklist." footer={<><span>{selected.length} selecionados</span><button className="mb-btn mb-btn-outline" onClick={onClose}>Cancelar</button><button className="mb-btn mb-btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await saveBooklist({ ...list, bookIds: selected }); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); } }}>Confirmar seleção</button></>}>
    <div className="mb-picker-search"><Search size={18}/><input className="mb-input" aria-label="Pesquisar livros da Booklist" placeholder="Livros, autores ou sagas…" value={search} onChange={event => setSearch(event.target.value)}/></div>
    {error && <p role="alert">{error}</p>}<div className="mb-book-picker-grid">{filtered.map(book => <button key={book.id} aria-pressed={selected.includes(book.id)} onClick={() => setSelected(previous => previous.includes(book.id) ? previous.filter(id => id !== book.id) : [...previous, book.id])}><span>{book.coverImagePath ? <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy"/> : <BookOpen/>}{selected.includes(book.id) && <i><Check size={16}/></i>}</span><strong>{book.title}</strong><small>{book.author}</small></button>)}</div>{!filtered.length && <p>Nenhum livro encontrado.</p>}
  </Modal>;
}
