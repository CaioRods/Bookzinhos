import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import type { SceneTheme } from "../lib/appearance";
import { CENTER_CROP } from "../lib/appearance";
import { fetchBooks } from "../lib/api";
import { saveTheme, submitTheme } from "../lib/appearanceApi";
import { getUsername, isAdmin } from "../lib/session";
import { inspectImage } from "../lib/imageFile";
import { useThemeCatalog } from "../lib/themeCatalog";
import { CropEditor } from "./CropEditor";
import { BookPicker } from "./BookPicker";
import { Modal, toast } from "./Ui";
const blank = (): SceneTheme => ({ id: "", name: "", scope: "personal", imageUrl: "", width: 1536, height: 1024, atlas: null, mainColor: "#64344f", profile: { ...CENTER_CROP }, sidebar: { ...CENTER_CROP }, sidebarOpacity: .75, reference: null });
export function ThemeEditor({ theme, onClose, onSaved }: { theme: SceneTheme | null; onClose: () => void; onSaved: (theme: SceneTheme) => void }) {
  const [draft, setDraft] = useState<SceneTheme>(() => theme ? structuredClone(theme) : blank());
  const [scope, setScope] = useState<"system" | "personal">(isAdmin() && theme?.scope === "system" ? "system" : "personal");
  const [surface, setSurface] = useState<"profile" | "sidebar">("profile");
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState("");
  const [requestPublic, setRequestPublic] = useState(false);
  const [picker, setPicker] = useState(false), [bookName, setBookName] = useState(theme?.reference?.bookId || "");
  useEffect(() => { if (!theme?.reference?.bookId) return; let alive = true; fetchBooks().then(books => { const book = books.find(book => book.id === theme.reference?.bookId); if (alive && book) setBookName(book.title); }).catch(() => {}); return () => { alive = false; }; }, [theme?.reference?.bookId]);
  const fileInput = useRef<HTMLInputElement>(null), url = useRef("");
  const { themes } = useThemeCatalog();
  const atLimit = scope === "personal" && theme?.scope !== "personal" && themes.filter(entry => entry.scope === "personal").length >= 4;
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const imageChange = async (candidate?: File) => {
    if (!candidate) return; setReading(true); setError("");
    try { const image = await inspectImage(candidate); if (url.current) URL.revokeObjectURL(url.current); url.current = image.url; setPreview(image.url); setFile(candidate); setDraft(current => ({ ...current, width: image.width, height: image.height, atlas: null, profile: { ...CENTER_CROP }, sidebar: { ...CENTER_CROP } })); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível abrir a imagem."); }
    finally { setReading(false); }
  };
  const save = async () => {
    if (!getUsername()) { setError("Entre na sua conta para salvar um tema."); return; }
    setBusy(true); setError("");
    try { const saved = await saveTheme(draft, scope, file); if (requestPublic && scope === "personal") await submitTheme(saved.id); onSaved(saved); toast(requestPublic && scope === "personal" ? "Tema salvo e enviado para aprovação." : scope === "system" ? "Tema publicado para todos." : "Tema pessoal salvo."); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };
  const source = { ...draft, imageUrl: preview || draft.imageUrl };
  return <><Modal open onClose={() => { if (!busy) onClose(); }} title={theme ? "Editar tema" : "Criar tema personalizado"} description="A mesma imagem, com recortes independentes para o perfil e o menu." size="lg" footer={<><button className="mb-btn mb-btn-outline" disabled={busy} onClick={onClose}>Cancelar</button><button className="mb-btn mb-btn-primary" disabled={busy || reading || atLimit || !draft.name.trim() || (!file && !draft.imageUrl)} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />}{scope === "system" ? "Publicar para todos" : "Salvar tema pessoal"}</button></>}>
    <div className="mb-theme-editor">
      <div className="mb-theme-form-row"><label>Nome do tema<input className="mb-input" aria-label="Nome do tema" maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: O povo do ar" /></label><label>Cor principal<input type="color" aria-label="Cor principal do tema" value={draft.mainColor} onChange={event => setDraft({ ...draft, mainColor: event.target.value })} /></label></div>
      <button className="mb-btn mb-btn-outline" onClick={() => fileInput.current?.click()} disabled={reading || busy}><ImagePlus size={17} />{reading ? "Abrindo imagem…" : "Adicionar ou trocar imagem"}</button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" aria-label="Imagem do tema" onChange={event => imageChange(event.target.files?.[0])} /><p className="mb-editor-hint">Recomendado: 2400 × 1600 px para os dois recortes. JPG, PNG, WebP ou AVIF; até 8 MB.</p>
      <div className="mb-editor-tabs">{([['profile', 'Banner do perfil'], ['sidebar', 'Menu lateral']] as const).map(([key, label]) => <button key={key} className="mb-btn mb-btn-outline" aria-pressed={surface === key} onClick={() => setSurface(key)}>{label}</button>)}</div>
      {(preview || draft.imageUrl) ? <CropEditor theme={source} value={draft[surface]} onChange={crop => setDraft({ ...draft, [surface]: crop })} label={surface === "profile" ? "Recorte do perfil" : "Recorte do menu"} surface={surface} opacity={surface === "sidebar" ? draft.sidebarOpacity : 1} /> : <p className="mb-picker-empty">Adicione uma imagem para ajustar os recortes.</p>}
      <label className="mb-editor-range">Força da imagem no menu lateral <output>{Math.round(draft.sidebarOpacity * 100)}%</output><input type="range" aria-label="Transparência da imagem no menu" min="0" max="1" step=".01" value={draft.sidebarOpacity} onChange={event => setDraft({ ...draft, sidebarOpacity: Number(event.target.value) })} /></label>
      <label className="mb-theme-checkbox"><input type="checkbox" checked={!!draft.reference} onChange={event => setDraft({ ...draft, reference: event.target.checked ? { bookId: "", saga: "" } : null })} />Este tema faz referência a um livro ou saga</label>
      {draft.reference && <div className="mb-theme-reference-fields"><button className="mb-btn mb-btn-outline" onClick={() => setPicker(true)}>{draft.reference.bookId ? `Livro: ${bookName}` : "Pesquisar livro de referência"}</button><label>Nome da saga (opcional)<input className="mb-input" aria-label="Nome da saga" value={draft.reference.saga} maxLength={100} onChange={event => setDraft({ ...draft, reference: { ...draft.reference!, saga: event.target.value } })} placeholder="Ex.: O povo do ar" /></label></div>}
      {isAdmin() && <label className="mb-theme-checkbox mb-system-publish"><input type="checkbox" checked={scope === "system"} onChange={event => setScope(event.target.checked ? "system" : "personal")} />Disponível para todos (Admin)<small>Ativado: publica ou atualiza um tema do sistema. Desativado: salva uma cópia pessoal.</small></label>}
      {!isAdmin() && <label className="mb-theme-checkbox mb-system-publish"><input type="checkbox" checked={requestPublic} onChange={event => setRequestPublic(event.target.checked)} />Solicitar ao admin para liberar para todos<small>Seu tema continua pessoal enquanto aguarda análise.</small></label>}
      {atLimit && <p role="alert">Você já tem quatro temas pessoais. Edite ou exclua um deles para criar outro.</p>}{error && <p role="alert" className="mb-editor-error">{error}</p>}
    </div>
  </Modal>{picker && <BookPicker selectedId={draft.reference?.bookId || ""} title="Livro de referência do tema" onSelect={book => { setDraft(current => ({ ...current, reference: { bookId: book.id, saga: current.reference?.saga || "" } })); setBookName(book.title); }} onClose={() => setPicker(false)} />}</>;
}
