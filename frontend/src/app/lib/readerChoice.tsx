import { isOffline } from "./offline/device";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { BookOpen, Smartphone, Check } from "lucide-react";
import { getFullUrl } from "./types";
import { registerBookOpen } from "./api";
import { requireAuth } from "./authGate";
import { soundOpen } from "./sounds";
import type { Book } from "./types";

export type ReaderMode = "native" | "app";
const STORAGE_KEY = "books-reader-mode";

export function getSavedReaderMode(): ReaderMode | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "native" || v === "app" ? v : null;
}

export function setSavedReaderMode(mode: ReaderMode | null) {
  if (mode) localStorage.setItem(STORAGE_KEY, mode);
  else localStorage.removeItem(STORAGE_KEY);
}

interface ReaderChoiceContextValue {
  openBook: (book: Book) => void;
}

const ReaderChoiceContext = createContext<ReaderChoiceContextValue | null>(null);

export function useOpenBook() {
  const ctx = useContext(ReaderChoiceContext);
  if (!ctx) throw new Error("useOpenBook precisa estar dentro de um ReaderChoiceProvider");
  return ctx.openBook;
}

export function ReaderChoiceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [pendingBook, setPendingBook] = useState<Book | null>(null);

  const openInApp = useCallback((book: Book) => {
    navigate(`/read/${book.id}`);
  }, [navigate]);

  const openNative = useCallback((book: Book) => {
    const url = getFullUrl(book.pdfPath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const openBook = useCallback((book: Book) => {
    // Ler e baixar são bloqueados para visitante.
    if (!requireAuth("ler este livro")) return;
    soundOpen();
    // Conta a abertura para o ranking "Mais lidos" da home.
    registerBookOpen(book.id);
    if (isOffline() || !book.pdfPath) {
      openInApp(book);
      return;
    }
    const saved = getSavedReaderMode();
    if (saved === "native") {
      openNative(book);
      return;
    }
    if (saved === "app") {
      openInApp(book);
      return;
    }
    setPendingBook(book);
  }, [openInApp, openNative]);

  const handleChoice = (mode: ReaderMode, remember: boolean) => {
    if (!pendingBook) return;
    if (remember) setSavedReaderMode(mode);
    if (mode === "native") openNative(pendingBook);
    else openInApp(pendingBook);
    setPendingBook(null);
  };

  const value = useMemo(() => ({ openBook }), [openBook]);

  return (
    <ReaderChoiceContext.Provider value={value}>
      {children}
      {pendingBook && (
        <ReaderChoiceModal
          book={pendingBook}
          onChoose={handleChoice}
          onClose={() => setPendingBook(null)}
        />
      )}
    </ReaderChoiceContext.Provider>
  );
}

function ReaderChoiceModal({
  book,
  onChoose,
  onClose,
}: {
  book: Book;
  onChoose: (mode: ReaderMode, remember: boolean) => void;
  onClose: () => void;
}) {
  const [remember, setRemember] = useState(true);
  const [selected, setSelected] = useState<ReaderMode | null>(null);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 sm:p-8 space-y-6 shadow-2xl animate-slide-up border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto sm:hidden" />

        <div className="text-center space-y-1.5">
          <div className="text-3xl select-none">📖</div>
          <h3 className="text-base font-extrabold text-slate-800 leading-snug px-2">
            Como você quer ler<br className="sm:hidden" /> "{book.title}"?
          </h3>
          <p className="text-[11px] text-slate-400 font-semibold">Você pode mudar isso depois no seu perfil.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSelected("app")}
            className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
              selected === "app" ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
            }`}
          >
            <BookOpen className={`w-6 h-6 mb-3 ${selected === "app" ? "text-[var(--primary)]" : "text-slate-400"}`} />
            <p className="text-xs font-extrabold text-slate-800">Leitor do App</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">Progresso, capítulos, temas e zoom</p>
          </button>
          <button
            onClick={() => setSelected("native")}
            className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
              selected === "native" ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
            }`}
          >
            <Smartphone className={`w-6 h-6 mb-3 ${selected === "native" ? "text-[var(--primary)]" : "text-slate-400"}`} />
            <p className="text-xs font-extrabold text-slate-800">Leitor do Sistema</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 leading-relaxed">Visualizador nativo do seu aparelho</p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRemember((r) => !r)}
          className="flex items-center gap-2.5 px-1 cursor-pointer select-none"
        >
          <span
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
              remember ? "bg-[var(--primary)] border-[var(--primary)]" : "border-slate-300"
            }`}
          >
            {remember && <Check className="w-3.5 h-3.5 text-white" />}
          </span>
          <span className="text-[11px] font-bold text-slate-500">Lembrar minha escolha</span>
        </button>

        <button
          onClick={() => selected && onChoose(selected, remember)}
          disabled={!selected}
          className={`w-full py-4 rounded-2xl font-extrabold text-[11px] uppercase tracking-widest transition-all cursor-pointer ${
            selected
              ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/15 active:scale-95"
              : "bg-slate-100 text-slate-300 cursor-not-allowed"
          }`}
        >
          Confirmar
        </button>
      </div>
    </div>,
    document.body
  );
}
