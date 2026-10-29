const HANDLE_CHANGE_DAYS = 30;
const HANDLE_RE = /^[a-z0-9_.]{2,20}$/;

function normalizeHandle(value) {
  const normalized = String(value || '').trim().replace(/^@+/, '').toLowerCase();
  return HANDLE_RE.test(normalized) ? normalized : null;
}

function canChangeHandle(lastChangedAt, now = Date.now()) {
  const changed = Number(lastChangedAt) || 0;
  return changed === 0 || now - changed >= HANDLE_CHANGE_DAYS * 86400000;
}

function normalizeGenres(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const genre = String(value || '').trim().slice(0, 40);
    if (!genre || out.some((item) => item.toLocaleLowerCase('pt-BR') === genre.toLocaleLowerCase('pt-BR'))) continue;
    out.push(genre);
    if (out.length === 12) break;
  }
  return out;
}

module.exports = { HANDLE_CHANGE_DAYS, normalizeHandle, canChangeHandle, normalizeGenres };
