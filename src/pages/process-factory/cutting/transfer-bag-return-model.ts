import {
  buildTransferBagNavigationPayload,
  deriveTransferBagMasterStatus,
  type TransferBagCleanlinessStatus,
  type TransferBagConditionRecord,
  type TransferBagConditionStatus,
  type TransferBagDiscrepancyType,
  type TransferBagMaster,
  type TransferBagMasterStatusKey,
  type TransferBagNavigationPayload,
  type TransferBagReturnAuditTrail,
  type TransferBagReturnReceipt,
  type TransferBagReusableDecision,
  type TransferBagReuseCycleSummary,
  type TransferBagStore,
  type TransferBagSummaryMeta,
  type TransferBagUsage,
  type TransferBagUsageClosureResult,
  type TransferBagUsageItem,
  type TransferBagValidationResult,
  type TransferBagViewModel,
} from './transfer-bags-model'

interface ReturnDecisionMeta {
  reusableDecision: TransferBagReusableDecision
  nextBagStatus: TransferBagMasterStatusKey
  label: string
  className: string
  detailText: string
}

interface ReturnExceptionMeta {
  label: string
  className: string
  detailText: string
}

export interface TransferBagReturnUsageItem extends TransferBagUsageItem {
  bagStatusMeta: TransferBagSummaryMeta<TransferBagMasterStatusKey> | null
  latestReturnReceipt: TransferBagReturnReceipt | null
  latestConditionRecord: TransferBagConditionRecord | null
  latestClosureResult: TransferBagUsageClosureResult | null
  returnEligibility: TransferBagValidationResult
  returnExceptionMeta: ReturnExceptionMeta | null
}

export interface TransferBagReuseCycleItem extends TransferBagReuseCycleSummary {
  latestUsage: TransferBagUsage | null
  latestReturnReceipt: TransferBagReturnReceipt | null
  latestConditionRecord: TransferBagConditionRecord | null
  bagStatusMeta: TransferBagSummaryMeta<TransferBagMasterStatusKey>
}

export interface TransferBagConditionDecisionItem extends TransferBagConditionRecord {
  latestUsage: TransferBagUsage | null
  bagMaster: TransferBagMaster | null
  decisionMeta: ReturnDecisionMeta
  returnExceptionMeta: ReturnExceptionMeta | null
}

export interface TransferBagReturnViewModel {
  summary: {
    waitingReturnUsageCount: number
    inspectingUsageCount: number
    closedUsageCount: number
    reusableBagCount: number
    waitingCleaningBagCount: number
    waitingRepairBagCount: number
  }
  waitingReturnUsages: TransferBagReturnUsageItem[]
  returnReceiptsByUsageId: Record<string, TransferBagReturnReceipt[]>
  conditionRecordsByUsageId: Record<string, TransferBagConditionRecord[]>
  closureResultsByUsageId: Record<string, TransferBagUsageClosureResult[]>
  returnAuditTrailByUsageId: Record<string, TransferBagReturnAuditTrail[]>
  reuseCycles: TransferBagReuseCycleItem[]
  conditionItems: TransferBagConditionDecisionItem[]
}

const discrepancyMetaMap: Record<TransferBagDiscrepancyType, ReturnExceptionMeta | null> = {
  NONE: null,
  QTY_MISMATCH: {
    label: '数量异常',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '回货数量与发出清单不一致，需要留痕说明。',
  },
  DAMAGED_BAG: {
    label: '口袋损坏',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '回仓时发现口袋损坏，需要结合袋况决定是否维修。',
  },
  LATE_RETURN: {
    label: '迟归还',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '回货时间晚于当前排定周期，需要保留说明。',
  },
  MISSING_RECORD: {
    label: '缺记录',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '当前回货资料不完整，需要补录后再闭环。',
  },
}

function sortByLatest<T extends { [key: string]: unknown }>(items: T[], key: keyof T): T[] {
  return items.slice().sort((left, right) => String(right[key] || '').localeCompare(String(left[key] || ''), 'zh-CN'))
}

function buildEmptyCollectionMap<T extends { usageId: string }>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((result, item) => {
    if (!result[item.usageId]) result[item.usageId] = []
    result[item.usageId].push(item)
    return result
  }, {})
}

