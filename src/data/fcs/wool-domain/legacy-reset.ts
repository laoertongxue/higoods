import { getBrowserLocalStorage } from '../../browser-storage.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData, clearFactoryReceivingCache, FACTORY_RECEIVING_KEY } from '../factory-receiving.ts'
import { captureRegisteredPdaHandoverState as capturePdaHandoverState, restoreRegisteredPdaHandoverState as restorePdaHandoverState } from '../pda-handover-handout-registry.ts'
import type { PdaHandoverStateSnapshot } from '../pda-handover-events.ts'
import type { WoolDomainStore } from './store.ts'
import type { WoolMachine } from './types.ts'

export const LEGACY_WOOL_STORE_KEY = 'higood-fcs-wool-domain-store-v2'
const STAGE_STORE_KEY = 'higood-fcs-wool-stage-store-v3'
const PDA_ACTIONS_KEY = 'higood.formal-merged-handout-actions.v1'
const PDA_FIELDS = ['handoverHeadAdditions', 'pickupRecordAdditions', 'handoutRecordAdditions', 'pickupRecordOverrides', 'handoutRecordOverrides', 'handoutRecordVersionHistory', 'headCompletionOverrides'] as const
const oldSeedId = (value: string) => /^(?:WOOL-MOCK-\d+|TASK-WOOL-MOCK-\d+|WOOL-RCV-DEMO-001|TASK-WOOL-RCV-DEMO-001)$/.test(value)
const stringValue = (value: unknown): string => typeof value === 'string' ? value : ''
type Identity = Record<string, unknown>
type PdaRows = Pick<PdaHandoverStateSnapshot, typeof PDA_FIELDS[number]>

export interface LegacyWoolResetResult {
  legacyStoreRemoved: boolean
  preservedMachineIds: string[]
  removedSourceLineIds: string[]
  removedReceiptLineIds: string[]
  removedDeliveryLineIds: string[]
  removedAllocationIds: string[]
  removedPdaHeadIds: string[]
}

function readLegacyStore(raw: string | null): { workOrders: Record<string, Identity>; handovers: Identity[]; machines: WoolMachine[] } | undefined {
  if (!raw) return undefined
  let value: Record<string, unknown>
  try { value = JSON.parse(raw) } catch { throw new Error('旧毛织数据无法读取，未清除任何记录，请保留本机数据并联系负责人。') }
  if (!value || typeof value !== 'object' || !value.workOrders || typeof value.workOrders !== 'object' || Array.isArray(value.workOrders) || !Array.isArray(value.machines) || !Array.isArray(value.handovers)) throw new Error('旧毛织数据结构不完整，未清除任何记录，请联系负责人核查。')
  const ids = new Set<string>()
  for (const machine of value.machines as WoolMachine[]) {
    if (!machine || !machine.machineId || ids.has(machine.machineId) || !machine.machineModel || !machine.needleType || !['IDLE', 'REPAIR', 'DISABLED'].includes(machine.status)) throw new Error('旧横机设备档案不完整，未清除旧数据，请先核查设备档案。')
    ids.add(machine.machineId)
  }
  return value as ReturnType<typeof readLegacyStore>
}

function parsePdaRows(raw: string): PdaRows & { version: number } {
  let value: PdaRows & { version: number }
  try { value = JSON.parse(raw) } catch { throw new Error('旧交接记录无法读取，未清除任何记录，请联系负责人。') }
  if (value?.version !== 1 || PDA_FIELDS.some(key => !Array.isArray(value[key]) || value[key].some(row => !Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !row[1] || typeof row[1] !== 'object'))) throw new Error('旧交接记录格式不完整，未清除任何记录，请联系负责人。')
  return value
}

