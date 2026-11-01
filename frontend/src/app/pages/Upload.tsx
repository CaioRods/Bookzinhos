import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Upload as UploadIcon, CheckCircle2, SkipForward, X, RotateCcw, Library } from "lucide-react";
import { uploadBook, saveProgress, type BookUploadStage } from "../lib/api";
import { randomCoverColor } from "../lib/types";
import { bookFileKind } from "../lib/epub/convert";
import { prepareBook } from "../lib/prepareBook";
import { automaticGenreCandidate, openLibraryDetails, searchBookMetadata, type BookMetadata } from "../lib/bookMetadata";
import { SeriesField } from "../components/SeriesField";
import { GenreField } from "../components/GenreField";
import { AuthorField } from "../components/AuthorField";
import { UploadProgress } from "../components/UploadProgress";
import { Modal } from "../components/Ui";
import { BookMetadataLookup } from "../components/BookMetadataLookup";

type Status = "waiting" | "preparing" | "ready" | "publishing" | "published" | "error" | "skipped";
interface QueueItem { id: string; file: File; status: Status; bookId?: string }
const emptyForm = () => ({ title: "", author: "", description: "", genre: "Outros", isPublic: true, seriesId: "", seriesOrder: 1, publisher: "", publishedYear: "", metadataSource: "", metadataId: "", isbn: "" });
export function Upload() {
  const navigate = useNavigate();
  const mounted = useRef(true);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [formData, setFormData] = useState(emptyForm), formRef = useRef(formData); formRef.current = formData;
  const touched = useRef(new Set<string>());
  const [queue, setQueue] = useState<QueueItem[]>([]), queueRef = useRef(queue); queueRef.current = queue;
  const [currentId, setCurrentId] = useState<string | null>(null), activeId = useRef<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null), [totalPages, setTotalPages] = useState(1);
  const [coverFile, setCoverFile] = useState<File | null>(null), [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false), posting = useRef(false), [isPreparing, setIsPreparing] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<number | null>(null), [uploadStage, setUploadStage] = useState<BookUploadStage>("checking");
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState("");
  const [metadataNotice, setMetadataNotice] = useState(""), [findingGenre, setFindingGenre] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false), [isDragOverCover, setIsDragOverCover] = useState(false);
  const processing = useRef<AbortController | null>(null), lookup = useRef<AbortController | null>(null);
  const coverUrl = useRef<string | null>(null), manualCover = useRef(false), coverInput = useRef<HTMLInputElement>(null);
  const published = queue.filter(item => item.status === "published").length;
  const current = queue.find(item => item.id === currentId), currentIndex = queue.findIndex(item => item.id === currentId);
  const complete = queue.length > 0 && !currentId && queue.every(item => ["published", "skipped"].includes(item.status));
  const hasPending = queue.some(item => !["published", "skipped"].includes(item.status));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; processing.current?.abort(); lookup.current?.abort(); if (coverUrl.current) URL.revokeObjectURL(coverUrl.current); }; }, []);
  useEffect(() => {
    if (!hasPending) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasPending]);
  const changeQueue = (items: QueueItem[]) => { queueRef.current = items; setQueue(items); };
  const patchItem = (id: string, patch: Partial<QueueItem>) => changeQueue(queueRef.current.map(item => item.id === id ? { ...item, ...patch } : item));
  const edit = (key: string, value: string) => { if (["title", "author"].includes(key)) { lookup.current?.abort(); setFindingGenre(false); setMetadataNotice(""); } touched.current.add(key); setFormData(previous => ({ ...previous, [key]: value })); };
  const previewCover = (file: File) => {
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
    coverUrl.current = URL.createObjectURL(file); setCoverFile(file); setCoverPreview(coverUrl.current);
  };
  const resetDraft = () => {
    processing.current?.abort(); lookup.current?.abort(); touched.current.clear(); manualCover.current = false;
    const form = emptyForm(); formRef.current = form; setFormData(form);
    setPdfFile(null); setCoverFile(null); setCoverPreview(null); setTotalPages(1); setError(null); setMetadataNotice(""); setFindingGenre(false); setConversionProgress(null);
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current); coverUrl.current = null;
  };
  const suggestGenre = async (title: string, author: string, id: string) => {
    lookup.current?.abort(); const controller = new AbortController(); lookup.current = controller; setFindingGenre(true);
    try {
      let responded = false, matched = false; const failures: string[] = [];
      const applyAvailable = (match: BookMetadata) => {
        if (controller.signal.aborted || activeId.current !== id || formRef.current.title !== title || formRef.current.author !== author) return;
        setFormData(previous => {
          const fillGenre = !touched.current.has("genre") && (!previous.genre || previous.genre === "Outros") && !!match.genres.length;
          const fillDescription = !touched.current.has("description") && !previous.description.trim() && !!match.description;
          return { ...previous, ...(fillGenre ? { genre: match.genres.join(", ") } : {}), ...(fillDescription ? { description: match.description } : {}), ...((fillGenre || fillDescription) ? { metadataSource: match.source, metadataId: match.id } : {}) };
        });
      };
      let description = "", genres: string[] = [];
      for (const source of ["google", "openlibrary"] as const) {
        setMetadataNotice(`Consultando ${source === "google" ? "Google Books" : "Open Library"} para “${title}”${author ? `, de ${author}` : ""}…`);
        try {
          let records = await searchBookMetadata(title, author, source, controller.signal);
          if (!automaticGenreCandidate(records, title, author) && author) records = await searchBookMetadata(title, "", source, controller.signal);
          if (controller.signal.aborted || activeId.current !== id) return;
          let match = automaticGenreCandidate(records, title, author); responded = true;
          if (!match) continue;
          matched = true;
          applyAvailable(match);
          if (source === "openlibrary" && (!description || !genres.length)) {
            try { const details = await openLibraryDetails(match.id, controller.signal); match = { ...match, description: details.description || match.description, genres: details.genres.length ? details.genres : match.genres }; }
            catch (error) { if (controller.signal.aborted) return; failures.push(`Open Library: ${(error as Error).message}`); }
          }
          applyAvailable(match);
          if (!description && match.description) description = match.description;
          if (!genres.length && match.genres.length) genres = match.genres;
          if (description && genres.length) break;
        } catch (error) { if (controller.signal.aborted) return; failures.push(`${source === "google" ? "Google Books" : "Open Library"}: ${(error as Error).message}`); }
      }
      if (controller.signal.aborted || activeId.current !== id || formRef.current.title !== title || formRef.current.author !== author) return;
      setMetadataNotice(description || genres.length ? "Dados encontrados nos catálogos. Confira a sinopse e os gêneros antes de publicar." : matched ? "Livro encontrado, mas o catálogo não forneceu sinopse ou gêneros. Você pode preencher manualmente ou buscar outra edição." : responded ? `Não encontramos uma correspondência segura para “${title}”${author ? `, de ${author}` : ""}. Confira os campos ou use Buscar dados do livro. ${failures.join(" ")}` : `Os catálogos estão indisponíveis. ${failures.join(" ")}`);
    } catch { if (!controller.signal.aborted && activeId.current === id) setMetadataNotice("A sugestão automática está indisponível. O cadastro manual e a busca por outra fonte continuam disponíveis."); }
    finally { if (!controller.signal.aborted && activeId.current === id) setFindingGenre(false); }
  };
  const processFile = async (item: QueueItem) => {
    processing.current?.abort(); lookup.current?.abort(); const controller = new AbortController(); processing.current = controller;
    setPdfFile(null); setError(null); setIsPreparing(true); setConversionProgress(null); setFindingGenre(false); patchItem(item.id, { status: "preparing" });
    try {
      const prepared = await prepareBook(item.file, controller.signal, value => { if (!controller.signal.aborted) setConversionProgress(value); });
      if (controller.signal.aborted || activeId.current !== item.id) return;
      if (prepared.cover && !manualCover.current) previewCover(prepared.cover);
      setPdfFile(prepared.file); setTotalPages(prepared.pageCount);
      const previous = formRef.current;
      const next = { ...previous, title: previous.title || prepared.title, author: previous.author || prepared.author, description: previous.description || prepared.description,
        genre: !touched.current.has("genre") && (previous.genre === "Outros" || !previous.genre) && prepared.genres.length ? prepared.genres.join(", ") : previous.genre };
      formRef.current = next; setFormData(next); patchItem(item.id, { status: "ready" });
      if (next.title.trim()) void suggestGenre(next.title, next.author, item.id);
      else if (prepared.genres.length) setMetadataNotice("Gêneros encontrados nos dados do arquivo. Você pode ajustar a seleção.");
    } catch (error) {
      if (!controller.signal.aborted && activeId.current === item.id) { setError((error as Error).message || "Não foi possível preparar este livro."); patchItem(item.id, { status: "error" }); }
    } finally { if (!controller.signal.aborted && activeId.current === item.id) { setIsPreparing(false); setConversionProgress(null); } }
  };
  useEffect(() => {
    if (!currentId || !pdfFile || isPreparing || isUploading || !formData.title.trim() || (!touched.current.has("title") && !touched.current.has("author"))) return;
    const timer = window.setTimeout(() => void suggestGenre(formData.title, formData.author, currentId), 900);
    return () => { window.clearTimeout(timer); lookup.current?.abort(); };
  }, [formData.title, formData.author, currentId, pdfFile, isPreparing, isUploading]);
  const startItem = (item: QueueItem, preserveDraft = false) => {
    if (!preserveDraft) resetDraft(); activeId.current = item.id; setCurrentId(item.id); void processFile(item);
  };
  const addFiles = (files: File[]) => {
    if (posting.current) return;
    const valid = files.filter(file => bookFileKind(file));
    const added = valid.filter(file => !queueRef.current.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)).map(file => ({ id: globalThis.crypto?.randomUUID?.() || `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, file, status: "waiting" as const }));
    if (!valid.length) { setError("Selecione arquivos PDF ou EPUB válidos."); return; }
    const firstSelection = queueRef.current.length === 0; changeQueue([...queueRef.current, ...added]);
    if (files.length !== valid.length) setNotice("Arquivos de outros formatos foram ignorados; PDFs e EPUBs entraram na fila.");
    if (!activeId.current && added.length) startItem(added[0], firstSelection);
  };
  const advance = () => {
    const next = queueRef.current.find(item => item.status === "waiting");
    if (next) startItem(next);
    else { processing.current?.abort(); lookup.current?.abort(); activeId.current = null; setCurrentId(null); setFindingGenre(false); setIsPreparing(false); }
  };
  const skip = () => { if (!current || posting.current) return; processing.current?.abort(); lookup.current?.abort(); patchItem(current.id, { status: "skipped" }); advance(); };
  const cancelPreparation = () => {
    processing.current?.abort(); setConversionProgress(null); setIsPreparing(false); setError("Preparação cancelada. Tente novamente ou pule este livro.");
    if (activeId.current) patchItem(activeId.current, { status: "error" });
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!pdfFile || !current || ["published", "skipped"].includes(current.status) || !formData.title.trim() || isPreparing || posting.current) return;
    posting.current = true; setShowUploadProgress(true); setIsUploading(true); setUploadStage("checking"); setError(null); lookup.current?.abort(); setFindingGenre(false); patchItem(current.id, { status: "publishing" });
    try {
      const book = await uploadBook({ ...formData, uploadRequestId: current.id, coverColor: randomCoverColor(), pdfFile, coverFile: coverFile || undefined }, setUploadStage);
      if (!mounted.current) return;
      patchItem(current.id, { status: "published", bookId: book.id });
      try { await saveProgress({ bookId: book.id, currentPage: 0, totalPages, progress: 0, status: "lendo", startedAt: Date.now(), lastReadAt: Date.now() }); }
      catch { setNotice(`“${book.title || formData.title}” foi publicado, mas não foi possível marcar o progresso inicial. Você pode abri-lo na biblioteca.`); }
      if (!mounted.current) return;
      if (queueRef.current.length === 1) navigate("/my-books"); else advance();
    } catch (error) { if (!mounted.current) return; setError((error as Error).message || "Não foi possível confirmar a publicação. Tente novamente."); patchItem(current.id, { status: "error" }); }
    finally { posting.current = false; if (mounted.current) { setIsUploading(false); setShowUploadProgress(false); } }
  };
  const phase = complete ? "complete" : isUploading ? "publishing" : conversionProgress !== null ? "converting" : isPreparing ? "preparing" : error ? "error" : "ready";
  const canSubmit = !!pdfFile && !!current && !["published", "skipped"].includes(current.status) && !!formData.title.trim() && !isPreparing && !isUploading;
  return <div className="mb-screen mb-screen--narrow mb-upload space-y-5">
    <header className="mb-upload-heading flex items-center gap-3"><button onClick={() => navigate(-1)} aria-label="Voltar" className="mb-btn mb-btn-outline mb-btn-icon mb-btn-sm"><ArrowLeft className="w-4 h-4" /></button><div><p className="mb-eyebrow mb-2">COMPARTILHE UMA DESCOBERTA</p><h1 className="mb-display">Mais uma boa história.</h1><p className="text-[13px] text-[var(--text-3)] mt-1">Adicione arquivos à fila, revise cada livro e publique para seguir ao próximo.</p></div></header>
    {queue.length > 0 && <UploadProgress phase={phase} filename={current?.file.name || "Todos os arquivos da fila foram revisados."} current={Math.max(1, currentIndex + 1)} total={queue.length} published={published} percent={conversionProgress} stage={uploadStage} />}
    <Modal open={isUploading && showUploadProgress} onClose={() => setShowUploadProgress(false)} title={`Publicando livro ${Math.max(1, currentIndex + 1)} de ${queue.length}`} description="Aguarde a confirmação do cadastro. O próximo livro só será aberto depois que este for adicionado." size="lg">
      <UploadProgress phase="publishing" filename={current?.file.name || ""} current={Math.max(1, currentIndex + 1)} total={queue.length} published={published} percent={null} stage={uploadStage} />
    </Modal>
    {notice && <p className="text-sm rounded-xl p-3 bg-[var(--primary-soft)] text-[var(--primary)]" role="status">{notice}</p>}
    {queue.length > 1 && <section className="mb-card p-3"><div className="flex justify-between text-xs text-[var(--text-3)] mb-2"><span>Sua fila de livros</span><span>{queue.filter(item => item.status === "skipped").length} pulados</span></div><ol className="max-h-44 overflow-y-auto space-y-1">{queue.map((item, index) => <li key={item.id} aria-current={item.id === currentId ? "step" : undefined} className={`flex gap-2 items-center px-2 py-2 rounded-lg text-xs ${item.id === currentId ? "bg-[var(--primary-soft)]" : ""}`}><span className="w-5 shrink-0 text-[var(--text-3)]">{item.status === "published" ? <CheckCircle2 size={15} /> : index + 1}</span><span className="flex-1 truncate" title={item.file.name}>{item.file.name}</span><span className="text-[var(--text-3)]">{{ waiting: "Na fila", preparing: "Preparando", ready: "Em revisão", publishing: "Publicando", published: "Adicionado", error: "Atenção", skipped: "Pulado" }[item.status]}</span>{item.status === "waiting" && <button type="button" disabled={isUploading} onClick={() => changeQueue(queueRef.current.filter(candidate => candidate.id !== item.id))} aria-label={`Remover ${item.file.name} da fila`}><X size={15} /></button>}</li>)}</ol><p className="text-[11px] text-[var(--text-3)] mt-2">Mantenha esta tela aberta até concluir a fila.</p></section>}
    {complete && <div className="mb-card p-5 text-center space-y-3"><CheckCircle2 className="mx-auto text-[var(--primary)]" size={32} /><h2 className="font-semibold">{published} {published === 1 ? "livro adicionado" : "livros adicionados"} ao acervo</h2><p className="text-sm text-[var(--text-3)]">{queue.filter(item => item.status === "skipped").length} arquivos pulados. Você pode adicionar outra seleção abaixo.</p><button type="button" className="mb-btn mb-btn-primary" onClick={() => navigate("/my-books")}><Library size={17} />Ver meus livros</button></div>}
    <form onSubmit={handleSubmit} className="mb-upload-form"><fieldset disabled={isUploading} className="space-y-5">
      <section><span className="mb-label">Arquivos PDF ou EPUB</span><label onDragOver={event => { event.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={event => { event.preventDefault(); setIsDragOver(false); addFiles(Array.from(event.dataTransfer.files)); }} className={`block w-full rounded-xl border-2 border-dashed px-5 py-6 text-center cursor-pointer transition-colors ${isDragOver ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--line)] bg-[var(--surface-2)]"}`}>
        <input type="file" multiple aria-label="Selecionar livros PDF ou EPUB" accept=".pdf,.epub,application/pdf,application/epub+zip" className="hidden" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; addFiles(files); }} /><UploadIcon className="w-6 h-6 mx-auto text-[var(--text-3)]" />
        <p className="text-sm font-semibold mt-2">{queue.length ? "Adicionar mais arquivos à fila" : "Arraste PDFs ou EPUBs, ou toque para selecionar vários"}</p><p className="text-xs text-[var(--text-3)] mt-1">EPUBs de até 40 MB são convertidos automaticamente. Um livro é preparado por vez.</p>
      </label>{pdfFile && current && <p className="mt-2 text-xs text-[var(--text-3)]"><span>{pdfFile.name}</span> · {(pdfFile.size / 1024 / 1024).toFixed(1)} MB · {totalPages} páginas</p>}
      {isPreparing && <button type="button" className="mb-btn mb-btn-outline mt-2" onClick={cancelPreparation}>Cancelar conversão</button>}</section>
      {!complete && <>
        <section><span className="mb-label">Capa</span><div className="flex gap-4 items-start"><button type="button" onClick={() => coverInput.current?.click()} onDragOver={event => { event.preventDefault(); setIsDragOverCover(true); }} onDragLeave={() => setIsDragOverCover(false)} onDrop={event => { event.preventDefault(); setIsDragOverCover(false); const file = event.dataTransfer.files[0]; if (file?.type.startsWith("image/")) { manualCover.current = true; previewCover(file); } else setError("Selecione uma imagem válida para a capa."); }} className={`w-24 aspect-[2/3] rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center shrink-0 ${isDragOverCover ? "border-[var(--primary)]" : "border-[var(--line)] bg-[var(--surface-2)]"}`}>{coverPreview ? <img src={coverPreview} alt="Prévia da capa" className="w-full h-full object-cover" /> : <span className="text-[11px] text-[var(--text-3)] px-2">{isPreparing ? "Preparando…" : "Escolher imagem"}</span>}</button><input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) { manualCover.current = true; previewCover(file); } }} /><p className="text-xs text-[var(--text-3)] leading-relaxed">Usamos a primeira página automaticamente. Sua capa escolhida manualmente será preservada.</p></div></section>
        <section className="mb-card p-5 space-y-4"><BookMetadataLookup key={currentId || "empty"} current={formData} onApply={(fields, metadata) => { lookup.current?.abort(); setFindingGenre(false); Object.keys(fields).forEach(key => touched.current.add(key)); setFormData(previous => ({ ...previous, ...fields, metadataSource: metadata.source, metadataId: metadata.id, isbn: metadata.isbn || "", publisher: fields.publisher ?? previous.publisher, publishedYear: fields.publishedYear ?? previous.publishedYear })); setMetadataNotice("Dados aplicados da fonte escolhida. Confira a revisão antes de publicar."); }} />
          <div><label htmlFor="up-title" className="mb-label">Título</label><input id="up-title" value={formData.title} onChange={event => edit("title", event.target.value)} placeholder="Nome do livro" className="mb-input" /></div>
          <AuthorField value={formData.author} onChange={name => edit("author", name)} refreshKey={published} />
          <GenreField value={formData.genre} onChange={genre => edit("genre", genre)} />
          {findingGenre && <p className="text-xs text-[var(--text-3)]" role="status">Buscando sinopse e gêneros…</p>}{metadataNotice && <p role="status" className="text-xs text-[var(--text-3)]">{metadataNotice}</p>}
          {currentId && pdfFile && !findingGenre && <button type="button" disabled={isUploading} className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => void suggestGenre(formData.title, formData.author, currentId)}>Tentar preenchimento automático novamente</button>}
          <div><label htmlFor="up-desc" className="mb-label">Sinopse</label><textarea id="up-desc" value={formData.description} onChange={event => edit("description", event.target.value)} rows={4} placeholder="Do que trata o livro?" className="mb-input resize-y" /></div>
          {(formData.publisher || formData.publishedYear || formData.isbn) && <p className="text-xs text-[var(--text-3)]">{[formData.publisher, formData.publishedYear, formData.isbn && `ISBN ${formData.isbn}`].filter(Boolean).join(" · ")}</p>}
        </section>
        <SeriesField value={formData.seriesId} order={formData.seriesOrder} onChange={(seriesId, seriesOrder) => setFormData(previous => ({ ...previous, seriesId, seriesOrder }))} />
        {error && <p role="alert" className="text-sm text-[var(--destructive)] rounded-xl p-3 bg-[var(--destructive)]/10">{error}</p>}
        <div className="flex gap-2">{current && <button type="button" disabled={isUploading} onClick={skip} className="mb-btn mb-btn-outline"><SkipForward size={16} />Pular livro</button>}{current && !pdfFile && !isPreparing && <button type="button" className="mb-btn mb-btn-outline" onClick={() => void processFile(current)}><RotateCcw size={16} />Tentar preparar novamente</button>}</div>
        <button type="submit" disabled={!canSubmit} className="mb-btn mb-btn-primary mb-btn-lg w-full">{isUploading ? "Publicando…" : queue.length > 1 ? "Confirmar, publicar e ir ao próximo" : "Publicar no acervo"}</button>
      </>}
    </fieldset></form>
  </div>;
}
