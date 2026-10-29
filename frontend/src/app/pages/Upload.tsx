import { SeriesField } from "../components/SeriesField";
import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Upload as UploadIcon } from "lucide-react";
import { uploadBook, saveProgress } from "../lib/api";
import { randomCoverColor } from "../lib/types";
import { GenreField } from "../components/GenreField";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

async function extractPdfCover(pdfFile: File): Promise<{ cover: File | null; numPages: number } | null> {
  const extractionPromise = (async () => {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      return new Promise<{ cover: File | null; numPages: number }>((resolve) => {
        try {
          canvas.toBlob(
            (blob) => {
              try {
                if (!blob) {
                  resolve({ cover: null, numPages });
                  return;
                }
                const coverFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
                resolve({ cover: coverFile, numPages });
              } catch (e) {
                console.error("Error creating File in canvas.toBlob callback:", e);
                resolve({ cover: null, numPages });
              }
            },
            "image/jpeg",
            0.85
          );
        } catch (e) {
          console.error("Error executing canvas.toBlob:", e);
          resolve({ cover: null, numPages });
        }
      });
    } catch (err) {
      console.error("PDF cover extraction failed:", err);
      return null;
    }
  })();

  const timeoutPromise = new Promise<{ cover: File | null; numPages: number } | null>((resolve) =>
    setTimeout(() => {
      console.warn("PDF cover extraction timed out (4s fallback limit hit)");
      resolve(null);
    }, 4000)
  );

  return Promise.race([extractionPromise, timeoutPromise]);
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
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop States
  const [isDragOverPdf, setIsDragOverPdf] = useState(false);
  const [isDragOverCover, setIsDragOverCover] = useState(false);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processPdfFile(file);
  };

  const processPdfFile = async (file: File) => {
    setPdfFile(file);
    if (!formData.title) {
      const name = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
      setFormData((f) => ({ ...f, title: name }));
    }
    setIsExtractingCover(true);
    try {
      const result = await extractPdfCover(file);
      if (result) {
        if (result.cover) {
          setCoverFile(result.cover);
          setCoverPreview(URL.createObjectURL(result.cover));
        }
        setTotalPages(result.numPages);
      }
    } catch (err) {
      console.error("Error processing PDF file cover:", err);
    } finally {
      setIsExtractingCover(false);
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
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      processPdfFile(file);
    } else {
      setError("Por favor, selecione um arquivo PDF válido.");
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCoverFile(file);
  };

  const processCoverFile = (file: File) => {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
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
    if (!pdfFile || !formData.title) return;
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


  const canSubmit = !!pdfFile && !!formData.title.trim() && !isUploading;

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
          <span className="mb-label">Arquivo PDF</span>
          <label
            onDragOver={handlePdfDragOver}
            onDragLeave={handlePdfDragLeave}
            onDrop={handlePdfDrop}
            className={`block w-full rounded-xl border-2 border-dashed px-5 py-8 text-center cursor-pointer transition-colors ${
              isDragOverPdf ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--primary)]/40"
            }`}
          >
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} />
            <UploadIcon className="w-6 h-6 mx-auto text-[var(--text-3)]" />
            {pdfFile ? (
              <>
                <p className="text-[13.5px] font-semibold text-foreground mt-2.5 break-all">{pdfFile.name}</p>
                <p className="text-[12px] text-[var(--text-3)] mt-1">
                  {(pdfFile.size / 1024 / 1024).toFixed(1)} MB{totalPages > 1 ? ` · ${totalPages} páginas` : ""} — toque para trocar
                </p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-semibold text-foreground mt-2.5">Arraste o PDF ou toque para escolher</p>
                <p className="text-[12px] text-[var(--text-3)] mt-1">A capa é extraída da primeira página automaticamente.</p>
              </>
            )}
          </label>
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
