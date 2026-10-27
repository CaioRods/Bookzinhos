import { useRef, useState, useCallback, memo } from "react";
import { BookOpen, Star } from "lucide-react";
import { useNavigate } from "react-router";
import { getCoverGradient, getFullUrl } from "../lib/types";
import { BookContextMenu } from "./BookContextMenu";
import { EditBookModal } from "./EditBookModal";
import { deleteBook, saveProgress } from "../lib/api";
import { useOpenBook } from "../lib/readerChoice";
import { ConfirmDialog, toast } from "./Ui";
import { Book3D, type BookDisplay } from "./Book3D";
import { useBookFlight, useFlyingBookId } from "./BookTransition";
import type { Book, ReadingProgress } from "../lib/types";

interface Props {
  book: Book;
  progress?: ReadingProgress;
  variant?: "grid" | "list";
  /** Largura da capa em pixels (modo grade) */
  width?: number;
  display?: BookDisplay;
  /** Posição na estante — escalona a animação de virada */
  index?: number;
  rank?: number;
  onDeleted?: (id: string) => void;
  onEdited?: (updated: Book) => void;
}

function BookCardImpl({
  book, progress: initialProgress, variant = "grid", width = 128,
  display = "cover", index = 0, rank, onDeleted, onEdited,
}: Props) {
  const navigate = useNavigate();
  const openBook = useOpenBook();
  const flyToBook = useBookFlight();
  const flyingId = useFlyingBookId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localProgress, setLocalProgress] = useState(initialProgress);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressedRef = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const startPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return;
    longPressedRef.current = false;

    const point = "touches" in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    touchStartPos.current = point;

    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setShowMenu(true);
      setMenuPos(point);
    }, 500);
  }, []);

  const handleCloseMenu = () => {
    setShowMenu(false);
    setMenuPos(null);
  };

  const cancelPress = useCallback(() => clearTimeout(timerRef.current), []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchStartPos.current.x, touch.clientY - touchStartPos.current.y);
    if (dist > 10) clearTimeout(timerRef.current);
  }, []);

  /** Abre o livro — com o voo animado quando há um palco para ele. */
  const openDetails = useCallback(() => {
    const scene = rootRef.current?.querySelector(".mb-book-scene");
    if (!flyToBook || !scene) {
      navigate(`/book/${book.id}`);
      return;
    }
    const rect = scene.getBoundingClientRect();
    flyToBook({
      book,
      rect: { left: rect.left, top: rect.top, width: rect.width },
      coverWidth: width,
      startAngle: display === "spine" ? 90 : 0,
    });
  }, [book, display, flyToBook, navigate, width]);

  const endPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    clearTimeout(timerRef.current);

    if (!longPressedRef.current) {
      if ("button" in e && e.button !== 0) return;
      const point = "changedTouches" in e
        ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
        : { x: e.clientX, y: e.clientY };

      const dist = Math.hypot(point.x - touchStartPos.current.x, point.y - touchStartPos.current.y);
      if (dist < 10) openDetails();
    }
    longPressedRef.current = false;
  }, [openDetails]);

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    handleCloseMenu();
    try {
      await deleteBook(book.id);
      onDeleted?.(book.id);
      toast(`"${book.title}" foi removido.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível excluir.", "error");
    }
  };

  const handleEdited = (updated: Book) => {
    setShowEdit(false);
    onEdited?.(updated);
  };

  const handlePause = async () => {
    handleCloseMenu();
    if (!localProgress) return;
    const nextStatus: "lendo" | "pausado" = localProgress.status === "pausado" ? "lendo" : "pausado";
    const nextProgress: ReadingProgress = { ...localProgress, status: nextStatus };
    setLocalProgress(nextProgress);
    await saveProgress(nextProgress);
    toast(nextStatus === "pausado" ? "Leitura pausada." : "Leitura retomada.");
  };

  const handleReadLater = async () => {
    handleCloseMenu();
    const nextProgress: ReadingProgress = localProgress
      ? { ...localProgress, status: "ler-depois" }
      : {
          bookId: book.id,
          currentPage: 0,
          totalPages: 100,
          progress: 0,
          status: "ler-depois",
          startedAt: Date.now(),
          lastReadAt: Date.now(),
        };
    setLocalProgress(nextProgress);
    await saveProgress(nextProgress);
    toast("Adicionado a “Ler depois”.");
  };

  const pressHandlers = {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `Ver ${book.title}${book.author ? `, de ${book.author}` : ""}`,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetails(); }
    },
    onMouseDown: startPress,
    onMouseUp: endPress,
    onMouseLeave: cancelPress,
    onTouchStart: startPress,
    onTouchEnd: endPress,
    onTouchMove: handleTouchMove,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clearTimeout(timerRef.current);
      longPressedRef.current = true;
      setShowMenu(true);
      setMenuPos({ x: e.clientX, y: e.clientY });
    },
  };

  const overlays = (
    <>
      {showMenu && (
        <BookContextMenu
          book={book}
          isPaused={localProgress?.status === "pausado"}
          onClose={handleCloseMenu}
          onRead={() => { handleCloseMenu(); openBook(book); }}
          onEdit={() => { handleCloseMenu(); setShowEdit(true); }}
          onDelete={() => { handleCloseMenu(); setShowDeleteConfirm(true); }}
          onFeedback={() => { handleCloseMenu(); navigate(`/book/${book.id}#avaliar`); }}
          onPause={localProgress ? handlePause : undefined}
          onReadLater={handleReadLater}
          menuPos={menuPos}
        />
      )}
      {showEdit && <EditBookModal book={book} onClose={() => setShowEdit(false)} onSaved={handleEdited} />}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir livro?"
        description={`“${book.title}” será removido para todos, junto com as resenhas e o progresso de leitura.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );

  if (variant === "list") {
    const coverUrl = getFullUrl(book.coverImagePath);
    return (
      <>
        <div {...pressHandlers} className="mb-card mb-card-hover p-3.5 flex gap-4 cursor-pointer select-none">
          <div className="flex-shrink-0 w-[64px] aspect-[2/3] rounded-md overflow-hidden shadow-[var(--shadow-2)]">
            {coverUrl ? (
              <img src={coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)} flex items-center justify-center`}>
                <BookOpen className="w-5 h-5 text-black/25" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 py-0.5">
            <h3 className="font-semibold text-foreground text-sm truncate">{book.title}</h3>
            <p className="text-[12px] text-[var(--text-3)] truncate mt-0.5">{book.author || "Autor desconhecido"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-2)]">
                <Star className="w-3.5 h-3.5 fill-[var(--gold)] text-[var(--gold)]" />
                {book.rating > 0 ? book.rating.toFixed(1) : "—"}
              </span>
              <span className="mb-chip">{book.genre}</span>
            </div>
            {localProgress && localProgress.progress > 0 && (
              <div className="mt-2.5">
                <div className="w-full bg-[var(--surface-2)] rounded-full h-1 overflow-hidden">
                  <div className="bg-[var(--primary)] h-full rounded-full" style={{ width: `${localProgress.progress}%` }} />
                </div>
                <p className="text-[11px] text-[var(--text-3)] mt-1.5">{Math.round(localProgress.progress)}% lido</p>
              </div>
            )}
          </div>
        </div>
        {overlays}
      </>
    );
  }

  const isSpine = display === "spine";

  return (
    <>
      {/* Enquanto este livro está voando, a cópia da estante fica invisível —
          mas ocupando o lugar, para a fileira não se reorganizar. */}
      <div
        ref={rootRef}
        {...pressHandlers}
        className="mb-book-tile cursor-pointer select-none"
        style={{ visibility: flyingId === book.id ? "hidden" : undefined }}
      >
        <Book3D
          book={book}
          width={width}
          display={display}
          index={index}
          rank={rank}
          progress={localProgress}
        />

        {/* A legenda some no modo estante: o nome já está na lombada. */}
        <div
          className="mb-book-caption overflow-hidden"
          style={{ display: isSpine ? "none" : undefined, width, marginTop: 12 }}
        >
          <h4 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">{book.title}</h4>
          <p className="mb-book-author">{book.author || "Autor desconhecido"}</p>
          {/* Uma linha só, que trunca inteira: em cartões estreitos a nota e a
              contagem de leitores brigavam por espaço e quebravam no meio. */}
          <p className="flex items-center gap-1 mt-1 text-[11.5px] whitespace-nowrap overflow-hidden">
            {book.rating > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-2)] flex-shrink-0">
                <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" />
                {book.rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-[var(--text-3)] flex-shrink-0">Sem nota</span>
            )}
            {!!book.readers && book.readers > 0 && (
              <span className="text-[var(--text-3)] truncate">· {book.readers} {book.readers === 1 ? "leitor" : "leitores"}</span>
            )}
          </p>
        </div>
      </div>
      {overlays}
    </>
  );
}

export const BookCard = memo(BookCardImpl);
