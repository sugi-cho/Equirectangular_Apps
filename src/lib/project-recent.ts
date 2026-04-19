import { parseProject } from "./project-file";
import type { StoryboardScene } from "./types";

export type ProjectFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: string | Blob | BufferSource) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

export type RecentProjectEntry = {
  id: string;
  name: string;
  snapshot: string;
  handle?: ProjectFileHandle | null;
  lastOpenedAt: number;
};

const DB_NAME = "equirectangular-storyboard-web";
const DB_VERSION = 1;
const STORE_NAME = "recent-projects";

export async function listRecentProjects() {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const entries = (await requestToPromise<RecentProjectEntry[]>(store.getAll())).sort(
    (a, b) => b.lastOpenedAt - a.lastOpenedAt,
  );
  db.close();
  return entries;
}

export async function upsertRecentProject(params: {
  name: string;
  snapshot: string;
  handle?: ProjectFileHandle | null;
}) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const entry: RecentProjectEntry = {
    id: params.name,
    name: params.name,
    snapshot: params.snapshot,
    handle: params.handle ?? null,
    lastOpenedAt: Date.now(),
  };
  await requestToPromise(store.put(entry));
  await transactionDone(transaction);
  db.close();
  return entry;
}

export async function loadProjectFromRecent(entry: RecentProjectEntry) {
  if (entry.handle) {
    try {
      const file = await entry.handle.getFile();
      const text = await file.text();
      return parseProject(text);
    } catch {
      // Fall back to the stored snapshot if the file is unavailable.
    }
  }

  return parseProject(entry.snapshot);
}

async function openDatabase() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  };
  return requestToPromise<IDBDatabase>(request);
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function loadRecentProjectsSnapshot() {
  const entries = await listRecentProjects();
  if (entries.length === 0) {
    return null;
  }
  const scene = await loadProjectFromRecent(entries[0]);
  return { entry: entries[0], scene };
}

export function sceneFileNameFromProject(scene: StoryboardScene, fallback = "scene.json") {
  return fallback;
}
