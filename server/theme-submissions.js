const crypto = require('crypto');

module.exports = function registerThemeSubmissions({ app, db, sql, currentUser, requireAdmin, progression, now = Date.now }) {
  let pending;
  const ready = () => pending ||= db.query(`CREATE TABLE IF NOT EXISTS theme_submissions (
    id TEXT PRIMARY KEY, theme_id TEXT NOT NULL, owner TEXT NOT NULL COLLATE NOCASE, theme_data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', reviewer TEXT, reason TEXT NOT NULL DEFAULT '',
    published_theme_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`);
  app.post('/appearance/themes/:id/submissions', async (req, res) => {
    try {
      await ready(); const owner = currentUser(req);
      if (!owner) return res.status(401).json({ error: 'Entre para enviar um tema.' });
      const [theme] = await db.query(sql`SELECT * FROM appearance_themes WHERE id=${req.params.id} AND owner=${owner} COLLATE NOCASE`);
      if (!theme) return res.status(404).json({ error: 'Tema pessoal não encontrado.' });
      const [existing] = await db.query(sql`SELECT * FROM theme_submissions WHERE theme_id=${theme.id} AND owner=${owner} COLLATE NOCASE AND status='pending'`);
      const timestamp = now();
      if (existing) {
        await db.query(sql`UPDATE theme_submissions SET theme_data=${theme.data},updated_at=${timestamp} WHERE id=${existing.id}`);
        return res.json({ ...existing, themeData: JSON.parse(theme.data) });
      }
      const id = crypto.randomUUID();
      await db.query(sql`INSERT INTO theme_submissions(id,theme_id,owner,theme_data,status,created_at,updated_at) VALUES(${id},${theme.id},${owner},${theme.data},'pending',${timestamp},${timestamp})`);
      res.status(201).json({ id, themeId: theme.id, owner, status: 'pending', themeData: JSON.parse(theme.data) });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get('/admin/theme-submissions', requireAdmin, async (req, res) => {
    try { await ready(); const status = String(req.query.status || 'pending'); res.json(await db.query(sql`SELECT * FROM theme_submissions WHERE status=${status} ORDER BY updated_at DESC`)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/admin/theme-submissions/:id/decision', requireAdmin, async (req, res) => {
    try {
      await ready(); const decision = String(req.body.decision || '');
      if (!['approved','rejected','changes_requested'].includes(decision)) return res.status(400).json({ error: 'Decisão inválida.' });
      const [submission] = await db.query(sql`SELECT * FROM theme_submissions WHERE id=${req.params.id}`);
      if (!submission) return res.status(404).json({ error: 'Solicitação não encontrada.' });
      if (submission.status !== 'pending') return res.status(409).json({ error: 'Esta solicitação já foi analisada.' });
      const timestamp = now(); let publishedThemeId = null;
      if (decision === 'approved') {
        publishedThemeId = `theme-${crypto.randomUUID()}`;
        await db.query(sql`INSERT INTO appearance_themes(id,owner,slot,data,updated_at) VALUES(${publishedThemeId},'',NULL,${submission.theme_data},${timestamp})`);
        await progression.awardXp({ username: submission.owner, type: 'theme_approved', baseAmount: 250, actor: currentUser(req), entityType: 'theme', entityId: submission.theme_id, idempotencyKey: `theme_approved:${submission.id}` });
        await db.query(sql`INSERT OR IGNORE INTO xp_boosts(id,username,multiplier,starts_at,ends_at,source) VALUES(${`theme-boost-${submission.id}`},${submission.owner},2,${timestamp},${timestamp + 86400000},${submission.id})`);
      }
      await db.query(sql`UPDATE theme_submissions SET status=${decision},reviewer=${currentUser(req)},reason=${String(req.body.reason || '').slice(0,300)},published_theme_id=${publishedThemeId},updated_at=${timestamp} WHERE id=${submission.id}`);
      res.json({ id: submission.id, status: decision, publishedThemeId });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  return { ready };
};
