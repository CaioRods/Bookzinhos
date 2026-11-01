import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { parseEpub } from "./parse";
import { renderEpubPdf } from "./pdf";
import { epubFixture } from "./fixtures.test-util";
const fonts = ["DejaVuSerif", "DejaVuSerif-Bold", "DejaVuSerif-Italic", "DejaVuSerif-BoldItalic"].map(name => new Uint8Array(readFileSync(new URL(`../../../assets/epub-fonts/${name}.ttf`, import.meta.url))));
describe("EPUB to vector PDF", () => {
  it("generates a real paginated PDF with metadata and embedded Unicode fonts", async () => {
    const book = parseEpub(epubFixture());
    const result = await renderEpubPdf(book, fonts);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getTitle()).toBe(book.title); expect(doc.getAuthor()).toBe(book.author);
    expect(result.pageCount).toBe(2); expect(doc.getPageCount()).toBe(2);
    expect(doc.getPages()[0].node.Resources()?.has).toBeDefined();
  });
  it("wraps long paragraphs over multiple pages without truncating them", async () => {
    const book = parseEpub(epubFixture({ "OPS/first.xhtml": `<html><body><p>${"Texto longo de ação e emoção. ".repeat(1500)}</p></body></html>` }));
    const result = await renderEpubPdf(book, fonts);
    expect(result.pageCount).toBeGreaterThan(5);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(result.pageCount);
  });
});
it("embeds a PNG illustration and rejects excessive image dimensions before decoding", async () => {
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fYQAAAAASUVORK5CYII=", "base64"));
  const book = parseEpub(epubFixture({ "OPS/first.xhtml": '<html><body><img src="cover.png"/><p>Após a capa.</p></body></html>', "OPS/cover.png": png }));
  expect((await renderEpubPdf(book, fonts)).pageCount).toBeGreaterThan(0);
  const huge = png.slice(); new DataView(huge.buffer).setUint32(16, 100000); new DataView(huge.buffer).setUint32(20, 100000);
  await expect(renderEpubPdf({ ...book, images: { "OPS/cover.png": huge } }, fonts)).rejects.toThrow(/grande/);
});
