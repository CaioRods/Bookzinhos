// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clampPdfZoom, installPdfZoom } from "./pdfZoom";
let stage: HTMLElement, dispose: () => void;
const commit = vi.fn();
const touch = (type: string, points: number[][]) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { touches: points.map(([clientX, clientY]) => ({ clientX, clientY })) });
  stage.dispatchEvent(event); return event;
};
beforeEach(() => {
  vi.useFakeTimers(); commit.mockClear();
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 0));
  stage = document.createElement("div");
  stage.innerHTML = '<div data-pdf-scroll><div data-pdf-content></div></div>';
  document.body.append(stage);
  dispose = installPdfZoom(stage, { getScale: () => 1, commit });
});
afterEach(() => { dispose(); stage.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("previews pinch without committing a redraw until release", () => {
  touch("touchstart", [[0, 0], [100, 0]]);
  expect(touch("touchmove", [[0, 0], [200, 0]]).defaultPrevented).toBe(true);
  expect(stage.querySelector<HTMLElement>("[data-pdf-content]")!.style.transform).toBe("scale(2)");
  expect(commit).not.toHaveBeenCalled();
  touch("touchend", []); expect(commit).toHaveBeenCalledExactlyOnceWith(2);
  expect(stage.querySelector<HTMLElement>("[data-pdf-content]")!.style.transform).toBe("");
});
it("preserves normal wheel scrolling and batches Ctrl+wheel zoom", () => {
  const wheel = (ctrlKey: boolean) => { const event = new WheelEvent("wheel", { deltaY: -50, ctrlKey, cancelable: true }); stage.dispatchEvent(event); return event; };
  expect(wheel(false).defaultPrevented).toBe(false);
  expect(wheel(true).defaultPrevented).toBe(true);
  wheel(true); expect(commit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(120); expect(commit).toHaveBeenCalledOnce(); expect(commit.mock.calls[0][0]).toBeCloseTo(Math.exp(0.5));
});
it("cancels interrupted gestures and pending wheel commits on disposal", () => {
  touch("touchstart", [[0, 0], [100, 0]]); touch("touchmove", [[0, 0], [300, 0]]); touch("touchcancel", []);
  expect(commit).not.toHaveBeenCalled();
  stage.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -40 }));
  dispose(); vi.runAllTimers(); expect(commit).not.toHaveBeenCalled();
});
it("bounds zoom to 50–500%", () => { expect(clampPdfZoom(0)).toBe(0.5); expect(clampPdfZoom(20)).toBe(5); });
