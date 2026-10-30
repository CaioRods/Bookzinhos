import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, HeartHandshake, X } from "lucide-react";
import { fetchSupportConfig, type SupportConfig } from "../lib/api";
import { useDialogFocus } from "../lib/useDialogFocus";

export function usePublicSupport() {
  const [support, setSupport] = useState<SupportConfig | null>(null);
  useEffect(() => {
    let active = true;
    const sync = (event: Event) => setSupport((event as CustomEvent<SupportConfig>).detail);
    fetchSupportConfig().then((value) => { if (active) setSupport(value); }).catch(() => { if (active) setSupport(null); });
    window.addEventListener("mybooks:support", sync);
    return () => { active = false; window.removeEventListener("mybooks:support", sync); };
  }, []);
  return support;
}

export function SupportDonation({ support, onClose }: { support: SupportConfig; onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useDialogFocus(dialog, { initialFocus: close, onClose, inertRoot: true });
  const copy = async () => {
    await navigator.clipboard.writeText(support.pixKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return createPortal(<div className="mb-support-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="mb-support-dialog" role="dialog" aria-modal="true" aria-label="Apoiar o myBooks">
      <button ref={close} className="mb-btn mb-btn-ghost mb-btn-icon mb-support-close" onClick={onClose} aria-label="Fechar"><X /></button>
      <span className="mb-support-heart"><HeartHandshake /></span>
      <p className="mb-support-kicker">Uma contribuição espontânea</p>
      <h2>Apoie o próximo capítulo</h2>
      <p>{support.message || "Se o myBooks faz parte das suas leituras, você pode ajudar a manter o projeto no ar."}</p>
      {support.recipient && <div className="mb-support-recipient"><span>Beneficiário</span><strong>{support.recipient}</strong></div>}
      <div className="mb-support-pix"><span>Chave Pix</span><strong>{support.pixKey}</strong><button className="mb-btn mb-btn-primary" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copiada" : "Copiar chave"}</button></div>
      <small>Doar é opcional. Nenhum recurso, conteúdo ou atendimento depende de contribuição.</small>
    </section>
  </div>, document.body);
}
