import { parseEngineeringBomSnapshot } from './pcs-engineering-bom-storage.ts'
import { commitPcsRecords, readPcsRecords, type PcsStoredRecord, type PcsStoredFile } from './pcs-record-db.ts'
import { assignPcsRecordPositions } from './pcs-record-position.ts'

// 同步领域函数只修改本次动作的工作副本；持久提交在页面继续显示成功之前完成。
export const PCS_LEGACY_KEYS = [
  'higood-fcs-production-tech-pack-publish-evaluations-v1',
  'higood-pcs-testing-orders-v1', 'higood-pcs-engineering-master-store-v1',
  'higood-pcs-design-revision-v1', 'higood-pcs-engineering-bom-pricing-plan-store-v2',
  'higood-pcs-style-archive-store-v3', 'higood-pcs-sku-archive-store-v1',
  'higood-pcs-project-channel-product-store-v2', 'higood-pcs-project-relation-store-v2',
  'higood-pcs-technical-data-version-store-v5', 'higood-pcs-tech-pack-version-log-store-v1',
  'higood-pcs-tech-pack-review-notification-store-v1', 'higood-pcs-engineering-task-uploads-v1',
  'higood:pcs:engineering-pattern-results:v1',
] as const
const keys = new Set<string>(PCS_LEGACY_KEYS)
let fcsBridge: typeof import('./fcs/design-revision-pcs-storage.ts') | undefined
const snapshots = new Map<string, string>()
const baseline = new Map<string, string>()
const resets = new Set<() => void>()
const files = new Map<string, Blob>()
const fileUrls = new Map<string, string>()
const urlIds = new Map<string, string>()
let stored: PcsStoredRecord[] = []
let ready: Promise<void> | null = null
let failure = ''
let saving = false
let demoDepth = 0
let staging = false
const dirty = new Set<string>()
let stale = false
const clientId = typeof crypto !== 'undefined' ? crypto.randomUUID() : 'node'

export function isPcsDemoData(): boolean { return demoDepth > 0 }
export function hasPcsRecordSnapshot(key: string): boolean { return snapshots.has(key) }

export function registerPcsRepositoryReset(reset: () => void): void { resets.add(reset) }
export function withPcsDemoData<T>(recipe: () => T): T {
  demoDepth++
  try { return recipe() } finally { demoDepth-- }
}
export function registerPcsFile(blob: Blob, id: string = crypto.randomUUID()): { fileId: string; url: string } {
  if (files.has(id) && files.get(id) !== blob) throw new Error('附件编号已存在；替换文件请使用新编号，不能覆盖原文件。')
  files.set(id, blob)
  let url = fileUrls.get(id)
  if (!url) { url = URL.createObjectURL(blob); fileUrls.set(id, url); urlIds.set(url, id) }
  return { fileId: id, url }
}
export function getPcsStorageFailure(): string { return failure }
export function getPcsStorageBusy(): boolean { return saving }

export const pcsRecordStore = {
  getItem(key: string): string | null { return snapshots.get(key) ?? baseline.get(key) ?? null },
  setItem(key: string, raw: string): void {
    if (!keys.has(key)) throw new Error(`未登记的数据范围：${key}`)
    JSON.parse(raw)
    if (demoDepth > 0 || typeof window === 'undefined') {
      baseline.set(key, raw)
      if (!staging) snapshots.set(key, raw)
      return
    }
    if (!staging) throw new Error('本次修改尚未保存：请通过页面业务动作重试。')
    const next = JSON.stringify(JSON.parse(raw), (_key, value) => {
      if (value && typeof value === 'object' && value.fileId && value.status === '待保存') return { ...value, status: '已保存' }
      return value
    })
    snapshots.set(key, next); dirty.add(key)
  },
  removeItem(key: string): void {
    if (!staging && !demoDepth && typeof window !== 'undefined') throw new Error('清理数据必须通过已确认的业务动作。')
    snapshots.set(key, emptySnapshot(snapshots.get(key) ?? baseline.get(key))); dirty.add(key)
  },
}

