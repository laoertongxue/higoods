import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  buildMarkerSeedDraft,
  finalizeSpreadingCompletion,
  buildMarkerSpreadingViewModel,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  buildRollHandoverViewModel,
  buildOperatorAmountWarnings,
  computeOperatorCalculatedAmount,
  computeOperatorDisplayAmount,
  computeRemainingLength,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeRollActualCutPieceQty,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deriveSpreadingStatus,
  hasSpreadingActualExecution,
  serializeMarkerSpreadingStorage,
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
  type SpreadingRollHandoverSummary,
  type SpreadingRollRecord,
  type SpreadingSession,
  type SpreadingStatusKey,
  validateMarkerForSpreadingImport,
} from './marker-spreading-model'
import {
  buildMarkerDetailViewModel,
  buildMarkerListViewModel,
  buildMarkerNavigationPayload,
  buildMarkerSpreadingCountsByOriginalOrder,
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
  MARKER_SIZE_KEYS,
  readMarkerSpreadingPrototypeData,
  type HighLowCuttingRow,
  type HighLowPatternRow,
  summarizeSpreadingRolls,
  type MarkerListRow,
  type SpreadingListRow,
} from './marker-spreading-utils'
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel,
  type MarkerAllocationSourceRow,
  type MarkerExplosionAllocationRow,
  type MarkerExplosionPieceDetailRow,
  type MarkerExplosionSkuSummaryRow,
} from './marker-piece-explosion'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'

type ListTabKey = 'MARKERS' | 'SPREADINGS'
type FeedbackTone = 'success' | 'warning'
type MarkerModeFilter = 'ALL' | MarkerModeKey
type ContextTypeFilter = 'ALL' | 'original-order' | 'merge-batch'
type BooleanFilter = 'ALL' | 'YES' | 'NO'
type SpreadingStatusFilter = 'ALL' | SpreadingStatusKey
type SpreadingWarningLevelFilter = 'ALL' | '低' | '中' | '高'
type MarkerDraftField =
  | 'markerNo'
  | 'markerMode'
  | 'colorSummary'
  | 'netLength'
  | 'singlePieceUsage'
  | 'spreadTotalLength'
  | 'materialCategory'
  | 'materialAttr'
  | 'plannedSizeRatioText'
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
  | 'replacementDraftFlag'
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
  | 'plannedLayers'
  | 'theoreticalSpreadTotalLength'
  | 'theoreticalActualCutPieceQty'
  | 'importAdjustmentRequired'
  | 'importAdjustmentNote'
  | 'unitPrice'
  | 'note'
  | 'status'
type SpreadingRollField =
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
  | 'handoverNotes'
  | 'note'

interface MarkerSpreadingPageState {
  querySignature: string
  prefilter: MarkerSpreadingPrefilter | null
  drillContext: CuttingDrillContext | null
  activeTab: ListTabKey
  keyword: string
  markerModeFilter: MarkerModeFilter
  contextTypeFilter: ContextTypeFilter
  adjustmentFilter: BooleanFilter
  imageFilter: BooleanFilter
  spreadingModeFilter: MarkerModeFilter
  spreadingStatusFilter: SpreadingStatusFilter
  spreadingVarianceFilter: BooleanFilter
  spreadingWarningFilter: BooleanFilter
  spreadingReplenishmentFilter: BooleanFilter
  spreadingWarningLevelFilter: SpreadingWarningLevelFilter
  spreadingPendingReplenishmentFilter: BooleanFilter
  spreadingCompletionSelection: string[]
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

const state: MarkerSpreadingPageState = {
  querySignature: '',
  prefilter: null,
  drillContext: null,
  activeTab: 'MARKERS',
  keyword: '',
  markerModeFilter: 'ALL',
  contextTypeFilter: 'ALL',
  adjustmentFilter: 'ALL',
  imageFilter: 'ALL',
  spreadingModeFilter: 'ALL',
  spreadingStatusFilter: 'ALL',
  spreadingVarianceFilter: 'ALL',
  spreadingWarningFilter: 'ALL',
  spreadingReplenishmentFilter: 'ALL',
  spreadingWarningLevelFilter: 'ALL',
  spreadingPendingReplenishmentFilter: 'ALL',
  spreadingCompletionSelection: [],
  markerDraft: null,
  spreadingDraft: null,
  feedback: null,
  importDecision: null,
}

function getCurrentPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('marker-spreading')
}

function getSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
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

function renderReturnToSummaryButton(): string {
  if (!hasSummaryReturnContext(state.drillContext)) return ''
  return '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="return-summary">返回裁剪总表</button>'
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

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '待补录'
  return `${Number(value).toFixed(2)} 元`
}

