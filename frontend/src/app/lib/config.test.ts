import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./config";

describe("API origin", () => {
  it("uses the same-origin proxy in production so Safari can keep the session cookie", () => {
    expect(resolveApiBaseUrl("mybookzinhos.vercel.app")).toBe("/api");
  });

  it("keeps direct local API access during development", () => {
    expect(resolveApiBaseUrl("localhost")).toBe("http://localhost:3001");
    expect(resolveApiBaseUrl("127.0.0.1")).toBe("http://127.0.0.1:3001");
  });
});
