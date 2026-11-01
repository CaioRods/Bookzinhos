import { API_BASE_URL } from "./config";
import { BOOK_GENRES } from "./genres";
export interface BookMetadata {
  id: string; source: "google" | "openlibrary"; sourceUrl: string; title: string; authors: string[];
  alternativeTitles?: string[]; description: string; genres: string[]; publisher: string; publishedYear: string; pageCount: number | null; isbn: string | null;
}
export const normalizeBookText = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function localGenres(value: string | string[]) {
  const text = normalizeBookText(Array.isArray(value) ? value.join(" ") : value);
  const translated = [["fantasy", "Fantasia"], ["science fiction", "Ficção científica"], ["mystery", "Mistério"], ["thriller", "Suspense"], ["horror", "Terror"], ["poetry", "Poesia"], ["biography", "Biografia"], ["young adult", "Young adult"], ["juvenile", "Infantojuvenil"], ["self help", "Desenvolvimento pessoal"]].filter(([key]) => (` ${text} `).includes(` ${key} `)).map(([, genre]) => genre);
  return [...new Set([...translated, ...BOOK_GENRES.filter(genre => genre !== "Outros" && (` ${text} `).includes(` ${normalizeBookText(genre)} `))])];
}
const authorIdentity = (name: string) => normalizeBookText(name.includes(",") ? name.split(",").reverse().join(" ") : name);
// Ignore explicit edition decoration, never an unlabelled sequel number.
const editionTitle = (title: string) => normalizeBookText(title.replace(/\s*[([]?\s*(?:vol(?:ume)?\.?|livro|book)\s*0?1\s*[)\]]?\s*$/iu, ""));
function sameTitle(candidate: string, query: string, confirmedAuthor: boolean) {
  if (editionTitle(candidate) === editionTitle(query)) return true;
  if (!confirmedAuthor) return false;
  // Do not treat a sequel's explicit number as a subtitle of the first book.
  if ([candidate, query].some(title => /(?:vol(?:ume)?\.?|livro|book|#)\s*(?:[2-9]|1\d)\b/iu.test(title))) return false;
  // A subtitle can differ by edition, but two distinct subtitles are not equivalent.
  const base = (title: string) => editionTitle(title.split(/[:：]|\s+[-–—]\s+|\s+[(\[]/u)[0]);
  return base(candidate).split(" ").length >= 3 && (base(candidate) === editionTitle(query) || base(query) === editionTitle(candidate));
}
export function automaticGenreCandidate(results: BookMetadata[], title: string, author: string): BookMetadata | null {
  const matches = results.filter(book => {
    const confirmedAuthor = !!author && author.split(";").some(name => book.authors.some(candidate => authorIdentity(candidate) === authorIdentity(name)));
    return (!author || confirmedAuthor) && [book.title, ...(book.alternativeTitles || [])].some(candidate => sameTitle(candidate, title, confirmedAuthor));
  });
  if (!matches.length || !matches[0].authors.length || (!author && new Set(matches.map(book => book.authors.map(authorIdentity).sort().join(";"))).size !== 1)) return null;
  return [...matches].sort((a, b) => Number(!!b.description) + Number(!!b.genres.length) - Number(!!a.description) - Number(!!a.genres.length))[0];
}
export function automaticGenres(results: BookMetadata[], title: string, author: string) { return automaticGenreCandidate(results, title, author)?.genres || []; }
async function metadataRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", signal });
  if (response.status === 401) throw new Error("Entre na sua conta novamente para consultar os catálogos.");
  if (response.status === 404) throw new Error("A API de metadados não está disponível neste deploy. É necessário atualizar também o servidor.");
  if (response.status === 429) throw new Error("Muitas buscas em sequência. Aguarde um minuto e tente novamente.");
  const data = await response.json().catch(() => { throw new Error("O servidor não retornou dados de catálogo. Confira o deploy da API."); });
  if (!response.ok) throw new Error(data.error || `Não foi possível buscar os dados (HTTP ${response.status}).`);
  return data;
}
export function searchBookMetadata(title: string, author: string, source: BookMetadata["source"], signal?: AbortSignal) {
  const params = new URLSearchParams({ q: title, author, source });
  return metadataRequest<BookMetadata[]>(`/integrations/books/search?${params}`, signal);
}
export function openLibraryDetails(id: string, signal?: AbortSignal) {
  return metadataRequest<Pick<BookMetadata, "description" | "genres">>(`/integrations/books/openlibrary/${encodeURIComponent(id.replace("/works/", ""))}`, signal);
}
