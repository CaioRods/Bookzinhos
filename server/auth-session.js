const crypto = require("crypto");

const COOKIE_NAME = "mybooks_session";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const query = (text, values = []) => ({ text, values });
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

function createSessionStore({ db, clock = Date.now, randomBytes = crypto.randomBytes, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!db?.query) throw new TypeError("A database connection is required");
  return {
    async create(username, metadata = {}) {
      const now = clock();
      const rawToken = randomBytes(32).toString("base64url");
      const id = crypto.randomUUID();
      const expiresAt = now + ttlMs;
      await db.query(query(`INSERT INTO auth_sessions
        (id, token_hash, username, created_at, expires_at, last_used_at, revoked_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`, [
        id, hashToken(rawToken), username, now, expiresAt, now,
        metadata.userAgent || "", metadata.ipAddress || "",
      ]));
      return { id, rawToken, username, expiresAt };
    },
    async resolve(rawToken) {
      if (typeof rawToken !== "string" || rawToken.length < 16 || rawToken.length > 256) return null;
      const rows = await db.query(query(`SELECT s.id, s.username, s.expires_at, s.last_used_at, s.revoked_at,
          COALESCE(u.privacy_version, '') AS privacy_version
        FROM auth_sessions s LEFT JOIN users u ON u.username = s.username COLLATE NOCASE
        WHERE s.token_hash = ? LIMIT 1`, [hashToken(rawToken)]));
      const row = rows[0];
      const now = clock();
      if (!row || row.revoked_at != null || Number(row.expires_at) <= now) return null;
      if (now - Number(row.last_used_at || 0) >= TOUCH_INTERVAL_MS) {
        await db.query(query("UPDATE auth_sessions SET last_used_at = ? WHERE id = ?", [now, row.id]));
      }
      return { id: row.id, username: row.username, expiresAt: Number(row.expires_at), privacyAcceptedVersion: row.privacy_version || "" };
    },
    async touch(sessionId) {
      await db.query(query("UPDATE auth_sessions SET last_used_at = ? WHERE id = ?", [clock(), sessionId]));
    },
    async revoke(rawToken) {
      if (!rawToken || typeof rawToken !== "string") return;
      await db.query(query("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", [clock(), hashToken(rawToken)]));
    },
    async revokeAll(username) {
      await db.query(query("UPDATE auth_sessions SET revoked_at = ? WHERE username = ? AND revoked_at IS NULL", [clock(), username]));
    },
  };
}

function normalizeOptions(options = {}) {
  const sameSite = String(options.sameSite || "lax").toLowerCase();
  const secure = Boolean(options.secure);
  if (!["lax", "strict", "none"].includes(sameSite)) throw new Error("Invalid SameSite value");
  if (sameSite === "none" && !secure) throw new Error("SameSite=None requires Secure");
  return { sameSite, secure };
}

function serializeCookie(value, options = {}) {
  const { sameSite, secure } = normalizeOptions(options);
  const maxAge = Math.max(0, Math.floor(Number(options.maxAgeSeconds) || 0));
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`, `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const buildSessionCookie = (rawToken, options = {}) => serializeCookie(rawToken, options);
const buildExpiredSessionCookie = (options = {}) => serializeCookie("", { ...options, maxAgeSeconds: 0 });

function readSessionCookie(req) {
  const header = req?.headers?.cookie;
  if (!header) return null;
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== COOKIE_NAME) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}

function createSessionMiddleware({ store }) {
  if (!store?.resolve) throw new TypeError("A session store is required");
  return async function resolveSession(req, res, next) {
    try {
      const rawToken = readSessionCookie(req);
      const session = rawToken ? await store.resolve(rawToken) : null;
      req.auth = session ? {
        username: session.username,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        ...(session.privacyAcceptedVersion !== undefined ? { privacyAcceptedVersion: session.privacyAcceptedVersion } : {}),
      } : null;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireUser(req, res, next) {
  if (!req.auth?.username) return res.status(401).json({ error: "Entre na sua conta para continuar." });
  next();
}

function cookieOptionsFromEnv(env = process.env) {
  const explicitSecure = env.SESSION_COOKIE_SECURE;
  const secure = explicitSecure == null
    ? env.NODE_ENV === "production"
    : String(explicitSecure).toLowerCase() === "true";
  const sameSite = String(
    env.SESSION_COOKIE_SAMESITE || (env.NODE_ENV === "production" ? "none" : "lax")
  ).toLowerCase();
  if (sameSite === "none" && !secure) throw new Error("SameSite=None requires Secure");
  const days = Math.max(1, Number(env.SESSION_TTL_DAYS) || 30);
  return { secure, sameSite, maxAgeSeconds: Math.floor(days * 86400) };
}

module.exports = {
  COOKIE_NAME,
  DEFAULT_TTL_MS,
  createSessionStore,
  buildSessionCookie,
  buildExpiredSessionCookie,
  readSessionCookie,
  createSessionMiddleware,
  requireUser,
  cookieOptionsFromEnv,
};
