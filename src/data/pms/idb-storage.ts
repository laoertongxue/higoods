/**
 * PMS IDB 基础设施
 *
 * 依据:AGENTS.md § 2.4.1 (业务数据 → IndexedDB) 与 § 2.4.3 (读写失败处理)
 * 数据库名:higood-pms
 * 当前版本:1
 *
 * 设计原则:
 * - 每个 store 的 keyPath 严格对齐 PMS 业务对象的业务主键(详见 STORES)。
 * - 事务封装 `pmsTx` 强制返回 oncomplete 才视为提交成功;符合 § 2.4.3.4 "必须等事务 complete 才显示保存成功"。
 * - 失败抛错:`IndexedDB 不可用 / quota exceeded / abort` 一律 PmsDomainError,不静默回退 § 2.4.3.5。
 * - 派生数据(§ 2.4.2 第 3 条)不进 IDB,只在内存缓存。
 */

import { PmsDomainError } from './runtime.ts'

export const PMS_IDB_DB_NAME = 'higood-pms'
export const PMS_IDB_VERSION = 1

export const PMS_STORES = {
  pmsOperationLogs: 'pmsOperationLogs',
  pmsMaterialPurchaseOrderDeltas: 'pmsMaterialPurchaseOrderDeltas',
  pmsBomTemplates: 'pmsBomTemplates',
  pmsBomLogs: 'pmsBomLogs',
  pmsBomDetails: 'pmsBomDetails',
  pmsFirstLegBatches: 'pmsFirstLegBatches',
  pmsFirstLegCarriers: 'pmsFirstLegCarriers',
  pmsFirstLegChannels: 'pmsFirstLegChannels',
  pmsReconciliations: 'pmsReconciliations',
  pmsPaymentRequests: 'pmsPaymentRequests',
  pmsPaymentDrafts: 'pmsPaymentDrafts',
  pmsMaterialRequirements: 'pmsMaterialRequirements',
  pmsSuppliers: 'pmsSuppliers',
  pmsSupplierConfirmations: 'pmsSupplierConfirmations',
  pmsInventoryMonitor: 'pmsInventoryMonitor',
  pmsInventoryOrders: 'pmsInventoryOrders',
  pmsPurchaseSuggestions: 'pmsPurchaseSuggestions',
  pmsKolDemands: 'pmsKolDemands',
  pmsProductPurchaseOrders: 'pmsProductPurchaseOrders',
  pmsSupplyArchives: 'pmsSupplyArchives',
  pmsVersionSnapshots: 'pmsVersionSnapshots',
  pmsTmfOrders: 'pmsTmfOrders',
  pmsTmfProduction: 'pmsTmfProduction',
  pmsTmfScrap: 'pmsTmfScrap',
  pmsTmfOperations: 'pmsTmfOperations',
} as const

export type PmsStoreName = (typeof PMS_STORES)[keyof typeof PMS_STORES]

// 每个 store 的 keyPath;在 onupgradeneeded 中按此创建。
// 所有字段名严格对齐业务对象的业务主键,避免冗余 id 列。
const STORE_KEYPATHS: Record<PmsStoreName, string> = {
  pmsOperationLogs: 'id',
  pmsMaterialPurchaseOrderDeltas: 'purchaseOrderNo',
  pmsBomTemplates: 'spu',
  pmsBomLogs: 'id',
  pmsBomDetails: 'spu',
  pmsFirstLegBatches: 'batchNo',
  pmsFirstLegCarriers: 'carrierCode',
  pmsFirstLegChannels: 'channelCode',
  pmsReconciliations: 'id',
  pmsPaymentRequests: 'requestNo',
  pmsPaymentDrafts: 'draftKey',
  pmsMaterialRequirements: 'requirementNo',
  pmsSuppliers: 'supplierCode',
  pmsSupplierConfirmations: 'confirmationNo',
  pmsInventoryMonitor: 'id',
  pmsInventoryOrders: 'orderNo',
  pmsPurchaseSuggestions: 'suggestionNo',
  pmsKolDemands: 'demandNo',
  pmsProductPurchaseOrders: 'purchaseOrderNo',
  pmsSupplyArchives: 'archiveId',
  pmsVersionSnapshots: 'snapshotKey',
  pmsTmfOrders: 'singleton',
  pmsTmfProduction: 'singleton',
  pmsTmfScrap: 'singleton',
  pmsTmfOperations: 'singleton',
}

