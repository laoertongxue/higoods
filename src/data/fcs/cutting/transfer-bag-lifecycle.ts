import {
  compareCuttingRuntimeChronologyAscending,
  type CuttingRuntimeChronologyItem,
} from './cutting-runtime-chronology.ts'

export type TransferBagMainStatusKey =
  | 'IDLE'
  | 'IN_USE'
  | 'DISABLED'

export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'READY_HANDOVER'
  | 'HANDED_OVER_WAITING_RETURN'

export type TransferBagLifecycleAction =
  | 'BAGGING'
  | 'INBOUND'
  | 'REPACK'
  | 'REPACK_TARGET'
  | 'HANDOVER'
  | 'SPECIAL_CRAFT_RETURN'
  | 'PHYSICAL_RETURN'
  | 'FORCE_RETURN'
  | 'SCRAP'

export type TransferBagLifecycleFactType =
  | 'BAGGING_CONFIRMED'
  | 'INBOUND_CONFIRMED'
  | 'REPACK_RESULT_CONFIRMED'
  | 'REPACK_SOURCE_RETAINED'
  | 'REPACK_SOURCE_EMPTIED'
  | 'HANDOVER_CONFIRMED'
  | 'SPECIAL_CRAFT_BAG_RETURNED'
  | 'PHYSICAL_BAG_RETURNED'
  | 'BAG_SCRAPPED'
  | 'DOWNSTREAM_RECEIVED'
  | 'DOWNSTREAM_DIFFERENCE'
  | 'DOWNSTREAM_WRITEBACK'

export interface TransferBagLifecycleCycle {
  usageCycleId: string
  startedAt: string
  startedChronology?: Omit<CuttingRuntimeChronologyItem, 'occurredAt'>
  productionOrderNo?: string
  closedAt?: string
  closedChronology?: Omit<CuttingRuntimeChronologyItem, 'occurredAt'>
  closeResult?: 'REUSABLE' | 'DISABLED'
}

export interface TransferBagLifecycleFact {
  factId: string
  factType: TransferBagLifecycleFactType
  usageCycleId?: string
  handoverLegId?: string
  occurredAt: string
  ledgerSequence?: number
  createdAt?: string
}

export interface TransferBagLifecycleInput {
  carrierId: string
  bagCode: string
  cycles: TransferBagLifecycleCycle[]
  facts: TransferBagLifecycleFact[]
}

export interface TransferBagLifecycleView {
  carrierId: string
  bagCode: string
  usageCycleId: string | null
  activeHandoverLegId: string | null
  mainStatus: TransferBagMainStatusKey
  mainStatusLabel: '空闲' | '使用中' | '已报废'
  flowStage: TransferBagFlowStageKey | null
  flowStageLabel: '菲票已装袋' | '入仓暂存中' | '待交出' | '已交出待回收' | '—'
  canStartBagging: boolean
  allowedActions: TransferBagLifecycleAction[]
  sourceFactIds: string[]
  compatibilityBlockedReason?: string
}

export const TRANSFER_BAG_MAIN_STATUS_META = {
  IDLE: { label: '空闲' },
  IN_USE: { label: '使用中' },
  DISABLED: { label: '已报废' },
} as const satisfies Record<TransferBagMainStatusKey, {
  label: TransferBagLifecycleView['mainStatusLabel']
}>

export const TRANSFER_BAG_FLOW_STAGE_META = {
  PACKED: { label: '菲票已装袋' },
  INBOUND_STORED: { label: '入仓暂存中' },
  READY_HANDOVER: { label: '待交出' },
  HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
} as const satisfies Record<TransferBagFlowStageKey, {
  label: Exclude<TransferBagLifecycleView['flowStageLabel'], '—'>
}>

const LIFECYCLE_STAGE_FACT_TYPES = new Set<TransferBagLifecycleFactType>([
  'BAGGING_CONFIRMED',
  'INBOUND_CONFIRMED',
  'REPACK_RESULT_CONFIRMED',
  'REPACK_SOURCE_RETAINED',
  'HANDOVER_CONFIRMED',
  'SPECIAL_CRAFT_BAG_RETURNED',
])

function sortByTimeAndId<T extends { occurredAt: string; factId: string }>(
  items: T[],
): T[] {
  return [...items].sort(compareCuttingRuntimeChronologyAscending)
}

function sortCycles(
  cycles: TransferBagLifecycleCycle[],
): TransferBagLifecycleCycle[] {
  return [...cycles].sort((left, right) => compareCuttingRuntimeChronologyAscending(
    cycleBoundaryChronology(left, 'started'),
    cycleBoundaryChronology(right, 'started'),
  ))
}

function cycleBoundaryChronology(
  cycle: TransferBagLifecycleCycle,
  boundary: 'started' | 'closed',
): CuttingRuntimeChronologyItem {
  const chronology = boundary === 'started'
    ? cycle.startedChronology
    : cycle.closedChronology
  return {
    occurredAt: boundary === 'started' ? cycle.startedAt : cycle.closedAt || '',
    ...chronology,
    factId: chronology?.factId || `cycle:${cycle.usageCycleId}:${boundary}`,
  }
}

function isUsageCycleOpenAt(
  cycle: TransferBagLifecycleCycle,
  facts: TransferBagLifecycleFact[],
  factAt: TransferBagLifecycleFact,
): boolean {
  if (compareCuttingRuntimeChronologyAscending(
    cycleBoundaryChronology(cycle, 'started'),
    factAt,
  ) > 0) return false
  if (cycle.closedAt && compareCuttingRuntimeChronologyAscending(
    cycleBoundaryChronology(cycle, 'closed'),
    factAt,
  ) <= 0) return false
  return !facts.some((fact) =>
    fact.usageCycleId === cycle.usageCycleId
    && fact.factType === 'REPACK_SOURCE_EMPTIED'
    && compareCuttingRuntimeChronologyAscending(fact, factAt) <= 0)
}

