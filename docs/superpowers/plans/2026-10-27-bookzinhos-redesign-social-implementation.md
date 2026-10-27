# Bookzinhos Redesign, Sagas and Social Community Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved immersive app shell, editorial book experience, ordered sagas, book galleries, and a full multimedia social community without losing existing data.

**Architecture:** Extend the existing Express/SQLite-compatible API with idempotent tables and focused routers, then consume typed APIs from focused React components. Social gallery content is one model filtered by `bookId`; palette generation is a pure utility that feeds CSS variables at the shell boundary.

**Tech Stack:** React 18, TypeScript 5.9, React Router 7, Vite 6, Tailwind CSS 4, Express 4, `@databases/sqlite`/libSQL, Multer, Node test runner, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-27-bookzinhos-redesign-social-design.md`

## Global Constraints

- Preserve all existing books, users, reviews, posts, progress, themes, and endpoint compatibility during migration.
- A book belongs to at most one saga in this release.
- One user has at most one active reaction per target and may replace or remove it.
- Gallery data is social post media filtered by `bookId`; do not create a second gallery store.
- All permission checks and upload limits run on the server as well as the client.
- Theme colors must meet WCAG AA contrast; invalid images fall back to the existing plum theme.
- Keyboard, touch, reduced-motion, and mobile layouts retain every essential action.
- Use test-first red/green/refactor cycles and commit after each task.

## Review Focus

- Very light, dark, transparent, or unreadable theme images must produce accessible tokens or the plum fallback; Task 6 pins this behavior.
- Concurrent saga reorder requests must leave contiguous unique positions; Task 3 tests transaction normalization.
- A failed image in a multi-image post must roll back the post and media rows; Task 4 tests atomic creation.
- Deleted source posts must leave repost shells intact and marked unavailable; Task 4 tests this join behavior.
- Deep comment trees must preserve parent relationships while the UI caps visual indentation; Tasks 4 and 9 test API and rendering behavior.

---

## File Map

- `server/db.js`: idempotent schema and legacy post migration only.
- `server/series.js`: saga validation, transactions, mapping, and `/series` router.
- `server/social.js`: social validation, decoration, permissions, and `/social` router.
- `server/index.js`: mount routers and extend global search; avoid adding more feature logic here.
- `server/tests/series.test.js`, `server/tests/social.test.js`: API integration tests against temporary SQLite databases.
- `frontend/src/app/lib/themePalette.ts`: pure palette and contrast functions.
- `frontend/src/app/lib/seriesApi.ts`, `socialApi.ts`: typed network boundary.
- `frontend/src/app/lib/types.ts`: shared `Series`, `SocialPost`, media, comment, and reaction types.
- `frontend/src/app/components/AppBackdrop.tsx`: blurred continuation outside the window.
- `frontend/src/app/components/SeriesEditor.tsx`: create, search, link, and reorder series.
- `frontend/src/app/components/BookHero.tsx`: editorial book banner.
- `frontend/src/app/components/BookSeriesStrip.tsx`: ordered volumes on book details.
- `frontend/src/app/components/PostComposer.tsx`, `SocialPostCard.tsx`, `ReactionPicker.tsx`, `CommentThread.tsx`: focused social UI.
- `frontend/src/app/components/BookGallery.tsx`, `MediaLightbox.tsx`: book-filtered visual posts.
- `frontend/src/app/pages/SeriesDetails.tsx`, `Social.tsx`, `PostDetails.tsx`, `BookDetails.tsx`: route composition.
- `frontend/src/styles/identity.css`, `references.css`, `refinements.css`: shell, editorial, social, and responsive styling.

### Task 1: Add frontend test infrastructure and shared domain contracts

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/lib/types.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/app/lib/types.test.ts`

**Interfaces:**
- Produces: `ReactionKind`, `Series`, `SeriesBook`, `SocialMedia`, `SocialComment`, `SocialPost`, and `Repost` types used by all later frontend tasks.

- [ ] **Step 1: Add the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeReaction } from "./types";

