# Profile Progression and Character Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver randomized Library highlights, precise avatar cropping, reusable saga-aware characters, corrected chat return navigation, account actions, themed public profiles, badges, long-term XP progression, active reading validation, community theme review, and audited admin controls.

**Architecture:** Add pure rule modules first, then persistence and server services, and finally UI consumers. XP is an idempotent server-side ledger with a materialized balance; character identity uses a many-to-many book junction; activity and reading use capped heartbeats. Existing SQLite/Turso initialization performs additive, repeatable migrations and retains every legacy column.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Express, Node.js, SQLite/Turso libSQL, CSS, existing S3/Supabase storage adapters.

**Spec:** `docs/superpowers/specs/2026-10-29-profile-progression-and-character-catalog-design.md`

## Global Constraints

- Preserve all existing users, books, sagas, characters, themes, conversations, readings, and reviews.
- The server is authoritative for XP, levels, badges, active time, and reading completion.
- Every repeatable reward needs an idempotency key and a per-person or time-window limit.
- SQLite and Turso must use the same schema and queries.
- No manual Supabase SQL is required; Supabase remains optional file storage.
- Keep keyboard access, screen-reader labels, reduced-motion behavior, and responsive layouts.
- Do not remove legacy columns in this delivery.

## Review Focus

- A catalog with zero, one, or two covered books must render without duplicate banner entries; Task 1 tests this.
- Portrait, landscape, transparent, and extremely narrow avatar images must never expose an empty crop area; Task 2 tests crop bounds.
- Re-running migrations after a partial deployment must not duplicate character links, pioneer order, XP balances, or badges; Tasks 3 and 4 test idempotency.
- Heartbeats sent after a suspended tab or with a forged large duration must be capped; Task 5 tests visibility, idle, and server caps.
- Concurrent duplicate reward requests must create one ledger row and one balance increment; Task 4 tests the unique key and transaction-safe recovery.

---

### Task 1: Stable random Library banner and chat return origin

**Files:**
- Create: `frontend/src/app/lib/randomBooks.ts`
- Create: `frontend/src/app/lib/randomBooks.test.ts`
- Create: `frontend/src/app/lib/chatNavigation.ts`
- Create: `frontend/src/app/lib/chatNavigation.test.ts`
- Modify: `frontend/src/app/components/LibraryBanner.tsx`
- Modify: `frontend/src/app/pages/Chat.tsx`

**Interfaces:**
- Produces: `pickDistinctBooks<T extends { id: string }>(items: T[], count: number, random?: () => number): T[]`.
- Produces: `rememberChatOrigin(path: string): void`, `chatOrigin(): string`, and `chatConversationTarget(username: string): { pathname: string; state: { fromChatSwitch: true } }`.

- [ ] **Step 1: Write failing pure-function tests**

```ts
expect(pickDistinctBooks([{id:"a"},{id:"b"},{id:"c"}], 3, () => 0)).toHaveLength(3);
expect(new Set(pickDistinctBooks([{id:"a"},{id:"b"}], 3).map(x => x.id)).size).toBe(2);
rememberChatOrigin("/community");
rememberChatOrigin("/chat/maria");
expect(chatOrigin()).toBe("/community");
```

- [ ] **Step 2: Run red tests**

Run: `npm run test:run --prefix frontend -- randomBooks.test.ts chatNavigation.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement deterministic injection and safe same-origin storage**

Use Fisher–Yates on a copied array. Store only paths beginning with `/` and not `/chat/`; default to `/social`. In `LibraryBanner`, call the picker inside `useState(() => ...)`, and remount naturally when the Library route is revisited. Conversation links and parameter changes use `replace` while the back button navigates to `chatOrigin()`.

- [ ] **Step 4: Run green tests and component suite**

Run: `npm run test:run --prefix frontend -- randomBooks.test.ts chatNavigation.test.ts`

Expected: PASS with distinct selections and preserved origin.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lib/randomBooks* frontend/src/app/lib/chatNavigation* frontend/src/app/components/LibraryBanner.tsx frontend/src/app/pages/Chat.tsx
git commit -m "fix: randomize library banner and preserve chat origin"
```

### Task 2: Accurate interactive avatar cropper

