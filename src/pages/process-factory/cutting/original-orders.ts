// original-orders 是 canonical 页面文件。
import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui/index.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
  deserializeReplenishmentPendingPrepStorage,
  type ReplenishmentPendingPrepFollowupRecord,
} from '../../../data/fcs/cutting/storage/replenishment-storage.ts'
import {
  buildCuttingOrderQrLabelPrintLink,
  buildTaskDetailLink,
  buildTaskRouteCardPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName, TEST_FACTORY_ID } from '../../../data/fcs/factory-mock-data.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
} from '../../../data/fcs/mobile-execution-task-index.ts'
import { validateCuttingOrderMobileTaskBinding } from '../../../data/fcs/process-mobile-task-binding.ts'
import {
  executeProcessWebAction,
  getAvailableCuttingWebActions,
  getProcessWebOperationRecordsBySource,
  type ProcessWebAction,
  type ProcessWebOperationRecord,
} from '../../../data/fcs/process-web-status-actions.ts'
import {
  buildPrintableUnitViewModel,
  getPrintableUnitStatusMeta,
  type FeiTicketLabelRecord,
} from './fei-tickets-model.ts'
import {
  FEI_QR_SCHEMA_VERSION,
  buildFeiQrCompatibilityMeta,
  buildFeiQrPayload,
  buildFeiQrPayloadSummary,
} from './fei-qr-model.ts'
import {
  buildOriginalCutOrderStats,
  filterOriginalCutOrderRows,
  findOriginalCutOrderByPrefilter,
  formatOriginalOrderCurrency,
  originalOrderStageMeta,
  originalOrderVisibleCuttableMeta,
  type OriginalCutOrderFilters,
  type OriginalCutOrderPrefilter,
  type OriginalCutOrderRow,
} from './original-orders-model.ts'
import { buildMarkerSpreadingCountsByOriginalOrder } from './marker-spreading-utils.ts'
import { configMeta, receiveMeta } from './production-progress-model.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import { getClaimDisputeStatusLabel } from '../../../helpers/fcs-claim-dispute.ts'
import { getLatestClaimDisputeByOriginalCutOrderNo } from '../../../state/fcs-claim-dispute-store.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import { buildOriginalOrdersProjection } from './original-orders-projection.ts'
import type { MergeBatchRecord } from './merge-batches-model.ts'

type FilterField =
  | 'keyword'
  | 'productionOrderNo'
  | 'styleKeyword'
  | 'materialSku'
  | 'currentStage'
  | 'cuttableState'
  | 'prepStatus'
  | 'claimStatus'
  | 'inBatch'

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof OriginalCutOrderFilters> = {
  keyword: 'keyword',
  productionOrderNo: 'productionOrderNo',
  styleKeyword: 'styleKeyword',
  materialSku: 'materialSku',
  currentStage: 'currentStage',
  cuttableState: 'cuttableState',
  prepStatus: 'prepStatus',
  claimStatus: 'claimStatus',
  inBatch: 'inBatch',
}

const initialFilters: OriginalCutOrderFilters = {
  keyword: '',
  productionOrderNo: '',
  styleKeyword: '',
  materialSku: '',
  currentStage: 'ALL',
  cuttableState: 'ALL',
  prepStatus: 'ALL',
  claimStatus: 'ALL',
  inBatch: 'ALL',
  riskOnly: false,
}

interface OriginalOrdersPageState {
  filters: OriginalCutOrderFilters
  activeOrderId: string | null
  page: number
  pageSize: number
  querySignature: string
  prefilter: OriginalCutOrderPrefilter | null
  drillContext: CuttingDrillContext | null
  feedback: { tone: 'warning' | 'success'; message: string } | null
}

const state: OriginalOrdersPageState = {
  filters: { ...initialFilters },
  activeOrderId: null,
  page: 1,
  pageSize: 20,
  querySignature: '',
  prefilter: null,
  drillContext: null,
  feedback: null,
}

const consumedWebActionKeys = new Set<string>()

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
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

function applyWebActionFromUrl(): void {
  const params = getCurrentSearchParams()
  const sourceId = params.get('originalCutOrderId') || params.get('originalCutOrderNo') || ''
  const actionCode = params.get('webAction') || ''
  if (!sourceId || !actionCode) return

  const actionKey = `${sourceId}:${actionCode}`
  if (consumedWebActionKeys.has(actionKey)) return
  consumedWebActionKeys.add(actionKey)

  try {
    const result = executeProcessWebAction({
      sourceType: 'CUTTING_ORIGINAL_ORDER',
      sourceId,
      actionCode,
      operatorName: 'Web 端裁床操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '裁片 Web 端状态操作，菲票归属仍回落原始裁片单',
    })
    setFeedback('success', result.message)
  } catch (error) {
    setFeedback('warning', error instanceof Error ? error.message : '状态操作失败')
  }
}

function resetPagination(): void {
  state.page = 1
}

function getProjection() {
  return buildOriginalOrdersProjection()
}

function getMergeBatchLedger(): MergeBatchRecord[] {
  return getProjection().sources.mergeBatches
}

function getViewModel() {
  return getProjection().viewModel
}

