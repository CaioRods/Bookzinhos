// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addNote, fetchBook, fetchBooks, fetchHome, invalidate } from "./api";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); invalidate(); });

describe("API cache consistency", () => {
  it("does not reuse or cache a request started before invalidation", async () => {
    const old = deferred();
    const fresh = deferred();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = fetchHome();
    invalidate("/home");
    const second = fetchHome();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fresh.resolve(json({ books: ["fresh"] }));
    await second;
    old.resolve(json({ books: ["stale"] }));
    await first;
    await expect(fetchHome()).resolves.toEqual({ books: ["fresh"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps deduplication for the replacement request when an old request finishes", async () => {
    const old = deferred();
    const fresh = deferred();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const first = fetchHome();
    invalidate("/home");
    const second = fetchHome();
    old.resolve(json({ books: [] }));
    await first;
    const third = fetchHome();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fresh.resolve(json({ books: ["fresh"] }));
    await expect(second).resolves.toEqual({ books: ["fresh"] });
    await expect(third).resolves.toEqual({ books: ["fresh"] });
  });

  it("rejects a failed mutation instead of reporting a 404 as success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: "Livro não encontrado" }, 404));
    await expect(addNote({ bookId: "missing", feedback: "nota", rating: 5 })).rejects.toThrow("Livro não encontrado");
    await expect(fetchBook("missing")).resolves.toBeNull();
  });

  it("does not reuse another account's persisted catalog", async () => {
    localStorage.setItem("books-username", "ana");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json([{ id: "ana-book" }])).mockResolvedValueOnce(json([{ id: "other-book" }]));
    await fetchBooks();
    localStorage.setItem("books-username", "outra");
    await expect(fetchBooks()).resolves.toEqual([{ id: "other-book" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not persist a stale catalog response after a mutation", async () => {
    const old = deferred();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(old.promise).mockResolvedValueOnce(json([{ id: "new" }]));
    const first = fetchBooks();
    invalidate("/books");
    await fetchBooks(true);
    old.resolve(json([{ id: "deleted" }]));
    await first;
    await expect(fetchBooks()).resolves.toEqual([{ id: "new" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not log the new account out when an old account's request returns 401", async () => {
    localStorage.setItem("books-username", "Ana");
    const pending = deferred();
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(pending.promise);
    const oldRequest = fetchHome();
    localStorage.setItem("books-username", "Bia");
    pending.resolve(json({ error: "Sessão expirada" }, 401));
    await expect(oldRequest).rejects.toThrow();
    expect(localStorage.getItem("books-username")).toBe("Bia");
  });

  it("does not enqueue an old account's failed request under a newly selected account", async () => {
    localStorage.setItem("books-username", "Ana");
    let reject!: (error: Error) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise<Response>((_, no) => { reject = no; }));
    const oldRequest = addNote({ bookId: "old-book", feedback: "private", rating: 5 });
    localStorage.setItem("books-username", "Bia");
    reject(new TypeError("Network failed"));
    await expect(oldRequest).rejects.toThrow(/conta/i);
  });
});
