require("dotenv").config();
const path = require("path");
const fs = require("fs");

function sql(strings, ...values) {
  return {
    text: strings.reduce((acc, str, idx) => acc + (idx > 0 ? "?" : "") + str, ""),
    values,
    format(options) {
      let text = "";
      let formattedValues = [];

      for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < values.length) {
          const val = values[i];
          if (options && typeof options.formatValue === 'function') {
            const formattedVal = options.formatValue(val);
            text += formattedVal.placeholder;
            formattedValues.push(formattedVal.value);
          } else {
            text += "?";
            formattedValues.push(val);
          }
        }
      }

      return { text, values: formattedValues };
    }
  };
}

let db;

if (process.env.TURSO_DATABASE_URL) {
  console.log("🔌 Conectando ao banco de dados remoto Turso...");
  const { createClient } = require("@libsql/client");
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  db = {
    async query(queryObj) {
      let text, values;
      if (queryObj && typeof queryObj.format === 'function') {
        const formatted = queryObj.format({
          escapeIdentifier: (id) => `"${id}"`,
          formatValue: (val) => ({ placeholder: "?", value: val })
        });
        text = formatted.text;
        values = formatted.values;
      } else if (typeof queryObj === 'string') {
        text = queryObj;
        values = [];
      } else if (queryObj && typeof queryObj.text === 'string') {
        text = queryObj.text;
        values = queryObj.values || [];
      } else {
        throw new Error("Formato de query inválido no wrapper Turso");
      }

      // Ignorar PRAGMA journal_mode no Turso
      if (text.toUpperCase().includes("PRAGMA JOURNAL_MODE")) {
        return [];
      }

      const res = await turso.execute({ sql: text, args: values });
      const columns = res.columns || [];
      return (res.rows || []).map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
  };
} else {
  console.log("🔌 Conectando ao banco de dados SQLite local (via sqlite3)...");
  const sqlite3 = require("sqlite3");

  const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : (process.env.VERCEL ? "/tmp" : path.join(__dirname, "data"));

  const DB_PATH = path.join(DATA_DIR, "bookdahelo.db");

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("⚠️ Não foi possível criar DATA_DIR:", e.message);
    }
  }

  const localDb = new sqlite3.Database(DB_PATH);

  db = {
    query(queryObj) {
      return new Promise((resolve, reject) => {
        let text, values;
        if (queryObj && typeof queryObj.format === 'function') {
          const formatted = queryObj.format();
          text = formatted.text;
          values = formatted.values;
        } else if (queryObj && typeof queryObj.text === 'string') {
          text = queryObj.text;
          values = queryObj.values || [];
        } else if (typeof queryObj === 'string') {
          text = queryObj;
          values = [];
        } else {
          return reject(new Error("Formato de query inválido no wrapper sqlite3"));
        }

        localDb.all(text, values, (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve(rows || []);
        });
      });
    }
  };
}

// Conta administradora do myBooks (controla livros, banners e posts da home).
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "537942";
const ADMIN_AVATAR = "\u{1F436}"; // 🐶

/** Executa uma query ignorando erros esperados (coluna já existe, índice duplicado...). */
async function trySql(query, label) {
  try {
    await db.query(query);
    return true;
  } catch (err) {
    if (label) console.log(`   ↷ ${label}: ${err.message}`);
    return false;
  }
}

