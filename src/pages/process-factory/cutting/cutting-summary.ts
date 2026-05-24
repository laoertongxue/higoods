import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  type ProductionPieceTruthCompletionKey,
} from '../../../domain/fcs-cutting-piece-truth/index.ts'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import type { ProductionProgressStageKey } from './production-progress-model.ts'
import {
  buildCuttingSummaryIssues,
  cuttingResultCheckGroupDefinitions,
  cuttingSummaryIssueMetaMap,
  cuttingSummaryRiskMetaMap,
  filterSummaryByIssueType,
  type CuttingSummaryBuildOptions,
  type CuttingSummaryDetailPanelData,
  type CuttingSummaryIssue,
  type CuttingSummaryIssueType,
  type CuttingSummaryNavigationPayload,
  type CuttingSummaryRiskLevel,
  type CuttingSummaryRow,
  type CuttingSummarySourceObjectItem,
  type CuttingSummaryTraceNode,
  type CuttingSummaryViewModel,
  type CuttingResultCheckItem,
  type CuttingResultCheckLevel,
  type CuttingResultCheckStatus,
  type CuttingResultCheckType,
} from './summary-model.ts'
import { getWarehouseSearchParams } from './warehouse-shared.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  getCuttingNavigationActionLabel,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import {
  cuttingCheckSectionLabelMap,
  type CuttingCheckBlockerItem,
  type CuttingCheckNextAction,
  type CuttingCheckSectionKey,
  type CuttingCheckSectionState,
  type CuttingCheckSourceObjectType,
} from './cutting-summary-checks.ts'
import {
  buildFcsCuttingSummaryDetailProjection,
  buildFcsCuttingSummaryProjection,
  type FcsCuttingSummaryProjection,
} from './runtime-projections.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import { listSpreadingDifferences } from '../../../data/fcs/cutting/spreading-differences.ts'
import {
  getCuttingProgressSnapshots,
  getCuttingSpecialCraftReturnStatusByProductionOrders,
  type CuttingSpecialCraftReturnStatusSummary,
} from '../../../data/fcs/progress-statistics-linkage.ts'
import {
  getCuttingSewingDispatchProgressByProductionOrder as getRuntimeSewingDispatchProgressByProductionOrder,
  listAvailableCutPieceInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags,
  type CuttingSewingDispatchBatch,
  type CuttingSewingDispatchOrder,
  type CuttingSewingTransferBag,
} from '../../../data/fcs/cutting/sewing-dispatch.ts'
import { buildBindingProcessOrders } from './special-processes.ts'

type SummaryFilterField =
  | 'keyword'
  | 'riskLevel'
  | 'issueType'
  | 'currentStage'
  | 'completionState'
  | 'blockerSection'
  | 'sourceObjectType'
  | 'materialSku'
  | 'sourceNoKeyword'
  | 'checkType'
  | 'checkStatus'
  | 'checkLevel'
  | 'ownerKeyword'
  | 'timeRange'
type SummaryNavigationTarget = keyof CuttingSummaryNavigationPayload

interface SummaryFilters {
  keyword: string
  riskLevel: 'ALL' | CuttingSummaryRiskLevel
  issueType: 'ALL' | CuttingSummaryIssueType
  currentStage: 'ALL' | 'NOT_STARTED' | 'STARTED' | ProductionProgressStageKey
  completionState: 'ALL' | ProductionPieceTruthCompletionKey
  blockerSection: 'ALL' | CuttingCheckSectionKey
  sourceObjectType: 'ALL' | CuttingCheckSourceObjectType
  materialSku: string
  sourceNoKeyword: string
  checkType: 'ALL' | CuttingResultCheckType
  checkStatus: 'ALL' | CuttingResultCheckStatus
  checkLevel: 'ALL' | CuttingResultCheckLevel
  ownerKeyword: string
  timeRange: 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'
  pendingReplenishmentOnly: boolean
  pendingTicketsOnly: boolean
  pendingBagOnly: boolean
  specialProcessOnly: boolean
}

interface SummaryPageState {
  filters: SummaryFilters
  prefilter: CuttingDrillContext | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  activeIssueId: string | null
  activeRowId: string | null
  resolvedCheckItemIds: Set<string>
}

const initialFilters: SummaryFilters = {
  keyword: '',
  riskLevel: 'ALL',
  issueType: 'ALL',
  currentStage: 'ALL',
  completionState: 'ALL',
  blockerSection: 'ALL',
  sourceObjectType: 'ALL',
  materialSku: '',
  sourceNoKeyword: '',
  checkType: 'ALL',
  checkStatus: '待处理',
  checkLevel: 'ALL',
  ownerKeyword: '',
  timeRange: 'ALL',
  pendingReplenishmentOnly: false,
  pendingTicketsOnly: false,
  pendingBagOnly: false,
  specialProcessOnly: false,
}

const state: SummaryPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  drillContext: null,
  querySignature: '',
  activeIssueId: null,
  activeRowId: null,
  resolvedCheckItemIds: new Set(),
}

const completionSortWeight: Record<ProductionPieceTruthCompletionKey, number> = {
  HAS_EXCEPTION: 0,
  DATA_PENDING: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
}

