import { isProductionContextReady, hydrateProductionContextRecords, productionContextInitializationRecords, assertProductionContextLegacyUnchanged } from '../production-context-records.ts'
import { cuttingRecordUuid, cuttingRecordFingerprint } from './cutting-record-identity.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, diffCuttingRecords, type CuttingStoredRecord, type CuttingRecordSnapshot } from './cutting-record-repository.ts'

/** 换片布及裁片交出使用的部位票事实，复用同一数据库和版本。 */
export const PART_TICKET_KEYS = {
  records: 'cuttingFeiTicketRecords', jobs: 'cuttingFeiTicketPrintJobs',
  drafts: 'cuttingFeiTicketDrafts', manual: 'cuttingManualFeiTicketSources',
  spreading: 'cuttingMarkerSpreadingLedger', markerSources: 'cuttingMarkerPlanSourceLedger', bags: 'cuttingTransferBagLedger',
  markerPlans: 'cuttingMarkerPlanLedger',
} as const
const keys: string[] = Object.values(PART_TICKET_KEYS)
const prefix = 'part-ticket:'
const migrationCollection = 'part-ticket-migrations'
function isBrowserContext(): boolean { return typeof window !== 'undefined' && typeof document !== 'undefined' }
function nodeContextStorage(): Storage | null {
  return typeof window !== 'undefined' && window.localStorage
    ? window.localStorage : typeof localStorage === 'undefined' ? null : localStorage
}
export class PartTicketReadError extends Error { readonly code = 'PART_TICKET_RECOVERY' }
export function isPartTicketRecoveryError(error: unknown): boolean {
  return error instanceof PartTicketReadError || (object(error) && error.code === 'PART_TICKET_RECOVERY')
}
type Json = Record<string, unknown>
function object(value: unknown): value is Json { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()) }
function assertKey(key: string): void { if (!keys.includes(key)) throw new Error(`未登记的部位票数据：${key}`) }
function fail(message = '部位票记录格式不完整'): never { throw new Error(`${message}，未覆盖原数据。`) }
function row(collection: string, id: string, value: unknown): CuttingStoredRecord { return { id: `${prefix}${collection}:${id}`, collection: `${prefix}${collection}`, value } }
function list(value: unknown): unknown[] { if (!Array.isArray(value)) fail(); return value }
const bagCollections = {
 masters: ['bag-masters', ['carrierId','bagId']], usages: ['bag-usages', ['cycleId','usageId']],
 bindings: ['bag-bindings', ['bindingId']], manifests: ['bag-manifests', ['manifestId']],
 sewingTasks: ['bag-sewing-tasks', ['sewingTaskId']], auditTrail: ['bag-audit', ['auditTrailId']],
 returnReceipts: ['bag-return-receipts', ['returnReceiptId']], conditionRecords: ['bag-conditions', ['conditionRecordId']],
 reuseCycles: ['bag-reuse-cycles', ['cycleSummaryId']], closureResults: ['bag-closures', ['closureId']],
 returnAuditTrail: ['bag-return-audit', ['auditTrailId']], scrapRecords: ['bag-scrap', ['scrapRecordId']],
} as const
function collections(key: string): string[] {
  assertKey(key)
  if (key === PART_TICKET_KEYS.bags) return Object.values(bagCollections).map(([name]) => name)
  if (key === PART_TICKET_KEYS.records) return ['records']
  if (key === PART_TICKET_KEYS.jobs) return ['jobs']
  if (key === PART_TICKET_KEYS.drafts) return ['drafts']
  if (key === PART_TICKET_KEYS.spreading) return ['markers', 'spreading-sessions']
  if (key === PART_TICKET_KEYS.markerSources) return ['marker-sources']
  if (key === PART_TICKET_KEYS.markerPlans) return ['marker-plans']
  return ['manual-records', 'manual-logs']
}
function entities(items: unknown, collection: string, idField: string): CuttingStoredRecord[] {
  return list(items).map(value => {
    if (!object(value) || !text(value[idField])) fail('部位票记录缺少身份')
    if (collection === 'records' && (!text(value.ticketNo) || !['PRINTED', 'VOIDED'].includes(String(value.status)))) fail('部位票号或状态无效')
    if (collection === 'jobs' && (!Array.isArray(value.ticketRecordIds) && !Array.isArray(value.cutOrderIds))) fail('打印任务缺少关联票据')
    if (collection === 'manual-records' && (!text(value.feiTicketNo) || !text(value.manualBatchId) || !object(value.qrPayload))) fail('手工票缺少批次或二维码')
    if (collection === 'manual-logs' && (!text(value.feiTicketId) || !text(value.action))) fail('手工票操作记录缺少关联票或动作')
    return row(collection, String(value[idField]), value)
  })
}
export function decodePartTicketRecords(key: string, raw: string | null): CuttingStoredRecord[] {
  assertKey(key)
  if (raw === null) return []
  let data: unknown
  try { data = JSON.parse(raw) } catch { fail('部位票数据格式错误') }
  let result: CuttingStoredRecord[]
  if (key === PART_TICKET_KEYS.bags) {
    if (!object(data) || !Array.isArray(data.masters) || !Array.isArray(data.usages) || !Array.isArray(data.bindings)) fail('旧袋账缺少档案、周期或绑定')
    if (Object.keys(data).some(name => !(name in bagCollections))) fail('旧袋账含未登记字段，请核对后迁移')
    result = Object.entries(bagCollections).flatMap(([field, [collection, idFields]]) => list(data[field] ?? []).map(value => {
      if (!object(value)) fail('旧袋账实体格式错误')
      const id = idFields.map(field => value[field]).find(text)
      if (!id) fail('旧袋账实体缺少稳定身份')
      return row(collection, id, value)
    }))
  } else if (key === PART_TICKET_KEYS.records) result = entities(data, 'records', 'ticketRecordId')
  else if (key === PART_TICKET_KEYS.jobs) result = entities(data, 'jobs', 'printJobId')
  else if (key === PART_TICKET_KEYS.drafts) {
    if (!object(data)) fail('部位票草稿格式错误')
    result = Object.entries(data).map(([key, value]) => {
      if (!text(key) || !object(value) || !text(value.draftId)) fail('部位票草稿身份缺失')
      return row('drafts', key, { key, value })
    })
  } else if (key === PART_TICKET_KEYS.spreading) {
    if (!object(data)) fail('铺布来源格式错误')
    result = [...entities(data.markers, 'markers', 'markerId'), ...entities(data.sessions, 'spreading-sessions', 'spreadingSessionId')]
  } else if (key === PART_TICKET_KEYS.markerSources) {
    result = entities(data, 'marker-sources', 'markerPlanId')
  } else if (key === PART_TICKET_KEYS.markerPlans) {
    result = entities(data, 'marker-plans', 'id')
  } else {
    if (Array.isArray(data)) result = entities(data, 'manual-records', 'feiTicketId')
    else {
      if (!object(data)) fail('手工票数据格式错误')
      result = [...entities(data.records, 'manual-records', 'feiTicketId'), ...entities(data.operationLogs, 'manual-logs', 'logId')]
    }
  }
  if (new Set(result.map(item => item.id)).size !== result.length) fail('部位票记录编号重复')
  return result
}
export function encodePartTicketRecords(key: string, records: CuttingStoredRecord[]): string | null {
  const names = collections(key).map(name => prefix + name)
  const selected = records.filter(item => names.includes(item.collection))
  if (!selected.length) return null
  const values = (name: string) => selected.filter(item => item.collection === prefix + name).map(item => item.value as Json)
  if (selected.some(item => !object(item.value))) fail('已保存部位票实体格式错误')
  let data: unknown
  if (key === PART_TICKET_KEYS.bags) data = Object.fromEntries(Object.entries(bagCollections).map(([field,[collection]]) => [field,values(collection)]))
  else if (key === PART_TICKET_KEYS.records) data = values('records')
  else if (key === PART_TICKET_KEYS.jobs) data = values('jobs')
  else if (key === PART_TICKET_KEYS.drafts) data = Object.fromEntries(values('drafts').map(item => [item.key, item.value]))
  else if (key === PART_TICKET_KEYS.spreading) data = { markers: values('markers'), sessions: values('spreading-sessions') }
  else if (key === PART_TICKET_KEYS.markerSources) data = values('marker-sources')
  else if (key === PART_TICKET_KEYS.markerPlans) data = values('marker-plans')
  else data = { records: values('manual-records'), operationLogs: values('manual-logs') }
  const raw = JSON.stringify(data), expected = decodePartTicketRecords(key, raw)
  const actual = new Map(selected.map(item => [item.id, item]))
  if (actual.size !== selected.length || expected.length !== selected.length || expected.some(item => JSON.stringify(actual.get(item.id)) !== JSON.stringify(item))) fail('已保存部位票身份不一致')
  return raw
}

