const crypto = require('crypto');

module.exports = function registerCharacters({ app, db, sql, upload, requireAdmin, uploadFileToCloud }) {
  const ready = async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS character_avatars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE,
      book_id TEXT,
      image_url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS idx_characters_book ON character_avatars(book_id, name)');
  };
  const readyPromise = ready();

  app.get('/characters', async (req, res) => {
    try {
      await readyPromise;
      const bookId = String(req.query.bookId || '').trim();
      const rows = bookId
        ? await db.query(sql`SELECT c.*, b.title AS book_title FROM character_avatars c LEFT JOIN books b ON b.id=c.book_id WHERE c.book_id=${bookId} ORDER BY c.name`)
        : await db.query(sql`SELECT c.*, b.title AS book_title FROM character_avatars c LEFT JOIN books b ON b.id=c.book_id ORDER BY c.name`);
      res.json(rows.map((row) => ({ id: row.id, name: row.name, bookId: row.book_id || null, bookTitle: row.book_title || null, imageUrl: row.image_url, createdAt: Number(row.created_at) })));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post('/characters', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      await readyPromise;
      const name = String(req.body.name || '').trim().slice(0, 60);
      const bookId = String(req.body.bookId || '').trim() || null;
      if (name.length < 2) return res.status(400).json({ error: 'Informe o nome do personagem.' });
      if (!req.file) return res.status(400).json({ error: 'Escolha uma imagem.' });
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'O arquivo precisa ser uma imagem.' });
      if (bookId) {
        const [book] = await db.query(sql`SELECT id FROM books WHERE id=${bookId}`);
        if (!book) return res.status(400).json({ error: 'Livro não encontrado.' });
      }
      const id = crypto.randomUUID();
      const extension = (req.file.mimetype.split('/')[1] || 'webp').replace('jpeg', 'jpg');
      const imageUrl = await uploadFileToCloud(req.file.buffer, `characters/${id}.${extension}`, req.file.mimetype);
      const createdAt = Date.now();
      await db.query(sql`INSERT INTO character_avatars(id,name,book_id,image_url,created_at) VALUES(${id},${name},${bookId},${imageUrl},${createdAt})`);
      res.status(201).json({ id, name, bookId, imageUrl, createdAt });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.delete('/characters/:id', requireAdmin, async (req, res) => {
    try {
      await readyPromise;
      await db.query(sql`DELETE FROM character_avatars WHERE id=${req.params.id}`);
      res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return { ready: () => readyPromise };
};
