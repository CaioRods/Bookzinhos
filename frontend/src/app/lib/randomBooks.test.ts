import { describe, expect, it } from "vitest";
import { pickDistinctBooks } from "./randomBooks";

const books = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("pickDistinctBooks", () => {
  it("returns distinct books without mutating the catalog", () => {
    const original = books.map((book) => book.id);
    const selected = pickDistinctBooks(books, 3, () => 0);

    expect(selected.map((book) => book.id)).toEqual(["b", "c", "d"]);
    expect(new Set(selected.map((book) => book.id)).size).toBe(3);
    expect(books.map((book) => book.id)).toEqual(original);
  });

  it("returns every available book when fewer than requested exist", () => {
    const selected = pickDistinctBooks(books.slice(0, 2), 3, () => 0.5);
    expect(selected).toHaveLength(2);
    expect(new Set(selected.map((book) => book.id))).toEqual(new Set(["a", "b"]));
  });
});