**Files:**
- Create: `frontend/src/app/lib/avatarCrop.ts`
- Create: `frontend/src/app/lib/avatarCrop.test.ts`
- Modify: `frontend/src/app/components/AvatarCropper.tsx`
- Modify: `frontend/src/styles/customization.css`

**Interfaces:**
- Produces: `fitAvatar(source: Size, viewport: Size, zoom: number): Transform`.
- Produces: `clampAvatarTransform(transform: Transform, source: Size, viewport: Size): Transform`.
- Produces: `avatarSourceRect(transform: Transform, source: Size, viewport: Size): DOMRectLike`.
- Preserves: `cropAvatar(source, x, y, zoom): Promise<Blob>` as the caller-facing export.

- [ ] **Step 1: Write failing geometry tests**

```ts
expect(fitAvatar({width:1600,height:900},{width:240,height:240},1).scale).toBeCloseTo(240/900);
expect(clampAvatarTransform({x:999,y:-999,scale:1},{width:900,height:1600},{width:240,height:240})).toMatchObject({x: expect.any(Number), y: expect.any(Number)});
expect(avatarSourceRect(transform, source, viewport).width).toBeGreaterThan(0);
```

Include portrait, landscape, transparent PNG dimensions, minimum zoom, and maximum pan cases.

- [ ] **Step 2: Run red geometry tests**

Run: `npm run test:run --prefix frontend -- avatarCrop.test.ts`

Expected: FAIL because geometry functions are absent.

- [ ] **Step 3: Implement shared preview/export geometry**

Render the source image behind a four-segment translucent mask with a circular opening. Add pointer drag, two-pointer pinch, wheel zoom, sliders, arrow keys, `+`, `-`, and “Centralizar”. Clamp after every input. Export the exact source rectangle computed by `avatarSourceRect` to 720 × 720 WebP.

- [ ] **Step 4: Verify crop behavior**

