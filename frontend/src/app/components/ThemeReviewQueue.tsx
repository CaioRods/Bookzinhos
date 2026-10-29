import { useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { decideThemeSubmission, fetchThemeSubmissions, type ThemeSubmission } from "../lib/appearanceApi";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage } from "./ThemeImage";
import { EmptyState, toast } from "./Ui";

const themeOf = (item: ThemeSubmission): SceneTheme | null => {
  try { return item.themeData || JSON.parse(item.theme_data || "null"); } catch { return null; }
};
export function ThemeReviewQueue() {
  const [items, setItems] = useState<ThemeSubmission[]>([]);
  const load = () => fetchThemeSubmissions().then(setItems).catch((error) => toast(error.message, "error"));
  useEffect(() => { void load(); }, []);
  const decide = async (item: ThemeSubmission, decision: "approved" | "rejected" | "changes_requested") => {
    const reason = decision === "approved" ? "" : window.prompt("Explique brevemente a decisão:") || "";
    if (decision !== "approved" && !reason) return;
    await decideThemeSubmission(item.id, decision, reason); setItems((old) => old.filter((entry) => entry.id !== item.id)); toast(decision === "approved" ? "Tema aprovado e boost ativado." : "Solicitação atualizada.");
  };
  if (!items.length) return <EmptyState emoji="🎨" title="Nenhum tema aguardando análise" description="Novas solicitações aparecerão aqui." />;
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{items.map((item) => { const theme = themeOf(item); return <article key={item.id} className="mb-card overflow-hidden"><div className="h-36 relative bg-[var(--surface-2)]">{theme && <ThemeImage theme={theme} crop={theme.profile} />}</div><div className="p-4"><strong>{theme?.name || "Tema"}</strong><small className="block text-[var(--text-3)] mt-1">por @{item.owner}</small><div className="flex gap-2 mt-4"><button className="mb-btn mb-btn-primary mb-btn-sm" onClick={() => decide(item,"approved")}><Check size={14}/> Aprovar</button><button className="mb-btn mb-btn-outline mb-btn-sm" onClick={() => decide(item,"changes_requested")}><RotateCcw size={14}/></button><button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => decide(item,"rejected")}><X size={14}/></button></div></div></article>; })}</div>;
}
