import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, Pencil, Trash2, MessageSquare, PauseCircle, PlayCircle, Clock, Download, Loader2, Bookmark,
} from "lucide-react";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book } from "../lib/types";
import { useDeviceTier } from "./ui/use-device-tier";
import { downloadRemoteFile, safeFileName } from "../lib/download";
import { Stars } from "./Ui";

interface Props {
  book: Book;
  isPaused?: boolean;
  onClose: () => void;
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFeedback: () => void;
  onPause?: () => void;
  onReadLater?: () => void;
  isSaved?: boolean;
  onToggleSaved?: () => void;
  menuPos?: { x: number; y: number } | null;
}

const MENU_WIDTH = 264;
const MENU_HEIGHT = 300;

/**
 * Menu de ações de um livro. No desktop abre junto ao cursor; no celular sobe
 * como uma folha a partir da base da tela.
 */
export function BookContextMenu({
  book, isPaused, isSaved, onClose, onRead, onEdit, onDelete, onFeedback, onPause, onReadLater, onToggleSaved, menuPos,
}: Props) {
  const coverUrl = getFullUrl(book.coverImagePath);
  const pdfUrl = getFullUrl(book.pdfPath);
  const isDesktop = useDeviceTier() === "desktop";
  const [isDownloading, setIsDownloading] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [onClose]);

  const handleDownload = async () => {
    if (!pdfUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadRemoteFile(pdfUrl, safeFileName(book.title, "pdf"));
    } catch (err) {
      console.error("Erro ao baixar PDF", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const actions = [
    { label: "Abrir para ler", icon: BookOpen, onClick: onRead },
    onToggleSaved ? { label: isSaved ? "Remover dos favoritos" : "Favoritar", icon: Bookmark, onClick: onToggleSaved } : null,
    { label: "Avaliar e comentar", icon: MessageSquare, onClick: onFeedback },
    onPause
      ? { label: isPaused ? "Retomar leitura" : "Pausar leitura", icon: isPaused ? PlayCircle : PauseCircle, onClick: onPause }
      : null,
    onReadLater ? { label: "Ler depois", icon: Clock, onClick: onReadLater } : null,
    pdfUrl
      ? { label: isDownloading ? "Baixando…" : "Baixar PDF", icon: isDownloading ? Loader2 : Download, onClick: handleDownload, spinning: isDownloading }
      : null,
    { label: "Editar livro", icon: Pencil, onClick: onEdit },
  ].filter(Boolean) as { label: string; icon: typeof BookOpen; onClick: () => void; spinning?: boolean }[];

  const header = (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-[var(--line)]">
      <div className="w-10 aspect-[2/3] rounded overflow-hidden flex-shrink-0 bg-[var(--surface-2)]">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)}`} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{book.title}</p>
        <p className="text-[11.5px] text-[var(--text-3)] truncate">{book.author || "Autor desconhecido"}</p>
        {book.rating > 0 && <div className="mt-1"><Stars value={book.rating} size="sm" /></div>}
      </div>
    </div>
  );

  const list = (
    <div className="py-1.5">
      {actions.map(({ label, icon: Icon, onClick, spinning }) => (
        <button
          key={label}
          onClick={onClick}
          className="w-full flex items-center gap-3 px-3.5 h-10 text-[13px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-foreground transition-colors cursor-pointer"
        >
          <Icon className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          {label}
        </button>
      ))}
      <div className="h-px bg-[var(--line)] my-1.5" />
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-3 px-3.5 h-10 text-[13px] font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" /> Excluir livro
      </button>
    </div>
  );

  if (isDesktop && menuPos) {
    const x = Math.max(10, Math.min(menuPos.x, window.innerWidth - MENU_WIDTH - 16));
    const y = Math.max(10, Math.min(menuPos.y, window.innerHeight - MENU_HEIGHT - 16));

    return createPortal(
      <div className="fixed inset-0 z-[9999]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={`Opções de ${book.title}`}
          style={{ left: x, top: y, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-3)] overflow-hidden animate-scale-in"
        >
          {header}
          {list}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Opções de ${book.title}`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm bg-[var(--surface)] border-t sm:border border-[var(--line)] rounded-t-2xl sm:rounded-2xl sm:mb-6 shadow-[var(--shadow-3)] overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]"
      >
        {header}
        {list}
        <button onClick={onClose} className="w-full h-12 text-[13px] font-semibold text-[var(--text-3)] border-t border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>,
    document.body
  );
}
