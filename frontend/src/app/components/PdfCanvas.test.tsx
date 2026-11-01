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
it("keeps old tile geometry and overview until all visible replacement tiles are ready", async () => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  let delayed = false;
  const jobs: (() => void)[] = [];
  const doc = { getPage: vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }),
    render: () => {
      let complete = () => {};
      const promise = delayed ? new Promise<void>(resolve => { complete = resolve; jobs.push(resolve); }) : Promise.resolve();
      return { promise, cancel: complete };
    },
  })) };
  const view = render(<PdfCanvas doc={doc} pageNumber={1} width={600} aspect={1.5} magnification={1} filter="none" />);
  await waitFor(() => expect(view.container.querySelectorAll("canvas")).toHaveLength(3));
  const overview = view.container.querySelector('[data-pdf-raster="overview"]');
  const oldLayer = view.container.querySelector<HTMLElement>('[data-pdf-layer-visible="true"]')!;
  const geometry = [...oldLayer.children].map(element => element.getAttribute("style"));
  delayed = true;
  view.rerender(<PdfCanvas doc={doc} pageNumber={1} width={600} aspect={1.5} magnification={2} filter="none" />);
  await waitFor(() => expect(jobs.length).toBe(2));
  expect(oldLayer.dataset.pdfLayerVisible).toBe("true");
  expect([...oldLayer.children].map(element => element.getAttribute("style"))).toEqual(geometry);
  for (let i = 0; i < 6; i++) {
    await waitFor(() => expect(jobs.length).toBeGreaterThan(i));
    await act(async () => { jobs[i](); await Promise.resolve(); });
    if (i < 5) expect(oldLayer.dataset.pdfLayerVisible).toBe("true");
  }
  await waitFor(() => expect(oldLayer.isConnected).toBe(false));
  expect(view.container.querySelector('[data-pdf-raster="overview"]')).toBe(overview);
  expect(view.container.querySelectorAll("[data-pdf-layer]")).toHaveLength(1);
  expect(view.container.querySelectorAll("canvas")).toHaveLength(7);
});
it("pauses raster jobs during gestures and safely returns to the displayed zoom", async () => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  const draw = vi.fn(() => ({ promise: Promise.resolve(), cancel() {} }));
  const doc = { getPage: vi.fn(async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }), render: draw })) };
  const content = (zoom: number) => <div data-pdf-camera><PdfCanvas doc={doc} pageNumber={1} width={600} aspect={1.5} magnification={zoom} filter="none" /></div>;
  const view = render(content(1));
  await waitFor(() => expect(view.container.querySelectorAll("canvas")).toHaveLength(3));
  const surface = view.container.firstElementChild as HTMLElement;
  act(() => { surface.dataset.pdfInteracting = "true"; surface.dispatchEvent(new Event("pdf-interaction")); });
  const count = draw.mock.calls.length;
  view.rerender(content(2));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
  expect(draw).toHaveBeenCalledTimes(count);
  view.rerender(content(1));
  act(() => { surface.dataset.pdfInteracting = "false"; surface.dispatchEvent(new Event("pdf-interaction")); });
  await waitFor(() => expect(view.container.querySelectorAll("[data-pdf-layer]")).toHaveLength(1));
  expect(view.container.querySelectorAll("canvas")).toHaveLength(3);
  expect(draw).toHaveBeenCalledTimes(count);
});
