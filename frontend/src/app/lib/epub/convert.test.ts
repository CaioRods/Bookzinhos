// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { convertEpub } from "./convert";
afterEach(() => vi.unstubAllGlobals());
it("terminates the conversion worker when a new selection aborts the current file", async () => {
  const stop = vi.fn(); let worker: any;
  vi.stubGlobal("Worker", class { onmessage: any; onerror: any; constructor() { worker = this; } postMessage() {} terminate = stop; });
  const controller = new AbortController();
  const file = { name: "test.epub", size: 10, arrayBuffer: async () => new ArrayBuffer(10) } as File;
  const conversion = convertEpub(file, controller.signal, vi.fn());
  await Promise.resolve(); controller.abort();
  await expect(conversion).rejects.toHaveProperty("name", "AbortError");
  expect(stop).toHaveBeenCalledOnce(); expect(worker.onmessage).toBeNull();
});
it("does not start a worker for an oversized or already cancelled input", async () => {
  const Worker = vi.fn(); vi.stubGlobal("Worker", Worker);
  const controller = new AbortController(); controller.abort();
  await expect(convertEpub({ size: 100, arrayBuffer: async () => new ArrayBuffer(1) } as File, controller.signal, vi.fn())).rejects.toHaveProperty("name", "AbortError");
  await expect(convertEpub({ size: 41 * 1024 * 1024 } as File, new AbortController().signal, vi.fn())).rejects.toThrow(/40 MB/);
  expect(Worker).not.toHaveBeenCalled();
});
