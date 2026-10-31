import type { ImageCrop } from "./appearance";
import { API_BASE_URL } from "./config";
import { account, deviceResponse, isOffline, rememberResponse } from "./offline/device";
export interface Booklist { id: string; name: string; color: string; icon: string; imageUrl: string; imageWidth: number; imageHeight: number; crop: ImageCrop; bookIds: string[]; updatedAt: number }
export async function fetchBooklists(): Promise<Booklist[]> {
  if (!account()) return [];
  if (isOffline()) return await deviceResponse<Booklist[]>("/booklists") || [];
  const user = account();
  const response = await fetch(API_BASE_URL + "/booklists", { credentials: "include", headers: { "X-Offline-Account": user } });
  if (!response.ok) throw new Error("Não foi possível carregar suas Booklists.");
  const lists: Booklist[] = await response.json(); await rememberResponse("/booklists", lists, user).catch(() => {}); return lists;
}
export async function saveBooklist(value: Booklist, file?: File, removeCover = false) {
  if (isOffline()) throw new Error("Conecte-se para criar ou editar Booklists.");
  const body = new FormData(); body.set("config", JSON.stringify({ ...value, removeCover })); if (file) body.set("cover", file);
  const response = await fetch(API_BASE_URL + "/booklists" + (value.id ? "/" + encodeURIComponent(value.id) : ""), { method: value.id ? "PUT" : "POST", credentials: "include", body });
  if (!response.ok) throw new Error((await response.json()).error || "Não foi possível salvar a Booklist.");
  return response.json() as Promise<Booklist>;
}
export async function deleteBooklist(id: string) {
  if (isOffline()) throw new Error("Conecte-se para excluir Booklists.");
  const response = await fetch(API_BASE_URL + "/booklists/" + encodeURIComponent(id), { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível excluir a Booklist.");
}