function parsePrefilterFromPath(): OriginalCutOrderPrefilter | null {
  const params = getCurrentSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const nextPrefilter: OriginalCutOrderPrefilter = {}

  const productionOrderId = drillContext?.productionOrderId || params.get('productionOrderId') || ''
  const productionOrderNo = drillContext?.productionOrderNo || params.get('productionOrderNo') || ''
  const originalCutOrderId = drillContext?.originalCutOrderId || params.get('originalCutOrderId') || ''
  const originalCutOrderNo = drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || ''
  const mergeBatchId = drillContext?.mergeBatchId || params.get('mergeBatchId') || ''
  const mergeBatchNo = drillContext?.mergeBatchNo || params.get('mergeBatchNo') || ''
  const styleCode = drillContext?.styleCode || params.get('styleCode') || ''
  const spuCode = drillContext?.spuCode || params.get('spuCode') || ''
  const materialSku = drillContext?.materialSku || params.get('materialSku') || ''

  if (productionOrderId) nextPrefilter.productionOrderId = productionOrderId
  if (productionOrderNo) nextPrefilter.productionOrderNo = productionOrderNo
  if (originalCutOrderId) nextPrefilter.originalCutOrderId = originalCutOrderId
  if (originalCutOrderNo) nextPrefilter.originalCutOrderNo = originalCutOrderNo
  if (mergeBatchId) nextPrefilter.mergeBatchId = mergeBatchId
  if (mergeBatchNo) nextPrefilter.mergeBatchNo = mergeBatchNo
  if (styleCode) nextPrefilter.styleCode = styleCode
  if (spuCode) nextPrefilter.spuCode = spuCode
  if (materialSku) nextPrefilter.materialSku = materialSku

  return Object.keys(nextPrefilter).length ? nextPrefilter : null
}

function syncStateFromPath(viewModel = getViewModel()): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  state.drillContext = readCuttingDrillContextFromLocation(getCurrentSearchParams())
  state.prefilter = parsePrefilterFromPath()
  state.querySignature = pathname
  resetPagination()

  const matched = findOriginalCutOrderByPrefilter(viewModel.rows, state.prefilter)
  state.activeOrderId = matched?.id ?? null
}

function getDisplayRows(viewModel = getViewModel()): OriginalCutOrderRow[] {
  return filterOriginalCutOrderRows(viewModel.rows, state.filters, state.prefilter)
}

function getActiveRow(viewModel = getViewModel()): OriginalCutOrderRow | null {
  if (!state.activeOrderId) return null
  return viewModel.rowsById[state.activeOrderId] ?? null
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function formatDate(value: string): string {
  return value || '待补'
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function readPendingPrepFollowups(): ReplenishmentPendingPrepFollowupRecord[] {
  return deserializeReplenishmentPendingPrepStorage(
    localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY),
  )
}

function getPendingPrepFollowupsForOriginalOrder(row: Pick<OriginalCutOrderRow, 'originalCutOrderId' | 'originalCutOrderNo'>) {
  return readPendingPrepFollowups().filter(
    (item) =>
      item.originalCutOrderId === row.originalCutOrderId ||
      item.originalCutOrderNo === row.originalCutOrderNo,
  )
}

function renderPendingPrepBadge(row: Pick<OriginalCutOrderRow, 'originalCutOrderId' | 'originalCutOrderNo'>): string {
  const pendingPrepItems = getPendingPrepFollowupsForOriginalOrder(row)
  if (!pendingPrepItems.length) return ''
  return renderBadge(`补料待配料 ${pendingPrepItems.length} 条`, 'bg-amber-100 text-amber-700')
}

function buildPendingPrepSummaryText(row: Pick<OriginalCutOrderRow, 'originalCutOrderId' | 'originalCutOrderNo'>): string {
  const pendingPrepItems = getPendingPrepFollowupsForOriginalOrder(row)
  if (!pendingPrepItems.length) return '当前无补料待配料'
  const latest = pendingPrepItems[0]
  return `补料待配料 ${pendingPrepItems.length} 条，待仓库配料领料继续处理；来源铺布 ${latest?.sourceSpreadingSessionId || '待补'}，来源补料单 ${latest?.sourceReplenishmentRequestId || '待补'}`
}

function getFeiTicketRecords(): FeiTicketLabelRecord[] {
  return getProjection().sources.feiViewModel.ticketRecords
}

function getFeiTicketPrintJobs() {
  return getProjection().sources.feiViewModel.printJobs
}

function getMarkerStore() {
  return getProjection().sources.markerStore
}

function buildPrintableUnitSummaryByCutOrder(rows: OriginalCutOrderRow[]) {
  const projection = getProjection()
  const printableView = buildPrintableUnitViewModel({
    originalRows: rows,
    materialPrepRows: projection.sources.materialPrepRows,
    mergeBatches: projection.sources.mergeBatches,
    markerStore: projection.sources.markerStore,
    ticketRecords: projection.sources.feiViewModel.ticketRecords,
    printJobs: projection.sources.feiViewModel.printJobs,
    prefilter: null,
  })
  return Object.fromEntries(printableView.units.map((unit) => [unit.cutOrderId, unit]))
}

function buildOriginalOrderQrSummary(row: OriginalCutOrderRow): {
  latestTicketNo: string
  schemaVersion: string
  ownerType: string
  qrBaseValue: string
  sourceContextText: string
  reservedProcessText: string
  compatibilityText: string
} {
  const latestRecord =
    getFeiTicketRecords()
      .filter((record) => record.originalCutOrderId === row.originalCutOrderId || record.originalCutOrderNo === row.originalCutOrderNo)
      .sort(
        (left, right) =>
          right.printedAt.localeCompare(left.printedAt, 'zh-CN') ||
          right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
          right.sequenceNo - left.sequenceNo,
      )[0] ?? null

  if (!latestRecord) {
    return {
      latestTicketNo: '待生成',
      schemaVersion: FEI_QR_SCHEMA_VERSION,
      ownerType: '原始裁片单',
      qrBaseValue: `QR-${row.originalCutOrderNo}`,
      sourceContextText: row.latestMergeBatchNo ? `最近来自合并裁剪批次 ${row.latestMergeBatchNo}` : '原始单上下文',
      reservedProcessText: '已预留 4 类工艺扩展槽位',
      compatibilityText: '当前尚无历史票据记录，裁片单主码按 1.0.0 结构生成。',
    }
  }

  const payload = buildFeiQrPayload({
    ticketRecord: latestRecord,
    owner: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      color: row.color,
      materialSku: row.materialSku,
      sameCodeValue: row.originalCutOrderNo,
      qrBaseValue: latestRecord.legacyQrBaseValue || `QR-${row.originalCutOrderNo}`,
    },
  })
  const summary = buildFeiQrPayloadSummary(payload)
  const compatibility = buildFeiQrCompatibilityMeta(latestRecord)

  return {
    latestTicketNo: latestRecord.ticketNo,
    schemaVersion: summary.schemaVersion,
    ownerType: summary.ownerType === 'original-cut-order' ? '原始裁片单' : summary.ownerType,
    qrBaseValue: summary.qrBaseValue,
    sourceContextText: summary.sourceContextType === 'merge-batch' ? `来源合并裁剪批次 ${latestRecord.sourceMergeBatchNo || '待补合并裁剪批次号'}` : '原始单上下文',
    reservedProcessText: summary.hasReservedProcess ? '已预留 4 类工艺扩展槽位' : '待补',
    compatibilityText: compatibility.compatibilityNote.replaceAll('二维码', '裁片单主码'),
  }
}