Run: `npm run test:run --prefix frontend -- avatarCrop.test.ts && npm run typecheck --prefix frontend`

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lib/avatarCrop* frontend/src/app/components/AvatarCropper.tsx frontend/src/styles/customization.css
git commit -m "feat: add precise avatar crop controls"
```

### Task 3: Many-to-many saga-aware character catalog

**Files:**
- Modify: `server/characters.js`
- Modify: `server/tests/characters.test.js`
- Modify: `frontend/src/app/components/CharacterAdmin.tsx`
- Modify: `frontend/src/app/components/CharacterPicker.tsx`
- Modify: `frontend/src/app/lib/types.ts`
- Modify: `frontend/src/app/lib/api.ts`

**Interfaces:**
- `GET /characters` returns `{ characters, groups }`, where each character has `bookIds: string[]` and groups contain `seriesId`, `seriesName`, ordered books, and deduplicated character IDs.
- `POST /characters` accepts multipart `name`, optional `characterId`, repeated/JSON `bookIds`, and optional `image`.
- `PUT /characters/:id/books` accepts `{ bookIds: string[] }` and replaces links atomically.

- [ ] **Step 1: Extend server tests before schema changes**

```js
assert.deepEqual(result.characters[0].bookIds.sort(), ["cruel", "queen"]);
assert.equal(result.groups[0].characters.filter(id => id === "cardan").length, 1);
```

Test legacy `book_id` backfill twice and reject missing book IDs.

- [ ] **Step 2: Run red server test**

Run: `npm test --prefix server -- characters.test.js`

Expected: FAIL because `character_books` and grouped output do not exist.

- [ ] **Step 3: Add additive schema, backfill, routes, and grouping**

Create `character_books(character_id, book_id, created_at, PRIMARY KEY(character_id,book_id))`, insert legacy links with `INSERT OR IGNORE`, validate every requested book, and sort saga volumes by `series_order`. Keep `character_avatars.book_id` readable for compatibility.

- [ ] **Step 4: Update admin and picker UI**

Allow multi-book selection; when any selected book belongs to a saga, show existing saga characters first with “Usar personagem existente”. Render picker sections Saga → Volume → unique character and independent books separately.

- [ ] **Step 5: Run server and frontend verification**

Run: `npm test --prefix server -- characters.test.js && npm run typecheck --prefix frontend`

Expected: PASS with one Cardan identity across multiple volumes.

- [ ] **Step 6: Commit**

```bash
git add server/characters.js server/tests/characters.test.js frontend/src/app/components/CharacterAdmin.tsx frontend/src/app/components/CharacterPicker.tsx frontend/src/app/lib/types.ts frontend/src/app/lib/api.ts
git commit -m "feat: reuse characters across saga volumes"
```

### Task 4: Progression rules, schema, and idempotent ledger

**Files:**
- Create: `server/progression-rules.js`
- Create: `server/progression-service.js`
- Create: `server/tests/progression-rules.test.js`
- Create: `server/tests/progression-service.test.js`
- Modify: `server/db.js`

**Interfaces:**
- `xpForLevel(level: number): number`, `levelForXp(xp: number): number`, `readerTitle(level: number): string`.
- `awardXp({ username, type, baseAmount, actor, entityType, entityId, idempotencyKey, metadata }): Promise<ProgressionResult>`.
- `adjustXpByAdmin({ admin, username, amount, reason }): Promise<ProgressionResult>`.
- `setLevelByAdmin({ admin, username, level, reason }): Promise<ProgressionResult>`.

- [ ] **Step 1: Write curve and ledger tests**

```js
assert.equal(levelForXp(xpForLevel(30)), 30);
assert.equal(readerTitle(100), "Lenda literária");
const first = await awardXp(event);
const duplicate = await awardXp(event);
assert.equal(first.totalXp, duplicate.totalXp);
assert.equal(await countEvents(event.idempotencyKey), 1);
```

Also assert monotonic requirements for levels 1–100, invalid level rejection, 2× expiry, self-action exclusion, and concurrent duplicate calls.

- [ ] **Step 2: Run red progression tests**

Run: `npm test --prefix server -- progression-rules.test.js progression-service.test.js`

Expected: FAIL because the progression modules and tables are absent.

- [ ] **Step 3: Add schema and pure rules**

Add `user_progression`, `xp_events`, `xp_boosts`, and `admin_audit_log`; add unique index on `xp_events.idempotency_key`. Initialize existing users at XP 0/level 1 using `INSERT OR IGNORE`. Implement the three approved curve segments rounded to 25.

- [ ] **Step 4: Implement award and admin operations**

Insert the event first, recover the existing result on a unique-key conflict, calculate active boosts server-side, update the materialized balance, derive old/new level, and write admin reasons to both ledger metadata and audit log.

- [ ] **Step 5: Run green progression suite**

Run: `npm test --prefix server -- progression-rules.test.js progression-service.test.js`

Expected: PASS including duplicate and boost cases.

- [ ] **Step 6: Commit**

```bash
git add server/db.js server/progression-rules.js server/progression-service.js server/tests/progression-*.test.js
git commit -m "feat: add audited long-term xp progression"
```

### Task 5: Active-time and verified reading tracking

**Files:**
- Create: `server/activity.js`
- Create: `server/tests/activity.test.js`
- Create: `frontend/src/app/lib/activityTracker.ts`
- Create: `frontend/src/app/lib/activityTracker.test.ts`
- Modify: `server/db.js`
- Modify: `server/index.js`
- Modify: `frontend/src/app/components/RootLayout.tsx`
- Modify: `frontend/src/app/pages/BookReader.tsx`

**Interfaces:**
- `POST /activity/heartbeat` accepts `{ scope: "app" | "reader", bookId?: string, page?: number, clientElapsedSeconds: number }` and returns capped totals.
- `readingEligibility(username, bookId)` returns `{ activeSeconds, visitedPages, totalPages, eligible, rewarded }`.
- `createActivityTracker({ idleMs: 600000, heartbeatMs: 30000, send }): ActivityTracker`.

- [ ] **Step 1: Write client idle and server-cap tests**

```ts
clock.advanceBy(600001);
expect(send).not.toHaveBeenCalledAfter(lastInteraction);
tracker.interact();
clock.advanceBy(30000);
expect(send).toHaveBeenCalledTimes(previous + 1);
```

```js
assert.equal((await recordHeartbeat({clientElapsedSeconds:9999})).creditedSeconds, 45);
assert.equal((await eligibility("ana","book")).eligible, false);
```

- [ ] **Step 2: Run red activity suites**

Run: `npm run test:run --prefix frontend -- activityTracker.test.ts && npm test --prefix server -- activity.test.js`

Expected: FAIL because tracker and endpoint are absent.

- [ ] **Step 3: Add capped persistence and eligibility**

Create `user_activity_daily`, `reading_sessions`, and `reading_page_visits`. Cap one heartbeat at 45 seconds, upsert distinct page visits, and require 2,400 active seconds plus every known page before awarding `reading_complete:<username>:<bookId>` once.

- [ ] **Step 4: Connect global and reader trackers**

Start a global tracker in `RootLayout`; in `BookReader`, attach reader scope and current page. Pause when hidden or after ten idle minutes; resume only after a real interaction.

- [ ] **Step 5: Run green activity suites**

Run: `npm run test:run --prefix frontend -- activityTracker.test.ts && npm test --prefix server -- activity.test.js`

Expected: PASS for idle, forged duration, incomplete pages, valid completion, and repeat completion.

- [ ] **Step 6: Commit**

```bash
git add server/activity.js server/tests/activity.test.js server/db.js server/index.js frontend/src/app/lib/activityTracker* frontend/src/app/components/RootLayout.tsx frontend/src/app/pages/BookReader.tsx
git commit -m "feat: verify active reading time and page coverage"
```

### Task 6: Reward hooks and badge evaluation

**Files:**
- Create: `server/badges.js`
- Create: `server/tests/badges.test.js`
- Create: `server/progression-events.js`
- Create: `server/tests/progression-events.test.js`
- Modify: `server/db.js`
- Modify: `server/index.js`
- Modify: `server/community.js`

**Interfaces:**
- `evaluateBadges(username): Promise<UserBadge[]>`.
- `rewardForAction(action: RewardAction): Promise<ProgressionResult | null>`.
- `GET /progression/:username` returns XP, level, title, next requirement, boost, stats, and badges.

- [ ] **Step 1: Write reward-limit and badge tests**

Test first review only, max five comments/day, unique actor/book share, no self-reward, ten-message chat block, pioneer 3/10/100, read/publish milestones, and permanent earned badges.

- [ ] **Step 2: Run red server tests**

Run: `npm test --prefix server -- badges.test.js progression-events.test.js`

Expected: FAIL because reward dispatch and badge tables are absent.

- [ ] **Step 3: Add badge and action persistence**

Create `badge_definitions`, `user_badges`, and stable `users.registration_order`. Seed immutable badge codes with `INSERT OR IGNORE`; backfill registration order once. Route every approved action through `rewardForAction`, whose idempotency keys include actor, entity, action, and daily window where required.

- [ ] **Step 4: Attach existing actions**

Award from book publication, save, like, share, reading completion, first rating, valid comment, and substantial chat blocks. Keep the primary action successful if reward creation fails, but log the reward error with action context.

- [ ] **Step 5: Run green server suite**

Run: `npm test --prefix server -- badges.test.js progression-events.test.js`

Expected: PASS with exact limits and non-removable badges.

- [ ] **Step 6: Commit**

```bash
git add server/badges.js server/progression-events.js server/tests/badges.test.js server/tests/progression-events.test.js server/db.js server/index.js server/community.js
git commit -m "feat: award guarded xp events and reader badges"
```

### Task 7: Account popover and themed public profile

**Files:**
- Create: `frontend/src/app/components/AccountMenu.tsx`
- Create: `frontend/src/app/components/AccountMenu.test.tsx`
- Create: `frontend/src/app/pages/UserProfile.test.tsx`
- Create: `frontend/src/app/components/ProgressionCard.tsx`
- Create: `frontend/src/app/components/BadgeGallery.tsx`
- Modify: `frontend/src/app/components/RootLayout.tsx`
- Modify: `frontend/src/app/pages/UserProfile.tsx`
- Modify: `frontend/src/app/pages/Profile.tsx`
- Modify: `frontend/src/app/lib/api.ts`
- Modify: `frontend/src/app/lib/types.ts`
- Modify: `frontend/src/styles/identity.css`

**Interfaces:**
- `AccountMenu` receives `{ avatar, username, admin, progression, onLogout }`.
- `ProgressionSummary` contains `{ totalXp, level, title, currentLevelXp, nextLevelXp, boostUntil }`.
- Public profile combines existing profile/theme API data with `GET /progression/:username`.

- [ ] **Step 1: Write failing menu/profile component tests**

Assert four regular actions, conditional Admin, logout callback, themed CSS variables, level/title text, badge accessible names, and fallback theme.

- [ ] **Step 2: Run red component tests**

Run: `npm run test:run --prefix frontend -- AccountMenu.test.tsx UserProfile.test.tsx`

Expected: FAIL because the account menu and progression UI are absent.

- [ ] **Step 3: Build account popover and simplify sidebar**

Replace desktop and mobile header avatar links with `AccountMenu`; remove Admin and Configurações from `navItems`. Keep mobile Perfil dock navigation. Use existing logout/session functions and close on Escape, outside click, or navigation.

- [ ] **Step 4: Redesign profile hierarchy**

Apply owner theme variables to a profile-scoped container; render protected banner copy, overlapping avatar, socials, progression, statistics, badge gallery, activity, public books, and public themes. Use one prominent banner treatment and restrained supporting cards.

- [ ] **Step 5: Run green component tests and typecheck**

Run: `npm run test:run --prefix frontend -- AccountMenu.test.tsx UserProfile.test.tsx && npm run typecheck --prefix frontend`

Expected: PASS with keyboard-accessible menu and profile fallbacks.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/components/AccountMenu* frontend/src/app/components/ProgressionCard.tsx frontend/src/app/components/BadgeGallery.tsx frontend/src/app/components/RootLayout.tsx frontend/src/app/pages/UserProfile.tsx frontend/src/app/pages/Profile.tsx frontend/src/app/lib/api.ts frontend/src/app/lib/types.ts frontend/src/styles/identity.css
git commit -m "feat: showcase themed reader profiles and account actions"
```

