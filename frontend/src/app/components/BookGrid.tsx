import { useEffect, useRef, useState } from "react";
import { BookCard } from "./BookCard";
import type { BookDisplay } from "./Book3D";
import type { Book, ReadingProgress } from "../lib/types";

interface Props {
  books: Book[];
  framed?: boolean;
  progressOf?: Map<string, ReadingProgress>;
  display?: BookDisplay;
  ranked?: boolean;
  onDeleted?: (id: string) => void;
  onEdited?: (book: Book) => void;
  savedIds?: string[];
  onSavedChange?: (bookId: string, saved: boolean) => void;
}

/** Measures the actual collection, so covers stay aligned inside any page or sidebar. */
export function BookGrid({ books, framed = false, progressOf, display = "cover", ranked, onDeleted, onEdited, savedIds = [], onSavedChange }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [coverWidth, setCoverWidth] = useState(128);
  const [gap, setGap] = useState(24);
  const isShelf = display === "spine";
  useEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const measure = () => {
      const styles = getComputedStyle(element);
      const available = element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      if (!available) return;
      const mobile = window.innerWidth < 640;
      const spacing = framed ? (mobile ? 12 : 16) : mobile ? 16 : 28;
      const minimum = framed ? (mobile ? (window.innerWidth < 360 ? 124 : 142) : window.innerWidth < 1600 ? 176 : 200) : window.innerWidth < 400 ? 82 : mobile ? 108 : 200;
      const columns = Math.max(1, Math.floor((available + spacing) / (minimum + spacing)));
      const tileWidth = Math.floor((available - spacing * (columns - 1)) / columns);
      setCoverWidth(framed ? Math.max(80, tileWidth - 48) : Math.min(236, tileWidth));
      setGap(spacing);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [isShelf, framed]);
  const height = isShelf ? Math.max(220, Math.round(coverWidth * 1.5)) : Math.round(coverWidth * 1.5);
  return <div className={isShelf ? "mb-shelf-room" : ""}>
    <div ref={gridRef} className={`mb-book-grid mb-stagger flex flex-wrap items-start ${isShelf ? "mb-book-grid--shelf" : ""} ${framed ? "mb-book-grid--framed" : ""}`} style={{
      columnGap: isShelf ? 5 : gap,
      rowGap: framed ? 18 : isShelf ? 42 : 36,
      padding: isShelf ? "0 0 16px" : undefined,
      backgroundImage: isShelf ? `repeating-linear-gradient(to bottom, transparent 0px, transparent ${height + 4}px, color-mix(in srgb, var(--primary) 17%, var(--surface-3)) ${height + 4}px, color-mix(in srgb, var(--primary) 17%, var(--surface-3)) ${height + 10}px, transparent ${height + 10}px, transparent ${height + 42}px)` : undefined,
    }}>
      {books.map((book, i) => <BookCard key={book.id} book={book} framed={framed} width={coverWidth} display={display} index={i} rank={ranked ? i + 1 : undefined} progress={progressOf?.get(book.id)} saved={savedIds.includes(book.id)} onSavedChange={onSavedChange} onDeleted={onDeleted} onEdited={onEdited} />)}
    </div>
  </div>;
}
