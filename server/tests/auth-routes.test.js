const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSessionMiddleware,
  requireUser,
  cookieOptionsFromEnv,
} = require("../auth-session");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("forged x-user-id cannot replace the cookie session owner", async () => {
  const middleware = createSessionMiddleware({
    store: { resolve: async (token) => token === "valid-cookie-token" ? { id: "s1", username: "Jude", expiresAt: 999 } : null },
  });
  const req = { headers: { cookie: "mybooks_session=valid-cookie-token", "x-user-id": "Caio" } };
  let continued = false;
  await middleware(req, responseRecorder(), () => { continued = true; });

  assert.equal(continued, true);
  assert.deepEqual(req.auth, { username: "Jude", sessionId: "s1", expiresAt: 999 });
});

test("missing or invalid cookies resolve to an anonymous request", async () => {
  const middleware = createSessionMiddleware({ store: { resolve: async () => null } });
  const req = { headers: { "x-user-id": "Caio" } };
  await middleware(req, responseRecorder(), () => {});
  assert.equal(req.auth, null);
});

test("requireUser returns 401 without a server session", () => {
  const res = responseRecorder();
  let continued = false;
  requireUser({ auth: null }, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Entre na sua conta para continuar." });
});

test("cross-site cookies require HTTPS while local cookies stay Lax", () => {
  assert.deepEqual(cookieOptionsFromEnv({ NODE_ENV: "development" }), { secure: false, sameSite: "lax", maxAgeSeconds: 2592000 });
  assert.deepEqual(cookieOptionsFromEnv({ NODE_ENV: "production", SESSION_COOKIE_SAMESITE: "none" }), { secure: true, sameSite: "none", maxAgeSeconds: 2592000 });
  assert.deepEqual(cookieOptionsFromEnv({ NODE_ENV: "production" }), { secure: true, sameSite: "none", maxAgeSeconds: 2592000 });
  assert.deepEqual(cookieOptionsFromEnv({ NODE_ENV: "production", SESSION_COOKIE_SAMESITE: "lax" }), { secure: true, sameSite: "lax", maxAgeSeconds: 2592000 });
  assert.throws(
    () => cookieOptionsFromEnv({ NODE_ENV: "production", SESSION_COOKIE_SAMESITE: "none", SESSION_COOKIE_SECURE: "false" }),
    /requires Secure/,
  );
});