let cuttingScopeBridge: { initializationRecords: () => CuttingStoredRecord[]; assertCurrent: () => void } | null = null
/** 裁后事件模块已核对的空源证明与部位票首次保存同事务提交。 */
export function installPartTicketCuttingScopeBridge(bridge: NonNullable<typeof cuttingScopeBridge>): void { cuttingScopeBridge = bridge }

let current: CuttingRecordSnapshot | null = null
let stage: Map<string, string | null> | null = null
let locked = false
const listeners = new Map<string, Set<() => void>>()
const serialized = new Map<string, string | null>()
const inspectedEmptyKeys = new Set<string>()
let initializationRecords: CuttingStoredRecord[] = []
/** 只供已有裁床动作合并到同一事务；普通读取绝不写入初始化记录。 */
export function partTicketInitializationRecords(): CuttingStoredRecord[] {
  if (!current) throw new PartTicketReadError('部位票数据尚未读取，不能创建来源初始化记录。')
  return structuredClone(initializationRecords)
}
export function assertPartTicketLegacyUnchanged(): void {
  if (!current) throw new PartTicketReadError('部位票数据尚未读取，请重新进入页面。')
  if (isBrowserContext()) for (const item of initializationRecords) {
    if (legacyValue((item.value as MigrationMarker).key) !== null) throw new PartTicketReadError('旧页面写入了部位票数据，请先迁移，本次未保存。')
  }
}
export function onPartTicketChanged(key: string, callback: () => void): void {
  assertKey(key); const group = listeners.get(key) || new Set(); group.add(callback); listeners.set(key, group)
}
export function isPartTicketReady(): boolean { return current !== null }
export function isPartTicketStaged(): boolean { return stage !== null }
export function readPartTicketValue(key: string): string | null {
  assertKey(key)
  if (stage) return stage.get(key) ?? null
  if (current) return serialized.get(key) ?? null
  if (!isBrowserContext()) return nodeContextStorage()?.getItem(key) ?? null
  throw new PartTicketReadError('部位票数据尚未读取，请重新进入页面；未使用空记录代替已有数据。')
}
export function writePartTicketValue(key: string, value: string | null): void {
  assertKey(key); decodePartTicketRecords(key, value)
  if (stage) { stage.set(key, value); return }
  if (!isBrowserContext()) {
    const storage = nodeContextStorage()
    if (storage) { if (value === null) storage.removeItem(key); else storage.setItem(key, value) }
    return
  }
  throw new Error('本次部位票数据尚未保存，请从保存或确认按钮重试。')
}
export const partTicketStorage = {
  getItem: readPartTicketValue, setItem: writePartTicketValue, removeItem: (key: string) => writePartTicketValue(key, null),
}
interface MigrationMarker { key: string; fingerprint: string; phase: 'COPYING' | 'VERIFIED' | 'COMPLETE'; count: number; copied: number; ids: string[]; targetFingerprint: string }
function marker(snapshot: CuttingRecordSnapshot, key: string): MigrationMarker | undefined {
  const value = snapshot.records.find(item => item.id === `part-ticket-migration:${key}`)?.value
  if (value === undefined) return undefined
  if (!object(value) || value.key !== key || !['COPYING', 'VERIFIED', 'COMPLETE'].includes(String(value.phase))
    || !Array.isArray(value.ids) || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint)
    || typeof value.targetFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.targetFingerprint)
    || !Number.isSafeInteger(value.count) || !Number.isSafeInteger(value.copied) || Number(value.count) < 0
    || Number(value.copied) < 0 || Number(value.copied) > Number(value.count)
    || value.ids.length !== value.count || value.ids.some(id => !text(id)) || new Set(value.ids).size !== value.ids.length
    || (value.phase !== 'COPYING' && value.copied !== value.count)) fail('部位票数据迁移进度损坏')
  return value as unknown as MigrationMarker
}
/** 恢复入口先校验受管实体及索引；不接受未知来源集合冒充可恢复业务。 */
export function validatePartTicketRecords(records: CuttingStoredRecord[]): void {
  const allowed = new Set(keys.flatMap(key => collections(key).map(name => prefix + name)))
  const managed = records.filter(item => item.collection.startsWith(prefix) || item.collection === migrationCollection || item.id.startsWith('part-ticket-migration:'))
  if (new Set(managed.map(item => item.id)).size !== managed.length) fail('部位票数据记录编号重复')
  if (managed.some(item => !allowed.has(item.collection) && item.collection !== migrationCollection)) fail('未登记的部位票数据集合')
  for (const key of keys) encodePartTicketRecords(key, records)
  for (const item of managed.filter(item => item.collection === migrationCollection)) {
    if (!object(item.value) || !keys.includes(String(item.value.key)) || item.id !== `part-ticket-migration:${item.value.key}`) fail('部位票数据迁移身份不一致')
    const saved = marker({ revision: 0, records }, String(item.value.key))!
    const allowedForKey = new Set(collections(saved.key).map(name => prefix + name))
    const rows = new Map(records.map(record => [record.id, record]))
    const found = saved.ids.filter(id => rows.has(id))
    if (saved.ids.some(id => ![...allowedForKey].some(name => id.startsWith(name + ':')))
      || found.some(id => !allowedForKey.has(rows.get(id)!.collection))
      || (saved.phase !== 'COMPLETE' && (found.length < saved.copied || (saved.phase !== 'COPYING' && found.length !== saved.count)))) fail('部位票数据迁移检查点关联缺失')
  }
}
function legacyStorage(key: string): Storage { return key === PART_TICKET_KEYS.drafts ? sessionStorage : localStorage }
function legacyValue(key: string): string | null {
  try { return legacyStorage(key).getItem(key) } catch { throw new PartTicketReadError('旧部位票数据无法检查，请允许读取本机旧数据后迁移；未将无法读取当作空数据。') }
}
export interface PartTicketMigrationStatus { key: string; phase: 'PENDING' | 'COPYING' | 'VERIFIED' | 'COMPLETE' | 'EMPTY' | 'UNAVAILABLE'; count: number; copied: number; message: string }
export async function listPartTicketMigrationStatus(): Promise<PartTicketMigrationStatus[]> {
  const snapshot = await readCuttingRecords()
  return keys.map(key => {
    const saved = marker(snapshot, key)
    if (saved?.phase === 'COMPLETE') return { key, phase: 'COMPLETE', count: saved.count, copied: saved.copied, message: '旧源已核对并清理，使用本机记录库。' }
    try {
      const raw = legacyValue(key)
      return { key, phase: saved?.phase || (raw === null ? 'EMPTY' : 'PENDING'), count: saved?.count ?? decodePartTicketRecords(key, raw).length, copied: saved?.copied || 0, message: saved ? '迁移未完成，可继续；完成前不开放部位票数据保存。' : raw === null ? '未发现旧源。' : '发现旧部位票数据，请先迁移。' }
    } catch (error) { return { key, phase: 'UNAVAILABLE', count: saved?.count || 0, copied: saved?.copied || 0, message: String(error) } }
  })
}
function assertLegacyReady(snapshot: CuttingRecordSnapshot): void {
  if (!isBrowserContext()) return
  for (const key of keys) {
    const saved = marker(snapshot, key)
    if (saved?.phase === 'COMPLETE') continue
    if (saved) throw new PartTicketReadError('部位票数据迁移尚未完成，请在数据管理中继续迁移；未使用部分记录。')
    if (inspectedEmptyKeys.has(key)) continue
    if (legacyValue(key) !== null) throw new PartTicketReadError('发现旧部位票数据，请先完成显式迁移；未使用空记录覆盖。')
    inspectedEmptyKeys.add(key)
  }
}
async function hydrate(snapshot?: CuttingRecordSnapshot, forceNotify = false): Promise<void> {
  const next = snapshot || await readCuttingRecords()
  assertLegacyReady(next)
  if (current?.revision === next.revision && !forceNotify) return
  const values = new Map(keys.map(key => [key, encodePartTicketRecords(key, next.records)]))
  const unmarked = keys.filter(key => !marker(next, key))
  const fingerprint = unmarked.length ? await cuttingRecordFingerprint('null') : ''
  const targetFingerprint = unmarked.length ? await recordsFingerprint([]) : ''
  initializationRecords = unmarked.map(key => markerRow({ key, fingerprint, targetFingerprint, phase: 'COMPLETE', count: 0, copied: 0, ids: [] }))
  const changed = keys.filter(key => forceNotify || serialized.get(key) !== values.get(key))
  for (const [key, value] of values) serialized.set(key, value)
  current = next
  try { for (const key of changed) for (const callback of listeners.get(key) || []) callback() }
  catch (error) { current = null; serialized.clear(); initializationRecords = []; throw error }
}
export async function hydratePartTicketRecords(snapshot?: CuttingRecordSnapshot): Promise<void> {
  if (locked) throw new Error('部位票数据正在保存或迁移，请等待当前动作完成。')
  locked = true
  try { await hydrate(snapshot) } catch (error) { current = null; throw error } finally { locked = false }
}
function restoreWithoutPersist<T>(restore: (value: unknown) => void, value: T, values: Map<string, string | null>): void {
  const prior = stage
  stage = new Map(values)
  try { restore(structuredClone(value)) } finally { stage = prior }
}
/** 锁覆盖准备、事务与发布；回滚写入隔离暂存，complete前业务内存保持原值。 */
export async function savePartTicketAction<T>(input: {
  id?: string; intent: string; action: () => T; capture?: () => unknown; restore?: (value: unknown) => void
}): Promise<T> {
  if (locked) throw new Error('另一项部位票确认尚未完成，请稍后重试。')
  locked = true
  let before: unknown; let captured = false; let committed = false
  const id = input.id || `PART-TICKET:${cuttingRecordUuid()}`
  const displayedRevision = current?.revision
  try {
    await hydrate()
    const withProductionContext = isProductionContextReady()
    if (withProductionContext) await hydrateProductionContextRecords(current!)
    if (!input.intent.trim()) throw new Error('部位票确认内容标识缺失。')
    const previous = await readCuttingCommand(id)
    if (previous) {
      if (previous.intent !== input.intent) throw new Error('本次确认编号已用于不同内容，请重新核对。')
      await hydrate(undefined, true); return previous.result as T
    }
    if (displayedRevision !== undefined && displayedRevision !== current!.revision) throw new Error('其他页面已更新裁床记录。本次未保存，请重新读取后确认。')
    const snapshot = current!, original = new Map(serialized)
    before = structuredClone((input.capture?.() ?? null)); captured = true
    const working = new Map(original)
    stage = working
    let result: T; let after: unknown
    try {
      result = input.action()
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('生产动作必须先完成同步计算再保存。')
      after = structuredClone((input.capture?.() ?? null))
    } finally { stage = null; restoreWithoutPersist(input.restore || (() => {}), before, original) }
    const change = diffCuttingRecords(snapshot.records.filter(item => item.collection.startsWith(prefix)), keys.flatMap(key => decodePartTicketRecords(key, working.get(key) ?? null)))
    const unmarked = keys.filter(key => !marker(snapshot, key))
    change.puts.push(...partTicketInitializationRecords(), ...(withProductionContext ? productionContextInitializationRecords() : []), ...(cuttingScopeBridge?.initializationRecords() || []))
    const saved = await commitCuttingRecords({ revision: snapshot.revision, change, command: { id, intent: input.intent, result, at: new Date().toISOString() },
      assertSourcesCurrent: () => { cuttingScopeBridge?.assertCurrent(); if (withProductionContext) assertProductionContextLegacyUnchanged(); if (isBrowserContext()) for (const key of unmarked) if (legacyValue(key) !== null) throw new PartTicketReadError('旧页面写入了部位票数据，请先迁移，本次未保存。') } })
    committed = true
    if (!saved.replayed) restoreWithoutPersist(input.restore || (() => {}), after, working)
    await hydrate(undefined, true)
    return saved.result
  } catch (error) {
    if (captured && !committed) restoreWithoutPersist(input.restore || (() => {}), before, serialized)
    if (committed) throw new Error(`部位票记录已保存，但页面同步失败，请重新进入页面核对，不要重复新建。${String(error)}`)
    throw error
  } finally { stage = null; locked = false }
}
function markerRow(value: MigrationMarker): CuttingStoredRecord { return { id: `part-ticket-migration:${value.key}`, collection: migrationCollection, value } }
async function recordsFingerprint(records: CuttingStoredRecord[]): Promise<string> { return cuttingRecordFingerprint(JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id)))) }
async function verifyMarker(snapshot: CuttingRecordSnapshot, saved: MigrationMarker): Promise<void> {
  const byId = new Map(snapshot.records.map(item => [item.id, item]))
  const rows = saved.ids.map(id => byId.get(id))
  if (rows.some(item => !item) || await recordsFingerprint(rows as CuttingStoredRecord[]) !== saved.targetFingerprint) throw new Error('部位票数据读回不一致，旧源未清理；请核对冲突后重试。')
}
/** 显式迁移：每批最多100个实体；断点与批次同事务，清理前读回完整校验。 */
export async function migratePartTicketRecords(input: { otherPagesClosed: boolean; progress: (text: string) => void }): Promise<number> {
  if (!input.otherPagesClosed) throw new Error('请先关闭其他 HiGood 页面并勾选确认，旧来源未清理。')
  if (locked) throw new Error('部位票数据正在保存或迁移，请等待当前动作完成。')
  locked = true
  current = null
  let count = 0
  try {
    for (const key of keys) {
      let snapshot = await readCuttingRecords()
      let saved = marker(snapshot, key)
      const raw = legacyValue(key)
      if (saved?.phase === 'COMPLETE') {
        if (raw !== null) throw new Error('已完成迁移的旧部位票数据再次出现，请关闭旧页面并核对；未删除重新写入的数据。')
        continue
      }
      if (raw === null && saved?.phase === 'COPYING') throw new Error('迁移尚未核对完成但旧源已缺失，请从备份恢复旧源后继续。')
      const records = raw === null ? [] : decodePartTicketRecords(key, raw)
      const fingerprint = raw === null && saved ? saved.fingerprint : await cuttingRecordFingerprint(raw ?? 'null')
      if (saved && saved.fingerprint !== fingerprint) throw new Error('旧页面改变了部位票数据，迁移暂停，源记录保留。')
      saved ||= { key, fingerprint, phase: 'COPYING', count: records.length, copied: 0, ids: records.map(item => item.id), targetFingerprint: await recordsFingerprint(records) }
      const assertSource = () => { if (legacyValue(key) !== raw) throw new Error('旧页面改变了部位票数据，迁移暂停，源记录保留。') }
      if (raw !== null) {
        for (let offset = 0; offset < records.length; offset += 100) {
          assertSource(); snapshot = await readCuttingRecords()
          const byId = new Map(snapshot.records.map(item => [item.id, item]))
          const batch = records.slice(offset, offset + 100)
          for (const item of batch) if (byId.has(item.id) && JSON.stringify(byId.get(item.id)) !== JSON.stringify(item)) throw new Error('部位票数据与本机版本冲突，未覆盖或清理。')
          saved = { ...saved, phase: 'COPYING', copied: Math.max(saved.copied, offset + batch.length) }
          await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [...batch.filter(item => !byId.has(item.id)), markerRow(saved)] }, assertSourcesCurrent: assertSource,
            command: { id: `PART-TICKET-MIGRATION:${key}:${fingerprint}:${offset}`, intent: fingerprint, result: batch.length, at: new Date().toISOString() } })
          input.progress(`部位票数据迁移：${saved.copied} / ${saved.count} 条，旧源仍保留。`)
        }
      }
      snapshot = await readCuttingRecords(); await verifyMarker(snapshot, saved); assertSource()
      if (raw !== null || saved.phase !== 'VERIFIED') {
        saved = { ...saved, phase: 'VERIFIED', copied: saved.count }
        await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [markerRow(saved)] }, assertSourcesCurrent: assertSource,
          command: { id: `PART-TICKET-MIGRATION:${key}:${fingerprint}:verified`, intent: fingerprint, result: saved.count, at: new Date().toISOString() } })
      }
      assertSource()
      if (raw !== null) legacyStorage(key).removeItem(key)
      if (legacyValue(key) !== null) throw new Error('旧页面重新写回部位票数据，迁移未完成。')
      snapshot = await readCuttingRecords(); await verifyMarker(snapshot, saved)
      const complete = { ...saved, phase: 'COMPLETE' as const, copied: saved.count }
      await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [markerRow(complete)] },
        assertSourcesCurrent: () => { if (legacyValue(key) !== null) throw new Error('旧部位票数据重新出现，迁移尚未完成。') },
        command: { id: `PART-TICKET-MIGRATION:${key}:${fingerprint}:complete`, intent: fingerprint, result: saved.count, at: new Date().toISOString() } })
      if (legacyValue(key) !== null) throw new Error('旧页面重新写回部位票数据，请关闭旧页面并核对。')
      count += saved.count
    }
    inspectedEmptyKeys.clear()
    await hydrate(undefined, true)
    input.progress(`部位票数据已读回核对并完成迁移，本次处理 ${count} 条，旧源已清理。`)
    return count
  } finally { locked = false }
}

