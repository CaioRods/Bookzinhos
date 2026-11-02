import { expect, it } from "vitest";
import { resolveReaderLayout } from "./readerLayout";
it("uses one page upright and two pages sideways on touch PDF devices", () => {
  expect(resolveReaderLayout("double", true, true, 390, 844)).toBe("single");
  expect(resolveReaderLayout("single", true, true, 844, 390)).toBe("double");
  expect(resolveReaderLayout("single", true, true, 1180, 820)).toBe("double");
});
it("retains manual layouts when disabled, on desktop or in continuous scrolling", () => {
  expect(resolveReaderLayout("single", false, true, 844, 390)).toBe("single");
  expect(resolveReaderLayout("double", false, true, 390, 844)).toBe("double");
  expect(resolveReaderLayout("single", true, false, 1440, 900)).toBe("single");
  expect(resolveReaderLayout("scroll", true, true, 844, 390)).toBe("scroll");
});
