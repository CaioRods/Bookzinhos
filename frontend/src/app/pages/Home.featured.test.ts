import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const skeletons = readFileSync(new URL("../components/Skeletons.tsx", import.meta.url), "utf8");

describe("home without featured books", () => {
  it("does not render or prepare the featured-books carousel", () => {
    expect(home).not.toContain("Livros em destaque");
    expect(home).not.toContain("HeroFeature");
    expect(home).not.toContain("const featured");
  });

  it("does not reserve an empty featured-books skeleton", () => {
    expect(skeletons).not.toContain("Destaque da semana");
  });
});
