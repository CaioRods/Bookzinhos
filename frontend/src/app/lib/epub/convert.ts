export function bookFileKind(file: Pick<File, "name" | "type">): "pdf" | "epub" | null {
  if (/\.epub$/i.test(file.name)) return "epub";
  if (/\.pdf$/i.test(file.name)) return "pdf";
  if (file.type === "application/epub+zip") return "epub";
  return file.type === "application/pdf" ? "pdf" : null;
}
interface ConvertedEpub { file: File; title: string; author: string; description?: string; subjects?: string[]; pageCount: number }
export async function convertEpub(file: File, signal: AbortSignal, progress: (value: number) => void): Promise<ConvertedEpub> {
  if (file.size > 40 * 1024 * 1024) throw new Error("O EPUB deve ter até 40 MB para conversão neste aparelho.");
  const buffer = await file.arrayBuffer();
  if (signal.aborted) throw new DOMException("Conversão cancelada.", "AbortError");
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./convert.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { worker.onmessage = null; worker.onerror = null; worker.terminate(); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("Conversão cancelada.", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error("Não foi possível converter o EPUB neste navegador. Tente novamente.")); };
    worker.onmessage = event => {
      const data = event.data;
      if (data.type === "progress") progress(data.value);
      else if (data.type === "error") { cleanup(); reject(new Error(data.message)); }
      else if (data.type === "complete") {
        cleanup(); resolve({ file: new File([data.bytes], file.name.replace(/\.epub$/i, "") + ".pdf", { type: "application/pdf" }), title: data.title, author: data.author, description: data.description, subjects: data.subjects, pageCount: data.pageCount });
      }
    };
    worker.postMessage(buffer, [buffer]);
  });
}