function formatDateText(value: string): string {
  return value || '待补'
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderSection(title: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-2">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 text-sm font-medium text-foreground">${escapeHtml(item.value || '待补')}</p>
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
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
        class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
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

function cloneMarkerRecord(record: MarkerRecord): MarkerRecord {
  return JSON.parse(JSON.stringify(record)) as MarkerRecord
}

function cloneSpreadingSession(session: SpreadingSession): SpreadingSession {
  return JSON.parse(JSON.stringify(session)) as SpreadingSession
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
    sourceCutOrderId: row.originalCutOrderId,
    sourceCutOrderNo: row.originalCutOrderNo,
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
      <table class="min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">来源裁片单号</th>
            <th class="px-3 py-2">来源生产单号</th>
            <th class="px-3 py-2">款号 / SPU</th>
            <th class="px-3 py-2">技术包 SPU</th>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">面料 SKU</th>
            <th class="px-3 py-2">当前分配摘要</th>
            <th class="px-3 py-2">分配合计件数</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.sourceProductionOrderNo || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(`${row.styleCode || '待补'} / ${row.spuCode || '待补'}`)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.techPackSpuCode || '未关联')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.materialSku || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.allocationSummaryText || '待补分配')}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.allocationTotalQty))}</td>
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
      <table class="min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">来源裁片单号</th>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">尺码</th>
            <th class="px-3 py-2">面料 SKU</th>
            <th class="px-3 py-2">plannedGarmentQty</th>
            <th class="px-3 py-2">技术包</th>
            <th class="px-3 py-2">SKU</th>
            <th class="px-3 py-2">映射状态</th>
            <th class="px-3 py-2">异常</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.materialSku || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-2">${escapeHtml(row.techPackSpuCode || '未关联')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-2">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
                  <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(row.exceptionText || '—')}</td>
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
      <table class="min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">来源裁片单号</th>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">尺码</th>
            <th class="px-3 py-2">SKU</th>
            <th class="px-3 py-2">计划成衣数</th>
            <th class="px-3 py-2">拆解总裁片数</th>
            <th class="px-3 py-2">涉及部位数</th>
            <th class="px-3 py-2">映射状态</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.explodedPieceTotal))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.involvedPartCount))}</td>
                  <td class="px-3 py-2">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
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
      <table class="min-w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">来源裁片单号</th>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">尺码</th>
            <th class="px-3 py-2">SKU</th>
            <th class="px-3 py-2">面料 SKU</th>
            <th class="px-3 py-2">纸样</th>
            <th class="px-3 py-2">部位</th>
            <th class="px-3 py-2">单件片数</th>
            <th class="px-3 py-2">计划成衣数</th>
            <th class="px-3 py-2">拆解裁片数</th>
            <th class="px-3 py-2">映射状态</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr class="border-b align-top">
                  <td class="px-3 py-2">${escapeHtml(row.sourceCutOrderNo)}</td>
                  <td class="px-3 py-2">${escapeHtml(row.color || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.sizeLabel || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.skuCode || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.materialSku || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.patternName || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(row.pieceName || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.pieceCountPerUnit))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.plannedGarmentQty))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(row.explodedPieceQty))}</td>
                  <td class="px-3 py-2">${getMarkerMappingStatusTag(row.mappingStatus)}</td>
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
  draft.originalCutOrderNos = draft.originalCutOrderNos || []
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
    markerNo: `MJ-${String(Date.now()).slice(-6)}`,
    contextType: 'original-order',
    originalCutOrderIds: [],
    mergeBatchId: '',
    mergeBatchNo: '',
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
    plannedSizeRatioText: '',
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
  const context = getDefaultMarkerSpreadingContext(data.rows, data.mergeBatches, state.prefilter)
  const seeded = context ? buildMarkerSeedDraft(context, null) : null
  const draft = seeded ? cloneMarkerRecord(seeded) : createFallbackMarkerDraft()
  draft.markerId = `marker-${Date.now()}`
  draft.markerNo = draft.markerNo || `MJ-${String(data.store.markers.length + 1).padStart(4, '0')}`
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
  const originalRows = record.originalCutOrderIds
    .map((id) => data.rowsById[id])
    .filter((row): row is (typeof data.rows)[number] => Boolean(row))

  if (!originalRows.length && !record.mergeBatchId && !record.mergeBatchNo) return null

  return {
    contextType: record.contextType,
    originalCutOrderIds: [...record.originalCutOrderIds],
    originalCutOrderNos:
      (record.originalCutOrderNos && record.originalCutOrderNos.length
        ? [...record.originalCutOrderNos]
        : originalRows.map((row) => row.originalCutOrderNo)) || [],
    mergeBatchId: record.mergeBatchId || '',
    mergeBatchNo: record.mergeBatchNo || '',
    productionOrderNos: Array.from(new Set(originalRows.map((row) => row.productionOrderNo))),
    styleCode: record.styleCode || originalRows[0]?.styleCode || '',
    spuCode: record.spuCode || originalRows[0]?.spuCode || '',
    techPackSpuCode:
      (Array.from(new Set(originalRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1
        ? Array.from(new Set(originalRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0]
        : '') || record.techPackSpuCode || '',
    styleName: originalRows[0]?.styleName || '',
    materialSkuSummary: record.materialSkuSummary || originalRows[0]?.materialSkuSummary || '',
    materialPrepRows: originalRows,
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
  const existingMarker = markerId ? data.store.markers.find((item) => item.markerId === markerId) || null : null
  const seededMarker = existingMarker || data.store.markers[0] || buildNewMarkerDraft()
  const context =
    getDefaultMarkerSpreadingContext(data.rows, data.mergeBatches, state.prefilter) ||
    getDefaultMarkerSpreadingContext(
      data.rows,
      data.mergeBatches,
      buildContextPayloadFromMarker(seededMarker) as MarkerSpreadingPrefilter,
    )

  if (!context) {
    return {
      spreadingSessionId: `spreading-${Date.now()}`,
      sessionNo: `PB-${String(Date.now()).slice(-6)}`,
      contextType: 'original-order',
      originalCutOrderIds: [],
      mergeBatchId: '',
      mergeBatchNo: '',
      markerId: seededMarker.markerId,
      markerNo: seededMarker.markerNo || '',
      styleCode: seededMarker.styleCode || '',
      spuCode: seededMarker.spuCode || '',
      materialSkuSummary: seededMarker.materialSkuSummary || '',
      colorSummary: '',
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
    originalCutOrderIds: [...context.originalCutOrderIds],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
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
  const primaryRow = session.originalCutOrderIds[0] ? data.rowsById[session.originalCutOrderIds[0]] : null
  return {
    sessionId: session.spreadingSessionId,
    markerId: session.markerId || undefined,
    originalCutOrderId: session.contextType === 'original-order' ? session.originalCutOrderIds[0] : undefined,
    originalCutOrderNo: session.contextType === 'original-order' ? primaryRow?.originalCutOrderNo : undefined,
    mergeBatchId: session.contextType === 'merge-batch' ? session.mergeBatchId || undefined : undefined,
    mergeBatchNo: session.contextType === 'merge-batch' ? session.mergeBatchNo || undefined : undefined,
    styleCode: session.styleCode || primaryRow?.styleCode || undefined,
    materialSku: session.materialSkuSummary?.split(' / ')[0] || primaryRow?.materialSkuSummary || undefined,
  }
}

function buildCreatePayloadFromSession(session: SpreadingSession): Record<string, string | undefined> {
  const payload = buildContextPayloadFromSession(session)
  return {
    markerId: payload.markerId,
    originalCutOrderId: payload.originalCutOrderId,
    originalCutOrderNo: payload.originalCutOrderNo,
    mergeBatchId: payload.mergeBatchId,
    mergeBatchNo: payload.mergeBatchNo,
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
  const primaryRows = session.originalCutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  const context = primaryRows.length
    ? {
        contextType: session.contextType,
        originalCutOrderIds: [...session.originalCutOrderIds],
        originalCutOrderNos: primaryRows.map((row) => row.originalCutOrderNo),
        mergeBatchId: session.mergeBatchId,
        mergeBatchNo: session.mergeBatchNo,
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
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces: markerRecord?.totalPieces || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
  })

  return {
    markerRecord,
    markerTotalPieces: markerRecord?.totalPieces || 0,
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
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    mergeBatchId: drillContext?.mergeBatchId || params.get('mergeBatchId') || undefined,
    mergeBatchNo: drillContext?.mergeBatchNo || params.get('mergeBatchNo') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    styleCode: drillContext?.styleCode || params.get('styleCode') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
  }
  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function parseListTabFromPath(): ListTabKey {
  return getSearchParams().get('tab') === 'spreadings' ? 'SPREADINGS' : 'MARKERS'
}

function syncStateFromPath(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return

  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getSearchParams())
  state.prefilter = parsePrefilterFromPath()
  state.activeTab = parseListTabFromPath()
  state.keyword = ''
  state.markerModeFilter = 'ALL'
  state.contextTypeFilter = 'ALL'
  state.adjustmentFilter = 'ALL'
  state.imageFilter = 'ALL'
  state.spreadingModeFilter = 'ALL'
  state.spreadingStatusFilter = 'ALL'
  state.spreadingVarianceFilter = 'ALL'
  state.spreadingReplenishmentFilter = 'ALL'
  state.spreadingWarningLevelFilter = 'ALL'
  state.spreadingPendingReplenishmentFilter = 'ALL'
  state.spreadingCompletionSelection = []
  state.feedback = null
  state.importDecision = null

  const currentPath = getCurrentPathname()
  const data = readMarkerSpreadingPrototypeData()

  if (currentPath === getCanonicalCuttingPath('marker-edit')) {
    const markerId = getSearchParams().get('markerId')
    const existing = markerId ? data.store.markers.find((item) => item.markerId === markerId) || null : null
    state.markerDraft = ensureMarkerDraftShape(existing ? cloneMarkerRecord(existing) : buildNewMarkerDraft())
    state.spreadingDraft = null
    return
  }

  if (currentPath === getCanonicalCuttingPath('spreading-edit')) {
    const sessionId = getSearchParams().get('sessionId')
    const existing = sessionId ? data.store.sessions.find((item) => item.spreadingSessionId === sessionId) || null : null
    state.spreadingDraft = existing ? cloneSpreadingSession(existing) : buildNewSpreadingDraft()
    state.spreadingCompletionSelection =
      state.spreadingDraft.contextType === 'merge-batch'
        ? [...(state.spreadingDraft.completionLinkage?.linkedOriginalCutOrderIds || [])]
        : [...state.spreadingDraft.originalCutOrderIds]
    state.markerDraft = null
    return
  }

  state.markerDraft = null
  state.spreadingDraft = null
}

function matchesKeyword(keyword: string, values: string[]): boolean {
  if (!keyword.trim()) return true
  const normalized = keyword.trim().toLowerCase()
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function getPageData() {
  syncStateFromPath()
  const data = readMarkerSpreadingPrototypeData()
  const viewModel = buildMarkerSpreadingViewModel({
    rows: data.rows,
    mergeBatches: data.mergeBatches,
    store: data.store,
    prefilter: state.prefilter,
  })

  const markerRows = buildMarkerListViewModel({
    markerRecords: viewModel.markerRecords,
    rowsById: data.rowsById,
    mergeBatches: data.mergeBatches,
  }).filter((row) => {
    if (state.prefilter?.productionOrderNo && !row.keywordIndex.includes(state.prefilter.productionOrderNo)) {
      return false
    }
    if (state.prefilter?.styleCode && row.styleCode !== state.prefilter.styleCode && row.spuCode !== state.prefilter.styleCode) {
      return false
    }
    if (state.prefilter?.materialSku && !row.materialSkuSummary.includes(state.prefilter.materialSku)) {
      return false
    }
    if (state.markerModeFilter !== 'ALL' && row.markerMode !== state.markerModeFilter) {
      return false
    }
    if (state.contextTypeFilter !== 'ALL' && row.contextType !== state.contextTypeFilter) {
      return false
    }
    if (state.adjustmentFilter === 'YES' && !row.hasAdjustment) {
      return false
    }
    if (state.adjustmentFilter === 'NO' && row.hasAdjustment) {
      return false
    }
    if (state.imageFilter === 'YES' && !row.hasImage) {
      return false
    }
    if (state.imageFilter === 'NO' && row.hasImage) {
      return false
    }
    return matchesKeyword(state.keyword, row.keywordIndex)
  })

  const spreadingRows = buildSpreadingListViewModel({
    spreadingSessions: viewModel.spreadingSessions,
    rowsById: data.rowsById,
    mergeBatches: data.mergeBatches,
    markerRecords: data.store.markers,
  }).filter((row) => {
    if (state.prefilter?.productionOrderNo && !row.productionOrderNos.includes(state.prefilter.productionOrderNo)) {
      return false
    }
    if (state.prefilter?.styleCode && row.styleCode !== state.prefilter.styleCode && row.spuCode !== state.prefilter.styleCode) {
      return false
    }
    if (state.prefilter?.materialSku && !row.materialSkuSummary.includes(state.prefilter.materialSku)) {
      return false
    }
    if (state.spreadingModeFilter !== 'ALL' && row.spreadingMode !== state.spreadingModeFilter) {
      return false
    }
    if (state.contextTypeFilter !== 'ALL' && row.contextType !== state.contextTypeFilter) {
      return false
    }
    if (state.spreadingStatusFilter !== 'ALL' && row.statusKey !== state.spreadingStatusFilter) {
      return false
    }
    if (state.spreadingVarianceFilter === 'YES' && !row.hasVariance) {
      return false
    }
    if (state.spreadingVarianceFilter === 'NO' && row.hasVariance) {
      return false
    }
    if (state.spreadingWarningFilter === 'YES' && !row.hasWarnings) {
      return false
    }
    if (state.spreadingWarningFilter === 'NO' && row.hasWarnings) {
      return false
    }
    if (state.spreadingReplenishmentFilter === 'YES' && !row.hasReplenishmentWarning) {
      return false
    }
    if (state.spreadingReplenishmentFilter === 'NO' && row.hasReplenishmentWarning) {
      return false
    }
    if (state.spreadingWarningLevelFilter !== 'ALL' && row.replenishmentWarningLevel !== state.spreadingWarningLevelFilter) {
      return false
    }
    if (state.spreadingPendingReplenishmentFilter === 'YES' && !row.pendingReplenishmentConfirmation) {
      return false
    }
    if (state.spreadingPendingReplenishmentFilter === 'NO' && row.pendingReplenishmentConfirmation) {
      return false
    }
    return matchesKeyword(state.keyword, row.keywordIndex)
  })

  return {
    ...data,
    viewModel,
    markerRows,
    spreadingRows,
  }
}

function getMarkerRow(markerId: string | null | undefined): MarkerListRow | null {
  if (!markerId) return null
  return getPageData().markerRows.find((item) => item.markerId === markerId) || null
}

function getSpreadingRow(sessionId: string | null | undefined): SpreadingListRow | null {
  if (!sessionId) return null
  return getPageData().spreadingRows.find((item) => item.spreadingSessionId === sessionId) || null
}

function getStoredMarkerRecord(markerId: string | null | undefined): MarkerRecord | null {
  if (!markerId) return null
  return readMarkerSpreadingPrototypeData().store.markers.find((item) => item.markerId === markerId) || null
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
  if (!state.importDecision) return ''
  return renderSection(
    '再次导入提示',
    `
      <div class="space-y-3">
        <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          当前唛架 <span class="font-medium">${escapeHtml(state.importDecision.markerNo)}</span> 已关联铺布草稿
          <span class="font-medium">${escapeHtml(state.importDecision.targetSessionNo)}</span>，并且该草稿已经录入实际卷记录或人员记录，不能静默覆盖。
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <button type="button" class="rounded-md border bg-card px-3 py-3 text-left text-sm hover:bg-muted" data-cutting-marker-action="confirm-marker-import-new">
            <p class="font-medium text-foreground">方案 A：新建一条新的铺布草稿</p>
            <p class="mt-1 text-xs text-muted-foreground">推荐。保留原实际执行数据不动，另起一条新草稿重新承接唛架模板。</p>
          </button>
          <button type="button" class="rounded-md border bg-card px-3 py-3 text-left text-sm hover:bg-muted" data-cutting-marker-action="confirm-marker-import-sync">
            <p class="font-medium text-foreground">方案 B：仅同步理论字段</p>
            <p class="mt-1 text-xs text-muted-foreground">只更新导入来源、计划铺布明细和理论字段，不覆盖卷记录与人员记录。</p>
          </button>
          <button type="button" class="rounded-md border bg-card px-3 py-3 text-left text-sm hover:bg-muted" data-cutting-marker-action="cancel-marker-import">
            <p class="font-medium text-foreground">方案 C：取消</p>
            <p class="mt-1 text-xs text-muted-foreground">不做任何导入操作，继续保留当前记录。</p>
          </button>
        </div>
      </div>
    `,
  )
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
  return `<section class="rounded-lg border px-3 py-2 text-sm ${className}">${escapeHtml(state.feedback.message)}</section>`
}

function renderPrefilterBar(): string {
  const labels = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.originalCutOrderNo ? `原始裁片单：${state.prefilter.originalCutOrderNo}` : '',
      state.prefilter?.mergeBatchNo ? `合并裁剪批次：${state.prefilter.mergeBatchNo}` : '',
      state.prefilter?.styleCode ? `款号：${state.prefilter.styleCode}` : '',
      state.prefilter?.materialSku ? `面料 SKU：${state.prefilter.materialSku}` : '',
    ].filter(Boolean)),
  )
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前列表已承接上游上下文预筛',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-marker-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-marker-action="clear-prefilter"',
  })
}

function renderFilterBar(): string {
  if (state.activeTab === 'SPREADINGS') {
    const chips: string[] = []
    if (state.keyword) {
      chips.push(renderWorkbenchFilterChip(`关键词：${state.keyword}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
    }
    if (state.spreadingModeFilter !== 'ALL') {
      chips.push(renderWorkbenchFilterChip(`模式：${deriveSpreadingModeMeta(state.spreadingModeFilter).label}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
    }
    if (state.contextTypeFilter !== 'ALL') {
      chips.push(
        renderWorkbenchFilterChip(
          `上下文：${state.contextTypeFilter === 'merge-batch' ? '合并裁剪批次' : '原始裁片单'}`,
          'data-cutting-marker-action="clear-filters"',
          'blue',
        ),
      )
    }
    if (state.spreadingStatusFilter !== 'ALL') {
      chips.push(renderWorkbenchFilterChip(`状态：${deriveSpreadingStatus(state.spreadingStatusFilter).label}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
    }
    if (state.spreadingVarianceFilter !== 'ALL') {
      chips.push(renderWorkbenchFilterChip(`差异：${state.spreadingVarianceFilter === 'YES' ? '存在差异' : '无明显差异'}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
    }
    if (state.spreadingWarningFilter !== 'ALL') {
      chips.push(
        renderWorkbenchFilterChip(
          `提醒：${state.spreadingWarningFilter === 'YES' ? '存在提醒' : '无提醒'}`,
          'data-cutting-marker-action="clear-filters"',
          'blue',
        ),
      )
    }
    if (state.spreadingReplenishmentFilter !== 'ALL') {
      chips.push(
        renderWorkbenchFilterChip(
          `补料预警：${state.spreadingReplenishmentFilter === 'YES' ? '已触发预警' : '无补料预警'}`,
          'data-cutting-marker-action="clear-filters"',
          'blue',
        ),
      )
    }
    if (state.spreadingWarningLevelFilter !== 'ALL') {
      chips.push(
        renderWorkbenchFilterChip(
          `预警等级：${state.spreadingWarningLevelFilter}`,
          'data-cutting-marker-action="clear-filters"',
          'blue',
        ),
      )
    }
    if (state.spreadingPendingReplenishmentFilter !== 'ALL') {
      chips.push(
        renderWorkbenchFilterChip(
          `待补料确认：${state.spreadingPendingReplenishmentFilter === 'YES' ? '是' : '否'}`,
          'data-cutting-marker-action="clear-filters"',
          'blue',
        ),
      )
    }

    return [
      renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-9">
          ${renderTextInput('搜索', state.keyword, 'data-cutting-spreading-list-field="keyword"', '铺布编号 / 原始裁片单号 / 批次号 / 款号 / 面料编码 / 卷号 / 人员')}
          ${renderSelect('模式', state.spreadingModeFilter, 'data-cutting-spreading-list-field="mode"', [
            { value: 'ALL', label: '全部模式' },
            { value: 'normal', label: '正常模式' },
            { value: 'high-low', label: '高低层模式' },
            { value: 'folded', label: '对折模式' },
          ])}
          ${renderSelect('上下文类型', state.contextTypeFilter, 'data-cutting-spreading-list-field="context"', [
            { value: 'ALL', label: '全部上下文' },
            { value: 'original-order', label: '原始裁片单' },
            { value: 'merge-batch', label: '合并裁剪批次' },
          ])}
          ${renderSelect('状态', state.spreadingStatusFilter, 'data-cutting-spreading-list-field="status"', [
            { value: 'ALL', label: '全部状态' },
            { value: 'DRAFT', label: '草稿' },
            { value: 'IN_PROGRESS', label: '进行中' },
            { value: 'DONE', label: '已完成' },
            { value: 'TO_FILL', label: '待补录' },
          ])}
          ${renderSelect('是否存在差异', state.spreadingVarianceFilter, 'data-cutting-spreading-list-field="variance"', [
            { value: 'ALL', label: '全部' },
            { value: 'YES', label: '存在差异' },
            { value: 'NO', label: '无明显差异' },
          ])}
          ${renderSelect('是否存在提醒', state.spreadingWarningFilter, 'data-cutting-spreading-list-field="warning"', [
            { value: 'ALL', label: '全部' },
            { value: 'YES', label: '存在提醒' },
            { value: 'NO', label: '无提醒' },
          ])}
          ${renderSelect('是否补料预警', state.spreadingReplenishmentFilter, 'data-cutting-spreading-list-field="replenishment"', [
            { value: 'ALL', label: '全部' },
            { value: 'YES', label: '有补料预警' },
            { value: 'NO', label: '无补料预警' },
          ])}
          ${renderSelect('预警等级', state.spreadingWarningLevelFilter, 'data-cutting-spreading-list-field="warning-level"', [
            { value: 'ALL', label: '全部等级' },
            { value: '高', label: '高' },
            { value: '中', label: '中' },
            { value: '低', label: '低' },
          ])}
          ${renderSelect('待补料确认', state.spreadingPendingReplenishmentFilter, 'data-cutting-spreading-list-field="pending-replenishment"', [
            { value: 'ALL', label: '全部' },
            { value: 'YES', label: '待确认' },
            { value: 'NO', label: '无需确认' },
          ])}
        </div>
        <div class="mt-3 flex flex-wrap gap-2 md:justify-end">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">清除页内筛选</button>
        </div>
      `),
      chips.length
        ? renderWorkbenchStateBar({
            summary: '当前页内筛选：',
            chips,
            clearAttrs: 'data-cutting-marker-action="clear-filters"',
          })
        : '',
    ].join('')
  }

  const chips: string[] = []
  if (state.keyword) {
    chips.push(renderWorkbenchFilterChip(`关键词：${state.keyword}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
  }
  if (state.markerModeFilter !== 'ALL') {
    chips.push(renderWorkbenchFilterChip(`模式：${deriveMarkerModeMeta(state.markerModeFilter).label}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
  }
  if (state.contextTypeFilter !== 'ALL') {
    chips.push(
      renderWorkbenchFilterChip(
        `上下文：${state.contextTypeFilter === 'merge-batch' ? '合并裁剪批次' : '原始裁片单'}`,
        'data-cutting-marker-action="clear-filters"',
        'blue',
      ),
    )
  }
  if (state.adjustmentFilter !== 'ALL') {
    chips.push(renderWorkbenchFilterChip(`调整：${state.adjustmentFilter === 'YES' ? '有调整' : '无调整'}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
  }
  if (state.imageFilter !== 'ALL') {
    chips.push(renderWorkbenchFilterChip(`图片：${state.imageFilter === 'YES' ? '已上传' : '未上传'}`, 'data-cutting-marker-action="clear-filters"', 'blue'))
  }

  return [
    renderStickyFilterShell(`
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderTextInput('搜索', state.keyword, 'data-cutting-marker-field="keyword"', '唛架序号 / session 编号 / 原始裁片单 / 批次 / 卷号 / 人员')}
        ${renderSelect('模式', state.markerModeFilter, 'data-cutting-marker-field="marker-mode-filter"', [
          { value: 'ALL', label: '全部模式' },
          { value: 'normal', label: '正常模式' },
          { value: 'high-low', label: '高低层模式' },
          { value: 'folded', label: '对折铺布模式' },
        ])}
        ${renderSelect('上下文类型', state.contextTypeFilter, 'data-cutting-marker-field="context-type-filter"', [
          { value: 'ALL', label: '全部上下文' },
          { value: 'original-order', label: '原始裁片单' },
          { value: 'merge-batch', label: '合并裁剪批次' },
        ])}
        ${renderSelect('是否有调整', state.adjustmentFilter, 'data-cutting-marker-field="adjustment-filter"', [
          { value: 'ALL', label: '全部' },
          { value: 'YES', label: '有调整' },
          { value: 'NO', label: '无调整' },
        ])}
        ${renderSelect('是否有图片', state.imageFilter, 'data-cutting-marker-field="image-filter"', [
          { value: 'ALL', label: '全部' },
          { value: 'YES', label: '已上传图片' },
          { value: 'NO', label: '未上传图片' },
        ])}
      </div>
      <div class="mt-3 flex flex-wrap gap-2 md:justify-end">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="clear-filters">清除页内筛选</button>
      </div>
    `),
    chips.length
      ? renderWorkbenchStateBar({
          summary: '当前页内筛选：',
          chips,
          clearAttrs: 'data-cutting-marker-action="clear-filters"',
        })
      : '',
  ].join('')
}

function renderListTabs(): string {
  const tabClass = (active: boolean) =>
    active
      ? 'border-blue-500 bg-blue-50 text-blue-700'
      : 'border-transparent bg-muted/30 text-muted-foreground hover:border-slate-200 hover:bg-muted'

  return `
    <section class="flex flex-wrap gap-2">
      <button type="button" class="rounded-full border px-4 py-2 text-sm font-medium ${tabClass(state.activeTab === 'MARKERS')}" data-cutting-marker-action="set-tab" data-tab="markers">唛架记录</button>
      <button type="button" class="rounded-full border px-4 py-2 text-sm font-medium ${tabClass(state.activeTab === 'SPREADINGS')}" data-cutting-marker-action="set-tab" data-tab="spreadings">铺布记录</button>
    </section>
  `
}

function renderListStats(): string {
  const { markerRows, spreadingRows } = getPageData()
  const mergeBatchMarkerCount = markerRows.filter((row) => row.contextType === 'merge-batch').length
  const originalMarkerCount = markerRows.filter((row) => row.contextType === 'original-order').length
  const inProgressCount = spreadingRows.filter((row) => row.statusLabel === '进行中').length
  const doneCount = spreadingRows.filter((row) => row.statusLabel === '已完成').length

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('唛架记录数', markerRows.length, '当前列表视图', 'text-slate-900')}
      ${renderCompactKpiCard('铺布记录数', spreadingRows.length, '包含草稿 / 进行中 / 已完成', 'text-blue-600')}
      ${renderCompactKpiCard('原始单上下文唛架', originalMarkerCount, '按原始裁片单查看', 'text-emerald-600')}
      ${renderCompactKpiCard('批次上下文唛架', mergeBatchMarkerCount, '按执行批次查看', 'text-violet-600')}
      ${renderCompactKpiCard('进行中铺布', inProgressCount, '仍可继续补录卷和人员', 'text-amber-600')}
      ${renderCompactKpiCard('已完成铺布', doneCount, '已形成执行记录', 'text-sky-600')}
    </section>
  `
}

function renderContextCell(contextLabel: string, originalCutOrderNos: string[], mergeBatchNo: string): string {
  return `
    <div class="space-y-1">
      <p class="text-xs font-medium text-foreground">${escapeHtml(contextLabel)}</p>
      <p class="text-[11px] text-muted-foreground">原始裁片单 ${escapeHtml(String(originalCutOrderNos.length))} 个</p>
      ${mergeBatchNo ? `<p class="text-[11px] text-muted-foreground">批次：${escapeHtml(mergeBatchNo)}</p>` : ''}
    </div>
  `
}

function renderMarkerTable(rows: MarkerListRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无唛架记录，可先新建唛架或从原始裁片单 / 批次上下文进入。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 bg-muted/70 text-left text-xs text-muted-foreground backdrop-blur">
        <tr>
          <th class="px-3 py-2 font-medium">唛架序号</th>
          <th class="px-3 py-2 font-medium">上下文</th>
          <th class="px-3 py-2 font-medium">款号 / SPU</th>
          <th class="px-3 py-2 font-medium">唛架模式</th>
          <th class="px-3 py-2 font-medium">总件数</th>
          <th class="px-3 py-2 font-medium">净长度</th>
          <th class="px-3 py-2 font-medium">单件用量</th>
          <th class="px-3 py-2 font-medium">唛架图状态</th>
          <th class="px-3 py-2 font-medium">更新时间</th>
          <th class="px-3 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const modeMeta = deriveMarkerModeMeta(row.record.markerMode)
            return `
              <tr class="border-b align-top">
                <td class="px-3 py-3">
                  <p class="font-medium text-foreground">${escapeHtml(row.markerNo)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.lineSummary)}</p>
                </td>
                <td class="px-3 py-3">${renderContextCell(row.contextLabel, row.originalCutOrderNos, row.mergeBatchNo)}</td>
                <td class="px-3 py-3">
                  <p>${escapeHtml(row.styleCode || '款号待补')}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.spuCode || 'SPU 待补')}</p>
                </td>
                <td class="px-3 py-3">${renderTag(modeMeta.label, modeMeta.className)}</td>
                <td class="px-3 py-3">${escapeHtml(formatQty(row.totalPieces))} 件</td>
                <td class="px-3 py-3">${escapeHtml(formatLength(row.netLength))}</td>
                <td class="px-3 py-3">${escapeHtml(formatLength(row.singlePieceUsage))}</td>
                <td class="px-3 py-3">${escapeHtml(row.markerImageStatus)}</td>
                <td class="px-3 py-3">${escapeHtml(formatDateText(row.updatedAt))}</td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="open-marker-detail" data-marker-id="${escapeHtml(row.markerId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="open-marker-edit" data-marker-id="${escapeHtml(row.markerId)}">编辑</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="create-marker-from-context" data-marker-id="${escapeHtml(row.markerId)}">新建唛架</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="create-spreading-from-marker" data-marker-id="${escapeHtml(row.markerId)}">从唛架导入铺布</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `)
}

function renderSpreadingTable(rows: SpreadingListRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">当前筛选范围内暂无铺布记录，可先新建铺布 session。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 bg-muted/70 text-left text-xs text-muted-foreground backdrop-blur">
        <tr>
          <th class="px-3 py-2 font-medium">铺布编号</th>
          <th class="px-3 py-2 font-medium">上下文</th>
          <th class="px-3 py-2 font-medium">款号 / 款式编码</th>
          <th class="px-3 py-2 font-medium">铺布模式</th>
          <th class="px-3 py-2 font-medium">卷数 / 人员数</th>
          <th class="px-3 py-2 font-medium">交接摘要</th>
          <th class="px-3 py-2 font-medium">分摊摘要</th>
          <th class="px-3 py-2 font-medium">实际铺布总长度</th>
          <th class="px-3 py-2 font-medium">总可用长度</th>
          <th class="px-3 py-2 font-medium">实际裁剪件数</th>
          <th class="px-3 py-2 font-medium">已联动完成原始裁片单数</th>
          <th class="px-3 py-2 font-medium">差异状态</th>
          <th class="px-3 py-2 font-medium">预警等级 / 建议动作</th>
          <th class="px-3 py-2 font-medium">提醒状态</th>
          <th class="px-3 py-2 font-medium">状态</th>
          <th class="px-3 py-2 font-medium">更新时间</th>
          <th class="px-3 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const modeMeta = deriveSpreadingModeMeta(row.session.spreadingMode)
            const statusMeta = deriveSpreadingStatus(row.session.status)
            return `
              <tr class="border-b align-top">
                <td class="px-3 py-3">
                  <p class="font-medium text-foreground">${escapeHtml(row.sessionNo)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">关联唛架 ${escapeHtml(row.session.markerNo || '待关联')}</p>
                  <p class="mt-1 text-xs text-muted-foreground">原始裁片单 ${escapeHtml(String(row.originalCutOrderCount))} 个</p>
                </td>
                <td class="px-3 py-3">${renderContextCell(row.contextLabel, row.originalCutOrderNos, row.mergeBatchNo)}</td>
                <td class="px-3 py-3">
                  <p>${escapeHtml(row.styleCode || '款号待补')}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.spuCode || '款式编码待补')}</p>
                </td>
                <td class="px-3 py-3">${renderTag(modeMeta.label, modeMeta.className)}</td>
                <td class="px-3 py-3">${escapeHtml(String(row.rollCount))} 卷 / ${escapeHtml(String(row.operatorCount))} 人</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    <p class="text-[11px] ${row.hasHandoverWarnings ? 'text-amber-700' : row.hasHandover ? 'text-blue-700' : 'text-muted-foreground'}">${escapeHtml(row.handoverStatusLabel)}</p>
                  </div>
                </td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    <p class="text-[11px] ${row.hasOperatorAllocation ? 'text-blue-700' : 'text-muted-foreground'}">${escapeHtml(row.operatorAllocationStatusLabel)}</p>
                    <p class="text-[11px] ${row.hasManualAdjustedAmount ? 'text-amber-700' : 'text-muted-foreground'}">${escapeHtml(
                      row.hasOperatorAllocation ? `金额 ${formatCurrency(row.operatorAllocationAmountTotal)}` : '待补录',
                    )}</p>
                  </div>
                </td>
                <td class="px-3 py-3">${escapeHtml(formatLength(row.totalActualLength))}</td>
                <td class="px-3 py-3">${escapeHtml(formatLength(row.totalCalculatedUsableLength))}</td>
                <td class="px-3 py-3">${escapeHtml(formatQty(row.actualCutPieceQty))} 件</td>
                <td class="px-3 py-3">${escapeHtml(formatQty(row.completedOriginalOrderCount))} 个</td>
                <td class="px-3 py-3">
                  <span class="${row.differenceStatusTone === 'warning' ? 'text-amber-700' : 'text-muted-foreground'}">${escapeHtml(row.differenceStatusLabel)}</span>
                </td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    <p class="text-[11px] ${row.replenishmentWarningLevel === '高' ? 'text-rose-600' : row.replenishmentWarningLevel === '中' ? 'text-amber-700' : 'text-emerald-700'}">${escapeHtml(`预警 ${row.replenishmentWarningLevel}`)}</p>
                    <p class="text-[11px] text-muted-foreground">${escapeHtml(row.replenishmentSuggestedAction)}</p>
                  </div>
                </td>
                <td class="px-3 py-3">
                  <span class="${row.hasWarnings ? 'text-amber-700' : 'text-muted-foreground'}">${escapeHtml(row.warningStatusLabel)}</span>
                </td>
                <td class="px-3 py-3">${renderTag(statusMeta.label, statusMeta.className)}</td>
                <td class="px-3 py-3">${escapeHtml(formatDateText(row.updatedAt))}</td>
                <td class="px-3 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-detail" data-session-id="${escapeHtml(row.spreadingSessionId)}">查看详情</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(row.spreadingSessionId)}">编辑</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="create-spreading-from-session-context" data-session-id="${escapeHtml(row.spreadingSessionId)}">新建铺布</button>
                    <button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(row.spreadingSessionId)}">去补料管理</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `)
}

function renderListPage(): string {
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'marker-spreading')
  const { markerRows, spreadingRows } = getPageData()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-marker">新建唛架</button>',
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-spreading">新建铺布</button>',
        ])),
      })}
      ${renderListStats()}
      ${renderFeedbackBar()}
      ${renderImportDecisionPanel()}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderListTabs()}
      ${state.activeTab === 'MARKERS' ? renderMarkerTable(markerRows) : renderSpreadingTable(spreadingRows)}
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
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(message)}</div>
                `,
              )
              .join('')}
          </div>
        `
      : '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前未识别明显 warning，可继续维护唛架数据。</div>',
  )
}

