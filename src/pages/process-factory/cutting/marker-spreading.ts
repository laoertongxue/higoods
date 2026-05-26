import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildMarkerSeedDraft,
  finalizeSpreadingCompletion,
  buildMarkerSpreadingViewModel,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  buildRollHandoverViewModel,
  buildOperatorAmountWarnings,
  buildOperatorHandledGarmentQtyFormula,
  buildOperatorHandledLayerFormula,
  buildOperatorHandledLengthFormula,
  buildRollActualCutGarmentQtyFormula,
  buildShortageQtyFormula,
  buildSpreadingImportedLengthFormula,
  buildTheoreticalCutGarmentQtyFormula,
  buildTheoreticalActualCutQtyFormula,
  computeOperatorCalculatedAmount,
  computeOperatorDisplayAmount,
  computeOperatorHandledGarmentQty,
  computeRemainingLength,
  computeOperatorHandledLengthByRoll,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  deriveSpreadingColorSummary,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  buildSpreadingSessionIdentityForMarkerBed,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deriveSpreadingStatus,
  deriveSpreadingCuttingStatus,
  deriveSpreadingListStatus,
  deriveSpreadingSessionGarmentQtyPerLayer,
  hasSpreadingActualExecution,
  resolveSpreadingOrderStatusFromSession,
  serializeMarkerSpreadingStorage,
  spreadingOrderStatusMeta,
  upsertMarkerRecord,
  upsertSpreadingSession,
  updateSessionStatus,
  validateSpreadingCompletion,
  summarizeSpreadingOperatorAmounts,
  type MarkerAllocationLine,
  type MarkerLineItem,
  type MarkerModeKey,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingPrefilter,
  type SpreadingPricingMode,
  type SpreadingReplenishmentWarning,
  type SpreadingOperatorRecord,
  type SpreadingOperatorAmountSummary,
  type SpreadingPlanUnit,
  type SpreadingOrder,
  type SpreadingRollHandoverSummary,
  type SpreadingRollRecord,
  type SpreadingSession,
  type SpreadingCuttingStatusKey,
  type SpreadingListStatusKey,
  type SpreadingStatusKey,
  findSpreadingPlanUnitById,
  validateMarkerForSpreadingImport,
} from './marker-spreading-model.ts'
import {
  buildMarkerDetailViewModel,
  buildMarkerListViewModel,
  buildMarkerNavigationPayload,
  buildMarkerSpreadingCountsByCutOrder,
  buildSpreadingDetailViewModel,
  buildSpreadingListViewModel,
  buildSpreadingReplenishmentWarning,
  buildMarkerWarningMessages,
  buildSpreadingHandoverListSummary,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeSinglePieceUsage,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingModeMeta,
  getDefaultMarkerSpreadingContext,
  buildMarkerSpreadingPrototypeStore,
  MARKER_SIZE_KEYS,
  readMarkerSpreadingPrototypeData,
  type HighLowCuttingRow,
  type HighLowPatternRow,
  summarizeSpreadingRolls,
  type MarkerListRow,
  type SpreadingListRow,
} from './marker-spreading-utils.ts'
import { listSpreadingPieceOutputLines } from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  buildMarkerSpreadingProjection,
  buildSpreadingPlanUnitProjectionLabel,
  type SpreadingCreateSourceRow,
  type MarkerSpreadingProjection,
} from './marker-spreading-projection.ts'
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel,
  type MarkerAllocationSourceRow,
  type MarkerExplosionAllocationRow,
  type MarkerExplosionPieceDetailRow,
  type MarkerExplosionSkuSummaryRow,
} from './marker-piece-explosion.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  addHighLowCuttingRow,
  addHighLowPatternKey,
  addHighLowPatternRow,
  addMarkerAllocationLine,
  addMarkerLineItem,
  addMarkerSizeRow,
  addSpreadingOperator,
  addSpreadingOperatorForRoll,
  addSpreadingRoll,
  removeHighLowCuttingRow,
  removeHighLowPatternKey,
  removeHighLowPatternRow,
  removeMarkerAllocationLine,
  removeMarkerLineItem,
  removeMarkerSizeRow,
  removeSpreadingOperator,
  removeSpreadingRoll,
} from './marker-spreading-draft-actions.ts'
import { handleMarkerSpreadingSubmitAction } from './marker-spreading-submit-actions.ts'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import {
  DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
  cuttingTableResources,
} from './cutting-table-resource.ts'
import { buildPdaCuttingMainlinePathForSession } from '../../../data/fcs/cutting/cutting-mainline.ts'
import { listSpreadingDifferencesBySpreadingOrder } from '../../../data/fcs/cutting/spreading-differences.ts'

type ListTabKey = 'ALL' | SpreadingListStatusKey
type FeedbackTone = 'success' | 'warning'
type MarkerModeFilter = 'ALL' | MarkerModeKey
type ContextTypeFilter = 'ALL' | 'cut-order' | 'marker-plan'
type BooleanFilter = 'ALL' | 'YES' | 'NO'
type SpreadingStageFilter = 'ALL' | SpreadingListStatusKey
const MOBILE_SOURCE_CHANNEL = 'PDA' as const
const MOBILE_WRITEBACK_CHANNEL = 'PDA_WRITEBACK' as const

type SpreadingSourceFilter = 'ALL' | 'PC' | typeof MOBILE_SOURCE_CHANNEL
type SpreadingCreateStepKey = 'SELECT_MARKER' | 'CONFIRM_CREATE'
type SpreadingCreateScheduleMode = 'BY_MARKER_NO' | 'WHOLE_PLAN_ONE_TABLE'
interface SpreadingCreateAssignment {
  cuttingTableId: string
  plannedStartAt: string
  plannedEndAt: string
  ownerAccountId: string
}
type SpreadingEditTabKey = 'summary' | 'rolls' | 'operators' | 'variance'
type MarkerDraftField =
  | 'markerNo'
  | 'markerMode'
  | 'colorSummary'
  | 'netLength'
  | 'singlePieceUsage'
  | 'spreadTotalLength'
  | 'materialCategory'
  | 'materialAttr'
  | 'sizeRatioPlanText'
  | 'plannedLayerCount'
  | 'plannedMarkerCount'
  | 'markerLength'
  | 'procurementUnitUsage'
  | 'actualUnitUsage'
  | 'fabricSku'
  | 'plannedMaterialMeter'
  | 'actualMaterialMeter'
  | 'actualCutQty'
  | 'markerImageUrl'
  | 'markerImageName'
  | 'note'
  | 'adjustmentRequired'
  | 'adjustmentNote'
type MarkerSizeField = 'sizeLabel' | 'quantity'
type MarkerAllocationField = 'sourceCutOrderId' | 'sizeLabel' | 'plannedGarmentQty' | 'note'
type MarkerLineField =
  | 'layoutCode'
  | 'layoutDetailText'
  | 'color'
  | 'spreadRepeatCount'
  | 'markerLength'
  | 'markerPieceCount'
  | 'singlePieceUsage'
  | 'spreadTotalLength'
  | 'widthHint'
  | 'note'
type SpreadingDraftField =
  | 'sessionNo'
  | 'spreadingMode'
  | 'colorSummary'
  | 'cuttingTableId'
  | 'plannedStartAt'
  | 'plannedEndAt'
  | 'plannedLayers'
  | 'theoreticalSpreadTotalLength'
  | 'theoreticalActualCutPieceQty'
  | 'importAdjustmentRequired'
  | 'importAdjustmentNote'
  | 'unitPrice'
  | 'note'
  | 'status'
type SpreadingRollField =
  | 'planUnitId'
  | 'rollNo'
  | 'materialSku'
  | 'color'
  | 'width'
  | 'labeledLength'
  | 'actualLength'
  | 'headLength'
  | 'tailLength'
  | 'layerCount'
  | 'occurredAt'
  | 'note'
type SpreadingOperatorField =
  | 'rollRecordId'
  | 'operatorName'
  | 'operatorAccountId'
  | 'startAt'
  | 'endAt'
  | 'actionType'
  | 'startLayer'
  | 'endLayer'
  | 'handledLength'
  | 'unitPrice'
  | 'pricingMode'
  | 'manualAmountAdjusted'
  | 'adjustedAmount'
  | 'amountNote'
  | 'nextOperatorAccountId'
  | 'handoverNotes'
  | 'note'

interface MarkerSpreadingPageState {
  querySignature: string
  prefilter: MarkerSpreadingPrefilter | null
  drillContext: CuttingDrillContext | null
  activeTab: ListTabKey
  keyword: string
  contextNoFilter: string
  sessionNoFilter: string
  cutOrderFilter: string
  markerPlanSourceFilter: string
  markerNoFilter: string
  productionOrderFilter: string
  styleSpuFilter: string
  materialSkuFilter: string
  colorFilter: string
  markerModeFilter: MarkerModeFilter
  contextTypeFilter: ContextTypeFilter
  spreadingStageFilter: SpreadingStageFilter
  sourceChannelFilter: SpreadingSourceFilter
  spreadingEditTab: SpreadingEditTabKey
  adjustmentFilter: BooleanFilter
  imageFilter: BooleanFilter
  spreadingModeFilter: MarkerModeFilter
  spreadingCompletionSelection: string[]
  createStep: SpreadingCreateStepKey
  selectedCreateMarkerId: string
  selectedCreateSourceSnapshot: SpreadingCreateSourceRow | null
  createExceptionBackfill: boolean
  createExceptionReason: string
  createScheduleMode: SpreadingCreateScheduleMode
  createOwnerAccountId: string
  createCuttingTableId: string
  createPlannedStartAt: string
  createNote: string
  createAssignments: Record<string, SpreadingCreateAssignment>
  markerDraft: MarkerRecord | null
  spreadingDraft: SpreadingSession | null
  feedback: {
    tone: FeedbackTone
    message: string
  } | null
  importDecision: {
    markerId: string
    markerNo: string
    targetSessionId: string
    targetSessionNo: string
  } | null
}

const SPREADING_CREATE_OWNER_OPTIONS = [
  { value: 'planner-chenjing', label: '计划员-陈静' },
  { value: 'supervisor-liufang', label: '铺布主管-刘芳' },
  { value: 'supervisor-zhouwei', label: '铺布主管-周伟' },
] as const

interface SupervisorSpreadingRow extends SpreadingListRow {
  sourceMarkerLabel: string
  contextSummary: string
  productionOrderCount: number
  plannedCutGarmentQtyFormula: string
  actualCutGarmentQtyFormula: string
  shortageGarmentQty: number
  shortageGarmentQtyFormula: string
  spreadActualLengthFormula: string
  dataSourceLabel: 'PC' | typeof MOBILE_SOURCE_CHANNEL
  mainStageKey: SpreadingListStatusKey
  mainStageLabel: string
  mainStageClassName: string
  mainStageFormula: string
  cuttingStatusKey: SpreadingCuttingStatusKey | ''
  cuttingStatusLabel: string
  cuttingStatusClassName: string
  cuttingStatusFormula: string
}

function getSpreadingDataSourceLabel(source: 'ALL' | 'PC' | typeof MOBILE_SOURCE_CHANNEL): string {
  if (source === 'PC') return '电脑录入'
  if (source === MOBILE_SOURCE_CHANNEL) return '移动录入'
  return '全部'
}

function isMobileWritebackSource(sourceChannel?: string, sourceWritebackId?: string | null): boolean {
  return sourceChannel === MOBILE_WRITEBACK_CHANNEL || Boolean(sourceWritebackId)
}

function getSourceChannelDisplayLabel(sourceChannel?: string): string {
  if (sourceChannel === MOBILE_WRITEBACK_CHANNEL) return '移动录入'
  if (sourceChannel === 'MIXED') return '混合录入'
  return '电脑录入'
}

const state: MarkerSpreadingPageState = {
  querySignature: '',
  prefilter: null,
  drillContext: null,
  activeTab: 'ALL',
  keyword: '',
  contextNoFilter: '',
  sessionNoFilter: '',
  cutOrderFilter: '',
  markerPlanSourceFilter: '',
  markerNoFilter: '',
  productionOrderFilter: '',
  styleSpuFilter: '',
  materialSkuFilter: '',
  colorFilter: '',
  markerModeFilter: 'ALL',
  contextTypeFilter: 'ALL',
  spreadingStageFilter: 'ALL',
  sourceChannelFilter: 'ALL',
  spreadingEditTab: 'summary',
  adjustmentFilter: 'ALL',
  imageFilter: 'ALL',
  spreadingModeFilter: 'ALL',
  spreadingCompletionSelection: [],
  createStep: 'SELECT_MARKER',
  selectedCreateMarkerId: '',
  selectedCreateSourceSnapshot: null,
  createExceptionBackfill: false,
  createExceptionReason: '',
  createScheduleMode: 'WHOLE_PLAN_ONE_TABLE',
  createOwnerAccountId: '',
  createCuttingTableId: '',
  createPlannedStartAt: '',
  createNote: '',
  createAssignments: {},
  markerDraft: null,
  spreadingDraft: null,
  feedback: null,
  importDecision: null,
}

function getCurrentPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('spreading-list')
}

function getSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function buildCanonicalSpreadingListPathFromCurrentLocation(): string {
  const query = getSearchParams().toString()
  const basePath = getCanonicalCuttingPath('spreading-list')
  return query ? `${basePath}?${query}` : basePath
}

function buildRouteWithQuery(pathname: string, payload?: Record<string, string | undefined>): string {
  if (!payload) return pathname
  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function buildMarkerRouteWithContext(pathname: string, payload?: Record<string, string | undefined>): string {
  return buildRouteWithQuery(pathname, {
    ...serializeCuttingDrillContext(state.drillContext),
    ...payload,
  })
}

function buildCreateOwnerLabel(accountId: string): string {
  return SPREADING_CREATE_OWNER_OPTIONS.find((option) => option.value === accountId)?.label || SPREADING_CREATE_OWNER_OPTIONS[0].label
}

function matchesSpreadingCreateSource(source: SpreadingCreateSourceRow): boolean {
  if (
    !matchesKeyword(state.keyword, [
      source.markerNo,
      source.sourceSchemeNo,
      source.sourceBedNo,
      ...source.cutOrderNos,
      source.markerPlanNo,
      ...source.productionOrderNos,
      source.styleCode,
      source.spuCode,
      source.materialSkuSummary,
    ])
  ) {
    return false
  }
  if (!matchesIncludesFilter(state.cutOrderFilter, source.cutOrderNos)) return false
  if (!matchesIncludesFilter(state.markerPlanSourceFilter, [source.markerPlanNo])) return false
  if (!matchesIncludesFilter(state.markerNoFilter, [source.markerNo, source.sourceSchemeNo, source.sourceBedNo])) return false
  if (!matchesIncludesFilter(state.productionOrderFilter, source.productionOrderNos)) return false
  if (!matchesIncludesFilter(state.styleSpuFilter, [source.styleCode, source.spuCode])) return false
  if (!matchesIncludesFilter(state.materialSkuFilter, [source.materialSkuSummary])) return false
  if (!matchesIncludesFilter(state.colorFilter, [source.colorSummary])) return false
  if (state.spreadingModeFilter !== 'ALL' && source.markerMode !== state.spreadingModeFilter) return false
  return true
}

function getSpreadingCreateSourceRows(): SpreadingCreateSourceRow[] {
  return buildMarkerSpreadingProjection({
    prefilter: state.prefilter,
  }).createSources.filter(matchesSpreadingCreateSource)
}

function getSelectedCreateSource(rows = getSpreadingCreateSourceRows()): SpreadingCreateSourceRow | null {
  if (!state.selectedCreateMarkerId) return null
  const matched = rows.find((row) => row.markerId === state.selectedCreateMarkerId) ||
    rows.find((row) => row.sourceBedId === state.selectedCreateMarkerId) ||
    rows.find((row) => row.sourceSchemeId === state.selectedCreateMarkerId) ||
    null
  if (matched) return matched
  const snapshot = state.selectedCreateSourceSnapshot
  if (
    snapshot &&
    (
      snapshot.markerId === state.selectedCreateMarkerId ||
      snapshot.sourceBedId === state.selectedCreateMarkerId ||
      snapshot.sourceSchemeId === state.selectedCreateMarkerId
    )
  ) {
    return snapshot
  }
  return null
}

function getSelectedCreateSchemeSources(rows = getSpreadingCreateSourceRows()): SpreadingCreateSourceRow[] {
  const selected = getSelectedCreateSource(rows)
  if (!selected?.sourceSchemeId) return selected ? [selected] : []
  return rows
    .filter((row) => row.sourceSchemeId === selected.sourceSchemeId)
    .sort((left, right) => left.sourceBedNo.localeCompare(right.sourceBedNo, 'zh-CN', { numeric: true }))
}

function getCreateAssignmentKey(source: SpreadingCreateSourceRow): string {
  return source.markerId || source.sourceBedId || source.sourceSchemeId
}

function getDefaultCreateAssignment(source: SpreadingCreateSourceRow, index: number): SpreadingCreateAssignment {
  const startAt = state.createPlannedStartAt || formatDateTimeLocal()
  const plannedStartAt =
    state.createScheduleMode === 'WHOLE_PLAN_ONE_TABLE'
      ? startAt
      : addMinutesToDateTimeLocal(startAt, index * DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES)
  return {
    cuttingTableId: state.createCuttingTableId || '',
    plannedStartAt,
    plannedEndAt: addMinutesToDateTimeLocal(plannedStartAt, DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES),
    ownerAccountId: state.createOwnerAccountId || '',
  }
}

function ensureCreateAssignments(rows: SpreadingCreateSourceRow[]): Record<string, SpreadingCreateAssignment> {
  const validKeys = new Set(rows.map(getCreateAssignmentKey))
  Object.keys(state.createAssignments).forEach((key) => {
    if (!validKeys.has(key)) delete state.createAssignments[key]
  })
  rows.forEach((row, index) => {
    const key = getCreateAssignmentKey(row)
    if (!state.createAssignments[key]) {
      state.createAssignments[key] = getDefaultCreateAssignment(row, index)
    }
  })
  return state.createAssignments
}

function getCreateAssignment(source: SpreadingCreateSourceRow, index: number): SpreadingCreateAssignment {
  const key = getCreateAssignmentKey(source)
  if (!state.createAssignments[key]) {
    state.createAssignments[key] = getDefaultCreateAssignment(source, index)
  }
  return state.createAssignments[key]
}

function syncCreateAssignmentsByCuttingTable(
  cuttingTableId: string,
  patch: Partial<Pick<SpreadingCreateAssignment, 'plannedStartAt' | 'plannedEndAt' | 'ownerAccountId'>>,
): void {
  if (!cuttingTableId) return
  getSelectedCreateSchemeSources().forEach((row, index) => {
    const assignment = getCreateAssignment(row, index)
    if (assignment.cuttingTableId !== cuttingTableId) return
    if (patch.plannedStartAt !== undefined) assignment.plannedStartAt = patch.plannedStartAt
    if (patch.plannedEndAt !== undefined) assignment.plannedEndAt = patch.plannedEndAt
    if (patch.ownerAccountId !== undefined) assignment.ownerAccountId = patch.ownerAccountId
  })
}

function getLatestCreateAssignmentForCuttingTable(
  cuttingTableId: string,
  excludeKey?: string,
): SpreadingCreateAssignment | null {
  if (!cuttingTableId) return null
  const rows = getSelectedCreateSchemeSources()
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    const key = getCreateAssignmentKey(row)
    if (key === excludeKey) continue
    const assignment = getCreateAssignment(row, index)
    if (assignment.cuttingTableId === cuttingTableId) return assignment
  }
  return null
}

function buildCreateAssignmentGroups(rows: SpreadingCreateSourceRow[]): Array<{
  groupKey: string
  rows: SpreadingCreateSourceRow[]
  cuttingTableId: string
  plannedStartAt: string
  plannedEndAt: string
  ownerAccountId: string
}> {
  ensureCreateAssignments(rows)
  const groups = new Map<string, {
    groupKey: string
    rows: SpreadingCreateSourceRow[]
    cuttingTableId: string
    plannedStartAt: string
    plannedEndAt: string
    ownerAccountId: string
  }>()
  rows.forEach((row, index) => {
    const assignment = getCreateAssignment(row, index)
    const groupKey = [
      assignment.cuttingTableId,
      assignment.plannedStartAt,
      assignment.plannedEndAt,
      assignment.ownerAccountId,
    ].join('|')
    const existing = groups.get(groupKey)
    if (existing) {
      existing.rows.push(row)
      return
    }
    groups.set(groupKey, {
      groupKey,
      rows: [row],
      cuttingTableId: assignment.cuttingTableId,
      plannedStartAt: assignment.plannedStartAt,
      plannedEndAt: assignment.plannedEndAt,
      ownerAccountId: assignment.ownerAccountId,
    })
  })
  return Array.from(groups.values())
}

function getExceptionCreateContext(): MarkerSpreadingContext | null {
  const data = readMarkerSpreadingPrototypeData()
  return getDefaultMarkerSpreadingContext(data.rows, data.markerPlanSources, state.prefilter)
}

function buildEmptyCreatePreview(): {
  source: SpreadingCreateSourceRow | null
  context: MarkerSpreadingContext | null
  marker: MarkerRecord | null
  plannedCutGarmentQty: number
  plannedCutGarmentQtyFormula: string
  plannedSpreadLengthM: number
  plannedSpreadLengthFormula: string
} {
  return {
    source: null,
    context: null,
    marker: null,
    plannedCutGarmentQty: 0,
    plannedCutGarmentQtyFormula: buildTheoreticalActualCutQtyFormula(0, 0, 0),
    plannedSpreadLengthM: 0,
    plannedSpreadLengthFormula: buildSpreadingImportedLengthFormula(0),
  }
}

function getSpreadingCreatePreview(): {
  source: SpreadingCreateSourceRow | null
  context: MarkerSpreadingContext | null
  marker: MarkerRecord | null
  plannedCutGarmentQty: number
  plannedCutGarmentQtyFormula: string
  plannedSpreadLengthM: number
  plannedSpreadLengthFormula: string
} {
  const source = getSelectedCreateSource()
  if (source) {
    return {
      source,
      context: source.spreadingContext,
      marker: source.markerRecord,
      plannedCutGarmentQty: source.plannedCutGarmentQty,
      plannedCutGarmentQtyFormula: source.plannedCutGarmentQtyFormula,
      plannedSpreadLengthM: source.plannedSpreadLengthM,
      plannedSpreadLengthFormula: source.plannedSpreadLengthFormula,
    }
  }

  if (!state.createExceptionBackfill) {
    return buildEmptyCreatePreview()
  }

  const context = getExceptionCreateContext()
  const marker = buildMarkerSeedDraft(context, null)
  if (!context || !marker) {
    return buildEmptyCreatePreview()
  }
  const plannedCutGarmentQty = Math.max(Number(marker?.totalPieces || 0), 0)
  return {
    source: null,
    context,
    marker,
    plannedCutGarmentQty,
    plannedCutGarmentQtyFormula: buildTheoreticalActualCutQtyFormula(
      plannedCutGarmentQty,
      1,
      plannedCutGarmentQty,
    ),
    plannedSpreadLengthM: Number(marker?.spreadTotalLength || 0),
    plannedSpreadLengthFormula: buildSpreadingImportedLengthFormula(Number(marker?.spreadTotalLength || 0)),
  }
}

function renderReturnToSummaryButton(): string {
  if (!hasSummaryReturnContext(state.drillContext)) return ''
  return '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="return-summary">返回裁剪结果核查</button>'
}

function appendSummaryReturnAction(actions: string[]): string[] {
  const returnAction = renderReturnToSummaryButton()
  return returnAction ? [...actions, returnAction] : actions
}

function formatLength(value: number): string {
  return `${Number(value || 0).toFixed(2)} 米`
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value || 0, 0))
}

function computeSessionPlannedCutGarmentQty(
  session: Pick<SpreadingSession, 'planUnits' | 'theoreticalActualCutPieceQty' | 'plannedLayers'>,
  garmentQtyPerLayer: number,
): number {
  const planUnitTotal = (session.planUnits || []).reduce((sum, unit) => {
    const storedTotal = Math.max(Number(unit.plannedCutGarmentQty || 0), 0)
    const computedTotal = Math.max(Number(unit.plannedRepeatCount || 0), 0) * Math.max(Number(unit.garmentQtyPerUnit || 0), 0)
    return sum + (storedTotal || computedTotal)
  }, 0)
  if (planUnitTotal > 0) return Math.max(Math.round(planUnitTotal), 0)
  if (Number(session.theoreticalActualCutPieceQty || 0) > 0) return Math.max(Math.round(Number(session.theoreticalActualCutPieceQty || 0)), 0)
  return Math.max(Math.round(Number(session.plannedLayers || 0) * Math.max(garmentQtyPerLayer, 0)), 0)
}

function renderSpreadingOutputMatrix(sessionId: string): string {
  const rows = listSpreadingPieceOutputLines().filter((item) => item.spreadingSessionId === sessionId)
  const matrixTable = `
    <table class="w-full min-w-[1180px] text-sm">
      <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
        <tr>
          <th class="px-3 py-3">面料卷号</th>
          <th class="px-3 py-3">布料颜色</th>
          <th class="px-3 py-3">尺码</th>
          <th class="px-3 py-3">裁片部位</th>
          <th class="px-3 py-3">数量</th>
          <th class="px-3 py-3">裁片单</th>
          <th class="px-3 py-3">生产单</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
                    <tr class="border-b align-top">
                      <td class="px-3 py-3">${escapeHtml(row.fabricRollNo || '暂无数据')}</td>
                      <td class="px-3 py-3">${escapeHtml(row.fabricColor || '暂无数据')}</td>
                      <td class="px-3 py-3">${escapeHtml(row.sizeCode || '暂无数据')}</td>
                      <td class="px-3 py-3">${escapeHtml(row.partName || '暂无数据')}</td>
                      <td class="px-3 py-3">${escapeHtml(`${formatQty(row.bundleQty || 0)} 件`)}</td>
                      <td class="px-3 py-3">${escapeHtml(row.cutOrderNo || '暂无数据')}</td>
                      <td class="px-3 py-3">${escapeHtml(row.productionOrderNo || '暂无数据')}</td>
                    </tr>
                  `,
                )
                .join('')
            : '<tr><td colspan="7" class="px-3 py-6 text-center text-xs text-muted-foreground">暂无数据</td></tr>'
        }
      </tbody>
    </table>
  `

  return `
    <div class="mt-3 space-y-2 rounded-lg border border-dashed bg-background/60 p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-medium text-foreground">铺布产出</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(`共 ${formatQty(rows.length)} 行`)}</div>
      </div>
      ${renderStickyTableScroller(matrixTable, 'max-h-[28vh]')}
    </div>
  `
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '待录入'
  return `${Number(value).toFixed(2)} 元`
}

function formatDateText(value: string): string {
  return value || '待补'
}

function formatScheduleDateTime(value?: string): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

function renderSchedulePlanActualCell(plannedAt?: string, actualAt?: string): string {
  return `
    <div class="space-y-1 text-xs leading-5">
      <div><span class="text-muted-foreground">计划：</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(plannedAt))}</span></div>
      <div><span class="text-muted-foreground">实际：</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(actualAt))}</span></div>
    </div>
  `
}

function renderCuttingTimeCell(startedAt?: string, finishedAt?: string): string {
  return `
    <div class="space-y-1 text-xs leading-5">
      <div><span class="text-muted-foreground">开始：</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(startedAt))}</span></div>
      <div><span class="text-muted-foreground">结束：</span><span class="font-medium text-foreground">${escapeHtml(formatScheduleDateTime(finishedAt))}</span></div>
    </div>
  `
}

function findSpreadingOrderForRow(
  row: SupervisorSpreadingRow,
  projection: MarkerSpreadingProjection = buildMarkerSpreadingProjection(),
): SpreadingOrder | null {
  return projection.spreadingOrders.find((order) =>
    order.spreadingOrderId === row.spreadingSessionId ||
    order.spreadingOrderNo === row.sessionNo ||
    order.spreadingOrderId === row.session.spreadingSessionId,
  ) || null
}

function resolvePdaRuntimeEventSummary(session: SpreadingSession): {
  statusLabel: string
  statusClassName: string
  latestAt: string
  operatorName: string
  sourceLabel: string
} {
  const runtimeEventIds = [
    session.sourceWritebackId,
    ...session.rolls.map((roll) => roll.sourceWritebackId),
    ...session.operators.map((operator) => operator.sourceWritebackId),
  ].filter(Boolean)
  const pdaTimes = [
    session.updatedFromPdaAt,
    ...session.rolls.map((roll) => roll.updatedFromPdaAt),
    ...session.operators.map((operator) => operator.updatedFromPdaAt),
  ].filter(Boolean).sort((left, right) => right.localeCompare(left, 'zh-CN'))
  const operatorName =
    session.operators.find((operator) => operator.operatorName)?.operatorName ||
    session.rolls.find((roll) => roll.operatorNames?.length)?.operatorNames?.join(' / ') ||
    session.ownerName ||
    '待补'
  const hasPdaSource =
    session.sourceChannel === MOBILE_WRITEBACK_CHANNEL ||
    session.sourceChannel === 'MIXED' ||
    session.rolls.some((roll) => roll.sourceChannel === MOBILE_WRITEBACK_CHANNEL) ||
    session.operators.some((operator) => operator.sourceChannel === MOBILE_WRITEBACK_CHANNEL)
  const hasFailedRuntimeEvent = runtimeEventIds.some((id) => /fail|failed|conflict|error/i.test(id))
  if (hasFailedRuntimeEvent) {
    return {
      statusLabel: '同步失败',
      statusClassName: 'border-rose-200 bg-rose-50 text-rose-700',
      latestAt: pdaTimes[0] || session.updatedAt || '待补',
      operatorName,
      sourceLabel: 'PDA 执行事件',
    }
  }
  if (hasPdaSource || runtimeEventIds.length) {
    return {
      statusLabel: pdaTimes.length ? '已同步' : '待同步',
      statusClassName: pdaTimes.length ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700',
      latestAt: pdaTimes[0] || '待同步',
      operatorName,
      sourceLabel: 'PDA 执行事件',
    }
  }
  return {
    statusLabel: session.status === 'DRAFT' ? '无 PDA 记录' : '电脑录入',
    statusClassName: 'border-slate-200 bg-slate-50 text-slate-600',
    latestAt: session.updatedAt || '待补',
    operatorName,
    sourceLabel: getSourceChannelDisplayLabel(session.sourceChannel),
  }
}

function resolveWebSpreadingSummary(
  row: SupervisorSpreadingRow,
  projection: MarkerSpreadingProjection = buildMarkerSpreadingProjection(),
) {
  const session = row.session
  const order = findSpreadingOrderForRow(row, projection)
  const derived = resolveSpreadingDerivedState(session)
  const rollSummary = derived.rollSummary
  const varianceSummary = derived.varianceSummary
  const plannedLayerCount = Math.max(Number(order?.plannedLayerCount || session.plannedLayers || derived.markerRecord?.plannedLayerCount || 0), 0)
  const actualLayerCount = Math.max(Number(rollSummary.totalLayers || session.actualLayers || 0), 0)
  const plannedUsage =
    Math.max(Number(order?.plannedMaterialUsage || 0), 0) ||
    Math.max(Number(derived.markerRecord?.spreadTotalLength || session.theoreticalSpreadTotalLength || 0), 0) ||
    (session.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0)
  const actualUsage = Math.max(Number(rollSummary.totalActualLength || session.totalActualLength || row.spreadActualLengthM || 0), 0)
  const plannedQty = Math.max(Number(order?.plannedGarmentQty || varianceSummary?.plannedCutGarmentQty || row.plannedCutGarmentQty || 0), 0)
  const actualCutQty = Math.max(Number(varianceSummary?.actualCutGarmentQty || row.actualCutGarmentQty || session.actualCutGarmentQty || 0), 0)
  const layerDiff = actualLayerCount - plannedLayerCount
  const usageDiff = Number((actualUsage - plannedUsage).toFixed(2))
  const qtyDiff = actualCutQty - plannedQty
  const pda = resolvePdaRuntimeEventSummary(session)
  const statusKey = resolveSpreadingOrderStatusFromSession(session)
  const status = spreadingOrderStatusMeta[statusKey]
  const needsReview =
    pda.statusLabel === '同步失败' ||
    row.hasVariance ||
    Math.abs(layerDiff) > 0 ||
    Math.abs(usageDiff) > 0.01 ||
    Math.abs(qtyDiff) > 0

  return {
    order,
    statusKey,
    status,
    plannedLayerCount,
    actualLayerCount,
    plannedUsage,
    actualUsage,
    plannedQty,
    actualCutQty,
    layerDiff,
    usageDiff,
    qtyDiff,
    pda,
    needsReview,
  }
}

function formatSignedNumber(value: number, unit = ''): string {
  if (!value) return `0${unit ? ` ${unit}` : ''}`
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${new Intl.NumberFormat('zh-CN').format(value)}${unit ? ` ${unit}` : ''}`
}

