import { clampPdfZoom } from "./pdfZoom";
export interface PdfCamera { zoom: number; x: number; y: number }
export interface PdfPoint { x: number; y: number }
/** Coordinates are CSS pixels relative to the page/spread's unpanned centre. */
export function zoomPdfCamera(camera: PdfCamera, zoom: number, point: PdfPoint): PdfCamera {
  const next = clampPdfZoom(zoom);
  const factor = next / camera.zoom;
  return { zoom: next, x: point.x - (point.x - camera.x) * factor, y: point.y - (point.y - camera.y) * factor };
}

/** Active only while the reader is mounted; also covers floating controls/portals. */
export function containReaderZoom() {
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };
  window.addEventListener("wheel", wheel, { capture: true, passive: false });
  return () => window.removeEventListener("wheel", wheel, true);
}
