# Session Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-controlled identity with revocable server sessions, harden the HTTP surface, preserve authenticated product flows, and remove the “Autor em destaque” Home variant.

**Architecture:** Express resolves an opaque cookie before route handlers and exposes a session-backed user through the existing `currentUser(req)` seam, so feature routers keep a small integration surface while `x-user-id` loses all authority. Focused modules own sessions, security headers/CORS, and rate limiting; the React client treats local storage as display cache only and restores identity from `/auth/session`.

**Tech Stack:** Node.js 20+, Express 4, SQLite/libSQL/Turso, Node `crypto`, React 18, TypeScript, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-session-security-hardening-design.md`

## Global Constraints

- HTML, CSS, and shipped JavaScript remain inspectable; no security decision may depend on hiding browser code or disabling developer tools.
- Raw session tokens must exist only in an `HttpOnly` cookie and must never be stored in the database, local storage, logs, or JSON responses.
- `x-user-id`, body `username`, `actor`, and `owner` values must never grant identity, ownership, or administrator access.
- Existing public reading/catalog routes remain available without a session; private writes return `401` without one and admin routes return `403` for authenticated non-admin users.
- Existing plaintext passwords are upgraded to `scrypt` only after a successful login; startup must not create or restore a fixed password.
- Cookie policy is configurable for deployment: `Lax` for same-site hosting and `None; Secure` only when frontend/API must be cross-site.
- Do not add a runtime dependency for headers or limiting; use the existing Express/Node stack and keep storage adapters replaceable.
- Every task follows red-green-refactor and ends in a focused commit.

## Review Focus

- A valid cookie plus a forged `x-user-id` must always resolve to the cookie owner; Task 2 adds the integration test.
- Concurrent login/logout and an expired or revoked token must never resurrect a session; Task 1 tests all three states.
- Cross-origin credential requests must work only for an exact configured origin, including OPTIONS; Task 3 tests allowed, missing, and hostile origins.
- Cross-site production deployment must not silently lose cookies; Task 2 tests `SESSION_COOKIE_SAMESITE=none` requires `Secure` and Task 6 documents both supported layouts.
- A stale local profile must disappear when `/auth/session` returns `401`, without logging the user out merely because a public API request fails; Task 5 tests boot restoration and explicit private-session expiry.

---

### Task 1: Session persistence and token lifecycle

**Files:**
- Create: `server/auth-session.js`
- Create: `server/tests/auth-session.test.js`
- Modify: `server/db.js`

**Interfaces:**
- Consumes: existing `db`, tagged-template `sql`, and `users.username`.
- Produces: `createSessionStore({ db, sql, clock?, randomBytes? })` with `create(username, metadata)`, `resolve(rawToken)`, `touch(sessionId)`, `revoke(rawToken)`, and `revokeAll(username)`; cookie helpers `readSessionCookie(req)`, `buildSessionCookie(rawToken, options)`, and `buildExpiredSessionCookie(options)`.

- [ ] **Step 1: Write failing lifecycle tests**

  Add Node tests that assert the stored token differs from the raw token, a fresh token resolves to its username, expired/revoked tokens resolve to `null`, `revokeAll` invalidates all account sessions, and cookie strings contain `HttpOnly`, configured `SameSite`, `Path=/`, `Max-Age`, plus `Secure` in production.

- [ ] **Step 2: Run the focused tests and verify red**

  Run: `node --test server/tests/auth-session.test.js`

  Expected: FAIL because `auth-session.js` and `auth_sessions` do not exist.

- [ ] **Step 3: Add the additive session schema**

  In `server/db.js`, create `auth_sessions(id, token_hash UNIQUE, username, created_at, expires_at, last_used_at, revoked_at, user_agent, ip_address)` and indexes on `token_hash`, `username`, and `expires_at`. Add no destructive migration and no raw-token column.

- [ ] **Step 4: Implement the session store and cookie helpers**

  Generate 32 random bytes encoded as base64url, persist `sha256(rawToken)`, use a 30-day default TTL, reject malformed/expired/revoked records, update `last_used_at` at most once per hour, parse cookies without external packages, and validate that `SameSite=None` cannot be emitted without `Secure`.

- [ ] **Step 5: Run lifecycle tests**

  Run: `node --test server/tests/auth-session.test.js`

  Expected: PASS with no raw token found in the test database.

- [ ] **Step 6: Commit the persistence layer**

  ```bash
  git add server/auth-session.js server/tests/auth-session.test.js server/db.js
  git commit -m "feat: add secure server session storage"
  ```

### Task 2: Authentication, authorization, and password migration

**Files:**
- Create: `server/tests/auth-routes.test.js`
- Modify: `server/index.js`
- Modify: `server/db.js`

**Interfaces:**
- Consumes: `createSessionStore`, cookie helpers, existing `hashPassword`, `verifyPassword`, `publicUser`, and `isAdmin`.
- Produces: `req.auth = { username, sessionId } | null`, synchronous `currentUser(req)`, `requireUser(req,res,next)`, `requireAdmin(req,res,next)`, `POST /auth/logout`, and `GET /auth/session`.

- [ ] **Step 1: Write failing authentication integration tests**

  Cover login issuing an `HttpOnly` cookie, `/auth/session` returning only `publicUser`, forged `x-user-id` being ignored, no-cookie private requests returning `401`, non-admin cookies returning `403` on `/admin/overview`, admin cookies succeeding, logout revoking the token, expired sessions returning `401`, and Google/register flows issuing the same cookie contract.

- [ ] **Step 2: Add failing legacy-password tests**

  Insert a plaintext-password user, assert a wrong password does not migrate it, then assert a successful login rewrites the database value with the existing `scrypt:` format. Assert database boot no longer inserts `1234` or overwrites an existing admin password.

- [ ] **Step 3: Run the focused tests and verify red**

  Run: `node --test server/tests/auth-routes.test.js`

  Expected: FAIL because cookie-backed auth routes and middleware are absent.

- [ ] **Step 4: Resolve sessions before feature routes**

  After database startup and before route registration, read the cookie, resolve it through the store, assign `req.auth`, and make `currentUser(req)` return only `req.auth?.username`. Keep the header unread. Add `requireUser`; change `requireAdmin` to return `401` without a session and `403` when the session user lacks admin status.

- [ ] **Step 5: Issue and revoke sessions in auth routes**

  On password login, registration, and Google login, create a session and append `Set-Cookie`. Add `/auth/session` and `/auth/logout`; the latter revokes the presented token even if the response cookie is also cleared. Keep password/reset/code fields out of all returned objects.

- [ ] **Step 6: Remove identity fallbacks and protect mutations**

  Replace every `currentUser(req) || "Caio"`, `|| "anonymous"`, and `currentUser(req) || req.body.username` used for private actions. Attach `requireUser` to personal library, profile, reviews, reactions, reading progress, community mutations, chat, upload/presign, appearance mutations, theme submissions, and progression writes; retain optional identity only on public reads.

- [ ] **Step 7: Remove fixed startup passwords and migrate legacy passwords**

  Stop seeding Caio/Helo with `1234`, never assign `ADMIN_PASSWORD` to an existing account during boot, and immediately persist `hashPassword(password)` after a successful plaintext comparison.

- [ ] **Step 8: Run server tests**

  Run: `node --test server/tests/*.test.js`

  Expected: PASS, including existing feature-router tests updated to inject `req.auth` instead of production headers where required.

- [ ] **Step 9: Commit authenticated authorization**

  ```bash
  git add server/index.js server/db.js server/tests
  git commit -m "feat: enforce cookie-backed authorization"
  ```

### Task 3: HTTP security policy, strict CORS, and rate limits

**Files:**
- Create: `server/security.js`
- Create: `server/rate-limit.js`
- Create: `server/tests/security.test.js`
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `FRONTEND_ORIGINS`, `CSP_CONNECT_SOURCES`, `CSP_IMAGE_SOURCES`, `NODE_ENV`, Express request metadata, and normalized login identity.
- Produces: `securityHeaders(config)`, `corsOptions(config)`, and `createRateLimiter({ windowMs, limit, key, clock?, store? })` Express middleware.

- [ ] **Step 1: Write failing header and CORS tests**

  Assert CSP has `default-src 'self'`, `script-src 'self'` plus configured Google sources only, `object-src 'none'`, and `frame-ancestors 'none'`; also assert `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. Exercise OPTIONS and credential requests for an allowed exact origin, no browser origin, a lookalike subdomain, and a hostile origin.

- [ ] **Step 2: Write failing limiter tests**

  With an injected clock, assert login keys combine IP and normalized username, the allowed count succeeds, the next attempt returns `429` with integer `Retry-After`, a later window succeeds, and separate identities do not share a bucket.

- [ ] **Step 3: Run the focused tests and verify red**

  Run: `node --test server/tests/security.test.js`

  Expected: FAIL because security middleware does not exist.

- [ ] **Step 4: Implement headers and exact-origin CORS**

  Parse comma-separated allowlists, reject nonmatching browser origins without reflecting them, allow server-to-server/no-Origin requests, set `credentials: true`, and build CSP from configured storage/API sources without allowing arbitrary external script hosts or `unsafe-eval`.

- [ ] **Step 5: Implement bounded in-memory limiting**

  Store count/reset timestamps behind a small adapter interface, prune expired keys, cap the map to prevent memory growth, and apply tighter policies to login/code/register/reset plus separate policies to uploads and admin mutations.

- [ ] **Step 6: Reduce parser/error exposure**

  Lower the general JSON limit from 2 MB to 256 KB while retaining explicit multipart limits, reject unsupported upload MIME types at the upload boundary, and make production 500 responses return a stable generic message while logging a request id rather than credentials or bodies.

- [ ] **Step 7: Run all server tests**

  Run: `node --test server/tests/*.test.js`

  Expected: PASS, with `429`, CORS rejection, and headers proven.

- [ ] **Step 8: Commit HTTP hardening**

  ```bash
  git add server/security.js server/rate-limit.js server/tests/security.test.js server/index.js
  git commit -m "feat: harden http security boundaries"
  ```

### Task 4: Credentialed frontend API transport

**Files:**
- Modify: `frontend/src/app/lib/api.ts`
- Modify: `frontend/src/app/lib/community.ts`
- Modify: `frontend/src/app/lib/appearanceApi.ts`
- Modify: `frontend/src/app/lib/coverExtractor.ts`
- Create: `frontend/src/app/lib/api.test.ts`

**Interfaces:**
- Consumes: existing `API_BASE_URL` and public API function signatures.
- Produces: all API-origin requests use `credentials: "include"`; no request constructs `x-user-id`.

- [ ] **Step 1: Write failing transport tests**

  Mock `fetch` and assert JSON requests, multipart uploads, community calls, appearance calls, cover uploads, and presign requests all include credentials while never including `x-user-id`. Assert direct S3/storage upload URLs do not receive app cookies or app-only headers.

- [ ] **Step 2: Run the focused frontend tests and verify red**

  Run: `npm --prefix frontend run test:run -- src/app/lib/api.test.ts`

  Expected: FAIL because transport still sends the identity header and omits cookie credentials.

- [ ] **Step 3: Centralize authenticated fetch options**

  Add `credentials: "include"` to app API requests and remove all imports/usages of `getUsername()` whose only purpose is constructing `x-user-id`. Preserve upload `Content-Type` behavior and keep direct signed-storage requests credential-free.

- [ ] **Step 4: Run transport and existing frontend tests**

  Run: `npm --prefix frontend run test:run`

  Expected: PASS with no test-observed identity header.

- [ ] **Step 5: Commit the transport migration**

  ```bash
  git add frontend/src/app/lib/api.ts frontend/src/app/lib/community.ts frontend/src/app/lib/appearanceApi.ts frontend/src/app/lib/coverExtractor.ts frontend/src/app/lib/api.test.ts
  git commit -m "feat: send authenticated api cookies"
  ```

### Task 5: Session restoration and logout UX

**Files:**
- Modify: `frontend/src/app/lib/api.ts`
- Modify: `frontend/src/app/lib/session.ts`
- Modify: `frontend/src/app/lib/session.test.ts`
- Modify: `frontend/src/app/components/AuthWrapper.tsx`
- Modify: `frontend/src/app/components/RootLayout.tsx`
- Modify: `frontend/src/app/pages/Profile.tsx`
- Modify: `frontend/src/app/pages/Settings.tsx`
- Create: `frontend/src/app/components/AuthWrapper.test.tsx`

**Interfaces:**
- Consumes: `GET /auth/session`, `POST /auth/logout`, `saveSession`, `clearSession`, and existing `session-changed` notification.
- Produces: `getAuthenticatedSession()`, `logout()`, and boot-time server validation before private UI trusts cached identity.

- [ ] **Step 1: Write failing restoration tests**

  Seed a stale cached profile, mock `/auth/session` success and assert it refreshes display fields; mock `401` and assert cache/admin state clears and the anonymous/login UI appears; mock a transient `500` and assert the app shows a retry-safe state rather than inventing an authenticated user.

- [ ] **Step 2: Write failing logout tests**

  Assert account-menu, profile, and settings logout call `POST /auth/logout` before clearing cache/navigation, and that a failed network response still clears local presentation state without claiming server revocation succeeded.

- [ ] **Step 3: Run focused tests and verify red**

  Run: `npm --prefix frontend run test:run -- src/app/components/AuthWrapper.test.tsx src/app/lib/session.test.ts`

  Expected: FAIL because boot restoration and server logout are not implemented.

- [ ] **Step 4: Implement session API and cache semantics**

  Add the two API calls, update the session module comment to state local storage is presentation cache only, keep password/token absent, and make cached profile updates originate from successful auth/session/profile responses.

- [ ] **Step 5: Restore the session during app boot**

  Make `AuthWrapper` wait for `/auth/session` before rendering authenticated private state, clear stale cache only on an authentication response, and preserve guest/public navigation behavior.

- [ ] **Step 6: Replace synchronous logout call sites**

  Route account-menu, profile, and settings through the async logout helper, prevent double clicks during the request, then navigate to the login/home route after local state clears.

- [ ] **Step 7: Run frontend verification**

  Run: `npm --prefix frontend run test:run && npm --prefix frontend run typecheck && npm --prefix frontend run build`

  Expected: all commands PASS.

- [ ] **Step 8: Commit session UX**

  ```bash
  git add frontend/src/app/lib/api.ts frontend/src/app/lib/session.ts frontend/src/app/lib/session.test.ts frontend/src/app/components/AuthWrapper.tsx frontend/src/app/components/AuthWrapper.test.tsx frontend/src/app/components/RootLayout.tsx frontend/src/app/pages/Profile.tsx frontend/src/app/pages/Settings.tsx
  git commit -m "feat: restore and revoke browser sessions"
  ```

### Task 6: CSP-compatible bootstrap and deployment configuration

**Files:**
- Create: `frontend/public/theme-bootstrap.js`
- Modify: `frontend/index.html`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `frontend/src/app/security-config.test.ts`

**Interfaces:**
- Consumes: current inline theme bootstrap behavior and server environment parser.
- Produces: a same-origin external bootstrap script and documented production variables `FRONTEND_ORIGINS`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `SESSION_TTL_DAYS`, `CSP_CONNECT_SOURCES`, and `CSP_IMAGE_SOURCES`.

- [ ] **Step 1: Write a failing static security test**

  Read `frontend/index.html`, assert it contains no inline executable script, assert `/theme-bootstrap.js` is loaded before the module entry, and assert the external file preserves the existing local theme/appearance initialization without reading credentials.

- [ ] **Step 2: Run the focused test and verify red**

  Run: `npm --prefix frontend run test:run -- src/app/security-config.test.ts`

  Expected: FAIL because the bootstrap is inline.

- [ ] **Step 3: Extract the bootstrap script**

  Move the existing inline code unchanged in behavior to `frontend/public/theme-bootstrap.js`, load it from the same origin, and leave no `unsafe-inline` requirement in `script-src`.

- [ ] **Step 4: Document safe environment profiles**

  Add exact local, same-site production, and cross-site production examples. State that cross-site requires HTTPS plus `SESSION_COOKIE_SAMESITE=none`, that wildcard CORS is invalid with cookies, and that storage/CDN hosts belong in CSP image/connect lists rather than script lists.

- [ ] **Step 5: Run build and static tests**

  Run: `npm --prefix frontend run test:run && npm --prefix frontend run build`

  Expected: PASS and generated HTML references `/theme-bootstrap.js`.

- [ ] **Step 6: Commit deployment compatibility**

  ```bash
  git add frontend/public/theme-bootstrap.js frontend/index.html frontend/src/app/security-config.test.ts .env.example README.md
  git commit -m "docs: configure secure browser deployment"
  ```

### Task 7: Remove “Autor em destaque” and perform end-to-end regression proof

**Files:**
- Modify: `frontend/src/app/pages/Home.tsx`
- Modify: `frontend/src/app/pages/Home.test.tsx`
- Modify: `docs/superpowers/plans/2026-10-29-session-security-hardening.md`

**Interfaces:**
- Consumes: current editorial book/series selection and all prior security work.
- Produces: Home editorial copy with only book or series variants; completed verification checklist.

- [ ] **Step 1: Write a failing Home regression test**

  Render the editorial section with multiple books by one author and assert neither `AUTOR EM DESTAQUE`, author-collection copy, nor author-query navigation is produced; retain assertions for `LIVRO EM DESTAQUE` and `SÉRIE EM DESTAQUE`.

- [ ] **Step 2: Run the focused test and verify red**

  Run: `npm --prefix frontend run test:run -- src/app/pages/Home.test.tsx`

  Expected: FAIL because the author variant still exists.

- [ ] **Step 3: Remove the author editorial branch**

  Delete the `multiple` copy and author-search action. Select one featured book unless the explicit trilogy condition applies, keeping the existing book and series visual design.

- [ ] **Step 4: Run full automated verification**

  Run: `node --test server/tests/*.test.js`

  Run: `npm --prefix frontend run test:run`

  Run: `npm --prefix frontend run typecheck`

  Run: `npm --prefix frontend run build`

  Expected: every command exits 0.

- [ ] **Step 5: Run adversarial smoke checks**

  Start the API with a temporary database and verify by HTTP requests that a forged `x-user-id: Caio` cannot access `/admin/overview`, a normal authenticated cookie receives `403`, logout makes the same cookie receive `401`, an unauthorized Origin is rejected, and responses contain CSP plus `nosniff`. Verify the browser can log in, open chat, save a book, upload through presign, and log out.

- [ ] **Step 6: Record verification evidence in this plan**

  Append a dated `## Verification Record` containing each command, exit status, test count, build result, and smoke-check outcomes. Do not mark a check complete without observed output.

- [ ] **Step 7: Commit the final product change**

  ```bash
  git add frontend/src/app/pages/Home.tsx frontend/src/app/pages/Home.test.tsx docs/superpowers/plans/2026-10-29-session-security-hardening.md
  git commit -m "fix: remove featured author banner"
  ```

- [ ] **Step 8: Review and push**

  Inspect `git diff origin/main...HEAD`, confirm no secrets or unrelated files are included, then run `git push origin main` and verify the remote reports the new `main` tip.
