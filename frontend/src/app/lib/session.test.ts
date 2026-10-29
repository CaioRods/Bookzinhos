// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDisplayName, saveSession } from "./session";

describe("session display name", () => {
  beforeEach(() => localStorage.clear());

  it("stores a changed display name and notifies the current page", () => {
    const listener = vi.fn();
    window.addEventListener("mybooks:session", listener, { once: true });
    saveSession({ username: "ana", displayName: "Ana Nova" });
    expect(getDisplayName()).toBe("Ana Nova");
    expect(listener).toHaveBeenCalledOnce();
  });
});