export function deriveReturnEligibility(options: {
  usage: TransferBagUsage | null
  bag: TransferBagMaster | null
  latestClosureResult?: TransferBagUsageClosureResult | null
}): TransferBagValidationResult {
  if (!options.usage) return { ok: false, reason: '当前没有可回货的 usage。' }
  if (!options.bag) return { ok: false, reason: '当前 usage 缺少对应 bag 主档。' }
  if (options.latestClosureResult) return { ok: false, reason: '当前 usage 已关闭，不能重复进入回货流程。' }
  if (!['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(options.usage.usageStatus)) {
    return { ok: false, reason: '当前 usage 尚未进入可回货状态。' }
  }
  return { ok: true, reason: '' }
}

export function createReturnReceiptDraft(options: {
  usage: TransferBagUsage
  bindingsCount: number
  originalCutOrderCount: number
  nowText: string
}): TransferBagReturnReceipt {
  return {
    returnReceiptId: `return-draft-${options.usage.usageId}`,
    usageId: options.usage.usageId,
    usageNo: options.usage.usageNo,
    bagId: options.usage.bagId,
    bagCode: options.usage.bagCode,
    sewingTaskId: options.usage.sewingTaskId,
    sewingTaskNo: options.usage.sewingTaskNo,
    returnWarehouseName: '裁片仓返仓口',
    returnAt: options.nowText,
    returnedBy: '',
    receivedBy: '',
    returnedFinishedQty: options.bindingsCount,
    returnedTicketCountSummary: options.bindingsCount,
    returnedOriginalCutOrderCount: options.originalCutOrderCount,
    discrepancyType: 'NONE',
    discrepancyNote: '',
    note: '回货验收草稿已创建，等待补充返仓信息。',
  }
}

export function validateReturnReceiptPayload(options: {
  usage: TransferBagUsage | null
  bag: TransferBagMaster | null
  receipt: TransferBagReturnReceipt
  condition: TransferBagConditionRecord
}): TransferBagValidationResult {
  const eligibility = deriveReturnEligibility({ usage: options.usage, bag: options.bag })
  if (!eligibility.ok) return eligibility
  if (!options.receipt.returnWarehouseName.trim()) return { ok: false, reason: '请填写回货入仓点。' }
  if (!options.receipt.returnAt.trim()) return { ok: false, reason: '请填写回货时间。' }
  if (!options.receipt.returnedBy.trim()) return { ok: false, reason: '请填写回货人。' }
  if (!options.receipt.receivedBy.trim()) return { ok: false, reason: '请填写接收人。' }
  if (!Number.isFinite(options.receipt.returnedFinishedQty) || options.receipt.returnedFinishedQty < 0) {
    return { ok: false, reason: '回货成衣数量必须是非负数。' }
  }
  if (!Number.isFinite(options.receipt.returnedTicketCountSummary) || options.receipt.returnedTicketCountSummary < 0) {
    return { ok: false, reason: '回货 ticket 数必须是非负数。' }
  }
  if (options.receipt.discrepancyType !== 'NONE' && !options.receipt.discrepancyNote.trim()) {
    return { ok: false, reason: '存在差异时请补充差异说明。' }
  }
  if (options.condition.reusableDecision === 'DISABLED' && !options.condition.note.trim()) {
    return { ok: false, reason: '标记停用 / 报废时请填写说明。' }
  }
  return { ok: true, reason: '' }
}

export function deriveBagConditionDecision(options: {
  conditionStatus: TransferBagConditionStatus
  cleanlinessStatus: TransferBagCleanlinessStatus
  damageType?: string
  repairNeeded: boolean
}): ReturnDecisionMeta {
  if (options.conditionStatus === 'SEVERE_DAMAGE' || options.damageType?.includes('报废')) {
    return {
      reusableDecision: 'DISABLED',
      nextBagStatus: 'DISABLED',
      label: '停用 / 报废',
      className: 'bg-slate-200 text-slate-700 border border-slate-300',
      detailText: '袋况严重损坏，当前轮次关闭后不再进入复用链路。',
    }
  }

  if (options.repairNeeded || options.conditionStatus === 'MINOR_DAMAGE') {
    return {
      reusableDecision: 'WAITING_REPAIR',
      nextBagStatus: 'WAITING_REPAIR',
      label: '待维修',
      className: 'bg-rose-100 text-rose-700 border border-rose-200',
      detailText: '袋况存在损坏，需维修确认后再决定是否可复用。',
    }
  }

  if (options.cleanlinessStatus === 'DIRTY') {
    return {
      reusableDecision: 'WAITING_CLEANING',
      nextBagStatus: 'WAITING_CLEANING',
      label: '待清洁',
      className: 'bg-sky-100 text-sky-700 border border-sky-200',
      detailText: '当前袋况可保留，但需先清洁后才能重新发放。',
    }
  }

  return {
    reusableDecision: 'REUSABLE',
    nextBagStatus: 'REUSABLE',
    label: '可复用',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '回货验收已完成，当前口袋可以进入下一轮 usage。',
  }
}

export function closeTransferBagUsageCycle(options: {
  usage: TransferBagUsage
  bag: TransferBagMaster
  receipt: TransferBagReturnReceipt
  condition: TransferBagConditionRecord
  nowText: string
  closedBy: string
}): TransferBagUsageClosureResult {
  const decision = deriveBagConditionDecision({
    conditionStatus: options.condition.conditionStatus,
    cleanlinessStatus: options.condition.cleanlinessStatus,
    damageType: options.condition.damageType,
    repairNeeded: options.condition.repairNeeded,
  })
  const warningMessages: string[] = []
  if (options.receipt.discrepancyType !== 'NONE') {
    warningMessages.push('本次回货存在差异，已按异常闭环记录。')
  }
  if (decision.nextBagStatus !== 'REUSABLE') {
    warningMessages.push(`当前 bag 关闭后进入“${decision.label}”状态。`)
  }
  return {
    closureId: `closure-${Date.now()}`,
    usageId: options.usage.usageId,
    usageNo: options.usage.usageNo,
    closedAt: options.nowText,
    closedBy: options.closedBy,
    closureStatus: warningMessages.length ? 'EXCEPTION_CLOSED' : 'CLOSED',
    nextBagStatus: decision.nextBagStatus,
    reason: warningMessages.length ? '当前 usage 在存在差异或袋况异常的前提下完成关闭。' : '当前 usage 已完成回货验收并正式关闭。',
    warningMessages,
  }
}

export function buildReuseCycleSummary(options: {
  bag: TransferBagMaster
  usages: TransferBagUsage[]
  returnReceipts: TransferBagReturnReceipt[]
  closureResults: TransferBagUsageClosureResult[]
}): TransferBagReuseCycleSummary {
  const relatedUsages = sortByLatest(options.usages.filter((item) => item.bagId === options.bag.bagId), 'usageNo')
  const relatedReceipts = sortByLatest(options.returnReceipts.filter((item) => item.bagId === options.bag.bagId), 'returnAt')
  const relatedClosures = sortByLatest(
    options.closureResults.filter((item) => relatedUsages.some((usage) => usage.usageId === item.usageId)),
    'closedAt',
  )
  const latestUsage = relatedUsages[0]
  const latestClosure = relatedClosures[0]
  const openUsage = relatedUsages.find((item) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus))
  return {
    cycleSummaryId: `cycle-${options.bag.bagId}`,
    bagId: options.bag.bagId,
    bagCode: options.bag.bagCode,
    latestUsageId: latestUsage?.usageId || options.bag.latestUsageId,
    latestUsageNo: latestUsage?.usageNo || options.bag.latestUsageNo,
    totalUsageCount: relatedUsages.length,
    totalDispatchCount: relatedUsages.filter((item) => Boolean(item.dispatchAt)).length,
    totalReturnCount: relatedReceipts.length,
    lastDispatchedAt: latestUsage?.dispatchAt || '',
    lastReturnedAt: relatedReceipts[0]?.returnAt || '',
    currentReusableStatus: latestClosure?.nextBagStatus || options.bag.currentStatus,
    currentLocation: options.bag.currentLocation,
    currentOpenUsageId: openUsage?.usageId || '',
    note: latestClosure ? latestClosure.reason : '当前 bag 尚未形成完整回货闭环。',
  }
}

