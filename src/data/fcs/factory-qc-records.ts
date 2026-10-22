import { commitPcsRecords, readPcsRecords, readPcsFiles, cleanupUnreferencedPcsFiles, type PcsStoredRecord, type PcsStoredFile } from '../pcs-record-db.ts'
import { PCS_FCS_COLLECTIONS, captureDesignRevisionFcsCaches, restoreDesignRevisionFcsCaches, hydrateDesignRevisionFcsCaches } from './design-revision-pcs-storage.ts'
import { FACTORY_PROCESS_KEYS, factoryProcessSnapshots, splitFactoryProcessLedger, rebuildFactoryProcessLedger, registerFactoryProcessStorage, withFactoryProcessStaticRead, type ProcessLedgerRow } from './factory-process-storage.ts'
import { emptyFactoryQcState, type FactoryQcState, type FactoryQcOrder, type FactoryQcRoll } from './factory-qc-model.ts'
import { RETIRED_WASHING_COLLECTIONS, stripRetiredWashingFacts, hasRetiredWashingFacts } from './legacy-washing-removal.ts'
import { parsePrintExecution, serializePrintExecution } from './printing-execution-storage.ts'
import { removeRetiredTechnicalProcessContent } from '../pcs-technical-data-demo-projection.ts'

export const QC_COLLECTION = 'fcs.factory-qc.v1'
export const HAND_FEEL_COLLECTION = 'fcs.stenter-handfeel.v1'
export const PROCESS_COLLECTION = 'fcs.factory-qc.process-records.v1'
const RETIRED = RETIRED_WASHING_COLLECTIONS
const TECHNICAL_COLLECTION = 'higood-pcs-technical-data-version-store-v5'
let retirementChecked = false
type ProcessRow = ProcessLedgerRow & { legacyKey: string; deleted?: boolean }
let records = new Map<string, PcsStoredRecord>(), staged: Map<string, PcsStoredRecord> | undefined
let loaded = false, saving = false, recipeActive = false, readFailure = ''
let files = new Map<string, Blob>()
const urls = new Map<string, string>(), rawStage = new Map<string, string>()
let baseline = new Map<string, string>()
const adoptions = new Map<string, { raw: string; rows: ProcessLedgerRow[] }>()
const processId = (key: string, row: ProcessLedgerRow) => PROCESS_COLLECTION + '/' + encodeURIComponent(key) + '/' + encodeURIComponent(row.path + '/' + row.key)
const current = () => staged ?? records
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('higood-factory-qc-v1') : undefined
channel?.addEventListener('message', () => { loaded = false })
function hydrateValue<T>(value: T): T {
  if (typeof value === 'string' && value.startsWith('pcs-file:')) return factoryQcPhotoUrl(value.slice(9)) as T
  if (Array.isArray(value)) return value.map(hydrateValue) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateValue(item)])) as T
  return value
}
const processRows = (key: string) => [...current().values()].filter(row => row.collection === PROCESS_COLLECTION && !row.deleted).map(row => hydrateValue(row.value as ProcessRow)).filter(row => row.legacyKey === key)
registerFactoryProcessStorage({
  read(key, raw) { return rawStage.get(key) ?? rebuildFactoryProcessLedger(raw, processRows(key)) },
  owns(target) { const text = JSON.stringify(target ?? ''); return [...current().values()].some(row => row.collection === PROCESS_COLLECTION && text.includes((row.value as ProcessRow).key)) },
  write(key, raw, previous) {
    if (!FACTORY_PROCESS_KEYS.includes(key)) return { handled: false }
    const adopted = processRows(key)
    if (!recipeActive) {
      const next = new Map(splitFactoryProcessLedger(raw).map(row => [row.path + '/' + row.key, row]))
      for (const row of adopted) if (JSON.stringify(next.get(row.path + '/' + row.key)?.value) !== JSON.stringify(row.value) && !row.deleted) throw new Error('本加工记录已按记录保存，请通过业务动作提交，或刷新旧页面。')
      return { handled: false, raw: adopted.length ? rebuildFactoryProcessLedger(raw, adopted.map(row => ({ ...row, deleted: true })))! : raw }
    }
    const before = new Map(splitFactoryProcessLedger(rebuildFactoryProcessLedger(baseline.get(key) ?? previous, adopted)).map(row => [row.path + '/' + row.key, row]))
    const next = new Map(splitFactoryProcessLedger(raw).map(row => [row.path + '/' + row.key, row]))
    for (const [id, row] of next) if (JSON.stringify(before.get(id)) !== JSON.stringify(row)) staged!.set(processId(key, row), { id: processId(key, row), collection: PROCESS_COLLECTION, version: records.get(processId(key, row))?.version ?? 0, value: { ...row, legacyKey: key } })
    for (const [id, row] of before) if (!next.has(id)) staged!.set(processId(key, row), { id: processId(key, row), collection: PROCESS_COLLECTION, version: records.get(processId(key, row))?.version ?? 0, value: { ...row, legacyKey: key, deleted: true } })
    rawStage.set(key, raw)
    return { handled: true }
  },
})
export function factoryQcPhotoUrl(id: string): string {
  const blob = files.get(id)
  if (!blob) return ''
  if (!urls.has(id)) urls.set(id, URL.createObjectURL(blob))
  return urls.get(id)!
}
export function readFactoryQcState(): FactoryQcState {
  if (readFailure) throw new Error(readFailure)
  const state = emptyFactoryQcState(), pendingRolls: Array<{ qcId: string; roll: FactoryQcRoll }> = []
  for (const row of current().values()) {
    if (row.deleted) continue
    const value = row.value as { kind: string; data: any; qcId?: string }
    if (row.collection === QC_COLLECTION) {
      if (value.kind === 'qc') state.qcOrders.push({ ...hydrateValue(value.data), rolls: [] })
      if (value.kind === 'roll') pendingRolls.push({ qcId: value.qcId!, roll: hydrateValue(value.data) })
      if (value.kind === 'action') state.actions.push(structuredClone(value.data))
    } else if (row.collection === HAND_FEEL_COLLECTION && value.kind === 'handfeel') state.handfeelOrders.push(hydrateValue(value.data))
  }
  for (const item of pendingRolls) state.qcOrders.find(order => order.id === item.qcId)?.rolls.push(item.roll)
  return state
}
export async function ensureFactoryQcRecords(force = false): Promise<void> {
  if (loaded && !force) return
  if (saving) throw new Error('上一笔加工或质检记录正在保存，请稍候。')
  try {
    await Promise.all([
      (async () => (await import('../pcs-record-runtime.ts')).ensurePcsRecordState(PCS_FCS_COLLECTIONS))(),
      (async () => (await import('./production-context-records.ts')).hydrateProductionContextRecords())(),
    ])
    const data = await readPcsRecords([QC_COLLECTION, HAND_FEEL_COLLECTION, PROCESS_COLLECTION])
    const priorVersions = JSON.stringify([...records.values()].filter(row => row.collection === PROCESS_COLLECTION).map(row => [row.id, row.version]).sort())
    records = new Map(data.records.map(row => [row.id, row])); files = new Map(data.files.map(file => [file.id, file.blob]))
    loaded = true; readFailure = ''
    const nextVersions = JSON.stringify(data.records.filter(row => row.collection === PROCESS_COLLECTION).map(row => [row.id, row.version]).sort())
    if (priorVersions !== nextVersions) hydrateDesignRevisionFcsCaches()
  } catch (error) { readFailure = '加工与QC资料无法读取，未按空资料覆盖。' + (error instanceof Error ? error.message : String(error)); throw new Error(readFailure) }
}
export function stageFactoryQcState(state: FactoryQcState): void {
  if (!staged) throw new Error('质检记录必须在原子业务命令内保存。')
  const put = (collection: string, id: string, value: unknown) => staged!.set(id, { id, collection, value, version: records.get(id)?.version ?? 0 })
  for (const order of state.qcOrders) {
    const { rolls, ...head } = order
    put(QC_COLLECTION, QC_COLLECTION + '/order/' + order.id, { kind: 'qc', data: head })
    for (const roll of rolls) put(QC_COLLECTION, QC_COLLECTION + '/roll/' + order.id + '/' + encodeURIComponent(roll.id), { kind: 'roll', qcId: order.id, data: { ...roll, photos: roll.photos.map(photo => ({ ...photo, fileId: photo.id })) } })
  }
  for (const order of state.handfeelOrders) put(HAND_FEEL_COLLECTION, HAND_FEEL_COLLECTION + '/order/' + order.id, { kind: 'handfeel', data: order })
  for (const action of state.actions) put(QC_COLLECTION, QC_COLLECTION + '/action/' + action.id, { kind: 'action', data: action })
}
export function adoptFactoryProcessRows(matches: (row: ProcessLedgerRow, key: string) => boolean): void {
  if (!staged) throw new Error('只能在明确业务提交时调整来源归属。')
  for (const key of FACTORY_PROCESS_KEYS) {
    const raw = baseline.get(key) ?? null
    const rows = splitFactoryProcessLedger(raw).filter(row => matches(row, key))
    const native = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
    const nativeRows = splitFactoryProcessLedger(native).filter(row => matches(row, key))
    if (native && nativeRows.length) adoptions.set(key, { raw: native, rows: nativeRows })
    for (const row of rows) if (!staged.has(processId(key, row))) staged.set(processId(key, row), { id: processId(key, row), collection: PROCESS_COLLECTION, value: { ...row, legacyKey: key }, version: 0 })
  }
}
async function compactSource(value: unknown, newFiles: PcsStoredFile[]): Promise<unknown> {
  if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('blob:'))) {
    const known = [...urls].find(([, url]) => url === value)
    if (known) return 'pcs-file:' + known[0]
    if (value.startsWith('blob:')) {
      try {
        // A source image already owned by PCS stays the same file, including
        // when QC and the original material both reference its current preview.
        const reference = (await import('../pcs-record-runtime.ts')).getPcsDurableFileReference(value)
        if (reference.startsWith('pcs-file:')) return reference
      } catch { /* An unregistered source preview is saved as original Blob below. */ }
    }
    const blob = await (await fetch(value)).blob(), id = 'fcs-source-' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('')
    if (!files.has(id) && !newFiles.some(file => file.id === id)) newFiles.push({ id, blob })
    return 'pcs-file:' + id
  }
  if (Array.isArray(value)) return Promise.all(value.map(item => compactSource(item, newFiles)))
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result = Object.fromEntries(await Promise.all(Object.entries(source).map(async ([key, item]) => [key, await compactSource(item, newFiles)])))
    // A named static source attachment is served from the application's assets;
    // its identity is not a user-uploaded Blob in the PCS file store.
    if (typeof source.fileId === 'string' && typeof source.dataUrl === 'string' && source.dataUrl.startsWith('/')) result.fileStorage = 'static'
    return result
  }
  return value
}
export async function runFactoryQcRecordCommand<T>(recipe: () => T, operationId: string, intent: string, newFiles: PcsStoredFile[] = []): Promise<T> {
  await ensureFactoryQcRecords(true)
  if (saving) throw new Error('上一笔记录尚未保存。')
  const cacheBefore = captureDesignRevisionFcsCaches()
  baseline = withFactoryProcessStaticRead(factoryProcessSnapshots); rawStage.clear(); adoptions.clear()
  staged = new Map(records); saving = true
  let committed = false
  try {
    recipeActive = true
    const result = recipe()
    if (result && typeof result === 'object' && ('then' in result || 'ok' in result && (result as any).ok === false)) throw new Error('业务校验未完成，本次未保存。' + ((result as any).message || ''))
    recipeActive = false
    withFactoryProcessStaticRead(() => restoreDesignRevisionFcsCaches(cacheBefore))
    const filePuts = [...newFiles]
    const candidates = await Promise.all([...staged.values()].filter(row => row !== records.get(row.id)).map(async row => ({ id: row.id, collection: row.collection, expectedVersion: records.get(row.id)?.version ?? 0, value: await compactSource(row.value, filePuts) })))
    const puts = candidates.filter(row => JSON.stringify(row.value) !== JSON.stringify(records.get(row.id)?.value))
    for (const [key, source] of adoptions) if (localStorage.getItem(key) !== source.raw) throw new Error('来源资料在其他旧页面发生变化，请关闭旧页后重新读取。')
    const putIds = new Set(puts.map(row => row.id))
    // All source records read by the command are protected, even if only QC changed.
    const guards = [...records.values()].filter(row => !row.deleted && row.collection === PROCESS_COLLECTION && !putIds.has(row.id)).map(row => ({ id: row.id, expectedVersion: row.version }))
    await commitPcsRecords({ puts, guards, deletes: [], files: filePuts.filter(file => !files.has(file.id)), operationId, intent })
    committed = true
    staged = undefined; saving = false; rawStage.clear(); loaded = false
    await ensureFactoryQcRecords()
    for (const [key, source] of adoptions) {
      if (localStorage.getItem(key) !== source.raw) continue
      if (source.rows.every(row => records.has(processId(key, row)))) localStorage.setItem(key, rebuildFactoryProcessLedger(source.raw, source.rows.map(row => ({ ...row, deleted: true })))!)
    }
    hydrateDesignRevisionFcsCaches(); channel?.postMessage({ operationId })
    return result
  } catch (error) {
    recipeActive = false; staged = undefined; rawStage.clear(); saving = false; loaded = false
    if (!committed) withFactoryProcessStaticRead(() => restoreDesignRevisionFcsCaches(cacheBefore))
    else throw new Error('记录已保存，页面重新读取失败；请重新读取，勿重复新建。' + (error instanceof Error ? error.message : String(error)))
    throw error
  }
}

