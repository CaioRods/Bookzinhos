const SETTINGS_KEY = "mybooks-settings";
const preferenceKey = (username: string) => `mybooks:motion:${username.toLowerCase()}`;
export function rememberMotionPreference(reduced: boolean) {
  const username = localStorage.getItem("books-username");
  if (username) localStorage.setItem(preferenceKey(username), String(reduced));
}
/** Existing accounts retain their setting; new accounts start with animation disabled. */
export function restoreMotionPreference(username: string, newAccountDefault?: boolean) {
  let preferences: Record<string, unknown> = {};
  try { const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); if (value && typeof value === "object") preferences = value; } catch { /* Restaura preferências corrompidas. */ }
  const saved = localStorage.getItem(preferenceKey(username));
  const reduced = saved === "true" || (saved !== "false" && (newAccountDefault === true || preferences.reduceMotion === true));
  localStorage.setItem(preferenceKey(username), String(reduced));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...preferences, reduceMotion: reduced }));
  document.documentElement.dataset.reduceMotion = String(reduced);
  window.dispatchEvent(new Event("mybooks:settings"));
}