function formatSignedLength(value: number): string {
  if (!value) return '0.00 米'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${Number(value).toFixed(2)} 米`
}

function renderCompactMetricLines(lines: Array<[string, string]>): string {
  return `
    <div class="space-y-1 text-xs leading-5">
      ${lines.map(([label, value]) => `
        <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2 text-left">
          <span class="text-muted-foreground">${escapeHtml(label)}</span>
          <span class="text-left font-medium text-foreground">${escapeHtml(value)}</span>
        </div>
      `).join('')}
    </div>
  `
}

function formatDateTimeLocal(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function addMinutesToDateTimeLocal(value: string, minutes: number): string {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() + minutes)
  return formatDateTimeLocal(date)
}

function getDateTimeDurationMinutes(startAt: string, endAt: string): number {
  const startTime = new Date(startAt).getTime()
  const endTime = new Date(endAt).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES
  return Math.round((endTime - startTime) / 60000)
}

function resolveCuttingTable(cuttingTableId: string) {
  return cuttingTableResources.find((table) => table.cuttingTableId === cuttingTableId) || cuttingTableResources[0]
}

function hasCuttingTableScheduleConflict(
  draft: Pick<SpreadingSession, 'spreadingSessionId' | 'cuttingTableId' | 'plannedStartAt' | 'plannedEndAt'>,
  sessions: SpreadingSession[],
): boolean {
  if (!draft.cuttingTableId || !draft.plannedStartAt || !draft.plannedEndAt) return false
  const draftStart = new Date(draft.plannedStartAt).getTime()
  const draftEnd = new Date(draft.plannedEndAt).getTime()
  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd) || draftEnd <= draftStart) return false
  return sessions.some((session) => {
    if (session.spreadingSessionId === draft.spreadingSessionId) return false
    if (session.cuttingTableId !== draft.cuttingTableId) return false
    if (!session.plannedStartAt || !session.plannedEndAt) return false
    const sessionStart = new Date(session.plannedStartAt).getTime()
    const sessionEnd = new Date(session.plannedEndAt).getTime()
    if (!Number.isFinite(sessionStart) || !Number.isFinite(sessionEnd)) return false
    return draftStart < sessionEnd && draftEnd > sessionStart
  })
}

function hasCuttingTableScheduleConflictInDrafts(
  draft: Pick<SpreadingSession, 'spreadingSessionId' | 'cuttingTableId' | 'plannedStartAt' | 'plannedEndAt'>,
  drafts: Array<Pick<SpreadingSession, 'spreadingSessionId' | 'cuttingTableId' | 'plannedStartAt' | 'plannedEndAt'>>,
): boolean {
  if (!draft.cuttingTableId || !draft.plannedStartAt || !draft.plannedEndAt) return false
  const draftStart = new Date(draft.plannedStartAt).getTime()
  const draftEnd = new Date(draft.plannedEndAt).getTime()
  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd) || draftEnd <= draftStart) return false
  return drafts.some((item) => {
    if (item.spreadingSessionId === draft.spreadingSessionId) return false
    if (item.cuttingTableId !== draft.cuttingTableId) return false
    if (!item.plannedStartAt || !item.plannedEndAt) return false
    const itemStart = new Date(item.plannedStartAt).getTime()
    const itemEnd = new Date(item.plannedEndAt).getTime()
    if (!Number.isFinite(itemStart) || !Number.isFinite(itemEnd)) return false
    return draftStart < itemEnd && draftEnd > itemStart
  })
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-4 ${className}">${escapeHtml(label)}</span>`
}

function renderSection(title: string, body: string): string {
  return `
    <section class="rounded-xl border bg-card shadow-sm">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `
}

function renderFormulaLine(formula?: string): string {
  return formula ? `<p class="mt-px font-mono text-[8px] leading-2.5 text-muted-foreground">${escapeHtml(formula)}</p>` : ''
}

function renderValueWithFormula(value: string, formula?: string, extraClass = ''): string {
  return `
    <div class="space-y-px">
      <p class="${extraClass || 'text-sm font-medium leading-4 text-foreground'}">${escapeHtml(value || '待补')}</p>
      ${renderFormulaLine(formula)}
    </div>
  `
}

function renderCompactListValueWithFormula(value: string, formula?: string): string {
  return `
    <div class="space-y-0.5">
      <p class="text-[11px] font-medium leading-3 text-foreground">${escapeHtml(value || '待补')}</p>
      ${formula ? `<p class="font-mono text-[8px] leading-2.5 text-muted-foreground">${escapeHtml(formula)}</p>` : ''}
    </div>
  `
}

function downloadCsvFile(filename: string, rows: string[][]): void {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildSumFormula(result: number, values: number[], digits = 2): string {
  const normalized = values.map((value) => Number(value || 0))
  const left = Number(result || 0).toFixed(digits)
  const right = normalized.length ? normalized.map((value) => value.toFixed(digits)).join(' + ') : '0'
  return `${left} 米 = ${right} 米`
}

function buildLayerSumFormula(result: number, values: number[]): string {
  const normalized = values.map((value) => Math.max(Math.round(Number(value || 0)), 0))
  const right = normalized.length ? normalized.map((value) => `${formatQty(value)} 层`).join(' + ') : '0 层'
  return `${formatQty(result)} 层 = ${right}`
}

function buildDifferenceFormula(result: number, minuend: number, subtrahend: number, digits = 2): string {
  return `${Number(result || 0).toFixed(digits)} 米 = ${Number(minuend || 0).toFixed(digits)} 米 - ${Number(subtrahend || 0).toFixed(digits)} 米`
}

function buildRollUsableLengthFormula(actualLength: number, headLength: number, tailLength: number, usableLength: number): string {
  return `${Number(usableLength || 0).toFixed(2)} 米 = ${Number(actualLength || 0).toFixed(2)} 米 - ${Number(headLength || 0).toFixed(2)} 米 - ${Number(tailLength || 0).toFixed(2)} 米`
}

function buildRemainingLengthFormula(labeledLength: number, actualLength: number, remainingLength: number): string {
  return `${Number(remainingLength || 0).toFixed(2)} 米 = ${Number(labeledLength || 0).toFixed(2)} 米 - ${Number(actualLength || 0).toFixed(2)} 米`
}

function buildQtySumFormula(result: number, values: number[]): string {
  const left = formatQty(result || 0)
  const right = values.length ? values.map((value) => formatQty(value || 0)).join(' + ') : '0'
  return `${left} 件 = ${right} 件`
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string; formula?: string }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value || '待补')}</p>
              ${renderFormulaLine(item.formula)}
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderStatusBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${className}">${escapeHtml(label)}</span>`
}

function renderSpreadingEditTabNav(activeTab: SpreadingEditTabKey): string {
  const tabs: Array<{ key: SpreadingEditTabKey; label: string }> = [
    { key: 'summary', label: '执行摘要' },
    { key: 'rolls', label: '卷记录' },
    { key: 'operators', label: '换班与人员' },
    { key: 'variance', label: '差异与补料' },
  ]

  return `
    <section class="rounded-lg border bg-card p-2 shadow-sm" data-cutting-spreading-edit-tab-shell>
      <div class="flex flex-wrap gap-2">
        ${tabs
          .map(
            (tab) => `
              <button
                type="button"
                class="inline-flex items-center rounded-md px-3 py-3 text-sm font-medium ${
                  activeTab === tab.key ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border hover:bg-muted'
                }"
                data-cutting-marker-action="switch-spreading-edit-tab"
                data-edit-tab="${tab.key}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function buildSpreadingPlanUnitLabel(planUnit: SpreadingPlanUnit): string {
  return buildSpreadingPlanUnitProjectionLabel(planUnit)
}

function renderTextInput(label: string, value: string, attrs: string, placeholder = '请输入'): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `
}

function renderReadonlyField(label: string, value: string, options?: { formula?: string; attrs?: string }): string {
  return `
    <div class="space-y-2" ${options?.attrs || ''}>
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <div class="min-h-10 rounded-md border bg-muted/10 px-3 py-3">
        ${renderValueWithFormula(value, options?.formula)}
      </div>
    </div>
  `
}

function renderNumberInput(label: string, value: number | string, attrs: string, step = '0.01'): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="number"
        value="${escapeHtml(String(value ?? ''))}"
        step="${escapeHtml(step)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `
}

function renderTextarea(label: string, value: string, attrs: string, rows = 3): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <textarea
        rows="${rows}"
        class="w-full rounded-md border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      >${escapeHtml(value)}</textarea>
    </label>
  `
}

function renderSelect(
  label: string,
  value: string,
  attrs: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" ${attrs}>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function renderListTextInput(label: string, value: string, attrs: string, placeholder = '请输入'): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <input
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        ${attrs}
      />
    </label>
  `
}

function renderListSelect(
  label: string,
  value: string,
  attrs: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" ${attrs}>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function cloneMarkerRecord(record: MarkerRecord): MarkerRecord {
  return JSON.parse(JSON['stringify'](record)) as MarkerRecord
}

function cloneSpreadingSession(session: SpreadingSession): SpreadingSession {
  return JSON.parse(JSON['stringify'](session)) as SpreadingSession
}

function createEmptyMarkerSizeValueMap(): HighLowCuttingRow['sizeValues'] {
  return Object.fromEntries(MARKER_SIZE_KEYS.map((sizeKey) => [sizeKey, 0])) as HighLowCuttingRow['sizeValues']
}

function createEmptyPatternValues(patternKeys: string[]): Record<string, number> {
  return Object.fromEntries(patternKeys.map((patternKey) => [patternKey, 0]))
}

function createEmptyHighLowCuttingRow(markerId: string, index: number): HighLowCuttingRow {
  return {
    rowId: `high-low-cutting-${Date.now()}-${index}`,
    markerId,
    color: '',
    sizeValues: createEmptyMarkerSizeValueMap(),
    total: 0,
  }
}

function createEmptyHighLowPatternRow(markerId: string, index: number, patternKeys: string[]): HighLowPatternRow {
  return {
    rowId: `high-low-pattern-${Date.now()}-${index}`,
    markerId,
    color: '',
    patternValues: createEmptyPatternValues(patternKeys),
    total: 0,
  }
}

function formatSizeBalance(requiredQty: number, allocatedQty: number): string {
  const difference = allocatedQty - requiredQty
  if (difference === 0) return '已配平'
  return difference > 0 ? `多分配 ${formatQty(difference)}` : `少分配 ${formatQty(Math.abs(difference))}`
}

function getMarkerMappingStatusTag(status: string): string {
  if (status === 'MATCHED') return renderTag('已匹配', 'bg-emerald-100 text-emerald-700')
  if (status === 'MATERIAL_PENDING_CONFIRM') return renderTag('面料待确认', 'bg-amber-100 text-amber-700')
  if (status === 'MISSING_TECH_PACK') return renderTag('未关联技术包', 'bg-rose-100 text-rose-700')
  if (status === 'MISSING_SKU') return renderTag('未匹配 SKU', 'bg-rose-100 text-rose-700')
  if (status === 'MISSING_COLOR_MAPPING') return renderTag('未匹配颜色映射', 'bg-rose-100 text-rose-700')
  if (status === 'MISSING_PIECE_MAPPING') return renderTag('未匹配裁片映射', 'bg-rose-100 text-rose-700')
  return renderTag('待确认', 'bg-slate-100 text-slate-700')
}

function createMarkerAllocationLineFromSource(
  marker: MarkerRecord,
  sourceRow: MarkerAllocationSourceRow | null,
  index: number,
): MarkerAllocationLine {
  return {
    allocationId: `marker-allocation-${Date.now()}-${index}`,
    markerId: marker.markerId,
    sourceCutOrderId: sourceRow?.sourceCutOrderId || '',
    sourceCutOrderNo: sourceRow?.sourceCutOrderNo || '',
    sourceProductionOrderId: sourceRow?.sourceProductionOrderId || '',
    sourceProductionOrderNo: sourceRow?.sourceProductionOrderNo || '',
    styleCode: sourceRow?.styleCode || marker.styleCode || '',
    spuCode: sourceRow?.spuCode || marker.spuCode || '',
    techPackSpuCode: sourceRow?.techPackSpuCode || marker.techPackSpuCode || '',
    color: sourceRow?.color || '',
    materialSku: sourceRow?.materialSku || '',
    sizeLabel: '',
    plannedGarmentQty: 0,
    note: '',
  }
}

function getMarkerDraftSourceRows(draft: MarkerRecord): MarkerAllocationSourceRow[] {
  const data = readMarkerSpreadingPrototypeData()
  return buildMarkerAllocationSourceRows(draft, data.rowsById).map((row) => ({
    sourceCutOrderId: row.cutOrderId,
    sourceCutOrderNo: row.cutOrderNo,
    sourceProductionOrderId: row.productionOrderId,
    sourceProductionOrderNo: row.productionOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpuCode || '',
    color: row.color,
    materialSku: row.materialSkuSummary,
    allocationSummaryText: '',
    allocationTotalQty: 0,
  }))
}

function applyAllocationSourceRowToLine(
  allocationLine: MarkerAllocationLine,
  sourceRow: MarkerAllocationSourceRow | null,
  draft: MarkerRecord,
): MarkerAllocationLine {
  return {
    ...allocationLine,
    markerId: draft.markerId,
    sourceCutOrderId: sourceRow?.sourceCutOrderId || '',
    sourceCutOrderNo: sourceRow?.sourceCutOrderNo || '',
    sourceProductionOrderId: sourceRow?.sourceProductionOrderId || '',
    sourceProductionOrderNo: sourceRow?.sourceProductionOrderNo || '',
    styleCode: sourceRow?.styleCode || draft.styleCode || '',
    spuCode: sourceRow?.spuCode || draft.spuCode || '',
    techPackSpuCode: sourceRow?.techPackSpuCode || draft.techPackSpuCode || '',
    color: sourceRow?.color || '',
    materialSku: sourceRow?.materialSku || '',
  }
}

function buildMarkerDraftPieceExplosion(draft: MarkerRecord) {
  const data = readMarkerSpreadingPrototypeData()
  const sourceRows = buildMarkerAllocationSourceRows(draft, data.rowsById)
  return buildMarkerPieceExplosionViewModel({
    marker: draft,
    sourceRows,
  })
}

function renderMarkerSourceRowsTable(rows: MarkerAllocationSourceRow[]): string {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前上下文未识别到关联裁片单。</div>'
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">来源裁片单号</th>
            <th class="px-3 py-3">来源生产单号</th>
            <th class="px-3 py-3">款号 / SPU</th>
            <th class="px-3 py-3">技术包 SPU</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">面料</th>
            <th class="px-3 py-3">当前分配摘要</th>
            <th class="px-3 py-3">分配合计成衣件数（件）</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sourceProductionOrderNo || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(`${row.styleCode || '待补'} / ${row.spuCode || '待补'}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.techPackSpuCode || '未关联')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
                    materialSku: row.materialSku || '待补',
                    materialLabel: row.materialSku || '待补',
                    materialAlias: row.materialAlias,
                    materialImageUrl: row.materialImageUrl,
                  }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(row.allocationSummaryText || '待补分配')}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.allocationTotalQty))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderMarkerAllocationTable(rows: MarkerExplosionAllocationRow[]): string {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前还没有唛架分配明细。</div>'
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">来源裁片单号</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">尺码</th>
            <th class="px-3 py-3">面料</th>
            <th class="px-3 py-3">plannedGarmentQty</th>
            <th class="px-3 py-3">技术包</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">映射状态</th>
            <th class="px-3 py-3">异常</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
                    materialSku: row.materialSku || '待补',
                    materialLabel: row.materialSku || '待补',
                    materialAlias: row.materialAlias,
                    materialImageUrl: row.materialImageUrl,
                  }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(row.techPackSpuCode || '未关联')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.exceptionText || '—')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderMarkerSkuSummaryTable(rows: MarkerExplosionSkuSummaryRow[]): string {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前还没有可展示的 SKU 拆解结果。</div>'
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">来源裁片单号</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">尺码</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">计划成衣数</th>
            <th class="px-3 py-3">拆解总裁片数</th>
            <th class="px-3 py-3">涉及部位数</th>
            <th class="px-3 py-3">映射状态</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.explodedPieceTotal))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.involvedPartCount))}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderMarkerPieceDetailTable(rows: MarkerExplosionPieceDetailRow[]): string {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前还没有可展示的部位裁片拆解明细。</div>'
  }
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">来源裁片单号</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">尺码</th>
            <th class="px-3 py-3">SKU</th>
            <th class="px-3 py-3">面料</th>
            <th class="px-3 py-3">纸样</th>
            <th class="px-3 py-3">部位</th>
            <th class="px-3 py-3">单件片数</th>
            <th class="px-3 py-3">计划成衣数</th>
            <th class="px-3 py-3">拆解裁片数</th>
            <th class="px-3 py-3">映射状态</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-3">${renderMaterialIdentityBlock({
                    materialSku: row.materialSku || '待补',
                    materialLabel: row.materialSku || '待补',
                    materialAlias: row.materialAlias,
                    materialImageUrl: row.materialImageUrl,
                  }, { compact: true })}</td>
                  <td class="px-3 py-3">${escapeHtml(row.patternName || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(row.pieceName || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.pieceCountPerUnit))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(row.explodedPieceQty))}</td>
                  <td class="px-3 py-3">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function ensureMarkerDraftShape(draft: MarkerRecord): MarkerRecord {
  draft.cutOrderNos = draft.cutOrderNos || []
  draft.techPackSpuCode = draft.techPackSpuCode || ''
  draft.allocationLines = draft.allocationLines || []
  const templateType = deriveMarkerTemplateByMode(draft.markerMode)

  if (templateType === 'row-template') {
    if (!(draft.lineItems || []).length) {
      draft.lineItems = [createEmptyMarkerLineItem(0)]
    }
    return draft
  }

  draft.highLowPatternKeys = draft.highLowPatternKeys?.length ? draft.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  if (!(draft.highLowCuttingRows || []).length) {
    draft.highLowCuttingRows = [createEmptyHighLowCuttingRow(draft.markerId, 0)]
  }
  if (!(draft.highLowPatternRows || []).length) {
    draft.highLowPatternRows = [createEmptyHighLowPatternRow(draft.markerId, 0, draft.highLowPatternKeys)]
  }
  return draft
}

function createEmptyMarkerLineItem(index: number): MarkerLineItem {
  return {
    lineItemId: `marker-line-${Date.now()}-${index}`,
    markerId: '',
    lineNo: index + 1,
    layoutCode: `A-${index + 1}`,
    layoutDetailText: '',
    color: '',
    ratioLabel: '',
    spreadRepeatCount: 1,
    markerLength: 0,
    markerPieceCount: 0,
    pieceCount: 0,
    singlePieceUsage: 0,
    spreadTotalLength: 0,
    spreadingTotalLength: 0,
    widthHint: '',
    note: '',
  }
}

function createFallbackMarkerDraft(): MarkerRecord {
  return ensureMarkerDraftShape({
    markerId: `marker-${Date.now()}`,
    markerNo: `MKP-${String(Date.now()).slice(-6)}`,
    contextType: 'cut-order',
    cutOrderIds: [],
    markerPlanId: '',
    markerPlanNo: '',
    styleCode: '',
    spuCode: '',
    techPackSpuCode: '',
    materialSkuSummary: '',
    colorSummary: '',
    markerMode: 'normal',
    sizeDistribution: [
      { sizeLabel: 'S', quantity: 0 },
      { sizeLabel: 'M', quantity: 0 },
      { sizeLabel: 'L', quantity: 0 },
      { sizeLabel: 'XL', quantity: 0 },
      { sizeLabel: '2XL', quantity: 0 },
      { sizeLabel: '3XL', quantity: 0 },
      { sizeLabel: '4XL', quantity: 0 },
      { sizeLabel: 'onesize', quantity: 0 },
      { sizeLabel: 'plusonesize', quantity: 0 },
    ],
    totalPieces: 0,
    netLength: 0,
    singlePieceUsage: 0,
    spreadTotalLength: 0,
    materialCategory: '',
    materialAttr: '',
    sizeRatioPlanText: '',
    plannedLayerCount: 0,
    plannedMarkerCount: 0,
    markerLength: 0,
    procurementUnitUsage: 0,
    actualUnitUsage: 0,
    fabricSku: '',
    plannedMaterialMeter: 0,
    actualMaterialMeter: 0,
    actualCutQty: 0,
    allocationLines: [],
    lineItems: [createEmptyMarkerLineItem(0)],
    highLowPatternKeys: [...DEFAULT_HIGH_LOW_PATTERN_KEYS],
    highLowCuttingRows: [],
    highLowPatternRows: [],
    warningMessages: [],
    markerImageUrl: '',
    markerImageName: '',
    adjustmentRequired: false,
    adjustmentNote: '',
    replacementDraftFlag: false,
    note: '',
    updatedAt: '',
  })
}

function buildNewMarkerDraft(): MarkerRecord {
  const data = readMarkerSpreadingPrototypeData()
  const context = getDefaultMarkerSpreadingContext(data.rows, data.markerPlanSources, state.prefilter)
  const seeded = context ? buildMarkerSeedDraft(context, null) : null
  const draft = seeded ? cloneMarkerRecord(seeded) : createFallbackMarkerDraft()
  draft.markerId = `marker-${Date.now()}`
  draft.markerNo = draft.markerNo || `MKP-${String(data.store.markers.length + 1).padStart(4, '0')}`
  draft.updatedAt = ''
  draft.markerImageUrl = ''
  draft.adjustmentRequired = Boolean(draft.adjustmentRequired)
  draft.adjustmentNote = draft.adjustmentNote || ''
  draft.replacementDraftFlag = Boolean(draft.replacementDraftFlag)
  return ensureMarkerDraftShape(draft)
}

function buildContextPayloadFromMarker(record: MarkerRecord): Record<string, string | undefined> {
  const row = getMarkerRow(record.markerId)
  return row ? buildMarkerNavigationPayload(row) : { markerId: record.markerId }
}

function buildImportContextFromMarker(record: MarkerRecord): MarkerSpreadingContext | null {
  const data = readMarkerSpreadingPrototypeData()
  const cutOrderRows = record.cutOrderIds
    .map((id) => data.rowsById[id])
    .filter((row): row is (typeof data.rows)[number] => Boolean(row))

  if (!cutOrderRows.length && !record.markerPlanId && !record.markerPlanNo) return null

  return {
    contextType: record.contextType,
    cutOrderIds: [...record.cutOrderIds],
    cutOrderNos:
      (record.cutOrderNos && record.cutOrderNos.length
        ? [...record.cutOrderNos]
        : cutOrderRows.map((row) => row.cutOrderNo)) || [],
    markerPlanId: record.markerPlanId || '',
    markerPlanNo: record.markerPlanNo || '',
    productionOrderNos: Array.from(new Set(cutOrderRows.map((row) => row.productionOrderNo))),
    styleCode: record.styleCode || cutOrderRows[0]?.styleCode || '',
    spuCode: record.spuCode || cutOrderRows[0]?.spuCode || '',
    techPackSpuCode:
      (Array.from(new Set(cutOrderRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1
        ? Array.from(new Set(cutOrderRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0]
        : '') || record.techPackSpuCode || '',
    styleName: cutOrderRows[0]?.styleName || '',
    materialSkuSummary: record.materialSkuSummary || cutOrderRows[0]?.materialSkuSummary || '',
    materialPrepRows: cutOrderRows,
  }
}

function resolveSeededMarkerForContext(
  context: MarkerSpreadingContext | null,
  markers: MarkerRecord[],
): MarkerRecord | null {
  if (!context) return null

  return (
    markers.find((item) => {
      if (context.contextType === 'marker-plan' && context.markerPlanId) {
        return item.contextType === 'marker-plan' && item.markerPlanId === context.markerPlanId
      }
      if (!context.cutOrderIds.length) return false
      return context.cutOrderIds.some((id) => item.cutOrderIds.includes(id))
    }) || null
  )
}

function buildCreatePayloadFromContext(
  context: MarkerSpreadingContext | null,
  marker: MarkerRecord | null,
): Record<string, string | undefined> {
  return {
    markerId: marker?.markerId,
    markerNo: marker?.markerNo,
    cutOrderId:
      context?.contextType === 'cut-order'
        ? context.cutOrderIds[0] || undefined
        : state.prefilter?.cutOrderId,
    cutOrderNo:
      context?.contextType === 'cut-order'
        ? context.cutOrderNos[0] || undefined
        : state.prefilter?.cutOrderNo,
    markerPlanId:
      context?.contextType === 'marker-plan' ? context.markerPlanId || undefined : state.prefilter?.markerPlanId,
    markerPlanNo:
      context?.contextType === 'marker-plan' ? context.markerPlanNo || undefined : state.prefilter?.markerPlanNo,
    productionOrderNo: context?.productionOrderNos[0] || state.prefilter?.productionOrderNo,
    styleCode: marker?.styleCode || context?.styleCode || state.prefilter?.styleCode || undefined,
    materialSku: marker?.materialSkuSummary?.split(' / ')[0] || context?.materialSkuSummary || state.prefilter?.materialSku || undefined,
  }
}

function nextSpreadingDraftIdentity(): { spreadingSessionId: string; sessionNo: string } {
  const now = Date.now()
  return {
    spreadingSessionId: `spreading-${now}`,
    sessionNo: `PB-${String(now).slice(-6)}`,
  }
}

function createImportedSpreadingDraft(
  marker: MarkerRecord,
  options?: {
    baseSession?: SpreadingSession | null
    reimported?: boolean
    importNote?: string
  },
): SpreadingSession | null {
  const context = buildImportContextFromMarker(marker)
  if (!context) return null

  const draft = cloneSpreadingSession(
    createSpreadingDraftFromMarker(marker, context, new Date(), {
      baseSession: options?.baseSession || null,
      reimported: options?.reimported,
      importNote: options?.importNote,
    }),
  )

  if (!options?.baseSession) {
    const identity = nextSpreadingDraftIdentity()
    draft.spreadingSessionId = identity.spreadingSessionId
    draft.sessionNo = identity.sessionNo
  }

  return draft
}

function buildNewSpreadingDraft(): SpreadingSession {
  const data = readMarkerSpreadingPrototypeData()
  const params = getSearchParams()
  const markerId = params.get('markerId')
  const exceptionEntry = params.get('exceptionEntry') === '1'
  const existingMarker = markerId ? data.store.markers.find((item) => item.markerId === markerId) || null : null
  const context = exceptionEntry ? getDefaultMarkerSpreadingContext(data.rows, data.markerPlanSources, state.prefilter) : null
  const seededMarker = existingMarker || (exceptionEntry ? buildMarkerSeedDraft(context, null) : null)

  if (!seededMarker) {
    return {
      spreadingSessionId: `spreading-${Date.now()}`,
      sessionNo: `PB-${String(Date.now()).slice(-6)}`,
      contextType: context?.contextType || 'cut-order',
      cutOrderIds: context?.cutOrderIds ? [...context.cutOrderIds] : [],
      markerPlanId: context?.markerPlanId || '',
      markerPlanNo: context?.markerPlanNo || '',
      markerId: '',
      markerNo: '',
      styleCode: context?.styleCode || '',
      spuCode: context?.spuCode || '',
      materialSkuSummary: context?.materialSkuSummary || '',
      colorSummary: '',
      spreadingMode: 'normal',
      status: 'DRAFT',
      importedFromMarker: false,
      plannedLayers: 0,
      actualLayers: 0,
      totalActualLength: 0,
      totalHeadLength: 0,
      totalTailLength: 0,
      totalCalculatedUsableLength: 0,
      totalRemainingLength: 0,
      operatorCount: 0,
      rollCount: 0,
      configuredLengthTotal: 0,
      claimedLengthTotal: 0,
      varianceLength: 0,
      varianceNote: '',
      actualCutPieceQty: 0,
      unitPrice: 0,
      totalAmount: 0,
      note: '新建铺布需从唛架编号进入。',
      createdAt: '',
      updatedAt: '',
      warningMessages:
        ['正常新建铺布需先关联唛架编号。'],
      sourceChannel: 'MANUAL',
      sourceWritebackId: '',
      updatedFromPdaAt: '',
      rolls: [],
      operators: [],
    }
  }

  const draft = createImportedSpreadingDraft(seededMarker) || {
    spreadingSessionId: `spreading-${Date.now()}`,
    sessionNo: `PB-${String(data.store.sessions.length + 1).padStart(4, '0')}`,
    contextType: context.contextType,
    cutOrderIds: [...context.cutOrderIds],
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    markerId: seededMarker.markerId,
    markerNo: seededMarker.markerNo || '',
    styleCode: seededMarker.styleCode || '',
    spuCode: seededMarker.spuCode || '',
    materialSkuSummary: seededMarker.materialSkuSummary || '',
    colorSummary: seededMarker.colorSummary || '',
    spreadingMode: seededMarker.markerMode,
    status: 'DRAFT',
    importedFromMarker: false,
    plannedLayers: 0,
    actualLayers: 0,
    totalActualLength: 0,
    totalHeadLength: 0,
    totalTailLength: 0,
    totalCalculatedUsableLength: 0,
    totalRemainingLength: 0,
    operatorCount: 0,
    rollCount: 0,
    configuredLengthTotal: 0,
    claimedLengthTotal: 0,
    varianceLength: 0,
    varianceNote: '',
    actualCutPieceQty: 0,
    unitPrice: 0,
    totalAmount: 0,
    note: '',
    createdAt: '',
    updatedAt: '',
    warningMessages: [],
    importSource: null,
    planLineItems: [],
    highLowPlanSnapshot: null,
    theoreticalSpreadTotalLength: 0,
    theoreticalActualCutPieceQty: 0,
    importAdjustmentRequired: false,
    importAdjustmentNote: '',
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
    rolls: [],
    operators: [],
  }
  draft.status = 'DRAFT'
  draft.markerId = seededMarker.markerId
  draft.markerNo = seededMarker.markerNo || ''
  return draft
}

function buildContextPayloadFromSession(session: SpreadingSession): Record<string, string | undefined> {
  const data = readMarkerSpreadingPrototypeData()
  const primaryRow = session.cutOrderIds[0] ? data.rowsById[session.cutOrderIds[0]] : null
  return {
    spreadingSessionId: session.spreadingSessionId,
    spreadingSessionNo: session.sessionNo || session.spreadingSessionId,
    sessionId: session.spreadingSessionId,
    markerId: session.markerId || undefined,
    markerNo: session.markerNo || undefined,
    cutOrderId: session.contextType === 'cut-order' ? session.cutOrderIds[0] : undefined,
    cutOrderNo: session.contextType === 'cut-order' ? primaryRow?.cutOrderNo : undefined,
    markerPlanId: session.contextType === 'marker-plan' ? session.markerPlanId || undefined : undefined,
    markerPlanNo: session.contextType === 'marker-plan' ? session.markerPlanNo || undefined : undefined,
    styleCode: session.styleCode || primaryRow?.styleCode || undefined,
    materialSku: session.materialSkuSummary?.split(' / ')[0] || primaryRow?.materialSkuSummary || undefined,
  }
}

function buildCreatePayloadFromSession(session: SpreadingSession): Record<string, string | undefined> {
  const payload = buildContextPayloadFromSession(session)
  return {
    markerId: payload.markerId,
    cutOrderId: payload.cutOrderId,
    cutOrderNo: payload.cutOrderNo,
    markerPlanId: payload.markerPlanId,
    markerPlanNo: payload.markerPlanNo,
    productionOrderNo: session.cutOrderIds[0]
      ? readMarkerSpreadingPrototypeData().rowsById[session.cutOrderIds[0]]?.productionOrderNo || undefined
      : undefined,
    styleCode: payload.styleCode,
    materialSku: payload.materialSku,
    tab: 'spreadings',
  }
}

function getLinkedMarkerForSession(session: SpreadingSession): MarkerRecord | null {
  if (!session.markerId) return null
  return readMarkerSpreadingPrototypeData().store.markers.find((item) => item.markerId === session.markerId) || null
}

function resolveSpreadingDerivedState(session: SpreadingSession): {
  markerRecord: MarkerRecord | null
  markerTotalPieces: number
  rollSummary: ReturnType<typeof summarizeSpreadingRolls>
  varianceSummary: ReturnType<typeof buildSpreadingVarianceSummary>
  warningMessages: string[]
} {
  const data = readMarkerSpreadingPrototypeData()
  const markerRecord = getLinkedMarkerForSession(session)
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  const context = primaryRows.length
    ? {
        contextType: session.contextType,
        cutOrderIds: [...session.cutOrderIds],
        cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
        markerPlanId: session.markerPlanId,
        markerPlanNo: session.markerPlanNo,
        productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
        styleCode: session.styleCode || primaryRows[0].styleCode,
        spuCode: session.spuCode || primaryRows[0].spuCode,
        styleName: primaryRows[0].styleName,
        materialSkuSummary: session.materialSkuSummary || primaryRows[0].materialSkuSummary,
        materialPrepRows: primaryRows,
      }
    : null
  const rollSummary = summarizeSpreadingRolls(session.rolls)
  const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session)
  const markerTotalPieces = deriveSpreadingSessionGarmentQtyPerLayer(session, markerRecord)
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
  })

  return {
    markerRecord,
    markerTotalPieces,
    rollSummary,
    varianceSummary,
    warningMessages,
  }
}

function persistMarkerSpreadingStore(store: ReturnType<typeof readMarkerSpreadingPrototypeData>['store']): void {
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(store))
}

function parsePrefilterFromPath(): MarkerSpreadingPrefilter | null {
  const params = getSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: MarkerSpreadingPrefilter = {
    cutOrderId: drillContext?.cutOrderId || params.get('cutOrderId') || undefined,
    cutOrderNo: drillContext?.cutOrderNo || params.get('cutOrderNo') || undefined,
    markerPlanId: drillContext?.markerPlanId || params.get('markerPlanId') || undefined,
    markerPlanNo: drillContext?.markerPlanNo || params.get('markerPlanNo') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    styleCode: drillContext?.styleCode || params.get('styleCode') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
  }
  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function parseListTabFromPath(): ListTabKey {
  return 'ALL'
}

function parseEditTabFromPath(): SpreadingEditTabKey {
  const tab = getSearchParams().get('tab')
  if (tab === 'rolls' || tab === 'operators' || tab === 'variance') return tab
  return 'summary'
}

function syncStateFromPath(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return

  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getSearchParams())
  state.prefilter = parsePrefilterFromPath()
  state.activeTab = parseListTabFromPath()
  state.keyword = ''
  state.contextNoFilter = ''
  state.sessionNoFilter = ''
  state.cutOrderFilter = ''
  state.markerPlanSourceFilter = ''
  state.markerNoFilter = ''
  state.productionOrderFilter = ''
  state.styleSpuFilter = ''
  state.materialSkuFilter = ''
  state.colorFilter = ''
  state.contextTypeFilter = 'ALL'
  state.spreadingModeFilter = 'ALL'
  state.spreadingStageFilter = 'ALL'
  state.sourceChannelFilter = 'ALL'
  state.spreadingCompletionSelection = []
  state.feedback = null
  state.importDecision = null
  state.spreadingEditTab = parseEditTabFromPath()

  const currentPath = getCurrentPathname()
  const data = readMarkerSpreadingPrototypeData()

  if (currentPath === getCanonicalCuttingPath('spreading-edit') || currentPath === getCanonicalCuttingPath('spreading-create')) {
    if (currentPath === getCanonicalCuttingPath('spreading-create')) {
      const previousSelectedCreateMarkerId = state.selectedCreateMarkerId
      const previousCreateAssignments = { ...state.createAssignments }
      const previousCreateScheduleMode = state.createScheduleMode
      const previousCreateOwnerAccountId = state.createOwnerAccountId
      const previousCreateCuttingTableId = state.createCuttingTableId
      const previousCreatePlannedStartAt = state.createPlannedStartAt
      const previousCreateNote = state.createNote
      const step = getSearchParams().get('step')
      state.createStep = step === 'confirm' ? 'CONFIRM_CREATE' : 'SELECT_MARKER'
      state.selectedCreateMarkerId = getSearchParams().get('bedId') || getSearchParams().get('markerId') || ''
      state.selectedCreateSourceSnapshot = null
      state.createStep = state.selectedCreateMarkerId ? state.createStep : 'SELECT_MARKER'
      state.createExceptionBackfill = false
      state.createExceptionReason = ''
      const shouldPreserveCreateState = Boolean(previousSelectedCreateMarkerId && previousSelectedCreateMarkerId === state.selectedCreateMarkerId)
      state.createOwnerAccountId = shouldPreserveCreateState ? previousCreateOwnerAccountId : ''
      state.createCuttingTableId = shouldPreserveCreateState ? previousCreateCuttingTableId : ''
      state.createScheduleMode = shouldPreserveCreateState ? previousCreateScheduleMode : 'WHOLE_PLAN_ONE_TABLE'
      state.createPlannedStartAt = shouldPreserveCreateState ? previousCreatePlannedStartAt : ''
      state.createNote = shouldPreserveCreateState ? previousCreateNote : ''
      state.createAssignments = shouldPreserveCreateState ? previousCreateAssignments : {}
      state.spreadingDraft = null
      state.spreadingCompletionSelection = []
      state.markerDraft = null
      return
    }

    const sessionId = getSearchParams().get('sessionId')
    const existing = sessionId ? data.store.sessions.find((item) => item.spreadingSessionId === sessionId) || null : null
    state.spreadingDraft = existing ? cloneSpreadingSession(existing) : buildNewSpreadingDraft()
    state.spreadingCompletionSelection =
      state.spreadingDraft.contextType === 'marker-plan'
        ? [...(state.spreadingDraft.completionLinkage?.linkedCutOrderIds || [])]
        : [...state.spreadingDraft.cutOrderIds]
    state.markerDraft = null
    return
  }

  state.spreadingDraft = null
  state.createStep = 'SELECT_MARKER'
  state.selectedCreateMarkerId = ''
  state.createExceptionBackfill = false
  state.createExceptionReason = ''
  state.createOwnerAccountId = ''
  state.createCuttingTableId = ''
  state.createScheduleMode = 'WHOLE_PLAN_ONE_TABLE'
  state.createPlannedStartAt = ''
  state.createNote = ''
  state.createAssignments = {}
  state.spreadingEditTab = 'summary'
}

function matchesKeyword(keyword: string, values: string[]): boolean {
  if (!keyword.trim()) return true
  const normalized = keyword.trim().toLowerCase()
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function matchesIncludesFilter(filterValue: string, candidates: Array<string | undefined>): boolean {
  if (!filterValue.trim()) return true
  const normalized = filterValue.trim().toLowerCase()
  return candidates.some((value) => String(value || '').toLowerCase().includes(normalized))
}

function renderStartSpreadingControls(sessionId: string, selectedTableId = '', selectedOwnerId = ''): string {
  return `
    <div class="inline-flex flex-wrap items-center gap-1" data-spreading-start-controls="true">
      <select class="h-8 min-w-28 rounded-md border bg-background px-2 text-xs" data-cutting-spreading-start-field="cuttingTableId" data-session-id="${escapeHtml(sessionId)}">
        <option value="">选择裁床</option>
        ${cuttingTableResources.map((item) => `<option value="${escapeHtml(item.cuttingTableId)}" ${item.cuttingTableId === selectedTableId ? 'selected' : ''}>${escapeHtml(item.cuttingTableName)}</option>`).join('')}
      </select>
      <select class="h-8 min-w-28 rounded-md border bg-background px-2 text-xs" data-cutting-spreading-start-field="ownerAccountId" data-session-id="${escapeHtml(sessionId)}">
        <option value="">选择负责人</option>
        ${SPREADING_CREATE_OWNER_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === selectedOwnerId ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
      </select>
      <button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium leading-5 text-white hover:bg-blue-700" data-cutting-marker-action="start-spreading-session" data-session-id="${escapeHtml(sessionId)}">开始铺布</button>
      <span class="hidden text-xs text-amber-700" data-spreading-start-feedback></span>
    </div>
  `
}

function renderSpreadingListPrimaryAction(row: SupervisorSpreadingRow): string {
  const stageKey = row.mainStageKey
  const sessionId = row.spreadingSessionId
  if (stageKey === 'WAITING_START') {
    return renderStartSpreadingControls(sessionId, row.session.cuttingTableId, row.session.ownerAccountId)
  }
  if (stageKey === 'IN_PROGRESS') {
    return `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium leading-5 text-white hover:bg-blue-700" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(sessionId)}">继续铺布</button>`
  }
  return ''
}

function buildSpreadingMainStageFormula(label: string): string {
  return `铺布状态 = ${label}`
}

function buildSupervisorSpreadingRows(baseRows: SpreadingListRow[]): SupervisorSpreadingRow[] {
  return baseRows.map((row) => {
    const dataSourceLabel: SupervisorSpreadingRow['dataSourceLabel'] =
      isMobileWritebackSource(row.session.sourceChannel, row.session.sourceWritebackId) ? MOBILE_SOURCE_CHANNEL : 'PC'
    const mainStageMeta = deriveSpreadingListStatus(row.statusKey)
    const cuttingStatusMeta =
      mainStageMeta.key === 'DONE'
        ? deriveSpreadingCuttingStatus(row.session.cuttingStatus || 'WAITING_CUTTING')
        : null
    const shortageGarmentQty = row.replenishmentWarning?.shortageQty || 0

    return {
      ...row,
      sourceMarkerLabel: row.session.markerNo || '待关联唛架编号',
      contextSummary:
        row.contextType === 'marker-plan'
          ? `唛架方案 ${row.markerPlanNo || '待补'} / 裁片单 ${formatQty(row.cutOrderCount)} 张`
          : `裁片单 ${row.cutOrderNos.join(' / ') || '待补'} / 生产单 ${row.productionOrderNos.join(' / ') || '待补'}`,
      productionOrderCount: row.productionOrderNos.length,
      plannedCutGarmentQtyFormula:
        row.replenishmentWarning?.plannedCutGarmentQtyFormula ||
        `${formatQty(row.plannedCutGarmentQty)} 件 = Σ（计划层数 × 单层成衣件数）`,
      actualCutGarmentQtyFormula:
        row.replenishmentWarning?.actualCutGarmentQtyFormula ||
        buildQtySumFormula(
          row.actualCutGarmentQty,
          row.session.rolls.map((roll) => (roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0),
        ),
      shortageGarmentQty,
      shortageGarmentQtyFormula:
        row.replenishmentWarning?.shortageGarmentQtyFormula ||
        buildShortageQtyFormula(shortageGarmentQty, row.plannedCutGarmentQty, row.actualCutGarmentQty),
      spreadActualLengthFormula: buildSumFormula(row.spreadActualLengthM, row.session.rolls.map((roll) => roll.actualLength || 0), 2),
      dataSourceLabel,
      mainStageKey: mainStageMeta.key,
      mainStageLabel: mainStageMeta.label,
      mainStageClassName: mainStageMeta.className,
      mainStageFormula: buildSpreadingMainStageFormula(mainStageMeta.label),
      cuttingStatusKey: cuttingStatusMeta?.key || '',
      cuttingStatusLabel: cuttingStatusMeta?.label || '-',
      cuttingStatusClassName: cuttingStatusMeta?.className || 'bg-slate-100 text-slate-500 border border-slate-200',
      cuttingStatusFormula: cuttingStatusMeta ? `裁剪状态 = ${cuttingStatusMeta.label}` : '-',
    }
  })
}

function getPageData() {
  syncStateFromPath()
  const projection = buildMarkerSpreadingProjection({
    prefilter: state.prefilter,
    includeCreateSources: false,
    includeViewModel: false,
  })
  const store = buildMarkerSpreadingPrototypeStore({
    rows: projection.rows,
    markerPlanSources: projection.markerPlanSources,
    stored: projection.store,
  })
  const viewModel = buildMarkerSpreadingViewModel({
    rows: projection.rows,
    markerPlanSources: projection.markerPlanSources,
    store,
    prefilter: state.prefilter,
  })
  const baseRows = buildSpreadingListViewModel({
    spreadingSessions: viewModel.spreadingSessions,
    rowsById: projection.rowsById,
    markerPlanSources: projection.markerPlanSources,
    markerRecords: store.markers,
  })
  const supervisorRows = buildSupervisorSpreadingRows(baseRows)
  const nonStageFilteredRows = supervisorRows.filter((row) => {
    if (state.prefilter?.productionOrderNo && !row.productionOrderNos.includes(state.prefilter.productionOrderNo)) {
      return false
    }
    if (state.prefilter?.styleCode && row.styleCode !== state.prefilter.styleCode && row.spuCode !== state.prefilter.styleCode) {
      return false
    }
    if (state.prefilter?.materialSku && !row.materialSkuSummary.includes(state.prefilter.materialSku)) {
      return false
    }
    if (!matchesIncludesFilter(state.contextNoFilter, [row.markerPlanNo, ...row.cutOrderNos])) {
      return false
    }
    if (!matchesIncludesFilter(state.sessionNoFilter, [row.sessionNo])) {
      return false
    }
    if (!matchesIncludesFilter(state.cutOrderFilter, row.cutOrderNos)) {
      return false
    }
    if (!matchesIncludesFilter(state.markerPlanSourceFilter, [row.markerPlanNo])) {
      return false
    }
    if (!matchesIncludesFilter(state.markerNoFilter, [
      row.sourceMarkerLabel,
      row.session.sourceSchemeNo,
      row.session.sourceBedNo,
      row.session.markerNo,
      row.session.cuttingTableName,
      row.session.cuttingTableNo,
    ])) {
      return false
    }
    if (!matchesIncludesFilter(state.productionOrderFilter, row.productionOrderNos)) {
      return false
    }
    if (!matchesIncludesFilter(state.styleSpuFilter, [row.styleCode, row.spuCode])) {
      return false
    }
    if (!matchesIncludesFilter(state.materialSkuFilter, [row.materialSkuSummary])) {
      return false
    }
    if (!matchesIncludesFilter(state.colorFilter, [row.colorSummary])) {
      return false
    }
    if (state.spreadingModeFilter !== 'ALL' && row.spreadingMode !== state.spreadingModeFilter) {
      return false
    }
    if (state.contextTypeFilter !== 'ALL' && row.contextType !== state.contextTypeFilter) {
      return false
    }
    if (state.spreadingStageFilter !== 'ALL' && row.mainStageKey !== state.spreadingStageFilter) {
      return false
    }
    if (state.sourceChannelFilter !== 'ALL' && row.dataSourceLabel !== state.sourceChannelFilter) {
      return false
    }
    return matchesKeyword(state.keyword, row.keywordIndex)
  })
  const stageCounts = {
    ALL: nonStageFilteredRows.length,
    WAITING_START: nonStageFilteredRows.filter((row) => row.mainStageKey === 'WAITING_START').length,
    IN_PROGRESS: nonStageFilteredRows.filter((row) => row.mainStageKey === 'IN_PROGRESS').length,
    DONE: nonStageFilteredRows.filter((row) => row.mainStageKey === 'DONE').length,
  } satisfies Record<ListTabKey, number>
  const spreadingRows =
    state.activeTab === 'ALL' ? nonStageFilteredRows : nonStageFilteredRows.filter((row) => row.mainStageKey === state.activeTab)

  return {
    rows: projection.rows,
    rowsById: projection.rowsById,
    markerPlanSources: projection.markerPlanSources,
    markerPlanSourcesById: projection.markerPlanSourcesById,
    store,
    projection,
    viewModel,
    spreadingRows,
    stageCounts,
  }
}

function getSpreadingRow(sessionId: string | null | undefined): SupervisorSpreadingRow | null {
  if (!sessionId) return null
  return getPageData().spreadingRows.find((item) => item.spreadingSessionId === sessionId) || null
}

function getStoredSpreadingSession(sessionId: string | null | undefined): SpreadingSession | null {
  if (!sessionId) return null
  return readMarkerSpreadingPrototypeData().store.sessions.find((item) => item.spreadingSessionId === sessionId) || null
}

function syncImportedFieldsToExistingSession(marker: MarkerRecord, baseSession: SpreadingSession): SpreadingSession | null {
  const draft = createImportedSpreadingDraft(marker, {
    baseSession,
    reimported: true,
    importNote: '仅同步唛架理论字段，不覆盖已有卷记录和人员记录。',
  })
  if (!draft) return null
  draft.status = baseSession.status
  return draft
}

function renderImportDecisionPanel(): string {
  return ''
}

function renderHeaderActions(actions: string[]): string {
  return `<div class="flex flex-wrap gap-2">${actions.join('')}</div>`
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const className =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<section class="rounded-lg border px-3 py-3 text-sm ${className}">${escapeHtml(state.feedback.message)}</section>`
}

function renderPrefilterBar(): string {
  const labels = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.cutOrderNo ? `裁片单：${state.prefilter.cutOrderNo}` : '',
      state.prefilter?.markerPlanNo ? `唛架方案：${state.prefilter.markerPlanNo}` : '',
      state.prefilter?.styleCode ? `款号：${state.prefilter.styleCode}` : '',
      state.prefilter?.materialSku ? `面料 SKU：${state.prefilter.materialSku}` : '',
    ].filter(Boolean)),
  )
  if (!labels.length) return ''

  return `
    <div data-testid="cutting-spreading-prefilter-bar">
      ${renderWorkbenchStateBar({
        summary: buildCuttingDrillSummary(state.drillContext) || '当前列表已承接上游上下文预筛',
        chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-marker-action="clear-prefilter"', 'amber')),
        clearAttrs: 'data-cutting-marker-action="clear-prefilter"',
      })}
    </div>
  `
}

