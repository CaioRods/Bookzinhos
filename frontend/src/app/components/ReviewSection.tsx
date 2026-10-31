import { ReaderName } from "./ReaderName";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Heart, MessageCircle, Trash2, Eye, Pencil, Send, Loader2 } from "lucide-react";
import {
  addReviewComment, deleteReview, deleteReviewComment, saveReview, toggleReviewLike,
} from "../lib/api";
import { getUsername, isAdmin as isAdminUser } from "../lib/session";
import { requireAuth } from "../lib/authGate";
import { timeAgo } from "../lib/types";
import type { Review } from "../lib/types";
import { Avatar, ConfirmDialog, StarPicker, Stars, toast } from "./Ui";

type SortMode = "recent" | "top" | "liked";

const SORTS: { key: SortMode; label: string }[] = [
  { key: "recent", label: "Mais recentes" },
  { key: "top", label: "Melhores notas" },
  { key: "liked", label: "Mais curtidas" },
];

/**
 * Bloco de avaliações de um livro: nota agregada, o formulário do leitor e a
 * conversa em volta de cada resenha (curtidas e respostas).
 */
export function ReviewSection({
  bookId,
  reviews,
  onChange,
}: {
  bookId: string;
  reviews: Review[];
  onChange: (reviews: Review[]) => void;
}) {
  const me = getUsername();
  const admin = isAdminUser();

  const myReview = useMemo(
    () => reviews.find((r) => r.username.toLowerCase() === (me || "").toLowerCase()),
    [reviews, me]
  );

  const [sort, setSort] = useState<SortMode>("recent");
  const [isComposing, setIsComposing] = useState(false);
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [hasSpoiler, setHasSpoiler] = useState(!!myReview?.hasSpoiler);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const idx = Math.min(4, Math.max(0, Math.round(r.rating) - 1));
      buckets[idx] += 1;
    });
    return buckets;
  }, [reviews]);

  const sorted = useMemo(() => {
    const list = [...reviews];
    if (sort === "top") list.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
    else if (sort === "liked") list.sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
    else list.sort((a, b) => b.createdAt - a.createdAt);
    // A própria resenha sempre aparece primeiro, para ficar fácil de editar.
    return list.sort((a, b) => {
      const aMine = a.username.toLowerCase() === (me || "").toLowerCase() ? 1 : 0;
      const bMine = b.username.toLowerCase() === (me || "").toLowerCase() ? 1 : 0;
      return bMine - aMine;
    });
  }, [reviews, sort, me]);

  const openComposer = () => {
    if (!requireAuth("avaliar este livro")) return;
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || "");
    setHasSpoiler(!!myReview?.hasSpoiler);
    setIsComposing(true);
  };

  const handleSubmit = async () => {
    if (!me) return toast("Entre na sua conta para avaliar.", "error");
    if (!rating) return toast("Escolha uma nota de 1 a 5.", "error");
    setIsSaving(true);
    try {
      const res = await saveReview(bookId, { rating, comment: comment.trim(), hasSpoiler });
      onChange(res.reviews);
      setIsComposing(false);
      toast(myReview ? "Avaliação atualizada." : "Avaliação publicada!");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível salvar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (reviewId: number) => {
    setConfirmDelete(null);
    try {
      await deleteReview(reviewId);
      onChange(reviews.filter((r) => r.id !== reviewId));
      toast("Avaliação removida.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível remover.", "error");
    }
  };

  const handleLike = async (review: Review) => {
    if (!requireAuth("curtir avaliações")) return;
    // Atualização otimista: a interface responde antes da rede.
    const optimistic = reviews.map((r) =>
      r.id === review.id
        ? { ...r, likedByMe: !r.likedByMe, likes: r.likes + (r.likedByMe ? -1 : 1) }
        : r
    );
    onChange(optimistic);
    try {
      const res = await toggleReviewLike(review.id);
      onChange(optimistic.map((r) => (r.id === review.id ? { ...r, ...res } : r)));
    } catch {
      onChange(reviews);
    }
  };

  const handleReply = async (reviewId: number, content: string) => {
    const comments = await addReviewComment(reviewId, content);
    onChange(reviews.map((r) => (r.id === reviewId ? { ...r, comments } : r)));
  };

  const handleDeleteComment = async (reviewId: number, commentId: number) => {
    await deleteReviewComment(reviewId, commentId);
    onChange(
      reviews.map((r) =>
        r.id === reviewId ? { ...r, comments: r.comments.filter((c) => c.id !== commentId) } : r
      )
    );
  };

  return (
    <section id="avaliar" className="space-y-5 scroll-mt-20">
      {/* ── Resumo ─────────────────────────────────────────────────────────── */}
      <div className="mb-card p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-[16px] font-bold text-foreground">Avaliações da comunidade</h3>
          {reviews.length > 0 && (
            <span className="text-[12.5px] text-[var(--text-3)]">{reviews.length} no total</span>
          )}
        </div>

        <div className="flex gap-6">
          <div className="text-center flex-shrink-0 w-[92px]">
            <div className="text-[42px] font-bold text-foreground leading-none">
              {average > 0 ? average.toFixed(1) : "—"}
            </div>
            <div className="mt-2 flex justify-center"><Stars value={average} size="sm" /></div>
            <p className="text-[11.5px] text-[var(--text-3)] mt-1.5">
              {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}
            </p>
          </div>

          <div className="flex-1 space-y-1.5 min-w-0 pt-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1];
              const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2.5">
                  <span className="text-[11.5px] font-semibold text-[var(--text-3)] w-6 text-right whitespace-nowrap">
                    {star} ★
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11.5px] text-[var(--text-3)] w-9 text-right tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {!isComposing && (
          <button onClick={openComposer} className="mb-btn mb-btn-primary w-full mt-5 h-11 rounded-[14px]">
            {myReview ? <><Pencil className="w-4 h-4" /> Editar minha avaliação</> : <>Escrever avaliação</>}
          </button>
        )}
      </div>

      {/* ── Formulário ─────────────────────────────────────────────────────── */}
      {isComposing && (
        <div className="mb-card p-5 space-y-4 animate-fade-in">
          <div>
            <span className="mb-label">Sua nota</span>
            <StarPicker value={rating} onChange={setRating} disabled={isSaving} />
          </div>

          <div>
            <label htmlFor="review-text" className="mb-label">O que você achou?</label>
            <textarea
              id="review-text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1500}
              rows={5}
              placeholder="Conte como foi a leitura, o que te marcou, para quem você recomendaria…"
              className="mb-input resize-y leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setHasSpoiler((v) => !v)}
                className={`mb-chip cursor-pointer transition-colors ${hasSpoiler ? "mb-chip-primary" : ""}`}
              >
                <Eye className="w-3.5 h-3.5" />
                {hasSpoiler ? "Contém spoiler" : "Marcar spoiler"}
              </button>
              <span className="text-[11.5px] text-[var(--text-3)]">{comment.length}/1500</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsComposing(false)} disabled={isSaving} className="mb-btn mb-btn-outline">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={isSaving || !rating} className="mb-btn mb-btn-primary">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {myReview ? "Salvar alterações" : "Publicar avaliação"}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista ──────────────────────────────────────────────────────────── */}
      {reviews.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`mb-btn mb-btn-sm ${sort === s.key ? "mb-btn-soft" : "mb-btn-ghost"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="mb-card px-6 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">Ninguém avaliou ainda</p>
          <p className="text-[13px] text-[var(--text-3)] mt-1">Seja a primeira pessoa a contar o que achou.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isMine={review.username.toLowerCase() === (me || "").toLowerCase()}
              canDelete={admin || review.username.toLowerCase() === (me || "").toLowerCase()}
              canModerate={admin}
              onLike={() => handleLike(review)}
              onEdit={openComposer}
              onDelete={() => setConfirmDelete(review.id)}
              onReply={handleReply}
              onDeleteComment={handleDeleteComment}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Apagar avaliação?"
        description="A nota e o comentário somem para todo mundo."
        confirmLabel="Apagar"
        destructive
        onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}

// ─── Cartão de uma resenha ────────────────────────────────────────────────────

function ReviewCard({
  review,
  isMine,
  canDelete,
  canModerate,
  onLike,
  onEdit,
  onDelete,
  onReply,
  onDeleteComment,
}: {
  review: Review;
  isMine: boolean;
  canDelete: boolean;
  canModerate: boolean;
  onLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReply: (reviewId: number, content: string) => Promise<void>;
  onDeleteComment: (reviewId: number, commentId: number) => Promise<void>;
}) {
  const me = getUsername();
  const [revealed, setRevealed] = useState(!review.hasSpoiler);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const submitReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    if (!requireAuth("responder avaliações")) return;
    setIsSending(true);
    try {
      await onReply(review.id, text);
      setReplyText("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível responder.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <article className={`mb-card p-4 ${isMine ? "ring-1 ring-[var(--primary)]/25" : ""}`}>
      <header className="flex items-start gap-3">
        <Avatar emoji={review.avatar} size="sm" username={review.username} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/user/${encodeURIComponent(review.username)}`}
              className="text-[13.5px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors"
            >
              <ReaderName username={review.username}/>
            </Link>
            {review.isAdmin && <span className="mb-chip mb-chip-primary">Admin</span>}
            {isMine && <span className="mb-chip">Você</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Stars value={review.rating} size="sm" />
            <span className="text-[11.5px] text-[var(--text-3)]">{timeAgo(review.createdAt)}</span>
          </div>
        </div>

        {canDelete && (
          <div className="flex gap-0.5 flex-shrink-0">
            {isMine && (
              <button onClick={onEdit} aria-label="Editar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={onDelete} aria-label="Apagar" className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {review.comment && (
        <div className="mt-3">
          {revealed ? (
            <p className="text-[13.5px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{review.comment}</p>
          ) : (
            <button
              onClick={() => setRevealed(true)}
              className="w-full text-left p-3 rounded-xl bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--text-3)] hover:text-foreground transition-colors cursor-pointer"
            >
              ⚠️ Contém spoiler — toque para revelar
            </button>
          )}
        </div>
      )}

      <footer className="flex items-center gap-1 mt-3">
        <button
          onClick={onLike}
          className={`mb-btn mb-btn-sm mb-btn-ghost ${review.likedByMe ? "text-[var(--primary)]" : ""}`}
          aria-pressed={review.likedByMe}
        >
          <Heart className={`w-4 h-4 ${review.likedByMe ? "fill-current" : ""}`} />
          {review.likes > 0 ? review.likes : "Curtir"}
        </button>
        <button onClick={() => setShowReply((v) => !v)} className="mb-btn mb-btn-sm mb-btn-ghost">
          <MessageCircle className="w-4 h-4" />
          {review.comments.length > 0 ? `${review.comments.length}` : "Responder"}
        </button>
      </footer>

      {(review.comments.length > 0 || showReply) && (
        <div className="mt-3 pl-3 border-l-2 border-[var(--line)] space-y-3">
          {review.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5 group">
              <Avatar emoji={c.avatar} size="xs" username={c.username} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/user/${encodeURIComponent(c.username)}`}
                    className="text-[12.5px] font-semibold text-foreground hover:text-[var(--primary)] transition-colors"
                  >
                    <ReaderName username={c.username}/>
                  </Link>
                  <span className="text-[11px] text-[var(--text-3)]">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-[13px] text-[var(--text-2)] leading-relaxed mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
              {(canModerate || c.username.toLowerCase() === (me || "").toLowerCase()) && (
                <button
                  onClick={() => onDeleteComment(review.id, c.id)}
                  aria-label="Apagar resposta"
                  className="mb-btn mb-btn-ghost mb-btn-icon mb-btn-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {showReply && (
            <div className="flex items-center gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitReply()}
                placeholder="Escreva uma resposta…"
                maxLength={500}
                className="mb-input flex-1 text-[13px] py-2"
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || isSending}
                aria-label="Enviar resposta"
                className="mb-btn mb-btn-primary mb-btn-icon mb-btn-sm"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
