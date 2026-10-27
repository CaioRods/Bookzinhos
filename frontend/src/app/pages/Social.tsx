import { BookDiscoveryPost } from "../components/BookDiscoveryPost";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  MessageCircle, Users, Sparkles, Search, UserPlus, UserCheck, BookOpen, Heart, Rss,
} from "lucide-react";
import { fetchAllUsers, fetchFeed, fetchNotifications, followUser, unfollowUser } from "../lib/api";
import { useLiveData } from "../lib/useLiveData";
import { getUsername } from "../lib/session";
import { getCoverGradient, getFullUrl, timeAgo } from "../lib/types";
import type { FeedItem, Notifications, UserProfile } from "../lib/types";
import { Avatar, EmptyState, PageHeader, SectionHeader, Skeleton, Stars, toast } from "../components/Ui";
import { requireAuth } from "../lib/authGate";

type Tab = "feed" | "leitores";
type Scope = "all" | "following";

export function Social() {
  const navigate = useNavigate();
  const me = getUsername();
  const [tab, setTab] = useState<Tab>("feed");
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");

  const { data: feed, isLoading: feedLoading } = useLiveData<FeedItem[]>(
    (force) => fetchFeed(scope, force),
    [scope],
    { intervalMs: 45000 }
  );

  const { data: users, isLoading: usersLoading, setData: setUsers } = useLiveData<UserProfile[]>(
    (force) => fetchAllUsers(force),
    [],
    { intervalMs: 60000 }
  );

  const { data: notifications } = useLiveData<Notifications>(
    () => fetchNotifications(),
    [],
    { intervalMs: 20000 }
  );

  const others = useMemo(
    () => (users || []).filter((u) => u.username.toLowerCase() !== me?.toLowerCase()),
    [users, me]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? others.filter((u) => u.username.toLowerCase().includes(term) || (u.bio || "").toLowerCase().includes(term))
      : others;
    // Quem ainda não sigo aparece antes — é o que faz descobrir gente nova.
    return [...list].sort((a, b) => Number(!!a.isFollowedByMe) - Number(!!b.isFollowedByMe));
  }, [others, search]);

  const toggleFollow = async (user: UserProfile) => {
    if (!requireAuth("seguir leitores")) return;
    const wasFollowing = !!user.isFollowedByMe;

    setUsers((prev) =>
      prev
        ? prev.map((u) =>
            u.username === user.username
              ? { ...u, isFollowedByMe: !wasFollowing, followers: (u.followers ?? 0) + (wasFollowing ? -1 : 1) }
              : u
          )
        : prev
    );

    try {
      if (wasFollowing) await unfollowUser(user.username);
      else await followUser(user.username);
    } catch (err) {
      setUsers(users);
      toast(err instanceof Error ? err.message : "Não foi possível atualizar.", "error");
    }
  };

  return (
    <div className="mb-screen mb-screen--social mb-social space-y-6">
      <PageHeader
        title="A"
        highlight="comunidade"
        subtitle="Veja o que a rede está lendo, siga leitores e converse sobre os livros."
        icon={<Users className="w-5 h-5" />}
        gradient="linear-gradient(140deg,#4f9e8a,#2f6d5e)"
      />

      <div className="flex gap-1.5 border-b border-[var(--line)] pb-2">
        <button onClick={() => setTab("feed")} className={`mb-btn mb-btn-sm ${tab === "feed" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
          <Rss className="w-4 h-4" /> Feed
        </button>
        <button onClick={() => setTab("leitores")} className={`mb-btn mb-btn-sm ${tab === "leitores" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
          <Users className="w-4 h-4" /> Leitores
          <span className="mb-chip">{others.length}</span>
        </button>
      </div>

      {tab === "feed" ? (
        <section className="space-y-4">
          <div className="flex gap-1.5">
            <button onClick={() => setScope("all")} className={`mb-btn mb-btn-sm ${scope === "all" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
              Tudo
            </button>
            <button onClick={() => setScope("following")} className={`mb-btn mb-btn-sm ${scope === "following" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
              Quem eu sigo
            </button>
          </div>

          {feedLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : !feed || feed.length === 0 ? (
            <EmptyState
              emoji="🌱"
              title={scope === "following" ? "Nada por aqui ainda" : "O feed está quieto"}
              description={
                scope === "following"
                  ? "Siga alguns leitores na aba Leitores para acompanhar as leituras deles."
                  : "Assim que alguém avaliar ou terminar um livro, aparece aqui."
              }
              action={
                scope === "following"
                  ? <button onClick={() => setTab("leitores")} className="mb-btn mb-btn-primary">Encontrar leitores</button>
                  : undefined
              }
            />
          ) : (
            <div className="mb-stagger space-y-3">
              {feed.map((item) => <FeedCard key={item.id} item={item} />)}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leitores…"
              aria-label="Buscar leitores"
              className="mb-input pl-9"
            />
          </div>

          {usersLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState emoji="🔍" title="Nenhum leitor encontrado" />
          ) : (
            <div className="mb-stagger grid gap-3 sm:grid-cols-2">
              {filteredUsers.map((user) => {
                const unread = notifications?.details?.[user.username.toLowerCase()] || 0;
                return (
                  <div key={user.username} className="mb-card mb-card-hover p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar emoji={user.avatar} size="md" username={user.username} />
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--surface)]">
                            {unread}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/user/${encodeURIComponent(user.username)}`}
                          className="flex items-center gap-2 text-[14px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors"
                        >
                          <span className="truncate">{user.username}</span>
                          {user.isAdmin && <span className="mb-chip mb-chip-primary">Admin</span>}
                        </Link>
                        <p className="text-[12.5px] text-[var(--text-3)] line-clamp-2 mt-0.5">
                          {user.bio || "Ainda escrevendo a própria história…"}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="mb-chip">{user.followers ?? 0} seguidores</span>
                          <span className="mb-chip">{user.reviewCount ?? 0} resenhas</span>
                          {!!user.pandinhas && <span className="mb-chip">🐼 {user.pandinhas}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => toggleFollow(user)}
                        className={`mb-btn mb-btn-sm flex-1 ${user.isFollowedByMe ? "mb-btn-outline" : "mb-btn-primary"}`}
                      >
                        {user.isFollowedByMe
                          ? <><UserCheck className="w-4 h-4" /> Seguindo</>
                          : <><UserPlus className="w-4 h-4" /> Seguir</>}
                      </button>
                      <button
                        onClick={() => navigate(`/chat/${encodeURIComponent(user.username)}`)}
                        aria-label={`Conversar com ${user.username}`}
                        className="mb-btn mb-btn-sm mb-btn-outline mb-btn-icon"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-card p-5">
            <SectionHeader
              title="Pandinhas de Amor"
              subtitle="O sistema de indicações do myBooks"
              icon={<Sparkles className="w-[18px] h-[18px] text-[var(--gold)]" />}
            />
            <ul className="space-y-2 text-[13px] text-[var(--text-2)] leading-relaxed list-disc pl-5">
              <li>Indique um livro pelo chat de qualquer leitor da rede.</li>
              <li>Quando a pessoa terminar a leitura, vocês dois ganham <strong>+1 Pandinha</strong>.</li>
              <li>Os Pandinhas ficam visíveis no seu perfil — é o placar de quem espalha boas histórias.</li>
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Cartão do feed ───────────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const cover = getFullUrl(item.book?.coverImagePath);

  const thumb = item.book && (
    <Link to={`/book/${item.book.id}`} className="w-12 aspect-[2/3] rounded-md overflow-hidden flex-shrink-0 shadow-[var(--shadow-1)] bg-[var(--surface-2)]">
      {cover ? (
        <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient({ id: item.book.id, coverColor: item.book.coverColor })}`} />
      )}
    </Link>
  );

  if (item.type === "new-book") return <BookDiscoveryPost item={item} />;

  if (item.type === "finished") {
    return (
      <article className="mb-card mb-card-hover p-4 flex items-center gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-[var(--text-2)]">
            <Link to={`/user/${encodeURIComponent(item.username!)}`} className="font-semibold text-foreground hover:text-[var(--primary)] transition-colors">
              {item.username}
            </Link>{" "}
            terminou de ler
          </p>
          <Link to={`/book/${item.book!.id}`} className="block text-[14px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors truncate mt-0.5">
            {item.book!.title}
          </Link>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Avatar emoji={item.avatar} size="xs" username={item.username} />
          <span className="text-[11.5px] text-[var(--text-3)]">{timeAgo(item.createdAt)}</span>
        </div>
      </article>
    );
  }

  if (item.type === "reading") {
    return (
      <article className="mb-card mb-card-hover p-4 flex items-center gap-3">
        {thumb}
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-[var(--text-2)]">
            <Link to={`/user/${encodeURIComponent(item.username!)}`} className="font-semibold text-foreground hover:text-[var(--primary)] transition-colors">
              {item.username}
            </Link>{" "}
            está lendo
          </p>
          <Link to={`/book/${item.book!.id}`} className="block text-[14px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors truncate mt-0.5">
            {item.book!.title}
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="h-1.5 flex-1 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${item.progress ?? 0}%` }} />
            </span>
            <span className="text-[11.5px] font-semibold text-[var(--text-3)] flex-shrink-0">{item.progress ?? 0}%</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Avatar emoji={item.avatar} size="xs" username={item.username} />
          <span className="text-[11.5px] text-[var(--text-3)]">{timeAgo(item.createdAt)}</span>
        </div>
      </article>
    );
  }

  // Só sobra a avaliação. Sem ela não há cartão — um item malformado do
  // servidor não deve derrubar o feed inteiro.
  const review = item.review;
  if (!review) return null;

  return (
    <article className="mb-card p-4">
      {/* Cabeçalho: avatar, nome, @handle e tempo — como no feed do modelo */}
      <header className="flex items-center gap-3">
        <Avatar emoji={review.avatar} size="sm" username={review.username} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/user/${encodeURIComponent(review.username)}`}
            className="block text-[14px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors truncate"
          >
            {review.username}
          </Link>
          <span className="block text-[12px] text-[var(--text-3)] truncate">@{review.username.toLowerCase()}</span>
        </div>
        <span className="text-[12px] text-[var(--text-3)] flex-shrink-0">{timeAgo(review.createdAt)}</span>
      </header>

      {review.comment && (
        <p className="text-[14px] text-[var(--text-2)] leading-relaxed mt-3">
          {review.hasSpoiler ? "⚠️ Contém spoiler — abra o livro para ler" : review.comment}
        </p>
      )}

      {/* A capa do livro entra grande, como a foto de um post */}
      {item.book && (
        <Link to={`/book/${item.book.id}`} className="block mt-3.5 rounded-[14px] overflow-hidden bg-[var(--surface-2)]">
          <div className="mb-review-book-stage aspect-[16/10] flex items-center justify-center overflow-hidden">
            {cover ? (
              <img src={cover} alt="" loading="lazy" className="mb-feed-review-cover w-full h-full object-contain" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient({ id: item.book.id, coverColor: item.book.coverColor })}`} />
            )}
          </div>
        </Link>
      )}

      {item.book && (
        <p className="text-[12.5px] text-[var(--text-3)] mt-2.5">
          <span className="font-semibold text-[var(--text-2)]">{item.book.title}</span>
          {item.book.author && <> · {item.book.author}</>}
        </p>
      )}

      <div className="flex items-center gap-1 mt-2.5 -ml-2">
        <span className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[13px] font-medium text-[var(--text-3)]">
          <Heart className={`w-[18px] h-[18px] ${review.likedByMe ? "fill-[var(--like)] text-[var(--like)]" : ""}`} />
          {review.likes}
        </span>
        <span className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[13px] font-medium text-[var(--text-3)]">
          <MessageCircle className="w-[18px] h-[18px]" />
          {review.comments.length}
        </span>
        <span className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[13px] text-[var(--text-3)]">
          <Stars value={review.rating} size="sm" />
        </span>
        <Link
          to={`/book/${review.bookId}#avaliar`}
          className="ml-auto inline-flex items-center h-9 px-3 rounded-lg text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors"
        >
          Ver discussão
        </Link>
      </div>
    </article>
  );
}
