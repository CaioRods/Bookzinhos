import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
export function GlobalSearch() {
  const [term, setTerm] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { setTerm(new URLSearchParams(location.search).get("q") || ""); }, [location.pathname, location.search]);
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if (!input.current?.getClientRects().length) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);
  return <form role="search" className="mb-global-search" onSubmit={event => { event.preventDefault(); navigate(`/library?q=${encodeURIComponent(term.trim())}`); }}>
    <Search size={18} aria-hidden="true" />
    <input ref={input} value={term} onChange={event => setTerm(event.target.value)} placeholder="Livros, autores ou gêneros…" aria-label="Buscar em toda a biblioteca" />
    <kbd aria-hidden="true">⌘ K</kbd>
  </form>;
}