### Task 8: Community theme submissions and 24-hour boost

**Files:**
- Modify: `server/appearance.js`
- Modify: `server/tests/appearance.test.js`
- Modify: `frontend/src/app/components/ThemeEditor.tsx`
- Create: `frontend/src/app/components/ThemeReviewQueue.tsx`
- Modify: `frontend/src/app/pages/Admin.tsx`
- Modify: `frontend/src/app/lib/appearanceApi.ts`

**Interfaces:**
- `POST /appearance/themes/:id/submissions` creates or updates a pending submission.
- `GET /admin/theme-submissions?status=pending` lists previews.
- `POST /admin/theme-submissions/:id/decision` accepts `{ decision: "approved" | "rejected" | "changes_requested", reason: string }`.

- [ ] **Step 1: Write failing moderation tests**

Test owner-only submission, duplicate pending update, admin-only listing/decision, approval public visibility, new-version re-review, 250 XP once, and exact 24-hour boost end.

- [ ] **Step 2: Run red appearance tests**

Run: `npm test --prefix server -- appearance.test.js`

Expected: FAIL because submission routes and states are absent.

- [ ] **Step 3: Add moderation schema and routes**

Create `theme_submissions` with theme version snapshot, status, reviewer, reason, and timestamps. Approval changes theme owner/scope safely, calls `awardXp` with submission ID, and creates one `xp_boosts` row ending at approval time plus 86,400,000 ms.

