import { commitPcsRecords, readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import type { BindingProcessOrder } from '../../pages/process-factory/cutting/binding-strip-order-types.ts'
import { assertWaterSolubleLegacyMigrated } from './water-soluble-legacy-source.ts'
import { captureSpecialCraftTaskStore, restoreSpecialCraftTaskStore, getSpecialCraftTaskOrderById } from './special-craft-task-orders.ts'
import { createFactoryInternalWarehouseMutationSnapshot, restoreFactoryInternalWarehouseMutationSnapshot } from './factory-internal-warehouse.ts'
import { captureProcessWarehouseMutationState, restoreProcessWarehouseMutationState } from './process-warehouse-domain.ts'
import { captureProcessActionRuntime, restoreProcessActionRuntime } from './process-action-writeback-service.ts'
import { capturePdaHandoverState, restorePdaHandoverState } from './pda-handover-events.ts'
import { captureSpecialCraftFeiTicketState, restoreSpecialCraftFeiTicketState } from './cutting/special-craft-fei-ticket-flow.ts'
import { captureDesignRevisionFcsCaches, restoreDesignRevisionFcsCaches, hydrateDesignRevisionFcsCaches } from './design-revision-pcs-storage.ts'
import {
  splitFactoryProcessLedger,
  sameProcessLedgerRow,
  getFactoryProcessSnapshot, withFactoryProcessStaticRead,
} from './factory-process-storage.ts'

import { SPECIAL_CRAFT_RECORDS, SPECIAL_CRAFT_LEDGER_RECORDS, CENTRAL_EXECUTION_COMMAND_GUARDS, CENTRAL_EXECUTION_COLLECTIONS, CENTRAL_EXECUTION_LEGACY_KEYS,
  centralLedgerRecordId as ledgerId, replaceCentralExecutionRecordSnapshot, setCentralExecutionLedgerStage,
  isCentralExecutionRecordTarget, getCentralExecutionRecordEpoch, centralExecutionRecordChannel as channel,
} from './central-execution-record-bridge.ts'
export { SPECIAL_CRAFT_RECORDS, SPECIAL_CRAFT_LEDGER_RECORDS } from './central-execution-record-bridge.ts'
const collections = CENTRAL_EXECUTION_COLLECTIONS
type DomainRow = { owner: string; group: string; key: string; tuple: boolean; data: unknown }
type State = ReturnType<typeof capture>
let records = new Map<string, PcsStoredRecord>()
let loaded = false, saving = false, readEpoch = -1
let readFailure = ''
const stagedLedgers = new Map<string, string>()
const relatedCacheOwners = ['print', 'dye', 'dye-online', 'water', 'receiving', 'prerequisite', 'staged-storage'] as const
// Registered only by the actual binding entry; other process entries never load its page/domain.
let bindingHooks: { capture(): BindingProcessOrder[]; restore(rows: BindingProcessOrder[]): void } | undefined
export function registerBindingExecutionRecordHooks(value: NonNullable<typeof bindingHooks>) { bindingHooks = value }
channel?.addEventListener('message', () => { loaded = false })

function capture(includeRelatedCaches = false, includeCraft = true, includeBinding = false) {
  return withFactoryProcessStaticRead(() => ({
    orders: includeCraft ? captureSpecialCraftTaskStore() : undefined,
    warehouse: includeCraft ? createFactoryInternalWarehouseMutationSnapshot() : undefined,
    process: captureProcessWarehouseMutationState(),
    binding: includeBinding && bindingHooks ? { bindingOrders: bindingHooks.capture() } : undefined,
    actions: includeCraft ? captureProcessActionRuntime() : undefined,
    tickets: includeCraft ? captureSpecialCraftFeiTicketState() : undefined,
    pda: capturePdaHandoverState(false),
    ledgerCaches: includeRelatedCaches ? captureDesignRevisionFcsCaches(relatedCacheOwners) : undefined,
  }))
}

function restore(state: State) {
  withFactoryProcessStaticRead(() => {
    if (state.orders) restoreSpecialCraftTaskStore(state.orders)
    if (state.warehouse) restoreFactoryInternalWarehouseMutationSnapshot(state.warehouse)
    if (state.process) restoreProcessWarehouseMutationState(state.process)
    if (state.binding && bindingHooks) bindingHooks.restore(state.binding.bindingOrders)
    if (state.actions) restoreProcessActionRuntime(state.actions)
    if (state.tickets) restoreSpecialCraftFeiTicketState(state.tickets)
    const pda = structuredClone(state.pda)
    delete pda.persistedActionsRaw
    restorePdaHandoverState(pda)
    if (state.ledgerCaches) restoreDesignRevisionFcsCaches(state.ledgerCaches)
  })
}

/** Merge only this synchronous command's cache delta after the async transaction.
 * Other page actions may have changed unrelated heads while it was committing. */
function publishHandoverDelta(before: State['pda'], after: State['pda']) {
  const current = capturePdaHandoverState(false)
  for (const key of ['handoverHeadAdditions', 'pickupRecordAdditions', 'handoutRecordAdditions',
    'pickupRecordOverrides', 'handoutRecordOverrides', 'handoutRecordVersionHistory', 'headCompletionOverrides'] as const) {
    const old = new Map<string, unknown>(before[key] as Array<[string, unknown]>)
    const next = new Map<string, unknown>(after[key] as Array<[string, unknown]>)
    const merged = new Map<string, unknown>(current[key] as Array<[string, unknown]>)
    for (const [id, value] of next) if (JSON.stringify(value) !== JSON.stringify(old.get(id))) merged.set(id, value)
    for (const id of old.keys()) if (!next.has(id)) merged.delete(id)
    ;(current as unknown as Record<string, unknown>)[key] = [...merged]
  }
  current.cachedBuiltHeads = null
  current.cachedPostFinishingBuiltHeads = null
  delete current.persistedActionsRaw
  restorePdaHandoverState(current)
}

const identityFields: Record<string, string> = {
  bindingOrders: 'bindingOrderId', taskOrders: 'taskOrderId', waitProcessStockItems: 'stockItemId', waitHandoverStockItems: 'stockItemId',
  inboundRecords: 'inboundRecordId', outboundRecords: 'outboundRecordId', warehouseRecords: 'warehouseRecordId',
  handoverRecords: 'handoverRecordId', differenceRecords: 'differenceRecordId', reviewRecords: 'reviewRecordId',
  operationRecords: 'operationRecordId', bindings: 'bindingId', differenceReports: 'reportId', flowEvents: 'eventId',
}
function rowId(owner: string, group: string, key: string) {
  return `${SPECIAL_CRAFT_RECORDS}/${owner}/${group}/${encodeURIComponent(key)}`
}
function domainRows(state: State): Map<string, DomainRow> {
  const result = new Map<string, DomainRow>()
  for (const owner of ['orders', 'warehouse', 'process', 'actions', 'tickets', 'binding'] as const) {
    for (const [group, values] of Object.entries(state[owner] ?? {})) {
      const tuple = group === 'idempotentResults' || group === 'pickupRecordToDispatchRecordId'
      const field = identityFields[group]
      if (!Array.isArray(values) || (!field && !tuple)) continue
      for (const value of values) {
        const key = tuple ? value[0] : value[field]
        if (typeof key !== 'string' || !key) throw new Error(`工艺记录缺少自身编号：${owner}/${group}。`)
        const id = rowId(owner, group, key)
        if (result.has(id)) throw new Error('工艺记录编号重复，未覆盖原记录。')
        result.set(id, { owner, group, key, tuple, data: tuple ? value[1] : value })
      }
    }
  }
  return result
}

function applyDomainRows(rows: Iterable<Pick<PcsStoredRecord, 'id' | 'collection' | 'value' | 'deleted'>>, includeBinding = false) {
  const savedRows = [...rows]
  const hasTicketRows = savedRows.some(row => row.collection === SPECIAL_CRAFT_RECORDS && !row.id.includes('/commands/') && (row.value as DomainRow)?.owner === 'tickets')
  // Hydration applies durable domain rows. It does not need a command rollback
  // snapshot of the unrelated paper-ticket flow or a pre-update PDA projection.
  // Preserve the original order -> warehouse -> process initialization order.
  const current = withFactoryProcessStaticRead(() => ({
    orders: captureSpecialCraftTaskStore(),
    warehouse: createFactoryInternalWarehouseMutationSnapshot(),
    process: captureProcessWarehouseMutationState(),
    binding: includeBinding && bindingHooks ? { bindingOrders: bindingHooks.capture() } : undefined,
    actions: captureProcessActionRuntime(),
    tickets: hasTicketRows ? captureSpecialCraftFeiTicketState() : undefined,
  }))
  const groups = current as unknown as Record<string, Record<string, unknown[]>>
  for (const row of savedRows) {
    if (row.collection !== SPECIAL_CRAFT_RECORDS || row.id.includes('/commands/')) continue
    const value = row.value as DomainRow
    if (!value || !['orders', 'warehouse', 'process', 'actions', 'tickets', 'binding'].includes(value.owner)
      || (!identityFields[value.group] && !['idempotentResults', 'pickupRecordToDispatchRecordId'].includes(value.group))) {
      throw new Error('工艺保存记录格式不完整，未按空记录覆盖。')
    }
    const expectedTuple = ['idempotentResults', 'pickupRecordToDispatchRecordId'].includes(value.group)
    if (typeof value.key !== 'string' || !value.key || value.tuple !== expectedTuple
      || row.id !== rowId(value.owner, value.group, value.key)
      || (!expectedTuple && (!value.data || typeof value.data !== 'object'
        || (value.data as Record<string, unknown>)[identityFields[value.group]] !== value.key))) {
      throw new Error('工艺保存记录编号或内容不一致，未覆盖原记录。')
    }
    if (value.owner === 'binding' && (!includeBinding || !bindingHooks)) continue
    const owner = groups[value.owner], list = owner?.[value.group]
    if (!Array.isArray(list)) throw new Error('工艺保存记录归属无效。')
    const field = identityFields[value.group]
    const index = list.findIndex((item: any) => (value.tuple ? item[0] : item[field]) === value.key)
    if (row.deleted) { if (index >= 0) list.splice(index, 1); continue }
    const data = value.tuple ? [value.key, structuredClone(value.data)] : structuredClone(value.data)
    if (index < 0) list.push(data); else list[index] = data
  }
  withFactoryProcessStaticRead(() => {
    restoreSpecialCraftTaskStore(current.orders)
    restoreFactoryInternalWarehouseMutationSnapshot(current.warehouse)
    restoreProcessWarehouseMutationState(current.process)
    if (current.binding && bindingHooks) bindingHooks.restore(current.binding.bindingOrders)
    restoreProcessActionRuntime(current.actions)
    if (current.tickets) restoreSpecialCraftFeiTicketState(current.tickets)
  })
}

export function isSpecialCraftRecordTarget(target: unknown): boolean {
  if (typeof target === 'string') {
    const order = getSpecialCraftTaskOrderById(target)
    if (order) return !order.woolPieceKey && !order.woolFinalInputOrderIds?.length
  }
  return isCentralExecutionRecordTarget(target)
}

export async function ensureSpecialCraftRecords(force = false, domain?: 'binding'): Promise<void> {
  try { assertWaterSolubleLegacyMigrated() } catch (error) {
    if ((error as { code?: string })?.code !== 'WATER_LEGACY_UNAVAILABLE') throw error
    // A blocked preference store must not hide already verified IndexedDB facts.
    // Without a verified migration and all its records, preserve the read failure.
    const saved = await readPcsRecords(collections), ids = new Set(saved.records.filter(row => !row.deleted).map(row => row.id))
    const proof = saved.migrations.find(row => row.id === 'fcs.water-soluble.legacy-execution.v1')
    if (!proof || proof.legacyKey !== 'higoods.formal-water-execution.v1' || !proof.sourceDigest || proof.recordIds.some(id => !ids.has(id))) throw error
  }
  if (loaded && readEpoch === getCentralExecutionRecordEpoch() && !force) return
  if (saving) throw new Error('上一笔工艺操作尚未保存，请等待完成。')
  try {
    await (await import('../pcs-record-runtime.ts')).ensurePcsRecordState()
    await (await import('./cutting/part-ticket-records.ts')).hydratePartTicketRecords()
    const saved = await readPcsRecords(collections)
    const next = new Map(saved.records.map(row => [row.id, row]))
    const prior = records
    records = next
    try {
      replaceCentralExecutionRecordSnapshot(saved.records)
      if (saved.records.some(row => row.collection === SPECIAL_CRAFT_RECORDS && !row.id.includes('/commands/'))) applyDomainRows(saved.records, domain === 'binding')
      const ledgerChanged = saved.records.some(row => row.collection === SPECIAL_CRAFT_LEDGER_RECORDS
        && prior.get(row.id)?.version !== row.version)
      if (ledgerChanged) hydrateDesignRevisionFcsCaches(relatedCacheOwners)
    } catch (error) { records = prior; replaceCentralExecutionRecordSnapshot(prior.values()); throw error }
    loaded = true; readEpoch = getCentralExecutionRecordEpoch(); readFailure = ''
  } catch (error) {
    readFailure = error instanceof Error ? error.message : '工艺记录无法读取，请重新读取。'
    throw new Error(readFailure)
  }
}

export function getSpecialCraftRecordFailure() { return readFailure }

export function hasSavedSpecialCraftCommand(operationId: string, intent: string): boolean {
  const row = records.get(`${SPECIAL_CRAFT_RECORDS}/commands/${encodeURIComponent(operationId)}`)
  if (!row || row.deleted) return false
  if ((row.value as { intent?: string })?.intent !== intent) throw new Error('本次确认号已用于其他填写，请重新打开操作。')
  return true
}

/** Persist only records changed by this action; all participating facts share the PCS database transaction. */
export async function runSpecialCraftRecordCommand<T>(target: unknown, recipe: () => T,
  operationId: string = crypto.randomUUID(), intent = JSON.stringify(target), commandGuardKeys: readonly string[] = [], recordScope: 'craft' | 'process' | 'binding' = 'craft'): Promise<T> {
  await ensureSpecialCraftRecords()
  if (saving) throw new Error('上一笔工艺操作尚未保存，请等待完成。')
  const commandId = `${SPECIAL_CRAFT_RECORDS}/commands/${encodeURIComponent(operationId)}`
  const previous = records.get(commandId)?.value as { intent: string; result: T } | undefined
  if (previous) {
    if (previous.intent !== intent) throw new Error('本次确认号已用于其他填写，请重新打开操作。')
    return structuredClone(previous.result)
  }
  const initialLedgers = new Map<string, string | null>()
  const { getDesignRevisionFcsStorage } = await import('./design-revision-pcs-storage.ts')
  for (const key of CENTRAL_EXECUTION_LEGACY_KEYS) initialLedgers.set(key,
    withFactoryProcessStaticRead(() => getFactoryProcessSnapshot(key)) ?? getDesignRevisionFcsStorage().getItem(key))
  // Initialize read-only domain baselines before capturing rollback caches. Otherwise
  // first use can treat seed initialization as user changes or restore an empty cache.
  const before = capture(true, recordScope === 'craft', recordScope === 'binding'), beforeRows = domainRows(before)
  saving = true; setCentralExecutionLedgerStage(stagedLedgers); stagedLedgers.clear()
  let committed = false
  try {
    const result = recipe()
    if (result && typeof (result as any).then === 'function') throw new Error('先完成资料读取，再提交工艺操作。')
    const after = capture(false, recordScope === 'craft', recordScope === 'binding'), afterRows = domainRows(after)
    const puts: Array<Omit<PcsStoredRecord, 'version'> & { expectedVersion: number }> = []
    const append = (id: string, collection: string, value: unknown, deleted = false) => {
      puts.push({ id, collection, value, ...(deleted ? { deleted: true } : {}), expectedVersion: records.get(id)?.version || 0 })
    }
    for (const [id, value] of afterRows) if (JSON.stringify(value) !== JSON.stringify(beforeRows.get(id))) append(id, SPECIAL_CRAFT_RECORDS, value)
    for (const [id, value] of beforeRows) if (!afterRows.has(id)) append(id, SPECIAL_CRAFT_RECORDS, value, true)
    for (const [key, raw] of stagedLedgers) {
      const old = new Map(splitFactoryProcessLedger(initialLedgers.get(key) ?? null).map(row => [row.path + '/' + row.key, row]))
      const next = new Map(splitFactoryProcessLedger(raw).map(row => [row.path + '/' + row.key, row]))
      const changed = new Map([...next].filter(([id, row]) => !sameProcessLedgerRow(row, old.get(id))))
      if (key === 'higood-factory-material-receiving-v1') {
        // A new physical receipt/use must still resolve its original documents in
        // a cold page before a process module initializes its static demo cache.
        // Adopt only those direct references, never the whole receiving seed set.
        const sourceIds = new Set<string>(), receiptLineIds = new Set<string>()
        for (const row of changed.values()) {
          const value = row.value as { receiptLineId?: string; lines?: Array<{ sourceId?: string; receiptLineId?: string }> }
          if (row.path === 'allocations' && value.receiptLineId) receiptLineIds.add(value.receiptLineId)
          if (['receipts', 'deliveries', 'materialUses'].includes(row.path)) for (const line of value.lines ?? []) {
            if (line.sourceId) sourceIds.add(line.sourceId)
            if (line.receiptLineId) receiptLineIds.add(line.receiptLineId)
          }
        }
        const include = (id: string, row: ReturnType<typeof splitFactoryProcessLedger>[number]) => {
          const durable = records.get(ledgerId(key, row))
          if (!durable || durable.deleted || !sameProcessLedgerRow(row, durable.value as typeof row)) changed.set(id, row)
        }
        for (const [id, row] of next) if (row.path === 'receipts') {
          const value = row.value as { lines: Array<{ id: string; sourceId: string }> }
          if (value.lines.some(line => receiptLineIds.has(line.id))) {
            include(id, row)
            for (const line of value.lines) sourceIds.add(line.sourceId)
          }
        }
        for (const [id, row] of next) if (row.path === 'sources' && sourceIds.has(row.key)) include(id, row)
      }
      for (const row of changed.values()) append(ledgerId(key, row), SPECIAL_CRAFT_LEDGER_RECORDS, { ...row, legacyKey: key })
      for (const [id, row] of old) if (!next.has(id)) append(ledgerId(key, row), SPECIAL_CRAFT_LEDGER_RECORDS, { ...row, legacyKey: key, deleted: true })
    }
    setCentralExecutionLedgerStage(undefined); stagedLedgers.clear(); restore(before)
    append(commandId, SPECIAL_CRAFT_RECORDS, { intent, result, ...(typeof target === 'string' ? { target } : {}) })
    // A selected static order may not need a business-row write. A same-transaction
    // version marker still prevents two tabs reserving its roll in different docs.
    for(const key of new Set(commandGuardKeys))append(`${CENTRAL_EXECUTION_COMMAND_GUARDS}/${encodeURIComponent(key)}`,CENTRAL_EXECUTION_COMMAND_GUARDS,{key,operationId})
    const orderGuards = [...beforeRows].filter(([, row]) => ((row.owner === 'orders' && row.group === 'taskOrders') || (row.owner === 'binding' && row.group === 'bindingOrders'))
      && (typeof target === 'string' ? row.key === target : JSON.stringify(target).includes(JSON.stringify(row.key))))
      .map(([id]) => ({ id, expectedVersion: records.get(id)?.version || 0 }))
    // Written records already carry the same guard; avoid duplicate IDs in the database contract.
    const written = new Set(puts.map(row => row.id))
    await commitPcsRecords({ operationId, intent, puts, deletes: [], guards: orderGuards.filter(row => !written.has(row.id)) })
    committed = true
    // A stable operation may already have committed in another tab. Publish the
    // durable readback rather than assuming this recipe was the database writer.
    const saved = await readPcsRecords(collections)
    records = new Map(saved.records.map(row => [row.id, row]))
    replaceCentralExecutionRecordSnapshot(saved.records)
    applyDomainRows(saved.records, recordScope === 'binding')
    // The ledger overlay is now durable; publish only this command's PDA cache changes.
    publishHandoverDelta(before.pda, after.pda)
    hydrateDesignRevisionFcsCaches(relatedCacheOwners)
    capturePdaHandoverState(true)
    loaded = true; readEpoch = getCentralExecutionRecordEpoch(); channel?.postMessage({ operationId })
    return result
  } catch (error) {
    setCentralExecutionLedgerStage(undefined); stagedLedgers.clear(); loaded = false
    if (committed) {
      readFailure = '工艺操作已保存，但页面未能更新，请重新读取后查看。'
      throw new Error(readFailure)
    }
    restore(before)
    throw error
  } finally { saving = false; setCentralExecutionLedgerStage(undefined); stagedLedgers.clear() }
}
