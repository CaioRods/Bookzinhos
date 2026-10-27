import { validScene, DEFAULT_SCENE, type SceneId } from "./scenery";
import { useCallback, useEffect, useState } from "react";

/**
 * Preferências do app.
 *
 * Ficam neste aparelho, de propósito: tema e permissão de notificação são
 * coisas do navegador, não da conta. O servidor guarda os avisos de todo mundo;
 * o que cada um escolhe ver é decidido aqui.
 */

export type ThemeChoice = "sistema" | "claro" | "escuro";

export type NotificationKind = "mensagem" | "curtida" | "resposta" | "seguidor" | "mural";

export interface Settings {
  theme: ThemeChoice;
  scene: SceneId;
  /** Chave-mestra: desligada, nada é avisado nem listado. */
  notificationsOn: boolean;
  /** Mostrar aviso do sistema (fora da aba) além do sino. */
  desktopNotifications: boolean;
  kinds: Record<NotificationKind, boolean>;
  /** Mostrar aviso quando alguém marca spoiler */
  compactBooks: boolean;
  reduceMotion: boolean;
  /** Sons sutis da interface (toques, abrir livro, trocar de menu). */
  soundsOn: boolean;
}

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  mensagem: "Mensagens no chat",
  curtida: "Curtidas nas minhas avaliações",
  resposta: "Respostas às minhas avaliações",
  seguidor: "Novos seguidores",
  mural: "Publicações no mural",
};

const KEY = "mybooks-settings";

const DEFAULTS: Settings = {
  theme: "sistema",
  scene: DEFAULT_SCENE,
  notificationsOn: true,
  desktopNotifications: false,
  kinds: { mensagem: true, curtida: true, resposta: true, seguidor: true, mural: true },
  compactBooks: false,
  reduceMotion: false,
  soundsOn: true,
};

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...saved, scene: validScene(saved.scene), kinds: { ...DEFAULTS.kinds, ...(saved.kinds || {}) } };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(next: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("mybooks:settings"));
}

/** Aplica tema e preferência de movimento no documento. */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = settings.theme === "escuro" || (settings.theme === "sistema" && prefersDark);
  root.classList.toggle("dark", dark);
  root.dataset.scene = validScene(settings.scene);
  root.dataset.reduceMotion = settings.reduceMotion ? "true" : "false";
}

/** Lê as preferências e reage a mudanças feitas em qualquer tela. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener("mybooks:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mybooks:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => applySettings(settings), [settings]);

  // O tema "sistema" precisa acompanhar o sistema mudando em tempo real.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applySettings(loadSettings());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    setSettings(next);
  }, []);

  return [settings, update];
}

/** Pede permissão ao navegador para avisos do sistema. */
export async function requestDesktopPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function desktopPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
