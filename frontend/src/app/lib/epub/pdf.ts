import { PDFDocument, PageSizes, rgb, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { EpubBook, EpubRun } from "./parse";

export async function renderEpubPdf(book: EpubBook, fontData: Uint8Array[], progress: (value: number) => void = () => {}) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(fontData.map(bytes => pdf.embedFont(bytes, { subset: true })));
  pdf.setTitle(book.title); pdf.setAuthor(book.author); pdf.setCreator("Bookzinhos");
  const [pageWidth, pageHeight] = PageSizes.A5, margin = 38, areaWidth = pageWidth - margin * 2, areaHeight = pageHeight - margin * 2;
  let page = pdf.addPage(PageSizes.A5), y = pageHeight - margin, used = false, chapterBreak = false;
  const newPage = () => { if (pdf.getPageCount() >= 3000) throw new Error("O EPUB gera páginas demais para conversão neste aparelho."); page = pdf.addPage(PageSizes.A5); y = pageHeight - margin; used = false; };
  const chooseFont = (run: EpubRun, heading?: number) => fonts[(run.bold || heading ? 1 : 0) + (run.italic ? 2 : 0)];
  const glyphs = fonts.map(font => new Set(font.getCharacterSet()));
  const images = new Map<string, PDFImage>();
  for (let index = 0; index < book.blocks.length; index++) {
    const block = book.blocks[index];
    if (block.kind === "chapter") { chapterBreak = true; continue; }
    if (chapterBreak) { if (used) newPage(); chapterBreak = false; }
    if (block.kind === "image") {
      let image = images.get(block.path);
      if (!image) {
        let bytes = book.images[block.path];
        if (!bytes) throw new Error("Uma imagem do EPUB não pôde ser lida.");
        if (bytes[0] === 0x89 && bytes[1] === 0x50) {
          if (bytes.byteLength < 24) throw new Error("Imagem PNG inválida no EPUB.");
          const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          if (header.getUint32(16) * header.getUint32(20) > 20_000_000) throw new Error("Uma imagem do EPUB é grande demais para converter.");
          image = await pdf.embedPng(bytes);
        }
        else if (bytes[0] === 0xff && bytes[1] === 0xd8) image = await pdf.embedJpg(bytes);
        else {
          const signature = new TextDecoder("ascii").decode(bytes.slice(0, 16));
          let imageWidth = 0, imageHeight = 0;
          if (signature.startsWith("GIF") && bytes.length >= 10) {
            imageWidth = bytes[6] | bytes[7] << 8; imageHeight = bytes[8] | bytes[9] << 8;
          } else if (signature.startsWith("RIFF") && signature.includes("WEBP") && bytes.length >= 30) {
            const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            if (signature.endsWith("VP8X")) {
              imageWidth = 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16); imageHeight = 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16);
            } else if (signature.endsWith("VP8L")) {
              const bits = header.getUint32(21, true); imageWidth = (bits & 0x3fff) + 1; imageHeight = ((bits >>> 14) & 0x3fff) + 1;
            } else { imageWidth = header.getUint16(26, true) & 0x3fff; imageHeight = header.getUint16(28, true) & 0x3fff; }
          }
          if (!imageWidth || !imageHeight) throw new Error("O EPUB contém um formato de imagem ainda não suportado.");
          if (imageWidth * imageHeight > 20_000_000) throw new Error("Uma imagem do EPUB é grande demais para converter.");
          if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") throw new Error("O EPUB contém uma imagem que este navegador não consegue converter.");
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes).buffer]));
          try {
            if (bitmap.width * bitmap.height > 20_000_000) throw new Error("Uma imagem do EPUB é grande demais para converter.");
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d");
            if (!context) throw new Error("Não foi possível converter uma imagem do EPUB.");
            context.drawImage(bitmap, 0, 0);
            bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
            image = await pdf.embedPng(bytes);
          } finally { bitmap.close(); }
        }
        if (image.width * image.height > 20_000_000) throw new Error("Uma imagem do EPUB é grande demais para converter.");
        images.set(block.path, image);
      }
      const scale = Math.min(areaWidth / image.width, areaHeight / image.height), width = image.width * scale, height = image.height * scale;
      if (y - height < margin && used) newPage();
      page.drawImage(image, { x: (pageWidth - width) / 2, y: y - height, width, height });
      y -= height + 10; used = true;
    } else {
      const size = block.heading ? Math.max(13, 23 - block.heading * 2) : 11;
      const lineHeight = size * 1.5;
      if (block.heading && y - lineHeight * 3 < margin && used) newPage();
      let x = margin, lineUsed = false;
      const newline = () => { y -= lineHeight; x = margin; lineUsed = false; };
      for (const run of block.runs) {
        const font = chooseFont(run, block.heading), supported = glyphs[fonts.indexOf(font)];
        const text = run.text.replace(/\u00a0/g, " ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b\ufeff]/g, "");
        for (const character of text) if (!/\s/u.test(character) && !supported.has(character.codePointAt(0)!)) throw new Error("O EPUB contém caracteres que a fonte de conversão ainda não suporta.");
        for (const token of text.split(/(\n|[^\S\n]+)/u).filter(Boolean)) {
          if (token === "\n") { newline(); continue; }
          const space = /^\s+$/u.test(token);
          const word = space ? " " : token;
          const width = font.widthOfTextAtSize(word, size);
          if (x + width > pageWidth - margin && lineUsed) newline();
          if (space && !lineUsed) continue;
          // Long URLs/words wrap by Unicode character, never outside the page.
          for (const part of width > areaWidth ? Array.from(word) : [word]) {
            const partWidth = font.widthOfTextAtSize(part, size);
            if (x + partWidth > pageWidth - margin && lineUsed) newline();
            if (y - lineHeight < margin) newPage();
            page.drawText(part, { x, y: y - size, size, font, color: rgb(0.08, 0.07, 0.06) });
            x += partWidth; lineUsed = true; used = true;
          }
        }
      }
      if (lineUsed) newline(); y -= 5;
    }
    if (index % 20 === 0) progress(Math.max(5, Math.round(index / book.blocks.length * 90)));
  }
  progress(95);
  return { bytes: await pdf.save(), pageCount: pdf.getPageCount() };
}
