import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Bell, Monitor, Moon, Sun, BookOpen, Smartphone, HelpCircle, LogOut, Check,
  SlidersHorizontal, Shield, Trash2,
} from "lucide-react";
import {
  NOTIFICATION_LABELS, desktopPermission, requestDesktopPermission, useSettings,
  type NotificationKind, type ThemeChoice,
} from "../lib/settings";
import { getSavedReaderMode, setSavedReaderMode, type ReaderMode } from "../lib/readerChoice";
import { soundToggle } from "../lib/sounds";
import { clearSession, getUsername, isAdmin as isAdminUser } from "../lib/session";
import { invalidate } from "../lib/api";
import { ConfirmDialog, PageHeader, toast } from "../components/Ui";

const THEMES: { key: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { key: "claro", label: "Claro", icon: Sun },
  { key: "escuro", label: "Escuro", icon: Moon },
  { key: "sistema", label: "Do sistema", icon: Monitor },
];

const READER_MODES: { key: ReaderMode | null; label: string; hint: string }[] = [
  { key: "app", label: "Leitor do app", hint: "Guarda progresso, capítulos e temas" },
  { key: "native", label: "Leitor do sistema", hint: "Abre no visualizador do aparelho" },
  { key: null, label: "Perguntar sempre", hint: "Escolho na hora de abrir" },
];

