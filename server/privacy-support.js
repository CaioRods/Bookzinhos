const PRIVACY_POLICY_VERSION = "2026-10-30";
const SUPPORT_SETTING_KEY = "voluntary_support";
const PRIVACY_ALLOWED_PATHS = new Set(["/", "/health", "/support", "/auth/session", "/auth/logout", "/privacy/accept"]);

function createPrivacyAcceptanceGate() {
  return function privacyAcceptanceGate(req, res, next) {
    if (!req.auth?.username || PRIVACY_ALLOWED_PATHS.has(req.path) || req.auth.privacyAcceptedVersion === PRIVACY_POLICY_VERSION) return next();
    return res.status(428).json({
      error: "Leia e aceite a Política de Privacidade para continuar.",
      code: "privacy_acceptance_required",
      version: PRIVACY_POLICY_VERSION,
    });
  };
}

function clean(value, max) {
  return String(value || "").trim().slice(0, max);
}

function normalizeSupport(input = {}) {
  return {
    pixKey: clean(input.pixKey, 140),
    recipient: clean(input.recipient, 100),
    message: clean(input.message, 280),
  };
}

function registerPrivacySupportRoutes({ app, db, sql, currentUser, requireAdmin, clock = Date.now }) {
  let readyPromise;
  const ready = () => readyPromise ||= db.query(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  const loadSupport = async () => {
    await ready();
    const [row] = await db.query(sql`SELECT value FROM app_settings WHERE key = ${SUPPORT_SETTING_KEY}`);
    if (!row) return normalizeSupport();
    try { return normalizeSupport(JSON.parse(row.value)); }
    catch { return normalizeSupport(); }
  };

  app.get("/support", async (_req, res) => {
    try { res.json(await loadSupport()); }
    catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.put("/admin/support", requireAdmin, async (req, res) => {
    try {
      await ready();
      const support = normalizeSupport(req.body);
      const now = clock();
      await db.query(sql`INSERT INTO app_settings (key, value, updated_at)
        VALUES (${SUPPORT_SETTING_KEY}, ${JSON.stringify(support)}, ${now})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
      res.json(support);
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  app.post("/privacy/accept", async (req, res) => {
    try {
      const username = currentUser(req);
      if (!username) return res.status(401).json({ error: "Entre na sua conta para continuar." });
      const acceptedAt = clock();
      await db.query(sql`UPDATE users SET privacy_version = ${PRIVACY_POLICY_VERSION}, privacy_accepted_at = ${acceptedAt} WHERE username = ${username} COLLATE NOCASE`);
      res.json({ version: PRIVACY_POLICY_VERSION, acceptedAt });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return { ready, loadSupport };
}

module.exports = { PRIVACY_POLICY_VERSION, SUPPORT_SETTING_KEY, normalizeSupport, createPrivacyAcceptanceGate, registerPrivacySupportRoutes };
