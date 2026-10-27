import { Scenery, ScenePicker } from "../components/Scenery";
import { useSettings } from "../lib/settings";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Camera, Clock3, Heart, UserPlus, BookOpen, Check, LogOut, Pencil, Smartphone, ExternalLink, Star, Users, Loader2, SlidersHorizontal,
} from "lucide-react";
import { fetchBooks, fetchStats, fetchUserProfile, updateProfile } from "../lib/api";
import { clearSession, getUsername, notifySessionChanged, saveSession } from "../lib/session";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book, Stats, UserProfile as UserProfileType } from "../lib/types";
import { getSavedReaderMode, setSavedReaderMode, type ReaderMode } from "../lib/readerChoice";
import { Avatar, ConfirmDialog, EmptyState, Modal, SectionHeader, Skeleton, toast } from "../components/Ui";

const AVATARS = ["🐼", "🐶", "🦊", "🐰", "🐻", "🐨", "🌸", "🎀", "✨", "🦋", "🌷", "📚", "🍡", "🐧", "🦉"];
const MAX_SHELF = 12;

export function Profile() {
  const username = getUsername();
  const [settings] = useSettings();

  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShelf, setIsEditingShelf] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [draftBio, setDraftBio] = useState("");
  const [draftAvatar, setDraftAvatar] = useState("🐼");
  const [draftShelf, setDraftShelf] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [readerMode, setReaderMode] = useState<ReaderMode | null>(() => getSavedReaderMode());

  useEffect(() => {
    if (!username) {
      setIsLoading(false);
      return;
    }
    Promise.all([
      fetchUserProfile(username, true).catch(() => null),
      fetchBooks().catch(() => [] as Book[]),
      fetchStats().catch(() => null),
    ]).then(([p, b, s]) => {
      setProfile(p);
      setBooks(b || []);
      setStats(s);
      if (p) {
        setDraftBio(p.bio || "");
        setDraftAvatar(p.avatar || "🐼");
        setDraftShelf(p.shelf || []);
        saveSession(p);
        notifySessionChanged();
      }
      setIsLoading(false);
    });
  }, [username]);

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const shelfBooks = (profile?.shelf || []).map((id) => byId.get(id)).filter(Boolean) as Book[];

  const persist = async (bio: string, avatar: string, shelf: string[]) => {
    setIsSaving(true);
    try {
      const updated = await updateProfile(bio, avatar, shelf);
      setProfile(updated);
      saveSession(updated);
      notifySessionChanged();
      toast("Perfil atualizado.");
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfileEdits = async () => {
    if (await persist(draftBio.trim(), draftAvatar, profile?.shelf || [])) setIsEditing(false);
  };

  const saveShelf = async () => {
    if (await persist(profile?.bio || "", profile?.avatar || "🐼", draftShelf)) setIsEditingShelf(false);
  };

  const toggleShelfBook = (id: string) => {
    setDraftShelf((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SHELF) {
        toast(`A estante cabe ${MAX_SHELF} livros.`, "error");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleLogout = () => {
    clearSession();
    window.location.href = "/";
  };

  const changeReaderMode = (mode: ReaderMode | null) => {
    setSavedReaderMode(mode);
    setReaderMode(mode);
  };

  if (isLoading) {
    return (
      <div className="mb-screen mb-screen--narrow mb-profile space-y-5">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mb-screen mb-screen--narrow mb-profile">
        <EmptyState emoji="👤" title="Perfil indisponível" description="Não conseguimos carregar seus dados. Tente entrar novamente." />
      </div>
    );
  }

  const statCards = [
    { label: "Livros na biblioteca", value: books.length, icon: BookOpen },
    { label: "Lendo no momento", value: stats?.reading ?? 0, icon: Clock3 },
    { label: "Livros concluídos", value: stats?.finished ?? 0, icon: Check },
    { label: "Favoritos", value: profile.savedIds?.length ?? profile.stats?.saved ?? 0, icon: Heart },
    { label: "Seguidores", value: profile.followers ?? stats?.followers ?? 0, icon: Users },
    { label: "Seguindo", value: profile.following ?? stats?.following ?? 0, icon: UserPlus },
  ];

  return (
    <div className="mb-screen mb-screen--narrow mb-profile space-y-6">
      <p className="mb-eyebrow mb-profile-kicker">MEU PERFIL</p>
      <header className="mb-reference-profile">
        <Avatar emoji={profile.avatar} size="hero" />
        <div className="min-w-0">
          <div className="mb-profile-name-row"><h1>{profile.username}</h1><button onClick={() => setIsEditing(true)} className="mb-btn mb-btn-soft"><Pencil size={16} /> Editar perfil</button></div>
          <p className="mb-profile-handle">@{profile.username.toLowerCase()}</p>
          <p className="mb-profile-bio">{profile.bio || "Lendo um capítulo de cada vez."}</p>
        </div>
      </header>
      <div className="mb-profile-landscape">
        <Scenery scene={settings.scene} />
        <blockquote>“Boas histórias<br />nos levam mais longe.”<span /></blockquote>
        <button className="mb-btn" onClick={() => document.getElementById("profile-scenery")?.scrollIntoView({ behavior: settings.reduceMotion ? "instant" : "smooth", block: "center" })}><Camera size={17} /> Alterar cenário</button>
      </div>
      <div className="mb-profile-metrics">{statCards.map(({ label, value, icon: Icon }) => <div key={label}><Icon size={25} /><span><strong>{value}</strong><small>{label}</small></span></div>)}</div>
      <ScenePicker />

      {/* ── Estante em destaque ────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Minha estante"
          subtitle="Os livros que aparecem no seu perfil público"
          icon={<BookOpen className="w-[18px] h-[18px] text-[var(--primary)]" />}
          action={
            <button
              onClick={() => { setDraftShelf(profile.shelf || []); setIsEditingShelf(true); }}
              className="mb-btn mb-btn-outline mb-btn-sm"
            >
              <Pencil className="w-3.5 h-3.5" /> Organizar
            </button>
          }
        />
        {shelfBooks.length === 0 ? (
          <EmptyState
            emoji="🪴"
            title="Estante vazia"
            description="Escolha os livros que representam você — eles aparecem para quem visita seu perfil."
            action={
              <button
                onClick={() => { setDraftShelf([]); setIsEditingShelf(true); }}
                className="mb-btn mb-btn-primary"
              >
                Montar estante
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-5">
            {shelfBooks.map((book) => (
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
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Preferências ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Preferências" icon={<Smartphone className="w-[18px] h-[18px] text-[var(--text-3)]" />} />
        <div className="mb-card p-5 space-y-4">
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">Como abrir os PDFs</p>
            <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">
              O leitor do app guarda progresso e capítulos; o do sistema abre no visualizador do aparelho.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {([
                { key: "app" as ReaderMode, label: "Leitor do app" },
                { key: "native" as ReaderMode, label: "Leitor do sistema" },
                { key: null, label: "Perguntar sempre" },
              ]).map((option) => (
                <button
                  key={option.label}
                  onClick={() => changeReaderMode(option.key)}
                  className={`mb-btn mb-btn-sm ${readerMode === option.key ? "mb-btn-primary" : "mb-btn-outline"}`}
                >
                  {readerMode === option.key && <Check className="w-3.5 h-3.5" />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--line)] flex flex-wrap gap-2">
            <Link to="/social" className="mb-btn mb-btn-outline mb-btn-sm">
              <Users className="w-3.5 h-3.5" /> Comunidade
            </Link>
            <Link to="/notes" className="mb-btn mb-btn-outline mb-btn-sm">
              <Star className="w-3.5 h-3.5" /> Meu diário
            </Link>
            <Link to="/settings" className="mb-btn mb-btn-outline mb-btn-sm">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Configurações
            </Link>
            {profile.isAdmin && (
              <Link to="/admin" className="mb-btn mb-btn-soft mb-btn-sm">🐶 Painel do Admin</Link>
            )}
          </div>

          {/* Sair fica sozinho, vermelho e largo — impossível não achar. */}
          <button
            onClick={() => setConfirmLogout(true)}
            className="mb-btn mb-btn-danger w-full h-12 rounded-[14px] mt-3 text-[14px]"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sair da conta
          </button>
        </div>
      </section>

      {/* ── Editar perfil ──────────────────────────────────────────────────── */}
      <Modal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        title="Editar perfil"
        description="Seu avatar e bio aparecem para toda a comunidade."
        footer={
          <>
            <button onClick={() => setIsEditing(false)} disabled={isSaving} className="mb-btn mb-btn-outline">Cancelar</button>
            <button onClick={saveProfileEdits} disabled={isSaving} className="mb-btn mb-btn-primary">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="mb-label">Avatar</span>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setDraftAvatar(a)}
                  className={`text-xl w-11 h-11 rounded-xl transition-colors cursor-pointer ${
                    draftAvatar === a ? "bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]/40" : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="profile-bio" className="mb-label">Bio</label>
            <textarea
              id="profile-bio"
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="O que você gosta de ler?"
              className="mb-input resize-none"
            />
            <p className="text-[11.5px] text-[var(--text-3)] text-right mt-1">{draftBio.length}/200</p>
          </div>
        </div>
      </Modal>

      {/* ── Organizar estante ──────────────────────────────────────────────── */}
      <Modal
        open={isEditingShelf}
        onClose={() => setIsEditingShelf(false)}
        title="Organizar estante"
        description={`Escolha até ${MAX_SHELF} livros — ${draftShelf.length} selecionados.`}
        size="lg"
        footer={
          <>
            <button onClick={() => setIsEditingShelf(false)} disabled={isSaving} className="mb-btn mb-btn-outline">Cancelar</button>
            <button onClick={saveShelf} disabled={isSaving} className="mb-btn mb-btn-primary">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar estante
            </button>
          </>
        }
      >
        {books.length === 0 ? (
          <p className="text-[13px] text-[var(--text-3)] text-center py-8">Nenhum livro disponível ainda.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {books.map((book) => {
              const selected = draftShelf.includes(book.id);
              return (
                <button
                  key={book.id}
                  onClick={() => toggleShelfBook(book.id)}
                  className="text-left cursor-pointer"
                  aria-pressed={selected}
                >
                  <div
                    className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-[var(--surface-2)] transition-all ${
                      selected ? "ring-2 ring-[var(--primary)]" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {book.coverImagePath ? (
                      <img src={getFullUrl(book.coverImagePath)!} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)}`} />
                    )}
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] font-semibold text-foreground line-clamp-2 mt-1.5 leading-snug">{book.title}</p>
                </button>
              );
            })}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta?"
        description="Você precisará entrar de novo com usuário e senha."
        confirmLabel="Sair"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
