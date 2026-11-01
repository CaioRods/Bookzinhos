import { parseEpub } from "./parse";
import { renderEpubPdf } from "./pdf";
import regular from "../../../assets/epub-fonts/DejaVuSerif.ttf?url";
import bold from "../../../assets/epub-fonts/DejaVuSerif-Bold.ttf?url";
import italic from "../../../assets/epub-fonts/DejaVuSerif-Italic.ttf?url";
import boldItalic from "../../../assets/epub-fonts/DejaVuSerif-BoldItalic.ttf?url";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ type: "progress", value: 2 });
    const book = parseEpub(new Uint8Array(event.data));
    const fontData = await Promise.all([regular, bold, italic, boldItalic].map(async url => {
      const response = await fetch(url); if (!response.ok) throw new Error("Não foi possível carregar as fontes da conversão. Tente novamente.");
      return new Uint8Array(await response.arrayBuffer());
    }));
    let lastProgress = 2;
    const result = await renderEpubPdf(book, fontData, value => { if (value > lastProgress) { lastProgress = value; self.postMessage({ type: "progress", value }); } });
    const bytes = new Uint8Array(result.bytes).buffer;
    self.postMessage({ type: "complete", bytes, pageCount: result.pageCount, title: book.title, author: book.author }, { transfer: [bytes] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    self.postMessage({ type: "error", message: /EPUB|imagem|capítulo|conversão|fonte|Arquivo|Caminho/i.test(message) ? message : "Não foi possível converter este EPUB. O arquivo está inválido ou contém um formato ainda não suportado." });
  }
};
