import { useEffect, useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { fetchBooks } from "../lib/api";
import type { Book } from "../lib/types";
import { getFullUrl } from "../lib/types";
import { Modal } from "./Ui";
export function BookPicker({ books: supplied, selectedId, onSelect, onClose, title = "Escolher livro" }: { books?: Book[]; selectedId: string; onSelect: (book: Book) => void; onClose: () => void; title?: string }) {
  const [books, setBooks] = useState<Book[]>(supplied || []), [search, setSearch] = useState(""), [draftId, setDraftId] = useState(selectedId), [error, setError] = useState("");
  useEffect(() => { if (supplied) return; let alive = true; fetchBooks().then(books => { if (alive) setBooks(books); }).catch(() => { if (alive) setError("Não foi possível carregar os livros."); }); return () => { alive = false; }; }, [supplied]);
  const filtered = useMemo(() => books.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [books, search]);
  const confirm = () => { const book = books.find(book => book.id === draftId); if (book) onSelect(book); onClose(); };
  return <Modal open onClose={confirm} title={title} description="Selecione um livro e confirme. Clicar fora também confirma a seleção." size="lg" footer={<><button className="mb-btn mb-btn-outline" onClick={onClose}>Cancelar</button><button className="mb-btn mb-btn-primary" disabled={!draftId} onClick={confirm}><Check size={16} /> Confirmar livro</button></>}>
    <div className="mb-picker-search"><Search size={18} /><input autoFocus aria-label="Pesquisar livros no seletor" placeholder="Pesquisar por título ou autor…" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {error && <p role="alert">{error}</p>}<div className="mb-book-picker-grid">{filtered.map(book => <button key={book.id} aria-pressed={draftId === book.id} onClick={() => setDraftId(book.id)}><span>{book.coverImagePath ? <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" /> : <span className="mb-picker-placeholder">{book.title}</span>}{draftId === book.id && <i><Check size={16} /></i>}</span><strong>{book.title}</strong><small>{book.author}</small></button>)}</div>
    {!filtered.length && !error && <p className="mb-picker-empty">Nenhum livro encontrado.</p>}
  </Modal>;
}
