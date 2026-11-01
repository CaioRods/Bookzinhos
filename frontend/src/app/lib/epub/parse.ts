import { unzipSync } from "fflate";
import { DOMParser, type Node, type Element } from "@xmldom/xmldom";

export interface EpubRun { text: string; bold?: boolean; italic?: boolean }
export type EpubBlock = { kind: "text"; runs: EpubRun[]; heading?: number } | { kind: "image"; path: string } | { kind: "chapter" };
export interface EpubBook { title: string; author: string; blocks: EpubBlock[]; description?: string; subjects?: string[]; images: Record<string, Uint8Array> }
export const MAX_EPUB_BYTES = 40 * 1024 * 1024;
const MAX_EXPANDED = 120 * 1024 * 1024;
const tags = (element: Element | ReturnType<DOMParser["parseFromString"]>, name: string) => Array.from(element.getElementsByTagNameNS("*", name));
function xml(source: string) {
  if (source.length > 8 * 1024 * 1024 || (source.match(/</g)?.length || 0) > 250000) throw new Error("Este EPUB é complexo demais para conversão neste aparelho.");
  if (/<!ENTITY/i.test(source)) throw new Error("O EPUB contém entidades XML não suportadas.");
  return new DOMParser({ onError: level => { if (level !== "warning") throw new Error("EPUB com XML inválido."); } }).parseFromString(source, "application/xhtml+xml");
}
function canonical(path: string) {
  if (path.includes("\\") || path.startsWith("/")) throw new Error("Caminho inválido no EPUB.");
  const result: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!result.length) throw new Error("Caminho inválido no EPUB."); result.pop(); }
    else { if (["__proto__", "constructor", "prototype"].includes(part)) throw new Error("Caminho inválido no EPUB."); result.push(part); }
  }
  return result.join("/");
}
export function epubPath(base: string, reference: string) {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(reference)) throw new Error("O EPUB referencia conteúdo externo; inclua os arquivos dentro do livro.");
  const path = decodeURIComponent(reference.split(/[?#]/)[0]);
  return canonical(path.startsWith("/") ? path.slice(1) : base.slice(0, base.lastIndexOf("/") + 1) + path);
}

/** Parses only archive content. It never executes HTML, CSS, scripts, or fetches resources. */
export function parseEpub(bytes: Uint8Array): EpubBook {
  if (bytes.length > MAX_EPUB_BYTES) throw new Error("O EPUB deve ter até 40 MB para conversão neste aparelho.");
  let expanded = 0, count = 0;
  const files = unzipSync(bytes, { filter: entry => {
    canonical(entry.name);
    expanded += entry.originalSize;
    if (++count > 10000 || entry.originalSize > 24 * 1024 * 1024 || expanded > MAX_EXPANDED) throw new Error("Este EPUB é grande demais para conversão neste aparelho.");
    return !entry.name.endsWith("/");
  } });
  const archive = new Map(Object.entries(files).map(([path, data]) => [canonical(path), data]));
  const read = (path: string) => {
    const data = archive.get(path); if (!data) throw new Error(`Arquivo ausente no EPUB: ${path}`);
    const encoding = (data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0x3c && data[1] === 0) ? "utf-16le" : (data[0] === 0xfe && data[1] === 0xff) || (data[0] === 0 && data[1] === 0x3c) ? "utf-16be" : "utf-8";
    return new TextDecoder(encoding, { fatal: true }).decode(data);
  };
  if (read("mimetype").trim() !== "application/epub+zip") throw new Error("Selecione um arquivo EPUB válido.");
  const container = xml(read("META-INF/container.xml"));
  const rootfile = tags(container, "rootfile")[0]?.getAttribute("full-path");
  if (!rootfile) throw new Error("O EPUB não informa seu índice de leitura.");
  const packagePath = canonical(decodeURIComponent(rootfile)), packageDoc = xml(read(packagePath));
  if (archive.has("META-INF/encryption.xml")) {
    for (const encrypted of tags(xml(read("META-INF/encryption.xml")), "EncryptedData")) {
      const algorithm = tags(encrypted, "EncryptionMethod")[0]?.getAttribute("Algorithm");
      const uri = tags(encrypted, "CipherReference")[0]?.getAttribute("URI") || "";
      if (!/\.(ttf|otf|woff2?)$/i.test(uri) || !["http://www.idpf.org/2008/embedding", "http://ns.adobe.com/pdf/enc#RC"].includes(algorithm || "")) throw new Error("Este EPUB possui proteção DRM e não pode ser convertido automaticamente.");
    }
  }
  const manifest = new Map(tags(packageDoc, "item").map(item => [item.getAttribute("id") || "", item]));
  const spine = tags(packageDoc, "itemref");
  if (!spine.length || spine.length > 2000) throw new Error("O EPUB não contém uma ordem de capítulos válida.");
  const book: EpubBook = { title: tags(packageDoc, "title")[0]?.textContent?.trim().slice(0, 500) || "", author: tags(packageDoc, "creator")[0]?.textContent?.trim().slice(0, 500) || "", blocks: [], images: Object.create(null) };
  book.description = (tags(packageDoc, "description")[0]?.textContent || "").replace(/<[^>]+>/g, "").trim().slice(0, 10000);
  book.subjects = tags(packageDoc, "subject").map(item => (item.textContent || "").trim()).filter(Boolean).slice(0, 30);
  let nodes = 0, characters = 0;
  const image = (base: string, reference: string, depth = 0) => {
    if (depth > 8) throw new Error("Imagens circulares ou complexas no EPUB.");
    const path = epubPath(base, reference);
    const data = archive.get(path); if (!data) throw new Error(`Imagem ausente no EPUB: ${path}`);
    if (/\.svg$/i.test(path)) {
      const embedded = tags(xml(read(path)), "image");
      if (!embedded.length) throw new Error("Este EPUB contém ilustrações SVG que ainda não podem ser convertidas automaticamente.");
      for (const element of embedded) {
        const href = element.getAttribute("href") || element.getAttribute("xlink:href");
        if (href) image(path, href, depth + 1);
      }
      return;
    }
    book.images[path] = data; book.blocks.push({ kind: "image", path });
  };
  const blockTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li", "pre", "figcaption", "dt", "dd", "tr"]);
  const containers = new Set(["body", "div", "section", "article", "main", "ul", "ol", "table", "tbody", "thead", "figure"]);
  const ignored = new Set(["script", "style", "head", "iframe", "object", "audio", "video"]);
  function visit(root: Node, base: string, depth = 0, heading?: number) {
    if (++nodes > 250000 || depth > 100 || book.blocks.length > 100000) throw new Error("Este EPUB é complexo demais para conversão neste aparelho.");
    let runs: EpubRun[] = [];
    const flush = () => { if (runs.some(run => run.text.trim())) book.blocks.push({ kind: "text", runs, heading }); runs = []; };
    const inline = (node: Node, style: { bold?: boolean; italic?: boolean } = {}, level = depth) => {
      if (++nodes > 250000 || level > 100) throw new Error("Este EPUB é complexo demais para conversão neste aparelho.");
      if (node.nodeType === 3 || node.nodeType === 4) {
        const text = (node.nodeValue || "").replace(/[\t\r\n ]+/g, " ").replace(/\u00ad/g, "");
        characters += text.length; if (characters > 6_000_000) throw new Error("Este EPUB tem texto demais para conversão neste aparelho.");
        if (text) runs.push({ text, ...style }); return;
      }
      if (node.nodeType !== 1) return;
      const element = node as Element, tag = (element.localName || element.nodeName).toLowerCase();
      if (ignored.has(tag) || element.getAttribute("hidden") !== null) return;
      if (tag === "img" || tag === "image") {
        flush(); const src = element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("xlink:href");
        if (src) image(base, src); return;
      }
      if (tag === "br") { runs.push({ text: "\n" }); return; }
      if (tag === "svg" && !tags(element, "image").length) throw new Error("Este EPUB contém ilustrações SVG que ainda não podem ser convertidas automaticamente.");
      const nextStyle = { bold: style.bold || tag === "strong" || tag === "b", italic: style.italic || tag === "em" || tag === "i" || tag === "blockquote" };
      for (const child of Array.from(element.childNodes)) inline(child, nextStyle, level + 1);
      if (tag === "td" || tag === "th") runs.push({ text: "  " });
    };
    for (const child of Array.from(root.childNodes)) {
      const tag = child.nodeType === 1 ? ((child as Element).localName || child.nodeName).toLowerCase() : "";
      if (ignored.has(tag)) continue;
      if (containers.has(tag)) { flush(); visit(child, base, depth + 1); }
      else if (blockTags.has(tag)) {
        flush(); heading = /^h[1-6]$/.test(tag) ? Number(tag[1]) : undefined;
        if (tag === "li") runs.push({ text: "• " });
        inline(child); flush(); heading = undefined;
      } else inline(child);
    }
    flush();
  }
  for (const reference of spine) {
    const item = manifest.get(reference.getAttribute("idref") || "");
    if (!item) throw new Error("O EPUB referencia um capítulo ausente.");
    const media = item.getAttribute("media-type");
    if (!["application/xhtml+xml", "text/html", "image/svg+xml"].includes(media || "")) throw new Error("Este EPUB contém um formato de capítulo ainda não suportado.");
    const path = epubPath(packagePath, item.getAttribute("href") || "");
    const chapter = xml(read(path));
    book.blocks.push({ kind: "chapter" });
    if (!chapter.documentElement) throw new Error("Capítulo vazio ou inválido no EPUB.");
    if (chapter.documentElement.localName === "svg" && !tags(chapter, "image").length) throw new Error("Este EPUB contém ilustrações SVG que ainda não podem ser convertidas automaticamente.");
    visit(tags(chapter, "body")[0] || chapter.documentElement, path);
  }
  const coverId = tags(packageDoc, "meta").find(meta => meta.getAttribute("name") === "cover")?.getAttribute("content");
  const coverItem = [...manifest.values()].find(item => (item.getAttribute("properties") || "").split(/\s+/).includes("cover-image")) || manifest.get(coverId || "");
  if (coverItem) {
    const path = epubPath(packagePath, coverItem.getAttribute("href") || "");
    if (!book.blocks.some(block => block.kind === "image" && block.path === path)) {
      if (archive.has(path)) {
        const existing = new Set(book.blocks.flatMap(block => block.kind === "image" ? [block.path] : []));
        const start = book.blocks.length; image(packagePath, coverItem.getAttribute("href") || "");
        const covers = book.blocks.splice(start).filter(block => block.kind !== "image" || !existing.has(block.path));
        book.blocks.unshift(...covers);
      }
    }
  }
  if (!book.blocks.some(block => block.kind === "text" || block.kind === "image")) throw new Error("O EPUB não contém texto ou imagens para converter.");
  return book;
}