function buildStatsCards(rows: OriginalCutOrderRow[]): string {
  const stats = buildOriginalCutOrderStats(rows)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('原始裁片单总数', stats.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('当前可裁数', stats.cuttableCount, '满足配料 / 领料条件', 'text-emerald-600')}
      ${renderCompactKpiCard('已入合并裁剪批次数', stats.inBatchCount, '已进入执行层合并裁剪批次', 'text-violet-600')}
      ${renderCompactKpiCard('配料异常数', stats.prepExceptionCount, '配料或领料未齐', 'text-amber-600')}
      ${renderCompactKpiCard('领料异常数', stats.claimExceptionCount, '待领料或领料差异', 'text-rose-600')}
    </section>
  `
}

function setFeedback(tone: 'warning' | 'success', message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const className =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `
    <section class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${className}">
      <span>${escapeHtml(state.feedback.message)}</span>
      <button type="button" class="rounded-md px-2 py-1 text-xs hover:bg-black/5" data-cutting-piece-action="clear-feedback">关闭</button>
    </section>
  `
}

function renderFilterSelect(
  label: string,
  field: FilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-piece-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderHeaderActions(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress-index">返回生产单进度</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep-index">去仓库配料领料</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan-index">去唛架</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-summary-index">查看裁剪总表</button>
    </div>
  `
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.productionOrderNo) labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`)
  if (prefilter.originalCutOrderNo) labels.push(`预筛：原始裁片单 ${prefilter.originalCutOrderNo}`)
  if (prefilter.mergeBatchNo) labels.push(`预筛：合并裁剪批次 ${prefilter.mergeBatchNo}`)
  if (prefilter.styleCode) labels.push(`预筛：款号 ${prefilter.styleCode}`)
  if (prefilter.spuCode) labels.push(`预筛：SPU ${prefilter.spuCode}`)
  if (prefilter.materialSku) labels.push(`预筛：面料 ${prefilter.materialSku}`)

  return labels
}

function getFilterLabels(): string[] {
  const labels: string[] = []

  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.productionOrderNo) labels.push(`来源生产单：${state.filters.productionOrderNo}`)
  if (state.filters.styleKeyword) labels.push(`款号 / SPU：${state.filters.styleKeyword}`)
  if (state.filters.materialSku) labels.push(`面料：${state.filters.materialSku}`)
  if (state.filters.currentStage !== 'ALL') labels.push(`当前阶段：${originalOrderStageMeta[state.filters.currentStage].label}`)
  if (state.filters.cuttableState !== 'ALL') labels.push(`可裁状态：${originalOrderVisibleCuttableMeta[state.filters.cuttableState].label}`)
  if (state.filters.prepStatus !== 'ALL') labels.push(`配料状态：${configMeta[state.filters.prepStatus].label}`)
  if (state.filters.claimStatus !== 'ALL') labels.push(`领料状态：${receiveMeta[state.filters.claimStatus].label}`)
  if (state.filters.inBatch === 'IN_BATCH') labels.push('仅看已入合并裁剪批次')
  if (state.filters.inBatch === 'NOT_IN_BATCH') labels.push('仅看未入合并裁剪批次')
  if (state.filters.riskOnly) labels.push('仅看异常项')

  return labels
}

function renderPrefilterBar(): string {
  const labels = Array.from(new Set([...buildCuttingDrillChipLabels(state.drillContext), ...getPrefilterLabels()]))
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前预筛条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-piece-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-piece-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels = getFilterLabels()
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前筛选条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-piece-action="clear-filters"', 'blue')),
    clearAttrs: 'data-cutting-piece-action="clear-filters"',
  })
}

function renderFilterArea(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-[240px] flex-1">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">关键字</span>
            <input
              type="search"
              value="${escapeHtml(state.filters.keyword)}"
              placeholder="搜索原始裁片单号 / 生产单号 / 款号 / 面料 SKU"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-cutting-piece-field="keyword"
            />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderWorkbenchFilterChip(
            state.filters.riskOnly ? '仅看异常项：已开启' : '仅看异常项',
            'data-cutting-piece-action="toggle-risk-only"',
            state.filters.riskOnly ? 'rose' : 'blue',
          )}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="clear-filters">重置筛选</button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">来源生产单</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.productionOrderNo)}"
            placeholder="输入生产单号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="productionOrderNo"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">款号 / SPU</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.styleKeyword)}"
            placeholder="输入款号、SPU 或款式名称"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="styleKeyword"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">面料 SKU / 类别</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.materialSku)}"
            placeholder="输入面料 SKU 或类别关键词"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-piece-field="materialSku"
          />
        </label>
        ${renderFilterSelect('当前阶段', 'currentStage', state.filters.currentStage, [
          { value: 'ALL', label: '全部阶段' },
          ...Object.entries(originalOrderStageMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        ${renderFilterSelect('可裁状态', 'cuttableState', state.filters.cuttableState, [
          { value: 'ALL', label: '全部' },
          { value: 'CUTTABLE', label: originalOrderVisibleCuttableMeta.CUTTABLE.label },
          { value: 'NOT_CUTTABLE', label: originalOrderVisibleCuttableMeta.NOT_CUTTABLE.label },
        ])}
        ${renderFilterSelect('配料状态', 'prepStatus', state.filters.prepStatus, [
          { value: 'ALL', label: '全部配料状态' },
          { value: 'NOT_CONFIGURED', label: configMeta.NOT_CONFIGURED.label },
          { value: 'PARTIAL', label: configMeta.PARTIAL.label },
          { value: 'CONFIGURED', label: configMeta.CONFIGURED.label },
        ])}
        ${renderFilterSelect('领料状态', 'claimStatus', state.filters.claimStatus, [
          { value: 'ALL', label: '全部领料状态' },
          { value: 'NOT_RECEIVED', label: receiveMeta.NOT_RECEIVED.label },
          { value: 'PARTIAL', label: receiveMeta.PARTIAL.label },
          { value: 'RECEIVED', label: receiveMeta.RECEIVED.label },
        ])}
        ${renderFilterSelect('是否已入合并裁剪批次', 'inBatch', state.filters.inBatch, [
          { value: 'ALL', label: '全部' },
          { value: 'IN_BATCH', label: '仅看已入合并裁剪批次' },
          { value: 'NOT_IN_BATCH', label: '仅看未入合并裁剪批次' },
        ])}
      </div>
    </div>
  `)
}

