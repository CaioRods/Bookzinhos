import { bookFileKind, convertEpub } from "../lib/epub/convert";
import { SeriesField } from "../components/SeriesField";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Upload as UploadIcon } from "lucide-react";
import { uploadBook, saveProgress } from "../lib/api";
import { randomCoverColor } from "../lib/types";
import { GenreField } from "../components/GenreField";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

async function extractPdfCover(pdfFile: File, signal: AbortSignal): Promise<{ cover: File | null; numPages: number } | null> {
  let task: any, cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
  let stop: () => void = () => {};
  const interrupted = new Promise<null>(resolve => { stop = () => resolve(null); timer = setTimeout(stop, 4000); });
  signal.addEventListener("abort", stop, { once: true });
  const extraction = (async () => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    const data = await pdfFile.arrayBuffer();
    if (cancelled || signal.aborted) return null;
    task = pdfjs.getDocument({ data });
    const pdf = await task.promise;
    const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
    const context = canvas.getContext("2d"); if (!context) return { cover: null, numPages: pdf.numPages };
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return { cover: blob ? new File([blob], "cover.jpg", { type: "image/jpeg" }) : null, numPages: pdf.numPages };
  })().catch(() => null);
  try { return await Promise.race([extraction, interrupted]); }
  finally { cancelled = true; clearTimeout(timer); signal.removeEventListener("abort", stop); await task?.destroy().catch(() => {}); }
}

