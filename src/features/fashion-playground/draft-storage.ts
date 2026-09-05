"use client";

export type FashionDraft = {
  id: string;
  createdAt: number;
  productFile: File | null;
  modelFile: File | null;
  productAssetId: string | null;
  modelAssetId: string | null;
  scene: "studio" | "lifestyle" | "outdoor";
  lighting: "soft-daylight" | "studio-softbox" | "golden-hour";
  aspectRatio: "1:1" | "4:5" | "9:16";
  autoResume: boolean;
};

const DATABASE = "airveek-private-drafts";
const STORE = "drafts";
const POINTER = "airveek:fashion-photoshoot-draft";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function loadFashionDraft(): Promise<FashionDraft | null> {
  try {
    const draftId = localStorage.getItem(POINTER);
    if (!draftId) return null;
    const db = await openDatabase();
    const value = await requestValue<FashionDraft | undefined>(db.transaction(STORE, "readonly").objectStore(STORE).get(draftId));
    db.close();
    if (!value || Date.now() - value.createdAt > MAX_AGE_MS) {
      if (value) await clearFashionDraft();
      return null;
    }
    return value;
  } catch { return null; }
}

export async function saveFashionDraft(draft: FashionDraft): Promise<void> {
  try {
    const db = await openDatabase();
    await transactionDone(db.transaction(STORE, "readwrite"), (store) => store.put(draft));
    db.close();
  } catch {
    // In-memory state still supports same-session authentication when storage is blocked.
  }
}

export async function clearFashionDraft(): Promise<void> {
  try {
    const draftId = localStorage.getItem(POINTER);
    if (!draftId) return;
    const db = await openDatabase();
    await transactionDone(db.transaction(STORE, "readwrite"), (store) => store.delete(draftId));
    db.close();
    localStorage.removeItem(POINTER);
  } catch { /* optional local persistence */ }
}

export function getOrCreateFashionDraftId(): string {
  const existing = localStorage.getItem(POINTER);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const draftId = crypto.randomUUID();
  localStorage.setItem(POINTER, draftId);
  return draftId;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionDone(transaction: IDBTransaction, operation: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    operation(transaction.objectStore(STORE));
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
}
