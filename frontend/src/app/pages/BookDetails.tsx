import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, BookOpen, BookOpenCheck, Play, Share2, CheckCircle, Users, FileText,
  Bookmark, ChevronDown, Star,
} from "lucide-react";
import {
  fetchAllUsers, fetchBook, fetchProgress, fetchSavedIds, saveProgress, sendMessage, toggleSaved,
} from "../lib/api";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book, ReadingProgress, Review, UserProfile } from "../lib/types";
import { getUsername } from "../lib/session";
import { requireAuth } from "../lib/authGate";
import { useOpenBook } from "../lib/readerChoice";
import { ReviewSection } from "../components/ReviewSection";
import { useSpineColor } from "../components/Book3D";
import { Avatar, Modal, Skeleton, Stars, toast } from "../components/Ui";

export function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const openBook = useOpenBook();
  const myUsername = getUsername();

  const [book, setBook] = useState<Book | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [tab, setTab] = useState<"sobre" | "avaliacoes">("sobre");
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // A página inteira se tinge com a cor dominante da capa: sobrescrevemos os
  // tokens da marca aqui, e cabeçalho, botões, abas e barras seguem juntos.
  const coverColor = useSpineColor(book);
  const bookTheme = useMemo(() => {
    // A cor da lombada pode ser clara demais; o texto por cima é branco, então
    // prendemos a luminosidade num teto que garante contraste legível.
    const darken = (hsl: string, maxLightness: number) => {
      const parts = hsl.match(/hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)/);
      if (!parts) return hsl;
      const [h, sat, light] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      return `hsl(${h} ${Math.min(sat, 72)}% ${Math.min(light, maxLightness)}%)`;
    };

    const base = darken(coverColor.base, 38);
    return {
      "--primary": base,
      "--primary-hover": darken(coverColor.shade, 28),
      "--primary-deep": darken(coverColor.shade, 22),
      "--primary-foreground": "#ffffff",
      "--primary-soft": `color-mix(in srgb, ${base} 14%, transparent)`,
      "--ring": `color-mix(in srgb, ${base} 26%, transparent)`,
    } as React.CSSProperties;
  }, [coverColor]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      fetchBook(id).catch(() => null),
      fetchSavedIds().catch(() => [] as string[]),
      fetchProgress(id).catch(() => null),
      fetchAllUsers().catch(() => [] as UserProfile[]),
    ]).then(([b, savedIds, p, allUsers]) => {
      if (cancelled) return;
      setBook(b);
      setIsSaved((savedIds || []).includes(id));
      setProgress(p);
      setUsers((allUsers || []).filter((u) => u.username.toLowerCase() !== myUsername?.toLowerCase()));
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [id, myUsername]);

  // Quem chega pelo link "#avaliar" cai direto na aba de avaliações.
  useEffect(() => {
    if (isLoading || window.location.hash !== "#avaliar") return;
    setTab("avaliacoes");
    document.getElementById("avaliar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading]);

  const handleToggleSave = async () => {
    if (!id) return;
    if (!requireAuth("guardar nos favoritos")) return;
    setIsSaved((v) => !v);
    try {
      const res = await toggleSaved(id, isSaved);
      setIsSaved(res.saved);
    } catch {
      setIsSaved(isSaved);
      toast("Não foi possível atualizar os favoritos.", "error");
    }
  };

  const handleToggleRead = async () => {
    if (!id || !book) return;
    if (!requireAuth("marcar leituras")) return;
    const isCurrentlyFinished = progress?.status === "finalizado";
    const total = book.pages?.length || progress?.totalPages || 1;

    const newProgress: ReadingProgress = {
      bookId: id,
      currentPage: isCurrentlyFinished ? 0 : Math.max(0, total - 1),
      totalPages: total,
      progress: isCurrentlyFinished ? 0 : 100,
      status: isCurrentlyFinished ? "pausado" : "finalizado",
      startedAt: progress?.startedAt || Date.now(),
      lastReadAt: Date.now(),
    };

    setProgress(newProgress);
    await saveProgress(newProgress);
    toast(isCurrentlyFinished ? "Marcado como não lido." : "Livro concluído! 🎉");
  };

  const handleShare = async (targetUsername: string) => {
    if (!book) return;
    if (!requireAuth("recomendar livros")) return;
    try {
      await sendMessage(targetUsername, `Recomendei "${book.title}" para você! 📖✨`, book.id);
      setShowShare(false);
      toast(`Recomendação enviada para ${targetUsername}.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao compartilhar.", "error");
    }
  };

  const handleReviewsChange = useCallback((reviews: Review[]) => {
    setBook((prev) => {
      if (!prev) return prev;
      const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      return { ...prev, reviews, rating: Math.round(rating * 10) / 10, reviewCount: reviews.length };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="mb-book-details">
        <Skeleton className="w-full h-[420px] lg:rounded-[24px]" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">📚</div>
          <h2 className="text-lg font-bold text-foreground">Livro não encontrado</h2>
          <button onClick={() => navigate(-1)} className="mb-btn mb-btn-primary">Voltar</button>
        </div>
      </div>
    );
  }

  const isFinished = progress?.status === "finalizado";
  const hasContent = (book.pages && book.pages.length > 0) || !!book.pdfPath;
  const cover = getFullUrl(book.coverImagePath);

  return (
    <div style={bookTheme} className="mb-book-details">
      {/* ── Palco: a própria arte da capa vira o cenário ──────────────────── */}
      <div className="mb-book-stage relative overflow-hidden lg:rounded-[24px]">
        {cover ? (
          <>
            <img
              src={cover}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl"
            />
            {/* Duas camadas: uma escurece para o texto branco funcionar, a
                outra puxa a cena para a cor dominante do livro. */}
            <div className="absolute inset-0 bg-black/55" />
            <div
              className="absolute inset-0 opacity-70"
              style={{ background: `linear-gradient(120deg, ${coverColor.shade} 0%, transparent 55%, ${coverColor.shade} 100%)` }}
            />
          </>
        ) : (
          <div className="absolute inset-0 mb-hero-green" />
        )}

        <div className="relative px-5 sm:px-8 lg:px-10 pt-5 pb-16 lg:pb-20 text-white">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => navigate(-1)}
              aria-label="Voltar"
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowShare(true)}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-[13.5px] font-semibold transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Indicar
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-9 mt-4 sm:mt-2">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-[150px] sm:w-[210px] lg:w-[240px] aspect-[2/3] rounded-xl overflow-hidden shadow-[0_28px_60px_-18px_rgba(0,0,0,.85)] ring-1 ring-white/10">
                {cover ? (
                  <img src={cover} alt={`Capa de ${book.title}`} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book)} flex items-center justify-center`}>
                    <BookOpen className="w-12 h-12 text-white/60" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0 sm:pt-4">
              <h1 className="mb-book-title text-[28px] sm:text-[38px] font-bold leading-[1.08] tracking-tight">{book.title}</h1>
              <p className="text-[16px] sm:text-[18px] font-semibold mt-1.5" style={{ color: coverColor.tint }}>
                {book.author || "Autor desconhecido"}
              </p>

              <div className="flex items-center gap-2.5 mt-4">
                <Stars value={book.rating} onDark />
                <span className="text-[14px] font-semibold">
                  {book.rating > 0 ? book.rating.toFixed(1) : "—"}
                  <span className="text-white/65 font-normal">
                    {" "}({book.reviewCount} {book.reviewCount === 1 ? "avaliação" : "avaliações"})
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4">
                <span className="h-8 px-3.5 rounded-full bg-white/18 backdrop-blur-sm text-[12px] font-semibold flex items-center">
                  {book.genre}
                </span>
                {!!book.pageCount && (
                  <span className="h-8 px-3.5 rounded-full bg-white/18 backdrop-blur-sm text-[12px] font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {book.pageCount} págs.
                  </span>
                )}
                {!!book.readers && (
                  <span className="h-8 px-3.5 rounded-full bg-white/18 backdrop-blur-sm text-[12px] font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {book.readers}
                  </span>
                )}
              </div>

              {book.description && (
                <>
                  <p className={`text-[14.5px] text-white/85 leading-[1.7] mt-5 max-w-xl ${expanded ? "" : "line-clamp-4"}`}>
                    {book.description}
                  </p>
                  {book.description.length > 180 && (
                    <button
                      onClick={() => setExpanded((v) => !v)}
                      className="inline-flex items-center gap-1 mt-2 text-[13.5px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ color: coverColor.tint }}
                    >
                      {expanded ? "Ver menos" : "Ver mais"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </>
              )}

              <div className="flex gap-2.5 mt-6 max-w-xl">
                {hasContent ? (
                  <button
                    onClick={() => openBook(book)}
                    className="flex-1 h-[52px] rounded-[14px] font-semibold text-[15px] text-white inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer shadow-[0_10px_28px_-10px_rgba(0,0,0,.8)]"
                    style={{ background: coverColor.base }}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {progress && progress.progress > 0 ? "Continuar leitura" : "Quero ler"}
                  </button>
                ) : (
                  <button disabled className="flex-1 h-[52px] rounded-[14px] bg-white/15 font-semibold text-[15px] inline-flex items-center justify-center gap-2 cursor-not-allowed">
                    <BookOpen className="w-4 h-4" /> Sem conteúdo
                  </button>
                )}

                <button
                  onClick={handleToggleRead}
                  aria-label={isFinished ? "Desmarcar como lido" : "Marcar como lido"}
                  className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center transition-colors cursor-pointer ${
                    isFinished ? "bg-white text-[var(--foreground)]" : "bg-white/15 hover:bg-white/25 backdrop-blur-md"
                  }`}
                >
                  <CheckCircle className="w-5 h-5" />
                </button>

                <button
                  onClick={handleToggleSave}
                  aria-label={isSaved ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  aria-pressed={isSaved}
                  className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center transition-colors cursor-pointer ${
                    isSaved ? "bg-white text-[var(--foreground)]" : "bg-white/15 hover:bg-white/25 backdrop-blur-md"
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${isSaved ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel branco, sobreposto ao palco ────────────────────────────── */}
      <div className="relative -mt-10 rounded-t-[24px] lg:rounded-[24px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-2)] px-5 sm:px-8 lg:px-10 py-6">
        <div className="flex gap-7 border-b border-[var(--line)]">
          {([
            { key: "sobre", label: "Sobre" },
            { key: "avaliacoes", label: "Avaliações" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative pb-3.5 text-[15px] transition-colors cursor-pointer ${
                tab === t.key ? "text-[var(--primary)] font-semibold" : "text-[var(--text-3)] font-medium hover:text-foreground"
              }`}
            >
              {t.label}
              {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[var(--primary)]" />}
            </button>
          ))}
        </div>

        {tab === "sobre" ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 pt-6">
            <div className="min-w-0">
              <p className="text-[14.5px] text-[var(--text-2)] leading-[1.85] whitespace-pre-wrap">
                {book.description || "Nenhuma sinopse cadastrada para este livro."}
              </p>

              <div className="flex flex-wrap gap-2 mt-6">
                <span className="h-9 px-4 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-[13px] font-medium flex items-center">
                  {book.genre}
                </span>
              </div>

              {progress && progress.progress > 0 && progress.status !== "finalizado" && (
                <div className="mt-7">
                  <div className="flex justify-between items-center text-[13px] font-semibold">
                    <span className="text-[var(--text-2)]">Seu progresso</span>
                    <span className="text-[var(--primary)]">{Math.round(progress.progress)}%</span>
                  </div>
                  <div className="w-full bg-[var(--surface-2)] rounded-full h-2 overflow-hidden mt-2">
                    <div className="bg-[var(--primary)] h-full rounded-full transition-all" style={{ width: `${progress.progress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <BookOpenCheck className="w-[18px] h-[18px]" />, value: book.rating > 0 ? book.rating.toFixed(1) : "—", label: "Nota média" },
                  { icon: <Star className="w-[18px] h-[18px] fill-current" />, value: String(book.reviewCount), label: "Avaliações" },
                  { icon: <Users className="w-[18px] h-[18px]" />, value: String(book.readers ?? 0), label: "Leitores" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[16px] bg-[var(--surface-2)] p-3.5 text-center">
                    <span className="inline-flex text-[var(--primary)] justify-center">{stat.icon}</span>
                    <div className="text-[19px] font-bold text-foreground leading-none mt-2">{stat.value}</div>
                    <div className="text-[11.5px] text-[var(--text-3)] mt-1.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-[16px] bg-[var(--surface-2)] p-4 grid grid-cols-2 gap-y-4 gap-x-3">
                {[
                  { label: "Autor", value: book.author || "—" },
                  { label: "Editora", value: book.publisher || "—" },
                  { label: "Páginas", value: book.pageCount ? String(book.pageCount) : "—" },
                  { label: "Publicado em", value: book.publishedYear || "—" },
                ].map((row) => (
                  <div key={row.label} className="min-w-0">
                    <div className="text-[12px] text-[var(--text-3)]">{row.label}</div>
                    <div className="text-[13.5px] font-semibold text-foreground truncate mt-0.5">{row.value}</div>
                  </div>
                ))}
              </div>

              {isFinished && (
                <div className="rounded-[16px] bg-[var(--primary-soft)] p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[var(--primary)]" />
                  <span className="text-[13.5px] font-semibold text-foreground">Você concluiu este livro 🎉</span>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="pt-6">
            <ReviewSection bookId={book.id} reviews={book.reviews || []} onChange={handleReviewsChange} />
          </div>
        )}
      </div>

      {/* ── Compartilhar ───────────────────────────────────────────────────── */}
      <Modal
        open={showShare}
        onClose={() => setShowShare(false)}
        title="Indicar para alguém"
        description="A pessoa recebe o livro no chat. Se ela terminar a leitura, vocês dois ganham um Pandinha."
      >
        {users.length === 0 ? (
          <p className="text-[13px] text-[var(--text-3)] text-center py-6">Nenhum outro leitor na rede ainda.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.username}
                onClick={() => handleShare(u.username)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors text-left cursor-pointer"
              >
                <Avatar emoji={u.avatar} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-foreground truncate">{u.username}</span>
                  <span className="block text-[12px] text-[var(--text-3)] truncate">{u.bio || "Leitor do myBooks"}</span>
                </span>
                <Share2 className="w-4 h-4 text-[var(--text-3)]" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
