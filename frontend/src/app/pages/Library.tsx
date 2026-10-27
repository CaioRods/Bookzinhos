import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, LayoutGrid, List as ListIcon, Upload, SlidersHorizontal, Library as ShelfIcon } from "lucide-react";
import { fetchAllProgress, fetchBooks, fetchSavedIds } from "../lib/api";
import { useLiveData } from "../lib/useLiveData";
import { triggerBackgroundCoverGeneration } from "../lib/coverExtractor";
import type { Book, ReadingProgress } from "../lib/types";
import { BookCard } from "../components/BookCard";
import { BookGrid } from "../components/BookGrid";
import { EmptyState, PageHeader, Skeleton } from "../components/Ui";

type Filter = "todos" | "lendo" | "ler-depois" | "lidos" | "favoritos" | "pdfs";
type Sort = "recentes" | "populares" | "nota" | "titulo";
type View = "grid" | "shelf" | "list";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "lendo", label: "Lendo" },
  { key: "ler-depois", label: "Ler depois" },
  { key: "lidos", label: "Lidos" },
  { key: "favoritos", label: "Favoritos" },
  { key: "pdfs", label: "Com PDF" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "recentes", label: "Mais recentes" },
  { key: "populares", label: "Mais lidos" },
  { key: "nota", label: "Melhor avaliados" },
  { key: "titulo", label: "Título (A–Z)" },
];

const VIEWS: { key: View; label: string; icon: typeof LayoutGrid }[] = [
  { key: "grid", label: "Capas", icon: LayoutGrid },
  { key: "shelf", label: "Guardar na estante", icon: ShelfIcon },
  { key: "list", label: "Lista", icon: ListIcon },
];

