// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSmoothPdfZoom } from "./smoothPdfZoom";
import { loadSettings, saveSettings } from "./settings";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });
it("moves through intermediate scales and settles exactly on the target once", () => {
  let value = 1; const values: number[] = [], settled = vi.fn();
  const animation = createSmoothPdfZoom(() => value, next => { value = next; values.push(next); }, settled);
  animation.start(2);
  expect(value).toBe(1); vi.advanceTimersByTime(80);
  expect(value).toBeGreaterThan(1); expect(value).toBeLessThan(2); expect(settled).not.toHaveBeenCalled();
  vi.advanceTimersByTime(100);
  expect(value).toBe(2); expect(settled).toHaveBeenCalledOnce(); expect(new Set(values).size).toBeGreaterThan(5);
});
it("retargets and reverses from the visible scale without a jump", () => {
  let value = 1; const settled = vi.fn();
  const animation = createSmoothPdfZoom(() => value, next => { value = next; }, settled);
  animation.start(3); vi.advanceTimersByTime(64);
  const middle = value; animation.start(0.75);
  expect(value).toBe(middle); vi.advanceTimersByTime(16);
  expect(value).toBeLessThan(middle); expect(value).toBeGreaterThan(0.75);
  vi.advanceTimersByTime(180); expect(value).toBe(0.75); expect(settled).toHaveBeenCalledOnce();
});
it("cancels frames and pending completion when stopped", () => {
  let value = 1; const settled = vi.fn();
  const animation = createSmoothPdfZoom(() => value, next => { value = next; }, settled);
  animation.start(2); vi.advanceTimersByTime(32); animation.stop();
  const stopped = value; vi.advanceTimersByTime(500);
  expect(value).toBe(stopped); expect(settled).not.toHaveBeenCalled();
});
it("keeps smooth zoom opt-in and persists its preference without changing other settings", () => {
  expect(loadSettings().smoothZoom).toBe(false);
  const original = loadSettings(); saveSettings({ ...original, smoothZoom: true });
  expect(loadSettings()).toEqual({ ...original, smoothZoom: true });
});