function getSpreadingStageOptions(): Array<{ value: ListTabKey; label: string }> {
  return [
    { value: 'ALL', label: '全部' },
    { value: 'WAITING_START', label: '待铺布' },
    { value: 'IN_PROGRESS', label: '铺布中' },
    { value: 'DONE', label: '已铺布' },
  ]
}

function getSpreadingStageLabel(stage: ListTabKey): string {
  return getSpreadingStageOptions().find((item) => item.value === stage)?.label || '全部'
}

function buildSpreadingStageCountFormula(label: string): string {
  return `${label}数 = 铺布状态 = ${label} 的铺布单数`
}

function buildCurrentListExportRows(rows: SupervisorSpreadingRow[]): { filename: string; rows: string[][] } {
  const tabLabel = getSpreadingStageLabel(state.activeTab)
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, '0'),
    `${now.getDate()}`.padStart(2, '0'),
    `${now.getHours()}`.padStart(2, '0'),
    `${now.getMinutes()}`.padStart(2, '0'),
    `${now.getSeconds()}`.padStart(2, '0'),
  ].join('')

  return {
    filename: `铺布单-${tabLabel}-${timestamp}.csv`,
    rows: [
      [
        '铺布编号',
        '铺布状态',
        '裁剪状态',
        '来源唛架编号',
        '裁床',
        '负责人',
        '开始时间',
        '结束时间',
        '裁剪时间',
        '预计耗时',
        '上下文摘要',
        '裁片单数（张）',
        '生产单数（单）',
        '铺布模式',
        '计划裁剪成衣件数（件）',
        '实际裁剪成衣件数（件）',
        '差异成衣件数（件）',
        '总实际铺布长度（m）',
        '最近更新时间',
      ],
      ...rows.map((row) => [
        row.sessionNo,
        row.mainStageLabel,
        row.cuttingStatusLabel,
        row.session.sourceBedNo || row.sourceMarkerLabel,
        row.session.cuttingTableName || row.session.cuttingTableNo || '未排程',
        row.session.ownerName || '未分配',
        formatScheduleDateTime(row.session.actualStartAt),
        formatScheduleDateTime(row.session.actualEndAt),
        `开始：${formatScheduleDateTime(row.session.cuttingStartedAt)} / 结束：${formatScheduleDateTime(row.session.cuttingFinishedAt)}`,
        `${row.session.estimatedDurationMinutes || 45} 分钟`,
        row.contextSummary,
        row.cutOrderCount,
        row.productionOrderCount,
        deriveSpreadingModeMeta(row.spreadingMode).label,
        row.plannedCutGarmentQty,
        row.actualCutGarmentQty,
        row.shortageGarmentQty,
        Number(row.spreadActualLengthM).toFixed(2),
        formatDateText(row.updatedAt),
      ]),
    ],
  }
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] xl:items-end">
        ${renderListTextInput('搜索', state.keyword, 'data-cutting-spreading-list-field="keyword"', '铺布单 / 唛架方案 / 唛架编号 / 生产单 / 款式')}
        ${renderListSelect('铺布状态', state.spreadingStageFilter, 'data-cutting-spreading-list-field="main-stage"', [
          { value: 'ALL', label: '全部' },
          ...getSpreadingStageOptions().filter((item) => item.value !== 'ALL'),
        ])}
        ${renderListTextInput('生产单 / 裁片单', state.contextNoFilter, 'data-cutting-spreading-list-field="context-no"', '')}
        ${renderListTextInput('款式 / SPU', state.styleSpuFilter, 'data-cutting-spreading-list-field="style-spu"', '')}
        ${renderListTextInput('裁床', state.markerNoFilter, 'data-cutting-spreading-list-field="marker-no"', '裁床名称 / 唛架方案')}
        <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">重置筛选</button>
      </div>
    `, '', 'data-testid="cutting-spreading-list-filters"')
}

function renderListTabs(pageData = getPageData()): string {
  const { stageCounts } = pageData
  return `
    <section class="rounded-lg border border-dashed bg-muted/20 px-3 py-3" data-testid="cutting-spreading-stage-tabs">
      <div class="flex flex-wrap gap-2">
        ${getSpreadingStageOptions()
          .map((tab) => {
            const active = state.activeTab === tab.value
            return `
              <button
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm leading-5 ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                data-cutting-marker-action="switch-spreading-list-tab"
                data-list-tab="${tab.value}"
              >
                ${escapeHtml(tab.label)}（${formatQty(stageCounts[tab.value])}）
              </button>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderListStats(pageData = getPageData()): string {
  const { stageCounts } = pageData

  return `
    <section class="grid gap-3 md:grid-cols-3" data-testid="cutting-spreading-list-stats">
      ${renderCompactKpiCard('待铺布数', stageCounts.WAITING_START, '', 'text-slate-900', buildSpreadingStageCountFormula('待铺布'))}
      ${renderCompactKpiCard('铺布中数', stageCounts.IN_PROGRESS, '', 'text-amber-600', buildSpreadingStageCountFormula('铺布中'))}
      ${renderCompactKpiCard('已铺布数', stageCounts.DONE, '', 'text-emerald-600', buildSpreadingStageCountFormula('已铺布'))}
    </section>
  `
}

function renderContextCell(contextLabel: string, cutOrderNos: string[], markerPlanNo: string): string {
  return `
    <div class="space-y-1">
      <p class="text-xs font-medium text-foreground">${escapeHtml(contextLabel)}</p>
      <p class="text-[11px] text-muted-foreground">裁片单 ${escapeHtml(String(cutOrderNos.length))} 个</p>
      ${markerPlanNo ? `<p class="text-[11px] text-muted-foreground">唛架方案：${escapeHtml(markerPlanNo)}</p>` : ''}
    </div>
  `
}

function renderMarkerTable(rows: MarkerListRow[]): string {
  void rows
  return ''
}

function renderSpreadingListCuttingAction(row: SupervisorSpreadingRow): string {
  if (row.cuttingStatusKey === 'WAITING_CUTTING') {
    return `<button type="button" class="rounded-md border border-violet-500 bg-violet-50 px-3 py-1.5 text-xs leading-5 text-violet-700 hover:bg-violet-100" data-cutting-marker-action="start-cutting" data-session-id="${escapeHtml(row.spreadingSessionId)}">开始裁剪</button>`
  }
  if (row.cuttingStatusKey === 'CUTTING') {
    return `<button type="button" class="rounded-md border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs leading-5 text-emerald-700 hover:bg-emerald-100" data-cutting-marker-action="finish-cutting" data-session-id="${escapeHtml(row.spreadingSessionId)}">完成裁剪</button>`
  }
  return ''
}

function renderSpreadingTable(rows: SupervisorSpreadingRow[], projection: MarkerSpreadingProjection): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-cutting-spreading-main-card="true">当前筛选范围内暂无铺布记录。</section>'
  }

  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-spreading-list-table" data-cutting-spreading-main-card="true">
      <div class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">铺布单</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${rows.length} 张铺布单</div>
      </div>
      <div class="hidden border-b bg-slate-50 px-4 py-3 text-left text-xs font-medium text-muted-foreground xl:grid xl:grid-cols-[1.1fr_1.2fr_1.4fr_1.2fr_1.2fr_1.2fr_1.2fr_1.1fr_1fr] xl:gap-4">
        <div>铺布单</div>
        <div>来源</div>
        <div>面料</div>
        <div>纸样</div>
        <div>计划</div>
        <div>实际</div>
        <div>差异</div>
        <div>PDA 执行记录</div>
        <div>操作</div>
      </div>
      <div class="divide-y">
        ${rows
          .map((row) => {
            const summary = resolveWebSpreadingSummary(row, projection)
            const markerNos = row.session.sourceBedNo || row.session.markerNo || row.sourceMarkerLabel
            const pattern = summary.order?.patternIdentity || null
            const pda = summary.pda
            return `
              <article class="grid gap-4 px-4 py-4 text-left text-sm xl:grid-cols-[1.1fr_1.2fr_1.4fr_1.2fr_1.2fr_1.2fr_1.2fr_1.1fr_1fr]">
                <div class="space-y-2">
                  <div class="font-semibold text-blue-600">${escapeHtml(row.sessionNo)}</div>
                  <div class="space-y-1">
                    <div class="text-[11px] text-muted-foreground">铺布状态</div>
                    <div class="flex flex-wrap gap-1">${renderStatusBadge(row.mainStageLabel, row.mainStageClassName)}</div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-[11px] text-muted-foreground">裁剪状态</div>
                    <div class="text-xs text-muted-foreground">
                      ${row.mainStageKey === 'DONE' ? renderStatusBadge(row.cuttingStatusLabel, row.cuttingStatusClassName) : '-'}
                    </div>
                  </div>
                  <div class="text-xs text-muted-foreground">唛架编号 / 床次：${escapeHtml(markerNos || '待补')}</div>
                </div>
                <div class="space-y-1 text-xs leading-5">
                  <div class="text-sm font-medium text-foreground">${escapeHtml(row.session.sourceSchemeNo || row.markerPlanNo || '待关联唛架方案')}</div>
                  <div class="text-muted-foreground">生产单：${escapeHtml(row.productionOrderNos.join(' / ') || '待补')}</div>
                  <div class="text-muted-foreground">来源裁片单：${escapeHtml(`${formatQty(summary.order?.sourceCutOrderIds.length || row.cutOrderCount)} 张`)}</div>
                </div>
                <div>
                  ${renderMaterialIdentityBlock(
                    summary.order?.materialIdentity || {
                      materialSku: row.materialSkuSummary || '待补',
                      materialLabel: '铺布面料',
                      materialColor: row.colorSummary,
                      materialAlias: row.materialAliasSummary,
                      materialImageUrl: row.materialImageUrl,
                    },
                    { compact: true, imageSizeClass: 'h-9 w-9', showCategory: false },
                  )}
                </div>
                <div class="space-y-1 text-xs leading-5">
                  <div class="font-medium text-foreground">${escapeHtml(pattern?.patternFileName || '纸样待补')}</div>
                  <div class="text-muted-foreground">版本：${escapeHtml(pattern?.patternVersion || '待补')}</div>
                  <div class="text-muted-foreground">有效幅宽：${escapeHtml(pattern?.effectiveWidthText || summary.order?.effectiveWidth || '待补')}</div>
                </div>
                <div>
                  ${renderCompactMetricLines([
                    ['计划层数', `${formatQty(summary.plannedLayerCount)} 层`],
                    ['计划用量', formatLength(summary.plannedUsage)],
                    ['计划数量', `${formatQty(summary.plannedQty)} 件`],
                  ])}
                </div>
                <div>
                  ${renderCompactMetricLines([
                    ['实铺层数', `${formatQty(summary.actualLayerCount)} 层`],
                    ['实际用量', formatLength(summary.actualUsage)],
                    ['实际裁剪数量', `${formatQty(summary.actualCutQty)} 件`],
                  ])}
                </div>
                <div>
                  ${renderCompactMetricLines([
                    ['层数差异', formatSignedNumber(summary.layerDiff, '层')],
                    ['用量差异', formatSignedLength(summary.usageDiff)],
                    ['数量差异', formatSignedNumber(summary.qtyDiff, '件')],
                  ])}
                  <div class="mt-2">${renderStatusBadge(summary.needsReview ? '有差异' : '无差异', summary.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}</div>
                </div>
                <div class="space-y-1 text-xs leading-5">
                  ${renderStatusBadge(pda.statusLabel, pda.statusClassName)}
                  <div class="text-muted-foreground">最近同步：${escapeHtml(formatScheduleDateTime(pda.latestAt))}</div>
                  <div class="text-muted-foreground">操作人：${escapeHtml(pda.operatorName)}</div>
                </div>
                <div class="flex flex-col gap-1">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">查看详情</button>
                  <button type="button" class="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(row.spreadingSessionId)}">编辑铺布</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">查看 PDA 记录</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(row.spreadingSessionId)}">处理差异</button>
                </div>
              </article>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSpreadingSupervisorListPage(): string {
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'spreading-list')
  const pageData = getPageData()
  const filteredRows = pageData.spreadingRows as SupervisorSpreadingRow[]

  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-list-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="create-spreading">新增铺布单</button>',
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="export-spreading-list">导出当前视图</button>',
        ])),
      })}
      ${renderFeedbackBar()}
      ${renderListStats(pageData)}
      ${renderListTabs(pageData)}
      ${renderFilterArea()}
      ${renderSpreadingTable(filteredRows, pageData.projection)}
    </div>
  `
}

function renderMarkerWarningSection(warningMessages: string[]): string {
  return renderSection(
    '提醒区',
    warningMessages.length
      ? `
          <div class="space-y-2">
            ${warningMessages
              .map(
                (message) => `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm text-amber-700">${escapeHtml(message)}</div>
                `,
              )
              .join('')}
          </div>
        `
      : '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">当前未识别明显异常，可继续维护唛架数据。</div>',
  )
}

function formatLayerValue(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '待录入' : String(value)
}

function formatHandledLengthValue(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '待录入' : formatLength(value)
}

function renderOperatorAllocationSummary(summary: SpreadingOperatorAmountSummary): string {
  if (!summary.rows.length) {
    return '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前尚未形成按人分摊数据，待录入层数、长度和单价后自动汇总。</div>'
  }

  return `
    <div class="space-y-3">
      ${renderInfoGrid([
        { label: '按人分摊人数', value: `${formatQty(summary.rows.length)} 人` },
        { label: '总负责层数（层）', value: `${formatQty(summary.totalHandledLayerCount)} 层` },
        { label: '总负责长度', value: formatHandledLengthValue(summary.totalHandledLength) },
        { label: '总负责成衣件数（件）', value: `${formatQty(summary.totalHandledPieceQty)} 件` },
        { label: '人员金额合计', value: formatCurrency(summary.totalDisplayAmount) },
        { label: '人工调整金额', value: summary.hasManualAdjustedAmount ? '存在人工调整' : '未人工调整' },
      ])}
      <div class="overflow-auto">
        <table class="w-full min-w-[880px] text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3">人员姓名</th>
              <th class="px-3 py-3">负责层数合计（层）</th>
              <th class="px-3 py-3">负责长度合计</th>
              <th class="px-3 py-3">负责成衣件数合计（件）</th>
              <th class="px-3 py-3">金额合计</th>
              <th class="px-3 py-3">人工调整</th>
            </tr>
          </thead>
          <tbody>
            ${summary.rows
              .map(
                (row) => `
                  <tr class="border-b">
                    <td class="px-3 py-3">${escapeHtml(row.operatorName)}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.handledLayerCountTotal)} 层`)}</td>
                    <td class="px-3 py-3">${escapeHtml(formatHandledLengthValue(row.handledLengthTotal))}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.handledGarmentQtyTotal ?? row.handledPieceQtyTotal)} 件`)}</td>
                    <td class="px-3 py-3">${escapeHtml(formatCurrency(row.displayAmountTotal))}</td>
                    <td class="px-3 py-3">${escapeHtml(row.hasManualAdjustedAmount ? '已调整' : '未调整')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderOperatorAmountWarningSection(warningMessages: string[]): string {
  if (!warningMessages.length) {
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">当前按人分摊金额字段完整，未识别明显金额异常。</div>'
  }

  return `
    <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
      <p class="font-medium">金额提醒</p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        ${warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}
      </ul>
    </div>
  `
}

function buildRollHandoverSummaryMap(session: SpreadingSession, markerTotalPieces: number): Record<string, SpreadingRollHandoverSummary> {
  return Object.fromEntries(
    session.rolls.map((roll) => [
      roll.rollRecordId,
      buildRollHandoverViewModel(
        roll,
        session.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
        markerTotalPieces,
      ),
    ]),
  )
}

function renderRollHandoverStatus(summary: SpreadingRollHandoverSummary): string {
  const tags: string[] = []
  if (summary.hasHandover) {
    tags.push(renderTag('有交接班', 'bg-blue-100 text-blue-700 border border-blue-200'))
  } else {
    tags.push(renderTag('无交接班', 'bg-slate-100 text-slate-700 border border-slate-200'))
  }
  if (summary.hasWarnings) {
    tags.push(renderTag('交接异常', 'bg-amber-100 text-amber-700 border border-amber-200'))
  } else {
    tags.push(renderTag('交接正常', 'bg-emerald-100 text-emerald-700 border border-emerald-200'))
  }
  return `<div class="flex flex-wrap gap-2">${tags.join('')}</div>`
}

function renderRollHandoverWarnings(summary: SpreadingRollHandoverSummary): string {
  if (!summary.warnings.length) {
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">当前卷的层数、长度与交接区间已形成可追溯闭环。</div>'
  }

  return `
    <div class="space-y-2">
      ${summary.warnings
        .map(
          (warning) => `
            <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">${escapeHtml(warning)}</div>
          `,
        )
        .join('')}
    </div>
  `
}

function buildSpreadingCompletionTargetIds(session: SpreadingSession): string[] {
  if (session.contextType === 'marker-plan') return [...state.spreadingCompletionSelection]
  return [...session.cutOrderIds]
}

function buildSpreadingReplenishmentPreview(
  session: SpreadingSession,
  linkedCutOrderNos: string[],
  derived: ReturnType<typeof resolveSpreadingDerivedState>,
): SpreadingReplenishmentWarning {
  const data = readMarkerSpreadingPrototypeData()
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  const context =
    primaryRows.length > 0
      ? {
          contextType: session.contextType,
          cutOrderIds: [...session.cutOrderIds],
          cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
          markerPlanId: session.markerPlanId,
          markerPlanNo: session.markerPlanNo,
          productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
          styleCode: session.styleCode || primaryRows[0].styleCode,
          spuCode: session.spuCode || primaryRows[0].spuCode,
          styleName: primaryRows[0].styleName,
          materialSkuSummary: session.materialSkuSummary || primaryRows[0].materialSkuSummary,
          materialPrepRows: primaryRows,
        }
      : null

  const derivedWarning = buildSpreadingReplenishmentWarning({
    context,
    session,
    markerTotalPieces: derived.markerTotalPieces,
    cutOrderNos: linkedCutOrderNos,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || '',
    warningMessages: derived.warningMessages,
  })

  return session.replenishmentWarning?.handled ? { ...derivedWarning, handled: true } : derivedWarning
}

function renderSpreadingReplenishmentSection(
  session: SpreadingSession,
  warning: SpreadingReplenishmentWarning,
  actionLabel = '去补料管理',
): string {
  const toneClass =
    warning.warningLevel === '高'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : warning.warningLevel === '中'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return renderSection(
    '补料预警区',
    `
        <div class="space-y-3">
          <div class="rounded-md border px-3 py-3 text-sm ${toneClass}">
            当前预警等级：${escapeHtml(warning.warningLevel)}，建议动作：${escapeHtml(warning.suggestedAction)}
          </div>
          ${renderInfoGrid([
          {
            label: '计划裁剪成衣件数（件）',
            value: `${formatQty(warning.plannedCutGarmentQty)} 件`,
            formula: warning.plannedCutGarmentQtyFormula,
          },
          {
            label: '理论裁剪成衣件数（件）',
            value: `${formatQty(warning.theoreticalCutGarmentQty)} 件`,
            formula: warning.theoreticalCutGarmentQtyFormula,
          },
          {
            label: '实际裁剪成衣件数（件）',
            value: `${formatQty(warning.actualCutGarmentQty)} 件`,
            formula: warning.actualCutGarmentQtyFormula,
          },
          { label: '中转仓已配总长度（m）', value: formatLength(warning.configuredLengthTotal) },
          { label: '裁床已领总长度（m）', value: formatLength(warning.claimedLengthTotal) },
          { label: '总实际铺布长度（m）', value: formatLength(warning.spreadActualLengthM) },
          {
            label: '总可用长度（m）',
            value: formatLength(warning.spreadUsableLengthM),
            formula: warning.spreadUsableLengthFormula,
          },
          {
            label: '差异长度（m）',
            value: formatLength(warning.varianceLength),
            formula: warning.varianceLengthFormula,
          },
          {
            label: '差异成衣件数（件）',
            value: `${formatQty(warning.shortageGarmentQty)} 件`,
            formula: warning.shortageGarmentQtyFormula,
          },
          { label: '建议动作', value: warning.suggestedAction },
          { label: '判定依据', value: warning.suggestedActionRuleText },
        ])}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    `,
  )
}

function renderSpreadingCompletionLinkageSection(session: SpreadingSession, linkedCutOrderNos: string[]): string {
  const data = readMarkerSpreadingPrototypeData()
  const selectionIds = buildSpreadingCompletionTargetIds(session)
  const rows = session.cutOrderIds
    .map((id) => data.rowsById[id])
    .filter(Boolean)
    .map((row) => ({
      id: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      materialSummary: `${row.color} / ${row.materialSkuSummary}`,
      spreadingProgress: buildMarkerSpreadingCountsByCutOrder(row.cutOrderId).statusSummary,
      selected: selectionIds.includes(row.cutOrderId),
    }))

  return renderSection(
    '状态联动区',
    session.contextType === 'marker-plan'
      ? `
          <div class="space-y-3">
            <div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
              当前为唛架方案上下文。完成铺布时，只记录勾选裁片单的累计铺布进度；未勾选任何项时不允许完成。
            </div>
            <div class="space-y-2">
              ${rows
                .map(
                  (row) => `
                    <label class="flex items-start gap-3 rounded-md border px-3 py-3">
                      <input type="checkbox" class="mt-1 size-4" ${row.selected ? 'checked' : ''} data-cutting-marker-action="toggle-spreading-completion-order" data-cut-order-id="${escapeHtml(row.id)}" />
                      <div class="space-y-1">
                        <p class="text-sm font-medium text-foreground">${escapeHtml(row.cutOrderNo)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(row.materialSummary)}</p>
                        <p class="text-xs text-muted-foreground">累计铺布进度：${escapeHtml(row.spreadingProgress)}</p>
                      </div>
                    </label>
                  `,
                )
                .join('')}
            </div>
            <div class="rounded-md border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
              本次预计计入 ${escapeHtml(String(selectionIds.length))} 个裁片单的累计进度。
            </div>
          </div>
        `
      : renderInfoGrid([
          { label: '本铺布单状态', value: deriveSpreadingStatus(session.status).label },
          { label: '联动更新对象', value: linkedCutOrderNos.join(' / ') || '待补' },
          { label: '联动规则', value: '完成铺布后只记录本铺布单和累计进度，不改变裁片单主状态。' },
        ]),
  )
}

function renderSpreadingImportSourceSection(session: SpreadingSession, linkedCutOrderNos: string[]): string {
  const source = session.importSource
  const data = readMarkerSpreadingPrototypeData()
  const sourceRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  const linkedMarker = getLinkedMarkerForSession(session)
  const importedVarianceSummary = buildSpreadingVarianceSummary(
    sourceRows.length
      ? {
          contextType: session.contextType,
          cutOrderIds: [...session.cutOrderIds],
          cutOrderNos: sourceRows.map((row) => row.cutOrderNo),
          markerPlanId: session.markerPlanId,
          markerPlanNo: session.markerPlanNo,
          productionOrderNos: Array.from(new Set(sourceRows.map((row) => row.productionOrderNo))),
          styleCode: session.styleCode || sourceRows[0].styleCode,
          spuCode: session.spuCode || sourceRows[0].spuCode,
          styleName: sourceRows[0].styleName,
          materialSkuSummary: session.materialSkuSummary || sourceRows[0].materialSkuSummary,
          materialPrepRows: sourceRows,
        }
      : null,
    linkedMarker,
    session,
  )
  const rollLayerTotal = summarizeSpreadingRolls(session.rolls || []).totalLayers
  const actualLayerTotal = Number(session.actualLayers || 0)
  const markerTotalPieces = deriveSpreadingSessionGarmentQtyPerLayer(session, linkedMarker)
  const theoreticalCutGarmentQty = importedVarianceSummary?.theoreticalCutGarmentQty || session.theoreticalActualCutPieceQty || 0
  const theoreticalCutGarmentQtyFormula =
    importedVarianceSummary?.theoreticalCutGarmentQtyFormula ||
    buildTheoreticalCutGarmentQtyFormula(theoreticalCutGarmentQty, rollLayerTotal, actualLayerTotal, markerTotalPieces)

  return renderSection(
    '导入来源区',
    source
      ? renderInfoGrid([
          { label: '来源唛架编号', value: session.sourceBedNo || source.sourceMarkerNo || session.markerNo || '待补' },
          { label: '裁床', value: session.cuttingTableName || session.cuttingTableNo || '未排程' },
          { label: '实际开始时间', value: session.actualStartAt || '未开始' },
          { label: '实际结束时间', value: session.actualEndAt || '未完成' },
          { label: '预计耗时', value: `${session.estimatedDurationMinutes || 45} 分钟` },
          { label: '裁床排程', value: session.tableScheduleStatus || '未排程' },
          { label: '来源模式', value: deriveSpreadingModeMeta(source.sourceMarkerMode).label },
          { label: '关联裁片单', value: source.sourceCutOrderNos.join(' / ') || linkedCutOrderNos.join(' / ') || '待补' },
          { label: '关联唛架方案', value: source.sourceMarkerPlanNo || '未关联唛架方案' },
          { label: '导入时间', value: formatDateText(source.importedAt) },
          { label: '重新导入', value: source.reimported ? '是' : '否' },
          { label: '导入记录', value: source.importNote || '由唛架模板导入铺布草稿' },
          {
            label: '理论铺布总长度（m）',
            value: formatLength(session.theoreticalSpreadTotalLength || 0),
            formula: buildSpreadingImportedLengthFormula(session.theoreticalSpreadTotalLength || 0),
          },
          {
            label: '理论裁剪成衣件数（件）',
            value: `${formatQty(theoreticalCutGarmentQty)} 件`,
            formula: theoreticalCutGarmentQtyFormula,
          },
          { label: '导入后调整', value: session.importAdjustmentRequired ? '已有导入后调整' : '当前未调整' },
          { label: '调整记录', value: session.importAdjustmentNote || '暂无' },
        ])
      : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前铺布记录未绑定唛架导入来源，仍可手工补录实际卷与人员数据。</div>',
  )
}

function renderSpreadingPlanSection(session: SpreadingSession): string {
  if (session.spreadingMode === 'high_low' || session.spreadingMode === 'fold_high_low') {
    return renderSection(
      '计划铺布明细区',
      session.highLowPlanSnapshot
        ? `
            <div class="space-y-4">
              <article class="space-y-3">
                <h4 class="text-sm font-semibold text-foreground">裁剪明细矩阵快照</h4>
                ${renderHighLowCuttingMatrix(session.highLowPlanSnapshot.cuttingRows, true)}
              </article>
              <article class="space-y-3">
                <h4 class="text-sm font-semibold text-foreground">模式分布矩阵快照</h4>
                ${renderHighLowPatternMatrix(session.highLowPlanSnapshot.patternKeys, session.highLowPlanSnapshot.patternRows, true)}
              </article>
            </div>
          `
        : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前缺少高低层计划矩阵快照，请先回到唛架补齐模板数据。</div>',
    )
  }

  return renderSection(
    '计划铺布明细区',
    session.planLineItems?.length
      ? `
          <div class="overflow-auto">
            <table class="w-full min-w-[1180px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">唛架编号</th>
                  <th class="px-3 py-3">唛架记录</th>
                  <th class="px-3 py-3">颜色</th>
                  <th class="px-3 py-3">计划层数</th>
                  <th class="px-3 py-3">唛架净长</th>
                  <th class="px-3 py-3">单层成衣件数（件）</th>
                  <th class="px-3 py-3">单件成衣用量（m/件）</th>
                  <th class="px-3 py-3">理论铺布总长度（m）</th>
                  <th class="px-3 py-3">门幅提示</th>
                  <th class="px-3 py-3">备注</th>
                </tr>
              </thead>
              <tbody>
                ${session.planLineItems
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.layoutCode || '待补')}</td>
                        <td class="px-3 py-3">${escapeHtml(item.layoutDetailText || '待补')}</td>
                        <td class="px-3 py-3">${escapeHtml(item.color || '待补')}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.markerLength || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.markerPieceCount || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.singlePieceUsage || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatLength(item.plannedSpreadTotalLength || 0))}</td>
                        <td class="px-3 py-3">${escapeHtml(item.widthHint || '—')}</td>
                        <td class="px-3 py-3">${escapeHtml(item.note || '—')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
      : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前缺少计划铺布明细，请先回到唛架补齐可导入的唛架明细。</div>',
  )
}

