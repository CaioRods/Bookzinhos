let opened: Promise<IDBDatabase> | undefined;
export function database() {
  return opened ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mybooks-device-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opened = undefined; reject(request.error); };
  });
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
    records.forEach(row => store.put(row)); remove.forEach(key => store.delete(key));
  });
}
