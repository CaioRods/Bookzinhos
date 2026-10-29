// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const progression = { totalXp: 125, level: 10, title: "Aprendiz", currentLevelXp: 100, nextLevelXp: 300, boostUntil: 0, stats: { activeSeconds: 0, finished: 0, published: 0, reviews: 0 }, badges: [] };

describe("AccountMenu", () => {
  afterEach(cleanup);
  it("shows account actions and hides administrator for regular readers", () => {
    render(<MemoryRouter><AccountMenu avatar="🐼" username="Ana" admin={false} progression={progression} onLogout={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /conta de ana/i }));
    expect(screen.getByRole("menuitem", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Administrador" })).not.toBeInTheDocument();
  });

  it("shows admin and invokes logout", () => {
    const logout = vi.fn();
    render(<MemoryRouter><AccountMenu avatar="🐶" username="Admin" admin progression={progression} onLogout={logout} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /conta de admin/i }));
    expect(screen.getByRole("menuitem", { name: "Administrador" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sair" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("renders an uploaded avatar as an image without nesting a profile link", () => {
    render(<MemoryRouter><AccountMenu avatar="/uploads/ana.webp" username="Ana" admin={false} progression={progression} onLogout={() => {}} /></MemoryRouter>);
    const trigger = screen.getByRole("button", { name: /conta de ana/i });
    expect(trigger.querySelector("img")).toBeInTheDocument();
    expect(trigger.querySelector("a")).not.toBeInTheDocument();
  });
});
