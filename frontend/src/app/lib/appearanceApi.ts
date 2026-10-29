import { API_BASE_URL } from "./config";
import { invalidate } from "./api";
import type { BookAppearance, SceneTheme } from "./appearance";
async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: "include", cache: "no-store", headers: { ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || (response.status === 404 ? "Atualize a API do servidor para habilitar a personalização." : "Não foi possível salvar a personalização."));
  return data;
}
export const fetchThemes = () => call<SceneTheme[]>("/appearance/themes");
export const fetchProfileTheme = (username: string) => call<SceneTheme | { id: string }>(`/appearance/profile/${encodeURIComponent(username)}`);
export const saveProfileTheme = (themeId: string) => call<{ themeId: string }>("/appearance/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themeId }) });
export async function saveTheme(theme: SceneTheme, scope: "personal" | "system", image?: File | null): Promise<SceneTheme> {
  const form = new FormData(); form.set("id", theme.id); form.set("scope", scope); form.set("config", JSON.stringify(theme));
  if (image) form.set("image", image);
  return call("/appearance/themes", { method: "POST", body: form });
}
export const deleteTheme = (id: string) => call(`/appearance/themes/${encodeURIComponent(id)}`, { method: "DELETE" });
export type ThemeSubmission = { id: string; theme_id?: string; themeId?: string; owner: string; theme_data?: string; themeData?: SceneTheme; status: string; updated_at?: number };
export const submitTheme = (id: string) => call<ThemeSubmission>(`/appearance/themes/${encodeURIComponent(id)}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
export const fetchThemeSubmissions = () => call<ThemeSubmission[]>("/admin/theme-submissions?status=pending");
export const decideThemeSubmission = (id: string, decision: "approved" | "rejected" | "changes_requested", reason = "") => call(`/admin/theme-submissions/${encodeURIComponent(id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason }) });
export async function saveBookAppearance(id: string, config: BookAppearance, image?: File | null): Promise<BookAppearance> {
  const form = new FormData(); form.set("config", JSON.stringify(config)); if (image) form.set("image", image);
  const result = await call<BookAppearance>(`/books/${encodeURIComponent(id)}/appearance`, { method: "PUT", body: form });
  invalidate("/books", "/home"); return result;
}
