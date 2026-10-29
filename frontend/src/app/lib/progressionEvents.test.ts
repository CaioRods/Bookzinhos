import { describe, expect, it } from "vitest";
import { presentationForProgression } from "./progressionEvents";

describe("level presentation", () => {
  it("ignores unchanged levels, uses toast normally and overlay on decades", () => {
    expect(presentationForProgression({ oldLevel: 4, newLevel: 4 })).toBe("none");
    expect(presentationForProgression({ oldLevel: 4, newLevel: 5 })).toBe("toast");
    expect(presentationForProgression({ oldLevel: 9, newLevel: 10 })).toBe("overlay");
    expect(presentationForProgression({ oldLevel: 19, newLevel: 21 })).toBe("overlay");
  });
});