function emptySnapshot(raw?: string): string {
  if (!raw) return '[]'
  const parsed = JSON.parse(raw)
  return JSON.stringify(Array.isArray(parsed) ? [] : Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? [] : value])))
}
type Entry = { position: number; data: unknown }
function identity(value: unknown, position: number): string {
  if (!value || typeof value !== 'object') return String(position)
  const item = value as Record<string, unknown>
  if (typeof item.resultVersionId === 'string' && item.resultVersionId) return item.resultVersionId
  if ('itemId' in item && 'purpose' in item && 'taskId' in item) return `${item.taskId}:${item.itemId}:${item.purpose}`
  for (const key of ['batchId', 'logId', 'notificationId', 'pendingRelationId', 'pendingItemId', 'pendingId', 'recordId', 'projectRelationId', 'relationId', 'pricingPlanId', 'planId', 'samplingTaskId', 'bomDraftVersionId', 'versionId', 'bomVersionId', 'testingOrderId', 'channelProductId', 'technicalVersionId', 'skuId', 'masterOrderId', 'styleId', 'id']) {
    if (typeof item[key] === 'string' && item[key]) return item[key] as string
  }
  throw new Error(`业务记录缺少稳定编号，未保存（字段：${Object.keys(item).join(',')}）。`)
}
function decode(key: string, raw: string): Array<Omit<PcsStoredRecord, 'version'>> {
  const value = key === 'higood-pcs-engineering-bom-pricing-plan-store-v2' ? parseEngineeringBomSnapshot(raw) as any : JSON.parse(raw)
  const result: Array<Omit<PcsStoredRecord, 'version'>> = []
  const groups: Record<string, unknown[]> = Array.isArray(value) ? { items: value } : Object.fromEntries(Object.entries(value).filter(([, v]) => Array.isArray(v))) as Record<string, unknown[]>
  const metadata = Array.isArray(value) ? { array: true } : { array: false, fields: Object.fromEntries(Object.entries(value).filter(([, v]) => !Array.isArray(v))), groups: Object.keys(groups) }
  result.push({ id: `${key}/meta`, collection: key, value: metadata })
  for (const [group, values] of Object.entries(groups)) {
    const seen = new Set<string>()
    values.forEach((data, position) => {
      const id = `${key}/${group}/${encodeURIComponent(identity(data, position))}`
      if (seen.has(id)) throw new Error(`业务记录编号重复，未保存（${id}；字段：${Object.keys(data as object).join(',')}）。`)
      seen.add(id)
      result.push({ id, collection: `${key}/${group}`, value: { position, data } satisfies Entry })
    })
  }
  return result
}
function encode(key: string, rows: PcsStoredRecord[], seed?: string): string | null {
  const seedRows = seed ? decode(key, seed) : []
  // 旧版演示单使用随机编号；按已有业务触发标识排除同一演示单的新种子。
  const trigger = (row: Omit<PcsStoredRecord, 'version'>) => (row.value as { data?: { bulkProductionQualification?: { uniqueTriggerKey?: string } } } | null)?.data?.bulkProductionQualification?.uniqueTriggerKey
  const existingTriggers = new Set(rows.filter(row => row.id.startsWith(`${key}/`) && !row.deleted).map(trigger).filter(Boolean))
  const combined = new Map(seedRows.filter(row => !trigger(row) || !existingTriggers.has(trigger(row))).map(row => [row.id, row]))
  for (const row of rows.filter(row => row.id.startsWith(`${key}/`))) {
    if (row.deleted) combined.delete(row.id)
    else combined.set(row.id, row)
  }
  const metadata = combined.get(`${key}/meta`)?.value as { array: boolean; fields?: Record<string, unknown>; groups?: string[] } | undefined
  if (!metadata) return null
  const read = (group: string) => [...combined.values()].filter(row => row.collection === `${key}/${group}`)
    .map(row => row.value as Entry).sort((a, b) => a.position - b.position).map(row => row.data)
  return JSON.stringify(metadata.array ? read('items') : { ...metadata.fields, ...Object.fromEntries((metadata.groups || []).map(group => [group, read(group)])) })
}
function hydrateFileReferences(raw: string): string {
  if (!raw.includes('pcs-file:')) return raw
  return JSON.stringify(JSON.parse(raw, (_key, value: unknown) => {
    if (typeof value !== 'string' || !value.startsWith('pcs-file:')) return value
    const id = value.slice(9), blob = files.get(id)
    if (!blob) throw new Error('附件实体缺失，已保存数据未被替换。请从完整备份恢复。')
    return registerPcsFile(blob, id).url
  }))
}

