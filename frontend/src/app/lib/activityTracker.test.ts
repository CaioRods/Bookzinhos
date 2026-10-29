import { describe, expect, it, vi } from "vitest";
import { createActivityTracker } from "./activityTracker";

describe("activity tracker", () => {
  it("pauses after ten idle minutes and resumes after interaction", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const tracker = createActivityTracker({ idleMs: 600_000, heartbeatMs: 30_000, send, visible: () => true });
    tracker.start();
    vi.advanceTimersByTime(600_001);
    const stoppedAt = send.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(stoppedAt);
    tracker.interact();
    vi.advanceTimersByTime(30_000);
    expect(send).toHaveBeenCalledTimes(stoppedAt + 1);
    tracker.stop();
    vi.useRealTimers();
  });
});
