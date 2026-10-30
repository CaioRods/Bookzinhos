import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./Library.tsx", import.meta.url), "utf8");
const liveDataSource = readFileSync(new URL("../lib/useLiveData.ts", import.meta.url), "utf8");

describe("library loading performance", () => {
  it("renders the cached catalog without waiting for personal metadata", () => {
    expect(source).not.toMatch(/Promise\.all\(\[\s*fetchBooks/);
    expect(source).toContain("fetchBooks(force)");
    expect(source).toContain("fetchSavedIds(force)");
    expect(source).toContain("fetchAllProgress(force)");
  });

  it("does not force a full catalog request on a short polling interval", () => {
    expect(source).not.toContain("intervalMs: 45000");
    expect(source).toContain("focusThrottleMs: 300000");
  });

  it("preserves the last personal metadata when a refresh fails", () => {
    expect(source).not.toMatch(/fetchSavedIds\(force\)\.catch\(/);
    expect(source).not.toMatch(/fetchAllProgress\(force\)\.catch\(/);
  });

  it("does not let an older refresh overwrite an optimistic mutation", () => {
    expect(liveDataSource).toContain("mutationVersionRef.current += 1");
    expect(liveDataSource).toContain("versionAtStart !== mutationVersionRef.current");
  });
});