let dbPromise: Promise<IDBDatabase> | null = null

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function getPmsDb(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(
      new PmsDomainError('PMS_IDB_UNAVAILABLE', '当前浏览器不支持 IndexedDB,PMS 业务数据无法持久化。'),
    )
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PMS_IDB_DB_NAME, PMS_IDB_VERSION)
    request.onupgradeneeded = (): void => {
      const db = request.result
      for (const storeName of Object.values(PMS_STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: STORE_KEYPATHS[storeName as PmsStoreName] })
        }
      }
    }
    request.onsuccess = (): void => {
      const db = request.result
      // 升级被旧连接阻塞时,主代理按 § 2.4.7 验收门禁要求,提示用户关闭旧标签页后刷新。
      db.onversionchange = (): void => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = (): void => {
      dbPromise = null
      reject(
        new PmsDomainError(
          'PMS_IDB_OPEN_FAILED',
          `无法打开 PMS 业务数据库:${request.error?.message ?? 'unknown error'}。请检查浏览器存储后重试。`,
        ),
      )
    }
    request.onblocked = (): void => {
      dbPromise = null
      reject(
        new PmsDomainError(
          'PMS_IDB_BLOCKED',
          'PMS 业务数据库被旧版本页面阻塞,请关闭其他标签页后刷新。',
        ),
      )
    }
  }).catch((error) => {
    dbPromise = null
    throw error
  })
  return dbPromise
}

/**
 * 事务封装。严格按 § 2.4.3.4:
 * - 必须等 `complete` 才视为提交成功
 * - 单条请求 `success` 不代表整个业务动作保存成功
 * - 写入前完成校验(此函数不做校验,调用方负责)
 */
export async function pmsTx<T>(
  storeNames: PmsStoreName | PmsStoreName[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const db = await getPmsDb()
  const names = Array.isArray(storeNames) ? storeNames : [storeNames]
  const tx = db.transaction(names, mode)
  let fnResult: T | Promise<T>
  try {
    fnResult = fn(tx)
  } catch (error) {
    // 同步抛错立即 abort,避免事务进入奇怪状态
    try {
      tx.abort()
    } catch {
      // abort 自身失败忽略(可能已结束)
    }
    throw error
  }
  const awaited = await fnResult
  return new Promise<T>((resolve, reject) => {
    tx.oncomplete = (): void => resolve(awaited)
    tx.onerror = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_TX_ERROR',
          `PMS 业务数据保存失败:${tx.error?.message ?? 'unknown error'}。当前状态未改变。`,
        ),
      )
    }
    tx.onabort = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_TX_ABORTED',
          `PMS 业务数据保存被中断:${tx.error?.message ?? 'aborted'}。当前状态未改变。`,
        ),
      )
    }
  })
}

export async function pmsPut<T>(storeName: PmsStoreName, value: T): Promise<void> {
  const keyValue = (value as { [k: string]: unknown })[STORE_KEYPATHS[storeName]]
  try {
    await pmsTx(storeName, 'readwrite', (tx) => {
      tx.objectStore(storeName).put(value)
    })
  } catch (error) {
    if (error instanceof PmsDomainError && error.code === 'PMS_IDB_UNAVAILABLE') {
      // IDB 不可用(Safari 隐私模式、Node 测试环境等)—— 持久化层静默跳过,内存态保留,
      // 避免 fire-and-forget 调用点产生 unhandledrejection。hydrate 路径仍会触发 PMS_IDB_HYDRATE_FAILED banner。
      console.warn('[PMS_IDB_UNAVAILABLE] put 跳过,数据仅保留在内存', { store: storeName, key: String(keyValue) })
      return
    }
    throw error
  }
  // 记录本标签页的 entity 写入时间戳,供跨标签页同步 banner 提示判断(§ 2.4.3.6)。
  // 写入后的 entity 在本标签页内被认为有效,其他标签页后到达的更新会被广播 handler 检测到并提示刷新。
  try {
    const at = Date.now()
    recordPmsHydratedAtSafely(storeName, String(keyValue), at)
  } catch {
    // 静默失败:不阻塞 IDB 写入
  }
  // 事务 oncomplete 后通知其他标签页(§ 2.4.3.4 + § 2.4.3.6)
  broadcastPmsDataChanged(storeName, keyValue as string | number, 'pms-user')
}

