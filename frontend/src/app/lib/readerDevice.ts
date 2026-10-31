import { getUsername } from "./session";
export interface PagePreset { zoom: number; x: number; y: number }
export interface ReaderPresets { single: PagePreset; double: PagePreset }
const key = () => `mybooks:reader-presets:${(getUsername() || "guest").toLowerCase()}`;
export const tutorialKey = (username = getUsername() || "guest") => `mybooks:reader-tutorial:${username.toLowerCase()}`;
export const defaultPreset = (): PagePreset => ({ zoom: 1, x: 0, y: 0 });
export function sanitizePreset(value?: Partial<PagePreset>): PagePreset {
  const bound = (n: unknown, fallback: number, low: number, high: number) => Number.isFinite(Number(n)) ? Math.max(low, Math.min(high, Number(n))) : fallback;
  return { zoom: bound(value?.zoom, 1, .5, 3), x: bound(value?.x, 0, -1, 1), y: bound(value?.y, 0, -1, 1) };
}
export function loadReaderPresets(): ReaderPresets {
  try { const value = JSON.parse(localStorage.getItem(key()) || "{}"); return { single: sanitizePreset(value.single), double: sanitizePreset(value.double) }; }
  catch { return { single: defaultPreset(), double: defaultPreset() }; }
}
export function saveReaderPresets(value: ReaderPresets) { localStorage.setItem(key(), JSON.stringify({ single: sanitizePreset(value.single), double: sanitizePreset(value.double) })); }
export function hasSeenReaderTutorial() { return localStorage.getItem(tutorialKey()) === "true"; }
export function rememberReaderTutorial() { localStorage.setItem(tutorialKey(), "true"); }
