import { newIdentity, type Identity } from './groupCrypto.ts';

// Non-extractable CryptoKeys can't be written to localStorage, but IndexedDB
// stores them as opaque handles: usable by this site, never readable as bytes.
const DB = 'enchanted-atlas';
const STORE = 'keys';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const req = op(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** This device's identity, created on first use. Falls back to a session-only key if storage is blocked. */
export async function deviceIdentity(): Promise<Identity> {
  try {
    const found = await run<Identity | undefined>('readonly', (s) => s.get('identity'));
    if (found) return found;
    const fresh = await newIdentity();
    await run('readwrite', (s) => s.put(fresh, 'identity'));
    return fresh;
  } catch {
    return newIdentity();
  }
}