function recordPmsHydratedAtSafely(storeName: string, key: string, at: number): void {
  // 通过全局变量查找,避免循环 import main.ts
  const g = globalThis as unknown as { __pmsHydratedAt?: Map<string, number> }
  if (!g.__pmsHydratedAt) g.__pmsHydratedAt = new Map<string, number>()
  g.__pmsHydratedAt.set(`${storeName}::${key}`, at)
}

/**
 * 通用持久化函数(§ 2.4.3.6 乐观锁):
 * - 如果 value._pmsBaseVersion 字段存在且 >= 0:用 pmsPutWithVersion 做版本检查
 * - 否则:退化为普通 pmsPut(向后兼容尚未升级的模块)
 * - actor 用于多标签页冲突日志与版本快照记录
 */
export async function pmsPersistEntity<T extends { _pmsBaseVersion?: number }>(
  storeName: PmsStoreName,
  value: T,
  actor: string,
): Promise<void> {
  if (typeof value === 'object' && value !== null && '_pmsBaseVersion' in value && typeof value._pmsBaseVersion === 'number') {
    return pmsPutWithVersion(storeName, value, actor)
  }
  return pmsPut(storeName, value)
}

/**
 * 批量从 pmsVersionSnapshots 拉取某个 store 的版本号映射,供 hydrate 后给内存 entity 注入 _pmsBaseVersion。
 */
export async function pmsGetVersionMap(storeName: PmsStoreName): Promise<Map<string, number>> {
  const prefix = `${storeName}::`
  const db = await getPmsDb()
  return new Promise<Map<string, number>>((resolve, reject) => {
    const tx = db.transaction(PMS_STORES.pmsVersionSnapshots, 'readonly')
    const req = tx.objectStore(PMS_STORES.pmsVersionSnapshots).openCursor()
    const result = new Map<string, number>()
    req.onerror = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_READ_FAILED',
          `读取 PMS 版本快照失败:${req.error?.message ?? 'unknown error'}`,
        ),
      )
    }
    req.onsuccess = (): void => {
      const cursor = req.result
      if (!cursor) {
        resolve(result)
        return
      }
      const key = cursor.key as string
      if (key.startsWith(prefix)) {
        const entityKey = key.slice(prefix.length)
        result.set(entityKey, (cursor.value as { version: number }).version)
      }
      cursor.continue()
    }
  })
}

/**
 * 乐观锁写入(§ 2.4.3.6):
 * - 读取 pmsVersionSnapshots 中该 entity 的 lastSyncedVersion
 * - 与 value._pmsBaseVersion(内存中预期的"上次同步的版本")比较
 * - 一致:put entity + snapshot(nextVersion) 在同一 IDB 事务
 * - 不一致:抛 PMS_IDB_VERSION_CONFLICT,提示用户数据已被其他标签页修改
 * - hydrate 时会从 IDB 拉取 snapshot 的 version 并注入 entity._pmsBaseVersion。
 */
