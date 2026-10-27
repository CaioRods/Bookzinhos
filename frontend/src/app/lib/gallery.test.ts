import { describe, expect, it } from "vitest";
import {
  clampGalleryZoom,
  doubleClickGalleryZoom,
} from "./gallery";

describe("gallery navigation", () => {
  it("keeps zoom between 100% and 400%", () => {
    expect(clampGalleryZoom(0.5)).toBe(1);
    expect(clampGalleryZoom(5)).toBe(4);
  });

  it("toggles double click zoom", () => {
    expect(doubleClickGalleryZoom(1)).toBe(2);
    expect(doubleClickGalleryZoom(2)).toBe(1);
  });
});
