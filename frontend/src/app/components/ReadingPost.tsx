import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Bookmark, Heart, MessageCircle, CheckCircle } from "lucide-react";
import { fetchSavedIds, toggleSaved, toggleReviewLike } from "../lib/api";
import { requireAuth } from "../lib/authGate";
import { getFullUrl, timeAgo } from "../lib/types";
import type { FeedItem } from "../lib/types";
import { Avatar, Stars, toast } from "./Ui";
import { BookDiscoveryPost } from "./BookDiscoveryPost";

export function ReadingPost({ item }: { item: FeedItem }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reaction, setReaction] = useState({ likes: item.review?.likes ?? 0, likedByMe: item.review?.likedByMe ?? false });
  const book = item.book;
  useEffect(() => {
    let alive = true;
    if (book) fetchSavedIds().then(ids => { if (alive) setSaved(ids.includes(book.id)); }).catch(() => {});
    return () => { alive = false; };
  }, [book?.id]);
  useEffect(() => { setReaction({ likes: item.review?.likes ?? 0, likedByMe: item.review?.likedByMe ?? false }); }, [item.review?.likes, item.review?.likedByMe]);
  if (item.type === "new-book") return <BookDiscoveryPost item={item} />;
  if (!book) return null;
  const cover = getFullUrl(book.coverImagePath);
  const user = item.review?.username || item.username;
  const progress = Math.min(100, Math.max(0, item.progress ?? 0));
  const save = async () => {
    if (busy || !requireAuth("guardar nos favoritos")) return;
    setBusy(true);
    try { const result = await toggleSaved(book.id, saved); setSaved(result.saved); toast(result.saved ? "Livro salvo nos favoritos." : "Livro removido dos favoritos."); }
    catch { toast("Não foi possível atualizar os favoritos.", "error"); }
    finally { setBusy(false); }
  };
  const like = async () => {
    if (busy || !item.review || !requireAuth("curtir resenhas")) return;
    setBusy(true);
    try { setReaction(await toggleReviewLike(item.review.id)); }
    catch { toast("Não foi possível curtir agora.", "error"); }
    finally { setBusy(false); }
  };
  return <article className="mb-reading-post">
    <header className="mb-reading-author"><Avatar emoji={item.review?.avatar || item.avatar} size="sm" username={user} /><div>{user && <Link to={`/user/${encodeURIComponent(user)}`}>{user}</Link>}<small>@{user?.toLowerCase()} · {timeAgo(item.createdAt)}</small></div></header>
    <div className="mb-reading-story">
      <Link to={`/book/${book.id}`} className="mb-reading-post-cover" aria-label={`Ver ${book.title}`}>{cover ? <img src={cover} alt="" loading="lazy" /> : <span>{book.title}</span>}</Link>
      <div className="min-w-0 flex-1">
        <p className="mb-reading-event">{item.type === "finished" ? <CheckCircle size={14} /> : <BookOpen size={14} />}{item.type === "finished" ? "terminou de ler" : item.type === "reading" ? "está lendo" : "avaliou um livro"}</p>
        <Link to={`/book/${book.id}`} className="mb-reading-title">{book.title}</Link>
        <p className="mb-reading-post-author">{book.author}</p>
        {item.type === "reading" && <div className="mb-inline-progress"><span role="progressbar" aria-label={`Progresso de ${user}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></span><small>{Math.round(progress)}%</small></div>}
        {item.review && <Stars value={item.review.rating} size="sm" />}
      </div>
    </div>
    {item.review?.comment && <p className="mb-reading-post-comment">{item.review.hasSpoiler ? "Esta resenha contém spoilers. Abra o livro para ler." : item.review.comment}</p>}
    <footer className="mb-reading-post-actions">
      {item.review && <button onClick={like} disabled={busy} aria-pressed={reaction.likedByMe} aria-label={`Curtir resenha de ${user}`}><Heart size={19} className={reaction.likedByMe ? "fill-[var(--like)] text-[var(--like)]" : ""} />{reaction.likes}</button>}
      <Link to={`/book/${book.id}#avaliar`} aria-label={`Ver discussão de ${book.title}`}><MessageCircle size={18} />{item.review ? item.review.comments.length : "Conversar sobre o livro"}</Link>
      <button className="ml-auto" onClick={save} disabled={busy} aria-pressed={saved} aria-label={saved ? `Remover ${book.title} dos favoritos` : `Salvar ${book.title} nos favoritos`}><Bookmark size={18} className={saved ? "fill-current" : ""} /></button>
    </footer>
  </article>;
}
