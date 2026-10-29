export function createActivityTracker({
  idleMs = 600_000,
  heartbeatMs = 30_000,
  send,
  visible = () => typeof document === "undefined" || document.visibilityState === "visible",
}: {
  idleMs?: number;
  heartbeatMs?: number;
  send: (elapsedSeconds: number) => void | Promise<void>;
  visible?: () => boolean;
}) {
  let lastInteraction = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastSent = Date.now();
  return {
    start() {
      if (timer) return;
      lastSent = Date.now();
      timer = setInterval(() => {
        const now = Date.now();
        if (!visible() || now - lastInteraction > idleMs) return;
        const elapsed = Math.max(1, Math.round((now - lastSent) / 1000));
        lastSent = now;
        void send(elapsed);
      }, heartbeatMs);
    },
    interact() { lastInteraction = Date.now(); lastSent = Date.now(); },
    stop() { if (timer) clearInterval(timer); timer = null; },
  };
}
