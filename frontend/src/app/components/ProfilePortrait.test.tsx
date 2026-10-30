// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfilePortrait, ProfileMetrics } from "./ProfilePortrait";
import { NO_THEME } from "../lib/themeCatalog";
import type { ProgressionSummary, UserProfile } from "../lib/types";
vi.mock("./ThemeImage", () => ({ ThemeImage: () => null }));
const profile: UserProfile = {
  username: "Reader",
  displayName: "Nome do leitor",
  handle: "leitor",
  bio: "Minha história",
  avatar: "🐼",
  shelf: [],
  pandinhas: 0,
  instagram: "reader",
};
const progression: ProgressionSummary = {
  level: 3,
  title: "Explorador",
  totalXp: 50,
  currentLevelXp: 0,
  nextLevelXp: 100,
  badges: [],
  boostUntil: 0,
  stats: { activeSeconds: 0, finished: 0, published: 0, reviews: 0 },
};
afterEach(cleanup);
describe("shared profile portrait", () => {
  it("keeps the owner's editing actions connected", () => {
    const edit = vi.fn(),
      scene = vi.fn();
    render(
      <ProfilePortrait
        profile={profile}
        theme={NO_THEME}
        own
        progression={progression}
        onEdit={edit}
        onChangeScene={scene}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Editar avatar e perfil" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Alterar cenário" }));
    expect(edit).toHaveBeenCalledOnce();
    expect(scene).toHaveBeenCalledOnce();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
  it("never shows editing actions or private XP on a public portrait", () => {
    render(
      <ProfilePortrait
        profile={profile}
        theme={NO_THEME}
        progression={progression}
        onEdit={vi.fn()}
        onChangeScene={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Alterar cenário" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Editar avatar e perfil" }),
    ).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("img", { name: "Nível público 3" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Nome do leitor" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Instagram/ }).getAttribute("href"),
    ).toBe("https://instagram.com/reader");
  });
  it("shows all six real reading and community statistics", () => {
    render(
      <ProfileMetrics
        addedBooks={5}
        reading={4}
        finished={12}
        favorites={7}
        followers={2}
        following={3}
      />,
    );
    for (const label of [
      "Livros adicionados",
      "Lendo no momento",
      "Livros concluídos",
      "Favoritos",
      "Seguidores",
      "Seguindo",
    ])
      expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });
});
