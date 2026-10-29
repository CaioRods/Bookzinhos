import { describe, expect, it } from "vitest";
import { avatarSourceRect, clampAvatarTransform, fitAvatar } from "./avatarCrop";

describe("avatar crop geometry", () => {
  it("covers a square viewport with a landscape source", () => {
    expect(fitAvatar({ width: 1600, height: 900 }, { width: 240, height: 240 }, 1)).toEqual({
      x: expect.closeTo(-93.333, 2),
      y: 0,
      scale: expect.closeTo(240 / 900, 5),
    });
  });

  it("clamps portrait and narrow images without exposing an empty crop area", () => {
    expect(clampAvatarTransform(
      { x: 999, y: -999, scale: 1 },
      { width: 300, height: 1200 },
      { width: 240, height: 240 },
    )).toEqual({ x: 0, y: -960, scale: 1 });
  });

  it("maps the visible viewport back to the exact source rectangle", () => {
    const source = { width: 1600, height: 900 };
    const viewport = { width: 240, height: 240 };
    const transform = fitAvatar(source, viewport, 2);
    const rect = avatarSourceRect(transform, source, viewport);

    expect(rect.width).toBeCloseTo(450);
    expect(rect.height).toBeCloseTo(450);
    expect(rect.left).toBeCloseTo(575);
    expect(rect.top).toBeCloseTo(225);
  });
});
