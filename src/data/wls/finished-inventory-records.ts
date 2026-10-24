import { readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import type { PostFinishingCommitDelta, PostFinishingCommitParticipant } from '../fcs/post-finishing-records.ts'
import { createFinishedInventorySeed } from './finished-inventory-quality-seed.ts'
import type { FinishedInventoryState } from './finished-inventory-quality-types.ts'

export const FINISHED_INVENTORY_NAMESPACE = 'higood-finished-inventory'
let state = createFinishedInventorySeed()
let stored = new Map<string, PcsStoredRecord>()
let ready = typeof window === 'undefined'
let failure = ''
const copy = <T>(v: T): T => structuredClone(v)
const collections = ['lots', 'exclusions', 'applications', 'transfers', 'movements', 'differences', 'scopes'] as const
function rows(value: FinishedInventoryState): Map<string, { collection: string; value: unknown }> {
  return new Map(collections.flatMap(key => value[key].map(row => [`${FINISHED_INVENTORY_NAMESPACE}/${key}/${encodeURIComponent(row.id)}`, { collection: `${FINISHED_INVENTORY_NAMESPACE}/${key}`, value: row }] as const)))
}
export function readFinishedInventoryState(): FinishedInventoryState { return state }
export function captureFinishedInventoryState(): FinishedInventoryState { return copy(state) }
export function restoreFinishedInventoryState(snapshot: unknown): void { state = snapshot as FinishedInventoryState }
export function getFinishedInventoryStorageFailure(): string { return failure }
export function isFinishedInventoryReady(): boolean { return ready }
export async function ensureFinishedInventoryRecords(): Promise<void> {
  if (typeof window === 'undefined' && typeof indexedDB === 'undefined') return
  try {
  const read = await readPcsRecords([FINISHED_INVENTORY_NAMESPACE])
  const next = createFinishedInventorySeed()
  for (const key of collections) {
    const entries = new Map(next[key].map(row => [row.id, row]))
    for (const record of read.records.filter(row => row.id.startsWith(`${FINISHED_INVENTORY_NAMESPACE}/${key}/`))) {
      const id = decodeURIComponent(record.id.slice(record.id.lastIndexOf('/') + 1))
      if (record.deleted) entries.delete(id)
      else {
        const value = record.value as { id?: string }
        if (!value || value.id !== id) throw new Error('库存记录身份不一致，原资料保留。')
        entries.set(id, value as never)
      }
    }
    ;(next[key] as unknown[]) = [...entries.values()]
  }
  for (const key of collections) if (new Set(next[key].map(row => row.id)).size !== next[key].length) throw new Error('库存记录身份重复，原资料保留。')
  for (const lot of next.lots) if (!lot.warehouseId || !lot.skuId || !lot.styleId || !['正常', '瑕疵', '破损'].includes(lot.quality) || !Number.isSafeInteger(lot.quantity) || lot.quantity < 0) throw new Error('库存数量或身份格式无效，原资料保留。')
  const appIds = new Set(next.applications.map(row => row.id))
  for (const application of next.applications) if (!application.operationId || !application.warehouseId || !application.styleId || !Array.isArray(application.lines) || !application.lines.length || application.lines.some(row => !row.skuId || !Number.isSafeInteger(row.outboundQty) || row.outboundQty <= 0 || row.receivedQty !== undefined && (!Number.isSafeInteger(row.receivedQty) || row.receivedQty < 0))) throw new Error('库存送检申请格式无效，原资料保留。')
  for (const transfer of next.transfers) if (!appIds.has(transfer.applicationId) || !transfer.targetId || !Array.isArray(transfer.lines) || transfer.lines.some(row => !Number.isSafeInteger(row.quantity) || row.quantity <= 0 || row.receivedQty !== undefined && (!Number.isSafeInteger(row.receivedQty) || row.receivedQty < 0))) throw new Error('库存交接关联或数量不完整，原资料保留。')
  state = next; stored = new Map(read.records.map(row => [row.id, row])); ready = true; failure = ''
  } catch (error) { ready = false; failure = `库存资料无法读取。${error instanceof Error ? error.message : String(error)}`; throw new Error(failure) }
}
export function prepareFinishedInventoryCommit(before: unknown): PostFinishingCommitDelta {
  const old = rows(before as FinishedInventoryState), next = rows(state)
  const puts: PostFinishingCommitDelta['puts'] = [], deletes: PostFinishingCommitDelta['deletes'] = []
  for (const [id, row] of next) if (JSON.stringify(row.value) !== JSON.stringify(old.get(id)?.value)) puts.push({ id, collection: row.collection, value: copy(row.value), expectedVersion: stored.get(id)?.version || 0 })
  for (const id of old.keys()) if (!next.has(id)) deletes.push({ id, expectedVersion: stored.get(id)?.version || 0 })
  return { puts, deletes }
}
export function acceptFinishedInventoryCommit(delta: PostFinishingCommitDelta): void {
  for (const row of delta.puts) { const { expectedVersion, ...value } = row; stored.set(row.id, { ...value, version: expectedVersion + 1 }) }
  for (const row of delta.deletes) stored.set(row.id, { id: row.id, collection: 'deleted', value: null, deleted: true, version: row.expectedVersion + 1 })
}
export const inventoryTransactionParticipant: PostFinishingCommitParticipant = {
  // 页面进入/明确重读取当前持久事实。保存不重复全域读取；记录及仓款scope CAS
  // 仍在共同事务内拒绝其他标签的修改，冲突后由页面明确重读，不能静默覆盖。
  key: 'finished-inventory', prepare: async () => { if (!ready) await ensureFinishedInventoryRecords() }, capture: captureFinishedInventoryState,
  restore: restoreFinishedInventoryState, changes: prepareFinishedInventoryCommit, committed: acceptFinishedInventoryCommit,
}
