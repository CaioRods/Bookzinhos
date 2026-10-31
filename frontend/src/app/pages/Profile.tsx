import { ProfilePortrait, ProfileMetrics } from "../components/ProfilePortrait";
import { useThemeCatalog, NO_THEME } from "../lib/themeCatalog";
import { BadgeGallery } from "../components/BadgeGallery";
import { ScenePicker } from "../components/Scenery";
import { useSettings } from "../lib/settings";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Camera, BookOpen, Check, LogOut, Pencil, Smartphone, Star, Users, Loader2, SlidersHorizontal,
} from "lucide-react";
import { fetchBooks, fetchStats, fetchProgression, fetchUserProfile, logout, updateProfile } from "../lib/api";
import { clearSession, getUsername, notifySessionChanged, saveSession } from "../lib/session";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book, Stats, ProgressionSummary, UserProfile as UserProfileType } from "../lib/types";
import { getSavedReaderMode, setSavedReaderMode, type ReaderMode } from "../lib/readerChoice";
import { Avatar, ConfirmDialog, EmptyState, Modal, SectionHeader, Skeleton, toast } from "../components/Ui";
import { CharacterPicker } from "../components/CharacterPicker";
import { BOOK_GENRES } from "../lib/genres";
import { saveProfileTheme } from "../lib/appearanceApi";

const AVATARS = ["🐼", "🐶", "🦊", "🐰", "🐻", "🐨", "🌸", "🎀", "✨", "🦋", "🌷", "📚", "🍡", "🐧", "🦉"];
const MAX_SHELF = 12;

