import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft, BookOpen, Play, Share2, CheckCircle, Users, FileText,
  Bookmark, ChevronDown, ChevronRight, Calendar, Star,
} from "lucide-react";
import {
  fetchAllUsers, fetchBooks, fetchBook, fetchProgress, fetchSavedIds, saveProgress, sendMessage, toggleSaved,
} from "../lib/api";
import { getCoverGradient, getFullUrl } from "../lib/types";
import type { Book, ReadingProgress, Review, UserProfile } from "../lib/types";
import { getUsername } from "../lib/session";
import { requireAuth } from "../lib/authGate";
import { useOpenBook } from "../lib/readerChoice";
import { ReviewSection } from "../components/ReviewSection";
import { Book3D } from "../components/Book3D";
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
  const [related, setRelated] = useState<Book[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      fetchBook(id).catch(() => null),
      fetchSavedIds().catch(() => [] as string[]),
      fetchProgress(id).catch(() => null),
      fetchAllUsers().catch(() => [] as UserProfile[]),
      fetchBooks().catch(() => [] as Book[]),
    ]).then(([b, savedIds, p, allUsers, catalog]) => {
      if (cancelled) return;
      setBook(b);
      setRelated(catalog.filter(entry => entry.id !== id && (entry.author === b?.author || (entry.genre !== "Outros" && entry.genre === b?.genre))).sort((a, entry) => Number(entry.author === b?.author) - Number(a.author === b?.author) || entry.rating - a.rating).slice(0, 5));
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
    const total = book.pageCount || book.pages?.length || progress?.totalPages || 1;

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
    <div className="mb-book-details mb-reference-details">
      <nav className="mb-book-breadcrumb" aria-label="Caminho de navegação"><button aria-label="Voltar" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button><Link to="/library">Biblioteca</Link><ChevronRight size={15} /><span>{book.title}</span></nav>
      <div className="mb-detail-columns"><div className="min-w-0">
        <section className="mb-reference-book-hero">
          <div className="mb-reference-book-cover">{cover ? <img src={cover} alt={`Capa de ${book.title}`} /> : <Book3D book={book} width={240} still />}</div>
          <div className="mb-reference-book-copy">
            <p className="mb-eyebrow">{book.genre}</p><h1>{book.title}</h1><p className="mb-detail-author">{book.author || "Autor desconhecido"}</p>
            <div className="mb-detail-rating"><Stars value={book.rating} /><strong>{book.rating > 0 ? book.rating.toFixed(1) : "Sem nota"}</strong><span>({book.reviewCount} {book.reviewCount === 1 ? "avaliação" : "avaliações"})</span></div>
            <div className="mb-detail-facts">{!!book.pageCount && <span><FileText size={16} />{book.pageCount} páginas</span>}{book.publishedYear && <span><Calendar size={16} />{book.publishedYear}</span>}<span><Users size={16} />{book.readers || 0} leitores</span></div>
            <p className={`mb-detail-description ${expanded ? "is-expanded" : ""}`}>{book.description || "Uma nova história para descobrir. A sinopse deste livro ainda não foi adicionada."}</p>
            {book.description.length > 260 && <button className="mb-detail-expand" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? "Ler menos" : "Ler mais"}<ChevronDown size={15} /></button>}
            <div className="mb-detail-actions">{hasContent ? <button className="mb-btn mb-btn-primary" onClick={() => openBook(book)}><Play size={17} />{progress && progress.progress > 0 && !isFinished ? "Continuar lendo" : "Começar leitura"}</button> : <span className="mb-detail-unavailable">Conteúdo ainda não disponível</span>}<button className="mb-btn mb-btn-outline mb-btn-icon" onClick={handleToggleSave} aria-pressed={isSaved} aria-label={isSaved ? "Remover dos favoritos" : "Guardar nos favoritos"}><Bookmark size={19} className={isSaved ? "fill-current" : ""} /></button><button className="mb-btn mb-btn-outline mb-btn-icon" aria-label="Indicar este livro" onClick={() => setShowShare(true)}><Share2 size={18} /></button></div>
            {progress && <div className="mb-detail-progress"><span>Seu progresso</span><div className="mb-inline-progress"><span role="progressbar" aria-label="Seu progresso de leitura" aria-valuenow={Math.min(100, Math.max(0, progress.progress))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }} /></span><strong>{Math.round(progress.progress)}%</strong></div><small>Página {progress.currentPage + 1} de {progress.totalPages}</small></div>}
          </div>
        </section>
        <section className="mb-book-about">
          <div className="mb-book-tabs" role="tablist" aria-label="Informações do livro">{([{ key: "sobre", label: "Sobre" }, { key: "avaliacoes", label: "Avaliações" }] as const).map(t => <button key={t.key} role="tab" aria-selected={tab === t.key} aria-controls={`book-panel-${t.key}`} id={`book-tab-${t.key}`} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>
          {tab === "sobre" ? <div className="mb-book-synopsis" role="tabpanel" id="book-panel-sobre" aria-labelledby="book-tab-sobre"><div><h2>Sinopse</h2><p>{book.description || "Nenhuma sinopse cadastrada para este livro."}</p><button className="mb-btn mb-btn-outline mt-6" onClick={handleToggleRead}><CheckCircle size={17} />{isFinished ? "Marcar como não lido" : "Marcar como concluído"}</button></div><dl>{[{ label: "Autor", value: book.author }, { label: "Editora", value: book.publisher }, { label: "Publicação", value: book.publishedYear }, { label: "Páginas", value: book.pageCount }, { label: "Gênero", value: book.genre }].filter(row => row.value).map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div> : <div role="tabpanel" id="book-panel-avaliacoes" aria-labelledby="book-tab-avaliacoes"><ReviewSection bookId={book.id} reviews={book.reviews || []} onChange={handleReviewsChange} /></div>}
        </section>
      </div><aside className="mb-book-related-rail">
        <section className="mb-card"><header><h2>Sua leitura</h2><Link to="/library?filter=lendo">Ver tudo</Link></header><button className="mb-current-reading" onClick={() => hasContent && openBook(book)} disabled={!hasContent}>{cover && <img src={cover} alt="" />}<span><strong>{book.title}</strong><small>{book.author}</small><span className="mb-inline-progress"><span><i style={{ width: `${Math.min(100, Math.max(0, progress?.progress || 0))}%` }} /></span><small>{Math.round(progress?.progress || 0)}%</small></span><small>{progress ? `Página ${progress.currentPage + 1} de ${progress.totalPages}` : "Comece seu próximo capítulo"}</small></span><ChevronRight size={17} /></button></section>
        {related.length > 0 && <section className="mb-card"><header><h2>Livros relacionados</h2><Link to={`/library?q=${encodeURIComponent(book.author || book.genre)}`}>Ver todos</Link></header>{related.map(entry => <Link className="mb-related-book" key={entry.id} to={`/book/${entry.id}`}><span>{entry.coverImagePath ? <img src={getFullUrl(entry.coverImagePath)!} alt="" loading="lazy" /> : <BookOpen size={22} />}</span><div><strong>{entry.title}</strong><small>{entry.author}</small>{entry.rating > 0 && <small className="mb-related-rating"><Star size={13} fill="currentColor" />{entry.rating.toFixed(1)}</small>}</div><ChevronRight size={17} /></Link>)}</section>}
      </aside></div>

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
