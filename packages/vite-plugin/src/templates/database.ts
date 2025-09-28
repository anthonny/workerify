export type Route = { method?: string; path: string; match?: string };

// IndexedDB configuration
const DB_NAME = 'workerify-sw-state';
const DB_VERSION = 1;
const STORE_NAME = 'state';

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Save state to IndexedDB
export async function saveState({
  clientConsumerMap,
  consumerRoutesMap,
}: {
  clientConsumerMap: Map<string, string>;
  consumerRoutesMap: Map<string, Array<Route>>;
}) {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Convert Maps to serializable arrays
    const clientConsumerArray = Array.from(clientConsumerMap.entries());
    const consumerRoutesArray = Array.from(consumerRoutesMap.entries());

    store.put(clientConsumerArray, 'clientConsumerMap');
    store.put(consumerRoutesArray, 'consumerRoutesMap');

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    console.log('[Workerify SW] State saved to IndexedDB');
  } catch (error) {
    console.error('[Workerify SW] Failed to save state:', error);
  }
}

// Load state from IndexedDB
export async function loadState(): Promise<{
  clientConsumerMap: Map<string, string>;
  consumerRoutesMap: Map<string, Route[]>;
}> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const clientConsumerRequest = store.get('clientConsumerMap');
    const consumerRoutesRequest = store.get('consumerRoutesMap');

    const [clientConsumerArray, consumerRoutesArray] = await Promise.all([
      new Promise<[string, string][]>((resolve) => {
        clientConsumerRequest.onsuccess = () =>
          resolve(clientConsumerRequest.result || []);
      }),
      new Promise<[string, Array<Route>][]>((resolve) => {
        consumerRoutesRequest.onsuccess = () =>
          resolve(consumerRoutesRequest.result || []);
      }),
    ]);

    // Restore Maps from arrays
    const clientConsumerMap = new Map(clientConsumerArray);
    const consumerRoutesMap = new Map(consumerRoutesArray);

    db.close();
    console.log('[Workerify SW] State loaded from IndexedDB');
    console.log('[Workerify SW] Restored clients:', clientConsumerMap.size);
    console.log('[Workerify SW] Restored consumers:', consumerRoutesMap.size);
    return {
      clientConsumerMap,
      consumerRoutesMap,
    };
  } catch (error) {
    console.error('[Workerify SW] Failed to load state:', error);
    return {
      clientConsumerMap: new Map(),
      consumerRoutesMap: new Map(),
    };
  }
}
