import type {
  ProductionProgressRow,
  ProductionProgressStageKey,
} from './production-progress-model.ts'
import type {
  ProductionPieceTruthCompletionKey,
  ProductionPieceTruthResult,
} from '../../../domain/fcs-cutting-piece-truth/index.ts'
import {
  buildProductionPieceTruthCompletion,
  productionPieceTruthCompletionMetaMap,
} from '../../../domain/fcs-cutting-piece-truth/index.ts'
import type { OriginalCutOrderRow } from './original-orders-model.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type { MarkerSpreadingStore, SpreadingSession } from './marker-spreading-model.ts'
import {
  getMergeBatchStatusMeta,
  type MergeBatchRecord,
} from './merge-batches-model.ts'
import type {
  FeiTicketsViewModel,
  FeiTicketLabelRecord,
  FeiTicketPrintJob,
  OriginalCutOrderTicketOwner,
} from './fei-tickets-model.ts'
import { getFeiTicketStatusMeta } from './fei-tickets-model.ts'
import type {
  FabricWarehouseStockItem,
  FabricWarehouseViewModel,
} from './fabric-warehouse-model.ts'
import type {
  CutPieceWarehouseItem,
  CutPieceWarehouseViewModel,
} from './cut-piece-warehouse-model.ts'
import type {
  SampleWarehouseItem,
  SampleWarehouseViewModel,
} from './sample-warehouse-model.ts'
import type {
  TransferBagBindingItem,
  TransferBagUsageItem,
  TransferBagViewModel,
} from './transfer-bags-model.ts'
import type {
  TransferBagConditionDecisionItem,
  TransferBagReuseCycleItem,
  TransferBagReturnUsageItem,
  TransferBagReturnViewModel,
} from './transfer-bag-return-model.ts'
import type {
  ReplenishmentSuggestionRow,
  ReplenishmentViewModel,
} from './replenishment-model.ts'
import type {
  SpecialProcessRow,
  SpecialProcessViewModel,
} from './special-processes-model.ts'
import {
  buildCuttingCheckResult,
  cuttingCheckSectionLabelMap,
  type CuttingCheckBlockerItem,
  type CuttingCheckNextAction,
  type CuttingCheckSectionKey,
  type CuttingCheckSectionState,
  type CuttingCheckSourceObjectType,
} from './cutting-summary-checks.ts'

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
  completionState: ProductionPieceTruthCompletionKey
  completionLabel: string
  completionClassName: string
  completionDetailText: string
  pieceTruth: ProductionPieceTruthResult
  skuProgressSummary: string
  skuTotalCount: number
  completedSkuCount: number
  incompleteSkuCount: number
  incompletePartCount: number
  dataStateLabel: string
  primaryGapObjectLabel: string
  primaryGapMaterialSku: string
  mainNextActionLabel: string
  checkSections: CuttingCheckSectionState[]
  blockerItems: CuttingCheckBlockerItem[]
  nextActions: CuttingCheckNextAction[]
  primaryBlockerSectionKey: CuttingCheckSectionKey | ''
  primaryBlockerSectionLabel: string
  primaryBlockerTitle: string
  primaryBlockerReason: string
  blockingCount: number
  pendingActionCount: number
  keySourceObjects: string[]
  overallRiskLevel: CuttingSummaryRiskLevel
  riskTags: string[]
  issueTypes: CuttingSummaryIssueType[]
  relatedOriginalCutOrderIds: string[]
  relatedOriginalCutOrderNos: string[]
  relatedMergeBatchIds: string[]
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
  highestRiskLevel: CuttingSummaryRiskLevel
  relatedRowIds: string[]
  relatedProductionOrderNos: string[]
  relatedOriginalCutOrderNos: string[]
  relatedMergeBatchNos: string[]
  relatedUsageNos: string[]
  relatedProcessOrderNos: string[]
  blockerIds: string[]
  blockingProductionOrderCount: number
  blockingObjectCount: number
  primaryActionLabel: string
  summary: string
  actionHint: string
}