describe("normalizeReaction", () => {
  it.each(["heart", "panda", "sad", "moved"])("accepts %s", value => {
    expect(normalizeReaction(value)).toBe(value);
  });
  it("rejects unknown values", () => expect(normalizeReaction("fire")).toBeNull());
});
```

- [ ] **Step 2: Install and run the test to prove RED**

Run: `cd frontend && npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event && npm test -- --run src/app/lib/types.test.ts`

Expected: FAIL because `npm test` and `normalizeReaction` do not exist.

- [ ] **Step 3: Add the test script, setup, and exact contracts**

```json
"test": "vitest",
"test:run": "vitest run"
```

```ts
export const REACTIONS = ["heart", "panda", "sad", "moved"] as const;
export type ReactionKind = typeof REACTIONS[number];
export const normalizeReaction = (value: unknown): ReactionKind | null =>
  REACTIONS.includes(value as ReactionKind) ? value as ReactionKind : null;

export interface SeriesBook { book: Book; position: number; volumeLabel: string; }
export interface Series { id: string; name: string; description: string; imageUrl: string | null; books: SeriesBook[]; }
export interface SocialMedia { id: number; url: string; altText: string; description: string; position: number; }
export interface SocialComment { id: number; postId: number; parentId: number | null; username: string; avatar?: string | null; content: string; createdAt: number; reactions: Record<ReactionKind, number>; myReaction: ReactionKind | null; replies: SocialComment[]; }
export interface SocialPost { id: number; author: string; avatar?: string | null; content: string; bookId: string | null; book?: Pick<Book, "id" | "title" | "author" | "coverImagePath" | "coverColor">; media: SocialMedia[]; createdAt: number; updatedAt: number; reactions: Record<ReactionKind, number>; myReaction: ReactionKind | null; commentCount: number; repostCount: number; repost?: { comment: string; original: SocialPost | null; originalUnavailable: boolean } | null; }
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd frontend && npm test -- --run src/app/lib/types.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/test/setup.ts frontend/src/app/lib/types.ts frontend/src/app/lib/types.test.ts
git commit -m "test: add frontend contracts and test harness"
```

### Task 2: Create idempotent saga and social schema migrations

**Files:**
- Modify: `server/db.js`
- Create: `server/tests/migrations.test.js`

**Interfaces:**
- Produces: tables `series`, `series_books`, `social_posts`, `social_post_media`, `social_comments`, `social_reactions`, `social_reposts`; exported `initDb()` remains unchanged.

- [ ] **Step 1: Write migration preservation tests**

```js
test('initDb is idempotent and migrates home posts once', async () => {
  await seedLegacyHomePost(db, { id: 7, author: 'Admin', content: 'Clássico', image_url: '/old.jpg', book_id: 'b1' });
  await initDb(db); await initDb(db);
  const posts = await db.query("SELECT legacy_home_post_id, content FROM social_posts");
  assert.deepEqual(posts, [{ legacy_home_post_id: 7, content: 'Clássico' }]);
});