/** Retire old wool facts by identity, retaining mixed-document non-wool rows and machine masters. */
export function resetLegacyWoolFacts(newStore: WoolDomainStore): LegacyWoolResetResult {
  const storage = getBrowserLocalStorage()
  const legacyRaw = storage?.getItem(LEGACY_WOOL_STORE_KEY) ?? null
  const legacy = readLegacyStore(legacyRaw)
  const liveOrderIds = new Set(Object.keys(newStore.workOrders))
  const liveTaskIds = new Set(Object.values(newStore.workOrders).map(order => order.taskId))
  const oldOrderIds = new Set(Object.entries(legacy?.workOrders ?? {}).flatMap(([key, order]) => [key, stringValue(order.woolOrderId)]).filter(Boolean))
  const oldTaskIds = new Set(Object.values(legacy?.workOrders ?? {}).flatMap(order => [stringValue(order.taskId), stringValue(order.taskNo), stringValue(order.sourceTaskId)]).filter(Boolean))
  const oldHandoverIds = new Set((legacy?.handovers ?? []).map(record => stringValue(record.handoverId)).filter(Boolean))
  const liveHandoverIds = new Set(newStore.handovers.map(record => record.handoverId))
  const isOldOrder = (id: unknown) => typeof id === 'string' && !liveOrderIds.has(id) && (oldOrderIds.has(id) || oldSeedId(id))
  const isOldTask = (id: unknown) => typeof id === 'string' && !liveTaskIds.has(id) && (oldTaskIds.has(id) || oldSeedId(id))
  const isOldHandover = (id: unknown) => typeof id === 'string' && !liveHandoverIds.has(id) && oldHandoverIds.has(id)
  const oldIdentity = (record: Identity) => ['woolOrderId', 'sourceDocId', 'scopeKey'].some(key => isOldOrder(record[key])) || ['taskId', 'taskNo', 'sourceTaskId', 'runtimeTaskId'].some(key => isOldTask(record[key])) || isOldHandover(record.sourceWoolHandoverId)
  const result: LegacyWoolResetResult = { legacyStoreRemoved: Boolean(legacy), preservedMachineIds: legacy?.machines.map(machine => machine.machineId) ?? [], removedSourceLineIds: [], removedReceiptLineIds: [], removedDeliveryLineIds: [], removedAllocationIds: [], removedPdaHeadIds: [] }
  const pdaBefore = capturePdaHandoverState()
  const persistedPda = pdaBefore.persistedActionsRaw ? parsePdaRows(pdaBefore.persistedActionsRaw) : undefined
  const pda = structuredClone(pdaBefore)
  const oldHeads = new Set<string>(), oldRecords = new Set<string>()
  // Collect from both stores first: partial overrides often contain only a record ID.
  const pdaStates: PdaRows[] = persistedPda ? [pda, persistedPda] : [pda]
  for (const state of pdaStates) for (const [id, head] of state.handoverHeadAdditions) if (oldIdentity(head as unknown as Identity)) oldHeads.add(id)
  for (const state of pdaStates) {
    for (const field of ['pickupRecordAdditions', 'handoutRecordAdditions', 'handoutRecordVersionHistory'] as const) {
      for (const [id, records] of state[field]) for (const record of records) {
        if (oldHeads.has(id) || oldHeads.has(record.handoverId) || oldIdentity(record as unknown as Identity) || isOldTask(id)) { oldRecords.add(record.recordId); if ('handoverRecordId' in record && record.handoverRecordId) oldRecords.add(record.handoverRecordId) }
      }
    }
  }

  const receivingBefore = captureFactoryReceivingData()
  const receiving = structuredClone(receivingBefore)
  const removedSourceLines = new Set<string>()
  for (const source of receiving.sources) {
    const wholeSource = oldRecords.has(source.originalRecordId ?? '') || isOldHandover(source.originalRecordId) || isOldOrder(source.workOrderNo) || oldSeedId(source.id)
    source.lines = source.lines.filter(line => {
      const remove = wholeSource || isOldOrder(line.woolOrderId) || (!line.woolOrderId && isOldTask(line.taskNo))
      if (remove) removedSourceLines.add(line.id)
      return !remove
    })
  }
  receiving.sources = receiving.sources.filter(source => source.lines.length > 0)
  result.removedSourceLineIds = [...removedSourceLines]
  const removedReceiptLines = new Set<string>()
  for (const receipt of receiving.receipts) {
    receipt.lines = receipt.lines.filter(line => {
      const remove = removedSourceLines.has(line.sourceLineId) || isOldOrder(line.woolOrderId)
      if (remove) removedReceiptLines.add(line.id)
      return !remove
    })
    // Keep the retained rows retryable under the same confirmation ID, without deleted wool rows.
    if (receipt.lines.length) {
      let input: { lines?: Array<{ sourceLineId?: string }> }
      try { input = JSON.parse(receipt.fingerprint) } catch { continue }
      if (Array.isArray(input.lines)) {
        const keptSourceLines = new Set(receipt.lines.map(line => line.sourceLineId))
        const lines = input.lines.filter(line => keptSourceLines.has(line.sourceLineId ?? ''))
        if (lines.length !== input.lines.length) receipt.fingerprint = JSON.stringify({ ...input, lines })
      }
    }
  }
  receiving.receipts = receiving.receipts.filter(receipt => receipt.lines.length > 0)
  result.removedReceiptLineIds = [...removedReceiptLines]
  for (const delivery of receiving.deliveries) {
    delivery.lines = delivery.lines.filter(line => {
      const remove = removedSourceLines.has(line.sourceLineId)
      if (remove) result.removedDeliveryLineIds.push(line.id)
      return !remove
    })
  }
  receiving.deliveries = receiving.deliveries.filter(delivery => delivery.lines.length > 0)
  receiving.allocations = receiving.allocations.filter(allocation => {
    const remove = isOldOrder(allocation.woolOrderId) || removedReceiptLines.has(allocation.receiptLineId)
    if (remove) result.removedAllocationIds.push(allocation.id)
    return !remove
  })
  if (receiving.materialUses) receiving.materialUses = receiving.materialUses.flatMap(use => {
    const lines = use.lines.filter(line => !removedReceiptLines.has(line.receiptLineId))
    return lines.length ? [{ ...use, lines }] : []
  })

  const cleanPda = <T extends PdaRows>(state: T): T => {
    state.handoverHeadAdditions = state.handoverHeadAdditions.filter(([id]) => !oldHeads.has(id))
    for (const field of ['pickupRecordAdditions', 'handoutRecordAdditions', 'handoutRecordVersionHistory'] as const) {
      // All three maps have the same identity fields but distinct record payload types.
      const rows = state[field] as Array<[string, Array<{ recordId: string; handoverId: string }>]>
      ;(state[field] as typeof rows) = rows.flatMap(([id, records]) => {
        if (oldHeads.has(id) || isOldTask(id)) return []
        const kept = records.filter(record => !oldRecords.has(record.recordId) && !oldHeads.has(record.handoverId))
        return kept.length ? [[id, kept]] : []
      })
    }
    state.pickupRecordOverrides = state.pickupRecordOverrides.filter(([id, row]) => !oldRecords.has(id) && !oldHeads.has(row.handoverId ?? '') && !oldIdentity(row as Identity))
    state.handoutRecordOverrides = state.handoutRecordOverrides.filter(([id, row]) => !oldRecords.has(id) && !oldHeads.has(row.handoverId ?? '') && !oldIdentity(row as Identity))
    state.headCompletionOverrides = state.headCompletionOverrides.filter(([id]) => !oldHeads.has(id))
    return state
  }
  cleanPda(pda)
  if (persistedPda) pda.persistedActionsRaw = JSON.stringify(cleanPda(persistedPda))
  const pdaChanged = JSON.stringify(PDA_FIELDS.map(field => pda[field])) !== JSON.stringify(PDA_FIELDS.map(field => pdaBefore[field])) || pda.persistedActionsRaw !== pdaBefore.persistedActionsRaw
  if (pdaChanged) { pda.cachedBuiltHeads = null; pda.cachedPostFinishingBuiltHeads = null }
  result.removedPdaHeadIds = [...oldHeads]

  const receivingChanged = JSON.stringify(receiving) !== JSON.stringify(receivingBefore)
  const machines = new Map(newStore.machines.map(machine => [machine.machineId, machine]))
  for (const machine of legacy?.machines ?? []) machines.set(machine.machineId, structuredClone(machine))
  const nextMachines = [...machines.values()]
  // Fresh demo occupancy must not override a preserved repair/disabled machine master.
  const nextAssociations = newStore.machineAssociations?.filter(association =>
    !newStore.workOrders[association.woolOrderId]?.demoSource || machines.get(association.machineId)?.status === 'IDLE')
  if (!legacy && !receivingChanged && !pdaChanged) return result
  if (typeof window !== 'undefined' && (!storage?.setItem || !storage.removeItem)) throw new Error('浏览器不能保存清理结果，未清除旧毛织数据，请恢复本地存储后重试。')
  const receivingRaw = storage?.getItem(FACTORY_RECEIVING_KEY) ?? null
  const stageRaw = storage?.getItem(STAGE_STORE_KEY) ?? null
  const originalMachines = newStore.machines
  const originalAssociations = newStore.machineAssociations
  try {
    if (receivingChanged) restoreFactoryReceivingData(receiving)
    if (pdaChanged) restorePdaHandoverState(pda)
    if (legacy) {
      newStore.machines = nextMachines
      if (nextAssociations) newStore.machineAssociations = nextAssociations
      storage?.setItem?.(STAGE_STORE_KEY, JSON.stringify(newStore))
      storage?.removeItem?.(LEGACY_WOOL_STORE_KEY)
    }
  } catch (error) {
    newStore.machines = originalMachines
    newStore.machineAssociations = originalAssociations
    const restoreRaw = (key: string, raw: string | null) => raw === null ? storage?.removeItem?.(key) : storage?.setItem?.(key, raw)
    try {
      restoreRaw(FACTORY_RECEIVING_KEY, receivingRaw)
      clearFactoryReceivingCache()
      restorePdaHandoverState(pdaBefore)
      restoreRaw(PDA_ACTIONS_KEY, pdaBefore.persistedActionsRaw ?? null)
      restoreRaw(STAGE_STORE_KEY, stageRaw)
      restoreRaw(LEGACY_WOOL_STORE_KEY, legacyRaw)
    } catch { throw new Error('旧毛织清理保存失败，回退也未能完整保存，请保留本机数据并联系负责人。') }
    throw new Error(`旧毛织清理未保存，原记录已保留。${error instanceof Error ? error.message : String(error)}`)
  }
  return result
}
