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
          <p class="text-sm font-semibold text-foreground">裁剪总结进度联动</p>
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
          <h2 class="text-base font-semibold text-foreground">裁剪结果总表</h2>
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
    'marker-plan-ref': 'markerPlanRefs',
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
  const issueRows = getFilteredRows(viewModel, { ignoreIssueType: true })
  const issues = buildCuttingSummaryIssues(issueRows)
  const filteredRows = getFilteredRows(viewModel)
  const aggregates = buildSummaryRenderAggregates(filteredRows, sources)
  const activeRowId = getActiveRowId(filteredRows, issues)
  const detail = activeRowId ? buildFcsCuttingSummaryDetailProjection(activeRowId, projection) : null
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'summary')

  return `
    <div class="space-y-4">
      ${renderCuttingPageHeader(meta)}
      ${renderCuttingResultOverview(filteredRows, aggregates)}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderIssueBoard(issues)}
      ${renderCheckStateBar(filteredRows)}
      ${renderSpecialCraftReturnOverview(filteredRows, aggregates)}
      ${renderSewingDispatchOverview(filteredRows, aggregates)}
      ${renderProgressStatisticsSummary(filteredRows, aggregates)}
      ${renderResultMainTable(filteredRows, aggregates)}
      <section class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div class="space-y-4">
          ${renderDetailPanel(detail, aggregates)}
        </div>
        <div class="space-y-4">
          ${renderTracePanel(detail)}
        </div>
      </section>
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
