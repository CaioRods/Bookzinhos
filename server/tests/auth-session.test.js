const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSessionStore,
  buildSessionCookie,
  buildExpiredSessionCookie,
  readSessionCookie,
} = require("../auth-session");

function createMemoryDb() {
  const rows = [];
  return {
    rows,
    async query(query) {
      const text = query.text.replace(/\s+/g, " ").trim().toLowerCase();
      const values = query.values || [];
      if (text.startsWith("insert into auth_sessions")) {
        rows.push({
          id: values[0], token_hash: values[1], username: values[2],
          created_at: values[3], expires_at: values[4], last_used_at: values[5],
          revoked_at: null, user_agent: values[6], ip_address: values[7],
        });
        return [];
      }
      if (text.includes("from auth_sessions") && text.includes("token_hash = ?")) {
        const row = rows.find((item) => item.token_hash === values[0]);
        return row ? [{ ...row }] : [];
      }
      if (text.startsWith("update auth_sessions set last_used_at")) {
        const row = rows.find((item) => item.id === values[1]);
        if (row) row.last_used_at = values[0];
        return [];
      }
      if (text.startsWith("update auth_sessions set revoked_at") && text.includes("token_hash")) {
        const row = rows.find((item) => item.token_hash === values[1]);
        if (row && row.revoked_at == null) row.revoked_at = values[0];
        return [];
      }
      if (text.startsWith("update auth_sessions set revoked_at") && text.includes("username")) {
        rows.filter((item) => item.username === values[1] && item.revoked_at == null)
          .forEach((item) => { item.revoked_at = values[0]; });
        return [];
      }
      throw new Error(`Unexpected query: ${query.text}`);
    },
  };
}

test("stores only a hash and resolves a fresh opaque token", async () => {
  const db = createMemoryDb();
  const clock = () => 1_700_000_000_000;
  const randomBytes = () => Buffer.alloc(32, 7);
  const store = createSessionStore({ db, clock, randomBytes, ttlMs: 60_000 });

  const session = await store.create("Jude", { userAgent: "test", ipAddress: "127.0.0.1" });

  assert.equal(session.rawToken, "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc");
  assert.notEqual(db.rows[0].token_hash, session.rawToken);
  assert.equal(db.rows[0].token_hash.length, 64);
  assert.deepEqual(await store.resolve(session.rawToken), {
    id: session.id,
    username: "Jude",
    expiresAt: 1_700_000_060_000,
  });
});

test("expired and revoked tokens never resolve", async () => {
  let now = 10_000;
  const db = createMemoryDb();
  const store = createSessionStore({ db, clock: () => now, randomBytes: () => Buffer.alloc(32, 3), ttlMs: 100 });
  const first = await store.create("Cardan");
  await store.revoke(first.rawToken);
  assert.equal(await store.resolve(first.rawToken), null);

  const second = await store.create("Cardan");
  now = 10_101;
  assert.equal(await store.resolve(second.rawToken), null);
});

test("revokeAll invalidates every session owned by the account", async () => {
  let byte = 1;
  const db = createMemoryDb();
  const store = createSessionStore({ db, clock: () => 50_000, randomBytes: () => Buffer.alloc(32, byte++), ttlMs: 10_000 });
  const one = await store.create("Oak");
  const two = await store.create("Oak");
  const other = await store.create("Jude");

  await store.revokeAll("Oak");

  assert.equal(await store.resolve(one.rawToken), null);
  assert.equal(await store.resolve(two.rawToken), null);
  assert.equal((await store.resolve(other.rawToken)).username, "Jude");
});

test("cookie helpers keep the token away from JavaScript", () => {
  const cookie = buildSessionCookie("opaque-token", {
    secure: true,
    sameSite: "lax",
    maxAgeSeconds: 3600,
  });
  assert.match(cookie, /^mybooks_session=opaque-token;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=3600/);
  assert.equal(readSessionCookie({ headers: { cookie: "other=x; mybooks_session=opaque-token" } }), "opaque-token");
  assert.match(buildExpiredSessionCookie({ secure: true, sameSite: "lax" }), /Max-Age=0/);
});

test("SameSite=None is rejected without Secure", () => {
  assert.throws(
    () => buildSessionCookie("token", { secure: false, sameSite: "none", maxAgeSeconds: 1 }),
    /requires Secure/,
  );
});