function renderSpreadingWarningSection(warningMessages: string[]): string {
  return renderSection(
    '提醒区',
    warningMessages.length
      ? `
          <div class="space-y-2">
            ${warningMessages
              .map(
                (message) => `
                  <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(message)}</div>
                `,
              )
              .join('')}
          </div>
        `
      : '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前未识别明显长度异常、交接异常、剩余异常或补料预警。</div>',
  )
}

function formatLayerValue(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '待补录' : String(value)
}

function formatHandledLengthValue(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '待补录' : formatLength(value)
}

function renderOperatorAllocationSummary(summary: SpreadingOperatorAmountSummary): string {
  if (!summary.rows.length) {
    return '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前尚未形成按人分摊数据，待补录层数、长度和单价后自动汇总。</div>'
  }

  return `
    <div class="space-y-3">
      ${renderInfoGrid([
        { label: '按人分摊人数', value: `${formatQty(summary.rows.length)} 人` },
        { label: '总负责层数', value: `${formatQty(summary.totalHandledLayerCount)} 层` },
        { label: '总负责长度', value: formatHandledLengthValue(summary.totalHandledLength) },
        { label: '总负责件数', value: `${formatQty(summary.totalHandledPieceQty)} 件` },
        { label: '人员金额合计', value: formatCurrency(summary.totalDisplayAmount) },
        { label: '人工调整金额', value: summary.hasManualAdjustedAmount ? '存在人工调整' : '未人工调整' },
      ])}
      <div class="overflow-auto">
        <table class="min-w-[880px] text-sm">
          <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2">人员姓名</th>
              <th class="px-3 py-2">负责层数合计</th>
              <th class="px-3 py-2">负责长度合计</th>
              <th class="px-3 py-2">负责件数合计</th>
              <th class="px-3 py-2">金额合计</th>
              <th class="px-3 py-2">人工调整</th>
            </tr>
          </thead>
          <tbody>
            ${summary.rows
              .map(
                (row) => `
                  <tr class="border-b">
                    <td class="px-3 py-2">${escapeHtml(row.operatorName)}</td>
                    <td class="px-3 py-2">${escapeHtml(`${formatQty(row.handledLayerCountTotal)} 层`)}</td>
                    <td class="px-3 py-2">${escapeHtml(formatHandledLengthValue(row.handledLengthTotal))}</td>
                    <td class="px-3 py-2">${escapeHtml(`${formatQty(row.handledPieceQtyTotal)} 件`)}</td>
                    <td class="px-3 py-2">${escapeHtml(formatCurrency(row.displayAmountTotal))}</td>
                    <td class="px-3 py-2">${escapeHtml(row.hasManualAdjustedAmount ? '已调整' : '未调整')}</td>
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
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前按人分摊金额字段完整，未识别明显金额异常。</div>'
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
    return '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前卷的层数、长度与交接区间已形成可追溯闭环。</div>'
  }

  return `
    <div class="space-y-2">
      ${summary.warnings
        .map(
          (warning) => `
            <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(warning)}</div>
          `,
        )
        .join('')}
    </div>
  `
}

function buildSpreadingCompletionTargetIds(session: SpreadingSession): string[] {
  if (session.contextType === 'merge-batch') return [...state.spreadingCompletionSelection]
  return [...session.originalCutOrderIds]
}

function buildSpreadingReplenishmentPreview(
  session: SpreadingSession,
  linkedOriginalCutOrderNos: string[],
  derived: ReturnType<typeof resolveSpreadingDerivedState>,
): SpreadingReplenishmentWarning {
  const data = readMarkerSpreadingPrototypeData()
  const primaryRows = session.originalCutOrderIds.map((id) => data.rowsById[id]).filter(Boolean)
  return (
    session.replenishmentWarning ||
    buildSpreadingReplenishmentWarning({
      session,
      markerTotalPieces: derived.markerTotalPieces,
      originalCutOrderNos: linkedOriginalCutOrderNos,
      productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
      materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || '',
      warningMessages: derived.warningMessages,
    })
  )
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
        <div class="rounded-md border px-3 py-2 text-sm ${toneClass}">
          当前预警等级：${escapeHtml(warning.warningLevel)}，建议动作：${escapeHtml(warning.suggestedAction)}
        </div>
        ${renderInfoGrid([
          { label: '需求数量', value: `${formatQty(warning.requiredQty)} 件`, hint: '按当前铺布计划层数与唛架总件数推导。' },
          { label: '理论可裁数量', value: `${formatQty(warning.theoreticalCapacityQty)} 件` },
          { label: '实际裁剪数量', value: `${formatQty(warning.actualCutQty)} 件` },
          { label: '已配置总长度', value: formatLength(warning.configuredLengthTotal) },
          { label: '已领取总长度', value: formatLength(warning.claimedLengthTotal) },
          { label: '总实际铺布长度', value: formatLength(warning.totalActualLength) },
          { label: '总可用长度', value: formatLength(warning.totalUsableLength) },
          { label: '差异长度', value: formatLength(warning.varianceLength) },
          { label: '缺口数量', value: `${formatQty(warning.shortageQty)} 件` },
          { label: '建议动作', value: warning.suggestedAction },
        ])}
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(session.spreadingSessionId)}">${escapeHtml(actionLabel)}</button>
        </div>
      </div>
    `,
  )
}

function renderSpreadingCompletionLinkageSection(session: SpreadingSession, linkedOriginalCutOrderNos: string[]): string {
  const data = readMarkerSpreadingPrototypeData()
  const selectionIds = buildSpreadingCompletionTargetIds(session)
  const rows = session.originalCutOrderIds
    .map((id) => data.rowsById[id])
    .filter(Boolean)
    .map((row) => ({
      id: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      materialSummary: `${row.color} / ${row.materialSkuSummary}`,
      spreadingStatus: buildMarkerSpreadingCountsByOriginalOrder(row.originalCutOrderId).spreadingStatusLabel,
      selected: selectionIds.includes(row.originalCutOrderId),
    }))

  return renderSection(
    '状态联动区',
    session.contextType === 'merge-batch'
      ? `
          <div class="space-y-3">
            <div class="rounded-md border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              当前为批次上下文。完成铺布时，只会联动更新勾选的原始裁片单；未勾选任何项时不允许完成。
            </div>
            <div class="space-y-2">
              ${rows
                .map(
                  (row) => `
                    <label class="flex items-start gap-3 rounded-md border px-3 py-2">
                      <input type="checkbox" class="mt-1 size-4" ${row.selected ? 'checked' : ''} data-cutting-marker-action="toggle-spreading-completion-order" data-original-cut-order-id="${escapeHtml(row.id)}" />
                      <div class="space-y-1">
                        <p class="text-sm font-medium text-foreground">${escapeHtml(row.originalCutOrderNo)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(row.materialSummary)}</p>
                        <p class="text-xs text-muted-foreground">当前状态：${escapeHtml(row.spreadingStatus)}</p>
                      </div>
                    </label>
                  `,
                )
                .join('')}
            </div>
            <div class="rounded-md border bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              本次预计联动更新 ${escapeHtml(String(selectionIds.length))} 个原始裁片单。
            </div>
          </div>
        `
      : renderInfoGrid([
          { label: '当前铺布状态', value: deriveSpreadingStatus(session.status).label },
          { label: '联动更新对象', value: linkedOriginalCutOrderNos.join(' / ') || '待补' },
          { label: '联动规则', value: '当前为原始裁片单上下文，完成铺布后将直接回写该原始裁片单的铺布状态。' },
        ]),
  )
}

function renderSpreadingImportSourceSection(session: SpreadingSession, linkedOriginalCutOrderNos: string[]): string {
  const source = session.importSource
  return renderSection(
    '导入来源区',
    source
      ? renderInfoGrid([
          { label: '来源唛架编号', value: source.sourceMarkerNo || session.markerNo || '待补' },
          { label: '来源模式', value: deriveSpreadingModeMeta(source.sourceMarkerMode).label },
          { label: '上下文类型', value: source.sourceContextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文' },
          { label: '关联原始裁片单', value: source.sourceOriginalCutOrderNos.join(' / ') || linkedOriginalCutOrderNos.join(' / ') || '待补' },
          { label: '关联批次', value: source.sourceMergeBatchNo || '未绑定批次' },
          { label: '导入时间', value: formatDateText(source.importedAt) },
          { label: '重新导入', value: source.reimported ? '是' : '否' },
          { label: '导入说明', value: source.importNote || '由唛架模板导入铺布草稿' },
          { label: '理论铺布总长度', value: formatLength(session.theoreticalSpreadTotalLength || 0), hint: '来源于唛架，默认锁定。' },
          { label: '理论实际裁剪件数', value: `${formatQty(session.theoreticalActualCutPieceQty || 0)} 件`, hint: '来源于唛架计划层数与总件数的推导值。' },
          { label: '导入后调整', value: session.importAdjustmentRequired ? '已有导入后调整' : '当前未调整', hint: '调整仅影响铺布页，不反向改写唛架。' },
          { label: '调整说明', value: session.importAdjustmentNote || '暂无' },
        ])
      : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前铺布记录未绑定唛架导入来源，仍可手工补录实际卷与人员数据。</div>',
  )
}

function renderSpreadingPlanSection(session: SpreadingSession): string {
  if (session.spreadingMode === 'high-low') {
    return renderSection(
      '计划铺布明细区',
      session.highLowPlanSnapshot
        ? `
            <div class="space-y-4">
              <div class="rounded-md border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                当前为高低层模式来源，计划层数据以矩阵快照锁定展示，后续实际卷与人员记录单独维护。
              </div>
              <article class="space-y-3">
                <div>
                  <h4 class="text-sm font-semibold text-foreground">裁剪明细矩阵快照</h4>
                  <p class="mt-1 text-xs text-muted-foreground">只读继承自唛架，不在铺布页直接改写。</p>
                </div>
                ${renderHighLowCuttingMatrix(session.highLowPlanSnapshot.cuttingRows, true)}
              </article>
              <article class="space-y-3">
                <div>
                  <h4 class="text-sm font-semibold text-foreground">模式分布矩阵快照</h4>
                  <p class="mt-1 text-xs text-muted-foreground">只读继承自唛架，用于后续铺布执行对照。</p>
                </div>
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
          <div class="mb-3 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
            当前计划铺布明细由唛架导入，模式、上下文、理论长度和计划主体默认锁定，只允许在下方补录实际执行数据。
          </div>
          <div class="overflow-auto">
            <table class="min-w-[1180px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">排版编号</th>
                  <th class="px-3 py-2">排版说明</th>
                  <th class="px-3 py-2">颜色</th>
                  <th class="px-3 py-2">铺布次数</th>
                  <th class="px-3 py-2">唛架长度</th>
                  <th class="px-3 py-2">唛件数</th>
                  <th class="px-3 py-2">单件量</th>
                  <th class="px-3 py-2">理论铺布总长度</th>
                  <th class="px-3 py-2">门幅提示</th>
                  <th class="px-3 py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                ${session.planLineItems
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-2">${escapeHtml(item.layoutCode || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(item.layoutDetailText || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(item.color || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(item.markerLength || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(item.markerPieceCount || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(item.singlePieceUsage || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(item.plannedSpreadTotalLength || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(item.widthHint || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(item.note || '—')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
      : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前缺少计划铺布明细，请先回到唛架补齐可导入的排版明细。</div>',
  )
}

function renderMarkerPlanMetricsSection(
  marker: MarkerRecord,
  usageSummary: ReturnType<typeof computeUsageSummary>,
): string {
  return renderSection(
    '计划 / 计算补充信息区',
    renderInfoGrid([
      { label: '面料类别', value: marker.materialCategory || '待补' },
      { label: '面料属性', value: marker.materialAttr || '待补' },
      { label: '计划尺码配比文本', value: marker.plannedSizeRatioText || '待补' },
      { label: '计划层数', value: `${formatQty(marker.plannedLayerCount || 0)} 层` },
      { label: '计划唛架数', value: `${formatQty(marker.plannedMarkerCount || 0)} 张` },
      { label: 'fabricSku', value: marker.fabricSku || '待补' },
      { label: 'markerLength', value: formatLength(marker.markerLength || marker.netLength) },
      { label: '采购单件用量', value: formatLength(usageSummary.procurementUnitUsage) },
      { label: '实际单件用量', value: formatLength(usageSummary.actualUnitUsage) },
      { label: '预算米数', value: formatLength(usageSummary.plannedMaterialMeter) },
      { label: '实际使用米数', value: formatLength(usageSummary.actualMaterialMeter) },
      { label: '实际裁剪数量', value: `${formatQty(usageSummary.actualCutQty)} 件` },
    ]),
  )
}

