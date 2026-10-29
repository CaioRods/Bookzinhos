export type ProgressionResult = { eventId?: string | null; oldLevel: number; newLevel: number; title?: string; totalXp?: number };
export function presentationForProgression(result: Pick<ProgressionResult,"oldLevel"|"newLevel">) {
  if (result.newLevel <= result.oldLevel) return "none" as const;
  for (let level = result.oldLevel + 1; level <= result.newLevel; level += 1) if (level % 10 === 0) return "overlay" as const;
  return "toast" as const;
}
export function dispatchProgressionResult(result: ProgressionResult) {
  if (presentationForProgression(result) === "none") return;
  const key = result.eventId ? `mybooks:level-event:${result.eventId}` : "";
  if (key && sessionStorage.getItem(key)) return;
  if (key) sessionStorage.setItem(key, "1");
  window.dispatchEvent(new CustomEvent("mybooks:progression", { detail: result }));
}
