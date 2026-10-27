/**
 * Peças de interface compartilhadas.
 *
 * Todas as telas montam a partir daqui — é o que mantém botões, cartões,
 * avatares e estrelas com a mesma aparência em todo o app.
 */

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Star, X } from "lucide-react";

// ─── Estrelas ─────────────────────────────────────────────────────────────────

const STAR_SIZES = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-7 h-7" } as const;

export function Stars({
  value,
  size = "md",
  showValue = false,
  count,
  onDark = false,
}: {
  value: number;
  size?: keyof typeof STAR_SIZES;
  showValue?: boolean;
  count?: number;
  /** Sobre fundo escuro a estrela vazia precisa ser translúcida, não cinza-claro */
  onDark?: boolean;
}) {
  const cls = STAR_SIZES[size];
  const empty = onDark ? "text-white/25 fill-white/25" : "text-[var(--surface-3)] fill-[var(--surface-3)]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${value} de 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${cls} ${i <= Math.round(value) ? "fill-[var(--gold)] text-[var(--gold)]" : empty}`}
          />
        ))}
      </span>
      {showValue && value > 0 && (
        <span className="text-[12px] font-semibold text-[var(--text-2)]">
          {value.toFixed(1)}
          {count != null && <span className="text-[var(--text-3)] font-normal"> ({count})</span>}
        </span>
      )}
    </span>
  );
}

const RATING_WORDS = ["", "Não curti", "Ok", "Bom", "Muito bom", "Amei!"];

/** Seletor de nota de 1 a 5 com rótulo — usado ao escrever uma resenha. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => onChange(i)}
            className="p-0.5 rounded-md transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed cursor-pointer"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                i <= shown ? "fill-[var(--gold)] text-[var(--gold)]" : "text-[var(--surface-3)] fill-[var(--surface-3)]"
              }`}
            />
          </button>
        ))}
      </div>
      <span className={`text-[13px] font-semibold ${shown ? "text-[var(--text-2)]" : "text-[var(--text-3)]"}`}>
        {shown ? RATING_WORDS[shown] : "Toque para dar sua nota"}
      </span>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_SIZES = {
  xs: "w-7 h-7 text-sm",
  sm: "w-9 h-9 text-lg",
  md: "w-11 h-11 text-xl",
  lg: "w-16 h-16 text-3xl",
  xl: "w-24 h-24 text-5xl",
  hero: "w-20 h-20 sm:w-28 sm:h-28 text-[48px] sm:text-[70px]",
} as const;

export function Avatar({
  emoji,
  size = "md",
  username,
  ring,
}: {
  emoji?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  username?: string;
  ring?: boolean;
}) {
  const content = (
    <span
      className={`${AVATAR_SIZES[size]} inline-flex items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--line)] select-none flex-shrink-0 ${
        ring ? "ring-2 ring-[var(--primary)]/30" : ""
      }`}
    >
      {emoji || "👤"}
    </span>
  );
  if (!username) return content;
  return (
    <Link to={`/user/${encodeURIComponent(username)}`} className="hover:opacity-80 transition-opacity">
      {content}
    </Link>
  );
}

// ─── Cabeçalho de seção ───────────────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-section-heading flex items-end justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[21px] font-semibold tracking-tight text-foreground">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-[13px] text-[var(--text-3)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Cabeçalho de página.
 *
 * Mesma estrutura em todas as telas — bolha colorida, título com a segunda
 * palavra em gradiente e uma linha de apoio — para o app não parecer um
 * conjunto de páginas soltas.
 */
export function PageHeader({
  title,
  highlight,
  subtitle,
  icon,
  gradient: _gradient,
  action,
}: {
  title: string;
  highlight?: string;
  subtitle?: string;
  icon?: ReactNode;
  gradient?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-page-heading">
      <div className="min-w-0">
        <p className="mb-eyebrow mb-heading-kicker">{icon && <span aria-hidden="true">{icon}</span>} MYBOOKS · SEU UNIVERSO DE LEITURA</p>
        <h1>{title} {highlight && <span>{highlight}</span>}</h1>
        {subtitle && <p className="mb-page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="mb-page-action">{action}</div>}
    </header>
  );
}

// ─── Estado vazio ─────────────────────────────────────────────────────────────

export function EmptyState({
  emoji = "📚",
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-empty mb-card px-6 py-12 text-center mb-in">
      <div className="mb-empty-symbol text-3xl mb-3 select-none">{emoji}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="text-[13px] text-[var(--text-3)] mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Esqueletos de carregamento ───────────────────────────────────────────────

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`mb-skeleton ${className}`} style={style} />;
}

export function BookRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mb-rail">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[116px] md:w-[132px]">
          <Skeleton className="w-full aspect-[2/3] rounded-lg" />
          <Skeleton className="h-3 w-4/5 mt-2.5" />
          <Skeleton className="h-3 w-3/5 mt-1.5" />
        </div>
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

let openModalCount = 0;
let modalOverflowBefore = "";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (openModalCount++ === 0) { modalOverflowBefore = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    const frame = requestAnimationFrame(() => {
      if (!dialog.current?.contains(document.activeElement)) (dialog.current?.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([type="file"])') || dialog.current?.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key === "Tab") {
        const targets = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter(target => target.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey);
      if (--openModalCount === 0) document.body.style.overflow = modalOverflowBefore;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const width = size === "xl" ? "max-w-6xl" : size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`mb-dialog relative w-full ${width} mb-glass-strong rounded-t-3xl sm:rounded-3xl animate-slide-up sm:animate-scale-in max-h-[92vh] flex flex-col`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div className="min-w-0">
              {title && <h3 className="text-[15px] font-bold text-foreground">{title}</h3>}
              {description && <p className="text-[13px] text-[var(--text-3)] mt-1">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Fechar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm -mt-1 -mr-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="flex gap-2 justify-end p-4 border-t border-[var(--line)]">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

/** Aviso rápido no rodapé — substitui os `alert()` que travavam a página. */
export function toast(message: string, kind: "success" | "error" = "success"): void {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.style.cssText = [
    "position:fixed", "left:50%", "bottom:88px", "transform:translateX(-50%)",
    "z-index:10001", "padding:11px 18px", "border-radius:12px",
    "font-size:13px", "font-weight:600", "max-width:90vw", "text-align:center",
    "box-shadow:0 8px 24px rgba(0,0,0,0.2)", "pointer-events:none",
    kind === "error" ? "background:#dc2626;color:#fff" : "background:#191419;color:#fff",
    "opacity:0", "transition:opacity .18s ease, transform .18s ease",
  ].join(";");
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(-6px)";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 2600);
}

// ─── Confirmação ──────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button onClick={onCancel} className="mb-btn mb-btn-outline">Cancelar</button>
          <button
            onClick={onConfirm}
            className="mb-btn mb-btn-primary"
            style={destructive ? { background: "var(--destructive)" } : undefined}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div />
    </Modal>
  );
}