/** Adiciona uma coluna se ela ainda não existir na tabela. */
async function ensureColumn(table, column, definition) {
  try {
    const info = await db.query({ text: `PRAGMA table_info(${table})`, values: [] });
    if (info.some((c) => c.name === column)) return false;
  } catch (err) {
    return false;
  }
  return trySql({ text: `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, values: [] }, `ALTER ${table}.${column}`);
}

// ─── Schema ───────────────────────────────────────────────────────────────────

async function initDB() {
  await trySql(sql`PRAGMA foreign_keys = ON`);
  await trySql(sql`PRAGMA journal_mode = DELETE`);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      password TEXT NOT NULL,
      bio TEXT,
      avatar TEXT,
      shelf TEXT,
      pandinhas INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS books (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      author       TEXT NOT NULL DEFAULT '',
      description  TEXT NOT NULL DEFAULT '',
      genre        TEXT NOT NULL DEFAULT 'Outros',
      rating       REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      is_public    INTEGER NOT NULL DEFAULT 1,
      cover_color  TEXT NOT NULL DEFAULT 'lavender-mint',
      added_at     INTEGER NOT NULL,
      pdf_path     TEXT,
      is_user_book INTEGER NOT NULL DEFAULT 0,
      cover_image_path TEXT
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS book_reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id     TEXT NOT NULL,
      username    TEXT NOT NULL COLLATE NOCASE,
      rating      REAL NOT NULL,
      comment     TEXT NOT NULL,
      has_spoiler INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT 0,
      updated_at  INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS book_pages (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id  TEXT NOT NULL,
      page_num INTEGER NOT NULL,
      content  TEXT NOT NULL
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS reading_progress (
      username     TEXT NOT NULL COLLATE NOCASE,
      book_id      TEXT NOT NULL,
      current_page INTEGER NOT NULL DEFAULT 0,
      total_pages  INTEGER NOT NULL DEFAULT 1,
      progress     REAL NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'lendo',
      started_at   INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL,
      PRIMARY KEY (username, book_id)
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      username   TEXT NOT NULL COLLATE NOCASE,
      book_id    TEXT NOT NULL,
      date_label TEXT NOT NULL,
      feedback   TEXT NOT NULL,
      rating     REAL NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS saved_books (
      username TEXT NOT NULL COLLATE NOCASE,
      book_id  TEXT NOT NULL,
      saved_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (username, book_id)
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS nicknames (
      from_user TEXT NOT NULL COLLATE NOCASE,
      to_user   TEXT NOT NULL COLLATE NOCASE,
      nickname  TEXT NOT NULL,
      PRIMARY KEY (from_user, to_user)
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL COLLATE NOCASE,
      receiver TEXT NOT NULL COLLATE NOCASE,
      content TEXT NOT NULL,
      shared_book_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS book_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL COLLATE NOCASE,
      receiver TEXT NOT NULL COLLATE NOCASE,
      book_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS book_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id TEXT NOT NULL,
      start_page INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(book_id, start_page)
    )
  `);

  await db.query(sql`
    CREATE TABLE IF NOT EXISTS global_status (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE,
      content TEXT NOT NULL,
      emote TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // ─── Rede social ────────────────────────────────────────────────────────────

  // Curtidas em resenhas
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS review_likes (
      review_id  INTEGER NOT NULL,
      username   TEXT NOT NULL COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (review_id, username)
    )
  `);

  // Respostas a resenhas (comentários encadeados)
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS review_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id  INTEGER NOT NULL,
      username   TEXT NOT NULL COLLATE NOCASE,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Seguidores
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS follows (
      follower   TEXT NOT NULL COLLATE NOCASE,
      following  TEXT NOT NULL COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (follower, following)
    )
  `);

  // Banners da home (gerenciados pelo Admin)
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS banners (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL DEFAULT '',
      subtitle   TEXT NOT NULL DEFAULT '',
      image_url  TEXT,
      link_url   TEXT,
      book_id    TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Postagens da home (avisos e curadoria do Admin)
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS home_posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author     TEXT NOT NULL COLLATE NOCASE,
      title      TEXT NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '',
      image_url  TEXT,
      book_id    TEXT,
      is_pinned  INTEGER NOT NULL DEFAULT 0,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Curtidas em postagens da home
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id    INTEGER NOT NULL,
      username   TEXT NOT NULL COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (post_id, username)
    )
  `);

  // Caixa de avisos de cada leitor
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL COLLATE NOCASE,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      link       TEXT NOT NULL DEFAULT '/',
      actor      TEXT NOT NULL DEFAULT '',
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  // Aberturas de livro — alimenta o ranking "Mais lidos"
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS book_opens (
      book_id      TEXT NOT NULL,
      username     TEXT NOT NULL COLLATE NOCASE,
      opens        INTEGER NOT NULL DEFAULT 1,
      last_open_at INTEGER NOT NULL,
      PRIMARY KEY (book_id, username)
    )
  `);

  // ─── Migrações de coluna ────────────────────────────────────────────────────
  await ensureColumn("users", "pandinhas", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("users", "created_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("users", "full_name", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "email", "TEXT NOT NULL DEFAULT ''");
  // Como a conta foi criada: "senha", "google" ou "" (contas antigas).
  await ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "display_name", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "handle", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "handle_changed_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("users", "favorite_genres", "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn("users", "instagram_handle", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "tiktok_handle", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("users", "profile_theme_id", "TEXT NOT NULL DEFAULT 'lilac'");
  await ensureColumn("users", "registration_order", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("books", "publisher", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("books", "published_year", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("books", "appearance_json", "TEXT");
  await ensureColumn("books", "series_id", "TEXT");
  await ensureColumn("books", "series_name", "TEXT");
  await ensureColumn("books", "series_order", "REAL");
  await ensureColumn("books", "uploaded_by", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("home_posts", "series_id", "TEXT");
  // Patrocínio: quem pagou pelo espaço e por quanto tempo ele fica no ar.
  // `starts_at`/`ends_at` em 0 significam "sem limite" — é o caso dos banners
  // da própria casa, que não têm contrato.
  await ensureColumn("banners", "sponsor", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn("banners", "starts_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("banners", "ends_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("book_reviews", "has_spoiler", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("book_reviews", "created_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("book_reviews", "updated_at", "INTEGER NOT NULL DEFAULT 0");

  // ─── Resenhas duplicadas (antes de criar o índice único) ────────────────────
  await trySql(sql`
    DELETE FROM book_reviews WHERE id NOT IN (
      SELECT MAX(id) FROM book_reviews GROUP BY book_id, LOWER(username)
    )
  `, "limpeza de resenhas duplicadas");

  // Exibições e cliques de banner.
  //
  // É o que vira o relatório do patrocinador — sem número medido, ninguém
  // renova o contrato. Guardamos evento a evento (e não só um contador) para
  // conseguir mostrar a série por dia e recortar por período contratado.
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS banner_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      banner_id  INTEGER NOT NULL,
      type       TEXT NOT NULL,
      username   TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
      created_at INTEGER NOT NULL
    )
  `);

  // Códigos enviados por e-mail (verificação de cadastro e recuperação de senha).
  // Guardamos hash do código, não o código puro, e uma validade curta.
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS email_codes (
      email      TEXT NOT NULL COLLATE NOCASE,
      code_hash  TEXT NOT NULL,
      purpose    TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  // ─── Índices (performance) ──────────────────────────────────────────────────
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_reviews_book ON book_reviews(book_id)",
    "CREATE INDEX IF NOT EXISTS idx_reviews_user ON book_reviews(username)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique ON book_reviews(book_id, username)",
    "CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments(review_id)",
    "CREATE INDEX IF NOT EXISTS idx_progress_book ON reading_progress(book_id)",
    "CREATE INDEX IF NOT EXISTS idx_progress_user ON reading_progress(username)",
    "CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id)",
    "CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(username)",
    "CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_books(username)",
    "CREATE INDEX IF NOT EXISTS idx_pages_book ON book_pages(book_id, page_num)",
    "CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(receiver, sender, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following)",
    "CREATE INDEX IF NOT EXISTS idx_books_added ON books(added_at)",
    "CREATE INDEX IF NOT EXISTS idx_opens_book ON book_opens(book_id)",
    "CREATE INDEX IF NOT EXISTS idx_banner_events ON banner_events(banner_id, type, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_email_codes ON email_codes(email, purpose)",
    "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle COLLATE NOCASE) WHERE handle <> ''",
    "CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(username, is_read, created_at)",
  ];
  for (const stmt of indexes) {
    await trySql({ text: stmt, values: [] });
  }

  // ─── Usuários padrão ────────────────────────────────────────────────────────
  const now = Date.now();
  await trySql(sql`INSERT OR IGNORE INTO users (username, password, bio, avatar, pandinhas, is_admin, created_at) VALUES ('Caio', '1234', 'Apaixonado por histórias que transformam', '🐼', 0, 0, ${now})`);
  await trySql(sql`INSERT OR IGNORE INTO users (username, password, bio, avatar, pandinhas, is_admin, created_at) VALUES ('Helo', '1234', 'Apaixonada por histórias que transformam', '🎀', 0, 0, ${now})`);

  // Conta administradora — garantida com a senha e o emote corretos a cada boot.
  await trySql(sql`
    INSERT OR IGNORE INTO users (username, password, bio, avatar, pandinhas, is_admin, created_at)
    VALUES (${ADMIN_USERNAME}, ${ADMIN_PASSWORD}, 'Curadoria oficial do myBooks 🐶', ${ADMIN_AVATAR}, 0, 1, ${now})
  `);
  await trySql(sql`
    UPDATE users SET password = ${ADMIN_PASSWORD}, avatar = ${ADMIN_AVATAR}, is_admin = 1
    WHERE username = ${ADMIN_USERNAME} COLLATE NOCASE
  `);

  await trySql(sql`INSERT OR IGNORE INTO global_status (id, username, content, emote, updated_at) VALUES (1, 'Sistema', 'Bem-vindos ao myBooks! ✨', '🐼', ${now})`);

  // ─── Migração: notas do diário viram resenhas públicas ──────────────────────
  // Antes a nota de um livro vinha do diário pessoal (notes). Agora as resenhas
  // públicas moram em book_reviews; importamos a nota mais recente de cada leitor.
  await trySql(sql`
    INSERT OR IGNORE INTO book_reviews (book_id, username, rating, comment, has_spoiler, created_at, updated_at)
    SELECT n.book_id, n.username, n.rating, n.feedback, 0, n.created_at, n.created_at
    FROM notes n
    WHERE n.created_at = (SELECT MAX(n2.created_at) FROM notes n2 WHERE n2.book_id = n.book_id AND n2.username = n.username COLLATE NOCASE)
  `, "importação de notas para resenhas");

  await trySql(sql`UPDATE book_reviews SET created_at = ${now} WHERE created_at IS NULL OR created_at = 0`);
  await trySql(sql`UPDATE book_reviews SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = 0`);
  await trySql(sql`UPDATE users SET created_at = ${now} WHERE created_at IS NULL OR created_at = 0`);
  await trySql(sql`UPDATE users SET display_name = CASE WHEN full_name <> '' THEN full_name ELSE username END WHERE display_name IS NULL OR display_name = ''`);
  await trySql(sql`UPDATE users SET handle = LOWER(username) WHERE handle IS NULL OR handle = ''`);

  // ─── Recalcula médias dos livros a partir das resenhas ──────────────────────
  await trySql(sql`
    UPDATE books SET
      rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM book_reviews WHERE book_id = books.id), 0),
      review_count = COALESCE((SELECT COUNT(*) FROM book_reviews WHERE book_id = books.id), 0)
  `, "recálculo de médias");

  // ─── Limpeza de livros duplicados (mantém o mais antigo) ────────────────────
  await trySql(sql`
    DELETE FROM books
    WHERE id NOT IN (
      SELECT b1.id FROM books b1
      WHERE b1.id = (
        SELECT b2.id FROM books b2
        WHERE LOWER(TRIM(b1.title)) = LOWER(TRIM(b2.title))
          AND LOWER(TRIM(b1.author)) = LOWER(TRIM(b2.author))
        ORDER BY b2.added_at ASC, b2.id ASC
        LIMIT 1
      )
    )
  `, "limpeza de livros duplicados");

  // Progressão usa apenas tabelas aditivas e pode ser inicializada várias vezes.
  const { ensureProgressionSchema } = require("./progression-service");
  await ensureProgressionSchema(db);

  console.log("✅ Banco pronto — schema, índices e conta Admin garantidos");
}

module.exports = { db, sql, initDB, ADMIN_USERNAME };
