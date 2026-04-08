import type {
  PatternAsset,
  PatternBlobKind,
  PatternBlobRecord,
  PatternLibraryStoreSnapshot,
} from './pcs-pattern-library-types.ts'

const DB_NAME = 'higood-pattern-library'
const DB_VERSION = 1
const STORE_META = 'pattern-library-meta'
const STORE_BLOBS = 'pattern-library-blobs'
const STORE_STATE_KEY = 'pattern-library-store'

interface MetaRecord {
  key: string
  value: PatternLibraryStoreSnapshot
}

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'))
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

async function openDb(): Promise<IDBDatabase> {
  if (!supportsIndexedDb()) {
    throw new Error('当前环境不支持 IndexedDB')
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'))
  })
  return dbPromise
}

function createBlobKey(kind: PatternBlobKind): string {
  return `${kind}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

async function readStoreSnapshot(): Promise<PatternLibraryStoreSnapshot | null> {
  if (!supportsIndexedDb()) return null
  const db = await openDb()
  const transaction = db.transaction(STORE_META, 'readonly')
  const store = transaction.objectStore(STORE_META)
  const record = await requestToPromise(store.get(STORE_STATE_KEY) as IDBRequest<MetaRecord | undefined>)
  return record?.value ?? null
}

async function writeStoreSnapshot(storeSnapshot: PatternLibraryStoreSnapshot): Promise<void> {
  if (!supportsIndexedDb()) return
  const db = await openDb()
  const transaction = db.transaction(STORE_META, 'readwrite')
  transaction.objectStore(STORE_META).put({
    key: STORE_STATE_KEY,
    value: storeSnapshot,
  } satisfies MetaRecord)
  await transactionDone(transaction)
}

async function clearAll(): Promise<void> {
  if (!supportsIndexedDb()) return
  const db = await openDb()
  const transaction = db.transaction([STORE_META, STORE_BLOBS], 'readwrite')
  transaction.objectStore(STORE_META).clear()
  transaction.objectStore(STORE_BLOBS).clear()
  await transactionDone(transaction)
}

export const patternRepo = {
  async loadStore(): Promise<PatternLibraryStoreSnapshot | null> {
    return readStoreSnapshot()
  },

  async saveStore(storeSnapshot: PatternLibraryStoreSnapshot): Promise<void> {
    await writeStoreSnapshot(storeSnapshot)
  },

  async upsert(asset: PatternAsset, storeSnapshot: PatternLibraryStoreSnapshot): Promise<void> {
    const index = storeSnapshot.assets.findIndex((item) => item.id === asset.id)
    if (index >= 0) storeSnapshot.assets[index] = asset
    else storeSnapshot.assets.push(asset)
    await writeStoreSnapshot(storeSnapshot)
  },

  async get(id: string): Promise<PatternAsset | null> {
    const snapshot = await readStoreSnapshot()
    return snapshot?.assets.find((item) => item.id === id) ?? null
  },

  async list(): Promise<PatternAsset[]> {
    const snapshot = await readStoreSnapshot()
    return snapshot?.assets ?? []
  },

  async saveBlob(blob: Blob, kind: PatternBlobKind, preferredKey?: string): Promise<string> {
    if (!supportsIndexedDb()) return preferredKey ?? createBlobKey(kind)
    const key = preferredKey ?? createBlobKey(kind)
    const db = await openDb()
    const transaction = db.transaction(STORE_BLOBS, 'readwrite')
    transaction.objectStore(STORE_BLOBS).put({
      key,
      blob,
      kind,
      created_at: new Date().toISOString(),
    } satisfies PatternBlobRecord)
    await transactionDone(transaction)
    return key
  },

  async getBlob(key: string): Promise<Blob | null> {
    if (!supportsIndexedDb()) return null
    const db = await openDb()
    const transaction = db.transaction(STORE_BLOBS, 'readonly')
    const store = transaction.objectStore(STORE_BLOBS)
    const record = await requestToPromise(store.get(key) as IDBRequest<PatternBlobRecord | undefined>)
    return record?.blob ?? null
  },

  async deleteBlob(key: string): Promise<void> {
    if (!supportsIndexedDb()) return
    const db = await openDb()
    const transaction = db.transaction(STORE_BLOBS, 'readwrite')
    transaction.objectStore(STORE_BLOBS).delete(key)
    await transactionDone(transaction)
  },

  async clear(): Promise<void> {
    await clearAll()
  },
}
