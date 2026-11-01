/** A short ease-out on the compositor; repeated wheel notches accumulate one target. */
export function createSmoothPdfZoom(read: () => number, draw: (value: number) => void, settled: () => void) {
  let frame = 0, active = false, current = read(), target = current, from = current, started = 0;
  const tick = (time: number) => {
    const progress = Math.min(1, Math.max(0, (time - started) / 160));
    const eased = 1 - (1 - progress) ** 3;
    current = progress === 1 ? target : from * (target / from) ** eased;
    draw(current);
    if (progress < 1) frame = requestAnimationFrame(tick);
    else { frame = 0; active = false; settled(); }
  };
  return {
    get active() { return active; },
    get target() { return active ? target : read(); },
    start(value: number) {
      if (!active) current = read();
      from = current; target = value; started = performance.now(); active = true;
      if (!frame) frame = requestAnimationFrame(tick);
    },
    stop() { cancelAnimationFrame(frame); frame = 0; active = false; },
  };
}