function renderRiskTags(tags: OriginalCutOrderRow['riskTags']): string {
  if (!tags.length) return '<span class="text-xs text-muted-foreground">-</span>'

  return `
    <div class="flex flex-wrap gap-1">
      ${tags
        .slice(0, 3)
        .map((tag) => renderBadge(tag.label, tag.className))
        .join('')}
      ${tags.length > 3 ? `<span class="text-xs text-muted-foreground">+${tags.length - 3}</span>` : ''}
    </div>
  `
}

function renderBatchSummary(row: OriginalCutOrderRow): string {
  if (!row.batchParticipationCount) {
    return '<span class="text-xs text-muted-foreground">未关联合并裁剪批次</span>'
  }

  return `
    <div class="space-y-1">
      <button type="button" class="text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-piece-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}">
        ${escapeHtml(row.latestMergeBatchNo || row.mergeBatchNos[0] || '查看合并裁剪批次')}
      </button>
      <p class="text-xs text-muted-foreground">共参与 ${escapeHtml(String(row.batchParticipationCount))} 个合并裁剪批次</p>
    </div>
  `
}

function renderEmptyTableState(): string {
  return `
    <tr>
      <td colspan="13" class="px-4 py-16 text-center text-sm text-muted-foreground">
        当前条件下暂无原始裁片单，请调整筛选条件或清除预筛后重试。
      </td>
    </tr>
  `
}

function renderTable(rows: OriginalCutOrderRow[]): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)

  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-original-orders-main-table">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">原始裁片单主表</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条原始裁片单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1560px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
                <th class="px-4 py-3 text-left font-medium">来源生产单号</th>
                <th class="px-4 py-3 text-left font-medium">款号 / SPU</th>
                <th class="px-4 py-3 text-left font-medium">颜色</th>
                <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
                <th class="px-4 py-3 text-left font-medium">面料类别 / 属性</th>
                <th class="px-4 py-3 text-left font-medium">需求成衣件数 / 待裁裁片数量</th>
                <th class="px-4 py-3 text-left font-medium">日期信息</th>
                <th class="px-4 py-3 text-left font-medium">当前阶段</th>
                <th class="px-4 py-3 text-left font-medium">可裁状态</th>
                <th class="px-4 py-3 text-left font-medium">关联合并裁剪批次</th>
                <th class="px-4 py-3 text-left font-medium">风险提示</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${
                pagination.items.length
                  ? pagination.items
                      .map((row) => {
                        const highlighted = state.activeOrderId === row.id
                        return `
                          <tr class="${highlighted ? 'bg-blue-50/60' : 'hover:bg-muted/20'}">
                            <td class="px-4 py-3 align-top">
                              <button type="button" class="text-left font-medium text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${escapeHtml(row.id)}">
                                ${escapeHtml(row.originalCutOrderNo)}
                              </button>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.relationSummary)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-blue-600" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">
                                ${escapeHtml(row.productionOrderNo)}
                              </button>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.urgencyLabel)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="font-medium">${escapeHtml(row.styleCode || row.spuCode || '待补')}</div>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '款式待补')}</p>
                            </td>
                            <td class="px-4 py-3 align-top">${escapeHtml(row.color)}</td>
                            <td class="px-4 py-3 align-top">
                              <div class="font-medium">${escapeHtml(row.materialSku)}</div>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialLabel)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div>${escapeHtml(row.materialCategory)}</div>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialType)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="font-medium">需求成衣件数：${escapeHtml(row.pieceCountText)} 件</div>
                              <p class="mt-1 text-xs text-muted-foreground">待裁裁片数量：${escapeHtml(row.pieceCountText)} 片</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                ${row.dateInfoLines
                                  .map((line) => `<p>${escapeHtml(line.label)}：${escapeHtml(line.value)}</p>`)
                                  .join('')}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBadge(row.currentStageLabel, row.currentStage.className)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBadge(row.visibleCuttableStatus.label, row.visibleCuttableStatus.className)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBatchSummary(row)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1">
                                ${renderRiskTags(row.riskTags)}
                                ${renderPendingPrepBadge(row)}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${escapeHtml(row.id)}">查看详情</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">查看配料</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>
                              </div>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
                  : renderEmptyTableState()
              }
            </tbody>
          </table>
        `,
      )}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-piece-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-piece-page-size',
      })}
    </section>
  `
}

function renderInfoGrid(
  items: Array<{ label: string; value: string; tone?: 'default' | 'strong'; hint?: string }>,
): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-2">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 ${item.tone === 'strong' ? 'text-base font-semibold' : 'text-sm'}">${escapeHtml(item.value || '待补')}</p>
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderDetailSection(title: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `
}

