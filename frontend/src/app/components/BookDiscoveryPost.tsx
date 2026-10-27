import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { getFullUrl, timeAgo } from "../lib/types";
import type { FeedItem } from "../lib/types";

/** A system announcement looks like a curated book recommendation, not a log entry. */
export function BookDiscoveryPost({ item }: { item: FeedItem }) {
  const book = item.book;
  if (!book) return null;
  const cover = getFullUrl(book.coverImagePath);
  return <article className="mb-feed-post">
    <header className="mb-feed-post-header">
      <img src="/logo.svg" alt="" width="32" height="32" />
      <div><strong>Descobertas myBooks</strong><small>Novas histórias na biblioteca</small></div>
      <time dateTime={new Date(item.createdAt).toISOString()}>{timeAgo(item.createdAt)}</time>
    </header>
    <div className="mb-feed-discovery">
      <Link to={`/book/${book.id}`} className="mb-feed-discovery-cover" aria-label={`Ver ${book.title}`}>
        {cover ? <img src={cover} alt={`Capa de ${book.title}`} loading="lazy" /> : <div className="mb-discovery-placeholder"><span>{book.title}</span></div>}
      </Link>
      <div className="min-w-0">
        <p className="mb-eyebrow text-[var(--primary)]">ACABOU DE CHEGAR</p>
        <h3><Link to={`/book/${book.id}`}>{book.title}</Link></h3>
        <p>{book.author || "Uma nova descoberta para sua estante"}</p>
        <p className="hidden sm:block">Um novo capítulo para a sua lista. Conheça este livro e descubra se é a sua próxima leitura.</p>
        <Link to={`/book/${book.id}`} className="mb-btn mb-btn-outline">Conhecer o livro <ArrowUpRight className="w-4 h-4" /></Link>
      </div>
    </div>
  </article>;
}
