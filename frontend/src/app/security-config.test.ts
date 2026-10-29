// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("browser security bootstrap", () => {
  it("loads same-origin bootstrap that blocks the installed-app gesture", () => {
    const html = readFileSync(`${process.cwd()}/index.html`, "utf8");
    const source = readFileSync(`${process.cwd()}/public/theme-bootstrap.js`, "utf8");
    expect(html).toContain('<script src="/theme-bootstrap.js"></script>');
    expect(html).not.toMatch(/<script>\s/);
    Function(source)();
    const gesture = new Event("gesturestart", { cancelable: true });
    document.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
  });
});
