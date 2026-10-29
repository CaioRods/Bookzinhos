import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { LogOut, Settings, Shield, UserRound } from "lucide-react";
import type { ProgressionSummary } from "../lib/types";
import { Avatar } from "./Ui";
import { ProfileProgressAvatar } from "./ProfileProgressAvatar";

export function AccountMenu({ avatar, username, admin, progression, onLogout }: {
  avatar: string; username: string; admin: boolean;
  progression?: ProgressionSummary | null; onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);
  const progress = progression ? Math.min(100, Math.max(0, (progression.totalXp - progression.currentLevelXp) / Math.max(1, progression.nextLevelXp - progression.currentLevelXp) * 100)) : 0;
  return <div className="mb-account-menu" ref={root}>
    <button type="button" aria-label={`Conta de ${username}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{progression ? <ProfileProgressAvatar compact avatar={avatar} level={progression.level} title={progression.title} totalXp={progression.totalXp} currentLevelXp={progression.currentLevelXp} nextLevelXp={progression.nextLevelXp} /> : <Avatar emoji={avatar} size="sm" />}</button>
    {open && <div className="mb-account-popover" role="menu">
      <header><Avatar emoji={avatar} size="md" username={username} link={false} /><span><strong>{username}</strong><small>{progression ? `Nível ${progression.level} · ${progression.title}` : "Meu perfil literário"}</small></span></header>
      {progression && <div className="mb-account-xp"><i style={{ width: `${progress}%` }} /></div>}
      <Link role="menuitem" to="/profile"><UserRound /> Perfil</Link>
      <Link role="menuitem" to="/settings"><Settings /> Configurações</Link>
      {admin && <Link role="menuitem" to="/admin"><Shield /> Administrador</Link>}
      <button role="menuitem" onClick={onLogout}><LogOut /> Sair</button>
    </div>}
  </div>;
}
