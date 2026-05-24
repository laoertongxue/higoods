const DB_NAME = 'higood-pattern-library';
const DB_VERSION = 1;
const STORE_META = 'pattern-library-meta';
const STORE_BLOBS = 'pattern-library-blobs';
const STORE_STATE_KEY = 'pattern-library-store';
function supportsIndexedDb() {
    return typeof indexedDB !== 'undefined';
}
function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
    });
}
function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'));
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
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
    });
    return dbPromise;
}
function createBlobKey(kind) {
    return `${kind}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}
async function readStoreSnapshot() {
    if (!supportsIndexedDb())
        return null;
    const db = await openDb();
    const transaction = db.transaction(STORE_META, 'readonly');
    const store = transaction.objectStore(STORE_META);
    const record = await requestToPromise(store.get(STORE_STATE_KEY));
    return record?.value ?? null;
}
async function writeStoreSnapshot(storeSnapshot) {
    if (!supportsIndexedDb())
        return;
    const db = await openDb();
    const transaction = db.transaction(STORE_META, 'readwrite');
    transaction.objectStore(STORE_META).put({
        key: STORE_STATE_KEY,
        value: storeSnapshot,
    });
    await transactionDone(transaction);
}
async function clearAll() {
    if (!supportsIndexedDb())
        return;
    const db = await openDb();
    const transaction = db.transaction([STORE_META, STORE_BLOBS], 'readwrite');
    transaction.objectStore(STORE_META).clear();
    transaction.objectStore(STORE_BLOBS).clear();
    await transactionDone(transaction);
}
export const patternRepo = {
    async loadStore() {
        return readStoreSnapshot();
    },
    async saveStore(storeSnapshot) {
        await writeStoreSnapshot(storeSnapshot);
    },
    async upsert(asset, storeSnapshot) {
        const index = storeSnapshot.assets.findIndex((item) => item.id === asset.id);
        if (index >= 0)
            storeSnapshot.assets[index] = asset;
        else
            storeSnapshot.assets.push(asset);
        await writeStoreSnapshot(storeSnapshot);
    },
    async get(id) {
        const snapshot = await readStoreSnapshot();
        return snapshot?.assets.find((item) => item.id === id) ?? null;
    },
    async list() {
        const snapshot = await readStoreSnapshot();
        return snapshot?.assets ?? [];
    },
    async saveBlob(blob, kind, preferredKey) {
        if (!supportsIndexedDb())
            return preferredKey ?? createBlobKey(kind);
        const key = preferredKey ?? createBlobKey(kind);
        const db = await openDb();
        const transaction = db.transaction(STORE_BLOBS, 'readwrite');
        transaction.objectStore(STORE_BLOBS).put({
            key,
            blob,
            kind,
            created_at: new Date().toISOString(),
        });
        await transactionDone(transaction);
        return key;
    },
    async getBlob(key) {
        if (!supportsIndexedDb())
            return null;
        const db = await openDb();
        const transaction = db.transaction(STORE_BLOBS, 'readonly');
        const store = transaction.objectStore(STORE_BLOBS);
        const record = await requestToPromise(store.get(key));
        return record?.blob ?? null;
    },
    async deleteBlob(key) {
        if (!supportsIndexedDb())
            return;
        const db = await openDb();
        const transaction = db.transaction(STORE_BLOBS, 'readwrite');
        transaction.objectStore(STORE_BLOBS).delete(key);
        await transactionDone(transaction);
    },
    async clear() {
        await clearAll();
    },
};
