module.exports = function registerProgressionRoutes({ app, db, sql, currentUser, requireAdmin, progression, badges }) {
  app.get('/progression/:username', async (req, res) => {
    try {
      const username = req.params.username;
      const summary = await progression.summary(username);
      const earned = await badges.evaluateBadges(username);
      const [[activity], [finished], [published], [reviews], [boost]] = await Promise.all([
        db.query(sql`SELECT COALESCE(SUM(active_seconds),0) AS n FROM user_activity_daily WHERE username=${username} COLLATE NOCASE`),
        db.query(sql`SELECT COUNT(*) AS n FROM reading_sessions WHERE username=${username} COLLATE NOCASE AND rewarded=1`),
        db.query(sql`SELECT COUNT(*) AS n FROM books WHERE uploaded_by=${username} COLLATE NOCASE`),
        db.query(sql`SELECT COUNT(*) AS n FROM book_reviews WHERE username=${username} COLLATE NOCASE`),
        db.query(sql`SELECT MAX(ends_at) AS ends_at FROM xp_boosts WHERE username=${username} COLLATE NOCASE AND ends_at>${Date.now()}`),
      ]);
      res.json({ ...summary, boostUntil: Number(boost?.ends_at || 0), stats: { activeSeconds: Number(activity.n), finished: Number(finished.n), published: Number(published.n), reviews: Number(reviews.n) }, badges: earned });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post('/admin/users/:username/xp', requireAdmin, async (req, res) => {
    try { res.json(await progression.adjustXpByAdmin({ admin: currentUser(req), username: req.params.username, amount: req.body.amount, reason: req.body.reason })); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.put('/admin/users/:username/level', requireAdmin, async (req, res) => {
    try { res.json(await progression.setLevelByAdmin({ admin: currentUser(req), username: req.params.username, level: req.body.level, reason: req.body.reason })); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.get('/admin/users/:username/xp-events', requireAdmin, async (req, res) => {
    try { res.json(await db.query(sql`SELECT * FROM xp_events WHERE username=${req.params.username} COLLATE NOCASE ORDER BY created_at DESC LIMIT 100`)); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });
};
