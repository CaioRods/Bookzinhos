/**
 * Cliente HTTP do myBooks.
 *
 * Além dos wrappers de rota, há um cache curto em memória com deduplicação de
 * requisições: várias telas pedindo `/books` ao mesmo tempo geram uma única
 * chamada de rede, e um segundo pedido dentro da janela de cache é respondido
 * na hora. Isso é o que faz a navegação parecer instantânea.
 */

import { API_BASE_URL } from "./config";
import type {
  AdminOverview, Banner, BannerReport, Book, BookChapter, ChatMessage, FeedItem, HomeData, HomePost,
  Note, Notifications, ReadingProgress, Review, ReviewComment, Stats, UserProfile, CharacterAvatar, CharacterCatalog, ChatConversation, ProgressionSummary,
} from "./types";

// ─── Cache + deduplicação ─────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Janela padrão do cache. Curta o bastante para não servir dado velho. */
const DEFAULT_TTL = 8000;
const BOOKS_STORAGE_KEY = "mybooks:catalog:v1";
const BOOKS_STORAGE_TTL = 24 * 60 * 60 * 1000;

function cacheKey(path: string): string {
  return `${localStorage.getItem("books-username") || "anon"}::${path}`;
}

/** Invalida entradas de cache cujo caminho contenha algum dos trechos dados. */
export function invalidate(...fragments: string[]): void {
  if (fragments.length === 0) {
    cache.clear();
    localStorage.removeItem(BOOKS_STORAGE_KEY);
    return;
  }
  for (const key of [...cache.keys()]) {
    if (fragments.some((f) => key.includes(f))) cache.delete(key);
  }
  if (fragments.some((fragment) => fragment.includes("/books"))) {
    localStorage.removeItem(BOOKS_STORAGE_KEY);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const userId = localStorage.getItem("books-username") || "anonymous";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-user-id": userId },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 404) return null as T;
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

/** GET com cache e deduplicação. `ttl: 0` força ida ao servidor. */
async function cachedGet<T>(path: string, ttl = DEFAULT_TTL): Promise<T> {
  const key = cacheKey(path);

  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  }

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const promise = request<T>("GET", path)
    .then((value) => {
      cache.set(key, { value, at: Date.now() });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Upload multipart (arquivos) — nunca passa pelo cache. */
async function upload<T>(method: string, path: string, form: FormData): Promise<T> {
  const userId = localStorage.getItem("books-username") || "anonymous";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "x-user-id": userId },
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

/** Extrai a mensagem de erro do corpo da resposta, seja JSON ou texto puro. */
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return JSON.parse(text).error || text || `Erro ${res.status}`;
  } catch {
    return text || `Erro ${res.status}`;
  }
}

// ─── Compatibilidade: o modo offline foi removido ─────────────────────────────
export function isOfflineMode(): boolean {
  return false;
}
export function setOfflineMode(_value: boolean): void {
  /* modo offline descontinuado — o app é sempre sincronizado com o servidor */
}

// ─── HOME (uma chamada monta a tela inteira) ──────────────────────────────────

export function fetchHome(force = false): Promise<HomeData> {
  return cachedGet<HomeData>("/home", force ? 0 : DEFAULT_TTL);
}

// ─── LIVROS ───────────────────────────────────────────────────────────────────

export function fetchBooks(force = false): Promise<Book[]> {
  if (!force) {
    try {
      const stored = JSON.parse(localStorage.getItem(BOOKS_STORAGE_KEY) || "null") as
        | { at: number; books: Book[] }
        | null;
      if (stored?.books && Date.now() - stored.at < BOOKS_STORAGE_TTL) {
        cache.set(cacheKey("/books"), { value: stored.books, at: Date.now() });
        return Promise.resolve(stored.books);
      }
    } catch {
      localStorage.removeItem(BOOKS_STORAGE_KEY);
    }
  }
  return cachedGet<Book[]>("/books", force ? 0 : DEFAULT_TTL).then((books) => {
    try {
      localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify({ at: Date.now(), books }));
    } catch {
      /* Sem espaço: o cache em memória continua funcionando. */
    }
    return books;
  });
}

export function fetchBook(id: string, force = false): Promise<Book | null> {
  return cachedGet<Book | null>(`/books/${id}`, force ? 0 : DEFAULT_TTL);
}

/** Registra a abertura de um livro para o ranking "Mais lidos". */
export function registerBookOpen(id: string): void {
  request("POST", `/books/${id}/open`).catch(() => {
    /* métrica: falhar aqui não pode atrapalhar a leitura */
  });
}

export async function uploadBook(data: {
  title: string;
  author: string;
  description: string;
  genre: string;
  isPublic: boolean;
  coverColor: string;
  seriesId?: string;
  seriesOrder?: number;
  pdfFile: File;
  coverFile?: File;
}): Promise<Book> {
  const userId = localStorage.getItem("books-username") || "anonymous";

  const existing = await fetchBooks(true).catch(() => [] as Book[]);
  const duplicate = existing.find(
    (b) =>
      b.title.trim().toLowerCase() === data.title.trim().toLowerCase() &&
      (b.author || "").trim().toLowerCase() === (data.author || "").trim().toLowerCase()
  );
  if (duplicate) throw new Error("Já existe um livro com este título e autor!");

  try {
    // Caminho rápido: upload direto para o storage via URL assinada.
    const presignedRes = await fetch(`${API_BASE_URL}/books/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ fileName: data.pdfFile.name, fileType: "application/pdf" }),
    });

    if (presignedRes.ok) {
      const pdfS3Data = await presignedRes.json();
      const pdfUploadRes = await fetch(pdfS3Data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: data.pdfFile,
      });
      if (!pdfUploadRes.ok) throw new Error("Erro no upload do PDF");

      let coverUrl: string | null = null;
      if (data.coverFile) {
        const coverPresignedRes = await fetch(`${API_BASE_URL}/books/presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ fileName: data.coverFile.name, fileType: data.coverFile.type }),
        });
        if (coverPresignedRes.ok) {
          const coverS3Data = await coverPresignedRes.json();
          const coverUploadRes = await fetch(coverS3Data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": data.coverFile.type },
            body: data.coverFile,
          });
          if (coverUploadRes.ok) coverUrl = coverS3Data.downloadUrl;
        }
      }

      const book = await request<Book>("POST", "/books", {
        title: data.title,
        author: data.author,
        description: data.description,
        genre: data.genre,
        isPublic: String(data.isPublic),
        coverColor: data.coverColor,
        seriesId: data.seriesId || "", seriesOrder: data.seriesOrder || 1,
        pdfUrl: pdfS3Data.downloadUrl,
        coverUrl,
      });
      invalidate("/books", "/home");
      return book;
    }
  } catch (err) {
    console.warn("Upload direto indisponível, usando o servidor como intermediário.", err);
  }

  const form = new FormData();
  form.append("seriesId", data.seriesId || "");
  form.append("seriesOrder", String(data.seriesOrder || 1));
  form.append("title", data.title);
  form.append("author", data.author);
  form.append("description", data.description);
  form.append("genre", data.genre);
  form.append("isPublic", String(data.isPublic));
  form.append("coverColor", data.coverColor);
  form.append("pdf", data.pdfFile);
  if (data.coverFile) form.append("cover", data.coverFile);

  const book = await upload<Book>("POST", "/books", form);
  invalidate("/books", "/home");
  return book;
}

