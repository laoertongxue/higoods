export type TransferBagMainStatusKey =
  | 'IDLE'
  | 'IN_USE'
  | 'DISABLED'

export type TransferBagFlowStageKey =
  | 'PACKED'
  | 'INBOUND_STORED'
  | 'HANDED_OVER_WAITING_RETURN'

export type TransferBagLifecycleAction =
  | 'BAGGING'
  | 'INBOUND'
  | 'HANDOVER'
  | 'SPECIAL_CRAFT_RETURN'
  | 'PHYSICAL_RETURN'
  | 'SCRAP'

export type TransferBagLifecycleFactType =
  | 'BAGGING_CONFIRMED'
  | 'INBOUND_CONFIRMED'
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
  productionOrderNo?: string
  closedAt?: string
  closeResult?: 'REUSABLE' | 'DISABLED'
}

export interface TransferBagLifecycleFact {
  factId: string
  factType: TransferBagLifecycleFactType
  usageCycleId?: string
  handoverLegId?: string
  occurredAt: string
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
  flowStageLabel: '菲票已装袋' | '入仓暂存中' | '已交出待回收' | '—'
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
  HANDED_OVER_WAITING_RETURN: { label: '已交出待回收' },
} as const satisfies Record<TransferBagFlowStageKey, {
  label: Exclude<TransferBagLifecycleView['flowStageLabel'], '—'>
}>

const LIFECYCLE_STAGE_FACT_TYPES = new Set<TransferBagLifecycleFactType>([
  'BAGGING_CONFIRMED',
  'INBOUND_CONFIRMED',
  'HANDOVER_CONFIRMED',
  'SPECIAL_CRAFT_BAG_RETURNED',
])

function sortByTimeAndId<T extends { occurredAt: string; factId: string }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    const time = left.occurredAt.localeCompare(right.occurredAt)
    return time || left.factId.localeCompare(right.factId)
  })
}

function sortCycles(
  cycles: TransferBagLifecycleCycle[],
): TransferBagLifecycleCycle[] {
  return [...cycles].sort((left, right) => {
    const time = left.startedAt.localeCompare(right.startedAt)
    return time || left.usageCycleId.localeCompare(right.usageCycleId)
  })
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
  if (mainStatus === 'IDLE') return ['BAGGING', 'SCRAP']
  if (flowStage === 'PACKED') return ['INBOUND', 'SCRAP']
  if (flowStage === 'INBOUND_STORED') return ['HANDOVER', 'SCRAP']
  if (flowStage === 'HANDED_OVER_WAITING_RETURN') {
    return ['SPECIAL_CRAFT_RETURN', 'PHYSICAL_RETURN', 'SCRAP']
  }
  return ['SCRAP']
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
  const scrapFact = sortByTimeAndId(
    input.facts.filter((fact) => fact.factType === 'BAG_SCRAPPED'),
  ).at(-1)

  if (scrapFact || latestCycle?.closeResult === 'DISABLED') {
    return buildView({
      carrierId: input.carrierId,
      bagCode: input.bagCode,
      usageCycleId: scrapFact?.usageCycleId || latestCycle?.usageCycleId || null,
      mainStatus: 'DISABLED',
      flowStage: null,
      sourceFactIds: scrapFact ? [scrapFact.factId] : [],
    })
  }

  const openCycles = sortedCycles.filter((cycle) => !cycle.closedAt)
  const openCycle = openCycles.at(-1)
  if (!openCycle) {
    return buildView({
      carrierId: input.carrierId,
      bagCode: input.bagCode,
      usageCycleId: null,
      mainStatus: 'IDLE',
      flowStage: null,
    })
  }

  const stageFacts = sortByTimeAndId(
    input.facts.filter((fact) =>
      fact.usageCycleId === openCycle.usageCycleId
      && LIFECYCLE_STAGE_FACT_TYPES.has(fact.factType)),
  )
  const latestStageFact = stageFacts.at(-1)
  const flowStage = stageFromFact(latestStageFact)
  const compatibilityBlockedReason = !flowStage
    ? '当前使用周期缺少可确认的装袋、入仓或交出事实，请由主管核查历史记录。'
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
