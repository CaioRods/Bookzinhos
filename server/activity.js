function createActivityService({ db, sql, now = Date.now, progression }) {
  let pending;
  const ready = () => pending ||= (async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS user_activity_daily (
      username TEXT NOT NULL COLLATE NOCASE, day TEXT NOT NULL, active_seconds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(username,day)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS reading_sessions (
      username TEXT NOT NULL COLLATE NOCASE, book_id TEXT NOT NULL, active_seconds INTEGER NOT NULL DEFAULT 0,
      rewarded INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(username,book_id)
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS reading_page_visits (
      username TEXT NOT NULL COLLATE NOCASE, book_id TEXT NOT NULL, page_num INTEGER NOT NULL, visited_at INTEGER NOT NULL,
      PRIMARY KEY(username,book_id,page_num)
    )`);
  })();

  const readingEligibility = async (username, bookId) => {
    await ready();
    const [[session], [pages], [visited]] = await Promise.all([
      db.query(sql`SELECT active_seconds,rewarded FROM reading_sessions WHERE username=${username} COLLATE NOCASE AND book_id=${bookId}`),
      db.query(sql`SELECT COUNT(*) AS total FROM book_pages WHERE book_id=${bookId}`),
      db.query(sql`SELECT COUNT(*) AS total FROM reading_page_visits WHERE username=${username} COLLATE NOCASE AND book_id=${bookId}`),
    ]);
    const activeSeconds = Number(session?.active_seconds || 0);
    const totalPages = Number(pages?.total || 0);
    const visitedPages = Number(visited?.total || 0);
    return { activeSeconds, totalPages, visitedPages, rewarded: !!Number(session?.rewarded), eligible: activeSeconds >= 2400 && totalPages > 0 && visitedPages >= totalPages };
  };

  const recordHeartbeat = async (username, input) => {
    await ready();
    const creditedSeconds = Math.max(0, Math.min(45, Math.trunc(Number(input.clientElapsedSeconds) || 0)));
    const timestamp = now();
    const day = new Date(timestamp).toISOString().slice(0, 10);
    await db.query(sql`INSERT INTO user_activity_daily(username,day,active_seconds) VALUES(${username},${day},${creditedSeconds})
      ON CONFLICT(username,day) DO UPDATE SET active_seconds=active_seconds+${creditedSeconds}`);
    if (input.scope === 'reader' && input.bookId) {
      await db.query(sql`INSERT INTO reading_sessions(username,book_id,active_seconds,rewarded,updated_at) VALUES(${username},${input.bookId},${creditedSeconds},0,${timestamp})
        ON CONFLICT(username,book_id) DO UPDATE SET active_seconds=active_seconds+${creditedSeconds},updated_at=${timestamp}`);
      if (Number.isInteger(Number(input.page)) && Number(input.page) > 0) {
        await db.query(sql`INSERT OR IGNORE INTO reading_page_visits(username,book_id,page_num,visited_at) VALUES(${username},${input.bookId},${Number(input.page)},${timestamp})`);
      }
      const eligibility = await readingEligibility(username, input.bookId);
      if (eligibility.eligible && !eligibility.rewarded) {
        await db.query(sql`UPDATE reading_sessions SET rewarded=1 WHERE username=${username} COLLATE NOCASE AND book_id=${input.bookId} AND rewarded=0`);
        await progression.awardXp({ username, type: 'reading_complete', baseAmount: 80, actor: username, entityType: 'book', entityId: input.bookId, idempotencyKey: `reading_complete:${username.toLowerCase()}:${input.bookId}` });
      }
    }
    return { creditedSeconds, ...(input.bookId ? await readingEligibility(username, input.bookId) : {}) };
  };
  return { ready, recordHeartbeat, readingEligibility };
}

module.exports = function registerActivity({ app, db, sql, currentUser, progression }) {
  const service = createActivityService({ db, sql, progression });
  app.post('/activity/heartbeat', async (req, res) => {
    try {
      const username = currentUser(req);
      if (!username) return res.status(401).json({ error: 'Entre para registrar atividade.' });
      res.json(await service.recordHeartbeat(username, req.body || {}));
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  return service;
};
module.exports.createActivityService = createActivityService;