async function transformFiles(value: unknown, hydrate: boolean): Promise<unknown> {
  if (typeof value === 'string') {
    if (hydrate && value.startsWith('pcs-file:')) {
      const id = value.slice(9), blob = files.get(id)
      if (!blob) throw new Error('附件实体缺失，已保存数据未被替换。请从完整备份恢复。')
      return registerPcsFile(blob, id).url
    }
    if (!hydrate && urlIds.has(value)) return `pcs-file:${urlIds.get(value)}`
    if (!hydrate && value.startsWith('data:')) {
      const blob = await (await fetch(value)).blob()
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const id = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
      files.set(id, blob)
      return `pcs-file:${id}`
    }
    if (!hydrate && value.startsWith('blob:')) throw new Error('附件尚未登记，未保存。请重新选择文件。')
    return value
  }
  if (Array.isArray(value)) return Promise.all(value.map(item => transformFiles(item, hydrate)))
  if (!hydrate && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (typeof record.dataUrl === 'string' && record.dataUrl.startsWith('data:') && typeof record.fileId === 'string') {
      const blob = await (await fetch(record.dataUrl)).blob()
      const previous = files.get(record.fileId)
      if (previous && (previous.type !== blob.type || await digestBlob(previous) !== await digestBlob(blob))) throw new Error('旧资料包含同编号不同内容附件，源数据已保留，请核对后重试。')
      files.set(record.fileId, blob)
      return { ...record, dataUrl: `pcs-file:${record.fileId}` }
    }
    if (typeof record.fileId === 'string' && typeof record.dataUrl === 'string' && record.dataUrl.startsWith('/')) {
      return { ...record, fileStorage: 'static' }
    }
  }
  if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await transformFiles(item, hydrate)])))
  return value
}
function notify(message: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pcs-storage-status', { detail: message }))
}
function sourceValue(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch (error) {
    if ((error as { name?: string })?.name === 'SecurityError') return null
    throw error
  }
}
async function migrateLegacy(): Promise<void> {
  const sources = [
    ...PCS_LEGACY_KEYS.flatMap(key => { const raw = sourceValue(key); return raw === null ? [] : [{ key, raw, legacyKey: key as string, legacyRaw: raw }] }),
    ...(fcsBridge?.enumerateLegacySlices() ?? []),
  ]
  for (const source of sources) {
    const { key, raw, legacyKey, legacyRaw } = source
    notify(`正在迁移本机资料：${sources.indexOf(source) + 1}/${sources.length}。请关闭旧版本标签页。`)
    const persisted = await transformFiles(key === 'higood-pcs-engineering-bom-pricing-plan-store-v2' ? parseEngineeringBomSnapshot(raw) : JSON.parse(raw), false)
    const rows = decode(key, JSON.stringify(persisted))
    for (let offset = 0; offset < rows.length; offset += 100) {
      const current = await readPcsRecords()
      const byId = new Map(current.records.map(row => [row.id, row]))
      const batch = rows.slice(offset, offset + 100)
      for (const saved of current.files) {
        const pending = files.get(saved.id)
        if (pending && batch.some(row => JSON.stringify(row.value).includes(`pcs-file:${saved.id}`)) && (saved.blob.type !== pending.type || await digestBlob(saved.blob) !== await digestBlob(pending))) throw new Error('迁移附件编号与已保存内容不一致，旧资料已保留。')
      }
      const conflicts = batch.filter(row => byId.has(row.id) && (byId.get(row.id)?.deleted || JSON.stringify(byId.get(row.id)?.value) !== JSON.stringify(row.value)))
      if (conflicts.length) throw new Error('旧资料与当前记录冲突，旧资料已保留。请导出备份后核对，未覆盖当前记录。')
      const puts = batch.filter(row => !byId.has(row.id)).map(row => ({ ...row, expectedVersion: 0 }))
      if (puts.length) await commitPcsRecords({ puts, deletes: [], files: [...files].filter(([id]) => !current.files.some(file => file.id === id)).map(([id, blob]) => ({ id, blob })), operationId: `migration:${key}:${offset}:${await digestText(JSON.stringify(batch))}`, intent: JSON.stringify(batch) })
      if (sourceValue(legacyKey) !== legacyRaw) throw new Error('旧页面正在修改资料，迁移已暂停。关闭旧标签页后重试，旧资料已保留。')
    }
    // 历史快照中已删除的静态记录也必须迁移，否则刷新会重新出现。
    const existingIds = new Set(rows.map(row => row.id))
    const beforeDeletions = await readPcsRecords()
    const persistedIds = new Set(beforeDeletions.records.map(row => row.id))
    const missingSeeds = baseline.has(key) ? decode(key, baseline.get(key)!).filter(row => !existingIds.has(row.id) && !persistedIds.has(row.id)) : []
    for (let offset = 0; offset < missingSeeds.length; offset += 100) {
      const deletes = missingSeeds.slice(offset, offset + 100).map(row => ({ id: row.id, expectedVersion: 0 }))
      await commitPcsRecords({ puts: [], deletes, operationId: `migration-deletions:${key}:${offset}:${await digestText(JSON.stringify(deletes))}`, intent: JSON.stringify(deletes) })
    }
    const readback = await readPcsRecords()
    if (rows.some(row => !readback.records.some(saved => saved.id === row.id && !saved.deleted && JSON.stringify(saved.value) === JSON.stringify(row.value)))) throw new Error('迁移读回校验未通过，旧资料已保留，请重试。')
    if (sourceValue(legacyKey) !== legacyRaw) throw new Error('旧资料已变化，未清理源数据。请关闭旧页面后重试。')
    // 保留旧源，用户明确关闭旧版本页面后再执行独立读回清理。
    notify('资料已复制并核对。请关闭旧版本标签页，再点击“完成旧资料清理”；清理前暂停保存。')
  }
}
async function hydrate(): Promise<void> {
  const snapshot = await readPcsRecords()
  stored = snapshot.records
  snapshot.files.forEach(file => files.set(file.id, file.blob))
  for (const key of keys) {
    // 未修改的静态集合直接读取已准备的基线，避免首次打开逐字段复制和异步遍历。
    if (!stored.some(row => row.id.startsWith(`${key}/`))) {
      snapshots.set(key, baseline.get(key) ?? '[]')
      continue
    }
    const raw = encode(key, stored, baseline.get(key))
    snapshots.set(key, raw !== null ? hydrateFileReferences(raw) : emptySnapshot(baseline.get(key)))
  }
  resets.forEach(reset => reset())
  fcsBridge?.hydrateDesignRevisionFcsCaches()
}
export async function ensurePcsRecordState(): Promise<void> {
  if (!ready) ready = (async () => {
    fcsBridge ??= await import('./fcs/design-revision-pcs-storage.ts')
    for (const key of fcsBridge.PCS_FCS_COLLECTIONS) { keys.add(key); if (!baseline.has(key)) baseline.set(key, '[]') }
    fcsBridge.configureDesignRevisionPcsStorage({ getItem: key => pcsRecordStore.getItem(key), setItem: (key, raw) => pcsRecordStore.setItem(key, raw), isStaging: () => staging })
    const { initializePcsRecordBaseline } = await import('./pcs-record-bootstrap.ts')
    await initializePcsRecordBaseline()
    await migrateLegacy()
    await hydrate()
    stale = false; failure = ''; notify('')
  })().catch(error => {
    ready = null; failure = error instanceof Error ? error.message : '本机业务数据无法读取，请重试。'; notify(failure); throw error
  })
  await ready
}
export async function retryPcsRecordState(): Promise<void> { ready = null; await ensurePcsRecordState() }

