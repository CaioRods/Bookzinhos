let opened: Promise<IDBDatabase> | undefined;
export function database() {
  if (opened) return opened;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mybooks-device-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records", { keyPath: "key" });
    request.onsuccess = () => {
      const db = request.result;
      const reset = () => { if (opened === promise) opened = undefined; };
      db.onversionchange = () => { db.close(); reset(); };
      db.onclose = reset;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => { if (opened === promise) opened = undefined; throw error; });
  opened = promise;
  return promise;
}
export interface DeviceRow<T = unknown> { key: string; value: T }
export async function read<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => { const request = db.transaction("records").objectStore("records").get(key); request.onsuccess = () => resolve(request.result?.value); request.onerror = () => reject(request.error); });
}
export async function rows<T>(prefix: string): Promise<DeviceRow<T>[]> {
  const db = await database();
  return new Promise((resolve, reject) => { const request = db.transaction("records").objectStore("records").getAll(IDBKeyRange.bound(prefix, prefix + "\uffff")); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function write(records: DeviceRow[], remove: string[] = []) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("records", "readwrite"), store = transaction.objectStore("records");
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error("Armazenamento interrompido."));
    try { records.forEach(row => store.put(row)); remove.forEach(key => store.delete(key)); }
    catch (error) { transaction.abort(); reject(error); }
  });
}

/** Acknowledgements must never erase a newer edit, including from another tab. */
export async function removeRevision(key: string, revision: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("records", "readwrite");
    const store = transaction.objectStore("records");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Armazenamento interrompido."));
    const request = store.get(key);
    request.onsuccess = () => { if (request.result?.value?.revision === revision) store.delete(key); };
  });
}
