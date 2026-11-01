import { zipSync, strToU8 } from "fflate";
export function epubFixture(overrides: Record<string, string | Uint8Array> = {}) {
  const contents: Record<string, string | Uint8Array> = {
    mimetype: "application/epub+zip",
    "META-INF/container.xml": '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    "OPS/book.opf": '<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>História de teste</dc:title><dc:creator>Autora de teste</dc:creator></metadata><manifest><item id="second" href="second.xhtml" media-type="application/xhtml+xml"/><item id="first" href="first.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="first"/><itemref idref="second"/></spine></package>',
    "OPS/first.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo um</h1><p>Olá, coração. <em>Ênfase</em> e <strong>ação</strong>.</p></body></html>',
    "OPS/second.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><body><h2>Capítulo dois</h2><p>Fim da história.</p></body></html>',
    ...overrides,
  };
  return zipSync(Object.fromEntries(Object.entries(contents).map(([path, content]) => [path, typeof content === "string" ? strToU8(content) : content])));
}
