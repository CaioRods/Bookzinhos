import { API_BASE_URL } from "./config";
import type { Book } from "./types";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// To prevent extracting the same book multiple times concurrently in the session
const processingBooks = new Set<string>();

export async function extractAndUploadCover(book: Book, onUpdated?: (updated: Book) => void) {
  if (processingBooks.has(book.id)) return;
  processingBooks.add(book.id);

  try {
    const pdfUrl = book.pdfPath;
    if (!pdfUrl) return;

    // Normalizar a URL do PDF (se for um caminho relativo, prefixar com a URL do backend)
    let fullPdfUrl = pdfUrl;
    if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://") && !pdfUrl.startsWith("blob:") && !pdfUrl.startsWith("data:")) {
      fullPdfUrl = `${API_BASE_URL}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
    }

    console.log(`[CoverExtractor] Extraindo capa do livro "${book.title}" da URL: ${fullPdfUrl}...`);

    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    const response = await fetch(fullPdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });

    if (!blob) {
      throw new Error("Não foi possível gerar o blob da capa a partir do canvas.");
    }

    const form = new FormData();
    form.append("cover", blob, "cover.jpg");

    const uploadRes = await fetch(`${API_BASE_URL}/books/${book.id}/cover`, {
      method: "POST",
      credentials: "include",
      body: form,
    });

    if (!uploadRes.ok) {
      throw new Error(`Falha no upload: ${uploadRes.statusText}`);
    }

    const resData = await uploadRes.json();
    console.log(`[CoverExtractor] Capa salva com sucesso para o livro "${book.title}":`, resData.coverImagePath);

    if (onUpdated) {
      onUpdated({
        ...book,
        coverImagePath: resData.coverImagePath,
      });
    }
  } catch (err) {
    console.error(`[CoverExtractor] Erro ao processar capa para o livro "${book.title}":`, err);
  } finally {
    processingBooks.delete(book.id);
  }
}

export function triggerBackgroundCoverGeneration(books: Book[], onUpdated?: (updated: Book) => void) {
  // Encontra livros que possuem pdfPath mas não têm coverImagePath (ou têm a imagem de esboço padrão)
  const booksNeedCover = books.filter(
    (b) => b.pdfPath && (!b.coverImagePath || b.coverImagePath === "/capa-esboco.png")
  );

  if (booksNeedCover.length === 0) return;

  console.log(`[CoverExtractor] Encontrado(s) ${booksNeedCover.length} livro(s) que precisam de extração de capa.`);

  // Só começa quando o navegador estiver ocioso: extrair capa de PDF é pesado
  // (carrega o pdf.js, renderiza uma página num canvas) e não pode competir com
  // a primeira pintura da tela. Entre um livro e outro há uma pausa, para o
  // trabalho ficar picado e a interface nunca travar.
  const start = () => {
    (async () => {
      for (const book of booksNeedCover) {
        await extractAndUploadCover(book, onUpdated);
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback(start, { timeout: 4000 });
  } else {
    setTimeout(start, 1500);
  }
}
