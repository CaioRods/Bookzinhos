import { createSmoothPdfZoom } from "../lib/smoothPdfZoom";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { zoomPdfCamera, type PdfCamera } from "../lib/pdfCamera";
import { clampPdfZoom } from "../lib/pdfZoom";

/** A stable camera for an entire spread. Page changes replace only its children. */
export function PdfViewport({ zoom, baseZoom = 1, offsetX = 0, offsetY = 0, disabled = false, movementLocked = false, smoothZoom = false, onZoom, children }: {
  zoom: number; baseZoom?: number; offsetX?: number; offsetY?: number; disabled?: boolean; movementLocked?: boolean; smoothZoom?: boolean;
  onZoom: (zoom: number) => void; children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const camera = useRef<PdfCamera>({ zoom: clampPdfZoom(zoom), x: 0, y: 0 });
  const cancelWheel = useRef(() => {});
  const settings = useRef({ baseZoom, offsetX, offsetY, onZoom, smoothZoom, movementLocked });
  settings.current = { baseZoom, offsetX, offsetY, onZoom, smoothZoom, movementLocked };
  const paint = () => {
    const element = contentRef.current;
    if (!element) return;
    const { x, y, zoom } = camera.current;
    const { offsetX, offsetY, baseZoom } = settings.current;
    element.style.transform = `translate(calc(-50% + ${x + offsetX}px), calc(-50% + ${y + offsetY}px)) scale(${zoom * baseZoom})`;
    element.dataset.pdfZoom = String(zoom);
    element.dataset.pdfPanX = String(x);
    element.dataset.pdfPanY = String(y);
  };
  // A toolbar/keyboard zoom is centred on the viewport; gestures already supplied their anchor.
  useLayoutEffect(() => {
    if (camera.current.zoom !== zoom) { cancelWheel.current(); camera.current = zoomPdfCamera(camera.current, zoom, { x: 0, y: 0 }); }
    if (movementLocked) { cancelWheel.current(); camera.current = { ...camera.current, x: 0, y: 0 }; }
    paint();
  }, [zoom, baseZoom, offsetX, offsetY, movementLocked]);
  useLayoutEffect(() => {
    const surface = surfaceRef.current!;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let suppressUntil = 0;
    let drag: { x: number; y: number; camera: PdfCamera; id: number } | null = null;
    let touch: { x: number; y: number; distance: number; camera: PdfCamera } | null = null;
    const point = (x: number, y: number) => {
      const rect = surface.getBoundingClientRect();
      return { x: x - rect.left - rect.width / 2 - settings.current.offsetX, y: y - rect.top - rect.height / 2 - settings.current.offsetY };
    };
    const interaction = (active: boolean) => {
      const value = String(active);
      if (surface.dataset.pdfInteracting === value) return;
      surface.dataset.pdfInteracting = value;
      surface.dispatchEvent(new Event("pdf-interaction"));
    };
    const schedulePaint = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); }); };
    const commit = () => { clearTimeout(timer); timer = undefined; interaction(false); settings.current.onZoom(camera.current.zoom); };
    let wheelPoint = { x: 0, y: 0 };
    const animation = createSmoothPdfZoom(() => camera.current.zoom, value => {
      camera.current = zoomPdfCamera(camera.current, value, wheelPoint);
      paint();
    }, commit);
    cancelWheel.current = () => { animation.stop(); clearTimeout(timer); timer = undefined; interaction(false); };
    const interruptWheel = () => {
      if (!animation.active && !timer) return;
      animation.stop(); clearTimeout(timer); timer = undefined;
      settings.current.onZoom(camera.current.zoom);
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      interaction(true);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1);
      wheelPoint = settings.current.movementLocked ? { x: 0, y: 0 } : point(event.clientX, event.clientY);
      const target = clampPdfZoom(animation.target * Math.exp(-delta * 0.003));
      clearTimeout(timer); timer = undefined;
      if (settings.current.smoothZoom) animation.start(target);
      else {
        animation.stop();
        camera.current = zoomPdfCamera(camera.current, target, wheelPoint);
        schedulePaint(); timer = setTimeout(commit, 120);
      }
      suppressUntil = Date.now() + 400;
    };
    const down = (event: PointerEvent) => {
      if (settings.current.movementLocked) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (event.button !== 0) return;
      event.preventDefault();
      interruptWheel();
      interaction(true);
      drag = { x: event.clientX, y: event.clientY, camera: { ...camera.current }, id: event.pointerId };
      surface.setPointerCapture(event.pointerId); surface.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (settings.current.movementLocked || !drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      camera.current = { ...drag.camera, x: drag.camera.x + dx, y: drag.camera.y + dy };
      schedulePaint();
      if (Math.hypot(dx, dy) > 4) suppressUntil = Date.now() + 400;
    };
    const up = () => { drag = null; surface.style.cursor = "grab"; if (!touch && !timer) interaction(false); };
    const touchPosition = (touches: TouchList) => {
      const a = touches[0], b = touches[1] || a;
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, distance: touches.length === 2 ? Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) : 0 };
    };
    const startTouch = (event: TouchEvent) => {
      if (event.touches.length > 2) { touch = null; interaction(false); return; }
      if (!event.touches.length || (settings.current.movementLocked && event.touches.length === 1)) return;
      interruptWheel();
      interaction(true);
      touch = { ...touchPosition(event.touches), camera: { ...camera.current } };
    };
    const moveTouch = (event: TouchEvent) => {
      if ((settings.current.movementLocked && event.touches.length === 1) || !touch || event.touches.length > 2 || !event.touches.length) return;
      event.preventDefault();
      const next = touchPosition(event.touches);
      const original = touch.camera;
      camera.current = touch.distance && next.distance
        ? zoomPdfCamera(original, original.zoom * next.distance / touch.distance, settings.current.movementLocked ? { x: 0, y: 0 } : point(touch.x, touch.y))
        : { ...original };
      if (!settings.current.movementLocked) { camera.current.x += next.x - touch.x; camera.current.y += next.y - touch.y; }
      schedulePaint(); suppressUntil = Date.now() + 400;
    };
    const endTouch = (event: TouchEvent) => {
      if (touch) commit();
      touch = null;
      if (event.touches.length && event.touches.length <= 2) startTouch(event);
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); }
    };
    const blur = () => { up(); touch = null; if (timer || animation.active) { animation.stop(); commit(); } interaction(false); };
    surface.addEventListener("wheel", wheel, { passive: false });
    surface.addEventListener("pointerdown", down); surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", up); surface.addEventListener("pointercancel", up); surface.addEventListener("lostpointercapture", up);
    surface.addEventListener("touchstart", startTouch, { passive: true }); surface.addEventListener("touchmove", moveTouch, { passive: false });
    surface.addEventListener("touchend", endTouch); surface.addEventListener("touchcancel", endTouch);
    surface.addEventListener("click", click, true); window.addEventListener("blur", blur);
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame); animation.stop(); cancelWheel.current = () => {}; interaction(false);
      surface.removeEventListener("wheel", wheel);
      surface.removeEventListener("pointerdown", down); surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up); surface.removeEventListener("pointercancel", up); surface.removeEventListener("lostpointercapture", up);
      surface.removeEventListener("touchstart", startTouch); surface.removeEventListener("touchmove", moveTouch);
      surface.removeEventListener("touchend", endTouch); surface.removeEventListener("touchcancel", endTouch);
      surface.removeEventListener("click", click, true); window.removeEventListener("blur", blur);
    };
  }, []);
  return <div ref={surfaceRef} data-pdf-camera data-movement-locked={movementLocked} className="h-full w-full overflow-hidden relative" style={{ touchAction: "none", cursor: movementLocked ? "default" : "grab", overscrollBehavior: "contain", pointerEvents: disabled ? "none" : undefined }}>
    <div ref={contentRef} data-pdf-content style={{ position: "absolute", left: "50%", top: "50%", width: "max-content", willChange: "transform" }}>{children}</div>
  </div>;
}
