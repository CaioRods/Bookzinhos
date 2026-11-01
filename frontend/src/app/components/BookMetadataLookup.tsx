import { useState, useRef, useEffect } from "react";
import { Search, Loader2, ExternalLink, Check } from "lucide-react";
import { Modal } from "./Ui";
import { searchBookMetadata, openLibraryDetails, type BookMetadata } from "../lib/bookMetadata";
const FIELDS = { title: "Título", author: "Autor", description: "Sinopse", genre: "Gêneros", publisher: "Editora", publishedYear: "Ano" } as const;
export type MetadataForm = Record<keyof typeof FIELDS, string>;
export function BookMetadataLookup({ current, onApply }: { current: MetadataForm; onApply: (fields: Partial<MetadataForm>, metadata: BookMetadata) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [source, setSource] = useState<BookMetadata["source"]>("google");
  const [results, setResults] = useState<BookMetadata[]>([]), [chosen, setChosen] = useState<BookMetadata | null>(null), [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [searched, setSearched] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const close = () => { active.current?.abort(); setLoading(false); setOpen(false); };
  const fieldsOf = (book: BookMetadata): MetadataForm => ({ title: book.title, author: book.authors.join("; "), description: book.description, genre: book.genres.join(", "), publisher: book.publisher, publishedYear: book.publishedYear });
  const search = async () => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(""); setChosen(null); setSearched(true); setResults([]);
    try { const records = await searchBookMetadata(query, "", source, controller.signal); if (!controller.signal.aborted) setResults(records); }
    catch (error) { if (!controller.signal.aborted) setError((error as Error).message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const choose = async (record: BookMetadata) => {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setLoading(true); setError("");
    let book = record;
    try {
      if (record.source === "openlibrary") book = { ...record, ...await openLibraryDetails(record.id, controller.signal) };
      if (controller.signal.aborted) return;
      setChosen(book); const values = fieldsOf(book);
      setChecked(Object.keys(FIELDS).filter(key => values[key as keyof MetadataForm] && (!current[key as keyof MetadataForm] || (key === "genre" && current.genre === "Outros"))));
    } catch (error) { if (!controller.signal.aborted) { setChosen(record); setChecked([]); setError((error as Error).message); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  return <>
    <button type="button" className="mb-btn mb-btn-outline w-full" onClick={() => { setQuery(current.title); setOpen(true); setError(""); }}><Search size={17} />Buscar dados do livro</button>
    <Modal open={open} onClose={close} title="Buscar informações do livro" description="Google Books e Open Library sugerem dados. Confira a obra ou edição e escolha os campos que deseja aplicar." size="lg">
      <div className="flex gap-2 mb-3"><input aria-label="Título ou ISBN" className="mb-input min-w-0 flex-1" placeholder="Título ou ISBN" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
        <button type="button" className="mb-btn mb-btn-primary" disabled={loading || query.trim().length < 2} onClick={() => void search()}>{loading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}Buscar</button></div>
      <label className="block text-xs text-[var(--text-3)] mb-3">Catálogo<select aria-label="Catálogo de metadados" className="mb-input mt-1" value={source} onChange={event => { active.current?.abort(); setSource(event.target.value as BookMetadata["source"]); setResults([]); setChosen(null); setLoading(false); setSearched(false); setError(""); }}><option value="google">Google Books — volumes e edições</option><option value="openlibrary">Open Library — informações da obra</option></select></label>
      {error && <p role="alert" className="text-sm text-[var(--destructive)] mb-3">{error}</p>}
      {loading && <p role="status" className="text-sm text-[var(--text-3)] my-4">Consultando o catálogo…</p>}
      {!chosen && <div className="max-h-80 overflow-y-auto space-y-2">{results.map(book => <button key={`${book.source}:${book.id}`} type="button" disabled={loading} onClick={() => void choose(book)} className="w-full text-left p-3 rounded-xl border border-[var(--line)] hover:bg-[var(--surface-2)]"><strong className="block text-sm">{book.title}</strong><span className="block text-xs text-[var(--text-3)]">{book.authors.join(" · ") || "Autor não informado"}{book.publishedYear && ` · ${book.publishedYear}`}</span><span className="block text-xs mt-1">{book.genres.join(" · ") || "Gêneros não informados"}</span></button>)}{searched && !results.length && !loading && !error && <p className="py-6 text-center text-sm">Nenhum resultado. Tente outro título, ISBN ou catálogo.</p>}</div>}
      {chosen && <div><a href={chosen.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center text-xs text-[var(--primary)] mb-3">Conferir fonte {chosen.isbn && ` · ISBN ${chosen.isbn}`}<ExternalLink size={12} /></a><div className="max-h-72 overflow-y-auto space-y-2">{Object.entries(FIELDS).map(([key, label]) => {
        const value = fieldsOf(chosen)[key as keyof MetadataForm]; if (!value) return null;
        return <label key={key} className="flex gap-3 p-3 rounded-xl bg-[var(--surface-2)] cursor-pointer"><input type="checkbox" checked={checked.includes(key)} onChange={event => setChecked(old => event.target.checked ? [...old, key] : old.filter(item => item !== key))} /><span className="min-w-0"><strong className="block text-xs">{label}</strong>{current[key as keyof MetadataForm] && <span className="block text-xs text-[var(--text-3)] line-clamp-2">Atual: {current[key as keyof MetadataForm]}</span>}<span className="block text-sm whitespace-pre-line">{value}</span></span></label>;
      })}</div><div className="flex justify-between gap-2 mt-4"><button type="button" className="mb-btn mb-btn-outline" onClick={() => setChosen(null)}>Voltar</button><button type="button" className="mb-btn mb-btn-primary" disabled={!checked.length || loading} onClick={() => { const values = fieldsOf(chosen); onApply(Object.fromEntries(checked.map(key => [key, values[key as keyof MetadataForm]])), chosen); close(); }}><Check size={17} />Aplicar selecionados</button></div></div>}
      <p className="text-[11px] text-[var(--text-3)] mt-4">A busca envia apenas título, autor ou ISBN ao catálogo. O arquivo do livro não é enviado.</p>
    </Modal>
  </>;
}
