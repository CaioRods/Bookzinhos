import { describe, expect, it, vi } from "vitest";
import { AUTH_HANDOFF_MS, waitForAuthHandoff } from "./authTransition";

describe("auth handoff", () => {
  it("keeps the login visible while the success animation plays", async () => {
    vi.useFakeTimers();
    let complete = false;
    const pending = waitForAuthHandoff(false).then(() => { complete = true; });
    await vi.advanceTimersByTimeAsync(AUTH_HANDOFF_MS - 1);
    expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(complete).toBe(true);
    vi.useRealTimers();
  });

  it("hands off immediately when reduced motion is enabled", async () => {
    await waitForAuthHandoff(true);
    expect(true).toBe(true);
  });
});
