require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { db, sql, initDB } = require("./db");
const { HANDLE_CHANGE_DAYS, normalizeHandle, canChangeHandle, normalizeGenres, normalizeSocialHandle } = require("./profile-rules");
const { summarizeConversations } = require("./chat-summary");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── STORAGE ──────────────────────────────────────────────────────────────────
let s3Client = null;
let supabase = null;
const BUCKET = process.env.S3_BUCKET_NAME || "bookzinhos";

if (process.env.S3_ACCESS_KEY_ID) {
  console.log("📦 Inicializando cliente de armazenamento S3...");
  const { S3Client } = require("@aws-sdk/client-s3");
  s3Client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
} else if (process.env.SUPABASE_URL) {
  console.log("📦 Inicializando cliente de armazenamento Supabase...");
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  );
} else {
  console.log("⚠️ Nenhum serviço de armazenamento em nuvem configurado (.env)");
}

async function uploadToS3(buffer, filename, mimetype) {
  if (!s3Client) throw new Error("Cliente S3 não está configurado");
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: mimetype,
    CacheControl: "public, max-age=31536000, immutable"
  });
  await s3Client.send(command);

  if (process.env.S3_PUBLIC_URL_PREFIX) {
    return `${process.env.S3_PUBLIC_URL_PREFIX}/${filename}`;
  }
  return `${process.env.S3_ENDPOINT}/${BUCKET}/${filename}`;
}

