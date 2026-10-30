async function loadUploadedBookCount({ db, sql, username }) {
  const [row] = await db.query(sql`SELECT COUNT(*) AS total FROM books WHERE uploaded_by = ${username} COLLATE NOCASE`);
  return Number(row?.total) || 0;
}
module.exports = { loadUploadedBookCount };
