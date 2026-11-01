// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PdfCanvas } from "./PdfCanvas";
import { pdfResolution, schedulePdfRender } from "../lib/pdfRendering";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("caps the overview but retains retina detail at calibrated zoom", () => {
  expect(pdfResolution(2000, 3000, 3, 2)).toBe(6);
  expect(pdfResolution(2000, 3000, 4, 2)).toBe(8);
  const overview = pdfResolution(2000, 3000, 3, 2, true);
  expect(2000 * 3000 * overview ** 2).toBeLessThanOrEqual(1_000_001);
});
it("limits worker concurrency for simultaneous tile requests", async () => {
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 8 }, () => schedulePdfRender(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
  })));
  expect(peak).toBe(2);
});
it("bounds tile canvases and releases them when offscreen", async () => {
  const observers: { callback: (entries: { isIntersecting: boolean }[]) => void }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    constructor(public callback: (entries: { isIntersecting: boolean }[]) => void) { observers.push(this); }
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  const draws: any[] = [];
  const doc = { getPage: vi.fn(async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }), render: (args: any) => { draws.push(args); return { promise: Promise.resolve(), cancel: vi.fn() }; } })) };
  const view = render(<PdfCanvas doc={doc} pageNumber={1} width={1500} aspect={1.5} filter="none" />);
  await waitFor(() => expect(draws.length).toBe(13));
  await waitFor(() => expect(view.container.querySelectorAll("canvas")).toHaveLength(13));
  for (const canvas of [...view.container.querySelectorAll("canvas")].slice(1)) {
    expect(canvas.width).toBeLessThanOrEqual(1024); expect(canvas.height).toBeLessThanOrEqual(1024);
  }
  act(() => observers.forEach(observer => observer.callback([{ isIntersecting: false }])));
  await waitFor(() => expect(view.container.querySelectorAll("canvas")).toHaveLength(1));
});
