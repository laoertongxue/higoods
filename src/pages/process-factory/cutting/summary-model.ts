import type {
  ProductionProgressRow,
  ProductionProgressStageKey,
} from './production-progress-model'
import type { OriginalCutOrderRow } from './original-orders-model'
import type { MaterialPrepRow } from './material-prep-model'
import type { MarkerSpreadingStore, SpreadingSession } from './marker-spreading-model'
import type { MergeBatchRecord } from './merge-batches-model'
import type {
  FeiTicketsViewModel,
  FeiTicketLabelRecord,
  FeiTicketPrintJob,
  OriginalCutOrderTicketOwner,
} from './fei-tickets-model'
import type {
  FabricWarehouseStockItem,
  FabricWarehouseViewModel,
} from './fabric-warehouse-model'
import type {
  CutPieceWarehouseItem,
  CutPieceWarehouseViewModel,
} from './cut-piece-warehouse-model'
import type {
  SampleWarehouseItem,
  SampleWarehouseViewModel,
} from './sample-warehouse-model'
import type {
  TransferBagBindingItem,
  TransferBagUsageItem,
  TransferBagViewModel,
} from './transfer-bags-model'
import type {
  TransferBagConditionDecisionItem,
  TransferBagReuseCycleItem,
  TransferBagReturnUsageItem,
  TransferBagReturnViewModel,
} from './transfer-bag-return-model'
import type {
  ReplenishmentSuggestionRow,
  ReplenishmentViewModel,
} from './replenishment-model'
import type {
  SpecialProcessRow,
  SpecialProcessViewModel,
} from './special-processes-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type CuttingSummaryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type CuttingSummaryIssueType =
  | 'MATERIAL_PREP'
  | 'SPREADING_REPLENISH'
  | 'TICKET_QR'
  | 'WAREHOUSE_HANDOFF'
  | 'SPECIAL_PROCESS'

export interface CuttingSummaryRiskMeta {
  key: CuttingSummaryRiskLevel
  label: string
  className: string
  detailText: string
}

export interface CuttingSummaryIssueMeta {
  key: CuttingSummaryIssueType
  label: string
  className: string
  detailText: string
  actionHint: string
}

