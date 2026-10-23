/**
 * PMS IDB 基础设施
 *
 * 依据:AGENTS.md § 2.4.1 (业务数据 → IndexedDB) 与 § 2.4.3 (读写失败处理)
 * 数据库名:higood-pms
 * 当前版本:3
 *
 * 设计原则:
 * - 每个 store 的 keyPath 严格对齐 PMS 业务对象的业务主键(详见 STORES)。
 * - 事务封装 `pmsTx` 强制返回 oncomplete 才视为提交成功;符合 § 2.4.3.4 "必须等事务 complete 才显示保存成功"。
 * - 失败抛错:`IndexedDB 不可用 / quota exceeded / abort` 一律 PmsDomainError,不静默回退 § 2.4.3.5。
 * - 派生数据(§ 2.4.2 第 3 条)不进 IDB,只在内存缓存。
 */

import { PmsDomainError, createPmsOperationLog, publishPmsOperationLog, type PmsOperationLog } from './runtime.ts'

export const PMS_IDB_DB_NAME = 'higood-pms'
export const PMS_IDB_VERSION = 4

export const PMS_STORES = {
  pmsOperationLogs: 'pmsOperationLogs',
  pmsReorderSuggestions: 'pmsReorderSuggestions',
  pmsPurchaseOrderAftersales: 'pmsPurchaseOrderAftersales',
  pmsKolStock: 'pmsKolStock',
  pmsKolApplies: 'pmsKolApplies',
  pmsKolLinks: 'pmsKolLinks',
  pmsKolLockLogs: 'pmsKolLockLogs',
  pmsFittingTimeliness: 'pmsFittingTimeliness',
  pmsPurchaseTracking: 'pmsPurchaseTracking',
  pmsAttachments: 'pmsAttachments',
  pmsAttachmentReferences: 'pmsAttachmentReferences',
  pmsCommittedOperations: 'pmsCommittedOperations',
  pmsMaterialPurchaseOrderDeltas: 'pmsMaterialPurchaseOrderDeltas',
  pmsFirstLegBatches: 'pmsFirstLegBatches',
  pmsFirstLegCarriers: 'pmsFirstLegCarriers',
  pmsFirstLegChannels: 'pmsFirstLegChannels',
  pmsReconciliations: 'pmsReconciliations',
  pmsPaymentRequests: 'pmsPaymentRequests',
  pmsPaymentDrafts: 'pmsPaymentDrafts',
  pmsMaterialRequirements: 'pmsMaterialRequirements',
  pmsSuppliers: 'pmsSuppliers',
  pmsSupplierConfirmations: 'pmsSupplierConfirmations',
  pmsPurchaseSuggestions: 'pmsPurchaseSuggestions',
  pmsKolDemands: 'pmsKolDemands',
  pmsProductPurchaseOrders: 'pmsProductPurchaseOrders',
  pmsProductStockBalances: 'pmsProductStockBalances',
  pmsSupplyArchives: 'pmsSupplyArchives',
  pmsVersionSnapshots: 'pmsVersionSnapshots',
  pmsTmfOrders: 'pmsTmfOrders',
  pmsTmfProduction: 'pmsTmfProduction',
  pmsTmfScrap: 'pmsTmfScrap',
  pmsTmfOperations: 'pmsTmfOperations',
  /** TMF 逐记录行与稳定操作号；旧的四个 singleton section 只作为只读基线。 */
  pmsTmfRecords: 'pmsTmfRecords',
} as const

export type PmsStoreName = (typeof PMS_STORES)[keyof typeof PMS_STORES]

export interface PmsCommitRecord {
  store: PmsStoreName
  value: object
  /** Version observed when the form was opened. Static records use zero. */
  expectedVersion?: number
}