export async function runPcsRecordCommand<T>(recipe: () => T, operationId: string = crypto.randomUUID()): Promise<T> {
  await ensurePcsRecordState()
  try {
  if (saving) throw new Error('上一笔操作尚未保存，请等待完成后再操作。')
  if (stale) throw new Error('其他标签页已更新资料，本次未保存。请重新读取后再操作。')
  for (const key of PCS_LEGACY_KEYS) if (sourceValue(key) !== null) throw new Error('旧页面重新写入资料，本次未保存。请关闭旧页面后刷新并完成迁移。')
  if (fcsBridge?.enumerateLegacySlices().length) throw new Error('旧加工或交接资料尚未完成清理，请先关闭旧页面并核对迁移。')
  } catch (error) {
    failure = error instanceof Error ? error.message : '本次未保存，请重试。'
    notify(failure)
    throw error
  }
  const before = new Map(snapshots)
  const fcsBefore = fcsBridge?.captureDesignRevisionFcsCaches()
  const versions = new Map(stored.map(row => [row.id, row]))
  saving = true; staging = true; dirty.clear()
  try {
    const result = recipe()
    if (dirty.size && (result === false || (result && typeof result === 'object' && 'ok' in result && result.ok === false))) throw new Error((result && typeof result === 'object' && 'message' in result ? String(result.message) : '') || '操作条件不满足，本次修改未保存。')
    if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('请先读取文件，再执行保存动作。')
    const working = new Map(snapshots)
    const fcsAfter = fcsBridge?.captureDesignRevisionFcsCaches()
    staging = false
    snapshots.clear(); before.forEach((raw, key) => snapshots.set(key, raw)); resets.forEach(reset => reset()); if (fcsBefore) fcsBridge?.restoreDesignRevisionFcsCaches(fcsBefore)
    const puts: Array<Omit<PcsStoredRecord, 'version'> & { expectedVersion: number }> = []
    const deletes: Array<{ id: string; expectedVersion: number }> = []
    for (const key of dirty) {
      const oldRows = new Map(decode(key, before.get(key) || baseline.get(key) || '[]').map(row => [row.id, row]))
      const seedRows = new Map(decode(key, baseline.get(key) || '[]').map(row => [row.id, row]))
      // encode 后的数组下标不是持久排序值；已保存记录及静态基线才是位置来源。
      for (const row of oldRows.values()) {
        const value = row.value as Partial<Entry>
        if (typeof value?.position !== 'number') continue
        const persisted = versions.get(row.id)?.value as Partial<Entry> | undefined
        const seed = seedRows.get(row.id)?.value as Partial<Entry> | undefined
        row.value = { ...value, position: persisted?.position ?? seed?.position ?? value.position }
      }
      const nextRaw = working.get(key)
      const nextRows = nextRaw ? decode(key, nextRaw) : []
      for (const collection of new Set(nextRows.filter(row => typeof (row.value as Partial<Entry>)?.position === 'number').map(row => row.collection))) {
        const items = nextRows.filter(row => row.collection === collection)
        const previous = new Map([...oldRows.values()].filter(row => row.collection === collection).map(row => [row.id, (row.value as Entry).position]))
        const positions = assignPcsRecordPositions(items.map(row => row.id), previous)
        for (const row of items) row.value = { ...(row.value as Entry), position: positions.get(row.id)! }
      }
      const nextIds = new Set(nextRows.map(row => row.id))
      for (const row of nextRows) {
        if (JSON.stringify(oldRows.get(row.id)?.value) === JSON.stringify(row.value)) continue
        puts.push({ ...row, value: await transformFiles(row.value, false), expectedVersion: versions.get(row.id)?.version || 0 })
      }
      for (const row of oldRows.values()) if (!nextIds.has(row.id)) deletes.push({ id: row.id, expectedVersion: versions.get(row.id)?.version || 0 })
      // 没有元数据时仅保存结构，不复制未变更的演示记录。
      const meta = nextRows.find(row => row.id === `${key}/meta`)
      if (meta && !versions.has(meta.id) && !puts.some(row => row.id === meta.id)) puts.push({ ...meta, expectedVersion: 0 })
    }
    staging = false
    if (puts.length || deletes.length) {
      const persistedFiles = (await readPcsRecords()).files
      for (const saved of persistedFiles) { const pending = files.get(saved.id); if (pending && puts.some(row => JSON.stringify(row.value).includes(`pcs-file:${saved.id}`)) && (saved.blob.type !== pending.type || await digestBlob(saved.blob) !== await digestBlob(pending))) throw new Error('附件编号与已保存内容不一致，本次未保存；替换文件请使用新编号。') }
      const existingFiles = new Set(persistedFiles.map(file => file.id))
      const referencedFiles = [...files].filter(([id]) => !existingFiles.has(id) && puts.some(row => JSON.stringify(row.value).includes(`pcs-file:${id}`))).map(([id, blob]) => ({ id, blob }))
      await commitPcsRecords({ puts, deletes, files: referencedFiles, operationId, intent: JSON.stringify({ puts, deletes }) })
      // complete 已成功；不用后续读取故障把已提交动作报告为未保存。
      const nextStored = new Map(stored.map(row => [row.id, row]))
      puts.forEach(({ expectedVersion, ...row }) => nextStored.set(row.id, { ...row, version: expectedVersion + 1 }))
      deletes.forEach(row => nextStored.set(row.id, { id: row.id, collection: versions.get(row.id)?.collection || row.id.split('/items/')[0], value: null, version: row.expectedVersion + 1, deleted: true }))
      stored = [...nextStored.values()]
      try { if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('higood-pcs-records'); channel.postMessage({ clientId, operationId }); channel.close() } } catch { /* 跨标签通知不可用时，事务内版本校验仍防止覆盖。 */ }
    }
    snapshots.clear(); working.forEach((raw, key) => snapshots.set(key, raw))
    failure = ''
    if (fcsAfter) { try { fcsBridge?.restoreDesignRevisionFcsCaches(fcsAfter) } catch { stale = true; failure = '数据已保存，但加工页面暂时无法更新，请重新读取。'; notify(failure) } }
    for (const reset of resets) { try { reset() } catch { stale = true; failure = '数据已保存，但页面暂时无法更新，请重新读取。'; notify(failure) } }
    return result
  } catch (error) {
    snapshots.clear(); before.forEach((raw, key) => snapshots.set(key, raw)); resets.forEach(reset => reset()); if (fcsBefore) fcsBridge?.restoreDesignRevisionFcsCaches(fcsBefore)
    failure = error instanceof Error ? error.message : '本次未保存，请重试。'; notify(failure); throw error
  } finally { staging = false; saving = false; dirty.clear() }
}
if (typeof window !== 'undefined') {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('higood-pcs-records')
    channel.onmessage = event => { if (event.data?.clientId === clientId) return; stale = true; notify('其他标签页已更新资料，请重新读取后再保存。') }
    window.addEventListener('pagehide', () => channel.close(), { once: true })
  }
  window.addEventListener('storage', event => { if (event.key && keys.has(event.key) && event.newValue !== null) { stale = true; notify('检测到旧版本页面写入，请关闭旧页面并刷新迁移。') } })
  window.addEventListener('pagehide', () => { fileUrls.forEach(url => URL.revokeObjectURL(url)) }, { once: true })
}

