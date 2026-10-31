import { installLongPressContext } from "../lib/longPressContext";
import { useEffect, useState } from "react";
import { Modal, toast } from "./Ui";
import { downloadRemoteFile, safeFileName } from "../lib/download";
import { getFullUrl } from "../lib/types";

export function InterfaceBehavior() {
  useEffect(() => installLongPressContext(), []);
  const [banner, setBanner] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"]');
    const prevent = (event: Event) => { if (!editable(event.target)) event.preventDefault(); };
    const context = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-banner-src]') : null;
      if (!editable(event.target)) event.preventDefault();
      if (element?.dataset.bannerSrc) { event.preventDefault(); setBanner({ url: element.dataset.bannerSrc.startsWith("/scenery/") ? element.dataset.bannerSrc : getFullUrl(element.dataset.bannerSrc) || element.dataset.bannerSrc, name: element.dataset.bannerName || "banner" }); }
    };
    document.addEventListener("dragstart", prevent);
    document.addEventListener("selectstart", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("contextmenu", context);
    return () => { document.removeEventListener("dragstart", prevent); document.removeEventListener("selectstart", prevent); document.removeEventListener("copy", prevent); document.removeEventListener("cut", prevent); document.removeEventListener("contextmenu", context); };
  }, []);
  const save = async () => {
    if (!banner || busy) return;
    setBusy(true);
    try {
      const extension = new URL(banner.url, location.href).pathname.match(/\.(png|jpe?g|webp|avif|svg)$/i)?.[1] || "jpg";
      await downloadRemoteFile(banner.url, safeFileName(banner.name, extension)); setBanner(null);
    } catch { toast("Não foi possível salvar o banner. Tente novamente.", "error"); }
    finally { setBusy(false); }
  };
  return <Modal open={!!banner} onClose={() => setBanner(null)} title="Salvar banner" description="Baixe a imagem original, sem reduzir a resolução." size="sm"><button className="mb-btn mb-btn-primary" disabled={busy} onClick={save}>{busy ? "Baixando…" : "Baixar imagem original"}</button></Modal>;
}