/** Explicit upgrade action: retired business data is discarded; shared source facts are retained. */
export async function removeLegacyWashingData(): Promise<void> {
  const scope = [...RETIRED, PROCESS_COLLECTION, ...PCS_FCS_COLLECTIONS, TECHNICAL_COLLECTION]
  const data = await readPcsRecords(scope)
  const legacy = data.records.filter(row => RETIRED.includes(row.collection as any) && !row.deleted)
  const existing = new Map(data.records.map(row => [row.id, row]))
  const puts: Array<{id:string;collection:string;value:unknown;expectedVersion:number}> = [], deletes: Array<{id:string;expectedVersion:number}> = legacy.map(row => ({id:row.id,expectedVersion:row.version}))
  // The old bridge also held original printing/dyeing/receiving records. Move
  // those facts unchanged to the bounded source store, excluding old business.
  for (const record of legacy.filter(row => row.collection === RETIRED[1])) {
    const row = stripRetiredWashingFacts(record.value) as ProcessRow | undefined
    if (!row || !row.legacyKey || !row.path || !row.key) continue
    const id = processId(row.legacyKey, row)
    const current = existing.get(id)
    if (current && (current.deleted || JSON.stringify(stripRetiredWashingFacts(current.value)) !== JSON.stringify(row))) throw new Error('原始来源在新旧资料中存在冲突，尚未删除旧资料；请核对并保全实际交出和实收事实后重试。')
    if (!current) puts.push({id,collection:PROCESS_COLLECTION,value:row,expectedVersion:0})
  }
  for (const record of data.records.filter(row => !row.deleted && !RETIRED.includes(row.collection as any) && hasRetiredWashingFacts(row.value))) {
    const content = (record.value as any)?.data
    const value = record.collection === TECHNICAL_COLLECTION + '/contents' && Array.isArray(content?.processEntries) && Array.isArray(content?.bomItems)
      ? { ...(record.value as object), data: removeRetiredTechnicalProcessContent(content) }
      : stripRetiredWashingFacts(record.value)
    if (value === undefined) deletes.push({id:record.id,expectedVersion:record.version})
    else puts.push({id:record.id,collection:record.collection,value,expectedVersion:record.version})
  }
  const counts = new Map(puts.filter(row => row.collection === TECHNICAL_COLLECTION + '/contents').map(row => [(row.value as any).data.technicalVersionId, (row.value as any).data.processEntries.length]))
  for (const record of data.records.filter(row => !row.deleted && row.collection === TECHNICAL_COLLECTION + '/records')) {
    const value = record.value as any, count = counts.get(value.data?.technicalVersionId)
    if (count !== undefined && value.data.processEntryCount !== count) puts.push({ id: record.id, collection: record.collection, value: { ...value, data: { ...value.data, processEntryCount: count } }, expectedVersion: record.version })
  }
  const nativeChanges: Array<{key:string;before:string;after:string}> = []
  if (typeof localStorage !== 'undefined') for (const key of FACTORY_PROCESS_KEYS) {
    const before = localStorage.getItem(key)
    if (!before) continue
    const parsed = parsePrintExecution(before)
    if (!hasRetiredWashingFacts(parsed)) continue
    nativeChanges.push({key,before,after:serializePrintExecution(stripRetiredWashingFacts(parsed) as object)})
  }
  if (typeof localStorage !== 'undefined') {
    const before = localStorage.getItem(TECHNICAL_COLLECTION)
    if (before) {
      const snapshot = JSON.parse(before)
      if (hasRetiredWashingFacts(snapshot) && Array.isArray(snapshot.contents) && Array.isArray(snapshot.records)) {
        const contents = snapshot.contents.map((content: any) => removeRetiredTechnicalProcessContent(content))
        const counts = new Map(contents.map((content: any) => [content.technicalVersionId, content.processEntries.length]))
        const after = JSON.stringify({ ...snapshot, contents, records: snapshot.records.map((record: any) => ({ ...record, processEntryCount: counts.get(record.technicalVersionId) ?? record.processEntryCount })) })
        nativeChanges.push({key:TECHNICAL_COLLECTION,before,after})
      }
    }
  }
  if (puts.length || deletes.length) {
    const intent = 'remove-retired-washing-v2:' + [...puts.map(row => row.id + ':' + row.expectedVersion), ...deletes.map(row => row.id + ':' + row.expectedVersion)].sort().join('|')
    await commitPcsRecords({ puts, deletes, operationId: 'fqc-cleanup-' + await digest(intent), intent })
    const verify = await readPcsRecords(scope)
    if (verify.records.some(row => !row.deleted && (RETIRED.includes(row.collection as any) || hasRetiredWashingFacts(row.value))) || puts.some(put => !verify.records.some(row => row.id === put.id && JSON.stringify(row.value) === JSON.stringify(put.value)))) throw new Error('旧资料清理或原始来源核对未完成，原始来源仍保留，请重试。')
  }
  // Cross-store cleanup follows verified DB commit. If interrupted, rerunning
  // repeats the same filter without discarding any original non-washing facts.
  for (const item of nativeChanges) {
    if (localStorage.getItem(item.key) !== item.before) throw new Error('旧页面仍在改来源资料，请关闭旧页后重试清理。')
    localStorage.setItem(item.key,item.after)
    if (localStorage.getItem(item.key) !== item.after) throw new Error('旧来源清理未完成，请重试。')
  }
  if (legacy.length || nativeChanges.length || puts.length || deletes.length) {
    loaded = false
    hydrateDesignRevisionFcsCaches()
  }
  await cleanupUnreferencedPcsFiles('wash-file-')
  if (typeof localStorage !== 'undefined') localStorage.removeItem('/fcs/craft/dyeing/washing/work-orders:columns')
  retirementChecked = true
}
/** Business commands prepare the versioned retirement once per loaded runtime. */
export async function ensureFactoryQcRetirement(): Promise<void> { if (!retirementChecked) await removeLegacyWashingData() }
async function digest(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('') }
export async function assertFactoryQcFiles(ids: string[], newFiles: PcsStoredFile[]) {
  const saved = await readPcsFiles(ids.filter(id => !newFiles.some(file => file.id === id)))
  if (ids.some(id => !newFiles.some(file => file.id === id) && !saved.some(file => file.id === id))) throw new Error('本卷照片原文件缺失，本次未保存。')
}
