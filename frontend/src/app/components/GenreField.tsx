import { useState } from "react";
import { BOOK_GENRES } from "../lib/genres";

export function GenreField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const known = BOOK_GENRES.some((genre) => genre === value);
  const [custom, setCustom] = useState(known ? "" : value);
  const showCustom = value === "Outros" || !known;
  return <div><span className="mb-label">Gênero</span><div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">{BOOK_GENRES.map((genre) => <button key={genre} type="button" onClick={() => onChange(genre)} className={`mb-btn mb-btn-sm ${value === genre ? "mb-btn-primary" : "mb-btn-outline"}`}>{genre}</button>)}</div>{showCustom && <input className="mb-input mt-2" value={custom} maxLength={40} onChange={(event) => { setCustom(event.target.value); onChange(event.target.value || "Outros"); }} placeholder="Digite o gênero" />}</div>;
}
