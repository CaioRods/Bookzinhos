const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBookGenres } = require("../book-genres");
test("book genres preserve legacy books and normalize multiple selections", () => {
  assert.equal(normalizeBookGenres("Fantasia"), "Fantasia");
  assert.equal(normalizeBookGenres(" Fantasia, Romance; fantasia, Drama "), "Fantasia, Romance, Drama");
  assert.equal(normalizeBookGenres(["Fantasia", "Romance", "fantasia"]), "Fantasia, Romance");
  assert.equal(normalizeBookGenres(""), "Outros");
  assert.equal(normalizeBookGenres(undefined), "Outros");
});
