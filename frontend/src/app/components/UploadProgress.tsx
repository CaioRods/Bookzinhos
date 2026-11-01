import { BookOpen, Check, Loader2, FileUp, Sparkles, AlertCircle } from "lucide-react";
export function UploadProgress({ phase, filename, current, total, published, percent, stage }: {
  phase: "preparing" | "converting" | "ready" | "publishing" | "error" | "complete"; filename: string; current: number; total: number; published: number; percent: number | null; stage?: string;
}) {
  const busy = ["preparing", "converting", "publishing"].includes(phase);
  const title = phase === "converting" ? `Convertendo EPUB para PDF… ${percent ?? 0}%` : phase === "preparing" ? "Preparando o livro e a capa…" : phase === "publishing" ? ({ checking: "Conferindo o cadastro…", pdf: "Enviando o arquivo do livro…", cover: "Enviando a capa…", saving: "Salvando o livro no acervo…" }[stage || "saving"] || "Publicando o livro…") : phase === "complete" ? "Sua fila foi concluída" : phase === "error" ? "Este livro precisa da sua atenção" : "Pronto para revisar e publicar";
  return <section className="mb-upload-progress" style={busy ? { position: "sticky", top: 12, zIndex: 20 } : undefined} role="status" aria-live="polite" aria-atomic="true">
    <div className="mb-upload-progress-icon">{busy ? phase === "publishing" ? <FileUp size={26} /> : <Loader2 size={26} className="animate-spin" /> : phase === "complete" ? <Check size={28} /> : phase === "error" ? <AlertCircle size={26} /> : <BookOpen size={26} />}</div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><span className="mb-upload-progress-counter">{phase === "complete" ? `${published} ${published === 1 ? "livro adicionado" : "livros adicionados"}` : `Livro ${current} de ${total}`}</span><span className="text-xs text-[var(--text-3)]">{published} de {total} adicionados</span></div>
      <h2 className="text-base font-semibold mt-2">{title}</h2><p className="text-xs text-[var(--text-3)] mt-1 truncate">{filename}</p>
      <div className={`mb-upload-progress-track mt-4 ${busy && percent === null ? "is-indeterminate" : ""}`} role="progressbar" aria-label={phase === "converting" ? "Conversão do EPUB" : "Livros adicionados"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={busy && percent === null ? undefined : phase === "converting" ? percent ?? 0 : Math.round(published / Math.max(1, total) * 100)}><span style={{ width: busy && percent === null ? "35%" : `${phase === "converting" ? percent ?? 0 : published / Math.max(1, total) * 100}%` }} /></div>
      <div className="flex gap-4 mt-3 text-[11px] text-[var(--text-3)]"><span className="inline-flex gap-1 items-center"><Sparkles size={12} />Preparar</span><span>Revisar</span><span>Publicar</span></div>
    </div>
  </section>;
}
