const crypto = require('crypto');
const BUILTINS = new Set(['lilac', 'golden', 'forest', 'coast', 'spring', 'night']);
const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const crop = (value = {}) => ({ x: finite(value.x, 50, 0, 100), y: finite(value.y, 50, 0, 100), zoom: finite(value.zoom, 1, 1, 4) });
const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
function imageUrl(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048 || !(/^(https?:\/\/|\/(?!\/))/.test(value))) throw new Error('Endereço de imagem inválido.');
  return value;
}
function themeConfig(input) {
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Dê um nome ao tema.');
  const mainColor = color(input.mainColor);
  if (!mainColor) throw new Error('Escolha uma cor principal válida.');
  return {
    name, mainColor, imageUrl: imageUrl(input.imageUrl),
    width: finite(input.width, 1536, 1, 20000), height: finite(input.height, 1024, 1, 20000),
    atlas: input.atlas ? { column: Math.round(finite(input.atlas.column, 0, 0, 1)), row: Math.round(finite(input.atlas.row, 0, 0, 2)) } : null,
    profile: crop(input.profile), sidebar: crop(input.sidebar), sidebarOpacity: finite(input.sidebarOpacity, .75, 0, 1),
    reference: input.reference ? { bookId: String(input.reference.bookId || '').slice(0, 160), saga: String(input.reference.saga || '').trim().slice(0, 100) } : null,
  };
}
function bookConfig(input) {
  if (input.mainColor && !color(input.mainColor)) throw new Error('Cor principal inválida.');
  return { width: finite(input.width, 800, 1, 20000), height: finite(input.height, 1200, 1, 20000), imageUrl: imageUrl(input.imageUrl), mainColor: color(input.mainColor), blur: finite(input.blur, 28, 0, 60), opacity: finite(input.opacity, .2, 0, 1), crop: crop(input.crop) };
}
module.exports = function registerAppearance({ app, db, sql, upload, uploadFileToCloud, currentUser, requireAdmin }) {
  let pending;
  const ready = () => pending ||= db.query(`CREATE TABLE IF NOT EXISTS appearance_themes (id TEXT PRIMARY KEY, owner TEXT NOT NULL COLLATE NOCASE, slot INTEGER, data TEXT NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(owner, slot))`);
  const fail = (res, error) => res.status(error.status || 400).json({ error: error.message || 'Não foi possível salvar.' });
  const decode = row => ({ ...JSON.parse(row.data), id: row.id, scope: row.owner === '' ? 'system' : 'personal', updatedAt: row.updated_at });
  const member = async (req, res, next) => {
    try {
      const me = currentUser(req);
      if (!me) return res.status(401).json({ error: 'Entre para salvar temas.' });
      const [user] = await db.query(sql`SELECT username, is_admin FROM users WHERE username = ${me} COLLATE NOCASE`);
      if (!user) return res.status(401).json({ error: 'Conta não encontrada.' });
      req.themeUser = user;
      next();
    } catch (error) { fail(res, error); }
  };
  const storeImage = async file => {
    if (!file) return null;
    const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };
    const extension = extensions[file.mimetype];
    if (!extension) throw new Error('Use uma imagem JPG, PNG, WebP ou AVIF.');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
    return uploadFileToCloud(file.buffer, `appearance/${crypto.randomUUID()}.${extension}`, file.mimetype);
  };
  app.get('/appearance/themes', async (req, res) => {
    try {
      await ready();
      const me = currentUser(req);
      res.set('Cache-Control', 'no-store');
      const rows = me ? await db.query(sql`SELECT * FROM appearance_themes WHERE owner = '' OR owner = ${me} COLLATE NOCASE ORDER BY updated_at`) : await db.query(sql`SELECT * FROM appearance_themes WHERE owner = '' ORDER BY updated_at`);
      res.json(rows.map(decode));
    } catch (error) { fail(res, error); }
  });
  app.get('/appearance/profile/:username', async (req, res) => {
    try {
      await ready();
      const [user] = await db.query(sql`SELECT profile_theme_id FROM users WHERE username=${req.params.username} COLLATE NOCASE`);
      if (!user) return res.status(404).json({ error: 'Perfil não encontrado.' });
      const id = user.profile_theme_id || 'none';
      if (id === 'none') return res.json({ id: 'none' });
      const [row] = await db.query(sql`SELECT * FROM appearance_themes WHERE id=${id} AND (owner='' OR owner=${req.params.username} COLLATE NOCASE)`);
      res.set('Cache-Control', 'public, max-age=60');
      res.json(row ? decode(row) : { id });
    } catch (error) { fail(res, error); }
  });
  app.put('/appearance/profile', member, async (req, res) => {
    try {
      await ready();
      const id = String(req.body.themeId || 'none').slice(0, 80);
      const builtin = BUILTINS.has(id) || id === 'none';
      const [theme] = builtin ? [] : await db.query(sql`SELECT id FROM appearance_themes WHERE id=${id} AND (owner='' OR owner=${req.themeUser.username} COLLATE NOCASE)`);
      if (!builtin && !theme) return res.status(400).json({ error: 'Tema não disponível para este perfil.' });
      await db.query(sql`UPDATE users SET profile_theme_id=${id} WHERE username=${req.themeUser.username} COLLATE NOCASE`);
      res.json({ themeId: id });
    } catch (error) { fail(res, error); }
  });
  app.post('/appearance/themes', member, upload.single('image'), async (req, res) => {
    try {
      await ready();
      const input = JSON.parse(req.body.config || '{}');
      const scope = req.body.scope === 'system' ? 'system' : 'personal';
      if (scope === 'system' && !Number(req.themeUser.is_admin)) return res.status(403).json({ error: 'Apenas o Admin pode publicar temas para todos.' });
      const config = themeConfig(input);
      if (config.reference?.bookId) {
        const [book] = await db.query(sql`SELECT id FROM books WHERE id = ${config.reference.bookId}`);
        if (!book) throw new Error('O livro de referência não existe mais.');
      }
      if (config.reference && !config.reference.bookId && !config.reference.saga) throw new Error('Escolha um livro ou informe a saga.');
      const owner = scope === 'system' ? '' : req.themeUser.username;
      const [existing] = await db.query(sql`SELECT * FROM appearance_themes WHERE id = ${String(req.body.id || '')}`);
      const own = existing && existing.owner.toLowerCase() === owner.toLowerCase();
      // Check the personal limit before uploading a new binary.
      if (!own && scope === 'personal') {
        const [count] = await db.query(sql`SELECT COUNT(*) AS n FROM appearance_themes WHERE owner = ${owner} COLLATE NOCASE`);
        if (Number(count.n) >= 4) return res.status(409).json({ error: 'Você já tem quatro temas pessoais. Edite ou exclua um deles.' });
      }
      const uploaded = await storeImage(req.file);
      if (uploaded) { config.imageUrl = uploaded; config.atlas = null; }
      if (!config.imageUrl) throw new Error('Adicione uma imagem ao tema.');
      const id = own ? existing.id : scope === 'system' && BUILTINS.has(req.body.id) ? req.body.id : `theme-${crypto.randomUUID()}`;
      const data = JSON.stringify(config), now = Date.now();
      if (own) await db.query(sql`UPDATE appearance_themes SET data = ${data}, updated_at = ${now} WHERE id = ${id} AND owner = ${owner} COLLATE NOCASE`);
      else if (scope === 'system') await db.query(sql`INSERT INTO appearance_themes(id, owner, slot, data, updated_at) VALUES (${id}, '', NULL, ${data}, ${now})`);
      else {
        let inserted = false;
        for (let slot = 1; slot <= 4 && !inserted; slot++) {
          try { await db.query(sql`INSERT INTO appearance_themes(id, owner, slot, data, updated_at) VALUES (${id}, ${owner}, ${slot}, ${data}, ${now})`); inserted = true; }
          catch (error) { if (!/unique/i.test(error.message)) throw error; }
        }
        if (!inserted) return res.status(409).json({ error: 'Limite de quatro temas pessoais atingido.' });
      }
      const [saved] = await db.query(sql`SELECT * FROM appearance_themes WHERE id = ${id}`);
      res.json(decode(saved));
    } catch (error) { fail(res, error); }
  });
  app.delete('/appearance/themes/:id', member, async (req, res) => {
    try {
      await ready();
      const [row] = await db.query(sql`SELECT * FROM appearance_themes WHERE id = ${req.params.id}`);
      if (!row) return res.status(404).json({ error: 'Tema não encontrado.' });
      if (row.owner === '' ? !Number(req.themeUser.is_admin) : row.owner.toLowerCase() !== req.themeUser.username.toLowerCase()) return res.status(403).json({ error: 'Você não pode excluir este tema.' });
      await db.query(sql`DELETE FROM appearance_themes WHERE id = ${row.id}`);
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });
  app.put('/books/:id/appearance', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      const [book] = await db.query(sql`SELECT id FROM books WHERE id = ${req.params.id}`);
      if (!book) return res.status(404).json({ error: 'Livro não encontrado.' });
      const config = bookConfig(JSON.parse(req.body.config || '{}'));
      const uploaded = await storeImage(req.file);
      if (uploaded) config.imageUrl = uploaded;
      await db.query(sql`UPDATE books SET appearance_json = ${JSON.stringify(config)} WHERE id = ${book.id}`);
      res.json(config);
    } catch (error) { fail(res, error); }
  });
  return { ready };
};
module.exports.themeConfig = themeConfig;
module.exports.bookConfig = bookConfig;