export async function editBook(id: string, data: Record<string, unknown>): Promise<Book> {
  const book = await request<Book>("PUT", `/books/${id}`, data);
  invalidate("/books", "/home");
  return book;
}

/** Atualiza um livro enviando um novo arquivo de capa. */
export async function editBookWithCover(id: string, data: Record<string, string | number>, coverFile: File): Promise<Book> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v)));
  form.append("cover", coverFile);
  const book = await upload<Book>("PUT", `/books/${id}`, form);
  invalidate("/books", "/home");
  return book;
}

export async function deleteBook(id: string): Promise<{ ok: boolean }> {
  const res = await request<{ ok: boolean }>("DELETE", `/books/${id}`);
  invalidate("/books", "/home");
  return res;
}

// ─── PROGRESSO ────────────────────────────────────────────────────────────────

export function fetchAllProgress(force = false): Promise<ReadingProgress[]> {
  return cachedGet<ReadingProgress[]>("/progress", force ? 0 : DEFAULT_TTL);
}

export function fetchProgress(bookId: string): Promise<ReadingProgress | null> {
  return cachedGet<ReadingProgress | null>(`/progress/${bookId}`, 2000);
}

export async function saveProgress(p: Partial<ReadingProgress> & { bookId: string }): Promise<ReadingProgress> {
  const res = await request<ReadingProgress>("PUT", `/progress/${p.bookId}`, p);
  invalidate("/progress", "/home", "/stats", "/books");
  return res;
}

