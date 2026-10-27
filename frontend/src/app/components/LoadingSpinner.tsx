import { Brand } from "./Brand";
export function LoadingSpinner({ label = "Preparando sua biblioteca…" }: { label?: string }) {
  return <div className="mb-brand-loading min-h-screen flex flex-col items-center justify-center gap-6 bg-background" role="status"><Brand compact /><p className="text-sm text-[var(--text-2)]">{label}</p><span className="mb-loading-line" /></div>;
}