export interface PmsAttachment {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

export interface PmsCommitOptions {
  log?: Omit<PmsOperationLog, 'id' | 'occurredAt' | 'timeZone' | 'source'>
  /** Keep this identifier unchanged across a retry of the same form submission. */
  operationId?: string
  /** Normalized business input, excluding newly computed IDs/timestamps. */
  operationSignature?: string
  attachments?: PmsAttachment[]
  attachmentReferences?: { store: PmsStoreName; key: string | number; fileIds: string[] }[]
  attachmentDeletes?: string[]
}

/** Save the records belonging to one procurement action in one transaction. */
export async function pmsCommitRecords(records: PmsCommitRecord[], options: PmsCommitOptions = {}): Promise<{
  values: object[]
  log?: PmsOperationLog
  replayed: boolean
}> {
  const log = options.log ? createPmsOperationLog(options.log) : undefined
  const entries = records.map((record) => {
    const value = structuredClone(record.value) as Record<string, unknown>
    const key = value[STORE_KEYPATHS[record.store]]
    if (!(typeof key === 'string' && key.trim() || typeof key === 'number' && Number.isFinite(key))) {
      throw new PmsDomainError('PMS_IDB_KEY_REQUIRED', '记录缺少业务编号，当前修改未保存。')
    }
    return { ...record, value, key, version: record.expectedVersion ?? Number(value._pmsBaseVersion ?? 0) }
  })
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '_pmsBaseVersion').sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
    return value
  }
  if (new Set(entries.map(({ store, key }) => `${store}::${String(key)}`)).size !== entries.length) {
    throw new PmsDomainError('PMS_IDB_DUPLICATE_RECORD', '同一操作重复包含相同记录，当前修改未保存。')
  }
  const stores = [...new Set<PmsStoreName>([
    ...entries.map((entry) => entry.store), PMS_STORES.pmsVersionSnapshots,
    ...(log || options.operationId ? [PMS_STORES.pmsOperationLogs] : []),
    ...(options.operationId ? [PMS_STORES.pmsCommittedOperations] : []),
    ...(options.attachments?.length ? [PMS_STORES.pmsAttachments] : []),
    ...(options.attachmentReferences?.length || options.attachmentDeletes?.length ? [PMS_STORES.pmsAttachments, PMS_STORES.pmsAttachmentReferences] : []),
  ])]
  for (const reference of options.attachmentReferences ?? []) {
    if (!entries.some((entry) => entry.store === reference.store && entry.key === reference.key)) {
      throw new PmsDomainError('PMS_IDB_ATTACHMENT_OWNER', '附件缺少共同保存的业务记录，当前修改未保存。')
    }
  }
  const suppliedReferences = new Set(options.attachmentReferences?.flatMap((owner) => owner.fileIds))
  const owners = options.attachmentReferences?.map(owner => `${owner.store}::${String(owner.key)}`) ?? []
  if (new Set(owners).size !== owners.length) {
    throw new PmsDomainError('PMS_IDB_ATTACHMENT_DUPLICATE_OWNER', '同一业务记录重复提供附件列表，当前修改未保存。')
  }
  if (options.attachments?.some((attachment) => !suppliedReferences.has(attachment.id))) {
    throw new PmsDomainError('PMS_IDB_ATTACHMENT_UNREFERENCED', '附件尚未关联业务记录，当前修改未保存。')
  }
  if (new Set(options.attachments?.map(file => file.id)).size !== (options.attachments?.length ?? 0)
    || options.attachments?.some(file => !(file.blob instanceof Blob) || file.size !== file.blob.size || !file.id || !file.name)) {
    throw new PmsDomainError('PMS_IDB_ATTACHMENT_INVALID', '附件编号或文件信息不符，当前修改未保存。请重新选择文件。')
  }
  const attachmentSignatures = await Promise.all((options.attachments ?? []).map(async ({ id, name, type, size, blob }) => {
    // File reads belong before the transaction; equal names and sizes do not prove equal bytes.
    const digest = options.operationId ? await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()) : undefined
    return { id, name, type, size, digest: digest ? Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') : undefined }
  }))
  const signature = JSON.stringify({
    keys: entries.map(({ store, key }) => [store, key]),
    input: options.operationSignature ?? canonical(entries.map(({ value }) => value)),
    action: options.log ? { objectType: options.log.objectType, objectId: options.log.objectId, action: options.log.action, reason: options.log.reason, actorId: options.log.actorId } : undefined,
    attachments: attachmentSignatures,
    references: canonical(options.attachmentReferences),
    deletes: options.attachmentDeletes,
  })
  let result: { values: object[]; log?: PmsOperationLog; replayed: boolean } = { values: [], replayed: false }
  await pmsTx(stores, 'readwrite', (tx) => new Promise<void>((resolve, reject) => {
    const fail = (error: unknown): void => { reject(error); try { tx.abort() } catch { /* already aborted */ } }
    const save = (): void => {
      let remaining = entries.length
      const finish = (): void => {
        const persist = (): void => {
        const write = (): void => {
        for (const attachment of options.attachments ?? []) tx.objectStore(PMS_STORES.pmsAttachments).put(attachment)
        if (log) tx.objectStore(PMS_STORES.pmsOperationLogs).put(log)
        result = { values: entries.map((entry) => entry.value), log, replayed: false }
        if (options.operationId) tx.objectStore(PMS_STORES.pmsCommittedOperations).put({ id: options.operationId, signature, logId: log?.id })
        resolve()
        }
        let pendingFiles = options.attachments?.length ?? 0
        if (!pendingFiles) { write(); return }
        for (const attachment of options.attachments ?? []) {
          const existing = tx.objectStore(PMS_STORES.pmsAttachments).get(attachment.id)
          existing.onerror = () => fail(existing.error)
          existing.onsuccess = () => {
            if (existing.result) { fail(new PmsDomainError('PMS_IDB_ATTACHMENT_CONFLICT', '附件编号已存在，当前文件没有替换。请重新选择文件。')); return }
            pendingFiles -= 1
            if (!pendingFiles) write()
          }
        }
        }
        if (!options.attachmentReferences?.length && !options.attachmentDeletes?.length) { persist(); return }
        const referenceStore = tx.objectStore(PMS_STORES.pmsAttachmentReferences)
        const read = referenceStore.getAll()
        read.onerror = () => fail(read.error)
        read.onsuccess = () => {
          type FileReference = { id: string; fileIds: string[] }
          const updated = (options.attachmentReferences ?? []).map((owner) => ({ id: `${owner.store}::${String(owner.key)}`, fileIds: [...new Set(owner.fileIds)] }))
          const replaced = new Set(updated.map((owner) => owner.id))
          const retained = (read.result as FileReference[]).filter((owner) => !replaced.has(owner.id))
          const inUse = new Set([...retained, ...updated].flatMap((owner) => owner.fileIds))
          const saveReferences = (): void => {
            for (const owner of updated) {
              if (owner.fileIds.length) referenceStore.put(owner)
              else referenceStore.delete(owner.id)
            }
            for (const fileId of options.attachmentDeletes ?? []) {
              if (!inUse.has(fileId)) tx.objectStore(PMS_STORES.pmsAttachments).delete(fileId)
            }
            persist()
          }
          const newFiles = new Set(options.attachments?.map((attachment) => attachment.id))
          const required = [...new Set(updated.flatMap((owner) => owner.fileIds))].filter((id) => !newFiles.has(id))
          let remainingFiles = required.length
          if (!remainingFiles) { saveReferences(); return }
          for (const id of required) {
            const file = tx.objectStore(PMS_STORES.pmsAttachments).get(id)
            file.onerror = () => fail(file.error)
            file.onsuccess = () => {
              if (!file.result) { fail(new PmsDomainError('PMS_IDB_ATTACHMENT_MISSING', '附件文件未能读取，当前修改未保存。请重新选择文件。')); return }
              remainingFiles -= 1
              if (!remainingFiles) saveReferences()
            }
          }
        }
      }
      if (!remaining) { finish(); return }
      for (const entry of entries) {
        const snapshotKey = `${entry.store}::${String(entry.key)}`
        const request = tx.objectStore(PMS_STORES.pmsVersionSnapshots).get(snapshotKey)
        request.onerror = () => fail(request.error)
        request.onsuccess = () => {
          const current = Number(request.result?.version ?? 0)
          if (current !== entry.version) {
            fail(new PmsDomainError('PMS_IDB_VERSION_CONFLICT', '此记录已在其他页面修改。当前输入未保存，请重新读取后重试。'))
            return
          }
          entry.value._pmsBaseVersion = current + 1
          tx.objectStore(entry.store).put(entry.value)
          tx.objectStore(PMS_STORES.pmsVersionSnapshots).put({ snapshotKey, version: current + 1, updatedAt: new Date().toISOString(), actor: options.log?.actorName ?? '采购操作' })
          remaining -= 1
          if (remaining === 0) finish()
        }
      }
    }
    if (options.operationId) {
      const request = tx.objectStore(PMS_STORES.pmsCommittedOperations).get(options.operationId)
      request.onerror = () => fail(request.error)
      request.onsuccess = () => {
        const receipt = request.result as { signature: string; logId?: string } | undefined
        if (!receipt) { save(); return }
        if (receipt.signature !== signature) {
          fail(new PmsDomainError('PMS_IDB_OPERATION_CONFLICT', '此提交已保存其他内容。当前输入未保存，请重新打开表单后重试。'))
          return
        }
        result = { values: [], replayed: true }
        let remaining = entries.length + (receipt.logId ? 1 : 0)
        const done = (): void => { remaining -= 1; if (!remaining) resolve() }
        if (!remaining) { resolve(); return }
        entries.forEach((entry, index) => {
          const read = tx.objectStore(entry.store).get(entry.key)
          read.onerror = () => fail(read.error)
          read.onsuccess = () => { result.values[index] = read.result; done() }
        })
        if (receipt.logId) {
          const read = tx.objectStore(PMS_STORES.pmsOperationLogs).get(receipt.logId)
          read.onerror = () => fail(read.error)
          read.onsuccess = () => { result.log = read.result; done() }
        }
      }
    } else save()
  }))
  // Memory and cross-tab notifications follow complete, never request.success.
  records.forEach((record, index) => Object.assign(record.value, result.values[index]))
  if (result.log) publishPmsOperationLog(result.log)
  entries.forEach((entry) => {
    recordPmsHydratedAtSafely(entry.store, String(entry.key), Date.now())
    broadcastPmsDataChanged(entry.store, entry.key, options.log?.actorName ?? '采购操作')
  })
  return result
}