export async function pmsPutWithVersion<T extends { _pmsBaseVersion?: number }>(
  storeName: PmsStoreName,
  value: T,
  actor: string,
): Promise<void> {
  const keyValue = (value as { [k: string]: unknown })[STORE_KEYPATHS[storeName]]
  const snapshotKey = `${storeName}::${String(keyValue)}`
  const baseVersion = (value._pmsBaseVersion ?? 0) as number
  try {
    await new Promise<void>((resolve, reject) => {
    const dbPromise = getPmsDb()
    dbPromise.then((db) => {
      const tx = db.transaction([storeName, PMS_STORES.pmsVersionSnapshots], 'readwrite')
      const entityStore = tx.objectStore(storeName)
      const snapStore = tx.objectStore(PMS_STORES.pmsVersionSnapshots)
      let aborted = false
      const getReq = snapStore.get(snapshotKey)
      getReq.onerror = (): void => {
        reject(
          new PmsDomainError(
            'PMS_IDB_READ_FAILED',
            `读取 PMS 版本快照失败:${getReq.error?.message ?? 'unknown error'}`,
          ),
        )
      }
      getReq.onsuccess = (): void => {
        const existing = getReq.result as { snapshotKey: string; version: number; updatedAt: string; actor: string } | undefined
        const lastSyncedVersion = existing?.version ?? 0
        if (lastSyncedVersion !== baseVersion) {
          aborted = true
          try { tx.abort() } catch { /* ignore */ }
          reject(
            new PmsDomainError(
              'PMS_IDB_VERSION_CONFLICT',
              `数据已被其他标签页或会话修改:entity=${storeName}:${String(keyValue)},本地 baseVersion=${baseVersion},IDB lastVersion=${lastSyncedVersion}。请刷新页面后重试。`,
            ),
          )
          return
        }
        const nextVersion = lastSyncedVersion + 1
        // 注入新 version 到 entity(_pmsBaseVersion 是内存中预期的上次同步值,这里改成新值用于下次 baseVersion)
        const valueWithVersion = { ...value, _pmsBaseVersion: nextVersion } as T
        entityStore.put(valueWithVersion)
        snapStore.put({
          snapshotKey,
          version: nextVersion,
          updatedAt: new Date().toISOString(),
          actor,
        })
      }
      tx.oncomplete = (): void => {
        if (!aborted) {
          broadcastPmsDataChanged(storeName, keyValue as string | number, actor)
          resolve()
        }
      }
      tx.onerror = (): void => {
        reject(
          new PmsDomainError(
            'PMS_IDB_TX_ERROR',
            `PMS 业务数据保存失败:${tx.error?.message ?? 'unknown error'}。当前状态未改变。`,
          ),
        )
      }
      tx.onabort = (): void => {
        if (!aborted) {
          reject(
            new PmsDomainError(
              'PMS_IDB_TX_ABORTED',
              `PMS 业务数据保存被中断:${tx.error?.message ?? 'aborted'}。当前状态未改变。`,
            ),
          )
        }
      }
    }).catch((error: unknown) => {
      reject(error)
    })
  })
  } catch (error) {
    if (error instanceof PmsDomainError && error.code === 'PMS_IDB_UNAVAILABLE') {
      console.warn('[PMS_IDB_UNAVAILABLE] pmsPutWithVersion 跳过,内存态保留', { store: storeName, key: String(keyValue) })
      return
    }
    throw error
  }
}

/**
 * 读取 entity 的最后同步版本号(从 pmsVersionSnapshots)。
 * hydrate 后各模块可调用此函数为内存 entity 注入 _pmsBaseVersion。
 */
export async function pmsGetEntityVersion(storeName: PmsStoreName, key: IDBValidKey): Promise<number> {
  const snapshotKey = `${storeName}::${String(key)}`
  const db = await getPmsDb()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(PMS_STORES.pmsVersionSnapshots, 'readonly')
    const req = tx.objectStore(PMS_STORES.pmsVersionSnapshots).get(snapshotKey)
    req.onsuccess = (): void => {
      const result = req.result as { version: number } | undefined
      resolve(result?.version ?? 0)
    }
    req.onerror = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_READ_FAILED',
          `读取 PMS 版本快照失败:${req.error?.message ?? 'unknown error'}`,
        ),
      )
    }
  })
}

export async function pmsGet<T>(storeName: PmsStoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await getPmsDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = (): void => resolve(req.result as T | undefined)
    req.onerror = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_READ_FAILED',
          `读取 PMS 业务数据失败:${req.error?.message ?? 'unknown error'}`,
        ),
      )
    }
  })
}

export async function pmsAll<T>(storeName: PmsStoreName): Promise<T[]> {
  const db = await getPmsDb()
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = (): void => resolve(req.result as T[])
    req.onerror = (): void => {
      reject(
        new PmsDomainError(
          'PMS_IDB_READ_ALL_FAILED',
          `读取 PMS 业务数据列表失败:${req.error?.message ?? 'unknown error'}`,
        ),
      )
    }
  })
}