function renderCuttingWebActions(row: OriginalCutOrderRow, actions: ProcessWebAction[]): string {
  const actionable = actions.filter((action) => !action.disabledReason)
  const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason
  const actionHref = (actionCode: string) =>
    buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
      originalCutOrderId: row.originalCutOrderId,
      webAction: actionCode,
    })
  return renderDetailSection(
    '可执行动作',
    `
      <div class="space-y-3">
        ${renderInfoGrid([
          { label: '当前状态', value: row.currentStage.label, tone: 'strong' },
          { label: '操作方式', value: '仅展示当前状态允许的下一步动作' },
          { label: '菲票归属口径', value: '菲票归属原始裁片单，合并裁剪批次只作为执行上下文' },
        ])}
        ${
          actionable.length
            ? `<div class="flex flex-wrap gap-2">
                ${actionable
                  .map(
                    (action) => `
                      <button
                        type="button"
                        class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        data-nav="${escapeHtml(actionHref(action.actionCode))}"
                      >
                        ${escapeHtml(action.actionLabel)}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                操作弹窗字段：${escapeHtml(actionable[0].requiredFields.join('、'))}；确认后写回裁片事实源并生成 操作记录。
              </div>`
            : `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">${escapeHtml(disabledReason || '当前状态暂无可执行动作')}</div>`
        }
      </div>
    `,
  )
}

function renderCuttingWebOperationRecords(records: ProcessWebOperationRecord[]): string {
  return renderDetailSection(
    '操作记录',
    `
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">操作动作</th>
              <th class="px-3 py-2 font-medium">前状态</th>
              <th class="px-3 py-2 font-medium">后状态</th>
              <th class="px-3 py-2 font-medium">操作人</th>
              <th class="px-3 py-2 font-medium">操作时间</th>
              <th class="px-3 py-2 font-medium">操作对象与数量单位</th>
              <th class="px-3 py-2 font-medium">来源</th>
              <th class="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            ${
              records.length
                ? records
                    .map(
                      (record) => `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.actionLabel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.previousStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.nextStatus)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatorName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.operatedAt)}</td>
                          <td class="px-3 py-3 text-sm"><div>${escapeHtml(record.qtyLabel || '操作裁片数量')}</div><div class="text-xs text-muted-foreground">${formatCount(record.objectQty)} ${escapeHtml(record.qtyUnit)}</div></td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceChannel)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">暂无操作记录</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `,
  )
}

function renderDetailDrawer(viewModel = getViewModel()): string {
  const row = getActiveRow(viewModel)
  if (!row) return ''
  const qrSummary = buildOriginalOrderQrSummary(row)
  const markerSpreadingCounts = buildMarkerSpreadingCountsByOriginalOrder(row.originalCutOrderId)
  const latestClaimDispute = getLatestClaimDisputeByOriginalCutOrderNo(row.originalCutOrderNo)
  const printableUnit = buildPrintableUnitSummaryByCutOrder(viewModel.rows)[row.originalCutOrderId] || null
  const printableStatusMeta = printableUnit ? getPrintableUnitStatusMeta(printableUnit.printableUnitStatus) : null
  const mobileBinding = validateCuttingOrderMobileTaskBinding(row.originalCutOrderId)
  const webActions = getAvailableCuttingWebActions(row.originalCutOrderId)
  const webOperationRecords = getProcessWebOperationRecordsBySource('CUTTING_ORIGINAL_ORDER', row.originalCutOrderId)
  const mobileBindingReasonLabel =
    mobileBinding.reasonCode === 'TASK_NOT_VISIBLE_IN_MOBILE_LIST'
      ? '移动端执行列表不可见，请检查工厂或任务状态'
      : mobileBinding.reasonLabel
  const mobileExecutionTask = mobileBinding.actualTaskId ? getMobileExecutionTaskById(mobileBinding.actualTaskId) : null
  const mobileExecutionLink =
    mobileBinding.canOpenMobileExecution && mobileExecutionTask
      ? buildTaskDetailLink(mobileBinding.actualTaskId, {
          returnTo: buildMobileExecutionListLocatePathForTask(mobileExecutionTask, {
            currentFactoryId: row.assignedFactoryId || TEST_FACTORY_ID,
            keyword: row.originalCutOrderNo,
          }),
          sourceType: 'CUTTING_ORIGINAL_ORDER',
          sourceId: row.originalCutOrderId || row.originalCutOrderNo,
          currentFactoryId: row.assignedFactoryId || TEST_FACTORY_ID,
          keyword: row.originalCutOrderNo,
        })
      : ''

  const siblingRows = viewModel.rows.filter(
    (item) => item.productionOrderId === row.productionOrderId && item.originalCutOrderId !== row.originalCutOrderId,
  )

  const batchParticipationText = row.batchParticipationCount
    ? `已参与 ${row.batchParticipationCount} 个合并裁剪批次，最新合并裁剪批次 ${row.latestMergeBatchNo || '待补'}。`
    : '当前尚未进入任何合并裁剪批次。'

  const extraButtons = `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去配料</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>
    </div>
  `

  const content = `
    <div class="space-y-4">
      ${renderDetailSection(
        '基础身份信息',
        renderInfoGrid([
          { label: '原始裁片单号', value: row.originalCutOrderNo, tone: 'strong' },
          { label: '来源生产单号', value: row.productionOrderNo },
          { label: '款号 / SPU', value: `${row.styleCode || row.spuCode} / ${row.styleName || row.spuCode}` },
          { label: '颜色', value: row.color },
          { label: '面料 SKU', value: row.materialSku },
          { label: '面料类别 / 属性', value: row.materialCategory, hint: row.materialLabel },
          { label: '需求成衣件数（件）', value: `${formatCount(row.orderQty)} 件` },
          { label: '计划裁片数量（片）', value: `${formatCount(row.orderQty)} 片` },
          { label: '采购日期', value: formatDate(row.purchaseDate) },
          { label: '实际下单日期', value: formatDate(row.actualOrderDate) },
          { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
          { label: '工厂', value: formatFactoryDisplayName(row.assignedFactoryName, TEST_FACTORY_ID) },
          { label: '卖价', value: formatOriginalOrderCurrency(row.sellingPrice) },
          { label: '最近执行痕迹', value: row.latestActionText },
        ]),
      )}

      ${renderDetailSection(
        '当前状态摘要',
        `
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              ${renderBadge(row.currentStage.label, row.currentStage.className)}
              ${renderBadge(row.cuttableState.label, row.cuttableState.className)}
              ${renderBadge(row.materialPrepStatus.label, row.materialPrepStatus.className)}
              ${renderBadge(row.materialClaimStatus.label, row.materialClaimStatus.className)}
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <article class="rounded-lg border bg-muted/10 px-3 py-2">
                <p class="text-xs text-muted-foreground">可裁说明</p>
                <p class="mt-1 text-sm">${escapeHtml(row.cuttableState.reasonText)}</p>
              </article>
              <article class="rounded-lg border bg-muted/10 px-3 py-2">
                <p class="text-xs text-muted-foreground">风险提示</p>
                <div class="mt-2 flex flex-wrap gap-1">
                  ${
                    row.riskTags.length
                      ? row.riskTags.map((tag) => renderBadge(tag.label, tag.className)).join('')
                      : '<span class="text-sm text-muted-foreground">当前未识别到异常项。</span>'
                  }
                </div>
              </article>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '移动端执行绑定',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '移动端任务号', value: mobileBinding.actualTaskNo || mobileBinding.expectedTaskNo || '未绑定', tone: 'strong' },
              { label: '绑定状态', value: mobileBinding.canOpenMobileExecution ? '有效' : '不可执行' },
              { label: '校验结果', value: mobileBinding.canOpenMobileExecution ? '允许打开移动端执行页' : '当前不可执行' },
              { label: '不可执行原因', value: mobileBindingReasonLabel },
            ])}
            <div class="flex flex-wrap gap-2">
              ${
                mobileBinding.canOpenMobileExecution
                  ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(mobileExecutionLink)}">打开移动端执行页</button>`
                  : '<button type="button" class="rounded-md border px-3 py-2 text-sm opacity-50" disabled>打开移动端执行页</button>'
              }
              <span class="inline-flex items-center rounded-md border ${mobileBinding.canOpenMobileExecution ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'} px-3 py-2 text-xs">${escapeHtml(mobileBinding.suggestedAction)}</span>
            </div>
          </div>
        `,
      )}

      ${renderCuttingWebActions(row, webActions)}

      ${renderDetailSection(
        '合并裁剪批次参与记录',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '最新合并裁剪批次号', value: row.latestMergeBatchNo || '未关联合并裁剪批次' },
              { label: '参与合并裁剪批次数', value: `${row.batchParticipationCount} 次` },
              { label: '当前占用状态', value: row.activeBatchNo ? `已占用（${row.activeBatchNo}）` : '未占用' },
            ])}
            <p class="text-sm text-muted-foreground">${escapeHtml(batchParticipationText)}</p>
            ${
              row.mergeBatchNos.length
                ? `
                  <div class="flex flex-wrap gap-2">
                    ${row.mergeBatchNos.map((batchNo) => renderBadge(batchNo, 'bg-violet-100 text-violet-700 border border-violet-200')).join('')}
                  </div>
                `
                : ''
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}">
                查看合并裁剪批次
              </button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-same-production-orders" data-record-id="${escapeHtml(row.id)}">
                查看同生产单下其他原始裁片单${siblingRows.length ? `（${siblingRows.length}）` : ''}
              </button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '裁片单主码摘要',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '最新菲票号', value: qrSummary.latestTicketNo, tone: 'strong' },
              { label: '主码版本', value: qrSummary.schemaVersion },
              { label: '归属对象', value: qrSummary.ownerType },
              { label: '主码值', value: qrSummary.qrBaseValue },
              { label: '来源上下文', value: qrSummary.sourceContextText },
              { label: '工艺预留', value: qrSummary.reservedProcessText },
            ])}
            <div class="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">${escapeHtml(qrSummary.compatibilityText)}</div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '打印菲票摘要',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '打印状态', value: printableStatusMeta ? printableStatusMeta.label : '暂无可打印对象', tone: 'strong' },
              { label: '应打菲票数', value: printableUnit ? `${formatCount(printableUnit.requiredTicketCount)} 张` : '0 张' },
              { label: '有效已打印数', value: printableUnit ? `${formatCount(printableUnit.validPrintedTicketCount)} 张` : '0 张' },
              { label: '已作废数', value: printableUnit ? `${formatCount(printableUnit.voidedTicketCount)} 张` : '0 张' },
              { label: '需补打数', value: printableUnit ? `${formatCount(printableUnit.missingTicketCount)} 张` : '0 张' },
              { label: '最近打印时间', value: printableUnit?.lastPrintedAt || '未打印' },
              { label: '最近打印人', value: printableUnit?.lastPrintedBy || '未打印' },
            ])}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>
              ${
                printableUnit
                  ? `
                    <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-ticket-printed'), {
                      printableUnitId: printableUnit.printableUnitId,
                      printableUnitNo: printableUnit.printableUnitNo,
                      printableUnitType: printableUnit.printableUnitType,
                      cutOrderId: printableUnit.cutOrderId,
                      cutOrderNo: printableUnit.cutOrderNo,
                    }))}">查看已打印菲票</button>
                    <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-ticket-records'), {
                      printableUnitId: printableUnit.printableUnitId,
                      printableUnitNo: printableUnit.printableUnitNo,
                      printableUnitType: printableUnit.printableUnitType,
                      cutOrderId: printableUnit.cutOrderId,
                      cutOrderNo: printableUnit.cutOrderNo,
                    }))}">查看打印记录</button>
                  `
                  : ''
              }
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '铺布摘要',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '相关唛架数', value: `${markerSpreadingCounts.markerCount} 条`, tone: 'strong' },
              { label: '铺布 session 数', value: `${markerSpreadingCounts.sessionCount} 条` },
              { label: '卷记录数', value: `${markerSpreadingCounts.rollCount} 条` },
              { label: '人员记录数', value: `${markerSpreadingCounts.operatorCount} 条` },
              { label: '铺布状态摘要', value: markerSpreadingCounts.statusSummary },
              { label: '当前铺布状态', value: markerSpreadingCounts.spreadingStatusLabel, tone: 'strong' },
              { label: '最近铺布记录', value: markerSpreadingCounts.latestSessionNo },
              { label: '是否已完成人员分摊', value: markerSpreadingCounts.hasOperatorAllocation ? '已形成按人分摊' : '待补录分摊' },
              { label: '人员金额摘要', value: `${formatOriginalOrderCurrency(markerSpreadingCounts.operatorAmountTotal)}` },
              { label: '人工调价', value: markerSpreadingCounts.hasManualAdjustedAmount ? '存在人工调整金额' : '当前未人工调整' },
              { label: '补料预警', value: markerSpreadingCounts.hasReplenishmentWarning ? `有预警（${markerSpreadingCounts.warningLevelLabel}）` : '当前无明显预警' },
              { label: '建议动作', value: markerSpreadingCounts.suggestedAction },
              { label: '补料待配料', value: buildPendingPrepSummaryText(row) },
            ])}
            <div class="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              <p>完成铺布后，原始裁片单会在这里直接看到“铺布完成 / 待补料确认 / 补料待配料”等联动结果。</p>
              <p class="mt-1">当前已可查看铺布记录数、卷记录数、人员记录数、最近铺布记录、补料预警摘要，并继续跳转到铺布页、补料页或仓库配料领料处理。</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment" data-record-id="${escapeHtml(row.id)}">去补料管理</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去仓库配料领料</button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '领料异议摘要',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '当前是否存在领料异议', value: latestClaimDispute ? '存在' : '暂无' },
              { label: '异议状态', value: latestClaimDispute ? getClaimDisputeStatusLabel(latestClaimDispute.status) : '暂无异议', tone: 'strong' },
              { label: '差异长度（m）', value: latestClaimDispute ? `${latestClaimDispute.discrepancyQty} 米` : '0 米' },
              { label: '处理结论', value: latestClaimDispute?.handleConclusion || '待平台处理' },
              { label: '提交时间', value: latestClaimDispute?.submittedAt || '待补' },
              { label: '证据份数（个）', value: latestClaimDispute ? `${latestClaimDispute.evidenceCount} 个` : '0 个' },
            ])}
            <div class="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              ${
                latestClaimDispute
                  ? `当前已存在领料长度异议，提交人 ${escapeHtml(latestClaimDispute.submittedBy)}，原因：${escapeHtml(latestClaimDispute.disputeReason)}。`
                  : '当前未发现领料长度异议，后续如移动端提交异议，会在这里同步展示摘要。'
              }
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去仓库配料领料</button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '关联单据 / 关联入口',
        `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去仓库配料领料</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment" data-record-id="${escapeHtml(row.id)}">去补料管理</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回生产单进度</button>
          </div>
        `,
      )}

      ${renderDetailSection(
        '轻量执行痕迹',
        `
          <div class="grid gap-3 md:grid-cols-2">
            <article class="rounded-lg border bg-muted/10 px-3 py-2">
              <p class="text-xs text-muted-foreground">最近状态摘要</p>
              <p class="mt-1 text-sm">${escapeHtml(row.statusSummary)}</p>
            </article>
            <article class="rounded-lg border bg-muted/10 px-3 py-2">
              <p class="text-xs text-muted-foreground">最近动作</p>
              <p class="mt-1 text-sm">${escapeHtml(row.latestActionText)}</p>
            </article>
          </div>
        `,
      )}

      ${renderCuttingWebOperationRecords(webOperationRecords)}
    </div>
  `

  return uiDetailDrawer(
    {
      title: row.originalCutOrderNo,
      subtitle: '',
      closeAction: { prefix: 'cuttingPiece', action: 'close-overlay' },
      width: 'lg',
    },
    content,
    extraButtons,
  )
}

