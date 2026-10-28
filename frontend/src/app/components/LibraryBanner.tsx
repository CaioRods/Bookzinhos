import { useMemo } from "react";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { getFullUrl, type Book } from "../lib/types";

/** Uses the real catalog, so the showcase always leads to available books. */
export function LibraryBanner({ books }: { books: Book[] }) {
  const featured = useMemo(() => {
    const covers = books.filter((book) => book.coverImagePath);
    const priorities = [
      /rainha.*nada/i,
      /pr[ií]ncipe cruel/i,
      /mundo.*gelo.*fogo/i,
    ];
    const selected: Book[] = [];
    priorities.forEach((pattern) => {
      const book = covers.find(
        (book) =>
          pattern.test(book.title) &&
          !selected.some((item) => item.id === book.id),
      );
      if (book) selected.push(book);
    });
    return [
      ...selected,
      ...covers.filter((book) => !selected.some((item) => item.id === book.id)),
    ].slice(0, 3);
  }, [books]);

  return (
    <section
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
          <Link
            key={book.id}
            to={`/book/${book.id}`}
            aria-label={`Conhecer ${book.title}`}
          >
            <img
              src={getFullUrl(book.coverImagePath)!}
              alt={`Capa de ${book.title}`}
              decoding="async"
            />
            <span aria-hidden="true" />
          </Link>
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