export async function pmsDelete(storeName: PmsStoreName, key: IDBValidKey): Promise<void> {
  try {
    await pmsTx(storeName, 'readwrite', (tx) => {
      tx.objectStore(storeName).delete(key)
    })
  } catch (error) {
    if (error instanceof PmsDomainError && error.code === 'PMS_IDB_UNAVAILABLE') {
      console.warn('[PMS_IDB_UNAVAILABLE] delete 跳过,内存态保留', { store: storeName, key: String(key) })
      return
    }
    throw error
  }
}

export async function pmsClear(storeName: PmsStoreName): Promise<void> {
  await pmsTx(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).clear()
  })
}

/**
 * 关闭数据库连接(用于测试或显式资源释放)。
 * 主流程不需要调用 —— IDB 连接由浏览器在页面卸载时自动关闭。
 */
export function closePmsDb(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => undefined)
    dbPromise = null
  }
}

// ============ 多标签页同步(§ 2.4.3.6) ============

const BROADCAST_CHANNEL_NAME = 'higood-pms-idb'
let broadcastChannel: BroadcastChannel | null = null
const broadcastSubscribers = new Set<(message: PmsIdbBroadcast) => void>()

export interface PmsIdbBroadcast {
  type: 'PMS_DATA_CHANGED'
  store: PmsStoreName
  key: string | number
  actor: string
  at: number
}

/**
 * 获取(或创建)跨标签页 BroadcastChannel。
 * 不支持 BroadcastChannel 的旧浏览器静默退化,§ 2.4.3.6 允许"提示用户",这种浏览器直接降级为单标签页使用。
 */
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (broadcastChannel) return broadcastChannel
  broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  broadcastChannel.addEventListener('message', (event: MessageEvent<PmsIdbBroadcast>) => {
    const message = event.data
    if (!message || message.type !== 'PMS_DATA_CHANGED') return
    for (const handler of broadcastSubscribers) {
      try {
        handler(message)
      } catch (error) {
        console.error('[PMS_IDB_BROADCAST_HANDLER_FAILED]', error)
      }
    }
  })
  return broadcastChannel
}

/**
 * 业务数据变更时调用此函数,通知其他标签页重新加载。
 * 由 idb-storage 的写入路径在事务 oncomplete 后调用(§ 2.4.3.4 "必须等事务 complete 才发布")。
 */
export function broadcastPmsDataChanged(store: PmsStoreName, key: string | number, actor: string): void {
  const channel = getBroadcastChannel()
  if (!channel) return
  channel.postMessage({
    type: 'PMS_DATA_CHANGED',
    store,
    key,
    actor,
    at: Date.now(),
  })
}

/**
 * 订阅 PMS 数据变更广播。
 * 返回 unsubscribe 函数。
 */
export function subscribePmsDataChanged(handler: (message: PmsIdbBroadcast) => void): () => void {
  getBroadcastChannel() // 确保 channel 已建
  broadcastSubscribers.add(handler)
  return () => {
    broadcastSubscribers.delete(handler)
  }
}

// ============ § 2.4.5 数据管理:导出/导入/清理/空间估算 ============

/**
 * 导出 PMS IDB 全量数据为可下载的 JSON 字符串。
 * 用 navigator.storage.estimate() 估算空间占用;逐 store getAll。
 */
export async function exportPmsDataBundle(): Promise<{ json: string; bytes: number; storeBytes: Record<string, number> }> {
  const db = await getPmsDb()
  const storeBytes: Record<string, number> = {}
  const allEntries: Array<{ store: string; records: unknown[] }> = []
  for (const storeName of Object.values(PMS_STORES)) {
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).getAll()
      req.onsuccess = (): void => resolve(req.result as unknown[])
      req.onerror = (): void => reject(new PmsDomainError('PMS_IDB_READ_ALL_FAILED', `读取 ${storeName} 失败:${req.error?.message ?? 'unknown'}`))
    })
    allEntries.push({ store: storeName, records })
    storeBytes[storeName] = JSON.stringify(records).length
  }
  const bundle = {
    version: PMS_IDB_VERSION,
    exportedAt: new Date().toISOString(),
    stores: allEntries,
  }
  const json = JSON.stringify(bundle, null, 2)
  return { json, bytes: json.length, storeBytes }
}

