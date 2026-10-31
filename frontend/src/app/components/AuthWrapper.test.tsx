// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthWrapper } from "./AuthWrapper";

const session = vi.hoisted(() => ({
  username: null as string | null,
  guest: false,
  privacyRequired: false,
  privacyAcceptedVersion: "2026-10-30",
}));
vi.mock("../lib/session", () => ({
  getUsername: () => session.username,
  isGuest: () => session.guest,
  enterGuestMode: () => {
    session.guest = true;
  },
  saveSession: (profile: { username: string; privacyAcceptedVersion?: string }) => {
    session.username = profile.username;
    session.privacyAcceptedVersion = profile.privacyAcceptedVersion || "";
    window.dispatchEvent(new Event("mybooks:session"));
  },
  clearSession: () => { session.username = null; window.dispatchEvent(new Event("mybooks:session")); },
  getPrivacyAcceptedVersion: () => session.privacyAcceptedVersion,
  savePrivacyAcceptedVersion: (version: string) => { session.privacyAcceptedVersion = version; window.dispatchEvent(new Event("mybooks:session")); },
}));
vi.mock("../lib/api", () => ({
  getAuthenticatedSession: async () => session.username ? { username: session.username, privacyAcceptedVersion: session.privacyAcceptedVersion, privacyRequired: session.privacyRequired } : null,
  acceptPrivacyPolicy: async () => { session.privacyRequired = false; return { version: "2026-10-30", acceptedAt: Date.now() }; },
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
  session.privacyRequired = false;
  session.privacyAcceptedVersion = "2026-10-30";
  sessionStorage.clear();
});
afterEach(cleanup);
describe("authenticated opening", () => {
  it("prepares the app beneath the opening for an existing session and dismisses it", async () => {
    session.username = "ExistingReader";
    app();
    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
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
  it("plays after a successful login and replays after logging in again", async () => {
    const view = app();
    fireEvent.click(await screen.findByText("Entrar na conta"));
    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
    fireEvent.click(screen.getByText("Finalizar abertura"));
    view.unmount();
    session.username = null;
    app();
    fireEvent.click(await screen.findByText("Entrar na conta"));
    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
  });
  it("does not interrupt guest browsing", async () => {
    app();
    fireEvent.click(await screen.findByText("Visitar"));
    expect(screen.queryByText("Finalizar abertura")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Biblioteca pronta" }),
    ).toBeTruthy();
  });
  it.each(["", "2020-01-01"])("never asks existing accounts to accept again, even with version %s", async (version) => {
    session.username = "ExistingReader";
    session.privacyAcceptedVersion = version;
    app();
    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Política de Privacidade" })).toBeNull();
  });
  it("blocks a new account until the current privacy policy is read and accepted", async () => {
    session.username = "NewReader";
    session.privacyRequired = true;
    session.privacyAcceptedVersion = "";
    const view = app();

    expect(await screen.findByRole("dialog", { name: "Política de Privacidade" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Biblioteca pronta", hidden: true })).toBeTruthy();
    expect(document.querySelector(".mb-authenticated-app")?.getAttribute("aria-hidden")).toBe("true");

    const accept = screen.getByRole("button", { name: "Li e aceito" }) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    const documentReader = screen.getByTestId("privacy-document");
    Object.defineProperties(documentReader, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, value: 800, writable: true },
    });
    fireEvent.scroll(documentReader);
    expect(accept.disabled).toBe(false);
    fireEvent.click(accept);

    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Política de Privacidade" })).toBeNull();
    view.unmount();
    session.privacyAcceptedVersion = "older-version";
    app();
    expect(await screen.findByText("Finalizar abertura")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Política de Privacidade" })).toBeNull();
  });
});
