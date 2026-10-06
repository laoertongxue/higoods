import { commitPcsRecords, commitPcsNewRecordGroups, readPcsRecords, readPcsFiles, pcsFileReferences, type PcsStoredRecord, type PcsMigrationReceipt } from './pcs-record-db.ts'
import { assignPcsRecordPositions } from './pcs-record-position.ts'
import { decodePcsRecordSnapshot as decode, encodePcsRecordSnapshot as encode, normalizePcsRecordSnapshot, equalPcsRecordValues, type PcsRecordEntry as Entry } from './pcs-record-codec.ts'
import { isPcsNewStaticRecord } from './pcs-record-static-versions.ts'

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
  'higood-pcs-config-workspace-store-v1', 'higood-pcs-exchange-rate-config-v1',
  'higood-pcs-material-config-v1', 'higood-pcs-material-archive-store-v2',
  'higood-pcs-channel-catalog-v1', 'higood-pcs-channel-store-v1',
  'higood-fcs-material-process-plans-v1',
] as const
const keys = new Set<string>(PCS_LEGACY_KEYS)
let fcsBridge: typeof import('./fcs/design-revision-pcs-storage.ts') | undefined
const snapshots = new Map<string, string>()
const baseline = new Map<string, string>()
const resets = new Set<() => void>()
const files = new Map<string, Blob>()
const persistedFileIds = new Set<string>()
const fileUrls = new Map<string, string>()
const urlIds = new Map<string, string>()
const collectionFailures = new Map<string, string>()
const migrationReceipts = new Map<string, PcsMigrationReceipt>()
const legacySources = new Map<string, LegacySource>()
interface LegacySource { key: string; raw: string; legacyKey: string; legacyRaw: string; auxiliary?: Record<string, string>; overlay?: boolean; recordSource?: string }
let stored: PcsStoredRecord[] = []
let ready: Promise<void> | null = null
let hydrationQueue: Promise<void> = Promise.resolve()
const loadedCollections = new Set<string>()
const hydratingCollections = new Set<string>()
let scopedReadsStarted = false
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
/** Business exports carry stable references, never session-only object URLs. */
export function getPcsDurableFileReference(url: string): string {
  const id = urlIds.get(url)
  if (id) return `pcs-file:${id}`
  if (url.startsWith('blob:') || url.startsWith('data:')) throw new Error('图片尚未登记为可复用文件，请重新保存图片后导出。')
  if (url.startsWith('pcs-file:') && !files.has(url.slice(9))) throw new Error('引用的图片文件不存在，请重新选择图片。')
  return url
}
/** Resolve a same-browser business reference without creating persistent data. */
export function resolvePcsFileReference(reference: string): string {
  if (reference.startsWith('blob:') || reference.startsWith('data:')) throw new Error('导入图片必须使用静态地址或已保存的文件引用。')
  if (!reference.startsWith('pcs-file:')) return reference
  const id = reference.slice(9), blob = files.get(id)
  if (!blob) throw new Error('引用的图片文件不存在，请在当前浏览器重新选择图片。')
  return registerPcsFile(blob, id).url
}
export function getPcsStorageFailure(): string { return failure }
export function getPcsStorageBusy(): boolean { return saving }
export function getPcsCollectionFailure(key: string): string { return collectionFailures.get(key) ?? '' }
export function assertPcsCollectionsReadable(collections: readonly string[]): void {
  for (const key of collections) { const message = collectionFailures.get(key); if (message) throw new Error(message) }
}

/** Discard only a not-yet-saved upload after its form is cancelled/replaced. */
export function releasePcsPendingFile(id: string): boolean {
  if (persistedFileIds.has(id)) return false
  const known = new Set(files.keys())
  const referenced = (value: unknown) => pcsFileReferences(value, known).has(id)
  if (stored.some(row => !row.deleted && referenced(row.value))) return false
  for (const raw of snapshots.values()) if (referenced(JSON.parse(raw)) || raw.includes(fileUrls.get(id) ?? '__no_file_url__')) return false
  const url = fileUrls.get(id)
  if (url) { URL.revokeObjectURL(url); fileUrls.delete(id); urlIds.delete(url) }
  return files.delete(id)
}