export interface CuttingSummarySourceObjectItem {
  sourceType: CuttingCheckSourceObjectType
  sourceLabel: string
  sourceId: string
  sourceNo: string
  statusLabel: string
  materialSku: string
  blockerCount: number
  navigationTarget: keyof CuttingSummaryNavigationPayload
  navigationPayload: Record<string, string | undefined>
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
  completionMeta: {
    key: ProductionPieceTruthCompletionKey
    label: string
    className: string
    detailText: string
  }
  primaryBlocker: CuttingCheckBlockerItem | null
  blockerItems: CuttingCheckBlockerItem[]
  sectionStates: CuttingCheckSectionState[]
  nextActions: CuttingCheckNextAction[]
  sourceObjects: CuttingSummarySourceObjectItem[]
  pieceTruth: ProductionPieceTruthResult
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
    detailText: '配料未齐或领料不齐。',
    actionHint: '去仓库配料领料',
  },
  SPREADING_REPLENISH: {
    key: 'SPREADING_REPLENISH',
    label: '铺布 / 补料问题',
    className: 'bg-violet-100 text-violet-700 border border-violet-200',
    detailText: '铺布差异、补料待审核或待执行动作。',
    actionHint: '去唛架、去铺布或补料管理',
  },
  TICKET_QR: {
    key: 'TICKET_QR',
    label: '打印菲票问题',
    className: 'bg-sky-100 text-sky-700 border border-sky-200',
    detailText: '待打印、部分已打印或主码兼容警告。',
    actionHint: '去打印菲票',
  },
  WAREHOUSE_HANDOFF: {
    key: 'WAREHOUSE_HANDOFF',
    label: '仓储 / 交接问题',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
    detailText: '待入仓、待交接、待回仓或袋况异常。',
    actionHint: '去中转袋流转',
  },
  SPECIAL_PROCESS: {
    key: 'SPECIAL_PROCESS',
    label: '特殊工艺问题',
    className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
    detailText: '特殊工艺待执行、执行中，或预留类型尚未接入执行链。',
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
  return `${formatCount(printed)}/${formatCount(planned)} 已打印菲票 · 待处理主体 ${pendingOwners}${partialOwners ? ` · 部分已打印 ${partialOwners}` : ''}`
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
  if (!usages.length && !returnUsages.length) return '未进入中转袋流转'
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
  return [
    `已配置 ${configured}/${rows.length}`,
    partial ? `部分配置 ${partial}` : '',
    claimException ? `领料异常 ${claimException}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function summarizeSpreading(sessions: SpreadingSession[], replenishments: ReplenishmentSuggestionRow[]): string {
  if (!sessions.length) {
    const pending = replenishments.filter((item) =>
      ['PENDING_REVIEW', 'PENDING_SUPPLEMENT', 'APPROVED_PENDING_ACTION', 'IN_ACTION'].includes(item.statusMeta.key),
    ).length
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
  const openCount = items.filter((item) => !['NO_ACTION', 'REJECTED', 'COMPLETED'].includes(item.statusMeta.key)).length
  const appliedCount = items.filter((item) => item.statusMeta.key === 'COMPLETED').length
  const highRiskCount = items.filter((item) => item.riskLevel === 'HIGH').length
  return [
    `建议 ${items.length}`,
    openCount ? `待处理 ${openCount}` : '',
    appliedCount ? `已完成 ${appliedCount}` : '',
    highRiskCount ? `高风险 ${highRiskCount}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function isReservedSpecialProcess(item: SpecialProcessRow): boolean {
  return !item.typeExecutionMeta.enabledForExecution
}

function isOpenSpecialProcess(item: SpecialProcessRow): boolean {
  if (isReservedSpecialProcess(item)) return true
  return !['DONE', 'CANCELLED'].includes(item.status)
}

function summarizeSpecialProcess(items: SpecialProcessRow[]): string {
  if (!items.length) return '未创建'
  const reservedCount = items.filter(isReservedSpecialProcess).length
  const draftCount = items.filter((item) => item.typeExecutionMeta.enabledForExecution && item.status === 'DRAFT').length
  const pendingCount = items.filter((item) => item.typeExecutionMeta.enabledForExecution && item.status === 'PENDING_EXECUTION').length
  const inProgressCount = items.filter((item) => item.status === 'IN_PROGRESS').length
  const doneCount = items.filter((item) => item.typeExecutionMeta.enabledForExecution && item.status === 'DONE').length
  const cancelledCount = items.filter((item) => item.typeExecutionMeta.enabledForExecution && item.status === 'CANCELLED').length
  return [
    `工艺单 ${items.length}`,
    reservedCount ? `预留未接入 ${reservedCount}` : '',
    draftCount ? `草稿 ${draftCount}` : '',
    pendingCount ? `待执行 ${pendingCount}` : '',
    inProgressCount ? `执行中 ${inProgressCount}` : '',
    doneCount ? `已完成 ${doneCount}` : '',
    cancelledCount ? `已取消 ${cancelledCount}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
}

function mapSectionKeyToIssueType(sectionKey: CuttingCheckSectionKey): CuttingSummaryIssueType {
  if (sectionKey === 'MATERIAL_PREP') return 'MATERIAL_PREP'
  if (sectionKey === 'SPREADING' || sectionKey === 'REPLENISHMENT') return 'SPREADING_REPLENISH'
  if (sectionKey === 'FEI_TICKETS') return 'TICKET_QR'
  if (sectionKey === 'WAREHOUSE_HANDOFF') return 'WAREHOUSE_HANDOFF'
  return 'SPECIAL_PROCESS'
}

function summarizeCheckSections(sections: CuttingCheckSectionState[]): CuttingSummaryIssueType[] {
  return uniqueStrings(
    sections
      .filter((section) => section.blocking || section.stateKey === 'DATA_PENDING')
      .map((section) => mapSectionKeyToIssueType(section.sectionKey)),
  ) as CuttingSummaryIssueType[]
}

const feiPrintJobStatusLabelMap: Record<FeiTicketPrintJob['status'], string> = {
  PRINTED: '已打印',
  REPRINTED: '已补打',
  CANCELLED: '已取消',
}

function deriveOverallRiskLevel(options: {
  completionState: ProductionPieceTruthCompletionKey
  blockerItems: CuttingCheckBlockerItem[]
  productionRiskTags: ProductionProgressRow['riskTags']
}): CuttingSummaryRiskLevel {
  if (options.completionState === 'HAS_EXCEPTION' || options.blockerItems.some((item) => item.severity === 'HIGH')) return 'HIGH'
  if (options.blockerItems.length || options.completionState === 'DATA_PENDING') return 'MEDIUM'
  if (options.productionRiskTags.length) return 'MEDIUM'
  return 'LOW'
}

function buildSummarySourceObjects(options: {
  row: CuttingSummaryRow
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  ticketOwners: OriginalCutOrderTicketOwner[]
  printJobs: FeiTicketPrintJob[]
  bagUsages: TransferBagUsageItem[]
  replenishments: ReplenishmentSuggestionRow[]
  specialProcesses: SpecialProcessRow[]
}): CuttingSummarySourceObjectItem[] {
  const blockerCountBySourceNo = options.row.blockerItems.reduce<Record<string, number>>((result, item) => {
    result[item.sourceNo] = (result[item.sourceNo] || 0) + 1
    return result
  }, {})

  const originalObjects = options.originalRows.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'ORIGINAL_CUT_ORDER',
    sourceLabel: '原始裁片单',
    sourceId: item.originalCutOrderId,
    sourceNo: item.originalCutOrderNo,
    statusLabel: `${item.currentStage.label} / ${item.cuttableState.label}`,
    materialSku: item.materialSku,
    blockerCount: blockerCountBySourceNo[item.originalCutOrderNo] || 0,
    navigationTarget: 'originalOrders',
    navigationPayload: item.navigationPayload.originalOrders,
  }))

  const mergeBatchObjects = options.mergeBatches.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'MERGE_BATCH',
    sourceLabel: '合并裁剪批次',
    sourceId: item.mergeBatchId,
    sourceNo: item.mergeBatchNo,
    statusLabel: getMergeBatchStatusMeta(item.status).label,
    materialSku: uniqueStrings(item.items.map((row) => row.materialSku)).join(' / '),
    blockerCount: blockerCountBySourceNo[item.mergeBatchNo] || 0,
    navigationTarget: 'mergeBatches',
    navigationPayload: options.row.navigationPayload.mergeBatches,
  }))

  const ticketOwners = options.ticketOwners.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'FEI_OWNER',
    sourceLabel: '打票主体',
    sourceId: item.originalCutOrderId,
    sourceNo: item.originalCutOrderNo,
    statusLabel: getFeiTicketStatusMeta(item.ticketStatus).label,
    materialSku: item.materialSku,
    blockerCount: blockerCountBySourceNo[item.originalCutOrderNo] || 0,
    navigationTarget: 'feiTickets',
    navigationPayload: item.navigationPayload.feiTickets,
  }))

  const printJobs = options.printJobs.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'FEI_PRINT_JOB',
    sourceLabel: '打印作业',
    sourceId: item.printJobId,
    sourceNo: item.printJobNo,
    statusLabel: feiPrintJobStatusLabelMap[item.status],
    materialSku: '',
    blockerCount: blockerCountBySourceNo[item.printJobNo] || 0,
    navigationTarget: 'feiTickets',
    navigationPayload: options.row.navigationPayload.feiTickets,
  }))

  const bagUsages = options.bagUsages.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'BAG_USAGE',
    sourceLabel: '中转袋使用周期',
    sourceId: item.usageId,
    sourceNo: item.usageNo,
    statusLabel: item.pocketStatusMeta.label,
    materialSku: '',
    blockerCount: blockerCountBySourceNo[item.usageNo] || 0,
    navigationTarget: 'transferBags',
    navigationPayload: item.navigationPayload,
  }))

  const replenishments = options.replenishments.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'REPLENISHMENT',
    sourceLabel: '补料建议',
    sourceId: item.suggestionId,
    sourceNo: item.suggestionNo,
    statusLabel: item.statusMeta.label,
    materialSku: item.materialSku,
    blockerCount: blockerCountBySourceNo[item.suggestionNo] || 0,
    navigationTarget: 'replenishment',
    navigationPayload: item.navigationPayload.replenishment,
  }))

  const specialProcesses = options.specialProcesses.map<CuttingSummarySourceObjectItem>((item) => ({
    sourceType: 'SPECIAL_PROCESS',
    sourceLabel: '特殊工艺单',
    sourceId: item.processOrderId,
    sourceNo: item.processOrderNo,
    statusLabel: item.statusMeta.label,
    materialSku: item.materialSku,
    blockerCount: blockerCountBySourceNo[item.processOrderNo] || 0,
    navigationTarget: 'specialProcesses',
    navigationPayload: item.navigationPayload.specialProcesses,
  }))

  return [
    ...originalObjects,
    ...mergeBatchObjects,
    ...ticketOwners,
    ...printJobs,
    ...bagUsages,
    ...replenishments,
    ...specialProcesses,
  ]
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

    const relatedOriginalCutOrderNos = uniqueStrings(originalRows.map((row) => row.originalCutOrderNo))
    const relatedOriginalCutOrderIds = uniqueStrings(originalRows.map((row) => row.originalCutOrderId))
    const relatedMergeBatchIds = uniqueStrings([
      ...mergeBatches.map((batch) => batch.mergeBatchId),
      ...originalRows.flatMap((row) => row.mergeBatchIds),
      ...bagBindings.map((binding) => binding.mergeBatchId),
    ])
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

    const navigationPayload = buildSummaryNavigationPayload({
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
    })

    const checkResult = buildCuttingCheckResult({
      productionRow,
      originalRows,
      mergeBatches,
      materialPrepRows,
      spreadingSessions,
      markerStore: options.markerStore,
      ticketOwners,
      ticketRecords,
      printJobs,
      cutPieceItems,
      bagUsages,
      returnUsages,
      conditionItems,
      replenishments,
      specialProcesses,
      navigationPayload,
    })
    const pieceTruth = productionRow.pieceTruth
    const completionMeta = buildProductionPieceTruthCompletion(pieceTruth, {
      hasObjectDataPending: checkResult.sectionStates.some((section) => section.stateKey === 'DATA_PENDING'),
      hasObjectException: checkResult.blockerItems.some((item) => item.severity === 'HIGH'),
      hasObjectPending:
        checkResult.blockerItems.length > 0 ||
        checkResult.nextActions.length > 0 ||
        checkResult.sectionStates.some((section) => section.stateKey === 'NOT_STARTED' || section.stateKey === 'IN_PROGRESS'),
      objectDataPendingReason: checkResult.sectionStates.find((section) => section.stateKey === 'DATA_PENDING')?.reason,
      objectExceptionReason: checkResult.blockerItems.find((item) => item.severity === 'HIGH')?.blockerReason,
      objectPendingReason: checkResult.primaryBlocker?.blockerReason || checkResult.nextActions[0]?.reason,
    })
    const issueTypes = summarizeCheckSections(checkResult.sectionStates)
    const overallRiskLevel = deriveOverallRiskLevel({
      completionState: completionMeta.key,
      blockerItems: checkResult.blockerItems,
      productionRiskTags: productionRow.riskTags,
    })
    const riskTags = uniqueStrings([
      ...productionRow.riskTags.map((tag) => tag.label),
      ...replenishments.filter((item) => item.riskLevel === 'HIGH').map(() => '补料高风险'),
      ...checkResult.blockerItems.map((item) => item.title),
    ])

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
      skuProgressSummary: `已完成 ${productionRow.completedSkuCount} / ${productionRow.skuTotalCount}`,
      materialPrepSummary: summarizeMaterialPrep(materialPrepRows),
      spreadingSummary: summarizeSpreading(spreadingSessions, replenishments),
      replenishmentSummary: summarizeReplenishment(replenishments),
      ticketSummary: summarizeTicketStatus(ticketOwners, ticketRecords),
      warehouseSummary: summarizeWarehouseStatus({ fabricStocks, cutPieceItems, sampleItems }),
      bagUsageSummary: summarizeBagUsageStatus(bagUsages, returnUsages),
      specialProcessSummary: summarizeSpecialProcess(specialProcesses),
      completionState: completionMeta.key,
      completionLabel: completionMeta.label,
      completionClassName: completionMeta.className,
      completionDetailText: completionMeta.detailText,
      pieceTruth,
      skuTotalCount: productionRow.skuTotalCount,
      completedSkuCount: productionRow.completedSkuCount,
      incompleteSkuCount: productionRow.incompleteSkuCount,
      incompletePartCount: productionRow.incompletePartCount,
      dataStateLabel: productionRow.dataStateLabel,
      primaryGapObjectLabel: productionRow.primaryGapObjectLabel,
      primaryGapMaterialSku: productionRow.primaryGapMaterialSku,
      mainNextActionLabel: checkResult.nextActions[0]?.label || productionRow.mainNextActionLabel,
      checkSections: checkResult.sectionStates,
      blockerItems: checkResult.blockerItems,
      nextActions: checkResult.nextActions,
      primaryBlockerSectionKey: checkResult.primaryBlocker?.sectionKey || '',
      primaryBlockerSectionLabel: checkResult.primaryBlocker
        ? cuttingCheckSectionLabelMap[checkResult.primaryBlocker.sectionKey]
        : productionRow.incompletePartCount > 0 || productionRow.incompleteSkuCount > 0
          ? 'SKU / 部位差异'
          : '',
      primaryBlockerTitle: checkResult.primaryBlocker?.title || productionRow.primaryGapPartName || '',
      primaryBlockerReason: checkResult.primaryBlocker?.blockerReason || productionRow.pieceCompletionSummary.detailText,
      blockingCount: checkResult.blockerCount,
      pendingActionCount: checkResult.pendingActionCount,
      keySourceObjects: checkResult.keySourceObjects,
      overallRiskLevel,
      riskTags,
      issueTypes,
      relatedOriginalCutOrderIds,
      relatedOriginalCutOrderNos,
      relatedMergeBatchIds,
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
      pendingReplenishmentCount: replenishments.filter((item) => !['NO_ACTION', 'REJECTED', 'COMPLETED'].includes(item.statusMeta.key)).length,
      warehouseIssueCount:
        fabricStocks.filter((item) => item.riskTags.length > 0).length +
        cutPieceItems.filter((item) => item.riskTags.length > 0).length +
        returnUsages.filter((item) => item.returnExceptionMeta || item.latestConditionRecord?.reusableDecision !== 'REUSABLE').length,
      openBagUsageCount: bagUsages.filter((usage) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(usage.usageStatus)).length,
      openSpecialProcessCount: specialProcesses.filter((item) => isOpenSpecialProcess(item)).length,
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
        ...checkResult.blockerItems.map((item) => item.sourceNo),
        ...checkResult.blockerItems.map((item) => item.materialSku),
        ...checkResult.keySourceObjects,
        ...pieceTruth.gapRows.map((item) => item.partName),
        ...pieceTruth.mappingIssues.map((item) => item.message),
        ...pieceTruth.dataIssues.map((item) => item.message),
      ]),
      navigationPayload,
    }
  })
}

function summarizeIssueSeverity(rows: CuttingSummaryRow[]): CuttingSummaryRiskLevel {
  if (rows.some((row) => row.blockerItems.some((item) => item.severity === 'HIGH'))) return 'HIGH'
  if (rows.some((row) => row.blockerItems.some((item) => item.severity === 'MEDIUM'))) return 'MEDIUM'
  if (rows.some((row) => row.overallRiskLevel === 'HIGH')) return 'HIGH'
  if (rows.some((row) => row.overallRiskLevel === 'MEDIUM')) return 'MEDIUM'
  return 'LOW'
}

export function buildCuttingSummaryIssues(rows: CuttingSummaryRow[]): CuttingSummaryIssue[] {
  return Object.values(cuttingSummaryIssueMetaMap)
    .map((meta) => {
      const relatedRows = filterSummaryByIssueType(rows, meta.key).filter(
        (row) =>
          row.blockerItems.some((item) => mapSectionKeyToIssueType(item.sectionKey) === meta.key) ||
          row.checkSections.some((section) => mapSectionKeyToIssueType(section.sectionKey) === meta.key && section.stateKey === 'DATA_PENDING'),
      )
      if (!relatedRows.length) return null
      const relatedBlockers = relatedRows.flatMap((row) =>
        row.blockerItems.filter((item) => mapSectionKeyToIssueType(item.sectionKey) === meta.key),
      )
      const primaryActionLabel =
        relatedRows.flatMap((row) => row.nextActions.filter((action) => mapSectionKeyToIssueType(action.sectionKey) === meta.key))[0]
          ?.label || meta.actionHint
      const severity = summarizeIssueSeverity(relatedRows)
      return {
        issueId: `issue-${meta.key.toLowerCase()}`,
        issueType: meta.key,
        severity,
        highestRiskLevel: severity,
        relatedRowIds: relatedRows.map((row) => row.rowId),
        relatedProductionOrderNos: uniqueStrings(relatedRows.map((row) => row.productionOrderNo)),
        relatedOriginalCutOrderNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedOriginalCutOrderNos)),
        relatedMergeBatchNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedMergeBatchNos)),
        relatedUsageNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedUsageNos)),
        relatedProcessOrderNos: uniqueStrings(relatedRows.flatMap((row) => row.relatedProcessOrderNos)),
        blockerIds: uniqueStrings(relatedBlockers.map((item) => item.blockerId)),
        blockingProductionOrderCount: uniqueStrings(relatedRows.map((row) => row.productionOrderNo)).length,
        blockingObjectCount: uniqueStrings(relatedBlockers.map((item) => `${item.sourceType}:${item.sourceId}`)).length,
        primaryActionLabel,
        summary: `当前阻塞生产单 ${formatCount(uniqueStrings(relatedRows.map((row) => row.productionOrderNo)).length)} 个 / 阻塞对象 ${formatCount(uniqueStrings(relatedBlockers.map((item) => `${item.sourceType}:${item.sourceId}`)).length)} 个。`,
        actionHint: primaryActionLabel,
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
        status: getMergeBatchStatusMeta(batch.status).label,
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
        status: record.schemaVersion ? `菲票码 ${record.schemaVersion}` : '菲票码待补版本',
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
      status: `${detail.completionMeta.label} / ${detail.row.currentStageLabel}`,
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
  const sourceObjects = buildSummarySourceObjects({
    row,
    originalRows,
    mergeBatches,
    ticketOwners,
    printJobs,
    bagUsages,
    replenishments,
    specialProcesses,
  })

  const base = {
    row,
    completionMeta: productionPieceTruthCompletionMetaMap[row.completionState]
      ? {
          key: row.completionState,
          ...productionPieceTruthCompletionMetaMap[row.completionState],
          detailText: row.completionDetailText,
        }
      : {
          key: 'DATA_PENDING' as const,
          ...productionPieceTruthCompletionMetaMap.DATA_PENDING,
          detailText: row.completionDetailText,
        },
    primaryBlocker: row.primaryBlockerSectionKey ? row.blockerItems[0] || null : null,
    blockerItems: row.blockerItems,
    sectionStates: row.checkSections,
    nextActions: row.nextActions,
    sourceObjects,
    pieceTruth: row.pieceTruth,
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
      hint: '默认按生产单汇总',
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
      hint: '待审核或待执行动作',
      accentClass: 'text-amber-600',
      filterType: 'pending-replenishment',
      filterValue: 'true',
    },
    {
      key: 'special-process-open',
      label: '特殊工艺单数',
      value: dashboard.openSpecialProcessCount,
      hint: '含草稿、待执行、执行中与预留类型',
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
      hint: '待打印或部分已打印',
      accentClass: 'text-sky-600',
      filterType: 'pending-ticket',
      filterValue: 'true',
    },
    {
      key: 'bag-open',
      label: '待交接 / 待回仓使用周期数',
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
      hint: '需优先核查的生产单',
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
    openReplenishmentCount: options.replenishmentView.rows.filter((item) => !['NO_ACTION', 'REJECTED', 'COMPLETED'].includes(item.statusMeta.key)).length,
    openSpecialProcessCount: options.specialProcessView.rows.filter((item) => isOpenSpecialProcess(item)).length,
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
