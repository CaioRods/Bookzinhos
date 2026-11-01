import { API_BASE_URL } from "./config";
export interface AuthorRecord { id: string; name: string; bookCount: number; books: { id: string; title: string; coverImagePath: string | null }[] }
export async function fetchAuthors(signal?: AbortSignal): Promise<AuthorRecord[]> {
  const response = await fetch(`${API_BASE_URL}/authors`, { credentials: "include", signal });
  if (!response.ok) throw new Error("Não foi possível carregar os autores. Você ainda pode digitar o nome.");
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error("Resposta de autores inválida. Tente novamente.");
  return records;
}
export const authorKey = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