export function Upload() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ title: "", author: "", description: "", genre: "Outros", isPublic: true, seriesId: "", seriesOrder: 1 });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingCover, setIsExtractingCover] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<number | null>(null);
  const processing = useRef<AbortController | null>(null);
  const coverUrl = useRef<string | null>(null);
  const manualCover = useRef(false);
  useEffect(() => () => { processing.current?.abort(); if (coverUrl.current) URL.revokeObjectURL(coverUrl.current); }, []);
  const previewCover = (file: File) => {
    if (coverUrl.current) URL.revokeObjectURL(coverUrl.current);
    coverUrl.current = URL.createObjectURL(file); setCoverFile(file); setCoverPreview(coverUrl.current);
  };
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop States
  const [isDragOverPdf, setIsDragOverPdf] = useState(false);
  const [isDragOverCover, setIsDragOverCover] = useState(false);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processPdfFile(file);
  };

  const processPdfFile = async (source: File) => {
    if (isUploading) return;
    processing.current?.abort();
    const controller = new AbortController(); processing.current = controller;
    setPdfFile(null); setError(null); setTotalPages(1); setIsExtractingCover(true); setConversionProgress(null);
    if (!manualCover.current) { setCoverFile(null); setCoverPreview(null); if (coverUrl.current) { URL.revokeObjectURL(coverUrl.current); coverUrl.current = null; } }
    try {
      const kind = bookFileKind(source);
      if (!kind) throw new Error("Selecione um arquivo PDF ou EPUB válido.");
      let file = source, pageCount = 1, metadataTitle = "", metadataAuthor = "";
      if (kind === "epub") {
        setConversionProgress(0);
        if (controller.signal.aborted) return;
        const converted = await convertEpub(source, controller.signal, value => { if (!controller.signal.aborted) setConversionProgress(value); });
        file = converted.file; pageCount = converted.pageCount; metadataTitle = converted.title; metadataAuthor = converted.author;
      }
      if (controller.signal.aborted) return;
      setConversionProgress(null);
      const result = await extractPdfCover(file, controller.signal);
      if (controller.signal.aborted) return;
      if (result?.cover && !manualCover.current) previewCover(result.cover);
      setTotalPages(result?.numPages || pageCount);
      setPdfFile(file);
      setFormData(previous => ({ ...previous, title: previous.title || metadataTitle || source.name.replace(/\.(pdf|epub)$/i, "").replace(/[-_]/g, " "), author: previous.author || metadataAuthor }));
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível processar este arquivo.");
    } finally {
      if (!controller.signal.aborted) { setIsExtractingCover(false); setConversionProgress(null); }
    }
  };

  const handlePdfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPdf(true);
  };

  const handlePdfDragLeave = () => {
    setIsDragOverPdf(false);
  };

  const handlePdfDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverPdf(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void processPdfFile(file);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCoverFile(file);
  };

  const processCoverFile = (file: File) => {
    manualCover.current = true;
    previewCover(file);
  };

  const handleCoverDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(true);
  };

  const handleCoverDragLeave = () => {
    setIsDragOverCover(false);
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCover(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      processCoverFile(file);
    } else {
      setError("Por favor, selecione uma imagem válida para a capa.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !formData.title || isExtractingCover) return;
    setIsUploading(true);
    setError(null);
    try {
      const book = await uploadBook({
        title: formData.title,
        author: formData.author,
        description: formData.description,
        genre: formData.genre,
        seriesId: formData.seriesId, seriesOrder: formData.seriesOrder,
        isPublic: formData.isPublic,
        coverColor: randomCoverColor(),
        pdfFile,
        coverFile: coverFile ?? undefined,
      });
      await saveProgress({
        bookId: book.id,
        currentPage: 0,
        totalPages: totalPages,
        progress: 0,
        status: "lendo",
        startedAt: Date.now(),
        lastReadAt: Date.now()
      });
      navigate("/my-books");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer upload. Verifique sua conexão.");
      setIsUploading(false);
    }
  };


  const canSubmit = !!pdfFile && !!formData.title.trim() && !isUploading && !isExtractingCover;

  return (
    <div className="mb-screen mb-screen--narrow mb-upload space-y-6">
      <header className="mb-upload-heading flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="mb-btn mb-btn-outline mb-btn-icon mb-btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="mb-eyebrow mb-2">COMPARTILHE UMA DESCOBERTA</p><h1 className="mb-display">Mais uma boa história.</h1>
          <p className="text-[13px] text-[var(--text-3)] mt-0.5">O livro entra no acervo compartilhado da comunidade.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mb-upload-form space-y-5">
        {/* ── PDF ──────────────────────────────────────────────────────────── */}
        <section>
          <span className="mb-label">Arquivo PDF ou EPUB</span>
          <label
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            className={`block w-full rounded-xl border-2 border-dashed px-5 py-8 text-center cursor-pointer transition-colors ${
              isDragOverPdf ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--primary)]/40"
            }`}
          >
            <input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" disabled={isUploading} className="hidden" onChange={handlePdfChange} />
            <UploadIcon className="w-6 h-6 mx-auto text-[var(--text-3)]" />
            {conversionProgress !== null ? <div role="status" className="mt-3 text-[13px] font-semibold">Convertendo EPUB para PDF… {conversionProgress}%</div> : isExtractingCover ? <div role="status" className="mt-3 text-[13px]">Preparando o PDF e a capa…</div> : pdfFile ? (
              <>
                <p className="text-[13.5px] font-semibold text-foreground mt-2.5 break-all">{pdfFile.name}</p>
                <p className="text-[12px] text-[var(--text-3)] mt-1">
                  {(pdfFile.size / 1024 / 1024).toFixed(1)} MB{totalPages > 1 ? ` · ${totalPages} páginas` : ""} — toque para trocar
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-semibold text-foreground mt-2.5">Arraste o PDF ou EPUB, ou toque para escolher</p>
                <p className="text-[12px] text-[var(--text-3)] mt-1">EPUBs de até 40 MB são convertidos para PDF automaticamente. A capa é extraída da primeira página.</p>
              </>
            )}
          </label>
          {conversionProgress !== null && <button type="button" className="mb-btn mb-btn-outline mt-2" onClick={() => {
            processing.current?.abort(); processing.current = null; setConversionProgress(null); setIsExtractingCover(false);
          }}>Cancelar conversão</button>}
        </section>

        {/* ── Capa ─────────────────────────────────────────────────────────── */}
        <section>
          <span className="mb-label">Capa</span>
          <div className="flex gap-4 items-start">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              onDragOver={handleCoverDragOver}
              onDragLeave={handleCoverDragLeave}
              onDrop={handleCoverDrop}
              className={`w-24 aspect-[2/3] rounded-lg overflow-hidden border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                isDragOverCover ? "border-[var(--primary)]" : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--primary)]/40"
              }`}
            >
              {isExtractingCover ? (
                <span className="text-[11px] font-semibold text-[var(--text-3)] px-2 text-center">Gerando…</span>
              ) : coverPreview ? (
                <img src={coverPreview} alt="Prévia da capa" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] font-semibold text-[var(--text-3)] px-2 text-center">Escolher imagem</span>
              )}
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed pt-1">
              Se você não enviar nada, usamos a primeira página do PDF. Dá para trocar depois, na página do livro.
            </p>
          </div>
        </section>

        {/* ── Dados ────────────────────────────────────────────────────────── */}
        <section className="mb-card p-5 space-y-4">
          <div>
            <label htmlFor="up-title" className="mb-label">Título</label>
            <input
              id="up-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nome do livro"
              className="mb-input"
            />
          </div>

          <div>
            <label htmlFor="up-author" className="mb-label">Autor</label>
            <input
              id="up-author"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              placeholder="Quem escreveu"
              className="mb-input"
            />
          </div>

          <GenreField value={formData.genre} onChange={(genre) => setFormData({ ...formData, genre })} />

          <div>
            <label htmlFor="up-desc" className="mb-label">Sinopse</label>
            <textarea
              id="up-desc"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Do que trata o livro?"
              className="mb-input resize-y leading-relaxed"
            />
          </div>
        </section>

        <SeriesField value={formData.seriesId} order={formData.seriesOrder} onChange={(seriesId,seriesOrder)=>setFormData({...formData,seriesId,seriesOrder})} />
        {error && (
          <p role="alert" className="text-[12.5px] font-semibold text-[var(--destructive)] bg-[var(--destructive)]/10 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="mb-btn mb-btn-primary mb-btn-lg w-full">
          {isUploading ? "Enviando…" : "Publicar no acervo"}
        </button>
      </form>
    </div>
  );
}