function renderMarkerRowTemplateDetailTable(lineItems: MarkerLineItem[]): string {
  return `
    <div class="overflow-auto">
      <table class="min-w-[1180px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">行号</th>
            <th class="px-3 py-2">排版编码</th>
            <th class="px-3 py-2">排版明细</th>
            <th class="px-3 py-2">颜色</th>
            <th class="px-3 py-2">次数 / 层数</th>
            <th class="px-3 py-2">唛架长度</th>
            <th class="px-3 py-2">唛件数</th>
            <th class="px-3 py-2">单件量</th>
            <th class="px-3 py-2">铺布总长度</th>
            <th class="px-3 py-2">门幅提示</th>
            <th class="px-3 py-2">备注</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems
            .map(
              (item) => `
                <tr class="border-b">
                  <td class="px-3 py-2">${escapeHtml(String(item.lineNo || '-'))}</td>
                  <td class="px-3 py-2">${escapeHtml(item.layoutCode || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(item.layoutDetailText || item.ratioLabel || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(item.color || '待补')}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(item.spreadRepeatCount || 0))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatLength(item.markerLength))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(item.markerPieceCount ?? item.pieceCount ?? 0))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatLength(item.singlePieceUsage || computeSinglePieceUsage(item.markerLength, item.markerPieceCount ?? item.pieceCount ?? 0)))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatLength(item.spreadTotalLength ?? item.spreadingTotalLength ?? Number((item.markerLength * Math.max(item.spreadRepeatCount || 0, 0)).toFixed(2))))}</td>
                  <td class="px-3 py-2">${escapeHtml(item.widthHint || '—')}</td>
                  <td class="px-3 py-2">${escapeHtml(item.note || '—')}</td>
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
      <table class="min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">颜色</th>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<th class="px-3 py-2">${escapeHtml(sizeKey)}</th>`).join('')}
            <th class="px-3 py-2">合计</th>
            ${readonly ? '' : '<th class="px-3 py-2">操作</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-2">
                    ${
                      readonly
                        ? escapeHtml(row.color || '待补')
                        : `<input type="text" value="${escapeHtml(row.color || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-color="true" />`
                    }
                  </td>
                  ${MARKER_SIZE_KEYS.map((sizeKey) =>
                    readonly
                      ? `<td class="px-3 py-2">${escapeHtml(formatQty(row.sizeValues[sizeKey] || 0))}</td>`
                      : `<td class="px-3 py-2"><input type="number" value="${escapeHtml(String(row.sizeValues[sizeKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-cutting-row-index="${rowIndex}" data-cutting-marker-highlow-cutting-size="${escapeHtml(sizeKey)}" /></td>`,
                  ).join('')}
                  <td class="px-3 py-2 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? '' : `<td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-cutting-row" data-index="${rowIndex}">删除</button></td>`}
                </tr>
              `,
            )
            .join('')}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-2">列合计</td>
            ${MARKER_SIZE_KEYS.map((sizeKey) => `<td class="px-3 py-2">${escapeHtml(formatQty(columnTotals[sizeKey]))}</td>`).join('')}
            <td class="px-3 py-2">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? '' : '<td class="px-3 py-2">—</td>'}
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
      <table class="min-w-[980px] text-sm">
        <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2">颜色</th>
            ${patternKeys
              .map((patternKey, patternIndex) =>
                readonly
                  ? `<th class="px-3 py-2">${escapeHtml(patternKey)}</th>`
                  : `<th class="px-3 py-2">
                      <div class="space-y-1">
                        <input type="text" value="${escapeHtml(patternKey)}" class="h-8 w-28 rounded-md border px-2 text-xs" data-cutting-marker-highlow-pattern-key-index="${patternIndex}" />
                        <button type="button" class="rounded-md border px-2 py-0.5 text-[11px] hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-key" data-index="${patternIndex}">删列</button>
                      </div>
                    </th>`,
              )
              .join('')}
            <th class="px-3 py-2">合计</th>
            ${readonly ? '' : '<th class="px-3 py-2">操作</th>'}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rowIndex) => `
                <tr class="border-b">
                  <td class="px-3 py-2">
                    ${
                      readonly
                        ? escapeHtml(row.color || '待补')
                        : `<input type="text" value="${escapeHtml(row.color || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-color="true" />`
                    }
                  </td>
                  ${patternKeys
                    .map((patternKey) =>
                      readonly
                        ? `<td class="px-3 py-2">${escapeHtml(formatQty(row.patternValues[patternKey] || 0))}</td>`
                        : `<td class="px-3 py-2"><input type="number" value="${escapeHtml(String(row.patternValues[patternKey] || 0))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-marker-highlow-pattern-row-index="${rowIndex}" data-cutting-marker-highlow-pattern-key="${escapeHtml(patternKey)}" /></td>`,
                    )
                    .join('')}
                  <td class="px-3 py-2 font-medium">${escapeHtml(formatQty(row.total || 0))}</td>
                  ${readonly ? '' : `<td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-highlow-pattern-row" data-index="${rowIndex}">删除</button></td>`}
                </tr>
              `,
            )
            .join('')}
        </tbody>
        <tfoot class="bg-muted/30 text-xs font-medium text-foreground">
          <tr>
            <td class="px-3 py-2">列合计</td>
            ${patternKeys.map((patternKey) => `<td class="px-3 py-2">${escapeHtml(formatQty(Number(columnTotals[patternKey] || 0)))}</td>`).join('')}
            <td class="px-3 py-2">${escapeHtml(formatQty(grandTotal))}</td>
            ${readonly ? '' : '<td class="px-3 py-2">—</td>'}
          </tr>
        </tfoot>
      </table>
    </div>
  `
}