async function digestText(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function finalizePcsLegacyMigration(oldPagesClosed: boolean): Promise<void> {
  if (!oldPagesClosed) throw new Error('请先关闭旧版本页面，迁移源数据仍保留。')
  const current = await readPcsRecords()
  for (const key of PCS_LEGACY_KEYS) {
    const raw = sourceValue(key)
    if (raw === null) continue
    const rows = decode(key, JSON.stringify(await transformFiles(key === 'higood-pcs-engineering-bom-pricing-plan-store-v2' ? parseEngineeringBomSnapshot(raw) : JSON.parse(raw), false)))
    if (rows.some(row => !current.records.some(saved => saved.id === row.id && !saved.deleted && JSON.stringify(saved.value) === JSON.stringify(row.value)))) throw new Error('旧源与目标核对不一致，未删除旧资料，请重试迁移。')
    for (const [id, blob] of files) {
      if (!rows.some(row => JSON.stringify(row.value).includes(`pcs-file:${id}`))) continue
      const saved = current.files.find(file => file.id === id)
      if (!saved || saved.blob.type !== blob.type || saved.blob.size !== blob.size || await digestBlob(saved.blob) !== await digestBlob(blob)) throw new Error('迁移附件校验未通过，旧资料已保留。')
    }
    const sourceIds = new Set(rows.map(row => row.id))
    const deletedSeedIds = baseline.has(key) ? decode(key, baseline.get(key)!).filter(row => !sourceIds.has(row.id)).map(row => row.id) : []
    if (deletedSeedIds.some(id => !current.records.some(row => row.id === id && row.deleted))) throw new Error('静态删除记录尚未迁移完整，旧资料已保留，请重新迁移后清理。')
    if (sourceValue(key) !== raw) throw new Error('旧页面仍在写入，未清理。')
    window.localStorage.removeItem(key)
  }
  const slices = fcsBridge?.enumerateLegacySlices() ?? []
  for (const slice of slices) {
    const rows = decode(slice.key, JSON.stringify(await transformFiles(JSON.parse(slice.raw), false)))
    if (rows.some(row => !current.records.some(saved => saved.id === row.id && !saved.deleted && JSON.stringify(saved.value) === JSON.stringify(row.value)))) throw new Error('加工及交接迁移读回不一致，旧资料已保留。')
    for (const [id, blob] of files) {
      if (!rows.some(row => JSON.stringify(row.value).includes(`pcs-file:${id}`))) continue
      const saved = current.files.find(file => file.id === id)
      if (!saved || saved.blob.type !== blob.type || await digestBlob(saved.blob) !== await digestBlob(blob)) throw new Error('加工附件核对未通过，旧资料已保留。')
    }
  }
  fcsBridge?.finalizeLegacySlices(slices)
  stale = false; failure = ''; notify('旧资料已核对并清理。')
}
export function hasPcsLegacyData(): boolean { return PCS_LEGACY_KEYS.some(key => sourceValue(key) !== null) || Boolean(fcsBridge?.enumerateLegacySlices().length) }

async function digestBlob(blob: Blob): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, "0")).join("") }
