import type { Book } from "./types";

export interface EditorialFeature {
  books: Book[];
  eyebrow: "LIVRO EM DESTAQUE" | "SÉRIE EM DESTAQUE";
  title: string;
  description: string;
  actionLabel: string;
  isSeries: boolean;
}

export function getEditorialFeature(book: Book, collection: Book[]): EditorialFeature {
  const trilogy = collection.length === 3
    && collection.every((entry) => /príncipe cruel|rei perverso|rainha do nada/i.test(entry.title));
  if (trilogy) {
    return {
      books: collection,
      eyebrow: "SÉRIE EM DESTAQUE",
      title: "O povo\ndo ar.",
      description: "Uma trilogia. Um reino. Nenhuma regra.",
      actionLabel: "Explorar a trilogia",
      isSeries: true,
    };
  }
  return {
    books: [book],
    eyebrow: "LIVRO EM DESTAQUE",
    title: book.title,
    description: book.author,
    actionLabel: "Explorar o livro",
    isSeries: false,
  };
}
