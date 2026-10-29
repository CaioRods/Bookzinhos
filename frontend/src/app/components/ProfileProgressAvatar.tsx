import type { CSSProperties } from "react";
import { Avatar } from "./Ui";

export type LevelTier = "iron" | "bronze" | "gold" | "blue" | "diamond";

export function levelTier(level: number): LevelTier {
  if (level < 20) return "iron";
  if (level < 40) return "bronze";
  if (level < 60) return "gold";
  if (level < 80) return "blue";
  return "diamond";
}

export function ProfileProgressAvatar({ avatar, level, title, totalXp, currentLevelXp, nextLevelXp, compact = false }: {
  avatar?: string | null; level: number; title: string; totalXp?: number; currentLevelXp?: number; nextLevelXp?: number; compact?: boolean;
}) {
  const hasPrivateXp = [totalXp, currentLevelXp, nextLevelXp].every(Number.isFinite);
  const span = Math.max(1, Number(nextLevelXp) - Number(currentLevelXp));
  const percent = hasPrivateXp ? (level >= 100 ? 100 : Math.max(0, Math.min(100, (Number(totalXp) - Number(currentLevelXp)) / span * 100))) : 100;
  const tier = levelTier(level);
  return <div className={`mb-profile-progress-avatar mb-profile-progress-avatar--${tier}${compact ? " mb-profile-progress-avatar--compact" : ""}`}>
    <div className={`mb-profile-progress-ring${hasPrivateXp ? "" : " mb-profile-progress-ring--public"}`} role={hasPrivateXp ? "progressbar" : "img"} aria-label={hasPrivateXp ? `Progresso para o nível ${Math.min(100, level + 1)}` : `Nível público ${level}`} {...(hasPrivateXp ? { "aria-valuenow": Math.round(percent), "aria-valuemin": 0, "aria-valuemax": 100 } : {})} style={{ "--profile-progress": `${percent * 3.6}deg` } as CSSProperties}>
      <Avatar emoji={avatar} size={compact ? "sm" : "xl"} />
    </div>
    <strong className="mb-level-medallion" aria-label={`Nível ${level}`}>{level}</strong>
    {!compact && <span>{title}</span>}
  </div>;
}
