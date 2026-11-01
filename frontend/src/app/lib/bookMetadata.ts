import { API_BASE_URL } from "./config";
import { BOOK_GENRES } from "./genres";
export interface BookMetadata {
  id: string; source: "google" | "openlibrary"; sourceUrl: string; title: string; authors: string[];
  description: string; genres: string[]; publisher: string; publishedYear: string; pageCount: number | null; isbn: string | null;
}
export const normalizeBookText = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function localGenres(value: string | string[]) {
  const text = normalizeBookText(Array.isArray(value) ? value.join(" ") : value);
  const translated = [["fantasy", "Fantasia"], ["science fiction", "Ficção científica"], ["mystery", "Mistério"], ["thriller", "Suspense"], ["horror", "Terror"], ["poetry", "Poesia"], ["biography", "Biografia"], ["young adult", "Young adult"], ["juvenile", "Infantojuvenil"], ["self help", "Desenvolvimento pessoal"]].filter(([key]) => (` ${text} `).includes(` ${key} `)).map(([, genre]) => genre);
  return [...new Set([...translated, ...BOOK_GENRES.filter(genre => genre !== "Outros" && (` ${text} `).includes(` ${normalizeBookText(genre)} `))])];
}
export function automaticGenreCandidate(results: BookMetadata[], title: string, author: string): BookMetadata | null {
  const matches = results.filter(book => normalizeBookText(book.title) === normalizeBookText(title) && (!author || book.authors.some(name => normalizeBookText(name) === normalizeBookText(author))));
  if (!matches.length || !matches[0].authors.length || new Set(matches.map(book => book.authors.map(normalizeBookText).sort().join(";"))).size !== 1) return null;
  return matches[0];
}
export function automaticGenres(results: BookMetadata[], title: string, author: string) { return automaticGenreCandidate(results, title, author)?.genres || []; }
async function metadataRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", signal });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Não foi possível buscar os dados. O cadastro manual continua disponível."); }
  return response.json();
}
export function searchBookMetadata(title: string, author: string, source: BookMetadata["source"], signal?: AbortSignal) {
  const params = new URLSearchParams({ q: title, author, source });
  return metadataRequest<BookMetadata[]>(`/integrations/books/search?${params}`, signal);
}
export function openLibraryDetails(id: string, signal?: AbortSignal) {
  return metadataRequest<Pick<BookMetadata, "description" | "genres">>(`/integrations/books/openlibrary/${encodeURIComponent(id.replace("/works/", ""))}`, signal);
}
