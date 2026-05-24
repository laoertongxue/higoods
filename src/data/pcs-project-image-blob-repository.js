const DB_NAME = 'higood-project-images';
const DB_VERSION = 1;
const STORE_BLOBS = 'project-image-blobs';
const memoryBlobStore = new Map();
function supportsIndexedDb() {
    return typeof indexedDB !== 'undefined';
}
function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('项目图片 IndexedDB 请求失败'));
    });
}
function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('项目图片 IndexedDB 事务失败'));
        transaction.onabort = () => reject(transaction.error ?? new Error('项目图片 IndexedDB 事务已中止'));
    });
}
let dbPromise = null;
async function openDb() {
    if (!supportsIndexedDb()) {
        throw new Error('当前环境不支持 IndexedDB');
    }
    if (dbPromise)
        return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('项目图片 IndexedDB 打开失败'));
    });
    return dbPromise;
}
export async function saveProjectImageBlob(blob, preferredKey) {
    if (!supportsIndexedDb()) {
        memoryBlobStore.set(preferredKey, blob);
        return preferredKey;
    }
    const db = await openDb();
    const transaction = db.transaction(STORE_BLOBS, 'readwrite');
    transaction.objectStore(STORE_BLOBS).put({
        key: preferredKey,
        blob,
        createdAt: new Date().toISOString(),
    });
    await transactionDone(transaction);
    return preferredKey;
}
export async function getProjectImageBlob(storageKey) {
    if (!storageKey)
        return null;
    if (!supportsIndexedDb()) {
        return memoryBlobStore.get(storageKey) || null;
    }
    const db = await openDb();
    const transaction = db.transaction(STORE_BLOBS, 'readonly');
    const record = await requestToPromise(transaction.objectStore(STORE_BLOBS).get(storageKey));
    return record?.blob || null;
}
export async function deleteProjectImageBlob(storageKey) {
    if (!storageKey)
        return;
    if (!supportsIndexedDb()) {
        memoryBlobStore.delete(storageKey);
        return;
    }
    const db = await openDb();
    const transaction = db.transaction(STORE_BLOBS, 'readwrite');
    transaction.objectStore(STORE_BLOBS).delete(storageKey);
    await transactionDone(transaction);
}
export async function resetProjectImageBlobStore() {
    memoryBlobStore.clear();
    if (!supportsIndexedDb())
        return;
    const db = await openDb();
    const transaction = db.transaction(STORE_BLOBS, 'readwrite');
    transaction.objectStore(STORE_BLOBS).clear();
    await transactionDone(transaction);
}