export function Profile() {
  const username = getUsername();
  const [settings] = useSettings();
  const { themes } = useThemeCatalog();
  const profileTheme = themes.find(theme=>theme.id === settings.scene) || NO_THEME;
  const [progression,setProgression] = useState<ProgressionSummary|null>(null);

  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShelf, setIsEditingShelf] = useState(false);
  const [isChoosingCharacter, setIsChoosingCharacter] = useState(false);
  const [isChoosingEmote, setIsChoosingEmote] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [draftBio, setDraftBio] = useState("");
  const [draftAvatar, setDraftAvatar] = useState("🐼");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [draftHandle, setDraftHandle] = useState("");
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftInstagram, setDraftInstagram] = useState("");
  const [draftTiktok, setDraftTiktok] = useState("");
  const [draftShelf, setDraftShelf] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [readerMode, setReaderMode] = useState<ReaderMode | null>(() => getSavedReaderMode());

  useEffect(() => {
    if (!username) {
      setIsLoading(false);
      return;
    }
    let active = true;
    Promise.all([
      fetchUserProfile(username, true).catch(() => null),
      fetchBooks().catch(() => [] as Book[]),
      fetchStats().catch(() => null),
      fetchProgression(username).catch(()=>null),
    ]).then(([p, b, s, level]) => {
      if (!active) return;
      setProgression(level);
      setProfile(p);
      setBooks(b || []);
      setStats(s);
      if (p) {
        setDraftBio(p.bio || "");
        setDraftAvatar(p.avatar || "🐼");
        setDraftDisplayName(p.displayName || p.username);
        setDraftHandle(p.handle || p.username.toLowerCase());
        setDraftGenres(p.favoriteGenres || []);
        setDraftInstagram(p.instagram || "");
        setDraftTiktok(p.tiktok || "");
        setDraftShelf(p.shelf || []);
        saveSession(p);
        notifySessionChanged();
      }
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [username]);

  useEffect(()=>{const refresh=(event:Event)=>{if((event as CustomEvent<{username:string}>).detail?.username?.toLowerCase()===username?.toLowerCase() && username) fetchProgression(username,true).then(setProgression).catch(()=>{});};window.addEventListener("mybooks:progression-updated",refresh);return()=>window.removeEventListener("mybooks:progression-updated",refresh);},[username]);

  useEffect(() => {
    if (username) saveProfileTheme(settings.scene).catch(() => {});
  }, [username, settings.scene]);

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const shelfBooks = (profile?.shelf || []).map((id) => byId.get(id)).filter(Boolean) as Book[];

  const persist = async (bio: string, avatar: string, shelf: string[], identity?: { displayName: string; handle: string; favoriteGenres: string[]; instagram?: string; tiktok?: string }) => {
    setIsSaving(true);
    try {
      const updated = await updateProfile({ bio, avatar, shelf, ...identity });
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
    if (await persist(draftBio.trim(), draftAvatar, profile?.shelf || [], { displayName: draftDisplayName.trim(), handle: draftHandle.trim(), favoriteGenres: draftGenres, instagram: draftInstagram, tiktok: draftTiktok })) setIsEditing(false);
  };

  const saveShelf = async () => {
    if (await persist(profile?.bio || "", profile?.avatar || "🐼", draftShelf, { displayName: profile?.displayName || profile?.username || "Leitor", handle: profile?.handle || profile?.username || "leitor", favoriteGenres: profile?.favoriteGenres || [], instagram: profile?.instagram, tiktok: profile?.tiktok })) setIsEditingShelf(false);
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

  const handleLogout = async () => {
    try { await logout(); } finally { clearSession(); window.location.href = "/"; }
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


  return (
    <div className="mb-profile mb-profile-cinematic">
      <ProfilePortrait profile={profile} theme={profileTheme} progression={progression} own
        onEdit={()=>setIsEditing(true)}
        onChangeScene={()=>{window.dispatchEvent(new Event("mybooks:open-personalization"));}}
        actions={<button onClick={()=>setIsEditing(true)} className="mb-btn"><Pencil size={16}/>Editar perfil</button>} />
      <div className="mb-profile-cinematic-body">
      <ProfileMetrics addedBooks={profile.stats?.uploaded ?? progression?.stats?.published ?? 0} reading={stats?.reading ?? profile.stats?.reading ?? 0} finished={stats?.finished ?? profile.stats?.finished ?? 0} favorites={profile.savedIds?.length ?? profile.stats?.saved ?? 0} followers={profile.followers ?? stats?.followers ?? 0} following={profile.following ?? stats?.following ?? 0}/>
      <ScenePicker />

      {progression && progression.badges.length>0 && <BadgeGallery badges={progression.badges}/>}
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

      </div>
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
          <div className="grid sm:grid-cols-2 gap-3"><label className="mb-label">Nome<input className="mb-input mt-1" value={draftDisplayName} maxLength={60} onChange={(event) => setDraftDisplayName(event.target.value)} /></label><label className="mb-label">@ do perfil<input className="mb-input mt-1" value={draftHandle} maxLength={20} disabled={!!profile.nextHandleChangeAt && profile.nextHandleChangeAt > Date.now()} onChange={(event) => setDraftHandle(event.target.value.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase())} />{profile.nextHandleChangeAt && profile.nextHandleChangeAt > Date.now() ? <small className="block mt-1 text-[var(--text-3)]">Nova alteração em {new Date(profile.nextHandleChangeAt).toLocaleDateString("pt-BR")}.</small> : <small className="block mt-1 text-[var(--text-3)]">Depois de salvar, só poderá trocar novamente em 30 dias.</small>}</label></div>
          <div className="grid sm:grid-cols-2 gap-3"><label className="mb-label">Instagram<input className="mb-input mt-1" value={draftInstagram} onChange={(event) => setDraftInstagram(event.target.value)} placeholder="@seuinstagram" /></label><label className="mb-label">TikTok<input className="mb-input mt-1" value={draftTiktok} onChange={(event) => setDraftTiktok(event.target.value)} placeholder="@seutiktok" /></label></div>
          <div>
            <span className="mb-label">Avatar</span>
            <div className="flex items-center gap-3 mt-2"><Avatar emoji={draftAvatar} size="lg" /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setIsChoosingCharacter(true)} className="mb-btn mb-btn-outline mb-btn-sm"><Camera size={15} /> Personagens</button><button type="button" onClick={() => setIsChoosingEmote(true)} className="mb-btn mb-btn-outline mb-btn-sm">✨ Emotes</button></div></div>
          </div>
          <div><span className="mb-label">Gêneros favoritos</span><div className="flex flex-wrap gap-1.5 mt-2">{BOOK_GENRES.filter((genre) => genre !== "Outros").map((genre) => <button type="button" key={genre} onClick={() => setDraftGenres((old) => old.includes(genre) ? old.filter((item) => item !== genre) : old.length < 12 ? [...old, genre] : old)} className={`mb-chip ${draftGenres.includes(genre) ? "mb-chip-primary" : ""}`}>{genre}</button>)}</div></div>
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

      <Modal open={isChoosingCharacter} onClose={() => setIsChoosingCharacter(false)} title="Escolha um personagem" description="Fotos adicionadas pela curadoria do myBooks." size="lg"><CharacterPicker value={draftAvatar} onChange={(imageUrl) => { setDraftAvatar(imageUrl); setIsChoosingCharacter(false); }} /></Modal>
      <Modal open={isChoosingEmote} onClose={() => setIsChoosingEmote(false)} title="Escolha um emote" description="Um símbolo simples para representar você."><div className="grid grid-cols-6 gap-2">{AVATARS.map((emote) => <button type="button" key={emote} onClick={() => { setDraftAvatar(emote); setIsChoosingEmote(false); }} className={`aspect-square rounded-xl text-2xl ${draftAvatar === emote ? "bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]" : "bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"}`}>{emote}</button>)}</div></Modal>

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
