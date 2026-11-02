const crypto = require('crypto');

function parseBookIds(body) {
  const raw = body.bookIds ?? body.bookId ?? [];
  let values = raw;
  if (typeof raw === 'string') {
    try { values = raw.trim().startsWith('[') ? JSON.parse(raw) : [raw]; }
    catch { values = []; }
  }
  return [...new Set((Array.isArray(values) ? values : [values]).map((id) => String(id || '').trim()).filter(Boolean))];
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
      scope: row.scope || 'system',
      owner: row.owner || null,
      publicationStatus: row.status || 'none',
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

module.exports = function registerCharacters({ app, db, sql, upload, requireAdmin, uploadFileToCloud, currentUser, isAdmin }) {
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
    await db.query(`CREATE TABLE IF NOT EXISTS character_visibility (character_id TEXT PRIMARY KEY, owner TEXT NOT NULL COLLATE NOCASE, scope TEXT NOT NULL DEFAULT 'personal', status TEXT NOT NULL DEFAULT 'none')`);
    await db.query('CREATE INDEX IF NOT EXISTS idx_characters_book ON character_avatars(book_id, name)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_character_books_book ON character_books(book_id, character_id)');
    await db.query(`INSERT OR IGNORE INTO character_books(character_id, book_id, created_at)
      SELECT id, book_id, created_at FROM character_avatars WHERE book_id IS NOT NULL AND book_id <> ''`);
  })();

  async function validateBooks(bookIds, username, admin, publicOnly = false) {
    if (bookIds.length > 1000) throw Object.assign(new Error('Selecione no máximo 1000 livros.'), { status: 400 });
    for (const bookId of bookIds) {
      const [book] = await db.query(sql`SELECT * FROM books WHERE id=${bookId}`);
      if (!book || (book.is_public != null && Number(book.is_public) !== 1 && (publicOnly || (!admin && String(book.uploaded_by || '').toLowerCase() !== String(username).toLowerCase())))) throw Object.assign(new Error(`Livro não encontrado: ${bookId}`), { status: 400 });
    }
  }

  async function replaceLinks(characterId, bookIds) {
    await db.query(sql`DELETE FROM character_books WHERE character_id=${characterId}`);
    for (const bookId of bookIds) {
      await db.query(sql`INSERT OR IGNORE INTO character_books(character_id,book_id,created_at) VALUES(${characterId},${bookId},${Date.now()})`);
    }
    await db.query(sql`UPDATE character_avatars SET book_id=${bookIds[0] || null} WHERE id=${characterId}`);
  }

  async function catalog(filterBookId = '', username = '', admin = false) {
    const [characters, links, books] = await Promise.all([
      db.query(sql`SELECT a.*, v.owner, v.scope, v.status FROM character_avatars a LEFT JOIN character_visibility v ON v.character_id=a.id WHERE v.character_id IS NULL OR v.scope='system' OR v.owner=${username} COLLATE NOCASE OR ${Number(admin)}=1 ORDER BY a.name`),
      db.query('SELECT character_id, book_id FROM character_books ORDER BY character_id, book_id'),
      db.query('SELECT * FROM books ORDER BY title'),
    ]);
    const visibleBooks = books.filter(book => book.is_public == null || Number(book.is_public) === 1 || admin || (username && String(book.uploaded_by || '').toLowerCase() === username.toLowerCase()));
    const allowed = new Set(visibleBooks.map(book => book.id));
    return buildCatalog(characters, links.filter(link => allowed.has(link.book_id)), visibleBooks, filterBookId);
  }

  app.get('/characters', async (req, res) => {
    try {
      await ready();
      const username = currentUser(req) || '';
      res.json(await catalog(String(req.query.bookId || '').trim(), username, await isAdmin(username)));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/characters', (req, res, next) => currentUser(req) ? next() : res.status(401).json({ error: 'Entre para criar um avatar.' }), upload.single('image'), async (req, res) => {
    try {
      await ready();
      const name = String(req.body.name || '').trim().slice(0, 60);
      const characterId = String(req.body.characterId || '').trim();
      const bookIds = parseBookIds(req.body);
      const username = currentUser(req), admin = await isAdmin(username);
      const scope = req.body.scope === 'personal' ? 'personal' : admin ? 'system' : 'personal';
      if (!admin && req.body.scope === 'system') return res.status(403).json({ error: 'Apenas o admin pode publicar para todos.' });
      await validateBooks(bookIds, username, admin, scope === 'system');
      if (characterId) {
        if (!admin) return res.status(403).json({ error: 'Apenas o admin pode editar personagens.' });
        const [existing] = await db.query(sql`SELECT a.id,v.scope FROM character_avatars a LEFT JOIN character_visibility v ON v.character_id=a.id WHERE a.id=${characterId}`);
        if (!existing) return res.status(404).json({ error: 'Personagem não encontrado.' });
        await validateBooks(bookIds, username, true, existing.scope !== 'personal');
        if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do personagem.' });
        let imageUrl;
        if (req.file) {
          if (!['image/jpeg','image/png','image/webp','image/avif'].includes(req.file.mimetype)) return res.status(400).json({ error: 'Formato de imagem inválido.' });
          imageUrl = await uploadFileToCloud(req.file.buffer, `characters/${crypto.randomUUID()}.${req.file.mimetype.split('/')[1].replace('jpeg', 'jpg')}`, req.file.mimetype);
        }
        await db.query(sql`UPDATE character_avatars SET name=${name} WHERE id=${characterId}`);
        if (imageUrl) await db.query(sql`UPDATE character_avatars SET image_url=${imageUrl} WHERE id=${characterId}`);
        await replaceLinks(characterId, bookIds);
        const result = await catalog('', currentUser(req), await isAdmin(currentUser(req)));
        return res.json(result.characters.find((character) => character.id === characterId));
      }
      if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do personagem.' });
      if (!req.file) return res.status(400).json({ error: 'Escolha uma imagem.' });
      if (!['image/jpeg','image/png','image/webp','image/avif'].includes(req.file.mimetype)) return res.status(400).json({ error: 'O arquivo precisa ser uma imagem.' });
      const id = crypto.randomUUID();
      const extension = (req.file.mimetype.split('/')[1] || 'webp').replace('jpeg', 'jpg');
      const imageUrl = await uploadFileToCloud(req.file.buffer, `characters/${id}.${extension}`, req.file.mimetype);
      const createdAt = Date.now();
      await db.query(sql`INSERT INTO character_visibility(character_id,owner,scope,status) VALUES(${id},${username},${scope},${scope === 'personal' && req.body.requestPublication === 'true' ? 'pending' : 'none'})`);
      await db.query(sql`INSERT INTO character_avatars(id,name,book_id,image_url,created_at) VALUES(${id},${name},${bookIds[0] || null},${imageUrl},${createdAt})`);
      for (const bookId of bookIds) await db.query(sql`INSERT OR IGNORE INTO character_books(character_id,book_id,created_at) VALUES(${id},${bookId},${createdAt})`);
      const result = await catalog('', currentUser(req), await isAdmin(currentUser(req)));
      res.status(201).json(result.characters.find((character) => character.id === id));
    } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  });

  app.put('/characters/:id/books', requireAdmin, async (req, res) => {
    try {
      await ready();
      const bookIds = parseBookIds(req.body);
      const [existing] = await db.query(sql`SELECT a.id,v.scope FROM character_avatars a LEFT JOIN character_visibility v ON v.character_id=a.id WHERE a.id=${req.params.id}`);
      if (!existing) return res.status(404).json({ error: 'Personagem não encontrado.' });
      await validateBooks(bookIds, currentUser(req), true, existing.scope !== 'personal');
      await replaceLinks(existing.id, bookIds);
      const result = await catalog('', currentUser(req), await isAdmin(currentUser(req)));
      res.json(result.characters.find((character) => character.id === existing.id));
    } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  });

  app.delete('/characters/:id', async (req, res) => {
    try {
      await ready();
      const username = currentUser(req), admin = await isAdmin(username);
      if (!username) return res.status(401).json({ error: 'Entre na sua conta.' });
      const [visibility] = await db.query(sql`SELECT * FROM character_visibility WHERE character_id=${req.params.id}`);
      if (!admin && !(visibility?.scope === 'personal' && visibility.owner.toLowerCase() === username.toLowerCase())) return res.status(403).json({ error: 'Sem permissão.' });
      await db.query(sql`DELETE FROM character_avatars WHERE id=${req.params.id}`);
      await db.query(sql`DELETE FROM character_books WHERE character_id=${req.params.id}`);
      await db.query(sql`DELETE FROM character_visibility WHERE character_id=${req.params.id}`);
      res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/characters/:id/submissions', async (req, res) => {
    try {
      await ready(); const username = currentUser(req);
      if (!username) return res.status(401).json({ error: 'Entre na sua conta.' });
      const [entry] = await db.query(sql`SELECT * FROM character_visibility WHERE character_id=${req.params.id} AND owner=${username} COLLATE NOCASE AND scope='personal'`);
      if (!entry) return res.status(404).json({ error: 'Avatar pessoal não encontrado.' });
      await db.query(sql`UPDATE character_visibility SET status='pending' WHERE character_id=${entry.character_id}`);
      res.json({ status: 'pending' });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/admin/character-submissions', requireAdmin, async (req, res) => {
    try { await ready(); const result = await catalog('', currentUser(req), true); res.json(result.characters.filter(item => item.scope === 'personal' && item.publicationStatus === 'pending')); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/admin/character-submissions/:id/decision', requireAdmin, async (req, res) => {
    try {
      await ready(); const decision = req.body.decision;
      if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Decisão inválida.' });
      const [entry] = await db.query(sql`SELECT * FROM character_visibility WHERE character_id=${req.params.id} AND scope='personal' AND status='pending'`);
      if (!entry) return res.status(409).json({ error: 'Solicitação já analisada ou não encontrada.' });
      if (decision === 'approved') {
        const links = await db.query(sql`SELECT book_id FROM character_books WHERE character_id=${entry.character_id}`);
        await validateBooks(links.map(link => link.book_id), currentUser(req), true, true);
      }
      await db.query(sql`UPDATE character_visibility SET scope=${decision === 'approved' ? 'system' : 'personal'},status=${decision} WHERE character_id=${entry.character_id} AND status='pending'`);
      res.json({ status: decision });
    } catch (error) { res.status(error.status || 500).json({ error: error.message }); }
  });

  return { ready, buildCatalog };
};

module.exports.parseBookIds = parseBookIds;
module.exports.buildCatalog = buildCatalog;
