import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./auth-polish.css", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../app/pages/Login.tsx", import.meta.url), "utf8");

describe("login viewport", () => {
  it("keeps the complete authentication experience inside the viewport", () => {
    expect(stylesheet).toMatch(/\.mb-auth-shell\s*\{[^}]*height\s*:\s*100dvh[^}]*overflow\s*:\s*hidden/i);
    expect(stylesheet).not.toMatch(/\.mb-auth-card-content\s*\{[^}]*overflow-y\s*:\s*auto/i);
    expect(loginSource).not.toContain("max-h-64 overflow-y-auto");
    expect(stylesheet).toMatch(/@media\s*\(max-width:767px\)[\s\S]*?\.mb-auth-panel\s*\{[^}]*position\s*:\s*fixed[^}]*top\s*:/i);
    expect(stylesheet).toMatch(/@media\s*\(max-width:767px\)[\s\S]*?\.mb-auth-card\s*\{[^}]*height\s*:\s*min\(560px,calc\(100dvh\s*-\s*132px\)\)/i);
  });

  it("uses a translucent acrylic surface for the login card", () => {
    expect(stylesheet).toMatch(/\.mb-auth-card\s*\{[^}]*backdrop-filter\s*:\s*blur\(/i);
    expect(stylesheet).toMatch(/\.mb-auth-card\s*\{[^}]*background\s*:\s*rgba?\(/i);
  });
});
