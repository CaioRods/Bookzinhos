import type { BookAppearance } from "./appearance";
/**
 * Tipos compartilhados do myBooks
 */

export interface Book {
  appearance?: BookAppearance | null;
  id: string;
  title: string;
  author: string;
  description: string;
  genre: string;
  publisher?: string;
  publishedYear?: string;
  rating: number;
  reviewCount: number;
  isPublic: boolean;
  coverColor: string;
  addedAt: number;
  pdfPath?: string | null;
  coverImagePath?: string | null;
  isUserBook?: boolean;
  reviews?: Review[];
  pages?: string[];
  pageCount?: number;
  /** Quantas pessoas já abriram o livro (alimenta "Mais lidos") */
  readers?: number;
  finishedCount?: number;
  opens?: number;
  popularity?: number;
  lastReadAt?: number;
}

export interface ReviewComment {
  id: number;
  reviewId: number;
  username: string;
  avatar?: string | null;
  content: string;
  createdAt: number;
}

export interface Review {
  id: number;
  bookId: string;
  username: string;
  avatar?: string | null;
  isAdmin?: boolean;
  rating: number;
  comment: string;
  hasSpoiler?: boolean;
  createdAt: number;
  updatedAt?: number;
  likes: number;
  likedByMe: boolean;
  comments: ReviewComment[];
  book?: Pick<Book, "id" | "title" | "author" | "coverImagePath" | "coverColor">;
}

export interface ReadingProgress {
  bookId: string;
  currentPage: number;
  totalPages: number;
  progress: number;
  status: "lendo" | "finalizado" | "pausado" | "ler-depois";
  startedAt: number;
  lastReadAt: number;
}

export interface Note {
  id: string;
  bookId: string;
  username?: string;
  date: string;
  feedback: string;
  rating: number;
  createdAt: number;
}

export interface Stats {
  finished: number;
  reading: number;
  notesCount: number;
  reviewCount?: number;
  followers?: number;
  following?: number;
}

export interface UserProfile {
  username: string;
  bio: string;
  avatar: string;
  shelf: string[];
  pandinhas: number;
  isAdmin?: boolean;
  followers?: number;
  following?: number;
  followerNames?: string[];
  followingNames?: string[];
  isFollowedByMe?: boolean;
  reviewCount?: number;
  finishedCount?: number;
  reviews?: Review[];
  savedIds?: string[];
  reading?: string[];
  finishedIds?: string[];
  stats?: { finished: number; reading: number; reviews: number; saved: number };
}

export interface ChatMessage {
  id: number;
  sender: string;
  receiver: string;
  content: string;
  shared_book_id?: string | null;
  is_read: number;
  created_at: number;
}

export interface AppNotification {
  id: number;
  type: "mensagem" | "curtida" | "resposta" | "seguidor" | "mural";
  title: string;
  body: string;
  link: string;
  actor: string;
  avatar?: string | null;
  isRead: boolean;
  createdAt: number;
}

export interface Notifications {
  unreadCount: number;
  details: Record<string, number>;
  items?: AppNotification[];
}

export interface GlobalStatus {
  username: string;
  content: string;
  emote: string;
  updated_at: number;
}

export interface BookChapter {
  id?: number;
  bookId: string;
  startPage: number;
  title: string;
  createdAt?: number;
}

export interface Banner {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  linkUrl: string | null;
  bookId: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Quem pagou pelo espaço. Vazio nos banners da própria casa. */
  sponsor: string;
  /** Período contratado, em milissegundos. 0 nos dois campos = sem limite. */
  startsAt: number;
  endsAt: number;
  createdAt: number;
}

/** Relatório de desempenho de um banner — o que o patrocinador recebe. */
export interface BannerReport {
  banner: Banner;
  from: number;
  to: number;
  views: number;
  clicks: number;
  /** Taxa de clique, em porcentagem. */
  ctr: number;
  daily: { day: string; views: number; clicks: number }[];
}

export interface HomePost {
  id: number;
  author: string;
  avatar?: string;
  title: string;
  content: string;
  imageUrl: string | null;
  bookId: string | null;
  isPinned: boolean;
  isActive: boolean;
  createdAt: number;
  likes: number;
  likedByMe: boolean;
}

export interface HomeData {
  books: Book[];
  mostRead: Book[];
  topRated: Book[];
  recent: Book[];
  banners: Banner[];
  posts: HomePost[];
  status: GlobalStatus | null;
  progress: ReadingProgress[];
  savedIds: string[];
  recentReviews: Review[];
  isAdmin: boolean;
}

export type FeedItem = {
  type: "review" | "finished" | "reading" | "new-book";
  id: string;
  createdAt: number;
  username?: string;
  avatar?: string | null;
  /** Percentual lido, presente apenas em `reading` */
  progress?: number;
  review?: Review;
  book?: Pick<Book, "id" | "title" | "author" | "coverImagePath" | "coverColor">;
};

export interface AdminOverview {
  books: number;
  users: number;
  reviews: number;
  banners: number;
  posts: number;
  readingSessions: number;
}

// ─── Cover gradients ──────────────────────────────────────────────────────────

/**
 * Capas geradas.
 *
 * Livro sem imagem ganha uma capa desenhada: um duotom saturado, escuro o
 * bastante para o título sair em branco por cima. Os pastéis anteriores
 * ficavam quase brancos na tela e todos os livros pareciam iguais.
 */
const COVER_GRADIENTS: Record<string, string> = {
  "lavender-mint": "from-[#7C3AED] via-[#5B4BE0] to-[#06B6D4]",
  "peach-lavender": "from-[#F97316] via-[#E1497E] to-[#A855F7]",
  "mint-sky": "from-[#059669] via-[#0E9F8E] to-[#3B82F6]",
  "blush-lavender": "from-[#EC4899] via-[#B44BC8] to-[#7C3AED]",
  "peach-mint": "from-[#FB7185] via-[#7F9E9A] to-[#0D9488]",
  "lemon-peach": "from-[#F59E0B] via-[#F2732B] to-[#DC2626]",
  "sky-mint": "from-[#0EA5E9] via-[#12A98B] to-[#22C55E]",
  "lavender-peach": "from-[#4F46E5] via-[#9A54C4] to-[#F472B6]",
  "mint-peach": "from-[#047857] via-[#8A8A34] to-[#FB923C]",
  "blush-mint": "from-[#E11D48] via-[#8E4E70] to-[#0D9488]",
};

const GRADIENT_LIST = Object.keys(COVER_GRADIENTS);

export function getCoverGradient(book: Pick<Book, "id" | "coverColor">): string {
  const key = book.coverColor ?? GRADIENT_LIST[parseInt(book.id, 10) % GRADIENT_LIST.length];
  return COVER_GRADIENTS[key] ?? COVER_GRADIENTS["lavender-mint"];
}

export function getFullUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:")) return path;
  const base = "https://bookzinhos-production.up.railway.app";
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function randomCoverColor(): string {
  return GRADIENT_LIST[Math.floor(Math.random() * GRADIENT_LIST.length)];
}

/** "há 3 h", "ontem", "12 mar" — datas curtas em português. */
export function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
