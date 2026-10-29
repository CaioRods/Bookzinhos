import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("./library-reference.css", import.meta.url),
  "utf8",
);

describe("library shell layout", () => {
  it("does not resize the application window only on the library route", () => {
    expect(stylesheet).not.toMatch(/body:has\(\.mb-library-reference\)/);
    expect(stylesheet).not.toMatch(
      /\.mb-app-window:has\(\.mb-library-reference\)\s*\{[^}]*(?:grid-template-columns|height|width|max-width|margin)\s*:/s,
    );
  });
});
