import { captureReplacementFabricSourceGuard } from './replacement-fabric-source.ts'
import { getBrowserLocalStorage, withBrowserBusinessStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, type CuttingStoredRecord } from './cutting-record-repository.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, deserializeCuttingRuntimeEventLedgerStorage,
  installCuttingCommittedEventReader, listCuttingRuntimeEvents, type CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import { replacementStateFromRecords, replacementStateToRecords, publishReplacementFabricState } from './replacement-fabric-repository.ts'
import type { ReplacementFabricState } from './replacement-fabric-fei-tickets.ts'
import { installCuttingReceiptTaskProjection } from '../runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from '../runtime-process-tasks.ts'
import { validateReplacementFabricEventBatch } from './replacement-fabric-event-validation.ts'

let committed: CuttingRuntimeEvent[] = []
let ready = false
let receiptProjectionSignature = ''
export function committedCuttingEvents(): CuttingRuntimeEvent[] { return committed }
export function mergeCommittedCuttingEvents(legacy: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return [...new Map([...legacy, ...committed].map(event => [event.eventId, event])).values()]
}
export async function hydrateCuttingEventRecords(): Promise<void> {
  const snapshot = await readCuttingRecords()
  publishReplacementFabricState(await replacementStateFromRecords(snapshot))
  committed = snapshot.records.filter(record => record.collection === 'cutting-events').map(record => record.value as CuttingRuntimeEvent)
  ready = true
  installCuttingCommittedEventReader(mergeCommittedCuttingEvents, snapshot.revision)
  const firstReceipts = new Map<string, { at: string; recordNo: string }>()
  for (const event of [...committed].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    if (event.eventStatus === '已取消') continue
    const payload = event.payload as unknown as Record<string, unknown>
    const receipts = event.eventType === '新增交出记录' ? (payload.automaticSewingReceipts || []) as Array<{ runtimeTaskId?: string; receivedPieceQty: number }>
      : event.eventType === '简易裁片交出' ? [{ runtimeTaskId: String(payload.runtimeTaskId || ''), receivedPieceQty: Number(payload.totalPieceQty || 0) }] : []
    for (const receipt of receipts) if (receipt.runtimeTaskId && receipt.receivedPieceQty > 0) {
      const key = JSON.stringify([receipt.runtimeTaskId, payload.receiverId || payload.factoryId])
      if (!firstReceipts.has(key)) firstReceipts.set(key, { at: event.occurredAt, recordNo: String(payload.handoverRecordNo || event.eventNo) })
    }
  }
  const signature = JSON.stringify([...firstReceipts])
  if (signature === receiptProjectionSignature) return
  receiptProjectionSignature = signature
  installCuttingReceiptTaskProjection(firstReceipts.size ? raw => {
    const task = raw as RuntimeProcessTask
    const receipt = firstReceipts.get(JSON.stringify([task.taskId, task.assignedFactoryId]))
    if (!receipt || task.status !== 'NOT_STARTED') return task
    return { ...task, status: 'IN_PROGRESS', startedAt: receipt.at }
  } : null)
}
export function isCuttingEventStorageReady() { return ready }
export async function runCuttingEventAction<T>(input: {
  id: string; intent: string; action: (storage: BrowserStorageLike) => T
  validate?: (input: { state: ReplacementFabricState; before: CuttingRuntimeEvent[]; after: CuttingRuntimeEvent[]; result: T; storage: BrowserStorageLike }) => void
}): Promise<T> {
  await hydrateCuttingEventRecords()
  const prior = await readCuttingCommand(input.id)
  if (prior) { if (prior.intent !== input.intent) throw new Error('本次操作编号对应不同内容，请重新核对。'); return prior.result as T }
  const assertSourcesCurrent = captureReplacementFabricSourceGuard()
  const snapshot = await readCuttingRecords()
  const persisted = snapshot.records.filter(record => record.collection === 'cutting-events').map(record => record.value as CuttingRuntimeEvent)
  const native = getBrowserLocalStorage()
  let legacyRaw: string | null = null
  try { legacyRaw = native?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null } catch { /* 已迁移记录可在 localStorage 禁止时读取。 */ }
  if (legacyRaw) {
    try { if (!Array.isArray(JSON.parse(legacyRaw).events)) throw new Error() } catch { throw new Error('旧裁床记录无法读取，未覆盖或清理，请主管核对。') }
  }
  const before = [...new Map([...listCuttingRuntimeEvents(), ...persisted].map(event => [event.eventId, event])).values()]
  let raw = JSON.stringify({ events: before })
  const storage: BrowserStorageLike = {
    getItem: key => key === CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY ? raw : native?.getItem(key) ?? null,
    setItem(key, value) { if (key !== CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) throw new Error(`本次动作包含未登记的保存 ${key}，已撤回。`); raw = value },
    removeItem() { throw new Error('交出动作不能清空业务记录。') },
  }
  const result = withBrowserBusinessStorage(storage, () => input.action(storage))
  if (result instanceof Promise) throw new Error('裁床事务准备必须同步完成。')
  const after = deserializeCuttingRuntimeEventLedgerStorage(raw).events
  const state = await replacementStateFromRecords(structuredClone(snapshot))
  const validation = { state, before, after, result, storage }
  validateReplacementFabricEventBatch(validation)
  if (input.validate && input.validate !== validateReplacementFabricEventBatch) input.validate(validation)
  const previous = new Map(snapshot.records.map(record => [record.id, record]))
  const beforeEvents = new Map(before.map(event => [event.eventId, JSON.stringify(event)]))
  const eventRecords: CuttingStoredRecord[] = after.filter(event => previous.has(`cutting-event:${event.eventId}`)
    || beforeEvents.get(event.eventId) !== JSON.stringify(event))
    .map(event => ({ id: `cutting-event:${event.eventId}`, collection: 'cutting-events', value: event }))
  const puts = [...eventRecords, ...replacementStateToRecords(state)].filter(record => JSON.stringify(previous.get(record.id)) !== JSON.stringify(record))
  await commitCuttingRecords({ revision: snapshot.revision, change: { puts }, assertSourcesCurrent, command: { id: input.id, intent: input.intent, result, at: new Date().toISOString() } })
  await hydrateCuttingEventRecords()
  return result
}
