import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { pdfResolution, schedulePdfRender } from "../lib/pdfRendering";

function Raster({ doc, pageNumber, width, height, density, x = 0, y = 0, tileWidth = width, tileHeight = height, detail = false }: {
  doc: any; pageNumber: number; width: number; height: number; density: number;
  x?: number; y?: number; tileWidth?: number; tileHeight?: number; detail?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!detail);
  useEffect(() => {
    if (!detail || !host.current) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "96px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [detail]);
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    if (!visible) { target.replaceChildren(); return; }
    let cancelled = false;
    let task: any;
    // Keep the previous image until the replacement is complete; never render into a busy canvas.
    const timer = setTimeout(() => {
      void schedulePdfRender(async () => {
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width * density });
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(detail ? 1024 : Infinity, Math.ceil(tileWidth * density));
        canvas.height = Math.min(detail ? 1024 : Infinity, Math.ceil(tileHeight * density));
        canvas.style.cssText = "display:block;width:100%;height:100%";
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;
        task = page.render({ canvasContext: ctx, viewport, transform: [1, 0, 0, 1, -x * density, -y * density] });
        await task.promise;
        if (!cancelled) target.replaceChildren(canvas);
      }).catch(error => {
        if (!cancelled && error?.name !== "RenderingCancelledException") console.error("Falha ao desenhar PDF", error);
      });
    }, detail ? 80 : 0);
    return () => { cancelled = true; clearTimeout(timer); task?.cancel(); };
  }, [doc, pageNumber, width, height, density, x, y, tileWidth, tileHeight, visible, detail]);
  return <div ref={host} aria-hidden="true" style={{ position: "absolute", left: x, top: y, width: tileWidth, height: tileHeight, pointerEvents: "none" }} />;
}

/** Small overview + visible detail tiles: sharp vector redraws without page-sized GPU allocations. */
export const PdfCanvas = memo(function PdfCanvas({ doc, pageNumber, width, aspect = 1.414, magnification = 1, filter, className, style }: {
  doc: any; pageNumber: number; width: number; aspect?: number; magnification?: number;
  filter: string; className?: string; style?: CSSProperties;
}) {
  const height = width * aspect;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const density = pdfResolution(width, height, dpr, magnification);
  // Each detail canvas is at most 1024×1024 physical pixels (~4 MB).
  const tileSize = 1024 / density;
  const tiles = [];
  for (let y = 0, row = 0; y < height; y += tileSize, row++) {
    for (let x = 0, col = 0; x < width; x += tileSize, col++) {
      tiles.push(<Raster key={`${row}:${col}`} doc={doc} pageNumber={pageNumber} width={width} height={height} density={density}
        x={x} y={y} tileWidth={Math.min(tileSize, width - x)} tileHeight={Math.min(tileSize, height - y)} detail />);
    }
  }
  return <div role="img" aria-label={`Página ${pageNumber} do PDF`} className={className}
    style={{ ...style, position: "relative", width, height, filter }}>
    <Raster doc={doc} pageNumber={pageNumber} width={width} height={height} density={pdfResolution(width, height, dpr, magnification, true)} />
    {tiles}
  </div>;
});
