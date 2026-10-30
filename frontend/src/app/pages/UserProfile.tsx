import { ProfilePortrait, ProfileMetrics } from "../components/ProfilePortrait";
import { usePublicProfileScene } from "../lib/profileScene";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, Star } from "lucide-react";
import { fetchBooks, fetchProgression, fetchUserProfile, followUser, unfollowUser } from "../lib/api";
import { useLiveData } from "../lib/useLiveData";
import { getUsername } from "../lib/session";
import { requireAuth } from "../lib/authGate";
import { getCoverGradient, getFullUrl, timeAgo } from "../lib/types";
import type { Book, ProgressionSummary, UserProfile as UserProfileType } from "../lib/types";
import { Avatar, EmptyState, Skeleton, Stars, toast } from "../components/Ui";
import { fetchProfileTheme } from "../lib/appearanceApi";
import { DEFAULT_THEMES, NO_THEME } from "../lib/themeCatalog";
import { accentVariables, type SceneTheme } from "../lib/appearance";
import { BadgeGallery } from "../components/BadgeGallery";

type Tab = "resenhas" | "estante" | "lidos" | "favoritos";

export function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const me = getUsername();
  const [tab, setTab] = useState<Tab>("resenhas");

  const { data, isLoading, setData, reload } = useLiveData<{ profile: UserProfileType | null; books: Book[]; profileTheme: SceneTheme | null; progression: ProgressionSummary | null }>(
    async (force) => {
      const [profile, books, remoteTheme, progression] = await Promise.all([
        fetchUserProfile(username!, force),
        fetchBooks(force),
        fetchProfileTheme(username!).catch(() => null),
        fetchProgression(username!, force).catch(() => null),
      ]);
      const profileTheme = remoteTheme && "mainColor" in remoteTheme ? remoteTheme : DEFAULT_THEMES.find((theme) => theme.id === remoteTheme?.id || theme.id === profile?.themeId) || DEFAULT_THEMES[0];
      return { profile, books, profileTheme, progression };
    },
    [username],
    { intervalMs: 60000 }
  );
  useEffect(() => {
    const refresh = (event: Event) => {
      const changed = (event as CustomEvent<{ username: string }>).detail?.username;
      if (changed?.toLowerCase() === username?.toLowerCase()) void reload();
    };
    window.addEventListener("mybooks:progression-updated", refresh);
    return () => window.removeEventListener("mybooks:progression-updated", refresh);
  }, [reload, username]);

  const profile = data?.profile ?? null;
  const books = data?.books ?? [];
  const profileTheme = data?.profileTheme || NO_THEME;
  const progression = data?.progression || null;
  usePublicProfileScene(data?.profileTheme || null);
  const isMe = profile?.username.toLowerCase() === me?.toLowerCase();

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const pick = (ids?: string[]) => (ids || []).map((id) => byId.get(id)).filter(Boolean) as Book[];

  const shelfBooks = pick(profile?.shelf);
  const finishedBooks = pick(profile?.finishedIds);
  const savedBooks = pick(profile?.savedIds);

  const toggleFollow = async () => {
    if (!profile) return;
    if (!requireAuth("seguir leitores")) return;
    const wasFollowing = !!profile.isFollowedByMe;

    setData((prev) =>
      prev && prev.profile
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              isFollowedByMe: !wasFollowing,
              followers: (prev.profile.followers ?? 0) + (wasFollowing ? -1 : 1),
            },
          }
        : prev
    );

    try {
      if (wasFollowing) await unfollowUser(profile.username);
      else await followUser(profile.username);
    } catch (err) {
      setData(data);
      toast(err instanceof Error ? err.message : "Não foi possível atualizar.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="mb-screen mb-screen--narrow mb-userprofile space-y-5">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">🐾</div>
          <h2 className="text-lg font-bold text-foreground">Leitor não encontrado</h2>
          <button onClick={() => navigate(-1)} className="mb-btn mb-btn-primary">Voltar</button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "resenhas", label: "Resenhas", count: profile.reviews?.length ?? 0 },
    { key: "estante", label: "Estante", count: shelfBooks.length },
    { key: "lidos", label: "Lidos", count: finishedBooks.length },
    { key: "favoritos", label: "Favoritos", count: savedBooks.length },
  ];

  return (
    <div className="mb-userprofile mb-profile-cinematic" style={accentVariables(profileTheme.mainColor, document.documentElement.classList.contains("dark")) as CSSProperties}>
      <ProfilePortrait profile={profile} theme={profileTheme} progression={progression} own={isMe}
        actions={isMe ? <Link to="/profile" className="mb-btn">Editar meu perfil</Link> : <><button onClick={toggleFollow} aria-pressed={!!profile.isFollowedByMe} className="mb-btn">{profile.isFollowedByMe ? <><UserCheck size={17}/>Seguindo</> : <><UserPlus size={17}/>Seguir</>}</button><Link to={`/chat/${encodeURIComponent(profile.username)}`} state={{chatOrigin:`/user/${encodeURIComponent(profile.username)}`}} className="mb-btn"><MessageCircle size={17}/>Conversar</Link></>} />
      <div className="mb-profile-cinematic-body">
      <ProfileMetrics addedBooks={profile.stats?.uploaded ?? 0} reading={profile.stats?.reading ?? profile.reading?.length ?? 0} finished={profile.stats?.finished ?? finishedBooks.length} favorites={profile.stats?.saved ?? savedBooks.length} followers={profile.followers ?? 0} following={profile.following ?? 0}/>
      <button onClick={()=>navigate(-1)} className="mb-profile-back mb-btn mb-btn-ghost mb-btn-sm"><ArrowLeft size={15}/> Voltar</button>
      {progression && <div className="mb-public-progression-grid mb-public-progression-grid--badges"><BadgeGallery badges={progression.badges} /></div>}

      {/* ── Abas ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-[var(--line)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`mb-btn mb-btn-sm ${tab === t.key ? "mb-btn-soft" : "mb-btn-ghost"}`}
          >
            {t.label} <span className="mb-chip">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "resenhas" && (
        (profile.reviews || []).length === 0 ? (
          <EmptyState emoji="✍️" title="Nenhuma resenha ainda" description={`${profile.username} ainda não avaliou nenhum livro.`} />
        ) : (
          <div className="space-y-3">
            {profile.reviews!.map((review) => (
              <Link
                key={review.id}
                to={`/book/${review.bookId}#avaliar`}
                className="mb-card mb-card-hover p-4 flex items-start gap-4"
              >
                {review.book && (
                  <div className="w-16 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 self-start shadow-[var(--shadow-book)] bg-[var(--surface-2)]">
                    {review.book.coverImagePath ? (
                      <img src={getFullUrl(review.book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient({ id: review.book.id, coverColor: review.book.coverColor })} flex items-center justify-center p-1.5`}>
                        <span className="text-[9px] font-bold text-black/45 text-center line-clamp-3">{review.book.title}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-foreground truncate">{review.book?.title || "Livro"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Stars value={review.rating} size="sm" />
                    <span className="text-[11.5px] text-[var(--text-3)]">{timeAgo(review.createdAt)}</span>
                  </div>
                  {review.comment && (
                    <p className="text-[13px] text-[var(--text-2)] leading-relaxed mt-1.5 line-clamp-3">
                      {review.hasSpoiler ? "⚠️ Contém spoiler — abra para ler" : review.comment}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11.5px] text-[var(--text-3)]">
                    <span>❤️ {review.likes}</span>
                    <span>💬 {review.comments.length}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "estante" && <BookGrid books={shelfBooks} emptyLabel="A estante está vazia." />}
      {tab === "lidos" && <BookGrid books={finishedBooks} emptyLabel="Nenhum livro concluído ainda." />}
      {tab === "favoritos" && <BookGrid books={savedBooks} emptyLabel="Nenhum favorito por aqui." />}
      </div>
    </div>
  );
}

function BookGrid({ books, emptyLabel }: { books: Book[]; emptyLabel: string }) {
  if (books.length === 0) return <EmptyState emoji="📚" title={emptyLabel} />;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-5">
      {books.map((book) => (
        <Link key={book.id} to={`/book/${book.id}`} className="group">
          <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow-[var(--shadow-book)] bg-[var(--surface-2)] transition-transform duration-200 group-hover:-translate-y-1">
            {book.coverImagePath ? (
              <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)} flex items-center justify-center p-2`}>
                <span className="text-[10px] font-bold text-black/45 text-center line-clamp-3">{book.title}</span>
              </div>
            )}
          </div>
          <p className="text-[12px] font-semibold text-foreground line-clamp-2 mt-2 leading-snug">{book.title}</p>
          {book.rating > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)] mt-0.5">
              <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" /> {book.rating.toFixed(1)}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