export const pcsRecordStore = {
  getItem(key: string): string | null {
    if (!demoDepth) {
      assertPcsCollectionsReadable([key])
      if (scopedReadsStarted && !loadedCollections.has(key) && !hydratingCollections.has(key)) throw new Error('当前页面所需资料尚未读取，请重新读取后重试。', { cause: { collection: key } })
    }
    return demoDepth ? baseline.get(key) ?? null : snapshots.get(key) ?? baseline.get(key) ?? null
  },
  setItem(key: string, raw: string): void {
    if (!keys.has(key)) throw new Error(`未登记的数据范围：${key}`)
    if (demoDepth > 0 || typeof window === 'undefined') {
      baseline.set(key, raw)
      if (!staging) snapshots.set(key, raw)
      return
    }
    if (!staging) throw new Error('本次修改尚未保存：请通过页面业务动作重试。')
    const parsed = JSON.parse(raw)
    const next = JSON.stringify(parsed, (_key, value) => {
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
/** Validate and hydrate attachment references during assembly, without parsing the
 * entire assembled collection a second time. The persisted rows stay unchanged. */
function hydrationSerializer(availableFiles: ReadonlySet<string>) {
  const missing = () => { throw new Error('当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。') }
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (value.charCodeAt(0) === 112 && value.startsWith('pcs-file:')) {
        const id = value.slice(9), blob = files.get(id)
        if (!availableFiles.has(id) || !blob) return missing()
        return registerPcsFile(blob, id).url
      }
      if ((value.charCodeAt(0) === 100 || value.charCodeAt(0) === 68) && /^data:.*;base64,/i.test(value)) throw new Error('PCS 附件必须以原始 Blob 保存，不能保存 Base64 文件。')
      return value
    }
    if (!value || typeof value !== 'object') return value
    if (value instanceof Blob) throw new Error('附件应保存在文件仓库中，原有资料已保留。')
    if (Array.isArray(value)) {
      let next: unknown[] | undefined
      for (let index = 0; index < value.length; index++) {
        const original = value[index], child = visit(original)
        if (child !== original) { next ??= value.slice(); next[index] = child }
      }
      return next ?? value
    }
    const object = value as Record<string, unknown>
    if (typeof object.fileId === 'string' && object.fileId && !(object.fileStorage === 'static' && typeof object.dataUrl === 'string' && object.dataUrl.startsWith('/')) && !availableFiles.has(object.fileId)) return missing()
    // Copy only branches containing hydrated URLs. The common no-attachment
    // case uses native serialization, avoiding a replacer call for every field.
    let next: Record<string, unknown> | null = null
    for (const key in object) {
      if (!Object.hasOwn(object, key)) continue
      const original = object[key]
      // Number/boolean/null fields have neither attachment bytes nor references.
      if (original === null || (typeof original !== 'object' && typeof original !== 'string')) continue
      if (typeof original === 'string') {
        const first = original.charCodeAt(0)
        if (first !== 112 && first !== 100 && first !== 68) continue
      }
      const child = visit(original)
      if (child !== original) {
        next ??= { ...object }
        next[key] = child
      }
    }
    return next ?? value
  }
  return (data: unknown): string => JSON.stringify(visit(data))
}
function hydrateFileReferences(raw: string, availableFiles: ReadonlySet<string> = new Set(files.keys())): string {
  if (!raw.includes('pcs-file:') && !raw.includes('"fileId"')) return raw
  const parsed = JSON.parse(raw)
  for (const id of pcsFileReferences(parsed)) if (!availableFiles.has(id)) throw new Error('当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。')
  return JSON.stringify(parsed, (_key, value: unknown) => {
    if (typeof value !== 'string' || !value.startsWith('pcs-file:')) return value
    const id = value.slice(9), blob = files.get(id)
    if (!blob) throw new Error('当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。')
    return registerPcsFile(blob, id).url
  })
}

async function transformFiles(value: unknown, hydrate: boolean): Promise<unknown> {
  if (typeof value === 'string') {
    if (hydrate && value.startsWith('pcs-file:')) {
      const id = value.slice(9), blob = files.get(id)
      if (!blob) throw new Error('当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。')
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
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(key) } catch (error) {
    if ((error as { name?: string })?.name === 'SecurityError') return null
    throw error
  }
}
function collectionFailure(key: string, error: unknown): void {
  collectionFailures.set(key, error instanceof Error ? error.message : '当前资料无法读取，请重新读取。')
}
function collectLegacySources(collections: ReadonlySet<string>): LegacySource[] {
  const sources = PCS_LEGACY_KEYS.filter(key => collections.has(key)).flatMap(key => {
    try { const raw = sourceValue(key); return raw === null ? [] : [{ key, raw, legacyKey: key as string, legacyRaw: raw }] }
    catch (error) { collectionFailure(key, error); return [] }
  })
  if (!fcsBridge?.PCS_FCS_COLLECTIONS.some(key => collections.has(key))) return sources
  try { return [...sources, ...(fcsBridge.enumerateLegacySlices() ?? [])] }
  catch (error) { for (const key of fcsBridge?.PCS_FCS_COLLECTIONS ?? []) collectionFailure(key, error); return sources }
}
function assertLegacySourceUnchanged(source: LegacySource): void {
  if (!source.recordSource && sourceValue(source.legacyKey) !== source.legacyRaw) throw new Error('旧版本页面已修改当前资料，本次未保存。请关闭旧页面后重新读取。')
  for (const [key, raw] of Object.entries(source.auxiliary ?? {})) if (sourceValue(key) !== raw) throw new Error('旧版本页面已修改当前备注，本次未保存。请关闭旧页面后重新读取。')
}
async function assertLegacySourceCurrent(source: LegacySource): Promise<void> {
  assertLegacySourceUnchanged(source)
  if (!source.recordSource) return
  const rows = (await readPcsRecords()).records.filter(row => row.id.startsWith(`${source.recordSource}/`))
  if (encode(source.recordSource, rows, baseline.get(source.recordSource)) !== source.legacyRaw) throw new Error('旧版本页面已修改渠道资料，本次未保存。请关闭旧页面后重新读取。')
}
async function persistedLegacyRows(source: LegacySource): Promise<Array<Omit<PcsStoredRecord, 'version'>>> {
  const rows = decode(source.key, JSON.stringify(await transformFiles(normalizePcsRecordSnapshot(source.key, source.raw), false)))
  if (!source.overlay) return rows
  const existing = new Map(stored.map(row => [row.id, row]))
  for (const row of rows) {
    const before = existing.get(row.id)?.value as Partial<Entry> | undefined
    if (typeof before?.position === 'number' && typeof (row.value as Partial<Entry>)?.position === 'number') row.value = { ...(row.value as Entry), position: before.position }
  }
  const seeds = new Map(decode(source.key, baseline.get(source.key) || '{}').map(row => [row.id, JSON.stringify(row.value)]))
  return rows.filter(row => row.id.endsWith('/meta') || seeds.get(row.id) !== JSON.stringify(row.value))
}

/** An explicit upgrade phase. Ordinary reads never call this function or write records. */
export async function upgradePcsLegacyRecords(collections: readonly string[]): Promise<void> {
  const requested = new Set(collections)
  for (const key of collections) {
    const source = legacySources.get(key)
    if (source?.overlay) for (const related of legacySources.values()) if (related.legacyKey === source.legacyKey) requested.add(related.key)
  }
  for (const key of requested) {
    const source = legacySources.get(key)
    if (!source) continue
    await assertLegacySourceCurrent(source)
    const sourceDigest = await digestText(source.raw)
    const receipt = migrationReceipts.get(key)
    if (receipt?.legacyKey === source.legacyKey && receipt.legacyDigest === await digestText(source.legacyRaw)) continue
    if (receipt) throw new Error('旧资料在完成核对后又有变化，原资料已保留。请核对当前资料后重试。')
    const rows = await persistedLegacyRows(source)
    const current = await readPcsRecords()
    const byId = new Map(current.records.map(row => [row.id, row]))
    for (const row of rows) {
      const previous = byId.get(row.id)
      if (previous && (previous.deleted || !equalPcsRecordValues(previous, row, current.records, rows))) throw new Error('旧资料与当前记录不一致，原资料已保留，未覆盖当前记录。')
    }
    const requiredFiles = new Set(rows.flatMap(row => [...pcsFileReferences(row.value)]))
    for (const id of requiredFiles) {
      const pending = files.get(id), saved = current.files.find(file => file.id === id)
      if (!pending && !saved) throw new Error('当前资料的附件文件缺失，原有记录已保留。请核对附件后重新读取。')
      if (pending && saved && (pending.type !== saved.blob.type || await digestBlob(pending) !== await digestBlob(saved.blob))) throw new Error('旧资料附件编号与已保存内容不一致，原资料已保留。')
    }
    // Independent batches are resumable. A failure cannot remove or overwrite their source.
    for (let offset = 0; offset < rows.length; offset += 100) {
      await assertLegacySourceCurrent(source)
      const batch = rows.slice(offset, offset + 100)
      const puts = batch.filter(row => !byId.has(row.id)).map(row => ({ ...row, expectedVersion: 0 }))
      const batchFiles = new Set(batch.flatMap(row => [...pcsFileReferences(row.value)]))
      const newFiles = [...batchFiles].filter(id => !current.files.some(file => file.id === id)).map(id => ({ id, blob: files.get(id)! }))
      if (puts.length || newFiles.length) {
        await commitPcsRecords({ puts, deletes: [], files: newFiles, operationId: `migration:${key}:${offset}:${sourceDigest}`, intent: JSON.stringify(batch) })
        current.files.push(...newFiles)
      }
    }
    const sourceIds = new Set(rows.map(row => row.id))
    const readback = await readPcsRecords()
    const readbackIds = new Set(readback.records.map(row => row.id))
    const missingSeeds = !source.overlay && baseline.has(key) ? decode(key, baseline.get(key)!).filter(row => !sourceIds.has(row.id) && !readbackIds.has(row.id) && !isPcsNewStaticRecord(row.id)) : []
    for (let offset = 0; offset < missingSeeds.length; offset += 100) {
      const deletes = missingSeeds.slice(offset, offset + 100).map(row => ({ id: row.id, expectedVersion: 0 }))
      await commitPcsRecords({ puts: [], deletes, operationId: `migration-deletions:${key}:${offset}:${sourceDigest}`, intent: JSON.stringify(deletes) })
    }
    const verified = await readPcsRecords()
    verified.files.forEach(file => persistedFileIds.add(file.id))
    const verifiedRows = new Map(verified.records.map(row => [row.id, row]))
    if (rows.some(row => { const saved = verifiedRows.get(row.id); return !saved || saved.deleted || !equalPcsRecordValues(saved, row, verified.records, rows) })) throw new Error('旧资料读回核对未通过，原资料已保留，请重试。')
    for (const id of requiredFiles) {
      const saved = verified.files.find(file => file.id === id), original = files.get(id)
      if (!saved || !original || saved.blob.type !== original.type || await digestBlob(saved.blob) !== await digestBlob(original)) throw new Error('旧资料附件读回核对未通过，原资料已保留。')
    }
    await assertLegacySourceCurrent(source)
    const nextReceipt: PcsMigrationReceipt = { id: key, sourceDigest, legacyKey: source.legacyKey, legacyDigest: await digestText(source.legacyRaw), recordIds: [...sourceIds, ...missingSeeds.map(row => row.id)], completedAt: new Date().toISOString() }
    await commitPcsRecords({ puts: [], deletes: [], migrationReceipts: [nextReceipt], operationId: `migration-verified:${key}:${sourceDigest}`, intent: JSON.stringify({ key, sourceDigest }) })
    migrationReceipts.set(key, nextReceipt)
    // The retained source is never replayed after this verified receipt, even after a refresh.
    stored = (await readPcsRecords()).records
  }
}

async function hydrate(collections: readonly string[], snapshot?: Awaited<ReturnType<typeof readPcsRecords>>): Promise<void> {
  const requested = new Set(collections)
  snapshot ??= await readPcsRecords(collections)
  stored = [...stored.filter(row => !requested.has(row.id.split('/')[0])), ...snapshot.records]
  for (const key of requested) { collectionFailures.delete(key); legacySources.delete(key); migrationReceipts.delete(key) }
  snapshot.migrations.forEach(receipt => migrationReceipts.set(receipt.id, receipt))
  snapshot.files.forEach(file => persistedFileIds.add(file.id))
  snapshot.files.forEach(file => files.set(file.id, file.blob))
  const availableFiles = new Set(snapshot.files.map(file => file.id))
  const grouped = new Map<string, PcsStoredRecord[]>()
  for (const row of stored) { const key = row.id.split('/')[0]; const values = grouped.get(key) ?? []; values.push(row); grouped.set(key, values) }
  for (const key of requested) {
    try {
      const rows = grouped.get(key) ?? []
      const raw = rows.length ? encode(key, rows, baseline.get(key), undefined, hydrationSerializer(availableFiles)) : baseline.get(key) ?? '[]'
      snapshots.set(key, raw !== null ? raw : emptySnapshot(baseline.get(key)))
    } catch (error) { collectionFailure(key, error); snapshots.delete(key) }
  }
  for (const source of collectLegacySources(requested)) {
    legacySources.set(source.key, source)
    try {
      const receipt = migrationReceipts.get(source.key)
      if (receipt) {
        if (receipt.legacyDigest !== await digestText(source.legacyRaw)) throw new Error('旧版本页面已改动已核对资料，当前资料暂时无法读取。请关闭旧页面并核对后重新读取。')
        continue
      }
      const beforeLegacyFiles = new Map(files)
      const rows = await persistedLegacyRows(source)
      const referencedFiles = new Set(rows.flatMap(row => [...pcsFileReferences(row.value)]))
      const convertedFiles = [...referencedFiles].filter(id => files.has(id) && beforeLegacyFiles.get(id) !== files.get(id))
      const legacyFiles = await readPcsFiles([...referencedFiles].filter(id => !availableFiles.has(id)))
      for (const file of legacyFiles) { files.set(file.id, file.blob); persistedFileIds.add(file.id); availableFiles.add(file.id) }
      const previous = grouped.get(source.key) ?? []
      const sourceById = new Map(rows.map(row => [row.id, row]))
      for (const saved of previous) {
        const origin = sourceById.get(saved.id)
        if (origin && (saved.deleted || !equalPcsRecordValues(saved, origin, previous, rows))) throw new Error('旧资料与当前记录不一致，原有资料已保留。请核对后重新读取。')
      }
      // The old source is complete only for its original static version. Add
      // explicitly registered new demo IDs; keep old omissions and IDB tombstones.
      const raw = encode(source.key, [...rows.map(row => ({ ...row, version: 0 })), ...previous], baseline.get(source.key), isPcsNewStaticRecord)
      if (raw !== null) snapshots.set(source.key, hydrateFileReferences(raw, new Set([...availableFiles, ...convertedFiles])))
      collectionFailures.delete(source.key)
    } catch (error) { collectionFailure(source.key, error); snapshots.delete(source.key) }
  }
  if (requested.has('higood-pcs-channel-catalog-v1') || requested.has('higood-pcs-channel-store-v1')) await hydrateLegacyChannelCatalog(grouped)
  resets.forEach(reset => reset())
  try { if (fcsBridge?.PCS_FCS_COLLECTIONS.some(key => requested.has(key))) fcsBridge.hydrateDesignRevisionFcsCaches() }
  catch (error) { for (const key of fcsBridge?.PCS_FCS_COLLECTIONS ?? []) collectionFailure(key, error) }
}

/** 旧渠道实例承接到新模型的只读投影；实际升级只在相关保存前执行。 */
async function hydrateLegacyChannelCatalog(grouped: Map<string, PcsStoredRecord[]>): Promise<void> {
  const sourceKey = 'higood-pcs-project-channel-product-store-v2'
  const storeKey = 'higood-pcs-channel-store-v1', catalogKey = 'higood-pcs-channel-catalog-v1'
  const local = legacySources.get(sourceKey)
  const recordRaw = grouped.has(sourceKey) ? encode(sourceKey, grouped.get(sourceKey)!, baseline.get(sourceKey)) : null
  const sourceRaw = local?.raw || recordRaw
  if (!sourceRaw) return
  try {
    assertPcsCollectionsReadable([storeKey, catalogKey, 'higood-pcs-sku-archive-store-v1', 'higood-pcs-style-archive-store-v3'])
    if (collectionFailures.has(sourceKey)) throw new Error(collectionFailures.get(sourceKey))
    const { convertLegacyChannelSnapshot } = await import('./pcs-channel-legacy-conversion.ts')
    const legacyKey = local?.legacyKey || `idb:${sourceKey}`
    const legacyRaw = local?.legacyRaw || recordRaw!
    const input = (key: string) => JSON.parse(snapshots.get(key) || baseline.get(key) || '{}')
    const converted = convertLegacyChannelSnapshot(sourceRaw, input(storeKey), input(catalogKey), input('higood-pcs-sku-archive-store-v1').records || [], input('higood-pcs-style-archive-store-v3').records || [])
    for (const [key, value] of [[storeKey, converted.storeSnapshot], [catalogKey, converted.catalogSnapshot]] as const) {
      if (legacySources.has(key)) throw new Error('存在两份渠道旧源，原资料已保留，请核对来源后重新读取。')
      const source: LegacySource = { key, raw: JSON.stringify(value), legacyKey, legacyRaw, overlay: true, ...(local ? {} : { recordSource: sourceKey }) }
      legacySources.set(key, source)
      const receipt = migrationReceipts.get(key)
      if (receipt) {
        if (receipt.legacyKey !== legacyKey || receipt.legacyDigest !== await digestText(legacyRaw)) throw new Error('旧渠道资料在核对后发生变化，原资料已保留。请关闭旧页面后重新读取。')
        continue
      }
      const rows = await persistedLegacyRows(source)
      const previous = grouped.get(key) || []
      const byId = new Map(rows.map(row => [row.id, row]))
      for (const row of previous) if (byId.has(row.id) && (row.deleted || JSON.stringify(row.value) !== JSON.stringify(byId.get(row.id)!.value))) throw new Error('历史渠道资料与当前渠道记录冲突，未覆盖任何已有记录。')
      const raw = encode(key, rows.map(row => ({ ...row, version: 0 })), baseline.get(key))
      if (raw) snapshots.set(key, hydrateFileReferences(raw))
    }
  } catch (error) {
    collectionFailure(storeKey, error); collectionFailure(catalogKey, error)
  }
}
async function preparePcsRecordState(collections: readonly string[]): Promise<void> {
  if (!ready) ready = (async () => {
    const { initializePcsRecordBaseline } = await import('./pcs-record-bootstrap.ts')
    await initializePcsRecordBaseline()
  })().catch(error => {
    ready = null; failure = error instanceof Error ? error.message : '本机业务数据无法读取，请重试。'; notify(failure); throw error
  })
  const baselineReady = ready
  const next = hydrationQueue.then(async () => {
    if (!collections.length || collections.some(key => key.startsWith('higood-pcs-fcs-'))) {
      await baselineReady
      fcsBridge ??= await import('./fcs/design-revision-pcs-storage.ts')
      for (const key of fcsBridge.PCS_FCS_COLLECTIONS) { keys.add(key); if (!baseline.has(key)) baseline.set(key, '[]') }
      fcsBridge.configureDesignRevisionPcsStorage({ getItem: key => pcsRecordStore.getItem(key), setItem: (key, raw) => pcsRecordStore.setItem(key, raw), isStaging: () => staging })
    }
    const requested = new Set(collections.length ? collections : keys)
    // Legacy channel conversion depends on canonical SKU/SPU identity; load the
    // complete dependency set together before exposing either channel view.
    if (requested.has('higood-pcs-channel-catalog-v1') || requested.has('higood-pcs-channel-store-v1')) {
      for (const key of ['higood-pcs-channel-catalog-v1', 'higood-pcs-channel-store-v1', 'higood-pcs-project-channel-product-store-v2', 'higood-pcs-style-archive-store-v3', 'higood-pcs-sku-archive-store-v1']) requested.add(key)
    }
    if (fcsBridge?.PCS_FCS_COLLECTIONS.some(key => requested.has(key))) for (const key of fcsBridge.PCS_FCS_COLLECTIONS) requested.add(key)
    for (const key of requested) if (!keys.has(key)) throw new Error(`未登记的数据范围：${key}`)
    const needed = [...requested].filter(key => !loadedCollections.has(key))
    if (!needed.length) { await baselineReady; return }
    scopedReadsStarted = true
    needed.forEach(key => hydratingCollections.add(key))
    try {
      // Both operations are read-only and independent. Assemble the visible
      // snapshot only after the published baseline AND saved records are ready.
      const [, snapshot] = await Promise.all([baselineReady, readPcsRecords(needed)])
      await hydrate(needed, snapshot)
      needed.forEach(key => loadedCollections.add(key))
      failure = ''; notify('')
    } finally { needed.forEach(key => hydratingCollections.delete(key)) }
  })
  hydrationQueue = next.catch(() => undefined)
  try { await next } catch (error) {
    failure = error instanceof Error ? error.message : '本机业务数据无法读取，请重试。'; notify(failure); throw error
  }
}
/** An explicit collection list reads only those records and their dependencies.
 * Existing callers without a scope still prepare all collections before writes.
 */
export async function ensurePcsRecordState(collections: readonly string[] = []): Promise<void> {
  await preparePcsRecordState(collections)
  assertPcsCollectionsReadable(collections)
}
export async function retryPcsRecordState(): Promise<void> {
  await hydrationQueue
  const requested = [...loadedCollections]
  loadedCollections.clear()
  await preparePcsRecordState(requested)
  stale = false
}

export interface PcsRecordInsertGroup<T> { operationId: string; snapshot: object; result: T }
/** CSV imports can only reuse saved files. No Blob conversion or asynchronous
 * file read belongs here; walking plain fields must not create a promise each. */
function importFileReferences(value: unknown): unknown {
  if (typeof value === 'string') {
    const id = urlIds.get(value)
    if (id) return `pcs-file:${id}`
    if (/^(data|blob):/i.test(value)) throw new Error('导入引用的附件尚未保存，请先保存附件后重试。')
    return value
  }
  if (value instanceof Blob) throw new Error('导入只能复用已保存的文件引用。')
  if (Array.isArray(value)) return value.map(importFileReferences)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) result[key] = importFileReferences(item)
    if (typeof result.fileId === 'string' && typeof result.dataUrl === 'string' && result.dataUrl.startsWith('/')) result.fileStorage = 'static'
    return result
  }
  return value
}
/** Import independent new parent groups. Every group is saved atomically;
 * assemble the visible collection once from the successful groups. */
export async function insertPcsRecordGroups<T>(key: string, prepare: () => PcsRecordInsertGroup<T>[]): Promise<Array<{ ok: true; result: T } | { ok: false; message: string }>> {
  await ensurePcsRecordState([key])
  if (saving) throw new Error('上一笔操作尚未保存，请等待完成后再操作。')
  if (stale) throw new Error('其他标签页已更新资料，本次未保存。请重新读取后再操作。')
  assertPcsCollectionsReadable([key])
  saving = true
  try {
    const source = legacySources.get(key)
    if (source) await assertLegacySourceCurrent(source)
    else if (sourceValue(key) !== null) throw new Error('旧版本页面写入了当前资料，本次未保存。请关闭旧页面后重新读取。')
    await upgradePcsLegacyRecords([key])
    const currentRaw = snapshots.get(key) || baseline.get(key) || '{}'
    const currentRows = decode(key, currentRaw)
    const ids = new Set(currentRows.map(row => row.id))
    const minimum = new Map<string, number>()
    const saved = new Map(stored.map(row => [row.id, row]))
    for (const row of currentRows) {
      const position = (saved.get(row.id)?.value as Entry | undefined)?.position ?? (row.value as Entry).position
      if (Number.isFinite(position)) {
        row.value = { ...(row.value as Entry), position }
        minimum.set(row.collection, Math.min(minimum.get(row.collection) ?? 0, position))
      }
    }
    const groups = prepare()
    const prepared = groups.map(group => {
      const rows = decode(key, JSON.stringify(group.snapshot)).filter(row => row.id !== `${key}/meta`)
      for (const row of rows) {
        if (ids.has(row.id)) throw new Error('导入记录已经存在，请重新校验文件。')
        ids.add(row.id)
      }
      // Positions are allocated per group before any asynchronous file work.
      for (const collection of new Set(rows.map(row => row.collection))) {
        const entries = rows.filter(row => row.collection === collection)
        const start = (minimum.get(collection) ?? 0) - entries.length
        entries.forEach((row, offset) => { row.value = { ...(row.value as Entry), position: start + offset } })
        minimum.set(collection, start)
      }
      const puts = rows.map(row => ({ ...row, value: importFileReferences(row.value), expectedVersion: 0 }))
      // Business CSVs reference already saved files; they never introduce bytes.
      const required = new Set(puts.flatMap(row => [...pcsFileReferences(row.value)]))
      for (const id of required) if (!persistedFileIds.has(id)) throw new Error('导入引用的附件尚未保存，请先保存附件后重试。')
      return { group, puts }
    })
    const committed = await commitPcsNewRecordGroups(prepared.map(({ group, puts }) => ({ puts, deletes: [], operationId: group.operationId, intent: JSON.stringify({ puts, deletes: [] }) })))
    const outcomes = prepared.map(({ group, puts }, index) => {
      const outcome = committed[index]
      if (outcome.ok) {
        for (const { expectedVersion: _, ...row } of puts) saved.set(row.id, { ...row, version: 1 })
        return { ok: true as const, result: group.result }
      }
      return outcome
    })
    stored = [...saved.values()]
    // Include the current visible records (including static omissions/overrides),
    // then overlay only transactions that actually completed.
    const merged = new Map(currentRows.map(row => [row.id, { ...row, version: saved.get(row.id)?.version ?? 0 }]))
    prepared.forEach(({ puts }, index) => { if (outcomes[index].ok) puts.forEach(row => merged.set(row.id, saved.get(row.id)!)) })
    const raw = encode(key, [...merged.values()], undefined, undefined, hydrationSerializer(new Set(files.keys())))
    if (raw !== null) snapshots.set(key, raw)
    resets.forEach(reset => reset())
    if (outcomes.some(row => row.ok)) {
      try { const channel = new BroadcastChannel('higood-pcs-records'); channel.postMessage({ clientId, operationId: groups[0]?.operationId }); channel.close() } catch { /* Record versions remain authoritative. */ }
    }
    failure = ''
    return outcomes
  } finally { saving = false }
}

export async function runPcsRecordCommand<T>(recipe: () => T, operationId: string = crypto.randomUUID()): Promise<T> {
  await ensurePcsRecordState()
  try {
  if (saving) throw new Error('上一笔操作尚未保存，请等待完成后再操作。')
  if (stale) throw new Error('其他标签页已更新资料，本次未保存。请重新读取后再操作。')
  } catch (error) {
    failure = error instanceof Error ? error.message : '本次未保存，请重试。'
    notify(failure)
    throw error
  }
  const before = new Map(snapshots)
  const fcsBefore = fcsBridge?.captureDesignRevisionFcsCaches()
  let versions = new Map(stored.map(row => [row.id, row]))
  saving = true; staging = true; dirty.clear()
  try {
    const result = recipe()
    if (dirty.size && (result === false || (result && typeof result === 'object' && 'ok' in result && result.ok === false))) throw new Error((result && typeof result === 'object' && 'message' in result ? String(result.message) : '') || '操作条件不满足，本次修改未保存。')
    if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('请先读取文件，再执行保存动作。')
    const working = new Map(snapshots)
    const fcsAfter = fcsBridge?.captureDesignRevisionFcsCaches()
    staging = false
    snapshots.clear(); before.forEach((raw, key) => snapshots.set(key, raw)); resets.forEach(reset => reset()); if (fcsBefore) fcsBridge?.restoreDesignRevisionFcsCaches(fcsBefore)
    assertPcsCollectionsReadable([...dirty])
    for (const key of dirty) {
      const source = legacySources.get(key)
      if (source) assertLegacySourceUnchanged(source)
      else if (keys.has(key) && sourceValue(key) !== null) throw new Error('旧版本页面写入了当前资料，本次未保存。请关闭旧页面后重新读取。')
    }
    await upgradePcsLegacyRecords([...dirty])
    versions = new Map(stored.map(row => [row.id, row]))
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
      const requiredFiles = new Set(puts.flatMap(row => [...pcsFileReferences(row.value)]))
      const persistedFiles = await readPcsFiles([...requiredFiles])
      for (const saved of persistedFiles) { const pending = files.get(saved.id); if (pending && (saved.blob.type !== pending.type || await digestBlob(saved.blob) !== await digestBlob(pending))) throw new Error('附件编号与已保存内容不一致，本次未保存；替换文件请使用新编号。') }
      const existingFiles = new Set(persistedFiles.map(file => file.id))
      const referencedFiles = [...files].filter(([id]) => !existingFiles.has(id) && requiredFiles.has(id)).map(([id, blob]) => ({ id, blob }))
      for (const key of dirty) { const source = legacySources.get(key); if (source) await assertLegacySourceCurrent(source) }
      await commitPcsRecords({ puts, deletes, files: referencedFiles, operationId, intent: JSON.stringify({ puts, deletes }) })
      referencedFiles.forEach(file => persistedFileIds.add(file.id))
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
  window.addEventListener('storage', event => {
    if (!event.key || event.newValue === null) return
    const affected = [...keys].filter(key => key === event.key || legacySources.get(key)?.legacyKey === event.key)
    for (const key of affected) collectionFailures.set(key, '旧版本页面已修改当前资料，请关闭旧页面后重新读取。')
  })
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
    const rows = decode(key, JSON.stringify(await transformFiles(normalizePcsRecordSnapshot(key, raw), false)))
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
