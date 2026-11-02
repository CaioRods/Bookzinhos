// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { BookReader } from "./BookReader";
import { fetchBook, fetchProgress, saveProgress } from "../lib/api";

const pdf = vi.hoisted(() => ({ promise: new Promise<unknown>(() => {}) }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: pdf.promise, destroy: async () => {} }) }));
vi.mock("../lib/api", () => ({ fetchBook: vi.fn(), fetchProgress: vi.fn(), saveProgress: vi.fn(), fetchChapters: async () => [], saveChapter: vi.fn(), deleteChapter: vi.fn(), sendActivityHeartbeat: vi.fn(), markReaderTutorialSeen: vi.fn() }));
vi.mock("../lib/offline/device", () => ({ installedPdf: async () => undefined, isOffline: () => false }));
vi.mock("../lib/settings", () => ({ useSettings: () => [{ smoothZoom: false }, vi.fn()] }));
vi.mock("../components/PdfViewport", () => ({ PdfViewport: () => <div>PDF viewport</div> }));
vi.mock("../components/PdfCanvas", () => ({ PdfCanvas: () => <div>PDF canvas</div> }));
vi.mock("../components/ReaderTutorial", () => ({ ReaderTutorial: () => null }));
vi.mock("../components/ReaderCalibration", () => ({ ReaderCalibration: () => null }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("books-username", "Ana");
  localStorage.setItem("mybooks-reader-prefs", JSON.stringify({ layout: "single" }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
  vi.mocked(fetchProgress).mockResolvedValue(null);
  vi.mocked(saveProgress).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const reader = () => render(<MemoryRouter initialEntries={["/read/book"]}><Routes><Route path="/read/:id" element={<BookReader />} /></Routes></MemoryRouter>);

describe("reading progress persistence", () => {
  it("waits for the actual PDF page count before autosaving", async () => {
    vi.mocked(fetchBook).mockResolvedValue({ id: "book", title: "PDF", pdfPath: "https://example.invalid/book.pdf", pages: [] } as never);
    vi.mocked(fetchProgress).mockResolvedValue({ currentPage: 2, totalPages: 5, status: "lendo" } as never);
    reader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it("flushes the last page when leaving before the debounce expires", async () => {
    vi.mocked(fetchBook).mockResolvedValue({ id: "book", title: "Texto", pdfPath: null, pages: ["first", "second", "third"] } as never);
    const view = reader();
    await act(async () => {});
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(document.querySelector("[data-reader-page]")?.getAttribute("data-reader-page")).toBe("2");
    view.unmount();
    await act(async () => {});
    expect(saveProgress).toHaveBeenCalledWith(expect.objectContaining({ bookId: "book", currentPage: 1, totalPages: 3 }));
  });

  it("recovers from outdated or malformed saved reader preferences", async () => {
    localStorage.setItem("mybooks-reader-prefs", JSON.stringify({ theme: "removed-theme", layout: "obsolete", pageScale: "bad" }));
    vi.mocked(fetchBook).mockResolvedValue({ id: "book", title: "Texto", pages: ["first", "second"] } as never);
    reader();
    await act(async () => {});
    expect(document.querySelector("[data-reader-stage]")).not.toBeNull();
  });

  it("does not flush the previous reader's position under another account", async () => {
    vi.mocked(fetchBook).mockResolvedValue({ id: "book", title: "Texto", pages: ["first", "second", "third"] } as never);
    const view = reader();
    await act(async () => {});
    fireEvent.keyDown(window, { key: "ArrowRight" });
    localStorage.setItem("books-username", "Bia");
    view.unmount();
    await act(async () => {});
    expect(saveProgress).not.toHaveBeenCalled();
  });
});