// ─── AUTENTICAÇÃO ─────────────────────────────────────────────────────────────

export function login(username: string, password: string): Promise<UserProfile> {
  invalidate();
  return request<UserProfile>("POST", "/auth/login", { username, password });
}

/** Dados de configuração pública do servidor (Google, entrega de e-mail). */
export interface ServerConfig {
  googleClientId: string | null;
  emailDelivery: boolean;
}

export function fetchServerConfig(): Promise<ServerConfig> {
  return request<ServerConfig>("GET", "/config");
}

export interface Availability {
  nickname?: { ok: boolean; reason: string | null };
  email?: { ok: boolean; reason: string | null };
}

/** Checa se apelido e/ou e-mail estão livres (cadastro passo a passo). */
export function checkAvailability(params: { nickname?: string; email?: string }): Promise<Availability> {
  const q = new URLSearchParams();
  if (params.nickname) q.set("nickname", params.nickname);
  if (params.email) q.set("email", params.email);
  return request<Availability>("GET", `/auth/available?${q.toString()}`);
}

/** Envia o código de verificação para o e-mail. `devCode` vem só sem serviço de e-mail. */
export function sendEmailCode(email: string, purpose: "signup" | "reset"): Promise<{ ok: boolean; delivered: boolean; devCode?: string }> {
  return request("POST", "/auth/send-code", { email, purpose });
}

export function verifyEmailCode(email: string, code: string, purpose: "signup" | "reset"): Promise<{ ok: boolean; reason?: string }> {
  return request("POST", "/auth/verify-code", { email, code, purpose });
}

export interface SignupData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  code: string;
  avatar: string;
  allowWeak: boolean;
  favoriteGenres: string[];
  instagram?: string;
  tiktok?: string;
}

export function register(data: SignupData): Promise<UserProfile> {
  invalidate();
  return request<UserProfile>("POST", "/auth/register", data);
}

export function resetPassword(email: string, code: string, password: string, allowWeak: boolean): Promise<UserProfile> {
  invalidate();
  return request<UserProfile>("POST", "/auth/reset", { email, code, password, allowWeak });
}

export function loginWithGoogle(credential: string): Promise<UserProfile & { isNew?: boolean }> {
  invalidate();
  return request<UserProfile & { isNew?: boolean }>("POST", "/auth/google", { credential });
}

export async function updateProfile(data: { bio: string; avatar: string; shelf: string[]; displayName?: string; handle?: string; favoriteGenres?: string[]; instagram?: string; tiktok?: string }): Promise<UserProfile> {
  const res = await request<UserProfile>("PUT", "/auth/me", data);
  invalidate("/users", "/home");
  return res;
}

export function fetchCharacters(bookId?: string, force = false): Promise<CharacterCatalog> {
  const query = bookId ? `?bookId=${encodeURIComponent(bookId)}` : "";
  return cachedGet<CharacterCatalog>(`/characters${query}`, force ? 0 : 60000);
}

export async function createCharacter(data: { name: string; characterId?: string; bookIds: string[]; image?: Blob }): Promise<CharacterAvatar> {
  const form = new FormData();
  form.set("name", data.name);
  form.set("characterId", data.characterId || "");
  form.set("bookIds", JSON.stringify(data.bookIds));
  if (data.image) form.set("image", data.image, "avatar.webp");
  const result = await upload<CharacterAvatar>("POST", "/characters", form);
  invalidate("/characters");
  return result;
}

