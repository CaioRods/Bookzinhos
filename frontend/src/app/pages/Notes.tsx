import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Trash2, Send, Loader2, Star, PenLine } from "lucide-react";
import { addNote, deleteNote, fetchBookNotes, fetchBooks } from "../lib/api";
import { getCoverGradient, getFullUrl, timeAgo } from "../lib/types";
import { getUsername } from "../lib/session";
import type { Book, Note } from "../lib/types";
import { EmptyState, PageHeader, SectionHeader, Skeleton, StarPicker, Stars, toast } from "../components/Ui";

const QUICK = ["Amei ❤️", "Confuso 🤔", "Viciante 🔥", "Emocionante 😭", "Chocante 😱", "Não larguei 📖"];

/**
 * Diário de leitura: anotações privadas por livro, com nota do momento.
 * É diferente da resenha pública — esta fica só para o próprio leitor.
 */
export function Notes() {
  const [searchParams] = useSearchParams();
  const me = getUsername();

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBooks().then((b) => {
      const list = b || [];
      setBooks(list);
      const urlBookId = searchParams.get("bookId");
      if (urlBookId && list.some((book) => book.id === urlBookId)) setSelectedId(urlBookId);
      else if (list.length > 0) setSelectedId(list[0].id);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedId) return;
    fetchBookNotes(selectedId).then((n) => setNotes(n || [])).catch(() => setNotes([]));
  }, [selectedId]);

  const selectedBook = books.find((b) => b.id === selectedId) || null;

  const filteredBooks = useMemo(() => {
    const term = bookSearch.trim().toLowerCase();
    if (!term) return books;
    return books.filter((b) => b.title.toLowerCase().includes(term) || (b.author || "").toLowerCase().includes(term));
  }, [books, bookSearch]);

  const myNotes = useMemo(
    () => notes.filter((n) => !n.username || n.username.toLowerCase() === (me || "").toLowerCase()),
    [notes, me]
  );

  const handleSubmit = async () => {
    if (!selectedId || rating === 0 || !feedback.trim()) return;
    setIsSaving(true);
    try {
      const newNote = await addNote({ bookId: selectedId, feedback: feedback.trim(), rating });
      setNotes((prev) => [{ ...newNote, username: me || undefined }, ...prev]);
      setRating(0);
      setFeedback("");
      toast("Anotação salva no seu diário.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      await deleteNote(noteId);
    } catch {
      toast("Não foi possível apagar.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="mb-screen mb-screen--narrow mb-notes space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="mb-screen mb-screen--narrow mb-notes">
        <EmptyState
          emoji="📓"
          title="Nenhum livro para anotar"
          description="Envie um livro para começar seu diário de leitura."
          action={<Link to="/upload" className="mb-btn mb-btn-primary">Enviar livro</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mb-screen mb-screen--narrow mb-notes space-y-6">
      <PageHeader
        title="Diário de"
        highlight="leitura"
        subtitle="Anotações só suas, presas ao livro. Para dar nota pública, use a página do livro."
        icon={<PenLine className="w-5 h-5" />}
        gradient="linear-gradient(140deg,#4f9e8a,#2f6d5e)"
      />

      {/* ── Escolha do livro ───────────────────────────────────────────────── */}
      <section className="mb-notes-selector">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
          <input
            value={bookSearch}
            onChange={(e) => setBookSearch(e.target.value)}
            placeholder="Encontrar um livro…"
            aria-label="Buscar livro"
            className="mb-input pl-9"
          />
        </div>

        <div className="mb-rail">
          {filteredBooks.map((book) => (
            <button
              key={book.id}
              onClick={() => setSelectedId(book.id)}
              className="w-[72px] text-left cursor-pointer"
              aria-pressed={selectedId === book.id}
            >
              <div
                className={`w-full aspect-[2/3] rounded-md overflow-hidden bg-[var(--surface-2)] transition-all ${
                  selectedId === book.id ? "ring-2 ring-[var(--primary)]" : "opacity-65 hover:opacity-100"
                }`}
              >
                {book.coverImagePath ? (
                  <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)}`} />
                )}
              </div>
              <p className="text-[11px] font-semibold text-foreground line-clamp-2 mt-1.5 leading-snug">{book.title}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Nova anotação ──────────────────────────────────────────────────── */}
      {selectedBook && (
        <section className="mb-notes-composer mb-card p-5 space-y-4">
          <SectionHeader
            title={`Anotar sobre “${selectedBook.title}”`}
            icon={<PenLine className="w-[18px] h-[18px] text-[var(--primary)]" />}
          />

          <div>
            <span className="mb-label">Como está a leitura agora?</span>
            <StarPicker value={rating} onChange={setRating} disabled={isSaving} />
          </div>

          <div>
            <label htmlFor="note-text" className="mb-label">Anotação</label>
            <textarea
              id="note-text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              maxLength={800}
              placeholder="O que aconteceu nesse trecho? O que você sentiu?"
              className="mb-input resize-y leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => setFeedback((prev) => (prev ? `${prev} ${q}` : q))}
                  className="mb-chip cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSaving || rating === 0 || !feedback.trim()}
              className="mb-btn mb-btn-primary"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar anotação
            </button>
          </div>
        </section>
      )}

      {/* ── Histórico ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Suas anotações"
          subtitle={selectedBook ? `Sobre “${selectedBook.title}”` : undefined}
          icon={<Star className="w-[18px] h-[18px] text-[var(--gold)]" />}
        />
        {myNotes.length === 0 ? (
          <EmptyState emoji="🕊️" title="Nada anotado ainda" description="Suas primeiras impressões aparecem aqui." />
        ) : (
          <div className="space-y-2.5">
            {myNotes.map((note) => (
              <article key={note.id} className="mb-card p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Stars value={note.rating} size="sm" />
                    <span className="text-[11.5px] text-[var(--text-3)]">
                      {note.createdAt ? timeAgo(note.createdAt) : note.date}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    aria-label="Apagar anotação"
                    className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed mt-2 whitespace-pre-wrap">{note.feedback}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