function renderMarkerPlanMetricsSection(
  marker: MarkerRecord,
  usageSummary: ReturnType<typeof computeUsageSummary>,
): string {
  return renderSection(
    '计划 / 计算补充信息区',
    `
      <div class="mb-3 rounded-lg border bg-muted/10 px-3 py-3">
        <div class="text-xs text-muted-foreground">面料</div>
        <div class="mt-2">${renderMaterialIdentityBlock({
          materialSku: marker.fabricSku || marker.materialSkuSummary || '待补',
          materialLabel: marker.materialSkuSummary || marker.fabricSku || '待补',
          materialCategory: marker.materialCategory || '',
          materialAlias: marker.materialAliasSummary || '',
          materialImageUrl: marker.materialImageUrl || '',
        })}</div>
      </div>
      ${renderInfoGrid([
        { label: '面料类别', value: marker.materialCategory || '待补' },
        { label: '面料属性', value: marker.materialAttr || '待补' },
        { label: '计划尺码配比文本', value: marker.sizeRatioPlanText || '待补' },
        { label: '计划铺布层数（层）', value: `${formatQty(marker.plannedLayerCount || 0)} 层` },
        { label: '层数来源值（层）', value: `${formatQty(marker.plannedMarkerCount || marker.plannedLayerCount || 0)} 层` },
        { label: '唛架净长（m）', value: formatLength(marker.markerLength || marker.netLength) },
        { label: '采购单件成衣用量（m/件）', value: formatLength(usageSummary.procurementUnitUsage) },
        { label: '实际单件成衣用量（m/件）', value: formatLength(usageSummary.actualUnitUsage) },
        { label: '预算长度（m）', value: formatLength(usageSummary.plannedMaterialMeter) },
        { label: '实际使用长度（m）', value: formatLength(usageSummary.actualMaterialMeter) },
        { label: '实际裁剪成衣件数（件）', value: `${formatQty(usageSummary.actualCutQty)} 件` },
      ])}
    `,
  )
}

function renderMarkerRowTemplateDetailTable(lineItems: MarkerLineItem[]): string {
  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[1180px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">行号</th>
            <th class="px-3 py-3">唛架编号</th>
            <th class="px-3 py-3">唛架明细</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">计划层数</th>
            <th class="px-3 py-3">唛架净长</th>
            <th class="px-3 py-3">单层成衣件数（件）</th>
            <th class="px-3 py-3">单件成衣用量（m/件）</th>
            <th class="px-3 py-3">计划铺布总长度（m）</th>
            <th class="px-3 py-3">门幅提示</th>
            <th class="px-3 py-3">备注</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems
            .map(
              (item) => `
                <tr class="border-b">
                  <td class="px-3 py-3">${escapeHtml(String(item.lineNo || '-'))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.layoutCode || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.layoutDetailText || item.ratioLabel || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.color || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.markerLength))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatQty(item.markerPieceCount ?? item.pieceCount ?? 0))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.singlePieceUsage || computeSinglePieceUsage(item.markerLength, item.markerPieceCount ?? item.pieceCount ?? 0)))}</td>
                  <td class="px-3 py-3">${escapeHtml(formatLength(item.spreadTotalLength ?? item.spreadingTotalLength ?? Number((item.markerLength * Math.max(item.spreadRepeatCount || 0, 0)).toFixed(2))))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.widthHint || '—')}</td>
                  <td class="px-3 py-3">${escapeHtml(item.note || '—')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderHighLowCuttingMatrix(
  rows: HighLowCuttingRow[],
  readonly = true,
): string {
  const columnTotals = Object.fromEntries(
    MARKER_SIZE_KEYS.map((sizeKey) => [sizeKey, rows.reduce((sum, row) => sum + Math.max(row.sizeValues[sizeKey] || 0, 0), 0)]),
  ) as Record<(typeof MARKER_SIZE_KEYS)[number], number>
  const grandTotal = MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + columnTotals[sizeKey], 0)

  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">颜色</th>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<th class="px-3 py-3">${escapeHtml(sizeKey)}</th>`).join('')}
            <th class="px-3 py-3">合计</th>
            ${readonly ? '' : '<th class="px-3 py-3">操作</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-3">
                    ${
                      readonly
                        ? escapeHtml(row.color || '待补')
                        : `<input type="text" value="${escapeHtml(row.color || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-color="true" />`
                    }
                  </td>
                  ${MARKER_SIZE_KEYS.map((sizeKey) =>
                    readonly
                      ? `<td class="px-3 py-3">${escapeHtml(formatQty(row.sizeValues[sizeKey] || 0))}</td>`
                      : `<td class="px-3 py-3"><input type="number" value="${escapeHtml(String(row.sizeValues[sizeKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-size="${escapeHtml(sizeKey)}" /></td>`,
                  ).join('')}
                  <td class="px-3 py-3 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? '' : `<td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-cutting-row" data-index="${rowIndex}">删除</button></td>`}
                </tr>
              `,
            )
            .join('')}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-3">列合计</td>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<td class="px-3 py-3">${escapeHtml(formatQty(columnTotals[sizeKey]))}</td>`).join('')}
            <td class="px-3 py-3">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? '' : '<td class="px-3 py-3">—</td>'}
          </tr>
        </tfoot>
      </table>
    </div>
  `
}

function renderHighLowPatternMatrix(
  patternKeys: string[],
  rows: HighLowPatternRow[],
  readonly = true,
): string {
  const columnTotals = Object.fromEntries(
    patternKeys.map((patternKey) => [patternKey, rows.reduce((sum, row) => sum + Math.max(row.patternValues[patternKey] || 0, 0), 0)]),
  )
  const grandTotal = patternKeys.reduce((sum, patternKey) => sum + Number(columnTotals[patternKey] || 0), 0)

  return `
    <div class="overflow-auto">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">颜色</th>
            ${patternKeys
              .map((patternKey, patternIndex) =>
                readonly
                  ? `<th class="px-3 py-3">${escapeHtml(patternKey)}</th>`
                  : `<th class="px-3 py-3">
                      <div class="space-y-1">
                        <input type="text" value="${escapeHtml(patternKey)}" class="h-8 w-28 rounded-md border px-2 text-xs" data-cutting-marker-highlow-pattern-key-index="${patternIndex}" />
                        <button type="button" class="rounded-md border px-2 py-0.5 text-[11px] hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-key" data-index="${patternIndex}">删列</button>
                      </div>
                    </th>`,
              )
              .join('')}
            <th class="px-3 py-3">合计</th>
            ${readonly ? '' : '<th class="px-3 py-3">操作</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-3">
                    ${
                      readonly
                        ? escapeHtml(row.color || '待补')
                        : `<input type="text" value="${escapeHtml(row.color || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-color="true" />`
                    }
                  </td>
                  ${patternKeys
                    .map((patternKey) =>
                      readonly
                        ? `<td class="px-3 py-3">${escapeHtml(formatQty(row.patternValues[patternKey] || 0))}</td>`
                        : `<td class="px-3 py-3"><input type="number" value="${escapeHtml(String(row.patternValues[patternKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-key="${escapeHtml(patternKey)}" /></td>`,
                    )
                    .join('')}
                  <td class="px-3 py-3 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? '' : `<td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-row" data-index="${rowIndex}">删除</button></td>`}
                </tr>
              `,
            )
            .join('')}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-3">列合计</td>
            ${patternKeys.map((patternKey) => `<td class="px-3 py-3">${escapeHtml(formatQty(Number(columnTotals[patternKey] || 0)))}</td>`).join('')}
            <td class="px-3 py-3">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? '' : '<td class="px-3 py-3">—</td>'}
          </tr>
        </tfoot>
      </table>
    </div>
  `
}

function renderMarkerDetailPage(): string {
  return renderListPage()
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'marker-detail')
  const row = getMarkerRow(getSearchParams().get('markerId'))

  if (!row) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
          actionsHtml: renderHeaderActions(appendSummaryReturnAction([
            '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">返回列表</button>',
          ])),
        })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">未找到对应计划记录，请返回列表重新选择。</section>
      </div>
    `
  }

  const detailView = buildMarkerDetailViewModel(row)
  const modeMeta = deriveMarkerModeMeta(row.record.markerMode)
  const usageSummary = detailView.usageSummary

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">返回列表</button>',
          `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-detail" data-marker-id="${escapeHtml(row.markerId)}">查看关联唛架编号</button>`,
        ])),
      })}
      ${renderPrefilterBar()}
      ${renderSection(
        '基础信息区',
        `
          <div class="mb-3 rounded-lg border bg-muted/10 px-3 py-3">
            <div class="text-xs text-muted-foreground">面料</div>
            <div class="mt-2">${renderMaterialIdentityBlock({
              materialSku: row.materialSkuSummary || '待补',
              materialLabel: row.materialSkuSummary || '待补',
              materialAlias: row.record.materialAliasSummary || '',
              materialImageUrl: row.record.materialImageUrl || '',
            })}</div>
          </div>
            ${renderInfoGrid([
            { label: '方案编号', value: row.markerNo },
            { label: '模式', value: modeMeta.label },
            { label: '裁片单摘要', value: row.cutOrderNos.join(' / ') || '待补' },
            { label: '关联唛架方案', value: row.markerPlanNo || '未关联唛架方案' },
            { label: '款号 / SPU', value: `${row.styleCode || '待补'} / ${row.spuCode || '待补'}` },
            { label: '颜色摘要', value: row.colorSummary || '待补' },
          ])}
        `,
      )}
      ${renderSection('关联裁片单区', renderMarkerSourceRowsTable(detailView.sourceOrderRows))}
      ${renderSection('唛架分配明细区', renderMarkerAllocationTable(detailView.allocationRows))}
      ${renderSection(
        '裁片拆解预览区',
        `
          <div class="space-y-4">
            <article class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                ${renderTag(`关联裁片单 ${detailView.totals.sourceOrderCount}`, 'bg-slate-100 text-slate-700')}
                ${renderTag(`分配行 ${detailView.totals.allocationLineCount}`, 'bg-slate-100 text-slate-700')}
                ${renderTag(`SKU 行 ${detailView.totals.skuRowCount}`, 'bg-slate-100 text-slate-700')}
                ${renderTag(`部位行 ${detailView.totals.pieceRowCount}`, 'bg-slate-100 text-slate-700')}
                ${renderTag(`拆解总裁片数 ${formatQty(detailView.totals.explodedPieceQtyTotal)}`, 'bg-blue-100 text-blue-700')}
              </div>
              <h4 class="text-sm font-semibold text-foreground">按 SKU 汇总</h4>
              ${renderMarkerSkuSummaryTable(detailView.skuSummaryRows)}
            </article>
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">按部位明细</h4>
              ${renderMarkerPieceDetailTable(detailView.pieceDetailRows)}
            </article>
          </div>
        `,
      )}
      ${renderSection(
        '映射异常区',
        detailView.mappingWarnings.length
          ? `
            <div class="space-y-3">
              <div class="flex flex-wrap gap-2">
                ${detailView.mappingWarnings.map((warning) => renderTag(warning, 'bg-amber-100 text-amber-700')).join('')}
              </div>
              <div class="overflow-auto">
                <table class="w-full min-w-full text-sm">
                  <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-3">来源裁片单号</th>
                      <th class="px-3 py-3">颜色</th>
                      <th class="px-3 py-3">尺码</th>
                      <th class="px-3 py-3">面料</th>
                      <th class="px-3 py-3">异常</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailView.missingMappings
                      .map(
                        (item) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(item.sourceCutOrderNo)}</td>
                            <td class="px-3 py-3">${escapeHtml(item.color || '待补')}</td>
                            <td class="px-3 py-3">${escapeHtml(item.sizeLabel || '待补')}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
                              materialSku: item.materialSku || '待补',
                              materialLabel: item.materialSku || '待补',
                              materialAlias: item.materialAlias,
                              materialImageUrl: item.materialImageUrl,
                            }, { compact: true })}</td>
                            <td class="px-3 py-3">${getMarkerMappingStatusTag(item.mappingStatus)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.reason)}</div></td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `
          : '<div class="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前未发现技术包映射异常。</div>',
      )}
      ${renderSection(
        '尺码配比区',
        `
          ${renderInfoGrid([
            { label: '唛架计划成衣件数（件）', value: `${formatQty(row.totalPieces)} 件` },
            { label: '计划尺码配比', value: detailView.sizeRatioPlanText || '待补' },
            { label: '配比摘要', value: detailView.lineSummary.summaryText },
          ])}
          <div class="mt-4 overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">尺码</th>
                  <th class="px-3 py-3">尺码成衣件数（件）</th>
                </tr>
              </thead>
              <tbody>
                ${row.record.sizeDistribution
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.quantity))}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}
      ${
        detailView.templateType === 'row-template'
          ? renderSection(
              '唛架明细区',
              renderMarkerRowTemplateDetailTable(row.record.lineItems || []),
            )
          : renderSection(
              '高低层矩阵区',
              `
                <div class="space-y-4">
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">裁剪明细矩阵</h4>
                    </div>
                    ${renderHighLowCuttingMatrix(detailView.highLowCuttingRows, true)}
                    <p class="text-xs text-muted-foreground">裁剪明细总合计：${escapeHtml(formatQty(detailView.highLowCuttingTotal))} 件</p>
                  </article>
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">唛架模式矩阵</h4>
                    </div>
                    ${renderHighLowPatternMatrix(detailView.highLowPatternKeys, detailView.highLowPatternRows, true)}
                    <p class="text-xs text-muted-foreground">模式矩阵总合计：${escapeHtml(formatQty(detailView.highLowPatternTotal))} 件</p>
                  </article>
                </div>
              `,
            )
      }
      ${renderSection(
        '长度与用量区',
        renderInfoGrid([
          { label: '唛架净长度', value: formatLength(row.netLength) },
          { label: '单件成衣用量（m/件）', value: formatLength(row.singlePieceUsage) },
          { label: '计划铺布总长度（m）', value: formatLength(row.spreadTotalLength) },
          { label: '预算米数', value: formatLength(usageSummary.plannedMaterialMeter) },
          { label: '实际使用米数', value: formatLength(usageSummary.actualMaterialMeter) },
          { label: '实际裁剪成衣件数（件）', value: `${formatQty(usageSummary.actualCutQty)} 件` },
        ]),
      )}
      ${renderMarkerPlanMetricsSection(row.record, usageSummary)}
      ${renderMarkerWarningSection(detailView.warningMessages)}
      ${renderSection(
        '图片与备注区',
        `
          <div class="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">唛架明细图</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(row.record.markerImageName || '当前未上传唛架明细图')}</p>
            </article>
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">备注与调整</p>
              <p class="mt-1 text-sm">${escapeHtml(row.record.note || '暂无备注')}</p>
            <div class="mt-3 rounded-md border bg-background px-3 py-3 text-sm">
              <p>是否有调整：${escapeHtml(row.record.adjustmentRequired ? '是' : '否')}</p>
              <p class="mt-1">调整记录：${escapeHtml(row.record.adjustmentNote || '暂无')}</p>
              </div>
            </article>
          </div>
        `,
      )}
    </div>
  `
}

