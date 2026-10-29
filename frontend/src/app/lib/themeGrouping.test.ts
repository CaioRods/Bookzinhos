import { describe, expect, it } from "vitest";
import { groupThemesByBook } from "./themeGrouping";

describe("groupThemesByBook", () => {
  it("separates linked themes by book and keeps unlinked themes in general", () => {
    const themes = [
      { id: "a", name: "Corte", reference: { bookId: "b1", saga: "" } },
      { id: "b", name: "Noite", reference: null },
    ] as never;
    const books = [{ id: "b1", title: "O Príncipe Cruel", coverImagePath: "/cover.jpg" }] as never;
    const groups = groupThemesByBook(themes, books);
    expect(groups[0]).toMatchObject({ id: "b1", title: "O Príncipe Cruel", coverImagePath: "/cover.jpg" });
    expect(groups[0].themes.map((theme) => theme.id)).toEqual(["a"]);
    expect(groups.at(-1)).toMatchObject({ id: "general", title: "Temas gerais" });
  });
});
