const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders, createCorsOptions } = require("../security");
const { createRateLimiter } = require("../rate-limit");

function response() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("security headers block foreign scripts, framing and sniffing", () => {
  const res = response();
  securityHeaders({ connectSources: ["https://api.example.com"], imageSources: ["https://cdn.example.com"] })({}, res, () => {});
  assert.match(res.headers["content-security-policy"], /default-src 'self'/);
  assert.match(res.headers["content-security-policy"], /script-src 'self'/);
  assert.doesNotMatch(res.headers["content-security-policy"], /unsafe-eval/);
  assert.match(res.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
});

test("CORS accepts only exact configured browser origins", () => {
  const options = createCorsOptions({ origins: ["https://bookzinhos.example"] });
  return new Promise((resolve, reject) => {
    options.origin("https://bookzinhos.example", (error, allowed) => {
      try { assert.equal(error, null); assert.equal(allowed, true); } catch (e) { reject(e); return; }
      options.origin("https://evil.bookzinhos.example", (hostileError) => {
        try { assert.match(hostileError.message, /CORS/); } catch (e) { reject(e); return; }
        options.origin(undefined, (serverError, serverAllowed) => {
          try { assert.equal(serverError, null); assert.equal(serverAllowed, true); resolve(); } catch (e) { reject(e); }
        });
      });
    });
  });
});

test("rate limiter returns 429 and Retry-After after the allowed count", () => {
  let now = 1000;
  const limit = createRateLimiter({ windowMs: 10_000, limit: 2, clock: () => now, key: (req) => `${req.ip}:${req.body.username.toLowerCase()}` });
  const req = { ip: "127.0.0.1", body: { username: "Jude" } };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = response(); let next = false;
    limit(req, res, () => { next = true; });
    assert.equal(next, true);
  }
  const blocked = response();
  limit(req, blocked, () => assert.fail("must be blocked"));
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["retry-after"], "10");
  now = 11_001;
  let continued = false;
  limit(req, response(), () => { continued = true; });
  assert.equal(continued, true);
});