async function uploadToSupabase(buffer, filename, mimetype) {
  if (!supabase) throw new Error("Cliente Supabase não está configurado");
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: mimetype, cacheControl: "31536000", upsert: true });
  if (error) throw new Error("Erro no upload para o Supabase: " + error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

async function uploadFileToCloud(buffer, filename, mimetype) {
  if (s3Client) return uploadToS3(buffer, filename, mimetype);
  if (supabase) return uploadToSupabase(buffer, filename, mimetype);

  // Fallback local (desenvolvimento)
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const safeFilename = filename.replace(/\//g, "-");
  const filePath = path.join(uploadsDir, safeFilename);
  fs.writeFileSync(filePath, buffer);
  return `http://localhost:${PORT}/uploads/${safeFilename}`;
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "1y", immutable: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

/** Nome do usuário logado, vindo do header enviado pelo app. */
function currentUser(req) {
  const raw = req.headers["x-user-id"];
  if (!raw || raw === "anonymous") return null;
  return String(raw);
}

async function isAdmin(username) {
  if (!username) return false;
  const [row] = await db.query(sql`SELECT is_admin FROM users WHERE username = ${username} COLLATE NOCASE`);
  return !!(row && Number(row.is_admin) === 1);
}

/** Bloqueia rotas de administração para quem não é Admin. */
async function requireAdmin(req, res, next) {
  try {
    const me = currentUser(req);
    if (!(await isAdmin(me))) {
      return res.status(403).json({ error: "Apenas a conta Admin pode fazer isso." });
    }
    req.adminUser = me;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  startup.then(() => next()).catch(() => res.status(503).json({ error: "O servidor ainda não conseguiu inicializar o banco de dados." }));
});

app.get("/", (_req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>🐼 myBooks API</h1>
      <p>O servidor está rodando com sucesso! ✨</p>
      <p style="color: #666;">Use a URL do seu Frontend para acessar o app.</p>
    </div>
  `);
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
const appearance = require("./appearance")({ app, db, sql, upload, uploadFileToCloud, currentUser, requireAdmin });
const community = require("./community")({ app, db, sql, upload, uploadFileToCloud, currentUser, requireAdmin });
const characters = require("./characters")({ app, db, sql, upload, uploadFileToCloud, requireAdmin });
async function seriesFields(body) {
  if (!body.seriesId) return { id: null, name: null, order: null };
  const [series] = await db.query(sql`SELECT * FROM book_series WHERE id = ${body.seriesId}`);
  if (!series) throw new Error("Saga não encontrada.");
  const order = Number(body.seriesOrder);
  if (!Number.isFinite(order) || order <= 0 || order > 10000) throw new Error("Informe um volume válido para a saga.");
  return { id: series.id, name: series.name, order };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rowToBook(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    genre: row.genre,
    publisher: row.publisher || "",
    publishedYear: row.published_year || "",
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    isPublic: !!row.is_public,
    coverColor: row.cover_color,
    addedAt: Number(row.added_at) || 0,
    pdfPath: row.pdf_path || null,
    coverImagePath: row.cover_image_path || null,
    seriesId: row.series_id || null,
    seriesName: row.series_name || null,
    seriesOrder: row.series_order == null ? null : Number(row.series_order),
    appearance: row.appearance_json ? JSON.parse(row.appearance_json) : null,
    isUserBook: !!row.is_user_book,
  };
}

/**
 * Estatísticas de todos os livros em 3 queries agregadas (antes era 2 queries
 * por livro — o gargalo da listagem). Retorna um mapa bookId -> stats.
 */
async function loadBookStats() {
  const [ratings, pages, readers] = await Promise.all([
    db.query(sql`SELECT book_id, AVG(rating) as avg_rating, COUNT(*) as cnt FROM book_reviews GROUP BY book_id`),
    db.query(sql`SELECT book_id, COUNT(*) as cnt FROM book_pages GROUP BY book_id`),
    db.query(sql`
      SELECT book_id,
             COUNT(*) as readers,
             SUM(CASE WHEN status = 'finalizado' THEN 1 ELSE 0 END) as finished,
             MAX(last_read_at) as last_read_at
      FROM reading_progress GROUP BY book_id
    `),
  ]);

  const stats = new Map();
  const slot = (id) => {
    if (!stats.has(id)) {
      stats.set(id, { rating: null, reviewCount: 0, pageCount: 0, readers: 0, finished: 0, lastReadAt: 0 });
    }
    return stats.get(id);
  };

  for (const r of ratings) {
    const s = slot(r.book_id);
    s.rating = Math.round(Number(r.avg_rating) * 10) / 10;
    s.reviewCount = Number(r.cnt);
  }
  for (const p of pages) slot(p.book_id).pageCount = Number(p.cnt);
  for (const r of readers) {
    const s = slot(r.book_id);
    s.readers = Number(r.readers);
    s.finished = Number(r.finished);
    s.lastReadAt = Number(r.last_read_at) || 0;
  }
  return stats;
}

function decorateBook(book, stats) {
  const s = stats.get(book.id);
  if (s) {
    if (s.rating !== null) {
      book.rating = s.rating;
      book.reviewCount = s.reviewCount;
    }
    book.pageCount = s.pageCount;
    book.readers = s.readers;
    book.finishedCount = s.finished;
    book.lastReadAt = s.lastReadAt;
  } else {
    book.pageCount = 0;
    book.readers = 0;
    book.finishedCount = 0;
    book.lastReadAt = 0;
  }
  // Popularidade: leitores valem mais que conclusões isoladas, resenhas somam.
  book.popularity = (book.readers || 0) * 3 + (book.finishedCount || 0) * 2 + (book.reviewCount || 0);
  return book;
}

/**
 * Guarda um aviso para alguém.
 *
 * Nunca lança: um aviso é secundário e não pode derrubar a ação que o gerou
 * (curtir, comentar, seguir). Também não avisa a própria pessoa.
 */
async function notify(username, { type, title, body = "", link = "/", actor = "" }) {
  try {
    if (!username) return;
    if (actor && String(actor).toLowerCase() === String(username).toLowerCase()) return;
    await db.query(sql`
      INSERT INTO notifications (username, type, title, body, link, actor, is_read, created_at)
      VALUES (${username}, ${type}, ${title}, ${body}, ${link}, ${actor}, 0, ${Date.now()})
    `);
  } catch (err) {
    console.error("[notify]", err.message);
  }
}

/** Avisa todo mundo, menos quem gerou o evento. */
async function notifyEveryone(payload) {
  try {
    const users = await db.query(sql`SELECT username FROM users`);
    for (const u of users) await notify(u.username, payload);
  } catch (err) {
    console.error("[notifyEveryone]", err.message);
  }
}

/** Recalcula média/contagem de um livro depois de mexer nas resenhas. */
async function refreshBookRating(bookId) {
  const [stats] = await db.query(sql`SELECT AVG(rating) as avg, COUNT(*) as cnt FROM book_reviews WHERE book_id = ${bookId}`);
  const avg = stats && stats.avg != null ? Math.round(Number(stats.avg) * 10) / 10 : 0;
  const cnt = stats ? Number(stats.cnt) : 0;
  await db.query(sql`UPDATE books SET rating = ${avg}, review_count = ${cnt} WHERE id = ${bookId}`);
  return { rating: avg, reviewCount: cnt };
}

/** Monta resenhas com autor, curtidas e respostas — sem N+1. */
async function loadReviews({ bookId = null, username = null, limit = 100, me = null }) {
  let reviews;
  if (bookId) {
    reviews = await db.query(sql`SELECT * FROM book_reviews WHERE book_id = ${bookId} ORDER BY created_at DESC LIMIT ${limit}`);
  } else if (username) {
    reviews = await db.query(sql`SELECT * FROM book_reviews WHERE username = ${username} COLLATE NOCASE ORDER BY created_at DESC LIMIT ${limit}`);
  } else {
    reviews = await db.query(sql`SELECT * FROM book_reviews ORDER BY created_at DESC LIMIT ${limit}`);
  }
  if (reviews.length === 0) return [];

  const ids = reviews.map((r) => Number(r.id));
  const idList = ids.join(",");
  const authors = [...new Set(reviews.map((r) => String(r.username).toLowerCase()))];

  const [likeRows, myLikes, commentRows, userRows, bookRows] = await Promise.all([
    db.query({ text: `SELECT review_id, COUNT(*) as c FROM review_likes WHERE review_id IN (${idList}) GROUP BY review_id`, values: [] }),
    me
      ? db.query({ text: `SELECT review_id FROM review_likes WHERE review_id IN (${idList}) AND username = ? COLLATE NOCASE`, values: [me] })
      : Promise.resolve([]),
    db.query({ text: `SELECT * FROM review_comments WHERE review_id IN (${idList}) ORDER BY created_at ASC`, values: [] }),
    db.query(sql`SELECT username, avatar, bio, is_admin FROM users`),
    bookId
      ? Promise.resolve([])
      : db.query(sql`SELECT id, title, author, cover_image_path, cover_color FROM books`),
  ]);

  const likeCount = new Map(likeRows.map((r) => [Number(r.review_id), Number(r.c)]));
  const liked = new Set(myLikes.map((r) => Number(r.review_id)));
  const userMap = new Map(userRows.map((u) => [String(u.username).toLowerCase(), u]));
  const bookMap = new Map(bookRows.map((b) => [b.id, b]));

  const commentsByReview = new Map();
  for (const c of commentRows) {
    const rid = Number(c.review_id);
    if (!commentsByReview.has(rid)) commentsByReview.set(rid, []);
    const author = userMap.get(String(c.username).toLowerCase());
    commentsByReview.get(rid).push({
      id: Number(c.id),
      reviewId: rid,
      username: c.username,
      avatar: author ? author.avatar : null,
      content: c.content,
      createdAt: Number(c.created_at),
    });
  }

  return reviews.map((r) => {
    const id = Number(r.id);
    const author = userMap.get(String(r.username).toLowerCase());
    const book = bookMap.get(r.book_id);
    return {
      id,
      bookId: r.book_id,
      username: r.username,
      avatar: author ? author.avatar : null,
      isAdmin: author ? !!Number(author.is_admin) : false,
      rating: Number(r.rating),
      comment: r.comment,
      hasSpoiler: !!Number(r.has_spoiler),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      likes: likeCount.get(id) || 0,
      likedByMe: liked.has(id),
      comments: commentsByReview.get(id) || [],
      book: book
        ? { id: book.id, title: book.title, author: book.author, coverImagePath: book.cover_image_path, coverColor: book.cover_color }
        : undefined,
    };
  });
}

// ─── BOOKS ────────────────────────────────────────────────────────────────────

app.get("/books", async (_req, res) => {
  try {
    const [rows, stats] = await Promise.all([
      db.query(sql`SELECT * FROM books ORDER BY added_at DESC`),
      loadBookStats(),
    ]);
    res.json(rows.map((r) => decorateBook(rowToBook(r), stats)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/books/:id", async (req, res) => {
  try {
    const me = currentUser(req);
    const [row] = await db.query(sql`SELECT * FROM books WHERE id = ${req.params.id}`);
    if (!row) return res.status(404).json({ error: "Livro não encontrado" });

    const book = rowToBook(row);
    const [reviews, pageRows, readerRow] = await Promise.all([
      loadReviews({ bookId: row.id, me }),
      db.query(sql`SELECT content FROM book_pages WHERE book_id = ${row.id} ORDER BY page_num`),
      db.query(sql`
        SELECT COUNT(*) as readers, SUM(CASE WHEN status = 'finalizado' THEN 1 ELSE 0 END) as finished
        FROM reading_progress WHERE book_id = ${row.id}
      `),
    ]);

    book.reviews = reviews;
    book.pages = pageRows.map((r) => r.content);
    book.pageCount = pageRows.length;
    book.readers = readerRow[0] ? Number(readerRow[0].readers) || 0 : 0;
    book.finishedCount = readerRow[0] ? Number(readerRow[0].finished) || 0 : 0;
    if (reviews.length > 0) {
      book.rating = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
      book.reviewCount = reviews.length;
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Registra uma abertura de livro (alimenta o ranking "Mais lidos"). */
app.post("/books/:id/open", async (req, res) => {
  try {
    const me = currentUser(req) || "anonymous";
    const now = Date.now();
    const [existing] = await db.query(sql`SELECT opens FROM book_opens WHERE book_id = ${req.params.id} AND username = ${me} COLLATE NOCASE`);
    if (existing) {
      await db.query(sql`UPDATE book_opens SET opens = opens + 1, last_open_at = ${now} WHERE book_id = ${req.params.id} AND username = ${me} COLLATE NOCASE`);
    } else {
      await db.query(sql`INSERT INTO book_opens (book_id, username, opens, last_open_at) VALUES (${req.params.id}, ${me}, 1, ${now})`);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRESIGNED URL ────────────────────────────────────────────────────────────
app.post("/books/presigned-url", async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) {
      return res.status(400).json({ error: "fileName e fileType são obrigatórios" });
    }

    const id = `user-${Date.now()}`;
    const isPdf = fileType === "application/pdf";
    const folder = isPdf ? "pdfs" : "covers";
    const extension = path.extname(fileName) || (isPdf ? ".pdf" : ".jpg");
    const safeName = `${folder}/${id}-${Math.floor(Math.random() * 1000)}${extension}`;

    if (s3Client) {
      const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
      const { PutObjectCommand } = require("@aws-sdk/client-s3");

      const command = new PutObjectCommand({ Bucket: BUCKET, Key: safeName, ContentType: fileType });
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      const downloadUrl = process.env.S3_PUBLIC_URL_PREFIX
        ? `${process.env.S3_PUBLIC_URL_PREFIX}/${safeName}`
        : `${process.env.S3_ENDPOINT}/${BUCKET}/${safeName}`;

      res.json({ uploadUrl, downloadUrl });
    } else if (supabase) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(safeName);
      if (error) throw new Error("Erro ao gerar URL assinada do Supabase: " + error.message);
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(safeName);
      res.json({ uploadUrl: data.signedUrl, downloadUrl: urlData.publicUrl });
    } else {
      res.status(400).json({ error: "Armazenamento em nuvem não configurado para URLs assinadas" });
    }
  } catch (err) {
    console.error("Erro ao gerar URL assinada:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/books", upload.fields([{ name: "pdf", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, description, genre, isPublic, coverColor, publisher, publishedYear } = req.body;
    const series = req.body.seriesId !== undefined ? await seriesFields(req.body) : undefined;
    if (!title) return res.status(400).json({ error: "Título é obrigatório" });

    const [existing] = await db.query(sql`
      SELECT id FROM books
      WHERE LOWER(TRIM(title)) = LOWER(TRIM(${title}))
        AND LOWER(TRIM(author)) = LOWER(TRIM(${author || ""}))
    `);
    if (existing) {
      return res.status(400).json({ error: "Já existe um livro com este título e autor!" });
    }

    const id = `user-${Date.now()}`;
    const pdfFile = req.files?.pdf?.[0];
    const coverFile = req.files?.cover?.[0];

    let pdfUrl = req.body.pdfUrl || null;
    let coverUrl = req.body.coverUrl || null;

    if (!pdfUrl && pdfFile) {
      pdfUrl = await uploadFileToCloud(pdfFile.buffer, `pdfs/${id}-${Date.now()}.pdf`, "application/pdf");
    }
    if (!coverUrl && coverFile) {
      coverUrl = await uploadFileToCloud(coverFile.buffer, `covers/${id}-${Date.now()}.jpg`, coverFile.mimetype);
    }

    await db.query(sql`
      INSERT INTO books (id,title,author,description,genre,publisher,published_year,rating,review_count,is_public,cover_color,added_at,pdf_path,cover_image_path,is_user_book)
      VALUES (${id},${title},${author || ""},${description || ""},${genre || "Outros"},${publisher || ""},${publishedYear || ""},0,0,${isPublic === "false" ? 0 : 1},${coverColor || "lavender-mint"},${Date.now()},${pdfUrl},${coverUrl},1)
    `);

    if (series) await db.query(sql`UPDATE books SET series_id=${series.id}, series_name=${series.name}, series_order=${series.order} WHERE id=${id}`);
    const [bookRow] = await db.query(sql`SELECT * FROM books WHERE id = ${id}`);
    const book = rowToBook(bookRow);
    book.reviews = [];
    book.pages = [];
    res.status(201).json(book);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/books/:id", upload.fields([{ name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, description, genre, isPublic, coverColor, publisher, publishedYear } = req.body;
    const series = req.body.seriesId !== undefined ? await seriesFields(req.body) : undefined;
    const coverFile = req.files?.cover?.[0];

    const [existing] = await db.query(sql`SELECT * FROM books WHERE id = ${req.params.id}`);
    if (!existing) return res.status(404).json({ error: "Livro não encontrado" });

    let coverUrl = req.body.coverUrl ?? existing.cover_image_path;
    if (coverFile) {
      coverUrl = await uploadFileToCloud(coverFile.buffer, `covers/cover-${req.params.id}-${Date.now()}.jpg`, coverFile.mimetype);
    }

    await db.query(sql`
      UPDATE books SET
        title=${title || existing.title},
        author=${author ?? existing.author},
        description=${description ?? existing.description},
        genre=${genre || existing.genre},
        publisher=${publisher ?? existing.publisher ?? ""},
        published_year=${publishedYear ?? existing.published_year ?? ""},
        is_public=${isPublic === "false" || isPublic === false ? 0 : 1},
        cover_color=${coverColor || existing.cover_color},
        cover_image_path=${coverUrl}
      WHERE id=${req.params.id}
    `);
    if (series) await db.query(sql`UPDATE books SET series_id=${series.id}, series_name=${series.name}, series_order=${series.order} WHERE id=${req.params.id}`);
    const [updated] = await db.query(sql`SELECT * FROM books WHERE id = ${req.params.id}`);
    const book = rowToBook(updated);
    book.reviews = await loadReviews({ bookId: req.params.id, me: currentUser(req) });
    book.pages = (await db.query(sql`SELECT content FROM book_pages WHERE book_id = ${req.params.id} ORDER BY page_num`)).map((r) => r.content);
    res.json(book);
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/books/:id/cover", upload.fields([{ name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const coverFile = req.files?.cover?.[0];
    if (!coverFile) return res.status(400).json({ error: "Arquivo de capa obrigatório" });

    const coverUrl = await uploadFileToCloud(coverFile.buffer, `covers/cover-${req.params.id}-${Date.now()}.jpg`, coverFile.mimetype);
    await db.query(sql`UPDATE books SET cover_image_path=${coverUrl} WHERE id=${req.params.id}`);
    res.json({ coverImagePath: coverUrl });
  } catch (err) {
    console.error("Error uploading cover:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/books/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [row] = await db.query(sql`SELECT pdf_path, cover_image_path FROM books WHERE id = ${id}`);
    if (!row) return res.status(404).json({ error: "Livro não encontrado" });
    if (row.pdf_path && !row.pdf_path.startsWith("http") && fs.existsSync(row.pdf_path)) fs.unlinkSync(row.pdf_path);
    if (row.cover_image_path && !row.cover_image_path.startsWith("http") && fs.existsSync(row.cover_image_path)) fs.unlinkSync(row.cover_image_path);

    // Cascata explícita para compatibilidade com Turso/SQLite
    await db.query(sql`DELETE FROM review_likes WHERE review_id IN (SELECT id FROM book_reviews WHERE book_id = ${id})`);
    await db.query(sql`DELETE FROM review_comments WHERE review_id IN (SELECT id FROM book_reviews WHERE book_id = ${id})`);
    await db.query(sql`DELETE FROM book_pages WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM book_reviews WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM reading_progress WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM notes WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM saved_books WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM book_recommendations WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM book_chapters WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM book_opens WHERE book_id = ${id}`);
    await db.query(sql`DELETE FROM books WHERE id = ${id}`);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const CODE_TTL_MS = 10 * 60 * 1000;   // validade do código enviado por e-mail
const CODE_MAX_TRIES = 6;             // tentativas antes de invalidar o código
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICK_RE = /^[a-zA-Z0-9_.]{2,20}$/;

/** Guarda a senha como scrypt (sal + hash). Nunca em texto puro. */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * Confere a senha. Aceita o formato scrypt novo e, por retrocompatibilidade,
 * senhas antigas em texto puro — inclusive a do Admin, que o seed reafirma
 * assim a cada boot.
 */
function verifyPassword(pw, stored) {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const test = crypto.scryptSync(pw, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(test, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return stored === pw;
}

/** Requisitos de senha. Vazio = senha forte. */
function passwordIssues(pw) {
  const issues = [];
  if (!pw || pw.length < 8) issues.push("min8");
  if (!/[0-9]/.test(pw || "")) issues.push("number");
  if (!/[^A-Za-z0-9]/.test(pw || "")) issues.push("symbol");
  return issues;
}

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const genCode = () => String(crypto.randomInt(100000, 1000000)); // 6 dígitos

/**
 * Envia o código por e-mail.
 *
 * Usa a API HTTP da Resend quando `RESEND_API_KEY` está no ambiente — não
 * precisa de biblioteca, só de `fetch`. Sem chave configurada, cai no modo de
 * desenvolvimento: registra o código no log e o devolve para o cliente, para
 * o fluxo poder ser testado antes de existir um serviço de e-mail.
 */
async function sendEmailCode(email, code, purpose) {
  const subject = purpose === "reset" ? "Redefinir senha — myBooks" : "Seu código do myBooks";
  const text = `Seu código é ${code}. Ele vale por 10 minutos.\n\nSe não foi você, ignore este e-mail.`;
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || "myBooks <onboarding@resend.dev>",
          to: email, subject, text,
        }),
      });
      if (r.ok) return { delivered: true };
      console.error("[mail] Resend recusou:", await r.text());
    } catch (err) {
      console.error("[mail]", err.message);
    }
  }
  console.log(`[mail:dev] Código para ${email} (${purpose}): ${code}`);
  return { delivered: false };
}

const isProd = () => process.env.NODE_ENV === "production";

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.display_name || user.full_name || user.username,
    handle: user.handle || String(user.username).toLowerCase(),
    handleChangedAt: Number(user.handle_changed_at) || 0,
    nextHandleChangeAt: Number(user.handle_changed_at) ? Number(user.handle_changed_at) + HANDLE_CHANGE_DAYS * 86400000 : 0,
    favoriteGenres: user.favorite_genres ? safeParse(user.favorite_genres) : [],
    instagram: user.instagram_handle || "",
    tiktok: user.tiktok_handle || "",
    themeId: user.profile_theme_id || "lilac",
    bio: user.bio,
    avatar: user.avatar,
    shelf: user.shelf ? safeParse(user.shelf) : [],
    pandinhas: Number(user.pandinhas) || 0,
    isAdmin: !!Number(user.is_admin),
  };
}

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

app.get("/version", (_req, res) => {
  // Sonda de deploy: se esta rota responde, o servidor esta com o codigo novo.
  res.json({ version: "auth-system-1", routes: ["/config", "/auth/available", "/auth/google"], ts: Date.now() });
});

app.get("/config", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    emailDelivery: !!process.env.RESEND_API_KEY,
  });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Aceita entrar pelo apelido ou pelo e-mail.
    const [user] = await db.query(sql`
      SELECT * FROM users WHERE username = ${username} COLLATE NOCASE OR handle = ${normalizeHandle(username) || username} COLLATE NOCASE OR email = ${username} COLLATE NOCASE
    `);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Diz se um apelido ou e-mail já está em uso — alimenta o cadastro passo a passo. */
app.get("/auth/available", async (req, res) => {
  try {
    const nickname = String(req.query.nickname || "").trim();
    const email = String(req.query.email || "").trim();
    const out = {};
    if (nickname) {
      if (!NICK_RE.test(nickname)) {
        out.nickname = { ok: false, reason: "formato" };
      } else {
        const [row] = await db.query(sql`SELECT 1 FROM users WHERE username = ${nickname} COLLATE NOCASE OR handle = ${normalizeHandle(nickname)} COLLATE NOCASE`);
        out.nickname = { ok: !row, reason: row ? "usado" : null };
      }
    }
    if (email) {
      if (!EMAIL_RE.test(email)) {
        out.email = { ok: false, reason: "formato" };
      } else {
        const [row] = await db.query(sql`SELECT 1 FROM users WHERE email = ${email} COLLATE NOCASE`);
        out.email = { ok: !row, reason: row ? "usado" : null };
      }
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Envia um código de verificação para o e-mail.
 *
 * `purpose: "signup"` exige que o e-mail ainda não tenha conta; `"reset"` exige
 * que já tenha. Guardamos só o hash do código e apagamos os anteriores daquele
 * e-mail e propósito, para não deixar códigos válidos soltos.
 */
app.post("/auth/send-code", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const purpose = req.body.purpose === "reset" ? "reset" : "signup";
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido." });

    const [existing] = await db.query(sql`SELECT 1 FROM users WHERE email = ${email} COLLATE NOCASE`);
    if (purpose === "signup" && existing) {
      return res.status(409).json({ error: "Este e-mail já tem conta. Use 'Esqueci minha senha'.", code: "email_em_uso" });
    }
    if (purpose === "reset" && !existing) {
      return res.status(404).json({ error: "Não há conta com este e-mail." });
    }

    const code = genCode();
    const now = Date.now();
    await db.query(sql`DELETE FROM email_codes WHERE email = ${email} COLLATE NOCASE AND purpose = ${purpose}`);
    await db.query(sql`
      INSERT INTO email_codes (email, code_hash, purpose, expires_at, attempts, created_at)
      VALUES (${email}, ${hashCode(code)}, ${purpose}, ${now + CODE_TTL_MS}, 0, ${now})
    `);

    const { delivered } = await sendEmailCode(email, code, purpose);
    // Sem serviço de e-mail (desenvolvimento), devolve o código para testar.
    res.json({ ok: true, delivered, devCode: delivered || isProd() ? undefined : code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Confere um código sem consumi-lo (usado para liberar o próximo passo do cadastro). */
async function checkCode(email, purpose, code) {
  const [row] = await db.query(sql`
    SELECT rowid, * FROM email_codes WHERE email = ${email} COLLATE NOCASE AND purpose = ${purpose}
  `);
  if (!row) return { ok: false, reason: "sem_codigo" };
  if (Date.now() > Number(row.expires_at)) return { ok: false, reason: "expirado" };
  if (Number(row.attempts) >= CODE_MAX_TRIES) return { ok: false, reason: "tentativas" };
  if (row.code_hash !== hashCode(code)) {
    await db.query(sql`UPDATE email_codes SET attempts = attempts + 1 WHERE rowid = ${row.rowid}`);
    return { ok: false, reason: "incorreto" };
  }
  return { ok: true, rowid: row.rowid };
}

app.post("/auth/verify-code", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const purpose = req.body.purpose === "reset" ? "reset" : "signup";
    const result = await checkCode(email, purpose, String(req.body.code || ""));
    res.json({ ok: result.ok, reason: result.reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const code = String(req.body.code || "");
    const avatar = String(req.body.avatar || "🐼").slice(0, 8) || "🐼";
    const favoriteGenres = normalizeGenres(req.body.favoriteGenres);
    const instagram = normalizeSocialHandle(req.body.instagram, "instagram");
    const tiktok = normalizeSocialHandle(req.body.tiktok, "tiktok");
    const allowWeak = req.body.allowWeak === true || req.body.allowWeak === "true";

    // Validações — a interface já checa, mas o servidor é a palavra final.
    if (fullName.length < 3) return res.status(400).json({ error: "Escreva seu nome completo." });
    if (!NICK_RE.test(username)) return res.status(400).json({ error: "Apelido inválido (2 a 20 letras, números, . ou _)." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido." });
    if (instagram === null || tiktok === null) return res.status(400).json({ error: "Confira o @ do Instagram ou TikTok." });

    // Regra: 8 caracteres sempre. Com a caixa marcada ("deixar minha conta
    // não segura"), isso basta; senão, também exige um número e um símbolo.
    const issues = passwordIssues(password);
    if (issues.includes("min8")) return res.status(400).json({ error: "A senha precisa de ao menos 8 caracteres." });
    if (!allowWeak && (issues.includes("number") || issues.includes("symbol"))) {
      return res.status(400).json({ error: "A senha não atende aos requisitos." });
    }

    const [nickTaken] = await db.query(sql`SELECT 1 FROM users WHERE username = ${username} COLLATE NOCASE OR handle = ${normalizeHandle(username)} COLLATE NOCASE`);
    if (nickTaken) return res.status(409).json({ error: "Este apelido já existe." });
    const [emailTaken] = await db.query(sql`SELECT 1 FROM users WHERE email = ${email} COLLATE NOCASE`);
    if (emailTaken) return res.status(409).json({ error: "Este e-mail já tem conta. Use 'Esqueci minha senha'." });

    const verified = await checkCode(email, "signup", code);
    if (!verified.ok) return res.status(400).json({ error: "Código de verificação inválido ou expirado.", reason: verified.reason });

    const bio = "Novo leitor por aqui ✨";
    const now = Date.now();
    await db.query(sql`
      INSERT INTO users (username, password, bio, avatar, pandinhas, is_admin, created_at, full_name, email, auth_provider, display_name, handle, favorite_genres, instagram_handle, tiktok_handle)
      VALUES (${username}, ${hashPassword(password)}, ${bio}, ${avatar}, 0, 0, ${now}, ${fullName}, ${email}, 'senha', ${fullName}, ${normalizeHandle(username)}, ${JSON.stringify(favoriteGenres)}, ${instagram}, ${tiktok})
    `);
    await db.query(sql`DELETE FROM email_codes WHERE email = ${email} COLLATE NOCASE`);

    res.status(201).json({ username, bio, avatar, shelf: [], pandinhas: 0, isAdmin: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Redefinir senha: confere o código de recuperação e grava a nova senha. */
app.post("/auth/reset", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const code = String(req.body.code || "");
    const allowWeak = req.body.allowWeak === true || req.body.allowWeak === "true";

    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido." });
    const issues = passwordIssues(password);
    if (issues.includes("min8")) return res.status(400).json({ error: "A senha precisa de ao menos 8 caracteres." });
    if (!allowWeak && (issues.includes("number") || issues.includes("symbol"))) {
      return res.status(400).json({ error: "A senha não atende aos requisitos." });
    }

    const verified = await checkCode(email, "reset", code);
    if (!verified.ok) return res.status(400).json({ error: "Código inválido ou expirado.", reason: verified.reason });

    const [user] = await db.query(sql`SELECT * FROM users WHERE email = ${email} COLLATE NOCASE`);
    if (!user) return res.status(404).json({ error: "Conta não encontrada." });
    await db.query(sql`UPDATE users SET password = ${hashPassword(password)} WHERE email = ${email} COLLATE NOCASE`);
    await db.query(sql`DELETE FROM email_codes WHERE email = ${email} COLLATE NOCASE`);
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Login com Google.
 *
 * Precisa de `GOOGLE_CLIENT_ID` no ambiente. O frontend obtém um id_token pelo
 * botão do Google e o manda aqui; conferimos o token no próprio Google (sem
 * biblioteca, só `fetch`). Conta nova é criada com um apelido derivado do
 * e-mail; a pessoa ajusta apelido e emote depois, no perfil.
 */
app.post("/auth/google", async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(501).json({ error: "Login com Google não está configurado." });
    const credential = String(req.body.credential || "");
    if (!credential) return res.status(400).json({ error: "Faltou o token do Google." });

    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return res.status(401).json({ error: "Token do Google inválido." });
    const info = await r.json();
    if (info.aud !== clientId) return res.status(401).json({ error: "Token não pertence a este app." });
    if (info.email_verified !== "true" && info.email_verified !== true) {
      return res.status(401).json({ error: "E-mail do Google não verificado." });
    }

    const email = String(info.email || "").toLowerCase();
    const [existing] = await db.query(sql`SELECT * FROM users WHERE email = ${email} COLLATE NOCASE`);
    if (existing) return res.json(publicUser(existing));

    // Apelido único a partir do e-mail.
    const base = (email.split("@")[0] || "leitor").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 16) || "leitor";
    let username = base;
    for (let i = 0; i < 50; i++) {
      const [taken] = await db.query(sql`SELECT 1 FROM users WHERE username = ${username} COLLATE NOCASE`);
      if (!taken) break;
      username = `${base}${crypto.randomInt(10, 9999)}`;
    }
    const now = Date.now();
    await db.query(sql`
      INSERT INTO users (username, password, bio, avatar, pandinhas, is_admin, created_at, full_name, email, auth_provider, display_name, handle)
      VALUES (${username}, '', 'Novo leitor por aqui ✨', '🐼', 0, 0, ${now}, ${String(info.name || "")}, ${email}, 'google', ${String(info.name || username)}, ${normalizeHandle(username)})
    `);
    const [created] = await db.query(sql`SELECT * FROM users WHERE username = ${username} COLLATE NOCASE`);
    res.status(201).json({ ...publicUser(created), isNew: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/auth/me", async (req, res) => {
  try {
    const { bio, avatar, shelf } = req.body;
    const username = currentUser(req);
    if (!username) return res.status(401).json({ error: "Não autorizado" });
    const [existing] = await db.query(sql`SELECT * FROM users WHERE username=${username} COLLATE NOCASE`);
    if (!existing) return res.status(404).json({ error: "Conta não encontrada." });
    const displayName = String(req.body.displayName ?? existing.display_name ?? existing.full_name ?? username).trim().slice(0, 60);
    if (displayName.length < 2) return res.status(400).json({ error: "O nome precisa ter pelo menos 2 caracteres." });
    const requestedHandle = normalizeHandle(req.body.handle ?? existing.handle ?? username);
    if (!requestedHandle) return res.status(400).json({ error: "O @ deve ter de 2 a 20 letras, números, ponto ou _." });
    const currentHandle = normalizeHandle(existing.handle || existing.username);
    let changedAt = Number(existing.handle_changed_at) || 0;
    if (requestedHandle !== currentHandle) {
      if (!canChangeHandle(changedAt)) {
        const next = changedAt + HANDLE_CHANGE_DAYS * 86400000;
        return res.status(429).json({ error: `Você poderá alterar o @ novamente em ${new Date(next).toLocaleDateString('pt-BR')}.`, nextHandleChangeAt: next });
      }
      const [taken] = await db.query(sql`SELECT 1 FROM users WHERE handle=${requestedHandle} COLLATE NOCASE AND username<>${username} COLLATE NOCASE`);
      if (taken) return res.status(409).json({ error: "Este @ já está sendo usado." });
      changedAt = Date.now();
    }
    const favoriteGenres = normalizeGenres(req.body.favoriteGenres ?? safeParse(existing.favorite_genres));
    const instagram = normalizeSocialHandle(req.body.instagram ?? existing.instagram_handle, "instagram");
    const tiktok = normalizeSocialHandle(req.body.tiktok ?? existing.tiktok_handle, "tiktok");
    if (instagram === null || tiktok === null) return res.status(400).json({ error: "Confira o @ do Instagram ou TikTok." });
    const nextBio = String(bio ?? existing.bio ?? '').slice(0, 200);
    const nextAvatar = String(avatar ?? existing.avatar ?? '🐼');
    const nextShelf = Array.isArray(shelf) ? shelf : safeParse(existing.shelf);
    await db.query(sql`UPDATE users SET bio=${nextBio}, avatar=${nextAvatar}, shelf=${JSON.stringify(nextShelf)}, display_name=${displayName}, handle=${requestedHandle}, handle_changed_at=${changedAt}, favorite_genres=${JSON.stringify(favoriteGenres)}, instagram_handle=${instagram}, tiktok_handle=${tiktok} WHERE username=${username} COLLATE NOCASE`);
    const [user] = await db.query(sql`SELECT * FROM users WHERE username = ${username} COLLATE NOCASE`);
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USUÁRIOS / PERFIS ────────────────────────────────────────────────────────

/** Lista de leitores com contadores sociais — usada na aba Social. */
app.get("/users", async (req, res) => {
  try {
    const me = currentUser(req);
    const [rows, followRows, reviewRows, finishedRows, myFollowing] = await Promise.all([
      db.query(sql`SELECT username, display_name, handle, bio, avatar, pandinhas, is_admin, favorite_genres FROM users`),
      db.query(sql`SELECT following, COUNT(*) as c FROM follows GROUP BY following`),
      db.query(sql`SELECT username, COUNT(*) as c FROM book_reviews GROUP BY username`),
      db.query(sql`SELECT username, COUNT(*) as c FROM reading_progress WHERE status = 'finalizado' GROUP BY username`),
      me ? db.query(sql`SELECT following FROM follows WHERE follower = ${me} COLLATE NOCASE`) : Promise.resolve([]),
    ]);

    const followers = new Map(followRows.map((r) => [String(r.following).toLowerCase(), Number(r.c)]));
    const reviews = new Map(reviewRows.map((r) => [String(r.username).toLowerCase(), Number(r.c)]));
    const finished = new Map(finishedRows.map((r) => [String(r.username).toLowerCase(), Number(r.c)]));
    const following = new Set(myFollowing.map((r) => String(r.following).toLowerCase()));

    res.json(rows.map((u) => {
      const key = String(u.username).toLowerCase();
      return {
        username: u.username,
        displayName: u.display_name || u.username,
        handle: u.handle || String(u.username).toLowerCase(),
        favoriteGenres: safeParse(u.favorite_genres),
        bio: u.bio,
        avatar: u.avatar,
        pandinhas: Number(u.pandinhas) || 0,
        isAdmin: !!Number(u.is_admin),
        followers: followers.get(key) || 0,
        reviewCount: reviews.get(key) || 0,
        finishedCount: finished.get(key) || 0,
        isFollowedByMe: following.has(key),
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/users/:username", async (req, res) => {
  try {
    const me = currentUser(req);
    const target = req.params.username;
    const [row] = await db.query(sql`SELECT * FROM users WHERE username = ${target} COLLATE NOCASE`);
    if (!row) return res.status(404).json({ error: "Usuário não encontrado" });

    const [followerRows, followingRows, reviews, progressRows, savedRows, meFollows] = await Promise.all([
      db.query(sql`SELECT follower FROM follows WHERE following = ${target} COLLATE NOCASE`),
      db.query(sql`SELECT following FROM follows WHERE follower = ${target} COLLATE NOCASE`),
      loadReviews({ username: target, me, limit: 30 }),
      db.query(sql`SELECT book_id, status, progress, last_read_at FROM reading_progress WHERE username = ${target} COLLATE NOCASE`),
      db.query(sql`SELECT book_id FROM saved_books WHERE username = ${target} COLLATE NOCASE ORDER BY saved_at DESC`),
      me ? db.query(sql`SELECT 1 FROM follows WHERE follower = ${me} COLLATE NOCASE AND following = ${target} COLLATE NOCASE`) : Promise.resolve([]),
    ]);

    const profile = publicUser(row);
    profile.followers = followerRows.length;
    profile.following = followingRows.length;
    profile.followerNames = followerRows.map((r) => r.follower);
    profile.followingNames = followingRows.map((r) => r.following);
    profile.isFollowedByMe = meFollows.length > 0;
    profile.reviews = reviews;
    profile.savedIds = savedRows.map((r) => r.book_id);
    profile.reading = progressRows.filter((p) => p.status === "lendo").map((p) => p.book_id);
    profile.finishedIds = progressRows.filter((p) => p.status === "finalizado").map((p) => p.book_id);
    profile.stats = {
      finished: profile.finishedIds.length,
      reading: profile.reading.length,
      reviews: reviews.length,
      saved: profile.savedIds.length,
    };
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users/:username/follow", async (req, res) => {
  try {
    const me = currentUser(req);
    const target = req.params.username;
    if (!me) return res.status(401).json({ error: "Entre na sua conta para seguir leitores." });
    if (me.toLowerCase() === target.toLowerCase()) return res.status(400).json({ error: "Você não pode seguir a si mesmo." });
    const [exists] = await db.query(sql`SELECT 1 FROM users WHERE username = ${target} COLLATE NOCASE`);
    if (!exists) return res.status(404).json({ error: "Usuário não encontrado" });
    await db.query(sql`INSERT OR IGNORE INTO follows (follower, following, created_at) VALUES (${me}, ${target}, ${Date.now()})`);

    await notify(target, {
      type: "seguidor",
      title: `${me} começou a seguir você`,
      link: `/user/${encodeURIComponent(me)}`,
      actor: me,
    });

    const [count] = await db.query(sql`SELECT COUNT(*) as c FROM follows WHERE following = ${target} COLLATE NOCASE`);
    res.json({ following: true, followers: Number(count.c) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/users/:username/follow", async (req, res) => {
  try {
    const me = currentUser(req);
    const target = req.params.username;
    if (!me) return res.status(401).json({ error: "Não autorizado" });
    await db.query(sql`DELETE FROM follows WHERE follower = ${me} COLLATE NOCASE AND following = ${target} COLLATE NOCASE`);
    const [count] = await db.query(sql`SELECT COUNT(*) as c FROM follows WHERE following = ${target} COLLATE NOCASE`);
    res.json({ following: false, followers: Number(count.c) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESENHAS (nota + comentário público) ─────────────────────────────────────

app.get("/books/:id/reviews", async (req, res) => {
  try {
    res.json(await loadReviews({ bookId: req.params.id, me: currentUser(req) }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Cria ou atualiza a resenha do usuário logado (uma por livro). */
app.post("/books/:id/reviews", async (req, res) => {
  try {
    const me = currentUser(req) || req.body.username;
    const { rating, comment, hasSpoiler } = req.body;
    if (!me) return res.status(401).json({ error: "Entre na sua conta para avaliar." });
    if (rating == null) return res.status(400).json({ error: "Escolha uma nota de 1 a 5." });

    const text = (comment || "").trim();
    const now = Date.now();
    const bookId = req.params.id;

    const [existing] = await db.query(sql`SELECT id FROM book_reviews WHERE book_id = ${bookId} AND username = ${me} COLLATE NOCASE`);
    if (existing) {
      await db.query(sql`
        UPDATE book_reviews SET rating = ${Number(rating)}, comment = ${text}, has_spoiler = ${hasSpoiler ? 1 : 0}, updated_at = ${now}
        WHERE id = ${existing.id}
      `);
    } else {
      await db.query(sql`
        INSERT INTO book_reviews (book_id, username, rating, comment, has_spoiler, created_at, updated_at)
        VALUES (${bookId}, ${me}, ${Number(rating)}, ${text}, ${hasSpoiler ? 1 : 0}, ${now}, ${now})
      `);
    }

    const stats = await refreshBookRating(bookId);
    const reviews = await loadReviews({ bookId, me });
    res.status(201).json({ ...stats, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/reviews/:reviewId", async (req, res) => {
  try {
    const me = currentUser(req);
    const id = Number(req.params.reviewId);
    const [review] = await db.query(sql`SELECT * FROM book_reviews WHERE id = ${id}`);
    if (!review) return res.status(404).json({ error: "Resenha não encontrada" });

    const admin = await isAdmin(me);
    if (!admin && String(review.username).toLowerCase() !== String(me || "").toLowerCase()) {
      return res.status(403).json({ error: "Você só pode apagar a sua própria resenha." });
    }

    await db.query(sql`DELETE FROM review_likes WHERE review_id = ${id}`);
    await db.query(sql`DELETE FROM review_comments WHERE review_id = ${id}`);
    await db.query(sql`DELETE FROM book_reviews WHERE id = ${id}`);
    const stats = await refreshBookRating(review.book_id);
    res.json({ ok: true, ...stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/reviews/:reviewId/like", async (req, res) => {
  try {
    const me = currentUser(req);
    const id = Number(req.params.reviewId);
    if (!me) return res.status(401).json({ error: "Entre na sua conta para curtir." });
    const [liked] = await db.query(sql`SELECT 1 FROM review_likes WHERE review_id = ${id} AND username = ${me} COLLATE NOCASE`);
    if (liked) {
      await db.query(sql`DELETE FROM review_likes WHERE review_id = ${id} AND username = ${me} COLLATE NOCASE`);
    } else {
      await db.query(sql`INSERT OR IGNORE INTO review_likes (review_id, username, created_at) VALUES (${id}, ${me}, ${Date.now()})`);
    }
    const [count] = await db.query(sql`SELECT COUNT(*) as c FROM review_likes WHERE review_id = ${id}`);

    if (!liked) {
      const [review] = await db.query(sql`SELECT username, book_id FROM book_reviews WHERE id = ${id}`);
      if (review) {
        const [b] = await db.query(sql`SELECT title FROM books WHERE id = ${review.book_id}`);
        await notify(review.username, {
          type: "curtida",
          title: `${me} curtiu sua avaliação`,
          body: b ? b.title : "",
          link: `/book/${review.book_id}#avaliar`,
          actor: me,
        });
      }
    }

    res.json({ likes: Number(count.c), likedByMe: !liked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/reviews/:reviewId/comments", async (req, res) => {
  try {
    const me = currentUser(req);
    const id = Number(req.params.reviewId);
    const content = (req.body.content || "").trim();
    if (!me) return res.status(401).json({ error: "Entre na sua conta para responder." });
    if (!content) return res.status(400).json({ error: "Escreva alguma coisa 🙂" });

    const [review] = await db.query(sql`SELECT id FROM book_reviews WHERE id = ${id}`);
    if (!review) return res.status(404).json({ error: "Resenha não encontrada" });

    await db.query(sql`INSERT INTO review_comments (review_id, username, content, created_at) VALUES (${id}, ${me}, ${content}, ${Date.now()})`);

    const [owner] = await db.query(sql`SELECT username, book_id FROM book_reviews WHERE id = ${id}`);
    if (owner) {
      await notify(owner.username, {
        type: "resposta",
        title: `${me} respondeu sua avaliação`,
        body: content.slice(0, 120),
        link: `/book/${owner.book_id}#avaliar`,
        actor: me,
      });
    }

    const rows = await db.query(sql`SELECT * FROM review_comments WHERE review_id = ${id} ORDER BY created_at ASC`);
    const [user] = await db.query(sql`SELECT avatar FROM users WHERE username = ${me} COLLATE NOCASE`);
    res.status(201).json(rows.map((c) => ({
      id: Number(c.id),
      reviewId: id,
      username: c.username,
      avatar: String(c.username).toLowerCase() === me.toLowerCase() && user ? user.avatar : null,
      content: c.content,
      createdAt: Number(c.created_at),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/reviews/:reviewId/comments/:commentId", async (req, res) => {
  try {
    const me = currentUser(req);
    const commentId = Number(req.params.commentId);
    const [comment] = await db.query(sql`SELECT * FROM review_comments WHERE id = ${commentId}`);
    if (!comment) return res.status(404).json({ error: "Comentário não encontrado" });
    const admin = await isAdmin(me);
    if (!admin && String(comment.username).toLowerCase() !== String(me || "").toLowerCase()) {
      return res.status(403).json({ error: "Você só pode apagar o seu comentário." });
    }
    await db.query(sql`DELETE FROM review_comments WHERE id = ${commentId}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BANNERS (Admin) ──────────────────────────────────────────────────────────

function rowToBanner(r) {
  return {
    id: Number(r.id),
    title: r.title || "",
    subtitle: r.subtitle || "",
    imageUrl: r.image_url || null,
    linkUrl: r.link_url || null,
    bookId: r.book_id || null,
    sortOrder: Number(r.sort_order) || 0,
    isActive: !!Number(r.is_active),
    sponsor: r.sponsor || "",
    startsAt: Number(r.starts_at) || 0,
    endsAt: Number(r.ends_at) || 0,
    createdAt: Number(r.created_at),
  };
}

/**
 * Um banner está no ar se está ativo e dentro do período contratado.
 *
 * Datas em 0 valem como "sem limite": banner da própria casa não tem contrato,
 * e o Admin não deveria ser obrigado a inventar uma data para publicar um
 * aviso interno.
 */
function bannerNoAr(r, agora = Date.now()) {
  if (!Number(r.is_active)) return false;
  const inicio = Number(r.starts_at) || 0;
  const fim = Number(r.ends_at) || 0;
  if (inicio && agora < inicio) return false;
  if (fim && agora > fim) return false;
  return true;
}

/** Datas vêm do formulário como texto (yyyy-mm-dd) ou vazias. */
function paraInstante(valor, atual = 0) {
  if (valor === undefined) return atual;
  if (valor === "" || valor === null) return 0;
  const t = new Date(valor).getTime();
  return Number.isFinite(t) ? t : atual;
}

app.get("/banners", async (req, res) => {
  try {
    const all = req.query.all === "true" && (await isAdmin(currentUser(req)));
    const rows = await db.query(sql`SELECT * FROM banners ORDER BY sort_order ASC, id DESC`);
    const visiveis = all ? rows : rows.filter((r) => bannerNoAr(r));
    res.json(visiveis.map(rowToBanner));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/banners", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, linkUrl, bookId, sortOrder, sponsor, startsAt, endsAt } = req.body;
    let imageUrl = req.body.imageUrl || null;
    if (req.file) {
      imageUrl = await uploadFileToCloud(req.file.buffer, `banners/banner-${Date.now()}.jpg`, req.file.mimetype);
    }
    if (!imageUrl && !title) return res.status(400).json({ error: "Envie uma imagem ou escreva um título." });

    const now = Date.now();
    await db.query(sql`
      INSERT INTO banners (title, subtitle, image_url, link_url, book_id, sort_order, is_active,
                           sponsor, starts_at, ends_at, created_at, updated_at)
      VALUES (${title || ""}, ${subtitle || ""}, ${imageUrl}, ${linkUrl || null}, ${bookId || null},
              ${Number(sortOrder) || 0}, 1, ${sponsor || ""}, ${paraInstante(startsAt)}, ${paraInstante(endsAt)},
              ${now}, ${now})
    `);
    const [row] = await db.query(sql`SELECT * FROM banners ORDER BY id DESC LIMIT 1`);
    res.status(201).json(rowToBanner(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/banners/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.query(sql`SELECT * FROM banners WHERE id = ${id}`);
    if (!existing) return res.status(404).json({ error: "Banner não encontrado" });

    let imageUrl = req.body.imageUrl !== undefined ? req.body.imageUrl : existing.image_url;
    if (req.file) {
      imageUrl = await uploadFileToCloud(req.file.buffer, `banners/banner-${id}-${Date.now()}.jpg`, req.file.mimetype);
    }
    const { title, subtitle, linkUrl, bookId, sortOrder, isActive, sponsor, startsAt, endsAt } = req.body;

    await db.query(sql`
      UPDATE banners SET
        title = ${title ?? existing.title},
        subtitle = ${subtitle ?? existing.subtitle},
        image_url = ${imageUrl},
        link_url = ${linkUrl ?? existing.link_url},
        book_id = ${bookId ?? existing.book_id},
        sort_order = ${sortOrder != null ? Number(sortOrder) : existing.sort_order},
        is_active = ${isActive != null ? (isActive === "false" || isActive === false ? 0 : 1) : existing.is_active},
        sponsor = ${sponsor ?? existing.sponsor ?? ""},
        starts_at = ${paraInstante(startsAt, Number(existing.starts_at) || 0)},
        ends_at = ${paraInstante(endsAt, Number(existing.ends_at) || 0)},
        updated_at = ${Date.now()}
      WHERE id = ${id}
    `);
    const [row] = await db.query(sql`SELECT * FROM banners WHERE id = ${id}`);
    res.json(rowToBanner(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Registra que um banner foi visto ou clicado.
 *
 * Responde 202 sem esperar a escrita: é telemetria, não pode segurar a
 * navegação de quem clicou nem quebrar a home se o banco engasgar.
 */
app.post("/banners/:id/event", async (req, res) => {
  res.status(202).json({ ok: true });
  try {
    const id = Number(req.params.id);
    const tipo = req.body?.type === "click" ? "click" : "view";
    if (!Number.isFinite(id)) return;
    await db.query(sql`
      INSERT INTO banner_events (banner_id, type, username, created_at)
      VALUES (${id}, ${tipo}, ${currentUser(req) || ""}, ${Date.now()})
    `);
  } catch (err) {
    console.error("[banner-event]", err.message);
  }
});

/**
 * Relatório de um banner: total de exibições, cliques, taxa de clique e a
 * série por dia. É o documento que o patrocinador recebe no fim do mês.
 */
app.get("/banners/:id/report", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [banner] = await db.query(sql`SELECT * FROM banners WHERE id = ${id}`);
    if (!banner) return res.status(404).json({ error: "Banner não encontrado" });

    // Sem período contratado, o relatório cobre os últimos 30 dias.
    const inicio = Number(banner.starts_at) || Date.now() - 30 * 24 * 3600 * 1000;
    const fim = Number(banner.ends_at) || Date.now();

    const rows = await db.query(sql`
      SELECT type, created_at FROM banner_events
      WHERE banner_id = ${id} AND created_at >= ${inicio} AND created_at <= ${fim}
    `);

    let views = 0;
    let clicks = 0;
    const porDia = new Map();
    for (const r of rows) {
      const dia = new Date(Number(r.created_at)).toISOString().slice(0, 10);
      const atual = porDia.get(dia) || { day: dia, views: 0, clicks: 0 };
      if (r.type === "click") { clicks++; atual.clicks++; } else { views++; atual.views++; }
      porDia.set(dia, atual);
    }

    res.json({
      banner: rowToBanner(banner),
      from: inicio,
      to: fim,
      views,
      clicks,
      ctr: views > 0 ? Number(((clicks / views) * 100).toFixed(2)) : 0,
      daily: [...porDia.values()].sort((a, b) => a.day.localeCompare(b.day)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/banners/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.query(sql`DELETE FROM banner_events WHERE banner_id = ${id}`);
    await db.query(sql`DELETE FROM banners WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POSTAGENS DA HOME (Admin) ────────────────────────────────────────────────

async function decoratePosts(rows, me) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id)).join(",");
  const [likeRows, myLikes, users] = await Promise.all([
    db.query({ text: `SELECT post_id, COUNT(*) as c FROM post_likes WHERE post_id IN (${ids}) GROUP BY post_id`, values: [] }),
    me ? db.query({ text: `SELECT post_id FROM post_likes WHERE post_id IN (${ids}) AND username = ? COLLATE NOCASE`, values: [me] }) : Promise.resolve([]),
    db.query(sql`SELECT username, avatar FROM users`),
  ]);
  const likes = new Map(likeRows.map((r) => [Number(r.post_id), Number(r.c)]));
  const liked = new Set(myLikes.map((r) => Number(r.post_id)));
  const avatars = new Map(users.map((u) => [String(u.username).toLowerCase(), u.avatar]));

  return rows.map((r) => ({
    id: Number(r.id),
    author: r.author,
    avatar: avatars.get(String(r.author).toLowerCase()) || "🐶",
    title: r.title || "",
    content: r.content || "",
    imageUrl: r.image_url || null,
    bookId: r.book_id || null,
    seriesId: r.series_id || null,
    isPinned: !!Number(r.is_pinned),
    isActive: !!Number(r.is_active),
    createdAt: Number(r.created_at),
    likes: likes.get(Number(r.id)) || 0,
    likedByMe: liked.has(Number(r.id)),
  }));
}

app.get("/posts", async (req, res) => {
  try {
    const me = currentUser(req);
    const all = req.query.all === "true" && (await isAdmin(me));
    const rows = all
      ? await db.query(sql`SELECT * FROM home_posts ORDER BY is_pinned DESC, created_at DESC`)
      : await db.query(sql`SELECT * FROM home_posts WHERE is_active = 1 ORDER BY is_pinned DESC, created_at DESC LIMIT 30`);
    res.json(await decoratePosts(rows, me));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, content, bookId, isPinned, seriesId } = req.body;
    if (seriesId && !(await db.query(sql`SELECT id FROM book_series WHERE id=${seriesId}`)).length) return res.status(400).json({error:"Saga não encontrada."});
    let imageUrl = req.body.imageUrl || null;
    if (req.file) {
      imageUrl = await uploadFileToCloud(req.file.buffer, `posts/post-${Date.now()}.jpg`, req.file.mimetype);
    }
    if (!title && !content && !imageUrl) return res.status(400).json({ error: "A postagem está vazia." });

    const now = Date.now();
    await db.query(sql`
      INSERT INTO home_posts (author, title, content, image_url, book_id, series_id, is_pinned, is_active, created_at, updated_at)
      VALUES (${req.adminUser}, ${title || ""}, ${content || ""}, ${imageUrl}, ${seriesId ? null : bookId || null}, ${seriesId || null}, ${isPinned === "true" || isPinned === true ? 1 : 0}, 1, ${now}, ${now})
    `);
    const rows = await db.query(sql`SELECT * FROM home_posts ORDER BY id DESC LIMIT 1`);
    const [post] = await decoratePosts(rows, req.adminUser);

    await notifyEveryone({
      type: "mural",
      title: title ? `Novo no mural: ${title}` : "Nova publicação no mural",
      body: String(content || "").slice(0, 120),
      link: "/",
      actor: req.adminUser,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/posts/:id", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.query(sql`SELECT * FROM home_posts WHERE id = ${id}`);
    if (!existing) return res.status(404).json({ error: "Postagem não encontrada" });

    let imageUrl = req.body.imageUrl !== undefined ? req.body.imageUrl : existing.image_url;
    if (req.file) {
      imageUrl = await uploadFileToCloud(req.file.buffer, `posts/post-${id}-${Date.now()}.jpg`, req.file.mimetype);
    }
    const { title, content, bookId, isPinned, isActive, seriesId } = req.body;
    if (seriesId && !(await db.query(sql`SELECT id FROM book_series WHERE id=${seriesId}`)).length) return res.status(400).json({error:"Saga não encontrada."});
    const truthy = (v, fallback) => (v == null ? fallback : v === "true" || v === true ? 1 : 0);

    await db.query(sql`
      UPDATE home_posts SET
        title = ${title ?? existing.title},
        content = ${content ?? existing.content},
        image_url = ${imageUrl},
        book_id = ${seriesId ? null : bookId ?? existing.book_id},
        series_id = ${seriesId === undefined ? existing.series_id : seriesId || null},
        is_pinned = ${truthy(isPinned, existing.is_pinned)},
        is_active = ${truthy(isActive, existing.is_active)},
        updated_at = ${Date.now()}
      WHERE id = ${id}
    `);
    const rows = await db.query(sql`SELECT * FROM home_posts WHERE id = ${id}`);
    const [post] = await decoratePosts(rows, req.adminUser);
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/posts/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.query(sql`DELETE FROM post_likes WHERE post_id = ${id}`);
    await db.query(sql`DELETE FROM home_posts WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/posts/:id/like", async (req, res) => {
  try {
    const me = currentUser(req);
    const id = Number(req.params.id);
    if (!me) return res.status(401).json({ error: "Entre na sua conta para curtir." });
    const [liked] = await db.query(sql`SELECT 1 FROM post_likes WHERE post_id = ${id} AND username = ${me} COLLATE NOCASE`);
    if (liked) {
      await db.query(sql`DELETE FROM post_likes WHERE post_id = ${id} AND username = ${me} COLLATE NOCASE`);
    } else {
      await db.query(sql`INSERT OR IGNORE INTO post_likes (post_id, username, created_at) VALUES (${id}, ${me}, ${Date.now()})`);
    }
    const [count] = await db.query(sql`SELECT COUNT(*) as c FROM post_likes WHERE post_id = ${id}`);
    res.json({ likes: Number(count.c), likedByMe: !liked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HOME AGREGADA ────────────────────────────────────────────────────────────
// Uma única chamada monta a home inteira: antes eram 4+ requisições em paralelo
// e mais uma rodada de N+1 no /books.
app.get("/home", async (req, res) => {
  try {
    const me = currentUser(req);
    const [bookRows, stats, bannerRows, postRows, statusRow, myProgress, savedRows, openRows] = await Promise.all([
      db.query(sql`SELECT * FROM books ORDER BY added_at DESC`),
      loadBookStats(),
      db.query(sql`SELECT * FROM banners ORDER BY sort_order ASC, id DESC`),
      db.query(sql`SELECT * FROM home_posts WHERE is_active = 1 ORDER BY is_pinned DESC, created_at DESC LIMIT 10`),
      db.query(sql`SELECT * FROM global_status WHERE id = 1`),
      me ? db.query(sql`SELECT * FROM reading_progress WHERE username = ${me} COLLATE NOCASE`) : Promise.resolve([]),
      me ? db.query(sql`SELECT book_id FROM saved_books WHERE username = ${me} COLLATE NOCASE ORDER BY saved_at DESC`) : Promise.resolve([]),
      db.query(sql`SELECT book_id, SUM(opens) as opens FROM book_opens GROUP BY book_id`),
    ]);

    const opens = new Map(openRows.map((r) => [r.book_id, Number(r.opens)]));
    const books = bookRows.map((r) => {
      const book = decorateBook(rowToBook(r), stats);
      book.opens = opens.get(book.id) || 0;
      book.popularity += book.opens;
      return book;
    });

    const mostRead = [...books]
      .filter((b) => b.popularity > 0)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 12);

    const topRated = [...books]
      .filter((b) => b.reviewCount > 0)
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, 12);

    const recent = books.slice(0, 12);

    const progress = myProgress.map((r) => ({
      bookId: r.book_id,
      currentPage: Number(r.current_page),
      totalPages: Number(r.total_pages),
      progress: Number(r.progress),
      status: r.status,
      startedAt: Number(r.started_at),
      lastReadAt: Number(r.last_read_at),
    }));

    const recentReviews = await loadReviews({ limit: 8, me });

    res.json({
      books,
      mostRead,
      topRated,
      recent,
      banners: bannerRows.filter((r) => bannerNoAr(r)).map(rowToBanner),
      posts: await decoratePosts(postRows, me),
      status: statusRow[0] || null,
      progress,
      savedIds: savedRows.map((r) => r.book_id),
      recentReviews,
      isAdmin: await isAdmin(me),
    });
  } catch (err) {
    console.error("[Home]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── FEED SOCIAL ──────────────────────────────────────────────────────────────
// Atividade da rede: resenhas recentes + livros concluídos + livros novos.
app.get("/feed", async (req, res) => {
  try {
    const me = currentUser(req);
    const scope = req.query.scope === "following" ? "following" : "all";

    let allowed = null;
    if (scope === "following" && me) {
      const rows = await db.query(sql`SELECT following FROM follows WHERE follower = ${me} COLLATE NOCASE`);
      allowed = new Set(rows.map((r) => String(r.following).toLowerCase()));
      allowed.add(me.toLowerCase());
    }

    const [reviews, finished, reading, newBooks, users, bookRows] = await Promise.all([
      loadReviews({ limit: 40, me }),
      db.query(sql`
        SELECT username, book_id, last_read_at FROM reading_progress
        WHERE status = 'finalizado' ORDER BY last_read_at DESC LIMIT 40
      `),
      // Quem está lendo agora — alimenta o trilho "Atividade recente".
      db.query(sql`
        SELECT username, book_id, progress, last_read_at FROM reading_progress
        WHERE status = 'lendo' ORDER BY last_read_at DESC LIMIT 30
      `),
      db.query(sql`SELECT id, title, author, cover_image_path, cover_color, added_at FROM books ORDER BY added_at DESC LIMIT 10`),
      db.query(sql`SELECT username, avatar FROM users`),
      db.query(sql`SELECT id, title, author, cover_image_path, cover_color FROM books`),
    ]);

    const avatars = new Map(users.map((u) => [String(u.username).toLowerCase(), u.avatar]));
    const bookMap = new Map(bookRows.map((b) => [b.id, {
      id: b.id, title: b.title, author: b.author, coverImagePath: b.cover_image_path, coverColor: b.cover_color,
    }]));

    const items = [];

    for (const r of reviews) {
      if (allowed && !allowed.has(String(r.username).toLowerCase())) continue;
      items.push({ type: "review", id: `review-${r.id}`, createdAt: r.createdAt, username: r.username, avatar: r.avatar, review: r, book: r.book });
    }

    for (const f of finished) {
      if (allowed && !allowed.has(String(f.username).toLowerCase())) continue;
      const book = bookMap.get(f.book_id);
      if (!book) continue;
      items.push({
        type: "finished",
        id: `finished-${f.username}-${f.book_id}`,
        createdAt: Number(f.last_read_at),
        username: f.username,
        avatar: avatars.get(String(f.username).toLowerCase()) || "🐼",
        book,
      });
    }

    for (const r of reading) {
      if (allowed && !allowed.has(String(r.username).toLowerCase())) continue;
      const book = bookMap.get(r.book_id);
      if (!book) continue;
      items.push({
        type: "reading",
        id: `reading-${r.username}-${r.book_id}`,
        createdAt: Number(r.last_read_at),
        username: r.username,
        avatar: avatars.get(String(r.username).toLowerCase()) || "🐼",
        progress: Math.round(Number(r.progress) || 0),
        book,
      });
    }

    if (scope === "all") {
      for (const b of newBooks) {
        items.push({
          type: "new-book",
          id: `book-${b.id}`,
          createdAt: Number(b.added_at),
          book: { id: b.id, title: b.title, author: b.author, coverImagePath: b.cover_image_path, coverColor: b.cover_color },
        });
      }
    }

    items.sort((a, b) => b.createdAt - a.createdAt);
    res.json(items.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHAT ─────────────────────────────────────────────────────────────────────

app.get("/chat", async (req, res) => {
  try {
    const me = currentUser(req);
    if (!me) return res.status(401).json({ error: "Entre para ver suas conversas." });
    const [messages, users] = await Promise.all([
      db.query(sql`SELECT sender, receiver, content, created_at, is_read FROM chat_messages WHERE sender=${me} COLLATE NOCASE OR receiver=${me} COLLATE NOCASE ORDER BY created_at DESC`),
      db.query(sql`SELECT username, display_name, handle, avatar FROM users`),
    ]);
    res.json(summarizeConversations(me, messages, users));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/chat/:otherUser", async (req, res) => {
  try {
    const me = currentUser(req);
    const other = req.params.otherUser;
    const messages = await db.query(sql`SELECT * FROM chat_messages WHERE (sender = ${me} COLLATE NOCASE AND receiver = ${other} COLLATE NOCASE) OR (sender = ${other} COLLATE NOCASE AND receiver = ${me} COLLATE NOCASE) ORDER BY created_at ASC`);
    await db.query(sql`UPDATE chat_messages SET is_read = 1 WHERE receiver = ${me} COLLATE NOCASE AND sender = ${other} COLLATE NOCASE AND is_read = 0`);
    const [nick] = await db.query(sql`SELECT nickname FROM nicknames WHERE from_user = ${me} COLLATE NOCASE AND to_user = ${other} COLLATE NOCASE`);
    res.json({ messages, nickname: nick ? nick.nickname : null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/chat/:otherUser", async (req, res) => {
  try {
    const me = currentUser(req);
    const other = req.params.otherUser;
    const { content, sharedBookId } = req.body;

    await db.query(sql`INSERT INTO chat_messages (sender, receiver, content, shared_book_id, created_at) VALUES (${me}, ${other}, ${content}, ${sharedBookId || null}, ${Date.now()})`);

    if (sharedBookId) {
      await db.query(sql`INSERT INTO book_recommendations (sender, receiver, book_id) VALUES (${me}, ${other}, ${sharedBookId})`);
    }

    await notify(other, {
      type: "mensagem",
      title: `${me} te mandou uma mensagem`,
      body: String(content || "").slice(0, 120),
      link: `/chat/${encodeURIComponent(me)}`,
      actor: me,
    });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/chat/nickname/:otherUser", async (req, res) => {
  try {
    const me = currentUser(req);
    const other = req.params.otherUser;
    const { nickname } = req.body;

    const [existing] = await db.query(sql`SELECT 1 FROM nicknames WHERE from_user = ${me} COLLATE NOCASE AND to_user = ${other} COLLATE NOCASE`);
    if (existing) {
      await db.query(sql`UPDATE nicknames SET nickname = ${nickname} WHERE from_user = ${me} COLLATE NOCASE AND to_user = ${other} COLLATE NOCASE`);
    } else {
      await db.query(sql`INSERT INTO nicknames (from_user, to_user, nickname) VALUES (${me}, ${other}, ${nickname})`);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── STATUS GLOBAL ────────────────────────────────────────────────────────────

app.get("/status", async (_req, res) => {
  try {
    const [status] = await db.query(sql`SELECT * FROM global_status WHERE id = 1`);
    res.json(status || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/status", async (req, res) => {
  try {
    const username = currentUser(req);
    const { content, emote } = req.body;
    if (!username) return res.status(401).json({ error: "Não autorizado" });

    await db.query(sql`INSERT OR REPLACE INTO global_status (id, username, content, emote, updated_at) VALUES (1, ${username}, ${content}, ${emote}, ${Date.now()})`);
    const [newStatus] = await db.query(sql`SELECT * FROM global_status WHERE id = 1`);
    res.json(newStatus);
  } catch (err) {
    console.error("[Status Error]:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/notifications", async (req, res) => {
  try {
    const me = currentUser(req);
    if (!me) return res.json({ unreadCount: 0, details: {}, items: [] });

    // `details` continua alimentando o badge por conversa na tela Social.
    const senders = await db.query(sql`SELECT sender, COUNT(*) as c FROM chat_messages WHERE receiver = ${me} COLLATE NOCASE AND is_read = 0 GROUP BY sender`);
    const details = {};
    for (const row of senders) {
      if (row.sender) details[String(row.sender).toLowerCase()] = Number(row.c);
    }

    const rows = await db.query(sql`
      SELECT * FROM notifications WHERE username = ${me} COLLATE NOCASE
      ORDER BY created_at DESC LIMIT 40
    `);
    const [unread] = await db.query(sql`
      SELECT COUNT(*) as c FROM notifications WHERE username = ${me} COLLATE NOCASE AND is_read = 0
    `);

    const users = await db.query(sql`SELECT username, avatar FROM users`);
    const avatars = new Map(users.map((u) => [String(u.username).toLowerCase(), u.avatar]));

    res.json({
      unreadCount: Number(unread.c) || 0,
      details,
      items: rows.map((r) => ({
        id: Number(r.id),
        type: r.type,
        title: r.title,
        body: r.body || "",
        link: r.link || "/",
        actor: r.actor || "",
        avatar: avatars.get(String(r.actor).toLowerCase()) || null,
        isRead: !!Number(r.is_read),
        createdAt: Number(r.created_at),
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** Marca avisos como lidos — todos, ou apenas os ids informados. */
app.post("/notifications/read", async (req, res) => {
  try {
    const me = currentUser(req);
    if (!me) return res.status(401).json({ error: "Nao autorizado" });

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : null;
    if (ids && ids.length > 0) {
      await db.query({
        text: `UPDATE notifications SET is_read = 1 WHERE username = ? COLLATE NOCASE AND id IN (${ids.join(",")})`,
        values: [me],
      });
    } else {
      await db.query(sql`UPDATE notifications SET is_read = 1 WHERE username = ${me} COLLATE NOCASE`);
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PROGRESS ─────────────────────────────────────────────────────────────────

app.get("/progress", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    const rows = await db.query(sql`SELECT * FROM reading_progress WHERE username = ${username} COLLATE NOCASE`);
    res.json(rows.map((r) => ({
      bookId: r.book_id, currentPage: Number(r.current_page), totalPages: Number(r.total_pages),
      progress: Number(r.progress), status: r.status, startedAt: Number(r.started_at), lastReadAt: Number(r.last_read_at),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/progress/:bookId", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    const [row] = await db.query(sql`SELECT * FROM reading_progress WHERE book_id = ${req.params.bookId} AND username = ${username} COLLATE NOCASE`);
    if (!row) return res.status(404).json({ error: "Sem progresso" });
    res.json({ bookId: row.book_id, currentPage: Number(row.current_page), totalPages: Number(row.total_pages), progress: Number(row.progress), status: row.status, startedAt: Number(row.started_at), lastReadAt: Number(row.last_read_at) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/progress/:bookId", async (req, res) => {
  try {
    const { bookId } = req.params;
    const { currentPage, totalPages, progress, status } = req.body;
    const username = currentUser(req) || "Caio";
    const [existing] = await db.query(sql`SELECT 1 FROM reading_progress WHERE book_id = ${bookId} AND username = ${username} COLLATE NOCASE`);
    if (existing) {
      await db.query(sql`UPDATE reading_progress SET current_page=${currentPage},total_pages=${totalPages},progress=${progress},status=${status},last_read_at=${Date.now()} WHERE book_id=${bookId} AND username=${username} COLLATE NOCASE`);
    } else {
      const t = Date.now();
      await db.query(sql`INSERT INTO reading_progress (username,book_id,current_page,total_pages,progress,status,started_at,last_read_at) VALUES (${username},${bookId},${currentPage},${totalPages},${progress},${status},${t},${t})`);
    }

    if (status === 'finalizado') {
      const pendingRecs = await db.query(sql`SELECT sender FROM book_recommendations WHERE receiver = ${username} COLLATE NOCASE AND book_id = ${bookId} AND completed = 0`);
      for (const rec of pendingRecs) {
        await db.query(sql`UPDATE users SET pandinhas = pandinhas + 1 WHERE username IN (${username}, ${rec.sender}) COLLATE NOCASE`);
      }
      if (pendingRecs.length > 0) {
        await db.query(sql`UPDATE book_recommendations SET completed = 1 WHERE receiver = ${username} COLLATE NOCASE AND book_id = ${bookId}`);
      }
    }

    const [updated] = await db.query(sql`SELECT * FROM reading_progress WHERE book_id = ${bookId} AND username = ${username} COLLATE NOCASE`);
    res.json({ bookId: updated.book_id, currentPage: Number(updated.current_page), totalPages: Number(updated.total_pages), progress: Number(updated.progress), status: updated.status, startedAt: Number(updated.started_at), lastReadAt: Number(updated.last_read_at) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NOTES (diário pessoal) ───────────────────────────────────────────────────

app.get("/notes", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    const rows = await db.query(sql`SELECT * FROM notes WHERE username = ${username} COLLATE NOCASE ORDER BY created_at DESC`);
    res.json(rows.map((r) => ({ id: r.id, bookId: r.book_id, date: r.date_label, feedback: r.feedback, rating: Number(r.rating), createdAt: Number(r.created_at) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/notes/book/:bookId", async (req, res) => {
  try {
    const rows = await db.query(sql`SELECT * FROM notes WHERE book_id = ${req.params.bookId} ORDER BY created_at DESC`);
    res.json(rows.map((r) => ({ id: r.id, bookId: r.book_id, username: r.username, date: r.date_label, feedback: r.feedback, rating: Number(r.rating), createdAt: Number(r.created_at) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/notes", async (req, res) => {
  try {
    const { bookId, feedback, rating } = req.body;
    const username = currentUser(req) || "Caio";
    if (!bookId || !feedback || rating == null)
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    const now = new Date();
    const dateLabel = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const id = `note-${Date.now()}`;
    await db.query(sql`INSERT INTO notes (id,username,book_id,date_label,feedback,rating,created_at) VALUES (${id},${username},${bookId},${dateLabel},${feedback},${rating},${Date.now()})`);
    res.status(201).json({ id, bookId, date: dateLabel, feedback, rating, createdAt: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/notes/:id", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    await db.query(sql`DELETE FROM notes WHERE id = ${req.params.id} AND username = ${username} COLLATE NOCASE`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SAVED ────────────────────────────────────────────────────────────────────

app.get("/saved", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    const rows = await db.query(sql`SELECT book_id FROM saved_books WHERE username = ${username} COLLATE NOCASE ORDER BY saved_at DESC`);
    res.json(rows.map((r) => r.book_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/saved/:bookId", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    await db.query(sql`INSERT OR IGNORE INTO saved_books (username,book_id,saved_at) VALUES (${username},${req.params.bookId},${Date.now()})`);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/saved/:bookId", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    await db.query(sql`DELETE FROM saved_books WHERE book_id = ${req.params.bookId} AND username = ${username} COLLATE NOCASE`);
    res.json({ saved: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CHAPTERS ─────────────────────────────────────────────────────────────────

app.get("/books/:id/chapters", async (req, res) => {
  try {
    const chapters = await db.query(
      sql`SELECT id, book_id as bookId, start_page as startPage, title, created_at as createdAt
          FROM book_chapters WHERE book_id = ${req.params.id} ORDER BY start_page ASC`
    );
    res.json(chapters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/books/:id/chapters", async (req, res) => {
  try {
    const { startPage, title } = req.body;
    if (startPage == null || !title) return res.status(400).json({ error: "Campos obrigatórios faltando" });
    await db.query(
      sql`INSERT OR REPLACE INTO book_chapters (book_id, start_page, title, created_at)
          VALUES (${req.params.id}, ${Number(startPage)}, ${title}, ${Date.now()})`
    );
    res.status(201).json({ success: true, startPage, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/books/:id/chapters/:startPage", async (req, res) => {
  try {
    await db.query(sql`DELETE FROM book_chapters WHERE book_id = ${req.params.id} AND start_page = ${Number(req.params.startPage)}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STATS ────────────────────────────────────────────────────────────────────

app.get("/stats", async (req, res) => {
  try {
    const username = currentUser(req) || "Caio";
    const [rows] = await db.query(sql`
      SELECT
        SUM(CASE WHEN status='finalizado' THEN 1 ELSE 0 END) as finished,
        SUM(CASE WHEN status='lendo' THEN 1 ELSE 0 END) as reading
      FROM reading_progress WHERE username=${username} COLLATE NOCASE
    `);
    const [notesCount] = await db.query(sql`SELECT COUNT(*) as c FROM notes WHERE username=${username} COLLATE NOCASE`);
    const [reviewCount] = await db.query(sql`SELECT COUNT(*) as c FROM book_reviews WHERE username=${username} COLLATE NOCASE`);
    const [followers] = await db.query(sql`SELECT COUNT(*) as c FROM follows WHERE following=${username} COLLATE NOCASE`);
    const [following] = await db.query(sql`SELECT COUNT(*) as c FROM follows WHERE follower=${username} COLLATE NOCASE`);
    res.json({
      finished: Number(rows?.finished) || 0,
      reading: Number(rows?.reading) || 0,
      notesCount: Number(notesCount.c) || 0,
      reviewCount: Number(reviewCount.c) || 0,
      followers: Number(followers.c) || 0,
      following: Number(following.c) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

/** Upload avulso de imagem (usado pelo painel para banners e posts). */
app.post("/admin/upload", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    const folder = req.body.folder === "banners" ? "banners" : "posts";
    const url = await uploadFileToCloud(req.file.buffer, `${folder}/${folder}-${Date.now()}.jpg`, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Visão geral do painel: números da comunidade. */
app.get("/admin/overview", requireAdmin, async (_req, res) => {
  try {
    const [[books], [users], [reviews], [banners], [posts], [progress]] = await Promise.all([
      db.query(sql`SELECT COUNT(*) as c FROM books`),
      db.query(sql`SELECT COUNT(*) as c FROM users`),
      db.query(sql`SELECT COUNT(*) as c FROM book_reviews`),
      db.query(sql`SELECT COUNT(*) as c FROM banners`),
      db.query(sql`SELECT COUNT(*) as c FROM home_posts`),
      db.query(sql`SELECT COUNT(*) as c FROM reading_progress`),
    ]);
    res.json({
      books: Number(books.c), users: Number(users.c), reviews: Number(reviews.c),
      banners: Number(banners.c), posts: Number(posts.c), readingSessions: Number(progress.c),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await initDB();
  await appearance.ready();
  await community.ready();
  if (!process.env.VERCEL) {
    const { initWatcher } = require("./watcher");
    initWatcher(db, sql, PORT, uploadFileToCloud);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n🐼 myBooks — Servidor rodando!`);
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/health\n`);
    });
  } else {
    console.log("⚡ Servidor rodando em modo Serverless na Vercel!");
  }
}

const startup = start();
startup.catch((err) => {
  console.error("Erro ao iniciar servidor:", err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

module.exports = app;
