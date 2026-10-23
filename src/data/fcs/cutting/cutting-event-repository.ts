import { prepareRetiredCutPiecePickupHistory, assertRetiredCutPieceHistoryCurrent, retiredCutPieceHistoryInitializationRecords } from './retired-cut-piece-pickup-history.ts'
import { installPartTicketCuttingScopeBridge, hydratePartTicketRecords, partTicketInitializationRecords, assertPartTicketLegacyUnchanged, preparePartTicketMutation } from './part-ticket-records.ts'
import { CUTTING_EVENT_SCOPE_RECORD, CUTTING_EVENT_SCOPE_VERSION, LEGACY_CUTTING_EVENT_SCOPE_RECORD, isManagedCuttingEvent } from './cutting-event-scope.ts'
import { ProductionContextReadError } from '../production-context-records.ts'
import { captureReplacementFabricSourceGuard } from './replacement-fabric-source.ts'
import { hydrateProductionContextRecords, productionContextInitializationRecords } from '../production-context-records.ts'
import { getBrowserLocalStorage, withBrowserBusinessStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, type CuttingStoredRecord } from './cutting-record-repository.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, deserializeCuttingRuntimeEventLedgerStorage,
  installCuttingCommittedEventReader, installManagedCuttingEventScope, listManagedCuttingRuntimeEvents, type CuttingRuntimeEvent } from './cutting-runtime-event-ledger.ts'
import { withCuttingRuntimeEventReadFrame } from './cutting-runtime-event-ledger.ts'
import { replacementStateFromRecords, replacementStateChangeRecords, publishReplacementFabricState } from './replacement-fabric-repository.ts'
import type { ReplacementFabricState } from './replacement-fabric-fei-tickets.ts'
import { installCuttingReceiptTaskProjection } from '../runtime-task-read-bridge.ts'
import type { RuntimeProcessTask } from '../runtime-process-tasks.ts'
import { validateReplacementFabricEventBatch, type CuttingPdaActorReference } from './replacement-fabric-event-validation.ts'
import { hydrateWarehouseLayoutRecords } from './warehouse-layout-records.ts'
import { assertReadablePreparationSource, hydrateCuttingPickupRecords, preparePickupReceiptRows, validateCuttingPickupRecordLinks } from './cutting-pickup-records.ts'
import { validateCuttingMaterialRecordLinks } from './cutting-material-record-links.ts'