export interface CuttingSummaryNavigationPayload {
  productionProgress: Record<string, string | undefined>
  cuttablePool: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  feiTickets: Record<string, string | undefined>
  fabricWarehouse: Record<string, string | undefined>
  cutPieceWarehouse: Record<string, string | undefined>
  sampleWarehouse: Record<string, string | undefined>
  transferBags: Record<string, string | undefined>
  replenishment: Record<string, string | undefined>
  specialProcesses: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export interface CuttingSummaryRow {
  rowId: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  currentStageKey: ProductionProgressStageKey | 'UNKNOWN'
  currentStageLabel: string
  originalCutOrderCount: number
  mergeBatchCount: number
  progressSummary: string
  materialPrepSummary: string
  spreadingSummary: string
  replenishmentSummary: string
  ticketSummary: string
  warehouseSummary: string
  bagUsageSummary: string
  specialProcessSummary: string
  overallRiskLevel: CuttingSummaryRiskLevel
  riskTags: string[]
  issueTypes: CuttingSummaryIssueType[]
  relatedOriginalCutOrderNos: string[]
  relatedMergeBatchNos: string[]
  relatedTicketNos: string[]
  relatedBagCodes: string[]
  relatedUsageNos: string[]
  relatedSuggestionIds: string[]
  relatedProcessOrderNos: string[]
  relatedMaterialSkus: string[]
  latestPrintJobNo: string
  qrSchemaVersions: string[]
  unprintedOwnerCount: number
  pendingReplenishmentCount: number
  warehouseIssueCount: number
  openBagUsageCount: number
  openSpecialProcessCount: number
  keywordIndex: string[]
  navigationPayload: CuttingSummaryNavigationPayload
}

export interface CuttingSummaryIssue {
  issueId: string
  issueType: CuttingSummaryIssueType
  severity: CuttingSummaryRiskLevel
  relatedRowIds: string[]
  relatedProductionOrderNos: string[]
  relatedOriginalCutOrderNos: string[]
  relatedMergeBatchNos: string[]
  relatedUsageNos: string[]
  relatedProcessOrderNos: string[]
  summary: string
  actionHint: string
}

export interface CuttingSummaryTraceNode {
  nodeId: string
  nodeType:
    | 'production-order'
    | 'original-cut-order'
    | 'merge-batch'
    | 'ticket'
    | 'bag-usage'
    | 'replenishment'
    | 'special-process'
  nodeLabel: string
  relatedIds: string[]
  status: string
  children: CuttingSummaryTraceNode[]
}

export interface CuttingSummaryDashboardSummary {
  productionOrderCount: number
  originalCutOrderCount: number
  mergeBatchCount: number
  openReplenishmentCount: number
  openSpecialProcessCount: number
  ticketPrintedCount: number
  unprintedOwnerCount: number
  bagOpenUsageCount: number
  warehouseIssueCount: number
  highRiskCount: number
  issueCount: number
}

export interface CuttingSummaryDashboardCard {
  key: string
  label: string
  value: number
  hint: string
  accentClass: string
  filterType?: 'risk' | 'issue' | 'pending-replenishment' | 'pending-ticket' | 'pending-bag' | 'special-process'
  filterValue?: string
}

export interface CuttingSummaryDetailPanelData {
  row: CuttingSummaryRow
  productionRow: ProductionProgressRow | null
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  materialPrepRows: MaterialPrepRow[]
  spreadingSessions: SpreadingSession[]
  ticketOwners: OriginalCutOrderTicketOwner[]
  ticketRecords: FeiTicketLabelRecord[]
  printJobs: FeiTicketPrintJob[]
  fabricStocks: FabricWarehouseStockItem[]
  cutPieceItems: CutPieceWarehouseItem[]
  sampleItems: SampleWarehouseItem[]
  bagUsages: TransferBagUsageItem[]
  returnUsages: TransferBagReturnUsageItem[]
  bagBindings: TransferBagBindingItem[]
  reuseCycles: TransferBagReuseCycleItem[]
  conditionItems: TransferBagConditionDecisionItem[]
  replenishments: ReplenishmentSuggestionRow[]
  specialProcesses: SpecialProcessRow[]
  traceTree: CuttingSummaryTraceNode[]
  navigationPayload: CuttingSummaryNavigationPayload
}

export interface CuttingSummarySearchIndexEntry {
  rowId: string
  tokens: string[]
}

export interface CuttingSummaryViewModel {
  dashboard: CuttingSummaryDashboardSummary
  dashboardCards: CuttingSummaryDashboardCard[]
  rows: CuttingSummaryRow[]
  rowsById: Record<string, CuttingSummaryRow>
  issues: CuttingSummaryIssue[]
  issuesById: Record<string, CuttingSummaryIssue>
  searchIndex: CuttingSummarySearchIndexEntry[]
}

export interface CuttingSummaryBuildOptions {
  productionRows: ProductionProgressRow[]
  originalRows: OriginalCutOrderRow[]
  materialPrepRows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
  feiViewModel: FeiTicketsViewModel
  fabricWarehouseView: FabricWarehouseViewModel
  cutPieceWarehouseView: CutPieceWarehouseViewModel
  sampleWarehouseView: SampleWarehouseViewModel
  transferBagView: TransferBagViewModel
  transferBagReturnView: TransferBagReturnViewModel
  replenishmentView: ReplenishmentViewModel
  specialProcessView: SpecialProcessViewModel
}

export const cuttingSummaryRiskMetaMap: Record<CuttingSummaryRiskLevel, CuttingSummaryRiskMeta> = {
  HIGH: {
    key: 'HIGH',
    label: '高风险',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前链路存在明显异常，建议优先处理。',
  },
  MEDIUM: {
    key: 'MEDIUM',
    label: '中风险',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前链路存在待处理事项，需要继续跟进。',
  },
  LOW: {
    key: 'LOW',
    label: '低风险',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前链路基本顺畅，仅需常规观察。',
  },
}

export const cuttingSummaryIssueMetaMap: Record<CuttingSummaryIssueType, CuttingSummaryIssueMeta> = {
  MATERIAL_PREP: {
    key: 'MATERIAL_PREP',
    label: '配料 / 领料问题',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '审核未完成、配料未齐或领料不齐。',
    actionHint: '去仓库配料 / 领料',
  },
  SPREADING_REPLENISH: {
    key: 'SPREADING_REPLENISH',
    label: '铺布 / 补料问题',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '铺布差异、补料待审核或待回写。',
    actionHint: '去唛架 / 铺布或补料管理',
  },
  TICKET_QR: {
    key: 'TICKET_QR',
    label: '打票 / 二维码问题',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
    detailText: '待打票、部分已打票或二维码兼容警告。',
    actionHint: '去菲票 / 打编号',
  },
  WAREHOUSE_HANDOFF: {
    key: 'WAREHOUSE_HANDOFF',
    label: '仓储 / 交接问题',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '待入仓、待交接、待回仓或袋况异常。',
    actionHint: '去裁片仓或周转口袋 / 车缝交接',
  },
  SPECIAL_PROCESS: {
    key: 'SPECIAL_PROCESS',
    label: '特殊工艺问题',
    className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
    detailText: '捆条等特殊工艺待执行、执行中或异常。',
    actionHint: '去特殊工艺',
  },
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function lowerKeywordIndex(values: Array<string | undefined>): string[] {
  return uniqueStrings(values).map((value) => value.toLowerCase())
}

function formatCount(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

function summarizeTicketStatus(owners: OriginalCutOrderTicketOwner[], records: FeiTicketLabelRecord[]): string {
  if (!owners.length) return '待建立票据主体'
  const planned = owners.reduce((sum, owner) => sum + owner.plannedTicketQty, 0)
  const printed = records.length
  const pendingOwners = owners.filter((owner) => !['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)).length
  const partialOwners = owners.filter((owner) => owner.ticketStatus === 'PARTIAL_PRINTED').length
  return `${formatCount(printed)}/${formatCount(planned)} 已打票 · 待处理主体 ${pendingOwners}${partialOwners ? ` · 部分已打票 ${partialOwners}` : ''}`
}

function summarizeWarehouseStatus(options: {
  fabricStocks: FabricWarehouseStockItem[]
  cutPieceItems: CutPieceWarehouseItem[]
  sampleItems: SampleWarehouseItem[]
}): string {
  const lowRemaining = options.fabricStocks.filter((item) => item.riskTags.some((tag) => tag.key === 'LOW_REMAINING')).length
  const waitingInbound = options.cutPieceItems.filter((item) => item.warehouseStatus.key === 'PENDING_INBOUND').length
  const waitingHandoff = options.cutPieceItems.filter((item) => item.handoffStatus.key === 'WAITING_HANDOVER').length
  const sampleFlowing = options.sampleItems.filter((item) => item.status.key !== 'AVAILABLE').length

  return [
    waitingInbound ? `待入仓 ${waitingInbound}` : '',
    waitingHandoff ? `待交接 ${waitingHandoff}` : '',
    lowRemaining ? `低余量 ${lowRemaining}` : '',
    sampleFlowing ? `样衣流转 ${sampleFlowing}` : '',
  ]
    .filter(Boolean)
    .join(' / ') || '仓务正常'
}

function summarizeBagUsageStatus(usages: TransferBagUsageItem[], returnUsages: TransferBagReturnUsageItem[]): string {
  if (!usages.length && !returnUsages.length) return '未进入周转交接'
  const waitingDispatch = usages.filter((usage) => usage.usageStatus === 'READY_TO_DISPATCH').length
  const waitingReturn = returnUsages.filter((usage) => ['WAITING_RETURN', 'RETURN_INSPECTING'].includes(usage.usageStatus)).length
  const closed = returnUsages.filter((usage) => ['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus)).length
  return [
    waitingDispatch ? `待交接 ${waitingDispatch}` : '',
    waitingReturn ? `待回仓 ${waitingReturn}` : '',
    closed ? `已闭环 ${closed}` : '',
  ]
    .filter(Boolean)
    .join(' / ') || '装袋中'
}

function summarizeMaterialPrep(rows: MaterialPrepRow[]): string {
  if (!rows.length) return '未进入配料 / 领料'
  const configured = rows.filter((row) => row.materialPrepStatus.key === 'CONFIGURED').length
  const partial = rows.filter((row) => row.materialPrepStatus.key === 'PARTIAL').length
  const claimException = rows.filter((row) => row.materialClaimStatus.key === 'EXCEPTION').length
  const auditPending = rows.filter((row) => row.materialAuditStatus.key !== 'APPROVED').length
  return [
    `已配置 ${configured}/${rows.length}`,
    partial ? `部分配置 ${partial}` : '',
    claimException ? `领料异常 ${claimException}` : '',
    auditPending ? `待审核 ${auditPending}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function summarizeSpreading(sessions: SpreadingSession[], replenishments: ReplenishmentSuggestionRow[]): string {
  if (!sessions.length) {
    const pending = replenishments.filter((item) => ['PENDING_REVIEW', 'PENDING_SUPPLEMENT', 'APPROVED'].includes(item.statusMeta.key)).length
    return pending ? `待补料确认 ${pending}` : '未进入铺布'
  }

  const doneCount = sessions.filter((session) => session.status === 'DONE').length
  const warningCount = replenishments.filter((item) => item.riskLevel === 'HIGH' || item.statusMeta.key === 'PENDING_SUPPLEMENT').length
  return [
    `铺布记录 ${sessions.length}`,
    doneCount ? `已完成 ${doneCount}` : '',
    warningCount ? `差异预警 ${warningCount}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function summarizeReplenishment(items: ReplenishmentSuggestionRow[]): string {
  if (!items.length) return '暂无补料建议'
  const openCount = items.filter((item) => !['NO_ACTION', 'REJECTED', 'APPLIED'].includes(item.statusMeta.key)).length
  const appliedCount = items.filter((item) => item.statusMeta.key === 'APPLIED').length
  const highRiskCount = items.filter((item) => item.riskLevel === 'HIGH').length
  return [
    `建议 ${items.length}`,
    openCount ? `待处理 ${openCount}` : '',
    appliedCount ? `已回写 ${appliedCount}` : '',
    highRiskCount ? `高风险 ${highRiskCount}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function summarizeSpecialProcess(items: SpecialProcessRow[]): string {
  if (!items.length) return '无特殊工艺单'
  const pendingCount = items.filter((item) => ['DRAFT', 'PENDING_EXECUTION'].includes(item.status)).length
  const inProgressCount = items.filter((item) => item.status === 'IN_PROGRESS').length
  const doneCount = items.filter((item) => item.status === 'DONE').length
  return [
    `工艺单 ${items.length}`,
    pendingCount ? `待执行 ${pendingCount}` : '',
    inProgressCount ? `执行中 ${inProgressCount}` : '',
    doneCount ? `已完成 ${doneCount}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function buildIssueTags(options: {
  materialPrepRows: MaterialPrepRow[]
  replenishments: ReplenishmentSuggestionRow[]
  ticketOwners: OriginalCutOrderTicketOwner[]
  ticketRecords: FeiTicketLabelRecord[]
  cutPieceItems: CutPieceWarehouseItem[]
  bagUsages: TransferBagUsageItem[]
  returnUsages: TransferBagReturnUsageItem[]
  conditionItems: TransferBagConditionDecisionItem[]
  specialProcesses: SpecialProcessRow[]
}): CuttingSummaryIssueType[] {
  const issueTypes: CuttingSummaryIssueType[] = []

  if (
    options.materialPrepRows.some(
      (row) =>
        row.materialAuditStatus.key !== 'APPROVED' ||
        row.materialPrepStatus.key !== 'CONFIGURED' ||
        row.materialClaimStatus.key !== 'RECEIVED',
    )
  ) {
    issueTypes.push('MATERIAL_PREP')
  }

  if (
    options.replenishments.some((item) => !['NO_ACTION', 'REJECTED', 'APPLIED'].includes(item.statusMeta.key)) ||
    options.replenishments.some((item) => item.riskLevel !== 'LOW')
  ) {
    issueTypes.push('SPREADING_REPLENISH')
  }

  if (
    options.ticketOwners.some((owner) => !['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)) ||
    options.ticketRecords.some((record) => !record.schemaVersion)
  ) {
    issueTypes.push('TICKET_QR')
  }

  if (
    options.cutPieceItems.some((item) => item.warehouseStatus.key === 'PENDING_INBOUND' || item.handoffStatus.key === 'WAITING_HANDOVER') ||
    options.bagUsages.some((usage) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus)) ||
    options.returnUsages.some((usage) => ['WAITING_RETURN', 'RETURN_INSPECTING'].includes(usage.usageStatus)) ||
    options.conditionItems.some((item) => item.decisionMeta.reusableDecision !== 'REUSABLE')
  ) {
    issueTypes.push('WAREHOUSE_HANDOFF')
  }

  if (options.specialProcesses.some((item) => !['DONE', 'CANCELLED'].includes(item.status))) {
    issueTypes.push('SPECIAL_PROCESS')
  }

  return issueTypes
}

export function deriveOverallRiskLevel(options: {
  productionRow: ProductionProgressRow
  materialPrepRows: MaterialPrepRow[]
  replenishments: ReplenishmentSuggestionRow[]
  ticketOwners: OriginalCutOrderTicketOwner[]
  cutPieceItems: CutPieceWarehouseItem[]
  returnUsages: TransferBagReturnUsageItem[]
  conditionItems: TransferBagConditionDecisionItem[]
  specialProcesses: SpecialProcessRow[]
}): CuttingSummaryRiskLevel {
  let highScore = 0
  let mediumScore = 0

  if (options.productionRow.riskTags.some((tag) => ['RECEIVE_EXCEPTION', 'REPLENISH_PENDING'].includes(tag.key))) {
    highScore += 1
  }
  if (options.materialPrepRows.some((row) => row.materialClaimStatus.key === 'EXCEPTION')) highScore += 1
  if (options.replenishments.some((item) => item.riskLevel === 'HIGH')) highScore += 2
  if (options.replenishments.some((item) => ['PENDING_REVIEW', 'PENDING_SUPPLEMENT'].includes(item.statusMeta.key))) mediumScore += 1
  if (options.ticketOwners.some((owner) => ['NOT_GENERATED', 'PENDING_SUPPLEMENT'].includes(owner.ticketStatus))) mediumScore += 1
  if (options.ticketOwners.some((owner) => owner.ticketStatus === 'PARTIAL_PRINTED')) mediumScore += 1
  if (options.cutPieceItems.some((item) => item.warehouseStatus.key === 'PENDING_INBOUND' || item.handoffStatus.key === 'WAITING_HANDOVER')) mediumScore += 1
  if (options.returnUsages.some((item) => item.returnExceptionMeta || item.latestClosureResult?.closureStatus === 'EXCEPTION_CLOSED')) highScore += 1
  if (options.conditionItems.some((item) => item.decisionMeta.reusableDecision !== 'REUSABLE')) mediumScore += 1
  if (options.specialProcesses.some((item) => item.status === 'IN_PROGRESS' || item.status === 'PENDING_EXECUTION')) mediumScore += 1

  if (highScore >= 2 || (highScore >= 1 && mediumScore >= 2)) return 'HIGH'
  if (highScore >= 1 || mediumScore >= 1 || options.productionRow.riskTags.length) return 'MEDIUM'
  return 'LOW'
}

export function buildSummaryNavigationPayload(options: {
  productionOrderNo: string
  originalCutOrderNos: string[]
  mergeBatchNos: string[]
  materialSkus: string[]
  styleCode: string
  ticketNos: string[]
  bagCodes: string[]
  usageNos: string[]
  processOrderNos: string[]
  suggestionIds: string[]
}): CuttingSummaryNavigationPayload {
  const firstOriginalCutOrderNo = options.originalCutOrderNos[0]
  const firstMergeBatchNo = options.mergeBatchNos[0]
  const firstMaterialSku = options.materialSkus[0]
  const firstTicketNo = options.ticketNos[0]
  const firstBagCode = options.bagCodes[0]
  const firstUsageNo = options.usageNos[0]
  const firstProcessOrderNo = options.processOrderNos[0]
  const firstSuggestionId = options.suggestionIds[0]

  return {
    productionProgress: {
      productionOrderNo: options.productionOrderNo,
    },
    cuttablePool: {
      productionOrderNo: options.productionOrderNo,
      styleCode: options.styleCode || undefined,
    },
    mergeBatches: {
      mergeBatchNo: firstMergeBatchNo,
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
    },
    originalOrders: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
      styleCode: options.styleCode || undefined,
      materialSku: firstMaterialSku,
    },
    materialPrep: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      materialSku: firstMaterialSku,
    },
    markerSpreading: {
      mergeBatchNo: firstMergeBatchNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      materialSku: firstMaterialSku,
    },
    feiTickets: {
      mergeBatchNo: firstMergeBatchNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      productionOrderNo: options.productionOrderNo,
      printJobNo: '',
      ticketNo: firstTicketNo,
    },
    fabricWarehouse: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      materialSku: firstMaterialSku,
    },
    cutPieceWarehouse: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
    },
    sampleWarehouse: {
      styleCode: options.styleCode || undefined,
    },
    transferBags: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
      ticketNo: firstTicketNo,
      bagCode: firstBagCode,
      usageNo: firstUsageNo,
    },
    replenishment: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
      materialSku: firstMaterialSku,
      suggestionId: firstSuggestionId,
    },
    specialProcesses: {
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
      processOrderNo: firstProcessOrderNo,
      styleCode: options.styleCode || undefined,
      materialSku: firstMaterialSku,
    },
    summary: {
      productionOrderNo: options.productionOrderNo,
      originalCutOrderNo: firstOriginalCutOrderNo,
      mergeBatchNo: firstMergeBatchNo,
      ticketNo: firstTicketNo,
      bagCode: firstBagCode,
      usageNo: firstUsageNo,
      suggestionId: firstSuggestionId,
      processOrderNo: firstProcessOrderNo,
    },
  }
}

export function buildCuttingSummaryRows(options: CuttingSummaryBuildOptions): CuttingSummaryRow[] {
  const originalRowsByProduction = options.productionRows.reduce<Record<string, OriginalCutOrderRow[]>>((result, productionRow) => {
    result[productionRow.productionOrderNo] = options.originalRows.filter((row) => row.productionOrderNo === productionRow.productionOrderNo)
    return result
  }, {})

  return options.productionRows.map((productionRow) => {
    const originalRows = originalRowsByProduction[productionRow.productionOrderNo] || []
    const originalCutOrderIdSet = new Set(originalRows.map((row) => row.originalCutOrderId))
    const originalCutOrderNoSet = new Set(originalRows.map((row) => row.originalCutOrderNo))
    const mergeBatches = options.mergeBatches.filter((batch) =>
      batch.items.some((item) => originalCutOrderIdSet.has(item.originalCutOrderId) || item.productionOrderNo === productionRow.productionOrderNo),
    )
    const mergeBatchNoSet = new Set(mergeBatches.map((batch) => batch.mergeBatchNo))
    const materialPrepRows = options.materialPrepRows.filter((row) => row.productionOrderNo === productionRow.productionOrderNo)
    const spreadingSessions = options.markerStore.sessions.filter((session) =>
      session.originalCutOrderIds.some((originalCutOrderId) => originalCutOrderIdSet.has(originalCutOrderId)),
    )
    const ticketOwners = options.feiViewModel.owners.filter((owner) => owner.productionOrderNo === productionRow.productionOrderNo)
    const ownerIdSet = new Set(ticketOwners.map((owner) => owner.originalCutOrderId))
    const ticketRecords = options.feiViewModel.ticketRecords.filter((record) => ownerIdSet.has(record.originalCutOrderId))
    const ticketNoSet = new Set(ticketRecords.map((record) => record.ticketNo))
    const printJobs = options.feiViewModel.printJobs.filter((job) => job.originalCutOrderIds.some((id) => ownerIdSet.has(id)))
    const fabricStocks = options.fabricWarehouseView.items.filter((item) => item.sourceProductionOrderNos.includes(productionRow.productionOrderNo))
    const cutPieceItems = options.cutPieceWarehouseView.items.filter((item) => item.productionOrderNo === productionRow.productionOrderNo)
    const sampleItems = options.sampleWarehouseView.items.filter(
      (item) => item.relatedProductionOrderNo === productionRow.productionOrderNo || item.styleCode === productionRow.styleCode,
    )
    const bagBindings = options.transferBagView.bindings.filter((binding) => binding.productionOrderNo === productionRow.productionOrderNo)
    const usageIdSet = new Set(bagBindings.map((binding) => binding.usageId))
    const bagUsages = options.transferBagView.usages.filter((usage) => usageIdSet.has(usage.usageId))
    const returnUsages = options.transferBagReturnView.waitingReturnUsages.filter((usage) => usageIdSet.has(usage.usageId))
    const reuseCycles = options.transferBagReturnView.reuseCycles.filter((cycle) => bagUsages.some((usage) => usage.bagId === cycle.bagId))
    const conditionItems = options.transferBagReturnView.conditionItems.filter((item) => usageIdSet.has(item.usageId))
    const replenishments = options.replenishmentView.rows.filter((item) => item.productionOrderNos.includes(productionRow.productionOrderNo))
    const specialProcesses = options.specialProcessView.rows.filter((item) => item.productionOrderNos.includes(productionRow.productionOrderNo))

    const issueTypes = buildIssueTags({
      materialPrepRows,
      replenishments,
      ticketOwners,
      ticketRecords,
      cutPieceItems,
      bagUsages,
      returnUsages,
      conditionItems,
      specialProcesses,
    })
    const overallRiskLevel = deriveOverallRiskLevel({
      productionRow,
      materialPrepRows,
      replenishments,
      ticketOwners,
      cutPieceItems,
      returnUsages,
      conditionItems,
      specialProcesses,
    })
    const riskTags = uniqueStrings([
      ...productionRow.riskTags.map((tag) => tag.label),
      ...replenishments.filter((item) => item.riskLevel === 'HIGH').map(() => '补料高风险'),
      ...cutPieceItems.filter((item) => item.handoffStatus.key === 'WAITING_HANDOVER').map(() => '待交接'),
      ...ticketOwners.filter((owner) => !['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)).map(() => '待打票'),
      ...conditionItems.filter((item) => item.decisionMeta.reusableDecision !== 'REUSABLE').map((item) => item.decisionMeta.label),
      ...specialProcesses.filter((item) => !['DONE', 'CANCELLED'].includes(item.status)).map(() => '特殊工艺待处理'),
    ])

    const relatedOriginalCutOrderNos = uniqueStrings(originalRows.map((row) => row.originalCutOrderNo))
    const relatedMergeBatchNos = uniqueStrings([
      ...Array.from(mergeBatchNoSet),
      ...originalRows.flatMap((row) => row.mergeBatchNos),
      ...bagBindings.map((binding) => binding.mergeBatchNo),
    ])
    const relatedBagCodes = uniqueStrings([...bagUsages.map((usage) => usage.bagCode), ...reuseCycles.map((cycle) => cycle.bagCode)])
    const relatedUsageNos = uniqueStrings(bagUsages.map((usage) => usage.usageNo))
    const relatedMaterialSkus = uniqueStrings([
      ...originalRows.map((row) => row.materialSku),
      ...materialPrepRows.flatMap((row) => row.materialLineItems.map((item) => item.materialSku)),
      ...fabricStocks.map((item) => item.materialSku),
    ])
    const relatedSuggestionIds = uniqueStrings(replenishments.map((item) => item.suggestionId))
    const relatedProcessOrderNos = uniqueStrings(specialProcesses.map((item) => item.processOrderNo))
    const qrSchemaVersions = uniqueStrings(ticketRecords.map((record) => record.schemaVersion || '1.0.0'))

    return {
      rowId: `summary-${productionRow.productionOrderId}`,
      productionOrderId: productionRow.productionOrderId,
      productionOrderNo: productionRow.productionOrderNo,
      styleCode: productionRow.styleCode,
      spuCode: productionRow.spuCode,
      styleName: productionRow.styleName,
      currentStageKey: productionRow.currentStage.key,
      currentStageLabel: productionRow.currentStage.label,
      originalCutOrderCount: relatedOriginalCutOrderNos.length,
      mergeBatchCount: relatedMergeBatchNos.length,
      progressSummary: `${productionRow.currentStage.label} · ${productionRow.cuttingCompletionSummary.label}`,
      materialPrepSummary: summarizeMaterialPrep(materialPrepRows),
      spreadingSummary: summarizeSpreading(spreadingSessions, replenishments),
      replenishmentSummary: summarizeReplenishment(replenishments),
      ticketSummary: summarizeTicketStatus(ticketOwners, ticketRecords),
      warehouseSummary: summarizeWarehouseStatus({ fabricStocks, cutPieceItems, sampleItems }),
      bagUsageSummary: summarizeBagUsageStatus(bagUsages, returnUsages),
      specialProcessSummary: summarizeSpecialProcess(specialProcesses),
      overallRiskLevel,
      riskTags,
      issueTypes,
      relatedOriginalCutOrderNos,
      relatedMergeBatchNos,
      relatedTicketNos: uniqueStrings(ticketRecords.map((record) => record.ticketNo)),
      relatedBagCodes,
      relatedUsageNos,
      relatedSuggestionIds,
      relatedProcessOrderNos,
      relatedMaterialSkus,
      latestPrintJobNo: printJobs[0]?.printJobNo || '',
      qrSchemaVersions,
      unprintedOwnerCount: ticketOwners.filter((owner) => !['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)).length,
      pendingReplenishmentCount: replenishments.filter((item) => !['NO_ACTION', 'REJECTED', 'APPLIED'].includes(item.statusMeta.key)).length,
      warehouseIssueCount:
        fabricStocks.filter((item) => item.riskTags.length > 0).length +
        cutPieceItems.filter((item) => item.riskTags.length > 0).length +
        returnUsages.filter((item) => item.returnExceptionMeta || item.latestConditionRecord?.reusableDecision !== 'REUSABLE').length,
      openBagUsageCount: bagUsages.filter((usage) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus)).length,
      openSpecialProcessCount: specialProcesses.filter((item) => !['DONE', 'CANCELLED'].includes(item.status)).length,
      keywordIndex: lowerKeywordIndex([
        productionRow.productionOrderNo,
        productionRow.productionOrderId,
        productionRow.styleCode,
        productionRow.spuCode,
        productionRow.styleName,
        ...relatedOriginalCutOrderNos,
        ...relatedMergeBatchNos,
        ...ticketRecords.map((record) => record.ticketNo),
        ...relatedBagCodes,
        ...relatedUsageNos,
        ...relatedSuggestionIds,
        ...relatedProcessOrderNos,
        ...relatedMaterialSkus,
        ...riskTags,
      ]),
      navigationPayload: buildSummaryNavigationPayload({
        productionOrderNo: productionRow.productionOrderNo,
        originalCutOrderNos: relatedOriginalCutOrderNos,
        mergeBatchNos: relatedMergeBatchNos,
        materialSkus: relatedMaterialSkus,
        styleCode: productionRow.styleCode,
        ticketNos: uniqueStrings(ticketRecords.map((record) => record.ticketNo)),
        bagCodes: relatedBagCodes,
        usageNos: relatedUsageNos,
        processOrderNos: relatedProcessOrderNos,
        suggestionIds: relatedSuggestionIds,
      }),
    }
  })
}

function summarizeIssueSeverity(rows: CuttingSummaryRow[]): CuttingSummaryRiskLevel {
  if (rows.some((row) => row.overallRiskLevel === 'HIGH')) return 'HIGH'
  if (rows.some((row) => row.overallRiskLevel === 'MEDIUM')) return 'MEDIUM'
  return 'LOW'
}

export function buildCuttingSummaryIssues(rows: CuttingSummaryRow[]): CuttingSummaryIssue[] {
  return Object.values(cuttingSummaryIssueMetaMap)
    .map((meta) => {
      const relatedRows = filterSummaryByIssueType(rows, meta.key)
      if (!relatedRows.length) return null
      return {
        issueId: `issue-${meta.key.toLowerCase()}`,
        issueType: meta.key,
        severity: summarizeIssueSeverity(relatedRows),
        relatedRowIds: relatedRows.map((row) => row.rowId),
        relatedProductionOrderNos: uniqueStrings(relatedRows.map((row) => row.productionOrderNo)),
        relatedOriginalCutOrderNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedOriginalCutOrderNos)),
        relatedMergeBatchNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedMergeBatchNos)),
        relatedUsageNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedUsageNos)),
        relatedProcessOrderNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedProcessOrderNos)),
        summary: `${meta.detailText} 当前关联 ${formatCount(relatedRows.length)} 个生产单收口行。`,
        actionHint: meta.actionHint,
      }
    })
    .filter((item): item is CuttingSummaryIssue => Boolean(item))
}

export function filterSummaryByIssueType(
  rows: CuttingSummaryRow[],
  issueType: CuttingSummaryIssueType | 'ALL',
): CuttingSummaryRow[] {
  if (issueType === 'ALL') return rows
  return rows.filter((row) => row.issueTypes.includes(issueType))
}

export function buildCuttingTraceTree(detail: Omit<CuttingSummaryDetailPanelData, 'traceTree'>): CuttingSummaryTraceNode[] {
  const originalNodes = detail.originalRows.map((row) => {
    const mergeBatchNodes = detail.mergeBatches
      .filter((batch) => batch.items.some((item) => item.originalCutOrderId === row.originalCutOrderId))
      .map<CuttingSummaryTraceNode>((batch) => ({
        nodeId: `trace-batch-${batch.mergeBatchId}`,
        nodeType: 'merge-batch',
        nodeLabel: batch.mergeBatchNo,
        relatedIds: [batch.mergeBatchId, batch.mergeBatchNo],
        status: batch.status,
        children: [],
      }))

    const ticketNodes = detail.ticketRecords
      .filter((record) => record.originalCutOrderId === row.originalCutOrderId)
      .slice(0, 6)
      .map<CuttingSummaryTraceNode>((record) => ({
        nodeId: `trace-ticket-${record.ticketRecordId}`,
        nodeType: 'ticket',
        nodeLabel: record.ticketNo,
        relatedIds: [record.ticketRecordId, record.ticketNo],
        status: record.schemaVersion ? `二维码 ${record.schemaVersion}` : '旧版二维码兼容',
        children: [],
      }))

    const bagNodes = detail.bagUsages
      .filter((usage) => usage.originalCutOrderNos.includes(row.originalCutOrderNo))
      .map<CuttingSummaryTraceNode>((usage) => ({
        nodeId: `trace-usage-${usage.usageId}`,
        nodeType: 'bag-usage',
        nodeLabel: `${usage.usageNo} / ${usage.bagCode}`,
        relatedIds: [usage.usageId, usage.usageNo, usage.bagCode],
        status: usage.statusMeta.label,
        children: [],
      }))

    return {
      nodeId: `trace-original-${row.originalCutOrderId}`,
      nodeType: 'original-cut-order',
      nodeLabel: row.originalCutOrderNo,
      relatedIds: [row.originalCutOrderId, row.originalCutOrderNo],
      status: `${row.currentStage.label} / ${row.cuttableState.label}`,
      children: [...mergeBatchNodes, ...ticketNodes, ...bagNodes],
    }
  })

  const replenishmentNodes = detail.replenishments.map<CuttingSummaryTraceNode>((item) => ({
    nodeId: `trace-replenishment-${item.suggestionId}`,
    nodeType: 'replenishment',
    nodeLabel: item.suggestionNo,
    relatedIds: [item.suggestionId, item.suggestionNo],
    status: item.statusMeta.label,
    children: [],
  }))

  const specialProcessNodes = detail.specialProcesses.map<CuttingSummaryTraceNode>((item) => ({
    nodeId: `trace-special-${item.processOrderId}`,
    nodeType: 'special-process',
    nodeLabel: item.processOrderNo,
    relatedIds: [item.processOrderId, item.processOrderNo],
    status: item.statusMeta.label,
    children: [],
  }))

  return [
    {
      nodeId: `trace-production-${detail.row.productionOrderId}`,
      nodeType: 'production-order',
      nodeLabel: detail.row.productionOrderNo,
      relatedIds: [detail.row.productionOrderId, detail.row.productionOrderNo],
      status: `${detail.row.currentStageLabel} / ${cuttingSummaryRiskMetaMap[detail.row.overallRiskLevel].label}`,
      children: [...originalNodes, ...replenishmentNodes, ...specialProcessNodes],
    },
  ]
}

export function buildSummaryDetailPanelData(
  rowId: string,
  options: CuttingSummaryBuildOptions & { rows: CuttingSummaryRow[] },
): CuttingSummaryDetailPanelData | null {
  const row = options.rows.find((item) => item.rowId === rowId)
  if (!row) return null

  const productionRow = options.productionRows.find((item) => item.productionOrderId === row.productionOrderId) || null
  const originalRows = options.originalRows.filter((item) => item.productionOrderNo === row.productionOrderNo)
  const originalCutOrderIdSet = new Set(originalRows.map((item) => item.originalCutOrderId))
  const mergeBatches = options.mergeBatches.filter((batch) =>
    batch.items.some((item) => originalCutOrderIdSet.has(item.originalCutOrderId) || item.productionOrderNo === row.productionOrderNo),
  )
  const materialPrepRows = options.materialPrepRows.filter((item) => item.productionOrderNo === row.productionOrderNo)
  const spreadingSessions = options.markerStore.sessions.filter((session) =>
    session.originalCutOrderIds.some((originalCutOrderId) => originalCutOrderIdSet.has(originalCutOrderId)),
  )
  const ticketOwners = options.feiViewModel.owners.filter((item) => item.productionOrderNo === row.productionOrderNo)
  const ownerIdSet = new Set(ticketOwners.map((item) => item.originalCutOrderId))
  const ticketRecords = options.feiViewModel.ticketRecords.filter((item) => ownerIdSet.has(item.originalCutOrderId))
  const printJobs = options.feiViewModel.printJobs.filter((job) => job.originalCutOrderIds.some((item) => ownerIdSet.has(item)))
  const fabricStocks = options.fabricWarehouseView.items.filter((item) => item.sourceProductionOrderNos.includes(row.productionOrderNo))
  const cutPieceItems = options.cutPieceWarehouseView.items.filter((item) => item.productionOrderNo === row.productionOrderNo)
  const sampleItems = options.sampleWarehouseView.items.filter(
    (item) => item.relatedProductionOrderNo === row.productionOrderNo || item.styleCode === row.styleCode,
  )
  const bagBindings = options.transferBagView.bindings.filter((binding) => binding.productionOrderNo === row.productionOrderNo)
  const usageIdSet = new Set(bagBindings.map((binding) => binding.usageId))
  const bagUsages = options.transferBagView.usages.filter((usage) => usageIdSet.has(usage.usageId))
  const returnUsages = options.transferBagReturnView.waitingReturnUsages.filter((usage) => usageIdSet.has(usage.usageId))
  const reuseCycles = options.transferBagReturnView.reuseCycles.filter((cycle) => bagUsages.some((usage) => usage.bagId === cycle.bagId))
  const conditionItems = options.transferBagReturnView.conditionItems.filter((item) => usageIdSet.has(item.usageId))
  const replenishments = options.replenishmentView.rows.filter((item) => item.productionOrderNos.includes(row.productionOrderNo))
  const specialProcesses = options.specialProcessView.rows.filter((item) => item.productionOrderNos.includes(row.productionOrderNo))

  const base = {
    row,
    productionRow,
    originalRows,
    mergeBatches,
    materialPrepRows,
    spreadingSessions,
    ticketOwners,
    ticketRecords,
    printJobs,
    fabricStocks,
    cutPieceItems,
    sampleItems,
    bagUsages,
    returnUsages,
    bagBindings,
    reuseCycles,
    conditionItems,
    replenishments,
    specialProcesses,
    navigationPayload: row.navigationPayload,
  }

  return {
    ...base,
    traceTree: buildCuttingTraceTree(base),
  }
}

export function buildSummaryDashboardCards(
  dashboard: CuttingSummaryDashboardSummary,
): CuttingSummaryDashboardCard[] {
  return [
    {
      key: 'production-orders',
      label: '生产单总数',
      value: dashboard.productionOrderCount,
      hint: '默认生产单视角收口行',
      accentClass: 'text-slate-900',
    },
    {
      key: 'original-orders',
      label: '原始裁片单总数',
      value: dashboard.originalCutOrderCount,
      hint: '回落主体仍为原始裁片单',
      accentClass: 'text-blue-600',
    },
    {
      key: 'merge-batches',
      label: '合并裁剪批次数',
      value: dashboard.mergeBatchCount,
      hint: '执行层批次台账',
      accentClass: 'text-violet-600',
    },
    {
      key: 'replenishment-open',
      label: '待处理补料建议数',
      value: dashboard.openReplenishmentCount,
      hint: '待审核或待回写',
      accentClass: 'text-amber-600',
      filterType: 'pending-replenishment',
      filterValue: 'true',
    },
    {
      key: 'special-process-open',
      label: '特殊工艺单数',
      value: dashboard.openSpecialProcessCount,
      hint: '当前待执行 / 执行中',
      accentClass: 'text-fuchsia-600',
      filterType: 'special-process',
      filterValue: 'true',
    },
    {
      key: 'ticket-printed',
      label: '已打印票数',
      value: dashboard.ticketPrintedCount,
      hint: '含首打与重打记录',
      accentClass: 'text-emerald-600',
    },
    {
      key: 'ticket-unprinted',
      label: '未打印票主体数',
      value: dashboard.unprintedOwnerCount,
      hint: '待打票或部分已打票',
      accentClass: 'text-sky-600',
      filterType: 'pending-ticket',
      filterValue: 'true',
    },
    {
      key: 'bag-open',
      label: '待交接 / 待回仓 usage 数',
      value: dashboard.bagOpenUsageCount,
      hint: '交接与返仓闭环待处理',
      accentClass: 'text-orange-600',
      filterType: 'pending-bag',
      filterValue: 'true',
    },
    {
      key: 'warehouse-issues',
      label: '仓务异常项数',
      value: dashboard.warehouseIssueCount,
      hint: '含待入仓、待交接和袋况异常',
      accentClass: 'text-rose-600',
      filterType: 'issue',
      filterValue: 'WAREHOUSE_HANDOFF',
    },
    {
      key: 'high-risk',
      label: '高风险问题数',
      value: dashboard.highRiskCount,
      hint: '需优先核查的收口行',
      accentClass: 'text-rose-600',
      filterType: 'risk',
      filterValue: 'HIGH',
    },
  ]
}

export function buildSummarySearchIndex(rows: CuttingSummaryRow[]): CuttingSummarySearchIndexEntry[] {
  return rows.map((row) => ({
    rowId: row.rowId,
    tokens: row.keywordIndex,
  }))
}

export function buildCuttingSummaryViewModel(options: CuttingSummaryBuildOptions): CuttingSummaryViewModel {
  const rows = buildCuttingSummaryRows(options)
  const issues = buildCuttingSummaryIssues(rows)
  const dashboard: CuttingSummaryDashboardSummary = {
    productionOrderCount: rows.length,
    originalCutOrderCount: rows.reduce((sum, row) => sum + row.originalCutOrderCount, 0),
    mergeBatchCount: options.mergeBatches.length,
    openReplenishmentCount: options.replenishmentView.rows.filter((item) => !['NO_ACTION', 'REJECTED', 'APPLIED'].includes(item.statusMeta.key)).length,
    openSpecialProcessCount: options.specialProcessView.rows.filter((item) => !['DONE', 'CANCELLED'].includes(item.status)).length,
    ticketPrintedCount: options.feiViewModel.ticketRecords.length,
    unprintedOwnerCount: options.feiViewModel.owners.filter((owner) => !['PRINTED', 'REPRINTED'].includes(owner.ticketStatus)).length,
    bagOpenUsageCount: options.transferBagReturnView.waitingReturnUsages.filter((item) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus)).length,
    warehouseIssueCount:
      options.fabricWarehouseView.summary.abnormalItemCount +
      options.cutPieceWarehouseView.summary.waitingInWarehouseCount +
      options.cutPieceWarehouseView.summary.waitingHandoffCount +
      options.transferBagReturnView.conditionItems.filter((item) => item.decisionMeta.reusableDecision !== 'REUSABLE').length,
    highRiskCount: rows.filter((row) => row.overallRiskLevel === 'HIGH').length,
    issueCount: issues.length,
  }

  return {
    dashboard,
    dashboardCards: buildSummaryDashboardCards(dashboard),
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.rowId, row])),
    issues,
    issuesById: Object.fromEntries(issues.map((issue) => [issue.issueId, issue])),
    searchIndex: buildSummarySearchIndex(rows),
  }
}
