const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

test('database initialization preserves the admin avatar across restarts', async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'bookzinhos-admin-avatar-'));
  const settings = {
    DATA_DIR: dataDir,
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    DOTENV_CONFIG_PATH: path.join(dataDir, 'no-env-file'),
    ADMIN_INITIAL_PASSWORD: 'isolated-test-password',
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  try {
    const { db, sql, initDB } = require('../db');
    await initDB();
    const readAdmin = async () => (await db.query(sql`SELECT * FROM users WHERE username = 'admin' COLLATE NOCASE`))[0];
    const initial = await readAdmin();
    assert.equal(initial.avatar, '🐶');
    assert.equal(initial.is_admin, 1);

    // Existing accounts may use a different casing for the admin name.
    await db.query(sql`UPDATE users SET username = 'aDmIn' WHERE username = 'Admin' COLLATE NOCASE`);
    await db.query(sql`INSERT INTO users (username, password, avatar) VALUES ('Leitora', 'test', '🐼')`);
    for (const avatar of ['/uploads/admin-photo.webp', 'https://example.com/photo.jpg', '🦊']) {
      await db.query(sql`UPDATE users SET avatar = ${avatar}, is_admin = 0 WHERE username = 'admin' COLLATE NOCASE`);
      await initDB();
      await initDB();
      const admin = await readAdmin();
      assert.equal(admin.avatar, avatar);
      assert.equal(admin.is_admin, 1);
      assert.equal(admin.password, initial.password);
    }

    for (const avatar of [null, '']) {
      await db.query(sql`UPDATE users SET avatar = ${avatar} WHERE username = 'admin' COLLATE NOCASE`);
      await initDB();
      assert.equal((await readAdmin()).avatar, '🐶');
    }
    const [reader] = await db.query(sql`SELECT avatar, is_admin FROM users WHERE username = 'Leitora'`);
    assert.equal(reader.avatar, '🐼');
    assert.equal(reader.is_admin, 0);

  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dataDir, { recursive: true, force: true });
  }
});
