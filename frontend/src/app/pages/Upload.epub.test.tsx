// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ convert: vi.fn(), upload: vi.fn(), progress: vi.fn() }));
vi.mock("../lib/epub/convert", () => ({ bookFileKind: (file: File) => file.name.endsWith(".epub") ? "epub" : "pdf", convertEpub: mocks.convert }));
vi.mock("../lib/api", () => ({ uploadBook: mocks.upload, saveProgress: mocks.progress }));
vi.mock("../components/AuthorField", () => ({ AuthorField: ({ value, onChange }: any) => <label>Autor<input value={value} onChange={event => onChange(event.target.value)} /></label> }));
vi.mock("../lib/bookMetadata", async importOriginal => ({ ...await importOriginal<object>(), searchBookMetadata: vi.fn(async () => []) }));
vi.mock("../components/SeriesField", () => ({ SeriesField: () => null }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async () => ({ getViewport: () => ({ width: 1, height: 1 }), render: () => ({ promise: Promise.resolve() }) }) }), destroy: async () => {} }) }));
import { Upload } from "./Upload";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("File", class extends File { async arrayBuffer() { return new ArrayBuffer(10); } });
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:test-cover"; } static revokeObjectURL() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["cover"], { type: "image/jpeg" })));
  mocks.upload.mockResolvedValue({ id: "converted" }); mocks.progress.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() { const view = render(<MemoryRouter><Upload /></MemoryRouter>); return view.container.querySelector('input[type="file"]')!; }
it("blocks submit during conversion, preserves edited fields and uploads only the generated PDF", async () => {
  let complete!: (result: unknown) => void;
  mocks.convert.mockImplementation((_file, _signal, progress) => { progress(25); return new Promise(resolve => { complete = resolve; }); });
  const input = setup();
  fireEvent.change(input, { target: { files: [new File(["epub"], "source.epub")] } });
  expect(await screen.findByText(/Convertendo EPUB para PDF/)).toHaveTextContent("25%");
  expect(screen.getByRole("button", { name: "Publicar no acervo" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Meu título" } });
  fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Minha autora" } });
  fireEvent.click(screen.getByRole("button", { name: "Fantasia" })); fireEvent.click(screen.getByRole("button", { name: "Romance" }));
  const pdf = new File(["%PDF-"], "source.pdf", { type: "application/pdf" });
  await act(async () => complete({ file: pdf, title: "Metadado do EPUB", author: "Autor original", pageCount: 2 }));
  await screen.findByText("source.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Publicar no acervo" }));
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  expect(mocks.upload.mock.calls[0][0]).toMatchObject({ pdfFile: pdf, title: "Meu título", author: "Minha autora", genre: "Fantasia, Romance" });
  await waitFor(() => expect(mocks.progress).toHaveBeenCalledWith(expect.objectContaining({ totalPages: 2, bookId: "converted" })));
});
it("shows a recoverable error and never uploads a failed EPUB conversion", async () => {
  mocks.convert.mockRejectedValue(new Error("EPUB inválido.")); const input = setup();
  fireEvent.change(input, { target: { files: [new File(["invalid"], "broken.epub")] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("EPUB inválido.");
  expect(screen.getByRole("button", { name: "Publicar no acervo" })).toBeDisabled(); expect(mocks.upload).not.toHaveBeenCalled();
});
it("allows cancelling the worker without losing the form or uploading anything", async () => {
  let signal!: AbortSignal;
  mocks.convert.mockImplementation((_file, current) => { signal = current; return new Promise((_resolve, reject) => current.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")))); });
  const input = setup(); fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título preservado" } });
  fireEvent.change(input, { target: { files: [new File(["epub"], "cancel.epub")] } });
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar conversão" }));
  await waitFor(() => expect(signal.aborted).toBe(true));
  expect(screen.getByLabelText("Título")).toHaveValue("Título preservado");
  expect(screen.getByRole("button", { name: "Publicar no acervo" })).toBeDisabled(); expect(mocks.upload).not.toHaveBeenCalled();
});
