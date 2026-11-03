import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
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

export function SupportDonation({ support, onClose, onNeverShow }: { support: SupportConfig; onClose: () => void; onNeverShow?: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useDialogFocus(dialog, { initialFocus: close, onClose, inertRoot: true });
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(support.pixKey);
      setCopied(true);
      setCopyError(false);
    } catch { setCopyError(true); }
  };
  return createPortal(<div className="mb-support-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="mb-support-dialog" role="dialog" aria-modal="true" aria-label="Doe para fazer a diferença">
      <button ref={close} className="mb-btn mb-btn-ghost mb-btn-icon mb-support-close" onClick={onClose} aria-label="Fechar"><X /></button>
      <span className="mb-support-heart"><HeartHandshake /></span>
      <p className="mb-support-kicker">Uma contribuição espontânea</p>
      <h2>Leitura que transforma</h2>
      <p>{support.message || "Se o myBooks faz parte das suas leituras, você pode ajudar a manter o projeto no ar."}</p>
      {support.recipient && <div className="mb-support-recipient"><span>Campanha</span><strong>{support.recipient}</strong></div>}
      <div className="mb-support-pix"><span>Chave Pix</span><strong>{support.pixKey}</strong><button className="mb-btn mb-btn-primary" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copiada" : "Copiar chave"}</button></div>
      {copyError && <p role="status">Não foi possível copiar. Selecione a chave acima e copie manualmente.</p>}
      <p className="mb-donation-note">Pix da campanha myBooks. A instituição apoiada é o GRAACC; esta chave não é apresentada como chave oficial do instituto. Confira o destinatário no seu banco.</p>
      <Link className="mb-btn mb-btn-primary mb-donation-link" to="/donate" onClick={onClose}>Conheça a causa e o destino da doação</Link>
      {onNeverShow && <button type="button" className="mb-support-dismiss" onClick={onNeverShow}>Não mostrar novamente</button>}
      <small>Doar é opcional. Nenhum recurso, conteúdo ou atendimento depende de contribuição.</small>
    </section>
  </div>, document.body);
}
