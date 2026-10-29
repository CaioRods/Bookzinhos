export const AUTH_HANDOFF_MS = 760;

export function waitForAuthHandoff(reducedMotion: boolean): Promise<void> {
  if (reducedMotion) return Promise.resolve();
  return new Promise((resolve) => globalThis.setTimeout(resolve, AUTH_HANDOFF_MS));
}