export function buildReturnExceptionMeta(discrepancyType: TransferBagDiscrepancyType): ReturnExceptionMeta | null {
  return discrepancyMetaMap[discrepancyType] ?? null
}

export function buildReturnNavigationPayload(options: {
  originalCutOrderNo?: string
  productionOrderNo?: string
  mergeBatchNo?: string
  bagCode?: string
  usageNo?: string
  sewingTaskNo?: string
  ticketNo?: string
}): TransferBagNavigationPayload {
  return buildTransferBagNavigationPayload({
    originalCutOrderNo: options.originalCutOrderNo,
    productionOrderNo: options.productionOrderNo,
    mergeBatchNo: options.mergeBatchNo,
    bagCode: options.bagCode,
    usageNo: options.usageNo,
    sewingTaskNo: options.sewingTaskNo,
  })
}

export function buildBagReturnAuditTrail(options: {
  usageId: string
  action: string
  actionAt: string
  actionBy: string
  payloadSummary: string
  note: string
}): TransferBagReturnAuditTrail {
  return {
    auditTrailId: `return-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    usageId: options.usageId,
    action: options.action,
    actionAt: options.actionAt,
    actionBy: options.actionBy,
    payloadSummary: options.payloadSummary,
    note: options.note,
  }
}

export function buildTransferBagReturnViewModel(options: {
  store: TransferBagStore
  baseViewModel: TransferBagViewModel
}): TransferBagReturnViewModel {
  const returnReceiptsByUsageId = buildEmptyCollectionMap(options.store.returnReceipts)
  const conditionRecordsByUsageId = buildEmptyCollectionMap(options.store.conditionRecords)
  const closureResultsByUsageId = buildEmptyCollectionMap(options.store.closureResults)
  const returnAuditTrailByUsageId = buildEmptyCollectionMap(options.store.returnAuditTrail)

  const waitingReturnUsages = options.baseViewModel.usages
    .map((usage) => {
      const latestReturnReceipt = sortByLatest(returnReceiptsByUsageId[usage.usageId] || [], 'returnAt')[0] || null
      const latestConditionRecord = sortByLatest(conditionRecordsByUsageId[usage.usageId] || [], 'inspectedAt')[0] || null
      const latestClosureResult = sortByLatest(closureResultsByUsageId[usage.usageId] || [], 'closedAt')[0] || null
      return {
        ...usage,
        bagStatusMeta: usage.bagMaster ? deriveTransferBagMasterStatus(usage.bagMaster.currentStatus) : null,
        latestReturnReceipt,
        latestConditionRecord,
        latestClosureResult,
        returnEligibility: deriveReturnEligibility({
          usage,
          bag: usage.bagMaster,
          latestClosureResult,
        }),
        returnExceptionMeta: buildReturnExceptionMeta(latestReturnReceipt?.discrepancyType || 'NONE'),
      }
    })
    .sort((left, right) => right.usageNo.localeCompare(left.usageNo, 'zh-CN'))

  const reuseCycles = options.store.masters
    .map((bag) => {
      const cycle = buildReuseCycleSummary({
        bag,
        usages: options.store.usages,
        returnReceipts: options.store.returnReceipts,
        closureResults: options.store.closureResults,
      })
      const latestUsage = options.store.usages.find((item) => item.usageId === cycle.latestUsageId) || null
      const latestReturnReceipt = sortByLatest(options.store.returnReceipts.filter((item) => item.bagId === bag.bagId), 'returnAt')[0] || null
      const latestConditionRecord = sortByLatest(options.store.conditionRecords.filter((item) => item.bagId === bag.bagId), 'inspectedAt')[0] || null
      return {
        ...cycle,
        latestUsage,
        latestReturnReceipt,
        latestConditionRecord,
        bagStatusMeta: deriveTransferBagMasterStatus(cycle.currentReusableStatus),
      }
    })
    .sort((left, right) => left.bagCode.localeCompare(right.bagCode, 'zh-CN'))

  const conditionItems = sortByLatest(options.store.conditionRecords, 'inspectedAt')
    .map((record) => ({
      ...record,
      latestUsage: options.store.usages.find((item) => item.usageId === record.usageId) || null,
      bagMaster: options.store.masters.find((item) => item.bagId === record.bagId) || null,
      decisionMeta: deriveBagConditionDecision({
        conditionStatus: record.conditionStatus,
        cleanlinessStatus: record.cleanlinessStatus,
        damageType: record.damageType,
        repairNeeded: record.repairNeeded,
      }),
      returnExceptionMeta: buildReturnExceptionMeta(
        sortByLatest(returnReceiptsByUsageId[record.usageId] || [], 'returnAt')[0]?.discrepancyType || 'NONE',
      ),
    }))

  return {
    summary: {
      waitingReturnUsageCount: waitingReturnUsages.filter((item) => ['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN'].includes(item.usageStatus)).length,
      inspectingUsageCount: waitingReturnUsages.filter((item) => item.usageStatus === 'RETURN_INSPECTING').length,
      closedUsageCount: waitingReturnUsages.filter((item) => ['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus)).length,
      reusableBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'REUSABLE').length,
      waitingCleaningBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'WAITING_CLEANING').length,
      waitingRepairBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'WAITING_REPAIR').length,
    },
    waitingReturnUsages,
    returnReceiptsByUsageId,
    conditionRecordsByUsageId,
    closureResultsByUsageId,
    returnAuditTrailByUsageId,
    reuseCycles,
    conditionItems,
  }
}
