// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterBookSelector, toggleCharacterBook } from "./CharacterBookSelector";
import type { Book } from "../lib/types";
const books = [
  { id: "a", title: "Príncipe", author: "Holly", seriesId: "s", seriesName: "Saga" },
  { id: "b", title: "Rei", author: "Holly", seriesId: "s", seriesName: "Saga" },
  { id: "c", title: "Outro", author: "Alguém", seriesId: null },
] as Book[];
afterEach(cleanup);
it("selects the entire saga and lets individual volumes be deselected", () => {
  const all = toggleCharacterBook(books, ["c"], books[0]);
  expect(all).toEqual(["c", "a", "b"]);
  expect(toggleCharacterBook(books, all, books[1])).toEqual(["c", "a"]);
  expect(toggleCharacterBook(books, [], books[2])).toEqual(["c"]);
});
it("opens a searchable multi-select modal and selects volumes outside the search result", () => {
  const update = vi.fn();
  render(<CharacterBookSelector books={books} value={[]} onChange={update}/>);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar livros (0)" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar livros" }), { target: { value: "principe" } });
  expect(screen.queryByRole("checkbox", { name: "Rei" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Príncipe" }));
  expect(update).toHaveBeenCalledWith(["a", "b"]);
});