export async function deleteCharacter(id: string): Promise<void> {
  await request("DELETE", `/characters/${encodeURIComponent(id)}`);
  invalidate("/characters");
}

export function sendActivityHeartbeat(data: { scope: "app" | "reader"; bookId?: string; page?: number; clientElapsedSeconds: number }) {
  return request<{ creditedSeconds: number; eligible?: boolean }>("POST", "/activity/heartbeat", data);
}

export function fetchProgression(username: string, force = false) {
  return cachedGet<ProgressionSummary>(`/progression/${encodeURIComponent(username)}`, force ? 0 : 30000);
}

export function adjustUserXp(username: string, amount: number, reason: string) {
  return request<ProgressionSummary>("POST", `/admin/users/${encodeURIComponent(username)}/xp`, { amount, reason });
}

export function setUserLevel(username: string, level: number, reason: string) {
  return request<ProgressionSummary>("PUT", `/admin/users/${encodeURIComponent(username)}/level`, { level, reason });
}

// ─── FAVORITOS ────────────────────────────────────────────────────────────────

export function fetchSavedIds(force = false): Promise<string[]> {
  return cachedGet<string[]>("/saved", force ? 0 : DEFAULT_TTL);
}

export async function toggleSaved(bookId: string, isSaved: boolean): Promise<{ saved: boolean }> {
  const res = await request<{ saved: boolean }>(isSaved ? "DELETE" : "POST", `/saved/${bookId}`);
  invalidate("/saved", "/home");
  return res;
}

// ─── USUÁRIOS E SOCIAL ────────────────────────────────────────────────────────

export function fetchAllUsers(force = false): Promise<UserProfile[]> {
  return cachedGet<UserProfile[]>("/users", force ? 0 : DEFAULT_TTL);
}

export function fetchUserProfile(username: string, force = false): Promise<UserProfile | null> {
  return cachedGet<UserProfile | null>(`/users/${encodeURIComponent(username)}`, force ? 0 : DEFAULT_TTL);
}

export async function followUser(username: string): Promise<{ following: boolean; followers: number }> {
  const res = await request<{ following: boolean; followers: number }>("POST", `/users/${encodeURIComponent(username)}/follow`);
  invalidate("/users", "/feed");
  return res;
}

export async function unfollowUser(username: string): Promise<{ following: boolean; followers: number }> {
  const res = await request<{ following: boolean; followers: number }>("DELETE", `/users/${encodeURIComponent(username)}/follow`);
  invalidate("/users", "/feed");
  return res;
}

export function fetchFeed(scope: "all" | "following" = "all", force = false): Promise<FeedItem[]> {
  return cachedGet<FeedItem[]>(`/feed?scope=${scope}`, force ? 0 : DEFAULT_TTL);
}

export function fetchStats(force = false): Promise<Stats> {
  return cachedGet<Stats>("/stats", force ? 0 : DEFAULT_TTL);
}

// ─── RESENHAS (nota + comentário público) ─────────────────────────────────────

export function fetchReviews(bookId: string, force = false): Promise<Review[]> {
  return cachedGet<Review[]>(`/books/${bookId}/reviews`, force ? 0 : 3000);
}

export async function saveReview(
  bookId: string,
  data: { rating: number; comment: string; hasSpoiler?: boolean }
): Promise<{ rating: number; reviewCount: number; reviews: Review[] }> {
  const res = await request<{ rating: number; reviewCount: number; reviews: Review[] }>(
    "POST", `/books/${bookId}/reviews`, data
  );
  invalidate("/books", "/home", "/feed", "/users", "/stats");
  return res;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await request("DELETE", `/reviews/${reviewId}`);
  invalidate("/books", "/home", "/feed", "/users", "/stats");
}

