const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { registerPrivacySupportRoutes, createPrivacyAcceptanceGate, PRIVACY_POLICY_VERSION } = require("../privacy-support");

test("the server blocks protected routes only for accounts created with pending initial acceptance", () => {
  const gate = createPrivacyAcceptanceGate();
  const response = () => ({
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  });
  const denied = response();
  gate({ path: "/books", auth: { username: "reader", privacyAcceptedVersion: "", privacyRequired: true } }, denied, () => assert.fail("must not continue"));
  assert.equal(denied.statusCode, 428);
  assert.equal(denied.payload.code, "privacy_acceptance_required");

  for (const path of ["/auth/session", "/auth/logout", "/privacy/accept"]) {
    let continued = false;
    gate({ path, auth: { username: "reader", privacyAcceptedVersion: "", privacyRequired: true } }, response(), () => { continued = true; });
    assert.equal(continued, true, path);
  }
  let accepted = false;
  gate({ path: "/books", auth: { username: "reader", privacyAcceptedVersion: PRIVACY_POLICY_VERSION } }, response(), () => { accepted = true; });
  assert.equal(accepted, true);
  for (const version of ["", "2020-01-01"]) {
    let continued = false;
    gate({ path: "/books", auth: { username: "legacy", privacyAcceptedVersion: version } }, response(), () => { continued = true; });
    assert.equal(continued, true, "Existing accounts never require another acceptance");
  }
});

function memoryDb() {
  const users = new Map([["reader", { privacy_version: "", privacy_accepted_at: 0 }]]);
  const settings = new Map();
  return {
    users,
    settings,
    async query(query) {
      const text = typeof query === "string" ? query : query.text;
      const values = query.values || [];
      if (/CREATE TABLE|CREATE INDEX/i.test(text)) return [];
      if (/SELECT value FROM app_settings/i.test(text)) {
        const value = settings.get(values[0]);
        return value == null ? [] : [{ value }];
      }
      if (/INSERT INTO app_settings/i.test(text)) { settings.set(values[0], values[1]); return []; }
      if (/UPDATE users SET privacy_version/i.test(text)) {
        users.set(values[2], { privacy_version: values[0], privacy_accepted_at: values[1], privacy_required: 0 });
        return [];
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };
}

async function start() {
  const app = express();
  app.use(express.json());
  const db = memoryDb();
  const sql = (strings, ...values) => ({ text: strings.reduce((out, part, index) => out + (index ? "?" : "") + part, ""), values });
  const currentUser = (req) => req.headers["x-test-user"] || null;
  const requireAdmin = (req, res, next) => req.headers["x-test-admin"] === "yes" ? next() : res.status(403).json({ error: "admin" });
  registerPrivacySupportRoutes({ app, db, sql, currentUser, requireAdmin, clock: () => 1730246400000 });
  const server = await new Promise((resolve) => { const value = app.listen(0, () => resolve(value)); });
  return { db, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("a reader accepts the current privacy version with a server timestamp", async () => {
  const ctx = await start();
  try {
    const response = await fetch(`${ctx.base}/privacy/accept`, { method: "POST", headers: { "x-test-user": "reader" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { version: PRIVACY_POLICY_VERSION, acceptedAt: 1730246400000 });
    assert.deepEqual(ctx.db.users.get("reader"), { privacy_version: PRIVACY_POLICY_VERSION, privacy_accepted_at: 1730246400000, privacy_required: 0 });
  } finally { await ctx.close(); }
});

test("only an admin can publish a normalized voluntary Pix destination", async () => {
  const ctx = await start();
  try {
    const denied = await fetch(`${ctx.base}/admin/support`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ pixKey: "pix@example.com" }) });
    assert.equal(denied.status, 403);

    const saved = await fetch(`${ctx.base}/admin/support`, { method: "PUT", headers: { "content-type": "application/json", "x-test-admin": "yes" }, body: JSON.stringify({ pixKey: "  pix@example.com  ", recipient: " Projeto myBooks ", message: " Se gostar, apoie. " }) });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { pixKey: "pix@example.com", recipient: "Projeto myBooks", message: "Se gostar, apoie." });

    const published = await fetch(`${ctx.base}/support`);
    assert.deepEqual(await published.json(), { pixKey: "pix@example.com", recipient: "Projeto myBooks", message: "Se gostar, apoie." });
  } finally { await ctx.close(); }
});
