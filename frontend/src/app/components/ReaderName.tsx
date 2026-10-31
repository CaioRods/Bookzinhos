import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAllUsers } from "../lib/api";
import { getDisplayName, getUsername } from "../lib/session";

const NamesContext = createContext<Record<string, string>>({});
export function ReaderNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<Record<string, string>>(() => { const own = getUsername(); return own ? { [own.toLowerCase()]: getDisplayName() } : {}; });
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      const username = getUsername();
      if (username) setNames(previous => ({ ...previous, [username.toLowerCase()]: getDisplayName() }));
      fetchAllUsers().then(users => {
        if (!alive || !Array.isArray(users)) return;
        const next = Object.fromEntries(users.map(user => [user.username.toLowerCase(), user.displayName || user.username]));
        const own = getUsername(); if (own) next[own.toLowerCase()] = getDisplayName();
        setNames(next);
      }).catch(() => {});
    };
    refresh(); window.addEventListener("mybooks:session", refresh); window.addEventListener("storage", refresh); window.addEventListener("mybooks:privacy-accepted", refresh);
    return () => { alive = false; window.removeEventListener("mybooks:session", refresh); window.removeEventListener("storage", refresh); window.removeEventListener("mybooks:privacy-accepted", refresh); };
  }, []);
  return <NamesContext.Provider value={names}>{children}</NamesContext.Provider>;
}
export function ReaderName({ username }: { username?: string | null }) {
  const names = useContext(NamesContext);
  return <>{username ? names[username.toLowerCase()] || username : "Leitor"}</>;
}