test('series positions and reactions have database uniqueness', async () => {
  await initDb(db);
  assert.equal(await hasUniqueIndex(db, 'series_books', ['series_id', 'position']), true);
  assert.equal(await hasUniqueIndex(db, 'social_reactions', ['username', 'target_type', 'target_id']), true);
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd server && node --test tests/migrations.test.js`

Expected: FAIL because the tables are missing.

- [ ] **Step 3: Add tables, indexes, and one-time legacy mapping**

Add explicit `CREATE TABLE IF NOT EXISTS` statements using `TEXT` IDs for series, integer social IDs, `ON DELETE`-compatible manual cleanup, and `legacy_home_post_id INTEGER UNIQUE`. Run:

```sql
INSERT INTO social_posts(author, content, book_id, created_at, updated_at, legacy_home_post_id)
SELECT CASE WHEN EXISTS(SELECT 1 FROM users u WHERE LOWER(u.username)=LOWER(h.author))
            THEN h.author ELSE 'Admin' END,
       CASE WHEN h.title='' THEN h.content ELSE h.title || char(10) || char(10) || h.content END,
       h.book_id, h.created_at, h.updated_at, h.id
FROM home_posts h
WHERE NOT EXISTS (SELECT 1 FROM social_posts s WHERE s.legacy_home_post_id=h.id);
```

Migrate each non-null `image_url` into `social_post_media(position=0)` with a guarded `NOT EXISTS` query.

- [ ] **Step 4: Run migration and existing tests**

Run: `cd server && node --test tests/migrations.test.js tests/appearance.test.js`

Expected: PASS on two consecutive `initDb` calls.

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/tests/migrations.test.js
git commit -m "feat: add idempotent saga and social schema"
```

### Task 3: Implement transactional saga API

**Files:**
- Create: `server/series.js`
- Create: `server/tests/series.test.js`
- Modify: `server/index.js`

**Interfaces:**
- Produces: `GET /series?q=`, `POST /series`, `GET /series/:id`, `PUT /series/:id`, `PUT /series/:id/books`, `DELETE /series/:id/books/:bookId`.
- Produces response: `{ id, name, description, imageUrl, books: [{ book, position, volumeLabel }] }`.

- [ ] **Step 1: Write failing authorization and ordering tests**

```js
test('admin creates and atomically reorders a series', async () => {
  const created = await api.post('/series', admin, { name: 'O Povo do Ar' });
  const result = await api.put(`/series/${created.id}/books`, admin, { books: [
    { bookId: 'b3', volumeLabel: '3' }, { bookId: 'b1', volumeLabel: '1' }, { bookId: 'b2', volumeLabel: '2' }
  ]});
  assert.deepEqual(result.books.map(x => [x.book.id, x.position]), [['b3', 0], ['b1', 1], ['b2', 2]]);
});

test('a book cannot belong to two series', async () => {
  await assert.rejects(() => api.put('/series/second/books', admin, { books: [{ bookId: 'b1' }] }), /already belongs/i);
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd server && node --test tests/series.test.js`

Expected: 404 for `/series`.

- [ ] **Step 3: Implement router and transaction helpers**

```js
export function createSeriesRouter({ db, requireAdmin, sql }) {
  const router = express.Router();
  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) throw httpError(400, 'Informe o nome da saga.');
      const id = crypto.randomUUID();
      await db.query(sql`INSERT INTO series(id,name,description,image_url,created_by,created_at,updated_at)
        VALUES(${id},${name},${String(req.body.description || '').trim()},${req.body.imageUrl || null},${req.user.username},${Date.now()},${Date.now()})`);
      res.status(201).json(await fetchSeries(db, id));
    } catch (error) { next(error); }
  });
  return router;
}
async function replaceSeriesBooks(db, seriesId, books) {
  const ids = new Set(books.map(item => item.bookId));
  if (ids.size !== books.length) throw httpError(400, 'Livro repetido na saga.');
  await db.tx(async tx => {
    await tx.query(sql`DELETE FROM series_books WHERE series_id=${seriesId}`);
    for (const [position, item] of books.entries()) await tx.query(sql`
      INSERT INTO series_books(series_id, book_id, position, volume_label)
      VALUES(${seriesId}, ${item.bookId}, ${position}, ${item.volumeLabel || String(position + 1)})`);
  });
}
```

Validate trimmed unique names, existing books, admin permission, and contiguous positions. Map snake_case at the router boundary.

- [ ] **Step 4: Run saga and full server suites**

Run: `cd server && node --test tests/series.test.js && node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/series.js server/index.js server/tests/series.test.js
git commit -m "feat: add ordered saga API"
```

### Task 4: Implement social posts, comments, reactions, and repost API

**Files:**
- Create: `server/social.js`
- Create: `server/tests/social.test.js`
- Modify: `server/index.js`

**Interfaces:**
- Produces: `GET/POST /social/posts`, `GET/PUT/DELETE /social/posts/:id`, `POST /social/posts/:id/comments`, `DELETE /social/comments/:id`, `PUT/DELETE /social/reactions`, `POST /social/posts/:id/reposts`.
- Consumes: existing `uploadFileToCloud`, `requireUser`, `requireAdmin`, `getRequestUsername` dependencies passed into `createSocialRouter()`.

- [ ] **Step 1: Write failing permission, rollback, reaction, tree, and deleted-source tests**

```js
test('failed second upload leaves no post or media rows', async () => {
  uploads.failAt(2);
  await assert.rejects(() => api.createPost(user, twoImages));
  assert.equal((await db.query('SELECT * FROM social_posts')).length, 0);
  assert.equal((await db.query('SELECT * FROM social_post_media')).length, 0);
});

test('reaction replacement keeps one row', async () => {
  await api.react(user, 'post', 1, 'heart');
  await api.react(user, 'post', 1, 'panda');
  assert.deepEqual(await reactionRows(), [{ reaction: 'panda' }]);
});

test('nested replies preserve parent ids', async () => {
  const root = await api.comment(user, 1, null, 'Primeiro');
  const reply = await api.comment(other, 1, root.id, 'Resposta');
  assert.equal((await api.post(1)).comments[0].replies[0].id, reply.id);
});

test('repost survives deleted source as unavailable', async () => {
  const repost = await api.repost(user, 1, 'Leiam isto');
  await api.deletePost(admin, 1);
  assert.equal((await api.post(repost.id)).repost.originalUnavailable, true);
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd server && node --test tests/social.test.js`

Expected: 404 for `/social/posts`.

- [ ] **Step 3: Implement validation, transactions, and decoration**

Allow at most 8 images, JPEG/PNG/WebP, 8 MB each; require content or media; cap content/comments at 5,000/1,500 characters. Use `target_type IN ('post','comment')`, reaction allowlist `heart|panda|sad|moved`, and upsert:

```sql
INSERT INTO social_reactions(username,target_type,target_id,reaction,created_at)
VALUES(?,?,?,?,?)
ON CONFLICT(username,target_type,target_id)
DO UPDATE SET reaction=excluded.reaction, created_at=excluded.created_at;
```

Decorate posts in batches with media, reaction counts, comment counts, book summaries, and original reposts. Build comment trees from flat rows in O(n), preserving every `parent_id`.

- [ ] **Step 4: Run focused and full suites**

Run: `cd server && node --test tests/social.test.js && node --test tests/*.test.js`

Expected: PASS with no leaked temporary files.

- [ ] **Step 5: Commit**

```bash
git add server/social.js server/index.js server/tests/social.test.js
git commit -m "feat: add multimedia social API"
```

### Task 5: Add typed saga/social clients and global search support

**Files:**
- Create: `frontend/src/app/lib/seriesApi.ts`
- Create: `frontend/src/app/lib/socialApi.ts`
- Create: `frontend/src/app/lib/socialApi.test.ts`
- Modify: `frontend/src/app/lib/api.ts`
- Modify: `frontend/src/app/components/GlobalSearch.tsx`
- Modify: `server/index.js`

**Interfaces:**
- Produces: `fetchSeries(query?)`, `fetchSeriesById(id)`, `saveSeries(input)`, `replaceSeriesBooks(id, books)`, `fetchSocialFeed(scope, cursor?)`, `createSocialPost(form)`, `fetchSocialPost(id)`, `reactTo(target)`, `commentOnPost(input)`, `repost(input)`.

- [ ] **Step 1: Write failing request-shape test**

```ts
it("sends post media as ordered multipart fields", async () => {
  await createSocialPost({ content: "Olá", bookId: "b1", media: [fileA, fileB] });
  const body = fetchMock.mock.calls[0][1]!.body as FormData;
  expect(body.getAll("media")).toEqual([fileA, fileB]);
  expect(body.get("bookId")).toBe("b1");
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/lib/socialApi.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement clients and extend search response groups**

Return typed errors with API messages. Extend server search to return `series` and public `posts`; update `GlobalSearch` to render “Sagas” and “Publicações” sections and navigate to `/series/:id` and `/social/post/:id`.

- [ ] **Step 4: Run tests, typecheck, and server suite**

Run: `cd frontend && npm test -- --run src/app/lib/socialApi.test.ts && npm run typecheck && cd ../server && node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lib/seriesApi.ts frontend/src/app/lib/socialApi.ts frontend/src/app/lib/socialApi.test.ts frontend/src/app/lib/api.ts frontend/src/app/components/GlobalSearch.tsx server/index.js
git commit -m "feat: connect saga social and search APIs"
```

### Task 6: Build accessible dynamic palette and clipped app window

**Files:**
- Create: `frontend/src/app/lib/themePalette.ts`
- Create: `frontend/src/app/lib/themePalette.test.ts`
- Create: `frontend/src/app/components/AppBackdrop.tsx`
- Modify: `frontend/src/app/components/RootLayout.tsx`
- Modify: `frontend/src/styles/identity.css`
- Modify: `frontend/src/styles/refinements.css`

**Interfaces:**
- Produces: `createThemeTokens(source: string | HTMLImageElement): Promise<ThemeTokens>` and CSS variables `--scene`, `--scene-strong`, `--scene-soft`, `--scene-contrast`, `--sidebar-tint`.

- [ ] **Step 1: Write failing contrast/fallback tests**

```ts
it.each(["#ffffff", "#000000", "#ffffff00"])("returns AA tokens for %s", async source => {
  const tokens = await createThemeTokens(source);
  expect(contrastRatio(tokens.scene, tokens.sceneContrast)).toBeGreaterThanOrEqual(4.5);
});

it("uses plum fallback for an unreadable source", async () => {
  expect((await createThemeTokens("invalid")).scene).toBe("#71385f");
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/lib/themePalette.test.ts`

Expected: module not found.

- [ ] **Step 3: Implement palette tokens and shell**

Use canvas sampling, median dominant color, HSL clamping, WCAG luminance, and black/white contrast selection. Cache by image URL. Wrap sidebar and main inside `.mb-app-window`; render `AppBackdrop` as a fixed sibling using the same scene image. Set desktop window to `height: calc(100dvh - 32px); overflow: clip; border-radius: 28px`, then give `.mb-app-main` its own scroll container. Remove the sidebar profile card, retaining “Adicionar livro”; keep top-right profile.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `cd frontend && npm test -- --run src/app/lib/themePalette.test.ts && npm run typecheck && npm run build`

Expected: PASS; build contains no CSS parse warnings.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/lib/themePalette.ts frontend/src/app/lib/themePalette.test.ts frontend/src/app/components/AppBackdrop.tsx frontend/src/app/components/RootLayout.tsx frontend/src/styles/identity.css frontend/src/styles/refinements.css
git commit -m "feat: create immersive dynamic app shell"
```

### Task 7: Redesign book editing and add saga management

**Files:**
- Create: `frontend/src/app/components/SeriesEditor.tsx`
- Create: `frontend/src/app/components/SeriesEditor.test.tsx`
- Modify: `frontend/src/app/components/EditBookModal.tsx`
- Modify: `frontend/src/app/pages/Upload.tsx`
- Modify: `frontend/src/styles/references.css`

**Interfaces:**
- Consumes: Task 5 saga client.
- Produces: `SeriesEditor({ bookId, value, onChange })`; wizard state `{ step, draft, files, seriesSelection, appearance }`.

- [ ] **Step 1: Write failing create/link/reorder test**

```tsx
it("creates a saga and emits contiguous reordered books", async () => {
  render(<SeriesEditor bookId="b2" value={null} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /criar saga/i }));
  await user.type(screen.getByLabelText(/nome da saga/i), "O Povo do Ar");
  await user.click(screen.getByRole("button", { name: /salvar saga/i }));
  await user.click(screen.getByLabelText(/mover b2 para cima/i));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ books: expect.arrayContaining([expect.objectContaining({ position: 0 })]) }));
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/components/SeriesEditor.test.tsx`

Expected: component missing.

- [ ] **Step 3: Implement wizard and series editor**

Use steps “Informações”, “Arquivos e capa”, “Saga”, “Aparência”, “Revisão”. Persist draft to `sessionStorage` under `book-draft:<id|new>` after each change, clear only after API success, and show field-specific failures. Provide pointer drag-and-drop plus “mover para cima/baixo” buttons. Keep a sticky desktop preview and collapsible mobile preview.

- [ ] **Step 4: Run component tests, typecheck, and build**

Run: `cd frontend && npm test -- --run src/app/components/SeriesEditor.test.tsx && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/SeriesEditor.tsx frontend/src/app/components/SeriesEditor.test.tsx frontend/src/app/components/EditBookModal.tsx frontend/src/app/pages/Upload.tsx frontend/src/styles/references.css
git commit -m "feat: redesign book editor with saga workflow"
```

### Task 8: Build editorial book banner and saga pages

**Files:**
- Create: `frontend/src/app/components/BookHero.tsx`
- Create: `frontend/src/app/components/BookSeriesStrip.tsx`
- Create: `frontend/src/app/components/BookSeriesStrip.test.tsx`
- Create: `frontend/src/app/pages/SeriesDetails.tsx`
- Modify: `frontend/src/app/pages/BookDetails.tsx`
- Modify: `frontend/src/app/routes.ts`
- Modify: `frontend/src/styles/references.css`

**Interfaces:**
- Consumes: `Series`, book actions, and theme tokens.
- Produces: routes `/series/:id`; book page sections hero → about/reviews → saga → gallery → related.

- [ ] **Step 1: Write failing ordered-volume test**

```tsx
it("renders ordered volumes and marks the current book", () => {
  render(<BookSeriesStrip series={seriesWithBooks([b3, b1, b2])} currentBookId="b1" />);
  expect(screen.getAllByRole("link").map(x => x.textContent)).toEqual(["Volume 3", "Volume 1", "Volume 2"]);
  expect(screen.getByText("Volume 1").closest("a")).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/components/BookSeriesStrip.test.tsx`

Expected: component missing.

- [ ] **Step 3: Implement hero, strip, and series page**

Move existing load/action logic out of the BookDetails markup but preserve behavior. `BookHero` renders a bounded image banner and overlaid cover, never a full-page background. `SeriesDetails` renders description and ordered books with admin edit affordance.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `cd frontend && npm test -- --run src/app/components/BookSeriesStrip.test.tsx && npm run typecheck && npm run build`

Expected: PASS and `/series/:id` included in route build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/BookHero.tsx frontend/src/app/components/BookSeriesStrip.tsx frontend/src/app/components/BookSeriesStrip.test.tsx frontend/src/app/pages/SeriesDetails.tsx frontend/src/app/pages/BookDetails.tsx frontend/src/app/routes.ts frontend/src/styles/references.css
git commit -m "feat: add editorial book and saga experience"
```

### Task 9: Replace community feed with full social experience

**Files:**
- Create: `frontend/src/app/components/PostComposer.tsx`
- Create: `frontend/src/app/components/SocialPostCard.tsx`
- Create: `frontend/src/app/components/ReactionPicker.tsx`
- Create: `frontend/src/app/components/CommentThread.tsx`
- Create: `frontend/src/app/components/CommentThread.test.tsx`
- Create: `frontend/src/app/pages/PostDetails.tsx`
- Modify: `frontend/src/app/pages/Social.tsx`
- Modify: `frontend/src/app/routes.ts`
- Modify: `frontend/src/styles/references.css`

**Interfaces:**
- Consumes: Task 5 social client.
- Produces: `/social/post/:id`, “Para você”/“Seguindo” feeds, composer, threaded discussion, reaction/repost/share actions.

- [ ] **Step 1: Write failing depth and optimistic rollback tests**

```tsx
it("preserves deep replies but caps visual indentation", () => {
  render(<CommentThread comments={fiveLevelTree} />);
  expect(screen.getByText("nível 5").closest("article")).toHaveStyle({ "--comment-depth": "3" });
});

it("rolls back a failed optimistic reaction", async () => {
  reactTo.mockRejectedValueOnce(new Error("offline"));
  render(<SocialPostCard post={post} />);
  await user.click(screen.getByRole("button", { name: /curtir/i }));
  expect(await screen.findByText(/não foi possível reagir/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /curtir/i })).toHaveAttribute("aria-pressed", "false");
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/components/CommentThread.test.tsx`

Expected: components missing.

- [ ] **Step 3: Implement feed, composer, detail page, and actions**

Composer supports 1–8 previews, reorder/remove, optional book picker, alt text, and disabled submit during upload. `ReactionPicker` opens on 450 ms press or explicit chevron; a normal activation applies heart. Sharing uses `navigator.share` when available, otherwise internal recipient picker plus clipboard. Reposts support direct and quoted variants. Author/admin menus expose edit/delete with confirmation.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `cd frontend && npm test -- --run src/app/components/CommentThread.test.tsx && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/PostComposer.tsx frontend/src/app/components/SocialPostCard.tsx frontend/src/app/components/ReactionPicker.tsx frontend/src/app/components/CommentThread.tsx frontend/src/app/components/CommentThread.test.tsx frontend/src/app/pages/PostDetails.tsx frontend/src/app/pages/Social.tsx frontend/src/app/routes.ts frontend/src/styles/references.css
git commit -m "feat: turn community into social network"
```

### Task 10: Add book gallery and accessible media lightbox

**Files:**
- Create: `frontend/src/app/components/BookGallery.tsx`
- Create: `frontend/src/app/components/MediaLightbox.tsx`
- Create: `frontend/src/app/components/MediaLightbox.test.tsx`
- Modify: `frontend/src/app/pages/BookDetails.tsx`
- Modify: `frontend/src/styles/references.css`

**Interfaces:**
- Consumes: `fetchSocialFeed({ bookId })`, `ReactionPicker`, and `CommentThread`.
- Produces: gallery section and modal media viewer with canonical post link.

- [ ] **Step 1: Write failing carousel accessibility test**

```tsx
it("moves by keyboard and restores focus when closed", async () => {
  render(<MediaLightbox post={postWithThreeMedia} initialIndex={0} onClose={close} />);
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("img", { name: "segunda imagem" })).toBeVisible();
  await user.keyboard("{Escape}");
  expect(close).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/components/MediaLightbox.test.tsx`

Expected: component missing.

- [ ] **Step 3: Implement gallery and lightbox**

Load only posts with `bookId` and media, render horizontal snap carousel, and open a focus-trapped dialog with media, alt text, description, author, reactions, comments, and “Abrir publicação”. Broken media show a neutral placeholder while siblings remain usable.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `cd frontend && npm test -- --run src/app/components/MediaLightbox.test.tsx && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/BookGallery.tsx frontend/src/app/components/MediaLightbox.tsx frontend/src/app/components/MediaLightbox.test.tsx frontend/src/app/pages/BookDetails.tsx frontend/src/styles/references.css
git commit -m "feat: add social gallery to book pages"
```

### Task 11: Integrate notifications, empty/error states, and responsive polish

**Files:**
- Modify: `server/social.js`
- Modify: `frontend/src/app/components/NotificationsMenu.tsx`
- Modify: `frontend/src/app/pages/Social.tsx`
- Modify: `frontend/src/app/pages/PostDetails.tsx`
- Modify: `frontend/src/styles/refinements.css`
- Create: `frontend/src/app/pages/Social.test.tsx`

**Interfaces:**
- Produces notification links for reactions, comments, replies, reposts; final desktop/tablet/mobile layouts.

- [ ] **Step 1: Write failing empty/error state test**

```tsx
it("offers useful actions when following feed is empty", async () => {
  fetchSocialFeed.mockResolvedValueOnce({ items: [], nextCursor: null });
  render(<Social />);
  await user.click(screen.getByRole("tab", { name: /seguindo/i }));
  expect(screen.getByRole("button", { name: /encontrar leitores/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /criar publicação/i })).toBeVisible();
});
```

- [ ] **Step 2: Run to prove RED**

Run: `cd frontend && npm test -- --run src/app/pages/Social.test.tsx`

Expected: required actions missing.

- [ ] **Step 3: Implement notifications and responsive states**

Create notifications only for other users, link to canonical posts, and deduplicate rapid replacements. Add retry actions for feed/post failures, upload progress, removed-source copy, mobile bottom sheets, safe-area padding, visible focus, and `prefers-reduced-motion` overrides.

- [ ] **Step 4: Run all automated checks**

Run: `cd server && node --test tests/*.test.js && cd ../frontend && npm test -- --run && npm run typecheck && npm run build`

Expected: all PASS with no warnings introduced by this task.

- [ ] **Step 5: Commit**

```bash
git add server/social.js frontend/src/app/components/NotificationsMenu.tsx frontend/src/app/pages/Social.tsx frontend/src/app/pages/PostDetails.tsx frontend/src/app/pages/Social.test.tsx frontend/src/styles/refinements.css
git commit -m "feat: finish social states and notifications"
```

### Task 12: End-to-end and visual verification

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/bookzinhos.spec.ts`
- Create: `docs/verification/2026-10-27-bookzinhos-redesign.md`

**Interfaces:**
- Consumes: complete app and seeded test database.
- Produces: reproducible browser checks and verification record.

- [ ] **Step 1: Write failing Playwright journeys**

```ts
test('admin creates a saga and user publishes book gallery media', async ({ page }) => {
  await loginAsAdmin(page);
  await createSeriesAndOrder(page, 'O Povo do Ar', ['O Príncipe Cruel', 'O Rei Perverso']);
  await loginAsReader(page);
  await publishPost(page, { book: 'O Príncipe Cruel', images: ['fixtures/book.jpg'] });
  await page.getByRole('link', { name: 'O Príncipe Cruel' }).click();
  await expect(page.getByRole('heading', { name: 'O Povo do Ar' })).toBeVisible();
  await expect(page.getByRole('region', { name: /galeria/i }).getByRole('img')).toBeVisible();
});
```

- [ ] **Step 2: Install Playwright and prove RED**

Run: `cd frontend && npm install -D @playwright/test && npx playwright install chromium && npm run test:e2e`

Expected: FAIL until helpers and completed flows are connected.

- [ ] **Step 3: Complete fixtures, journeys, and visual assertions**

Add scripts `"test:e2e": "playwright test"`. Cover shell clipping, profile absence in sidebar, editor draft recovery, saga reorder, post media, isolated post comments/replies, reactions, repost, share fallback, gallery lightbox, keyboard navigation, and 390×844 plus 1440×1000 screenshots. Record commands, screenshots, and any accepted platform limitation in the verification document.

- [ ] **Step 4: Run the full release gate**

Run: `cd server && node --test tests/*.test.js && cd ../frontend && npm test -- --run && npm run typecheck && npm run build && npm run test:e2e`

Expected: all PASS. Inspect desktop and mobile screenshots for clipping, overflow, contrast, focus, and density.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.ts frontend/e2e docs/verification/2026-10-27-bookzinhos-redesign.md
git commit -m "test: verify complete Bookzinhos redesign"
```

## Final Branch Review

- Compare every spec heading against Tasks 2–12.
- Run `git diff main...HEAD --check` and inspect the complete diff for accidental legacy-model edits.
- Run the release gate from Task 12 once more from a clean dependency install.
- Verify migration twice against a copy of representative production-shaped data.
- Confirm no credentials, uploaded fixtures, database files, or screenshots outside `docs/verification` are tracked.
- Use the requesting-code-review skill for a fresh whole-branch review before merge or push.
