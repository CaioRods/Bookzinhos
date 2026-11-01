import { describe, expect, it, vi } from "vitest";
import { parseEpub, epubPath } from "./parse";
import { epubFixture } from "./fixtures.test-util";
import { bookFileKind } from "./convert";

describe("EPUB import", () => {
  it("recognizes EPUB by extension or MIME and preserves normal PDF detection", () => {
    expect(bookFileKind({ name: "BOOK.EPUB", type: "" })).toBe("epub");
    expect(bookFileKind({ name: "book", type: "application/epub+zip" })).toBe("epub");
    expect(bookFileKind({ name: "book.pdf", type: "" })).toBe("pdf");
    expect(bookFileKind({ name: "book.zip", type: "application/zip" })).toBe(null);
  });
  it("reads metadata and spine order instead of ZIP or manifest order, preserving text emphasis", () => {
    const book = parseEpub(epubFixture());
    expect(book.title).toBe("História de teste"); expect(book.author).toBe("Autora de teste");
    const text = book.blocks.flatMap(block => block.kind === "text" ? [block.runs.map(run => run.text).join("")] : []);
    expect(text).toEqual(["Capítulo um", "Olá, coração. Ênfase e ação.", "Capítulo dois", "Fim da história."]);
    expect(book.blocks.some(block => block.kind === "text" && block.runs.some(run => run.italic && run.text === "Ênfase"))).toBe(true);
  });
  it("does not execute embedded code or fetch external content", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const book = parseEpub(epubFixture({ "OPS/first.xhtml": '<html><body><script>fetch("https://example.invalid")</script><p>Seguro</p></body></html>' }));
    expect(JSON.stringify(book.blocks)).not.toContain("fetch"); expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
    expect(() => parseEpub(epubFixture({ "OPS/first.xhtml": '<html><body><img src="https://example.invalid/cover.png"/></body></html>' }))).toThrow(/externo/);
  });
  it("rejects DRM, missing chapters, invalid archives, unsafe paths and oversized expansion", () => {
    expect(() => parseEpub(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() => parseEpub(epubFixture({ "META-INF/encryption.xml": '<encryption><EncryptedData><EncryptionMethod Algorithm="encrypted"/><CipherReference URI="OPS/first.xhtml"/></EncryptedData></encryption>' }))).toThrow(/DRM/);
    expect(() => parseEpub(epubFixture({ "OPS/book.opf": '<package><manifest/><spine><itemref idref="missing"/></spine></package>' }))).toThrow(/ausente/);
    expect(() => epubPath("OPS/book.opf", "../../escape.xhtml")).toThrow();
    expect(epubPath("OPS/chapters/ch1.xhtml", "../images/cover%20one.png")).toBe("OPS/images/cover one.png");
    const bytes = epubFixture();
    const offset = bytes.findIndex((value, index) => value === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 1 && bytes[index + 3] === 2);
    new DataView(bytes.buffer).setUint32(offset + 24, 200 * 1024 * 1024, true);
    expect(() => parseEpub(bytes)).toThrow(/grande/);
  });
});
it("preserves packaged images, SVG cover wrappers and named XHTML entities", () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const book = parseEpub(epubFixture({
    "OPS/first.xhtml": '<html><body><p>Olá&nbsp;mundo</p><img src="images/cover.svg"/></body></html>',
    "OPS/images/cover.svg": '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="cover.png"/></svg>',
    "OPS/images/cover.png": bytes,
  }));
  expect(book.images["OPS/images/cover.png"]).toEqual(bytes);
  expect(book.blocks.some(block => block.kind === "image" && block.path === "OPS/images/cover.png")).toBe(true);
});
