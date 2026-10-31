import { useEffect, useState } from "react";
import { getUsername } from "../session";
import { API_BASE_URL } from "../config";
import { getFullUrl, type Book, type ReadingProgress, type Note, type UserProfile, type BookChapter } from "../types";
import { read, rows, write } from "./db";
const recordReads = new Map<string, Promise<InstalledBook[]>>();
export const DEVICE_EVENT = "mybooks:device";
let disconnected = typeof navigator !== "undefined" && !navigator.onLine;
export const isOffline = () => disconnected || !navigator.onLine;
export function deviceChanged() { recordReads.clear(); window.dispatchEvent(new Event(DEVICE_EVENT)); }
export function connectionLost() { if (!disconnected) { disconnected = true; deviceChanged(); window.dispatchEvent(new Event("mybooks:offline-data")); } }
export function connectionRestored() { if (disconnected) { disconnected = false; deviceChanged(); window.dispatchEvent(new Event("mybooks:offline-data")); } }
export function account() { return getUsername()?.toLowerCase() || ""; }
const prefix = (user: string, kind: string) => `${user}::${kind}::`;
export const deviceKey = (user: string, kind: string, id = "") => prefix(user, kind) + id;
export function useOffline() {
  const [offline, setOffline] = useState(isOffline);
  useEffect(() => { const sync = () => setOffline(isOffline()); window.addEventListener(DEVICE_EVENT, sync); window.addEventListener("offline", sync); window.addEventListener("online", sync); return () => { window.removeEventListener(DEVICE_EVENT, sync); window.removeEventListener("offline", sync); window.removeEventListener("online", sync); }; }, []);
  return offline;
}
export interface InstalledBook { book: Book; pdf?: Blob; cover?: Blob; chapters: BookChapter[]; bytes: number; installedAt: number }
export interface DownloadState { loaded: number; total: number; percent: number | null; error?: string }
const downloads = new Map<string, DownloadState>(), controllers = new Map<string, AbortController>();
const urls = new Map<string, string>();
export async function installedRecords(user = account()) { if (!user) return []; if (!recordReads.has(user)) recordReads.set(user, rows<InstalledBook>(prefix(user, "book")).then(items => items.map(row => row.value))); return recordReads.get(user)!; }
function blobUrl(key: string, blob: Blob) { if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob)); return urls.get(key)!; }
function hydrate(record: InstalledBook, user: string): Book {
  return { ...record.book, pdfPath: record.pdf ? blobUrl(`${user}:${record.book.id}:pdf`, record.pdf) : record.book.pdfPath, coverImagePath: record.cover ? blobUrl(`${user}:${record.book.id}:cover`, record.cover) : record.book.coverImagePath };
}
export async function installedBooks(user = account()) { return (await installedRecords(user)).map(row => hydrate(row, user)); }
export async function installedBook(id: string, user = account()) { const record = user ? await read<InstalledBook>(deviceKey(user, "book", id)) : undefined; return record ? hydrate(record, user) : null; }
export async function installedPdf(id: string) { return (await read<InstalledBook>(deviceKey(account(), "book", id)))?.pdf; }
export async function installedChapters(id: string) { return (await read<InstalledBook>(deviceKey(account(), "book", id)))?.chapters || []; }
export function cancelOtherAccountInstalls() { const user = account(); for (const [key, controller] of controllers) if (!user || !key.startsWith(user + ":")) controller.abort(); }
export function cancelInstall(id: string) { controllers.get(`${account()}:${id}`)?.abort(); }
export async function removeInstalled(id: string) {
  const user = account(); await write([], [deviceKey(user, "book", id)]);
  for (const suffix of ["pdf", "cover"]) { const key = `${user}:${id}:${suffix}`, url = urls.get(key); if (url) URL.revokeObjectURL(url); urls.delete(key); }
  deviceChanged(); window.dispatchEvent(new Event("mybooks:offline-data"));
}
export function useInstalled(id?: string) {
  const [state, setState] = useState<{ ids: Set<string>; download?: DownloadState }>({ ids: new Set() });
  useEffect(() => { let active = true; const sync = () => { const user = account(); void installedRecords(user).then(records => { if (active && account() === user) setState({ ids: new Set(records.map(row => row.book.id)), download: id ? downloads.get(`${user}:${id}`) : undefined }); }).catch(() => {}); }; sync(); window.addEventListener(DEVICE_EVENT, sync); window.addEventListener("mybooks:session", sync); return () => { active = false; window.removeEventListener(DEVICE_EVENT, sync); window.removeEventListener("mybooks:session", sync); }; }, [id]);
  return state;
}
async function fetchBlob(url: string, signal: AbortSignal, onProgress?: (loaded: number, total: number) => void) {
  const response = await fetch(url, { signal });
  if (!response.ok || response.type === "opaque") throw new Error("Não foi possível baixar o arquivo para o aparelho.");
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) return response.blob();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let loaded = 0;
  while (true) { const next = await reader.read(); if (next.done) break; chunks.push(next.value); loaded += next.value.byteLength; onProgress?.(loaded, total); }
  if (!loaded) throw new Error("O arquivo do livro está vazio.");
  return new Blob(chunks as BlobPart[], { type: response.headers.get("content-type") || "application/pdf" });
}
const activeInstalls = new Map<string, Promise<void>>();
export function installBook(id: string): Promise<void> {
  const key = `${account()}:${id}`, active = activeInstalls.get(key); if (active) return active;
  const task = installBookNow(id).finally(() => activeInstalls.delete(key)); activeInstalls.set(key, task); return task;
}
async function installBookNow(id: string) {
  const user = account(); if (!user) throw new Error("Entre na conta para instalar livros.");
  if (isOffline()) throw new Error("Conecte-se à internet para instalar este livro.");
  const key = `${user}:${id}`; if (controllers.has(key)) return;
  const controller = new AbortController(); controllers.set(key, controller);
  downloads.set(key, { loaded: 0, total: 0, percent: null }); deviceChanged();
  try {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("A instalação do app ainda está sendo preparada. Aguarde um momento e tente novamente.")), 30000))]);
    }
    const [bookResponse, chapterResponse] = await Promise.all([fetch(`${API_BASE_URL}/books/${encodeURIComponent(id)}`, { credentials: "include", headers: { "X-Offline-Account": user }, signal: controller.signal }), fetch(`${API_BASE_URL}/books/${encodeURIComponent(id)}/chapters`, { credentials: "include", headers: { "X-Offline-Account": user }, signal: controller.signal })]);
    if (!bookResponse.ok) throw new Error("Livro indisponível ou acesso não autorizado.");
    const book: Book = await bookResponse.json(), chapters: BookChapter[] = chapterResponse.ok ? await chapterResponse.json() : [];
    if (!book.pdfPath && !book.pages?.length) throw new Error("Este livro ainda não possui conteúdo para instalar.");
    for (const path of [`/progress/${id}`, `/notes/book/${id}`, "/saved"]) {
      try { const response = await fetch(API_BASE_URL + path, { credentials: "include", headers: { "X-Offline-Account": user }, signal: controller.signal }); if (response.ok) await rememberResponse(path, await response.json(), user); } catch (error) { if (controller.signal.aborted) throw error; }
    }
    const estimate = await navigator.storage?.estimate?.();
    const pdf = book.pdfPath ? await fetchBlob(getFullUrl(book.pdfPath)!, controller.signal, (loaded, total) => { downloads.set(key, { loaded, total, percent: total ? Math.min(99, Math.round(loaded / total * 100)) : null }); deviceChanged(); }) : undefined;
    if (pdf && !(await pdf.slice(0,1024).text()).includes("%PDF-")) throw new Error("O arquivo recebido não é um PDF válido. Tente instalar novamente.");
    const cover = book.coverImagePath ? await fetchBlob(getFullUrl(book.coverImagePath)!, controller.signal).catch(error => { if (controller.signal.aborted) throw error; return undefined; }) : undefined;
    const bytes = (pdf?.size || 0) + (cover?.size || 0) + JSON.stringify(book).length;
    if (estimate?.quota && bytes > estimate.quota - (estimate.usage || 0)) throw new Error("Espaço insuficiente no aparelho. Remova um livro instalado e tente novamente.");
    if (controller.signal.aborted) throw new DOMException("Instalação cancelada.", "AbortError");
    if (account() !== user) throw new Error("A conta mudou durante a instalação. Tente novamente.");
    // The installed marker and all content become visible in one atomic transaction.
    await write([{ key: deviceKey(user, "book", id), value: { book, pdf, cover, chapters, bytes, installedAt: Date.now() } satisfies InstalledBook }]);
    void navigator.storage?.persist?.(); downloads.delete(key); window.dispatchEvent(new Event("mybooks:offline-data"));
  } catch (error) {
    downloads.set(key, { loaded: 0, total: 0, percent: null, error: error instanceof DOMException && error.name === "QuotaExceededError" ? "Sem espaço no aparelho." : error instanceof Error && error.name === "AbortError" ? "Instalação cancelada." : error instanceof Error ? error.message : "Falha na instalação." });
    throw error;
  } finally { controllers.delete(key); deviceChanged(); }
}
export const snapshotKey = (user: string, path: string) => deviceKey(user, "snapshot", path);
export async function rememberSession(profile: UserProfile) { if (typeof indexedDB !== "undefined") await write([{ key: deviceKey(profile.username.toLowerCase(), "session"), value: profile }]); }
export async function deviceSession() { const user = account(); return user ? await read<UserProfile>(deviceKey(user, "session")) || null : null; }
const cacheable = (path: string) => /^\/(progress(?:\/|$)|saved$|notes\/book\/|booklists$)/.test(path);
export async function rememberResponse(path: string, value: unknown, user = account()) {
  if (!user || !cacheable(path)) return;
  const pending = await pendingMutations(user);
  // A slow network response must not replace edits made locally while it was in flight.
  if (path === "/progress") {
    const byBook = new Map(((value || []) as ReadingProgress[]).map(item => [item.bookId, item]));
    pending.filter(item => item.path.startsWith("/progress/")).forEach(item => byBook.set(item.body.bookId, item.body)); value = [...byBook.values()];
  } else if (path.startsWith("/progress/")) {
    const local = pending.find(item => item.path === path); if (local) value = local.body;
  } else if (path === "/saved") {
    const ids = new Set((value || []) as string[]); pending.filter(item => item.path.startsWith("/saved/")).forEach(item => { const id = decodeURIComponent(item.path.slice(7)); if (item.method === "POST") ids.add(id); else ids.delete(id); }); value = [...ids];
  } else if (path.startsWith("/notes/book/")) {
    const local = await deviceResponse<Note[]>(path, user) || [], notes = new Map(((value || []) as Note[]).map(note => [note.id, note]));
    for (const item of pending) {
      if (item.path === "/notes" && item.body.bookId === path.slice(12)) { const note = local.find(note => note.id === item.body.clientId); if (note) notes.set(note.id, note); }
      if (item.method === "DELETE" && item.path.startsWith("/notes/")) notes.delete(decodeURIComponent(item.path.slice(7)));
    }
    value = [...notes.values()].sort((a,b) => b.createdAt-a.createdAt);
  }
  await write([{ key: snapshotKey(user, path), value }]);
}
export async function deviceResponse<T>(path: string, user = account()): Promise<T | undefined> { return user ? read<T>(snapshotKey(user, path)) : undefined; }
export interface PendingMutation { id: string; revision: string; user: string; method: string; path: string; body?: any; at: number; error?: string }
export async function pendingMutations(user = account()) { return user ? (await rows<PendingMutation>(prefix(user, "queue"))).map(row => row.value).sort((a,b) => a.at-b.at) : []; }
export async function queueMutation<T>(method: string, path: string, body?: any): Promise<T> {
  const user = account(); if (!user) throw new Error("Entre na conta antes de usar o modo offline.");
  let value: any, snapshots: { key: string; value: unknown }[] = [], stable = path;
  if (method === "PUT" && path.startsWith("/progress/")) {
    const bookId = decodeURIComponent(path.slice(10)); if (!await installedBook(bookId)) throw new Error("Instale este livro antes de usá-lo offline.");
    const previous = await deviceResponse<ReadingProgress>(path); value = { currentPage: 0, totalPages: 1, progress: 0, status: "lendo", startedAt: Date.now(), ...previous, ...body, lastReadAt: Date.now(), _offlineRecordedAt: Date.now() };
    const all = await deviceResponse<ReadingProgress[]>("/progress") || [];
    snapshots = [{ key: snapshotKey(user, path), value }, { key: snapshotKey(user, "/progress"), value: [value, ...all.filter(item => item.bookId !== bookId)] }]; body = value;
  } else if (/^\/saved\/[^/]+$/.test(path) && ["POST", "DELETE"].includes(method)) {
    const bookId = decodeURIComponent(path.slice(7)); const saved = await deviceResponse<string[]>("/saved") || [];
    value = { saved: method === "POST" }; snapshots = [{ key: snapshotKey(user, "/saved"), value: value.saved ? [...new Set([...saved, bookId])] : saved.filter(id => id !== bookId) }];
  } else if (method === "POST" && path === "/notes") {
    if (!await installedBook(body.bookId)) throw new Error("Instale este livro para escrever no diário offline.");
    const id = body.clientId || `offline-${crypto.randomUUID()}`; body = { ...body, clientId: id }; stable += "/" + id;
    value = { id, ...body, username: getUsername(), date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), createdAt: Date.now() };
    const notesPath = `/notes/book/${body.bookId}`, notes = await deviceResponse<Note[]>(notesPath) || [];
    snapshots = [{ key: snapshotKey(user, notesPath), value: [value, ...notes] }];
  } else if (method === "DELETE" && path.startsWith("/notes/")) {
    const id = decodeURIComponent(path.slice(7));
    for (const row of await rows<Note[]>(prefix(user, "snapshot") + "/notes/book/")) snapshots.push({ key: row.key, value: row.value.filter(note => note.id !== id) });
    value = undefined;
  } else throw new Error("Esta ação precisa de conexão para validar suas permissões. Conecte-se e tente novamente.");
  const mutation: PendingMutation = { id: stable, revision: crypto.randomUUID(), user, method, path, body, at: Date.now() };
  await write([...snapshots, { key: deviceKey(user, "queue", stable), value: mutation }]); deviceChanged(); return value;
}
let syncing: Promise<void> | undefined;
export const syncState = { user: "", busy: false, error: "" };
export function synchronize() {
  return syncing ||= syncNow().finally(() => { syncing = undefined; });
}
async function syncNow() {
  const user = account(); if (!user || isOffline()) return;
  if (!(await pendingMutations(user)).length) return;
  syncState.user = user; syncState.busy = true; syncState.error = ""; deviceChanged();
  try {
    const session = await fetch(`${API_BASE_URL}/auth/session`, { credentials: "include" });
    if (!session.ok) throw new Error("Entre novamente na mesma conta para sincronizar suas leituras.");
    const profile: UserProfile = await session.json();
    if (profile.username.toLowerCase() !== user || account() !== user) throw new Error("As alterações aguardam a conta que as criou.");
    await rememberSession(profile);
    for (const mutation of await pendingMutations(user)) {
      if (account() !== user || isOffline()) break;
      const response = await fetch(API_BASE_URL + mutation.path, { method: mutation.method, credentials: "include", headers: { "Content-Type": "application/json", "X-Offline-Account": user }, body: mutation.body === undefined ? undefined : JSON.stringify(mutation.body) });
      if (!response.ok) throw new Error(response.status === 401 ? "Entre novamente para sincronizar." : "Uma alteração aguarda validação do servidor. Tente sincronizar novamente.");
      // Do not erase a newer edit queued while this request was in flight.
      const key = deviceKey(user, "queue", mutation.id), current = await read<PendingMutation>(key);
      if (current?.revision === mutation.revision) await write([], [key]);
    }
    window.dispatchEvent(new Event("mybooks:synced"));
  } catch (error) { syncState.error = error instanceof Error ? error.message : "Não foi possível sincronizar."; }
  finally { syncState.busy = false; deviceChanged(); }
}