// 每个 store 的 keyPath;在 onupgradeneeded 中按此创建。
// 所有字段名严格对齐业务对象的业务主键,避免冗余 id 列。
const STORE_KEYPATHS: Record<PmsStoreName, string> = {
  pmsOperationLogs: 'id',
  pmsReorderSuggestions: 'spu',
  pmsPurchaseOrderAftersales: 'aftersalesNo',
  pmsKolStock: 'id',
  pmsKolApplies: 'applyNo',
  pmsKolLinks: 'linkId',
  pmsKolLockLogs: 'id',
  pmsFittingTimeliness: 'id',
  pmsPurchaseTracking: 'id',
  pmsAttachments: 'id',
  pmsAttachmentReferences: 'id',
  pmsCommittedOperations: 'id',
  pmsMaterialPurchaseOrderDeltas: 'purchaseOrderNo',
  pmsFirstLegBatches: 'batchNo',
  pmsFirstLegCarriers: 'carrierCode',
  pmsFirstLegChannels: 'channelCode',
  pmsReconciliations: 'id',
  pmsPaymentRequests: 'requestNo',
  pmsPaymentDrafts: 'draftKey',
  pmsMaterialRequirements: 'requirementNo',
  pmsSuppliers: 'supplierCode',
  pmsSupplierConfirmations: 'confirmationNo',
  pmsPurchaseSuggestions: 'suggestionNo',
  pmsKolDemands: 'demandNo',
  pmsProductPurchaseOrders: 'purchaseOrderNo',
  pmsProductStockBalances: 'id',
  pmsSupplyArchives: 'archiveId',
  pmsVersionSnapshots: 'snapshotKey',
  pmsTmfOrders: 'singleton',
  pmsTmfProduction: 'singleton',
  pmsTmfScrap: 'singleton',
  pmsTmfOperations: 'singleton',
  pmsTmfRecords: 'recordKey',
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
    let blocked = false
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
      if (blocked) { db.close(); return }
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
      blocked = true
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
  // Register completion before invoking a callback that may enqueue asynchronous IDB requests.
  const completed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(new PmsDomainError('PMS_IDB_TX_ERROR', '保存失败，当前修改未保存。请重试。'))
    tx.onabort = () => reject(new PmsDomainError('PMS_IDB_TX_ABORTED', '保存被中止，当前修改未保存。请重试。'))
  })
  // A synchronous validation failure can abort before the caller awaits the completion promise.
  void completed.catch(() => undefined)
  let result: T
  try {
    result = await fn(tx)
  } catch (error) {
    try { tx.abort() } catch { /* The transaction may already be aborted. */ }
    await completed.catch(() => undefined)
    throw error
  }
  await completed
  return result
}

