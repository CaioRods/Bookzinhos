const seenInMemory = new Set<string>();
const keyFor = (username: string) =>
  `mybooks:opening:v1:${username.toLowerCase()}`;

/** Once per account in the current tab; a successful login can explicitly replay it. */
export function needsOpening(username: string | null): boolean {
  if (!username) return false;
  const key = keyFor(username);
  try {
    return sessionStorage.getItem(key) !== "seen" && !seenInMemory.has(key);
  } catch {
    return !seenInMemory.has(key);
  }
}
export function completeOpening(username: string): void {
  const key = keyFor(username);
  seenInMemory.add(key);
  try {
    sessionStorage.setItem(key, "seen");
  } catch {
    /* Private mode still gets a usable app. */
  }
}
