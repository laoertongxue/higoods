import { withLaceFactoryCommandScope } from './lace-factory-command-scope.ts'
import { commitPcsRecords, readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import { captureLaceFactoryRuntime, createLaceFactoryStaticSnapshot, restoreLaceFactoryRuntime, type LaceFactoryRuntimeState } from './lace-factory-domain.ts'

export const LACE_FACTORY_RECORDS = 'fcs.lace.records.v1'
const fields = {
  purchaseOrders: 'purchaseOrderId', workOrders: 'workOrderId', completionReports: 'reportId',
  handovers: 'handoverId', receipts: 'receiptId', logs: 'logId',
} as const
interface Row { group: keyof typeof fields | 'viewedPurchaseVersions' | 'actionIds' | 'sequence' | 'commands'; key: string; data: unknown }
let baseline: LaceFactoryRuntimeState | undefined
let records = new Map<string, PcsStoredRecord>()
let saving = false, reading: Promise<void> | undefined
function id(group: Row['group'], key: string) { return `${LACE_FACTORY_RECORDS}/${group}/${encodeURIComponent(key)}` }
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function rowsOf(snapshot: LaceFactoryRuntimeState) {
  const result = new Map<string, Row>()
  const put = (group: Row['group'], key: string, data: unknown) => {
    if (!key || result.has(id(group, key))) throw new Error('花边记录编号为空或重复，本次未保存。')
    result.set(id(group, key), { group, key, data })
  }
  for (const [group, field] of Object.entries(fields) as Array<[keyof typeof fields, string]>) {
    for (const item of snapshot[group]) put(group, String((item as unknown as Record<string, unknown>)[field] ?? ''), item)
  }
  for (const [key, value] of snapshot.viewedPurchaseVersions) put('viewedPurchaseVersions', key, value)
  for (const key of snapshot.actionIds) put('actionIds', key, true)
  for (const [key, value] of Object.entries(snapshot.sequence)) put('sequence', key, value)
  return result
}
function applyRows(stored: PcsStoredRecord[]) {
  baseline ??= createLaceFactoryStaticSnapshot()
  const snapshot = structuredClone(baseline), rows = rowsOf(snapshot)
  for (const record of stored) {
    const row = record.value as Row
    if (record.collection !== LACE_FACTORY_RECORDS || !row || typeof row.key !== 'string' || !row.key ||
      ![...Object.keys(fields), 'viewedPurchaseVersions', 'actionIds', 'sequence', 'commands'].includes(row.group) ||
      record.id !== id(row.group, row.key)) throw new Error('花边保存记录无法核对，请保留原资料后重新读取。')
    if (row.group === 'commands') continue
    if (record.deleted) rows.delete(record.id); else rows.set(record.id, row)
  }
  for (const group of Object.keys(fields) as Array<keyof typeof fields>) (snapshot[group] as unknown[]) = []
  snapshot.viewedPurchaseVersions = new Map(); snapshot.actionIds = new Set()
  for (const row of rows.values()) {
    if (row.group in fields) {
      const field = fields[row.group as keyof typeof fields]
      if (!row.data || typeof row.data !== 'object' || (row.data as Record<string, unknown>)[field] !== row.key) throw new Error('花边记录身份无法核对，原资料保持不变。')
      ;(snapshot[row.group as keyof typeof fields] as unknown[]).push(structuredClone(row.data))
    } else if (row.group === 'viewedPurchaseVersions') {
      if (!Number.isSafeInteger(row.data) || Number(row.data) <= 0) throw new Error('花边采购版本记录无效。')
      snapshot.viewedPurchaseVersions.set(row.key, Number(row.data))
    } else if (row.group === 'actionIds') snapshot.actionIds.add(row.key)
    else if (row.group === 'sequence') {
      if (!(row.key in snapshot.sequence) || !Number.isSafeInteger(row.data) || Number(row.data) < 0) throw new Error('花边编号记录无效。')
      snapshot.sequence[row.key as keyof LaceFactoryRuntimeState['sequence']] = Number(row.data)
    }
  }
  // Reject broken relationships rather than presenting an empty or partial order.
  const orders = new Set(snapshot.workOrders.map(order => order.workOrderId)), handovers = new Set(snapshot.handovers.map(row => row.handoverId))
  if ([...snapshot.completionReports, ...snapshot.handovers, ...snapshot.receipts].some(row => !orders.has(row.workOrderId)) || snapshot.receipts.some(row => !handovers.has(row.handoverId))) throw new Error('花边单据或交接关系不完整，请保留原资料后重新读取。')
  restoreLaceFactoryRuntime(snapshot)
}
/** Static records remain static. Ordinary cold reads never seed or migrate data. */
export async function hydrateLaceFactoryRecords() {
  if (typeof window === 'undefined') return
  if (saving) throw new Error('花边操作正在保存，请完成后再读取。')
  if (reading) return reading
  reading = (async () => {
    const result = await readPcsRecords([LACE_FACTORY_RECORDS])
    applyRows(result.records)
    records = new Map(result.records.map(row => [row.id, row]))
  })().finally(() => { reading = undefined })
  return reading
}
/** Original synchronous business validation is captured, rolled back while saving,
 * then published only after the existing record database transaction completes. */
export async function runLaceFactoryRecordCommand(operationId: string, intent: string, mutate: () => unknown, guard?: { workOrderId: string; expected: string }): Promise<void> {
  if (!operationId.trim() || !intent.trim()) throw new Error('缺少本次花边操作编号，请重新打开单据。')
  if (saving) throw new Error('花边操作正在保存，请勿重复提交。')
  if (typeof window !== 'undefined') await hydrateLaceFactoryRecords()
  if (saving) throw new Error('花边操作正在保存，请勿重复提交。')
  const before = captureLaceFactoryRuntime()
  const commandId = id('commands', operationId), prior = records.get(commandId)
  if (prior && !prior.deleted) {
    if (!same((prior.value as Row).data, { intent })) throw new Error('此花边操作号已保存其他内容，请查看原记录。')
    // A retry must never repeat a non-idempotent original mutation.
    return
  }
  if (guard && JSON.stringify(before.workOrders.find(order => order.workOrderId === guard.workOrderId)) !== guard.expected) throw new Error('花边单据已变化，本次未保存。重新读取后核对再提交。')
  let after: LaceFactoryRuntimeState
  try {
    const value = withLaceFactoryCommandScope(mutate)
    if (value && typeof (value as { then?: unknown }).then === 'function') throw new Error('先完成花边资料读取，再提交同步业务操作。')
    after = captureLaceFactoryRuntime()
  } catch (error) { restoreLaceFactoryRuntime(before); throw error }
  if (typeof window === 'undefined') return
  const oldRows = rowsOf(before), nextRows = rowsOf(after)
  const puts: Parameters<typeof commitPcsRecords>[0]['puts'] = [], deletes: Parameters<typeof commitPcsRecords>[0]['deletes'] = []
  for (const [key, row] of nextRows) if (!same(row, oldRows.get(key))) puts.push({ id: key, collection: LACE_FACTORY_RECORDS, value: row, expectedVersion: records.get(key)?.version ?? 0 })
  for (const key of oldRows.keys()) if (!nextRows.has(key)) {
    const row = oldRows.get(key)!
    // A tombstone also preserves deletion of a static baseline row.
    puts.push({ id: key, collection: LACE_FACTORY_RECORDS, value: row, deleted: true, expectedVersion: records.get(key)?.version ?? 0 })
  }
  puts.push({ id: commandId, collection: LACE_FACTORY_RECORDS, value: { group: 'commands', key: operationId, data: { intent } } satisfies Row, expectedVersion: 0 })
  const guards: Parameters<typeof commitPcsRecords>[0]['guards'] = []
  if (guard) {
    const key = id('workOrders', guard.workOrderId)
    if (!puts.some(row => row.id === key)) guards.push({ id: key, expectedVersion: records.get(key)?.version ?? 0 })
  }
  restoreLaceFactoryRuntime(before); saving = true
  try {
    await commitPcsRecords({ operationId: 'lace/' + operationId, intent, puts, deletes, guards })
  } catch (error) { restoreLaceFactoryRuntime(before); throw error }
  finally { saving = false }
  try { await hydrateLaceFactoryRecords() } catch { throw new Error('花边操作已保存，但未能更新页面。请重新读取后查看原记录，不要重复提交。') }
}

export async function withLaceFactoryRecords<T>(render: () => T): Promise<Awaited<T>> {
  await hydrateLaceFactoryRecords()
  return await render()
}

export function hasSavedLaceFactoryCommand(operationId: string, intent: string) {
  const row = records.get(id('commands', operationId))
  return !!row && !row.deleted && same((row.value as Row).data, { intent })
}
