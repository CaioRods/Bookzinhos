const crypto = require('crypto');
const multer = require('multer');
const ICONS = new Set(['heart', 'sparkles', 'bookmark', 'castle', 'coffee', 'zap', 'book', 'moon', 'flower', 'library']);
function normalize(input = {}) {
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Dê um nome à Booklist.');
  const color = input.color || '#c9aaa1';
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor inválida.');
  const bookIds = [...new Set(Array.isArray(input.bookIds) ? input.bookIds.map(String) : [])];
  if (bookIds.length > 1000 || bookIds.some(id => !id || id.length > 160)) throw new Error('Seleção de livros inválida.');
  const crop = input.crop || {};
  const bounded = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : fallback;
  return { name, color, icon: ICONS.has(input.icon) ? input.icon : 'heart', bookIds, crop: { x: bounded(crop.x, 50, 100), y: bounded(crop.y, 50, 100), zoom: Math.max(1, bounded(crop.zoom, 1, 4)) }, imageWidth: Math.max(1, bounded(input.imageWidth, 1000, 20000)), imageHeight: Math.max(1, bounded(input.imageHeight, 1000, 20000)) };
}
module.exports = function registerBooklists({ app, db, sql, currentUser, uploadFileToCloud }) {
  let initialized;
  const ready = () => initialized ||= db.query('CREATE TABLE IF NOT EXISTS booklists (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE, data TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fieldSize: 300000 } }).single('cover');
  const member = async (req, res, next) => {
    try { const me = currentUser(req); const [user] = me ? await db.query(sql`SELECT username, is_admin FROM users WHERE username = ${me} COLLATE NOCASE`) : []; if (!user) return res.status(401).json({ error: 'Entre na conta para usar Booklists.' }); req.booklistUser = user; await ready(); next(); }
    catch (error) { res.status(500).json({ error: error.message }); }
  };
  const decode = row => ({ ...JSON.parse(row.data), id: row.id, updatedAt: Number(row.updated_at) });
  app.get('/booklists', member, async (req, res) => {
    try { const rows = await db.query(sql`SELECT * FROM booklists WHERE username = ${req.booklistUser.username} COLLATE NOCASE ORDER BY updated_at DESC`); res.json(rows.map(decode)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  const save = async (req, res) => {
    try {
      const user = req.booklistUser;
      let existing;
      if (req.params.id) {
        [existing] = await db.query(sql`SELECT * FROM booklists WHERE id = ${req.params.id} AND username = ${user.username} COLLATE NOCASE`);
        if (!existing) return res.status(404).json({ error: 'Booklist não encontrada.' });
      }
      const input = JSON.parse(req.body.config || '{}'), config = normalize(input), previous = existing ? JSON.parse(existing.data) : {};
      if (config.bookIds.length) {
        const known = await db.query({ text: `SELECT id FROM books WHERE id IN (${config.bookIds.map(() => '?').join(',')}) AND (is_public = 1 OR uploaded_by = ? COLLATE NOCASE OR ? = 1)`, values: [...config.bookIds, user.username, Number(user.is_admin) || 0] });
        if (known.length !== config.bookIds.length) return res.status(400).json({ error: 'Um dos livros foi removido ou não está disponível para sua conta.' });
      }
      config.imageUrl = input.removeCover ? '' : previous.imageUrl || '';
      if (req.file) {
        if (!/^image\/(jpeg|png|webp|avif)$/.test(req.file.mimetype)) throw new Error('Use uma imagem JPG, PNG, WebP ou AVIF.');
        config.imageUrl = await uploadFileToCloud(req.file.buffer, `booklists/${crypto.randomUUID()}.${req.file.mimetype.split('/')[1]}`, req.file.mimetype);
      }
      const id = existing?.id || `booklist-${crypto.randomUUID()}`, now = Date.now();
      if (existing) await db.query(sql`UPDATE booklists SET data = ${JSON.stringify(config)}, updated_at = ${now} WHERE id = ${id} AND username = ${user.username} COLLATE NOCASE`);
      else await db.query(sql`INSERT INTO booklists (id,username,data,updated_at) VALUES (${id},${user.username},${JSON.stringify(config)},${now})`);
      res.status(existing ? 200 : 201).json({ ...config, id, updatedAt: now });
    } catch (error) { res.status(400).json({ error: error.message }); }
  };
  app.post('/booklists', member, upload, save);
  app.put('/booklists/:id', member, upload, save);
  app.delete('/booklists/:id', member, async (req, res) => {
    try { await db.query(sql`DELETE FROM booklists WHERE id = ${req.params.id} AND username = ${req.booklistUser.username} COLLATE NOCASE`); res.json({ ok: true }); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  return { ready };
};
module.exports.normalize = normalize;