function renderMarkerEditPage(): string {
  return renderListPage()
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'marker-edit')
  const draft = ensureMarkerDraftShape(state.markerDraft || buildNewMarkerDraft())
  const totalPieces = computeMarkerTotalPieces(draft.sizeDistribution)
  const templateType = deriveMarkerTemplateByMode(draft.markerMode)
  const usageSummary = computeUsageSummary({
    ...draft,
    totalPieces,
    spreadTotalLength:
      templateType === 'row-template'
        ? computeNormalMarkerSpreadTotalLength(draft.lineItems || [])
        : Number(draft.spreadTotalLength || draft.actualMaterialMeter || 0),
  })
  const warningMessages = buildMarkerWarningMessages({
    ...draft,
    totalPieces,
    spreadTotalLength:
      templateType === 'row-template'
        ? computeNormalMarkerSpreadTotalLength(draft.lineItems || [])
        : Number(draft.spreadTotalLength || draft.actualMaterialMeter || 0),
  })
  const patternKeys = draft.highLowPatternKeys?.length ? draft.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const highLowCuttingTotals = computeHighLowCuttingTotals(draft.highLowCuttingRows || [])
  const highLowPatternTotals = computeHighLowPatternTotals(draft.highLowPatternRows || [], patternKeys)
  const sourceRows = getMarkerDraftSourceRows(draft)
  const pieceExplosion = buildMarkerDraftPieceExplosion(draft)
  const allocationWarningMessages = Array.from(new Set([...warningMessages, ...pieceExplosion.mappingWarnings]))

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="cancel-spreading-edit">取消</button>',
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="save-spreading">保存草稿</button>',
          '<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="save-spreading-and-view">保存并返回详情</button>',
        ])),
      })}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderSection(
        '基础表单',
        `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderTextInput('方案编号', draft.markerNo || '', 'data-cutting-marker-draft-field="markerNo"')}
            ${renderSelect('唛架模式', draft.markerMode, 'data-cutting-marker-draft-field="markerMode"', [
              { value: 'normal', label: '普通唛架' },
              { value: 'high_low', label: '高低层唛架' },
              { value: 'fold_normal', label: '对折普通唛架' },
              { value: 'fold_high_low', label: '对折高低层唛架' },
            ])}
            ${renderTextInput('关联裁片单', (draft.cutOrderNos || draft.cutOrderIds).join(' / '), 'disabled', '当前由上游预筛带入')}
            ${renderTextInput('关联唛架方案', draft.markerPlanNo || '', 'disabled', '可为空')}
            ${renderTextInput('款号 / SPU', `${draft.styleCode || ''} / ${draft.spuCode || ''}`, 'disabled', '来源于上下文')}
            ${renderTextInput('面料摘要', draft.materialSkuSummary || '', 'disabled')}
            ${renderTextInput('颜色摘要', draft.colorSummary || '', 'data-cutting-marker-draft-field="colorSummary"', '可手工补充')}
            ${renderNumberInput('唛架净长度（米）', draft.netLength, 'data-cutting-marker-draft-field="netLength"')}
            ${renderNumberInput('单件成衣用量（m/件）', draft.singlePieceUsage, 'data-cutting-marker-draft-field="singlePieceUsage"', '0.001')}
            ${renderNumberInput('计划铺布总长度（m）', draft.spreadTotalLength || 0, 'data-cutting-marker-draft-field="spreadTotalLength"', '0.01')}
          </div>
        `,
      )}
      ${renderSection('关联裁片单与可分配背景区', renderMarkerSourceRowsTable(pieceExplosion.sourceOrderRows))}
      ${renderSection(
        '分配明细编辑区',
        `
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-muted-foreground">按来源裁片单 + 颜色 + 尺码分配计划成衣件数（件），作为技术包裁片拆解的事实源。</div>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-allocation-line">新增分配行</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full min-w-[1380px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">来源裁片单</th>
                  <th class="px-3 py-3">来源生产单</th>
                  <th class="px-3 py-3">颜色</th>
                  <th class="px-3 py-3">面料</th>
                  <th class="px-3 py-3">款号 / SPU</th>
                  <th class="px-3 py-3">技术包 SPU</th>
                  <th class="px-3 py-3">尺码</th>
                  <th class="px-3 py-3">计划成衣数</th>
                  <th class="px-3 py-3">备注</th>
                  <th class="px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                ${(draft.allocationLines || [])
                  .map((line, index) => {
                    const selectedSourceRow =
                      sourceRows.find((row) => row.sourceCutOrderId === line.sourceCutOrderId) || null
                    return `
                      <tr class="border-b align-top">
                        <td class="px-3 py-3">
                          <select class="h-9 min-w-[12rem] rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="sourceCutOrderId">
                            <option value="">请选择来源裁片单</option>
                            ${sourceRows
                              .map(
                                (row) =>
                                  `<option value="${escapeHtml(row.sourceCutOrderId)}" ${row.sourceCutOrderId === line.sourceCutOrderId ? 'selected' : ''}>${escapeHtml(row.sourceCutOrderNo)}</option>`,
                              )
                              .join('')}
                          </select>
                        </td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.sourceProductionOrderNo || line.sourceProductionOrderNo || '待补')}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.color || line.color || '待补')}</td>
                        <td class="px-3 py-3 text-muted-foreground">${renderMaterialIdentityBlock({
                          materialSku: selectedSourceRow?.materialSku || line.materialSku || '待补',
                          materialLabel: selectedSourceRow?.materialSku || line.materialSku || '待补',
                          materialAlias: selectedSourceRow?.materialAlias || '',
                          materialImageUrl: selectedSourceRow?.materialImageUrl || '',
                        }, { compact: true })}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(`${selectedSourceRow?.styleCode || line.styleCode || '待补'} / ${selectedSourceRow?.spuCode || line.spuCode || '待补'}`)}</td>
                        <td class="px-3 py-3 text-muted-foreground">${escapeHtml(selectedSourceRow?.techPackSpuCode || line.techPackSpuCode || '未关联')}</td>
                        <td class="px-3 py-3">
                          <input type="text" value="${escapeHtml(line.sizeLabel || '')}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="sizeLabel" />
                        </td>
                        <td class="px-3 py-3">
                          <input type="number" min="0" value="${escapeHtml(String(line.plannedGarmentQty || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="plannedGarmentQty" />
                        </td>
                        <td class="px-3 py-3">
                          <input type="text" value="${escapeHtml(line.note || '')}" class="h-9 w-40 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="note" />
                        </td>
                        <td class="px-3 py-3">
                          <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-allocation-line" data-index="${index}">删除</button>
                        </td>
                      </tr>
                    `
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}
      ${renderSection(
        '实时校验区',
        `
          <div class="overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">尺码</th>
                  <th class="px-3 py-3">尺码配比</th>
                  <th class="px-3 py-3">allocation 合计</th>
                  <th class="px-3 py-3">差值</th>
                  <th class="px-3 py-3">校验</th>
                </tr>
              </thead>
              <tbody>
                ${pieceExplosion.allocationSizeSummary
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-3">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.requiredQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(item.allocatedQty))}</td>
                        <td class="px-3 py-3">${escapeHtml(formatQty(Math.abs(item.differenceQty)))}</td>
                        <td class="px-3 py-3">${
                          item.differenceQty === 0
                            ? renderTag('已配平', 'bg-emerald-100 text-emerald-700')
                            : renderTag(formatSizeBalance(item.requiredQty, item.allocatedQty), 'bg-amber-100 text-amber-700')
                        }</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}
      ${renderSection(
        '尺码配比编辑区',
        `
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="mt-1 text-xs text-muted-foreground">当前总成衣件数（件）：${escapeHtml(formatQty(totalPieces))} 件</p>
            </div>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-size-row">新增尺码行</button>
          </div>
          <div class="overflow-auto">
            <table class="w-full min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-3">尺码</th>
                  <th class="px-3 py-3">尺码成衣件数（件）</th>
                  <th class="px-3 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                ${draft.sizeDistribution
                  .map(
                    (item, index) => `
                      <tr class="border-b">
                        <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.sizeLabel)}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="sizeLabel" /></td>
                        <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.quantity))}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="quantity" /></td>
                        <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-size-row" data-index="${index}">删除</button></td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `,
      )}
      ${renderSection(
        '裁片拆解实时预览区',
        `
          <div class="space-y-4">
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">按 SKU 汇总</h4>
              ${renderMarkerSkuSummaryTable(pieceExplosion.skuSummaryRows)}
            </article>
            <article class="space-y-3">
              <h4 class="text-sm font-semibold text-foreground">按部位明细</h4>
              ${renderMarkerPieceDetailTable(pieceExplosion.pieceDetailRows)}
            </article>
          </div>
        `,
      )}
      ${
        templateType === 'row-template'
          ? renderSection(
              '唛架明细编辑区',
              `
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm text-muted-foreground">当前模式使用行明细模板。明细行不再单独维护模式，只承接当前唛架编号头部模式下的唛架数据。</p>
                    <p class="mt-1 text-xs text-muted-foreground">当前模式：${escapeHtml(deriveMarkerModeMeta(draft.markerMode).label)}</p>
                  </div>
                  <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-line-item">新增明细行</button>
                </div>
                <div class="overflow-auto">
                  <table class="w-full min-w-[1380px] text-sm">
                    <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th class="px-3 py-3">行号</th>
                        <th class="px-3 py-3">唛架编号</th>
                        <th class="px-3 py-3">唛架明细</th>
                        <th class="px-3 py-3">颜色</th>
                        <th class="px-3 py-3">计划层数</th>
                        <th class="px-3 py-3">唛架净长</th>
                        <th class="px-3 py-3">单层成衣件数（件）</th>
                        <th class="px-3 py-3">单件成衣用量（m/件）</th>
                        <th class="px-3 py-3">计划铺布总长度（m）</th>
                        <th class="px-3 py-3">门幅提示</th>
                        <th class="px-3 py-3">备注</th>
                        <th class="px-3 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(draft.lineItems || [])
                        .map(
                          (item, index) => `
                            <tr class="border-b align-top">
                              <td class="px-3 py-3">${escapeHtml(String(item.lineNo || index + 1))}</td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.layoutCode || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutCode" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.layoutDetailText || item.ratioLabel || '')}" class="h-9 w-52 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutDetailText" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.color)}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="color" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.spreadRepeatCount || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadRepeatCount" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.markerLength))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerLength" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.markerPieceCount ?? item.pieceCount ?? 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerPieceCount" /></td>
                              <td class="px-3 py-3"><input type="number" step="0.001" value="${escapeHtml(String(item.singlePieceUsage))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="singlePieceUsage" /></td>
                              <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(item.spreadTotalLength ?? item.spreadingTotalLength ?? 0))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadTotalLength" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.widthHint || '')}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="widthHint" /></td>
                              <td class="px-3 py-3"><input type="text" value="${escapeHtml(item.note)}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="note" /></td>
                              <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-line-item" data-index="${index}">删除</button></td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `,
            )
          : renderSection(
              '高低层矩阵编辑区',
              `
                <div class="space-y-5">
                  <article class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-foreground">裁剪明细矩阵</h4>
                      </div>
                      <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-cutting-row">新增颜色行</button>
                    </div>
                    ${renderHighLowCuttingMatrix(highLowCuttingTotals.rows, false)}
                    <p class="text-xs text-muted-foreground">裁剪明细总合计：${escapeHtml(formatQty(highLowCuttingTotals.cuttingTotal))} 件</p>
                  </article>
                  <article class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-foreground">唛架模式矩阵</h4>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-key">新增模式列</button>
                        <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-row">新增颜色行</button>
                      </div>
                    </div>
                    ${renderHighLowPatternMatrix(patternKeys, highLowPatternTotals.rows, false)}
                    <p class="text-xs text-muted-foreground">模式矩阵总合计：${escapeHtml(formatQty(highLowPatternTotals.patternTotal))} 件</p>
                  </article>
                </div>
              `,
            )
      }
      ${renderMarkerPlanMetricsSection(draft, usageSummary)}
      ${renderMarkerWarningSection(allocationWarningMessages)}
      ${renderSection(
        '图片信息区',
        `
          <div class="grid gap-3 md:grid-cols-2">
            ${renderTextInput('唛架明细图文件名', draft.markerImageName || '', 'data-cutting-marker-draft-field="markerImageName"')}
            ${renderTextInput('图片预览地址（可选）', draft.markerImageUrl || '', 'data-cutting-marker-draft-field="markerImageUrl"')}
            ${renderTextarea('备注', draft.note || '', 'data-cutting-marker-draft-field="note"')}
          </div>
        `,
      )}
      ${renderSection(
        '调整区',
        `
          <div class="grid gap-3 md:grid-cols-3">
            ${renderSelect('是否有调整', draft.adjustmentRequired ? 'true' : 'false', 'data-cutting-marker-draft-field="adjustmentRequired"', [
              { value: 'false', label: '否' },
              { value: 'true', label: '是' },
            ])}
          </div>
          <div class="mt-3">
            ${renderTextarea('调整记录', draft.adjustmentNote || '', 'data-cutting-marker-draft-field="adjustmentNote"', 4)}
          </div>
        `,
      )}
    </div>
  `
}

function renderSpreadingDetailPage(): string {
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'spreading-detail')
  const row = getSpreadingRow(getSearchParams().get('sessionId'))

  if (!row) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
          actionsHtml: renderHeaderActions(appendSummaryReturnAction([
            '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">返回列表</button>',
          ])),
        })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">未找到对应铺布 session，请返回列表重新选择。</section>
      </div>
    `
  }

  const pageData = getPageData()
  const detailView = buildSpreadingDetailViewModel({
    row,
    rowsById: pageData.rowsById,
    markerPlanSources: pageData.markerPlanSources,
    markerRecords: pageData.store.markers,
  })
  const session = row.session
  const derived = resolveSpreadingDerivedState(session)
  const linkedMarker = derived.markerRecord
  const markerTotalPieces = derived.markerTotalPieces
  const rollSummary = derived.rollSummary
  const varianceSummary = derived.varianceSummary
  const replenishmentWarning = buildSpreadingReplenishmentPreview(session, detailView.linkedCutOrderNos, derived)
  const lifecycleState = resolveSpreadingEditLifecycleState(session)
  const data = readMarkerSpreadingPrototypeData()
  const primaryRows = session.cutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  const linkedCutOrderNos = detailView.linkedCutOrderNos
  const productionOrderNos = Array.from(new Set(primaryRows.map((rowItem) => rowItem.productionOrderNo).filter(Boolean)))
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: session.rolls,
    importSourceColorSummary: session.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((rowItem) => rowItem.color),
    fallbackSummary: session.colorSummary,
  })
  const theoreticalSpreadTotalLength = Number(linkedMarker?.spreadTotalLength ?? session.theoreticalSpreadTotalLength ?? 0)
  const plannedSpreadLengthM = (session.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0)
  const plannedSpreadLengthFormula = buildSumFormula(
    plannedSpreadLengthM,
    (session.planUnits || []).map((unit) => Number(unit.plannedSpreadLengthM || 0)),
    2,
  )
  const plannedLayerTotal = Math.max(Number(session.plannedLayers || linkedMarker?.plannedLayerCount || 0), 0)
  const actualLayerTotal = Math.max(Number(rollSummary.totalLayers || session.actualLayers || 0), 0)
  const plannedUsageLengthM = theoreticalSpreadTotalLength || plannedSpreadLengthM
  const actualUsageLengthM = rollSummary.totalActualLength
  const theoreticalActualCutPieceQty =
    varianceSummary?.theoreticalCutGarmentQty ??
    computeSessionPlannedCutGarmentQty(session, markerTotalPieces)
  const handoverSummaryByRollId = buildRollHandoverSummaryMap(session, markerTotalPieces)
  const webSummary = resolveWebSpreadingSummary(row, pageData.projection)
  const materialIdentity = webSummary.order?.materialIdentity || {
    materialSku: row.materialSkuSummary || session.materialSkuSummary || '待补',
    materialLabel: '铺布面料',
    materialColor: row.colorSummary || session.colorSummary || '',
    materialAlias: row.materialAliasSummary || session.materialAliasSummary || '',
    materialImageUrl: row.materialImageUrl || session.materialImageUrl || '',
  }
  const patternIdentity = webSummary.order?.patternIdentity || null
  const writebackRecords = [
    session.sourceWritebackId
      ? {
          recordId: session.sourceWritebackId,
          sourceLabel: '铺布单写回',
          updatedAt: session.updatedFromPdaAt || session.updatedAt,
          operatorName: webSummary.pda.operatorName,
        }
      : null,
    ...session.rolls.map((roll) =>
      roll.sourceWritebackId
        ? {
            recordId: roll.sourceWritebackId,
            sourceLabel: `布卷 ${roll.rollNo || '待补'} 写回`,
            updatedAt: roll.updatedFromPdaAt || roll.occurredAt,
            operatorName: roll.operatorNames?.join(' / ') || webSummary.pda.operatorName,
          }
        : null,
    ),
    ...session.operators.map((operator) =>
      operator.sourceWritebackId
        ? {
            recordId: operator.sourceWritebackId,
            sourceLabel: `${operator.operatorName || '人员'} 写回`,
            updatedAt: operator.updatedFromPdaAt || operator.endAt || operator.startAt,
            operatorName: operator.operatorName || webSummary.pda.operatorName,
          }
        : null,
    ),
  ].filter((record): record is { recordId: string; sourceLabel: string; updatedAt: string; operatorName: string } => Boolean(record))
  const differenceRuntime = {
    orders: webSummary.order ? [webSummary.order] : [],
    sessions: [session],
  }
  const spreadingDifferences = Array.from(
    new Map(
      [
        ...listSpreadingDifferencesBySpreadingOrder(session.spreadingSessionId, differenceRuntime),
        ...listSpreadingDifferencesBySpreadingOrder(session.sessionNo || '', differenceRuntime),
        ...(webSummary.order?.spreadingOrderId ? listSpreadingDifferencesBySpreadingOrder(webSummary.order.spreadingOrderId, differenceRuntime) : []),
        ...(webSummary.order?.spreadingOrderNo ? listSpreadingDifferencesBySpreadingOrder(webSummary.order.spreadingOrderNo, differenceRuntime) : []),
      ].map((difference) => [difference.differenceId, difference]),
    ).values(),
  )

  const renderRollCards = (): string => `
    <div class="grid gap-3 lg:grid-cols-2">
      ${session.rolls.length
        ? session.rolls.map((roll) => {
            const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)
            const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength)
            return `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-foreground">${escapeHtml(roll.rollNo || '待补布卷号')}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(roll.materialSku || materialIdentity.materialSku || '待补面料')}</div>
                  </div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(formatScheduleDateTime(roll.occurredAt))}</div>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField('卷长', formatLength(roll.labeledLength))}
                  ${renderReadonlyField('使用长度', formatLength(roll.actualLength))}
                  ${renderReadonlyField('剩余长度', formatLength(remainingLength))}
                  ${renderReadonlyField('净可用长度', formatLength(usableLength))}
                  ${renderReadonlyField('布头长度', formatLength(roll.headLength))}
                  ${renderReadonlyField('布尾长度', formatLength(roll.tailLength))}
                  ${renderReadonlyField('实铺层数', `${formatQty(roll.layerCount)} 层`)}
                  ${renderReadonlyField('操作人', roll.operatorNames?.join(' / ') || '待补')}
                </div>
              </article>
            `
          }).join('')
        : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">暂无卷记录。</div>'}
    </div>
  `

  const renderOperatorCards = (): string => `
    <div class="grid gap-3 lg:grid-cols-2">
      ${session.operators.length
        ? session.operators.map((operator) => {
            const linkedRoll = session.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null
            const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
            return `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold text-foreground">${escapeHtml(operator.operatorName || '待补人员')}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(operator.operatorAccountId || '待补账号')}</div>
                  </div>
                  ${renderStatusBadge(operator.actionType || '待补动作', 'border-slate-200 bg-slate-50 text-slate-700')}
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField('所属卷', linkedRoll?.rollNo || '待补')}
                  ${renderReadonlyField('开始时间', formatScheduleDateTime(operator.startAt))}
                  ${renderReadonlyField('结束时间', formatScheduleDateTime(operator.endAt))}
                  ${renderReadonlyField('负责层数', handledLayerCount === null ? '待补' : `${formatQty(handledLayerCount)} 层`)}
                  ${renderReadonlyField('计件数据', operator.handledLength ? formatLength(operator.handledLength) : '待补')}
                  ${renderReadonlyField('交接备注', operator.note || operator.handoverNotes || '—')}
                </div>
              </article>
            `
          }).join('')
        : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">暂无人员记录。</div>'}
    </div>
  `

  const renderPdaRuntimeEventSection = (): string => `
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        ${renderStatusBadge(webSummary.pda.statusLabel, webSummary.pda.statusClassName)}
        <span class="text-xs text-muted-foreground">最近同步：${escapeHtml(formatScheduleDateTime(webSummary.pda.latestAt))}</span>
        <span class="text-xs text-muted-foreground">操作人：${escapeHtml(webSummary.pda.operatorName)}</span>
      </div>
      <div class="grid gap-3 lg:grid-cols-2">
        ${writebackRecords.length
          ? writebackRecords.map((record) => `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="font-semibold text-foreground">${escapeHtml(record.sourceLabel)}</div>
                <div class="mt-2 grid gap-2 sm:grid-cols-2">
                  ${renderReadonlyField('执行记录', record.recordId)}
                  ${renderReadonlyField('同步时间', formatScheduleDateTime(record.updatedAt))}
                  ${renderReadonlyField('操作人', record.operatorName)}
                  ${renderReadonlyField('同步状态', webSummary.pda.statusLabel)}
                </div>
              </article>
            `).join('')
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">暂无 PDA 执行记录。</div>'}
      </div>
    </div>
  `

  const renderDifferenceCards = (): string => `
    <div class="mt-3 grid gap-3">
      ${
        spreadingDifferences.length
          ? spreadingDifferences
              .map(
                (difference) => `
                  <article class="rounded-lg border bg-background p-3 text-sm">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderStatusBadge(difference.differenceType, difference.differenceLevel === '需处理' ? 'border-rose-200 bg-rose-50 text-rose-700' : difference.differenceLevel === '待处理' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700')}
                        ${renderStatusBadge(difference.handlingStatus, difference.handlingStatus === '待处理' ? 'border-amber-200 bg-amber-50 text-amber-700' : difference.handlingStatus === '已处理' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700')}
                        <span class="text-xs text-muted-foreground">${escapeHtml(difference.sourceType)}</span>
                      </div>
                      <span class="text-xs text-muted-foreground">${escapeHtml(formatScheduleDateTime(difference.detectedAt))}</span>
                    </div>
                    <div class="mt-2 grid gap-2 sm:grid-cols-4">
                      ${renderReadonlyField('计划值', `${formatQty(difference.plannedValue)} ${difference.unit}`)}
                      ${renderReadonlyField('实际值', `${formatQty(difference.actualValue)} ${difference.unit}`)}
                      ${renderReadonlyField('差异值', `${formatQty(Math.abs(difference.differenceValue))} ${difference.unit}`)}
                      ${renderReadonlyField('关联补料处理', difference.linkedReplenishmentId)}
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(difference.evidence.summary)}</p>
                  </article>
                `,
              )
              .join('')
          : webSummary.needsReview
            ? `
              <article class="rounded-lg border bg-background p-3 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  ${renderStatusBadge('系统计算差异', 'border-amber-200 bg-amber-50 text-amber-700')}
                  ${renderStatusBadge('待处理', 'border-amber-200 bg-amber-50 text-amber-700')}
                </div>
                <div class="mt-2 grid gap-2 sm:grid-cols-3">
                  ${renderReadonlyField('层数差异', formatSignedNumber(webSummary.layerDiff, '层'))}
                  ${renderReadonlyField('用量差异', formatSignedLength(webSummary.usageDiff))}
                  ${renderReadonlyField('数量差异', formatSignedNumber(webSummary.qtyDiff, '件'))}
                </div>
                <p class="mt-2 text-xs text-muted-foreground">该铺布单存在计划与实际差异，允许提交现场数据，后续处理差异只选择发起布料或忽略。</p>
              </article>
            `
          : '<div class="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">当前没有已生成的铺布或裁剪差异事项。</div>'
      }
    </div>
  `

  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-detail-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">返回铺布单</button>',
          `<button type="button" class="rounded-md border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700 hover:bg-blue-100" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(session.spreadingSessionId)}">编辑铺布</button>`,
          `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">处理差异</button>`,
          `${row.markerPlanNo ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-plan" data-session-id="${escapeHtml(row.spreadingSessionId)}">去来源唛架方案</button>` : ''}`,
        ])),
      })}
      <section class="rounded-xl border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-blue-600">${escapeHtml(session.sessionNo || '待补铺布单号')}</div>
            <div class="mt-1 text-xs text-muted-foreground">唛架方案：${escapeHtml(session.sourceSchemeNo || row.markerPlanNo || '待关联')} / 唛架编号：${escapeHtml(session.sourceBedNo || session.markerNo || row.sourceMarkerLabel || '待补')}</div>
          </div>
          <div class="flex flex-wrap gap-2">${renderStatusBadge(webSummary.status.label, webSummary.status.className)}</div>
        </div>
      </section>
      ${renderSection('基本信息', `
        <div class="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>${renderMaterialIdentityBlock(materialIdentity, { compact: true, imageSizeClass: 'h-12 w-12', showCategory: false })}</div>
          <div class="space-y-2 text-sm">
            ${renderReadonlyField('来源裁片单', (webSummary.order?.sourceCutOrderNos || linkedCutOrderNos).join(' / ') || '待补')}
            ${renderReadonlyField('生产单', productionOrderNos.join(' / ') || row.productionOrderNos.join(' / ') || '待补')}
            ${renderReadonlyField('铺布负责人', session.ownerName || '待分配')}
          </div>
          <div class="space-y-2 text-sm">
            ${renderReadonlyField('纸样文件', patternIdentity?.patternFileName || '待补')}
            ${renderReadonlyField('纸样版本', patternIdentity?.patternVersion || '待补')}
            ${renderReadonlyField('有效幅宽', patternIdentity?.effectiveWidthText || webSummary.order?.effectiveWidth || '待补')}
          </div>
        </div>
      `)}
      ${renderSection('计划信息', `
        ${renderInfoGrid([
          { label: '计划层数', value: `${formatQty(webSummary.plannedLayerCount)} 层` },
          { label: '计划用量', value: formatLength(webSummary.plannedUsage) },
          { label: '计划数量', value: `${formatQty(webSummary.plannedQty)} 件` },
          { label: '尺码配比', value: webSummary.order?.sizeRatio || linkedMarker?.sizeRatioPlanText || '待补' },
          { label: '唛架图片', value: webSummary.order?.markerImageUrl || linkedMarker?.markerImageUrl || '待上传' },
        ])}
      `)}
      ${renderSection('实际信息', `
        ${renderInfoGrid([
          { label: '实铺层数', value: `${formatQty(webSummary.actualLayerCount)} 层`, formula: buildLayerSumFormula(webSummary.actualLayerCount, session.rolls.map((roll) => roll.layerCount)) },
          { label: '实际铺布长度', value: formatLength(webSummary.actualUsage), formula: buildSumFormula(webSummary.actualUsage, session.rolls.map((roll) => roll.actualLength), 2) },
          { label: '实际用量', value: formatLength(webSummary.actualUsage) },
          { label: '实际裁剪数量', value: `${formatQty(webSummary.actualCutQty)} 件` },
          { label: '布头长度', value: formatLength(rollSummary.totalHeadLength) },
          { label: '布尾长度', value: formatLength(rollSummary.totalTailLength) },
        ])}
      `)}
      ${renderSection('卷记录', renderRollCards())}
      ${renderSection('人员记录', renderOperatorCards())}
      ${renderSection('PDA 执行记录', renderPdaRuntimeEventSection())}
      ${renderSection('差异与后续动作', `
        ${renderInfoGrid([
          { label: '层数差异', value: formatSignedNumber(webSummary.layerDiff, '层') },
          { label: '用量差异', value: formatSignedLength(webSummary.usageDiff) },
          { label: '数量差异', value: formatSignedNumber(webSummary.qtyDiff, '件') },
          { label: '差异判断', value: webSummary.needsReview ? '有差异' : '无差异' },
          { label: '差异说明', value: row.varianceNote || '当前未识别明显差异。' },
        ])}
        ${renderDifferenceCards()}
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">进入差异处理</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-cut-orders" data-session-id="${escapeHtml(session.spreadingSessionId)}">查看来源裁片单</button>
        </div>
      `)}
    </div>
  `

  const renderTopInfo = (): string => `
    <section class="rounded-xl border bg-card p-4">
      <div class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div><div class="text-[11px] text-muted-foreground">铺布编号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(session.sessionNo || '待补')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">来源唛架编号</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.sourceBedNo || session.markerNo || '未关联唛架编号')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">裁床</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.cuttingTableName || session.cuttingTableNo || '未排程')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">实际开始</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.actualStartAt || '未开始')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">实际结束</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(session.actualEndAt || '未完成')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">裁片单 / 唛架方案</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(linkedCutOrderNos.join(' / ') || session.markerPlanNo || '—')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">生产单</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(productionOrderNos.join(' / ') || '—')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">模式</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(deriveSpreadingModeMeta(session.spreadingMode).label)}</div></div>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderStatusBadge(lifecycleState.mainStageLabel, lifecycleState.mainStageClassName)}
            ${lifecycleState.cuttingStatusLabel ? renderStatusBadge(lifecycleState.cuttingStatusLabel, lifecycleState.cuttingStatusClassName) : ''}
          </div>
        </div>
        ${session.status === 'DRAFT' ? `<div class="rounded-lg border bg-blue-50/40 px-3 py-3">${renderStartSpreadingControls(session.spreadingSessionId, session.cuttingTableId, session.ownerAccountId)}</div>` : ''}
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(plannedLayerTotal)} 层`, `${formatQty(plannedLayerTotal)} 层 = 唛架方案计划层数`)}<div class="mt-1 text-[11px] text-muted-foreground">计划层数</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(actualLayerTotal)} 层`, buildLayerSumFormula(actualLayerTotal, session.rolls.map((roll) => roll.layerCount)))}<div class="mt-1 text-[11px] text-muted-foreground">实铺层数</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(formatLength(plannedUsageLengthM), theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula)}<div class="mt-1 text-[11px] text-muted-foreground">计划用量</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(formatLength(actualUsageLengthM), buildSumFormula(actualUsageLengthM, session.rolls.map((roll) => roll.actualLength), 2))}<div class="mt-1 text-[11px] text-muted-foreground">实际用量</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`, varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, session.plannedLayers || 0, markerTotalPieces))}<div class="mt-1 text-[11px] text-muted-foreground">计划数量</div></div>
          <div class="rounded-md border bg-background px-3 py-3">${renderValueWithFormula(`${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`, varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []))}<div class="mt-1 text-[11px] text-muted-foreground">实际裁剪数量</div></div>
        </div>
      </div>
    </section>
  `

  const renderSummaryTab = (): string =>
    renderSection(
      '执行摘要',
      `
        ${renderInfoGrid([
          {
            label: '计划层数',
            value: `${formatQty(plannedLayerTotal)} 层`,
            formula: `${formatQty(plannedLayerTotal)} 层 = 唛架方案计划层数`,
          },
          {
            label: '实铺层数',
            value: `${formatQty(actualLayerTotal)} 层`,
            formula: buildLayerSumFormula(actualLayerTotal, session.rolls.map((roll) => roll.layerCount)),
          },
          {
            label: '计划数量',
            value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`,
            formula:
              varianceSummary?.plannedCutGarmentQtyFormula ||
              buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, session.plannedLayers || 0, markerTotalPieces),
          },
          {
            label: '理论裁剪成衣件数（件）',
            value: `${formatQty(theoreticalActualCutPieceQty)} 件`,
            formula:
              varianceSummary?.theoreticalCutGarmentQtyFormula ||
              buildTheoreticalActualCutQtyFormula(theoreticalActualCutPieceQty, session.plannedLayers || 0, markerTotalPieces),
          },
          {
            label: '实际裁剪数量',
            value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []),
          },
          {
            label: '差异成衣件数（件）',
            value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} 件`,
            formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0),
          },
          {
            label: '计划用量',
            value: formatLength(plannedUsageLengthM),
            formula: theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula,
          },
          {
            label: '实际用量',
            value: formatLength(actualUsageLengthM),
            formula: buildSumFormula(actualUsageLengthM, session.rolls.map((roll) => roll.actualLength), 2),
          },
          {
            label: '总净可用长度（m）',
            value: formatLength(varianceSummary?.spreadUsableLengthM || rollSummary.totalCalculatedUsableLength),
            formula:
              varianceSummary?.spreadUsableLengthFormula ||
              buildSumFormula(rollSummary.totalCalculatedUsableLength, session.rolls.map((roll) => computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)), 2),
          },
          {
            label: '裁床已领长度（m）',
            value: formatLength(varianceSummary?.claimedLengthTotal || 0),
            formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = Σ 裁床已领长度`,
          },
          {
            label: '差异长度（m）',
            value: formatLength(varianceSummary?.varianceLength || 0),
            formula:
              varianceSummary?.varianceLengthFormula ||
              buildDifferenceFormula(varianceSummary?.varianceLength || 0, varianceSummary?.claimedLengthTotal || 0, rollSummary.totalActualLength, 2),
          },
          { label: 'Session 备注', value: session.note || '—' },
        ])}
      `,
    )

  const renderRollsTab = (): string =>
    !canEditSpreadingExecution(draft)
      ? renderSection('卷记录', renderStartSpreadingGate('卷记录'))
      : renderSection(
      '卷记录',
      `
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">唛架项</th>
                <th class="px-3 py-3">卷号</th>
                <th class="px-3 py-3">面料</th>
                <th class="px-3 py-3">颜色</th>
                <th class="px-3 py-3">标注长度（m）</th>
                <th class="px-3 py-3">实际铺布长度（m）</th>
                <th class="px-3 py-3">布头长度（m）</th>
                <th class="px-3 py-3">布尾长度（m）</th>
                <th class="px-3 py-3">铺布层数（层）</th>
                <th class="px-3 py-3">净可用长度（m）</th>
                <th class="px-3 py-3">剩余长度（m）</th>
                <th class="px-3 py-3">实际裁剪成衣件数（件）</th>
                <th class="px-3 py-3">录入来源</th>
                <th class="px-3 py-3">记录时间</th>
                <th class="px-3 py-3">备注</th>
              </tr>
            </thead>
            <tbody>
              ${
                session.rolls.length
                  ? session.rolls
                      .map((roll) => {
                        const planUnit = findSpreadingPlanUnitById(session.planUnits, roll.planUnitId)
                        const garmentQtyPerUnit = planUnit?.garmentQtyPerUnit || 0
                        const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)
                        const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength)
                        const actualCutGarmentQty = computeRollActualCutGarmentQty(roll.layerCount, garmentQtyPerUnit)
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(planUnit ? buildSpreadingPlanUnitLabel(planUnit) : '待补')}</td>
                            <td class="px-3 py-3">${escapeHtml(roll.rollNo || '待补')}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
                              materialSku: planUnit?.materialSku || roll.materialSku || '—',
                              materialLabel: planUnit?.materialSku || roll.materialSku || '—',
                              materialAlias: planUnit?.materialAlias || '',
                              materialImageUrl: planUnit?.materialImageUrl || '',
                            }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(planUnit?.color || roll.color || '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.labeledLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.actualLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.headLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLength(roll.tailLength))}</td>
                            <td class="px-3 py-3">${escapeHtml(`${formatQty(roll.layerCount)} 层`)}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(usableLength), buildRollUsableLengthFormula(roll.actualLength, roll.headLength, roll.tailLength, usableLength), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(remainingLength), buildRemainingLengthFormula(roll.labeledLength, roll.actualLength, remainingLength), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(actualCutGarmentQty)} 件`, buildRollActualCutGarmentQtyFormula(actualCutGarmentQty, roll.layerCount, garmentQtyPerUnit), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(getSourceChannelDisplayLabel(roll.sourceChannel))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatDateText(roll.occurredAt || ''))}</td>
                            <td class="px-3 py-3">${escapeHtml(roll.note || '—')}</td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="15" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有卷记录。</td></tr>'
              }
            </tbody>
          </table>
        </div>
        ${renderSpreadingOutputMatrix(session.spreadingSessionId)}
      `,
    )

  const renderOperatorsTab = (): string =>
    !canEditSpreadingExecution(draft)
      ? renderSection('换班与人员', renderStartSpreadingGate('换班与人员'))
      : renderSection(
      '换班与人员',
      `
        <details open class="rounded-md border bg-background" data-testid="cutting-spreading-detail-operators-fold" data-default-open="open">
          <summary class="cursor-pointer px-2.5 py-1.5 text-sm font-medium text-foreground">换班明细摘要</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-[1560px] text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">所属卷</th>
                <th class="px-3 py-3">操作账号</th>
                <th class="px-3 py-3">操作人</th>
                <th class="px-3 py-3">动作类型</th>
                <th class="px-3 py-3">开始层</th>
                <th class="px-3 py-3">结束层</th>
                <th class="px-3 py-3">负责层数（层）</th>
                <th class="px-3 py-3">负责成衣件数（件）</th>
                <th class="px-3 py-3">负责长度（m）</th>
                <th class="px-3 py-3">接手人账号</th>
                <th class="px-3 py-3">记录时间</th>
                <th class="px-3 py-3">备注</th>
              </tr>
            </thead>
            <tbody>
              ${
                session.operators.length
                  ? session.operators
                      .map((operator) => {
                        const linkedRoll = session.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null
                        const linkedUnit = linkedRoll ? findSpreadingPlanUnitById(session.planUnits, linkedRoll.planUnitId) : null
                        const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
                        const handledGarmentQty = computeOperatorHandledGarmentQty(handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0)
                        const handledLength = computeOperatorHandledLengthByRoll(handledLayerCount, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0)
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(linkedRoll?.rollNo || '待补')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.operatorAccountId || '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.operatorName || '待补')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.actionType || '待补')}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLayerValue(operator.startLayer))}</td>
                            <td class="px-3 py-3">${escapeHtml(formatLayerValue(operator.endLayer))}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLayerCount === null ? '待补' : `${formatQty(handledLayerCount)} 层`, buildOperatorHandledLayerFormula(handledLayerCount, operator.startLayer, operator.endLayer), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledGarmentQty === null ? '待补' : `${formatQty(handledGarmentQty)} 件`, buildOperatorHandledGarmentQtyFormula(handledGarmentQty, handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLength === null ? '待补' : formatLength(handledLength), buildOperatorHandledLengthFormula(handledLength, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0, handledLayerCount), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.nextOperatorAccountId || '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.endAt || operator.startAt || '—')}</td>
                            <td class="px-3 py-3">${escapeHtml(operator.note || operator.handoverNotes || '—')}</td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="12" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有换班与人员记录。</td></tr>'
              }
            </tbody>
          </table>
          </div>
        </details>
        <div class="mt-2 space-y-2">
          ${
            Object.values(handoverSummaryByRollId).length
              ? Object.values(handoverSummaryByRollId)
                  .map(
                    (summary) => `
                      <div class="rounded-lg border bg-muted/10 p-2.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="text-sm font-medium text-foreground">卷 ${escapeHtml(summary.rollNo || '待补')}</div>
                          ${renderRollHandoverStatus(summary)}
                        </div>
                        <div class="mt-2">${renderRollHandoverWarnings(summary)}</div>
                      </div>
                    `,
                  )
                  .join('')
              : ''
          }
        </div>
      `,
    )

  const renderVarianceTab = (): string =>
    renderSection(
      '差异与补料',
      `
        ${renderInfoGrid([
          {
            label: '需求成衣件数（件）',
            value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.plannedCutGarmentQtyFormula || `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件 = 当前需求成衣件数`,
          },
          {
            label: '实际裁剪成衣件数（件）',
            value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []),
          },
          {
            label: '差异成衣件数（件）',
            value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} 件`,
            formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0),
          },
          {
            label: '裁床已领长度（m）',
            value: formatLength(varianceSummary?.claimedLengthTotal || 0),
            formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = Σ 裁床已领长度`,
          },
          {
            label: '实际铺布长度（m）',
            value: formatLength(varianceSummary?.spreadActualLengthM || 0),
            formula: buildSumFormula(rollSummary.totalActualLength, session.rolls.map((roll) => roll.actualLength), 2),
          },
          {
            label: '差异长度（m）',
            value: formatLength(varianceSummary?.varianceLength || 0),
            formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(0, 0, 0, 2),
          },
        ])}
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-foreground">差异处理项</h4>
          <button type="button" class="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">去补料管理</button>
        </div>
        <details class="mt-2 rounded-md border bg-background" data-testid="cutting-spreading-detail-replenishment-fold" data-default-open="collapsed">
          <summary class="cursor-pointer px-2.5 py-1.5 text-sm font-medium text-foreground">差异处理摘要</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">裁片单</th>
                <th class="px-3 py-3">面料</th>
                <th class="px-3 py-3">颜色</th>
                <th class="px-3 py-3">需求成衣件数（件）</th>
                <th class="px-3 py-3">实际裁剪成衣件数（件）</th>
                <th class="px-3 py-3">差异成衣件数（件）</th>
                <th class="px-3 py-3">裁床已领长度（m）</th>
                <th class="px-3 py-3">实际铺布长度（m）</th>
                <th class="px-3 py-3">预警等级</th>
                <th class="px-3 py-3">建议动作</th>
                <th class="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                replenishmentWarning.lines.length
                  ? replenishmentWarning.lines
                      .map((line) => {
                        const warningLevel = line.shortageGarmentQty > 0 || line.actualLengthTotal > line.claimedLengthTotal ? '高' : '低'
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
                              materialSku: line.materialSku,
                              materialLabel: line.materialSku,
                              materialAlias: line.materialAlias,
                              materialImageUrl: line.materialImageUrl,
                            }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(line.color || '待补')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.requiredGarmentQty)} 件`, `${formatQty(line.requiredGarmentQty)} 件 = 当前行需求成衣件数`, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.actualCutGarmentQty)} 件`, line.actualCutGarmentQtyFormula, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.shortageGarmentQty)} 件`, line.shortageGarmentQtyFormula, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${formatLength(line.claimedLengthTotal)}</td>
                            <td class="px-3 py-3">${formatLength(line.actualLengthTotal)}</td>
                            <td class="px-3 py-3">${renderStatusBadge(
                              warningLevel,
                              warningLevel === '高' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
                            )}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(line.suggestedAction, line.suggestedActionRuleText, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">
                              <button
                                type="button"
                                class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                                data-cutting-marker-action="launch-line-replenishment"
                                data-session-id="${escapeHtml(session.spreadingSessionId)}"
                                data-cut-order-id="${escapeHtml(line.cutOrderId)}"
                                data-cut-order-no="${escapeHtml(line.cutOrderNo)}"
                                data-material-sku="${escapeHtml(line.materialSku)}"
                                data-color="${escapeHtml(line.color || '')}"
                              >
                                发起补料
                              </button>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">当前没有可展示的差异处理项。</td></tr>'
              }
            </tbody>
          </table>
          </div>
        </details>
      `,
    )

  const content =
    state.spreadingEditTab === 'rolls'
      ? renderRollsTab()
      : state.spreadingEditTab === 'operators'
        ? renderOperatorsTab()
        : state.spreadingEditTab === 'variance'
          ? renderVarianceTab()
          : renderSummaryTab()

  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-detail-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">返回列表</button>',
          `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(row.spreadingSessionId)}">去编辑</button>`,
          `${row.session.markerId ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-detail" data-marker-id="${escapeHtml(row.session.markerId)}">去来源唛架编号</button>` : ''}`,
          `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-cut-orders" data-session-id="${escapeHtml(row.spreadingSessionId)}">去来源裁片单</button>`,
          `${row.markerPlanNo ? `<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-marker-plan" data-session-id="${escapeHtml(row.spreadingSessionId)}">去来源唛架方案</button>` : ''}`,
        ])),
      })}
      ${renderTopInfo()}
      ${renderSpreadingEditTabNav(state.spreadingEditTab)}
      ${content}
    </div>
  `
}

function resolveSpreadingEditLifecycleState(draft: SpreadingSession): {
  mainStageLabel: string
  mainStageClassName: string
  cuttingStatusLabel: string
  cuttingStatusClassName: string
} {
  const mainStageMeta = deriveSpreadingListStatus(draft.status)
  const cuttingStatusMeta =
    draft.cuttingStatus || draft.status === 'DONE'
      ? deriveSpreadingCuttingStatus(draft.cuttingStatus || 'WAITING_CUTTING')
      : null

  return {
    mainStageLabel: mainStageMeta.label,
    mainStageClassName: mainStageMeta.className,
    cuttingStatusLabel: cuttingStatusMeta?.label || '',
    cuttingStatusClassName: cuttingStatusMeta?.className || '',
  }
}

function canEditSpreadingExecution(draft: SpreadingSession): boolean {
  return draft.status !== 'DRAFT' && draft.status !== 'TO_FILL'
}

function renderStartSpreadingGate(targetLabel: string): string {
  const session = state.spreadingDraft
  return `
    <div class="rounded-lg border border-dashed bg-muted/10 px-4 py-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-muted-foreground">开始铺布后录入${escapeHtml(targetLabel)}。</div>
        ${session ? renderStartSpreadingControls(session.spreadingSessionId, session.cuttingTableId, session.ownerAccountId) : ''}
      </div>
    </div>
  `
}

function ensureCanEditCurrentSpreadingExecution(): boolean {
  if (!state.spreadingDraft || canEditSpreadingExecution(state.spreadingDraft)) return true
  state.feedback = { tone: 'warning', message: '请先点击开始铺布，再录入卷记录和换班与人员。' }
  return false
}

function renderSpreadingEditPage(): string {
  const pathname = getCurrentPathname()
  const fallbackMetaKey = pathname === getCanonicalCuttingPath('spreading-create') ? 'spreading-create' : 'spreading-edit'
  const meta = getCanonicalCuttingMeta(pathname, fallbackMetaKey)
  const draft = state.spreadingDraft || buildNewSpreadingDraft()
  const data = readMarkerSpreadingPrototypeData()
  const primaryRows = draft.cutOrderIds.map((id) => data.rowsById[id]).filter((row): row is (typeof data.rows)[number] => Boolean(row))
  const linkedCutOrderNos = draft.cutOrderIds.map((id) => data.rowsById[id]?.cutOrderNo || id).filter(Boolean)
  const productionOrderNos = Array.from(new Set(primaryRows.map((row) => row.productionOrderNo).filter(Boolean)))
  const derived = resolveSpreadingDerivedState(draft)
  const linkedMarker = derived.markerRecord
  const markerTotalPieces = derived.markerTotalPieces
  const rollSummary = derived.rollSummary
  const varianceSummary = derived.varianceSummary
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: draft.rolls,
    importSourceColorSummary: draft.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((row) => row.color),
    fallbackSummary: draft.colorSummary,
  })
  const theoreticalSpreadTotalLength = Number(linkedMarker?.spreadTotalLength ?? draft.theoreticalSpreadTotalLength ?? 0)
  const theoreticalActualCutPieceQty =
    varianceSummary?.theoreticalCutGarmentQty ??
    computeSessionPlannedCutGarmentQty(draft, markerTotalPieces)
  const replenishmentWarning = buildSpreadingReplenishmentPreview(draft, linkedCutOrderNos, derived)
  const handoverSummaryByRollId = buildRollHandoverSummaryMap(draft, derived.markerTotalPieces)
  const lifecycleState = resolveSpreadingEditLifecycleState(draft)
  const plannedSpreadLengthM = (draft.planUnits || []).reduce((sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0), 0)
  const plannedSpreadLengthFormula = buildSumFormula(
    plannedSpreadLengthM,
    (draft.planUnits || []).map((unit) => Number(unit.plannedSpreadLengthM || 0)),
    2,
  )
  const plannedLayerTotal = Math.max(Number(draft.plannedLayers || linkedMarker?.plannedLayerCount || 0), 0)
  const actualLayerTotal = Math.max(Number(rollSummary.totalLayers || draft.actualLayers || 0), 0)
  const plannedUsageLengthM = theoreticalSpreadTotalLength || plannedSpreadLengthM
  const actualUsageLengthM = rollSummary.totalActualLength

  const renderTopInfo = (): string => `
    <section class="rounded-lg border bg-card px-2 py-1.5">
      <div class="space-y-2">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div><div class="text-[11px] text-muted-foreground">铺布编号</div><div class="mt-0.5 text-sm font-semibold text-foreground">${escapeHtml(draft.sessionNo || '待补')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">来源唛架编号</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(draft.sourceBedNo || draft.markerNo || '未关联唛架编号')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">裁片单 / 唛架方案</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(linkedCutOrderNos.join(' / ') || draft.markerPlanNo || '—')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">生产单</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(productionOrderNos.join(' / ') || '—')}</div></div>
            <div><div class="text-[11px] text-muted-foreground">模式</div><div class="mt-0.5 text-sm font-medium text-foreground">${escapeHtml(deriveSpreadingModeMeta(draft.spreadingMode).label)}</div></div>
          </div>
          <div class="flex flex-wrap gap-1">
            ${renderStatusBadge(lifecycleState.mainStageLabel, lifecycleState.mainStageClassName)}
            ${lifecycleState.cuttingStatusLabel ? renderStatusBadge(lifecycleState.cuttingStatusLabel, lifecycleState.cuttingStatusClassName) : ''}
          </div>
        </div>
        <div class="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-6">
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(plannedLayerTotal)} 层`, `${formatQty(plannedLayerTotal)} 层 = 唛架方案计划层数`)}<div class="mt-0.5 text-[11px] text-muted-foreground">计划层数</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(actualLayerTotal)} 层`, buildLayerSumFormula(actualLayerTotal, draft.rolls.map((roll) => roll.layerCount)))}<div class="mt-0.5 text-[11px] text-muted-foreground">实铺层数</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(formatLength(plannedUsageLengthM), theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula)}<div class="mt-0.5 text-[11px] text-muted-foreground">计划用量</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(formatLength(actualUsageLengthM), buildSumFormula(actualUsageLengthM, draft.rolls.map((roll) => roll.actualLength), 2))}<div class="mt-0.5 text-[11px] text-muted-foreground">实际用量</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`, varianceSummary?.plannedCutGarmentQtyFormula || buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, draft.plannedLayers || 0, markerTotalPieces))}<div class="mt-0.5 text-[11px] text-muted-foreground">计划数量</div></div>
          <div class="rounded-md border bg-background px-2.5 py-1.5">${renderValueWithFormula(`${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`, varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []))}<div class="mt-0.5 text-[11px] text-muted-foreground">实际裁剪数量</div></div>
        </div>
        ${draft.status === 'DRAFT' ? `<div class="rounded-lg border bg-blue-50/40 px-3 py-3">${renderStartSpreadingControls(draft.spreadingSessionId, draft.cuttingTableId, draft.ownerAccountId)}</div>` : ''}
      </div>
    </section>
  `

  const renderSummaryTab = (): string =>
    renderSection(
      '执行摘要',
      `
        ${renderInfoGrid([
          {
            label: '计划层数',
            value: `${formatQty(plannedLayerTotal)} 层`,
            formula: `${formatQty(plannedLayerTotal)} 层 = 唛架方案计划层数`,
          },
          {
            label: '实铺层数',
            value: `${formatQty(actualLayerTotal)} 层`,
            formula: buildLayerSumFormula(actualLayerTotal, draft.rolls.map((roll) => roll.layerCount)),
          },
          {
            label: '计划数量',
            value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`,
            formula:
              varianceSummary?.plannedCutGarmentQtyFormula ||
              buildTheoreticalActualCutQtyFormula(varianceSummary?.plannedCutGarmentQty || 0, draft.plannedLayers || 0, markerTotalPieces),
          },
          {
            label: '理论裁剪成衣件数（件）',
            value: `${formatQty(theoreticalActualCutPieceQty)} 件`,
            formula:
              varianceSummary?.theoreticalCutGarmentQtyFormula ||
              buildTheoreticalActualCutQtyFormula(theoreticalActualCutPieceQty, draft.plannedLayers || 0, markerTotalPieces),
          },
          {
            label: '实际裁剪数量',
            value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []),
          },
          {
            label: '差异成衣件数（件）',
            value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} 件`,
            formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0),
          },
          {
            label: '计划用量',
            value: formatLength(plannedUsageLengthM),
            formula: theoreticalSpreadTotalLength > 0 ? buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) : plannedSpreadLengthFormula,
          },
          {
            label: '实际用量',
            value: formatLength(actualUsageLengthM),
            formula: buildSumFormula(actualUsageLengthM, draft.rolls.map((roll) => roll.actualLength), 2),
          },
          {
            label: '总净可用长度（m）',
            value: formatLength(varianceSummary?.spreadUsableLengthM || rollSummary.totalCalculatedUsableLength),
            formula:
              varianceSummary?.spreadUsableLengthFormula ||
              buildSumFormula(rollSummary.totalCalculatedUsableLength, draft.rolls.map((roll) => computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)), 2),
          },
          {
            label: '裁床已领长度（m）',
            value: formatLength(varianceSummary?.claimedLengthTotal || 0),
            formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = Σ 裁床已领长度`,
          },
          {
            label: '差异长度（m）',
            value: formatLength(varianceSummary?.varianceLength || 0),
            formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(varianceSummary?.varianceLength || 0, varianceSummary?.claimedLengthTotal || 0, rollSummary.totalActualLength, 2),
          },
        ])}
        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          ${renderReadonlyField('裁床', draft.cuttingTableName || draft.cuttingTableNo || '—')}
          ${renderReadonlyField('实际开始时间', formatScheduleDateTime(draft.actualStartAt))}
          ${renderReadonlyField('实际结束时间', formatScheduleDateTime(draft.actualEndAt))}
          ${renderReadonlyField('负责人', draft.ownerName || '未分配')}
        </div>
        <div class="mt-3">
          ${renderTextarea('Session 备注', draft.note || '', 'data-cutting-spreading-draft-field="note"', 3)}
        </div>
      `,
    )

  const renderRollsTab = (): string =>
    renderSection(
      '卷记录',
      `
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-roll">新增卷记录</button>
            <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="sync-spreading-rolls-from-pda">同步回写</button>
          </div>
        </div>
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">唛架项</th>
                <th class="px-3 py-3">卷号</th>
                <th class="px-3 py-3">面料</th>
                <th class="px-3 py-3">颜色</th>
                <th class="px-3 py-3">标注长度（m）</th>
                <th class="px-3 py-3">实际铺布长度（m）</th>
                <th class="px-3 py-3">布头长度（m）</th>
                <th class="px-3 py-3">布尾长度（m）</th>
                <th class="px-3 py-3">铺布层数（层）</th>
                <th class="px-3 py-3">净可用长度（m）</th>
                <th class="px-3 py-3">剩余长度（m）</th>
                <th class="px-3 py-3">实际裁剪成衣件数（件）</th>
                <th class="px-3 py-3">录入来源</th>
                <th class="px-3 py-3">记录时间</th>
                <th class="px-3 py-3">备注</th>
                <th class="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                draft.rolls.length
                  ? draft.rolls
                      .map((roll, index) => {
                        const planUnit = findSpreadingPlanUnitById(draft.planUnits, roll.planUnitId)
                        const garmentQtyPerUnit = planUnit?.garmentQtyPerUnit || 0
                        const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)
                        const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength)
                        const actualCutGarmentQty = computeRollActualCutGarmentQty(roll.layerCount, garmentQtyPerUnit)
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                                <select class="h-8 w-52 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="planUnitId">
                                <option value="">请选择唛架项</option>
                                ${(draft.planUnits || [])
                                  .map(
                                    (unit) =>
                                      `<option value="${escapeHtml(unit.planUnitId)}" ${unit.planUnitId === (roll.planUnitId || '') ? 'selected' : ''}>${escapeHtml(buildSpreadingPlanUnitLabel(unit))}</option>`,
                                  )
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.rollNo)}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="rollNo" /></td>
                            <td class="px-3 py-3 text-muted-foreground">${renderMaterialIdentityBlock({
                              materialSku: planUnit?.materialSku || roll.materialSku || '—',
                              materialLabel: planUnit?.materialSku || roll.materialSku || '—',
                              materialAlias: planUnit?.materialAlias || '',
                              materialImageUrl: planUnit?.materialImageUrl || '',
                            }, { compact: true })}</td>
                            <td class="px-3 py-3 text-muted-foreground">${escapeHtml(planUnit?.color || roll.color || '—')}</td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.labeledLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="labeledLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.actualLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="actualLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.headLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="headLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.tailLength || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="tailLength" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(String(roll.layerCount || 0))}" class="h-8 w-24 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="layerCount" /></td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(usableLength), buildRollUsableLengthFormula(roll.actualLength, roll.headLength, roll.tailLength, usableLength), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(formatLength(remainingLength), buildRemainingLengthFormula(roll.labeledLength, roll.actualLength, remainingLength), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(actualCutGarmentQty)} 件`, buildRollActualCutGarmentQtyFormula(actualCutGarmentQty, roll.layerCount, garmentQtyPerUnit), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(getSourceChannelDisplayLabel(roll.sourceChannel))}</td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.occurredAt || '')}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="occurredAt" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(roll.note || '')}" class="h-8 w-40 rounded-md border px-2.5 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="note" /></td>
                            <td class="px-3 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="duplicate-roll" data-index="${index}">复制卷记录</button>
                                <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-roll" data-index="${index}">删除卷记录</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="16" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有卷记录，请先新增卷记录并绑定唛架项。</td></tr>'
              }
            </tbody>
          </table>
        </div>
        ${renderSpreadingOutputMatrix(draft.spreadingSessionId)}
      `,
    )

  const renderOperatorsTab = (): string =>
    renderSection(
      '换班与人员',
      `
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="add-operator">新增人员记录</button>
        </div>
        <details open class="rounded-md border bg-background" data-testid="cutting-spreading-edit-operators-fold" data-default-open="open">
          <summary class="cursor-pointer px-3 py-3 text-sm font-medium text-foreground">换班明细摘要</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-[1560px] text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">所属卷</th>
                <th class="px-3 py-3">操作账号</th>
                <th class="px-3 py-3">操作人</th>
                <th class="px-3 py-3">动作类型</th>
                <th class="px-3 py-3">开始层</th>
                <th class="px-3 py-3">结束层</th>
                <th class="px-3 py-3">负责层数（层）</th>
                <th class="px-3 py-3">负责成衣件数（件）</th>
                <th class="px-3 py-3">负责长度（m）</th>
                <th class="px-3 py-3">接手人账号</th>
                <th class="px-3 py-3">记录时间</th>
                <th class="px-3 py-3">备注</th>
                <th class="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                draft.operators.length
                  ? draft.operators
                      .map((operator, index) => {
                        const linkedRoll = draft.rolls.find((roll) => roll.rollRecordId === operator.rollRecordId) || null
                        const linkedUnit = linkedRoll ? findSpreadingPlanUnitById(draft.planUnits, linkedRoll.planUnitId) : null
                        const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
                        const handledGarmentQty = computeOperatorHandledGarmentQty(handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0)
                        const handledLength = computeOperatorHandledLengthByRoll(handledLayerCount, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0)
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">
                                <select class="h-8 w-44 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="rollRecordId">
                                <option value="">请选择卷</option>
                                ${draft.rolls
                                  .map(
                                    (roll) =>
                                      `<option value="${escapeHtml(roll.rollRecordId)}" ${roll.rollRecordId === (operator.rollRecordId || '') ? 'selected' : ''}>${escapeHtml(roll.rollNo || '未命名卷')}</option>`,
                                  )
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.operatorAccountId || '')}" class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorAccountId" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.operatorName || '')}" class="h-8 w-28 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorName" /></td>
                            <td class="px-3 py-3">
                              <select class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="actionType">
                                ${['开始铺布', '中途交接', '接手继续', '完成铺布']
                                  .map((actionType) => `<option value="${escapeHtml(actionType)}" ${actionType === operator.actionType ? 'selected' : ''}>${escapeHtml(actionType)}</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(operator.startLayer === undefined ? '' : String(operator.startLayer))}" class="h-8 w-20 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startLayer" /></td>
                            <td class="px-3 py-3"><input type="number" value="${escapeHtml(operator.endLayer === undefined ? '' : String(operator.endLayer))}" class="h-8 w-20 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endLayer" /></td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLayerCount === null ? '待录入' : `${formatQty(handledLayerCount)} 层`, buildOperatorHandledLayerFormula(handledLayerCount, operator.startLayer, operator.endLayer), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledGarmentQty === null ? '待录入' : `${formatQty(handledGarmentQty)} 件`, buildOperatorHandledGarmentQtyFormula(handledGarmentQty, handledLayerCount, linkedUnit?.garmentQtyPerUnit || 0), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(handledLength === null ? '待录入' : formatLength(handledLength), buildOperatorHandledLengthFormula(handledLength, linkedRoll?.actualLength || 0, linkedRoll?.layerCount || 0, handledLayerCount), 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.nextOperatorAccountId || '')}" class="h-8 w-32 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="nextOperatorAccountId" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.endAt || '')}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endAt" /></td>
                            <td class="px-3 py-3"><input type="text" value="${escapeHtml(operator.note || '')}" class="h-8 w-36 rounded-md border px-2.5 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="note" /></td>
                            <td class="px-3 py-3"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-operator" data-index="${index}">删除</button></td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="13" class="px-3 py-6 text-center text-xs text-muted-foreground">当前还没有换班与人员记录。</td></tr>'
              }
            </tbody>
          </table>
          </div>
        </details>
        <div class="mt-2.5 space-y-2">
          ${
            Object.values(handoverSummaryByRollId).length
              ? Object.values(handoverSummaryByRollId)
                  .map(
                    (summary) => `
                      <div class="rounded-lg border bg-muted/10 p-2.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="text-sm font-medium text-foreground">卷 ${escapeHtml(summary.rollNo || '待补')}</div>
                          ${renderRollHandoverStatus(summary)}
                        </div>
                        <div class="mt-3">${renderRollHandoverWarnings(summary)}</div>
                      </div>
                    `,
                  )
                  .join('')
              : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前还没有卷级换班记录。</div>'
          }
        </div>
      `,
    )

  const renderVarianceTab = (): string =>
    renderSection(
      '差异与补料',
      `
        ${renderInfoGrid([
          {
            label: '需求成衣件数（件）',
            value: `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.plannedCutGarmentQtyFormula || `${formatQty(varianceSummary?.plannedCutGarmentQty || 0)} 件 = 当前需求成衣件数`,
          },
          {
            label: '实际裁剪成衣件数（件）',
            value: `${formatQty(varianceSummary?.actualCutGarmentQty || 0)} 件`,
            formula: varianceSummary?.actualCutGarmentQtyFormula || buildQtySumFormula(0, []),
          },
          {
            label: '差异成衣件数（件）',
            value: `${formatQty(varianceSummary?.shortageGarmentQty || 0)} 件`,
            formula: varianceSummary?.shortageGarmentQtyFormula || buildShortageQtyFormula(0, 0, 0),
          },
          {
            label: '裁床已领长度（m）',
            value: formatLength(varianceSummary?.claimedLengthTotal || 0),
            formula: `${Number(varianceSummary?.claimedLengthTotal || 0).toFixed(2)} = Σ 裁床已领长度`,
          },
          {
            label: '实际铺布长度（m）',
            value: formatLength(varianceSummary?.spreadActualLengthM || 0),
            formula: buildSumFormula(rollSummary.totalActualLength, draft.rolls.map((roll) => roll.actualLength), 2),
          },
          {
            label: '差异长度（m）',
            value: formatLength(varianceSummary?.varianceLength || 0),
            formula: varianceSummary?.varianceLengthFormula || buildDifferenceFormula(0, 0, 0, 2),
          },
        ])}
        <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-foreground">差异处理项</h4>
          <button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(draft.spreadingSessionId)}">去补料管理</button>
        </div>
        <details class="mt-2 rounded-md border bg-background" data-testid="cutting-spreading-edit-replenishment-fold" data-default-open="collapsed">
          <summary class="cursor-pointer px-3 py-3 text-sm font-medium text-foreground">差异处理摘要</summary>
          <div class="border-t overflow-auto">
          <table class="w-full min-w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th class="px-3 py-3">裁片单</th>
                <th class="px-3 py-3">面料</th>
                <th class="px-3 py-3">颜色</th>
                <th class="px-3 py-3">需求成衣件数（件）</th>
                <th class="px-3 py-3">实际裁剪成衣件数（件）</th>
                <th class="px-3 py-3">差异成衣件数（件）</th>
                <th class="px-3 py-3">裁床已领长度（m）</th>
                <th class="px-3 py-3">实际铺布长度（m）</th>
                <th class="px-3 py-3">预警等级</th>
                <th class="px-3 py-3">建议动作</th>
                <th class="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                replenishmentWarning.lines.length
                  ? replenishmentWarning.lines
                      .map((line) => {
                        const warningLevel = line.shortageGarmentQty > 0 || line.actualLengthTotal > line.claimedLengthTotal ? '高' : '低'
                        return `
                          <tr class="border-b align-top">
                            <td class="px-3 py-3">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</td>
                            <td class="px-3 py-3">${renderMaterialIdentityBlock({
                              materialSku: line.materialSku,
                              materialLabel: line.materialSku,
                              materialAlias: line.materialAlias,
                              materialImageUrl: line.materialImageUrl,
                            }, { compact: true })}</td>
                            <td class="px-3 py-3">${escapeHtml(line.color || '待补')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.requiredGarmentQty)} 件`, `${formatQty(line.requiredGarmentQty)} 件 = 当前行需求成衣件数`, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.actualCutGarmentQty)} 件`, line.actualCutGarmentQtyFormula, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(`${formatQty(line.shortageGarmentQty)} 件`, line.shortageGarmentQtyFormula, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">${formatLength(line.claimedLengthTotal)}</td>
                            <td class="px-3 py-3">${formatLength(line.actualLengthTotal)}</td>
                            <td class="px-3 py-3">${renderStatusBadge(
                              warningLevel,
                              warningLevel === '高' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
                            )}</td>
                            <td class="px-3 py-3">${renderValueWithFormula(line.suggestedAction, line.suggestedActionRuleText, 'text-sm text-foreground')}</td>
                            <td class="px-3 py-3">
                              <button
                                type="button"
                                class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                                data-cutting-marker-action="launch-line-replenishment"
                                data-session-id="${escapeHtml(draft.spreadingSessionId)}"
                                data-cut-order-id="${escapeHtml(line.cutOrderId)}"
                                data-cut-order-no="${escapeHtml(line.cutOrderNo)}"
                                data-material-sku="${escapeHtml(line.materialSku)}"
                                data-color="${escapeHtml(line.color || '')}"
                              >
                                发起补料
                              </button>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
                  : '<tr><td colspan="11" class="px-3 py-6 text-center text-xs text-muted-foreground">当前没有可展示的差异处理项。</td></tr>'
              }
            </tbody>
          </table>
          </div>
        </details>
      `,
    )

  const content =
    state.spreadingEditTab === 'rolls'
      ? renderRollsTab()
      : state.spreadingEditTab === 'operators'
        ? renderOperatorsTab()
        : state.spreadingEditTab === 'variance'
          ? renderVarianceTab()
          : renderSummaryTab()

  const headerActions = renderHeaderActions([
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list">返回列表</button>',
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="save-spreading">保存草稿</button>',
    '',
    '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="complete-spreading">完成铺布</button>',
  ])

  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-edit-page">
      ${renderCuttingPageHeader(meta, { actionsHtml: headerActions })}
      ${renderFeedbackBar()}
      ${renderTopInfo()}
      ${renderSpreadingEditTabNav(state.spreadingEditTab)}
      ${content}
    </div>
  `
}

function renderSpreadingCreateStepBar(): string {
  const steps: Array<{ key: SpreadingCreateStepKey; label: string }> = [
    { key: 'SELECT_MARKER', label: '步骤 1：选择可铺布唛架编号' },
    { key: 'CONFIRM_CREATE', label: '步骤 2：确认铺布单' },
  ]

  return `
    <section class="rounded-xl border bg-card p-3" data-testid="cutting-spreading-create-steps">
      <div class="flex flex-wrap gap-2">
        ${steps
          .map((step, index) => {
            const active = state.createStep === step.key
            return `
              <div class="inline-flex items-center gap-2 rounded-md border px-3 py-3 text-sm ${
                active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground'
              }">
                <span class="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full ${active ? 'bg-blue-600 text-white' : 'bg-muted text-foreground'} text-[11px] font-semibold">${index + 1}</span>
                <span>${escapeHtml(step.label)}</span>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSpreadingCreateSourceTable(rows: SpreadingCreateSourceRow[]): string {
  if (!rows.length) {
    return '<div class="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前没有可铺布的唛架编号，请先回到唛架方案补齐可铺布唛架编号。</div>'
  }
  const schemeRows = Array.from(
    rows.reduce<Map<string, SpreadingCreateSourceRow[]>>((accumulator, row) => {
      const key = row.sourceSchemeId || row.markerId
      if (!accumulator.has(key)) accumulator.set(key, [])
      accumulator.get(key)!.push(row)
      return accumulator
    }, new Map()).values(),
  ).map((items) => {
    const first = items[0]
    return {
      first,
      rows: items,
      totalQty: items.reduce((sum, item) => sum + Math.max(Number(item.plannedCutGarmentQty || 0), 0), 0),
      bedNos: items.map((item) => item.sourceBedNo).filter(Boolean),
    }
  })

  return `
    <div class="overflow-auto" data-testid="cutting-spreading-create-source-table">
      <table class="w-full min-w-[1080px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-3">选中</th>
            <th class="px-3 py-3">唛架方案</th>
            <th class="px-3 py-3">生产单 / 裁片单</th>
            <th class="px-3 py-3">款式 / SPU</th>
            <th class="px-3 py-3">颜色</th>
            <th class="px-3 py-3">唛架编号数量</th>
            <th class="px-3 py-3">计划件数</th>
            <th class="px-3 py-3">可铺布状态</th>
          </tr>
        </thead>
        <tbody>
          ${schemeRows
            .map(({ first: row, rows: groupRows, totalQty, bedNos }) => {
              const selected =
                row.markerId === state.selectedCreateMarkerId ||
                row.sourceBedId === state.selectedCreateMarkerId ||
                row.sourceSchemeId === state.selectedCreateMarkerId
              return `
                <tr class="border-b align-top ${selected ? 'bg-blue-50/40' : ''}">
                  <td class="px-3 py-3">
                    <button
                      type="button"
                      class="rounded-md border px-3 py-1.5 text-xs ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'hover:bg-muted'}"
                      data-cutting-marker-action="select-spreading-create-marker"
                      data-marker-id="${escapeHtml(row.sourceSchemeId || row.markerId)}"
                    >
                      ${selected ? '已选中' : '选中'}
                    </button>
                  </td>
                  <td class="px-3 py-3">
                    <div class="font-medium text-foreground">${escapeHtml(row.sourceSchemeNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(bedNos.slice(0, 4).join(' / ') || '待补唛架编号')}${bedNos.length > 4 ? ` 等 ${bedNos.length} 个` : ''}</div>
                  </td>
                  <td class="px-3 py-3">${escapeHtml(row.productionOrderNos.join(' / ') || row.cutOrderNos.join(' / ') || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(`${row.styleCode || '待补'} / ${row.spuCode || '待补'}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(row.colorSummary || '待补')}</td>
                  <td class="px-3 py-3">${escapeHtml(`${formatQty(groupRows.length)} 个`)}</td>
                  <td class="px-3 py-3">${escapeHtml(`${formatQty(totalQty)} 件`)}</td>
                  <td class="px-3 py-3">${renderTag('可铺布', 'bg-emerald-100 text-emerald-700 border border-emerald-200')}</td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSpreadingCreateSelectStep(rows: SpreadingCreateSourceRow[]): string {
  return renderSection(
    '步骤 1：选择可铺布唛架编号',
    `
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          ${renderTextInput('搜索唛架编号', state.keyword, 'data-cutting-spreading-list-field="keyword"', '唛架方案 / 唛架编号 / 生产单 / 款号 / 颜色')}
          <button type="button" class="h-10 rounded-md border px-3 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">重置</button>
        </div>
      `)}
      <div class="mt-3">
        ${renderSpreadingCreateSourceTable(rows)}
      </div>
    `,
  )
}

function renderSpreadingCreateConfirmStep(): string {
  const selectedSchemeRows = getSelectedCreateSchemeSources()
  const totalQty = selectedSchemeRows.reduce((sum, row) => sum + Math.max(Number(row.plannedCutGarmentQty || 0), 0), 0)
  return renderSection(
      '步骤 2：确认铺布单',
      `
        <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-foreground">
        将按已选唛架方案的 ${formatQty(selectedSchemeRows.length)} 个唛架编号生成 ${formatQty(selectedSchemeRows.length)} 张待铺布单。
      </div>
      <div class="mt-3 overflow-auto rounded-lg border">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-3">预计铺布单</th>
              <th class="px-3 py-3">唛架方案</th>
              <th class="px-3 py-3">唛架编号</th>
              <th class="px-3 py-3">状态</th>
              <th class="px-3 py-3">计划数量</th>
            </tr>
          </thead>
          <tbody>
            ${selectedSchemeRows
              .map((row, index) => {
                return `
                  <tr class="border-b align-top">
                    <td class="px-3 py-3 font-medium text-foreground">铺布单 ${index + 1}</td>
                    <td class="px-3 py-3">${escapeHtml(row.sourceSchemeNo || '待补')}</td>
                    <td class="px-3 py-3">${escapeHtml(row.sourceBedNo || row.markerNo || '待补')}</td>
                    <td class="px-3 py-3">${renderTag('待铺布', 'bg-slate-100 text-slate-700 border border-slate-200')}</td>
                    <td class="px-3 py-3">${escapeHtml(`${formatQty(row.plannedCutGarmentQty)} 件`)}</td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
          <tfoot class="bg-muted/20 text-sm font-medium">
            <tr>
              <td class="px-3 py-3" colspan="4">合计</td>
              <td class="px-3 py-3">${escapeHtml(`${formatQty(totalQty)} 件`)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `,
  )
}

function renderSpreadingCreatePage(): string {
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), 'spreading-create')
  const createRows = getSpreadingCreateSourceRows()
  const selectedSource = getSelectedCreateSource(createRows)
  const canProceed = Boolean(selectedSource) || state.createExceptionBackfill

  return `
    <div class="space-y-4 p-4" data-testid="cutting-spreading-create-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions([
          '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="go-list">返回列表</button>',
        ]),
      })}
      ${renderFeedbackBar()}
      ${renderSpreadingCreateStepBar()}
      ${
        state.createStep === 'SELECT_MARKER'
          ? renderSpreadingCreateSelectStep(createRows)
          : renderSpreadingCreateConfirmStep()
      }
      <section class="rounded-xl border bg-card p-4">
        <div class="flex flex-wrap justify-end gap-2">
          ${
            state.createStep !== 'SELECT_MARKER'
              ? '<button type="button" class="rounded-md border px-3 py-3 text-sm hover:bg-muted" data-cutting-marker-action="prev-spreading-create-step">上一步</button>'
              : ''
          }
          ${
            state.createStep === 'SELECT_MARKER'
              ? `<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white ${canProceed ? 'hover:bg-blue-700' : 'cursor-not-allowed opacity-50'}" data-cutting-marker-action="next-spreading-create-step" ${canProceed ? '' : 'disabled'}>下一步</button>`
              : '<button type="button" class="rounded-md bg-blue-600 px-3 py-3 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="confirm-spreading-create">确认生成铺布单</button>'
          }
        </div>
      </section>
    </div>
  `
}

function renderPage(): string {
  syncStateFromPath()
  const pathname = getCurrentPathname()

  if (pathname === getCanonicalCuttingPath('spreading-detail')) return renderSpreadingDetailPage()
  if (pathname === getCanonicalCuttingPath('spreading-edit')) return renderSpreadingEditPage()
  if (pathname === getCanonicalCuttingPath('spreading-create')) return renderSpreadingCreatePage()
  return renderSpreadingSupervisorListPage()
}

function buildListRoute(): string {
  return buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-list'), {
    cutOrderId: state.prefilter?.cutOrderId,
    cutOrderNo: state.prefilter?.cutOrderNo,
    markerPlanId: state.prefilter?.markerPlanId,
    markerPlanNo: state.prefilter?.markerPlanNo,
    productionOrderNo: state.prefilter?.productionOrderNo,
    styleCode: state.prefilter?.styleCode,
    materialSku: state.prefilter?.materialSku,
  })
}

function persistImportedDraftAndOpen(draft: SpreadingSession, successMessage: string): boolean {
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(draft, data.store)
  persistMarkerSpreadingStore(nextStore)
  state.feedback = { tone: 'success', message: successMessage }
  state.importDecision = null
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === draft.spreadingSessionId) || draft
  appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-edit'), buildContextPayloadFromSession(saved)))
  return true
}

function startMarkerImport(marker: MarkerRecord): boolean {
  const validation = validateMarkerForSpreadingImport(marker)
  if (!validation.allowed) {
    state.feedback = { tone: 'warning', message: validation.messages.join('；') }
    state.importDecision = null
    return true
  }

  const data = readMarkerSpreadingPrototypeData()
  const relatedSessions = data.store.sessions
    .filter((session) => session.markerId === marker.markerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
  const latestSession = relatedSessions[0] || null

  if (!latestSession) {
    const newDraft = createImportedSpreadingDraft(marker, {
      importNote: '首次从唛架导入铺布草稿。',
    })
    if (!newDraft) {
      state.feedback = { tone: 'warning', message: '当前唛架编号上下文不完整，无法生成铺布草稿。' }
      return true
    }
    return persistImportedDraftAndOpen(newDraft, `${marker.markerNo || '当前唛架编号'} 已生成铺布草稿。`)
  }

  if (!hasSpreadingActualExecution(latestSession)) {
    const syncedDraft = syncImportedFieldsToExistingSession(marker, latestSession)
    if (!syncedDraft) {
      state.feedback = { tone: 'warning', message: '当前铺布草稿无法同步唛架理论字段，请检查上下文。' }
      return true
    }
    return persistImportedDraftAndOpen(syncedDraft, `${latestSession.sessionNo || '当前铺布草稿'} 已按最新唛架模板同步。`)
  }

  state.importDecision = {
    markerId: marker.markerId,
    markerNo: marker.markerNo || marker.markerId,
    targetSessionId: latestSession.spreadingSessionId,
    targetSessionNo: latestSession.sessionNo || latestSession.spreadingSessionId,
  }
  state.feedback = { tone: 'warning', message: '检测到已有实际卷记录或人员记录，不能直接覆盖，请先选择再次导入策略。' }
  return true
}

function navigateToMarkerPage(target: 'detail' | 'edit', markerId: string | undefined): boolean {
  if (!markerId) return false
  const row = getMarkerRow(markerId)
  if (!row) return false
  const path =
    target === 'detail'
      ? `${getCanonicalCuttingPath('marker-detail')}/${encodeURIComponent(row.markerId)}`
      : `${getCanonicalCuttingPath('marker-edit')}/${encodeURIComponent(row.markerId)}`
  appStore.navigate(buildMarkerRouteWithContext(path, buildContextPayloadFromMarker(row.record)))
  return true
}

function navigateToSpreadingPage(target: 'detail' | 'edit', sessionId: string | undefined): boolean {
  if (!sessionId) return false
  const row = getSpreadingRow(sessionId)
  if (!row) return false
  const path = target === 'detail' ? getCanonicalCuttingPath('spreading-detail') : getCanonicalCuttingPath('spreading-edit')
  appStore.navigate(buildMarkerRouteWithContext(path, buildContextPayloadFromSession(row.session)))
  return true
}

function navigateFromSpreadingSession(sessionId: string | undefined, target: 'cut-orders' |  'marker-list'): boolean {
  if (!sessionId) return false
  const row = getSpreadingRow(sessionId)
  if (!row) return false
  const context = buildCuttingDrillContext(
    target === 'cut-orders'
      ? buildContextPayloadFromSession(row.session)
      : {
          markerPlanId: row.session.markerPlanId || undefined,
          markerPlanNo: row.session.markerPlanNo || undefined,
          cutOrderNo: row.cutOrderNos[0] || undefined,
          productionOrderNo: row.productionOrderNos[0] || undefined,
        },
    'spreading-list',
    {
      productionOrderNo: row.productionOrderNos[0] || undefined,
      cutOrderNo: row.cutOrderNos[0] || undefined,
      markerPlanId: row.session.markerPlanId || undefined,
      markerPlanNo: row.session.markerPlanNo || undefined,
      materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
      autoOpenDetail: true,
    },
  )
  appStore.navigate(buildCuttingRouteWithContext(target === 'cut-orders' ? 'cutOrders' : 'markerPlanSources', context))
  return true
}

function saveCurrentMarker(goDetail: boolean, successMessage?: string): boolean {
  const draft = state.markerDraft
  if (!draft) return false
  const templateType = deriveMarkerTemplateByMode(draft.markerMode)
  const data = readMarkerSpreadingPrototypeData()
  const sourceRows = buildMarkerAllocationSourceRows(draft, data.rowsById)
  const sourceRowsById = Object.fromEntries(sourceRows.map((row) => [row.cutOrderId, row]))

  const normalizedLineItems = (draft.lineItems || []).map((item, index) => ({
    ...item,
    markerId: draft.markerId,
    lineNo: item.lineNo || index + 1,
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || '',
    spreadRepeatCount: Number(item.spreadRepeatCount || 0),
    markerPieceCount: item.markerPieceCount ?? item.pieceCount ?? 0,
    pieceCount: item.markerPieceCount ?? item.pieceCount ?? 0,
    singlePieceUsage: item.singlePieceUsage || computeSinglePieceUsage(Number(item.markerLength || 0), Number(item.markerPieceCount ?? item.pieceCount ?? 0)),
    spreadTotalLength:
      Number((((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2))),
    spreadingTotalLength:
      Number((((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2))),
  }))
  const totalPieces = computeMarkerTotalPieces(draft.sizeDistribution)
  const normalizedHighLowCuttingRows = (draft.highLowCuttingRows || []).map((row) => ({
    ...row,
    markerId: draft.markerId,
    total: MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + Math.max(row.sizeValues[sizeKey] || 0, 0), 0),
  }))
  const patternKeys = draft.highLowPatternKeys?.length ? draft.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const normalizedHighLowPatternRows = (draft.highLowPatternRows || []).map((row) => ({
    ...row,
    markerId: draft.markerId,
    patternValues: Object.fromEntries(patternKeys.map((key) => [key, Number(row.patternValues[key] || 0)])),
    total: patternKeys.reduce((sum, key) => sum + Math.max(row.patternValues[key] || 0, 0), 0),
  }))
  const spreadTotalLength =
    templateType === 'row-template'
      ? computeNormalMarkerSpreadTotalLength(normalizedLineItems)
      : Number(draft.spreadTotalLength || draft.actualMaterialMeter || 0)
  const normalizedAllocationLines = (draft.allocationLines || []).map((line, index) => {
    const sourceRow = sourceRowsById[line.sourceCutOrderId] || null
    return applyAllocationSourceRowToLine(
      {
        ...line,
        allocationId: line.allocationId || `marker-allocation-${Date.now()}-${index}`,
        markerId: draft.markerId,
        plannedGarmentQty: Number(line.plannedGarmentQty || 0),
      },
      sourceRow
        ? {
            sourceCutOrderId: sourceRow.cutOrderId,
            sourceCutOrderNo: sourceRow.cutOrderNo,
            sourceProductionOrderId: sourceRow.productionOrderId,
            sourceProductionOrderNo: sourceRow.productionOrderNo,
            styleCode: sourceRow.styleCode,
            spuCode: sourceRow.spuCode,
            techPackSpuCode: sourceRow.techPackSpuCode || '',
            color: sourceRow.color,
            materialSku: sourceRow.materialSkuSummary,
            allocationSummaryText: '',
            allocationTotalQty: 0,
          }
        : null,
      draft,
    )
  })
  const sizeTotals = new Map<string, number>()
  normalizedAllocationLines.forEach((line) => {
    sizeTotals.set(line.sizeLabel, (sizeTotals.get(line.sizeLabel) || 0) + Math.max(line.plannedGarmentQty || 0, 0))
  })
  const blockingMessages: string[] = []
  if (draft.cutOrderIds.length > 0 && !normalizedAllocationLines.length) {
    blockingMessages.push('当前唛架编号已关联裁片单，请先补充分配明细。')
  }
  normalizedAllocationLines.forEach((line) => {
    if (!draft.cutOrderIds.includes(line.sourceCutOrderId)) {
      blockingMessages.push(`分配行 ${line.sourceCutOrderNo || line.allocationId} 不属于当前关联裁片单。`)
    }
    if (Number(line.plannedGarmentQty || 0) < 0) {
      blockingMessages.push(`分配行 ${line.sourceCutOrderNo || line.allocationId} 的计划成衣数不能小于 0。`)
    }
  })
  draft.sizeDistribution.forEach((item) => {
    if (item.quantity > 0 && (sizeTotals.get(item.sizeLabel) || 0) !== item.quantity) {
      blockingMessages.push(`尺码 ${item.sizeLabel} 尚未配平：配比 ${item.quantity}，分配 ${sizeTotals.get(item.sizeLabel) || 0}。`)
    }
  })
  if (blockingMessages.length) {
    state.feedback = { tone: 'warning', message: Array.from(new Set(blockingMessages)).join('；') }
    return true
  }
  const pieceExplosion = buildMarkerPieceExplosionViewModel({
    marker: {
      ...draft,
      allocationLines: normalizedAllocationLines,
    },
    sourceRows,
  })
  const warningMessages = buildMarkerWarningMessages({
    ...draft,
    totalPieces,
    spreadTotalLength,
    allocationLines: normalizedAllocationLines,
    lineItems: templateType === 'row-template' ? normalizedLineItems : [],
    highLowPatternKeys: templateType === 'matrix-template' ? patternKeys : [],
    highLowCuttingRows: templateType === 'matrix-template' ? normalizedHighLowCuttingRows : [],
    highLowPatternRows: templateType === 'matrix-template' ? normalizedHighLowPatternRows : [],
  })
  const mergedWarnings = Array.from(new Set([...warningMessages, ...pieceExplosion.mappingWarnings]))
  const nextStore = upsertMarkerRecord(
    {
      ...draft,
      cutOrderNos: draft.cutOrderNos || data.rows
        .filter((row) => draft.cutOrderIds.includes(row.cutOrderId))
        .map((row) => row.cutOrderNo),
      techPackSpuCode:
        (Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1
          ? Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0]
          : '') || draft.techPackSpuCode || '',
      totalPieces,
      singlePieceUsage: draft.singlePieceUsage || computeSinglePieceUsage(draft.netLength, totalPieces),
      sizeRatioPlanText:
        draft.sizeRatioPlanText ||
        draft.sizeDistribution
          .filter((item) => item.quantity > 0)
          .map((item) => `${item.sizeLabel}×${item.quantity}`)
          .join(' / '),
      spreadTotalLength,
      allocationLines: normalizedAllocationLines,
      lineItems: templateType === 'row-template' ? normalizedLineItems : [],
      highLowPatternKeys: templateType === 'matrix-template' ? patternKeys : [],
      highLowCuttingRows: templateType === 'matrix-template' ? normalizedHighLowCuttingRows : [],
      highLowPatternRows: templateType === 'matrix-template' ? normalizedHighLowPatternRows : [],
      warningMessages: mergedWarnings,
    },
    data.store,
  )
  persistMarkerSpreadingStore(nextStore)
  const saved = nextStore.markers.find((item) => item.markerId === draft.markerId) || draft
  state.markerDraft = ensureMarkerDraftShape(cloneMarkerRecord(saved))
  state.feedback = { tone: 'success', message: successMessage || `${saved.markerNo || '计划记录'} 已保存。` }

  if (goDetail) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('marker-detail'), buildContextPayloadFromMarker(saved)))
  }
  return true
}

function createOperatorDraftForRoll(session: SpreadingSession, rollRecordId: string): SpreadingOperatorRecord {
  const linkedOperators = session.operators
    .filter((operator) => operator.rollRecordId === rollRecordId)
    .sort((left, right) => {
      const startGap = (left.sortOrder || 0) - (right.sortOrder || 0)
      if (startGap !== 0) return startGap
      return left.startAt.localeCompare(right.startAt, 'zh-CN')
    })
  const previousOperator = linkedOperators[linkedOperators.length - 1] || null
  const nextDraft = {
    ...createOperatorRecordDraft(session.spreadingSessionId),
    sortOrder: session.operators.length + 1,
    rollRecordId,
    unitPrice: session.unitPrice,
    pricingMode: '按件计价' as SpreadingPricingMode,
  }

  if (!previousOperator) {
    return nextDraft
  }

  return {
    ...nextDraft,
    actionType: '接手继续',
    previousOperatorName: previousOperator.operatorName || '',
    startLayer: previousOperator.endLayer !== undefined ? Number(previousOperator.endLayer) + 1 : undefined,
    handoverAtLayer: previousOperator.endLayer,
    handoverAtLength: previousOperator.handledLength,
    handoverNotes: '',
  }
}

function cloneRollRecordForDraft(
  roll: SpreadingRollRecord,
  session: SpreadingSession,
  nextIndex: number,
): SpreadingRollRecord {
  const nextRoll = createRollRecordDraft(
    session.spreadingSessionId,
    roll.materialSku || session.materialSkuSummary?.split(' / ')[0] || '',
    roll.planUnitId || session.planUnits?.[0]?.planUnitId || '',
  )
  return {
    ...nextRoll,
    sortOrder: nextIndex + 1,
    planUnitId: roll.planUnitId || nextRoll.planUnitId,
    materialSku: roll.materialSku || nextRoll.materialSku,
    color: roll.color || '',
    labeledLength: roll.labeledLength,
    actualLength: roll.actualLength,
    headLength: roll.headLength,
    tailLength: roll.tailLength,
    layerCount: roll.layerCount,
    width: roll.width,
    note: roll.note,
  }
}

function syncDraftRollFromPlanUnit(draft: SpreadingSession, roll: SpreadingRollRecord): void {
  const linkedPlanUnit = findSpreadingPlanUnitById(draft.planUnits, roll.planUnitId)
  if (linkedPlanUnit) {
    roll.planUnitId = linkedPlanUnit.planUnitId
    roll.materialSku = linkedPlanUnit.materialSku
    roll.color = linkedPlanUnit.color
  }
  const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || 0
  roll.actualCutPieceQty = computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit)
}

function syncSpreadingDraftFromStoredPdaRuntimeEvent(draft: SpreadingSession): boolean {
  const stored = getStoredSpreadingSession(draft.spreadingSessionId)
  if (!stored) {
    state.feedback = { tone: 'warning', message: '当前铺布还没有可同步的工厂端执行记录。' }
    return true
  }
  const hasPdaSource =
    stored.rolls.some((roll) => isMobileWritebackSource(roll.sourceChannel, roll.sourceWritebackId)) ||
    stored.operators.some((operator) => isMobileWritebackSource(operator.sourceChannel, operator.sourceWritebackId))
  if (!hasPdaSource) {
    state.feedback = { tone: 'warning', message: '当前铺布还没有来自工厂端的卷或人员记录。' }
    return true
  }
  state.spreadingDraft = cloneSpreadingSession(stored)
  state.feedback = { tone: 'success', message: '已同步当前铺布的工厂端卷记录与换班记录。' }
  return true
}

function buildPersistableSpreadingDraft(draft: SpreadingSession): {
  normalizedDraft: SpreadingSession
  derived: ReturnType<typeof resolveSpreadingDerivedState>
  primaryRows: ReturnType<typeof readMarkerSpreadingPrototypeData>['rows']
} {
  const normalizeOptionalNumber = (value: number | string | undefined | null): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const derived = resolveSpreadingDerivedState(draft)
  const markerTotalPieces = derived.markerTotalPieces

  const normalizedRolls = draft.rolls.map((roll, index) => {
    const actualLength = Number(roll.actualLength || 0)
    const headLength = Number(roll.headLength || 0)
    const tailLength = Number(roll.tailLength || 0)
    const labeledLength = Number(roll.labeledLength || 0)
    const linkedPlanUnit = findSpreadingPlanUnitById(draft.planUnits, roll.planUnitId)
    const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || markerTotalPieces
    const usableLength = computeUsableLength(actualLength, headLength, tailLength)
    const remainingLength = computeRemainingLength(labeledLength, actualLength)
    const actualCutPieceQty = computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit)
    const operatorNames = draft.operators
      .filter((operator) => operator.rollRecordId === roll.rollRecordId)
      .map((operator) => operator.operatorName)
      .filter(Boolean)

    return {
      ...roll,
      planUnitId: roll.planUnitId || linkedPlanUnit?.planUnitId || '',
      materialSku: linkedPlanUnit?.materialSku || roll.materialSku,
      color: linkedPlanUnit?.color || roll.color,
      sortOrder: index + 1,
      totalLength: Number((actualLength + headLength + tailLength).toFixed(2)),
      remainingLength,
      usableLength,
      actualCutPieceQty,
      operatorNames,
    }
  })

  const actualCutPieceQty = normalizedRolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0)
  const baseOperators = draft.operators.map((operator, index) => ({
    ...operator,
    sortOrder: index + 1,
    startLayer: normalizeOptionalNumber(operator.startLayer),
    endLayer: normalizeOptionalNumber(operator.endLayer),
    handledLength: normalizeOptionalNumber(operator.handledLength),
    pricingMode: (operator.pricingMode || '按件计价') as SpreadingPricingMode,
    unitPrice: normalizeOptionalNumber(operator.unitPrice) ?? normalizeOptionalNumber(draft.unitPrice),
    manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
    adjustedAmount: normalizeOptionalNumber(operator.adjustedAmount),
    amountNote: operator.amountNote || '',
    nextOperatorAccountId: operator.nextOperatorAccountId || '',
    handoverFlag:
      operator.handoverFlag ||
      operator.actionType === '中途交接' ||
      operator.actionType === '接手继续' ||
      Boolean(operator.handoverNotes),
  }))
  const quantifiedOperatorsById = new Map<string, SpreadingOperatorRecord>()
  normalizedRolls.forEach((roll) => {
    const handoverSummary = buildRollHandoverViewModel(
      roll,
      baseOperators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
      markerTotalPieces,
    )
    handoverSummary.operators.forEach((item) => {
      quantifiedOperatorsById.set(item.operator.operatorRecordId, {
        ...item.operator,
        handledLayerCount: item.handledLayerCount ?? undefined,
        handledPieceQty: item.handledPieceQty ?? undefined,
        pricingMode: (item.operator.pricingMode || '按件计价') as SpreadingPricingMode,
        unitPrice: item.operator.unitPrice ?? normalizeOptionalNumber(draft.unitPrice) ?? undefined,
        calculatedAmount:
          computeOperatorCalculatedAmount({
            pricingMode: item.operator.pricingMode || '按件计价',
            unitPrice: item.operator.unitPrice ?? normalizeOptionalNumber(draft.unitPrice),
            handledLayerCount: item.handledLayerCount,
            handledLength: item.operator.handledLength,
            handledPieceQty: item.handledPieceQty,
          }) ?? undefined,
        manualAmountAdjusted: Boolean(item.operator.manualAmountAdjusted),
        adjustedAmount: item.operator.adjustedAmount ?? undefined,
        amountNote: item.operator.amountNote || '',
        nextOperatorAccountId: item.operator.nextOperatorAccountId || '',
        previousOperatorName: item.previousOperatorName || '',
        nextOperatorName: item.nextOperatorName || '',
        handoverAtLayer: item.handoverAtLayer ?? undefined,
        handoverAtLength: item.handoverAtLength ?? undefined,
      })
    })
  })
  const normalizedOperators = baseOperators.map((operator) => quantifiedOperatorsById.get(operator.operatorRecordId) || operator)
  const rollSummary = summarizeSpreadingRolls(normalizedRolls)
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(normalizedOperators, markerTotalPieces, draft.unitPrice)
  const data = readMarkerSpreadingPrototypeData()
  const primaryRows = draft.cutOrderIds.map((id) => data.rowsById[id]).filter((row): row is (typeof data.rows)[number] => Boolean(row))
  const colorSummaryDerived = deriveSpreadingColorSummary({
    rolls: normalizedRolls,
    importSourceColorSummary: draft.importSource?.sourceColorSummary,
    contextColors: primaryRows.map((row) => row.color),
    fallbackSummary: draft.colorSummary,
  })
  const varianceContext = primaryRows.length
    ? {
        contextType: draft.contextType,
        cutOrderIds: [...draft.cutOrderIds],
        cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
        markerPlanId: draft.markerPlanId,
        markerPlanNo: draft.markerPlanNo,
        productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
        styleCode: draft.styleCode || primaryRows[0].styleCode,
        spuCode: draft.spuCode || primaryRows[0].spuCode,
        styleName: primaryRows[0].styleName,
        materialSkuSummary: draft.materialSkuSummary || primaryRows[0].materialSkuSummary,
        materialAliasSummary: Array.from(new Set(primaryRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias)).filter(Boolean))).join(' / '),
        materialImageUrl: primaryRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || '',
        materialPrepRows: primaryRows,
      }
    : null
  const varianceSummary = buildSpreadingVarianceSummary(
    varianceContext,
    derived.markerRecord,
    {
      ...draft,
      rolls: normalizedRolls,
      operators: normalizedOperators,
      actualCutPieceQty,
    } as SpreadingSession,
  )
  const warningMessages = buildSpreadingWarningMessages({
    session: {
      ...draft,
      rolls: normalizedRolls,
      operators: normalizedOperators,
    },
    markerTotalPieces,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
  })
  const selectedTable = draft.cuttingTableId ? resolveCuttingTable(draft.cuttingTableId) : null
  const plannedStartAt = draft.plannedStartAt || ''
  const plannedEndAt =
    draft.plannedEndAt ||
    (plannedStartAt ? addMinutesToDateTimeLocal(plannedStartAt, draft.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES) : '')

  const normalizedDraft: SpreadingSession = {
    ...draft,
    cuttingTableId: selectedTable?.cuttingTableId || '',
    cuttingTableNo: selectedTable?.cuttingTableNo || '',
    cuttingTableName: selectedTable?.cuttingTableName || '',
    plannedStartAt,
    plannedEndAt,
    estimatedDurationMinutes: draft.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: plannedStartAt && selectedTable ? draft.tableScheduleStatus || '已排程' : draft.tableScheduleStatus || '未排程',
    colorSummary: colorSummaryDerived.value === '待补' ? '' : colorSummaryDerived.value,
    rolls: normalizedRolls,
    operators: normalizedOperators,
    actualCutPieceQty,
    totalActualLength: rollSummary.totalActualLength,
    totalHeadLength: rollSummary.totalHeadLength,
    totalTailLength: rollSummary.totalTailLength,
    totalCalculatedUsableLength: rollSummary.totalCalculatedUsableLength,
    totalRemainingLength: rollSummary.totalRemainingLength,
    rollCount: normalizedRolls.length,
    operatorCount: normalizedOperators.length,
    actualLayers: rollSummary.totalLayers,
    configuredLengthTotal: varianceSummary?.configuredLengthTotal || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
    varianceLength: varianceSummary?.varianceLength || 0,
    varianceNote: varianceSummary?.replenishmentHint || '当前尚未识别明显差异。',
    warningMessages,
    importSource: draft.importSource || null,
    planLineItems: draft.planLineItems || [],
    highLowPlanSnapshot: draft.highLowPlanSnapshot || null,
    theoreticalSpreadTotalLength: derived.markerRecord?.spreadTotalLength ?? draft.theoreticalSpreadTotalLength ?? 0,
    theoreticalActualCutPieceQty: computeSessionPlannedCutGarmentQty(draft, markerTotalPieces),
    importAdjustmentRequired: Boolean(draft.importAdjustmentRequired),
    importAdjustmentNote: draft.importAdjustmentNote || '',
    totalAmount:
      operatorAmountSummary.hasAnyAllocationData
        ? operatorAmountSummary.totalDisplayAmount
        : Number(((draft.unitPrice || 0) * actualCutPieceQty).toFixed(2)),
  }

  return {
    normalizedDraft,
    derived: resolveSpreadingDerivedState(normalizedDraft),
    primaryRows,
  }
}

function buildCreateSessionsFromSelection(): SpreadingSession[] | null {
  const preview = getSpreadingCreatePreview()

  if (state.createExceptionBackfill) {
    state.feedback = { tone: 'warning', message: '铺布必须选择一个可执行的唛架编号。' }
    return null
  }

  if (!preview.source || !preview.source.markerId) {
    state.feedback = { tone: 'warning', message: '创建铺布需先选中一个可铺布的唛架编号。' }
    return null
  }

  const selectedRows = getSelectedCreateSchemeSources()
  if (!selectedRows.length) {
    state.feedback = { tone: 'warning', message: '当前唛架方案没有可生成铺布任务的唛架编号。' }
    return null
  }

  const scheduleBatchId = `spreading-create-batch-${Date.now()}`
  const drafts: SpreadingSession[] = []

  for (let rowIndex = 0; rowIndex < selectedRows.length; rowIndex += 1) {
    const source = selectedRows[rowIndex]
    if (!source.spreadingContext || !source.markerRecord) {
      state.feedback = { tone: 'warning', message: `唛架编号 ${source.sourceBedNo || source.markerNo} 未识别到上下文，无法创建铺布。` }
      return null
    }
    const identity = buildSpreadingSessionIdentityForMarkerBed(source, rowIndex)

    const draft = createSpreadingDraftFromMarker(
      source.markerRecord,
      source.spreadingContext,
      new Date(Date.now() + rowIndex),
      {
        baseSession: {
          spreadingSessionId: identity.spreadingSessionId,
          sessionNo: identity.sessionNo,
          note: state.createNote || '铺布单已创建，待铺布。',
          ownerAccountId: '',
          ownerName: '',
          isExceptionBackfill: false,
          exceptionReason: '',
        },
      },
    )
    const bedNo = source.sourceBedNo || source.markerNo || draft.sourceBedNo || draft.markerNo || ''
    const bedId = source.sourceBedId || source.markerId || draft.sourceBedId || draft.sourceMarkerId || ''

    draft.status = 'DRAFT'
    draft.cuttingStatus = undefined
    draft.ownerAccountId = ''
    draft.ownerName = ''
    draft.note = state.createNote || draft.note
    draft.cuttingTableId = ''
    draft.cuttingTableNo = ''
    draft.cuttingTableName = ''
    draft.plannedStartAt = ''
    draft.plannedEndAt = ''
    draft.actualStartAt = ''
    draft.actualEndAt = ''
    draft.estimatedDurationMinutes = DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES
    draft.tableScheduleStatus = '未排程'
    draft.scheduleMode = 'BY_MARKER_NO'
    draft.scheduleBatchId = scheduleBatchId
    draft.sequenceNoInScheme = rowIndex + 1
    draft.sourceSchemeId = source.sourceSchemeId || draft.sourceSchemeId
    draft.sourceSchemeNo = source.sourceSchemeNo || draft.sourceSchemeNo
    draft.sourceBedId = bedId
    draft.sourceBedNo = bedNo
    draft.markerNo = bedNo
    draft.sourceMarkerNo = bedNo
    draft.theoreticalSpreadTotalLength = draft.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0,
    )
    draft.theoreticalActualCutPieceQty = draft.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0,
    )

    const plannedCutGarmentQty = (draft.planUnits || []).reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0,
    )
    const plannedSpreadLengthM = (draft.planUnits || []).reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0,
    )

    if (!draft.sourceMarkerId || !draft.sourceSchemeId || !draft.sourceBedId) {
      state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 未绑定来源唛架方案。` }
      return null
    }

    if (plannedCutGarmentQty <= 0) {
      state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 的计划成衣件数必须大于 0。` }
      return null
    }

    if (plannedSpreadLengthM <= 0) {
      state.feedback = { tone: 'warning', message: `唛架编号 ${bedNo || '待补'} 的计划铺布总长度必须大于 0。` }
      return null
    }

    drafts.push(draft)
  }

  return drafts
}

function confirmSpreadingCreate(): boolean {
  const drafts = buildCreateSessionsFromSelection()
  if (!drafts?.length) return true
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = drafts.reduce((store, draft) => upsertSpreadingSession(draft, store), data.store)
  persistMarkerSpreadingStore(nextStore)
  state.feedback = {
    tone: 'success',
    message: drafts.length === 1 ? `已创建待铺布单 ${drafts[0].sessionNo || ''}`.trim() : `已按唛架编号生成 ${drafts.length} 张待铺布单。`,
  }
  if (drafts.length === 1) {
    const saved = nextStore.sessions.find((item) => item.spreadingSessionId === drafts[0].spreadingSessionId) || drafts[0]
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-edit'), buildContextPayloadFromSession(saved)))
    return true
  }
  appStore.navigate(buildListRoute())
  return true
}

function saveCurrentSpreading(goDetail: boolean, successMessage?: string): boolean {
  const draft = state.spreadingDraft
  if (!draft) return false
  const { normalizedDraft } = buildPersistableSpreadingDraft(draft)
  const data = readMarkerSpreadingPrototypeData()
  if (hasCuttingTableScheduleConflict(normalizedDraft, data.store.sessions)) {
    state.feedback = { tone: 'warning', message: '该裁床当前时间段已有铺布任务。' }
    return true
  }
  const nextStore = upsertSpreadingSession(normalizedDraft, data.store)
  persistMarkerSpreadingStore(nextStore)
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === draft.spreadingSessionId) || normalizedDraft
  state.spreadingDraft = cloneSpreadingSession(saved)
  state.spreadingCompletionSelection =
    saved.contextType === 'marker-plan'
      ? [...(saved.completionLinkage?.linkedCutOrderIds || [])]
      : [...saved.cutOrderIds]
  state.feedback = { tone: 'success', message: successMessage || `${saved.sessionNo || '铺布 session'} 已保存。` }

  if (goDetail) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-detail'), buildContextPayloadFromSession(saved)))
  }
  return true
}

function completeCurrentSpreading(): boolean {
  const draft = state.spreadingDraft
  if (!draft) return false
  const { normalizedDraft, derived, primaryRows } = buildPersistableSpreadingDraft(draft)
  const linkedCutOrderIds = buildSpreadingCompletionTargetIds(normalizedDraft)
  const validation = validateSpreadingCompletion({
    session: normalizedDraft,
    markerTotalPieces: derived.markerTotalPieces,
    selectedCutOrderIds: linkedCutOrderIds,
  })

  if (!validation.allowed) {
    state.feedback = { tone: 'warning', message: validation.messages.join('；') }
    return true
  }

  const linkedCutOrderNos = primaryRows
    .filter((row) => linkedCutOrderIds.includes(row.cutOrderId))
    .map((row) => row.cutOrderNo)
  const completionContext =
    primaryRows.length > 0
      ? {
          contextType: normalizedDraft.contextType,
          cutOrderIds: [...normalizedDraft.cutOrderIds],
          cutOrderNos: primaryRows.map((row) => row.cutOrderNo),
          markerPlanId: normalizedDraft.markerPlanId,
          markerPlanNo: normalizedDraft.markerPlanNo,
          productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
          styleCode: normalizedDraft.styleCode || primaryRows[0].styleCode,
          spuCode: normalizedDraft.spuCode || primaryRows[0].spuCode,
          styleName: primaryRows[0].styleName,
          materialSkuSummary: normalizedDraft.materialSkuSummary || primaryRows[0].materialSkuSummary,
          materialAliasSummary: Array.from(new Set(primaryRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias)).filter(Boolean))).join(' / '),
          materialImageUrl: primaryRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || '',
          materialPrepRows: primaryRows,
        }
      : null
  const completedDraft = finalizeSpreadingCompletion({
    session: normalizedDraft,
    context: completionContext,
    linkedCutOrderIds,
    linkedCutOrderNos,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    markerTotalPieces: derived.markerTotalPieces,
    materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || '',
    warningMessages: derived.warningMessages,
    completedBy: '铺布编辑页',
  })
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(completedDraft, data.store)
  persistMarkerSpreadingStore(nextStore)
  const saved = nextStore.sessions.find((item) => item.spreadingSessionId === completedDraft.spreadingSessionId) || completedDraft
  state.spreadingDraft = cloneSpreadingSession(saved)
  state.spreadingCompletionSelection =
    saved.contextType === 'marker-plan'
      ? [...(saved.completionLinkage?.linkedCutOrderIds || [])]
      : [...saved.cutOrderIds]
  state.spreadingEditTab = 'completion'
  state.feedback = {
    tone: 'success',
    message: `已完成铺布，本铺布单裁剪状态已进入待裁剪；裁片单仅累计进度，不改变主状态。`,
  }
  return true
}

function persistCurrentSpreadingStatus(nextStatus: SpreadingStatusKey): boolean {
  const draft = state.spreadingDraft
  if (!draft) return false
  if (nextStatus === 'DONE') {
    state.feedback = {
      tone: 'warning',
      message: '已铺布状态只能通过“完成铺布”主按钮触发。',
    }
    return false
  }
  state.spreadingDraft = updateSessionStatus(draft, nextStatus)
  return saveCurrentSpreading(false, `当前铺布 session 已标记为“${deriveSpreadingStatus(nextStatus).label}”。`)
}

function startSpreadingSession(
  sessionId: string | null | undefined,
  openEdit = true,
  startConfig: { cuttingTableId?: string; ownerAccountId?: string } = {},
): boolean {
  const session = getStoredSpreadingSession(sessionId)
  if (!session) return false
  if (session.status === 'DONE') {
    state.feedback = { tone: 'warning', message: '当前铺布已完成，不能重新开始铺布。' }
    return true
  }
  const cuttingTableId = startConfig.cuttingTableId || session.cuttingTableId || ''
  const ownerAccountId = startConfig.ownerAccountId || session.ownerAccountId || ''
  if (!cuttingTableId || !ownerAccountId) {
    state.feedback = { tone: 'warning', message: '开始铺布前必须选择裁床和负责人。' }
    return true
  }
  const selectedTable = resolveCuttingTable(cuttingTableId)
  const ownerName = buildCreateOwnerLabel(ownerAccountId)

  const now = formatDateTimeLocal()
  const nextSession = {
    ...updateSessionStatus(session, 'IN_PROGRESS'),
    cuttingTableId: selectedTable.cuttingTableId,
    cuttingTableNo: selectedTable.cuttingTableNo,
    cuttingTableName: selectedTable.cuttingTableName,
    ownerAccountId,
    ownerName,
    actualStartAt: session.actualStartAt || now,
    updatedAt: now,
  }
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(nextSession, data.store)
  persistMarkerSpreadingStore(nextStore)
  if (state.spreadingDraft?.spreadingSessionId === nextSession.spreadingSessionId) {
    state.spreadingDraft = cloneSpreadingSession(nextSession)
  }
  state.feedback = { tone: 'success', message: '已开始铺布。' }
  if (openEdit) {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-edit'), buildContextPayloadFromSession(nextSession)))
  }
  return true
}

function startCurrentSpreading(): boolean {
  const controls = document.querySelector<HTMLElement>('[data-spreading-start-controls="true"]')
  const cuttingTableId = controls?.querySelector<HTMLSelectElement>('[data-cutting-spreading-start-field="cuttingTableId"]')?.value || ''
  const ownerAccountId = controls?.querySelector<HTMLSelectElement>('[data-cutting-spreading-start-field="ownerAccountId"]')?.value || ''
  return startSpreadingSession(state.spreadingDraft?.spreadingSessionId, false, { cuttingTableId, ownerAccountId })
}

function updateSpreadingCuttingStatus(sessionId: string | null | undefined, nextStatus: SpreadingCuttingStatusKey): boolean {
  const session = getStoredSpreadingSession(sessionId)
  if (!session) return false
  if (session.status !== 'DONE') {
    state.feedback = { tone: 'warning', message: '完成铺布后才能更新裁剪状态。' }
    return true
  }
  if (nextStatus === 'CUTTING' && session.cuttingStatus === 'CUTTING_DONE') {
    state.feedback = { tone: 'warning', message: '裁剪已完成，不能重新开始裁剪。' }
    return true
  }
  if (nextStatus === 'CUTTING_DONE' && session.cuttingStatus !== 'CUTTING') {
    state.feedback = { tone: 'warning', message: '开始裁剪后才能完成裁剪。' }
    return true
  }

  const now = formatDateTimeLocal()
  const nextSession: SpreadingSession = {
    ...session,
    cuttingStatus: nextStatus,
    cuttingStatusUpdatedAt: now,
    cuttingStartedAt:
      nextStatus === 'CUTTING'
        ? session.cuttingStartedAt || now
        : nextStatus === 'CUTTING_DONE'
          ? session.cuttingStartedAt || session.cuttingStatusUpdatedAt || now
          : session.cuttingStartedAt,
    cuttingFinishedAt: nextStatus === 'CUTTING_DONE' ? now : session.cuttingFinishedAt,
    updatedAt: now,
  }
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(nextSession, data.store)
  persistMarkerSpreadingStore(nextStore)
  state.feedback = { tone: 'success', message: `裁剪状态已更新为“${deriveSpreadingCuttingStatus(nextStatus).label}”。` }
  return true
}

function closeMarkerEditOverlay(): boolean {
  const markerId = getSearchParams().get('markerId')
  if (markerId) {
    const row = getMarkerRow(markerId)
    if (row) {
      appStore.navigate(
        buildMarkerRouteWithContext(
          `${getCanonicalCuttingPath('marker-detail')}/${encodeURIComponent(row.markerId)}`,
          buildContextPayloadFromMarker(row.record),
        ),
      )
      return true
    }
  }
  appStore.navigate(getCanonicalCuttingPath('marker-list'))
  return true
}

function closeSpreadingEditOverlay(): boolean {
  const sessionId = getSearchParams().get('sessionId')
  if (sessionId) {
    const row = getSpreadingRow(sessionId)
    if (row) {
      appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-detail'), buildContextPayloadFromSession(row.session)))
      return true
    }
  }
  appStore.navigate(buildListRoute())
  return true
}

export function renderCraftCuttingMarkerSpreadingPage(): string {
  const currentPath = appStore.getState().pathname
  const canonicalPath = buildCanonicalSpreadingListPathFromCurrentLocation()
  if (currentPath !== canonicalPath && getCurrentPathname() === getCanonicalCuttingPath('marker-spreading')) {
    queueMicrotask(() => {
      if (appStore.getState().pathname === currentPath) {
        appStore.navigate(canonicalPath)
      }
    })
    return `
      <div class="space-y-3 p-4">
        <div class="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">正在跳转到铺布单…</div>
      </div>
    `
  }
  return renderPage()
}

export function renderCraftCuttingSpreadingListPage(): string {
  return renderSpreadingSupervisorListPage()
}

export function renderCraftCuttingSpreadingCreatePage(): string {
  return renderPage()
}

export function renderCraftCuttingMarkerDetailPage(): string {
  return renderPage()
}

export function renderCraftCuttingMarkerEditPage(): string {
  return renderPage()
}

export function renderCraftCuttingSpreadingDetailPage(): string {
  return renderPage()
}

export function renderCraftCuttingSpreadingEditPage(): string {
  return renderPage()
}

export function handleCraftCuttingMarkerSpreadingEvent(target: Element): boolean {
  const spreadingListFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-list-field]')
  if (spreadingListFieldNode) {
    const field = spreadingListFieldNode.dataset.cuttingSpreadingListField
    const value = (spreadingListFieldNode as HTMLInputElement | HTMLSelectElement).value
    if (field === 'keyword') state.keyword = value
    if (field === 'context-no') state.contextNoFilter = value
    if (field === 'session-no') state.sessionNoFilter = value
    if (field === 'cut-order') state.cutOrderFilter = value
    if (field === 'marker-plan') state.markerPlanSourceFilter = value
    if (field === 'marker-no') state.markerNoFilter = value
    if (field === 'production-order') state.productionOrderFilter = value
    if (field === 'style-spu') state.styleSpuFilter = value
    if (field === 'material-sku') state.materialSkuFilter = value
    if (field === 'color') state.colorFilter = value
    if (field === 'mode') state.spreadingModeFilter = value as MarkerModeFilter
    if (field === 'context') state.contextTypeFilter = value as ContextTypeFilter
    if (field === 'main-stage') state.spreadingStageFilter = value as SpreadingStageFilter
    if (field === 'source-channel') state.sourceChannelFilter = value as SpreadingSourceFilter
    return true
  }

  const spreadingCreateFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-create-field]')
  if (spreadingCreateFieldNode) {
    const field = spreadingCreateFieldNode.dataset.cuttingSpreadingCreateField
    const value = (spreadingCreateFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
    if (field === 'exception-backfill') {
      state.createExceptionBackfill = value === 'true'
      if (!state.createExceptionBackfill) state.createExceptionReason = ''
      return true
    }
    if (field === 'exception-reason') {
      state.createExceptionReason = value
      return true
    }
    if (field === 'owner-account') {
      state.createOwnerAccountId = value
      getSelectedCreateSchemeSources().forEach((row, index) => {
        getCreateAssignment(row, index).ownerAccountId = value
      })
      return true
    }
    if (field === 'schedule-mode') {
      state.createScheduleMode = value === 'WHOLE_PLAN_ONE_TABLE' ? 'WHOLE_PLAN_ONE_TABLE' : 'BY_MARKER_NO'
      const selectedRows = getSelectedCreateSchemeSources()
      state.createAssignments = {}
      ensureCreateAssignments(selectedRows)
      return true
    }
    if (field === 'cutting-table-id') {
      state.createCuttingTableId = value
      getSelectedCreateSchemeSources().forEach((row, index) => {
        getCreateAssignment(row, index).cuttingTableId = value
      })
      return true
    }
    if (field === 'planned-start-at') {
      state.createPlannedStartAt = value
      getSelectedCreateSchemeSources().forEach((row, index) => {
        const assignment = getCreateAssignment(row, index)
        assignment.plannedStartAt =
          state.createScheduleMode === 'WHOLE_PLAN_ONE_TABLE'
            ? value
            : addMinutesToDateTimeLocal(value, index * DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES)
        assignment.plannedEndAt = addMinutesToDateTimeLocal(assignment.plannedStartAt, DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES)
      })
      return true
    }
    if (field === 'note') {
      state.createNote = value
      return true
    }
  }

  const spreadingCreateAssignmentNode = target.closest<HTMLElement>('[data-cutting-spreading-create-assignment-field]')
  if (spreadingCreateAssignmentNode) {
    const field = spreadingCreateAssignmentNode.dataset.cuttingSpreadingCreateAssignmentField as keyof SpreadingCreateAssignment | undefined
    const markerId = spreadingCreateAssignmentNode.dataset.markerId || ''
    if (!field || !markerId) return false
    const value = (spreadingCreateAssignmentNode as HTMLInputElement | HTMLSelectElement).value
    const selectedRows = getSelectedCreateSchemeSources()
    const rowIndex = selectedRows.findIndex((row) => getCreateAssignmentKey(row) === markerId)
    const row = selectedRows[rowIndex]
    if (!row) return false
    const assignment = getCreateAssignment(row, rowIndex)
    if (field === 'cuttingTableId') {
      const matchedAssignment = getLatestCreateAssignmentForCuttingTable(value, markerId)
      assignment.cuttingTableId = value
      if (matchedAssignment) {
        assignment.plannedStartAt = matchedAssignment.plannedStartAt
        assignment.plannedEndAt = matchedAssignment.plannedEndAt
        assignment.ownerAccountId = matchedAssignment.ownerAccountId
      }
      syncCreateAssignmentsByCuttingTable(value, {
        plannedStartAt: assignment.plannedStartAt,
        plannedEndAt: assignment.plannedEndAt,
        ownerAccountId: assignment.ownerAccountId,
      })
      return true
    }
    assignment[field] = value
    if (field === 'plannedStartAt' || field === 'plannedEndAt' || field === 'ownerAccountId') {
      syncCreateAssignmentsByCuttingTable(assignment.cuttingTableId, { [field]: value })
    }
    return true
  }

  const keywordNode = target.closest<HTMLElement>('[data-cutting-marker-field="keyword"]')
  if (keywordNode) {
    state.keyword = (keywordNode as HTMLInputElement).value
    return true
  }

  const markerModeFilterNode = target.closest<HTMLElement>('[data-cutting-marker-field="marker-mode-filter"]')
  if (markerModeFilterNode) {
    state.markerModeFilter = (markerModeFilterNode as HTMLSelectElement).value as MarkerModeFilter
    return true
  }

  const contextTypeFilterNode = target.closest<HTMLElement>('[data-cutting-marker-field="context-type-filter"]')
  if (contextTypeFilterNode) {
    state.contextTypeFilter = (contextTypeFilterNode as HTMLSelectElement).value as ContextTypeFilter
    return true
  }

  const adjustmentFilterNode = target.closest<HTMLElement>('[data-cutting-marker-field="adjustment-filter"]')
  if (adjustmentFilterNode) {
    state.adjustmentFilter = (adjustmentFilterNode as HTMLSelectElement).value as BooleanFilter
    return true
  }

  const imageFilterNode = target.closest<HTMLElement>('[data-cutting-marker-field="image-filter"]')
  if (imageFilterNode) {
    state.imageFilter = (imageFilterNode as HTMLSelectElement).value as BooleanFilter
    return true
  }

  const markerDraftFieldNode = target.closest<HTMLElement>('[data-cutting-marker-draft-field]')
  if (markerDraftFieldNode && state.markerDraft) {
    const field = markerDraftFieldNode.dataset.cuttingMarkerDraftField as MarkerDraftField | undefined
    if (!field) return false
    const value = (markerDraftFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
    if (field === 'markerMode') {
      state.markerDraft.markerMode = value as MarkerModeKey
      ensureMarkerDraftShape(state.markerDraft)
      return true
    }
    if (field === 'adjustmentRequired') {
      ;(state.markerDraft as Record<string, boolean>)[field] = value === 'true'
      return true
    }
    if (
      field === 'netLength' ||
      field === 'singlePieceUsage' ||
      field === 'spreadTotalLength' ||
      field === 'plannedLayerCount' ||
      field === 'plannedMarkerCount' ||
      field === 'markerLength' ||
      field === 'procurementUnitUsage' ||
      field === 'actualUnitUsage' ||
      field === 'plannedMaterialMeter' ||
      field === 'actualMaterialMeter' ||
      field === 'actualCutQty'
    ) {
      state.markerDraft[field] = Number(value) as never
      return true
    }
    state.markerDraft[field] = value as never
    return true
  }

  const markerSizeFieldNode = target.closest<HTMLElement>('[data-cutting-marker-size-field]')
  if (markerSizeFieldNode && state.markerDraft) {
    const index = Number(markerSizeFieldNode.dataset.cuttingMarkerSizeIndex)
    const field = markerSizeFieldNode.dataset.cuttingMarkerSizeField as MarkerSizeField | undefined
    if (Number.isNaN(index) || !field || !state.markerDraft.sizeDistribution[index]) return false
    if (field === 'quantity') {
      state.markerDraft.sizeDistribution[index].quantity = Number((markerSizeFieldNode as HTMLInputElement).value)
      return true
    }
    state.markerDraft.sizeDistribution[index].sizeLabel = (markerSizeFieldNode as HTMLInputElement).value
    return true
  }

  const markerAllocationFieldNode = target.closest<HTMLElement>('[data-cutting-marker-allocation-field]')
  if (markerAllocationFieldNode && state.markerDraft) {
    const index = Number(markerAllocationFieldNode.dataset.cuttingMarkerAllocationIndex)
    const field = markerAllocationFieldNode.dataset.cuttingMarkerAllocationField as MarkerAllocationField | undefined
    const allocationLine = state.markerDraft.allocationLines?.[index]
    if (Number.isNaN(index) || !field || !allocationLine) return false
    const value = (markerAllocationFieldNode as HTMLInputElement | HTMLSelectElement).value

    if (field === 'sourceCutOrderId') {
      const sourceRows = getMarkerDraftSourceRows(state.markerDraft)
      const sourceRow = sourceRows.find((row) => row.sourceCutOrderId === value) || null
      state.markerDraft.allocationLines![index] = applyAllocationSourceRowToLine(allocationLine, sourceRow, state.markerDraft)
      return true
    }

    if (field === 'plannedGarmentQty') {
      allocationLine.plannedGarmentQty = Number(value)
      return true
    }

    ;(allocationLine as Record<string, string>)[field] = value
    return true
  }

  const markerLineFieldNode = target.closest<HTMLElement>('[data-cutting-marker-line-field]')
  if (markerLineFieldNode && state.markerDraft) {
    const index = Number(markerLineFieldNode.dataset.cuttingMarkerLineIndex)
    const field = markerLineFieldNode.dataset.cuttingMarkerLineField as MarkerLineField | undefined
    const lineItem = state.markerDraft.lineItems?.[index]
    if (Number.isNaN(index) || !field || !lineItem) return false
    const value = (markerLineFieldNode as HTMLInputElement | HTMLSelectElement).value

    if (field === 'markerLength' || field === 'markerPieceCount' || field === 'singlePieceUsage' || field === 'spreadTotalLength' || field === 'spreadRepeatCount') {
      ;(lineItem as Record<string, number>)[field] = Number(value)
      if (field === 'markerPieceCount') {
        lineItem.pieceCount = Number(value)
      }
      if (field === 'spreadTotalLength') {
        lineItem.spreadingTotalLength = Number(value)
      }
      return true
    }

    if (field === 'layoutDetailText') {
      lineItem.layoutDetailText = value
      lineItem.ratioLabel = value
      return true
    }

    ;(lineItem as Record<string, string>)[field] = value
    return true
  }

  const highLowCuttingCellNode = target.closest<HTMLElement>('[data-cutting-marker-highlow-cutting-row-index]')
  if (highLowCuttingCellNode && state.markerDraft) {
    const rowIndex = Number(highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingRowIndex)
    const cuttingRow = state.markerDraft.highLowCuttingRows?.[rowIndex]
    if (Number.isNaN(rowIndex) || !cuttingRow) return false

    if (highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingColor === 'true') {
      cuttingRow.color = (highLowCuttingCellNode as HTMLInputElement).value
      cuttingRow.total = MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + Math.max(cuttingRow.sizeValues[sizeKey] || 0, 0), 0)
      return true
    }

    const sizeKey = highLowCuttingCellNode.dataset.cuttingMarkerHighlowCuttingSize as (typeof MARKER_SIZE_KEYS)[number] | undefined
    if (sizeKey) {
      cuttingRow.sizeValues[sizeKey] = Number((highLowCuttingCellNode as HTMLInputElement).value)
      cuttingRow.total = MARKER_SIZE_KEYS.reduce((sum, key) => sum + Math.max(cuttingRow.sizeValues[key] || 0, 0), 0)
      return true
    }
  }

  const highLowPatternKeyNode = target.closest<HTMLElement>('[data-cutting-marker-highlow-pattern-key-index]')
  if (highLowPatternKeyNode && state.markerDraft) {
    const patternIndex = Number(highLowPatternKeyNode.dataset.cuttingMarkerHighlowPatternKeyIndex)
    const nextKey = (highLowPatternKeyNode as HTMLInputElement).value.trim()
    const patternKeys = state.markerDraft.highLowPatternKeys || []
    const currentKey = patternKeys[patternIndex]
    if (Number.isNaN(patternIndex) || !currentKey || !nextKey || currentKey === nextKey) return Boolean(currentKey)
    state.markerDraft.highLowPatternKeys = patternKeys.map((key, index) => (index === patternIndex ? nextKey : key))
    state.markerDraft.highLowPatternRows = (state.markerDraft.highLowPatternRows || []).map((row) => {
      const nextValues = { ...row.patternValues, [nextKey]: row.patternValues[currentKey] || 0 }
      delete nextValues[currentKey]
      return { ...row, patternValues: nextValues }
    })
    return true
  }

  const highLowPatternCellNode = target.closest<HTMLElement>('[data-cutting-marker-highlow-pattern-row-index]')
  if (highLowPatternCellNode && state.markerDraft) {
    const rowIndex = Number(highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternRowIndex)
    const patternRow = state.markerDraft.highLowPatternRows?.[rowIndex]
    if (Number.isNaN(rowIndex) || !patternRow) return false

    if (highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternColor === 'true') {
      patternRow.color = (highLowPatternCellNode as HTMLInputElement).value
      patternRow.total = Object.values(patternRow.patternValues).reduce((sum, value) => sum + Math.max(value || 0, 0), 0)
      return true
    }

    const patternKey = highLowPatternCellNode.dataset.cuttingMarkerHighlowPatternKey
    if (patternKey) {
      patternRow.patternValues[patternKey] = Number((highLowPatternCellNode as HTMLInputElement).value)
      patternRow.total = Object.values(patternRow.patternValues).reduce((sum, value) => sum + Math.max(value || 0, 0), 0)
      return true
    }
  }

  const spreadingDraftFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-draft-field]')
  if (spreadingDraftFieldNode && state.spreadingDraft) {
    const field = spreadingDraftFieldNode.dataset.cuttingSpreadingDraftField as SpreadingDraftField | undefined
    if (!field) return false
    const value = (spreadingDraftFieldNode as HTMLInputElement | HTMLSelectElement).value

    if (field === 'spreadingMode') {
      state.spreadingDraft.spreadingMode = value as MarkerModeKey
      return true
    }

    if (field === 'status') {
      if (value === 'DONE') {
        state.feedback = {
          tone: 'warning',
          message: '已铺布状态只能通过“完成铺布”主按钮触发。',
        }
        return true
      }
      state.spreadingDraft.status = value as SpreadingStatusKey
      return true
    }

    if (field === 'importAdjustmentRequired') {
      state.spreadingDraft.importAdjustmentRequired = value === 'true'
      return true
    }

    if (field === 'cuttingTableId') {
      const table = resolveCuttingTable(value)
      state.spreadingDraft.cuttingTableId = table.cuttingTableId
      state.spreadingDraft.cuttingTableNo = table.cuttingTableNo
      state.spreadingDraft.cuttingTableName = table.cuttingTableName
      return true
    }

    if (field === 'plannedStartAt') {
      state.spreadingDraft.plannedStartAt = value
      state.spreadingDraft.plannedEndAt = value
        ? addMinutesToDateTimeLocal(value, state.spreadingDraft.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES)
        : ''
      state.spreadingDraft.tableScheduleStatus = value ? '已排程' : '未排程'
      return true
    }

    if (field === 'plannedEndAt') {
      state.spreadingDraft.plannedEndAt = value
      return true
    }

    if (field === 'plannedLayers' || field === 'unitPrice') {
      ;(state.spreadingDraft as Record<string, number>)[field] = Number(value)
      if (field === 'plannedLayers') {
        state.spreadingDraft.importAdjustmentRequired = true
      }
      return true
    }

    ;(state.spreadingDraft as Record<string, string>)[field] = value
    if (field === 'importAdjustmentNote' && value.trim()) {
      state.spreadingDraft.importAdjustmentRequired = true
    }
    return true
  }

  const spreadingRollFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-roll-field]')
  if (spreadingRollFieldNode && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const index = Number(spreadingRollFieldNode.dataset.cuttingSpreadingRollIndex)
    const field = spreadingRollFieldNode.dataset.cuttingSpreadingRollField as SpreadingRollField | undefined
    const roll = state.spreadingDraft.rolls[index]
    if (Number.isNaN(index) || !field || !roll) return false
    const value = (spreadingRollFieldNode as HTMLInputElement | HTMLSelectElement).value

    if (field === 'planUnitId') {
      roll.planUnitId = value
      syncDraftRollFromPlanUnit(state.spreadingDraft, roll)
      return true
    }

    if (
      field === 'width' ||
      field === 'labeledLength' ||
      field === 'actualLength' ||
      field === 'headLength' ||
      field === 'tailLength' ||
      field === 'layerCount'
    ) {
      ;(roll as Record<string, number>)[field] = Number(value)
      if (field === 'layerCount') {
        syncDraftRollFromPlanUnit(state.spreadingDraft, roll)
      }
      return true
    }

    ;(roll as Record<string, string>)[field] = value
    return true
  }

  const spreadingOperatorFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-operator-field]')
  if (spreadingOperatorFieldNode && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const index = Number(spreadingOperatorFieldNode.dataset.cuttingSpreadingOperatorIndex)
    const field = spreadingOperatorFieldNode.dataset.cuttingSpreadingOperatorField as SpreadingOperatorField | undefined
    const operator = state.spreadingDraft.operators[index]
    if (Number.isNaN(index) || !field || !operator) return false
    if (field === 'actionType') {
      operator.actionType = (spreadingOperatorFieldNode as HTMLInputElement | HTMLSelectElement).value as SpreadingOperatorRecord['actionType']
      operator.handoverFlag = operator.actionType === '中途交接' || operator.actionType === '接手继续'
      return true
    }
    if (field === 'startLayer' || field === 'endLayer' || field === 'handledLength' || field === 'unitPrice' || field === 'adjustedAmount') {
      const rawValue = (spreadingOperatorFieldNode as HTMLInputElement | HTMLSelectElement).value
      ;(operator as Record<string, number | undefined>)[field] = rawValue === '' ? undefined : Number(rawValue)
      return true
    }
    if (field === 'manualAmountAdjusted') {
      operator.manualAmountAdjusted = (spreadingOperatorFieldNode as HTMLInputElement | HTMLSelectElement).value === 'true'
      return true
    }
    if (field === 'pricingMode') {
      operator.pricingMode = (spreadingOperatorFieldNode as HTMLInputElement | HTMLSelectElement).value as SpreadingPricingMode
      return true
    }
    ;(operator as Record<string, string>)[field] = (spreadingOperatorFieldNode as HTMLInputElement | HTMLSelectElement).value
    if (field === 'handoverNotes') {
      operator.handoverFlag = Boolean(operator.handoverNotes)
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-marker-action]')
  const action = actionNode?.dataset.cuttingMarkerAction
  if (!action) return false

  if (action === 'close-overlay') {
    const currentPath = getCurrentPathname()
    if (currentPath === getCanonicalCuttingPath('spreading-edit')) return closeSpreadingEditOverlay()
    return false
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.keyword = ''
    state.contextNoFilter = ''
    state.sessionNoFilter = ''
    appStore.navigate(getCanonicalCuttingPath('spreading-list'))
    return true
  }

  if (action === 'clear-filters') {
    state.keyword = ''
    state.contextNoFilter = ''
    state.sessionNoFilter = ''
    state.cutOrderFilter = ''
    state.markerPlanSourceFilter = ''
    state.markerNoFilter = ''
    state.productionOrderFilter = ''
    state.styleSpuFilter = ''
    state.materialSkuFilter = ''
    state.colorFilter = ''
    state.contextTypeFilter = 'ALL'
    state.spreadingModeFilter = 'ALL'
    state.spreadingStageFilter = 'ALL'
    state.sourceChannelFilter = 'ALL'
    return true
  }

  if (action === 'switch-spreading-list-tab') {
    const nextTab = actionNode.dataset.listTab as ListTabKey | undefined
    if (!nextTab) return false
    state.activeTab = nextTab
    return true
  }

  if (action === 'switch-spreading-edit-tab') {
    const nextTab = actionNode.dataset.editTab as SpreadingEditTabKey | undefined
    if (!nextTab) return false
    state.spreadingEditTab = nextTab
    return true
  }

  if (action === 'go-list') {
    appStore.navigate(buildListRoute())
    return true
  }

  if (action === 'create-spreading') {
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-create'), buildCreatePayloadFromContext(null, null)))
    return true
  }

  if (action === 'create-spreading-exception') {
    state.feedback = { tone: 'warning', message: '铺布必须选择一个可执行的唛架编号。' }
    return true
  }

  if (action === 'select-spreading-create-marker') {
    const markerId = actionNode.dataset.markerId || ''
    state.selectedCreateMarkerId = markerId
    const currentRows = getSpreadingCreateSourceRows()
    const selectedSource =
      currentRows.find((row) => row.markerId === markerId) ||
      currentRows.find((row) => row.sourceBedId === markerId) ||
      currentRows.find((row) => row.sourceSchemeId === markerId) ||
      null
    state.selectedCreateSourceSnapshot = selectedSource ? { ...selectedSource } : null
    state.feedback = null
    window.history.replaceState(
      window.history.state,
      '',
      buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-create'), { markerId }),
    )
    document
      .querySelectorAll<HTMLElement>('[data-cutting-marker-action="select-spreading-create-marker"]')
      .forEach((button) => {
        const isSelected = button.dataset.markerId === markerId
        button.textContent = isSelected ? '已选中' : '选中'
        button.classList.toggle('bg-blue-600', isSelected)
        button.classList.toggle('text-white', isSelected)
      })
    const nextButton = document.querySelector<HTMLButtonElement>('[data-cutting-marker-action="next-spreading-create-step"]')
    if (nextButton) {
      nextButton.disabled = false
      nextButton.classList.remove('cursor-not-allowed', 'opacity-50')
      nextButton.classList.add('hover:bg-blue-700')
    }
    return true
  }

  if (action === 'next-spreading-create-step') {
    const source = getSelectedCreateSource()
    if (!source) {
      state.feedback = { tone: 'warning', message: '创建铺布需先选中一个可铺布的唛架编号。' }
      return true
    }
    if (state.createStep === 'SELECT_MARKER') {
      state.selectedCreateMarkerId = source.sourceSchemeId || source.markerId
      state.selectedCreateSourceSnapshot = { ...source }
      state.createStep = 'CONFIRM_CREATE'
      appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-create'), { markerId: state.selectedCreateMarkerId, step: 'confirm' }))
      return true
    }
    state.selectedCreateMarkerId = source.sourceSchemeId || source.markerId
    state.selectedCreateSourceSnapshot = { ...source }
    state.createStep = 'CONFIRM_CREATE'
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-create'), { markerId: state.selectedCreateMarkerId, step: 'confirm' }))
    return true
  }

  if (action === 'prev-spreading-create-step') {
    state.createStep = 'SELECT_MARKER'
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-create'), {
      markerId: state.selectedCreateMarkerId || undefined,
    }))
    return true
  }

  if (action === 'confirm-spreading-create') {
    return confirmSpreadingCreate()
  }

  if (action === 'go-linked-marker-detail') {
    const markerId = actionNode.dataset.markerId
    if (!markerId) return false
    appStore.navigate(`${getCanonicalCuttingPath('marker-detail')}/${encodeURIComponent(markerId)}`)
    return true
  }

  if (action === 'open-spreading-detail') return navigateToSpreadingPage('detail', actionNode.dataset.sessionId)
  if (action === 'open-spreading-edit') return navigateToSpreadingPage('edit', actionNode.dataset.sessionId)
  if (action === 'start-spreading-session') {
    const controls = actionNode.closest<HTMLElement>('[data-spreading-start-controls="true"]')
    const cuttingTableId = controls?.querySelector<HTMLSelectElement>('[data-cutting-spreading-start-field="cuttingTableId"]')?.value || ''
    const ownerAccountId = controls?.querySelector<HTMLSelectElement>('[data-cutting-spreading-start-field="ownerAccountId"]')?.value || ''
    const inlineFeedback = controls?.querySelector<HTMLElement>('[data-spreading-start-feedback]')
    if (!cuttingTableId || !ownerAccountId) {
      if (inlineFeedback) {
        inlineFeedback.classList.remove('hidden')
        inlineFeedback.textContent = '开始铺布前必须选择裁床和负责人。'
      }
      state.feedback = { tone: 'warning', message: '开始铺布前必须选择裁床和负责人。' }
      return true
    }
    if (inlineFeedback) {
      inlineFeedback.classList.add('hidden')
      inlineFeedback.textContent = ''
    }
    return startSpreadingSession(actionNode.dataset.sessionId, true, { cuttingTableId, ownerAccountId })
  }
  if (action === 'start-current-spreading') return startCurrentSpreading()
  if (action === 'start-cutting') return updateSpreadingCuttingStatus(actionNode.dataset.sessionId, 'CUTTING')
  if (action === 'finish-cutting') return updateSpreadingCuttingStatus(actionNode.dataset.sessionId, 'CUTTING_DONE')
  if (action === 'open-pda-spreading-site') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    actionNode.textContent = '打开中'
    appStore.navigate(buildPdaCuttingMainlinePathForSession(sessionId, appStore.getState().pathname))
    return true
  }
  if (action === 'go-linked-cut-orders') return navigateFromSpreadingSession(actionNode.dataset.sessionId, 'cut-orders')
  if (action === 'go-linked-marker-plan') return navigateFromSpreadingSession(actionNode.dataset.sessionId,  'marker-list')

  if (action === 'go-spreading-replenishment') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const row = getSpreadingRow(sessionId)
    if (!row) return false
    const context = buildCuttingDrillContext(row.replenishmentPayload, 'spreading-list', {
      productionOrderNo: row.productionOrderNos[0] || undefined,
      cutOrderNo: row.cutOrderNos[0] || undefined,
      markerPlanId: row.markerPlanId || undefined,
      markerPlanNo: row.markerPlanNo || undefined,
      materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
      markerId: row.session.markerId || undefined,
      markerNo: row.session.markerNo || undefined,
      spreadingSessionId: row.spreadingSessionId,
      spreadingSessionNo: row.session.sessionNo || undefined,
      autoOpenDetail: true,
    })
    appStore.navigate(buildCuttingRouteWithContext('replenishment', context))
    return true
  }

  if (action === 'launch-line-replenishment') {
    const context = buildCuttingDrillContext(
      {
        cutOrderId: actionNode.dataset.cutOrderId,
        cutOrderNo: actionNode.dataset.cutOrderNo,
        materialSku: actionNode.dataset.materialSku,
      },
      'spreading-list',
      {
        markerId: state.spreadingDraft?.markerId || undefined,
        markerNo: state.spreadingDraft?.markerNo || undefined,
        autoOpenDetail: true,
      },
    )
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('replenishment'), {
        ...serializeCuttingDrillContext(context),
        color: actionNode.dataset.color || undefined,
      }),
    )
    return true
  }

  if (action === 'go-spreading-fei-tickets') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const session = getStoredSpreadingSession(sessionId)
    if (!session) return false
    appStore.navigate(
      buildCuttingRouteWithContext(
        'feiTickets',
        buildCuttingDrillContext(buildContextPayloadFromSession(session), 'spreading-list', {
          markerPlanId: session.markerPlanId || undefined,
          markerPlanNo: session.markerPlanNo || undefined,
        }),
      ),
    )
    return true
  }

  if (action === 'go-spreading-transfer-bags') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const session = getStoredSpreadingSession(sessionId)
    if (!session) return false
    appStore.navigate(
      buildCuttingRouteWithContext(
        'transferBags',
        buildCuttingDrillContext(buildContextPayloadFromSession(session), 'spreading-list', {
          markerPlanId: session.markerPlanId || undefined,
          markerPlanNo: session.markerPlanNo || undefined,
        }),
      ),
    )
    return true
  }

  if (action === 'go-spreading-warehouse') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const session = getStoredSpreadingSession(sessionId)
    if (!session) return false
    appStore.navigate(
      buildCuttingRouteWithContext(
        'cutPieceWarehouse',
        buildCuttingDrillContext(buildContextPayloadFromSession(session), 'spreading-list', {
          markerPlanId: session.markerPlanId || undefined,
          markerPlanNo: session.markerPlanNo || undefined,
        }),
      ),
    )
    return true
  }

  if (action === 'export-spreading-list') {
    const { filename, rows } = buildCurrentListExportRows(getPageData().spreadingRows as SupervisorSpreadingRow[])
    downloadCsvFile(filename, rows)
    state.feedback = {
      tone: 'success',
      message: `已导出当前视图：${filename}`,
    }
    return true
  }

  if (action === 'cancel-spreading-edit') {
    return closeSpreadingEditOverlay()
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  if (action === 'add-size-row' && state.markerDraft) {
    addMarkerSizeRow(state.markerDraft)
    return true
  }

  if (action === 'remove-size-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeMarkerSizeRow(state.markerDraft, index)
    return true
  }

  if (action === 'add-allocation-line' && state.markerDraft) {
    addMarkerAllocationLine(state.markerDraft, getMarkerDraftSourceRows(state.markerDraft), createMarkerAllocationLineFromSource)
    return true
  }

  if (action === 'remove-allocation-line' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeMarkerAllocationLine(state.markerDraft, index)
    return true
  }

  if (action === 'add-line-item' && state.markerDraft) {
    addMarkerLineItem(state.markerDraft, createEmptyMarkerLineItem)
    return true
  }

  if (action === 'remove-line-item' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeMarkerLineItem(state.markerDraft, index)
    return true
  }

  if (action === 'add-highlow-cutting-row' && state.markerDraft) {
    addHighLowCuttingRow(state.markerDraft, createEmptyHighLowCuttingRow)
    return true
  }

  if (action === 'remove-highlow-cutting-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeHighLowCuttingRow(state.markerDraft, index)
    return true
  }

  if (action === 'add-highlow-pattern-key' && state.markerDraft) {
    addHighLowPatternKey(state.markerDraft)
    return true
  }

  if (action === 'remove-highlow-pattern-key' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeHighLowPatternKey(state.markerDraft, index)
    return true
  }

  if (action === 'add-highlow-pattern-row' && state.markerDraft) {
    addHighLowPatternRow(state.markerDraft, createEmptyHighLowPatternRow)
    return true
  }

  if (action === 'remove-highlow-pattern-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeHighLowPatternRow(state.markerDraft, index)
    return true
  }

  if (action === 'add-roll' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    addSpreadingRoll(state.spreadingDraft, (draft) => ({
      ...createRollRecordDraft(
        draft.spreadingSessionId,
        draft.materialSkuSummary?.split(' / ')[0] || '',
        draft.planUnits?.[0]?.planUnitId || '',
      ),
      sortOrder: draft.rolls.length + 1,
    }))
    return true
  }

  if (action === 'duplicate-roll' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const index = Number(actionNode.dataset.index)
    const current = state.spreadingDraft.rolls[index]
    if (Number.isNaN(index) || !current) return false
    const cloned = cloneRollRecordForDraft(current, state.spreadingDraft, state.spreadingDraft.rolls.length)
    state.spreadingDraft.rolls = [...state.spreadingDraft.rolls, cloned].map((roll, itemIndex) => ({
      ...roll,
      sortOrder: itemIndex + 1,
    }))
    state.feedback = { tone: 'success', message: '已复制当前卷记录，请补充新的卷号和记录时间。' }
    return true
  }

  if (action === 'remove-roll' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    const feedbackMessage = removeSpreadingRoll(state.spreadingDraft, index)
    if (feedbackMessage) {
      state.feedback = { tone: 'success', message: feedbackMessage }
    }
    return true
  }

  if (action === 'sync-spreading-rolls-from-pda' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    return syncSpreadingDraftFromStoredPdaRuntimeEvent(state.spreadingDraft)
  }

  if (action === 'add-operator' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    addSpreadingOperator(state.spreadingDraft, (draft) => ({
      ...createOperatorRecordDraft(draft.spreadingSessionId),
      sortOrder: draft.operators.length + 1,
      unitPrice: draft.unitPrice,
      pricingMode: '按件计价',
    }))
    return true
  }

  if (action === 'add-operator-for-roll' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const rollRecordId = actionNode.dataset.rollRecordId
    if (!rollRecordId) return false
    addSpreadingOperatorForRoll(state.spreadingDraft, rollRecordId, createOperatorDraftForRoll)
    return true
  }

  if (action === 'remove-operator' && state.spreadingDraft) {
    if (!ensureCanEditCurrentSpreadingExecution()) return true
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    removeSpreadingOperator(state.spreadingDraft, index)
    return true
  }

  if (action === 'toggle-spreading-completion-order' && state.spreadingDraft) {
    const cutOrderId = actionNode.dataset.cutOrderId
    if (!cutOrderId) return false
    const checked = (actionNode as HTMLInputElement).checked
    state.spreadingCompletionSelection = checked
      ? Array.from(new Set([...state.spreadingCompletionSelection, cutOrderId]))
      : state.spreadingCompletionSelection.filter((item) => item !== cutOrderId)
    return true
  }

  if (
    handleMarkerSpreadingSubmitAction({
      action,
      actionNode,
      saveSpreading: (goDetail, successMessage) => saveCurrentSpreading(goDetail, successMessage),
      completeSpreading: completeCurrentSpreading,
      persistSpreadingStatus: persistCurrentSpreadingStatus,
    })
  ) {
    return true
  }

  return false
}

export function isCraftCuttingMarkerSpreadingDialogOpen(): boolean {
  const pathname = getCurrentPathname()
  return pathname === getCanonicalCuttingPath('spreading-edit') || pathname === getCanonicalCuttingPath('spreading-create')
}
