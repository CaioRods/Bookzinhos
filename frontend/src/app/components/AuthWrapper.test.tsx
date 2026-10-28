// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthWrapper } from "./AuthWrapper";

const session = vi.hoisted(() => ({
  username: null as string | null,
  guest: false,
}));
vi.mock("../lib/session", () => ({
  getUsername: () => session.username,
  isGuest: () => session.guest,
  enterGuestMode: () => {
    session.guest = true;
  },
}));
vi.mock("../pages/Login", () => ({
  Login: ({
    onLoginSuccess,
    onGuest,
  }: {
    onLoginSuccess: (name: string) => void;
    onGuest: () => void;
  }) => (
    <>
      <button
        onClick={() => {
          session.username = "LoginReader";
          window.dispatchEvent(new Event("mybooks:session"));
          onLoginSuccess("LoginReader");
        }}
      >
        Entrar na conta
      </button>
      <button onClick={onGuest}>Visitar</button>
    </>
  ),
}));
vi.mock("./BookOpening", () => ({
  BookOpening: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Finalizar abertura</button>
  ),
}));
const app = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AuthWrapper />}>
          <Route index element={<h1>Biblioteca pronta</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  session.username = null;
  session.guest = false;
  sessionStorage.clear();
});
afterEach(cleanup);
describe("authenticated opening", () => {
  it("prepares the app beneath the opening for an existing session and dismisses it", () => {
    session.username = "ExistingReader";
    app();
    expect(screen.getByText("Finalizar abertura")).toBeTruthy();
    expect(
      document
        .querySelector(".mb-authenticated-app")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
    fireEvent.click(screen.getByText("Finalizar abertura"));
    expect(screen.queryByText("Finalizar abertura")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Biblioteca pronta" }),
    ).toBeTruthy();
  });
  it("plays after a successful login and replays after logging in again", () => {
    const view = app();
    fireEvent.click(screen.getByText("Entrar na conta"));
    expect(screen.getByText("Finalizar abertura")).toBeTruthy();
    fireEvent.click(screen.getByText("Finalizar abertura"));
    view.unmount();
    session.username = null;
    app();
    fireEvent.click(screen.getByText("Entrar na conta"));
    expect(screen.getByText("Finalizar abertura")).toBeTruthy();
  });
  it("does not interrupt guest browsing", () => {
    app();
    fireEvent.click(screen.getByText("Visitar"));
    expect(screen.queryByText("Finalizar abertura")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Biblioteca pronta" }),
    ).toBeTruthy();
  });
});