function renderPage(): string {
  applyWebActionFromUrl()
  const viewModel = getViewModel()
  syncStateFromPath(viewModel)
  const rows = getDisplayRows(viewModel)
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'original-orders')

  return `
    <div class="space-y-3 p-4" data-testid="cutting-original-orders-page">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
      ${renderFeedbackBar()}
      ${buildStatsCards(rows)}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${renderFilterStateBar()}
      ${renderTable(rows)}
      ${renderDetailDrawer(viewModel)}
    </div>
  `
}

function navigateToRecordTarget(
  recordId: string | undefined,
  target: keyof OriginalCutOrderRow['navigationPayload'] | 'markerPlan' | 'spreadingList',
): boolean {
  if (!recordId) return false
  const row = getViewModel().rowsById[recordId]
  if (!row) return false
  const payload =
    target === 'markerPlan' || target === 'spreadingList'
      ? row.navigationPayload.markerSpreading
      : row.navigationPayload[target]
  const context = normalizeLegacyCuttingPayload(payload, 'original-orders', {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    originalCutOrderId: row.originalCutOrderId,
    originalCutOrderNo: row.originalCutOrderNo,
    mergeBatchNo: row.latestMergeBatchNo || undefined,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    materialSku: row.materialSku,
    autoOpenDetail: true,
  })
  appStore.navigate(
    buildCuttingRouteWithContext(
      target === 'sameProductionOrders'
        ? 'originalOrders'
        : target === 'markerPlan'
          ? 'markerPlan'
          : target === 'spreadingList'
            ? 'spreadingList'
          : (target as CuttingNavigationTarget),
      context,
    ),
  )
  return true
}

