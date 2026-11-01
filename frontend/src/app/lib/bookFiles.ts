import { getFullUrl, type Book } from "./types";
export type BookFileFormat = "pdf" | "epub";
export interface BookFileOption { format: BookFileFormat; url: string | null; bytes: number | null }
export function bookFileOptions(book: Book): BookFileOption[] {
  return [{ format: "pdf", url: getFullUrl(book.pdfPath), bytes: book.pdfBytes || null }, { format: "epub", url: getFullUrl(book.epubPath), bytes: book.epubBytes || null }];
}
export function formatFileSize(bytes: number | null) {
  if (!bytes || bytes < 0) return "Tamanho indisponível";
  return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
export async function resolveBookFiles(book: Book, signal: AbortSignal) {
  return Promise.all(bookFileOptions(book).map(async option => {
    if (!option.url || option.bytes) return option;
    try {
      const response = await fetch(option.url, { method: "HEAD", signal });
      const bytes = Number(response.headers.get("content-length"));
      return response.ok && Number.isFinite(bytes) && bytes > 0 ? { ...option, bytes } : option;
    } catch { return option; }
  }));
}
