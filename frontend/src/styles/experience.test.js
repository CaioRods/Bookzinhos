import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./experience.css", import.meta.url), "utf8");

describe("desktop sidebar", () => {
  it("keeps the account action available instead of hiding the whole footer", () => {
    expect(stylesheet).not.toMatch(/\.mb-sidebar-account\s*\{[^}]*display\s*:\s*none/i);
  });
});
