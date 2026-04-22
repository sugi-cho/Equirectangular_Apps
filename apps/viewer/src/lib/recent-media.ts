const DB_NAME = "equirectangular-viewer";
const DB_VERSION = 1;
const STORE_NAME = "recent-media";
const LAST_MEDIA_KEY = "last";

type SourceKind = "image" | "video";

export type StoredMedia = {
  kind: SourceKind;
  sourceName: string;
  currentTime: number;
  loop: boolean;
  blob: Blob;
};

type StoredMediaRecord = StoredMedia & {
  key: string;
};

export async function saveLastMedia(media: StoredMedia) {
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({ key: LAST_MEDIA_KEY, ...media } satisfies StoredMediaRecord);
  await waitForTransaction(tx);
  database.close();
}

export async function loadLastMedia() {
  const database = await openDatabase();
  const tx = database.transaction(STORE_NAME, "readonly");
  const request = tx.objectStore(STORE_NAME).get(LAST_MEDIA_KEY);
  const record = await waitForRequest<StoredMediaRecord | undefined>(request);
  await waitForTransaction(tx);
  database.close();
  return record ?? null;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForTransaction(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}