export async function toggleReviewLike(reviewId: number): Promise<{ likes: number; likedByMe: boolean }> {
  const res = await request<{ likes: number; likedByMe: boolean }>("POST", `/reviews/${reviewId}/like`);
  invalidate("/books", "/home", "/feed");
  return res;
}

export async function addReviewComment(reviewId: number, content: string): Promise<ReviewComment[]> {
  const res = await request<ReviewComment[]>("POST", `/reviews/${reviewId}/comments`, { content });
  invalidate("/books", "/home", "/feed");
  return res;
}

export async function deleteReviewComment(reviewId: number, commentId: number): Promise<void> {
  await request("DELETE", `/reviews/${reviewId}/comments/${commentId}`);
  invalidate("/books", "/home", "/feed");
}

// ─── BANNERS (Admin) ──────────────────────────────────────────────────────────

export function fetchBanners(all = false, force = false): Promise<Banner[]> {
  return cachedGet<Banner[]>(`/banners${all ? "?all=true" : ""}`, force ? 0 : DEFAULT_TTL);
}

export async function createBanner(data: {
  title?: string; subtitle?: string; linkUrl?: string; bookId?: string; sortOrder?: number;
  imageFile?: File | null; imageUrl?: string; sponsor?: string; startsAt?: string; endsAt?: string;
}): Promise<Banner> {
  const form = new FormData();
  if (data.title) form.append("title", data.title);
  if (data.subtitle) form.append("subtitle", data.subtitle);
  if (data.linkUrl) form.append("linkUrl", data.linkUrl);
  if (data.bookId) form.append("bookId", data.bookId);
  if (data.sponsor) form.append("sponsor", data.sponsor);
  if (data.startsAt != null) form.append("startsAt", data.startsAt);
  if (data.endsAt != null) form.append("endsAt", data.endsAt);
  if (data.sortOrder != null) form.append("sortOrder", String(data.sortOrder));
  if (data.imageUrl) form.append("imageUrl", data.imageUrl);
  if (data.imageFile) form.append("image", data.imageFile);
  const res = await upload<Banner>("POST", "/banners", form);
  invalidate("/banners", "/home");
  return res;
}

export async function updateBanner(id: number, data: Record<string, string | number | boolean>, imageFile?: File | null): Promise<Banner> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v)));
  if (imageFile) form.append("image", imageFile);
  const res = await upload<Banner>("PUT", `/banners/${id}`, form);
  invalidate("/banners", "/home");
  return res;
}

export async function deleteBanner(id: number): Promise<void> {
  await request("DELETE", `/banners/${id}`);
  invalidate("/banners", "/home");
}

/**
 * Avisa que um banner foi visto ou clicado.
 *
 * Dispara e esquece: nenhum erro daqui pode atrapalhar a navegação de quem
 * clicou. Usa `sendBeacon` quando existe, para o registro sobreviver mesmo
 * quando o clique leva a pessoa para fora da página.
 */
export function trackBanner(id: number, type: "view" | "click"): void {
  const body = JSON.stringify({ type });
  try {
    const url = `${API_BASE_URL}/banners/${id}/event`;
    if (type === "click" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void request("POST", `/banners/${id}/event`, { type }).catch(() => {});
  } catch {
    /* telemetria nunca deve estourar para o usuário */
  }
}

export function fetchBannerReport(id: number): Promise<BannerReport> {
  return request<BannerReport>("GET", `/banners/${id}/report`);
}

// ─── POSTAGENS DA HOME (Admin) ────────────────────────────────────────────────

export function fetchPosts(all = false, force = false): Promise<HomePost[]> {
  return cachedGet<HomePost[]>(`/posts${all ? "?all=true" : ""}`, force ? 0 : DEFAULT_TTL);
}

export async function createPost(data: {
  title?: string; content?: string; bookId?: string; seriesId?: string; isPinned?: boolean; imageFile?: File | null;
}): Promise<HomePost> {
  const form = new FormData();
  if (data.title) form.append("title", data.title);
  if (data.content) form.append("content", data.content);
  if (data.seriesId) form.append("seriesId", data.seriesId);
  if (data.bookId) form.append("bookId", data.bookId);
  form.append("isPinned", String(!!data.isPinned));
  if (data.imageFile) form.append("image", data.imageFile);
  const res = await upload<HomePost>("POST", "/posts", form);
  invalidate("/posts", "/home");
  return res;
}

export async function updatePost(id: number, data: Record<string, string | number | boolean>, imageFile?: File | null): Promise<HomePost> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v)));
  if (imageFile) form.append("image", imageFile);
  const res = await upload<HomePost>("PUT", `/posts/${id}`, form);
  invalidate("/posts", "/home");
  return res;
}

