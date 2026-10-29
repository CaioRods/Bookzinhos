/**
 * URL do servidor myBooks.
 */

export function resolveApiBaseUrl(hostname: string): string {
  const local = hostname === "localhost"
    || hostname === "127.0.0.1"
    || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  return local ? `http://${hostname}:3001` : "/api";
}

export const API_BASE_URL = resolveApiBaseUrl(
  typeof window === "undefined" ? "localhost" : window.location.hostname,
);
