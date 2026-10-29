const crypto = require('crypto');

function parseBookIds(body) {
  const raw = body.bookIds ?? body.bookId ?? [];
  let values = raw;
  if (typeof raw === 'string') {
    try { values = raw.trim().startsWith('[') ? JSON.parse(raw) : [raw]; }
    catch { values = []; }
  }
  return [...new Set((Array.isArray(values) ? values : [values]).map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 100);
}

function buildCatalog(characterRows, linkRows, books, filterBookId = '') {
  const links = new Map();
  for (const row of linkRows) {
    if (!links.has(row.character_id)) links.set(row.character_id, []);
    links.get(row.character_id).push(row.book_id);
  }
  const bookMap = new Map(books.map((book) => [book.id, book]));
  const characters = characterRows.map((row) => {
    const bookIds = links.get(row.id) || [];
    return {
      id: row.id,
      name: row.name,
      bookIds,
      bookId: bookIds[0] || row.book_id || null,
      bookTitle: bookMap.get(bookIds[0] || row.book_id)?.title || null,
      imageUrl: row.image_url,
      createdAt: Number(row.created_at),
    };
  }).filter((character) => !filterBookId || character.bookIds.includes(filterBookId));

  const visibleIds = new Set(characters.map((character) => character.id));
  const groups = new Map();
  for (const character of characters) {
    if (!character.bookIds.length) {
      if (!groups.has('other')) groups.set('other', { id: 'other', seriesId: null, seriesName: 'Outros personagens', books: [], characterIds: [] });
      groups.get('other').characterIds.push(character.id);
      continue;
    }
    const seenGroups = new Set();
    for (const bookId of character.bookIds) {
      const book = bookMap.get(bookId);
      if (!book) continue;
      const key = book.series_id ? `series:${book.series_id}` : `book:${book.id}`;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      if (!groups.has(key)) groups.set(key, {
        id: key,
        seriesId: book.series_id || null,
        seriesName: book.series_name || book.title,
        books: [],
        characterIds: [],
      });
      groups.get(key).characterIds.push(character.id);
    }
  }
  for (const group of groups.values()) {
    group.characterIds = [...new Set(group.characterIds)].filter((id) => visibleIds.has(id));
    if (group.seriesId) {
      group.books = books.filter((book) => book.series_id === group.seriesId);
    } else if (group.id.startsWith('book:')) {
      const book = bookMap.get(group.id.slice(5));
      group.books = book ? [book] : [];
    }
    group.books = group.books
      .sort((a, b) => Number(a.series_order || 0) - Number(b.series_order || 0) || a.title.localeCompare(b.title))
      .map((book) => ({ id: book.id, title: book.title, coverImagePath: book.cover_image_path || null, seriesOrder: book.series_order == null ? null : Number(book.series_order) }));
  }
  return { characters, groups: [...groups.values()] };
}

module.exports = function registerCharacters({ app, db, sql, upload, requireAdmin, uploadFileToCloud }) {
  let readyPromise;
  const ready = () => readyPromise ||= (async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS character_avatars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      book_id TEXT,
      image_url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS character_books (
      character_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(character_id, book_id)
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS idx_characters_book ON character_avatars(book_id, name)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_character_books_book ON character_books(book_id, character_id)');
    await db.query(`INSERT OR IGNORE INTO character_books(character_id, book_id, created_at)
      SELECT id, book_id, created_at FROM character_avatars WHERE book_id IS NOT NULL AND book_id <> ''`);
  })();

  async function validateBooks(bookIds) {
    for (const bookId of bookIds) {
      const [book] = await db.query(sql`SELECT id FROM books WHERE id=${bookId}`);
      if (!book) throw Object.assign(new Error(`Livro não encontrado: ${bookId}`), { status: 400 });
    }
  }

  async function replaceLinks(characterId, bookIds) {
    await db.query(sql`DELETE FROM character_books WHERE character_id=${characterId}`);
    for (const bookId of bookIds) {
      await db.query(sql`INSERT OR IGNORE INTO character_books(character_id,book_id,created_at) VALUES(${characterId},${bookId},${Date.now()})`);
    }
    await db.query(sql`UPDATE character_avatars SET book_id=${bookIds[0] || null} WHERE id=${characterId}`);
  }

  async function catalog(filterBookId = '') {
    const [characters, links, books] = await Promise.all([
      db.query('SELECT * FROM character_avatars ORDER BY name'),
      db.query('SELECT character_id, book_id FROM character_books ORDER BY character_id, book_id'),
      db.query('SELECT id,title,cover_image_path,series_id,series_name,series_order FROM books ORDER BY title'),
    ]);
    return buildCatalog(characters, links, books, filterBookId);
  }

  app.get('/characters', async (req, res) => {
    try {
      await ready();
      res.json(await catalog(String(req.query.bookId || '').trim()));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/characters', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      await ready();
      const name = String(req.body.name || '').trim().slice(0, 60);
      const characterId = String(req.body.characterId || '').trim();
      const bookIds = parseBookIds(req.body);
      await validateBooks(bookIds);
      if (characterId) {
        const [existing] = await db.query(sql`SELECT id FROM character_avatars WHERE id=${characterId}`);
        if (!existing) return res.status(404).json({ error: 'Personagem não encontrado.' });
        await replaceLinks(characterId, bookIds);
        const result = await catalog();
        return res.json(result.characters.find((character) => character.id === characterId));
      }
      if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do personagem.' });
      if (!req.file) return res.status(400).json({ error: 'Escolha uma imagem.' });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'O arquivo precisa ser uma imagem.' });
      const id = crypto.randomUUID();
      const extension = (req.file.mimetype.split('/')[1] || 'webp').replace('jpeg', 'jpg');
      const imageUrl = await uploadFileToCloud(req.file.buffer, `characters/${id}.${extension}`, req.file.mimetype);
      const createdAt = Date.now();
      await db.query(sql`INSERT INTO character_avatars(id,name,book_id,image_url,created_at) VALUES(${id},${name},${bookIds[0] || null},${imageUrl},${createdAt})`);
      for (const bookId of bookIds) await db.query(sql`INSERT OR IGNORE INTO character_books(character_id,book_id,created_at) VALUES(${id},${bookId},${createdAt})`);
      const result = await catalog();
      res.status(201).json(result.characters.find((character) => character.id === id));
    } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  });

  app.put('/characters/:id/books', requireAdmin, async (req, res) => {
    try {
      await ready();
      const bookIds = parseBookIds(req.body);
      await validateBooks(bookIds);
      const [existing] = await db.query(sql`SELECT id FROM character_avatars WHERE id=${req.params.id}`);
      if (!existing) return res.status(404).json({ error: 'Personagem não encontrado.' });
      await replaceLinks(existing.id, bookIds);
      const result = await catalog();
      res.json(result.characters.find((character) => character.id === existing.id));
    } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  });

  app.delete('/characters/:id', requireAdmin, async (req, res) => {
    try {
      await ready();
      await db.query(sql`DELETE FROM character_books WHERE character_id=${req.params.id}`);
      await db.query(sql`DELETE FROM character_avatars WHERE id=${req.params.id}`);
      res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return { ready, buildCatalog };
};

module.exports.parseBookIds = parseBookIds;
module.exports.buildCatalog = buildCatalog;