export async function deletePost(id: number): Promise<void> {
  await request("DELETE", `/posts/${id}`);
  invalidate("/posts", "/home");
}

export async function togglePostLike(id: number): Promise<{ likes: number; likedByMe: boolean }> {
  const res = await request<{ likes: number; likedByMe: boolean }>("POST", `/posts/${id}/like`);
  invalidate("/posts", "/home");
  return res;
}

export function fetchAdminOverview(): Promise<AdminOverview> {
  return cachedGet<AdminOverview>("/admin/overview", 0);
}

// ─── NOTAS E DIÁRIO ───────────────────────────────────────────────────────────

export function fetchBookNotes(bookId: string): Promise<Note[]> {
  return cachedGet<Note[]>(`/notes/book/${bookId}`, 3000);
}

export async function addNote(data: { bookId: string; feedback: string; rating: number }): Promise<Note> {
  const res = await request<Note>("POST", "/notes", data);
  invalidate("/notes", "/stats");
  return res;
}

export async function deleteNote(id: string): Promise<void> {
  await request("DELETE", `/notes/${id}`);
  invalidate("/notes", "/stats");
}

// ─── CHAT E MENSAGENS ─────────────────────────────────────────────────────────

export function fetchChat(target: string): Promise<{ messages: ChatMessage[]; nickname: string | null }> {
  return request("GET", `/chat/${encodeURIComponent(target)}`);
}

export function fetchConversations(): Promise<ChatConversation[]> {
  return request("GET", "/chat");
}

export function fetchMessages(target: string): Promise<{ messages: ChatMessage[]; nickname: string | null }> {
  return request("GET", `/chat/${encodeURIComponent(target)}`);
}

export async function sendMessage(target: string, content: string, bookId?: string): Promise<{ ok: boolean }> {
  return request("POST", `/chat/${encodeURIComponent(target)}`, { content, sharedBookId: bookId || null });
}

export function setNickname(target: string, nickname: string): Promise<{ ok: boolean }> {
  return request("POST", `/chat/nickname/${encodeURIComponent(target)}`, { nickname });
}

export function fetchNotifications(): Promise<Notifications> {
  return request("GET", "/notifications");
}

/** Marca avisos como lidos — todos, ou apenas os ids informados. */
export function markNotificationsRead(ids?: number[]): Promise<{ ok: boolean }> {
  return request("POST", "/notifications/read", ids ? { ids } : {});
}

// ─── STATUS GLOBAL ────────────────────────────────────────────────────────────

export function fetchGlobalStatus(): Promise<{ username: string; content: string; emote: string; updated_at: number } | null> {
  return cachedGet("/status", 5000);
}

export async function updateGlobalStatus(content: string, emote: string) {
  const res = await request("POST", "/status", { content, emote });
  invalidate("/status", "/home");
  return res;
}

// ─── CAPÍTULOS ────────────────────────────────────────────────────────────────

export async function fetchChapters(bookId: string): Promise<BookChapter[]> {
  return (await cachedGet<BookChapter[]>(`/books/${bookId}/chapters`, 5000)) || [];
}

export async function saveChapter(bookId: string, startPage: number, title: string) {
  const res = await request("POST", `/books/${bookId}/chapters`, { startPage, title });
  invalidate(`/books/${bookId}/chapters`);
  return res;
}

export async function deleteChapter(bookId: string, startPage: number) {
  const res = await request("DELETE", `/books/${bookId}/chapters/${startPage}`);
  invalidate(`/books/${bookId}/chapters`);
  return res;
}
