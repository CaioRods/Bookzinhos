const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const multer = require("multer");
const sqlite3 = require("sqlite3");
const register = require("../community");
test("community permissions, gallery isolation, threads, reactions, reposts and ordered series", async (t) => {
  const connection = new sqlite3.Database(":memory:");
  const db = {
    query: (q) =>
      new Promise((resolve, reject) =>
        connection.all(
          typeof q === "string" ? q : q.text,
          q.values || [],
          (error, rows) => (error ? reject(error) : resolve(rows)),
        ),
      ),
  };
  const sql = (strings, ...values) => ({ text: strings.join("?"), values });
  for (const query of [
    "CREATE TABLE users(username TEXT PRIMARY KEY,is_admin INTEGER,avatar TEXT)",
    "INSERT INTO users VALUES ('Admin',1,'🐼'),('Reader',0,'🐶'),('Other',0,'🦊')",
    "CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT,author TEXT,cover_image_path TEXT,series_id TEXT,series_order REAL)",
    "INSERT INTO books(id,title,author) VALUES ('one','First','Author'),('two','Second','Author')",
    "CREATE TABLE follows(follower TEXT,following TEXT)",
    "INSERT INTO follows VALUES ('Other','Reader')",
  ])
    await db.query(query);
  const app = express();
  app.use(express.json());
  const currentUser = (req) => req.get("x-user-id");
  const requireAdmin = (req, res, next) =>
    currentUser(req) === "Admin" ? next() : res.sendStatus(403);
  let uploads = 0;
  await register({
    app,
    db,
    sql,
    upload: multer(),
    uploadFileToCloud: async () => "/uploads/image-" + ++uploads + ".png",
    currentUser,
    requireAdmin,
  }).ready();
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => connection.close(resolve));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (path, method = "GET", body, user = "Reader") => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "x-user-id": user,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json().catch(() => null),
    };
  };
  const publish = (gallery = false, images = 0) => {
    const data = new FormData();
    data.set("content", "A conversation");
    data.set("bookId", "one");
    data.set("gallery", String(gallery));
    for (let i = 0; i < images; i++)
      data.append(
        "images",
        new Blob(["image"], { type: "image/png" }),
        "test.png",
      );
    return data;
  };
  assert.equal(
    (await request("/community/posts", "POST", publish(), "Missing")).status,
    401,
  );
  assert.equal(
    (await request("/community/posts", "POST", publish(true, 1))).status,
    403,
  );
  assert.equal(uploads, 0);
  const post = (await request("/community/posts", "POST", publish(false, 2)))
    .data;
  assert.equal(post.images.length, 2);
  assert.equal(post.book.title, "First");
  const readerGallery = (await request("/community/posts?bookId=one")).data;
  assert.equal(readerGallery.length, 1);
  assert.equal(readerGallery[0].id, post.id);
  const gallery = await request(
    "/community/posts",
    "POST",
    publish(true, 1),
    "Admin",
  );
  assert.equal(gallery.status, 201);
  const fullGallery = (await request("/community/posts?bookId=one")).data;
  assert.equal(fullGallery.length, 2);
  assert.equal(fullGallery[0].id, gallery.data.id);
  const directImages = Array.from(
    { length: 8 },
    (_, index) => `https://storage.example/community/image-${index}.png`,
  );
  const directGallery = await request(
    "/community/posts",
    "POST",
    {
      content: "Eight original images",
      bookId: "two",
      gallery: true,
      imageUrls: directImages,
    },
    "Admin",
  );
  assert.equal(directGallery.status, 201);
  assert.deepEqual(directGallery.data.images, directImages);
  const comment = (
    await request("/community/posts/" + post.id + "/comments", "POST", {
      content: "Comment",
    })
  ).data;
  const reply = await request(
    "/community/posts/" + post.id + "/comments",
    "POST",
    { content: "Reply", parentId: comment.id },
    "Other",
  );
  assert.equal(reply.status, 201);
  assert.equal(
    (
      await request(
        "/community/posts/" + gallery.data.id + "/comments",
        "POST",
        { content: "Invalid reply", parentId: comment.id },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/community/reactions/" + post.id, "PUT", {
        reaction: "panda",
      })
    ).status,
    200,
  );
  await request(
    "/community/reactions/" + comment.id,
    "PUT",
    { reaction: "heart" },
    "Other",
  );
  let detail = (await request("/community/posts/" + post.id)).data;
  assert.equal(detail.myReaction, "panda");
  assert.equal(detail.comments.length, 2);
  assert.equal(detail.comments[0].reactions.heart, 1);
  await request("/community/reactions/" + post.id, "PUT", {
    reaction: "moved",
  });
  detail = (await request("/community/posts/" + post.id)).data;
  assert.equal(detail.reactions.moved, 1);
  assert.equal(detail.reactions.panda, undefined);
  await request("/community/posts/" + post.id + "/repost", "POST", {});
  detail = (await request("/community/posts/" + post.id)).data;
  assert.equal(detail.repostCount, 1);
  assert.equal(detail.repostedByMe, true);
  assert.equal(
    (
      await request(
        "/community/posts?scope=following",
        "GET",
        undefined,
        "Other",
      )
    ).data.some((p) => p.id === post.id),
    true,
  );
  assert.equal(
    (await request("/community/posts/" + post.id, "DELETE", undefined, "Other"))
      .status,
    403,
  );
  const series = (await request("/series", "POST", { name: "O povo do ar" }))
    .data;
  const duplicate = (await request("/series", "POST", { name: "O POVO DO AR" }))
    .data;
  assert.equal(duplicate.id, series.id);
  await db.query(
    sql`UPDATE books SET series_id=${series.id},series_order=1 WHERE id='one'`,
  );
  await db.query(
    sql`UPDATE books SET series_id=${series.id},series_order=2 WHERE id='two'`,
  );
  assert.equal(
    (
      await request("/series/" + series.id + "/order", "PUT", {
        bookIds: ["two", "one"],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/series/" + series.id + "/order",
        "PUT",
        { bookIds: ["two"] },
        "Admin",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/series/" + series.id + "/order",
        "PUT",
        { bookIds: ["two", "one"] },
        "Admin",
      )
    ).status,
    200,
  );
  assert.equal(
    (await db.query("SELECT series_order FROM books WHERE id='two'"))[0]
      .series_order,
    1,
  );
  assert.equal(
    (await request("/community/posts/" + post.id, "DELETE", undefined, "Admin"))
      .status,
    200,
  );
  assert.equal((await request("/community/posts/" + post.id)).status, 404);
  assert.equal((await db.query("SELECT * FROM community_comments")).length, 0);
  assert.equal((await db.query("SELECT * FROM community_reactions")).length, 0);
});
