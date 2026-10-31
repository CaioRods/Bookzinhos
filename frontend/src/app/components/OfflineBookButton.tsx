import { Download, DownloadCloud, CheckCircle2, Loader2, X } from "lucide-react";
import { cancelInstall, installBook, removeInstalled, useInstalled, useOffline } from "../lib/offline/device";
import { requireAuth } from "../lib/authGate";
import { toast } from "./Ui";
export function OfflineBookButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const { ids, download } = useInstalled(id), offline = useOffline(), installed = ids.has(id), busy = download && !download.error;
  const activate = async () => {
    if (!requireAuth("instalar livros")) return;
    try { if (installed) await removeInstalled(id); else if (busy) cancelInstall(id); else await installBook(id); }
    catch (error) { toast(error instanceof Error ? error.message : "Não foi possível instalar.", "error"); }
  };
  return <button type="button" className={`mb-offline-book ${compact ? "is-compact" : "mb-btn mb-btn-outline"} ${installed ? "is-installed" : ""}`} disabled={offline && !installed} aria-label={installed ? "Remover instalação deste aparelho" : busy ? "Cancelar instalação" : "Instalar para ler offline"} title={installed ? "Instalado neste aparelho" : "Instalar para ler offline"} onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); void activate(); }}>
    {installed ? <CheckCircle2 size={17}/> : busy ? <Loader2 size={17} className="animate-spin"/> : <DownloadCloud size={17}/>}
    {!compact && <span>{installed ? "Instalado" : busy ? download.percent === null ? `${(download.loaded/1048576).toFixed(1)} MB` : `Instalando ${download.percent}%` : "Instalar livro"}</span>}
    {busy && !compact && <><progress aria-label="Progresso da instalação" max={100} value={download.percent ?? undefined}/><X size={14}/></>}
  </button>;
}
export function InstalledMark({ id }: { id: string }) {
  const { ids } = useInstalled(id); return ids.has(id) ? <span className="mb-installed-mark" title="Instalado neste aparelho" aria-label="Instalado para leitura offline"><Download size={13}/></span> : null;
}
