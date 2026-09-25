import { prepareRetiredCutPiecePickupHistory, assertRetiredCutPieceHistoryCurrent, retiredCutPieceHistoryInitializationRecords } from './retired-cut-piece-pickup-history.ts'
import { installPartTicketCuttingScopeBridge, hydratePartTicketRecords, partTicketInitializationRecords, assertPartTicketLegacyUnchanged, preparePartTicketMutation } from './part-ticket-records.ts'
import { CUTTING_EVENT_SCOPE_RECORD, isManagedCuttingEvent } from './cutting-event-scope.ts'
import { ProductionContextReadError } from '../production-context-records.ts'
import { captureReplacementFabricSourceGuard } from './replacement-fabric-source.ts'
import { hydrateProductionContextRecords, productionContextInitializationRecords } from '../production-context-records.ts'
import { getBrowserLocalStorage, withBrowserBusinessStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, type CuttingStoredRecord } from './cutting-record-repository.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, deserializeCuttingRuntimeEventLedgerStorage,
  installCuttingCommittedEventReader, installManagedCuttingEventScope, listManagedCuttingRuntimeEvents, type CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import { replacementStateFromRecords, replacementStateToRecords, publishReplacementFabricState } from './replacement-fabric-repository.ts'
import type { ReplacementFabricState } from './replacement-fabric-fei-tickets.ts'
import { installCuttingReceiptTaskProjection } from '../runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from '../runtime-process-tasks.ts'
import { validateReplacementFabricEventBatch } from './replacement-fabric-event-validation.ts'

let committed: CuttingRuntimeEvent[] = []
let ready = false
let scopeInitialization: CuttingStoredRecord[] = []
export function prepareManagedScope(records: CuttingStoredRecord[]): void {
  prepareRetiredCutPiecePickupHistory(records)
  const scope = records.find(record => record.id === CUTTING_EVENT_SCOPE_RECORD)
  if (scope) {
    if (scope.collection !== 'cutting-event-scopes' || ((scope.value as { phase?: string; version?: number }).phase !== 'COMPLETE' || (scope.value as { version?: number }).version !== 2)) throw new ProductionContextReadError('裁后事件迁移未完成，请继续迁移。')
    scopeInitialization = []; installManagedCuttingEventScope(true); return
  }
  let raw: string | null
  try { raw = getBrowserLocalStorage()?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null } catch { throw new ProductionContextReadError('旧裁后事件尚未核对，请先允许读取并迁移本机旧记录。') }
  let events: CuttingRuntimeEvent[] = []
  if (raw) {
    try { const source = JSON.parse(raw); if (!Array.isArray(source.events) || source.events.some((event: CuttingRuntimeEvent) => !event?.eventId || !event.eventType || !event.refs || !event.payload)) throw new Error(); events = source.events }
    catch { throw new ProductionContextReadError('旧裁床记录格式不完整，未覆盖，请先核对原记录。') }
  }
  if (events.some(isManagedCuttingEvent)) throw new ProductionContextReadError('发现旧裁后处理记录，请先迁移并读回核对，再继续当前动作。')
  scopeInitialization = [{ id: CUTTING_EVENT_SCOPE_RECORD, collection: 'cutting-event-scopes', value: { phase: 'COMPLETE', version: 2 } }]
  installManagedCuttingEventScope(true)
}
export function assertManagedScopeCurrent(): void {
  assertRetiredCutPieceHistoryCurrent()
  if (!scopeInitialization.length) return
  let raw: string | null
  try { raw = getBrowserLocalStorage()?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null } catch { throw new Error('尚未保存：旧裁后来源无法核对，请恢复读取权限后迁移。') }
  if (raw && JSON.parse(raw).events.some(isManagedCuttingEvent)) throw new Error('旧页面写入了裁后记录，本次未保存，请关闭旧页面后迁移。')
}
let receiptProjectionSignature = ''
export function cuttingEventScopeInitializationRecords(): CuttingStoredRecord[] { return [...structuredClone(scopeInitialization), ...retiredCutPieceHistoryInitializationRecords()] }
export function committedCuttingEvents(): CuttingRuntimeEvent[] { return committed }
export function mergeCommittedCuttingEvents(legacy: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return [...new Map([...legacy, ...committed].map(event => [event.eventId, event])).values()]
}
export async function hydrateCuttingEventRecords(): Promise<void> {
  const snapshot = await readCuttingRecords()
  await hydrateProductionContextRecords(snapshot)
  await hydratePartTicketRecords(snapshot)
  prepareManagedScope(snapshot.records)
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
  const snapshot = await readCuttingRecords()
  await hydrateProductionContextRecords(snapshot)
  await hydratePartTicketRecords(snapshot)
  const assertSourcesCurrent = captureReplacementFabricSourceGuard()
  const persisted = snapshot.records.filter(record => record.collection === 'cutting-events').map(record => record.value as CuttingRuntimeEvent)
  const native = getBrowserLocalStorage()
  const before = [...new Map([...listManagedCuttingRuntimeEvents(), ...persisted].map(event => [event.eventId, event])).values()]
  let raw = JSON.stringify({ events: before })
  // Compare the same canonical representation on both sides. Hydration adds
  // default fields to old/static events; those defaults are not a user action.
  const beforeEvents = new Map(deserializeCuttingRuntimeEventLedgerStorage(raw).events
    .map(event => [event.eventId, JSON.stringify(event)]))
  const storage: BrowserStorageLike = {
    getItem: key => key === CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY ? raw : native?.getItem(key) ?? null,
    setItem(key, value) { if (key !== CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) throw new Error(`本次动作包含未登记的保存 ${key}，已撤回。`); raw = value },
    removeItem() { throw new Error('交出动作不能清空业务记录。') },
  }
  const partMutation = preparePartTicketMutation(() => withBrowserBusinessStorage(storage, () => input.action(storage)))
  const result = partMutation.result
  if (result instanceof Promise) throw new Error('裁床事务准备必须同步完成。')
  const after = deserializeCuttingRuntimeEventLedgerStorage(raw).events
  const state = await replacementStateFromRecords(structuredClone(snapshot))
  const validation = { state, before, after, result, storage }
  validateReplacementFabricEventBatch(validation)
  if (input.validate && input.validate !== validateReplacementFabricEventBatch) input.validate(validation)
  const previous = new Map(snapshot.records.map(record => [record.id, record]))
  const eventRecords: CuttingStoredRecord[] = after.filter(event => beforeEvents.get(event.eventId) !== JSON.stringify(event))
    .map(event => ({ id: `cutting-event:${event.eventId}`, collection: 'cutting-events', value: event }))
  const puts = [...partMutation.change.puts, ...eventRecords, ...replacementStateToRecords(state), ...productionContextInitializationRecords(), ...partTicketInitializationRecords(), ...cuttingEventScopeInitializationRecords()].filter(record => JSON.stringify(previous.get(record.id)) !== JSON.stringify(record))
  await commitCuttingRecords({ revision: snapshot.revision, change: { puts, deletes: partMutation.change.deletes }, assertSourcesCurrent: () => { assertSourcesCurrent(); assertPartTicketLegacyUnchanged(); assertManagedScopeCurrent() }, command: { id: input.id, intent: input.intent, result, at: new Date().toISOString() } })
  await hydrateCuttingEventRecords()
  return result
}

installPartTicketCuttingScopeBridge({ initializationRecords: cuttingEventScopeInitializationRecords, assertCurrent: assertManagedScopeCurrent })
