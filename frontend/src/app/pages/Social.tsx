import { CommunityTimeline } from "../components/Community";
import { ReadingPost } from "../components/ReadingPost";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  MessageCircle, Users, Sparkles, Search, UserPlus, UserCheck, Rss,
} from "lucide-react";
import { fetchAllUsers, fetchFeed, fetchNotifications, followUser, unfollowUser } from "../lib/api";
import { useLiveData } from "../lib/useLiveData";
import { getUsername } from "../lib/session";
import type { FeedItem, Notifications, UserProfile } from "../lib/types";
import { Avatar, EmptyState, PageHeader, SectionHeader, Skeleton, toast } from "../components/Ui";
import { requireAuth } from "../lib/authGate";

type Tab = "feed" | "leitores" | "atividade";
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
      ? others.filter((u) => [u.username, u.displayName, u.handle, u.bio].some((value) => (value || "").toLowerCase().includes(term)))
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
        title="Comunidade"
        subtitle="Veja o que a rede está lendo, siga leitores e converse sobre os livros."
        icon={<Users className="w-5 h-5" />}
        gradient="linear-gradient(140deg,#4f9e8a,#2f6d5e)"
      />

      <div className="flex gap-1.5 border-b border-[var(--line)] pb-2">
        <button onClick={() => setTab("feed")} className={`mb-btn mb-btn-sm ${tab === "feed" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
          <Rss className="w-4 h-4" /> Feed
        </button>
        <button onClick={() => setTab("atividade")} className={`mb-btn mb-btn-sm ${tab === "atividade" ? "mb-btn-soft" : "mb-btn-ghost"}`}>Leituras</button>
        <button onClick={() => setTab("leitores")} className={`mb-btn mb-btn-sm ${tab === "leitores" ? "mb-btn-soft" : "mb-btn-ghost"}`}>
          <Users className="w-4 h-4" /> Leitores
          <span className="mb-chip">{others.length}</span>
        </button>
      </div>

      <div className="mb-social-columns"><div className="min-w-0">
      {tab === "feed" ? <><div className="mb-social-scopes"><button className={`mb-btn ${scope === "all" ? "mb-btn-soft" : "mb-btn-ghost"}`} onClick={()=>setScope("all")}>Para você</button><button className={`mb-btn ${scope === "following" ? "mb-btn-soft" : "mb-btn-ghost"}`} onClick={()=>setScope("following")}>Seguindo</button></div><CommunityTimeline scope={scope}/></> : tab === "atividade" ? (
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
              {feed.map((item) => <ReadingPost key={item.id} item={item} />)}
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
                          <span className="truncate">{user.displayName || user.username}</span>
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
                        onClick={() => navigate(`/chat/${encodeURIComponent(user.username)}`, { state: { chatOrigin: "/social" } })}
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
      </div><aside className="mb-community-rail">
        <section className="mb-card"><header><h2>Leitores em destaque</h2><button onClick={() => setTab("leitores")}>Ver todos</button></header>
          {others.length === 0 ? <p className="mb-rail-empty">Os próximos leitores aparecem aqui.</p> : others.slice(0, 5).map(user => <div className="mb-suggested-reader" key={user.username}><Avatar emoji={user.avatar} size="sm" username={user.username} /><Link to={`/user/${encodeURIComponent(user.username)}`}><strong>{user.displayName || user.username}</strong><small>@{user.handle || user.username.toLowerCase()}</small></Link><button onClick={() => toggleFollow(user)} className={user.isFollowedByMe ? "is-following" : ""}>{user.isFollowedByMe ? "Seguindo" : "Seguir"}</button></div>)}
        </section>
        <section className="mb-card"><header><h2>Discussões em alta</h2><button onClick={() => { setTab("feed"); setScope("all"); }}>Ver todas</button></header>
          {(feed || []).filter(item => item.review && item.book && item.review.comments.length > 0).sort((a,b) => (b.review?.comments.length || 0) - (a.review?.comments.length || 0)).slice(0, 5).map(item => <Link key={item.id} to={`/book/${item.book!.id}#avaliar`} className="mb-discussion-link"><MessageCircle size={18} /><span><strong>{item.book!.title}</strong><small>{item.review?.hasSpoiler ? "Discussão com spoilers" : item.review?.comment || "Converse sobre este livro"}</small></span><small>{item.review!.comments.length}</small></Link>)}
          {!(feed || []).some(item => item.review && item.review.comments.length > 0) && <p className="mb-rail-empty">Uma boa conversa começa com a sua próxima resenha.</p>}
        </section>
        <section className="mb-community-invitation"><h2>Conecte-se<br />com outros leitores</h2><p>Compartilhe suas leituras, descubra novos livros e encontre sua comunidade.</p><button onClick={() => setTab("leitores")} className="mb-btn mb-btn-outline">Encontrar leitores</button></section>
      </aside></div>
    </div>
  );
}
