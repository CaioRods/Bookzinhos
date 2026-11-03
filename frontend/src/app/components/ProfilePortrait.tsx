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
import { CropArtwork } from "./CropArtwork";
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
  onEditScene,
}: {
  profile: UserProfile;
  theme: SceneTheme;
  progression?: ProgressionSummary | null;
  own?: boolean;
  actions?: ReactNode;
  onEdit?: () => void;
  onChangeScene?: () => void;
  onEditScene?: () => void;
}) {
  const illustrated = theme.id !== "none" && !!theme.imageUrl;
  return (
    <header
      className={`mb-profile-portrait mb-profile-clean ${illustrated ? "has-scenery" : "is-neutral"}`}
    >
      <div className="mb-profile-clean-cover" data-profile-banner data-banner-src={illustrated ? theme.imageUrl : undefined} data-banner-name={theme.name}>
        {illustrated && <div className="mb-profile-portrait-art"><CropArtwork theme={theme} crop={theme.profile} surface="profile" /></div>}
        {own && onChangeScene && <div className="mb-profile-clean-scene-tools">
          <button className="mb-btn" onClick={onChangeScene} aria-label="Alterar cenário" title="Alterar cenário"><Camera size={17}/><span>Cenário</span></button>
          {onEditScene && <button className="mb-btn" onClick={onEditScene} aria-label="Editar cenário atual" title="Editar cenário atual"><Pencil size={17}/></button>}
        </div>}
      </div>
      <div className="mb-profile-portrait-content">
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

            </div>
            <p className="mb-profile-portrait-handle">
              @{profile.handle || profile.username.toLowerCase()}
            </p>
          </div>
        </div>
        {profile.bio && <p className="mb-profile-portrait-bio">{profile.bio}</p>}
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
        <div className="mb-profile-portrait-actions">{actions}</div>
      </div>
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
      className="mb-profile-stat-strip mb-profile-stats-clean"
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

        </div>
      ))}
    </section>
  );
}
