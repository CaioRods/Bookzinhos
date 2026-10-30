import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { acceptPrivacyPolicy } from "../lib/api";
import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_VERSION } from "../lib/privacyPolicy";
import { useDialogFocus } from "../lib/useDialogFocus";

export function PrivacyConsent({ onAccepted }: { onAccepted: (version: string) => void }) {
  const dialog = useRef<HTMLElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDialogFocus(dialog, { initialFocus: reader });

  const measure = () => {
    const element = reader.current;
    if (!element) return;
    if (element.scrollHeight <= 0 || element.clientHeight <= 0) return;
    const available = Math.max(1, element.scrollHeight - element.clientHeight);
    const next = Math.min(100, Math.round((element.scrollTop / available) * 100));
    setProgress(next);
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 12) setReachedEnd(true);
  };

  useEffect(() => { measure(); }, []);

  const accept = async () => {
    if (!reachedEnd || busy) return;
    setBusy(true); setError("");
    try {
      const result = await acceptPrivacyPolicy();
      window.dispatchEvent(new Event("mybooks:privacy-accepted"));
      onAccepted(result.version);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar o aceite.");
      setBusy(false);
    }
  };

  return (
    <div className="mb-privacy-backdrop" role="presentation">
      <section ref={dialog} className="mb-privacy-dialog" role="dialog" aria-modal="true" aria-label="Política de Privacidade">
        <header className="mb-privacy-header">
          <span className="mb-privacy-seal"><ShieldCheck /></span>
          <div><p>Um acordo de confiança</p><h1>Política de Privacidade</h1><small>Versão {PRIVACY_POLICY_VERSION}</small></div>
          <BookOpen className="mb-privacy-bookmark" aria-hidden="true" />
        </header>
        <div className="mb-privacy-progress" aria-label={`${progress}% do documento percorrido`}><i style={{ width: `${progress}%` }} /></div>
        <div className="mb-privacy-document" data-testid="privacy-document" ref={reader} onScroll={measure} tabIndex={0}>
          <div className="mb-privacy-lead">
            <strong>Antes de começar seu próximo capítulo</strong>
            <p>Leia até o final para conhecer como o myBooks cuida dos seus dados, das suas leituras e do conteúdo compartilhado.</p>
          </div>
          {PRIVACY_POLICY_SECTIONS.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
          <div className="mb-privacy-end"><Check /><strong>Fim do documento</strong><span>Agora você pode confirmar a leitura.</span></div>
        </div>
        <footer className="mb-privacy-actions">
          <span><LockKeyhole /> Seu aceite será registrado com versão, data e hora.</span>
          {error && <p role="alert">{error}</p>}
          <button className="mb-btn mb-btn-primary mb-btn-lg" disabled={!reachedEnd || busy} onClick={accept}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />} Li e aceito
          </button>
          {!reachedEnd && <small>Chegue ao final do texto para liberar a confirmação.</small>}
        </footer>
      </section>
    </div>
  );
}