/** 裁床事件与部位票来源同一动作的同步准备；不写库、不发布。 */
export function preparePartTicketMutation<T>(action: () => T): { result: T; change: import('./cutting-record-repository.ts').CuttingRecordChange } {
  if (!current) throw new PartTicketReadError('部位票来源尚未读取。')
  if (stage || locked) throw new Error('部位票正在保存，请等待当前动作完成。')
  const working = new Map(serialized)
  stage = working
  try {
    const result = action()
    if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('裁床动作准备须同步完成。')
    return { result, change: diffCuttingRecords(current.records.filter(item => item.collection.startsWith(prefix)), keys.flatMap(key => decodePartTicketRecords(key, working.get(key) ?? null))) }
  } finally { stage = null }
}

/** 静态唛架/铺布单不落盘，只有保存动作改变的实体进入覆盖库。 */
export function stagePartTicketSpreadingStore<T extends { markers: Array<{ markerId: string }>; sessions: Array<{ spreadingSessionId: string }> }>(next: T, baseline: T, changedIds?: { markers?: string[]; sessions?: string[] }): void {
  const raw = readPartTicketValue(PART_TICKET_KEYS.spreading)
  const previous = raw ? JSON.parse(raw) as T : { markers: [], sessions: [] }
  const changed = <R>(rows: R[], defaults: R[], saved: R[], id: (row: R) => string): R[] => {
    const defaultMap = new Map(defaults.map(row => [id(row), JSON.stringify(row)]))
    const savedIds = new Set(saved.map(id))
    return rows.filter(row => savedIds.has(id(row)) || defaultMap.get(id(row)) !== JSON.stringify(row))
  }
  const selected = <R>(rows: R[], saved: R[], ids: string[] | undefined, id: (row: R) => string): R[] => {
    const chosen = new Set(ids || [])
    const result = new Map(saved.filter(row => !chosen.has(id(row))).map(row => [id(row), row]))
    for (const row of rows.filter(row => chosen.has(id(row)))) {
      if (result.has(id(row))) fail('本次保存对象身份重复')
      result.set(id(row), row)
    }
    return [...result.values()]
  }
  writePartTicketValue(PART_TICKET_KEYS.spreading, JSON.stringify({
    markers: changedIds ? selected(next.markers, previous.markers, changedIds.markers, row => row.markerId) : changed(next.markers, baseline.markers, previous.markers, row => row.markerId),
    sessions: changedIds ? selected(next.sessions, previous.sessions, changedIds.sessions, row => row.spreadingSessionId) : changed(next.sessions, baseline.sessions, previous.sessions, row => row.spreadingSessionId),
  }))
}

/** 旧袋操作按实体差异暂存；动作入口负责和事件一起事务提交。静态记录关闭用状态覆盖。 */
export function stagePartTicketTransferBagStore(next: object, before: object): void {
 const key = PART_TICKET_KEYS.bags
 const previous = decodePartTicketRecords(key, readPartTicketValue(key))
 const baseline = decodePartTicketRecords(key, JSON.stringify(before))
 const updated = decodePartTicketRecords(key, JSON.stringify(next))
 const changed = diffCuttingRecords(baseline, updated)
 const saved = new Map(previous.map(record => [record.id,record]))
 for (const id of changed.deletes || []) {
   if (!saved.has(id)) throw new Error('静态中转袋记录不能物理删除，请通过关闭或移除状态保留历史。')
   saved.delete(id)
 }
 for (const record of changed.puts || []) saved.set(record.id,record)
 writePartTicketValue(key, encodePartTicketRecords(key, [...saved.values()]))
}
