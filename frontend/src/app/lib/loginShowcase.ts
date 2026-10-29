import type { Book } from "./types";

export function selectLoginShowcase(books: Book[], limit = 5): Book[] {
  return books
    .filter((book) => book.isPublic !== false && Boolean(book.coverImagePath))
    .sort((left, right) => (Number(right.addedAt) - Number(left.addedAt)) || left.title.localeCompare(right.title, "pt-BR"))
    .slice(0, limit);
}
