import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { SCENES } from "./scenery";
import { CENTER_CROP, type SceneTheme } from "./appearance";
import { fetchThemes } from "./appearanceApi";
import { getUsername } from "./session";
export const NO_THEME: SceneTheme = { id: "none", name: "Sem tema", scope: "system", imageUrl: "", width: 1536, height: 1024, atlas: null, mainColor: "#64344f", profile: { ...CENTER_CROP }, sidebar: { ...CENTER_CROP }, sidebarOpacity: 0 };
export const DEFAULT_THEMES: SceneTheme[] = [NO_THEME, ...SCENES.map(scene => ({ id: scene.id, name: scene.name, scope: "system" as const, imageUrl: "/scenery/landscapes.webp", width: 1536, height: 1024, atlas: { column: scene.column, row: scene.row }, mainColor: "#64344f", profile: { ...CENTER_CROP }, sidebar: { ...CENTER_CROP }, sidebarOpacity: .75 }))];
const Context = createContext<{ themes: SceneTheme[]; loading: boolean; error: string; refresh: () => Promise<void>; upsert: (theme: SceneTheme) => void; remove: (id: string) => void }>({ themes: DEFAULT_THEMES, loading: true, error: "", refresh: async () => {}, upsert: () => {}, remove: () => {} });
function merged(records: SceneTheme[]) {
  const map = new Map(DEFAULT_THEMES.map(theme => [theme.id, theme]));
  records.forEach(theme => map.set(theme.id, theme));
  return [...map.values()];
}
export function ThemeCatalogProvider({ children }: { children: ReactNode }) {
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const [username, setUsername] = useState(getUsername);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const identity = getUsername(); setLoading(true);
    try { const records = await fetchThemes(); if (getUsername() === identity) { setThemes(merged(records)); setError(""); } }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível carregar os temas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const sync = () => setUsername(getUsername()); window.addEventListener("mybooks:session", sync); window.addEventListener("storage", sync); return () => { window.removeEventListener("mybooks:session", sync); window.removeEventListener("storage", sync); }; }, []);
  useEffect(() => {
    let alive = true; setLoading(true); setThemes(DEFAULT_THEMES);
    fetchThemes().then(records => { if (alive) { setThemes(merged(records)); setError(""); } }).catch(error => { if (alive) setError(error.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [username]);
  useEffect(() => { const refreshOnFocus = () => { if (document.visibilityState === "visible") refresh(); }; window.addEventListener("focus", refreshOnFocus); const timer = window.setInterval(refreshOnFocus, 45000); return () => { window.removeEventListener("focus", refreshOnFocus); window.clearInterval(timer); }; }, [refresh]);
  return <Context.Provider value={{ themes, loading, error, refresh, upsert: theme => setThemes(current => merged([...current.filter(entry => entry.id !== theme.id), theme])), remove: id => setThemes(current => merged(current.filter(theme => theme.id !== id))) }}>{children}</Context.Provider>;
}
export const useThemeCatalog = () => useContext(Context);
