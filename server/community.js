const crypto = require("crypto");
module.exports = function ({
  app,
  db,
  sql,
  upload,
  uploadFileToCloud,
  currentUser,
  requireAdmin,
}) {
  const multer = require("multer");
  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 12 * 1024 * 1024,
      files: 8,
      fields: 8,
      fieldSize: 10000,
    },
  });
  const ready = async () => {
    for (const query of [
      `CREATE TABLE IF NOT EXISTS book_series (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE)`,
      `CREATE TABLE IF NOT EXISTS community_posts (id TEXT PRIMARY KEY, username TEXT NOT NULL, content TEXT NOT NULL, book_id TEXT, images TEXT NOT NULL DEFAULT '[]', is_gallery INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS community_comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, parent_id TEXT, username TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS community_reactions (target_id TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE, reaction TEXT NOT NULL, PRIMARY KEY(target_id,username))`,
      `CREATE TABLE IF NOT EXISTS community_reposts (post_id TEXT NOT NULL, username TEXT NOT NULL COLLATE NOCASE, created_at INTEGER NOT NULL, PRIMARY KEY(post_id,username))`,
      `CREATE INDEX IF NOT EXISTS books_series_order_idx ON books(series_id,series_order)`,
      `CREATE INDEX IF NOT EXISTS community_book_idx ON community_posts(book_id,created_at)`,
      `CREATE INDEX IF NOT EXISTS community_comment_idx ON community_comments(post_id,created_at)`,
    ])
      await db.query(query);
  };
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  };
  const member = async (req, res, next) => {
    try {
      const me = currentUser(req);
      const [user] = me
        ? await db.query(
            sql`SELECT username FROM users WHERE username = ${me} COLLATE NOCASE`,
          )
        : [];
      if (!user)
        return res
          .status(401)
          .json({ error: "Entre na sua conta para participar." });
      req.communityUser = user.username;
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  const knownBook = async (id) => {
    if (
      id &&
      !(await db.query(sql`SELECT id FROM books WHERE id = ${id}`)).length
    )
      throw new Error("Livro não encontrado.");
  };
  app.get(
    "/series",
    wrap(async (_req, res) =>
      res.json(await db.query("SELECT * FROM book_series ORDER BY name")),
    ),
  );
  app.post(
    "/series",
    member,
    wrap(async (req, res) => {
      const name = String(req.body.name || "")
        .trim()
        .slice(0, 120);
      if (!name) throw new Error("Informe o nome da saga.");
      await db.query(
        sql`INSERT OR IGNORE INTO book_series(id,name) VALUES (${crypto.randomUUID()},${name})`,
      );
      res.json(
        (
          await db.query(
            sql`SELECT * FROM book_series WHERE name = ${name} COLLATE NOCASE`,
          )
        )[0],
      );
    }),
  );
  // Ordering is an administrative operation: a user cannot silently rearrange the shared catalog.
  app.put(
    "/series/:id/order",
    requireAdmin,
    wrap(async (req, res) => {
      const ids = req.body.bookIds;
      if (
        !Array.isArray(ids) ||
        ids.length > 500 ||
        new Set(ids).size !== ids.length
      )
        throw new Error("Ordem inválida.");
      const members = await db.query(
        sql`SELECT id FROM books WHERE series_id = ${req.params.id}`,
      );
      if (
        members.length !== ids.length ||
        members.some((book) => !ids.includes(book.id))
      )
        throw new Error(
          "A lista deve conter todos os livros da saga. Atualize e tente novamente.",
        );
      for (let i = 0; i < ids.length; i++)
        await db.query(
          sql`UPDATE books SET series_order = ${i + 1} WHERE id = ${ids[i]} AND series_id = ${req.params.id}`,
        );
      res.json({ ok: true });
    }),
  );
  const hydrate = async (rows, me) => {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id),
      placeholders = ids.map(() => "?").join(",");
    const comments = await db.query({
      text: `SELECT * FROM community_comments WHERE post_id IN (${placeholders}) ORDER BY created_at`,
      values: ids,
    });
    const targets = [...ids, ...comments.map((c) => c.id)];
    const [users, books, reactions, reposts] = await Promise.all([
      db.query("SELECT username,avatar FROM users"),
      db.query("SELECT id,title,author,cover_image_path FROM books"),
      db.query({
        text: `SELECT * FROM community_reactions WHERE target_id IN (${targets.map(() => "?").join(",")})`,
        values: targets,
      }),
      db.query({
        text: `SELECT * FROM community_reposts WHERE post_id IN (${placeholders})`,
        values: ids,
      }),
    ]);
    const same = (a, b) =>
      String(a).toLowerCase() === String(b || "").toLowerCase();
    const activity = (id) => ({
      reactions: reactions
        .filter((r) => r.target_id === id)
        .reduce(
          (out, r) => ({ ...out, [r.reaction]: (out[r.reaction] || 0) + 1 }),
          {},
        ),
      myReaction:
        reactions.find((r) => r.target_id === id && same(r.username, me))
          ?.reaction || null,
    });
    const avatar = (username) =>
      users.find((u) => same(u.username, username))?.avatar || "🐼";
    return rows.map((row) => ({
      ...row,
      images: JSON.parse(row.images),
      avatar: avatar(row.username),
      book: books.find((b) => b.id === row.book_id) || null,
      ...activity(row.id),
      repostCount: reposts.filter((r) => r.post_id === row.id).length,
      repostedByMe: reposts.some(
        (r) => r.post_id === row.id && same(r.username, me),
      ),
      comments: comments
        .filter((c) => c.post_id === row.id)
        .map((c) => ({ ...c, avatar: avatar(c.username), ...activity(c.id) })),
    }));
  };
  app.get(
    "/community/posts",
    wrap(async (req, res) => {
      const me = currentUser(req);
      const before = Number(req.query.before) || Date.now() + 1;
      let rows;
      if (req.query.bookId)
        rows = await db.query(
          sql`SELECT * FROM community_posts WHERE book_id = ${String(req.query.bookId)} AND images <> '[]' AND created_at < ${before} ORDER BY is_gallery DESC, created_at DESC LIMIT 100`,
        );
      else if (req.query.scope === "following")
        rows = !me
          ? []
          : await db.query(sql`
        SELECT p.* FROM community_posts p WHERE p.created_at < ${before} AND (
          p.username = ${me} COLLATE NOCASE OR
          EXISTS (SELECT 1 FROM follows f WHERE f.follower = ${me} COLLATE NOCASE AND f.following = p.username COLLATE NOCASE) OR
          EXISTS (SELECT 1 FROM community_reposts r WHERE r.post_id = p.id AND (
            r.username = ${me} COLLATE NOCASE OR EXISTS (SELECT 1 FROM follows f WHERE f.follower = ${me} COLLATE NOCASE AND f.following = r.username COLLATE NOCASE)
          ))
        ) ORDER BY p.created_at DESC LIMIT 100
      `);
      else
        rows = await db.query(
          sql`SELECT * FROM community_posts WHERE created_at < ${before} ORDER BY created_at DESC LIMIT 100`,
        );
      const reposts = await db.query(
        "SELECT * FROM community_reposts ORDER BY created_at DESC LIMIT 1000",
      );
      const hydrated = await hydrate(rows, me);
      res.json(
        hydrated.map((p) => ({
          ...p,
          repostedBy: reposts
            .filter((r) => r.post_id === p.id)
            .slice(0, 3)
            .map((r) => r.username),
        })),
      );
    }),
  );
  app.get(
    "/community/posts/:id",
    wrap(async (req, res) => {
      const rows = await db.query(
        sql`SELECT * FROM community_posts WHERE id=${req.params.id}`,
      );
      if (!rows.length)
        return res.status(404).json({ error: "Publicação não encontrada." });
      res.json((await hydrate(rows, currentUser(req)))[0]);
    }),
  );
  app.post(
    "/community/posts",
    member,
    mediaUpload.array("images", 8),
    wrap(async (req, res) => {
      const content = String(req.body.content || "").trim();
      if (content.length > 5000)
        throw new Error("Escreva até 5.000 caracteres.");
      const gallery = req.body.gallery === true || req.body.gallery === "true";
      if (gallery) {
        const [user] = await db.query(
          sql`SELECT is_admin FROM users WHERE username=${req.communityUser} COLLATE NOCASE`,
        );
        if (!user?.is_admin)
          return res.status(403).json({
            error: "Apenas o admin pode publicar na galeria do livro.",
          });
        if (!req.body.bookId)
          throw new Error("Escolha um livro para a galeria.");
      }
      const files = req.files || [];
      const directImages = Array.isArray(req.body.imageUrls)
        ? req.body.imageUrls
        : [];
      if (directImages.length > 8)
        throw new Error("Adicione até 8 imagens.");
      for (const url of directImages) {
        if (
          typeof url !== "string" ||
          url.length > 2000 ||
          !/^https:\/\//i.test(url)
        )
          throw new Error("Uma das imagens enviadas é inválida.");
      }
      if (gallery && !files.length && !directImages.length)
        throw new Error("Adicione uma imagem à galeria.");
      if (!content && !files.length && !directImages.length)
        throw new Error("Escreva algo ou adicione uma imagem.");
      const bookId = req.body.bookId || null;
      await knownBook(bookId);
      const types = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
      };
      for (const file of files)
        if (!types[file.mimetype] || file.size > 12 * 1024 * 1024)
          throw new Error("Use JPG, PNG, WebP ou AVIF de até 12 MB por imagem.");
      const images = [...directImages];
      for (const file of files)
        images.push(
          await uploadFileToCloud(
            file.buffer,
            `community/${crypto.randomUUID()}.${types[file.mimetype]}`,
            file.mimetype,
          ),
        );
      const id = crypto.randomUUID();
      await db.query(
        sql`INSERT INTO community_posts(id,username,content,book_id,images,is_gallery,created_at) VALUES(${id},${req.communityUser},${content},${bookId},${JSON.stringify(images)},${gallery ? 1 : 0},${Date.now()})`,
      );
      res
        .status(201)
        .json(
          (
            await hydrate(
              await db.query(sql`SELECT * FROM community_posts WHERE id=${id}`),
              req.communityUser,
            )
          )[0],
        );
    }),
  );
  app.post(
    "/community/posts/:id/comments",
    member,
    wrap(async (req, res) => {
      const [post] = await db.query(
        sql`SELECT id FROM community_posts WHERE id=${req.params.id}`,
      );
      if (!post)
        return res.status(404).json({ error: "Publicação não encontrada." });
      const content = String(req.body.content || "").trim();
      if (!content || content.length > 2000)
        throw new Error("Escreva um comentário de até 2.000 caracteres.");
      const parent = req.body.parentId || null;
      if (
        parent &&
        !(
          await db.query(
            sql`SELECT id FROM community_comments WHERE id=${parent} AND post_id=${post.id}`,
          )
        ).length
      )
        throw new Error("Resposta inválida.");
      const id = crypto.randomUUID();
      await db.query(
        sql`INSERT INTO community_comments(id,post_id,parent_id,username,content,created_at) VALUES(${id},${post.id},${parent},${req.communityUser},${content},${Date.now()})`,
      );
      res.status(201).json({ id });
    }),
  );
  app.put(
    "/community/reactions/:id",
    member,
    wrap(async (req, res) => {
      const id = req.params.id;
      const exists =
        (await db.query(sql`SELECT id FROM community_posts WHERE id=${id}`))
          .length ||
        (await db.query(sql`SELECT id FROM community_comments WHERE id=${id}`))
          .length;
      if (!exists)
        return res.status(404).json({ error: "Conteúdo não encontrado." });
      const reaction = req.body.reaction;
      if (
        reaction !== null &&
        !["heart", "panda", "sad", "moved"].includes(reaction)
      )
        throw new Error("Reação inválida.");
      if (!reaction)
        await db.query(
          sql`DELETE FROM community_reactions WHERE target_id=${id} AND username=${req.communityUser} COLLATE NOCASE`,
        );
      else
        await db.query(
          sql`INSERT INTO community_reactions(target_id,username,reaction) VALUES(${id},${req.communityUser},${reaction}) ON CONFLICT(target_id,username) DO UPDATE SET reaction=excluded.reaction`,
        );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/community/posts/:id/repost",
    member,
    wrap(async (req, res) => {
      if (
        !(
          await db.query(
            sql`SELECT id FROM community_posts WHERE id=${req.params.id}`,
          )
        ).length
      )
        return res.sendStatus(404);
      const [exists] = await db.query(
        sql`SELECT post_id FROM community_reposts WHERE post_id=${req.params.id} AND username=${req.communityUser} COLLATE NOCASE`,
      );
      if (exists)
        await db.query(
          sql`DELETE FROM community_reposts WHERE post_id=${req.params.id} AND username=${req.communityUser} COLLATE NOCASE`,
        );
      else
        await db.query(
          sql`INSERT INTO community_reposts(post_id,username,created_at) VALUES(${req.params.id},${req.communityUser},${Date.now()})`,
        );
      res.json({ ok: true });
    }),
  );
  app.delete(
    "/community/posts/:id",
    member,
    wrap(async (req, res) => {
      const [post] = await db.query(
        sql`SELECT username FROM community_posts WHERE id=${req.params.id}`,
      );
      if (!post) return res.sendStatus(404);
      const [user] = await db.query(
        sql`SELECT is_admin FROM users WHERE username=${req.communityUser} COLLATE NOCASE`,
      );
      if (
        post.username.toLowerCase() !== req.communityUser.toLowerCase() &&
        !user?.is_admin
      )
        return res.sendStatus(403);
      const comments = await db.query(
        sql`SELECT id FROM community_comments WHERE post_id=${req.params.id}`,
      );
      for (const comment of comments)
        await db.query(
          sql`DELETE FROM community_reactions WHERE target_id=${comment.id}`,
        );
      await db.query(
        sql`DELETE FROM community_reactions WHERE target_id=${req.params.id}`,
      );
      await db.query(
        sql`DELETE FROM community_reposts WHERE post_id=${req.params.id}`,
      );
      await db.query(
        sql`DELETE FROM community_comments WHERE post_id=${req.params.id}`,
      );
      await db.query(
        sql`DELETE FROM community_posts WHERE id=${req.params.id}`,
      );
      res.json({ ok: true });
    }),
  );
  return { ready };
};
