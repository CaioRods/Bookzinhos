import { afterEach, expect, it, vi } from "vitest";
import { bookFileOptions, formatFileSize, resolveBookFiles } from "./bookFiles";
import type { Book } from "./types";
afterEach(()=>vi.restoreAllMocks());
it('offers only real sources and uses persisted byte counts without downloading files',async()=>{
 const book={pdfPath:'https://files.example/book.pdf',pdfBytes:2097152} as Book;
 const fetch=vi.spyOn(globalThis,'fetch');
 expect(await resolveBookFiles(book,new AbortController().signal)).toEqual([{format:'pdf',url:book.pdfPath,bytes:2097152},{format:'epub',url:null,bytes:null}]);
 expect(fetch).not.toHaveBeenCalled();expect(formatFileSize(2097152)).toBe('2 MB');expect(formatFileSize(null)).toBe('Tamanho indisponível');
});
it('checks only headers for old files and leaves an inaccessible size unknown',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(null,{headers:{'content-length':'1024'}})).mockRejectedValueOnce(new TypeError('CORS'));
 const result=await resolveBookFiles({pdfPath:'https://files.example/a.pdf',epubPath:'https://files.example/a.epub'} as Book,new AbortController().signal);
 expect(result[0].bytes).toBe(1024);expect(result[1].bytes).toBeNull();expect(fetch.mock.calls.every(([,options])=>options?.method==='HEAD')).toBe(true);
 expect(bookFileOptions({} as Book).every(option=>!option.url)).toBe(true);
});
