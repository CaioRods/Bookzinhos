import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowUp, ArrowDown, ChevronRight, Library } from "lucide-react";
import { fetchBooks, invalidate } from "../lib/api";
import { communityApi, type Series } from "../lib/community";
import { isAdmin } from "../lib/session";
import { getFullUrl, type Book } from "../lib/types";
import { toast } from "./Ui";
export function SeriesShelf({
  book,
  onOrderSaved,
}: {
  book: Book;
  onOrderSaved?: (order: number) => void;
}) {
  const [books, setBooks] = useState<Book[]>([]),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchBooks()
      .then((data) =>
        setBooks(
          data
            .filter((b) => b.seriesId === book.seriesId)
            .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0)),
        ),
      )
      .catch(() => {});
  }, [book.seriesId]);
  const move = (index: number, delta: number) => {
    setBooks((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };
  const save = async () => {
    setBusy(true);
    try {
      await communityApi("/series/" + book.seriesId + "/order", "PUT", {
        bookIds: books.map((b) => b.id),
      });
      invalidate("/books", "/home");
      setBooks(books.map((b, i) => ({ ...b, seriesOrder: i + 1 })));
      onOrderSaved?.(books.findIndex((entry) => entry.id === book.id) + 1);
      setEditing(false);
      toast("Ordem da saga atualizada.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (!book.seriesId) return null;
  return (
    <section className="mb-series-shelf">
      <header>
        <div>
          <p className="mb-eyebrow">UMA HISTÓRIA EM VÁRIOS VOLUMES</p>
          <h2>{book.seriesName}</h2>
        </div>
        <div>
          {isAdmin() && (
            <button
              className="mb-btn mb-btn-outline"
              disabled={busy}
              onClick={() => (editing ? save() : setEditing(true))}
            >
              {editing ? (busy ? "Salvando…" : "Salvar ordem") : "Organizar"}
            </button>
          )}
          <Link className="mb-btn mb-btn-ghost" to={"/series/" + book.seriesId}>
            Ver saga
            <ChevronRight size={16} />
          </Link>
        </div>
      </header>
      <div className="mb-series-rail">
        {books.map((entry, i) => (
          <div
            key={entry.id}
            className={entry.id === book.id ? "is-current" : ""}
          >
            <Link to={"/book/" + entry.id}>
              {entry.coverImagePath ? (
                <img
                  src={getFullUrl(entry.coverImagePath)!}
                  alt={"Capa de " + entry.title}
                />
              ) : (
                <div className="mb-series-cover-placeholder">
                  <Library />
                </div>
              )}
              <small>VOL. {editing ? i + 1 : entry.seriesOrder}</small>
              <strong>{entry.title}</strong>
            </Link>
            {editing && (
              <div className="mb-series-move">
                <button
                  aria-label={"Mover " + entry.title + " para antes"}
                  disabled={i === 0 || busy}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label={"Mover " + entry.title + " para depois"}
                  disabled={i === books.length - 1 || busy}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
export function SeriesPage() {
  const { seriesId } = useParams();
  const [books, setBooks] = useState<Book[]>([]),
    [series, setSeries] = useState<Series | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchBooks(true), communityApi<Series[]>("/series")])
      .then(([catalog, all]) => {
        if (alive) {
          setBooks(
            catalog
              .filter((b) => b.seriesId === seriesId)
              .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0)),
          );
          setSeries(all.find((s) => s.id === seriesId) || null);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [seriesId]);
  return (
    <div className="mb-screen mb-series-page">
      <Link className="mb-btn mb-btn-ghost" to="/library">
        ← Biblioteca
      </Link>
      <header>
        <p className="mb-eyebrow">A COLEÇÃO COMPLETA</p>
        <h1>{series?.name || "Saga"}</h1>
        <p>
          {books.length} {books.length === 1 ? "volume" : "volumes"} · Uma
          história para acompanhar na ordem.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Carregando volumes…</p>
      ) : !series ? (
        <p>Saga não encontrada.</p>
      ) : (
        <div className="mb-series-page-grid">
          {books.map((book) => (
            <Link key={book.id} to={"/book/" + book.id}>
              {book.coverImagePath && (
                <img
                  src={getFullUrl(book.coverImagePath)!}
                  alt={"Capa de " + book.title}
                />
              )}
              <small>VOLUME {book.seriesOrder}</small>
              <h2>{book.title}</h2>
              <p>{book.author}</p>
              <span>
                {book.rating > 0
                  ? "★ " + book.rating.toFixed(1)
                  : "Sem avaliações"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
