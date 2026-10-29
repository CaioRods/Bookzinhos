import type { ProgressionSummary } from "../lib/types";

export function ProgressionCard({ progression }: { progression: ProgressionSummary }) {
  const span = Math.max(1, progression.nextLevelXp - progression.currentLevelXp);
  const percent = progression.level >= 100 ? 100 : Math.max(0, Math.min(100, (progression.totalXp - progression.currentLevelXp) / span * 100));
  return <section className="mb-progression-card" aria-label="Progressão do leitor"><div><span>Nível {progression.level}</span>{progression.boostUntil > Date.now() && <b>XP 2× ativo</b>}</div><h2>{progression.title}</h2><div className="mb-xp-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div><p>{progression.totalXp.toLocaleString("pt-BR")} XP {progression.level < 100 && <>· faltam {(progression.nextLevelXp - progression.totalXp).toLocaleString("pt-BR")}</>}</p></section>;
}
