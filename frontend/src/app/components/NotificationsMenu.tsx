import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, Check, Heart, MessageCircle, MessageSquare, Megaphone, UserPlus, Settings } from "lucide-react";
import { fetchNotifications, markNotificationsRead } from "../lib/api";
import { timeAgo } from "../lib/types";
import type { AppNotification } from "../lib/types";
import { useSettings, desktopPermission, type NotificationKind } from "../lib/settings";
import { Avatar } from "./Ui";

const ICONS: Record<string, typeof Bell> = {
  mensagem: MessageSquare,
  curtida: Heart,
  resposta: MessageCircle,
  seguidor: UserPlus,
  mural: Megaphone,
};

const TINTS: Record<string, string> = {
  mensagem: "#3b82f6",
  curtida: "var(--like)",
  resposta: "#8b5cf6",
  seguidor: "var(--primary)",
  mural: "var(--gold)",
};

/**
 * Sino de avisos.
 *
 * A lista vem do servidor; o que aparece é filtrado pelas preferências deste
 * aparelho. Quando um aviso novo chega e a aba está em segundo plano, o
 * navegador mostra a notificação de verdade — se a pessoa tiver permitido.
 */
export function NotificationsMenu({ onUnreadChange }: { onUnreadChange?: (n: number) => void }) {
  const [settings] = useSettings();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  // Ids já anunciados pelo navegador, para não repetir o mesmo aviso.
  const announced = useRef<Set<number>>(new Set());
  const firstLoad = useRef(true);

  const allowed = useCallback(
    (n: AppNotification) => settings.notificationsOn && settings.kinds[n.type as NotificationKind] !== false,
    [settings]
  );

  const visible = useMemo(() => items.filter(allowed), [items, allowed]);
  const unread = visible.filter((n) => !n.isRead).length;

  useEffect(() => onUnreadChange?.(unread), [unread, onUnreadChange]);

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible" && !firstLoad.current) return;
    try {
      const data = await fetchNotifications();
      const next = data.items ?? [];
      setItems(next);

      // Anuncia no sistema apenas o que é novo desde a última checagem.
      if (!firstLoad.current && settings.notificationsOn && settings.desktopNotifications) {
        if (desktopPermission() === "granted") {
          for (const n of next) {
            if (n.isRead || announced.current.has(n.id)) continue;
            if (settings.kinds[n.type as NotificationKind] === false) continue;
            announced.current.add(n.id);
            try {
              new Notification(n.title, { body: n.body || undefined, icon: "/icon-192.png", tag: `mybooks-${n.id}` });
            } catch {
              /* alguns navegadores só permitem via service worker */
            }
          }
        }
      } else {
        next.forEach((n) => announced.current.add(n.id));
      }
      firstLoad.current = false;
    } catch {
      /* silencioso: o sino é secundário */
    }
  }, [settings]);

  useEffect(() => {
    load();
    // Sondagem frequente + ao voltar o foco/aba: o aviso aparece quase na
    // hora, sem precisar de conexão persistente.
    const id = window.setInterval(load, 8000);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Abriu o sino e viu: os avisos deixam de contar como novos e o balão some.
  useEffect(() => {
    if (!open || unread === 0) return;
    const timer = window.setTimeout(() => { void markAllRead(); }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markNotificationsRead();
    } catch {
      load();
    }
  };

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await markNotificationsRead([n.id]);
    } catch {
      /* a próxima carga corrige */
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
        aria-expanded={open}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
      >
        <Bell className="w-[19px] h-[19px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[var(--like)] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--background)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mb-notifications-panel absolute right-0 top-12 z-50 w-[340px] max-w-[calc(100vw-2rem)] mb-card shadow-[var(--shadow-3)] overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--line)]">
            <span className="text-[14px] font-bold text-foreground">Notificações</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="mb-btn mb-btn-ghost mb-btn-sm" title="Marcar tudo como lido">
                  <Check className="w-4 h-4" /> Ler tudo
                </button>
              )}
              <Link to="/settings" onClick={() => setOpen(false)} aria-label="Configurar notificações" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="mb-notifications-scroll max-h-[380px] overflow-y-auto">
            {!settings.notificationsOn ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[var(--text-3)]">As notificações estão desligadas.</p>
                <Link to="/settings" onClick={() => setOpen(false)} className="mb-btn mb-btn-soft mb-btn-sm mt-3">
                  Ativar nas configurações
                </Link>
              </div>
            ) : visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-[var(--text-3)]">Nada por aqui ainda.</p>
            ) : (
              visible.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => openItem(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[var(--line)] last:border-0 transition-colors hover:bg-[var(--surface-2)] ${
                      n.isRead ? "" : "bg-[var(--primary-soft)]"
                    }`}
                  >
                    <span className="relative flex-shrink-0 mt-0.5">
                      <Avatar emoji={n.avatar || "🔔"} size="xs" username={n.actor} link={false} />
                      <span
                        className="absolute -bottom-1 -right-1 w-[17px] h-[17px] rounded-full flex items-center justify-center ring-2 ring-[var(--surface)]"
                        style={{ background: TINTS[n.type] || "var(--primary)" }}
                      >
                        <Icon className="w-[10px] h-[10px] text-white" />
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground leading-snug">{n.title}</span>
                      {n.body && <span className="block text-[12.5px] text-[var(--text-3)] line-clamp-2 mt-0.5">{n.body}</span>}
                      <span className="block text-[11.5px] text-[var(--text-3)] mt-1">{timeAgo(n.createdAt)}</span>
                    </span>

                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0 mt-2" />}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
