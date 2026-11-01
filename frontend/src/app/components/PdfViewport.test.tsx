// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PdfViewport } from "./PdfViewport";
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0)); vi.stubGlobal("cancelAnimationFrame", clearTimeout); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("pans at 100% and retains the exact camera when the page changes", () => {
  const onZoom = vi.fn();
  const view = render(<PdfViewport zoom={1} onZoom={onZoom}><div>Page 1</div></PdfViewport>);
  const surface = view.container.querySelector<HTMLElement>("[data-pdf-camera]")!;
  surface.setPointerCapture = vi.fn();
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerType: "mouse", button: 0, pointerId: 1, clientX: x, clientY: y });
    surface.dispatchEvent(event);
  };
  act(() => { pointer("pointerdown", 400, 300); pointer("pointermove", 610, 180); pointer("pointerup", 610, 180); vi.runOnlyPendingTimers(); });
  const content = view.container.querySelector<HTMLElement>("[data-pdf-content]")!;
  expect(content.dataset.pdfPanX).toBe("210"); expect(content.dataset.pdfPanY).toBe("-120");
  const transform = content.style.transform;
  view.rerender(<PdfViewport zoom={1} onZoom={onZoom}><div>Page 2</div></PdfViewport>);
  expect(content.style.transform).toBe(transform);
});
it("anchors wheel zoom on the mouse position and batches raster-resolution updates", () => {
  const onZoom = vi.fn();
  const view = render(<PdfViewport zoom={1} onZoom={onZoom}>Page</PdfViewport>);
  const surface = view.container.querySelector<HTMLElement>("[data-pdf-camera]")!;
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 800 } as DOMRect);
  act(() => {
    const event = new WheelEvent("wheel", { ctrlKey: true, deltaY: -100, clientX: 700, clientY: 300, cancelable: true });
    surface.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); vi.advanceTimersByTime(1);
  });
  const content = view.container.querySelector<HTMLElement>("[data-pdf-content]")!;
  const zoom = Number(content.dataset.pdfZoom);
  expect(200 * zoom + Number(content.dataset.pdfPanX)).toBeCloseTo(200);
  expect(-100 * zoom + Number(content.dataset.pdfPanY)).toBeCloseTo(-100);
  expect(onZoom).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(120)); expect(onZoom).toHaveBeenCalledExactlyOnceWith(zoom);
});
it("smooths wheel zoom while keeping the cursor anchored at every frame and committing once", () => {
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  const onZoom = vi.fn();
  const view = render(<PdfViewport zoom={1} smoothZoom onZoom={onZoom}>Page</PdfViewport>);
  const surface = view.container.querySelector<HTMLElement>("[data-pdf-camera]")!;
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1000, height: 800 } as DOMRect);
  const content = view.container.querySelector<HTMLElement>("[data-pdf-content]")!;
  act(() => surface.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -100, clientX: 700, clientY: 300, cancelable: true })));
  expect(Number(content.dataset.pdfZoom)).toBe(1);
  for (let frame = 0; frame < 10; frame++) {
    act(() => vi.advanceTimersByTime(16));
    const zoom = Number(content.dataset.pdfZoom);
    expect(200 * zoom + Number(content.dataset.pdfPanX)).toBeCloseTo(200);
    expect(-100 * zoom + Number(content.dataset.pdfPanY)).toBeCloseTo(-100);
    if (frame < 9) { expect(zoom).toBeLessThan(Math.exp(0.3)); expect(onZoom).not.toHaveBeenCalled(); }
  }
  expect(onZoom).toHaveBeenCalledExactlyOnceWith(Math.exp(0.3));
  expect(surface.dataset.pdfInteracting).toBe("false");
});
