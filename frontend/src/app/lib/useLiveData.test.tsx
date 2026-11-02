// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveData } from "./useLiveData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("live data lifecycle", () => {
  it("ignores an old route's response and error after dependencies change", async () => {
    const old = deferred<string>();
    const current = deferred<string>();
    const hook = renderHook(({ id }) => useLiveData(() => id === "old" ? old.promise : current.promise, [id]), { initialProps: { id: "old" } });
    hook.rerender({ id: "current" });
    await act(async () => { current.resolve("current profile"); });
    await act(async () => { old.reject(new Error("old request failed")); });
    expect(hook.result.current.data).toBe("current profile");
    expect(hook.result.current.error).toBeNull();
  });

  it("does not let a superseded response end loading or replace current data", async () => {
    const old = deferred<string>();
    const current = deferred<string>();
    const hook = renderHook(({ id }) => useLiveData(() => id === "old" ? old.promise : current.promise, [id]), { initialProps: { id: "old" } });
    hook.rerender({ id: "current" });
    await act(async () => { old.resolve("wrong profile"); });
    expect(hook.result.current.data).toBeNull();
    expect(hook.result.current.isLoading).toBe(true);
    await act(async () => { current.resolve("right profile"); });
    expect(hook.result.current.data).toBe("right profile");
  });

  it("coalesces focus, timer and manual refreshes while a request is pending", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const loader = vi.fn(() => pending.promise);
    const hook = renderHook(() => useLiveData(loader, [], { intervalMs: 1000, focusThrottleMs: 0 }));
    act(() => { vi.advanceTimersByTime(5000); window.dispatchEvent(new Event("focus")); });
    let refresh!: Promise<void>;
    act(() => { refresh = hook.result.current.reload(); });
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("ready"); await refresh; });
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("responds to enabled changes without getting stuck loading", async () => {
    const loader = vi.fn(async () => "ready");
    const hook = renderHook(({ enabled }) => useLiveData(loader, [], { enabled }), { initialProps: { enabled: false } });
    expect(hook.result.current.isLoading).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    await act(async () => { hook.rerender({ enabled: true }); });
    expect(hook.result.current.data).toBe("ready");
    expect(loader).toHaveBeenCalledOnce();
  });

  it("preserves optimistic edits when a pending refresh completes", async () => {
    const pending = deferred<string>();
    const hook = renderHook(() => useLiveData(() => pending.promise));
    act(() => hook.result.current.setData("edited"));
    await act(async () => { pending.resolve("old server value"); });
    expect(hook.result.current.data).toBe("edited");
  });

  it("can retry after a loader throws synchronously", async () => {
    const loader = vi.fn<() => Promise<string>>()
      .mockImplementationOnce(() => { throw new Error("temporary failure"); })
      .mockResolvedValue("recovered");
    const hook = renderHook(() => useLiveData(loader));
    await act(async () => {});
    await act(async () => { await hook.result.current.reload(); });
    expect(hook.result.current.data).toBe("recovered");
    expect(hook.result.current.error).toBeNull();
  });

  it("starts a fresh reload after an optimistic edit instead of joining stale work", async () => {
    const old = deferred<string>();
    const loader = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue("confirmed edit");
    const hook = renderHook(() => useLiveData<string>(loader));
    act(() => hook.result.current.setData("edited"));
    await act(async () => { await hook.result.current.reload(); });
    await act(async () => { old.resolve("before edit"); });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(hook.result.current.data).toBe("confirmed edit");
  });
});