function stageFromFact(
  fact: TransferBagLifecycleFact | undefined,
): TransferBagFlowStageKey | null {
  if (!fact) return null
  if (fact.factType === 'BAGGING_CONFIRMED') return 'PACKED'
  if (
    fact.factType === 'INBOUND_CONFIRMED'
    || fact.factType === 'SPECIAL_CRAFT_BAG_RETURNED'
  ) {
    return 'INBOUND_STORED'
  }
  if (fact.factType === 'REPACK_RESULT_CONFIRMED') {
    return 'READY_HANDOVER'
  }
  if (fact.factType === 'REPACK_SOURCE_RETAINED') return 'PACKED'
  if (fact.factType === 'HANDOVER_CONFIRMED') {
    return 'HANDED_OVER_WAITING_RETURN'
  }
  return null
}

function allowedActionsFor(
  mainStatus: TransferBagMainStatusKey,
  flowStage: TransferBagFlowStageKey | null,
): TransferBagLifecycleAction[] {
  if (mainStatus === 'DISABLED') return []
  if (mainStatus === 'IDLE') return ['BAGGING', 'REPACK_TARGET', 'SCRAP']
  if (flowStage === 'PACKED') return ['INBOUND', 'REPACK']
  if (flowStage === 'INBOUND_STORED' || flowStage === 'READY_HANDOVER') {
    return ['REPACK', 'HANDOVER']
  }
  if (flowStage === 'HANDED_OVER_WAITING_RETURN') {
    return ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'FORCE_RETURN']
  }
  return []
}

function buildView(input: {
  carrierId: string
  bagCode: string
  usageCycleId: string | null
  activeHandoverLegId?: string | null
  mainStatus: TransferBagMainStatusKey
  flowStage: TransferBagFlowStageKey | null
  sourceFactIds?: string[]
  compatibilityBlockedReason?: string
}): TransferBagLifecycleView {
  return {
    carrierId: input.carrierId,
    bagCode: input.bagCode,
    usageCycleId: input.usageCycleId,
    activeHandoverLegId: input.activeHandoverLegId || null,
    mainStatus: input.mainStatus,
    mainStatusLabel: TRANSFER_BAG_MAIN_STATUS_META[input.mainStatus].label,
    flowStage: input.flowStage,
    flowStageLabel: input.flowStage
      ? TRANSFER_BAG_FLOW_STAGE_META[input.flowStage].label
      : '—',
    canStartBagging: input.mainStatus === 'IDLE',
    allowedActions: allowedActionsFor(input.mainStatus, input.flowStage),
    sourceFactIds: input.sourceFactIds || [],
    ...(input.compatibilityBlockedReason
      ? { compatibilityBlockedReason: input.compatibilityBlockedReason }
      : {}),
  }
}

export function deriveTransferBagLifecycle(
  input: TransferBagLifecycleInput,
): TransferBagLifecycleView {
  const sortedCycles = sortCycles(input.cycles)
  const latestCycle = sortedCycles.at(-1)
  const sourceEmptiedCycleIds = new Set(
    input.facts
      .filter((fact) => fact.factType === 'REPACK_SOURCE_EMPTIED')
      .map((fact) => fact.usageCycleId)
      .filter((usageCycleId): usageCycleId is string => Boolean(usageCycleId)),
  )
  const openCycles = sortedCycles.filter((cycle) =>
    !cycle.closedAt && !sourceEmptiedCycleIds.has(cycle.usageCycleId),
  )
  const openCycle = openCycles.at(-1)

  const effectiveScrapFact = sortByTimeAndId(
    input.facts.filter((fact) =>
      fact.factType === 'BAG_SCRAPPED'
      && !sortedCycles.some((cycle) =>
        isUsageCycleOpenAt(cycle, input.facts, fact))),
  ).at(-1)

  if (effectiveScrapFact || latestCycle?.closeResult === 'DISABLED') {
    return buildView({
      carrierId: input.carrierId,
      bagCode: input.bagCode,
      usageCycleId:
        effectiveScrapFact?.usageCycleId || latestCycle?.usageCycleId || null,
      mainStatus: 'DISABLED',
      flowStage: null,
      sourceFactIds: effectiveScrapFact ? [effectiveScrapFact.factId] : [],
    })
  }

  if (openCycle) {
    const stageFacts = sortByTimeAndId(
      input.facts.filter((fact) =>
        fact.usageCycleId === openCycle.usageCycleId
        && LIFECYCLE_STAGE_FACT_TYPES.has(fact.factType)),
    )
    const latestStageFact = stageFacts.at(-1)
    const flowStage = stageFromFact(latestStageFact)
    const compatibilityBlockedReason = !flowStage
      ? '当前使用周期缺少可确认的装袋、入仓、分装交出或交出事实，请由主管核查历史记录。'
      : undefined

    return buildView({
      carrierId: input.carrierId,
      bagCode: input.bagCode,
      usageCycleId: openCycle.usageCycleId,
      activeHandoverLegId:
        flowStage === 'HANDED_OVER_WAITING_RETURN'
          ? latestStageFact?.handoverLegId || null
          : null,
      mainStatus: 'IN_USE',
      flowStage,
      sourceFactIds: stageFacts.map((fact) => fact.factId),
      compatibilityBlockedReason,
    })
  }

  return buildView({
    carrierId: input.carrierId,
    bagCode: input.bagCode,
    usageCycleId: null,
    mainStatus: 'IDLE',
    flowStage: null,
  })
}
