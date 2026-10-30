// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeCatalogProvider, useThemeCatalog } from "./themeCatalog";

const fetchThemes = vi.hoisted(() => vi.fn());
vi.mock("./appearanceApi", () => ({ fetchThemes }));
vi.mock("./session", () => ({ getUsername: () => "Jude" }));

function ThemeNames() {
  const { themes } = useThemeCatalog();
  return <div>{themes.map((theme) => <span key={theme.id}>{theme.name}</span>)}</div>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("theme catalog privacy recovery", () => {
  it("reloads saved themes immediately after privacy acceptance unlocks the API", async () => {
    fetchThemes
      .mockRejectedValueOnce(new Error("Leia e aceite a Política de Privacidade para continuar."))
      .mockResolvedValueOnce([{
        id: "cruel-prince",
        name: "O Príncipe Cruel",
        scope: "system",
        imageUrl: "/uploads/cruel-prince.webp",
        width: 1536,
        height: 1024,
        atlas: null,
        mainColor: "#31402f",
        profile: { x: 0, y: 0, zoom: 1 },
        sidebar: { x: 0, y: 0, zoom: 1 },
        sidebarOpacity: 0.8,
      }]);

    render(<ThemeCatalogProvider><ThemeNames /></ThemeCatalogProvider>);
    await waitFor(() => expect(fetchThemes).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("O Príncipe Cruel")).toBeNull();

    window.dispatchEvent(new Event("mybooks:privacy-accepted"));

    expect(await screen.findByText("O Príncipe Cruel")).toBeTruthy();
  });
});