function renderMarkerDetailPage(): string {
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'marker-detail')
  const row = getMarkerRow(getSearchParams().get('markerId'))

  if (!row) {
    return `
      <div class="space-y-3 p-4">
        ${renderCuttingPageHeader(meta, {
          actionsHtml: renderHeaderActions(appendSummaryReturnAction([
            '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">返回列表</button>',
          ])),
        })}
        <section class="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">未找到对应唛架记录，请返回列表重新选择。</section>
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
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="markers">返回列表</button>',
          `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="open-marker-edit" data-marker-id="${escapeHtml(row.markerId)}">去编辑</button>`,
          `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-spreading-from-marker" data-marker-id="${escapeHtml(row.markerId)}">从唛架导入铺布</button>`,
        ])),
      })}
      ${renderPrefilterBar()}
      ${renderImportDecisionPanel()}
      ${renderSection(
        '基础信息区',
        renderInfoGrid([
          { label: '唛架序号', value: row.markerNo },
          { label: '模式', value: modeMeta.label },
          { label: '上下文类型', value: row.contextLabel },
          { label: '原始裁片单摘要', value: row.originalCutOrderNos.join(' / ') || '待补' },
          { label: 'mergeBatch 摘要', value: row.mergeBatchNo || '未绑定批次' },
          { label: '款号 / SPU', value: `${row.styleCode || '待补'} / ${row.spuCode || '待补'}` },
          { label: '面料 SKU 摘要', value: row.materialSkuSummary || '待补' },
          { label: '颜色摘要', value: row.colorSummary || '待补' },
        ]),
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
                <table class="min-w-full text-sm">
                  <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2">来源裁片单号</th>
                      <th class="px-3 py-2">颜色</th>
                      <th class="px-3 py-2">尺码</th>
                      <th class="px-3 py-2">面料 SKU</th>
                      <th class="px-3 py-2">异常</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailView.missingMappings
                      .map(
                        (item) => `
                          <tr class="border-b align-top">
                            <td class="px-3 py-2">${escapeHtml(item.sourceCutOrderNo)}</td>
                            <td class="px-3 py-2">${escapeHtml(item.color || '待补')}</td>
                            <td class="px-3 py-2">${escapeHtml(item.sizeLabel || '待补')}</td>
                            <td class="px-3 py-2">${escapeHtml(item.materialSku || '待补')}</td>
                            <td class="px-3 py-2">${getMarkerMappingStatusTag(item.mappingStatus)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.reason)}</div></td>
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
            { label: '唛架总件数', value: `${formatQty(row.totalPieces)} 件` },
            { label: '计划尺码配比', value: detailView.plannedSizeRatioText || '待补' },
            { label: '配比摘要', value: detailView.lineSummary.summaryText },
          ])}
          <div class="mt-4 overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">尺码</th>
                  <th class="px-3 py-2">数量</th>
                </tr>
              </thead>
              <tbody>
                ${row.record.sizeDistribution
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-2">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(item.quantity))}</td>
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
              '排版明细区',
              renderMarkerRowTemplateDetailTable(row.record.lineItems || []),
            )
          : renderSection(
              '高低层矩阵区',
              `
                <div class="space-y-4">
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">裁剪明细矩阵</h4>
                      <p class="mt-1 text-xs text-muted-foreground">行按颜色展开，列按尺码展开，展示高低层模式下的裁剪件数分布。</p>
                    </div>
                    ${renderHighLowCuttingMatrix(detailView.highLowCuttingRows, true)}
                    <p class="text-xs text-muted-foreground">裁剪明细总合计：${escapeHtml(formatQty(detailView.highLowCuttingTotal))} 件</p>
                  </article>
                  <article class="space-y-3">
                    <div>
                      <h4 class="text-sm font-semibold text-foreground">唛架模式矩阵</h4>
                      <p class="mt-1 text-xs text-muted-foreground">动态列用于表达高低层模式分布，例如 S*1、XL*1、L*1+plusonesize。</p>
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
          { label: '单件用量', value: formatLength(row.singlePieceUsage) },
          { label: '铺布总长度', value: formatLength(row.spreadTotalLength) },
          { label: '预算米数', value: formatLength(usageSummary.plannedMaterialMeter) },
          { label: '实际使用米数', value: formatLength(usageSummary.actualMaterialMeter) },
          { label: '实际裁剪数量', value: `${formatQty(usageSummary.actualCutQty)} 件` },
        ]),
      )}
      ${renderMarkerPlanMetricsSection(row.record, usageSummary)}
      ${renderMarkerWarningSection(detailView.warningMessages)}
      ${renderSection(
        '图片与备注区',
        `
          <div class="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">唛架图</p>
              <p class="mt-1 text-sm font-medium">${escapeHtml(row.record.markerImageName || '当前未上传唛架图')}</p>
              <p class="mt-2 text-xs text-muted-foreground">原型阶段先保留文件名与预览占位，后续再接更完整的图片管理。</p>
            </article>
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">备注</p>
              <p class="mt-1 text-sm">${escapeHtml(row.record.note || '暂无备注')}</p>
              <div class="mt-3 rounded-md border border-dashed bg-background px-3 py-2 text-sm text-muted-foreground">
                <p>调整 / 换一入口占位</p>
                <p class="mt-1">是否有调整：${escapeHtml(row.record.adjustmentRequired ? '是' : '否')}</p>
                <p class="mt-1">调整说明：${escapeHtml(row.record.adjustmentNote || '暂无')}</p>
                <p class="mt-1">换一功能占位：${escapeHtml(row.record.replacementDraftFlag ? '已预留换一草稿' : '仅保留入口占位')}</p>
              </div>
            </article>
          </div>
        `,
      )}
    </div>
  `
}

function renderMarkerEditPage(): string {
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
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="cancel-marker-edit">取消</button>',
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="save-marker">保存草稿</button>',
          '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="save-marker-and-view">保存并返回详情</button>',
        ])),
      })}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderSection(
        '基础表单',
        `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderTextInput('唛架序号', draft.markerNo || '', 'data-cutting-marker-draft-field="markerNo"')}
            ${renderSelect('唛架模式', draft.markerMode, 'data-cutting-marker-draft-field="markerMode"', [
              { value: 'normal', label: '正常模式' },
              { value: 'high-low', label: '高低层模式' },
              { value: 'folded', label: '对折铺布模式' },
            ])}
            ${renderTextInput('上下文类型', draft.contextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文', 'disabled')}
            ${renderTextInput('关联原始裁片单', (draft.originalCutOrderNos || draft.originalCutOrderIds).join(' / '), 'disabled', '当前由上游预筛带入')}
            ${renderTextInput('关联批次', draft.mergeBatchNo || '', 'disabled', '可为空')}
            ${renderTextInput('款号 / SPU', `${draft.styleCode || ''} / ${draft.spuCode || ''}`, 'disabled', '来源于上下文')}
            ${renderTextInput('面料摘要', draft.materialSkuSummary || '', 'disabled')}
            ${renderTextInput('颜色摘要', draft.colorSummary || '', 'data-cutting-marker-draft-field="colorSummary"', '可手工补充')}
            ${renderNumberInput('唛架净长度（米）', draft.netLength, 'data-cutting-marker-draft-field="netLength"')}
            ${renderNumberInput('单件用量（米）', draft.singlePieceUsage, 'data-cutting-marker-draft-field="singlePieceUsage"', '0.001')}
            ${renderNumberInput('铺布总长度（米）', draft.spreadTotalLength || 0, 'data-cutting-marker-draft-field="spreadTotalLength"', '0.01')}
          </div>
        `,
      )}
      ${renderSection('关联裁片单与可分配背景区', renderMarkerSourceRowsTable(pieceExplosion.sourceOrderRows))}
      ${renderSection(
        '分配明细编辑区',
        `
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm text-muted-foreground">按来源裁片单 + 颜色 + 尺码分配计划成衣数量，作为技术包裁片拆解的事实源。</div>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-allocation-line">新增分配行</button>
          </div>
          <div class="overflow-auto">
            <table class="min-w-[1380px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">来源裁片单</th>
                  <th class="px-3 py-2">来源生产单</th>
                  <th class="px-3 py-2">颜色</th>
                  <th class="px-3 py-2">面料 SKU</th>
                  <th class="px-3 py-2">款号 / SPU</th>
                  <th class="px-3 py-2">技术包 SPU</th>
                  <th class="px-3 py-2">尺码</th>
                  <th class="px-3 py-2">计划成衣数</th>
                  <th class="px-3 py-2">备注</th>
                  <th class="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                ${(draft.allocationLines || [])
                  .map((line, index) => {
                    const selectedSourceRow =
                      sourceRows.find((row) => row.sourceCutOrderId === line.sourceCutOrderId) || null
                    return `
                      <tr class="border-b align-top">
                        <td class="px-3 py-2">
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
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(selectedSourceRow?.sourceProductionOrderNo || line.sourceProductionOrderNo || '待补')}</td>
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(selectedSourceRow?.color || line.color || '待补')}</td>
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(selectedSourceRow?.materialSku || line.materialSku || '待补')}</td>
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(`${selectedSourceRow?.styleCode || line.styleCode || '待补'} / ${selectedSourceRow?.spuCode || line.spuCode || '待补'}`)}</td>
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(selectedSourceRow?.techPackSpuCode || line.techPackSpuCode || '未关联')}</td>
                        <td class="px-3 py-2">
                          <input type="text" value="${escapeHtml(line.sizeLabel || '')}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="sizeLabel" />
                        </td>
                        <td class="px-3 py-2">
                          <input type="number" min="0" value="${escapeHtml(String(line.plannedGarmentQty || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="plannedGarmentQty" />
                        </td>
                        <td class="px-3 py-2">
                          <input type="text" value="${escapeHtml(line.note || '')}" class="h-9 w-40 rounded-md border px-3 text-sm" data-cutting-marker-allocation-index="${index}" data-cutting-marker-allocation-field="note" />
                        </td>
                        <td class="px-3 py-2">
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
            <table class="min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">尺码</th>
                  <th class="px-3 py-2">尺码配比</th>
                  <th class="px-3 py-2">allocation 合计</th>
                  <th class="px-3 py-2">差值</th>
                  <th class="px-3 py-2">校验</th>
                </tr>
              </thead>
              <tbody>
                ${pieceExplosion.allocationSizeSummary
                  .map(
                    (item) => `
                      <tr class="border-b">
                        <td class="px-3 py-2">${escapeHtml(item.sizeLabel)}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(item.requiredQty))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(item.allocatedQty))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(Math.abs(item.differenceQty)))}</td>
                        <td class="px-3 py-2">${
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
              <p class="text-sm text-muted-foreground">支持动态尺码输入，兼容 2XL / 3XL / 4XL / onesize / plusonesize 等业务尺码。</p>
              <p class="mt-1 text-xs text-muted-foreground">当前总件数：${escapeHtml(formatQty(totalPieces))} 件</p>
            </div>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-size-row">新增尺码行</button>
          </div>
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">尺码</th>
                  <th class="px-3 py-2">数量</th>
                  <th class="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                ${draft.sizeDistribution
                  .map(
                    (item, index) => `
                      <tr class="border-b">
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.sizeLabel)}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="sizeLabel" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(item.quantity))}" class="h-9 w-full rounded-md border px-3 text-sm" data-cutting-marker-size-index="${index}" data-cutting-marker-size-field="quantity" /></td>
                        <td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-size-row" data-index="${index}">删除</button></td>
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
              '排版明细编辑区',
              `
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm text-muted-foreground">当前模式使用行明细模板。line item 不再单独维护模式，只承接当前唛架头部模式下的排版数据。</p>
                    <p class="mt-1 text-xs text-muted-foreground">当前模式：${escapeHtml(deriveMarkerModeMeta(draft.markerMode).label)}</p>
                  </div>
                  <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-line-item">新增明细行</button>
                </div>
                <div class="overflow-auto">
                  <table class="min-w-[1380px] text-sm">
                    <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2">行号</th>
                        <th class="px-3 py-2">排版编码</th>
                        <th class="px-3 py-2">排版明细</th>
                        <th class="px-3 py-2">颜色</th>
                        <th class="px-3 py-2">次数 / 层数</th>
                        <th class="px-3 py-2">唛架长度</th>
                        <th class="px-3 py-2">唛件数</th>
                        <th class="px-3 py-2">单件量</th>
                        <th class="px-3 py-2">铺布总长度</th>
                        <th class="px-3 py-2">门幅提示</th>
                        <th class="px-3 py-2">备注</th>
                        <th class="px-3 py-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(draft.lineItems || [])
                        .map(
                          (item, index) => `
                            <tr class="border-b align-top">
                              <td class="px-3 py-2">${escapeHtml(String(item.lineNo || index + 1))}</td>
                              <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.layoutCode || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutCode" /></td>
                              <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.layoutDetailText || item.ratioLabel || '')}" class="h-9 w-52 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="layoutDetailText" /></td>
                              <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.color)}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="color" /></td>
                              <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(item.spreadRepeatCount || 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadRepeatCount" /></td>
                              <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(item.markerLength))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerLength" /></td>
                              <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(item.markerPieceCount ?? item.pieceCount ?? 0))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="markerPieceCount" /></td>
                              <td class="px-3 py-2"><input type="number" step="0.001" value="${escapeHtml(String(item.singlePieceUsage))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="singlePieceUsage" /></td>
                              <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(item.spreadTotalLength ?? item.spreadingTotalLength ?? 0))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="spreadTotalLength" /></td>
                              <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.widthHint || '')}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="widthHint" /></td>
                              <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.note)}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-marker-line-index="${index}" data-cutting-marker-line-field="note" /></td>
                              <td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-line-item" data-index="${index}">删除</button></td>
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
                        <p class="mt-1 text-xs text-muted-foreground">行按颜色展开，列按尺码展开，用于维护高低层模式下的裁剪件数。</p>
                      </div>
                      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-cutting-row">新增颜色行</button>
                    </div>
                    ${renderHighLowCuttingMatrix(highLowCuttingTotals.rows, false)}
                    <p class="text-xs text-muted-foreground">裁剪明细总合计：${escapeHtml(formatQty(highLowCuttingTotals.cuttingTotal))} 件</p>
                  </article>
                  <article class="space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="text-sm font-semibold text-foreground">唛架模式矩阵</h4>
                        <p class="mt-1 text-xs text-muted-foreground">模式列默认带入高低层典型组合，并允许继续增删和改名。</p>
                      </div>
                      <div class="flex gap-2">
                        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-key">新增模式列</button>
                        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-highlow-pattern-row">新增颜色行</button>
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
        '图片上传区',
        `
          <div class="grid gap-3 md:grid-cols-2">
            ${renderTextInput('唛架图文件名', draft.markerImageName || '', 'data-cutting-marker-draft-field="markerImageName"', '原型阶段可直接填写文件名')}
            ${renderTextInput('图片预览地址（可选）', draft.markerImageUrl || '', 'data-cutting-marker-draft-field="markerImageUrl"', '原型阶段可直接填写本地预览地址')}
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
            ${renderSelect('换一功能占位', draft.replacementDraftFlag ? 'true' : 'false', 'data-cutting-marker-draft-field="replacementDraftFlag"', [
              { value: 'false', label: '未启用' },
              { value: 'true', label: '预留换一草稿' },
            ])}
            <div class="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              <p>当前不做复杂审批和版本系统。</p>
              <p class="mt-1">本次仅冻结“调整记录 / 换一”入口和字段。</p>
            </div>
          </div>
          <div class="mt-3">
            ${renderTextarea('调整说明', draft.adjustmentNote || '', 'data-cutting-marker-draft-field="adjustmentNote"', 4)}
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
            '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">返回列表</button>',
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
    mergeBatches: pageData.mergeBatches,
    markerRecords: pageData.store.markers,
  })
  const session = row.session
  const modeMeta = deriveSpreadingModeMeta(session.spreadingMode)
  const statusMeta = deriveSpreadingStatus(session.status)
  const rollSummary = detailView.varianceSummary ? summarizeSpreadingRolls(session.rolls) : summarizeSpreadingRolls(session.rolls)
  const linkedMarker = detailView.markerRecord
  const varianceSummary = detailView.varianceSummary
  const replenishmentWarning = detailView.replenishmentWarning
  const operatorAmountSummary = detailView.operatorAmountSummary
  const operatorAmountWarnings = detailView.amountWarnings

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(appendSummaryReturnAction([
          '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-list" data-tab="spreadings">返回列表</button>',
          `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="open-spreading-edit" data-session-id="${escapeHtml(row.spreadingSessionId)}">去编辑</button>`,
          `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-original-orders" data-session-id="${escapeHtml(row.spreadingSessionId)}">查看关联原始裁片单</button>`,
          `${row.mergeBatchNo ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-linked-merge-batches" data-session-id="${escapeHtml(row.spreadingSessionId)}">查看关联批次</button>` : ''}`,
          `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(row.spreadingSessionId)}">去补料管理</button>`,
        ])),
      })}
      ${renderPrefilterBar()}
      ${renderSection(
        '基础信息区',
        renderInfoGrid([
          { label: '铺布编号', value: row.sessionNo },
          { label: '铺布模式', value: modeMeta.label },
          { label: '上下文类型', value: row.contextLabel },
          { label: '原始裁片单摘要', value: row.originalCutOrderNos.join(' / ') || '待补' },
          { label: '批次摘要', value: row.mergeBatchNo || '未绑定批次' },
          { label: '款号 / 款式编码', value: `${row.styleCode || '待补'} / ${row.spuCode || '待补'}` },
          { label: '面料摘要', value: row.materialSkuSummary || '待补' },
          { label: '颜色摘要', value: row.colorSummary || '待补' },
          { label: '状态', value: statusMeta.label },
        ]),
      )}
      ${renderSection(
        '状态摘要区',
        renderInfoGrid([
          { label: '当前铺布状态', value: statusMeta.label, hint: statusMeta.detailText },
          {
            label: '关联原始裁片单状态摘要',
            value:
              session.status === 'DONE'
                ? `已联动更新 ${formatQty(session.completionLinkage?.linkedOriginalCutOrderIds.length || row.completedOriginalOrderCount)} 个原始裁片单`
                : '当前尚未完成铺布联动',
          },
          {
            label: '本次联动更新对象',
            value: session.completionLinkage?.linkedOriginalCutOrderNos.join(' / ') || '当前尚未生成联动痕迹',
          },
          {
            label: '完成时间',
            value: session.completionLinkage?.completedAt || '未完成',
          },
          {
            label: '操作人',
            value: session.completionLinkage?.completedBy || '待记录',
          },
          {
            label: '补料预警生成',
            value: session.completionLinkage?.generatedWarning ? '已生成' : '当前尚未生成',
          },
        ]),
      )}
      ${renderSection(
        '唛架关联区',
        renderInfoGrid([
          { label: '关联唛架编号', value: session.markerNo || '待关联' },
          { label: '唛架模式', value: linkedMarker ? deriveSpreadingModeMeta(linkedMarker.markerMode).label : '待补' },
          { label: '唛架总件数', value: `${formatQty(linkedMarker?.totalPieces || 0)} 件` },
          { label: '唛架净长度', value: formatLength(linkedMarker?.netLength || 0) },
          { label: '单件用量', value: formatLength(linkedMarker?.singlePieceUsage || 0) },
          { label: '价格 / 金额字段', value: session.unitPrice ? `${session.unitPrice.toFixed(2)} 元 / 件` : '待保留' },
          { label: '从唛架导入', value: session.importedFromMarker ? '当前草稿已承接关联唛架' : '本次仍以手工选择唛架为主' },
        ]),
      )}
      ${renderSpreadingImportSourceSection(session, detailView.linkedOriginalCutOrderNos)}
      ${renderSpreadingPlanSection(session)}
      ${renderSection(
        '卷记录区',
        `
          <div class="overflow-auto">
            <table class="min-w-[1480px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">排序</th>
                  <th class="px-3 py-2">卷号</th>
                  <th class="px-3 py-2">面料编码</th>
                  <th class="px-3 py-2">颜色</th>
                  <th class="px-3 py-2">幅宽</th>
                  <th class="px-3 py-2">标注长度</th>
                  <th class="px-3 py-2">实际长度</th>
                  <th class="px-3 py-2">布头</th>
                  <th class="px-3 py-2">布尾</th>
                  <th class="px-3 py-2">层数</th>
                  <th class="px-3 py-2">单卷可用长度</th>
                  <th class="px-3 py-2">剩余布料长度</th>
                  <th class="px-3 py-2">实际裁剪件数</th>
                  <th class="px-3 py-2">时间</th>
                  <th class="px-3 py-2">参与人员链</th>
                  <th class="px-3 py-2">交接说明</th>
                  <th class="px-3 py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                ${session.rolls
                  .map((roll) => {
                    const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)
                    const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength)
                    const linkedOperators = detailView.operatorsByRollId[roll.rollRecordId] || []
                    return `
                      <tr class="border-b">
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(roll.sortOrder || '—'))}</td>
                        <td class="px-3 py-2">${escapeHtml(roll.rollNo || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(roll.materialSku || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(roll.color || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(roll.width ? `${roll.width} cm` : '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(roll.labeledLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(roll.actualLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(roll.headLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(roll.tailLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(roll.layerCount))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(usableLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(remainingLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatQty(roll.actualCutPieceQty || 0))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatDateText(roll.occurredAt || ''))}</td>
                        <td class="px-3 py-2">${escapeHtml(detailView.rollParticipantSummary[roll.rollRecordId] || roll.operatorNames.join(' → ') || '待补')}</td>
                        <td class="px-3 py-2">${escapeHtml(linkedOperators.map((operator) => operator.handoverNotes).filter((value) => value.trim()).join(' / ') || roll.handoverNotes || '—')}</td>
                        <td class="px-3 py-2">${escapeHtml(roll.note || '—')}</td>
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
        '人员记录区',
        session.rolls.length
          ? `
              <div class="mb-3 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                同卷换班不会拆成第二卷。以下按“卷 -> 人员交接记录”展示每个人从第几层铺到第几层、负责多少长度、负责多少件，以及交接是否连续。
              </div>
              <div class="space-y-4">
                ${session.rolls
                  .map((roll) => {
                    const handoverSummary = detailView.handoverSummaryByRollId[roll.rollRecordId] || buildRollHandoverViewModel(roll, [], linkedMarker?.totalPieces || 0)
                    return `
                      <article class="rounded-lg border bg-muted/10 p-3">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="space-y-1">
                            <h4 class="text-sm font-semibold text-foreground">卷 ${escapeHtml(roll.rollNo || '待补')}</h4>
                            <p class="text-xs text-muted-foreground">当前卷共有 ${escapeHtml(String(handoverSummary.operators.length))} 条人员记录，负责长度合计 ${escapeHtml(formatLength(handoverSummary.totalHandledLength))}。</p>
                          </div>
                          ${renderRollHandoverStatus(handoverSummary)}
                        </div>
                        <div class="mt-3">
                          ${renderInfoGrid([
                            { label: '卷号', value: roll.rollNo || '待补' },
                            { label: '铺布层数', value: `${formatQty(roll.layerCount)} 层` },
                            { label: '最后结束层', value: formatLayerValue(handoverSummary.finalHandledLayer) },
                            { label: '负责长度合计', value: formatHandledLengthValue(handoverSummary.totalHandledLength) },
                            { label: '层数连续性', value: handoverSummary.continuityStatus },
                            { label: '铺完状态', value: handoverSummary.incompleteCoverage ? '未完整铺完' : '当前卷已铺完' },
                          ])}
                        </div>
                        <div class="mt-3 overflow-auto">
                          <table class="min-w-[2140px] text-sm">
                            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                              <tr>
                                <th class="px-3 py-2">排序号</th>
                                <th class="px-3 py-2">人员姓名</th>
                                <th class="px-3 py-2">动作类型</th>
                                <th class="px-3 py-2">开始时间</th>
                                <th class="px-3 py-2">结束时间</th>
                                <th class="px-3 py-2">开始层</th>
                                <th class="px-3 py-2">结束层</th>
                                <th class="px-3 py-2">负责层数</th>
                                <th class="px-3 py-2">负责长度</th>
                                <th class="px-3 py-2">负责件数</th>
                                <th class="px-3 py-2">单价</th>
                                <th class="px-3 py-2">计价方式</th>
                                <th class="px-3 py-2">计算金额</th>
                                <th class="px-3 py-2">最终显示金额</th>
                                <th class="px-3 py-2">人工调整</th>
                                <th class="px-3 py-2">金额备注</th>
                                <th class="px-3 py-2">上一个交接人</th>
                                <th class="px-3 py-2">下一个接手人</th>
                                <th class="px-3 py-2">交接说明</th>
                                <th class="px-3 py-2">备注</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${handoverSummary.operators
                                .map(
                                  (item, index) => `
                                    <tr class="border-b">
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(item.operator.sortOrder || index + 1))}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.operatorName || '待补录')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.actionType || '待补录')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.startAt || '待补录')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.endAt || '待补录')}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatLayerValue(item.operator.startLayer))}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatLayerValue(item.operator.endLayer))}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatLayerValue(item.handledLayerCount))}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatHandledLengthValue(item.operator.handledLength ?? item.handoverAtLength))}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.handledPieceQty === null ? '待补录' : `${formatQty(item.handledPieceQty)} 件`)}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatCurrency(item.operator.unitPrice))}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.pricingMode || '按件计价')}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatCurrency(item.calculatedAmount))}</td>
                                      <td class="px-3 py-2">${escapeHtml(formatCurrency(item.displayAmount))}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.manualAmountAdjusted ? '已调整' : '未调整')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.amountNote || '—')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.previousOperatorName || item.operator.previousOperatorName || '—')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.nextOperatorName || item.operator.nextOperatorName || '—')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.handoverNotes || '—')}</td>
                                      <td class="px-3 py-2">${escapeHtml(item.operator.note || '—')}</td>
                                    </tr>
                                  `,
                                )
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                        <div class="mt-3">
                          ${renderRollHandoverWarnings(handoverSummary)}
                        </div>
                      </article>
                    `
                  })
                  .join('')}
                ${
                  detailView.sortedOperators.some((operator) => !operator.rollRecordId)
                    ? `
                        <article class="rounded-lg border border-dashed bg-card p-3">
                          <h4 class="text-sm font-semibold text-foreground">未关联卷的人员记录</h4>
                          <p class="mt-1 text-xs text-muted-foreground">以下旧记录尚未绑定到具体卷，当前无法形成同卷交接链，请回编辑页补齐。</p>
                          <div class="mt-3 overflow-auto">
                            <table class="min-w-[1680px] text-sm">
                              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                                <tr>
                                  <th class="px-3 py-2">排序号</th>
                                  <th class="px-3 py-2">人员姓名</th>
                                  <th class="px-3 py-2">动作类型</th>
                                  <th class="px-3 py-2">开始时间</th>
                                  <th class="px-3 py-2">结束时间</th>
                                  <th class="px-3 py-2">开始层</th>
                                  <th class="px-3 py-2">结束层</th>
                                  <th class="px-3 py-2">负责长度</th>
                                  <th class="px-3 py-2">负责件数</th>
                                  <th class="px-3 py-2">单价</th>
                                  <th class="px-3 py-2">计价方式</th>
                                  <th class="px-3 py-2">最终显示金额</th>
                                  <th class="px-3 py-2">交接说明</th>
                                  <th class="px-3 py-2">备注</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${detailView.sortedOperators
                                  .filter((operator) => !operator.rollRecordId)
                                  .map(
                                    (operator, index) => `
                                      <tr class="border-b">
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(operator.sortOrder || index + 1))}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.operatorName || '待补录')}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.actionType || '待补录')}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.startAt || '待补录')}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.endAt || '待补录')}</td>
                                        <td class="px-3 py-2">${escapeHtml(formatLayerValue(operator.startLayer))}</td>
                                        <td class="px-3 py-2">${escapeHtml(formatLayerValue(operator.endLayer))}</td>
                                        <td class="px-3 py-2">${escapeHtml(formatHandledLengthValue(operator.handledLength))}</td>
                                        <td class="px-3 py-2">${escapeHtml(
                                          computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, linkedMarker?.totalPieces || 0) === null
                                            ? '待补录'
                                            : `${formatQty(computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, linkedMarker?.totalPieces || 0) || 0)} 件`,
                                        )}</td>
                                        <td class="px-3 py-2">${escapeHtml(formatCurrency(operator.unitPrice))}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.pricingMode || '按件计价')}</td>
                                        <td class="px-3 py-2">${escapeHtml(
                                          formatCurrency(
                                            computeOperatorDisplayAmount(
                                              operator,
                                              computeOperatorCalculatedAmount({
                                                pricingMode: operator.pricingMode,
                                                unitPrice: operator.unitPrice ?? session.unitPrice,
                                                handledLayerCount: computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer),
                                                handledLength: operator.handledLength,
                                                handledPieceQty: computeOperatorHandledPieceQty(
                                                  operator.startLayer,
                                                  operator.endLayer,
                                                  linkedMarker?.totalPieces || 0,
                                                ),
                                              }),
                                            ),
                                          ),
                                        )}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.handoverNotes || '—')}</td>
                                        <td class="px-3 py-2">${escapeHtml(operator.note || '—')}</td>
                                      </tr>
                                    `,
                                  )
                                  .join('')}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      `
                    : ''
                }
              </div>
            `
          : '<div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">当前尚未录入卷记录，因此没有卷内交接量化数据。</div>',
      )}
      ${renderSection('按人汇总区', renderOperatorAllocationSummary(operatorAmountSummary))}
      ${renderSection('金额提醒区', renderOperatorAmountWarningSection(operatorAmountWarnings))}
      ${renderSection(
        '汇总区',
        renderInfoGrid([
          { label: '卷数', value: `${formatQty(row.rollCount)} 卷` },
          { label: '人员数', value: `${formatQty(row.operatorCount)} 人` },
          { label: '总实际铺布长度', value: formatLength(rollSummary.totalActualLength) },
          { label: '总布头长度', value: formatLength(rollSummary.totalHeadLength) },
          { label: '总布尾长度', value: formatLength(rollSummary.totalTailLength) },
          { label: '总可用长度', value: formatLength(rollSummary.totalCalculatedUsableLength) },
          { label: '总剩余长度', value: formatLength(rollSummary.totalRemainingLength) },
          { label: '实际裁剪件数合计', value: `${formatQty(row.actualCutPieceQty)} 件` },
          { label: '人员金额合计', value: formatCurrency(operatorAmountSummary.totalDisplayAmount) },
          { label: '已配置总长度', value: formatLength(varianceSummary?.configuredLengthTotal || row.configuredLengthTotal) },
          { label: '已领取总长度', value: formatLength(varianceSummary?.claimedLengthTotal || row.claimedLengthTotal) },
          { label: '差异长度', value: formatLength(varianceSummary?.varianceLength || row.varianceLength) },
          { label: '差异说明', value: varianceSummary?.replenishmentHint || row.varianceNote || statusMeta.detailText },
        ]),
      )}
      ${renderSpreadingReplenishmentSection(session, replenishmentWarning, '去补料管理')}
      ${renderSection(
        '联动痕迹区',
        renderInfoGrid([
          { label: '完成铺布时间', value: session.completionLinkage?.completedAt || '未记录' },
          { label: '完成铺布操作人', value: session.completionLinkage?.completedBy || '未记录' },
          { label: '联动更新原始裁片单', value: session.completionLinkage?.linkedOriginalCutOrderNos.join(' / ') || '未联动' },
          { label: '补料预警编号', value: session.replenishmentWarning?.warningId || '未生成' },
          { label: '预警建议动作', value: replenishmentWarning.suggestedAction },
          { label: '联动说明', value: session.completionLinkage?.note || '当前尚未记录完成联动痕迹。' },
        ]),
      )}
      ${renderSpreadingWarningSection(detailView.warningMessages)}
    </div>
  `
}

function renderSpreadingEditPage(): string {
  const pathname = getCurrentPathname()
  const meta = getCanonicalCuttingMeta(pathname, 'spreading-edit')
  const draft = state.spreadingDraft || buildNewSpreadingDraft()
  const data = readMarkerSpreadingPrototypeData()
  const linkedOriginalCutOrderNos = draft.originalCutOrderIds
    .map((id) => data.rowsById[id]?.originalCutOrderNo || id)
    .filter(Boolean)
  const derived = resolveSpreadingDerivedState(draft)
  const linkedMarker = derived.markerRecord
  const rollSummary = derived.rollSummary
  const varianceSummary = derived.varianceSummary
  const replenishmentWarning = buildSpreadingReplenishmentPreview(draft, linkedOriginalCutOrderNos, derived)
  const handoverSummaryByRollId = buildRollHandoverSummaryMap(draft, derived.markerTotalPieces)
  const handoverListSummary = buildSpreadingHandoverListSummary(draft.rolls, draft.operators, derived.markerTotalPieces)
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(draft.operators, derived.markerTotalPieces, draft.unitPrice)
  const operatorAmountWarnings = buildOperatorAmountWarnings(draft.operators, derived.markerTotalPieces, draft.unitPrice)
  const headerActions = renderHeaderActions(([
    '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="cancel-spreading-edit">取消</button>',
    draft.importedFromMarker
      ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="show-marker-import-status">查看导入来源</button>'
      : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="guide-marker-import">从唛架导入</button>',
    getSearchParams().get('sessionId')
      ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-spreading-replenishment" data-session-id="${escapeHtml(draft.spreadingSessionId)}">去补料管理</button>`
      : '',
    '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="save-spreading">保存草稿</button>',
    '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="set-spreading-status" data-status="IN_PROGRESS">标记进行中</button>',
    '<button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" data-cutting-marker-action="save-spreading-and-view">保存并返回详情</button>',
    '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="complete-spreading">完成铺布</button>',
    renderReturnToSummaryButton(),
  ].filter(Boolean) as string[]))

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: headerActions })}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderSpreadingImportSourceSection(draft, linkedOriginalCutOrderNos)}
      ${renderSpreadingPlanSection(draft)}
      ${renderSpreadingCompletionLinkageSection(draft, linkedOriginalCutOrderNos)}
      ${renderSection(
        '基础表单区',
        `
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderTextInput('铺布编号', draft.sessionNo || '', 'data-cutting-spreading-draft-field="sessionNo"')}
            ${
              draft.importedFromMarker
                ? renderTextInput('铺布模式', deriveSpreadingModeMeta(draft.spreadingMode).label, 'disabled', '来源于唛架，当前锁定')
                : renderSelect('铺布模式', draft.spreadingMode, 'data-cutting-spreading-draft-field="spreadingMode"', [
                    { value: 'normal', label: '正常模式' },
                    { value: 'high-low', label: '高低层模式' },
                    { value: 'folded', label: '对折模式' },
                  ])
            }
            ${renderSelect('状态', draft.status, 'data-cutting-spreading-draft-field="status"', [
              { value: 'DRAFT', label: '草稿' },
              { value: 'IN_PROGRESS', label: '进行中' },
              { value: 'DONE', label: '已完成' },
              { value: 'TO_FILL', label: '待补录' },
            ])}
            ${renderTextInput('上下文类型', draft.contextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文', 'disabled')}
            ${renderTextInput('关联原始裁片单', linkedOriginalCutOrderNos.join(' / '), 'disabled', '由上游上下文带入')}
            ${renderTextInput('关联批次', draft.mergeBatchNo || '', 'disabled', '可为空')}
            ${renderTextInput('关联唛架', draft.markerNo || '', 'disabled', draft.importedFromMarker ? '来源于唛架，当前锁定' : '本次先手选承接，不自动导入')}
            ${renderTextInput('款号 / 款式编码', `${draft.styleCode || ''} / ${draft.spuCode || ''}`, 'disabled')}
            ${renderTextInput('面料摘要', draft.materialSkuSummary || '', 'disabled')}
            ${renderTextInput('颜色摘要', draft.colorSummary || '', 'data-cutting-spreading-draft-field="colorSummary"')}
            ${renderNumberInput('计划层数', draft.plannedLayers, 'data-cutting-spreading-draft-field="plannedLayers"', '1')}
            ${renderNumberInput('价格 / 金额（保留字段）', draft.unitPrice || 0, 'data-cutting-spreading-draft-field="unitPrice"')}
          </div>
          ${
            draft.importedFromMarker
              ? `<div class="mt-3 grid gap-3 md:grid-cols-3">
                  ${renderNumberInput('理论铺布总长度（米）', draft.theoreticalSpreadTotalLength || 0, 'data-cutting-spreading-draft-field="theoreticalSpreadTotalLength"', '0.01')}
                  ${renderNumberInput('理论实际裁剪件数', draft.theoreticalActualCutPieceQty || 0, 'data-cutting-spreading-draft-field="theoreticalActualCutPieceQty"', '1')}
                  ${renderSelect('是否有导入后调整', draft.importAdjustmentRequired ? 'true' : 'false', 'data-cutting-spreading-draft-field="importAdjustmentRequired"', [
                    { value: 'false', label: '否' },
                    { value: 'true', label: '是' },
                  ])}
                </div>
                <div class="mt-3">
                  ${renderTextarea('导入后调整说明', draft.importAdjustmentNote || '', 'data-cutting-spreading-draft-field="importAdjustmentNote"', 3)}
                </div>`
              : ''
          }
        `,
      )}
      ${renderSection(
        '卷记录编辑区',
        `
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm text-muted-foreground">支持新增卷；每卷都独立计算可用长度、剩余长度和实际裁剪件数。</p>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-roll">新增卷</button>
          </div>
          <div class="overflow-auto">
            <table class="min-w-[1660px] text-sm">
              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2">卷号</th>
                  <th class="px-3 py-2">面料编码</th>
                  <th class="px-3 py-2">颜色</th>
                  <th class="px-3 py-2">幅宽</th>
                  <th class="px-3 py-2">标注长度</th>
                  <th class="px-3 py-2">实际长度</th>
                  <th class="px-3 py-2">布头长度</th>
                  <th class="px-3 py-2">布尾长度</th>
                  <th class="px-3 py-2">铺布层数</th>
                  <th class="px-3 py-2">单卷可用长度</th>
                  <th class="px-3 py-2">单卷剩余长度</th>
                  <th class="px-3 py-2">单卷实际裁剪件数</th>
                  <th class="px-3 py-2">时间</th>
                  <th class="px-3 py-2">参与人员链</th>
                  <th class="px-3 py-2">交接说明</th>
                  <th class="px-3 py-2">备注</th>
                  <th class="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                ${draft.rolls
                  .map((roll, index) => {
                    const usableLength = computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)
                    const remainingLength = computeRemainingLength(roll.labeledLength, roll.actualLength)
                    const actualCutPieceQty = computeRollActualCutPieceQty(roll.layerCount, linkedMarker?.totalPieces || 0)
                    const linkedOperators = draft.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId)
                    return `
                      <tr class="border-b align-top">
                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(roll.sortOrder || index + 1))}</td>
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(roll.rollNo)}" class="h-9 w-32 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="rollNo" /></td>
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(roll.materialSku)}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="materialSku" /></td>
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(roll.color || '')}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="color" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.width))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="width" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.labeledLength))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="labeledLength" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.actualLength))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="actualLength" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.headLength))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="headLength" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.tailLength))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="tailLength" /></td>
                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(String(roll.layerCount))}" class="h-9 w-20 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="layerCount" /></td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(usableLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(formatLength(remainingLength))}</td>
                        <td class="px-3 py-2">${escapeHtml(`${formatQty(actualCutPieceQty)} 件`)}</td>
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(roll.occurredAt || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="occurredAt" placeholder="YYYY-MM-DD HH:mm" /></td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(linkedOperators.map((operator) => operator.operatorName).filter(Boolean).join(' → ') || '待补录')}</td>
                        <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(linkedOperators.map((operator) => operator.handoverNotes).filter((value) => value.trim()).join(' / ') || '—')}</td>
                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(roll.note || '')}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-spreading-roll-index="${index}" data-cutting-spreading-roll-field="note" /></td>
                        <td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-roll" data-index="${index}">删除</button></td>
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
        '人员记录编辑区',
        draft.rolls.length
          ? `
              <div class="mb-3 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                同卷换班不要新建第二卷。请直接在该卷下继续新增人员交接记录，并明确填写开始层、结束层、负责长度和交接说明。
              </div>
              <div class="space-y-4">
                ${draft.rolls
                  .map((roll) => {
                    const handoverSummary = handoverSummaryByRollId[roll.rollRecordId] || buildRollHandoverViewModel(roll, [], derived.markerTotalPieces)
                    return `
                      <article class="rounded-lg border bg-muted/10 p-3">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="space-y-1">
                            <h4 class="text-sm font-semibold text-foreground">卷 ${escapeHtml(roll.rollNo || '待补')}</h4>
                            <p class="text-xs text-muted-foreground">当前卷共 ${escapeHtml(String(handoverSummary.operators.length))} 条交接记录，负责长度合计 ${escapeHtml(formatLength(handoverSummary.totalHandledLength))}。</p>
                          </div>
                          <div class="flex flex-wrap gap-2">
                            ${renderRollHandoverStatus(handoverSummary)}
                            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-operator-for-roll" data-roll-record-id="${escapeHtml(roll.rollRecordId)}">在该卷下新增人员</button>
                          </div>
                        </div>
                        <div class="mt-3 overflow-auto">
                          <table class="min-w-[2520px] text-sm">
                            <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                              <tr>
                                <th class="px-3 py-2">排序</th>
                                <th class="px-3 py-2">人员姓名</th>
                                <th class="px-3 py-2">账号</th>
                                <th class="px-3 py-2">开始时间</th>
                                <th class="px-3 py-2">结束时间</th>
                                <th class="px-3 py-2">动作类型</th>
                                <th class="px-3 py-2">开始层</th>
                                <th class="px-3 py-2">结束层</th>
                                <th class="px-3 py-2">负责层数</th>
                                <th class="px-3 py-2">负责长度</th>
                                <th class="px-3 py-2">负责件数</th>
                                <th class="px-3 py-2">单价</th>
                                <th class="px-3 py-2">计价方式</th>
                                <th class="px-3 py-2">计算金额</th>
                                <th class="px-3 py-2">人工调整</th>
                                <th class="px-3 py-2">调整后金额</th>
                                <th class="px-3 py-2">最终显示金额</th>
                                <th class="px-3 py-2">金额备注</th>
                                <th class="px-3 py-2">上一个交接人</th>
                                <th class="px-3 py-2">下一个接手人</th>
                                <th class="px-3 py-2">交接时层数</th>
                                <th class="px-3 py-2">交接时长度</th>
                                <th class="px-3 py-2">交接说明</th>
                                <th class="px-3 py-2">备注</th>
                                <th class="px-3 py-2">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${handoverSummary.operators
                                .map((item) => {
                                  const index = draft.operators.findIndex((operator) => operator.operatorRecordId === item.operator.operatorRecordId)
                                  if (index < 0) return ''
                                  return `
                                    <tr class="border-b align-top">
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(item.operator.sortOrder || index + 1))}</td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.operatorName || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorName" /></td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.operatorAccountId || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorAccountId" /></td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.startAt || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startAt" placeholder="YYYY-MM-DD HH:mm" /></td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.endAt || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endAt" placeholder="YYYY-MM-DD HH:mm" /></td>
                                      <td class="px-3 py-2">
                                        <select class="h-9 w-32 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="actionType">
                                          ${['开始铺布', '中途交接', '接手继续', '完成铺布']
                                            .map((actionType) => `<option value="${escapeHtml(actionType)}" ${actionType === item.operator.actionType ? 'selected' : ''}>${escapeHtml(actionType)}</option>`)
                                            .join('')}
                                        </select>
                                      </td>
                                      <td class="px-3 py-2"><input type="number" value="${escapeHtml(item.operator.startLayer === undefined ? '' : String(item.operator.startLayer))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startLayer" /></td>
                                      <td class="px-3 py-2"><input type="number" value="${escapeHtml(item.operator.endLayer === undefined ? '' : String(item.operator.endLayer))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endLayer" /></td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatLayerValue(item.handledLayerCount))}</td>
                                      <td class="px-3 py-2"><input type="number" value="${escapeHtml(item.operator.handledLength === undefined ? '' : String(item.operator.handledLength))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="handledLength" step="0.01" /></td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.handledPieceQty === null ? '待补录' : `${formatQty(item.handledPieceQty)} 件`)}</td>
                                      <td class="px-3 py-2"><input type="number" value="${escapeHtml(item.operator.unitPrice === undefined ? String(draft.unitPrice || '') : String(item.operator.unitPrice))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="unitPrice" step="0.01" /></td>
                                      <td class="px-3 py-2">
                                        <select class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="pricingMode">
                                          ${['按件计价', '按长度计价', '按层计价']
                                            .map((pricingMode) => `<option value="${escapeHtml(pricingMode)}" ${(item.operator.pricingMode || '按件计价') === pricingMode ? 'selected' : ''}>${escapeHtml(pricingMode)}</option>`)
                                            .join('')}
                                        </select>
                                      </td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatCurrency(item.calculatedAmount))}</td>
                                      <td class="px-3 py-2">
                                        <select class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="manualAmountAdjusted">
                                          <option value="false" ${item.operator.manualAmountAdjusted ? '' : 'selected'}>否</option>
                                          <option value="true" ${item.operator.manualAmountAdjusted ? 'selected' : ''}>是</option>
                                        </select>
                                      </td>
                                      <td class="px-3 py-2"><input type="number" value="${escapeHtml(item.operator.adjustedAmount === undefined ? '' : String(item.operator.adjustedAmount))}" class="h-9 w-28 rounded-md border px-3 text-sm ${item.operator.manualAmountAdjusted ? '' : 'bg-muted/20'}" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="adjustedAmount" step="0.01" ${item.operator.manualAmountAdjusted ? '' : 'disabled'} /></td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatCurrency(computeOperatorDisplayAmount(item.operator, item.calculatedAmount)))}</td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.amountNote || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="amountNote" /></td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.previousOperatorName || '—')}</td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.nextOperatorName || '—')}</td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatLayerValue(item.handoverAtLayer))}</td>
                                      <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatHandledLengthValue(item.handoverAtLength))}</td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.handoverNotes || '')}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="handoverNotes" /></td>
                                      <td class="px-3 py-2"><input type="text" value="${escapeHtml(item.operator.note || '')}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="note" /></td>
                                      <td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-operator" data-index="${index}">删除</button></td>
                                    </tr>
                                  `
                                })
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                        <div class="mt-3">
                          ${renderRollHandoverWarnings(handoverSummary)}
                        </div>
                      </article>
                    `
                  })
                  .join('')}
                ${
                  draft.operators.some((operator) => !operator.rollRecordId)
                    ? `
                        <article class="rounded-lg border border-dashed bg-card p-3">
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <h4 class="text-sm font-semibold text-foreground">未关联卷的人员记录</h4>
                              <p class="mt-1 text-xs text-muted-foreground">旧数据或临时记录若尚未绑定卷，会先显示在这里。请优先补齐所属卷，再回到对应卷下完成交接量化。</p>
                            </div>
                            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-operator">新增未分配人员记录</button>
                          </div>
                          <div class="mt-3 overflow-auto">
                            <table class="min-w-[2360px] text-sm">
                              <thead class="bg-muted/50 text-left text-xs text-muted-foreground">
                                <tr>
                                  <th class="px-3 py-2">排序</th>
                                  <th class="px-3 py-2">关联卷</th>
                                  <th class="px-3 py-2">人员姓名</th>
                                  <th class="px-3 py-2">账号</th>
                                  <th class="px-3 py-2">开始时间</th>
                                  <th class="px-3 py-2">结束时间</th>
                                  <th class="px-3 py-2">动作类型</th>
                                  <th class="px-3 py-2">开始层</th>
                                  <th class="px-3 py-2">结束层</th>
                                  <th class="px-3 py-2">负责层数</th>
                                  <th class="px-3 py-2">负责长度</th>
                                  <th class="px-3 py-2">负责件数</th>
                                  <th class="px-3 py-2">单价</th>
                                  <th class="px-3 py-2">计价方式</th>
                                  <th class="px-3 py-2">计算金额</th>
                                  <th class="px-3 py-2">人工调整</th>
                                  <th class="px-3 py-2">调整后金额</th>
                                  <th class="px-3 py-2">最终显示金额</th>
                                  <th class="px-3 py-2">金额备注</th>
                                  <th class="px-3 py-2">交接说明</th>
                                  <th class="px-3 py-2">备注</th>
                                  <th class="px-3 py-2">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${draft.operators
                                  .map((operator, index) => ({ operator, index }))
                                  .filter(({ operator }) => !operator.rollRecordId)
                                  .map(({ operator, index }) => {
                                    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
                                    const handledPieceQty = computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, derived.markerTotalPieces)
                                    const calculatedAmount = computeOperatorCalculatedAmount({
                                      pricingMode: operator.pricingMode || '按件计价',
                                      unitPrice: operator.unitPrice ?? draft.unitPrice,
                                      handledLayerCount,
                                      handledLength: operator.handledLength,
                                      handledPieceQty,
                                    })
                                    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount)
                                    return `
                                      <tr class="border-b align-top">
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(String(operator.sortOrder || index + 1))}</td>
                                        <td class="px-3 py-2">
                                          <select class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="rollRecordId">
                                            <option value="">请选择卷号</option>
                                            ${draft.rolls
                                              .map(
                                                (roll) => `<option value="${escapeHtml(roll.rollRecordId)}">${escapeHtml(roll.rollNo || '未命名卷')}</option>`,
                                              )
                                              .join('')}
                                          </select>
                                        </td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.operatorName || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorName" /></td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.operatorAccountId || '')}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="operatorAccountId" /></td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.startAt || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startAt" placeholder="YYYY-MM-DD HH:mm" /></td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.endAt || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endAt" placeholder="YYYY-MM-DD HH:mm" /></td>
                                        <td class="px-3 py-2">
                                          <select class="h-9 w-32 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="actionType">
                                            ${['开始铺布', '中途交接', '接手继续', '完成铺布']
                                              .map((actionType) => `<option value="${escapeHtml(actionType)}" ${actionType === operator.actionType ? 'selected' : ''}>${escapeHtml(actionType)}</option>`)
                                              .join('')}
                                          </select>
                                        </td>
                                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(operator.startLayer === undefined ? '' : String(operator.startLayer))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="startLayer" /></td>
                                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(operator.endLayer === undefined ? '' : String(operator.endLayer))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="endLayer" /></td>
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatLayerValue(handledLayerCount))}</td>
                                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(operator.handledLength === undefined ? '' : String(operator.handledLength))}" class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="handledLength" step="0.01" /></td>
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(handledPieceQty === null ? '待补录' : `${formatQty(handledPieceQty)} 件`)}</td>
                                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(operator.unitPrice === undefined ? String(draft.unitPrice || '') : String(operator.unitPrice))}" class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="unitPrice" step="0.01" /></td>
                                        <td class="px-3 py-2">
                                          <select class="h-9 w-28 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="pricingMode">
                                            ${['按件计价', '按长度计价', '按层计价']
                                              .map((pricingMode) => `<option value="${escapeHtml(pricingMode)}" ${(operator.pricingMode || '按件计价') === pricingMode ? 'selected' : ''}>${escapeHtml(pricingMode)}</option>`)
                                              .join('')}
                                          </select>
                                        </td>
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatCurrency(calculatedAmount))}</td>
                                        <td class="px-3 py-2">
                                          <select class="h-9 w-24 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="manualAmountAdjusted">
                                            <option value="false" ${operator.manualAmountAdjusted ? '' : 'selected'}>否</option>
                                            <option value="true" ${operator.manualAmountAdjusted ? 'selected' : ''}>是</option>
                                          </select>
                                        </td>
                                        <td class="px-3 py-2"><input type="number" value="${escapeHtml(operator.adjustedAmount === undefined ? '' : String(operator.adjustedAmount))}" class="h-9 w-28 rounded-md border px-3 text-sm ${operator.manualAmountAdjusted ? '' : 'bg-muted/20'}" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="adjustedAmount" step="0.01" ${operator.manualAmountAdjusted ? '' : 'disabled'} /></td>
                                        <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatCurrency(displayAmount))}</td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.amountNote || '')}" class="h-9 w-36 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="amountNote" /></td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.handoverNotes || '')}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="handoverNotes" /></td>
                                        <td class="px-3 py-2"><input type="text" value="${escapeHtml(operator.note || '')}" class="h-9 w-44 rounded-md border px-3 text-sm" data-cutting-spreading-operator-index="${index}" data-cutting-spreading-operator-field="note" /></td>
                                        <td class="px-3 py-2"><button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-marker-action="remove-operator" data-index="${index}">删除</button></td>
                                      </tr>
                                    `
                                  })
                                  .join('')}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      `
                    : ''
                }
              </div>
            `
          : `
              <div class="space-y-3">
                <div class="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-sm text-muted-foreground">请先新增卷记录，再在对应卷下维护人员交接记录。</div>
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="add-roll">先新增卷</button>
              </div>
            `,
      )}
      ${renderSection('按人汇总预览区', renderOperatorAllocationSummary(operatorAmountSummary))}
      ${renderSection('金额提醒区', renderOperatorAmountWarningSection(operatorAmountWarnings))}
      ${renderSection(
        '交接校验提醒区',
        handoverListSummary.hasHandover || handoverListSummary.hasAbnormalHandover
          ? `
              <div class="space-y-3">
                ${renderInfoGrid([
                  { label: '存在交接班', value: handoverListSummary.hasHandover ? '是' : '否' },
                  { label: '交接异常卷数', value: `${formatQty(handoverListSummary.abnormalRollCount)} 卷` },
                  { label: '交接摘要', value: handoverListSummary.statusLabel },
                ])}
                ${
                  Object.values(handoverSummaryByRollId)
                    .filter((summary) => summary.hasWarnings)
                    .map(
                      (summary) => `
                        <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          <p class="font-medium">卷 ${escapeHtml(summary.rollNo || '待补')}</p>
                          <ul class="mt-1 space-y-1 list-disc pl-5">
                            ${summary.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}
                          </ul>
                        </div>
                      `,
                    )
                    .join('') || '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前虽存在交接班，但尚未识别异常。</div>'
                }
              </div>
            `
          : '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">当前各卷暂无交接班，或已补录完整交接数据且未识别异常。</div>',
      )}
      ${renderSection(
        '汇总区',
        renderInfoGrid([
          { label: '卷数', value: `${formatQty(draft.rolls.length)} 卷` },
          { label: '人员数', value: `${formatQty(draft.operators.length)} 人` },
          { label: '总实际铺布长度', value: formatLength(rollSummary.totalActualLength) },
          { label: '总布头长度', value: formatLength(rollSummary.totalHeadLength) },
          { label: '总布尾长度', value: formatLength(rollSummary.totalTailLength) },
          { label: '总可用长度', value: formatLength(rollSummary.totalCalculatedUsableLength) },
          { label: '总剩余长度', value: formatLength(rollSummary.totalRemainingLength) },
          { label: '实际裁剪件数合计', value: `${formatQty(rollSummary.totalActualCutPieceQty)} 件` },
          { label: '人员金额合计', value: formatCurrency(operatorAmountSummary.totalDisplayAmount) },
          { label: '已配置长度摘要', value: formatLength(varianceSummary?.configuredLengthTotal || 0) },
          { label: '已领取长度摘要', value: formatLength(varianceSummary?.claimedLengthTotal || 0) },
          { label: '差异长度', value: formatLength(varianceSummary?.varianceLength || 0) },
          { label: '差异说明', value: varianceSummary?.replenishmentHint || '当前尚未识别明显差异' },
        ]),
      )}
      ${renderSpreadingReplenishmentSection(draft, replenishmentWarning)}
      ${renderSpreadingWarningSection(derived.warningMessages)}
      ${renderSection(
        '完成动作区',
        renderInfoGrid([
          { label: '当前状态', value: deriveSpreadingStatus(draft.status).label, hint: '保存草稿后可继续补录卷与人员；标记完成前先复核差异与提醒。' },
          { label: '关联唛架总件数', value: `${formatQty(linkedMarker?.totalPieces || 0)} 件`, hint: '单卷实际裁剪件数 = 铺布层数 × 唛架总件数。' },
          {
            label: '联动更新预览',
            value:
              draft.contextType === 'merge-batch'
                ? `本次将联动更新 ${formatQty(buildSpreadingCompletionTargetIds(draft).length)} 个原始裁片单`
                : `本次将联动更新 ${linkedOriginalCutOrderNos.join(' / ') || '当前原始裁片单'}`,
          },
          { label: '补料入口', value: replenishmentWarning.suggestedAction === '建议补料' ? '建议尽快进入补料管理' : '当前只保留入口，不自动生成补料单' },
        ]),
      )}
    </div>
  `
}

function renderPage(): string {
  const pathname = getCurrentPathname()

  if (pathname === getCanonicalCuttingPath('marker-detail')) return renderMarkerDetailPage()
  if (pathname === getCanonicalCuttingPath('marker-edit')) return renderMarkerEditPage()
  if (pathname === getCanonicalCuttingPath('spreading-detail')) return renderSpreadingDetailPage()
  if (pathname === getCanonicalCuttingPath('spreading-edit')) return renderSpreadingEditPage()
  return renderListPage()
}

function buildListRoute(tab: ListTabKey = state.activeTab): string {
  return buildMarkerRouteWithContext(getCanonicalCuttingPath('marker-spreading'), {
    originalCutOrderId: state.prefilter?.originalCutOrderId,
    originalCutOrderNo: state.prefilter?.originalCutOrderNo,
    mergeBatchId: state.prefilter?.mergeBatchId,
    mergeBatchNo: state.prefilter?.mergeBatchNo,
    productionOrderNo: state.prefilter?.productionOrderNo,
    styleCode: state.prefilter?.styleCode,
    materialSku: state.prefilter?.materialSku,
    tab: tab === 'SPREADINGS' ? 'spreadings' : 'markers',
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
      state.feedback = { tone: 'warning', message: '当前唛架上下文不完整，无法生成铺布草稿。' }
      return true
    }
    return persistImportedDraftAndOpen(newDraft, `${marker.markerNo || '当前唛架'} 已生成铺布草稿。`)
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
  const path = target === 'detail' ? getCanonicalCuttingPath('marker-detail') : getCanonicalCuttingPath('marker-edit')
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

function navigateFromSpreadingSession(sessionId: string | undefined, target: 'original-orders' | 'merge-batches'): boolean {
  if (!sessionId) return false
  const row = getSpreadingRow(sessionId)
  if (!row) return false
  const context = normalizeLegacyCuttingPayload(
    target === 'original-orders'
      ? buildContextPayloadFromSession(row.session)
      : {
          mergeBatchId: row.session.mergeBatchId || undefined,
          mergeBatchNo: row.session.mergeBatchNo || undefined,
          originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
          productionOrderNo: row.productionOrderNos[0] || undefined,
        },
    'marker-spreading',
    {
      productionOrderNo: row.productionOrderNos[0] || undefined,
      originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
      mergeBatchId: row.session.mergeBatchId || undefined,
      mergeBatchNo: row.session.mergeBatchNo || undefined,
      materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
      autoOpenDetail: true,
    },
  )
  appStore.navigate(buildCuttingRouteWithContext(target === 'original-orders' ? 'originalOrders' : 'mergeBatches', context))
  return true
}

function saveCurrentMarker(goDetail: boolean): boolean {
  const draft = state.markerDraft
  if (!draft) return false
  const templateType = deriveMarkerTemplateByMode(draft.markerMode)
  const data = readMarkerSpreadingPrototypeData()
  const sourceRows = buildMarkerAllocationSourceRows(draft, data.rowsById)
  const sourceRowsById = Object.fromEntries(sourceRows.map((row) => [row.originalCutOrderId, row]))

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
            sourceCutOrderId: sourceRow.originalCutOrderId,
            sourceCutOrderNo: sourceRow.originalCutOrderNo,
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
  if (draft.originalCutOrderIds.length > 0 && !normalizedAllocationLines.length) {
    blockingMessages.push('当前唛架已关联原始裁片单，必须先补充分配明细。')
  }
  normalizedAllocationLines.forEach((line) => {
    if (!draft.originalCutOrderIds.includes(line.sourceCutOrderId)) {
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
      originalCutOrderNos: draft.originalCutOrderNos || data.rows
        .filter((row) => draft.originalCutOrderIds.includes(row.originalCutOrderId))
        .map((row) => row.originalCutOrderNo),
      techPackSpuCode:
        (Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean))).length === 1
          ? Array.from(new Set(sourceRows.map((row) => row.techPackSpuCode).filter(Boolean)))[0]
          : '') || draft.techPackSpuCode || '',
      totalPieces,
      singlePieceUsage: draft.singlePieceUsage || computeSinglePieceUsage(draft.netLength, totalPieces),
      plannedSizeRatioText:
        draft.plannedSizeRatioText ||
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
  state.feedback = { tone: 'success', message: `${draft.markerNo || '唛架记录'} 已保存。` }

  if (goDetail) {
    const saved = nextStore.markers.find((item) => item.markerId === draft.markerId) || draft
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
    const usableLength = computeUsableLength(actualLength, headLength, tailLength)
    const remainingLength = computeRemainingLength(labeledLength, actualLength)
    const actualCutPieceQty = computeRollActualCutPieceQty(Number(roll.layerCount || 0), markerTotalPieces)
    const operatorNames = draft.operators
      .filter((operator) => operator.rollRecordId === roll.rollRecordId)
      .map((operator) => operator.operatorName)
      .filter(Boolean)

    return {
      ...roll,
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
  const primaryRows = draft.originalCutOrderIds.map((id) => data.rowsById[id]).filter((row): row is (typeof data.rows)[number] => Boolean(row))
  const varianceContext = primaryRows.length
    ? {
        contextType: draft.contextType,
        originalCutOrderIds: [...draft.originalCutOrderIds],
        originalCutOrderNos: primaryRows.map((row) => row.originalCutOrderNo),
        mergeBatchId: draft.mergeBatchId,
        mergeBatchNo: draft.mergeBatchNo,
        productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
        styleCode: draft.styleCode || primaryRows[0].styleCode,
        spuCode: draft.spuCode || primaryRows[0].spuCode,
        styleName: primaryRows[0].styleName,
        materialSkuSummary: draft.materialSkuSummary || primaryRows[0].materialSkuSummary,
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

  const normalizedDraft: SpreadingSession = {
    ...draft,
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
    theoreticalSpreadTotalLength: draft.theoreticalSpreadTotalLength ?? derived.markerRecord?.spreadTotalLength ?? 0,
    theoreticalActualCutPieceQty:
      draft.theoreticalActualCutPieceQty ?? Math.max((draft.plannedLayers || 0) * Math.max(derived.markerRecord?.totalPieces || 0, 0), 0),
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

function saveCurrentSpreading(goDetail: boolean): boolean {
  const draft = state.spreadingDraft
  if (!draft) return false
  const { normalizedDraft } = buildPersistableSpreadingDraft(draft)
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(normalizedDraft, data.store)
  persistMarkerSpreadingStore(nextStore)
  state.feedback = { tone: 'success', message: `${draft.sessionNo || '铺布 session'} 已保存。` }

  if (goDetail) {
    const saved = nextStore.sessions.find((item) => item.spreadingSessionId === draft.spreadingSessionId) || normalizedDraft
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-detail'), buildContextPayloadFromSession(saved)))
  }
  return true
}

function completeCurrentSpreading(): boolean {
  const draft = state.spreadingDraft
  if (!draft) return false
  const { normalizedDraft, derived, primaryRows } = buildPersistableSpreadingDraft(draft)
  const linkedOriginalCutOrderIds = buildSpreadingCompletionTargetIds(normalizedDraft)
  const validation = validateSpreadingCompletion({
    session: normalizedDraft,
    markerTotalPieces: derived.markerTotalPieces,
    selectedOriginalCutOrderIds: linkedOriginalCutOrderIds,
  })

  if (!validation.allowed) {
    state.feedback = { tone: 'warning', message: validation.messages.join('；') }
    return true
  }

  const linkedOriginalCutOrderNos = primaryRows
    .filter((row) => linkedOriginalCutOrderIds.includes(row.originalCutOrderId))
    .map((row) => row.originalCutOrderNo)
  const completedDraft = finalizeSpreadingCompletion({
    session: normalizedDraft,
    linkedOriginalCutOrderIds,
    linkedOriginalCutOrderNos,
    productionOrderNos: Array.from(new Set(primaryRows.map((row) => row.productionOrderNo))),
    markerTotalPieces: derived.markerTotalPieces,
    materialAttr: primaryRows[0]?.materialLabel || primaryRows[0]?.materialCategory || '',
    warningMessages: derived.warningMessages,
    completedBy: '铺布编辑页',
  })
  const data = readMarkerSpreadingPrototypeData()
  const nextStore = upsertSpreadingSession(completedDraft, data.store)
  persistMarkerSpreadingStore(nextStore)
  state.feedback = {
    tone: 'success',
    message:
      completedDraft.replenishmentWarning?.suggestedAction === '无需补料'
        ? `已完成铺布，并联动更新 ${linkedOriginalCutOrderNos.length} 个原始裁片单。`
        : `已完成铺布、联动更新 ${linkedOriginalCutOrderNos.length} 个原始裁片单，并生成补料预警。`,
  }
  appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-detail'), buildContextPayloadFromSession(completedDraft)))
  return true
}

export function renderCraftCuttingMarkerSpreadingPage(): string {
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
    if (field === 'mode') state.spreadingModeFilter = value as MarkerModeFilter
    if (field === 'context') state.contextTypeFilter = value as ContextTypeFilter
    if (field === 'status') state.spreadingStatusFilter = value as SpreadingStatusFilter
    if (field === 'variance') state.spreadingVarianceFilter = value as BooleanFilter
    if (field === 'warning') state.spreadingWarningFilter = value as BooleanFilter
    if (field === 'replenishment') state.spreadingReplenishmentFilter = value as BooleanFilter
    if (field === 'warning-level') state.spreadingWarningLevelFilter = value as SpreadingWarningLevelFilter
    if (field === 'pending-replenishment') state.spreadingPendingReplenishmentFilter = value as BooleanFilter
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
    if (field === 'adjustmentRequired' || field === 'replacementDraftFlag') {
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
      state.spreadingDraft.status = value as SpreadingStatusKey
      return true
    }

    if (field === 'importAdjustmentRequired') {
      state.spreadingDraft.importAdjustmentRequired = value === 'true'
      return true
    }

    if (field === 'plannedLayers' || field === 'unitPrice' || field === 'theoreticalSpreadTotalLength' || field === 'theoreticalActualCutPieceQty') {
      ;(state.spreadingDraft as Record<string, number>)[field] = Number(value)
      if (field === 'plannedLayers' || field === 'theoreticalSpreadTotalLength' || field === 'theoreticalActualCutPieceQty') {
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
    const index = Number(spreadingRollFieldNode.dataset.cuttingSpreadingRollIndex)
    const field = spreadingRollFieldNode.dataset.cuttingSpreadingRollField as SpreadingRollField | undefined
    const roll = state.spreadingDraft.rolls[index]
    if (Number.isNaN(index) || !field || !roll) return false
    const value = (spreadingRollFieldNode as HTMLInputElement).value

    if (
      field === 'width' ||
      field === 'labeledLength' ||
      field === 'actualLength' ||
      field === 'headLength' ||
      field === 'tailLength' ||
      field === 'layerCount'
    ) {
      ;(roll as Record<string, number>)[field] = Number(value)
      return true
    }

    ;(roll as Record<string, string>)[field] = value
    return true
  }

  const spreadingOperatorFieldNode = target.closest<HTMLElement>('[data-cutting-spreading-operator-field]')
  if (spreadingOperatorFieldNode && state.spreadingDraft) {
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

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.keyword = ''
    appStore.navigate(getCanonicalCuttingPath('marker-spreading'))
    return true
  }

  if (action === 'clear-filters') {
    state.keyword = ''
    state.markerModeFilter = 'ALL'
    state.contextTypeFilter = 'ALL'
    state.adjustmentFilter = 'ALL'
    state.imageFilter = 'ALL'
    state.spreadingModeFilter = 'ALL'
    state.spreadingStatusFilter = 'ALL'
    state.spreadingVarianceFilter = 'ALL'
    state.spreadingWarningFilter = 'ALL'
    state.spreadingReplenishmentFilter = 'ALL'
    state.spreadingWarningLevelFilter = 'ALL'
    state.spreadingPendingReplenishmentFilter = 'ALL'
    return true
  }

  if (action === 'set-tab') {
    state.activeTab = actionNode.dataset.tab === 'spreadings' ? 'SPREADINGS' : 'MARKERS'
    return true
  }

  if (action === 'go-list') {
    appStore.navigate(buildListRoute(actionNode.dataset.tab === 'spreadings' ? 'SPREADINGS' : 'MARKERS'))
    return true
  }

  if (action === 'create-marker') {
    appStore.navigate(
      buildMarkerRouteWithContext(getCanonicalCuttingPath('marker-edit'), {
        originalCutOrderId: state.prefilter?.originalCutOrderId,
        originalCutOrderNo: state.prefilter?.originalCutOrderNo,
        mergeBatchId: state.prefilter?.mergeBatchId,
        mergeBatchNo: state.prefilter?.mergeBatchNo,
        styleCode: state.prefilter?.styleCode,
        materialSku: state.prefilter?.materialSku,
      }),
    )
    return true
  }

  if (action === 'create-spreading') {
    appStore.navigate(
      buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-edit'), {
        originalCutOrderId: state.prefilter?.originalCutOrderId,
        originalCutOrderNo: state.prefilter?.originalCutOrderNo,
        mergeBatchId: state.prefilter?.mergeBatchId,
        mergeBatchNo: state.prefilter?.mergeBatchNo,
        styleCode: state.prefilter?.styleCode,
        materialSku: state.prefilter?.materialSku,
      }),
    )
    return true
  }

  if (action === 'open-marker-detail') return navigateToMarkerPage('detail', actionNode.dataset.markerId)
  if (action === 'open-marker-edit') return navigateToMarkerPage('edit', actionNode.dataset.markerId)

  if (action === 'create-marker-from-context') {
    const markerId = actionNode.dataset.markerId
    if (!markerId) return false
    const row = getMarkerRow(markerId)
    if (!row) return false
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('marker-edit'), buildMarkerNavigationPayload(row)))
    return true
  }

  if (action === 'create-spreading-from-marker') {
    const markerId = actionNode.dataset.markerId
    if (!markerId) return false
    const marker = getStoredMarkerRecord(markerId)
    if (!marker) return false
    return startMarkerImport(marker)
  }

  if (action === 'confirm-marker-import-new') {
    const decision = state.importDecision
    if (!decision) return false
    const marker = getStoredMarkerRecord(decision.markerId)
    if (!marker) return false
    const newDraft = createImportedSpreadingDraft(marker, {
      reimported: true,
      importNote: '检测到已有实际执行数据，已另起新的铺布草稿承接唛架模板。',
    })
    if (!newDraft) {
      state.feedback = { tone: 'warning', message: '当前唛架上下文不完整，无法新建再次导入草稿。' }
      return true
    }
    return persistImportedDraftAndOpen(newDraft, `${marker.markerNo || '当前唛架'} 已另起新的铺布草稿。`)
  }

  if (action === 'confirm-marker-import-sync') {
    const decision = state.importDecision
    if (!decision) return false
    const marker = getStoredMarkerRecord(decision.markerId)
    const targetSession = getStoredSpreadingSession(decision.targetSessionId)
    if (!marker || !targetSession) return false
    const syncedDraft = syncImportedFieldsToExistingSession(marker, targetSession)
    if (!syncedDraft) {
      state.feedback = { tone: 'warning', message: '当前铺布记录无法同步理论字段，请检查唛架上下文。' }
      return true
    }
    return persistImportedDraftAndOpen(syncedDraft, `${decision.targetSessionNo} 已同步最新唛架理论字段，卷记录和人员记录保持不变。`)
  }

  if (action === 'cancel-marker-import') {
    state.importDecision = null
    state.feedback = { tone: 'success', message: '已取消再次导入，本次不修改现有铺布记录。' }
    return true
  }

  if (action === 'create-spreading-from-session-context') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const row = getSpreadingRow(sessionId)
    if (!row) return false
    appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-edit'), buildCreatePayloadFromSession(row.session)))
    return true
  }

  if (action === 'open-spreading-detail') return navigateToSpreadingPage('detail', actionNode.dataset.sessionId)
  if (action === 'open-spreading-edit') return navigateToSpreadingPage('edit', actionNode.dataset.sessionId)
  if (action === 'go-linked-original-orders') return navigateFromSpreadingSession(actionNode.dataset.sessionId, 'original-orders')
  if (action === 'go-linked-merge-batches') return navigateFromSpreadingSession(actionNode.dataset.sessionId, 'merge-batches')

  if (action === 'go-spreading-replenishment') {
    const sessionId = actionNode.dataset.sessionId
    if (!sessionId) return false
    const row = getSpreadingRow(sessionId)
    if (!row) return false
    const context = normalizeLegacyCuttingPayload(row.replenishmentPayload, 'marker-spreading', {
      productionOrderNo: row.productionOrderNos[0] || undefined,
      originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
      mergeBatchId: row.mergeBatchId || undefined,
      mergeBatchNo: row.mergeBatchNo || undefined,
      materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
      markerId: row.markerId,
      markerNo: row.markerNo,
      autoOpenDetail: true,
    })
    appStore.navigate(buildCuttingRouteWithContext('replenishment', context))
    return true
  }

  if (action === 'cancel-marker-edit') {
    const markerId = getSearchParams().get('markerId')
    if (markerId) {
      const row = getMarkerRow(markerId)
      if (row) {
        appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('marker-detail'), buildContextPayloadFromMarker(row.record)))
        return true
      }
    }
    appStore.navigate(buildListRoute('MARKERS'))
    return true
  }

  if (action === 'cancel-spreading-edit') {
    const sessionId = getSearchParams().get('sessionId')
    if (sessionId) {
      const row = getSpreadingRow(sessionId)
      if (row) {
        appStore.navigate(buildMarkerRouteWithContext(getCanonicalCuttingPath('spreading-detail'), buildContextPayloadFromSession(row.session)))
        return true
      }
    }
    appStore.navigate(buildListRoute('SPREADINGS'))
    return true
  }

  if (action === 'show-marker-import-status') {
    state.feedback = {
      tone: 'success',
      message: state.spreadingDraft?.linkedMarkerNo
        ? `当前铺布草稿已承接唛架 ${state.spreadingDraft.linkedMarkerNo} 的导入内容。`
        : '当前铺布草稿已承接唛架导入内容。',
    }
    return true
  }

  if (action === 'guide-marker-import') {
    state.feedback = {
      tone: 'warning',
      message: '当前页面不能直接发起导入，请先在唛架列表或唛架详情中点击“从唛架导入铺布”。',
    }
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  if (action === 'add-size-row' && state.markerDraft) {
    state.markerDraft.sizeDistribution = [...state.markerDraft.sizeDistribution, { sizeLabel: '', quantity: 0 }]
    return true
  }

  if (action === 'remove-size-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.markerDraft.sizeDistribution = state.markerDraft.sizeDistribution.filter((_, itemIndex) => itemIndex !== index)
    return true
  }

  if (action === 'add-allocation-line' && state.markerDraft) {
    const sourceRows = getMarkerDraftSourceRows(state.markerDraft)
    state.markerDraft.allocationLines = [
      ...(state.markerDraft.allocationLines || []),
      createMarkerAllocationLineFromSource(
        state.markerDraft,
        sourceRows.length === 1 ? sourceRows[0] : null,
        state.markerDraft.allocationLines?.length || 0,
      ),
    ]
    return true
  }

  if (action === 'remove-allocation-line' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.markerDraft.allocationLines = (state.markerDraft.allocationLines || []).filter((_, itemIndex) => itemIndex !== index)
    return true
  }

  if (action === 'add-line-item' && state.markerDraft) {
    state.markerDraft.lineItems = [
      ...(state.markerDraft.lineItems || []),
      createEmptyMarkerLineItem(state.markerDraft.lineItems?.length || 0),
    ]
    return true
  }

  if (action === 'remove-line-item' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.markerDraft.lineItems = (state.markerDraft.lineItems || []).filter((_, itemIndex) => itemIndex !== index)
    return true
  }

  if (action === 'add-highlow-cutting-row' && state.markerDraft) {
    const nextIndex = state.markerDraft.highLowCuttingRows?.length || 0
    state.markerDraft.highLowCuttingRows = [...(state.markerDraft.highLowCuttingRows || []), createEmptyHighLowCuttingRow(state.markerDraft.markerId, nextIndex)]
    return true
  }

  if (action === 'remove-highlow-cutting-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.markerDraft.highLowCuttingRows = (state.markerDraft.highLowCuttingRows || []).filter((_, itemIndex) => itemIndex !== index)
    return true
  }

  if (action === 'add-highlow-pattern-key' && state.markerDraft) {
    const nextKey = `自定义列${(state.markerDraft.highLowPatternKeys?.length || DEFAULT_HIGH_LOW_PATTERN_KEYS.length) + 1}`
    state.markerDraft.highLowPatternKeys = [...(state.markerDraft.highLowPatternKeys || [...DEFAULT_HIGH_LOW_PATTERN_KEYS]), nextKey]
    state.markerDraft.highLowPatternRows = (state.markerDraft.highLowPatternRows || []).map((row) => ({
      ...row,
      patternValues: {
        ...row.patternValues,
        [nextKey]: 0,
      },
    }))
    return true
  }

  if (action === 'remove-highlow-pattern-key' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    const patternKeys = state.markerDraft.highLowPatternKeys || []
    const removedKey = patternKeys[index]
    state.markerDraft.highLowPatternKeys = patternKeys.filter((_, itemIndex) => itemIndex !== index)
    state.markerDraft.highLowPatternRows = (state.markerDraft.highLowPatternRows || []).map((row) => {
      const nextValues = { ...row.patternValues }
      delete nextValues[removedKey]
      return { ...row, patternValues: nextValues }
    })
    return true
  }

  if (action === 'add-highlow-pattern-row' && state.markerDraft) {
    const nextIndex = state.markerDraft.highLowPatternRows?.length || 0
    const patternKeys = state.markerDraft.highLowPatternKeys?.length ? state.markerDraft.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
    state.markerDraft.highLowPatternRows = [
      ...(state.markerDraft.highLowPatternRows || []),
      createEmptyHighLowPatternRow(state.markerDraft.markerId, nextIndex, patternKeys),
    ]
    return true
  }

  if (action === 'remove-highlow-pattern-row' && state.markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.markerDraft.highLowPatternRows = (state.markerDraft.highLowPatternRows || []).filter((_, itemIndex) => itemIndex !== index)
    return true
  }

  if (action === 'save-marker') return saveCurrentMarker(false)
  if (action === 'save-marker-and-view') return saveCurrentMarker(true)

  if (action === 'add-roll' && state.spreadingDraft) {
    state.spreadingDraft.rolls = [
      ...state.spreadingDraft.rolls,
      {
        ...createRollRecordDraft(
          state.spreadingDraft.spreadingSessionId,
          state.spreadingDraft.materialSkuSummary?.split(' / ')[0] || '',
        ),
        sortOrder: state.spreadingDraft.rolls.length + 1,
      },
    ]
    return true
  }

  if (action === 'remove-roll' && state.spreadingDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    const targetRoll = state.spreadingDraft.rolls[index]
    state.spreadingDraft.rolls = state.spreadingDraft.rolls
      .filter((_, itemIndex) => itemIndex !== index)
      .map((roll, itemIndex) => ({ ...roll, sortOrder: itemIndex + 1 }))
    if (targetRoll) {
      state.spreadingDraft.operators = state.spreadingDraft.operators
        .filter((operator) => operator.rollRecordId !== targetRoll.rollRecordId)
        .map((operator, itemIndex) => ({ ...operator, sortOrder: itemIndex + 1 }))
      state.feedback = { tone: 'success', message: `已删除卷 ${targetRoll.rollNo || index + 1}，并同步移除其下人员记录。` }
    }
    return true
  }

  if (action === 'add-operator' && state.spreadingDraft) {
    state.spreadingDraft.operators = [
      ...state.spreadingDraft.operators,
      {
        ...createOperatorRecordDraft(state.spreadingDraft.spreadingSessionId),
        sortOrder: state.spreadingDraft.operators.length + 1,
        unitPrice: state.spreadingDraft.unitPrice,
        pricingMode: '按件计价',
      },
    ]
    return true
  }

  if (action === 'add-operator-for-roll' && state.spreadingDraft) {
    const rollRecordId = actionNode.dataset.rollRecordId
    if (!rollRecordId) return false
    state.spreadingDraft.operators = [
      ...state.spreadingDraft.operators,
      createOperatorDraftForRoll(state.spreadingDraft, rollRecordId),
    ]
    return true
  }

  if (action === 'remove-operator' && state.spreadingDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return false
    state.spreadingDraft.operators = state.spreadingDraft.operators
      .filter((_, itemIndex) => itemIndex !== index)
      .map((operator, itemIndex) => ({ ...operator, sortOrder: itemIndex + 1 }))
    return true
  }

  if (action === 'save-spreading') return saveCurrentSpreading(false)
  if (action === 'save-spreading-and-view') return saveCurrentSpreading(true)
  if (action === 'complete-spreading') return completeCurrentSpreading()

  if (action === 'toggle-spreading-completion-order' && state.spreadingDraft) {
    const originalCutOrderId = actionNode.dataset.originalCutOrderId
    if (!originalCutOrderId) return false
    const checked = (actionNode as HTMLInputElement).checked
    state.spreadingCompletionSelection = checked
      ? Array.from(new Set([...state.spreadingCompletionSelection, originalCutOrderId]))
      : state.spreadingCompletionSelection.filter((item) => item !== originalCutOrderId)
    return true
  }

  if (action === 'set-spreading-status' && state.spreadingDraft) {
    const nextStatus = actionNode.dataset.status as SpreadingStatusKey | undefined
    if (!nextStatus) return false
    if (nextStatus === 'DONE') {
      return completeCurrentSpreading()
    }
    state.spreadingDraft = updateSessionStatus(state.spreadingDraft, nextStatus)
    state.feedback = { tone: 'success', message: `当前铺布 session 已标记为“${deriveSpreadingStatus(nextStatus).label}”。` }
    return true
  }

  return false
}

export function isCraftCuttingMarkerSpreadingDialogOpen(): boolean {
  return false
}
