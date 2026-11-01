import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { pdfResolution, schedulePdfRender } from "../lib/pdfRendering";

function Raster({ doc, pageNumber, width, height, density, x = 0, y = 0, tileWidth = width, tileHeight = height, detail = false, paused = false, onVisibility, onReady }: {
  doc: any; pageNumber: number; width: number; height: number; density: number;
  x?: number; y?: number; tileWidth?: number; tileHeight?: number; detail?: boolean; paused?: boolean;
  onVisibility?: (visible: boolean) => void; onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendered = useRef<{ doc: unknown; key: string } | null>(null);
  const callbacks = useRef({ onVisibility, onReady, paused });
  callbacks.current = { onVisibility, onReady, paused };
  const observedVisibility = useRef(!detail);
  const [visible, setVisible] = useState(!detail);
  useEffect(() => {
    if (!detail || !host.current) return;
    const update = (value: boolean) => {
      observedVisibility.current = value;
      callbacks.current.onVisibility?.(value);
      if (!callbacks.current.paused) setVisible(value);
    };
    if (typeof IntersectionObserver === "undefined") { update(true); return; }
    const observer = new IntersectionObserver(([entry]) => update(entry.isIntersecting), { rootMargin: "96px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [detail]);
  useEffect(() => { if (!paused) setVisible(observedVisibility.current); }, [paused]);
  useEffect(() => {
    const target = host.current;
    // Freeze the complete old layer while its replacement renders, and during gestures.
    if (!target || paused) return;
    if (!visible) { target.replaceChildren(); rendered.current = null; return; }
    const key = `${pageNumber}:${width}:${height}:${density}:${x}:${y}:${tileWidth}:${tileHeight}`;
    const cached = rendered.current;
    if (target.firstChild && cached && cached.doc === doc && cached.key === key) { callbacks.current.onReady?.(); return; }
    let cancelled = false;
    let task: any;
    const timer = setTimeout(() => {
      void schedulePdfRender(async () => {
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(width / base.width, height / base.height) * density });
        const offsetX = (width * density - viewport.width) / 2;
        const offsetY = (height * density - viewport.height) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(detail ? 1024 : Infinity, Math.ceil(tileWidth * density));
        canvas.height = Math.min(detail ? 1024 : Infinity, Math.ceil(tileHeight * density));
        canvas.dataset.pdfRaster = detail ? "detail" : "overview";
        canvas.dataset.pdfDensity = String(density);
        canvas.style.cssText = "display:block;width:100%;height:100%";
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;
        task = page.render({ canvasContext: ctx, viewport, transform: [1, 0, 0, 1, offsetX - x * density, offsetY - y * density] });
        await task.promise;
        if (!cancelled) { target.replaceChildren(canvas); rendered.current = { doc, key }; callbacks.current.onReady?.(); }
      }).catch(error => {
        if (!cancelled && error?.name !== "RenderingCancelledException") console.error("Falha ao desenhar PDF", error);
      });
    }, detail ? 40 : 0);
    return () => { cancelled = true; clearTimeout(timer); task?.cancel(); };
  }, [doc, pageNumber, width, height, density, x, y, tileWidth, tileHeight, visible, detail, paused]);
  return <div ref={host} aria-hidden="true" style={{ position: "absolute", left: x, top: y, width: tileWidth, height: tileHeight, pointerEvents: "none" }} />;
}

interface LayerSpec { width: number; height: number; density: number; key: string }
function DetailLayer({ doc, pageNumber, spec, width, hidden, paused, onComplete }: {
  doc: any; pageNumber: number; spec: LayerSpec; width: number; hidden: boolean; paused: boolean; onComplete: () => void;
}) {
  const visibility = useRef(new Map<string, boolean>());
  const ready = useRef(new Set<string>());
  const completed = useRef(false);
  const size = 1024 / spec.density;
  const columns = Math.ceil(spec.width / size), rows = Math.ceil(spec.height / size);
  const check = () => {
    if (completed.current || visibility.current.size !== rows * columns) return;
    for (const [key, visible] of visibility.current) if (visible && !ready.current.has(key)) return;
    completed.current = true;
    onComplete();
  };
  const tiles = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const key = `${row}:${col}`, x = col * size, y = row * size;
    tiles.push(<Raster key={key} doc={doc} pageNumber={pageNumber} width={spec.width} height={spec.height} density={spec.density}
      x={x} y={y} tileWidth={Math.min(size, spec.width - x)} tileHeight={Math.min(size, spec.height - y)} detail paused={paused}
      onVisibility={visible => { visibility.current.set(key, visible); if (!visible) ready.current.delete(key); check(); }}
      onReady={() => { ready.current.add(key); check(); }} />);
  }
  return <div data-pdf-layer={spec.key} data-pdf-layer-visible={!hidden} style={{ position: "absolute", left: 0, top: 0,
    width: spec.width, height: spec.height, transform: `scale(${width / spec.width})`, transformOrigin: "0 0", opacity: hidden ? 0 : 1, pointerEvents: "none" }}>{tiles}</div>;
}

function PageRasters({ doc, pageNumber, width, height, density, previewDensity }: {
  doc: any; pageNumber: number; width: number; height: number; density: number; previewDensity: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [interacting, setInteracting] = useState(false);
  const requested = useMemo<LayerSpec>(() => ({ width, height, density, key: `${width}:${height}:${density}` }), [width, height, density]);
  const latest = useRef(requested); latest.current = requested;
  const [displayed, setDisplayed] = useState(requested);
  useEffect(() => {
    const surface = root.current?.closest("[data-pdf-camera]");
    if (!surface) return;
    const update = () => setInteracting(surface.getAttribute("data-pdf-interacting") === "true");
    update(); surface.addEventListener("pdf-interaction", update);
    return () => surface.removeEventListener("pdf-interaction", update);
  }, []);
  const pending = displayed.key !== requested.key;
  const layers = pending ? [displayed, requested] : [displayed];
  return <div ref={root} style={{ position: "absolute", inset: 0 }}>
    {/* This overview is independent of gesture zoom and never changes tile coordinates. */}
    <Raster doc={doc} pageNumber={pageNumber} width={width} height={height} density={previewDensity} />
    {layers.map(spec => <DetailLayer key={spec.key} doc={doc} pageNumber={pageNumber} spec={spec} width={width}
      hidden={spec !== displayed} paused={interacting || (spec === displayed && pending)}
      onComplete={() => { if (latest.current.key === spec.key) setDisplayed(spec); }} />)}
  </div>;
}

/** Retain the old geometry until every visible tile of the new resolution is ready. */
export const PdfCanvas = memo(function PdfCanvas({ doc, pageNumber, width, aspect = 1.414, magnification = 1, filter, className, style }: {
  doc: any; pageNumber: number; width: number; aspect?: number; magnification?: number;
  filter: string; className?: string; style?: CSSProperties;
}) {
  const height = width * aspect;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  const density = pdfResolution(width, height, dpr, magnification);
  return <div role="img" aria-label={`Página ${pageNumber} do PDF`} className={className}
    style={{ ...style, position: "relative", width, height, filter }}>
    <PageRasters key={pageNumber} doc={doc} pageNumber={pageNumber} width={width} height={height} density={density}
      previewDensity={pdfResolution(width, height, dpr, 1, true)} />
  </div>;
});
