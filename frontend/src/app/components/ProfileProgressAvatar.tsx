import type { CSSProperties } from "react";
import { Avatar } from "./Ui";

export function ProfileProgressAvatar({ avatar, level, title, totalXp, currentLevelXp, nextLevelXp }: {
  avatar?: string | null; level: number; title: string; totalXp: number; currentLevelXp: number; nextLevelXp: number;
}) {
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const percent = level >= 100 ? 100 : Math.max(0, Math.min(100, (totalXp - currentLevelXp) / span * 100));
  return <div className="mb-profile-progress-avatar">
    <div className="mb-profile-progress-ring" role="progressbar" aria-label={`Progresso para o nível ${Math.min(100, level + 1)}`} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} style={{ "--profile-progress": `${percent * 3.6}deg` } as CSSProperties}>
      <Avatar emoji={avatar} size="xl" />
    </div>
    <strong>Nível {level}</strong>
    <span>{title}</span>
  </div>;
}
