const CHAT_ORIGIN_KEY = "mybooks:chat-origin";
const DEFAULT_CHAT_ORIGIN = "/social";

function safeOrigin(path: string | null | undefined) {
  if (!path?.startsWith("/") || path.startsWith("//") || path.startsWith("/chat/")) {
    return null;
  }
  return path;
}

export function rememberChatOrigin(path: string) {
  const safe = safeOrigin(path);
  if (!safe) return;
  try {
    sessionStorage.setItem(CHAT_ORIGIN_KEY, safe);
  } catch {
    /* Session storage can be unavailable in privacy mode. */
  }
}

export function chatOrigin() {
  try {
    return safeOrigin(sessionStorage.getItem(CHAT_ORIGIN_KEY)) || DEFAULT_CHAT_ORIGIN;
  } catch {
    return DEFAULT_CHAT_ORIGIN;
  }
}

export function chatConversationTarget(username: string) {
  return {
    pathname: `/chat/${encodeURIComponent(username)}`,
    state: { fromChatSwitch: true as const },
  };
}
