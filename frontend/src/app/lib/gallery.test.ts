import { describe, expect, it } from "vitest";
import {
  clampGalleryIndex,
  clampGalleryZoom,
  doubleClickGalleryZoom,
  gallerySwipeIndex,
} from "./gallery";

describe("gallery navigation", () => {
  it("stops at the first and last image", () => {
    expect(clampGalleryIndex(-1, 8)).toBe(0);
    expect(clampGalleryIndex(8, 8)).toBe(7);
  });

  it("keeps zoom between 100% and 400%", () => {
    expect(clampGalleryZoom(0.5)).toBe(1);
    expect(clampGalleryZoom(5)).toBe(4);
  });

  it("toggles double click zoom and changes images only after a real swipe", () => {
    expect(doubleClickGalleryZoom(1)).toBe(2);
    expect(doubleClickGalleryZoom(2)).toBe(1);
    expect(gallerySwipeIndex(-40, 1, 4)).toBe(1);
    expect(gallerySwipeIndex(-90, 1, 4)).toBe(2);
    expect(gallerySwipeIndex(90, 0, 4)).toBe(0);
  });
});
