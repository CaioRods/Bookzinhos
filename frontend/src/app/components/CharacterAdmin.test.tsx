// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CharacterAdmin } from "./CharacterAdmin";
const mocks = vi.hoisted(() => ({ admin: false, create: vi.fn().mockResolvedValue({}), catalog: [{ id: "public", name: "Jude", imageUrl: "/j.webp", scope: "system", bookIds: ["a"] }] }));
vi.mock("../lib/session", () => ({ isAdmin: () => mocks.admin, getUsername: () => "Ana" }));
vi.mock("../lib/api", () => ({ createCharacter: mocks.create, fetchBooks: async () => [], fetchCharacters: async () => ({ characters: mocks.catalog }), deleteCharacter: vi.fn(), decideCharacter: vi.fn(), submitCharacter: vi.fn() }));
vi.mock("./AvatarCropper", () => ({ AvatarCropper: () => <div>Recorte</div>, cropAvatar: async () => new Blob(["image"], { type: "image/webp" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.admin = false; mocks.create.mockClear(); });
it("lets a member create a personal avatar and request publication without editing public characters", async () => {
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:test"); static revokeObjectURL = vi.fn(); });
  render(<CharacterAdmin personal/>);
  expect(screen.queryByRole("button", { name: "Editar Jude" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Personagem" }), { target: { value: "Cardan" } });
  fireEvent.change(screen.getByLabelText("Foto"), { target: { files: [new File(["image"], "a.webp", { type: "image/webp" })] } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Solicitar ao admin que libere este avatar para todos" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar avatar" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Cardan", scope: "personal", requestPublication: true, image: expect.any(Blob) })));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("lets the admin edit the existing avatar without requiring another upload", async () => {
  mocks.admin = true;
  render(<CharacterAdmin/>);
  fireEvent.click(await screen.findByRole("button", { name: "Editar Jude" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Personagem" }), { target: { value: "Jude Duarte" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar avatar" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Jude Duarte", characterId: "public", scope: "system", image: undefined })));
});
