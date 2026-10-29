/**
 * Sessão local do usuário.
 *
 * O servidor identifica quem está logado pelo header `x-user-id`; aqui ficam os
 * dados que a interface precisa ler sem ida ao servidor (nome, avatar, se é a
 * conta Admin). Um único lugar para ler e gravar isso.
 */

import type { UserProfile } from "./types";

const KEYS = {
  username: "books-username",
  displayName: "books-display-name",
  bio: "books-bio",
  avatar: "books-avatar",
  admin: "books-is-admin",
  shelf: "profile-shelf",
} as const;

/** Flag de "entrar sem conta": navega e vê tudo, mas não age. */
const GUEST_KEY = "mybooks-guest";

/** Está navegando como visitante (sem conta, mas escolheu entrar assim). */
export function isGuest(): boolean {
  return !getUsername() && localStorage.getItem(GUEST_KEY) === "1";
}

export function enterGuestMode(): void {
  localStorage.setItem(GUEST_KEY, "1");
  notifySessionChanged();
}

/** Sai do modo visitante — a AuthWrapper volta a mostrar a tela de entrada. */
export function leaveGuestMode(): void {
  localStorage.removeItem(GUEST_KEY);
  notifySessionChanged();
}

export function getUsername(): string | null {
  const value = localStorage.getItem(KEYS.username);
  return value && value !== "anonymous" ? value : null;
}

export function getAvatar(): string {
  return localStorage.getItem(KEYS.avatar) || "🐼";
}

export function getDisplayName(): string {
  return localStorage.getItem(KEYS.displayName) || getUsername() || "Leitora";
}

export function getBio(): string {
  return localStorage.getItem(KEYS.bio) || "";
}

export function isAdmin(): boolean {
  return localStorage.getItem(KEYS.admin) === "true";
}

export function getShelf(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.shelf);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(user: Partial<UserProfile> & { username: string }): void {
  localStorage.removeItem(GUEST_KEY); // entrar de verdade encerra o modo visitante
  localStorage.setItem(KEYS.username, user.username);
  localStorage.setItem(KEYS.displayName, user.displayName || user.username);
  if (user.bio != null) localStorage.setItem(KEYS.bio, user.bio);
  if (user.avatar != null) localStorage.setItem(KEYS.avatar, user.avatar);
  localStorage.setItem(KEYS.admin, String(!!user.isAdmin));
  if (user.shelf) localStorage.setItem(KEYS.shelf, JSON.stringify(user.shelf));
  if (user.themeId !== undefined) {
    try {
      const settings = JSON.parse(localStorage.getItem("mybooks-settings") || "{}");
      localStorage.setItem("mybooks-settings", JSON.stringify({ ...settings, scene: user.themeId || "none" }));
      window.dispatchEvent(new CustomEvent("mybooks:settings"));
    } catch { /* preferências inválidas serão restauradas pela tela de configurações */ }
  }
  notifySessionChanged();
}

export function clearSession(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(GUEST_KEY);
}

/** Dispara um evento para que o layout atualize avatar/nome sem recarregar. */
export function notifySessionChanged(): void {
  window.dispatchEvent(new CustomEvent("mybooks:session"));
}
