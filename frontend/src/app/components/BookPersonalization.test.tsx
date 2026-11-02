// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Book } from "../lib/types";
import { BookPersonalization } from "./BookPersonalization";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn(), session: vi.fn() }));
vi.mock("../lib/api", () => ({ fetchCharacters: mocks.fetch, updateProfile: mocks.update }));
vi.mock("../lib/session", () => ({ getUsername: () => "Ana", getAvatar: () => "🐼", saveSession: mocks.session }));
vi.mock("../lib/authGate", () => ({ requireAuth: () => true }));
vi.mock("../lib/offline/device", () => ({ useOffline: () => false }));
vi.mock("./Scenery", () => ({ ScenePicker: () => null }));
const book = { id: "one", title: "Livro Um" } as Book;
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("hides the profile icon when no avatars are linked", async () => {
  mocks.fetch.mockResolvedValue({ characters: [] });
  render(<BookPersonalization book={book}/>);
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("one"));
  expect(screen.queryByRole("button", { name: "Fotos de perfil deste livro" })).not.toBeInTheDocument();
});
it("offers only this book's avatars and updates only the avatar field", async () => {
  mocks.fetch.mockResolvedValue({ characters: [{ id: "jude", name: "Jude", bookIds: ["one"], imageUrl: "/jude.webp" }, { id: "other", name: "Outro", bookIds: ["two"], imageUrl: "/other.webp" }] });
  mocks.update.mockResolvedValue({ username: "Ana", avatar: "/jude.webp" });
  render(<BookPersonalization book={book}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Fotos de perfil deste livro" }));
  expect(screen.queryByRole("button", { name: "Usar foto de Outro" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Usar foto de Jude" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ avatar: "/jude.webp" }));
  await waitFor(() => expect(mocks.session).toHaveBeenCalledWith({ username: "Ana", avatar: "/jude.webp" }));
});
it("ignores an old book's response after navigation", async () => {
  let resolveOld!: (value: unknown) => void;
  mocks.fetch.mockImplementation((id: string) => id === "one" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ characters: [] }));
  const { rerender } = render(<BookPersonalization book={book}/>);
  rerender(<BookPersonalization book={{ ...book, id: "two" }}/>);
  resolveOld({ characters: [{ id: "jude", name: "Jude", bookIds: ["one"], imageUrl: "/jude.webp" }] });
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("two"));
  expect(screen.queryByRole("button", { name: "Fotos de perfil deste livro" })).not.toBeInTheDocument();
});
