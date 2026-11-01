import { bookFileKind, convertEpub } from "./epub/convert";
import { localGenres } from "./bookMetadata";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
export interface PreparedBook { file: File; cover: File | null; pageCount: number; title: string; author: string; description: string; genres: string[] }
export function filenameMetadata(name: string) {
  const value = name.replace(/\.(pdf|epub)$/i, "").replace(/_/g, " ").trim();
  const split = value.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return { title: (split?.[1] || value).trim(), author: (split?.[2] || "").trim() };
}
async function pdfDetails(file: File, signal: AbortSignal) {
  let task: any, cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
  let stop = () => {};
  const interrupted = new Promise<null>(resolve => { stop = () => resolve(null); timer = setTimeout(stop, 6000); });
  signal.addEventListener("abort", stop, { once: true });
  const extraction = (async () => {
    const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    const data = await file.arrayBuffer(); if (cancelled || signal.aborted) return null;
    task = pdfjs.getDocument({ data }); const pdf = await task.promise;
    let info: Record<string, unknown> = {};
    try { info = (await pdf.getMetadata?.())?.info || {}; } catch { /* Metadata is optional. */ }
    const clean = (value: unknown) => typeof value === "string" ? value.trim().replace(/<[^>]+>/g, "").slice(0, 1000) : "";
    const title = clean(info.Title), author = clean(info.Author);
    const metadata = { title: /^(untitled|document|microsoft|adobe|sem t[ií]tulo)/i.test(title) ? "" : title, author: /^(unknown|user|admin|adobe|microsoft)$/i.test(author) ? "" : author, genres: localGenres(`${clean(info.Subject)} ${clean(info.Keywords)}`) };
    const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) return { cover: null, pageCount: pdf.numPages, ...metadata };
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .85));
    return { cover: blob ? new File([blob], "cover.jpg", { type: "image/jpeg" }) : null, pageCount: pdf.numPages, ...metadata };
  })().catch(() => null);
  try { return await Promise.race([extraction, interrupted]); }
  finally { cancelled = true; clearTimeout(timer); signal.removeEventListener("abort", stop); await task?.destroy().catch(() => {}); }
}
export async function prepareBook(source: File, signal: AbortSignal, progress: (value: number | null) => void): Promise<PreparedBook> {
  const kind = bookFileKind(source); if (!kind) throw new Error("Selecione um PDF ou EPUB válido.");
  const guessed = filenameMetadata(source.name);
  let file = source, pageCount = 1, title = "", author = "", description = "", genres: string[] = [];
  if (kind === "epub") {
    progress(0); const converted = await convertEpub(source, signal, progress);
    file = converted.file; pageCount = converted.pageCount; title = converted.title; author = converted.author;
    description = converted.description || ""; genres = localGenres(converted.subjects || []);
  }
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  progress(null); const details = await pdfDetails(file, signal);
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  return { file, cover: details?.cover || null, pageCount: details?.pageCount || pageCount, title: title || details?.title || guessed.title, author: author || details?.author || guessed.author, description, genres: genres.length ? genres : details?.genres || [] };
}
