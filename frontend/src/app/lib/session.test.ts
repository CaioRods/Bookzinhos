// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAvatar, getBio, getDisplayName, getPrivacyAcceptedVersion, getShelf, saveSession } from "./session";

describe("session display name", () => {
  beforeEach(() => localStorage.clear());

  it("stores a changed display name and notifies the current page", () => {
    const listener = vi.fn();
    window.addEventListener("mybooks:session", listener, { once: true });
    saveSession({ username: "ana", displayName: "Ana Nova" });
    expect(getDisplayName()).toBe("Ana Nova");
    expect(listener).toHaveBeenCalledOnce();
  });
  it("keeps the edited display name when a partial session refresh omits it", () => {
    saveSession({ username: "ana", displayName: "Ana Nova" });
    saveSession({ username: "ana", avatar: "🐼" });
    expect(getDisplayName()).toBe("Ana Nova");
    saveSession({ username: "outra" });
    expect(getDisplayName()).toBe("outra");
  });

  it("clears the previous account's visual data when switching accounts", () => {
    saveSession({ username: "ana", avatar: "/ana.webp", bio: "Privado", shelf: ["book-ana"], privacyAcceptedVersion: "2026-10-30" });
    saveSession({ username: "outra" });
    expect(getAvatar()).toBe("🐼");
    expect(getBio()).toBe("");
    expect(getShelf()).toEqual([]);
    expect(getPrivacyAcceptedVersion()).toBe("");
  });

  it("retains same-account data across casing changes and partial refreshes", () => {
    saveSession({ username: "Ana", avatar: "/ana.webp", bio: "Minha bio", shelf: ["book-ana"] });
    saveSession({ username: "ana" });
    expect(getAvatar()).toBe("/ana.webp");
    expect(getBio()).toBe("Minha bio");
    expect(getShelf()).toEqual(["book-ana"]);
  });
});
