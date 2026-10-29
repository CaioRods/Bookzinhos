import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { fetchCharacters } from "../lib/api";
import { getFullUrl, type CharacterAvatar } from "../lib/types";
import { Skeleton } from "./Ui";

export function CharacterPicker({ value, onChange }: { value?: string; onChange: (imageUrl: string) => void }) {
  const [items, setItems] = useState<CharacterAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  useEffect(() => { fetchCharacters().then(setItems).finally(() => setLoading(false)); }, []);
  const grouped = useMemo(() => {
    const filtered = items.filter((item) => `${item.name} ${item.bookTitle || ""}`.toLowerCase().includes(query.toLowerCase()));
    return filtered.reduce((groups, item) => {
      const key = item.bookTitle || "Outros personagens";
      groups.set(key, [...(groups.get(key) || []), item]);
      return groups;
    }, new Map<string, CharacterAvatar[]>());
  }, [items, query]);
  return <div className="space-y-4">
    <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" /><input className="mb-input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Personagem ou livro" /></label>
    {loading ? <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="aspect-square rounded-full" />)}</div> : items.length === 0 ? <p className="text-sm text-[var(--text-3)] text-center py-8">O admin ainda não adicionou personagens.</p> :
      [...grouped].map(([book, characters]) => <section key={book}><h3 className="text-xs font-semibold text-[var(--text-2)] mb-2 flex items-center gap-1.5"><BookOpen size={13} /> {book}</h3><div className="grid grid-cols-4 sm:grid-cols-6 gap-3">{characters.map((character) => <button type="button" key={character.id} onClick={() => onChange(character.imageUrl)} className="group text-center"><span className={`block aspect-square rounded-full overflow-hidden border-2 ${value === character.imageUrl ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20" : "border-[var(--line)]"}`}><img src={getFullUrl(character.imageUrl) || character.imageUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" /></span><span className="block text-[10px] mt-1 truncate text-[var(--text-2)]">{character.name}</span></button>)}</div></section>)}
  </div>;
}
