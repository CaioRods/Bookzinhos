import { afterEach, describe, expect, it, vi } from "vitest";
import { completeOpening, needsOpening } from "./opening";

afterEach(() => vi.unstubAllGlobals());
describe("opening playback", () => {
  it("plays once per account in a tab without blocking other accounts", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    expect(needsOpening(null)).toBe(false);
    expect(needsOpening("FirstReader")).toBe(true);
    completeOpening("FirstReader");
    expect(needsOpening("firstreader")).toBe(false);
    expect(needsOpening("SecondReader")).toBe(true);
  });
  it("remains usable when browser storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("Blocked");
      },
      setItem: () => {
        throw new Error("Blocked");
      },
    });
    expect(needsOpening("PrivateReader")).toBe(true);
    expect(() => completeOpening("PrivateReader")).not.toThrow();
    expect(needsOpening("PrivateReader")).toBe(false);
  });
});
