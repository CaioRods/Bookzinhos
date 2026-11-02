// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());
describe("durable device transactions", () => {
  it("can retry when the browser initially rejects opening IndexedDB", async () => {
    vi.resetModules();
    const { database } = await import("./db");
    vi.spyOn(indexedDB, "open").mockImplementationOnce(() => { throw new DOMException("blocked", "SecurityError"); });
    await expect(database()).rejects.toThrow("blocked");
    const connection = await database();
    expect(connection.name).toBe("mybooks-device-v1");
    connection.close();
  });

  it("rolls back every record if a later write cannot be cloned", async () => {
    vi.resetModules();
    const { read, write } = await import("./db");
    const key = "atomic-" + crypto.randomUUID();
    await expect(write([{ key, value: "must roll back" }, { key: key + "-bad", value: () => {} }])).rejects.toThrow();
    expect(await read(key)).toBeUndefined();
  });

  it("removes only the acknowledged queue revision", async () => {
    vi.resetModules();
    const { read, write, removeRevision } = await import("./db");
    const key = "revision-" + crypto.randomUUID();
    await write([{ key, value: { revision: "new", page: 12 } }]);
    await removeRevision(key, "old");
    expect(await read(key)).toEqual({ revision: "new", page: 12 });
    await removeRevision(key, "new");
    expect(await read(key)).toBeUndefined();
  });
});
