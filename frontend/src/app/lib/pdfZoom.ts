export const clampPdfZoom = (value: number) => Math.min(5, Math.max(0.5, value));

/** Preview on the compositor while pinching; redraw once the gesture settles. */
export function installPdfZoom(stage: HTMLElement, options: { getScale: () => number; commit: (scale: number) => void }) {
  let pinch: { distance: number; scale: number; x: number; y: number } | null = null;
  let ratio = 1;
  let anchor: { x: number; y: number; localX: number; localY: number } | null = null;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressUntil = 0;
  let drag: { x: number; y: number; left: number; top: number; id: number } | null = null;
  let content: HTMLElement | null = null;
  let surface: HTMLElement | null = null;
  const distance = (points: TouchList) => Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
  const begin = (x: number, y: number) => {
    surface = stage.querySelector<HTMLElement>("[data-pdf-scroll]");
    content = stage.querySelector<HTMLElement>("[data-pdf-content]");
    if (!surface || !content) return false;
    const rect = content.getBoundingClientRect();
    anchor = { x, y, localX: x - rect.left, localY: y - rect.top };
    content.style.transformOrigin = `${anchor.localX}px ${anchor.localY}px`;
    content.style.willChange = "transform";
    return true;
  };
  const preview = (next: number) => {
    ratio = clampPdfZoom(next) / options.getScale();
    if (content) content.style.transform = `scale(${ratio})`;
    suppressUntil = Date.now() + 400;
  };
  const clear = () => { if (content) { content.style.transform = ""; content.style.willChange = ""; } };
  const finish = () => {
    clearTimeout(wheelTimer);
    const scale = clampPdfZoom(options.getScale() * ratio);
    const scroller = surface;
    const focus = anchor;
    const element = content;
    const factor = ratio;
    clear();
    if (ratio !== 1) options.commit(scale);
    requestAnimationFrame(() => {
      if (!scroller?.isConnected || !element?.isConnected || !focus) return;
      const rect = element.getBoundingClientRect();
      scroller.scrollLeft += rect.left + focus.localX * factor - focus.x;
      scroller.scrollTop += rect.top + focus.localY * factor - focus.y;
    });
    wheelTimer = undefined;
    ratio = 1; pinch = null;
  };
  const start = (event: TouchEvent) => {
    if (event.touches.length !== 2) { if (pinch) finish(); return; }
    clearTimeout(wheelTimer);
    const x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    const y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    if (!begin(x, y)) return;
    event.preventDefault();
    pinch = { distance: Math.max(1, distance(event.touches)), scale: options.getScale(), x, y };
  };
  const move = (event: TouchEvent) => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    preview(pinch.scale * distance(event.touches) / pinch.distance);
  };
  const end = () => { if (pinch) finish(); };
  const cancel = () => { clearTimeout(wheelTimer); clear(); pinch = null; ratio = 1; wheelTimer = undefined; };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (!wheelTimer && !begin(event.clientX, event.clientY)) return;
    event.preventDefault();
    preview(options.getScale() * ratio * Math.exp(-event.deltaY * 0.005));
    clearTimeout(wheelTimer); wheelTimer = setTimeout(finish, 120);
  };
  const click = (event: MouseEvent) => { if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); } };
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || options.getScale() <= 1) return;
    surface = stage.querySelector<HTMLElement>("[data-pdf-scroll]");
    if (!surface) return;
    drag = { x: event.clientX, y: event.clientY, left: surface.scrollLeft, top: surface.scrollTop, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
  };
  const pan = (event: PointerEvent) => {
    if (!drag || !surface) return;
    surface.scrollLeft = drag.left - (event.clientX - drag.x);
    surface.scrollTop = drag.top - (event.clientY - drag.y);
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) suppressUntil = Date.now() + 400;
  };
  const up = () => { drag = null; };
  stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", pan);
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("touchstart", start, { passive: false });
  stage.addEventListener("touchmove", move, { passive: false });
  stage.addEventListener("touchend", end);
  stage.addEventListener("touchcancel", cancel);
  stage.addEventListener("wheel", wheel, { passive: false });
  stage.addEventListener("click", click, true);
  return () => {
    cancel();
    stage.removeEventListener("pointerdown", down); stage.removeEventListener("pointermove", pan);
    stage.removeEventListener("pointerup", up); stage.removeEventListener("pointercancel", up);
    stage.removeEventListener("touchstart", start); stage.removeEventListener("touchmove", move);
    stage.removeEventListener("touchend", end); stage.removeEventListener("touchcancel", cancel);
    stage.removeEventListener("wheel", wheel); stage.removeEventListener("click", click, true);
  };
}
