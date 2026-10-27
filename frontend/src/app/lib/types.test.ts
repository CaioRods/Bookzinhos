import { describe, expect, it } from "vitest";
import { normalizeReaction } from "./community";

describe("normalizeReaction", () => {
  it.each(["heart", "panda", "sad", "moved"])("accepts %s", (value) => {
    expect(normalizeReaction(value)).toBe(value);
  });

  it("rejects unknown values", () => {
    expect(normalizeReaction("fire")).toBeNull();
  });
});
