import { useSyncExternalStore } from "react";
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: InstallEvent | null = null;
const standalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
let state = { available: false, installed: !!standalone(), busy: false, error: "" };
const listeners = new Set<() => void>();
function update(patch: Partial<typeof state>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferred = event as InstallEvent; update({ available: true, installed: false, error: "" }); });
  window.addEventListener("appinstalled", () => { deferred = null; update({ installed: true, available: false, busy: false }); });
}
export function useAppInstallation() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state); }
export async function installApp() {
  const prompt = deferred;
  if (!prompt || state.busy) return false;
  update({ busy: true, error: "" });
  try { await prompt.prompt(); const choice = await prompt.userChoice; if (deferred === prompt) deferred = null; update({ available: !!deferred, installed: state.installed || choice.outcome === "accepted" }); return choice.outcome === "accepted"; }
  catch { update({ error: "Não foi possível abrir a instalação. Tente pelo menu do Chrome." }); return false; }
  finally { update({ busy: false }); }
}
