import { describe, expect, it } from "vitest";
import { imageCropRect, moveImageCrop } from "./imageCrop";

describe("preview and destination crop geometry", () => {
  const source = { width: 2400, height: 1600 };
  for (const target of [{ width: 247, height: 607.5 }, { width: 1136, height: 420 }, { width: 928, height: 250 }, { width: 390, height: 180 }, { width: 280, height: 300 }, { width: 240, height: 240 }]) {
    it(`keeps the exact source rectangle at all preview scales for ${target.width}×${target.height}`, () => {
      for (const crop of [{ x: 0, y: 50, zoom: 1 }, { x: 100, y: 0, zoom: 1.37 }, { x: 63.25, y: 72.6, zoom: 4 }]) {
        const expected = imageCropRect(source, target, crop);
        for (const scale of [.25, .63, 1.5]) {
          const actual = imageCropRect(source, { width: target.width * scale, height: target.height * scale }, crop);
          for (const key of ["left", "top", "width", "height"] as const) expect(actual[key]).toBeCloseTo(expected[key], 9);
        }
        expect(expected.left).toBeGreaterThanOrEqual(0);
        expect(expected.top).toBeGreaterThanOrEqual(0);
        expect(expected.left + expected.width).toBeLessThanOrEqual(source.width + .00001);
        expect(expected.top + expected.height).toBeLessThanOrEqual(source.height + .00001);
      }
    });
  }
  it("moves by the pointer distance without changing zoom or drifting on scaled previews", () => {
    const crop = { x: 50, y: 50, zoom: 2 };
    const target = { width: 247, height: 607.5 };
    const actual = moveImageCrop(source, target, crop, 20, -35);
    const preview = moveImageCrop(source, {width:target.width/2,height:target.height/2}, crop, 10, -17.5);
    expect(actual).toEqual(preview);
    expect(actual.x).toBeLessThan(50);
    expect(actual.y).toBeGreaterThan(50);
    expect(actual.zoom).toBe(2);
  });
});
