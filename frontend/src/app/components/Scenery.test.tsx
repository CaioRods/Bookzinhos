// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Book } from "../lib/types";
import { ScenePicker } from "./Scenery";
const { update, saveTheme } = vi.hoisted(() => ({ update: vi.fn(), saveTheme: vi.fn().mockResolvedValue({}) }));
vi.mock("../lib/appearanceApi", () => ({ saveProfileTheme: saveTheme, deleteTheme: vi.fn() }));
vi.mock("../lib/authGate", () => ({ requireAuth: () => true }));
vi.mock("../lib/settings", () => ({ useSettings: () => [{ scene: "one" }, update] }));
vi.mock("../lib/session", () => ({ getUsername: () => "ana", isAdmin: () => false }));
vi.mock("../lib/api", () => ({ fetchBooks: async () => [{ id: "book1", title: "O Povo do Ar", coverImagePath: "/cover.jpg" }] }));
vi.mock("../lib/themeCatalog", () => ({ DEFAULT_THEMES: [], useThemeCatalog: () => ({ themes: [{ id: "one", name: "Jardim", scope: "system", mainColor: "#456789", profile: { x: 25, y: 40, zoom: 1.5 }, sidebar: { x: 80, y: 60, zoom: 2 }, sidebarOpacity: .6, reference: { bookId: "book1" } }, { id: "two", name: "Entardecer", scope: "system", mainColor: "#456789", profile: { x: 25, y: 40, zoom: 1.5 }, sidebar: { x: 80, y: 60, zoom: 2 }, sidebarOpacity: .6, reference: { bookId: "book1" } }], upsert: vi.fn(), remove: vi.fn() }) }));
vi.mock("./ThemeImage", () => ({ sourceSize: () => ({ width: 1536, height: 1024 }), ThemeImage: () => <svg data-testid="banner"/> }));
vi.mock("./ThemeEditor", () => ({ ThemeEditor: ({ theme }: { theme: { name: string } | null }) => <div role="dialog" aria-label={`Editar ${theme?.name || "novo tema"}`}/> }));
afterEach(cleanup);
it("opens only on request, groups themes behind book covers and keeps names below banners", async () => {
  render(<ScenePicker/>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new Event("mybooks:open-personalization")));
  let dialog = screen.getByRole("dialog", { name: "Escolha seu cenário" });
  fireEvent.click(await within(dialog).findByRole("button", { name: "O Povo do Ar 2 temas disponíveis" }));
  const banner = within(dialog).getByRole("button", { name: "Usar tema Entardecer" });
  expect(banner).not.toHaveTextContent("Entardecer");
  expect(within(banner).getAllByTestId("banner")).toHaveLength(2);
  expect(banner.querySelector(".mb-theme-profile-preview")).toHaveStyle({ "--primary": "#456789" });
  expect(banner.querySelector(".mb-theme-preview-sidebar-art .mb-crop-image-layer")).toHaveStyle({ opacity: "0.6" });
  expect(within(dialog).getByRole("heading", { name: "Entardecer" })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Ver imagem completa de Entardecer" }));
  const fullImage = screen.getByRole("dialog", { name: "Imagem completa · Entardecer" });
  expect(within(fullImage).getByTestId("banner")).toBeInTheDocument();
  fireEvent.click(within(fullImage).getByRole("button", { name: "Fechar" }));
  dialog = screen.getByRole("dialog", { name: "Escolha seu cenário" });
  fireEvent.click(screen.getByRole("button", { name: "Usar tema Entardecer" })); expect(update).toHaveBeenCalledWith({ scene: "two" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Todos os livros" }));
  expect(within(dialog).getByRole("button", { name: "O Povo do Ar 2 temas disponíveis" })).toBeInTheDocument();
});

it("opens the current theme editor directly from the profile event", () => {
  render(<ScenePicker/>);
  act(() => window.dispatchEvent(new Event("mybooks:edit-current-theme")));
  expect(screen.getByRole("dialog", { name: "Editar Jardim" })).toBeInTheDocument();
});

it("only offers linked book themes and persists the selected profile theme", async () => {
  update.mockClear(); saveTheme.mockClear();
  const { rerender } = render(<ScenePicker book={{ id: "unlinked", title: "Sem tema" } as Book}/>);
  expect(screen.queryByRole("button", { name: "Temas deste livro" })).not.toBeInTheDocument();
  rerender(<ScenePicker book={{ id: "book1", title: "O Povo do Ar" } as Book}/>);
  fireEvent.click(screen.getByRole("button", { name: "Temas deste livro" }));
  const modal = screen.getByRole("dialog", { name: "Temas de O Povo do Ar" });
  expect(within(modal).queryByRole("button", { name: "Todos os livros" })).not.toBeInTheDocument();
  fireEvent.click(within(modal).getByRole("button", { name: "Usar tema Entardecer" }));
  await waitFor(() => expect(saveTheme).toHaveBeenCalledWith("two"));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ scene: "two" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
