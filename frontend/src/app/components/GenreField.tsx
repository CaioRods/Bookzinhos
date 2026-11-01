import { useState } from "react";
import { BOOK_GENRES, bookGenres, hasBookGenre, mergeCustomGenre } from "../lib/genres";

export function GenreField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = bookGenres(value);
  const [custom, setCustom] = useState("");
  const choices: string[] = [...BOOK_GENRES];
  selected.forEach(genre => { if (!choices.some(item => item.toLocaleLowerCase("pt-BR") === genre.toLocaleLowerCase("pt-BR"))) choices.push(genre); });
  const update = (genres: string[]) => onChange(genres.join(", "));
  const toggle = (genre: string) => update(hasBookGenre(value, genre) ? selected.filter(item => item.toLocaleLowerCase("pt-BR") !== genre.toLocaleLowerCase("pt-BR")) : genre === "Outros" ? [genre] : [...selected.filter(item => item !== "Outros"), genre]);
  const addCustom = () => {
    if (!custom.trim()) return;
    update(mergeCustomGenre(selected.filter(item => item !== "Outros"), custom));
    setCustom("");
  };
  return <fieldset><legend className="mb-label">Gêneros</legend>
    <p className="text-[12px] text-[var(--text-3)] mb-2">Selecione todos os gêneros que se aplicam ao livro.</p>
    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">{choices.map(genre => <button key={genre} type="button" aria-pressed={hasBookGenre(value, genre)} onClick={() => toggle(genre)} className={`mb-btn mb-btn-sm ${hasBookGenre(value, genre) ? "mb-btn-primary" : "mb-btn-outline"}`}>{genre}</button>)}</div>
    <div className="flex gap-2 mt-2"><input aria-label="Outro gênero" className="mb-input min-w-0 flex-1" value={custom} maxLength={40} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }} placeholder="Adicionar outro gênero" />
      <button type="button" className="mb-btn mb-btn-outline" disabled={!custom.trim()} onClick={addCustom}>Adicionar</button></div>
  </fieldset>;
}
