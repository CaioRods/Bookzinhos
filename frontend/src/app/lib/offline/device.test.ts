// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { Blob as NativeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { read, rows, write } from "./db";
import { account, deviceChanged, connectionRestored, deviceKey, installedBook, installedRecords, installBook, pendingMutations, queueMutation, rememberResponse, synchronize, type InstalledBook } from "./device";
import { convertEpub } from "../epub/convert";
vi.mock("../epub/convert", () => ({ convertEpub: vi.fn() }));
import type { Book } from "../types";
afterEach(()=>vi.unstubAllGlobals());
const book = { id:"first",title:"Primeiro",pdfPath:"https://files.test/book.pdf",pages:[] } as unknown as Book;
async function seed() { await write([{key:deviceKey(account(),"book",book.id),value:{book,chapters:[],bytes:100,installedAt:1} satisfies InstalledBook}]); }
beforeEach(async()=>{vi.restoreAllMocks();localStorage.clear();localStorage.setItem("books-username","Ana");Object.defineProperty(navigator,"onLine",{configurable:true,value:true});connectionRestored();await write([], (await rows("")).map(row=>row.key));deviceChanged();});
describe("offline device storage",()=>{
 it("isolates downloaded books and queued changes by authenticated account",async()=>{await seed();expect((await installedRecords()).length).toBe(1);localStorage.setItem("books-username","Outra");expect(await installedBook("first")).toBeNull();expect(await installedRecords()).toEqual([]);expect(await pendingMutations()).toEqual([]);});
 it("coalesces page changes durably and refuses identity/permission mutations",async()=>{await seed();await queueMutation("PUT","/progress/first",{bookId:"first",currentPage:1});await queueMutation("PUT","/progress/first",{bookId:"first",currentPage:8});const queue=await pendingMutations();expect(queue).toHaveLength(1);expect(queue[0].body.currentPage).toBe(8);await rememberResponse("/progress/first",{bookId:"first",currentPage:0});expect(await read(deviceKey(account(),"snapshot","/progress/first"))).toMatchObject({currentPage:8});await expect(queueMutation("PUT","/auth/me",{displayName:"Fake"})).rejects.toThrow(/permissões/);expect(await pendingMutations()).toHaveLength(1);});
 it("never marks a failed PDF download as installed",async()=>{vi.spyOn(globalThis,"fetch").mockImplementation(async input=>{const url=String(input);if(url.includes("files.test"))return new Response("unavailable",{status:503});if(url.endsWith("/chapters"))return Response.json([]);if(url.endsWith("/books/first"))return Response.json(book);return Response.json([]);});await expect(installBook("first")).rejects.toThrow();expect(await installedBook("first")).toBeNull();});
 it("retains pending changes on expired sessions and never sends them under another account",async()=>{await seed();await queueMutation("PUT","/progress/first",{bookId:"first",currentPage:3});const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("unauthorized",{status:401}));await synchronize();expect(await pendingMutations()).toHaveLength(1);expect(fetch).toHaveBeenCalledTimes(1);fetch.mockClear();fetch.mockResolvedValue(Response.json({username:"Outra"}));await synchronize();expect(fetch).toHaveBeenCalledTimes(1);expect(await pendingMutations()).toHaveLength(1);});
 it("replays only after checking the session and clears acknowledged operations",async()=>{await seed();await queueMutation("PUT","/progress/first",{bookId:"first",currentPage:4});const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(Response.json({username:"Ana"})).mockResolvedValueOnce(Response.json({ok:true}));await synchronize();expect(fetch.mock.calls[1][1]).toMatchObject({method:"PUT",credentials:"include"});expect(await pendingMutations()).toEqual([]);});
 it("assigns stable client IDs to notes for idempotent replay",async()=>{await seed();const note=await queueMutation<{id:string}>("POST","/notes",{bookId:"first",feedback:"Gostei",rating:5});expect(note.id).toMatch(/^offline-/);const mutation=(await pendingMutations())[0];expect(mutation.body.clientId).toBe(note.id);await queueMutation("DELETE","/notes/"+note.id);expect(await pendingMutations()).toHaveLength(1);expect((await pendingMutations())[0].method).toBe("DELETE");});
});

it("installs EPUB using only the original download and stores a local PDF for the reader",async()=>{
 vi.stubGlobal("Blob",NativeBlob);
 const source={...book,epubPath:"https://files.test/book.epub"};
 vi.mocked(convertEpub).mockResolvedValue({file:new NativeBlob(["%PDF-1.7 generated"], {type:"application/pdf"}),title:"Primeiro",author:"Autora",pageCount:1} as any);
 const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(async input=>{
  const url=String(input);if(url.endsWith("/books/first"))return Response.json(source);if(url.endsWith(".epub"))return new Response("PK-EPUB fixture");return Response.json([]);
 });
 await installBook("first","epub");const [record]=await installedRecords();
 expect(record.format).toBe("epub");expect(record.epub?.size).toBeGreaterThan(0);expect(record.pdf?.size).toBeGreaterThan(0);
 expect(fetch.mock.calls.some(([url])=>String(url).endsWith(".pdf"))).toBe(false);expect(convertEpub).toHaveBeenCalledOnce();
});
it("preserves an existing installation when preparing a replacement EPUB fails",async()=>{
 await seed();vi.mocked(convertEpub).mockRejectedValue(new Error("EPUB inválido"));
 vi.spyOn(globalThis,"fetch").mockImplementation(async input=>String(input).endsWith("/books/first") ? Response.json({...book,epubPath:"https://files.test/book.epub"}) : String(input).endsWith(".epub") ? new Response("PK fixture") : Response.json([]));
 await expect(installBook("first","epub")).rejects.toThrow("EPUB inválido");expect((await installedRecords())[0].installedAt).toBe(1);
});
it("keeps offline installation available for text-only books",async()=>{
 const textBook={...book,pdfPath:null,pages:['Primeira página','Segunda página']};
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>String(input).endsWith('/books/first') ? Response.json(textBook) : Response.json([]));
 await installBook('first');expect((await installedBook('first'))?.pages).toEqual(textBook.pages);
});
