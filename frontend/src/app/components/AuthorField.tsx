import { useEffect, useMemo, useState } from "react";
import { Search, Users, BookOpen, RefreshCw } from "lucide-react";
import { Modal } from "./Ui";
import { authorKey, fetchAuthors, type AuthorRecord } from "../lib/authors";
import { getFullUrl } from "../lib/types";
export function AuthorField({ value, onChange, refreshKey = 0 }: { value: string; onChange: (name: string) => void; refreshKey?: number }) {
  const [records, setRecords] = useState<AuthorRecord[]>([]), [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState(""), [loading, setLoading] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    fetchAuthors(controller.signal).then(data => { if (!controller.signal.aborted) { setRecords(data); setError(""); } }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey, attempt]);
  const selected = value.split(";").map(authorKey);
  const linked = useMemo(() => [...new Map(records.filter(author => selected.includes(authorKey(author.name))).flatMap(author => author.books).map(book => [book.id, book])).values()], [records, value]);
  const filtered = records.filter(author => authorKey(author.name).includes(authorKey(query)));
  return <div>
    <label htmlFor="up-author" className="mb-label">Autor</label>
    <div className="flex gap-2"><input id="up-author" value={value} onChange={event => onChange(event.target.value)} placeholder="Quem escreveu" className="mb-input min-w-0 flex-1" />
      <button type="button" className="mb-btn mb-btn-outline" onClick={() => { setQuery(""); setLimit(50); setOpen(true); }} aria-label="Selecionar autor cadastrado"><Users size={17} /><span className="hidden sm:inline">Autores</span></button></div>
    {linked.length > 0 && <div className="mt-3"><p className="text-xs text-[var(--text-3)] mb-2">Livros vinculados a este autor ({linked.length})</p><div className="flex gap-2 overflow-x-auto pb-1">{linked.map(book => <div key={book.id} className="w-16 shrink-0" title={book.title}>{book.coverImagePath ? <img loading="lazy" src={getFullUrl(book.coverImagePath)!} alt={`Capa de ${book.title}`} className="w-16 h-24 rounded-lg object-cover" /> : <div className="w-16 h-24 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><BookOpen size={20} /></div>}<span className="block text-[10px] mt-1 truncate">{book.title}</span></div>)}</div></div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Autores cadastrados" description="Escolha um autor para vincular o livro. Novos nomes são cadastrados ao publicar." size="lg">
      <div className="relative mb-4"><Search size={17} className="absolute left-3 top-3.5 text-[var(--text-3)]" /><input aria-label="Pesquisar autores" className="mb-input pl-10" value={query} onChange={event => { setQuery(event.target.value); setLimit(50); }} placeholder="Pesquisar pelo nome…" /></div>
      {loading ? <p role="status" className="py-6 text-center">Carregando autores…</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mb-btn mb-btn-outline mt-3" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} />Tentar novamente</button></div> : !filtered.length ? <p className="py-6 text-center text-sm text-[var(--text-3)]">{query ? "Nenhum autor encontrado." : "Os autores dos seus livros aparecerão aqui."}</p> : <div className="max-h-80 overflow-y-auto space-y-2">{filtered.slice(0, limit).map(author => <button key={author.id} type="button" className="w-full flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left hover:bg-[var(--surface-2)]" onClick={() => { onChange(author.name); setOpen(false); }}><div className="flex -space-x-3 w-20 shrink-0">{author.books.slice(0, 3).map(book => book.coverImagePath ? <img loading="lazy" key={book.id} src={getFullUrl(book.coverImagePath)!} alt="" className="w-8 h-12 rounded object-cover border border-[var(--surface)]" /> : <BookOpen key={book.id} size={22} />)}</div><span><strong className="block text-sm">{author.name}</strong><span className="text-xs text-[var(--text-3)]">{author.bookCount} {author.bookCount === 1 ? "livro vinculado" : "livros vinculados"}</span></span></button>)}{filtered.length > limit && <button type="button" className="mb-btn mb-btn-outline w-full" onClick={() => setLimit(value => value + 50)}>Mostrar mais autores</button>}</div>}
    </Modal>
  </div>;
}
