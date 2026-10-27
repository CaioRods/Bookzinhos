/** Marca vetorial compartilhada, legível do favicon ao cabeçalho. */
export function Brand({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return <span className={`mb-brand ${className}`}>
    <img src="/logo.svg" alt={compact ? "myBooks" : ""} width="40" height="40" />
    {!compact && <span className="mb-wordmark">myBooks<span className="mb-brand-dot">.</span></span>}
  </span>;
}
