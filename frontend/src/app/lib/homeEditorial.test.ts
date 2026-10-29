import { describe, expect, it } from "vitest";
import { getEditorialFeature } from "./homeEditorial";
import type { Book } from "./types";

const book = (id: string, title: string, author = "Holly Black") => ({ id, title, author }) as Book;

describe("Home editorial feature", () => {
  it("shows one book instead of creating an author banner", () => {
    const selected = book("1", "Como o Rei de Elfhame Aprendeu a Odiar Histórias");
    const feature = getEditorialFeature(selected, [selected, book("2", "As Crônicas de Spiderwick")]);
    expect(feature.eyebrow).toBe("LIVRO EM DESTAQUE");
    expect(feature.title).toBe(selected.title);
    expect(feature.description).toBe("Holly Black");
    expect(feature.books.map((entry) => entry.id)).toEqual(["1"]);
  });

  it("keeps the explicit O Povo do Ar trilogy feature", () => {
    const trilogy = [book("1", "O Príncipe Cruel"), book("2", "O Rei Perverso"), book("3", "A Rainha do Nada")];
    const feature = getEditorialFeature(trilogy[0], trilogy);
    expect(feature.eyebrow).toBe("SÉRIE EM DESTAQUE");
    expect(feature.books).toHaveLength(3);
  });
});
