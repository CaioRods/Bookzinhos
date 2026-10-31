import { useEffect, useState } from "react";
import { account, cancelInstall, DEVICE_EVENT, deviceChanged, installedBook, installBook, isOffline } from "./device";
export interface BatchState { total: number; completed: number; current?: string; failed: string[]; running: boolean; cancelled: boolean }
const batches = new Map<string, BatchState>();
export function useBooklistInstall(id: string) {
  const [state, setState] = useState<BatchState | undefined>();
  useEffect(() => { const update = () => { const value = batches.get(`${account()}:${id}`); setState(value ? { ...value } : undefined); }; update(); window.addEventListener(DEVICE_EVENT, update); return () => window.removeEventListener(DEVICE_EVENT, update); }, [id]);
  return state;
}
export function stopBooklistInstall(id: string) { const state = batches.get(`${account()}:${id}`); if (state) { state.cancelled = true; if (state.current) cancelInstall(state.current); deviceChanged(); } }
export async function installBooklist(id: string, bookIds: string[]) {
  const user = account(), key = `${user}:${id}`;
  if (isOffline()) throw new Error("Conecte-se para instalar os livros da Booklist.");
  if (batches.get(key)?.running) return;
  const state: BatchState = { total: bookIds.length, completed: 0, failed: [], running: true, cancelled: false }; batches.set(key, state); deviceChanged();
  try {
    for (const bookId of bookIds) {
      if (state.cancelled || account() !== user || isOffline()) break;
      state.current = bookId; deviceChanged();
      try { if (!await installedBook(bookId)) await installBook(bookId); if (!await installedBook(bookId)) throw new Error("Não instalado"); }
      catch { if (!state.cancelled) state.failed.push(bookId); }
      if (state.cancelled) break;
      state.completed++; deviceChanged();
    }
  } finally { state.running = false; state.current = undefined; deviceChanged(); }
}
