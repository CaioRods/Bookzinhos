function sourceList(values = []) {
  return values.map(String).map((value) => value.trim()).filter(Boolean);
}

function securityHeaders({ connectSources = [], imageSources = [] } = {}) {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${sourceList(imageSources).join(" ")}`.trim(),
    `connect-src 'self' ${sourceList(connectSources).join(" ")}`.trim(),
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", policy);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    next();
  };
}

function createCorsOptions({ origins = [] } = {}) {
  const allowed = new Set(sourceList(origins));
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new Error("Origin rejected by CORS policy"));
    },
  };
}

function parseList(value, fallback = []) {
  return value ? String(value).split(",").map((item) => item.trim()).filter(Boolean) : fallback;
}

const DEFAULT_DEVELOPMENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_PRODUCTION_ORIGINS = ["https://mybookzinhos.vercel.app"];

function defaultFrontendOrigins(env = process.env) {
  return env?.NODE_ENV === "production"
    ? DEFAULT_PRODUCTION_ORIGINS
    : DEFAULT_DEVELOPMENT_ORIGINS;
}

function resolveFrontendOrigins(env = process.env) {
  return parseList(env?.FRONTEND_ORIGINS, defaultFrontendOrigins(env));
}

module.exports = {
  securityHeaders,
  createCorsOptions,
  parseList,
  defaultFrontendOrigins,
  resolveFrontendOrigins,
  DEFAULT_DEVELOPMENT_ORIGINS,
  DEFAULT_PRODUCTION_ORIGINS,
};
