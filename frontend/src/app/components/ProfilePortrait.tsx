import type { ReactNode } from "react";
import {
  Camera,
  Pencil,
  Instagram,
  BookOpen,
  Clock3,
  Check,
  Heart,
  Users,
  UserPlus,
} from "lucide-react";
import type { ProgressionSummary, UserProfile } from "../lib/types";
import type { SceneTheme } from "../lib/appearance";
import { ThemeImage } from "./ThemeImage";
import { Avatar } from "./Ui";
import { ProfileProgressAvatar } from "./ProfileProgressAvatar";

export function ProfilePortrait({
  profile,
  theme,
  progression,
  own = false,
  actions,
  onEdit,
  onChangeScene,
}: {
  profile: UserProfile;
  theme: SceneTheme;
  progression?: ProgressionSummary | null;
  own?: boolean;
  actions?: ReactNode;
  onEdit?: () => void;
  onChangeScene?: () => void;
}) {
  const illustrated = theme.id !== "none" && !!theme.imageUrl;
  return (
    <header
      data-profile-banner
      className={`mb-profile-portrait ${illustrated ? "has-scenery" : "is-neutral"}`}
    >
      {illustrated && (
        <div className="mb-profile-portrait-art">
          <ThemeImage theme={theme} crop={theme.profile} />
        </div>
      )}
      <div className="mb-profile-portrait-shade" />
      <div className="mb-profile-portrait-content">
        <p className="mb-profile-portrait-kicker">
          {own ? "MEU PERFIL" : "UM LEITOR, MUITAS HISTÓRIAS"}
        </p>
        <div className="mb-profile-portrait-identity">
          <div className="mb-profile-portrait-avatar">
            {progression ? (
              <ProfileProgressAvatar
                avatar={profile.avatar}
                level={progression.level}
                title={progression.title}
                {...(own
                  ? {
                      totalXp: progression.totalXp,
                      currentLevelXp: progression.currentLevelXp,
                      nextLevelXp: progression.nextLevelXp,
                    }
                  : {})}
              />
            ) : (
              <Avatar emoji={profile.avatar} size="hero" link={false} />
            )}
            {own && onEdit && (
              <button
                className="mb-profile-avatar-edit"
                aria-label="Editar avatar e perfil"
                onClick={onEdit}
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
          <div className="mb-profile-portrait-details">
            <div className="mb-profile-portrait-name">
              <h1>{profile.displayName || profile.username}</h1>
              <div className="mb-profile-portrait-actions">{actions}</div>
            </div>
            <p className="mb-profile-portrait-handle">
              @{profile.handle || profile.username.toLowerCase()}
            </p>
            <p className="mb-profile-portrait-bio">
              {profile.bio || progression?.title || "Novo leitor por aqui ✨"}
            </p>
            <div className="mb-profile-portrait-socials">
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Instagram size={16} />
                  Instagram · @{profile.instagram.replace(/^@/, "")}
                </a>
              )}
              {profile.tiktok && (
                <a
                  href={`https://tiktok.com/@${profile.tiktok.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span aria-hidden="true">♪</span>TikTok · @
                  {profile.tiktok.replace(/^@/, "")}
                </a>
              )}
              {!!profile.pandinhas && (
                <span className="mb-profile-pandinha">
                  🐼 {profile.pandinhas}{" "}
                  {profile.pandinhas === 1 ? "Pandinha" : "Pandinhas"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <blockquote>
        “Boas histórias
        <br />
        nos levam mais longe.”
      </blockquote>
      {own && onChangeScene && (
        <button className="mb-profile-change-scene" onClick={onChangeScene}>
          <Camera size={17} />
          Alterar cenário
        </button>
      )}
    </header>
  );
}
export function ProfileMetrics({
  addedBooks,
  reading,
  finished,
  favorites,
  followers,
  following,
}: {
  addedBooks: number;
  reading: number;
  finished: number;
  favorites: number;
  followers: number;
  following: number;
}) {
  const items = [
    { label: "Livros adicionados", value: addedBooks, icon: BookOpen },
    { label: "Lendo no momento", value: reading, icon: Clock3 },
    { label: "Livros concluídos", value: finished, icon: Check },
    { label: "Favoritos", value: favorites, icon: Heart },
    { label: "Seguidores", value: followers, icon: Users },
    { label: "Seguindo", value: following, icon: UserPlus },
  ];
  return (
    <section
      className="mb-profile-stat-strip"
      aria-label="Estatísticas do leitor"
    >
      {items.map(({ label, value, icon: Icon }, index) => (
        <div
          key={label}
          className={`mb-profile-stat mb-profile-stat--${index}`}
        >
          <Icon size={25} />
          <div>
            <strong>{value.toLocaleString("pt-BR")}</strong>
            <span>{label}</span>
          </div>
          <div className="mb-profile-stat-art" aria-hidden="true" />
        </div>
      ))}
    </section>
  );
}
