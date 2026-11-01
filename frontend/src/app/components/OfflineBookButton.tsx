import { useEffect, useState } from "react";
import { Download, Check, Loader2, X, FileText, BookOpen } from "lucide-react";
import { cancelInstall, installBook, removeInstalled, useInstalled, useOffline } from "../lib/offline/device";
import { requireAuth } from "../lib/authGate";
import { fetchBook } from "../lib/api";
import { bookFileOptions, resolveBookFiles, formatFileSize, type BookFileFormat, type BookFileOption } from "../lib/bookFiles";
import type { Book } from "../lib/types";
import { Modal, toast } from "./Ui";
export function OfflineBookButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const { ids, download } = useInstalled(id), offline = useOffline(), installed = ids.has(id), busy = download && !download.error;
  const [open, setOpen] = useState(false), [book, setBook] = useState<Book | null>(null), [options, setOptions] = useState<BookFileOption[]>([]), [format, setFormat] = useState<BookFileFormat>("pdf"), [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setError(""); setBook(null); setOptions([]); setFormat("pdf");
    void fetchBook(id).then(async book => {
      if (controller.signal.aborted) return;
      if (!book) throw new Error("Livro indisponível.");
      setBook(book); setOptions(bookFileOptions(book));
      const timer = window.setTimeout(() => controller.abort(), 8000);
      const resolved = await resolveBookFiles(book, controller.signal); window.clearTimeout(timer);
      if (!controller.signal.aborted) setOptions(resolved);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [open, id]);
  const textOnly = !!book?.pages?.length && !options.some(option => option.url);
  const activate = () => {
    if (!requireAuth("instalar livros")) return;
    if (busy) cancelInstall(id); else setOpen(true);
  };
  const install = async () => {
    setOpen(false);
    try { await installBook(id, format); }
    catch (error) { toast(error instanceof Error ? error.message : "Não foi possível instalar.", "error"); }
  };
  return <>
    <button type="button" className={`mb-offline-book ${compact ? "is-compact" : "mb-btn mb-btn-outline"} ${installed ? "is-installed" : ""}`} disabled={offline && !installed} aria-label={installed ? "Gerenciar instalação deste aparelho" : busy ? "Cancelar instalação" : "Instalar para ler offline"} title={installed ? "Instalado neste aparelho" : "Instalar para ler offline"} onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); activate(); }}>
      {busy ? <Loader2 size={17} className="animate-spin"/> : <span className={`mb-installed-mark ${installed ? "is-installed" : ""}`}>{installed ? <Check size={15}/> : <Download size={15}/>}</span>}
      {!compact && <span>{busy ? download.phase === "converting" ? `Preparando leitura ${download.percent ?? 0}%` : download.percent === null ? `${(download.loaded/1048576).toFixed(1)} MB` : `Instalando ${download.percent}%` : installed ? "Instalado" : "Instalar livro"}</span>}
      {busy && !compact && <><progress aria-label="Progresso da instalação" max={100} value={download.percent ?? undefined}/><X size={14}/></>}
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={installed ? "Livro neste aparelho" : "Instalar livro"} description={book?.title || "Escolha o formato para leitura offline."} size="sm" footer={<>{installed && <button className="mb-btn mb-btn-outline" onClick={async () => { try { await removeInstalled(id); setOpen(false); } catch { setError("Não foi possível remover a instalação."); } }}>Remover do aparelho</button>}<button className="mb-btn mb-btn-primary" disabled={offline || (!textOnly && !options.find(option => option.format === format)?.url)} onClick={() => void install()}>{installed ? "Reinstalar" : "Instalar"} {textOnly ? "leitura" : format.toUpperCase()}</button></>}>
      {!book && !error && <p role="status">Carregando formatos disponíveis…</p>}
      {textOnly && <p className="mb-download-summary">Este livro está disponível como texto para leitura no app, sem arquivo PDF ou EPUB. Você pode instalar a leitura offline.</p>}
      <div className="mb-format-options">{options.map(option => <button type="button" key={option.format} className="mb-format-option" disabled={!option.url} aria-pressed={format === option.format} onClick={() => setFormat(option.format)}>{option.format === "pdf" ? <FileText size={25}/> : <BookOpen size={25}/>}<strong>{option.format.toUpperCase()}</strong><small>{option.url ? formatFileSize(option.bytes) : "Não disponível"}</small></button>)}</div>
      {book && <p className="mb-download-summary">{format === "epub" ? "Baixa o EPUB original e prepara uma cópia local para leitura no app. O espaço ocupado será maior que o tamanho do download." : "Mantém a paginação e a qualidade do PDF original."}{!book.epubPath && " Este livro não possui um EPUB original disponível."}</p>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
export function InstalledMark({ id }: { id: string }) {
  const { ids } = useInstalled(id), installed = ids.has(id);
  return <span className={`mb-installed-mark ${installed ? "is-installed" : ""}`} title={installed ? "Instalado neste aparelho" : "Não instalado neste aparelho"} aria-label={installed ? "Instalado para leitura offline" : "Não instalado neste aparelho"}>{installed ? <Check size={15} strokeWidth={3}/> : <Download size={14}/>}</span>;
}
