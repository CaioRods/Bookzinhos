import { describe, expect, it } from "vitest";
import { clampGalleryIndex, clampGalleryZoom } from "./gallery";

describe("gallery navigation", () => {
  it("stops at the first and last image", () => {
    expect(clampGalleryIndex(-1, 8)).toBe(0);
    expect(clampGalleryIndex(8, 8)).toBe(7);
  });

  it("keeps zoom between 100% and 400%", () => {
    expect(clampGalleryZoom(0.5)).toBe(1);
    expect(clampGalleryZoom(5)).toBe(4);
  });
});
