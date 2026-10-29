// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login } from "./api";
import { communityApi, uploadCommunityImage } from "./community";

describe("authenticated API transport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends cookies and never sends a client-selected identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ username: "Jude" }), { status: 200 }));
    await login("Jude", "secret");
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe("include");
    expect(new Headers(options.headers).has("x-user-id")).toBe(false);
  });

  it("keeps app cookies on API requests but not on signed storage uploads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ uploadUrl: "https://storage.example/upload", downloadUrl: "https://cdn.example/image" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await uploadCommunityImage(new File(["image"], "scene.png", { type: "image/png" }));
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("include");
    expect((fetchMock.mock.calls[1][1] as RequestInit).credentials).toBeUndefined();
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).has("x-user-id")).toBe(false);
  });

  it("uses cookies for community mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await communityApi("/community/posts", "POST", { content: "Olá" });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe("include");
    expect(new Headers(options.headers).has("x-user-id")).toBe(false);
  });
});