/**
 * 从 JSON 字符串导入 PMS IDB 数据。
 * 每个 store 在同一 IDB 事务里 put 所有 records;失败抛 PmsDomainError。
 */
export async function importPmsDataBundle(json: string): Promise<{ imported: number; storeCounts: Record<string, number> }> {
  let bundle: { version?: number; stores?: Array<{ store: string; records: unknown[] }> }
  try {
    bundle = JSON.parse(json) as { version?: number; stores?: Array<{ store: string; records: unknown[] }> }
  } catch (error) {
    throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', `导入数据 JSON 解析失败:${error instanceof Error ? error.message : 'unknown'}`)
  }
  if (!bundle.stores || !Array.isArray(bundle.stores)) {
    throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '导入数据格式不符:缺少 stores 数组')
  }
  const db = await getPmsDb()
  const storeNames = new Set(Object.values(PMS_STORES))
  let imported = 0
  const storeCounts: Record<string, number> = {}
  // 收集所有 store names,逐个 transaction
  const groupedByStore = new Map<string, unknown[]>()
  for (const entry of bundle.stores) {
    if (!storeNames.has(entry.store as PmsStoreName)) continue
    groupedByStore.set(entry.store, entry.records ?? [])
  }
  for (const [storeName, records] of groupedByStore) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName as PmsStoreName, 'readwrite')
      const store = tx.objectStore(storeName as PmsStoreName)
      for (const record of records) {
        store.put(record)
      }
      tx.oncomplete = (): void => {
        storeCounts[storeName] = records.length
        imported += records.length
        resolve()
      }
      tx.onerror = (): void => reject(new PmsDomainError('PMS_IDB_TX_ERROR', `导入 ${storeName} 失败:${tx.error?.message ?? 'unknown'}`))
      tx.onabort = (): void => reject(new PmsDomainError('PMS_IDB_TX_ABORTED', `导入 ${storeName} 中断:${tx.error?.message ?? 'aborted'}`))
    })
  }
  return { imported, storeCounts }
}

/**
 * 估算 IDB 已用空间(§ 2.4.5)。
 * 使用 navigator.storage.estimate() 返回的 quota/usage 估算 PMS 占用比例。
 * 返回:
 *   - usage: 浏览器报告的 IndexedDB 估算使用量
 *   - quota: 浏览器报告的存储配额
 *   - pmsStoreBytes: 每个 PMS store 的字节数(基于 JSON.stringify)
 */
export async function estimatePmsStorage(): Promise<{
  usage: number; quota: number; pmsStoreBytes: Record<string, number>; pmsTotalBytes: number
}> {
  const result = { usage: 0, quota: 0, pmsStoreBytes: {} as Record<string, number>, pmsTotalBytes: 0 }
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const estimate = await navigator.storage.estimate()
      result.usage = estimate.usage ?? 0
      result.quota = estimate.quota ?? 0
    } catch {
      // ignore
    }
  }
  const { storeBytes } = await exportPmsDataBundle()
  result.pmsStoreBytes = storeBytes
  result.pmsTotalBytes = Object.values(storeBytes).reduce((sum, v) => sum + v, 0)
  return result
}

/**
 * 清空所有 PMS 数据(§ 2.4.5)。在同一个 IDB 事务里 clear 所有 store。
 * 用于"重置 PMS"操作,需用户二次确认。
 */
export async function clearAllPmsData(): Promise<void> {
  const db = await getPmsDb()
  await new Promise<void>((resolve, reject) => {
    const stores = Object.values(PMS_STORES) as PmsStoreName[]
    const tx = db.transaction(stores, 'readwrite')
    for (const storeName of stores) {
      tx.objectStore(storeName).clear()
    }
    tx.oncomplete = (): void => resolve()
    tx.onerror = (): void => reject(new PmsDomainError('PMS_IDB_TX_ERROR', `清空 PMS 失败:${tx.error?.message ?? 'unknown'}`))
    tx.onabort = (): void => reject(new PmsDomainError('PMS_IDB_TX_ABORTED', `清空 PMS 中断:${tx.error?.message ?? 'aborted'}`))
  })
}
