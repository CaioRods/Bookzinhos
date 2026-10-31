import { AddToBooklist } from "./AddToBooklist";
import { OfflineBookButton } from "./OfflineBookButton";
import { useOffline } from "../lib/offline/device";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown, FolderPlus, BookOpen, Pencil, Trash2, MessageSquare, PauseCircle, PlayCircle, Clock, Download, Loader2, Bookmark,
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


/**
 * Menu de ações de um livro. No desktop abre junto ao cursor; no celular sobe
 * como uma folha a partir da base da tela.
 */
export function BookContextMenu({
  book, isPaused, isSaved, onClose, onRead, onEdit, onDelete, onFeedback, onPause, onReadLater, onToggleSaved, menuPos,
}: Props) {
  const offline = useOffline();
  const coverUrl = getFullUrl(book.coverImagePath);
  const pdfUrl = getFullUrl(book.pdfPath);
  const isDesktop = useDeviceTier() === "desktop";
  const [isDownloading, setIsDownloading] = useState(false);
  const panel = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [addToList,setAddToList]=useState(false),[more,setMore]=useState(false);
  const [position,setPosition]=useState({x:10,y:10,maxHeight:400,width:264,viewWidth:0});
  const measureScroll=()=>{const element=scroller.current;if(element)setMore(element.scrollTop+element.clientHeight<element.scrollHeight-3);};
  useLayoutEffect(()=>{
    const measure=()=>{
      const vv=window.visualViewport, left=vv?.offsetLeft||0,top=vv?.offsetTop||0,w=vv?.width||innerWidth,h=vv?.height||innerHeight;
      const width=Math.min(MENU_WIDTH,Math.max(80,w-24)),maxHeight=Math.max(40,h-24);
      if(panel.current) panel.current.style.maxHeight=`${maxHeight}px`;
      const height=Math.min(panel.current?.offsetHeight||400,maxHeight);
      const x=Math.max(left+12,Math.min(menuPos?.x||left+12,left+w-width-12)),y=Math.max(top+12,Math.min(menuPos?.y||top+12,top+h-height-12));
      setPosition(previous=>previous.x===x&&previous.y===y&&previous.maxHeight===maxHeight&&previous.width===width&&previous.viewWidth===w?previous:{x,y,maxHeight,width,viewWidth:w});measureScroll();
    };
    measure();const observer=new ResizeObserver(measure);if(panel.current)observer.observe(panel.current);if(scroller.current)observer.observe(scroller.current);
    window.addEventListener("resize",measure);window.visualViewport?.addEventListener("resize",measure);window.visualViewport?.addEventListener("scroll",measure);
    return()=>{observer.disconnect();window.removeEventListener("resize",measure);window.visualViewport?.removeEventListener("resize",measure);window.visualViewport?.removeEventListener("scroll",measure);};
  },[menuPos?.x,menuPos?.y,isDesktop]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (addToList) return;
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
  }, [onClose,addToList]);

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
    !offline ? { label: "Adicionar à Booklist", icon: FolderPlus, onClick: () => setAddToList(true) } : null,
    onToggleSaved ? { label: isSaved ? "Remover dos favoritos" : "Favoritar", icon: Bookmark, onClick: onToggleSaved } : null,
    !offline ? { label: "Avaliar e comentar", icon: MessageSquare, onClick: onFeedback } : null,
    onPause
      ? { label: isPaused ? "Retomar leitura" : "Pausar leitura", icon: isPaused ? PlayCircle : PauseCircle, onClick: onPause }
      : null,
    onReadLater ? { label: "Ler depois", icon: Clock, onClick: onReadLater } : null,
    pdfUrl && !offline
      ? { label: isDownloading ? "Baixando…" : "Baixar PDF", icon: isDownloading ? Loader2 : Download, onClick: handleDownload, spinning: isDownloading }
      : null,
    !offline ? { label: "Editar livro", icon: Pencil, onClick: onEdit } : null,
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
      <OfflineBookButton id={book.id}/>
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
        disabled={offline}
        onClick={onDelete}
        className="w-full flex items-center gap-3 px-3.5 h-10 text-[13px] font-medium text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4" /> Excluir livro
      </button>
    </div>
  );

  if (addToList) return <AddToBooklist book={book} onClose={onClose}/>;
  const footer=<><button className="mb-context-more" hidden={!more} onClick={()=>scroller.current?.scrollBy({top:150,behavior:document.documentElement.dataset.reduceMotion==="true"?"instant":"smooth"})}><ChevronDown size={15}/> Mais opções abaixo</button><button className="mb-context-close" onClick={onClose}>Fechar</button></>;
  if (isDesktop && menuPos) {
    return createPortal(
      <div className="fixed inset-0 z-[9999]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={`Opções de ${book.title}`}
          style={{ left: position.x, top: position.y, width: position.width, maxHeight: position.maxHeight }}
          onClick={(e) => e.stopPropagation()}
          className="mb-book-context absolute bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-3)] overflow-hidden animate-scale-in"
        >
          {header}
          <div ref={scroller} className="mb-context-scroll" onScroll={measureScroll}>{list}</div>
          {footer}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" style={{top:window.visualViewport?.offsetTop||0,left:window.visualViewport?.offsetLeft||0,width:window.visualViewport?.width||"100vw",height:window.visualViewport?.height||"100dvh",bottom:"auto",right:"auto"}} onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Opções de ${book.title}`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: position.maxHeight, width: Math.min(384, (window.visualViewport?.width||innerWidth)-24) }}
        className="mb-book-context relative bg-[var(--surface)] border rounded-2xl shadow-[var(--shadow-3)] overflow-hidden animate-fade-in mb-3 pb-[env(safe-area-inset-bottom)]"
      >
        {header}
        <div ref={scroller} className="mb-context-scroll" onScroll={measureScroll}>{list}</div>
        {footer}

      </div>
    </div>,
    document.body
  );
}
