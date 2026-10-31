/** Adds touch/pen access to the existing context-menu action without blocking scroll. */
export function installLongPressContext(root: Document = document) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let press: { id: number; x: number; y: number; target: Element } | null = null;
  let held = false;
  const cancel = () => { clearTimeout(timer); press = null; };
  const down = (event: PointerEvent) => {
    cancel(); held = false; clearTimeout(releaseTimer);
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (!event.isPrimary || !(event.target instanceof Element)) return;
    const surface = event.target.closest('[data-banner-src], [data-context-menu]');
    if (!surface) return;
    const control = event.target.closest('button, a, input, textarea, select, [contenteditable="true"]');
    if (control && control !== surface) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target };
    timer = setTimeout(() => {
      if (!press?.target.isConnected) return;
      held = true;
      press.target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: press.x, clientY: press.y, button: 2 }));
    }, 500);
  };
  const move = (event: PointerEvent) => {
    if (press && (event.pointerId !== press.id || Math.hypot(event.clientX-press.x, event.clientY-press.y) > 10)) cancel();
  };
  const up = () => { cancel(); if (held) releaseTimer = setTimeout(() => { held = false; }, 800); };
  const click = (event: MouseEvent) => {
    if (!held || event.detail === 0) return;
    event.preventDefault(); event.stopImmediatePropagation(); held = false;
  };
  const nativeContext = (event: MouseEvent) => {
    if (held && event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  root.addEventListener("pointerdown", down, true);
  root.addEventListener("pointermove", move, { capture: true, passive: true });
  root.addEventListener("pointerup", up, true);
  root.addEventListener("pointercancel", up, true);
  root.addEventListener("scroll", cancel, true);
  root.addEventListener("click", click, true);
  root.addEventListener("contextmenu", nativeContext, true);
  window.addEventListener("blur", up);
  return () => {
    cancel(); clearTimeout(releaseTimer);
    root.removeEventListener("pointerdown", down, true);
    root.removeEventListener("pointermove", move, true);
    root.removeEventListener("pointerup", up, true);
    root.removeEventListener("pointercancel", up, true);
    root.removeEventListener("scroll", cancel, true);
    root.removeEventListener("click", click, true);
    root.removeEventListener("contextmenu", nativeContext, true);
    window.removeEventListener("blur", up);
  };
}
