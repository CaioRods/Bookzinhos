import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { fetchCharacters } from "../lib/api";
import { getFullUrl, type CharacterCatalog } from "../lib/types";
import { Skeleton } from "./Ui";

export function CharacterPicker({ value, onChange }: { value?: string; onChange: (imageUrl: string) => void }) {
  const [catalog, setCatalog] = useState<CharacterCatalog>({ characters: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  useEffect(() => { fetchCharacters().then(setCatalog).finally(() => setLoading(false)); }, []);
  const groups = useMemo(() => catalog.groups.map((group) => ({
    ...group,
    characters: group.characterIds.map((id) => catalog.characters.find((character) => character.id === id)).filter(Boolean).filter((character) => `${character!.name} ${group.seriesName} ${group.books.map((book) => book.title).join(" ")}`.toLowerCase().includes(query.toLowerCase())),
  })).filter((group) => group.characters.length), [catalog, query]);
  return <div className="space-y-4">
    <label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" /><input className="mb-input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Personagem, livro ou saga" /></label>
    {loading ? <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="aspect-square rounded-full" />)}</div> : catalog.characters.length === 0 ? <p className="text-sm text-[var(--text-3)] text-center py-8">O admin ainda não adicionou personagens.</p> : groups.map((group) => <section key={group.id}><h3 className="text-xs font-semibold text-[var(--text-2)] mb-1 flex items-center gap-1.5"><BookOpen size={13} /> {group.seriesName}</h3>{group.books.length > 0 && <p className="text-[10px] text-[var(--text-3)] mb-2">{group.books.map((book) => book.title).join(" · ")}</p>}<div className="grid grid-cols-4 sm:grid-cols-6 gap-3">{group.characters.map((character) => <button type="button" key={character!.id} onClick={() => onChange(character!.imageUrl)} className="group text-center"><span className={`block aspect-square rounded-full overflow-hidden border-2 ${value === character!.imageUrl ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20" : "border-[var(--line)]"}`}><img src={getFullUrl(character!.imageUrl) || character!.imageUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" /></span><span className="block text-[10px] mt-1 truncate text-[var(--text-2)]">{character!.name}</span></button>)}</div></section>)}
  </div>;
}
