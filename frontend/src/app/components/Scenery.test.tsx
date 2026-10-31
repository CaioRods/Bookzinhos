// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ScenePicker } from "./Scenery";
const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../lib/settings", () => ({ useSettings: () => [{ scene: "one" }, update] }));
vi.mock("../lib/session", () => ({ getUsername: () => "ana", isAdmin: () => false }));
vi.mock("../lib/api", () => ({ fetchBooks: async () => [{ id: "book1", title: "O Povo do Ar", coverImagePath: "/cover.jpg" }] }));
vi.mock("../lib/themeCatalog", () => ({ DEFAULT_THEMES: [], useThemeCatalog: () => ({ themes: [{ id: "one", name: "Jardim", scope: "system", reference: { bookId: "book1" } }, { id: "two", name: "Entardecer", scope: "system", reference: { bookId: "book1" } }], upsert: vi.fn(), remove: vi.fn() }) }));
vi.mock("./ThemeImage", () => ({ ThemeImage: () => <svg data-testid="banner"/> }));
vi.mock("./ThemeEditor", () => ({ ThemeEditor: () => null }));
afterEach(cleanup);
it("opens only on request, groups themes behind book covers and keeps names below banners", async () => {
  render(<ScenePicker/>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new Event("mybooks:open-personalization")));
  const dialog = screen.getByRole("dialog", { name: "Escolha seu cenário" });
  fireEvent.click(await within(dialog).findByRole("button", { name: "O Povo do Ar 2 temas disponíveis" }));
  const banner = within(dialog).getByRole("button", { name: "Usar tema Entardecer" });
  expect(banner).not.toHaveTextContent("Entardecer");
  expect(within(dialog).getByRole("heading", { name: "Entardecer" })).toBeInTheDocument();
  fireEvent.click(banner); expect(update).toHaveBeenCalledWith({ scene: "two" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Todos os livros" }));
  expect(within(dialog).getByRole("button", { name: "O Povo do Ar 2 temas disponíveis" })).toBeInTheDocument();
});
