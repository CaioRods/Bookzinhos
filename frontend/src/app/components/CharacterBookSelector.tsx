import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { getFullUrl, type Book } from "../lib/types";
import { Modal } from "./Ui";

export function toggleCharacterBook(books: Book[], selected: string[], book: Book) {
  if (selected.includes(book.id)) return selected.filter(id => id !== book.id);
  const saga = books.filter(item => item.id === book.id || (book.seriesId ? item.seriesId === book.seriesId : !!book.seriesName?.trim() && item.seriesName?.trim().toLocaleLowerCase() === book.seriesName.trim().toLocaleLowerCase()));
  return [...new Set([...selected, ...saga.map(item => item.id)])];
}

export function CharacterBookSelector({ books, value, onChange }: { books: Book[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    const term = normalize(query.trim());
    return books.filter(book => normalize(`${book.title} ${book.author} ${book.seriesName || ""}`).includes(term));
  }, [books, query]);
  return <div><span className="mb-label">Livros vinculados</span>
    <button type="button" className="mb-btn mb-btn-outline w-full mt-1" onClick={() => setOpen(true)}><BookOpen size={16}/> Selecionar livros ({value.length})</button>
    <small className="block mt-1 text-[var(--text-3)]">Selecionar um volume marca a saga inteira. Você pode desmarcar volumes individualmente.</small>
    <Modal open={open} onClose={() => setOpen(false)} title="Selecionar livros" size="lg" footer={<button type="button" className="mb-btn mb-btn-primary" onClick={() => setOpen(false)}>Concluir · {value.length} selecionados</button>}>
      <label className="mb-label flex items-center gap-2"><Search size={16}/><input className="mb-input" aria-label="Buscar livros" placeholder="Buscar livro, autor ou saga" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div className="flex items-center justify-between my-3"><small>{filtered.length} livros</small><button type="button" className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => onChange([])}>Desmarcar todos</button></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{filtered.map(book => <label key={book.id} className="mb-card p-3 cursor-pointer flex gap-2 items-start"><input type="checkbox" checked={value.includes(book.id)} onChange={() => onChange(toggleCharacterBook(books, value, book))} aria-label={book.title}/><span className="min-w-0">{book.coverImagePath ? <img className="h-24 w-16 object-cover rounded mb-2" src={getFullUrl(book.coverImagePath) || ""} alt="" loading="lazy"/> : <BookOpen size={32}/>}<strong className="block text-sm">{book.title}</strong><small className="text-[var(--text-3)]">{book.seriesName || book.author}</small></span></label>)}</div>
      {!filtered.length && <p className="text-sm py-6 text-center">Nenhum livro encontrado.</p>}
    </Modal>
  </div>;
}