export function Settings() {
  const [settings, update] = useSettings();
  const [permission, setPermission] = useState(desktopPermission);
  const [readerMode, setReaderMode] = useState<ReaderMode | null>(() => getSavedReaderMode());
  const [confirmLogout, setConfirmLogout] = useState(false);
  const admin = isAdminUser();
  const username = getUsername();

  useEffect(() => {
    const id = window.setInterval(() => setPermission(desktopPermission()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const askPermission = async () => {
    const result = await requestDesktopPermission();
    setPermission(result);
    if (result === "granted") {
      update({ desktopNotifications: true });
      toast("Avisos do sistema ativados.");
      try {
        new Notification("myBooks", { body: "Pronto! É assim que os avisos vão aparecer.", icon: "/icon-192.png" });
      } catch {
        /* alguns navegadores exigem service worker */
      }
    } else if (result === "denied") {
      toast("O navegador bloqueou os avisos. Libere nas permissões do site.", "error");
    }
  };

  const changeReaderMode = (mode: ReaderMode | null) => {
    setSavedReaderMode(mode);
    setReaderMode(mode);
  };

  return (
    <div className="mb-screen mb-screen--narrow mb-settings space-y-6">
      <PageHeader
        title="Suas"
        highlight="configurações"
        subtitle="Aparência, leitura e o que você quer ser avisado."
        icon={<SlidersHorizontal className="w-5 h-5" />}
      />

      {/* ── Aparência ──────────────────────────────────────────────────────── */}
      <Section title="Aparência" description="Vale para este aparelho.">
        <Field label="Tema">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => update({ theme: key })}
                aria-pressed={settings.theme === key}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-[14px] border transition-all cursor-pointer ${
                  settings.theme === key
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--primary)]/40"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[12.5px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label="Reduzir animações"
          hint="Desliga as transições mais longas, como a virada das lombadas."
          checked={settings.reduceMotion}
          onChange={(v) => update({ reduceMotion: v })}
        />

        <Toggle
          label="Sons da interface"
          hint="Toques sutis ao trocar de menu e abrir um livro."
          checked={settings.soundsOn}
          onChange={(v) => {
            update({ soundsOn: v });
            // Toca a prévia depois do estado salvar, para ela respeitar o novo valor.
            if (v) window.setTimeout(() => soundToggle(true), 0);
          }}
        />
      </Section>

      {/* ── Notificações ───────────────────────────────────────────────────── */}
      <Section
        title="Notificações"
        description="O sino avisa dentro do app. Os avisos do sistema aparecem mesmo com a aba fechada."
        icon={<Bell className="w-[18px] h-[18px] text-[var(--primary)]" />}
      >
        <Toggle
          label="Receber notificações"
          hint="Desligado, o sino para de listar qualquer aviso."
          checked={settings.notificationsOn}
          onChange={(v) => update({ notificationsOn: v })}
        />

        {settings.notificationsOn && (
          <>
            <div className="rounded-[14px] bg-[var(--surface-2)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-foreground">Avisos do sistema</p>
                  <p className="text-[12.5px] text-[var(--text-3)] mt-0.5 leading-relaxed">
                    {permission === "unsupported"
                      ? "Este navegador não oferece notificações."
                      : permission === "granted"
                      ? "O navegador já autorizou este site."
                      : permission === "denied"
                      ? "O navegador bloqueou. Libere nas permissões do site para reativar."
                      : "Precisa da sua autorização no navegador."}
                  </p>
                </div>
                {permission === "granted" ? (
                  <Switch
                    checked={settings.desktopNotifications}
                    onChange={(v) => update({ desktopNotifications: v })}
                    label="Avisos do sistema"
                  />
                ) : (
                  <button
                    onClick={askPermission}
                    disabled={permission === "unsupported" || permission === "denied"}
                    className="mb-btn mb-btn-primary mb-btn-sm flex-shrink-0"
                  >
                    Permitir
                  </button>
                )}
              </div>
            </div>

            <Field label="O que quero ser avisado">
              <div className="space-y-1">
                {(Object.keys(NOTIFICATION_LABELS) as NotificationKind[]).map((kind) => (
                  <Toggle
                    key={kind}
                    label={NOTIFICATION_LABELS[kind]}
                    checked={settings.kinds[kind] !== false}
                    onChange={(v) => update({ kinds: { ...settings.kinds, [kind]: v } })}
                    compact
                  />
                ))}
              </div>
            </Field>
          </>
        )}
      </Section>

      {/* ── Leitura ────────────────────────────────────────────────────────── */}
      <Section
        title="Leitura"
        description="Como os livros abrem quando você toca em “Quero ler”."
        icon={<BookOpen className="w-[18px] h-[18px] text-[var(--primary)]" />}
      >
        <div className="space-y-2">
          {READER_MODES.map((mode) => (
            <button
              key={mode.label}
              onClick={() => changeReaderMode(mode.key)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-[14px] border text-left transition-all cursor-pointer ${
                readerMode === mode.key
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                  : "border-[var(--line)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <Smartphone className={`w-[18px] h-[18px] flex-shrink-0 ${readerMode === mode.key ? "text-[var(--primary)]" : "text-[var(--text-3)]"}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-foreground">{mode.label}</span>
                <span className="block text-[12.5px] text-[var(--text-3)]">{mode.hint}</span>
              </span>
              {readerMode === mode.key && <Check className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Conta ──────────────────────────────────────────────────────────── */}
      <Section title="Conta" description={username ? `Conectado como ${username}.` : undefined}>
        <div className="flex flex-wrap gap-2">
          <Link to="/profile" className="mb-btn mb-btn-outline">Editar perfil</Link>
          {admin && (
            <Link to="/admin" className="mb-btn mb-btn-soft">
              <Shield className="w-4 h-4" /> Painel do Admin
            </Link>
          )}
          <button
            onClick={() => {
              invalidate();
              toast("Cache limpo. Os dados vão ser buscados de novo.");
            }}
            className="mb-btn mb-btn-outline"
          >
            <Trash2 className="w-4 h-4" /> Limpar cache local
          </button>
          <button onClick={() => setConfirmLogout(true)} className="mb-btn mb-btn-danger-soft ml-auto">
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>
      </Section>

      <p className="flex items-start gap-2 text-[12.5px] text-[var(--text-3)] leading-relaxed px-1">
        <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Tema, animações e preferências de aviso ficam guardados neste aparelho — em outro
        navegador você escolhe de novo.
      </p>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        description="Você precisará entrar de novo com usuário e senha."
        confirmLabel="Sair"
        onConfirm={() => {
          clearSession();
          window.location.href = "/";
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

// ─── Peças ────────────────────────────────────────────────────────────────────

function Section({
  title, description, icon, children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-card p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-foreground">
          {icon}
          {title}
        </h2>
        {description && <p className="text-[12.5px] text-[var(--text-3)] mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-label">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange, compact,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`mb-setting-row flex items-center justify-between gap-4 ${compact ? "py-1.5" : "rounded-[14px] bg-[var(--surface-2)] p-4"}`}>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-foreground">{label}</p>
        {hint && <p className="text-[12.5px] text-[var(--text-3)] mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Switch({
  checked, onChange, label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-[46px] h-[26px] rounded-full flex-shrink-0 transition-colors cursor-pointer ${
        checked ? "bg-[var(--primary)]" : "bg-[var(--switch-background)]"
      }`}
    >
      <span
        className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ left: 3, transform: `translateX(${checked ? 20 : 0}px)` }}
      />
    </button>
  );
}
