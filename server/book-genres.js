/** Backward-compatible storage: one text field, containing one or more independent genres. */
function normalizeBookGenres(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;]/) : [];
  const genres = [];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const clean = item.trim().slice(0, 40);
    if (clean && !genres.some(genre => genre.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) genres.push(clean);
  }
  return genres.join(", ") || "Outros";
}
module.exports = { normalizeBookGenres };
