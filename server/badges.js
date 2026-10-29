const crypto = require('crypto');

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
    return db.query(sql`SELECT d.code,d.name,d.description,d.category,d.threshold,MIN(x.earned_at) AS earnedAt,MAX(x.manual) AS manual
      FROM (SELECT badge_code,earned_at,0 AS manual FROM user_badges WHERE username=${username} COLLATE NOCASE
      UNION ALL SELECT badge_code,granted_at AS earned_at,1 AS manual FROM admin_badges WHERE username=${username} COLLATE NOCASE) x
      JOIN badge_definitions d ON d.code=x.badge_code GROUP BY d.code,d.name,d.description,d.category,d.threshold ORDER BY earnedAt`);
  };
  const listDefinitions = async () => { await ready(); return db.query('SELECT code,name,description,category,threshold FROM badge_definitions ORDER BY category,threshold,name'); };
  const requireReason = (reason) => {
    const value = String(reason || '').trim();
    if (!value) throw new Error('Informe o motivo da alteração do selo.');
    return value;
  };
  const grantBadge = async ({ username, code, admin, reason }) => {
    await ready();
    const cleanReason = requireReason(reason);
    const [[user], [definition]] = await Promise.all([
      db.query(sql`SELECT username FROM users WHERE username=${username} COLLATE NOCASE`),
      db.query(sql`SELECT code FROM badge_definitions WHERE code=${code}`),
    ]);
    if (!user) throw new Error('Leitor não encontrado.');
    if (!definition) throw new Error('Selo não encontrado.');
    await db.query(sql`INSERT OR REPLACE INTO admin_badges(username,badge_code,granted_by,reason,granted_at) VALUES(${username},${code},${admin},${cleanReason},${now()})`);
    await db.query(sql`INSERT INTO admin_audit_log(id,admin_username,target_username,action,amount,reason,metadata,created_at) VALUES(${crypto.randomUUID()},${admin},${username},'grant_badge',0,${cleanReason},${JSON.stringify({ code })},${now()})`);
    return evaluateBadges(username);
  };
  const revokeBadge = async ({ username, code, admin, reason }) => {
    await ready();
    const cleanReason = requireReason(reason);
    await db.query(sql`DELETE FROM admin_badges WHERE username=${username} COLLATE NOCASE AND badge_code=${code}`);
    await db.query(sql`INSERT INTO admin_audit_log(id,admin_username,target_username,action,amount,reason,metadata,created_at) VALUES(${crypto.randomUUID()},${admin},${username},'revoke_badge',0,${cleanReason},${JSON.stringify({ code })},${now()})`);
    return evaluateBadges(username);
  };
  return { ready, evaluateBadges, listDefinitions, grantBadge, revokeBadge };
}

module.exports = { DEFINITIONS, badgeCodesForStats, createBadgeService };