let committed: CuttingRuntimeEvent[] = []
let ready = false
let scopeInitialization: CuttingStoredRecord[] = []
export class CuttingCommittedRefreshError extends Error { readonly committed = true }
function readLegacyCuttingEvents(): CuttingRuntimeEvent[] {
  let raw: string | null
  try {
    const storage = getBrowserLocalStorage()
    if (typeof window !== 'undefined' && !storage) throw new Error('旧源无法读取')
    raw = storage?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null
  } catch { throw new ProductionContextReadError('旧裁床事件尚未核对，请先恢复读取并迁移本机旧记录。') }
  if (!raw) return []
  try {
    const source = JSON.parse(raw)
    if (!Array.isArray(source.events) || source.events.some((event: CuttingRuntimeEvent) => !event?.eventId || !event.eventType || !event.refs || !event.payload)
      || new Set(source.events.map((event: CuttingRuntimeEvent) => event.eventId)).size !== source.events.length) throw new Error()
    return source.events
  } catch { throw new ProductionContextReadError('旧裁床记录格式不完整，未覆盖，请先核对原记录。') }
}
export function prepareManagedScope(records: CuttingStoredRecord[]): void {
  prepareRetiredCutPiecePickupHistory(records)
  const scope = records.find(record => record.id === CUTTING_EVENT_SCOPE_RECORD)
  const legacyScope = records.find(record => record.id === LEGACY_CUTTING_EVENT_SCOPE_RECORD)
  // A v2 receipt covered post-cutting only. It cannot certify the physical
  // wait-process records now being adopted from the shared legacy ledger.
  if (!scope && legacyScope && (legacyScope.collection !== 'cutting-event-scopes' || (legacyScope.value as {phase?:string;version?:number}).phase !== 'COMPLETE' || (legacyScope.value as {version?:number}).version !== 2)) throw new ProductionContextReadError('原裁后事件核对标记不完整，请先核对原记录。')
  if (readLegacyCuttingEvents().some(isManagedCuttingEvent)) throw new ProductionContextReadError('发现旧裁床处理记录，请先迁移并读回核对，再继续当前动作。')
  if (scope) {
    if (scope.collection !== 'cutting-event-scopes' || ((scope.value as { phase?: string; version?: number }).phase !== 'COMPLETE' || (scope.value as { version?: number }).version !== CUTTING_EVENT_SCOPE_VERSION)) throw new ProductionContextReadError('裁床事件迁移未完成，请继续迁移。')
    scopeInitialization = []; installManagedCuttingEventScope(true); return
  }
  scopeInitialization = [{ id: CUTTING_EVENT_SCOPE_RECORD, collection: 'cutting-event-scopes', value: { phase: 'COMPLETE', version: CUTTING_EVENT_SCOPE_VERSION } }]
  installManagedCuttingEventScope(true)
}
export function assertManagedScopeCurrent(): void {
  assertRetiredCutPieceHistoryCurrent()
  if (readLegacyCuttingEvents().some(isManagedCuttingEvent)) throw new Error('旧页面写入了裁床记录，本次未保存，请关闭旧页面后迁移。')
}
let receiptProjectionSignature = ''
export function cuttingEventScopeInitializationRecords(): CuttingStoredRecord[] { return [...structuredClone(scopeInitialization), ...retiredCutPieceHistoryInitializationRecords()] }
export function committedCuttingEvents(): CuttingRuntimeEvent[] { return committed }
export function mergeCommittedCuttingEvents(legacy: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return [...new Map([...legacy, ...committed].map(event => [event.eventId, event])).values()]
}
export async function hydrateCuttingEventRecords(provided?:import('./cutting-record-repository.ts').CuttingRecordSnapshot,sourcesPrepared=false): Promise<void> {
  const snapshot = provided || await readCuttingRecords()
  validateCuttingMaterialRecordLinks(snapshot.records)
  if(!sourcesPrepared) {await hydrateProductionContextRecords(snapshot);await hydratePartTicketRecords(snapshot)}
  prepareManagedScope(snapshot.records)
  hydrateWarehouseLayoutRecords(snapshot)
  hydrateCuttingPickupRecords(snapshot)
  publishReplacementFabricState(await replacementStateFromRecords(snapshot))
  committed = snapshot.records.filter(record => record.collection === 'cutting-events').map(record => record.value as CuttingRuntimeEvent)
  ready = true
  installCuttingCommittedEventReader(mergeCommittedCuttingEvents, snapshot.revision)
  const release=await import('../cut-piece-release.ts')
  await release.hydrateCutPieceReleaseRecords(snapshot)
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
  pdaActor?: CuttingPdaActorReference
  id: string; intent: string; action: (storage: BrowserStorageLike) => T
  pickupReceipt?: boolean
  assertCurrent?: () => void
  validate?: (input: { state: ReplacementFabricState; before: CuttingRuntimeEvent[]; after: CuttingRuntimeEvent[]; result: T; storage: BrowserStorageLike }) => void
}): Promise<T> {
  const snapshot = await readCuttingRecords()
  await hydrateCuttingEventRecords(snapshot)
  const prior = await readCuttingCommand(input.id)
  if (prior) { if (prior.intent !== input.intent) throw new Error('本次操作编号对应不同内容，请重新核对。'); await hydrateCuttingEventRecords(); return prior.result as T }
  const release=await import('../cut-piece-release.ts')
  const assertSourcesCurrent = captureReplacementFabricSourceGuard()
  const persisted = snapshot.records.filter(record => record.collection === 'cutting-events').map(record => record.value as CuttingRuntimeEvent)
  const native = getBrowserLocalStorage()
  const prep = input.pickupReceipt ? await import('./production-material-prep.ts') : undefined
  const prepKey = prep?.PRODUCTION_MATERIAL_PREP_STORAGE_KEY || ''
  const journalKey = 'pickupWarehouseTransaction'
  const sourceReads = new Map<string, string | null>()
  const sourceRead = (key: string): string | null => {
    const value = native?.getItem(key) ?? null
    if (input.pickupReceipt && !sourceReads.has(key)) sourceReads.set(key, value)
    if (input.pickupReceipt && key === 'higood.fcs.cutting.pickup-discrepancies.v1' && value !== null) {
      let rows: any
      try { rows = JSON.parse(value) } catch { throw new ProductionContextReadError('原接收前置资料无法读取，原资料已保留，请先核对。') }
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row.discrepancyId !== 'string' || !row.discrepancyId
        || typeof row.pickupNodeId !== 'string' || !row.pickupNodeId || !Number.isSafeInteger(row.pickupNodeVersion) || row.pickupNodeVersion < 1
        || !['待主管处理', '已处理'].includes(row.status) || !Number.isFinite(row.differenceQty) || row.differenceQty <= 0 || typeof row.unit !== 'string' || !row.unit)) {
        throw new ProductionContextReadError('原接收前置资料不完整，原资料已保留，请先核对。')
      }
    }
    return value
  }
  const legacyPrep = prep ? sourceRead(prepKey) : null
  if (prep) assertReadablePreparationSource(legacyPrep)
  if (prep && sourceRead(journalKey) !== null) throw new ProductionContextReadError('发现尚未核对的旧接收日志，原资料已保留，请先核对后继续。')
  // The original reader catches parse errors and treats them as no prerequisite.
  // Validate before entering that reader so damaged source cannot allow a receipt.
  if (prep) sourceRead('higood.fcs.cutting.pickup-discrepancies.v1')
  const beforePrep = prep?.hydrateProductionMaterialPrepStore(native)
  let prepRaw = prep && beforePrep ? prep.serializeProductionMaterialPrepStore(beforePrep) : null
  let journalRaw: string | null = null
  const before = [...new Map([...listManagedCuttingRuntimeEvents(), ...persisted].map(event => [event.eventId, event])).values()]
  let raw = JSON.stringify({ events: before })
  // Compare the same canonical representation on both sides. Hydration adds
  // default fields to old/static events; those defaults are not a user action.
  const beforeEvents = new Map(deserializeCuttingRuntimeEventLedgerStorage(raw).events
    .map(event => [event.eventId, JSON.stringify(event)]))
  const storage: BrowserStorageLike = {
    getItem: key => key === CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY ? raw : prep && key === prepKey ? prepRaw : prep && key === journalKey ? journalRaw : sourceRead(key),
    setItem(key, value) {
      if (prep && key === prepKey) { prepRaw = value; return }
      if (prep && key === journalKey) { journalRaw = value; return }
      if (key !== CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) throw new Error(`本次动作包含未登记的保存 ${key}，已撤回。`)
      raw = value
    },
    removeItem(key) { if (prep && key === journalKey) { journalRaw = null; return }; throw new Error('交出动作不能清空业务记录。') },
  }
  const releaseMutation=release.prepareCutPieceReleaseMutation(()=>preparePartTicketMutation(() => withBrowserBusinessStorage(storage, () => withCuttingRuntimeEventReadFrame(storage,()=>{const result=input.action(storage);release.listCutPieceReleaseRecords();return result}))))
  const partMutation=releaseMutation.result
  const result = partMutation.result
  if (result instanceof Promise) throw new Error('裁床事务准备必须同步完成。')
  if (journalRaw !== null) throw new Error('本次接收计算未完成，全部未保存。')
  const pickupRows = prep && beforePrep ? preparePickupReceiptRows(beforePrep, prep.deserializeProductionMaterialPrepStore(prepRaw), legacyPrep) : []
  const after = deserializeCuttingRuntimeEventLedgerStorage(raw).events
  const state = await replacementStateFromRecords(structuredClone(snapshot))
  const beforeReplacement = structuredClone(state)
  const validation = { state, before, after, result, storage, pdaActor: input.pdaActor }
  validateReplacementFabricEventBatch(validation)
  if (input.validate && input.validate !== validateReplacementFabricEventBatch) input.validate(validation)
  const previous = new Map(snapshot.records.map(record => [record.id, record]))
  const eventRecords: CuttingStoredRecord[] = after.filter(event => beforeEvents.get(event.eventId) !== JSON.stringify(event))
    .map(event => ({ id: `cutting-event:${event.eventId}`, collection: 'cutting-events', value: event }))
  const puts = [...pickupRows, ...releaseMutation.change.puts, ...partMutation.change.puts, ...eventRecords, ...replacementStateChangeRecords(beforeReplacement, state, snapshot.records), ...productionContextInitializationRecords(), ...partTicketInitializationRecords(), ...cuttingEventScopeInitializationRecords()].filter(record => JSON.stringify(previous.get(record.id)) !== JSON.stringify(record))
  if (input.pickupReceipt) {
    const replaced = new Set(puts.map(row => row.id))
    validateCuttingPickupRecordLinks([...snapshot.records.filter(row => !replaced.has(row.id)), ...puts])
  }
  const deletes = [...(partMutation.change.deletes || []), ...(releaseMutation.change.deletes || [])]
  const replaced = new Set([...puts.map(row => row.id), ...deletes])
  validateCuttingMaterialRecordLinks([...snapshot.records.filter(row => !replaced.has(row.id)), ...puts])
  const saved = await commitCuttingRecords({ revision: snapshot.revision, change: { puts, deletes }, assertSourcesCurrent: () => {
    assertSourcesCurrent(); assertPartTicketLegacyUnchanged(); assertManagedScopeCurrent()
    input.assertCurrent?.()
    if ([...sourceReads].some(([key, value]) => (native?.getItem(key) ?? null) !== value)) throw new Error('原配料、接收节点或来源记录已变化，本次未保存，请重新核对。')
  }, command: { id: input.id, intent: input.intent, result, at: new Date().toISOString() } })
  if (input.pickupReceipt && !saved.replayed) {
    const next = new Map(snapshot.records.filter(row => !deletes.includes(row.id)).map(row => [row.id, row]))
    for (const row of puts) next.set(row.id, row)
    const known = { revision: saved.revision, records: [...next.values()] }
    // complete is authoritative. Publishing known committed rows does not depend on another read.
    hydrateCuttingPickupRecords(known)
    committed = known.records.filter(row => row.collection === 'cutting-events').map(row => row.value as CuttingRuntimeEvent)
    ready = true
    installCuttingCommittedEventReader(mergeCommittedCuttingEvents, saved.revision)
    return saved.result
  }
  try { await hydrateCuttingEventRecords() } catch (cause) {
    throw new CuttingCommittedRefreshError('本次操作已保存，暂时无法显示记录。恢复读取后再查看。', { cause })
  }
  return saved.result
}

installPartTicketCuttingScopeBridge({ initializationRecords: cuttingEventScopeInitializationRecords, assertCurrent: assertManagedScopeCurrent })

export function prepareCommittedCuttingEventSnapshot(snapshot:import('./cutting-record-repository.ts').CuttingRecordSnapshot):void {
  validateCuttingMaterialRecordLinks(snapshot.records)
  prepareManagedScope(snapshot.records)
  hydrateWarehouseLayoutRecords(snapshot)
  hydrateCuttingPickupRecords(snapshot)
  committed=snapshot.records.filter(record=>record.collection==='cutting-events').map(record=>record.value as CuttingRuntimeEvent)
  ready=true
  installCuttingCommittedEventReader(mergeCommittedCuttingEvents,snapshot.revision)
}
