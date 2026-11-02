import { describe, expect, it, vi } from "vitest";
import { createActivityTracker } from "./activityTracker";

describe("activity tracker", () => {
  it("counts the whole interval even with frequent interaction", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const tracker = createActivityTracker({ send, visible: () => true });
    tracker.start();
    for (let i = 0; i < 5; i++) { vi.advanceTimersByTime(5000); tracker.interact(); }
    vi.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledWith(30);
    tracker.stop();
    vi.useRealTimers();
  });
  it("does not include hidden-tab time when the tab becomes visible again", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    let visible = false;
    const tracker = createActivityTracker({ send, visible: () => visible });
    tracker.start();
    vi.advanceTimersByTime(300000);
    visible = true;
    vi.advanceTimersByTime(30000);
    expect(send).toHaveBeenCalledWith(30);
    tracker.stop();
    vi.useRealTimers();
  });
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