export function Library() {
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "todos");
  const [genre, setGenre] = useState("Todos");
  const [sort, setSort] = useState<Sort>("recentes");
  const [view, setView] = useState<View>(
    () => (localStorage.getItem("library-view") as View) || "grid"
  );

  const { data, isLoading, setData } = useLiveData<{
    books: Book[];
    savedIds: string[];
    progress: ReadingProgress[];
  }>(
    async (force) => {
      const [books, savedIds, progress] = await Promise.all([
        fetchBooks(force),
        fetchSavedIds(force).catch(() => [] as string[]),
        fetchAllProgress(force).catch(() => [] as ReadingProgress[]),
      ]);
      return { books: books || [], savedIds: savedIds || [], progress: progress || [] };
    },
    [],
    { intervalMs: 45000 }
  );

  const books = data?.books ?? [];
  const savedIds = data?.savedIds ?? [];
  const progress = data?.progress ?? [];

  // Gera capas em segundo plano para livros que chegaram sem imagem.
  useEffect(() => {
    if (books.length === 0) return;
    triggerBackgroundCoverGeneration(books, (updated) => {
      setData((prev) =>
        prev ? { ...prev, books: prev.books.map((b) => (b.id === updated.id ? updated : b)) } : prev
      );
    });
  }, [books.length, setData]);

  useEffect(() => {
    if (params.get("focus") === "search") {
      searchRef.current?.focus();
      params.delete("focus");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const changeFilter = (next: Filter) => {
    setFilter(next);
    if (next === "todos") params.delete("filter");
    else params.set("filter", next);
    setParams(params, { replace: true });
  };

  const changeView = (next: View) => {
    setView(next);
    localStorage.setItem("library-view", next);
  };

  const genres = useMemo(
    () => ["Todos", ...Array.from(new Set(books.map((b) => b.genre).filter(Boolean))).sort()],
    [books]
  );

  const statusOf = useMemo(() => {
    const map = new Map<string, ReadingProgress>();
    progress.forEach((p) => map.set(p.bookId, p));
    return map;
  }, [progress]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = books.filter((book) => {
      const p = statusOf.get(book.id);

      if (filter === "lendo" && p?.status !== "lendo") return false;
      if (filter === "ler-depois" && p?.status !== "ler-depois") return false;
      if (filter === "lidos" && p?.status !== "finalizado") return false;
      if (filter === "favoritos" && !savedIds.includes(book.id)) return false;
      if (filter === "pdfs" && !book.pdfPath) return false;

      if (genre !== "Todos" && book.genre !== genre) return false;

      if (term && !book.title.toLowerCase().includes(term) && !(book.author || "").toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === "populares") sorted.sort((a, b) => (b.popularity ?? b.readers ?? 0) - (a.popularity ?? a.readers ?? 0));
    else if (sort === "nota") sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    else if (sort === "titulo") sorted.sort((a, b) => a.title.localeCompare(b.title, "pt", { sensitivity: "base" }));
    else sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    return sorted;
  }, [books, filter, genre, search, sort, savedIds, statusOf]);

  const counts = useMemo(
    () => ({
      todos: books.length,
      lendo: progress.filter((p) => p.status === "lendo").length,
      "ler-depois": progress.filter((p) => p.status === "ler-depois").length,
      lidos: progress.filter((p) => p.status === "finalizado").length,
      favoritos: savedIds.length,
      pdfs: books.filter((b) => !!b.pdfPath).length,
    }),
    [books, progress, savedIds]
  );

  const handleRemoved = (id: string) =>
    setData((prev) => (prev ? { ...prev, books: prev.books.filter((b) => b.id !== id) } : prev));

  const handleEdited = (updated: Book) =>
    setData((prev) =>
      prev ? { ...prev, books: prev.books.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)) } : prev
    );

  return (
    <div className="mb-screen mb-screen--wide mb-library space-y-5">
      <PageHeader
        title="Sua"
        highlight="biblioteca."
        subtitle={isLoading ? "Carregando o acervo…" : `${books.length} histórias. Sua próxima descoberta está aqui.`}
        icon={<ShelfIcon className="w-5 h-5" />}
        gradient="linear-gradient(140deg,#4b7a57,#2f4f39)"
        action={
          <Link to="/upload" className="mb-btn mb-btn-primary mb-btn-sm">
            <Upload className="w-4 h-4" /> Enviar livro
          </Link>
        }
      />

      {/* ── Busca e visualização ───────────────────────────────────────────── */}
      <div className="mb-library-search flex gap-2 mb-in" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou autor…"
            aria-label="Buscar na biblioteca"
            className="mb-input pl-9"
          />
        </div>
        <div className="mb-view-switch flex gap-1 p-1 rounded-xl">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => changeView(key)}
              title={label}
              aria-label={label}
              aria-pressed={view === key}
              className={`mb-btn mb-btn-sm mb-btn-icon ${view === key ? "mb-btn-primary" : "mb-btn-ghost"}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      {/* Quebra em linhas em vez de rolar na horizontal: no celular, o rolo
          cortava o primeiro e o último filtro. Assim todos aparecem inteiros. */}
      <div className="mb-library-tabs flex gap-1.5 mb-in" style={{ "--i": 2 } as React.CSSProperties}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => changeFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`mb-btn mb-btn-sm ${filter === f.key ? "mb-btn-primary" : "mb-btn-outline"}`}
          >
            {f.label}
            <span className={`text-[11px] ${filter === f.key ? "opacity-80" : "text-[var(--text-3)]"}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-library-tools flex flex-wrap gap-2 items-center mb-in" style={{ "--i": 3 } as React.CSSProperties}>
        <SlidersHorizontal className="w-4 h-4 text-[var(--text-3)]" />
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          aria-label="Filtrar por gênero"
          className="mb-input w-auto py-1.5 text-[12.5px]"
        >
          {genres.map((g) => (
            <option key={g} value={g}>{g === "Todos" ? "Todos os gêneros" : g}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Ordenar por"
          className="mb-input w-auto py-1.5 text-[12.5px]"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <span className="text-[12.5px] text-[var(--text-3)] ml-auto">
          {view === "shelf" ? "Guardados na estante · " : ""}{visible.length} {visible.length === 1 ? "livro" : "livros"}
        </span>
      </div>

      <div className="mb-collection-heading"><h2>{view === "shelf" ? "Sua estante, de perto" : "Explore a coleção"}</h2><span>{view === "shelf" ? "Toque em uma lombada para abrir" : "Histórias que merecem um lugar na sua estante"}</span></div>

      {/* ── Resultados ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-5 gap-y-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="w-full aspect-[2/3] rounded-lg" />
              <Skeleton className="h-3 w-4/5 mt-3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Nada por aqui"
          description={search.trim() ? "Nenhum livro corresponde à sua busca." : "Ainda não há livros nesta seção."}
          action={<Link to="/upload" className="mb-btn mb-btn-primary">Enviar um livro</Link>}
        />
      ) : view === "list" ? (
        <div className="mb-stagger space-y-2.5">
          {visible.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              variant="list"
              progress={statusOf.get(book.id)}
              onDeleted={handleRemoved}
              onEdited={handleEdited}
            />
          ))}
        </div>
      ) : (
        <BookGrid
          books={visible}
          progressOf={statusOf}
          display={view === "shelf" ? "spine" : "cover"}
          onDeleted={handleRemoved}
          onEdited={handleEdited}
        />
      )}
    </div>
  );
}
