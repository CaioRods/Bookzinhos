import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { presentationForProgression, type ProgressionResult } from "../lib/progressionEvents";
import { soundLevelUp } from "../lib/sounds";
import { toast } from "./Ui";

export function LevelUpOverlay() {
  const [result, setResult] = useState<ProgressionResult | null>(null);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<ProgressionResult>).detail;
      if (presentationForProgression(detail) === "overlay") { setResult(detail); soundLevelUp(true); }
      else { toast(`Você chegou ao nível ${detail.newLevel}!`); soundLevelUp(false); }
    };
    window.addEventListener("mybooks:progression", receive);
    return () => window.removeEventListener("mybooks:progression", receive);
  }, []);
  if (!result) return null;
  return <div className="mb-level-overlay" role="dialog" aria-modal="true" aria-label="Novo nível"><div><button aria-label="Fechar" onClick={() => setResult(null)}><X /></button><Sparkles className="mb-level-spark"/><small>NOVA CONQUISTA</small><p><span>{result.oldLevel}</span><i>→</i><strong>{result.newLevel}</strong></p><h2>{result.title || "Novo título desbloqueado"}</h2><button className="mb-btn mb-btn-primary" onClick={() => setResult(null)}>Continuar lendo</button></div></div>;
}
