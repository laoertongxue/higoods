import type { PmsMaterialPurchaseOrder } from './material-purchase-orders.ts'
import { PMS_STORES, pmsTx, type PmsAttachment } from './idb-storage.ts'
import { createPmsOperationLog, publishPmsOperationLog, PmsDomainError, PMS_SYSTEM_ACTOR, type PmsActorRole, type PmsOperationLog } from './runtime.ts'

/** Only this named legacy source is handled. Importing this module never opens a database or migrates. */
export const PMS_LEGACY_MPO_KEY = 'higood-pms-material-purchase-updates-v1'
const TARGET = PMS_STORES.pmsMaterialPurchaseOrderDeltas
const STORES = [TARGET, PMS_STORES.pmsVersionSnapshots, PMS_STORES.pmsAttachments, PMS_STORES.pmsAttachmentReferences, PMS_STORES.pmsCommittedOperations, PMS_STORES.pmsOperationLogs]
export interface LegacyPurchaseStorage { getItem(key: string): string | null; removeItem(key: string): void }
export interface LegacyPurchaseDetection { key: string; found: boolean; count: number; sourceHash?: string }
export interface LegacyPurchaseBackup { raw: string; fileName: string; sourceHash: string; count: number | null; validationMessage?: string }
export interface LegacyPurchaseMigrationOptions {
  otherPagesClosed: boolean
  expectedSourceHash?: string
  storage?: LegacyPurchaseStorage
  actor?: { id: string; name: string; role: PmsActorRole }
}
export interface LegacyPurchaseMigrationResult {
  key: string; status: 'no-source' | 'completed' | 'cleanup-pending'
  sourceHash?: string; operationId?: string; total: number; migrated: number; skipped: number
  replayed: boolean; targetVerified: boolean; removed: boolean; message: string
}
type RecordObject = Record<string, unknown>
type Order = PmsMaterialPurchaseOrder & { _baseVersion?: number }
type Version = { snapshotKey: string; version: number }
type Owner = { id: string; fileIds: string[] }
type Receipt = { id: string; signature: string; logId: string; recordCount: number }
type Snapshot = { order: Order; existing?: Order; version?: Version; owner?: Owner }
const error = (code: string, message: string) => new PmsDomainError(`MPO_LEGACY_${code}`, message)
function getStorage(storage?: LegacyPurchaseStorage): LegacyPurchaseStorage {
  if (storage) return storage
  try { if (typeof window !== 'undefined') return window.localStorage } catch { /* Report the read failure below. */ }
  throw error('READ_FAILED', '旧采购资料未能读取。保留当前资料，恢复浏览器本地存储后重试。')
}
function readRaw(storage: LegacyPurchaseStorage): string | null {
  try { return storage.getItem(PMS_LEGACY_MPO_KEY) } catch { throw error('READ_FAILED', '旧采购资料未能读取。没有执行迁移或清理，请恢复本地存储后重试。') }
}
function object(value: unknown): value is RecordObject { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function validVersion(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function unsupportedFiles(value: unknown, key = '', depth = 0): void {
  if (depth > 60) throw error('INVALID', '旧采购资料结构过深，未执行迁移。请保留旧资料核对。')
  if (typeof value === 'string' && (/^\s*(?:data:|blob:)/i.test(value) || /base64/i.test(key) && value)) {
    throw error('ATTACHMENT_UNSUPPORTED', '旧资料包含内嵌文件或临时文件地址。此工具不转换这类附件；旧源已保留，请先核对原始文件。')
  }
  if (Array.isArray(value)) { value.forEach(item => unsupportedFiles(item, key, depth + 1)); return }
  if (!object(value)) return
  for (const [name, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(name)) throw error('INVALID', '旧采购资料包含不支持的结构字段，旧源已保留。')
    if (/^(?:files?|images?|pictures?|vouchers?|attachment)$/i.test(name) && item != null && item !== '' && (!Array.isArray(item) || item.length)) {
      throw error('ATTACHMENT_UNSUPPORTED', '旧资料包含无法确定归属的附件字段。此工具不猜测附件关系，旧源已保留。')
    }
    if (name === 'fileId' && key !== 'attachments') throw error('ATTACHMENT_UNSUPPORTED', '旧资料存在无法确定归属的文件引用，旧源已保留。')
    if (/(?:^version$|Version$)/.test(name) && item !== undefined && !(name === 'relationVersion' && item === null) && !validVersion(item)) {
      throw error('INVALID_VERSION', '旧采购资料的版本信息不合法，未执行迁移或清理。')
    }
    unsupportedFiles(item, name, depth + 1)
  }
}
function parseOrders(raw: string): Order[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw error('INVALID', '旧采购资料格式错误，未执行迁移或清理。请保留旧资料核对。') }
  if (!Array.isArray(parsed)) throw error('INVALID', '旧采购资料不是采购记录列表，未执行迁移或清理。')
  const identifiers = new Set<string>()
  const strings = ['purchaseOrderNo', 'requirementNo', 'sourceRequirementLineNo', 'sourceProductPurchaseOrderNo', 'materialCode', 'materialName', 'materialType', 'materialImageUrl', 'unit', 'styleCode', 'styleName', 'styleImageUrl', 'supplierName', 'warehouse', 'orderDate', 'expectedArrivalDate', 'buyerName', 'supplierConfirmedAt', 'remark']
  for (const value of parsed) {
    if (!object(value) || strings.some(key => typeof value[key] !== 'string') || ['purchaseOrderNo', 'materialCode', 'materialName', 'materialType', 'unit', 'warehouse'].some(key => !(value[key] as string).trim())) throw error('INVALID', '旧采购记录缺少有效单号、物料、单位、仓库或必要业务字段，旧源已保留。')
    const no = value.purchaseOrderNo as string
    if (no !== no.trim() || identifiers.has(no)) throw error('DUPLICATE', '旧采购列表的单号重复或包含首尾空白，未执行迁移或清理。')
    identifiers.add(no)
    // This v1 key held ordinary purchase updates. PCS drafts have a separate IDB source.
    if (!['待采购', '已采购', '部分到货', '已到货', '已入库', '已关闭'].includes(String(value.status)) || !['RMB', 'IDR', 'USD'].includes(String(value.currency)) || typeof value.supplierConfirmed !== 'boolean') throw error('INVALID', '旧采购记录的状态、币种或供应商确认字段不合法，旧源已保留。')
    if (['orderedQty', 'receivedQty', 'unitPrice'].some(key => typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Number(value[key]) < 0) || Number(value.orderedQty) <= 0 || Number(value.receivedQty) > Number(value.orderedQty) + 0.000001) throw error('INVALID', '旧采购数量或价格不合法，未执行迁移或清理。')
    if (['_baseVersion', '_pmsBaseVersion', 'draftVersion'].some(key => key in value && !validVersion(value[key]))) throw error('INVALID_VERSION', '旧采购资料的版本信息不合法，未执行迁移或清理。')
    const extraNumbers = ['weightKg', 'volumeM3', 'dyeFee', 'defectQty', 'mainUnitQuantity']
    const extraStrings = ['usageType', 'supplementReason', 'dedicatedSpu', 'factoryName', 'inspector', 'inspectionConclusion', 'rejectedReason', 'printingFactory', 'cuttingFactory', 'printingProcess', 'supplierCode', 'purchaseRegion', 'purchasedAt', 'arrivedAt', 'defectWarehouse']
    if (extraNumbers.some(key => key in value && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Number(value[key]) < 0)) || extraStrings.some(key => key in value && typeof value[key] !== 'string') || ['priceConfirmed', 'isStockProduction', 'taxIncluded'].some(key => key in value && typeof value[key] !== 'boolean')) throw error('INVALID', '旧采购记录的补充业务字段类型不合法，旧源已保留。')
    unsupportedFiles(value)
    if ('attachments' in value) {
      if (!Array.isArray(value.attachments)) throw error('ATTACHMENT_UNSUPPORTED', '旧采购附件结构无法核对，旧源已保留。')
      const fileIds = new Set<string>()
      for (const file of value.attachments) {
        if (!object(file) || !['fileId', 'name', 'type', 'category'].every(key => typeof file[key] === 'string' && (file[key] as string).trim()) || !Number.isSafeInteger(file.size) || Number(file.size) <= 0 || !['物流凭证', '附加图片'].includes(String(file.category)) || fileIds.has(file.fileId as string) || Object.keys(file).some(key => !['fileId', 'name', 'type', 'size', 'category'].includes(key))) throw error('ATTACHMENT_UNSUPPORTED', '旧采购附件引用不完整、重复或包含无法核对的文件内容，旧源已保留。')
        fileIds.add(file.fileId as string)
      }
    }
    if ('detailBarcodes' in value) {
      if (!Array.isArray(value.detailBarcodes)) throw error('INVALID', '旧采购条码结构不合法，旧源已保留。')
      const codes = new Set<string>()
      let total = 0
      for (const row of value.detailBarcodes) {
        if (!object(row) || typeof row.code !== 'string' || !row.code.trim() || codes.has(row.code) || typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity <= 0 || row.unit !== value.unit || typeof row.warehouse !== 'string' || !row.warehouse.trim() || !['有效', '已下架'].includes(String(row.status))) throw error('INVALID', '旧采购条码的编号、数量、单位或状态不合法，旧源已保留。')
        codes.add(row.code); total += row.quantity
      }
      if (total > Number(value.orderedQty) + 0.000001) throw error('INVALID', '旧采购条码总数量超过采购数量，旧源已保留。')
    }
  }
  return parsed as Order[]
}
/** Storage metadata is not business content. All other fields and array order must match. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (object(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => !['_baseVersion', '_pmsBaseVersion'].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  return value
}
function equal(left: unknown, right: unknown): boolean { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)) }
async function sourceHash(raw: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw error('HASH_UNAVAILABLE', '当前浏览器无法核验旧资料内容，未执行迁移或清理。')
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function detectLegacyMaterialPurchaseOrders(storageInput?: LegacyPurchaseStorage): Promise<LegacyPurchaseDetection> {
  const raw = readRaw(getStorage(storageInput))
  if (raw === null) return { key: PMS_LEGACY_MPO_KEY, found: false, count: 0 }
  const orders = parseOrders(raw)
  return { key: PMS_LEGACY_MPO_KEY, found: true, count: orders.length, sourceHash: await sourceHash(raw) }
}
/** A raw source backup remains available even when migration validation rejects its contents. */
export async function readLegacyMaterialPurchaseBackup(storageInput?: LegacyPurchaseStorage): Promise<LegacyPurchaseBackup> {
  const raw = readRaw(getStorage(storageInput))
  if (raw === null) throw error('NO_SOURCE', '此旧采购键已不存在，没有生成空备份。')
  const hash = await sourceHash(raw)
  let count: number | null = null, validationMessage: string | undefined
  try { count = parseOrders(raw).length } catch (reason) { validationMessage = reason instanceof Error ? reason.message : '旧资料尚未通过迁移核对。' }
  return { raw, fileName: `旧面辅料采购资料-${hash.slice(0, 12)}.json`, sourceHash: hash, count, validationMessage }
}
function request<T>(value: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(error('TARGET_READ_FAILED', '迁移目标或附件未能读取，旧源已保留。')) }) }
async function readSnapshot(tx: IDBTransaction, orders: Order[]) {
  const rows = await Promise.all(orders.map(async order => {
    const [existing, version, owner] = await Promise.all([
      request(tx.objectStore(TARGET).get(order.purchaseOrderNo)) as Promise<Order | undefined>,
      request(tx.objectStore(PMS_STORES.pmsVersionSnapshots).get(`${TARGET}::${order.purchaseOrderNo}`)) as Promise<Version | undefined>,
      request(tx.objectStore(PMS_STORES.pmsAttachmentReferences).get(`${TARGET}::${order.purchaseOrderNo}`)) as Promise<Owner | undefined>,
    ])
    return { order, existing, version, owner } as Snapshot
  }))
  const fileIds = [...new Set(orders.flatMap(order => order.attachments?.map(file => file.fileId) ?? []))]
  const files = new Map(await Promise.all(fileIds.map(async id => [id, await request(tx.objectStore(PMS_STORES.pmsAttachments).get(id)) as PmsAttachment | undefined] as const)))
  return { rows, files }
}
function validateTarget(rows: Snapshot[], files: Map<string, PmsAttachment | undefined>, requireAll = false): void {
  for (const { order, existing, version, owner } of rows) {
    if (existing && !equal(existing, order)) throw error('CONFLICT', '已有采购资料与旧源内容不同。本批未覆盖已有资料，请保留旧源先核对冲突。')
    if (requireAll && !existing) throw error('VERIFY_FAILED', '迁入事务已完成，但回读缺少采购记录；旧源尚未清理。')
    const currentVersion = version?.version ?? 0
    if (!validVersion(currentVersion) || (!existing && version) || existing && (['_baseVersion', '_pmsBaseVersion'].some(key => key in existing && !validVersion((existing as unknown as RecordObject)[key])) || (existing._pmsBaseVersion ?? 0) !== currentVersion)) throw error('VERSION_CONFLICT', '迁移目标的版本记录无法核对，旧源已保留；未覆盖已有采购资料。')
    const wantedIds = order.attachments?.map(file => file.fileId) ?? []
    if (owner && (!Array.isArray(owner.fileIds) || !equal([...owner.fileIds].sort(), [...wantedIds].sort())) || existing && wantedIds.length && !owner || !existing && owner) throw error('ATTACHMENT_CONFLICT', '迁移目标的附件归属与旧采购资料不一致，旧源已保留。')
    for (const meta of order.attachments ?? []) {
      const file = files.get(meta.fileId)
      if (!file || !(file.blob instanceof Blob) || file.name !== meta.name || file.type !== meta.type || file.size !== meta.size || file.blob.size !== meta.size || file.blob.type !== meta.type) throw error('ATTACHMENT_MISSING', '旧采购单的原始附件不存在或内容信息不符。无法确定附件关系，旧源已保留，未执行清理。')
    }
  }
}
export async function migrateLegacyMaterialPurchaseOrders(options: LegacyPurchaseMigrationOptions): Promise<LegacyPurchaseMigrationResult> {
  if (options.otherPagesClosed !== true) throw error('OLD_PAGES_OPEN', '先关闭使用旧版本的采购页面，再明确执行迁移。普通打开页面不会迁移或清理旧资料。')
  const storage = getStorage(options.storage), raw = readRaw(storage)
  if (raw === null) return { key: PMS_LEGACY_MPO_KEY, status: 'no-source', total: 0, migrated: 0, skipped: 0, replayed: false, targetVerified: false, removed: false, message: '未发现此旧采购键，没有执行迁移或清理。' }
  const orders = parseOrders(raw), hash = await sourceHash(raw), operationId = `pms-legacy-mpo:${hash}`
  if (options.expectedSourceHash !== undefined && options.expectedSourceHash !== hash) throw error('SOURCE_CHANGED', '旧采购内容已变化。没有执行迁移或清理，请重新检查旧资料。')
  const actor = options.actor ?? PMS_SYSTEM_ACTOR
  const signature = JSON.stringify({ kind: 'legacy-material-purchase-v1', sourceHash: hash, keys: orders.map(order => order.purchaseOrderNo) })
  const logCandidate = createPmsOperationLog({ objectType: 'material-purchase-migration', objectId: operationId, action: '核对迁入旧采购资料', beforeValue: `${orders.length} 条旧采购资料`, afterValue: '', reason: '明确触发迁移；事务完成并回读一致后才清理指定旧键', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  logCandidate.id = `PMSLOG-MIGRATION-${hash}`
  const committed = await pmsTx(STORES, 'readwrite', async tx => {
    const [snapshot, receipt] = await Promise.all([readSnapshot(tx, orders), request(tx.objectStore(PMS_STORES.pmsCommittedOperations).get(operationId)) as Promise<Receipt | undefined>])
    validateTarget(snapshot.rows, snapshot.files)
    if (readRaw(storage) !== raw) throw error('SOURCE_CHANGED', '旧采购内容在迁移期间发生变化。本批没有迁入或清理，请重新检查旧资料。')
    const missing = snapshot.rows.filter(row => !row.existing)
    if (receipt) {
      if (receipt.signature !== signature || receipt.recordCount !== orders.length || missing.length) throw error('RECEIPT_CONFLICT', '上次迁移的回执与当前目标记录不一致，旧源已保留；没有覆盖或重复建单。')
      const log = await request(tx.objectStore(PMS_STORES.pmsOperationLogs).get(receipt.logId)) as PmsOperationLog | undefined
      if (!log) throw error('RECEIPT_CONFLICT', '上次迁移的操作记录未能核对，旧源已保留；没有重复建单。')
      return { migrated: 0, skipped: orders.length, replayed: true, log }
    }
    logCandidate.afterValue = `新增 ${missing.length} 条，已有相同 ${orders.length - missing.length} 条`
    for (const { order } of missing) {
      const value = canonical(order) as RecordObject
      value._pmsBaseVersion = 1
      tx.objectStore(TARGET).put(value)
      tx.objectStore(PMS_STORES.pmsVersionSnapshots).put({ snapshotKey: `${TARGET}::${order.purchaseOrderNo}`, version: 1, updatedAt: logCandidate.occurredAt, actor: actor.name })
      if (order.attachments?.length) tx.objectStore(PMS_STORES.pmsAttachmentReferences).put({ id: `${TARGET}::${order.purchaseOrderNo}`, fileIds: order.attachments.map(file => file.fileId) })
    }
    tx.objectStore(PMS_STORES.pmsOperationLogs).put(logCandidate)
    tx.objectStore(PMS_STORES.pmsCommittedOperations).put({ id: operationId, signature, logId: logCandidate.id, recordCount: orders.length })
    return { migrated: missing.length, skipped: orders.length - missing.length, replayed: false, log: logCandidate }
  })
  publishPmsOperationLog(committed.log)
  const result: LegacyPurchaseMigrationResult = { key: PMS_LEGACY_MPO_KEY, sourceHash: hash, operationId, status: 'cleanup-pending', total: orders.length, migrated: committed.migrated, skipped: committed.skipped, replayed: committed.replayed, targetVerified: false, removed: false, message: '目标已保存，旧源未清理。' }
  let cleanupAttempted = false
  try {
    await pmsTx(STORES, 'readonly', async tx => {
      const snapshot = await readSnapshot(tx, orders)
      validateTarget(snapshot.rows, snapshot.files, true)
      const receipt = await request(tx.objectStore(PMS_STORES.pmsCommittedOperations).get(operationId)) as Receipt | undefined
      const log = receipt ? await request(tx.objectStore(PMS_STORES.pmsOperationLogs).get(receipt.logId)) : undefined
      if (!receipt || receipt.signature !== signature || !log) throw error('VERIFY_FAILED', '迁移回执与操作记录未能独立回读。')
    })
    result.targetVerified = true
    const latestRaw = readRaw(storage)
    if (latestRaw !== raw) { result.message = '目标已保存并核对，旧内容已变化；未执行旧源清理。请重新检查旧资料。'; return result }
    cleanupAttempted = true
    try { storage.removeItem(PMS_LEGACY_MPO_KEY) } catch { result.message = '目标已保存并核对，旧源未清理。恢复本地存储后可重新执行；相同记录不会重复迁入。'; return result }
    if (readRaw(storage) !== null) { result.message = '目标已保存并核对，旧源清理未确认。请重新检查旧资料；相同记录不会重复迁入。'; return result }
    result.status = 'completed'; result.removed = true; result.message = `已核对 ${orders.length} 条采购资料并清理指定旧键；其它本地资料保持不变。`
  } catch (reason) { result.message = cleanupAttempted ? '目标已保存并核对，旧键清理结果未能回读。恢复本地存储后重新检查；没有把读取失败当成旧键不存在。' : `目标迁入事务已完成，旧源未清理。${reason instanceof Error ? reason.message : '回读核对未完成，请恢复读取后重试。'}` }
  return result
}
