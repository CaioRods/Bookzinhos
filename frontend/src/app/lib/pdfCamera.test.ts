// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { containReaderZoom, zoomPdfCamera } from "./pdfCamera";
afterEach(() => document.body.replaceChildren());
it("keeps the document point beneath the cursor fixed through repeated off-centre zooms", () => {
  let camera = { zoom: 1, x: 93, y: -76 };
  const mouse = { x: -271, y: 134 };
  const documentPoint = { x: (mouse.x - camera.x) / camera.zoom, y: (mouse.y - camera.y) / camera.zoom };
  for (const zoom of [1.3, 2.8, 5, 1.2, 0.5, 1]) {
    camera = zoomPdfCamera(camera, zoom, mouse);
    expect(documentPoint.x * camera.zoom + camera.x).toBeCloseTo(mouse.x, 10);
    expect(documentPoint.y * camera.zoom + camera.y).toBeCloseTo(mouse.y, 10);
  }
});
it("allows panning beyond scroll bounds and clamps only the zoom", () => {
  const camera = zoomPdfCamera({ zoom: 1, x: -1600, y: 2400 }, 100, { x: 0, y: 0 });
  expect(camera).toEqual({ zoom: 5, x: -8000, y: 12000 });
});
it("prevents native Ctrl+wheel on the reader and its controls, covering portal controls and restoring it after cleanup", () => {
  const root = document.createElement("div"), controls = document.createElement("button"), outside = document.createElement("div");
  root.append(controls); document.body.append(root, outside);
  const dispose = containReaderZoom();
  const wheel = (target: HTMLElement, ctrlKey = true) => { const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey }); target.dispatchEvent(event); return event.defaultPrevented; };
  expect(wheel(root)).toBe(true); expect(wheel(controls)).toBe(true);
  expect(wheel(root, false)).toBe(false); expect(wheel(outside)).toBe(true);
  dispose(); expect(wheel(root)).toBe(false);
});