- [ ] **Step 4: Add creator request and admin queue UI**

Theme editor shows “Solicitar publicação para todos” and current review status. Admin gets preview tiles for profile/sidebar plus approve, request changes, and reject actions with a required reason for non-approval.

- [ ] **Step 5: Run green moderation tests and typecheck**

Run: `npm test --prefix server -- appearance.test.js && npm run typecheck --prefix frontend`

Expected: PASS with one reward and boost per approved version.

- [ ] **Step 6: Commit**

```bash
git add server/appearance.js server/tests/appearance.test.js frontend/src/app/components/ThemeEditor.tsx frontend/src/app/components/ThemeReviewQueue.tsx frontend/src/app/pages/Admin.tsx frontend/src/app/lib/appearanceApi.ts
git commit -m "feat: moderate and reward community themes"
```

### Task 9: Admin progression controls and level-up presentation

**Files:**
- Create: `server/progression-routes.js`
- Create: `server/tests/progression-routes.test.js`
- Create: `frontend/src/app/components/LevelUpOverlay.tsx`
- Create: `frontend/src/app/lib/progressionEvents.ts`
- Create: `frontend/src/app/lib/progressionEvents.test.ts`
- Modify: `frontend/src/app/pages/Admin.tsx`
- Modify: `frontend/src/app/components/RootLayout.tsx`
- Modify: `frontend/src/app/lib/sounds.ts`
- Modify: `frontend/src/styles/experience.css`

