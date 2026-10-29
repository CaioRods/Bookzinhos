import { describe, expect, it } from "vitest";
import { selectLoginShowcase } from "./loginShowcase";
import type { Book } from "./types";

const book = (id: string, cover: string | null, addedAt: number) => ({
  id,
  title: `Livro ${id}`,
  author: `Autor ${id}`,
  coverImagePath: cover,
  addedAt,
  isPublic: true,
}) as Book;

describe("login cover showcase", () => {
  it("keeps a deterministic set of five public books with usable covers", () => {
    const books = [
      book("old", "/old.jpg", 1),
      book("private", "/private.jpg", 20),
      book("missing", null, 30),
      book("one", "/one.jpg", 9),
      book("two", "/two.jpg", 8),
      book("three", "/three.jpg", 7),
      book("four", "/four.jpg", 6),
      book("five", "/five.jpg", 5),
      book("six", "/six.jpg", 4),
    ];
    books[1].isPublic = false;

    expect(selectLoginShowcase(books).map(({ id }) => id)).toEqual(["one", "two", "three", "four", "five"]);
  });
});