const blockerLevelMetaMap: Record<CuttingCheckBlockerItem['severity'], { label: string; className: string }> = {
  HIGH: {
    label: '高风险',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
  },
  MEDIUM: {
    label: '中风险',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  LOW: {
    label: '低风险',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  },
}

const sourceObjectTypeLabelMap: Record<CuttingCheckSourceObjectType, string> = {
  CUT_ORDER: '裁片单',
  MARKER_PLAN: '唛架方案',
  REPLENISHMENT: '补料建议',
  FEI_OWNER: '打票主体',
  FEI_PRINT_JOB: '打印作业',
  BAG_USAGE: '中转袋使用周期',
  SPECIAL_PROCESS: '特殊工艺单',
}

const sourceObjectGroupOrder: CuttingCheckSourceObjectType[] = [
  'CUT_ORDER',
  'MARKER_PLAN',
  'REPLENISHMENT',
  'FEI_OWNER',
  'FEI_PRINT_JOB',
  'BAG_USAGE',
  'SPECIAL_PROCESS',
]

const checkLevelMetaMap: Record<CuttingResultCheckLevel, { className: string }> = {
  紧急: { className: 'border-rose-200 bg-rose-50 text-rose-700' },
  需处理: { className: 'border-amber-200 bg-amber-50 text-amber-700' },
  提示: { className: 'border-slate-200 bg-slate-50 text-slate-700' },
}

const checkStatusMetaMap: Record<CuttingResultCheckStatus, { className: string }> = {
  待处理: { className: 'border-amber-200 bg-amber-50 text-amber-700' },
  处理中: { className: 'border-blue-200 bg-blue-50 text-blue-700' },
  已处理: { className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  已关闭: { className: 'border-slate-200 bg-slate-50 text-slate-700' },
}

const checkTypeOptions: CuttingResultCheckType[] = [
  '铺布差异',
  '裁剪差异',
  '补料待审核',
  '补排待处理',
  '裁片单已关闭',
  '菲票待处理',
  '入仓待处理',
  '分拣待处理',
  '交出后缺口',
  '接收差异',
  '特殊工艺未回仓',
  '特殊工艺回仓差异',
  '样衣异常',
  '捆条异常',
]

type SewingDispatchProgressSummary = ReturnType<typeof getRuntimeSewingDispatchProgressByProductionOrder>
type CuttingProgressSnapshot = ReturnType<typeof getCuttingProgressSnapshots>[number]
type SummarySpreadingSession = CuttingSummaryBuildOptions['markerStore']['sessions'][number]

interface CuttingSummaryResultLine {
  productionOrderId: string
  actualCutPieceQty: number
  materialConsumedMeter: number
  feiTicketCount: number
  waitHandoverStockPieceQty: number
  handoverOrderCount: number
  handoverRecordCount: number
  handedOverPieceQty: number
  remainingGapPieceQty: number
  differenceQty: number
}

interface CuttingSummaryPartResultLine {
  lineId: string
  cutOrderNo: string
  materialSku: string
  color: string
  size: string
  partName: string
  requiredPieceQty: number
  actualCutQty: number
  waitHandoverStockQty: number
  handedOverPieceQty: number
  remainingGapQty: number
}

interface CuttingSummaryRenderAggregates {
  specialReturnByProductionId: Map<string, SpecialCraftReturnStatusSummary>
  sewingDispatchByProductionId: Map<string, SewingDispatchProgressSummary>
  cuttingProgressSnapshots: CuttingProgressSnapshot[]
  resultLineByProductionId: Map<string, CuttingSummaryResultLine>
  partResultLinesByProductionId: Map<string, CuttingSummaryPartResultLine[]>
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function formatMeter(value: number): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Math.max(value, 0))} 米`
}

function sumNumber(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.max(Number(value || 0), 0), 0)
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getSessionActualMaterialMeter(session: SummarySpreadingSession): number {
  const rollLength = sumNumber((session.rolls || []).map((roll) => roll.actualLength))
  return Number((Math.max(Number(session.totalActualLength || 0), rollLength, 0)).toFixed(2))
}

function getRowSpreadingSessions(row: CuttingSummaryRow, sources: CuttingSummaryBuildOptions): SummarySpreadingSession[] {
  const cutOrderIds = new Set(row.relatedCutOrderIds)
  const markerPlanNos = new Set(row.relatedMarkerPlanNos)
  return sources.markerStore.sessions.filter(
    (session) =>
      (session.cutOrderIds || []).some((cutOrderId) => cutOrderIds.has(cutOrderId)) ||
      Boolean(session.markerPlanNo && markerPlanNos.has(session.markerPlanNo)),
  )
}

const submittedTransferBagStatuses = new Set(['已交出', '已回写', '差异', '异议中'])

function makePartResultKey(input: { color?: string; size?: string; sizeCode?: string; partName?: string; materialSku?: string }): string {
  return [input.color || '', input.size || input.sizeCode || '', input.partName || '', input.materialSku || '']
    .map((value) => String(value || '').trim().toLowerCase())
    .join('::')
}

function buildSummaryPartResultLines(row: CuttingSummaryRow, transferBags: CuttingSewingTransferBag[]): CuttingSummaryPartResultLine[] {
  const grouped = new Map<string, CuttingSummaryPartResultLine>()
  const upsert = (input: {
    cutOrderNo?: string
    materialSku?: string
    color?: string
    size?: string
    sizeCode?: string
    partName?: string
  }): CuttingSummaryPartResultLine => {
    const key = makePartResultKey(input)
    const current =
      grouped.get(key) ||
      {
        lineId: `${row.productionOrderId}::${key}`,
        cutOrderNo: input.cutOrderNo || '',
        materialSku: input.materialSku || '',
        color: input.color || '',
        size: input.size || input.sizeCode || '',
        partName: input.partName || '裁片',
        requiredPieceQty: 0,
        actualCutQty: 0,
        waitHandoverStockQty: 0,
        handedOverPieceQty: 0,
        remainingGapQty: 0,
      }
    if (!current.cutOrderNo && input.cutOrderNo) current.cutOrderNo = input.cutOrderNo
    if (!current.materialSku && input.materialSku) current.materialSku = input.materialSku
    grouped.set(key, current)
    return current
  }

  row.pieceTruth.gapRows.forEach((gapRow) => {
    const line = upsert(gapRow)
    line.requiredPieceQty += Math.max(gapRow.requiredPieceQty || 0, 0)
    line.actualCutQty += Math.max(gapRow.actualCutQty || 0, 0)
  })

  listAvailableCutPieceInventoryForSewingDispatch({ productionOrderId: row.productionOrderId }).forEach((inventoryLine) => {
    const line = upsert({
      cutOrderNo: inventoryLine.cutOrderNos[0] || '',
      materialSku: inventoryLine.materialSku,
      color: inventoryLine.colorName,
      sizeCode: inventoryLine.sizeCode,
      partName: inventoryLine.partName,
    })
    line.waitHandoverStockQty += Math.max(inventoryLine.availablePieceQty || 0, 0)
  })

  transferBags
    .filter((bag) => bag.productionOrderId === row.productionOrderId && submittedTransferBagStatuses.has(bag.status))
    .forEach((bag) => {
      bag.pieceLines.forEach((pieceLine) => {
        const line = upsert({
          cutOrderNo: bag.cuttingOrderNos[0] || '',
          color: pieceLine.colorName,
          sizeCode: pieceLine.sizeCode,
          partName: pieceLine.partName,
        })
        line.handedOverPieceQty += Math.max(pieceLine.scannedPieceQty || 0, 0)
      })
    })

  return Array.from(grouped.values())
    .map((line) => ({
      ...line,
      remainingGapQty: Math.max(
        line.requiredPieceQty - Math.max(line.actualCutQty, line.waitHandoverStockQty + line.handedOverPieceQty),
        0,
      ),
    }))
    .sort((left, right) =>
      `${left.materialSku}-${left.color}-${left.size}-${left.partName}`.localeCompare(
        `${right.materialSku}-${right.color}-${right.size}-${right.partName}`,
        'zh-CN',
      ),
    )
}

function buildCuttingSummaryResultLine(options: {
  row: CuttingSummaryRow
  sources: CuttingSummaryBuildOptions
  snapshot: CuttingProgressSnapshot | undefined
  dispatchOrders: CuttingSewingDispatchOrder[]
  dispatchBatches: CuttingSewingDispatchBatch[]
  transferBags: CuttingSewingTransferBag[]
  partLines: CuttingSummaryPartResultLine[]
}): CuttingSummaryResultLine {
  const { row, sources, snapshot, dispatchOrders, dispatchBatches, transferBags, partLines } = options
  const rowDispatchOrders = dispatchOrders.filter((order) => order.productionOrderId === row.productionOrderId)
  const rowDispatchBatches = dispatchBatches.filter((batch) => batch.productionOrderId === row.productionOrderId)
  const rowTransferBags = transferBags.filter((bag) => bag.productionOrderId === row.productionOrderId)
  const handoverOrderNos = uniqueNonEmpty(rowDispatchOrders.map((order) => order.handoverOrderNo || order.handoverOrderId))
  const handoverRecordNos = uniqueNonEmpty([
    ...rowDispatchOrders.flatMap((order) => order.handoverRecordIds || []),
    ...rowDispatchBatches.map((batch) => batch.handoverRecordNo || batch.handoverRecordId),
  ])
  const actualCutPieceQty = sumNumber(partLines.map((line) => line.actualCutQty)) || snapshot?.cuttingProgress.completedQty || 0
  const materialConsumedMeter = sumNumber(getRowSpreadingSessions(row, sources).map(getSessionActualMaterialMeter))
  const handedOverPieceQty = sumNumber(partLines.map((line) => line.handedOverPieceQty))
  const remainingGapPieceQty = sumNumber(partLines.map((line) => line.remainingGapQty))

  return {
    productionOrderId: row.productionOrderId,
    actualCutPieceQty,
    materialConsumedMeter,
    feiTicketCount: row.relatedTicketNos.length || snapshot?.feiTicketProgress.completedQty || 0,
    waitHandoverStockPieceQty: sumNumber(partLines.map((line) => line.waitHandoverStockQty)),
    handoverOrderCount: handoverOrderNos.length,
    handoverRecordCount: handoverRecordNos.length,
    handedOverPieceQty,
    remainingGapPieceQty,
    differenceQty: sumNumber([
      ...rowDispatchOrders.map((order) => order.differenceQty || 0),
      ...rowDispatchBatches.map((batch) => batch.differenceQty || 0),
      ...rowTransferBags.map((bag) => bag.differenceQty || 0),
    ]),
  }
}

function findSummaryMaterialIdentity(
  detail: CuttingSummaryDetailPanelData,
  materialSku: string,
  sourceNo?: string,
) {
  return (
    detail.sourceObjects.find((item) => item.sourceNo === sourceNo && item.materialSku === materialSku)
    || detail.sourceObjects.find((item) => item.materialSku === materialSku)
    || null
  )
}

function mergeByKey<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const merged = new Map<string, T>()
  seed.forEach((item) => merged.set(String(item[key]), item))
  stored.forEach((item) => merged.set(String(item[key]), item))
  return Array.from(merged.values())
}

function buildSources(): CuttingSummaryBuildOptions {
  return buildProjection().sources
}

function buildPageData(): {
  sources: CuttingSummaryBuildOptions
  viewModel: CuttingSummaryViewModel
} {
  const projection = buildProjection()
  return {
    sources: projection.sources,
    viewModel: projection.viewModel,
  }
}

function buildProjection(): FcsCuttingSummaryProjection {
  return buildFcsCuttingSummaryProjection()
}

function getPrefilterFromQuery(): CuttingDrillContext | null {
  const params = getWarehouseSearchParams()
  const context = readCuttingDrillContextFromLocation(params)
  const issueType = (params.get('issueType') as CuttingSummaryIssueType | null) || undefined
  const blockerSection = params.get('blockerSection') || undefined
  return context || issueType || blockerSection
    ? {
        ...context,
        issueType,
        blockerSection: blockerSection || context?.blockerSection,
      }
    : null
}

function rowMatchesPrefilter(row: CuttingSummaryRow, prefilter: CuttingDrillContext | null): boolean {
  if (!prefilter) return true
  if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
  if (prefilter.cutOrderNo && !row.relatedCutOrderNos.includes(prefilter.cutOrderNo)) return false
  if (prefilter.markerPlanNo && !row.relatedMarkerPlanNos.includes(prefilter.markerPlanNo)) return false
  if (prefilter.ticketNo && !row.relatedTicketNos.includes(prefilter.ticketNo)) return false
  if (prefilter.bagCode && !row.relatedBagCodes.includes(prefilter.bagCode)) return false
  if (prefilter.usageNo && !row.relatedUsageNos.includes(prefilter.usageNo)) return false
  if (prefilter.suggestionId && !row.relatedSuggestionIds.includes(prefilter.suggestionId)) return false
  if (prefilter.processOrderNo && !row.relatedProcessOrderNos.includes(prefilter.processOrderNo)) return false
  if (prefilter.materialSku && !row.relatedMaterialSkus.includes(prefilter.materialSku)) return false
  if (prefilter.issueType && !row.issueTypes.includes(prefilter.issueType as CuttingSummaryIssueType)) return false
  if (prefilter.blockerSection && !row.blockerItems.some((item) => item.sectionKey === prefilter.blockerSection)) return false
  return true
}

function getBlockerSourceFallback(row: CuttingSummaryRow, sourceType: CuttingCheckSourceObjectType): boolean {
  if (sourceType === 'CUT_ORDER') return row.relatedCutOrderNos.length > 0
  if (sourceType === 'MARKER_PLAN') return row.relatedMarkerPlanNos.length > 0
  if (sourceType === 'REPLENISHMENT') return row.relatedSuggestionIds.length > 0
  if (sourceType === 'FEI_OWNER') return row.relatedCutOrderNos.length > 0 && row.relatedTicketNos.length > 0
  if (sourceType === 'FEI_PRINT_JOB') return Boolean(row.latestPrintJobNo)
  if (sourceType === 'BAG_USAGE') return row.relatedUsageNos.length > 0
  return row.relatedProcessOrderNos.length > 0
}

function getSourceNumberTokens(row: CuttingSummaryRow): string[] {
  return [
    ...row.relatedCutOrderNos,
    ...row.relatedMarkerPlanNos,
    ...row.relatedSuggestionIds,
    ...row.relatedProcessOrderNos,
    ...row.relatedBagCodes,
    ...row.relatedUsageNos,
    ...row.relatedTicketNos,
    row.latestPrintJobNo,
    ...row.blockerItems.map((item) => item.sourceNo),
  ]
    .filter(Boolean)
    .map((item) => item.toLowerCase())
}

function getHighestBlockerWeight(row: CuttingSummaryRow): number {
  if (row.blockerItems.some((item) => item.severity === 'HIGH')) return 3
  if (row.blockerItems.some((item) => item.severity === 'MEDIUM')) return 2
  if (row.blockerItems.some((item) => item.severity === 'LOW')) return 1
  return 0
}

function getFilteredRows(
  viewModel: CuttingSummaryViewModel,
  options: { ignoreIssueType?: boolean } = {},
): CuttingSummaryRow[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const materialSkuKeyword = state.filters.materialSku.trim().toLowerCase()
  const sourceNoKeyword = state.filters.sourceNoKeyword.trim().toLowerCase()

  return filterSummaryByIssueType(viewModel.rows, options.ignoreIssueType ? 'ALL' : state.filters.issueType)
    .filter((row) => {
      if (!rowMatchesPrefilter(row, state.prefilter)) return false
      if (state.filters.riskLevel !== 'ALL' && row.overallRiskLevel !== state.filters.riskLevel) return false
      if (state.filters.currentStage !== 'ALL') {
        const matchesStage =
          state.filters.currentStage === 'NOT_STARTED'
            ? row.currentStageKey === 'WAITING_PREP' || row.currentStageKey === 'PREPPING' || row.currentStageKey === 'WAITING_CLAIM'
            : state.filters.currentStage === 'STARTED'
              ? row.currentStageKey === 'CUTTING' || row.currentStageKey === 'WAITING_INBOUND' || row.currentStageKey === 'DONE'
              : row.currentStageKey === state.filters.currentStage
        if (!matchesStage) return false
      }
      if (state.filters.completionState !== 'ALL' && row.completionState !== state.filters.completionState) return false
      if (state.filters.pendingReplenishmentOnly && row.pendingReplenishmentCount === 0) return false
      if (state.filters.pendingTicketsOnly && row.unprintedOwnerCount === 0) return false
      if (state.filters.pendingBagOnly && row.openBagUsageCount === 0) return false
      if (state.filters.specialProcessOnly && row.openSpecialProcessCount === 0) return false

      if (state.filters.blockerSection !== 'ALL') {
        const hasBlockingSection = row.blockerItems.some((item) => item.sectionKey === state.filters.blockerSection)
        const hasRelevantSection = row.checkSections.some(
          (section) => section.sectionKey === state.filters.blockerSection && section.stateKey !== 'NOT_APPLICABLE',
        )
        if (row.blockerItems.length) {
          if (!hasBlockingSection) return false
        } else if (!hasRelevantSection) {
          return false
        }
      }

      if (state.filters.sourceObjectType !== 'ALL') {
        const hasBlockedSourceType = row.blockerItems.some((item) => item.sourceType === state.filters.sourceObjectType)
        if (row.blockerItems.length) {
          if (!hasBlockedSourceType) return false
        } else if (!getBlockerSourceFallback(row, state.filters.sourceObjectType)) {
          return false
        }
      }

      if (keyword && !row.keywordIndex.some((token) => token.includes(keyword))) return false

      if (
        materialSkuKeyword &&
        ![
          ...row.relatedMaterialSkus.map((item) => item.toLowerCase()),
          ...row.blockerItems.map((item) => item.materialSku.toLowerCase()),
        ].some((token) => token.includes(materialSkuKeyword))
      ) {
        return false
      }

      if (sourceNoKeyword && !getSourceNumberTokens(row).some((token) => token.includes(sourceNoKeyword))) return false

      return true
    })
    .sort((left, right) => {
      const completionDiff = completionSortWeight[left.completionState] - completionSortWeight[right.completionState]
      if (completionDiff !== 0) return completionDiff
      const blockerDiff = right.blockingCount - left.blockingCount
      if (blockerDiff !== 0) return blockerDiff
      const severityDiff = getHighestBlockerWeight(right) - getHighestBlockerWeight(left)
      if (severityDiff !== 0) return severityDiff
      const pendingDiff = right.pendingActionCount - left.pendingActionCount
      if (pendingDiff !== 0) return pendingDiff
      return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    })
}

function getActiveRowId(rows: CuttingSummaryRow[], issues: CuttingSummaryIssue[]): string | null {
  if (state.activeRowId && rows.some((row) => row.rowId === state.activeRowId)) return state.activeRowId
  if (state.activeIssueId) {
    const issue = issues.find((item) => item.issueId === state.activeIssueId)
    const matched = rows.find((row) => issue?.relatedRowIds.includes(row.rowId))
    if (matched) return matched.rowId
  }
  return rows[0]?.rowId || null
}

function syncStateWithQuery(viewModel: CuttingSummaryViewModel): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return

  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()
  state.drillContext = state.prefilter

  if (state.prefilter?.issueType) state.filters.issueType = state.prefilter.issueType as CuttingSummaryIssueType
  if (state.prefilter?.blockerSection) state.filters.blockerSection = state.prefilter.blockerSection as CuttingCheckSectionKey

  if (state.prefilter?.issueType) {
    const issue = viewModel.issues.find((item) => item.issueType === state.prefilter?.issueType) || null
    state.activeIssueId = issue?.issueId || null
    state.activeRowId = issue?.relatedRowIds[0] || null
  } else {
    const matched = viewModel.rows.find((row) => rowMatchesPrefilter(row, state.prefilter))
    state.activeRowId = matched?.rowId || viewModel.rows[0]?.rowId || null
    state.activeIssueId = null
  }

  if (state.prefilter?.autoOpenDetail && state.activeRowId) {
    state.activeRowId = state.activeRowId
  }
}

function clearLocateState(): void {
  state.prefilter = null
  state.drillContext = null
  state.querySignature = getCanonicalCuttingPath('summary')
  appStore.navigate(getCanonicalCuttingPath('summary'))
}

function buildSummaryDrillContext(
  payload: Record<string, string | undefined>,
  extra?: Partial<CuttingDrillContext>,
): CuttingDrillContext {
  return buildCuttingDrillContext(payload, 'cutting-summary', {
    productionOrderNo: extra?.productionOrderNo,
    productionOrderId: extra?.productionOrderId,
    issueType: state.filters.issueType !== 'ALL' ? state.filters.issueType : undefined,
    blockerSection: state.filters.blockerSection !== 'ALL' ? state.filters.blockerSection : undefined,
    autoOpenDetail: true,
    ...extra,
  })
}

function navigateWithPayload(
  target: SummaryNavigationTarget,
  payload: Record<string, string | undefined>,
  extra?: Partial<CuttingDrillContext>,
): boolean {
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, buildSummaryDrillContext(payload, extra)))
  return true
}

function getResultLines(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): CuttingSummaryResultLine[] {
  return rows
    .map((row) => aggregates.resultLineByProductionId.get(row.productionOrderId))
    .filter((line): line is CuttingSummaryResultLine => Boolean(line))
}

function renderCuttingResultOverview(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): string {
  const resultLines = getResultLines(rows, aggregates)
  const totals = resultLines.reduce(
    (summary, line) => {
      summary.actualCutPieceQty += line.actualCutPieceQty
      summary.materialConsumedMeter += line.materialConsumedMeter
      summary.feiTicketCount += line.feiTicketCount
      summary.waitHandoverStockPieceQty += line.waitHandoverStockPieceQty
      summary.handoverOrderCount += line.handoverOrderCount
      summary.handoverRecordCount += line.handoverRecordCount
      summary.handedOverPieceQty += line.handedOverPieceQty
      summary.remainingGapPieceQty += line.remainingGapPieceQty
      summary.differenceQty += line.differenceQty
      return summary
    },
    {
      actualCutPieceQty: 0,
      materialConsumedMeter: 0,
      feiTicketCount: 0,
      waitHandoverStockPieceQty: 0,
      handoverOrderCount: 0,
      handoverRecordCount: 0,
      handedOverPieceQty: 0,
      remainingGapPieceQty: 0,
      differenceQty: 0,
    },
  )

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${renderCompactKpiCard('生产单数', rows.length, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('实际裁剪裁片', totals.actualCutPieceQty, '来自铺布裁剪与部位进度', 'text-violet-600')}
      ${renderCompactKpiCard('面料实际消耗', formatMeter(totals.materialConsumedMeter), '铺布单实际用量合计', 'text-blue-600')}
      ${renderCompactKpiCard('菲票数量', totals.feiTicketCount, '裁剪完成后生成', 'text-cyan-600')}
      ${renderCompactKpiCard('待交出仓库存', totals.waitHandoverStockPieceQty, '未被交出装袋占用的裁片', 'text-emerald-600')}
      ${renderCompactKpiCard('交出单 / 交出记录', `${formatCount(totals.handoverOrderCount)} / ${formatCount(totals.handoverRecordCount)}`, '通用交出单结构', 'text-slate-700')}
      ${renderCompactKpiCard('已交出裁片', totals.handedOverPieceQty, '已提交交出记录的裁片', 'text-blue-600')}
      ${renderCompactKpiCard('剩余缺口', totals.remainingGapPieceQty, `差异 ${formatCount(totals.differenceQty)}`, totals.remainingGapPieceQty ? 'text-amber-600' : 'text-emerald-600')}
    </section>
  `
}

function buildSummaryRenderAggregates(rows: CuttingSummaryRow[], sources: CuttingSummaryBuildOptions): CuttingSummaryRenderAggregates {
  const productionIds = new Set(rows.map((row) => row.productionOrderId))
  const snapshots = getCuttingProgressSnapshots().filter((snapshot) => productionIds.has(snapshot.productionOrderId))
  const snapshotByProductionId = new Map(snapshots.map((snapshot) => [snapshot.productionOrderId, snapshot] as const))
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((order) => productionIds.has(order.productionOrderId))
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((batch) => productionIds.has(batch.productionOrderId))
  const transferBags = listCuttingSewingTransferBags().filter((bag) => productionIds.has(bag.productionOrderId))
  const partResultLinesByProductionId = new Map(
    rows.map((row) => [row.productionOrderId, buildSummaryPartResultLines(row, transferBags)] as const),
  )
  const resultLineByProductionId = new Map(
    rows.map((row) => [
      row.productionOrderId,
      buildCuttingSummaryResultLine({
        row,
        sources,
        snapshot: snapshotByProductionId.get(row.productionOrderId),
        dispatchOrders,
        dispatchBatches,
        transferBags,
        partLines: partResultLinesByProductionId.get(row.productionOrderId) || [],
      }),
    ] as const),
  )

  return {
    specialReturnByProductionId: getCuttingSpecialCraftReturnStatusByProductionOrders([...productionIds]),
    sewingDispatchByProductionId: new Map(
      rows.map((row) => [row.productionOrderId, getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId)]),
    ),
    cuttingProgressSnapshots: snapshots,
    resultLineByProductionId,
    partResultLinesByProductionId,
  }
}