export function renderCraftCuttingOriginalOrdersPage(): string {
  return renderPage()
}

export function handleCraftCuttingOriginalOrdersEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-piece-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-piece-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingPieceField as FilterField | undefined
    if (!field) return false

    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    resetPagination()
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-piece-action]')
  const action = actionNode?.dataset.cuttingPieceAction
  if (!action) return false

  if (action === 'toggle-risk-only') {
    state.filters = {
      ...state.filters,
      riskOnly: !state.filters.riskOnly,
    }
    resetPagination()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    resetPagination()
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.activeOrderId = null
    state.querySignature = getCanonicalCuttingPath('original-orders')
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'open-detail') {
    state.activeOrderId = actionNode.dataset.recordId ?? null
    return true
  }

  if (action === 'print-task-route-card') {
    const recordId = actionNode.dataset.recordId
    const row = recordId ? getViewModel().rowsById[recordId] : null
    if (!row) return false
    appStore.navigate(buildTaskRouteCardPrintLink('CUTTING_ORIGINAL_ORDER', row.originalCutOrderId))
    return true
  }

  if (action === 'print-cutting-order-qr') {
    const recordId = actionNode.dataset.recordId
    const row = recordId ? getViewModel().rowsById[recordId] : null
    if (!row) return false
    appStore.navigate(buildCuttingOrderQrLabelPrintLink(row.originalCutOrderId))
    return true
  }

  if (action === 'web-status-action') {
    const sourceId = actionNode.dataset.sourceId
    const actionCode = actionNode.dataset.actionCode
    if (!sourceId || !actionCode) return true
    try {
      const result = executeProcessWebAction({
        sourceType: 'CUTTING_ORIGINAL_ORDER',
        sourceId,
        actionCode,
        operatorName: 'Web 端裁床操作员',
        operatedAt: '2026-04-28 10:00',
        remark: '裁片 Web 端状态操作，菲票归属仍回落原始裁片单',
      })
      setFeedback('success', result.message)
    } catch (error) {
      setFeedback('warning', error instanceof Error ? error.message : '状态操作失败')
    }
    return true
  }

  if (action === 'close-overlay') {
    state.activeOrderId = null
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    return true
  }

  if (action === 'go-production-progress') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'productionProgress')
  }

  if (action === 'go-material-prep') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'materialPrep')
  }

  if (action === 'go-marker-plan') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'markerPlan')
  }

  if (action === 'go-marker-spreading') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'spreadingList')
  }

  if (action === 'go-spreading') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'spreadingList')
  }

  if (action === 'go-fei-tickets') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'feiTickets')
  }

  if (action === 'go-replenishment') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'replenishment')
  }

  if (action === 'go-merge-batches') {
    const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : null
    if (!row?.batchParticipationCount) {
      setFeedback('warning', '当前没有关联的合并裁剪批次，无法跳转。')
      return true
    }
    return navigateToRecordTarget(actionNode.dataset.recordId, 'mergeBatches')
  }

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'go-same-production-orders') {
    state.activeOrderId = null
    return navigateToRecordTarget(actionNode.dataset.recordId, 'sameProductionOrders')
  }

  if (action === 'go-production-progress-index') {
    appStore.navigate(getCanonicalCuttingPath('production-progress'))
    return true
  }

  if (action === 'go-material-prep-index') {
    appStore.navigate(getCanonicalCuttingPath('material-prep'))
    return true
  }

  if (action === 'go-marker-plan-index') {
    appStore.navigate(getCanonicalCuttingPath('marker-list'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  return false
}

export function isCraftCuttingOriginalOrdersDialogOpen(): boolean {
  return state.activeOrderId !== null
}
