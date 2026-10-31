import { useState } from "react";
import { AnimatedBookLink } from "./BookTransition";
import { BookOpen } from "lucide-react";
import { getFullUrl, type Book } from "../lib/types";
import { pickDistinctBooks } from "../lib/randomBooks";

/** Uses the real catalog, so the showcase always leads to available books. */
export function LibraryBanner({ books }: { books: Book[] }) {
  const [featured] = useState(() =>
    pickDistinctBooks(books.filter((book) => book.coverImagePath), 3),
  );

  return (
    <section
      data-banner-src="/scenery/golden-branches.webp" data-banner-name="Entre páginas, novos mundos"
      className="mb-library-banner"
      aria-labelledby="library-banner-title"
    >
      <div className="mb-library-banner-copy">
        <h2 id="library-banner-title">
          Entre páginas,
          <br />
          novos mundos.
        </h2>
        <p>
          Explore histórias, encontre favoritos e
          <br className="mb-banner-linebreak" /> compartilhe suas descobertas.
        </p>
        <span aria-hidden="true" />
      </div>
      <div className="mb-library-banner-books">
        {featured.map((book) => (
          <AnimatedBookLink
            key={book.id}
            book={book}
            aria-label={`Conhecer ${book.title}`}
          >
            <img
              src={getFullUrl(book.coverImagePath)!}
              alt={`Capa de ${book.title}`}
              decoding="async"
            />
            <span aria-hidden="true" />
          </AnimatedBookLink>
        ))}
        {!featured.length && (
          <BookOpen
            className="mb-banner-empty"
            size={100}
            strokeWidth={0.8}
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}
