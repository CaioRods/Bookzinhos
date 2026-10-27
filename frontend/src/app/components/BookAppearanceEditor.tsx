import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import type { Book } from "../lib/types";
import { getFullUrl } from "../lib/types";
import { DEFAULT_BOOK_APPEARANCE, type BookAppearance, type SceneTheme } from "../lib/appearance";
import { inspectImage } from "../lib/imageFile";
import { saveBookAppearance } from "../lib/appearanceApi";
import { CropEditor } from "./CropEditor";
import { ThemeImage } from "./ThemeImage";
import { Modal, toast } from "./Ui";
export function BookAppearanceEditor({ book, autoColor, onClose, onSaved }: { book: Book; autoColor: string; onClose: () => void; onSaved: (appearance: BookAppearance) => void }) {
  const [draft, setDraft] = useState<BookAppearance>(() => structuredClone(book.appearance || DEFAULT_BOOK_APPEARANCE));
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(""), [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null), url = useRef("");
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const source: SceneTheme = { id: book.id, scope: "system", name: book.title, imageUrl: preview || draft.imageUrl || getFullUrl(book.coverImagePath) || "/scenery/golden-branches.webp", width: draft.width || 800, height: draft.height || 1200, mainColor: draft.mainColor || autoColor, profile: draft.crop, sidebar: draft.crop, sidebarOpacity: 1 };
  const changeFile = async (candidate?: File) => {
    if (!candidate) return; setReading(true); setError("");
    try { const image = await inspectImage(candidate); if (url.current) URL.revokeObjectURL(url.current); url.current = image.url; setPreview(image.url); setFile(candidate); setDraft(current => ({ ...current, width: image.width, height: image.height, crop: { x: 50, y: 50, zoom: 1 } })); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível abrir a imagem."); }
    finally { setReading(false); }
  };
  const save = async () => { setBusy(true); setError(""); try { const saved = await saveBookAppearance(book.id, draft, file); onSaved(saved); toast("Aparência do livro atualizada para todos."); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); } };
  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Aparência da página do livro" description={`Personalização de “${book.title}”, visível para todos os leitores.`} size="lg" footer={<><button className="mb-btn mb-btn-outline" disabled={busy} onClick={onClose}>Cancelar</button><button className="mb-btn mb-btn-primary" disabled={busy || reading} onClick={save}>{busy && <Loader2 size={16} className="animate-spin" />} Salvar aparência</button></>}>
    <div className="mb-theme-editor"><div className="mb-book-art-preview"><div style={{ filter: `blur(${draft.blur}px)`, opacity: draft.opacity, transform: "scale(1.15)" }}><ThemeImage theme={source} crop={draft.crop} /></div><strong style={{ color: draft.mainColor || autoColor }}>{book.title}</strong><small>Prévia do fundo da página</small></div>
      <div className="mb-editor-tabs"><button className="mb-btn mb-btn-outline" disabled={reading || busy} onClick={() => fileInput.current?.click()}><ImagePlus size={16} /> Enviar banner do livro</button><button className="mb-btn mb-btn-outline" onClick={() => { setFile(null); setPreview(""); setDraft(current => ({ ...current, imageUrl: "", width: 800, height: 1200, crop: { x: 50, y: 50, zoom: 1 } })); }}><RotateCcw size={15} /> Usar capa como fundo</button></div>
      <input className="hidden" ref={fileInput} type="file" aria-label="Banner de fundo do livro" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => changeFile(event.target.files?.[0])} /><p className="mb-editor-hint">O padrão usa a capa ampliada. Para um banner próprio, prefira 2400 × 1600 px; até 8 MB.</p>
      <label className="mb-theme-checkbox"><input type="checkbox" checked={!draft.mainColor} onChange={event => setDraft({ ...draft, mainColor: event.target.checked ? null : autoColor })} />Usar automaticamente a cor dominante da capa</label>
      <label className="mb-theme-color-field">Cor principal da página<input type="color" aria-label="Cor principal da página do livro" value={draft.mainColor || autoColor} onChange={event => setDraft({ ...draft, mainColor: event.target.value })} /></label>
      <label className="mb-editor-range">Desfoque do fundo<output>{draft.blur}px</output><input aria-label="Desfoque do fundo do livro" type="range" min="0" max="60" step="1" value={draft.blur} onChange={event => setDraft({ ...draft, blur: Number(event.target.value) })} /></label>
      <label className="mb-editor-range">Intensidade da imagem<output>{Math.round(draft.opacity * 100)}%</output><input aria-label="Intensidade do fundo do livro" type="range" min="0" max="1" step=".01" value={draft.opacity} onChange={event => setDraft({ ...draft, opacity: Number(event.target.value) })} /></label>
      <CropEditor theme={source} value={draft.crop} label="Recorte do fundo do livro" surface="book" onChange={crop => setDraft({ ...draft, crop })} />
      {error && <p role="alert" className="mb-editor-error">{error}</p>}
    </div>
  </Modal>;
}