function getCheckItemStatus(item: CuttingResultCheckItem): CuttingResultCheckStatus {
  return state.resolvedCheckItemIds.has(item.checkItemId) ? '已处理' : item.handlingStatus
}

function buildCheckRoute(
  row: CuttingSummaryRow,
  target: SummaryNavigationTarget,
  extra?: Partial<CuttingDrillContext>,
): string {
  return buildCuttingRouteWithContext(
    target as CuttingNavigationTarget,
    buildCuttingDrillContext(row.navigationPayload[target], 'cutting-summary', {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      autoOpenDetail: true,
      ...extra,
    }),
  )
}

function buildDirectCheckRoute(path: string, row: CuttingSummaryRow, extra?: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams()
  params.set('sourcePageKey', 'cutting-summary')
  params.set('productionOrderNo', row.productionOrderNo)
  params.set('productionOrderId', row.productionOrderId)
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`
}

function findPrimaryCutOrder(row: CuttingSummaryRow, sources: CuttingSummaryBuildOptions): CuttingSummaryBuildOptions['cutOrderRows'][number] | null {
  return (
    sources.cutOrderRows.find((item) => item.productionOrderNo === row.productionOrderNo && item.currentStage.key === 'CLOSED') ||
    sources.cutOrderRows.find((item) => item.productionOrderNo === row.productionOrderNo && item.cutOrderNo === row.relatedCutOrderNos[0]) ||
    sources.cutOrderRows.find((item) => item.productionOrderNo === row.productionOrderNo) ||
    null
  )
}

function buildCheckMaterialIdentity(cutOrder: CuttingSummaryBuildOptions['cutOrderRows'][number] | null): CuttingResultCheckItem['materialIdentity'] {
  if (!cutOrder) return null
  return {
    materialSku: cutOrder.materialSku,
    materialName: cutOrder.materialName || cutOrder.materialLabel || cutOrder.materialSku,
    materialColor: cutOrder.materialColor || cutOrder.color,
    materialAlias: cutOrder.materialAlias,
    materialImageUrl: cutOrder.materialImageUrl,
    materialUnit: cutOrder.materialUnit,
  }
}

function buildCheckPatternIdentity(cutOrder: CuttingSummaryBuildOptions['cutOrderRows'][number] | null): CuttingResultCheckItem['patternIdentity'] {
  if (!cutOrder) return null
  return {
    patternFileId: cutOrder.patternFileId,
    patternFileName: cutOrder.patternFileName,
    patternVersion: cutOrder.patternVersion,
    patternKind: cutOrder.patternKind,
    effectiveWidthText: cutOrder.effectiveWidthText,
    piecePartNames: cutOrder.piecePartNames,
  }
}

function normalizeCheckLevel(level: CuttingSummaryRiskLevel | string | undefined): CuttingResultCheckLevel {
  if (level === 'HIGH' || level === '高风险' || level === '紧急') return '紧急'
  if (level === 'MEDIUM' || level === '中风险' || level === '需处理') return '需处理'
  return '提示'
}

function buildCuttingResultCheckItems(
  rows: CuttingSummaryRow[],
  sources: CuttingSummaryBuildOptions,
  aggregates: CuttingSummaryRenderAggregates,
): CuttingResultCheckItem[] {
  const items: CuttingResultCheckItem[] = []
  const pushItem = (
    row: CuttingSummaryRow,
    input: Omit<CuttingResultCheckItem, 'materialIdentity' | 'patternIdentity' | 'productionOrderId' | 'productionOrderNo' | 'cutOrderId' | 'cutOrderNo'> & {
      cutOrder?: CuttingSummaryBuildOptions['cutOrderRows'][number] | null
    },
  ) => {
    const cutOrder = input.cutOrder === undefined ? findPrimaryCutOrder(row, sources) : input.cutOrder
    items.push({
      ...input,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      cutOrderId: cutOrder?.cutOrderId || '',
      cutOrderNo: cutOrder?.cutOrderNo || '',
      materialIdentity: buildCheckMaterialIdentity(cutOrder || null),
      patternIdentity: buildCheckPatternIdentity(cutOrder || null),
    })
  }

  rows.forEach((row) => {
    const primaryCutOrder = findPrimaryCutOrder(row, sources)
    const rowCutOrderIds = new Set(row.relatedCutOrderIds)
    const spreadingSessions = sources.markerStore.sessions.filter((session) =>
      session.cutOrderIds.some((cutOrderId) => rowCutOrderIds.has(cutOrderId)),
    )
    const spreadingDifferenceRecords = listSpreadingDifferences({ sessions: spreadingSessions }).filter((difference) =>
      difference.productionOrderNos.includes(row.productionOrderNo),
    )
    const spreadingDifferenceRecord = spreadingDifferenceRecords.find(
      (difference) => difference.differenceType === '实铺小于计划' && difference.handlingStatus !== '已处理',
    )
    if (spreadingDifferenceRecord) {
      pushItem(row, {
        checkItemId: `check-spreading-difference-${spreadingDifferenceRecord.differenceId}`,
        checkType: '铺布差异',
        checkLevel: spreadingDifferenceRecord.differenceLevel === '提示' ? '提示' : '需处理',
        sourceObjectType: '铺布单',
        sourceObjectId: spreadingDifferenceRecord.spreadingOrderId,
        sourceObjectNo: spreadingDifferenceRecord.spreadingOrderNo,
        spreadingOrderId: spreadingDifferenceRecord.spreadingOrderId,
        spreadingOrderNo: spreadingDifferenceRecord.spreadingOrderNo,
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `实铺小于计划：实际 ${formatCount(spreadingDifferenceRecord.actualValue)} ${spreadingDifferenceRecord.unit}，计划 ${formatCount(spreadingDifferenceRecord.plannedValue)} ${spreadingDifferenceRecord.unit}。`,
        impactText: spreadingDifferenceRecord.evidence.summary || '允许提交，但需要判断是否补料、补录、继续补排或仅记录差异。',
        suggestedAction: '去铺布单定位差异',
        actionRoute: buildDirectCheckRoute(getCanonicalCuttingPath('spreading-list'), row, {
          spreadingOrderNo: spreadingDifferenceRecord.spreadingOrderNo,
        }),
        handlingStatus: spreadingDifferenceRecord.handlingStatus === '仅记录' ? '已处理' : spreadingDifferenceRecord.handlingStatus,
        ownerRole: '裁床主管',
        ownerName: spreadingDifferenceRecord.detectedBy || '铺布复核员',
        occurredAt: spreadingDifferenceRecord.detectedAt,
        updatedAt: spreadingDifferenceRecord.detectedAt,
        cutOrder: primaryCutOrder,
      })
    }
    const spreadingDiff = spreadingSessions.find(
      (session) => session.plannedLayers > 0 && session.actualLayers > 0 && session.actualLayers < session.plannedLayers,
    )
    if (spreadingDiff && !spreadingDifferenceRecord) {
      pushItem(row, {
        checkItemId: `check-spreading-${spreadingDiff.spreadingSessionId}`,
        checkType: '铺布差异',
        checkLevel: '需处理',
        sourceObjectType: '铺布单',
        sourceObjectId: spreadingDiff.spreadingSessionId,
        sourceObjectNo: spreadingDiff.sessionNo || spreadingDiff.spreadingSessionId,
        spreadingOrderId: spreadingDiff.spreadingSessionId,
        spreadingOrderNo: spreadingDiff.sessionNo || '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `实铺 ${formatCount(spreadingDiff.actualLayers)} 层，小于计划 ${formatCount(spreadingDiff.plannedLayers)} 层。`,
        impactText: `实际用量 ${formatMeter(spreadingDiff.totalActualLength)}，需核查是否继续补排或仅记录差异。`,
        suggestedAction: '去铺布单详情核查差异',
        actionRoute: buildCheckRoute(row, 'markerSpreading', {
          spreadingSessionId: spreadingDiff.spreadingSessionId,
          spreadingSessionNo: spreadingDiff.sessionNo,
        }),
        handlingStatus: '待处理',
        ownerRole: '裁床主管',
        ownerName: spreadingDiff.ownerName || '铺布复核员',
        occurredAt: spreadingDiff.updatedFromPdaAt || spreadingDiff.actualEndAt || spreadingDiff.updatedAt,
        updatedAt: spreadingDiff.updatedAt,
        cutOrder: primaryCutOrder,
      })
    }

    const cuttingDiff = spreadingSessions.find((session) => {
      const plannedQty = session.theoreticalCutGarmentQty || session.theoreticalActualCutPieceQty || 0
      const actualQty = session.actualCutGarmentQty || session.actualCutPieceQty || 0
      return plannedQty > 0 && actualQty > 0 && actualQty < plannedQty
    })
    const cuttingDifferenceRecord = spreadingDifferenceRecords.find(
      (difference) => difference.differenceType === '实裁小于计划' && difference.handlingStatus !== '已处理',
    )
    if (cuttingDifferenceRecord) {
      pushItem(row, {
        checkItemId: `check-cutting-difference-${cuttingDifferenceRecord.differenceId}`,
        checkType: '裁剪差异',
        checkLevel: cuttingDifferenceRecord.differenceLevel === '提示' ? '提示' : '需处理',
        sourceObjectType: '铺布单',
        sourceObjectId: cuttingDifferenceRecord.spreadingOrderId,
        sourceObjectNo: cuttingDifferenceRecord.spreadingOrderNo,
        spreadingOrderId: cuttingDifferenceRecord.spreadingOrderId,
        spreadingOrderNo: cuttingDifferenceRecord.spreadingOrderNo,
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `实裁小于计划：实际 ${formatCount(cuttingDifferenceRecord.actualValue)} ${cuttingDifferenceRecord.unit}，计划 ${formatCount(cuttingDifferenceRecord.plannedValue)} ${cuttingDifferenceRecord.unit}。`,
        impactText: cuttingDifferenceRecord.evidence.summary || '需要确认补录、继续补排、关闭裁片单或仅记录差异。',
        suggestedAction: '去补料管理审核',
        actionRoute: buildCheckRoute(row, 'replenishment', {
          suggestionId: cuttingDifferenceRecord.linkedReplenishmentId,
        }),
        handlingStatus: cuttingDifferenceRecord.handlingStatus === '仅记录' ? '已处理' : cuttingDifferenceRecord.handlingStatus,
        ownerRole: '补料审核',
        ownerName: cuttingDifferenceRecord.detectedBy || '补料审核员',
        occurredAt: cuttingDifferenceRecord.detectedAt,
        updatedAt: cuttingDifferenceRecord.detectedAt,
        cutOrder: primaryCutOrder,
      })
    }
    if (cuttingDiff && !cuttingDifferenceRecord) {
      const plannedQty = cuttingDiff.theoreticalCutGarmentQty || cuttingDiff.theoreticalActualCutPieceQty || 0
      const actualQty = cuttingDiff.actualCutGarmentQty || cuttingDiff.actualCutPieceQty || 0
      pushItem(row, {
        checkItemId: `check-cutting-${cuttingDiff.spreadingSessionId}`,
        checkType: '裁剪差异',
        checkLevel: '需处理',
        sourceObjectType: '铺布单',
        sourceObjectId: cuttingDiff.spreadingSessionId,
        sourceObjectNo: cuttingDiff.sessionNo || cuttingDiff.spreadingSessionId,
        spreadingOrderId: cuttingDiff.spreadingSessionId,
        spreadingOrderNo: cuttingDiff.sessionNo || '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `实裁小于计划：实际裁剪 ${formatCount(actualQty)} 件，小于计划 ${formatCount(plannedQty)} 件。`,
        impactText: '需要确认是补录、继续补排、关闭裁片单，还是仅记录差异。',
        suggestedAction: '去补料管理审核',
        actionRoute: buildCheckRoute(row, 'replenishment'),
        handlingStatus: '待处理',
        ownerRole: '补料审核',
        ownerName: '补料审核员',
        occurredAt: cuttingDiff.cuttingFinishedAt || cuttingDiff.actualEndAt || cuttingDiff.updatedAt,
        updatedAt: cuttingDiff.updatedAt,
        cutOrder: primaryCutOrder,
      })
    }

    const replenishment = sources.replenishmentView.rows.find(
      (item) =>
        item.productionOrderNos.includes(row.productionOrderNo) &&
        ['PENDING_REVIEW', 'PENDING_SUPPLEMENT', 'APPROVED_PENDING_ACTION', 'IN_ACTION'].includes(item.statusMeta.key),
    )
    if (replenishment) {
      pushItem(row, {
        checkItemId: `check-replenishment-${replenishment.suggestionId}`,
        checkType: '补料待审核',
        checkLevel: normalizeCheckLevel(replenishment.riskMeta.label),
        sourceObjectType: '补料管理',
        sourceObjectId: replenishment.suggestionId,
        sourceObjectNo: replenishment.suggestionNo,
        spreadingOrderId: replenishment.context.session?.spreadingSessionId || '',
        spreadingOrderNo: replenishment.context.session?.sessionNo || '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `${replenishment.differenceTypeSummary || replenishment.sourceSummary}，${replenishment.reviewStatusLabel}。`,
        impactText: replenishment.differenceSummary || replenishment.majorGapSummary || '审核后决定是否补料、补录、继续补排、关闭裁片单或仅记录差异。',
        suggestedAction: replenishment.nextActionLabel || '去补料管理处理',
        actionRoute: buildCheckRoute(row, 'replenishment', {
          suggestionId: replenishment.suggestionId,
          suggestionNo: replenishment.suggestionNo,
        }),
        handlingStatus: replenishment.statusMeta.key === 'PENDING_SUPPLEMENT' ? '审核中' : '待处理',
        ownerRole: '补料审核',
        ownerName: replenishment.review?.reviewedBy || '补料审核员',
        occurredAt: replenishment.createdAt,
        updatedAt: replenishment.reviewedAt || replenishment.createdAt,
        cutOrder: primaryCutOrder,
      })

      if ((replenishment.nextActionLabel || '').includes('可排唛架') || (replenishment.reviewResultLabel || '').includes('继续补排')) {
        pushItem(row, {
          checkItemId: `check-replan-${replenishment.suggestionId}`,
          checkType: '补排待处理',
          checkLevel: '需处理',
          sourceObjectType: '补料管理',
          sourceObjectId: replenishment.suggestionId,
          sourceObjectNo: replenishment.suggestionNo,
          spreadingOrderId: replenishment.context.session?.spreadingSessionId || '',
          spreadingOrderNo: replenishment.context.session?.sessionNo || '',
          feiTicketId: '',
          feiTicketNo: '',
          handoverOrderId: '',
          handoverRecordId: '',
          problemText: '补料审核指向继续补排，需要回到可排唛架裁片单确认余额和组合规则。',
          impactText: '未处理前可能影响后续唛架方案和铺布单安排。',
          suggestedAction: '去可排唛架裁片单',
          actionRoute: buildCheckRoute(row, 'cuttablePool'),
          handlingStatus: '待处理',
          ownerRole: '裁前计划',
          ownerName: '唛架计划员',
          occurredAt: replenishment.reviewedAt || replenishment.createdAt,
          updatedAt: replenishment.reviewedAt || replenishment.createdAt,
          cutOrder: primaryCutOrder,
        })
      }
    }

    const closedCutOrders = sources.cutOrderRows.filter((item) => item.productionOrderNo === row.productionOrderNo && item.currentStage.key === 'CLOSED')
    closedCutOrders.slice(0, 2).forEach((cutOrder) => {
      pushItem(row, {
        checkItemId: `check-closed-${cutOrder.cutOrderId}`,
        checkType: '裁片单已关闭',
        checkLevel: '提示',
        sourceObjectType: '裁片单',
        sourceObjectId: cutOrder.cutOrderId,
        sourceObjectNo: cutOrder.cutOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `裁片单已关闭，关闭原因：${cutOrder.closeReasonText || cutOrder.closeReason || '未填写'}`,
        impactText: '关闭后不再进入可排唛架，也不再要求继续配料或领料；历史菲票、库存和交出记录仍可追溯。',
        suggestedAction: '查看关闭记录',
        actionRoute: buildCheckRoute(row, 'cutOrders', { cutOrderId: cutOrder.cutOrderId, cutOrderNo: cutOrder.cutOrderNo }),
        handlingStatus: '待处理',
        ownerRole: '裁床主管',
        ownerName: cutOrder.closedBy || '裁床主管',
        occurredAt: cutOrder.closedAt,
        updatedAt: cutOrder.closedAt,
        cutOrder,
      })
    })

    const ticketOwners = sources.feiViewModel.owners.filter((owner) => owner.productionOrderNo === row.productionOrderNo)
    const pendingTicketOwner = ticketOwners.find((owner) => ['NOT_GENERATED', 'DRAFT', 'PENDING_SUPPLEMENT'].includes(owner.ticketStatus))
    if (pendingTicketOwner) {
      const ownerCutOrder = sources.cutOrderRows.find((item) => item.cutOrderId === pendingTicketOwner.cutOrderId) || primaryCutOrder
      pushItem(row, {
        checkItemId: `check-fei-first-${pendingTicketOwner.id}`,
        checkType: '菲票待处理',
        checkLevel: '需处理',
        sourceObjectType: '菲票',
        sourceObjectId: pendingTicketOwner.id,
        sourceObjectNo: pendingTicketOwner.cutOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `裁片单 ${pendingTicketOwner.cutOrderNo} 菲票待首打。`,
        impactText: '未首打菲票不能进入裁床待交出仓库存。',
        suggestedAction: '去菲票打印页',
        actionRoute: buildCheckRoute(row, 'feiTickets', pendingTicketOwner.navigationPayload.feiTickets),
        handlingStatus: '待处理',
        ownerRole: '菲票打印',
        ownerName: '打印员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: ownerCutOrder,
      })
    }
    const reprintTicketOwner = ticketOwners.find((owner) => owner.ticketStatus === 'PARTIAL_PRINTED')
    if (reprintTicketOwner) {
      const ownerCutOrder = sources.cutOrderRows.find((item) => item.cutOrderId === reprintTicketOwner.cutOrderId) || primaryCutOrder
      pushItem(row, {
        checkItemId: `check-fei-reprint-${reprintTicketOwner.id}`,
        checkType: '菲票待处理',
        checkLevel: '需处理',
        sourceObjectType: '菲票',
        sourceObjectId: reprintTicketOwner.id,
        sourceObjectNo: reprintTicketOwner.cutOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `裁片单 ${reprintTicketOwner.cutOrderNo} 菲票需补打。`,
        impactText: '补打前需要核对编号范围、特殊工艺和承接工厂。',
        suggestedAction: '去菲票补打页',
        actionRoute: buildCheckRoute(row, 'feiTickets', { ...reprintTicketOwner.navigationPayload.feiTickets, focusTab: 'printed' }),
        handlingStatus: '待处理',
        ownerRole: '菲票打印',
        ownerName: '打印员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: ownerCutOrder,
      })
    }

    const waitingInbound = sources.cutPieceWarehouseView.items.find(
      (item) => item.productionOrderNo === row.productionOrderNo && item.warehouseStatus.key === 'PENDING_INBOUND',
    )
    if (waitingInbound) {
      const itemCutOrder = sources.cutOrderRows.find((item) => item.cutOrderId === waitingInbound.cutOrderId) || primaryCutOrder
      pushItem(row, {
        checkItemId: `check-inbound-${waitingInbound.warehouseItemId}`,
        checkType: '入仓待处理',
        checkLevel: '需处理',
        sourceObjectType: '裁床待交出仓',
        sourceObjectId: waitingInbound.warehouseItemId,
        sourceObjectNo: waitingInbound.spreadingSessionNo || waitingInbound.cutOrderNo,
        spreadingOrderId: waitingInbound.spreadingSessionId,
        spreadingOrderNo: waitingInbound.spreadingSessionNo,
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `已打印菲票对应裁片待入仓确认，数量 ${formatCount(waitingInbound.pieceQty)} 片。`,
        impactText: '未入仓前不能成为裁床待交出仓可分配库存。',
        suggestedAction: '去裁床待交出仓',
        actionRoute: buildDirectCheckRoute(getCanonicalCuttingPath('warehouse-management-wait-handover'), row),
        handlingStatus: '待处理',
        ownerRole: '待交出仓',
        ownerName: waitingInbound.inWarehouseBy || '仓管',
        occurredAt: waitingInbound.inWarehouseAt,
        updatedAt: waitingInbound.inWarehouseAt,
        cutOrder: itemCutOrder,
      })
    }

    const sewingSummary = aggregates.sewingDispatchByProductionId.get(row.productionOrderId)
    if (row.openBagUsageCount > 0 || (sewingSummary?.transferBagCount || 0) > 0) {
      pushItem(row, {
        checkItemId: `check-sorting-${row.productionOrderId}`,
        checkType: '分拣待处理',
        checkLevel: '需处理',
        sourceObjectType: '待交出仓裁片配料',
        sourceObjectId: row.productionOrderId,
        sourceObjectNo: row.productionOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: '车缝任务分配后仍有待二次分拣或待重新装袋事项。',
        impactText: `中转袋 ${formatCount(sewingSummary?.transferBagCount || row.openBagUsageCount)} 个，需按交出对象重新核对裁片。`,
        suggestedAction: '去待交出仓裁片配料',
        actionRoute: buildDirectCheckRoute(`${getCanonicalCuttingPath('warehouse-management-wait-handover')}?tab=picking`, row),
        handlingStatus: '待处理',
        ownerRole: '待交出仓',
        ownerName: '仓管',
        occurredAt: '',
        updatedAt: '',
        cutOrder: primaryCutOrder,
      })
    }

    const resultLine = aggregates.resultLineByProductionId.get(row.productionOrderId)
    if ((resultLine?.remainingGapPieceQty || 0) > 0) {
      pushItem(row, {
        checkItemId: `check-handover-shortage-${row.productionOrderId}`,
        checkType: '交出后缺口',
        checkLevel: '需处理',
        sourceObjectType: '交出记录',
        sourceObjectId: row.productionOrderId,
        sourceObjectNo: row.relatedUsageNos[0] || row.productionOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: row.relatedTicketNos[0] || '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `交出后仍有缺口 ${formatCount(resultLine?.remainingGapPieceQty || 0)} 片。`,
        impactText: '缺口是交出后的计算结果，不阻断后续有效裁片继续交出。',
        suggestedAction: '去交出记录核查缺口',
        actionRoute: buildDirectCheckRoute(getCanonicalCuttingPath('handover-orders'), row),
        handlingStatus: '待处理',
        ownerRole: '交出复核',
        ownerName: '交出复核员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: primaryCutOrder,
      })
    }

    if ((resultLine?.differenceQty || 0) > 0 || (sewingSummary?.differenceTransferBagCount || 0) > 0 || (sewingSummary?.objectionTransferBagCount || 0) > 0) {
      pushItem(row, {
        checkItemId: `check-receiver-diff-${row.productionOrderId}`,
        checkType: '接收差异',
        checkLevel: '紧急',
        sourceObjectType: '交出记录',
        sourceObjectId: row.productionOrderId,
        sourceObjectNo: row.relatedUsageNos[0] || row.productionOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: row.relatedTicketNos[0] || '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `接收差异 / 异议数量 ${formatCount((resultLine?.differenceQty || 0) + (sewingSummary?.differenceTransferBagCount || 0) + (sewingSummary?.objectionTransferBagCount || 0))}。`,
        impactText: '需要核对交出记录、接收回写和异议处理记录。',
        suggestedAction: '去交出记录处理差异',
        actionRoute: buildDirectCheckRoute(getCanonicalCuttingPath('handover-orders'), row),
        handlingStatus: '待处理',
        ownerRole: '交出复核',
        ownerName: '交出复核员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: primaryCutOrder,
      })
    }

    const specialSummary = aggregates.specialReturnByProductionId.get(row.productionOrderId)
    if ((specialSummary?.waitReturnCount || 0) > 0) {
      pushItem(row, {
        checkItemId: `check-special-pending-${row.productionOrderId}`,
        checkType: '特殊工艺未回仓',
        checkLevel: '需处理',
        sourceObjectType: '特殊工艺',
        sourceObjectId: row.productionOrderId,
        sourceObjectNo: row.relatedProcessOrderNos[0] || row.productionOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: row.relatedTicketNos[0] || '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `特殊工艺未回仓菲票 ${formatCount(specialSummary?.waitReturnCount || 0)} 张。`,
        impactText: '未回仓部位暂不参与车缝任务分配，但不影响其他已裁出部位交出。',
        suggestedAction: '去特殊工艺回仓页',
        actionRoute: buildCheckRoute(row, 'specialProcesses'),
        handlingStatus: '待处理',
        ownerRole: '特殊工艺跟单',
        ownerName: '特殊工艺跟单员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: primaryCutOrder,
      })
    }
    if ((specialSummary?.differenceCount || 0) > 0 || (specialSummary?.objectionCount || 0) > 0) {
      pushItem(row, {
        checkItemId: `check-special-return-diff-${row.productionOrderId}`,
        checkType: '特殊工艺回仓差异',
        checkLevel: '紧急',
        sourceObjectType: '特殊工艺',
        sourceObjectId: row.productionOrderId,
        sourceObjectNo: row.relatedProcessOrderNos[0] || row.productionOrderNo,
        spreadingOrderId: '',
        spreadingOrderNo: '',
        feiTicketId: '',
        feiTicketNo: row.relatedTicketNos[0] || '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `特殊工艺回仓差异 ${formatCount((specialSummary?.differenceCount || 0) + (specialSummary?.objectionCount || 0))} 项。`,
        impactText: '需要核对回仓记录、承接工厂回写和裁床待交出仓库存。',
        suggestedAction: '去特殊工艺回仓差异',
        actionRoute: buildCheckRoute(row, 'specialProcesses'),
        handlingStatus: '待处理',
        ownerRole: '特殊工艺跟单',
        ownerName: '特殊工艺跟单员',
        occurredAt: '',
        updatedAt: '',
        cutOrder: primaryCutOrder,
      })
    }

    const sampleAnomalies = sources.sampleWarehouseView.items.filter(
      (item) =>
        item.abnormalFlag &&
        (item.relatedProductionOrderNo === row.productionOrderNo || item.styleCode === row.styleCode),
    )
    sampleAnomalies.slice(0, 2).forEach((sample) => {
      const abnormal = sample.abnormalItems[0]
      const sampleCutOrder = sources.cutOrderRows.find((item) => item.cutOrderId === sample.relatedCutOrderId) || primaryCutOrder
      pushItem(row, {
        checkItemId: `check-sample-${sample.sampleItemId}-${abnormal?.abnormalId || 'abnormal'}`,
        checkType: '样衣异常',
        checkLevel: abnormal?.abnormalType === '样衣未归还' ? '需处理' : '紧急',
        sourceObjectType: '裁床样衣仓',
        sourceObjectId: sample.sampleItemId,
        sourceObjectNo: sample.sampleNo,
        spreadingOrderId: sample.relatedSpreadingOrderIds[0] || '',
        spreadingOrderNo: sample.relatedSpreadingOrderNos[0] || '',
        feiTicketId: '',
        feiTicketNo: '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `${sample.sampleNo} ${abnormal?.abnormalType || '样衣异常'}。`,
        impactText: abnormal?.description || '样衣异常会影响裁前版型、部位、尺寸和拼接关系核对，但不改变裁片单主状态。',
        suggestedAction: '去裁床样衣仓处理',
        actionRoute: buildDirectCheckRoute(getCanonicalCuttingPath('sample-warehouse'), row, {
          sampleNo: sample.sampleNo,
          cutOrderId: sample.relatedCutOrderId,
          status: sample.status.key,
          tab: 'exception',
        }),
        handlingStatus: abnormal?.handlingStatus || '待处理',
        ownerRole: '样衣仓',
        ownerName: abnormal?.reportedBy || sample.currentHolder || '样衣管理员',
        occurredAt: abnormal?.reportedAt || sample.lastMovedAt,
        updatedAt: abnormal?.handledAt || abnormal?.reportedAt || sample.lastMovedAt,
        cutOrder: sampleCutOrder,
      })
    })

    const bindingAbnormalOrders = buildBindingProcessOrders().filter(
      (order) =>
        order.sourceProductionOrderNo === row.productionOrderNo ||
        row.relatedCutOrderIds.includes(order.sourceCutOrderId) ||
        row.relatedCutOrderNos.includes(order.sourceCutOrderNo),
    )
    bindingAbnormalOrders
      .filter((order) => order.abnormalItems.length > 0)
      .slice(0, 2)
      .forEach((bindingOrder) => {
        const abnormal = bindingOrder.abnormalItems[0]
        const bindingCutOrder =
          sources.cutOrderRows.find((item) => item.cutOrderId === bindingOrder.sourceCutOrderId) ||
          sources.cutOrderRows.find((item) => item.cutOrderNo === bindingOrder.sourceCutOrderNo) ||
          primaryCutOrder
        pushItem(row, {
          checkItemId: `check-binding-${bindingOrder.bindingOrderId}-${abnormal?.abnormalId || 'abnormal'}`,
          checkType: '捆条异常',
          checkLevel: abnormal?.abnormalLevel || '需处理',
          sourceObjectType: '捆条加工单',
          sourceObjectId: bindingOrder.bindingOrderId,
          sourceObjectNo: bindingOrder.bindingOrderNo,
          spreadingOrderId: bindingOrder.sourceSpreadingOrderId,
          spreadingOrderNo: bindingOrder.sourceSpreadingOrderNo,
          feiTicketId: bindingOrder.sourceFeiTicketIds[0] || '',
          feiTicketNo: bindingOrder.sourceFeiTicketNos[0] || '',
          handoverOrderId: '',
          handoverRecordId: '',
          problemText: `${bindingOrder.bindingOrderNo} ${abnormal?.abnormalType || '捆条异常'}。`,
          impactText:
            abnormal?.description ||
            '捆条加工异常需要回到补料管理或裁剪结果核查处理，但不改变裁片单主状态。',
          suggestedAction: '去捆条加工单处理',
          actionRoute: buildDirectCheckRoute('/fcs/craft/cutting/special-processes/' + encodeURIComponent(bindingOrder.bindingOrderId), row, {
            checkType: '捆条异常',
            cutOrderId: bindingOrder.sourceCutOrderId,
          }),
          handlingStatus: abnormal?.handlingStatus || '待处理',
          ownerRole: '裁床工艺',
          ownerName: abnormal?.reportedBy || bindingOrder.operatorName || '捆条加工负责人',
          occurredAt: abnormal?.reportedAt || bindingOrder.startedAt,
          updatedAt: abnormal?.reportedAt || bindingOrder.completedAt || bindingOrder.startedAt,
          cutOrder: bindingCutOrder,
        })
      })
  })

  buildBindingProcessOrders()
    .filter((order) => order.abnormalItems.length > 0)
    .forEach((bindingOrder) => {
      const existing = items.some((item) => item.sourceObjectType === '捆条加工单' && item.sourceObjectId === bindingOrder.bindingOrderId)
      if (existing) return
      const fallbackRow =
        rows.find((row) => row.productionOrderNo === bindingOrder.sourceProductionOrderNo) ||
        rows.find((row) => row.relatedCutOrderNos.includes(bindingOrder.sourceCutOrderNo)) ||
        rows[0]
      if (!fallbackRow) return
      const abnormal = bindingOrder.abnormalItems[0]
      const bindingCutOrder =
        sources.cutOrderRows.find((item) => item.cutOrderId === bindingOrder.sourceCutOrderId) ||
        sources.cutOrderRows.find((item) => item.cutOrderNo === bindingOrder.sourceCutOrderNo) ||
        findPrimaryCutOrder(fallbackRow, sources)
      pushItem(fallbackRow, {
        checkItemId: `check-binding-${bindingOrder.bindingOrderId}-${abnormal?.abnormalId || 'fallback'}`,
        checkType: '捆条异常',
        checkLevel: abnormal?.abnormalLevel || '需处理',
        sourceObjectType: '捆条加工单',
        sourceObjectId: bindingOrder.bindingOrderId,
        sourceObjectNo: bindingOrder.bindingOrderNo,
        spreadingOrderId: bindingOrder.sourceSpreadingOrderId,
        spreadingOrderNo: bindingOrder.sourceSpreadingOrderNo,
        feiTicketId: bindingOrder.sourceFeiTicketIds[0] || '',
        feiTicketNo: bindingOrder.sourceFeiTicketNos[0] || '',
        handoverOrderId: '',
        handoverRecordId: '',
        problemText: `${bindingOrder.bindingOrderNo} ${abnormal?.abnormalType || '捆条异常'}。`,
        impactText:
          abnormal?.description ||
          '捆条加工异常需要回到补料管理或裁剪结果核查处理，但不改变裁片单主状态。',
        suggestedAction: '去捆条加工单处理',
        actionRoute: buildDirectCheckRoute('/fcs/craft/cutting/special-processes/' + encodeURIComponent(bindingOrder.bindingOrderId), fallbackRow, {
          checkType: '捆条异常',
          cutOrderId: bindingOrder.sourceCutOrderId,
        }),
        handlingStatus: abnormal?.handlingStatus || '待处理',
        ownerRole: '裁床工艺',
        ownerName: abnormal?.reportedBy || bindingOrder.operatorName || '捆条加工负责人',
        occurredAt: abnormal?.reportedAt || bindingOrder.startedAt,
        updatedAt: abnormal?.reportedAt || bindingOrder.completedAt || bindingOrder.startedAt,
        cutOrder: bindingCutOrder,
      })
    })

  return items
}

function getFilteredCheckItems(items: CuttingResultCheckItem[]): CuttingResultCheckItem[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  const sourceKeyword = state.filters.sourceNoKeyword.trim().toLowerCase()
  const materialKeyword = state.filters.materialSku.trim().toLowerCase()
  const ownerKeyword = state.filters.ownerKeyword.trim().toLowerCase()

  return items
    .filter((item) => {
      const status = getCheckItemStatus(item)
      if (state.filters.checkStatus !== 'ALL' && status !== state.filters.checkStatus) return false
      if (state.filters.checkType !== 'ALL' && item.checkType !== state.filters.checkType) return false
      if (state.filters.checkLevel !== 'ALL' && item.checkLevel !== state.filters.checkLevel) return false
      if (ownerKeyword && !`${item.ownerRole} ${item.ownerName}`.toLowerCase().includes(ownerKeyword)) return false
      if (materialKeyword && !item.materialIdentity?.materialSku.toLowerCase().includes(materialKeyword)) return false
      if (sourceKeyword) {
        const sourceText = [item.sourceObjectNo, item.cutOrderNo, item.spreadingOrderNo, item.feiTicketNo, item.productionOrderNo].join(' ').toLowerCase()
        if (!sourceText.includes(sourceKeyword)) return false
      }
      if (keyword) {
        const text = [
          item.checkType,
          item.problemText,
          item.impactText,
          item.suggestedAction,
          item.productionOrderNo,
          item.cutOrderNo,
          item.spreadingOrderNo,
          item.feiTicketNo,
          item.ownerRole,
          item.ownerName,
          item.materialIdentity?.materialSku,
          item.materialIdentity?.materialAlias,
          item.patternIdentity?.patternFileName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!text.includes(keyword)) return false
      }
      return true
    })
    .sort((left, right) => {
      const statusWeight: Record<CuttingResultCheckStatus, number> = { 待处理: 0, 处理中: 1, 已处理: 2, 已关闭: 3 }
      const levelWeight: Record<CuttingResultCheckLevel, number> = { 紧急: 0, 需处理: 1, 提示: 2 }
      const statusDiff = statusWeight[getCheckItemStatus(left)] - statusWeight[getCheckItemStatus(right)]
      if (statusDiff !== 0) return statusDiff
      const levelDiff = levelWeight[left.checkLevel] - levelWeight[right.checkLevel]
      if (levelDiff !== 0) return levelDiff
      return left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    })
}

function renderCheckBadge(label: string, className: string): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderPatternIdentitySummary(item: CuttingResultCheckItem): string {
  if (!item.patternIdentity) return '<span class="text-xs text-muted-foreground">纸样待补</span>'
  return `
    <div class="text-sm">
      <p class="font-medium text-foreground">${escapeHtml(item.patternIdentity.patternFileName || '纸样文件待补')}</p>
      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.patternIdentity.patternVersion, item.patternIdentity.effectiveWidthText].filter(Boolean).join(' / ') || '版本和幅宽待补')}</p>
      <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">${escapeHtml(item.patternIdentity.piecePartNames.slice(0, 4).join('、') || '部位集合待补')}</p>
    </div>
  `
}

function renderCheckOverviewCards(items: CuttingResultCheckItem[]): string {
  const pendingCount = items.filter((item) => ['待处理', '处理中'].includes(getCheckItemStatus(item))).length
  const urgentCount = items.filter((item) => item.checkLevel === '紧急' && getCheckItemStatus(item) !== '已处理').length
  const pendingReplenishmentCount = items.filter((item) => item.checkType === '补料待审核' && getCheckItemStatus(item) === '待处理').length
  const handoverShortageCount = items.filter((item) => item.checkType === '交出后缺口').length
  const specialCraftPendingCount = items.filter((item) => item.checkType === '特殊工艺未回仓').length
  const closedCutOrderCount = items.filter((item) => item.checkType === '裁片单已关闭').length

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('待处理数量', pendingCount, '默认聚焦当前要处理的问题', 'text-amber-600')}
      ${renderCompactKpiCard('紧急数量', urgentCount, '优先核查接收差异和回仓差异', 'text-rose-600')}
      ${renderCompactKpiCard('待审核补料数量', pendingReplenishmentCount, '来自实际差异', 'text-violet-600')}
      ${renderCompactKpiCard('交出后缺口数量', handoverShortageCount, '交出后的结果提示', 'text-orange-600')}
      ${renderCompactKpiCard('特殊工艺未回仓数量', specialCraftPendingCount, '不阻断其他部位交出', 'text-fuchsia-600')}
      ${renderCompactKpiCard('已关闭裁片单数量', closedCutOrderCount, '展示关闭原因与影响项', 'text-slate-700')}
    </section>
  `
}

function renderResultCheckFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 xl:grid-cols-6">
      <label class="space-y-2 xl:col-span-2">
        <span class="text-sm font-medium text-foreground">关键词</span>
        <input
          value="${escapeHtml(state.filters.keyword)}"
          placeholder="生产单 / 裁片单 / 铺布单 / 菲票 / 问题说明"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-cutting-summary-field="keyword"
        />
      </label>
      ${renderFilterSelect('核查类型', 'checkType', state.filters.checkType, [
        { value: 'ALL', label: '全部类型' },
        ...checkTypeOptions.map((type) => ({ value: type, label: type })),
      ])}
      ${renderFilterSelect('处理状态', 'checkStatus', state.filters.checkStatus, [
        { value: 'ALL', label: '全部状态' },
        { value: '待处理', label: '待处理' },
        { value: '处理中', label: '处理中' },
        { value: '已处理', label: '已处理' },
        { value: '已关闭', label: '已关闭' },
      ])}
      ${renderFilterSelect('紧急程度', 'checkLevel', state.filters.checkLevel, [
        { value: 'ALL', label: '全部' },
        { value: '紧急', label: '紧急' },
        { value: '需处理', label: '需处理' },
        { value: '提示', label: '提示' },
      ])}
      ${renderFilterInput('负责人', 'ownerKeyword', state.filters.ownerKeyword, '负责人 / 角色')}
    </div>
    <div class="mt-3 grid gap-3 xl:grid-cols-6">
      ${renderFilterInput('来源对象', 'sourceNoKeyword', state.filters.sourceNoKeyword, '裁片单 / 铺布单 / 交出记录')}
      ${renderFilterInput('面料 SKU', 'materialSku', state.filters.materialSku, '输入面料 SKU')}
      ${renderFilterSelect('时间范围', 'timeRange', state.filters.timeRange, [
        { value: 'ALL', label: '全部时间' },
        { value: 'TODAY', label: '今天' },
        { value: 'THIS_WEEK', label: '本周' },
        { value: 'THIS_MONTH', label: '本月' },
      ])}
      <div class="flex items-end gap-2 xl:col-span-3">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="clear-filters">清除筛选条件</button>
      </div>
    </div>
  `)
}

function renderCheckItemCard(item: CuttingResultCheckItem): string {
  const status = getCheckItemStatus(item)
  return `
    <article class="rounded-lg border bg-background p-3">
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            ${renderCheckBadge(item.checkType, 'border-blue-200 bg-blue-50 text-blue-700')}
            ${renderCheckBadge(item.checkLevel, checkLevelMetaMap[item.checkLevel].className)}
          </div>
          <p class="mt-2 text-sm font-medium leading-5 text-foreground">${escapeHtml(item.problemText)}</p>
        </div>
        <div class="min-w-0 text-sm">
          <p class="font-medium text-foreground">${escapeHtml(item.productionOrderNo)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cutOrderNo || '未关联裁片单')}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.spreadingOrderNo, item.feiTicketNo, item.sourceObjectNo].filter(Boolean).slice(0, 2).join(' / ') || item.sourceObjectType)}</p>
        </div>
        <div class="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div>
            ${
              item.materialIdentity
                ? renderMaterialIdentityBlock(
                    {
                      materialSku: item.materialIdentity.materialSku,
                      materialLabel: item.materialIdentity.materialName,
                      materialAlias: item.materialIdentity.materialAlias,
                      materialImageUrl: item.materialIdentity.materialImageUrl,
                    },
                    { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                  )
                : '<span class="text-xs text-muted-foreground">面料待补</span>'
            }
          </div>
          ${renderPatternIdentitySummary(item)}
        </div>
        <div class="min-w-0 text-xs leading-5 text-muted-foreground">
          ${escapeHtml(item.impactText)}
        </div>
        <div class="min-w-0">
          ${renderCheckBadge(status, checkStatusMetaMap[status].className)}
          <p class="mt-2 text-xs text-blue-700">${escapeHtml(item.suggestedAction)}</p>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.ownerRole, item.ownerName].filter(Boolean).join(' / ') || '负责人待定')}</p>
        </div>
        <div class="flex shrink-0 flex-col gap-2">
          <a
            href="${escapeHtml(item.actionRoute)}"
            class="rounded-md border px-3 py-2 text-center text-xs hover:bg-muted"
            data-nav="${escapeHtml(item.actionRoute)}"
          >查看来源</a>
          <a
            href="${escapeHtml(item.actionRoute)}"
            class="rounded-md border px-3 py-2 text-center text-xs hover:bg-muted"
            data-nav="${escapeHtml(item.actionRoute)}"
          >去处理</a>
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            data-cutting-summary-action="mark-check-handled"
            data-check-item-id="${escapeHtml(item.checkItemId)}"
          >标记已处理</button>
        </div>
      </div>
    </article>
  `
}

function renderGroupedCheckItems(items: CuttingResultCheckItem[]): string {
  return `
    <section class="space-y-4">
      ${cuttingResultCheckGroupDefinitions
        .map((group) => {
          const groupItems = items.filter((item) => group.checkTypes.includes(item.checkType))
          return `
            <section class="space-y-3 rounded-lg border bg-card p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-base font-semibold text-foreground">${escapeHtml(group.title)}</h2>
                <span class="text-xs text-muted-foreground">${formatCount(groupItems.length)} 项</span>
              </div>
              ${
                groupItems.length
                  ? `<div class="space-y-3">${groupItems.map(renderCheckItemCard).join('')}</div>`
                  : '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前筛选范围内暂无该类待处理事项。</div>'
              }
            </section>
          `
        })
        .join('')}
    </section>
  `
}

function renderSpecialCraftReturnOverview(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): string {
  const summaries = rows
    .map((row) => aggregates.specialReturnByProductionId.get(row.productionOrderId))
    .filter((item): item is SpecialCraftReturnStatusSummary => Boolean(item && item.totalNeedSpecialCraftFeiTickets > 0))

  if (summaries.length === 0) return ''

  const aggregated = summaries.reduce(
    (result, item) => {
      result.totalNeed += item.totalNeedSpecialCraftFeiTickets
      result.waitDispatch += item.waitDispatchCount
      result.dispatched += item.dispatchedCount
      result.received += item.receivedBySpecialFactoryCount
      result.waitReturn += item.waitReturnCount
      result.returned += item.returnedCount
      result.difference += item.differenceCount
      result.objection += item.objectionCount
      return result
    },
    {
      totalNeed: 0,
      waitDispatch: 0,
      dispatched: 0,
      received: 0,
      waitReturn: 0,
      returned: 0,
      difference: 0,
      objection: 0,
    },
  )
  const allReturned = summaries.every((item) => item.allReturned)

  return `
    <section class="rounded-lg border bg-card px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-foreground">特殊工艺回仓汇总</p>
          <p class="mt-1 text-xs text-muted-foreground">给后续裁床交出提供状态基础，不在本页新增交出记录。</p>
        </div>
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${allReturned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">是否全部回仓：${allReturned ? '是' : '否'}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('需要特殊工艺菲票数量', aggregated.totalNeed, '需执行特殊工艺', 'text-slate-900')}
        ${renderCompactKpiCard('待交出菲票数量', aggregated.waitDispatch, '裁床厂待交出', 'text-amber-600')}
        ${renderCompactKpiCard('已交出菲票数量', aggregated.dispatched, '已创建交出记录', 'text-blue-600')}
        ${renderCompactKpiCard('已接收菲票数量', aggregated.received, '特殊工艺厂已接收', 'text-cyan-600')}
        ${renderCompactKpiCard('待回仓菲票数量', aggregated.waitReturn, '特殊工艺厂待回仓', 'text-amber-600')}
        ${renderCompactKpiCard('已回仓菲票数量', aggregated.returned, '已回裁床厂待交出仓', 'text-emerald-600')}
        ${renderCompactKpiCard('差异菲票数量', aggregated.difference, '交出或回仓差异', 'text-rose-600')}
        ${renderCompactKpiCard('异议中菲票数量', aggregated.objection, '数量异议处理中', 'text-rose-600')}
      </div>
    </section>
  `
}

function renderSewingDispatchOverview(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): string {
  const summaries = rows
    .map((row) => aggregates.sewingDispatchByProductionId.get(row.productionOrderId))
    .filter((item): item is SewingDispatchProgressSummary => Boolean(item))
  const total = summaries.reduce(
    (result, item) => {
      result.totalProductionQty += item.totalProductionQty
      result.cumulativeDispatchedGarmentQty += item.cumulativeDispatchedGarmentQty
      result.remainingGarmentQty += item.remainingGarmentQty
      result.dispatchBatchCount += item.dispatchBatchCount
      result.transferBagCount += item.transferBagCount
      result.writtenBackTransferBagCount += item.writtenBackTransferBagCount
      result.differenceTransferBagCount += item.differenceTransferBagCount
      result.objectionTransferBagCount += item.objectionTransferBagCount
      item.blockingReasons.forEach((reason) => result.blockingReasons.add(reason))
      return result
    },
    {
      totalProductionQty: 0,
      cumulativeDispatchedGarmentQty: 0,
      remainingGarmentQty: 0,
      dispatchBatchCount: 0,
      transferBagCount: 0,
      writtenBackTransferBagCount: 0,
      differenceTransferBagCount: 0,
      objectionTransferBagCount: 0,
      blockingReasons: new Set<string>(),
    },
  )
  const reasons = Array.from(total.blockingReasons)

  return `
    <section class="rounded-lg border bg-card px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-foreground">交出单汇总</p>
          <p class="mt-1 text-xs text-muted-foreground">裁床厂按交出单和交出记录追踪中转袋、缺口核对与回写。</p>
        </div>
        <span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${reasons.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">交出缺口提示：${reasons.length ? '有' : '无'}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderCompactKpiCard('生产总数', total.totalProductionQty, '', 'text-slate-900')}
        ${renderCompactKpiCard('累计已交出件数', total.cumulativeDispatchedGarmentQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余未交出件数', total.remainingGarmentQty, '', 'text-amber-600')}
        ${renderCompactKpiCard('交出记录数', total.dispatchBatchCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('中转袋数', total.transferBagCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('已回写袋数', total.writtenBackTransferBagCount, '', 'text-emerald-600')}
        ${renderCompactKpiCard('差异袋数', total.differenceTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('异议中袋数', total.objectionTransferBagCount, '', 'text-rose-600')}
        ${renderCompactKpiCard('缺口结果', reasons.length ? reasons.join('、') : '无', '裁片缺口 / 特殊工艺未回仓 / 存在差异 / 存在异议 / 菲票被占用 / 数量超过剩余未交', 'text-amber-600')}
      </div>
    </section>
  `
}

function renderProgressStatisticsSummary(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): string {
  const snapshots = aggregates.cuttingProgressSnapshots
  if (!snapshots.length) return ''
  const sewingSummaries = rows
    .map((row) => aggregates.sewingDispatchByProductionId.get(row.productionOrderId))
    .filter((item): item is SewingDispatchProgressSummary => Boolean(item))

  const totalProductionQty = snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.plannedQty, 0)
  const cuttingCompletedQty = snapshots.reduce((sum, item) => sum + item.cuttingProgress.completedQty, 0)
  const feiTicketQty = snapshots.reduce((sum, item) => sum + item.feiTicketProgress.completedQty, 0)
  const warehouseQty = snapshots.reduce((sum, item) => sum + item.cutPieceWarehouseProgress.completedQty, 0)
  const needSpecialCraft = snapshots.reduce((sum, item) => sum + item.specialCraftReturnProgress.plannedQty, 0)
  const returnedSpecialCraft = snapshots.reduce((sum, item) => sum + item.specialCraftReturnProgress.completedQty, 0)
  const transferBagCount = sewingSummaries.reduce((sum, item) => sum + item.transferBagCount, 0)
  const completedTransferBagCount = sewingSummaries.reduce((sum, item) => sum + item.writtenBackTransferBagCount + item.dispatchedTransferBagCount, 0)
  const shippedQty = snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.completedQty, 0)
  const remainingQty = Math.max(totalProductionQty - shippedQty, 0)
  const differenceCount = snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.differenceQty + item.specialCraftReturnProgress.differenceQty, 0)
  const objectionCount = snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.abnormalCount + item.specialCraftReturnProgress.abnormalCount, 0)
  const blockingReasons = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.blockingReasons.map((reason) => reason.blockingLabel))))

  return `
    <section class="rounded-lg border bg-card px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-foreground">裁剪结果核查进度联动</p>
          <p class="mt-1 text-xs text-muted-foreground">汇总生产数量、裁剪完成、菲票、裁床厂待交出仓、特殊工艺回仓、中转袋和交出进度。</p>
        </div>
        <span class="inline-flex rounded-full border px-3 py-1 text-xs ${blockingReasons.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}">风险与差异：${escapeHtml(blockingReasons[0] || '无')}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('生产数量', totalProductionQty, '', 'text-slate-900')}
        ${renderCompactKpiCard('裁剪完成裁片数量', cuttingCompletedQty, '', 'text-violet-600')}
        ${renderCompactKpiCard('菲票数量', feiTicketQty, '', 'text-cyan-600')}
        ${renderCompactKpiCard('裁片入裁床厂待交出仓数量', warehouseQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('需要特殊工艺菲票数量', needSpecialCraft, '', 'text-slate-900')}
        ${renderCompactKpiCard('已回仓菲票数量', returnedSpecialCraft, '', 'text-emerald-600')}
        ${renderCompactKpiCard('未回仓菲票数量', Math.max(needSpecialCraft - returnedSpecialCraft, 0), '', 'text-amber-600')}
        ${renderCompactKpiCard('中转袋数', transferBagCount, '', 'text-slate-700')}
        ${renderCompactKpiCard('已核对中转袋数', completedTransferBagCount, '', 'text-emerald-600')}
        ${renderCompactKpiCard('已交出件数', shippedQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余未交出件数', remainingQty, '', 'text-amber-600')}
        ${renderCompactKpiCard('差异裁片数量', differenceCount, `异议数量 ${objectionCount}`, 'text-rose-600')}
      </div>
    </section>
  `
}

function renderPrefilterBar(): string {
  if (!state.drillContext) return ''
  const chips = buildCuttingDrillChipLabels(state.drillContext)

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext),
    chips: chips.map((label) => renderWorkbenchFilterChip(label, '', 'blue')),
    clearAttrs: 'data-cutting-summary-action="clear-prefilter"',
  })
}

function renderFilterSelect(
  label: string,
  field: SummaryFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-summary-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderFilterInput(label: string, field: SummaryFilterField, value: string, placeholder: string): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-summary-field="${field}"
      />
    </label>
  `
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="grid gap-3 xl:grid-cols-6">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">跨对象搜索</span>
          <input
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="生产单 / 裁片单 / 批次 / 菲票 / 中转袋 / 补料 / 工艺单"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-summary-field="keyword"
          />
        </label>
        ${renderFilterSelect('闭环状态', 'completionState', state.filters.completionState, [
          { value: 'ALL', label: '全部' },
          { value: 'HAS_EXCEPTION', label: '有异常' },
          { value: 'IN_PROGRESS', label: '处理中' },
          { value: 'COMPLETED', label: '已闭环' },
          { value: 'DATA_PENDING', label: '待补数据' },
        ])}
        ${renderFilterSelect('风险链路', 'blockerSection', state.filters.blockerSection, [
          { value: 'ALL', label: '全部链路' },
          ...Object.entries(cuttingCheckSectionLabelMap).map(([value, label]) => ({ value, label })),
        ])}
        ${renderFilterSelect('来源对象类型', 'sourceObjectType', state.filters.sourceObjectType, [
          { value: 'ALL', label: '全部对象' },
          ...Object.entries(sourceObjectTypeLabelMap).map(([value, label]) => ({ value, label })),
        ])}
        ${renderFilterSelect('裁床主状态', 'currentStage', state.filters.currentStage, [
          { value: 'ALL', label: '全部' },
          { value: 'NOT_STARTED', label: '未开工' },
          { value: 'STARTED', label: '已开工' },
        ])}
      </div>
      <div class="grid gap-3 xl:grid-cols-6">
        ${renderFilterInput('面料 SKU', 'materialSku', state.filters.materialSku, '输入面料 SKU 精确定位风险来源')}
        ${renderFilterInput('来源对象号', 'sourceNoKeyword', state.filters.sourceNoKeyword, '裁片单 / 批次 / 补料 / 工艺单 / 使用周期')}
        ${renderFilterSelect('风险等级', 'riskLevel', state.filters.riskLevel, [
          { value: 'ALL', label: '全部风险' },
          { value: 'HIGH', label: '高风险' },
          { value: 'MEDIUM', label: '中风险' },
          { value: 'LOW', label: '低风险' },
        ])}
        ${renderFilterSelect('问题分类', 'issueType', state.filters.issueType, [
          { value: 'ALL', label: '全部问题' },
          ...Object.values(cuttingSummaryIssueMetaMap).map((meta) => ({ value: meta.key, label: meta.label })),
        ])}
        <div class="flex flex-wrap items-end gap-2 xl:col-span-2">
          ${renderWorkbenchFilterChip(
            state.filters.pendingReplenishmentOnly ? '已选：只看待补料' : '只看待补料',
            'data-cutting-summary-action="toggle-replenishment"',
            'amber',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.pendingTicketsOnly ? '已选：只看待打印菲票' : '只看待打印菲票',
            'data-cutting-summary-action="toggle-tickets"',
            'blue',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.pendingBagOnly ? '已选：只看待交接 / 待回仓' : '只看待交接 / 待回仓',
            'data-cutting-summary-action="toggle-bags"',
            'rose',
          )}
          ${renderWorkbenchFilterChip(
            state.filters.specialProcessOnly ? '已选：只看特殊工艺' : '只看特殊工艺',
            'data-cutting-summary-action="toggle-special"',
            'emerald',
          )}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="clear-filters">清除筛选条件</button>
        </div>
      </div>
    </div>
  `)
}

function renderIssueBoard(issues: CuttingSummaryIssue[]): string {
  if (!issues.length) {
    return `
      <section class="rounded-lg border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground">
        当前筛选范围内暂无风险项分类。
      </section>
    `
  }

  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">风险项分类</h2>
        </div>
        <p class="text-xs text-muted-foreground">当前共 ${formatCount(issues.length)} 类风险</p>
      </div>
      <div class="grid gap-3 xl:grid-cols-5">
        ${issues
          .map((issue) => {
            const issueMeta = cuttingSummaryIssueMetaMap[issue.issueType]
            const riskMeta = cuttingSummaryRiskMetaMap[issue.highestRiskLevel]
            const activeClass = state.activeIssueId === issue.issueId ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-300'
            return `
              <button
                type="button"
                class="rounded-lg border p-3 text-left transition ${activeClass}"
                data-cutting-summary-action="focus-issue"
                data-issue-id="${issue.issueId}"
                data-row-id="${issue.relatedRowIds[0] || ''}"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${issueMeta.className}">${escapeHtml(issueMeta.label)}</span>
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${riskMeta.className}">${escapeHtml(riskMeta.label)}</span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div class="rounded-md bg-muted/30 px-2 py-2">
                    <p class="text-[11px] text-muted-foreground">涉及生产单</p>
                    <p class="mt-1 font-semibold text-foreground">${formatCount(issue.blockingProductionOrderCount)}</p>
                  </div>
                  <div class="rounded-md bg-muted/30 px-2 py-2">
                    <p class="text-[11px] text-muted-foreground">风险对象</p>
                    <p class="mt-1 font-semibold text-foreground">${formatCount(issue.blockingObjectCount)}</p>
                  </div>
                </div>
                <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(issue.summary)}</p>
                <p class="mt-2 text-xs font-medium text-blue-700">建议关注：${escapeHtml(issue.primaryActionLabel)}</p>
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderCheckStateBar(rows: CuttingSummaryRow[]): string {
  const blockerCount = rows.reduce((sum, row) => sum + row.blockingCount, 0)
  const pendingActionCount = rows.reduce((sum, row) => sum + row.pendingActionCount, 0)
  const blockedCount = rows.filter((row) => row.completionState === 'HAS_EXCEPTION').length
  const dataPendingCount = rows.filter((row) => row.completionState === 'DATA_PENDING').length

  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      当前筛选命中 ${formatCount(rows.length)} 个生产单，风险对象 ${formatCount(blockerCount)} 个，核查提示 ${formatCount(pendingActionCount)} 个。
      ${blockedCount ? `有风险 ${formatCount(blockedCount)} 个。` : ''} ${dataPendingCount ? `待补数据 ${formatCount(dataPendingCount)} 个。` : ''}
    </section>
  `
}

function renderResultMainTable(rows: CuttingSummaryRow[], aggregates: CuttingSummaryRenderAggregates): string {
  return `
    <section class="space-y-3 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">裁剪结果核查明细</h2>
        </div>
        <p class="text-xs text-muted-foreground">当前共 ${formatCount(rows.length)} 个生产单</p>
      </div>
      ${renderStickyTableScroller(
        rows.length
          ? `
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-card">
                <tr class="border-b text-left text-xs text-muted-foreground">
                  <th class="px-3 py-2">生产单号</th>
                  <th class="px-3 py-2">款号 / SPU</th>
                  <th class="px-3 py-2">实际裁剪</th>
                  <th class="px-3 py-2">面料消耗</th>
                  <th class="px-3 py-2">菲票 / 待交出仓</th>
                  <th class="px-3 py-2">交出单 / 记录</th>
                  <th class="px-3 py-2">已交出</th>
                  <th class="px-3 py-2">剩余缺口</th>
                  <th class="px-3 py-2 text-right">查看</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((row) => {
                    const result = aggregates.resultLineByProductionId.get(row.productionOrderId)
                    const activeClass = state.activeRowId === row.rowId ? 'bg-blue-50/70' : ''
                    return `
                      <tr class="border-b align-top ${activeClass}">
                        <td class="px-3 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-cutting-summary-action="focus-row" data-row-id="${row.rowId}">
                            ${escapeHtml(row.productionOrderNo)}
                          </button>
                          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName)}</p>
                        </td>
                        <td class="px-3 py-3 text-xs text-muted-foreground">
                          <div>${escapeHtml(row.styleCode)}</div>
                          <div class="mt-1">${escapeHtml(row.spuCode)}</div>
                        </td>
                        <td class="px-3 py-3 font-medium text-foreground">${formatCount(result?.actualCutPieceQty || 0)} 片</td>
                        <td class="px-3 py-3">${formatMeter(result?.materialConsumedMeter || 0)}</td>
                        <td class="px-3 py-3">
                          <div class="font-medium text-foreground">${formatCount(result?.feiTicketCount || 0)} 张菲票</div>
                          <div class="mt-1 text-xs text-muted-foreground">待交出仓 ${formatCount(result?.waitHandoverStockPieceQty || 0)} 片</div>
                        </td>
                        <td class="px-3 py-3">
                          <div class="font-medium text-foreground">${formatCount(result?.handoverOrderCount || 0)} 单 / ${formatCount(result?.handoverRecordCount || 0)} 条</div>
                          <div class="mt-1 text-xs text-muted-foreground">差异 ${formatCount(result?.differenceQty || 0)}</div>
                        </td>
                        <td class="px-3 py-3">${formatCount(result?.handedOverPieceQty || 0)} 片</td>
                        <td class="px-3 py-3">
                          <span class="font-medium ${(result?.remainingGapPieceQty || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}">${formatCount(result?.remainingGapPieceQty || 0)} 片</span>
                        </td>
                        <td class="px-3 py-3 text-right">
                          <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="focus-row" data-row-id="${row.rowId}">查看结果</button>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : `
            <div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              当前筛选条件下没有命中的裁剪结果。
            </div>
          `,
      )}
    </section>
  `
}

function renderResultConclusion(detail: CuttingSummaryDetailPanelData, aggregates: CuttingSummaryRenderAggregates): string {
  const result = aggregates.resultLineByProductionId.get(detail.row.productionOrderId)
  if (!result) return ''

  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">裁剪结果汇总</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(detail.row.productionOrderNo)}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard('实际裁剪裁片', result.actualCutPieceQty, '', 'text-violet-600')}
        ${renderCompactKpiCard('面料实际消耗', formatMeter(result.materialConsumedMeter), '', 'text-blue-600')}
        ${renderCompactKpiCard('菲票数量', result.feiTicketCount, '', 'text-cyan-600')}
        ${renderCompactKpiCard('待交出仓库存', result.waitHandoverStockPieceQty, '', 'text-emerald-600')}
        ${renderCompactKpiCard('交出单 / 交出记录', `${formatCount(result.handoverOrderCount)} / ${formatCount(result.handoverRecordCount)}`, '', 'text-slate-700')}
        ${renderCompactKpiCard('已交出裁片', result.handedOverPieceQty, '', 'text-blue-600')}
        ${renderCompactKpiCard('剩余缺口', result.remainingGapPieceQty, '', result.remainingGapPieceQty ? 'text-amber-600' : 'text-emerald-600')}
        ${renderCompactKpiCard('差异数量', result.differenceQty, '', result.differenceQty ? 'text-rose-600' : 'text-slate-700')}
      </div>
    </article>
  `
}

function renderPartResultSection(detail: CuttingSummaryDetailPanelData, aggregates: CuttingSummaryRenderAggregates): string {
  const rows = aggregates.partResultLinesByProductionId.get(detail.row.productionOrderId) || []

  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">SKU / 部位结果明细</h3>
        <span class="text-xs text-muted-foreground">${rows.length ? `共 ${formatCount(rows.length)} 行` : '暂无明细'}</span>
      </div>
      ${
        rows.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">裁片单</th>
                      <th class="px-3 py-2">面料</th>
                      <th class="px-3 py-2">SKU / 部位</th>
                      <th class="px-3 py-2">理论片数</th>
                      <th class="px-3 py-2">实际裁剪</th>
                      <th class="px-3 py-2">待交出仓库存</th>
                      <th class="px-3 py-2">已交出</th>
                      <th class="px-3 py-2">仍缺</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map((row) => `
                        <tr class="border-b align-top">
                          <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(row.cutOrderNo || '未关联裁片单')}</td>
                          <td class="px-3 py-3">
                            ${row.materialSku
                              ? renderMaterialIdentityBlock(
                                  {
                                    materialSku: row.materialSku,
                                    materialLabel: row.materialSku,
                                    materialAlias: findSummaryMaterialIdentity(detail, row.materialSku, row.cutOrderNo)?.materialAlias || '',
                                    materialImageUrl: findSummaryMaterialIdentity(detail, row.materialSku, row.cutOrderNo)?.materialImageUrl || '',
                                  },
                                  { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                                )
                              : '<span class="text-xs text-muted-foreground">—</span>'}
                          </td>
                          <td class="px-3 py-3">
                            <div class="font-medium text-foreground">${escapeHtml([row.color, row.size].filter(Boolean).join(' / ') || '未命名 SKU')}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.partName)}</div>
                          </td>
                          <td class="px-3 py-3">${formatCount(row.requiredPieceQty)} 片</td>
                          <td class="px-3 py-3">${formatCount(row.actualCutQty)} 片</td>
                          <td class="px-3 py-3">${formatCount(row.waitHandoverStockQty)} 片</td>
                          <td class="px-3 py-3">${formatCount(row.handedOverPieceQty)} 片</td>
                          <td class="px-3 py-3">
                            <span class="font-medium ${row.remainingGapQty ? 'text-amber-700' : 'text-emerald-700'}">${formatCount(row.remainingGapQty)} 片</span>
                          </td>
                        </tr>
                      `)
                      .join('')}
                  </tbody>
                </table>
              `,
              'max-h-[28rem]',
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前生产单尚未形成 SKU / 部位结果明细。</p>'
      }
    </article>
  `
}

function renderCheckConclusion(detail: CuttingSummaryDetailPanelData): string {
  const whyBlocked =
    detail.primaryBlocker?.blockerReason || detail.completionMeta.detailText || detail.row.primaryBlockerReason || '当前暂无风险说明。'

  return `
    <article class="rounded-lg border p-3">
      <h3 class="text-sm font-semibold text-foreground">核查结论</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前闭环状态</p>
          <span class="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${detail.completionMeta.className}">${escapeHtml(detail.completionMeta.label)}</span>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前最主要卡点</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${escapeHtml(detail.row.primaryBlockerSectionLabel || detail.row.currentStageLabel || '当前无明确风险')}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">未完成 SKU 数</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${formatCount(detail.row.incompleteSkuCount)}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">未完成部位数</p>
          <p class="mt-2 text-sm font-semibold text-foreground">${formatCount(detail.row.incompletePartCount)}</p>
        </div>
        <div class="rounded-lg bg-muted/30 px-3 py-3">
          <p class="text-xs text-muted-foreground">当前关注点</p>
          <p class="mt-2 text-sm font-semibold text-blue-700">${escapeHtml(detail.row.mainNextActionLabel)}</p>
        </div>
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        ${escapeHtml(whyBlocked)}
      </div>
    </article>
  `
}

function renderPieceTruthSkuSection(detail: CuttingSummaryDetailPanelData): string {
  const rows = detail.pieceTruth.skuRows
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">SKU 情况</h3>
        <span class="text-xs text-muted-foreground">共 ${formatCount(rows.length)} 个 SKU</span>
      </div>
      ${
        rows.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">SKU</th>
                      <th class="px-3 py-2">颜色</th>
                      <th class="px-3 py-2">尺码</th>
                      <th class="px-3 py-2">理论成衣件数（件）</th>
                      <th class="px-3 py-2">已裁片片数（片）</th>
                      <th class="px-3 py-2">已入仓裁片片数（片）</th>
                      <th class="px-3 py-2">当前状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (row) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(row.skuCode || `${row.color}/${row.size}`)}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.color || '-')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.size || '-')}</td>
                            <td class="px-3 py-3">${formatCount(row.requiredGarmentQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.actualCutQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.inboundQty)}</td>
                            <td class="px-3 py-3">
                              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.mappingStatus === 'MATCHED' ? row.gapCutQty > 0 ? 'bg-rose-100 text-rose-700' : row.gapInboundQty > 0 ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(row.currentStateLabel)}</span>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前尚未形成 SKU 情况。</p>'
      }
    </article>
  `
}

function renderPieceTruthGapSection(detail: CuttingSummaryDetailPanelData): string {
  const rows = detail.pieceTruth.gapRows.filter(
    (row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0,
  )
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">部位差异区</h3>
        <span class="text-xs text-muted-foreground">${rows.length ? `未完成部位 ${formatCount(rows.length)} 个` : '当前无差异部位'}</span>
      </div>
      ${
        rows.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">裁片单</th>
                      <th class="px-3 py-2">面料</th>
                      <th class="px-3 py-2">SKU</th>
                      <th class="px-3 py-2">部位</th>
                      <th class="px-3 py-2">理论裁片片数（片）</th>
                      <th class="px-3 py-2">已裁片片数（片）</th>
                      <th class="px-3 py-2">已入仓裁片片数（片）</th>
                      <th class="px-3 py-2">差异裁片片数（片）</th>
                      <th class="px-3 py-2">当前状态</th>
                      <th class="px-3 py-2">建议关注</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (row) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3 font-medium text-foreground">${escapeHtml(row.cutOrderNo || '裁片单待补')}</td>
                            <td class="px-3 py-3">
                              ${renderMaterialIdentityBlock(
                                {
                                  materialSku: row.materialSku,
                                  materialLabel: '部位差异面料',
                                  materialAlias: findSummaryMaterialIdentity(detail, row.materialSku, row.cutOrderNo)?.materialAlias || '',
                                  materialImageUrl: findSummaryMaterialIdentity(detail, row.materialSku, row.cutOrderNo)?.materialImageUrl || '',
                                },
                                { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                              )}
                            </td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.skuCode || `${row.color}/${row.size}`)}</td>
                            <td class="px-3 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(row.partName)}</div>
                              ${row.patternName ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.patternName)}</div>` : ''}
                            </td>
                            <td class="px-3 py-3">${formatCount(row.requiredPieceQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.actualCutQty)}</td>
                            <td class="px-3 py-3">${formatCount(row.inboundQty)}</td>
                            <td class="px-3 py-3">
                              <span class="font-medium ${row.gapCutQty > 0 ? 'text-rose-700' : 'text-amber-700'}">${formatCount(row.gapCutQty > 0 ? row.gapCutQty : row.gapInboundQty)}</span>
                            </td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.currentStateLabel)}</td>
                            <td class="px-3 py-3 text-xs text-blue-700">${escapeHtml(row.nextActionLabel)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有未完成部位差异。</p>'
      }
    </article>
  `
}

function renderPieceTruthIssueSection(detail: CuttingSummaryDetailPanelData): string {
  const issues = [...detail.pieceTruth.mappingIssues, ...detail.pieceTruth.dataIssues]
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">映射与数据问题区</h3>
        <span class="text-xs text-muted-foreground">${issues.length ? `共 ${formatCount(issues.length)} 项` : '当前无问题'}</span>
      </div>
      ${
        issues.length
          ? `<div class="mt-3 space-y-2">
              ${issues
                .map(
                  (issue) => `
                    <div class="rounded-lg border ${issue.level === 'mapping' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} px-3 py-2">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-sm font-medium ${issue.level === 'mapping' ? 'text-amber-700' : 'text-slate-700'}">${escapeHtml(issue.level === 'mapping' ? '映射缺失' : '数据待补')}</p>
                          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(issue.message)}</p>
                        </div>
                        <div class="text-right text-[11px] text-muted-foreground">${escapeHtml(issue.cutOrderNo || issue.productionOrderNo)}</div>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            </div>`
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有映射缺失或数据待补项。</p>'
      }
    </article>
  `
}

function renderBlockerSeverity(level: CuttingCheckBlockerItem['severity']): string {
  const meta = blockerLevelMetaMap[level]
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}">${escapeHtml(meta.label)}</span>`
}

