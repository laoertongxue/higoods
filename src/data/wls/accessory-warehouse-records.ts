import {
  openCuttingRecordDatabase,
  commitCuttingRecords,
  type CuttingRecordChange,
  type CuttingStoredRecord,
} from '../fcs/cutting/cutting-record-repository.ts'
import { cuttingRecordFingerprint } from '../fcs/cutting/cutting-record-identity.ts'

export const ACCESSORY_RECORD_PREFIX = 'accessory-warehouse:'
export type AccessoryRecordKind = 'preparation' | 'transfer' | 'receipt' | 'stock' | 'pickup' | 'change' | 'migration' | 'audit'
  | 'sewing-slip' | 'sewing-handover' | 'sewing-context' | 'sewing-result'
export interface AccessoryRecordSnapshot { revision: number; records: CuttingStoredRecord[] }
let snapshot: AccessoryRecordSnapshot | null = null
let readFailure = ''
let saving = false

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('辅料资料无法读取。'))
  })
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('辅料资料读取中止，请重新读取。'))
    tx.onerror = () => {}
  })
}
export function accessoryRecord<T>(kind: AccessoryRecordKind, id: string, value: T): CuttingStoredRecord<T> {
  if (!id.trim()) throw new Error('辅料记录身份缺失。')
  return { id: `${ACCESSORY_RECORD_PREFIX}${kind}:${id}`, collection: `${ACCESSORY_RECORD_PREFIX}${kind}`, value }
}
/** 按本任务 ID 前缀读取；不扫描全库、不写初始化标记、不复制静态演示记录。 */
export async function readAccessoryRecordSnapshot(): Promise<AccessoryRecordSnapshot> {
  const db = await openCuttingRecordDatabase()
  const tx = db.transaction(['records', 'meta'], 'readonly')
  const done = completed(tx)
  try {
    const [records, revision] = await Promise.all([
      resultOf(tx.objectStore('records').getAll(IDBKeyRange.bound(ACCESSORY_RECORD_PREFIX, `${ACCESSORY_RECORD_PREFIX}\uffff`))),
      resultOf(tx.objectStore('meta').get('revision')),
    ])
    await done
    return { records: records as CuttingStoredRecord[], revision: revision?.value || 0 }
  } catch (error) { await done.catch(() => {}); throw error }
}
export async function ensureAccessoryWarehouseRecords(): Promise<void> {
  if (saving) throw new Error('上一笔辅料操作尚未保存，请等待完成。')
  try { snapshot = await readAccessoryRecordSnapshot(); readFailure = '' }
  catch (error) {
    snapshot = null
    readFailure = `用户辅料资料无法读取，未使用空数据覆盖。${error instanceof Error ? error.message : String(error)}`
    throw new Error(readFailure)
  }
}
export function accessoryWarehouseReadError(): string { return readFailure }
export function listAccessoryRecords<T>(kind: AccessoryRecordKind): T[] {
  if (readFailure) throw new Error(readFailure)
  if (!snapshot) throw new Error('辅料资料尚未读取，请重新打开页面。')
  return snapshot.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}${kind}`).map(row => structuredClone(row.value) as T)
}
export function findAccessoryRecord<T>(kind: AccessoryRecordKind, id: string): T | undefined {
  return listAccessoryRecords<T & { id: string }>(kind).find(row => row.id === id)
}
export function currentAccessorySnapshot(): AccessoryRecordSnapshot {
  if (!snapshot || readFailure) throw new Error(readFailure || '辅料资料尚未读取。')
  return structuredClone(snapshot)
}
/** prepareChange 适配任务改派时使用；在同一裁剪记录库事务中保存必要关联。 */
export function accessoryChangeFromRows(rows: Array<{ kind: AccessoryRecordKind; id: string; value: unknown }>): CuttingRecordChange {
  return { puts: rows.map(row => accessoryRecord(row.kind, row.id, row.value)) }
}
/** 输入在事务前计算；complete 后才发布新内存。冲突保留旧快照，不自动重试。 */
export async function saveAccessoryWarehouseAction<T>(input: {
  commandId: string
  intent: string
  result: T
  change: CuttingRecordChange
  assertSourcesCurrent?: () => void
}): Promise<T> {
  if (saving) throw new Error('上一笔辅料操作尚未保存，请等待完成。')
  const before = currentAccessorySnapshot()
  if (input.change.puts.some(row => !row.id.startsWith(ACCESSORY_RECORD_PREFIX) || !row.collection.startsWith(ACCESSORY_RECORD_PREFIX))) {
    throw new Error('本次辅料保存包含未登记的记录范围。')
  }
  if (input.change.deletes?.some(id => !id.startsWith(ACCESSORY_RECORD_PREFIX))) throw new Error('不能删除本范围以外的记录。')
  const change = structuredClone(input.change)
  const result = structuredClone(input.result)
  saving = true
  try {
    const files = await Promise.all((change.files || []).map(async file => ({
      id: file.id, type: file.blob.type, size: file.blob.size,
      sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join(''),
    })))
    // 调用方的动作名称相同也不能复用另一份数量/结果，附件内容在事务前指纹化。
    const intent = `accessory:${await cuttingRecordFingerprint(JSON.stringify({
      action: input.intent, result, puts: change.puts, deletes: change.deletes || [], files, deleteFileIds: change.deleteFileIds || [],
    }))}`
    const saved = await commitCuttingRecords({
      revision: before.revision, change,
      command: { id: input.commandId, intent, result, at: new Date().toISOString() },
      assertSourcesCurrent: input.assertSourcesCurrent,
    })
    if (saved.replayed) snapshot = await readAccessoryRecordSnapshot()
    else {
      const next = new Map(before.records.map(row => [row.id, row]))
      for (const id of change.deletes || []) next.delete(id)
      for (const row of change.puts) next.set(row.id, structuredClone(row))
      snapshot = { records: [...next.values()], revision: saved.revision }
    }
    readFailure = ''
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('accessory-warehouse-saved'))
    return saved.result
  } finally { saving = false }
}
export async function withAccessoryWarehouseRecords(render: () => string | Promise<string>, prepare = ensureAccessoryWarehouseRecords): Promise<string> {
  try { await prepare(); return await render() }
  catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
    return `<section class="rounded-lg border border-red-200 bg-red-50 p-5" role="alert" data-accessory-read-error data-skip-page-rerender="true"><h1 class="font-semibold">辅料资料无法读取</h1><p class="mt-2 text-sm">${message}</p><div class="mt-3 flex gap-2"><button class="rounded border px-3 py-2" data-accessory-action="reload">重新读取</button><button class="rounded border px-3 py-2" data-accessory-action="data">本机资料</button></div><div data-aw-overlay-host></div></section>`
  }
}
