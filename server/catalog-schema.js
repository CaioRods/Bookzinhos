async function ensureCatalogImportSchema({ db }) {
  const definitions = [
    ['ipr', 'INTEGER NOT NULL DEFAULT 90'],
    ['source_name', "TEXT NOT NULL DEFAULT ''"],
    ['source_url', "TEXT NOT NULL DEFAULT ''"],
    ['license_status', "TEXT NOT NULL DEFAULT ''"],
    ['pdf_sha256', "TEXT NOT NULL DEFAULT ''"],
    ['imported_at', 'INTEGER'],
  ];
  let columns = await db.query('PRAGMA table_info(books)');
  let addedIpr = false;
  for (const [name, definition] of definitions) {
    if (!columns.some((column) => column.name === name)) {
      try {
        await db.query({ text: `ALTER TABLE books ADD COLUMN ${name} ${definition}`, values: [] });
        if (name === 'ipr') addedIpr = true;
      } catch (error) {
        const refreshed = await db.query('PRAGMA table_info(books)');
        if (!refreshed.some((column) => column.name === name)) throw error;
      }
      columns = await db.query('PRAGMA table_info(books)');
    }
  }
  if (addedIpr) {
    await db.query({ text: "UPDATE books SET ipr = 80 + (ABS(LENGTH(title) * 7 + LENGTH(author) * 3) % 21) WHERE imported_at IS NULL", values: [] });
  }
  await db.query({ text: "CREATE UNIQUE INDEX IF NOT EXISTS idx_books_pdf_sha256 ON books(pdf_sha256) WHERE pdf_sha256 <> ''", values: [] });
}

module.exports = { ensureCatalogImportSchema };
