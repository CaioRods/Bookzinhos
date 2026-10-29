import type { SceneTheme } from "./appearance";
import type { Book } from "./types";

export type ThemeBookGroup = { id: string; title: string; coverImagePath?: string | null; themes: SceneTheme[] };

export function groupThemesByBook(themes: SceneTheme[], books: Book[]): ThemeBookGroup[] {
  const bookMap = new Map(books.map((book) => [book.id, book]));
  const groups = new Map<string, ThemeBookGroup>();
  const general: SceneTheme[] = [];
  for (const theme of themes) {
    const book = theme.reference?.bookId ? bookMap.get(theme.reference.bookId) : undefined;
    if (!book) { general.push(theme); continue; }
    if (!groups.has(book.id)) groups.set(book.id, { id: book.id, title: book.title, coverImagePath: book.coverImagePath, themes: [] });
    groups.get(book.id)!.themes.push(theme);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")).concat(general.length ? [{ id: "general", title: "Temas gerais", themes: general }] : []);
}
