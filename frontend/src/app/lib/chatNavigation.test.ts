import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatConversationTarget, chatOrigin, rememberChatOrigin } from "./chatNavigation";

describe("chat navigation", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it("preserves the page that opened chat when conversations change", () => {
    rememberChatOrigin("/social?feed=following");
    rememberChatOrigin("/chat/maria");
    expect(chatOrigin()).toBe("/social?feed=following");
  });

  it("rejects unsafe origins and falls back to the community", () => {
    rememberChatOrigin("https://malicious.example");
    expect(chatOrigin()).toBe("/social");
  });

  it("builds an encoded conversation target marked as a switch", () => {
    expect(chatConversationTarget("Ana Maria")).toEqual({
      pathname: "/chat/Ana%20Maria",
      state: { fromChatSwitch: true },
    });
  });
});
