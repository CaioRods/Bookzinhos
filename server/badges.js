const DEFINITIONS = [
  ['pioneer-3','Entre os 3 primeiros','Pioneiro lendário','pioneer',3], ['pioneer-10','Entre os 10 primeiros','Pioneiro','pioneer',10], ['pioneer-100','Entre os 100 primeiros','Primeira geração','pioneer',100],
  ['published-10','10 livros publicados','Autor da estante','published',10], ['published-100','100 livros publicados','Biblioteca viva','published',100], ['published-1000','1.000 livros publicados','Acervo lendário','published',1000],
  ['read-10','10 livros lidos','Primeiros capítulos','finished',10], ['read-50','50 livros lidos','Leitor constante','finished',50], ['read-100','100 livros lidos','Cem mundos','finished',100], ['read-1000','1.000 livros lidos','Mil vidas','finished',1000],
  ['theme-first','Primeiro tema aprovado','Criador de mundos','approvedThemes',1],
  ['level-10','Nível 10','Aprendiz','level',10], ['level-20','Nível 20','Explorador','level',20], ['level-30','Nível 30','Curte leitura','level',30], ['level-50','Nível 50','Leitor dedicado','level',50], ['level-75','Nível 75','Bibliófilo','level',75], ['level-100','Nível 100','Lenda literária','level',100],
];

function badgeCodesForStats(stats) {
  return DEFINITIONS.filter(([, , , field, threshold]) => field === 'pioneer'
    ? Number(stats.registrationOrder || Infinity) <= threshold
    : Number(stats[field] || 0) >= threshold).map(([code]) => code);
}

function createBadgeService({ db, sql, now = Date.now }) {
  const ready = async () => {
    for (const [code, description, name, category, threshold] of DEFINITIONS) {
      await db.query(sql`INSERT OR IGNORE INTO badge_definitions(code,name,description,category,threshold) VALUES(${code},${name},${description},${category},${threshold})`);
    }
  };
  const evaluateBadges = async (username) => {
    await ready();
    let [user] = await db.query(sql`SELECT registration_order,created_at FROM users WHERE username=${username} COLLATE NOCASE`);
    if (!user) return [];
    if (!Number(user.registration_order)) {
      const [order] = await db.query(sql`SELECT COUNT(*) AS n FROM users WHERE created_at<${user.created_at} OR (created_at=${user.created_at} AND username<=${username} COLLATE NOCASE)`);
      await db.query(sql`UPDATE users SET registration_order=${Number(order.n)} WHERE username=${username} COLLATE NOCASE`);
      user.registration_order = Number(order.n);
    }
    const [[finished], [published], [progress], [themes]] = await Promise.all([
      db.query(sql`SELECT COUNT(*) AS n FROM reading_sessions WHERE username=${username} COLLATE NOCASE AND rewarded=1`),
      db.query(sql`SELECT COUNT(*) AS n FROM books WHERE uploaded_by=${username} COLLATE NOCASE`),
      db.query(sql`SELECT level FROM user_progression WHERE username=${username} COLLATE NOCASE`),
      db.query(sql`SELECT COUNT(*) AS n FROM xp_events WHERE username=${username} COLLATE NOCASE AND type='theme_approved'`),
    ]);
    const codes = badgeCodesForStats({ registrationOrder: user.registration_order, finished: finished.n, published: published.n, level: progress?.level, approvedThemes: themes.n });
    for (const code of codes) await db.query(sql`INSERT OR IGNORE INTO user_badges(username,badge_code,earned_at) VALUES(${username},${code},${now()})`);
    return db.query(sql`SELECT d.code,d.name,d.description,d.category,d.threshold,b.earned_at AS earnedAt FROM user_badges b JOIN badge_definitions d ON d.code=b.badge_code WHERE b.username=${username} COLLATE NOCASE ORDER BY b.earned_at`);
  };
  return { ready, evaluateBadges };
}

module.exports = { DEFINITIONS, badgeCodesForStats, createBadgeService };
