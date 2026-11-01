const crypto = require("node:crypto");
const normalizeAuthor = value => String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const authorNames = value => [...new Map(String(value || "").split(";").map(name => name.trim().replace(/\s+/g, " ").slice(0, 200)).filter(Boolean).map(name => [normalizeAuthor(name), name])).values()];
function createAuthorRegistry({ db }) {
  const query = (text, values = []) => db.query({ text, values });
  let initialization;
  async function replaceInternal(bookId, author, owner = "") {
    const names = authorNames(author);
    const ids = [];
    for (const name of names) {
      const normalized = normalizeAuthor(name), id = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
      await query("INSERT OR IGNORE INTO authors (id, name, normalized_name, created_by, created_at) VALUES (?, ?, ?, ?, ?)", [id, name, normalized, owner, Date.now()]);
      ids.push(id);
    }
    if (owner) for (const id of ids) await query("INSERT OR IGNORE INTO author_accounts (author_id, username) VALUES (?, ?)", [id, owner]);
    // Insert first; a failure must not erase the previous valid links.
    for (const id of ids) await query("INSERT OR IGNORE INTO book_authors (book_id, author_id) VALUES (?, ?)", [bookId, id]);
    if (ids.length) await query(`DELETE FROM book_authors WHERE book_id = ? AND author_id NOT IN (${ids.map(() => "?").join(",")})`, [bookId, ...ids]);
    else await query("DELETE FROM book_authors WHERE book_id = ?", [bookId]);
  }
  async function backfill() {
    const missing = await query("SELECT id, author, uploaded_by FROM books WHERE TRIM(COALESCE(author, '')) <> '' AND NOT EXISTS (SELECT 1 FROM book_authors WHERE book_id = books.id)");
    if (!missing.length) return;
    const authors = new Map(), accounts = new Map(), links = [];
    for (const book of missing) for (const name of authorNames(book.author)) {
      const normalized = normalizeAuthor(name), id = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32), owner = book.uploaded_by || "";
      if (!authors.has(id)) authors.set(id, [id, name, normalized, owner, Date.now()]);
      if (owner) accounts.set(`${id}:${owner.toLowerCase()}`, [id, owner]);
      links.push([book.id, id]);
    }
    const insert = async (table, columns, rows) => {
      for (let i = 0; i < rows.length; i += 100) {
        const part = rows.slice(i, i + 100);
        await query(`INSERT OR IGNORE INTO ${table} (${columns}) VALUES ${part.map(row => `(${row.map(() => "?").join(",")})`).join(",")}`, part.flat());
      }
    };
    await insert("authors", "id,name,normalized_name,created_by,created_at", [...authors.values()]);
    await insert("author_accounts", "author_id,username", [...accounts.values()]);
    await insert("book_authors", "book_id,author_id", links);
  }
  async function initialize() {
    await query("CREATE TABLE IF NOT EXISTS authors (id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)");
    await query("CREATE TABLE IF NOT EXISTS book_authors (book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES authors(id), PRIMARY KEY (book_id, author_id))");
    await query("CREATE TABLE IF NOT EXISTS author_accounts (author_id TEXT NOT NULL REFERENCES authors(id), username TEXT NOT NULL COLLATE NOCASE, PRIMARY KEY (author_id, username))");
    await query("CREATE INDEX IF NOT EXISTS book_authors_author_idx ON book_authors(author_id)");
    await backfill();
    await query("INSERT OR IGNORE INTO author_accounts (author_id, username) SELECT ba.author_id, b.uploaded_by FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE TRIM(COALESCE(b.uploaded_by, '')) <> ''");
  }
  function ready() { if (!initialization) initialization = initialize().catch(error => { initialization = undefined; throw error; }); return initialization; }
  async function replace(...args) { await ready(); return replaceInternal(...args); }
  async function list(username, admin = false) {
    await ready(); await backfill();
    const rows = await query(`SELECT a.id, a.name, EXISTS(SELECT 1 FROM author_accounts aa WHERE aa.author_id = a.id AND aa.username = ? COLLATE NOCASE) AS own, b.id AS book_id, b.title, b.author, b.cover_image_path
      FROM authors a LEFT JOIN book_authors ba ON ba.author_id = a.id
      LEFT JOIN books b ON b.id = ba.book_id AND (b.is_public = 1 OR b.uploaded_by = ? COLLATE NOCASE OR ? = 1)
      ORDER BY a.name, b.added_at DESC`, [username, username, admin ? 1 : 0]);
    const authors = new Map();
    for (const row of rows) {
      if (!authors.has(row.id)) authors.set(row.id, { id: row.id, name: row.name, books: [], own: !!Number(row.own) });
      if (row.book_id) authors.get(row.id).books.push({ id: row.book_id, title: row.title, author: row.author, coverImagePath: row.cover_image_path || null });
    }
    return [...authors.values()].filter(author => admin || author.own || author.books.length).map(({ own, ...author }) => ({ ...author, bookCount: author.books.length }));
  }
  return { ready, replace, list };
}
module.exports = { normalizeAuthor, authorNames, createAuthorRegistry };
