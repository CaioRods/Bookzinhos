import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Play, ArrowRight, LayoutGrid, Heart, Library as ShelfIcon } from "lucide-react";
import { fetchAllProgress, fetchBooks, fetchSavedIds } from "../lib/api";
import { useLiveData } from "../lib/useLiveData";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book, ReadingProgress } from "../lib/types";
import { BookGrid } from "../components/BookGrid";
import { EmptyState, PageHeader, Skeleton } from "../components/Ui";
import { useOpenBook } from "../lib/readerChoice";

type TabKey = "lendo" | "ler-depois" | "finalizado" | "favoritos" | "recomendados";

const TABS: { key: TabKey; label: string }[] = [
  { key: "lendo", label: "Lendo" },
  { key: "ler-depois", label: "Ler depois" },
  { key: "finalizado", label: "Lidos" },
  { key: "favoritos", label: "Favoritos" },
  { key: "recomendados", label: "Para você" },
];

export function MyBooks() {
  const openBook = useOpenBook();
  const [tab, setTab] = useState<TabKey>("lendo");
  const [shelfMode, setShelfMode] = useState(false);

  const { data, isLoading } = useLiveData<{
    books: Book[];
    progress: ReadingProgress[];
    savedIds: string[];
  }>(
    async (force) => {
      const [books, progress, savedIds] = await Promise.all([
        fetchBooks(force),
        fetchAllProgress(force).catch(() => [] as ReadingProgress[]),
        fetchSavedIds(force).catch(() => [] as string[]),
      ]);
      return { books: books || [], progress: progress || [], savedIds: savedIds || [] };
    },
    [],
    { intervalMs: 45000 }
  );

  const books = data?.books ?? [];
  const progress = data?.progress ?? [];
  const savedIds = data?.savedIds ?? [];

  const progressOf = useMemo(() => new Map(progress.map((p) => [p.bookId, p])), [progress]);

  /** Sugestões por afinidade de gênero com o que a pessoa já leu. */
  const recommended = useMemo(() => {
    const genreScore: Record<string, number> = {};
    progress.forEach((p) => {
      const book = books.find((b) => b.id === p.bookId);
      if (book?.genre) {
        const key = book.genre.trim().toLowerCase();
        genreScore[key] = (genreScore[key] || 0) + 1;
      }
    });

    const untouched = books.filter((b) => {
      const p = progressOf.get(b.id);
      return !p || (p.status !== "lendo" && p.status !== "finalizado");
    });

    return [...untouched].sort((a, b) => {
      const scoreA = genreScore[(a.genre || "").trim().toLowerCase()] || 0;
      const scoreB = genreScore[(b.genre || "").trim().toLowerCase()] || 0;
      return scoreB - scoreA || (b.popularity ?? 0) - (a.popularity ?? 0) || b.addedAt - a.addedAt;
    });
  }, [books, progress, progressOf]);

  const listFor = (key: TabKey): Book[] => {
    if (key === "favoritos") return books.filter((b) => savedIds.includes(b.id));
    if (key === "recomendados") return recommended;
    return books.filter((b) => progressOf.get(b.id)?.status === key);
  };

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, listFor(t.key).length])) as Record<TabKey, number>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [books, progress, savedIds, recommended]
  );

  const visible = listFor(tab);
  const reading = listFor("lendo");
  const heroBook = reading[0];
  const heroProgress = heroBook ? progressOf.get(heroBook.id) : undefined;

  return (
    <div className="mb-screen mb-screen--wide mb-mybooks space-y-6">
      <PageHeader
        title="Histórias que"
        highlight="ficam com você."
        subtitle="Suas leituras, favoritos e o que vem a seguir."
        icon={<Heart className="w-5 h-5" />}
        gradient="linear-gradient(140deg,#e0a33c,#c07f1f)"
      />

      {/* Destaque da leitura em andamento */}
      {isLoading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : heroBook && heroProgress ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => openBook(heroBook)}
          onKeyDown={(e) => e.key === "Enter" && openBook(heroBook)}
          className="mb-reading-spotlight mb-card mb-card-hover cursor-pointer p-5 flex gap-5"
        >
          <div className="w-20 aspect-[2/3] rounded-lg overflow-hidden shadow-[var(--shadow-book)] flex-shrink-0 bg-[var(--surface-2)]">
            {heroBook.coverImagePath ? (
              <img src={getFullUrl(heroBook.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(heroBook)}`} />
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <p className="mb-eyebrow">Retomar leitura</p>
              <h2 className="text-lg font-bold text-foreground mt-1 line-clamp-1">{heroBook.title}</h2>
              <p className="text-[13px] text-[var(--text-3)]">{heroBook.author}</p>
            </div>
            <div className="mt-4">
              <div className="w-full bg-[var(--surface-2)] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: `${heroProgress.progress}%` }} />
              </div>
              <div className="flex justify-between items-center mt-2 text-[12.5px]">
                <span className="text-[var(--text-3)]">{Math.round(heroProgress.progress)}% concluído</span>
                <span className="text-[var(--primary)] font-semibold inline-flex items-center gap-1">
                  <Play className="w-3.5 h-3.5 fill-current" /> Continuar
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`mb-btn mb-btn-sm ${tab === t.key ? "mb-btn-soft" : "mb-btn-ghost"}`}
            >
              {t.label} <span className="mb-chip">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShelfMode((v) => !v)}
          title={shelfMode ? "Mostrar as capas" : "Guardar na estante"}
          aria-pressed={shelfMode}
          className={`mb-btn mb-btn-sm mb-btn-icon flex-shrink-0 ${shelfMode ? "mb-btn-primary" : "mb-btn-outline"}`}
        >
          {shelfMode ? <LayoutGrid className="w-4 h-4" /> : <ShelfIcon className="w-4 h-4" />}
        </button>
      </div>

      {isLoading ? (
        <div className="mb-stagger grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="w-full aspect-[2/3] rounded-lg" />
              <Skeleton className="h-3 w-4/5 mt-2.5" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji={tab === "favoritos" ? "💗" : "📚"}
          title={
            tab === "lendo" ? "Nenhuma leitura em andamento"
              : tab === "ler-depois" ? "Nada na fila ainda"
              : tab === "finalizado" ? "Nenhum livro concluído"
              : tab === "favoritos" ? "Sem favoritos por enquanto"
              : "Sem sugestões no momento"
          }
          description="Segure um livro na biblioteca para salvar, pausar ou deixar para depois."
          action={<Link to="/library" className="mb-btn mb-btn-primary">Ir para a biblioteca <ArrowRight className="w-4 h-4" /></Link>}
        />
      ) : (
        <BookGrid books={visible} progressOf={progressOf} display={shelfMode ? "spine" : "cover"} />
      )}
    </div>
  );
}