**Interfaces:**
- `POST /admin/users/:username/xp` accepts `{ amount, reason }`.
- `PUT /admin/users/:username/level` accepts `{ level, reason }`.
- `GET /admin/users/:username/xp-events` returns paginated ledger/audit rows.
- `dispatchProgressionResult(result)` emits `mybooks:progression`; `LevelUpOverlay` consumes it globally.

- [ ] **Step 1: Write failing permission and event tests**

Assert non-admin 403, mandatory reason, level range 1–100, negative XP floor at zero, audit row, ordinary level toast, decade overlay, one presentation per event ID, sound disabled behavior, and reduced motion class.

- [ ] **Step 2: Run red admin and frontend tests**

Run: `npm test --prefix server -- progression-routes.test.js && npm run test:run --prefix frontend -- progressionEvents.test.ts`

Expected: FAIL because routes and event controller are absent.

- [ ] **Step 3: Register routes and admin UI**

Use progression service exclusively; never update balances directly. Add level, XP, active boost, reason input, adjust/set actions, and paginated history to the existing user admin tab.

- [ ] **Step 4: Add global level-up experience**

Dispatch progression results from API mutations. Render a compact toast for normal levels and a focused celebratory overlay at multiples of ten, showing old/new level and new title. Add distinct short sounds through existing sound preferences and reduced-motion CSS.

- [ ] **Step 5: Run green admin and frontend tests**

Run: `npm test --prefix server -- progression-routes.test.js && npm run test:run --prefix frontend -- progressionEvents.test.ts`

Expected: PASS for permissions, audit, deduplication, and presentation selection.

- [ ] **Step 6: Commit**

```bash
git add server/progression-routes.js server/tests/progression-routes.test.js frontend/src/app/components/LevelUpOverlay.tsx frontend/src/app/lib/progressionEvents* frontend/src/app/pages/Admin.tsx frontend/src/app/components/RootLayout.tsx frontend/src/app/lib/sounds.ts frontend/src/styles/experience.css
git commit -m "feat: add admin progression tools and level celebrations"
```

### Task 10: Migration, responsive review, and complete verification

**Files:**
- Create: `server/tests/migration.test.js`
- Modify: affected CSS and components only where verification exposes a defect.
- Create: `docs/verification/2026-10-29-profile-progression.md`

**Interfaces:**
- Consumes all interfaces from Tasks 1–9.
- Produces a repeatable deployment verification record.

- [ ] **Step 1: Write migration replay test**

Build a legacy fixture containing users, one legacy character/book link, private/system themes, reading progress, and reviews. Run initialization twice and assert exact row counts for progression, character links, pioneer ordering, boosts, badges, and XP events.

- [ ] **Step 2: Run migration test before final fixes**

Run: `npm test --prefix server -- migration.test.js`

Expected: PASS only when all additive migrations are repeatable; fix the owning migration if any assertion fails.

- [ ] **Step 3: Run full automated verification**

```bash
npm test --prefix server
npm run test:run --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
git diff --check
```

Expected: zero failed tests, zero TypeScript errors, successful Vite build, and no whitespace errors.

- [ ] **Step 4: Perform responsive interaction checks**

At 390 × 844 and 1440 × 900 verify: avatar drag/pinch/wheel, account menu keyboard flow, banner remount shuffle, chat switch/back, themed profile contrast, badge overflow, theme review dialogs, admin XP controls, normal level toast, decade overlay, and reduced motion.

- [ ] **Step 5: Record evidence**

Write exact commands, pass counts, viewport checks, migration replay result, and any environment limitation in `docs/verification/2026-10-29-profile-progression.md`.

- [ ] **Step 6: Commit final verification**

```bash
git add server/tests/migration.test.js docs/verification/2026-10-29-profile-progression.md frontend/src server
git commit -m "test: verify profile progression delivery"
```