function renderBlockerList(detail: CuttingSummaryDetailPanelData): string {
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">风险项清单</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.blockerItems.length)} 项</span>
      </div>
      ${
        detail.blockerItems.length
          ? renderStickyTableScroller(
              `
                <table class="min-w-full text-sm">
                  <thead class="sticky top-0 bg-card">
                    <tr class="border-b text-left text-xs text-muted-foreground">
                      <th class="px-3 py-2">链路</th>
                      <th class="px-3 py-2">来源对象</th>
                      <th class="px-3 py-2">面料</th>
                      <th class="px-3 py-2">当前状态</th>
                      <th class="px-3 py-2">风险原因</th>
                      <th class="px-3 py-2">建议关注</th>
                      <th class="px-3 py-2 text-right">查看来源</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detail.blockerItems
                      .map(
                        (item) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                              <div class="space-y-1">
                                <span class="inline-flex rounded-full border bg-muted/30 px-2 py-0.5 text-xs text-foreground">${escapeHtml(cuttingCheckSectionLabelMap[item.sectionKey])}</span>
                                <div>${renderBlockerSeverity(item.severity)}</div>
                              </div>
                            </td>
                            <td class="px-3 py-3 text-sm">
                              <p class="font-medium text-foreground">${escapeHtml(item.sourceNo)}</p>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sourceLabel)}</p>
                            </td>
                            <td class="px-3 py-3">
                              ${item.materialSku
                                ? renderMaterialIdentityBlock(
                                    {
                                      materialSku: item.materialSku,
                                      materialLabel: '风险来源面料',
                                      materialAlias: findSummaryMaterialIdentity(detail, item.materialSku, item.sourceNo)?.materialAlias || '',
                                      materialImageUrl: findSummaryMaterialIdentity(detail, item.materialSku, item.sourceNo)?.materialImageUrl || '',
                                    },
                                    { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                                  )
                                : '<span class="text-xs text-muted-foreground">—</span>'}
                            </td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStateLabel)}</td>
                            <td class="px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(item.blockerReason)}</td>
                            <td class="px-3 py-3 text-xs text-blue-700">${escapeHtml(item.nextActionLabel)}</td>
                            <td class="px-3 py-3 text-right">
                              <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="navigate-blocker" data-row-id="${detail.row.rowId}" data-blocker-id="${item.blockerId}">
                                ${escapeHtml(getCuttingNavigationActionLabel(item.navigationTarget as CuttingNavigationTarget))}
                              </button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `,
              'max-h-[26rem]',
            )
          : '<p class="mt-3 text-sm text-muted-foreground">当前没有明确风险项。</p>'
      }
    </article>
  `
}

function renderSourceObjects(detail: CuttingSummaryDetailPanelData): string {
  const groups = sourceObjectGroupOrder
    .map((sourceType) => ({
      sourceType,
      label: sourceObjectTypeLabelMap[sourceType],
      items: detail.sourceObjects.filter((item) => item.sourceType === sourceType),
    }))
    .filter((group) => group.items.length)

  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">来源对象</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.sourceObjects.length)} 个</span>
      </div>
      ${
        groups.length
          ? `<div class="mt-3 space-y-3">
              ${groups
                .map(
                  (group) => `
                    <section class="space-y-2">
                      <div class="flex items-center justify-between gap-3">
                        <h4 class="text-xs font-semibold text-muted-foreground">${escapeHtml(group.label)}</h4>
                        <span class="text-[11px] text-muted-foreground">${formatCount(group.items.length)} 个</span>
                      </div>
                      <div class="space-y-2">
                        ${group.items
                          .map(
                            (item) => `
                              <div class="rounded-md border px-3 py-2">
                                <div class="flex items-start justify-between gap-3">
                                  <div class="min-w-0">
                                    <p class="truncate text-sm font-medium text-foreground">${escapeHtml(item.sourceNo)}</p>
                                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.statusLabel)}</p>
                                    ${
                                      item.materialSku
                                        ? `<div class="mt-2">${renderMaterialIdentityBlock(
                                            {
                                              materialSku: item.materialSku,
                                              materialLabel: item.sourceLabel,
                                              materialAlias: item.materialAlias,
                                              materialImageUrl: item.materialImageUrl,
                                            },
                                            { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                                          )}</div>`
                                        : ''
                                    }
                                  </div>
                                  <div class="shrink-0 text-right">
                                    ${
                                      item.blockerCount
                                        ? `<span class="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">风险 ${formatCount(item.blockerCount)}</span>`
                                        : '<span class="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">无风险</span>'
                                    }
                                    <div class="mt-2">
                                      <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-summary-action="navigate-source-object" data-row-id="${detail.row.rowId}" data-source-type="${item.sourceType}" data-source-id="${item.sourceId}">
                                        ${escapeHtml(getCuttingNavigationActionLabel(item.navigationTarget as CuttingNavigationTarget))}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    </section>
                  `,
                )
                .join('')}
            </div>`
          : '<p class="mt-3 text-sm text-muted-foreground">当前未挂出可核查来源对象。</p>'
      }
    </article>
  `
}

function renderSectionStates(detail: CuttingSummaryDetailPanelData): string {
  return `
    <article class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">链路完成度</h3>
        <span class="text-xs text-muted-foreground">${formatCount(detail.sectionStates.length)} 条链路</span>
      </div>
      <div class="mt-3 space-y-2">
        ${detail.sectionStates
          .map(
            (section) => `
              <div class="rounded-md border px-3 py-2">
                <div class="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-medium text-foreground">${escapeHtml(section.label)}</p>
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${section.className}">${escapeHtml(section.currentStateLabel)}</span>
                    </div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(section.detailText)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">风险对象 ${formatCount(section.blockerCount)} / 完成 ${formatCount(section.doneCount)} / 总数 ${formatCount(section.totalCount)}</p>
                  </div>
                  <div class="shrink-0">
                    <button
                      type="button"
                      class="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      data-cutting-summary-action="navigate-section-action"
                      data-row-id="${detail.row.rowId}"
                      data-section-key="${section.sectionKey}"
                    >
                      ${escapeHtml(section.defaultAction.label)}
                    </button>
                  </div>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `
}

function renderDetailPanel(detail: CuttingSummaryDetailPanelData | null, aggregates: CuttingSummaryRenderAggregates): string {
  if (!detail) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold text-foreground">结果详情</h2>
        <p class="mt-2 text-sm text-muted-foreground">请选择一条生产单核查记录。</p>
      </section>
    `
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">结果详情</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-summary-action="close-overlay">清空当前选中</button>
      </div>
      ${renderResultConclusion(detail, aggregates)}
      ${renderPartResultSection(detail, aggregates)}
      ${renderCheckConclusion(detail)}
      ${renderPieceTruthSkuSection(detail)}
      ${renderPieceTruthGapSection(detail)}
      ${renderPieceTruthIssueSection(detail)}
      ${renderBlockerList(detail)}
      ${renderSourceObjects(detail)}
      ${renderSectionStates(detail)}
    </section>
  `
}

function renderTraceNode(node: CuttingSummaryTraceNode, rowId: string): string {
  const targetMap: Record<CuttingSummaryTraceNode['nodeType'], SummaryNavigationTarget> = {
    'production-order': 'productionProgress',
    'cut-order': 'cutOrders',
    'marker-plan': 'markerPlanSources',
    ticket: 'feiTickets',
    'bag-usage': 'transferBags',
    replenishment: 'replenishment',
    'special-process': 'specialProcesses',
  }

  return `
    <li class="space-y-2">
      <div class="rounded-md border px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-foreground">${escapeHtml(node.nodeLabel)}</p>
            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(node.status)}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            data-cutting-summary-action="navigate-row"
            data-row-id="${rowId}"
            data-nav-target="${targetMap[node.nodeType]}"
          >
            跳转
          </button>
        </div>
      </div>
      ${
        node.children.length
          ? `<ul class="ml-4 space-y-2 border-l pl-3">${node.children.map((child) => renderTraceNode(child, rowId)).join('')}</ul>`
          : ''
      }
    </li>
  `
}

function renderTracePanel(detail: CuttingSummaryDetailPanelData | null): string {
  return renderWorkbenchSecondaryPanel({
    title: '追溯关系区',
    hint: '',
    defaultOpen: true,
    countText: detail ? `${detail.traceTree.length} 条根节点` : '待选择对象',
    body: detail
      ? `<ul class="space-y-3">${detail.traceTree.map((node) => renderTraceNode(node, detail.row.rowId)).join('')}</ul>`
      : '<p class="text-sm text-muted-foreground">请选择一条记录。</p>',
  })
}

function renderPage(): string {
  const projection = buildProjection()
  const { sources, viewModel } = projection
  syncStateWithQuery(viewModel)
  const baseRows = getFilteredRows(viewModel, { ignoreIssueType: true })
  const aggregates = buildSummaryRenderAggregates(baseRows, sources)
  const allCheckItems = buildCuttingResultCheckItems(baseRows, sources, aggregates)
  const filteredCheckItems = getFilteredCheckItems(allCheckItems)
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'summary')

  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader(meta)}
      ${renderPrefilterBar()}
      ${renderCheckOverviewCards(allCheckItems)}
      ${renderResultCheckFilterBar()}
      <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        默认展示待处理核查项；如需历史查询，可将处理状态切换为全部状态。
        当前筛选命中 ${formatCount(filteredCheckItems.length)} 项，来源生产单 ${formatCount(new Set(filteredCheckItems.map((item) => item.productionOrderNo)).size)} 个。
      </section>
      ${renderGroupedCheckItems(filteredCheckItems)}
    </div>
  `
}

function getRowById(rowId: string | undefined): CuttingSummaryRow | null {
  if (!rowId) return null
  return buildPageData().viewModel.rowsById[rowId] || null
}

function getDetailByRowId(rowId: string | undefined): CuttingSummaryDetailPanelData | null {
  if (!rowId) return null
  return buildFcsCuttingSummaryDetailProjection(rowId, buildProjection())
}

function getRowAction(rowId: string | undefined, actionId: string | undefined): CuttingCheckNextAction | null {
  const row = getRowById(rowId)
  if (!row || !actionId) return null
  return row.nextActions.find((item) => item.actionId === actionId) || null
}

function getRowBlocker(rowId: string | undefined, blockerId: string | undefined): CuttingCheckBlockerItem | null {
  const row = getRowById(rowId)
  if (!row || !blockerId) return null
  return row.blockerItems.find((item) => item.blockerId === blockerId) || null
}

function getRowSection(rowId: string | undefined, sectionKey: string | undefined): CuttingCheckSectionState | null {
  const row = getRowById(rowId)
  if (!row || !sectionKey) return null
  return row.checkSections.find((item) => item.sectionKey === sectionKey) || null
}

function getSourceObject(
  rowId: string | undefined,
  sourceType: string | undefined,
  sourceId: string | undefined,
): CuttingSummarySourceObjectItem | null {
  const detail = getDetailByRowId(rowId)
  if (!detail || !sourceType || !sourceId) return null
  return detail.sourceObjects.find((item) => item.sourceType === sourceType && item.sourceId === sourceId) || null
}

export function renderCraftCuttingSummaryPage(): string {
  return renderPage()
}

export function handleCraftCuttingSummaryEvent(target: Element): boolean {
  const filterFieldNode = target.closest<HTMLElement>('[data-cutting-summary-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.cuttingSummaryField as SummaryFilterField | undefined
    if (!field) return false
    state.filters = {
      ...state.filters,
      [field]: (filterFieldNode as HTMLInputElement | HTMLSelectElement).value,
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-summary-action]')
  const action = actionNode?.dataset.cuttingSummaryAction
  if (!action) return false

  if (action === 'focus-row') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return false
    state.activeRowId = rowId
    state.activeIssueId = null
    return true
  }

  if (action === 'focus-issue') {
    const issueId = actionNode.dataset.issueId
    if (!issueId) return false
    state.activeIssueId = issueId
    state.activeRowId = actionNode.dataset.rowId || null
    return true
  }

  if (action === 'close-overlay') {
    state.activeRowId = null
    state.activeIssueId = null
    return true
  }

  if (action === 'clear-prefilter') {
    clearLocateState()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    state.activeIssueId = null
    return true
  }

  if (action === 'navigate-check-item') {
    const route = actionNode.dataset.actionRoute
    if (!route) return false
    appStore.navigate(route)
    return true
  }

  if (action === 'mark-check-handled') {
    const checkItemId = actionNode.dataset.checkItemId
    if (!checkItemId) return false
    state.resolvedCheckItemIds.add(checkItemId)
    return true
  }

  if (action === 'toggle-replenishment') {
    state.filters.pendingReplenishmentOnly = !state.filters.pendingReplenishmentOnly
    return true
  }

  if (action === 'toggle-tickets') {
    state.filters.pendingTicketsOnly = !state.filters.pendingTicketsOnly
    return true
  }

  if (action === 'toggle-bags') {
    state.filters.pendingBagOnly = !state.filters.pendingBagOnly
    return true
  }

  if (action === 'toggle-special') {
    state.filters.specialProcessOnly = !state.filters.specialProcessOnly
    return true
  }

  if (action === 'navigate-row') {
    const row = getRowById(actionNode.dataset.rowId || state.activeRowId || undefined)
    const navTarget = actionNode.dataset.navTarget as SummaryNavigationTarget | undefined
    if (!row || !navTarget) return false
    return navigateWithPayload(navTarget, row.navigationPayload[navTarget], {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    })
  }

  if (action === 'navigate-next-action') {
    const nextAction = getRowAction(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.actionId)
    if (!nextAction) return false
    return navigateWithPayload(nextAction.target as SummaryNavigationTarget, nextAction.payload, {
      blockerSection: nextAction.sectionKey,
      sourceSection: 'action-queue',
    })
  }

  if (action === 'navigate-blocker') {
    const blocker = getRowBlocker(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.blockerId)
    if (!blocker) return false
    return navigateWithPayload(blocker.navigationTarget as SummaryNavigationTarget, blocker.navigationPayload, {
      productionOrderId: blocker.productionOrderId,
      productionOrderNo: blocker.productionOrderNo,
      blockerSection: blocker.sectionKey,
      sourceSection: 'blocker-list',
      cutOrderNo: blocker.sourceType === 'CUT_ORDER' ? blocker.sourceNo : undefined,
      markerPlanNo: blocker.sourceType === 'MARKER_PLAN' ? blocker.sourceNo : undefined,
      suggestionId: blocker.sourceType === 'REPLENISHMENT' ? blocker.sourceId : undefined,
      suggestionNo: blocker.sourceType === 'REPLENISHMENT' ? blocker.sourceNo : undefined,
      processOrderId: blocker.sourceType === 'SPECIAL_PROCESS' ? blocker.sourceId : undefined,
      processOrderNo: blocker.sourceType === 'SPECIAL_PROCESS' ? blocker.sourceNo : undefined,
      bagCode: blocker.sourceType === 'BAG_USAGE' ? blocker.sourceNo : undefined,
      materialSku: blocker.materialSku || undefined,
    })
  }

  if (action === 'navigate-section-action') {
    const section = getRowSection(actionNode.dataset.rowId || state.activeRowId || undefined, actionNode.dataset.sectionKey)
    if (!section) return false
    return navigateWithPayload(section.defaultAction.target as SummaryNavigationTarget, section.defaultAction.payload, {
      blockerSection: section.sectionKey,
      sourceSection: 'section-state',
    })
  }

  if (action === 'navigate-source-object') {
    const sourceObject = getSourceObject(
      actionNode.dataset.rowId || state.activeRowId || undefined,
      actionNode.dataset.sourceType,
      actionNode.dataset.sourceId,
    )
    if (!sourceObject) return false
    return navigateWithPayload(sourceObject.navigationTarget as SummaryNavigationTarget, sourceObject.navigationPayload, {
      sourceSection: 'source-object',
      cutOrderNo: sourceObject.sourceType === 'CUT_ORDER' ? sourceObject.sourceNo : undefined,
      markerPlanNo: sourceObject.sourceType === 'MARKER_PLAN' ? sourceObject.sourceNo : undefined,
      suggestionId: sourceObject.sourceType === 'REPLENISHMENT' ? sourceObject.sourceId : undefined,
      suggestionNo: sourceObject.sourceType === 'REPLENISHMENT' ? sourceObject.sourceNo : undefined,
      processOrderId: sourceObject.sourceType === 'SPECIAL_PROCESS' ? sourceObject.sourceId : undefined,
      processOrderNo: sourceObject.sourceType === 'SPECIAL_PROCESS' ? sourceObject.sourceNo : undefined,
      bagCode: sourceObject.sourceType === 'BAG_USAGE' ? sourceObject.sourceNo : undefined,
      materialSku: sourceObject.materialSku || undefined,
    })
  }

  return false
}

export function isCraftCuttingSummaryDialogOpen(): boolean {
  return false
}