export async function pmsPut<T>(storeName: PmsStoreName, value: T): Promise<void> {
  const keyValue = (value as { [k: string]: unknown })[STORE_KEYPATHS[storeName]]
  await pmsTx(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).put(value)
  })
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
 * § 2.4.3.5 保存失败的统一出口:记录语义日志后**重新抛出**,由 main.ts 的
 * unhandledrejection 处理器捕获 PMS_IDB_* 错误并以 banner 明确告知用户"未保存"。
 *
 * 之前各模块用 .catch(console.error) 吞掉失败,页面仍显示"已保存",属于虚假成功。
 * 打开失败、存储不可用与事务失败均保留未保存状态。
 */
export function reportPmsSaveFailure(logTag: string, detail: Record<string, unknown>, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown'
  console.error(logTag, { ...detail, message })
  throw error
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
 * 本客户端已知的最新版本号(storeKey → version)。
 *
 * 版本号语义是"本会话对持久状态的认知",每个 store+key 只有一份权威值,
 * **不能**只挂在 entity 对象副本上:业务层普遍使用 structuredClone / spread 产生副本,
 * 回写只落在被保存的那一个副本上,其余副本的 _pmsBaseVersion 会永久落后,
 * 再次保存时必然被误判为"其他标签页已修改"(实测 baseVersion=4 而 IDB=5)。
 * 这里集中登记,写入前以表内值为准;跨标签页的真实冲突仍能检出——
 * 因为别的标签页写入会把 IDB 版本推到本表之上。
 */
const pmsKnownVersions = new Map<string, number>()

/**
 * 同一 key 的写入队列。
 *
 * 并发写入同一 entity 时,前一个事务提交后版本表要等到 oncomplete 才更新,
 * 后一个事务此刻已经读到新快照,必定误判为冲突(实测恒定差 1)。
 * 按 key 串行化后,每次写入开始前读到的都是上一次已完成的最新版本。
 */
const pmsWriteQueue = new Map<string, Promise<void>>()

/**
 * 乐观锁写入(§ 2.4.3.6):
 * - 读取 pmsVersionSnapshots 中该 entity 的 lastSyncedVersion
 * - 与表单观察到的 value._pmsBaseVersion 比较；无该字段的旧调用才取已知版本
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

  // 真正执行一次乐观锁写入;baseVersion 必须在这里读,串行化后才是最新值。
  const writeOnce = async (): Promise<void> => {
  // A newer read in this tab must not silently promote an older draft's expected version.
  const baseVersion = value._pmsBaseVersion ?? pmsKnownVersions.get(snapshotKey) ?? 0
  try {
    await new Promise<void>((resolve, reject) => {
    const dbPromise = getPmsDb()
    dbPromise.then((db) => {
      const tx = db.transaction([storeName, PMS_STORES.pmsVersionSnapshots], 'readwrite')
      const entityStore = tx.objectStore(storeName)
      const snapStore = tx.objectStore(PMS_STORES.pmsVersionSnapshots)
      let aborted = false
      // 提交成功后的新版本号,需回写调用方内存对象(见 tx.oncomplete)。
      let nextVersion = baseVersion + 1
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
        nextVersion = lastSyncedVersion + 1
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
          // § 2.4.3.6 关键:把新版本号登记到本客户端版本表,并回写调用方的内存对象。
          // 只写 IDB 不登记,会让同一对象第二次保存时 baseVersion 落后于快照,
          // 必定误判为"其他标签页已修改"而保存失败。
          pmsKnownVersions.set(snapshotKey, nextVersion)
          Object.assign(value, { _pmsBaseVersion: nextVersion })
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
    throw error
  }
  }

  // 按 key 排队:等上一次写入结束后再执行本次,避免读到"已提交但版本表未更新"的中间态。
  const previous = pmsWriteQueue.get(snapshotKey) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(writeOnce)
  // 队列里保留永不 reject 的镜像,避免一次失败把后续所有写入都毒化。
  pmsWriteQueue.set(snapshotKey, current.catch(() => undefined))
  return current
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
      const version = result?.version ?? 0
      // 同步本客户端版本表:hydrate / reload 时让本地认知追上 IDB。
      // 缺少这一步,冲突后用户刷新页面会拿着旧版本反复冲突(表是权威,不能只更新对象副本)。
      pmsKnownVersions.set(snapshotKey, version)
      resolve(version)
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
  await pmsTx(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).delete(key)
  })
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
let broadcastUnavailable = false
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
  if (typeof BroadcastChannel === 'undefined' || broadcastUnavailable) return null
  if (broadcastChannel) return broadcastChannel
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  } catch (error) {
    broadcastUnavailable = true
    console.warn('[PMS_NOTIFICATION_UNAVAILABLE]', error)
    return null
  }
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
  try {
    channel.postMessage({ type: 'PMS_DATA_CHANGED', store, key, actor, at: Date.now() })
  } catch (error) {
    // Notification cannot reverse an already completed business transaction.
    if (!broadcastUnavailable) console.warn('[PMS_NOTIFICATION_UNAVAILABLE]', error)
    broadcastUnavailable = true
  }
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
export async function exportPmsDataBundle(): Promise<{ blob: Blob; bytes: number; storeBytes: Record<string, number> }> {
  const stores = Object.values(PMS_STORES)
  const snapshot = await pmsTx(stores, 'readonly', (tx) => Promise.all(stores.map((store) => new Promise<{ store: PmsStoreName; records: Record<string, unknown>[] }>((resolve, reject) => {
    const request = tx.objectStore(store).getAll()
    request.onsuccess = () => resolve({ store, records: request.result })
    request.onerror = () => reject(request.error)
  }))))
  const files: Blob[] = []
  const storeBytes: Record<string, number> = {}
  let offset = 0
  for (const entry of snapshot) {
    if (entry.store === PMS_STORES.pmsAttachments) {
      entry.records = entry.records.map((record) => {
        const { blob, ...meta } = record
        if (!(blob instanceof Blob)) throw new PmsDomainError('PMS_IDB_BACKUP_ATTACHMENT', '附件内容未能读取，备份没有生成。')
        const descriptor = { ...meta, backupOffset: offset, backupLength: blob.size }
        files.push(blob); offset += blob.size
        return descriptor
      })
    }
    storeBytes[entry.store] = new TextEncoder().encode(JSON.stringify(entry.records)).length + (entry.store === PMS_STORES.pmsAttachments ? offset : 0)
  }
  const manifest = new TextEncoder().encode(JSON.stringify({ format: 'higood-pms', formatVersion: 1, databaseVersion: PMS_IDB_VERSION, exportedAt: new Date().toISOString(), stores: snapshot }))
  const size = new Uint8Array(4)
  new DataView(size.buffer).setUint32(0, manifest.length, true)
  const blob = new Blob(['HGPMS001', size, manifest, ...files], { type: 'application/octet-stream' })
  return { blob, bytes: blob.size, storeBytes }
}

/** Restore validated records and raw attachment bytes; conflicts abort the entire restore. */
export async function importPmsDataBundle(file: Blob): Promise<{ imported: number; storeCounts: Record<string, number> }> {
  if (!(file instanceof Blob) || file.size < 12 || file.size > 128 * 1024 * 1024) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份文件格式或大小不符，当前记录没有改变。')
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (new TextDecoder().decode(header.slice(0, 8)) !== 'HGPMS001') throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '请选择采购备份文件，当前记录没有改变。')
  const length = new DataView(header.buffer).getUint32(8, true)
  if (length > file.size - 12) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份内容不完整，当前记录没有改变。')
  let bundle: { format: string; formatVersion: number; databaseVersion: number; stores: { store: PmsStoreName; records: Record<string, unknown>[] }[] }
  try { bundle = JSON.parse(await file.slice(12, 12 + length).text()) } catch { throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份内容无法解析，当前记录没有改变。') }
  if (bundle.format !== 'higood-pms' || bundle.formatVersion !== 1 || bundle.databaseVersion !== PMS_IDB_VERSION || !Array.isArray(bundle.stores)) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份版本不兼容，当前记录没有改变。')
  const allowed = new Set(Object.values(PMS_STORES))
  const storeCounts: Record<string, number> = {}
  const entries = new Map<PmsStoreName, Record<string, unknown>[]>()
  const attachmentMetadata = (value: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] => {
    if (typeof value === 'string' && (/^\s*(?:data:|blob:)/i.test(value) || /data:[^\s,;]*;base64,/i.test(value))) {
      throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份业务记录包含内嵌文件或临时地址，当前记录没有改变。')
    }
    if (Array.isArray(value)) value.forEach(item => attachmentMetadata(item, found))
    else if (value && typeof value === 'object') {
      const row = value as Record<string, unknown>
      if ('fileId' in row) {
        if (typeof row.fileId !== 'string' || !row.fileId.trim()) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份附件编号不完整，当前记录没有改变。')
        found.push(row)
      }
      Object.values(row).forEach(item => attachmentMetadata(item, found))
    }
    return found
  }
  for (const entry of bundle.stores) {
    if (!allowed.has(entry.store) || entries.has(entry.store) || !Array.isArray(entry.records)) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份包含未知或重复的数据分类，当前记录没有改变。')
    const keys = new Set<string | number>()
    for (let index = 0; index < entry.records.length; index += 1) {
      const record = entry.records[index]
      if (!record || typeof record !== 'object') throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份记录格式不符。')
      const key = record[STORE_KEYPATHS[entry.store]]
      if ((typeof key !== 'string' && typeof key !== 'number') || keys.has(key)) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份存在缺失编号或重复记录。')
      keys.add(key)
      if (entry.store === PMS_STORES.pmsAttachments) {
        const { backupOffset, backupLength, ...meta } = record
        const offset = Number(backupOffset); const bytes = Number(backupLength)
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(bytes) || offset < 0 || bytes < 0 || 12 + length + offset + bytes > file.size || bytes !== Number(meta.size)) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '附件内容不完整。')
        entry.records[index] = { ...meta, blob: file.slice(12 + length + offset, 12 + length + offset + bytes, String(meta.type || '')) }
      } else attachmentMetadata(record)
    }
    entries.set(entry.store, entry.records)
  }
  let imported = 0
  await pmsTx([...allowed], 'readwrite', async (tx) => {
    const current = new Map<PmsStoreName, Record<string, unknown>[]>()
    await Promise.all([...allowed].map((store) => new Promise<void>((resolve, reject) => {
      const request = tx.objectStore(store).getAll()
      request.onsuccess = () => { current.set(store, request.result); resolve() }
      request.onerror = () => reject(request.error)
    })))
    const files = new Map([...current.get(PMS_STORES.pmsAttachments) ?? [], ...entries.get(PMS_STORES.pmsAttachments) ?? []].map(record => [record.id, record]))
    const owners = new Map<string, Record<string, unknown>>()
    for (const store of allowed) if (store !== PMS_STORES.pmsAttachments && store !== PMS_STORES.pmsAttachmentReferences) {
      for (const row of [...current.get(store) ?? [], ...entries.get(store) ?? []]) owners.set(`${store}::${String(row[STORE_KEYPATHS[store]])}`, row)
    }
    const references = new Map([...current.get(PMS_STORES.pmsAttachmentReferences) ?? [], ...entries.get(PMS_STORES.pmsAttachmentReferences) ?? []].map(row => [row.id, row]))
    for (const reference of entries.get(PMS_STORES.pmsAttachmentReferences) ?? []) {
      if (!owners.has(String(reference.id)) || !Array.isArray(reference.fileIds) || new Set(reference.fileIds).size !== reference.fileIds.length
        || reference.fileIds.some(id => typeof id !== 'string' || !id || !files.has(id))) throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份包含缺失附件或业务归属，当前记录没有改变。')
    }
    for (const [store, records] of entries) if (store !== PMS_STORES.pmsAttachments && store !== PMS_STORES.pmsAttachmentReferences) for (const row of records) {
      const metadata = attachmentMetadata(row)
      if (!metadata.length) continue
      const reference = references.get(`${store}::${String(row[STORE_KEYPATHS[store]])}`)
      const ids = new Set(metadata.map(item => item.fileId))
      if (!reference || !Array.isArray(reference.fileIds) || reference.fileIds.length !== ids.size || reference.fileIds.some(id => !ids.has(id))) {
        throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份业务附件与引用列表不一致，当前记录没有改变。')
      }
      for (const item of metadata) {
        const fileRecord = files.get(item.fileId)
        if (!fileRecord || ['name', 'type', 'size'].some(key => key in item && item[key] !== fileRecord[key])) {
          throw new PmsDomainError('PMS_IDB_IMPORT_INVALID', '备份业务附件缺失或文件信息不符，当前记录没有改变。')
        }
      }
    }
    for (const [store, records] of entries) {
      const saved = new Map(current.get(store)?.map((record) => [record[STORE_KEYPATHS[store]], record]))
      storeCounts[store] = 0
      for (const record of records) {
        const existing = saved.get(record[STORE_KEYPATHS[store]])
        if (existing) {
          if (store === PMS_STORES.pmsAttachments) throw new PmsDomainError('PMS_IDB_IMPORT_CONFLICT', '当前浏览器已有备份中的附件，恢复未保存。请在空白浏览器中恢复并核对。')
          if (JSON.stringify(existing) !== JSON.stringify(record)) throw new PmsDomainError('PMS_IDB_IMPORT_CONFLICT', '备份与当前记录存在冲突，恢复未保存。请先保留当前备份并使用另一浏览器核对。')
          continue
        }
        tx.objectStore(store).put(record); imported += 1; storeCounts[store] += 1
      }
    }
  })
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
