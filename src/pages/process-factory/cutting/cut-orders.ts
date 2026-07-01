// cut-orders 是 canonical 页面文件。
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
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
  isPrintableSourceRow,
  type FeiTicketLabelRecord,
} from './fei-tickets-model.ts'
import {
  FEI_QR_SCHEMA_VERSION,
  buildFeiQrSchemaMeta,
  buildFeiQrPayload,
  buildFeiQrPayloadSummary,
} from './fei-qr-model.ts'
import {
  buildCutOrderStats,
  filterCutOrderRows,
  findCutOrderByPrefilter,
  formatCutOrderCurrency,
  cutOrderStageMeta,
  type CutOrderFilters,
  type CutOrderPrefilter,
  type CutOrderRow,
} from './cut-orders-model.ts'
import { buildMarkerSpreadingCountsByCutOrder } from './marker-spreading-utils.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
import { getClaimDisputeStatusLabel } from '../../../helpers/fcs-claim-dispute.ts'
import { getLatestClaimDisputeByCutOrderNo } from '../../../state/fcs-claim-dispute-store.ts'
import {
  paginateItems,
  renderCompactKpiCard,
  renderCompactKpiGroup,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
  renderProductionObjectCodeButton,
} from '../../../data/fcs/production-order-identity.ts'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context.ts'
import { buildCutOrdersProjection } from './cut-orders-projection.ts'
import { buildSampleWarehouseProjection } from './sample-warehouse-projection.ts'
import type { SampleWarehouseItem } from './sample-warehouse-model.ts'
import type { MarkerPlanSourceRecord } from './marker-plan-source-model.ts'
import { updateCuttingOrderProgressWebStage } from '../../../data/fcs/cutting/order-progress.ts'
import {
  buildCutOrderCloseImpactItems,
  buildCutOrderLedgerSnapshotBeforeClose,
  cutOrderCloseReasonOptions,
  formatCutOrderCloseLedgerQty,
  listCutOrderCloseRecords,
  listStoredCutOrderReopenRecords,
  resolveCutOrderCloseReasonText,
  upsertStoredCutOrderCloseRecord,
  upsertStoredCutOrderReopenRecord,
  type CutOrderCloseImpactItem,
  type CutOrderCloseReasonCode,
  type CutOrderCloseRecord,
  type CutOrderReopenRecord,
} from '../../../data/fcs/cutting/cut-order-close-records.ts'
import { cuttingMaterialLedgerEventTypeLabels } from '../../../data/fcs/cutting/material-ledger.ts'
import { listSpreadingDifferences } from '../../../data/fcs/cutting/spreading-differences.ts'
import { buildBindingProcessOrders } from './binding-strip-orders.ts'

type FilterField =
  | 'keyword'
  | 'productionOrderNo'
  | 'styleKeyword'
  | 'materialSku'
  | 'currentStage'
  | 'inBatch'
  | 'hasAvailableBalance'
  | 'hasCloseReason'
type CloseField = 'closeReasonCode' | 'closeDescription' | 'closedBy'

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof CutOrderFilters> = {
  keyword: 'keyword',
  productionOrderNo: 'productionOrderNo',
  styleKeyword: 'styleKeyword',
  materialSku: 'materialSku',
  currentStage: 'currentStage',
  inBatch: 'inBatch',
  hasAvailableBalance: 'hasAvailableBalance',
  hasCloseReason: 'hasCloseReason',
}

const initialFilters: CutOrderFilters = {
  keyword: '',
  productionOrderNo: '',
  styleKeyword: '',
  materialSku: '',
  currentStage: 'ALL',
  inBatch: 'ALL',
  hasAvailableBalance: 'ALL',
  hasCloseReason: 'ALL',
  riskOnly: false,
}

interface CutOrdersPageState {
  filters: CutOrderFilters
  activeOrderId: string | null
  page: number
  pageSize: number
  querySignature: string
  prefilter: CutOrderPrefilter | null
  drillContext: CuttingDrillContext | null
  feedback: { tone: 'warning' | 'success'; message: string } | null
  closeDraft: {
    querySignature: string
    closeReasonCode: CutOrderCloseReasonCode
    closeDescription: string
    closedBy: string
    feedback: { tone: 'warning' | 'success'; message: string } | null
  }
}

const state: CutOrdersPageState = {
  filters: { ...initialFilters },
  activeOrderId: null,
  page: 1,
  pageSize: 20,
  querySignature: '',
  prefilter: null,
  drillContext: null,
  feedback: null,
  closeDraft: {
    querySignature: '',
    closeReasonCode: 'BUSINESS_STOP_RECUT',
    closeDescription: '',
    closedBy: '裁床主管 何倩',
    feedback: null,
  },
}

const cutOrderDemoScenarioNos = new Set([
  // 只保留裁片单页面需要演示的关键业务场景，避免大量重复 mock 干扰阅读。
  'CUT-260308-081-01', // 未开工：无配料、无领料、无唛架
  'CUT-260306-101-05', // 已开工未排唛架：只有配料 / 领料 / 入仓记录
  'CUT-260306-101-01', // 已排唛架：有唛架、铺布和后续记录
  'CUT-260306-101-02', // 历史唛架后仍有可用余额
  'CUT-260307-102-01', // 已裁剪：有菲票和差异记录
  'CUT-260306-101-04', // 已关闭：有关闭原因和影响项
])

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

function buildCutOrderDetailPath(recordId: string): string {
  return `/fcs/craft/cutting/cut-orders/${encodeURIComponent(recordId)}`
}

function applyWebActionFromUrl(): void {
  const params = getCurrentSearchParams()
  const sourceId = params.get('cutOrderId') || params.get('cutOrderNo') || ''
  const actionCode = params.get('webAction') || ''
  if (!sourceId || !actionCode) return

  const actionKey = `${sourceId}:${actionCode}`
  if (consumedWebActionKeys.has(actionKey)) return
  consumedWebActionKeys.add(actionKey)

  try {
    const result = executeProcessWebAction({
      sourceType: 'CUTTING_ORDER',
      sourceId,
      actionCode,
      operatorName: 'Web 端裁床操作员',
      operatedAt: '2026-04-28 10:00',
      remark: '裁片 Web 端状态操作，菲票归属仍回落裁片单',
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
  return buildCutOrdersProjection()
}

function getMarkerPlanSourceLedger(): MarkerPlanSourceRecord[] {
  return getProjection().sources.markerPlanSources
}

function getViewModel() {
  return getProjection().viewModel
}

function parsePrefilterFromPath(): CutOrderPrefilter | null {
  const params = getCurrentSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const nextPrefilter: CutOrderPrefilter = {}

  const productionOrderId = drillContext?.productionOrderId || params.get('productionOrderId') || ''
  const productionOrderNo = drillContext?.productionOrderNo || params.get('productionOrderNo') || ''
  const cutOrderId = drillContext?.cutOrderId || params.get('cutOrderId') || ''
  const cutOrderNo = drillContext?.cutOrderNo || params.get('cutOrderNo') || ''
  const markerPlanId = drillContext?.markerPlanId || params.get('markerPlanId') || ''
  const markerPlanNo = drillContext?.markerPlanNo || params.get('markerPlanNo') || ''
  const styleCode = drillContext?.styleCode || params.get('styleCode') || ''
  const spuCode = drillContext?.spuCode || params.get('spuCode') || ''
  const materialSku = drillContext?.materialSku || params.get('materialSku') || ''

  if (productionOrderId) nextPrefilter.productionOrderId = productionOrderId
  if (productionOrderNo) nextPrefilter.productionOrderNo = productionOrderNo
  if (cutOrderId) nextPrefilter.cutOrderId = cutOrderId
  if (cutOrderNo) nextPrefilter.cutOrderNo = cutOrderNo
  if (markerPlanId) nextPrefilter.markerPlanId = markerPlanId
  if (markerPlanNo) nextPrefilter.markerPlanNo = markerPlanNo
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

  const matched = findCutOrderByPrefilter(viewModel.rows, state.prefilter)
  state.activeOrderId = matched?.id ?? null
}

function getDisplayRows(viewModel = getViewModel()): CutOrderRow[] {
  const sourceRows = state.prefilter
    ? viewModel.rows
    : viewModel.rows.filter((row) => cutOrderDemoScenarioNos.has(row.cutOrderNo))
  return filterCutOrderRows(sourceRows.length ? sourceRows : viewModel.rows, state.filters, state.prefilter)
}

function getActiveRow(viewModel = getViewModel()): CutOrderRow | null {
  if (!state.activeOrderId) return null
  return viewModel.rowsById[state.activeOrderId] ?? null
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderInfoCard(label: string, value: string): string {
  return `
    <div class="rounded-lg border bg-muted/20 p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-medium leading-5 text-foreground">${escapeHtml(value || '—')}</div>
    </div>
  `
}

function formatDate(value: string): string {
  return value || '待补'
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatMaterialLedgerQty(value: number, unit = '米'): string {
  return `${formatCount(Math.round(value * 10) / 10)} ${unit}`
}

function renderMaterialLedgerGrid(row: CutOrderRow): string {
  const ledger = row.materialQuantityLedger
  const items = [
    ['需求用量', ledger.requiredMaterialQty],
    ['中转仓已配数量', ledger.transferWarehouseAllocatedQty],
    ['裁床已领数量', ledger.cuttingClaimedQty],
    ['已消耗数量', ledger.spreadingConsumedQty],
    ['可用余额', ledger.availableQty],
  ] as const
  return `
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          ([label, value]) => `
            <div class="rounded-md border bg-muted/10 px-3 py-2">
              <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
              <div class="mt-1 text-sm font-semibold tabular-nums text-foreground">${escapeHtml(formatMaterialLedgerQty(value, ledger.unit))}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function isCutOrderInExecutionStage(row: CutOrderRow): boolean {
  return row.currentStage.key === 'STARTED' && !row.closeReason
}

function resolveReopenedCutOrderStage(row: CutOrderRow): string {
  if (
    row.materialClaimStatus.key === 'RECEIVED' ||
    row.claimedQty > 0 ||
    row.consumedQty > 0 ||
    row.batchParticipationCount > 0 ||
    row.activeMarkerPlanNo ||
    row.latestMarkerPlanNo
  ) {
    return '已开工'
  }
  return '待中转仓配料'
}

function buildCutOrderReopenRecord(row: CutOrderRow, reopenedAt: string): CutOrderReopenRecord {
  return {
    reopenRecordId: `reopen-${row.cutOrderId}`,
    reopenRecordNo: `REOPEN-${row.cutOrderNo.replace(/^CUT-/, '')}`,
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    reopenedAt,
    reopenedBy: '裁床主管 何倩',
    reopenReason: '业务需要继续针对裁片单补料或铺布执行。',
    previousCloseRecordNo: row.closeRecord?.closeRecordNo || '',
    createdAt: reopenedAt,
    createdBy: '裁床主管 何倩',
  }
}

function getCutOrderCloseAuditRecords(row: CutOrderRow): CutOrderCloseRecord[] {
  return listCutOrderCloseRecords()
    .filter((record) => record.cutOrderId === row.cutOrderId || record.cutOrderNo === row.cutOrderNo)
    .sort((left, right) => (right.closedAt || right.createdAt).localeCompare(left.closedAt || left.createdAt, 'zh-CN'))
}

function getCutOrderReopenAuditRecords(row: CutOrderRow): CutOrderReopenRecord[] {
  return listStoredCutOrderReopenRecords()
    .filter((record) => record.cutOrderId === row.cutOrderId || record.cutOrderNo === row.cutOrderNo)
    .sort((left, right) => (right.reopenedAt || right.createdAt).localeCompare(left.reopenedAt || left.createdAt, 'zh-CN'))
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

function buildPrintableUnitSummaryByCutOrder(rows: CutOrderRow[]) {
  const projection = getProjection()
  const printableView = buildPrintableUnitViewModel({
    cutOrderRows: rows,
    materialPrepRows: projection.sources.materialPrepRows,
    markerPlanSources: projection.sources.markerPlanSources,
    markerStore: projection.sources.markerStore,
    ticketRecords: projection.sources.feiViewModel.ticketRecords,
    printJobs: projection.sources.feiViewModel.printJobs,
    prefilter: null,
  })
  return Object.fromEntries(printableView.units.map((unit) => [unit.cutOrderId, unit]))
}

function buildCutOrderQrSummary(row: CutOrderRow): {
  latestTicketNo: string
  schemaVersion: string
  ownerType: string
  qrBaseValue: string
  sourceContextText: string
  reservedProcessText: string
  schemaText: string
} {
  const latestRecord =
    getFeiTicketRecords()
      .filter((record) => record.cutOrderId === row.cutOrderId || record.cutOrderNo === row.cutOrderNo)
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
      ownerType: '裁片单',
      qrBaseValue: `QR-${row.cutOrderNo}`,
      sourceContextText: row.latestMarkerPlanNo ? `最近来自唛架方案 ${row.latestMarkerPlanNo}` : '裁片单上下文',
      reservedProcessText: '已预留 4 类工艺扩展槽位',
      schemaText: '当前尚无历史票据记录，裁片单主码按 1.0.0 结构生成。',
    }
  }

  const payload = buildFeiQrPayload({
    ticketRecord: latestRecord,
    owner: {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      color: row.color,
      materialSku: row.materialSku,
      sameCodeValue: row.cutOrderNo,
      qrBaseValue: latestRecord.sourceQrBaseValue || `QR-${row.cutOrderNo}`,
    },
  })
  const summary = buildFeiQrPayloadSummary(payload)
  const schema = buildFeiQrSchemaMeta(latestRecord)

  return {
    latestTicketNo: latestRecord.ticketNo,
    schemaVersion: summary.schemaVersion,
    ownerType: summary.ownerType === 'cut-order' ? '裁片单' : summary.ownerType,
    qrBaseValue: summary.qrBaseValue,
    sourceContextText: summary.sourceContextType === 'marker-plan' ? `来源唛架方案 ${latestRecord.sourceMarkerPlanNo || '待补唛架方案号'}` : '裁片单上下文',
    reservedProcessText: summary.hasReservedProcess ? '已预留 4 类工艺扩展槽位' : '待补',
    schemaText: schema.schemaNote.replaceAll('二维码', '裁片单主码'),
  }
}

function buildStatsCards(rows: CutOrderRow[]): string {
  const stats = buildCutOrderStats(rows)
  return renderCompactKpiGroup(`
      ${renderCompactKpiCard('裁片单总数', stats.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('唛架方案占用数', stats.inBatchCount, '草稿或有效唛架方案占用记录', 'text-violet-600')}
      ${renderCompactKpiCard('有可用余额数', stats.availableBalanceCount, '裁床可用面料余额大于 0', 'text-blue-600')}
      ${renderCompactKpiCard('已关闭数', stats.closedCount, '已填写关闭原因', 'text-zinc-600')}
      ${renderCompactKpiCard('未产生领料记录数', stats.noClaimRecordCount, '裁床尚未形成领料数量账', 'text-amber-600')}
  `)
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

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.productionOrderNo) labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`)
  if (prefilter.cutOrderNo) labels.push(`预筛：裁片单 ${prefilter.cutOrderNo}`)
  if (prefilter.markerPlanNo) labels.push(`预筛：唛架方案 ${prefilter.markerPlanNo}`)
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
  if (state.filters.currentStage !== 'ALL') labels.push(`裁片单主状态：${cutOrderStageMeta[state.filters.currentStage].label}`)
  if (state.filters.inBatch === 'IN_MARKER_PLAN') labels.push('仅看有唛架方案占用')
  if (state.filters.inBatch === 'NOT_IN_MARKER_PLAN') labels.push('仅看无唛架方案占用')
  if (state.filters.hasAvailableBalance === 'YES') labels.push('可用余额：大于 0')
  if (state.filters.hasAvailableBalance === 'NO') labels.push('可用余额：等于 0')
  if (state.filters.hasCloseReason === 'YES') labels.push('关闭原因：已填写')
  if (state.filters.hasCloseReason === 'NO') labels.push('关闭原因：未填写')
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
              placeholder="搜索裁片单号 / 生产单号 / 款号 / 面料 SKU"
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
        ${renderFilterSelect('裁片单主状态', 'currentStage', state.filters.currentStage, [
          { value: 'ALL', label: '全部状态' },
          ...Object.entries(cutOrderStageMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        ${renderFilterSelect('唛架方案占用', 'inBatch', state.filters.inBatch, [
          { value: 'ALL', label: '全部' },
          { value: 'IN_MARKER_PLAN', label: '有占用关系' },
          { value: 'NOT_IN_MARKER_PLAN', label: '无占用关系' },
        ])}
        ${renderFilterSelect('是否有可用余额', 'hasAvailableBalance', state.filters.hasAvailableBalance, [
          { value: 'ALL', label: '全部' },
          { value: 'YES', label: '可用余额大于 0' },
          { value: 'NO', label: '可用余额等于 0' },
        ])}
        ${renderFilterSelect('是否有关闭原因', 'hasCloseReason', state.filters.hasCloseReason, [
          { value: 'ALL', label: '全部' },
          { value: 'YES', label: '已填写关闭原因' },
          { value: 'NO', label: '未填写关闭原因' },
        ])}
      </div>
    </div>
  `)
}

function renderRiskTags(tags: CutOrderRow['riskTags']): string {
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

function renderBatchSummary(row: CutOrderRow): string {
  if (!row.batchParticipationCount) {
    return '<span class="text-xs text-muted-foreground">未关联唛架方案</span>'
  }

  return `
    <div class="space-y-1">
      <button type="button" class="text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">
        ${escapeHtml(row.latestMarkerPlanNo || row.markerPlanNos[0] || '查看唛架方案')}
      </button>
      <p class="text-xs text-muted-foreground">共参与 ${escapeHtml(String(row.batchParticipationCount))} 个唛架方案</p>
    </div>
  `
}

function renderProductionStyleCell(row: CutOrderRow): string {
  return `
    <div class="space-y-1">
      <div class="cursor-pointer hover:text-blue-600" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">
        ${renderProductionOrderIdentityCell(row.productionOrderNo)}
      </div>
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || '待补')}</div>
      <p class="text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '款式待补')}</p>
      <span class="${row.urgencyClassName} inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium">${escapeHtml(row.urgencyLabel)}</span>
    </div>
  `
}

function renderMaterialCell(row: CutOrderRow): string {
  return `
    <div class="max-w-[34rem] space-y-2">
      ${renderMaterialIdentityBlock(row, { compact: true })}
    </div>
  `
}

function renderPatternCell(row: CutOrderRow): string {
  return `
    <div class="space-y-1.5 text-xs">
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.patternFileName || '待补纸样文件')}</div>
      <div class="text-muted-foreground">版本：${escapeHtml(row.patternVersion || '待补')}</div>
      <div class="text-muted-foreground">类型：${escapeHtml(row.patternKind || '待补')}</div>
      <div class="text-muted-foreground">有效幅宽：<span class="font-medium text-foreground">${escapeHtml(row.effectiveWidthText || '待补')}</span></div>
      <div class="line-clamp-2 text-muted-foreground" title="${escapeHtml(row.piecePartNames.join('、'))}">
        部位：${escapeHtml(row.piecePartNames.length ? row.piecePartNames.join('、') : '待补')}
      </div>
    </div>
  `
}

function renderQuantityCell(row: CutOrderRow): string {
  const ledger = row.materialQuantityLedger
  return `
    <div class="space-y-1.5 text-xs">
      <div class="text-sm font-medium text-foreground">${escapeHtml(row.pieceCountText)} 件</div>
      <div class="text-muted-foreground">需求成衣件数</div>
      <div class="pt-1 leading-5 text-muted-foreground">
        <div>需求用量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.requiredMaterialQty, ledger.unit))}</span></div>
        <div>中转仓已配数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.transferWarehouseAllocatedQty, ledger.unit))}</span></div>
        <div>裁床已领数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.cuttingClaimedQty, ledger.unit))}</span></div>
        <div>已消耗数量：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.spreadingConsumedQty, ledger.unit))}</span></div>
        <div>可用余额：<span class="font-medium text-foreground">${escapeHtml(formatMaterialLedgerQty(ledger.availableQty, ledger.unit))}</span></div>
      </div>
    </div>
  `
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function syncCloseDraftFromPath(): void {
  const pathname = appStore.getState().pathname
  if (state.closeDraft.querySignature === pathname) return
  const params = getCurrentSearchParams()
  const reasonCode = params.get('closeReasonCode') as CutOrderCloseReasonCode | null
  state.closeDraft.querySignature = pathname
  state.closeDraft.closeReasonCode = cutOrderCloseReasonOptions.some((option) => option.value === reasonCode)
    ? reasonCode as CutOrderCloseReasonCode
    : 'BUSINESS_STOP_RECUT'
  state.closeDraft.closeDescription = params.get('closeDescription') || ''
  state.closeDraft.closedBy = '裁床主管 何倩'
  state.closeDraft.feedback = null
}

function findClosePageRow(viewModel = getViewModel()): CutOrderRow | null {
  const params = getCurrentSearchParams()
  const cutOrderId = params.get('cutOrderId') || ''
  const cutOrderNo = params.get('cutOrderNo') || ''
  if (cutOrderId) return viewModel.rows.find((row) => row.cutOrderId === cutOrderId || row.id === cutOrderId) ?? null
  if (cutOrderNo) return viewModel.rows.find((row) => row.cutOrderNo === cutOrderNo) ?? null
  return null
}

function renderCloseFeedbackBar(): string {
  const feedback = state.closeDraft.feedback
  if (!feedback) return ''
  const className =
    feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<section class="rounded-lg border px-4 py-3 text-sm ${className}">${escapeHtml(feedback.message)}</section>`
}

function buildCloseImpactContext(row: CutOrderRow): {
  ledgerSnapshot: NonNullable<CutOrderCloseRecord['ledgerSnapshotBeforeClose']>
  impactItems: CutOrderCloseImpactItem[]
  inventorySummary: string
  pendingSpecialCraftSummary: string
  pendingHandoverSummary: string
  markerSpreadingSummary: string
  feiTicketSummary: string
  differenceSummary: string
} {
  const projection = getProjection()
  const sources = projection.sources
  const ledgerSnapshot = buildCutOrderLedgerSnapshotBeforeClose(row.materialQuantityLedger)
  const warehouseItems = sources.cutPieceWarehouseView.items.filter(
    (item) => item.cutOrderId === row.cutOrderId || item.cutOrderNo === row.cutOrderNo,
  )
  const inventoryQty = warehouseItems.reduce((sum, item) => sum + Number(item.pieceQty || item.quantity || 0), 0)
  const inventorySummary = inventoryQty > 0 ? `${formatCount(inventoryQty)} 片 / ${formatCount(warehouseItems.length)} 条库存` : ''
  const openHandoverItems = warehouseItems.filter((item) => !/已交出|已关闭|已取消/.test(item.handoffStatus?.label || ''))
  const pendingHandoverSummary = openHandoverItems.length ? `${openHandoverItems.length} 条` : ''
  const differenceRows = listSpreadingDifferences({ sessions: sources.markerStore.sessions }).filter(
    (item) => item.cutOrderIds.includes(row.cutOrderId) || item.cutOrderNos.includes(row.cutOrderNo),
  )
  const pendingDifferenceCount = differenceRows.filter((item) => item.handlingStatus !== '已处理' && item.handlingStatus !== '仅记录').length
  const specialProcessRows = sources.specialProcessView.rows.filter(
    (item) => item.cutOrderIds.includes(row.cutOrderId) || item.cutOrderNos.includes(row.cutOrderNo),
  )
  const pendingSpecialCraftCount = specialProcessRows.filter((item) => !/已回仓|已关闭|已取消/.test(item.statusMeta?.label || '')).length
  const pendingSpecialCraftSummary = pendingSpecialCraftCount ? `${pendingSpecialCraftCount} 单未回仓` : ''
  const markerSpreadingCounts = buildMarkerSpreadingCountsByCutOrder(row.cutOrderId)
  const feiTicketCount = sources.feiViewModel.ticketRecords.filter(
    (ticket) => ticket.cutOrderId === row.cutOrderId || ticket.cutOrderNo === row.cutOrderNo,
  ).length

  return {
    ledgerSnapshot,
    impactItems: buildCutOrderCloseImpactItems({
      ledgerSnapshot,
      pendingDifferenceCount,
      inventorySummary,
      pendingSpecialCraftSummary,
      pendingHandoverSummary,
    }),
    inventorySummary: inventorySummary || '0 片',
    pendingSpecialCraftSummary: pendingSpecialCraftSummary || '0 片',
    pendingHandoverSummary: pendingHandoverSummary || '0 条',
    markerSpreadingSummary: `${markerSpreadingCounts.markerCount} 个唛架方案 / ${markerSpreadingCounts.sessionCount} 张铺布单 / 实际裁剪 ${markerSpreadingCounts.statusSummary}`,
    feiTicketSummary: `${formatCount(feiTicketCount)} 张菲票`,
    differenceSummary: `${formatCount(pendingDifferenceCount)} 项待处理 / ${formatCount(differenceRows.length)} 项总记录`,
  }
}

function renderCloseLedgerSnapshot(snapshot: NonNullable<CutOrderCloseRecord['ledgerSnapshotBeforeClose']>): string {
  const rows = [
    ['需求用量', snapshot.requiredMaterialQty],
    ['中转仓已配数量', snapshot.transferWarehouseAllocatedQty],
    ['裁床已领数量', snapshot.cuttingClaimedQty],
    ['已消耗数量', snapshot.spreadingConsumedQty],
    ['可用余额', snapshot.availableQty],
  ] as const
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${rows
        .map(
          ([label, value]) => `
            <div class="rounded-lg border bg-muted/20 p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
              <div class="mt-1 text-base font-semibold tabular-nums">${escapeHtml(formatCutOrderCloseLedgerQty(value, snapshot.unit))}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderCloseImpactItems(items: CutOrderCloseImpactItem[]): string {
  const classMap: Record<CutOrderCloseImpactItem['severity'], string> = {
    info: 'border-slate-200 bg-slate-50 text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    critical: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-lg border p-3 ${classMap[item.severity]}">
              <div class="text-xs">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-base font-semibold">${escapeHtml(item.value)}</div>
              <p class="mt-2 text-xs leading-5">${escapeHtml(item.detailText)}</p>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderCutOrderClosePage(): string {
  syncCloseDraftFromPath()
  const viewModel = getViewModel()
  const row = findClosePageRow(viewModel)
  const meta = getCanonicalCuttingMeta(getCanonicalCuttingPath('cut-order-close'), 'cut-order-close')
  if (!row) {
    return `
      <div class="space-y-4 p-4" data-testid="cut-order-close-page">
        ${renderCuttingPageHeader(meta)}
        <section class="rounded-lg border bg-card p-6 text-sm text-muted-foreground">未找到要关闭的裁片单，请返回裁片单页面重新选择。</section>
      </div>
    `
  }

  const params = getCurrentSearchParams()
  const sourceDifferenceId = params.get('sourceDifferenceId') || ''
  const impactContext = buildCloseImpactContext(row)
  const alreadyClosed = row.currentStage.key === 'CLOSED'
  const closeRecord = row.closeRecord
  const sourceText = sourceDifferenceId ? `差异确认 ${sourceDifferenceId}` : '人工关闭'

  return `
    <div class="space-y-4 p-4" data-testid="cut-order-close-page">
      ${renderCuttingPageHeader(meta)}
      ${renderCloseFeedbackBar()}

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">关闭裁片单：${escapeHtml(row.cutOrderNo)}</h2>
            <p class="mt-1 text-sm text-muted-foreground">关闭后不再要求继续配料或领料；历史记录保留追溯。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), { cutOrderId: row.cutOrderId, cutOrderNo: row.cutOrderNo }))}">返回裁片单</button>
          </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderInfoCard('裁片单', row.cutOrderNo)}
          ${renderInfoCard('来源生产单', row.productionOrderNo)}
          ${renderInfoCard('当前主状态', row.currentStage.label)}
          ${renderInfoCard('关闭来源', sourceText)}
        </div>
      </section>

      ${
        alreadyClosed
          ? `
            <section class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="text-sm font-semibold text-zinc-800">该裁片单已经关闭，不能重复关闭。</div>
                <button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100" data-cutting-piece-action="reopen-cut-order" data-record-id="${escapeHtml(row.id)}">重新打开裁片单</button>
              </div>
              <div class="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                ${renderInfoCard('关闭原因', closeRecord?.closeReasonText || row.closeReasonText || row.closeReason || '已关闭')}
                ${renderInfoCard('关闭时间', closeRecord?.closedAt || row.closedAt || '已记录')}
                ${renderInfoCard('关闭人', closeRecord?.closedBy || row.closedBy || '已记录')}
                ${renderInfoCard('关闭记录', closeRecord?.closeRecordNo || '历史记录')}
              </div>
            </section>
          `
          : `
            <section class="rounded-lg border bg-card p-4">
              <h3 class="text-sm font-semibold">关闭信息</h3>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-sm font-medium">关闭原因</span>
                  <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-piece-close-field="closeReasonCode">
                    ${cutOrderCloseReasonOptions
                      .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === state.closeDraft.closeReasonCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
                      .join('')}
                  </select>
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium">关闭人</span>
                  <input class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${escapeHtml(state.closeDraft.closedBy)}" data-cutting-piece-close-field="closedBy" />
                </label>
                <label class="space-y-2 md:col-span-2">
                  <span class="text-sm font-medium">关闭说明</span>
                  <textarea class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="说明为什么不再继续排唛架、继续裁剪或等待面料" data-cutting-piece-close-field="closeDescription">${escapeHtml(state.closeDraft.closeDescription)}</textarea>
                </label>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700" data-cutting-piece-action="submit-close-cut-order" data-record-id="${escapeHtml(row.id)}" data-source-difference-id="${escapeHtml(sourceDifferenceId)}">确认关闭裁片单</button>
                <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), { cutOrderId: row.cutOrderId, cutOrderNo: row.cutOrderNo }))}">取消</button>
              </div>
            </section>
          `
      }

      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">关闭前数量账</h3>
        <div class="mt-3">${renderCloseLedgerSnapshot(impactContext.ledgerSnapshot)}</div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">关闭前影响项</h3>
        <p class="mt-1 text-xs text-muted-foreground">以下内容只做关闭前提示，不作为禁止关闭条件；关闭后仍保留历史追溯。</p>
        <div class="mt-3">${renderCloseImpactItems(impactContext.impactItems)}</div>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold">历史执行记录仍保留</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderInfoCard('唛架 / 铺布', impactContext.markerSpreadingSummary)}
          ${renderInfoCard('菲票', impactContext.feiTicketSummary)}
          ${renderInfoCard('库存与交出', `${impactContext.inventorySummary}；未关闭交出记录 ${impactContext.pendingHandoverSummary}`)}
          ${renderInfoCard('差异 / 特殊工艺', `${impactContext.differenceSummary}；特殊工艺 ${impactContext.pendingSpecialCraftSummary}`)}
        </div>
      </section>
    </div>
  `
}

function renderStatusCell(row: CutOrderRow): string {
  const markerPlanSource = row.activeMarkerPlanNo || row.latestMarkerPlanNo
  return `
    <div class="space-y-2">
      <div class="space-y-1">
        <div class="text-xs text-muted-foreground">裁片单主状态</div>
        ${renderBadge(row.currentStageLabel, row.currentStage.className)}
        ${row.closeReason ? `<p class="text-xs leading-5 text-muted-foreground">关闭原因：${escapeHtml(row.closeReasonText || row.closeReason)}</p>` : ''}
      </div>
      <div class="space-y-1 text-xs text-muted-foreground">
        ${markerPlanSource ? `<p>当前唛架方案：${escapeHtml(markerPlanSource)}</p>` : ''}
      </div>
      ${renderBatchSummary(row)}
    </div>
  `
}

function renderEmptyTableState(): string {
  return `
    <tr>
      <td colspan="9" class="px-4 py-16 text-center text-sm text-muted-foreground">
        当前条件下暂无裁片单，请调整筛选条件或清除预筛后重试。
      </td>
    </tr>
  `
}

function renderTable(rows: CutOrderRow[]): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)

  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-cut-orders-main-table">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">裁片单</h2>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条裁片单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1260px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">裁片单</th>
                <th class="px-4 py-3 text-left font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE} / 款式</th>
                <th class="px-4 py-3 text-left font-medium">面料</th>
                <th class="px-4 py-3 text-left font-medium">纸样</th>
                <th class="px-4 py-3 text-left font-medium">数量账</th>
                <th class="px-4 py-3 text-left font-medium">日期</th>
                <th class="px-4 py-3 text-left font-medium">主状态 / 判断</th>
                <th class="px-4 py-3 text-left font-medium">风险</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${
                pagination.items.length
                  ? pagination.items
                      .map((row) => {
                        const highlighted = state.activeOrderId === row.id
                        const canEnterExecution = isCutOrderInExecutionStage(row)
                        const canEnterFeiTickets = isPrintableSourceRow(row)
                        return `
                          <tr class="${highlighted ? 'bg-blue-50/60' : 'hover:bg-muted/20'}">
                            <td class="px-4 py-3 align-top">
                              ${renderProductionObjectCodeButton({
                                objectType: 'CUT_ORDER',
                                objectId: row.cutOrderNo,
                                label: row.cutOrderNo,
                                relatedProductionOrderNo: row.productionOrderNo,
                                defaultTab: 'progress',
                                highlightKey: `CUT_ORDER:${row.cutOrderNo}`,
                                className: 'font-mono text-blue-600 hover:underline',
                              })}
                              <button type="button" class="ml-2 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted" data-nav="${escapeHtml(buildCutOrderDetailPath(row.id))}">详情</button>
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.relationSummary)}</p>
                              <p class="mt-1 text-xs text-muted-foreground">裁片任务：${escapeHtml(row.cuttingTaskNo || '待补')}</p>
                              <p class="mt-1 text-xs text-muted-foreground">执行去向：${escapeHtml(row.executionRouteLabel || '待分配承接方')}</p>
                            </td>
                            <td class="px-4 py-3 align-top">${renderProductionStyleCell(row)}</td>
                            <td class="px-4 py-3 align-top">
                              <div class="max-w-[34rem]">
                                ${renderMaterialCell(row)}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">${renderPatternCell(row)}</td>
                            <td class="px-4 py-3 align-top">${renderQuantityCell(row)}</td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                ${row.dateInfoLines
                                  .map((line) => `<p>${escapeHtml(line.label)}：${escapeHtml(line.value)}</p>`)
                                  .join('')}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderStatusCell(row)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1">
                                ${renderRiskTags(row.riskTags)}
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-nav="${escapeHtml(buildCutOrderDetailPath(row.id))}">查看详情</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
                                ${canEnterExecution ? `<button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
                                ${
                                  row.currentStage.key !== 'CLOSED'
                                    ? `<button type="button" class="text-xs text-zinc-700 hover:underline" data-cutting-piece-action="go-close-cut-order" data-record-id="${escapeHtml(row.id)}">关闭裁片单</button>`
                                    : `
                                      <button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100" data-cutting-piece-action="reopen-cut-order" data-record-id="${escapeHtml(row.id)}">重新打开</button>
                                      <button type="button" class="text-xs text-zinc-600 hover:underline" data-cutting-piece-action="go-close-cut-order" data-record-id="${escapeHtml(row.id)}">查看关闭记录</button>
                                    `
                                }
                                ${canEnterFeiTickets ? `<button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
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
    <div class="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <div class="min-w-0 border-b pb-2">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 break-words ${item.tone === 'strong' ? 'text-base font-semibold' : 'text-sm'}">${escapeHtml(item.value || '待补')}</p>
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderDetailSection(title: string, body: string): string {
  return `
    <section class="border-b px-4 py-4 last:border-b-0">
      <h3 class="mb-3 text-sm font-semibold">${escapeHtml(title)}</h3>
      <div>
        ${body}
      </div>
    </section>
  `
}

function getSampleItemsForCutOrder(row: CutOrderRow): SampleWarehouseItem[] {
  return buildSampleWarehouseProjection().viewModel.items.filter(
    (item) =>
      item.relatedCutOrderId === row.cutOrderId ||
      item.relatedCutOrderNo === row.cutOrderNo ||
      (item.relatedProductionOrderNo === row.productionOrderNo && item.styleCode === row.styleCode),
  )
}

function renderCutOrderSampleSection(row: CutOrderRow): string {
  const sampleItems = getSampleItemsForCutOrder(row)
  const sampleWarehousePath = (item: SampleWarehouseItem) =>
    buildRouteWithQuery(getCanonicalCuttingPath('sample-warehouse'), {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      sampleNo: item.sampleNo,
    })

  return renderDetailSection(
    '关联样衣',
    `
      <div class="space-y-3">
        <div class="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          样衣用于裁床裁剪前核对版型、部位、尺寸和拼接关系；样衣状态不改变裁片单主状态。
        </div>
        ${
          sampleItems.length
            ? `<div class="grid gap-3 md:grid-cols-2">
                ${sampleItems
                  .map(
                    (item) => `
                      <div class="rounded-lg border bg-background p-3">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div class="font-medium text-blue-700">${escapeHtml(item.sampleNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml([item.sampleName, item.sampleVersion].filter(Boolean).join(' / '))}</div>
                          </div>
                          ${renderBadge(item.currentStatus, item.status.className)}
                        </div>
                        <div class="mt-3 grid gap-2 text-xs text-muted-foreground">
                          <div>用途：${escapeHtml(item.currentUsageType)}</div>
                          <div>位置：${escapeHtml(item.currentLocation)} / ${escapeHtml(item.currentHolder)}</div>
                          <div>预计归还：${escapeHtml(item.expectedReturnAt || '按现场使用结束')}</div>
                          <div>异常：${escapeHtml(item.abnormalItems.map((abnormal) => abnormal.abnormalType).join('、') || '无')}</div>
                        </div>
                        <button type="button" class="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(sampleWarehousePath(item))}">查看样衣详情</button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>`
            : '<div class="rounded-lg border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground">当前裁片单暂无关联样衣。</div>'
        }
      </div>
    `,
  )
}

function renderCuttingWebActions(row: CutOrderRow, actions: ProcessWebAction[]): string {
  const actionable = actions.filter((action) => !action.disabledReason)
  const disabledReason = actions.find((action) => action.disabledReason)?.disabledReason
  const actionHref = (actionCode: string) =>
    buildRouteWithQuery(getCanonicalCuttingPath('cut-orders'), {
      cutOrderId: row.cutOrderId,
      webAction: actionCode,
    })
  return renderDetailSection(
    '可执行动作',
    `
      <div class="space-y-3">
        ${renderInfoGrid([
              { label: '裁片单主状态', value: row.currentStage.label, tone: 'strong' },
              ...(row.closeReason ? [{ label: '关闭原因', value: row.closeReason }] : []),
              ...(row.closedAt ? [{ label: '关闭时间', value: row.closedAt }] : []),
          { label: '操作方式', value: '按当前状态开放' },
          { label: '菲票归属口径', value: '菲票归属裁片单，唛架方案只作为执行上下文' },
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

function renderCutOrderDetailPanel(row: CutOrderRow, viewModel = getViewModel()): string {
  const qrSummary = buildCutOrderQrSummary(row)
  const markerSpreadingCounts = buildMarkerSpreadingCountsByCutOrder(row.cutOrderId)
  const latestClaimDispute = getLatestClaimDisputeByCutOrderNo(row.cutOrderNo)
  const printableUnit = buildPrintableUnitSummaryByCutOrder(viewModel.rows)[row.cutOrderId] || null
  const printableStatusMeta = printableUnit ? getPrintableUnitStatusMeta(printableUnit.printableUnitStatus) : null
  const canEnterExecution = isCutOrderInExecutionStage(row)
  const canEnterFeiTickets = isPrintableSourceRow(row)
  const mobileBinding = validateCuttingOrderMobileTaskBinding(row.cutOrderId)
  const webActions = getAvailableCuttingWebActions(row.cutOrderId)
  const webOperationRecords = getProcessWebOperationRecordsBySource('CUTTING_ORDER', row.cutOrderId)
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
            keyword: row.cutOrderNo,
          }),
          sourceType: 'CUTTING_ORDER',
          sourceId: row.cutOrderId || row.cutOrderNo,
          currentFactoryId: row.assignedFactoryId || TEST_FACTORY_ID,
          keyword: row.cutOrderNo,
        })
      : ''

  const siblingRows = viewModel.rows.filter(
    (item) => item.productionOrderId === row.productionOrderId && item.cutOrderId !== row.cutOrderId,
  )

  const batchParticipationText = row.batchParticipationCount
    ? `已参与 ${row.batchParticipationCount} 个唛架方案，最新唛架方案 ${row.latestMarkerPlanNo || '待补'}。`
    : '当前尚未进入任何唛架方案。'

  const extraButtons = `
    <div class="flex flex-wrap items-center gap-2">
      ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布</button>` : ''}
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-task-route-card" data-record-id="${escapeHtml(row.id)}">打印任务流转卡</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="print-cutting-order-qr" data-record-id="${escapeHtml(row.id)}">打印裁片单二维码</button>
      ${canEnterFeiTickets ? `<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
      ${row.currentStage.key === 'CLOSED' ? `<button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100" data-cutting-piece-action="reopen-cut-order" data-record-id="${escapeHtml(row.id)}">重新打开</button>` : ''}
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-close-cut-order" data-record-id="${escapeHtml(row.id)}">${row.currentStage.key === 'CLOSED' ? '查看关闭记录' : '关闭裁片单'}</button>
    </div>
  `

  const content = `
    <div class="space-y-4">
      ${renderDetailSection(
        '基础身份信息',
        `
          <div class="space-y-3">
            <div class="rounded-lg border bg-muted/20 p-3">
              ${renderMaterialIdentityBlock(
                {
                  materialSku: row.materialSku,
                  materialName: row.materialName,
                  materialLabel: row.materialLabel,
                  materialCategory: row.materialCategory,
                  materialColor: row.materialColor,
                  materialAlias: row.materialAlias,
                  materialImageUrl: row.materialImageUrl,
                  materialUnit: row.materialUnit,
                },
                { imageSizeClass: 'h-14 w-14' },
              )}
            </div>
            ${renderInfoGrid([
              { label: '裁片单号', value: row.cutOrderNo, tone: 'strong' },
              { label: '来源生产单号', value: row.productionOrderNo },
              { label: '款号 / SPU', value: `${row.styleCode || row.spuCode} / ${row.styleName || row.spuCode}` },
              { label: '面料颜色', value: row.materialColor || row.color },
              { label: '纸样文件', value: row.patternFileName },
              { label: '纸样版本', value: row.patternVersion },
              { label: '有效幅宽', value: row.effectiveWidthText },
              { label: '部位集合', value: row.piecePartNames.join('、') },
              { label: '需求成衣件数（件）', value: `${formatCount(row.orderQty)} 件` },
              { label: '计划裁片数量（片）', value: `${formatCount(row.orderQty)} 片` },
              { label: '采购日期', value: formatDate(row.purchaseDate) },
              { label: '实际下单日期', value: formatDate(row.actualOrderDate) },
              { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
              { label: '工厂', value: formatFactoryDisplayName(row.assignedFactoryName, TEST_FACTORY_ID) },
              { label: '卖价', value: formatCutOrderCurrency(row.sellingPrice) },
              { label: '最近执行痕迹', value: row.latestActionText },
            ])}
          </div>
        `,
      )}

      ${renderCutOrderSampleSection(row)}

      ${renderDetailSection(
        '主状态与唛架关系',
        `
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <span class="w-full text-xs text-muted-foreground">裁片单主状态</span>
              ${renderBadge(row.currentStage.label, row.currentStage.className)}
            </div>
            ${row.closeReason ? `<p class="text-sm"><span class="text-muted-foreground">关闭原因：</span>${escapeHtml(row.closeReasonText || row.closeReason)}</p>` : ''}
            ${row.closedAt ? `<p class="text-sm"><span class="text-muted-foreground">关闭时间：</span>${escapeHtml(row.closedAt)}</p>` : ''}
            ${row.closedBy ? `<p class="text-sm"><span class="text-muted-foreground">关闭人：</span>${escapeHtml(row.closedBy)}</p>` : ''}
            <div class="space-y-2 text-sm">
              <p><span class="text-muted-foreground">当前唛架方案：</span>${escapeHtml(row.activeMarkerPlanNo || row.latestMarkerPlanNo || '无')}</p>
              <div class="flex flex-wrap items-center gap-1">
                <span class="text-muted-foreground">风险：</span>
                ${
                  row.riskTags.length
                    ? row.riskTags.map((tag) => renderBadge(tag.label, tag.className)).join('')
                    : '<span class="text-muted-foreground">无</span>'
                }
              </div>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '面料数量账',
        renderMaterialLedgerGrid(row),
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
        '唛架方案参与记录',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '最新唛架方案号', value: row.latestMarkerPlanNo || '未关联唛架方案' },
              { label: '参与唛架方案数', value: `${row.batchParticipationCount} 次` },
              { label: '当前占用状态', value: row.activeMarkerPlanNo ? `已占用（${row.activeMarkerPlanNo}）` : '未占用' },
            ])}
            ${
              row.markerPlanNos.length
                ? `
                  <div class="flex flex-wrap gap-2">
                    ${row.markerPlanNos.map((batchNo) => renderBadge(batchNo, 'bg-violet-100 text-violet-700 border border-violet-200')).join('')}
                  </div>
                `
                : ''
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">
                查看唛架方案
              </button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-same-production-orders" data-record-id="${escapeHtml(row.id)}">
                查看同生产单下其他裁片单${siblingRows.length ? `（${siblingRows.length}）` : ''}
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
            <div class="flex flex-wrap gap-2">
              ${
                canEnterFeiTickets
                  ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>`
                  : '<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前未完成领料 / 铺布，不生成菲票主码</span>'
              }
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
              { label: '需补打数', value: printableUnit ? `${formatCount(printableUnit.missingTicketCount)} 张` : '0 张' },
              { label: '最近打印时间', value: printableUnit?.lastPrintedAt || '未打印' },
              { label: '最近打印人', value: printableUnit?.lastPrintedBy || '未打印' },
            ])}
            <div class="flex flex-wrap gap-2">
              ${
                canEnterFeiTickets
                  ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>`
                  : '<span class="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">当前不允许打印菲票</span>'
              }
              ${
                canEnterFeiTickets && printableUnit
                  ? `
                    <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-ticket-printed'), {
                      printableUnitId: printableUnit.printableUnitId,
                      printableUnitNo: printableUnit.printableUnitNo,
                      printableUnitType: printableUnit.printableUnitType,
                      cutOrderId: printableUnit.cutOrderId,
                      cutOrderNo: printableUnit.cutOrderNo,
                    }))}">查看已打印菲票</button>
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
              { label: '铺布单累计', value: `${markerSpreadingCounts.sessionCount} 张 / ${markerSpreadingCounts.rollCount} 卷` },
              { label: '累计铺布进度', value: markerSpreadingCounts.statusSummary, tone: 'strong' },
              { label: '最近铺布记录', value: markerSpreadingCounts.latestSessionNo },
              { label: '是否已完成人员分摊', value: markerSpreadingCounts.hasOperatorAllocation ? '已形成按人分摊' : '待补录分摊' },
              { label: '人员金额摘要', value: `${formatCutOrderCurrency(markerSpreadingCounts.operatorAmountTotal)}` },
              { label: '人工调价', value: markerSpreadingCounts.hasManualAdjustedAmount ? '存在人工调整金额' : '当前未人工调整' },
              { label: '差异提示', value: markerSpreadingCounts.hasVarianceWarning ? `有预警（${markerSpreadingCounts.warningLevelLabel}）` : '当前无明显预警' },
              { label: '建议动作', value: markerSpreadingCounts.suggestedAction },
            ])}
            <div class="flex flex-wrap gap-2">
              ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布差异</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '来料异议摘要',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '当前是否存在来料异议', value: latestClaimDispute ? '存在' : '暂无' },
              { label: '异议状态', value: latestClaimDispute ? getClaimDisputeStatusLabel(latestClaimDispute.status) : '暂无异议', tone: 'strong' },
              { label: '差异长度（m）', value: latestClaimDispute ? `${latestClaimDispute.discrepancyQty} 米` : '0 米' },
              { label: '处理结论', value: latestClaimDispute?.handleConclusion || '待平台处理' },
              { label: '提交时间', value: latestClaimDispute?.submittedAt || '待补' },
              { label: '证据份数（个）', value: latestClaimDispute ? `${latestClaimDispute.evidenceCount} 个` : '0 个' },
            ])}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '关联单据 / 关联入口',
        `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去待加工仓</button>
            ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
            ${canEnterFeiTickets ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布差异</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回生产单总览</button>
          </div>
        `,
      )}

      ${renderDetailSection(
        '轻量执行痕迹',
        `
          ${renderInfoGrid([
            { label: '最近状态摘要', value: row.statusSummary },
            { label: '最近动作', value: row.latestActionText },
          ])}
        `,
      )}

      ${renderCuttingWebOperationRecords(webOperationRecords)}
    </div>
  `

  return `
    <article class="space-y-4" data-testid="cut-order-detail-page">
      <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <p class="text-sm text-muted-foreground">裁片单详情</p>
          <h1 class="text-2xl font-semibold text-foreground">${renderProductionObjectCodeButton({
            objectType: 'CUT_ORDER',
            objectId: row.cutOrderNo,
            label: row.cutOrderNo,
            relatedProductionOrderNo: row.productionOrderNo,
            defaultTab: 'progress',
            highlightKey: `CUT_ORDER:${row.cutOrderNo}`,
            className: 'font-mono text-blue-600 hover:underline',
          })}</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.materialSku)} · ${escapeHtml(row.patternFileName)}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${extraButtons}
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('cut-orders'))}">返回裁片单</button>
        </div>
      </div>
      ${content}
    </article>
  `
}

type CutOrderDetailTabKey =
  | 'overview'
  | 'material-flow'
  | 'marker-plans'
  | 'spreading'
  | 'tickets-warehouse'
  | 'differences'
  | 'close'

const cutOrderDetailTabs: Array<{ key: CutOrderDetailTabKey; label: string; description: string }> = [
  { key: 'overview', label: '概览', description: '当前事实' },
  { key: 'material-flow', label: '配料领料', description: '多次配料 / 领料 / 入仓' },
  { key: 'marker-plans', label: '唛架方案', description: '多次排唛架与锁定' },
  { key: 'spreading', label: '铺布裁剪', description: '多张铺布单与实裁' },
  { key: 'tickets-warehouse', label: '菲票入仓交出', description: '实际裁剪后的追踪' },
  { key: 'differences', label: '差异处理', description: '差异与后续动作' },
  { key: 'close', label: '关闭记录', description: '关闭原因和快照' },
]

const markerPlanSourceStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  READY: '已确认',
  CUTTING: '执行中',
  DONE: '已完成',
  CANCELLED: '已取消',
}

const spreadingStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  TO_FILL: '待铺布',
  IN_PROGRESS: '铺布中',
  DONE: '已铺布',
  CANCELLED: '已取消',
}

const cuttingStatusLabels: Record<string, string> = {
  WAITING_CUTTING: '待裁剪',
  CUTTING: '裁剪中',
  CUTTING_DONE: '已裁剪',
  CANCELLED: '已取消',
}

const feiTicketPrintStatusLabels: Record<string, string> = {
  WAIT_PRINT: '待打印',
  PRINTED: '已打印',
  REPRINTED: '已补打',
  VOIDED: '已作废',
}

function isCutOrderLinked(value: unknown, row: Pick<CutOrderRow, 'cutOrderId' | 'cutOrderNo'>): boolean {
  if (Array.isArray(value)) return value.includes(row.cutOrderId) || value.includes(row.cutOrderNo)
  return value === row.cutOrderId || value === row.cutOrderNo
}

function isObjectLinkedToCutOrder(item: Record<string, any>, row: Pick<CutOrderRow, 'cutOrderId' | 'cutOrderNo'>): boolean {
  return (
    isCutOrderLinked(item.cutOrderId, row) ||
    isCutOrderLinked(item.cutOrderNo, row) ||
    isCutOrderLinked(item.cutOrderIds, row) ||
    isCutOrderLinked(item.cutOrderNos, row) ||
    isCutOrderLinked(item.sourceCutOrderIds, row) ||
    isCutOrderLinked(item.sourceCutOrderNos, row) ||
    isCutOrderLinked(item.completionLinkage?.linkedCutOrderIds, row) ||
    isCutOrderLinked(item.completionLinkage?.linkedCutOrderNos, row)
  )
}

function formatUnknownText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function formatUnknownNumber(value: unknown, unit = ''): string {
  const numeric = Number(value || 0)
  const label = Number.isFinite(numeric) ? formatCount(Math.round(numeric * 100) / 100) : '0'
  return unit ? `${label} ${unit}` : label
}

function readRecordDate(record: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    if (record[key]) return String(record[key])
  }
  return ''
}

function sortRecordsByLatest<T extends Record<string, any>>(records: T[], keys: string[]): T[] {
  return [...records].sort((left, right) =>
    readRecordDate(right, keys).localeCompare(readRecordDate(left, keys), 'zh-CN'),
  )
}

function getCutOrderDetailActiveTab(): CutOrderDetailTabKey {
  const tab = getCurrentSearchParams().get('tab') as CutOrderDetailTabKey | null
  return cutOrderDetailTabs.some((item) => item.key === tab) ? tab as CutOrderDetailTabKey : 'overview'
}

function buildCutOrderDetailTabPath(row: CutOrderRow, tab: CutOrderDetailTabKey): string {
  return buildRouteWithQuery(buildCutOrderDetailPath(row.id), { tab })
}

function renderCutOrderDetailTabs(row: CutOrderRow, activeTab: CutOrderDetailTabKey): string {
  return `
    <nav class="flex flex-wrap gap-2 rounded-xl border bg-card p-2" aria-label="裁片单详情页签">
      ${cutOrderDetailTabs.map((item) => {
        const active = item.key === activeTab
        return `
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-medium transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            data-nav="${escapeHtml(buildCutOrderDetailTabPath(row, item.key))}"
            aria-current="${active ? 'page' : 'false'}"
          >
            ${escapeHtml(item.label)}
          </button>
        `
      }).join('')}
    </nav>
  `
}

function renderEmptyDetailRecord(message: string): string {
  return `<div class="rounded-lg border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">${escapeHtml(message)}</div>`
}

function renderCompactRecordList<T>(
  records: T[],
  emptyText: string,
  renderItem: (record: T, index: number) => string,
): string {
  if (!records.length) return renderEmptyDetailRecord(emptyText)
  return `<div class="divide-y rounded-lg border bg-background">${records.map(renderItem).join('')}</div>`
}

function buildCutOrderDetailView(row: CutOrderRow, viewModel = getViewModel()) {
  const projection = getProjection()
  const sources = projection.sources
  const materialEvents = sortRecordsByLatest(
    row.materialQuantityLedger.events.map((event) => ({ ...event })),
    ['occurredAt'],
  )
  const markerPlanRecords = sortRecordsByLatest(
    sources.markerPlanSources
      .filter((record) => record.items.some((item) => item.cutOrderId === row.cutOrderId || item.cutOrderNo === row.cutOrderNo))
      .map((record) => ({ ...record })),
    ['updatedAt', 'createdAt'],
  )
  const markerPlanIds = new Set(markerPlanRecords.map((record) => String(record.markerPlanId || '')).filter(Boolean))
  const markerPlanNos = new Set(markerPlanRecords.map((record) => String(record.markerPlanNo || '')).filter(Boolean))
  const spreadingSessions = sortRecordsByLatest(
    (sources.markerStore.sessions as Array<Record<string, any>>)
      .filter((session) => {
        if (!markerPlanRecords.length) return false
        return (
          isObjectLinkedToCutOrder(session, row) ||
          markerPlanIds.has(String(session.markerPlanId || session.sourceSchemeId || '')) ||
          markerPlanNos.has(String(session.markerPlanNo || session.sourceMarkerNo || session.markerNo || ''))
        )
      })
      .map((session) => ({ ...session })),
    ['updatedAt', 'actualEndAt', 'createdAt'],
  )
  const spreadingSessionIds = new Set(spreadingSessions.map((session) => String(session.spreadingSessionId || '')).filter(Boolean))
  const spreadingSessionNos = new Set(
    spreadingSessions
      .flatMap((session) => [session.sessionNo, session.spreadingOrderNo, session.sourceSpreadingSessionNo])
      .map((value) => String(value || ''))
      .filter(Boolean),
  )
  const ticketRecords = sortRecordsByLatest(
    (sources.feiViewModel.ticketRecords as Array<Record<string, any>>)
      .filter((ticket) => {
        if (!markerPlanRecords.length) return false
        return (
          isObjectLinkedToCutOrder(ticket, row) ||
          spreadingSessionIds.has(String(ticket.spreadingSessionId || ticket.sourceSpreadingSessionId || '')) ||
          spreadingSessionNos.has(String(ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo || ''))
        )
      })
      .map((ticket) => ({ ...ticket })),
    ['printedAt', 'createdAt'],
  )
  const warehouseItems = sortRecordsByLatest(
    (sources.cutPieceWarehouseView.items as Array<Record<string, any>>)
      .filter((item) => ticketRecords.length > 0 && isObjectLinkedToCutOrder(item, row))
      .map((item) => ({ ...item })),
    ['inWarehouseAt', 'updatedAt'],
  )
  const differenceRows = sortRecordsByLatest(
    listSpreadingDifferences({ sessions: spreadingSessions })
      .filter((item) => item.cutOrderIds.includes(row.cutOrderId) || item.cutOrderNos.includes(row.cutOrderNo))
      .map((item) => ({ ...item })),
    ['detectedAt'],
  )
  const bindingProcessRows = buildBindingProcessOrders()
    .filter((item) => item.sourceCutOrderId === row.cutOrderId || item.sourceCutOrderNo === row.cutOrderNo)
    .map((item) => ({
      ...item,
      processNo: item.bindingOrderNo,
      processType: '捆条加工单',
      statusLabel: item.status,
      quantity: item.plannedTotalLength,
      pieceQty: item.actualTotalLength,
      unit: '米',
      updatedAt: item.completedAt || item.startedAt || '',
    }))
  const specialProcessRows = sortRecordsByLatest(
    [
      ...(sources.specialProcessView.rows as Array<Record<string, any>>)
        .filter((item) => isObjectLinkedToCutOrder(item, row))
        .map((item) => ({ ...item })),
      ...bindingProcessRows,
    ],
    ['updatedAt', 'returnedAt', 'createdAt'],
  )
  const siblingRows = viewModel.rows.filter(
    (item) => item.productionOrderId === row.productionOrderId && item.cutOrderId !== row.cutOrderId,
  )

  return {
    row,
    materialEvents,
    markerPlanRecords,
    spreadingSessions,
    ticketRecords,
    warehouseItems,
    differenceRows,
    specialProcessRows,
    siblingRows,
  }
}

function renderMaterialFlowEventRows(
  title: string,
  records: Array<Record<string, any>>,
  emptyText: string,
): string {
  return `
    <section class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
        <span class="text-xs text-muted-foreground">${records.length} 条</span>
      </div>
      ${renderCompactRecordList(records, emptyText, (event) => `
        <div class="grid gap-3 px-3 py-3 text-sm md:grid-cols-[1.1fr_1fr_1.1fr_1.3fr]">
          <div>
            <div class="font-medium text-foreground">${escapeHtml(cuttingMaterialLedgerEventTypeLabels[event.eventType as keyof typeof cuttingMaterialLedgerEventTypeLabels] || title)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatUnknownText(event.sourceObjectId))}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">数量</div>
            <div class="font-semibold tabular-nums">${escapeHtml(formatMaterialLedgerQty(Number(event.quantity || 0), event.unit || '米'))}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">操作</div>
            <div>${escapeHtml(formatUnknownText(event.operatorName))}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(formatUnknownText(event.occurredAt))}</div>
          </div>
          <div class="text-xs leading-5 text-muted-foreground">${escapeHtml(formatUnknownText(event.remark, '无备注'))}</div>
        </div>
      `)}
    </section>
  `
}

function renderCutOrderOverviewTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  const { row } = view
  const markerSpreadingCounts = buildMarkerSpreadingCountsByCutOrder(row.cutOrderId)
  return `
    <div class="space-y-4">
      ${renderDetailSection('当前概览', `
        <div class="grid gap-3 xl:grid-cols-[1.1fr_1fr]">
          <div class="rounded-lg border bg-muted/20 p-3">
            ${renderMaterialIdentityBlock(
              {
                materialSku: row.materialSku,
                materialName: row.materialName,
                materialLabel: row.materialLabel,
                materialCategory: row.materialCategory,
                materialColor: row.materialColor,
                materialAlias: row.materialAlias,
                materialImageUrl: row.materialImageUrl,
                materialUnit: row.materialUnit,
              },
              { imageSizeClass: 'h-14 w-14' },
            )}
          </div>
          ${renderInfoGrid([
            { label: '裁片单号', value: row.cutOrderNo, tone: 'strong' },
            { label: '来源裁片任务', value: row.cuttingTaskNo || '待补', tone: 'strong' },
            { label: '来源生产单', value: row.productionOrderNo },
            { label: '承接方', value: row.cuttingTaskAssigneeFactoryName || '待分配' },
            { label: '执行去向', value: row.executionRouteLabel || '待分配承接方', tone: row.executionRoute === 'OWN_CUTTING' ? 'strong' : undefined },
            { label: '主状态', value: row.currentStageLabel, tone: 'strong' },
            { label: '可用余额', value: formatMaterialLedgerQty(row.availableQty, row.availableUnit || row.materialUnit), tone: 'strong' },
            { label: '当前唛架方案', value: row.activeMarkerPlanNo || row.latestMarkerPlanNo || '无' },
          ])}
        </div>
      `)}
      ${renderDetailSection('纸样与日期', renderInfoGrid([
        { label: '纸样文件', value: row.patternFileName },
        { label: '纸样版本', value: row.patternVersion },
        { label: '有效幅宽', value: row.effectiveWidthText },
        { label: '部位集合', value: row.piecePartNames.join('、') || '待补' },
        ...row.dateInfoLines.map((line) => ({ label: `${line.label}日期`, value: line.value })),
        { label: '最近执行痕迹', value: row.latestActionText },
      ]))}
      ${renderDetailSection('数量账', renderMaterialLedgerGrid(row))}
      ${renderDetailSection('最近关系', renderInfoGrid([
        { label: '最近唛架方案', value: row.latestMarkerPlanNo || '暂无' },
        { label: '参与唛架方案数', value: `${row.batchParticipationCount} 次` },
        { label: '铺布记录', value: `${markerSpreadingCounts.sessionCount} 张铺布单 / 最近 ${markerSpreadingCounts.latestSessionNo}` },
        { label: '铺布裁剪进度', value: markerSpreadingCounts.statusSummary },
        { label: '菲票记录', value: `${view.ticketRecords.length} 条` },
        { label: '执行差异', value: `${view.differenceRows.length} 条` },
      ]))}
    </div>
  `
}

function renderCutOrderMaterialFlowTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  const eventGroups = [
    { title: '中转仓配料记录', types: ['TRANSFER_WAREHOUSE_ALLOCATED'], empty: '暂无中转仓配料记录。' },
    { title: '裁床领料记录', types: ['CUTTING_CLAIMED'], empty: '暂无裁床领料记录。' },
    { title: '扫码入仓记录', types: ['CUTTING_WAIT_PROCESS_INBOUNDED'], empty: '暂无扫码入仓记录。' },
    { title: '加工用料 / 铺布消耗', types: ['SPREADING_ACTUAL_CONSUMED'], empty: '暂无加工用料或铺布消耗记录。' },
    { title: '回收入仓 / 调整', types: ['CUTTING_RETURNED', 'LEDGER_ADJUSTED'], empty: '暂无回收入仓或调整记录。' },
  ]

  return `
    <div class="space-y-4">
      ${renderDetailSection('当前数量账', renderMaterialLedgerGrid(view.row))}
      ${eventGroups.map((group) =>
        renderMaterialFlowEventRows(
          group.title,
          view.materialEvents.filter((event) => group.types.includes(event.eventType)),
          group.empty,
        ),
      ).join('')}
    </div>
  `
}

function renderCutOrderMarkerPlanTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  return `
    <div class="space-y-4">
      ${renderDetailSection('唛架方案记录', renderCompactRecordList(view.markerPlanRecords, '暂无唛架方案记录。', (record) => {
        const sourceItem = record.items.find((item: Record<string, any>) => item.cutOrderId === view.row.cutOrderId || item.cutOrderNo === view.row.cutOrderNo)
        return `
          <div class="grid gap-3 px-3 py-3 text-sm xl:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto]">
            <div>
              <div class="font-semibold text-blue-600">${escapeHtml(record.markerPlanNo || '待补唛架方案号')}</div>
              <div class="mt-1 text-xs text-muted-foreground">来源裁片单 ${escapeHtml(String(record.sourceCutOrderCount || record.items.length || 0))} 张</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">状态</div>
              <div>${escapeHtml(markerPlanSourceStatusLabels[record.status] || record.status || '待补')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">本裁片单</div>
              <div>${escapeHtml(sourceItem?.cutOrderNo || view.row.cutOrderNo)}</div>
              <div class="text-xs text-muted-foreground">${escapeHtml(sourceItem?.sourceStageLabel || view.row.currentStageLabel)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">时间</div>
              <div>创建：${escapeHtml(record.createdAt || '待补')}</div>
              <div class="text-xs text-muted-foreground">更新：${escapeHtml(record.updatedAt || '待补')}</div>
            </div>
            <div class="flex items-center justify-start xl:justify-end">
              <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('marker-list'), {
                markerPlanNo: record.markerPlanNo,
                cutOrderId: view.row.cutOrderId,
                cutOrderNo: view.row.cutOrderNo,
              }))}">查看唛架方案</button>
            </div>
          </div>
        `
      }))}
    </div>
  `
}

function renderCutOrderSpreadingTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  return `
    <div class="space-y-4">
      ${renderDetailSection('铺布 / 裁剪记录', renderCompactRecordList(view.spreadingSessions, '暂无铺布单记录。', (session) => {
        const spreadingStatus = spreadingStatusLabels[session.status] || formatUnknownText(session.status, '待补')
        const cuttingStatus = session.status === 'DONE'
          ? cuttingStatusLabels[session.cuttingStatus] || formatUnknownText(session.cuttingStatus, '待裁剪')
          : '-'
        return `
          <div class="grid gap-3 px-3 py-3 text-sm xl:grid-cols-[1.2fr_1.1fr_1.1fr_1.1fr_1.3fr_auto]">
            <div>
              <div class="font-semibold text-blue-600">${escapeHtml(formatUnknownText(session.sessionNo || session.spreadingOrderNo || session.spreadingSessionId))}</div>
              <div class="mt-1 text-xs text-muted-foreground">唛架编号 / 床次：${escapeHtml(formatUnknownText(session.sourceBedNo || session.bedNo || session.markerNo))}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">唛架方案</div>
              <div>${escapeHtml(formatUnknownText(session.markerPlanNo || session.sourceMarkerNo || session.markerNo))}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">状态</div>
              <div>铺布：${escapeHtml(spreadingStatus)}</div>
              <div class="text-xs text-muted-foreground">裁剪：${escapeHtml(cuttingStatus)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">层数</div>
              <div>计划：${escapeHtml(formatUnknownNumber(session.plannedLayers, '层'))}</div>
              <div class="text-xs text-muted-foreground">实铺：${escapeHtml(formatUnknownNumber(session.actualLayers, '层'))}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">用量 / 数量</div>
              <div>计划用量：${escapeHtml(formatUnknownNumber(session.theoreticalSpreadTotalLength || session.plannedMaterialUsage, '米'))}</div>
              <div>实际用量：${escapeHtml(formatUnknownNumber(session.totalActualLength, '米'))}</div>
              <div>实际裁剪：${escapeHtml(formatUnknownNumber(session.actualCutGarmentQty ?? session.actualCutPieceQty, '件'))}</div>
            </div>
            <div class="flex items-center justify-start xl:justify-end">
              <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('spreading-list'), {
                cutOrderId: view.row.cutOrderId,
                cutOrderNo: view.row.cutOrderNo,
                sessionId: session.spreadingSessionId,
              }))}">查看铺布单</button>
            </div>
          </div>
        `
      }))}
    </div>
  `
}

function renderCutOrderTicketsWarehouseTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  return `
    <div class="space-y-4">
      ${renderDetailSection('菲票记录', renderCompactRecordList(view.ticketRecords, '暂无菲票记录。', (ticket) => `
        <div class="grid gap-3 px-3 py-3 text-sm xl:grid-cols-[1.2fr_1.1fr_1.2fr_1.2fr_1fr_auto]">
          <div>
            <div class="font-semibold text-blue-600">${escapeHtml(formatUnknownText(ticket.ticketNo))}</div>
            <div class="mt-1 text-xs text-muted-foreground">来源铺布单：${escapeHtml(formatUnknownText(ticket.sourceSpreadingSessionNo))}</div>
          </div>
          <div><div class="text-xs text-muted-foreground">裁片</div><div>${escapeHtml(formatUnknownText(ticket.partName))} / ${escapeHtml(formatUnknownText(ticket.size))}</div></div>
          <div><div class="text-xs text-muted-foreground">数量 / 编号范围</div><div>${escapeHtml(formatUnknownNumber(ticket.quantity ?? ticket.actualCutPieceQty, '片'))}</div><div class="text-xs text-muted-foreground">${escapeHtml(formatUnknownText(ticket.pieceSequenceLabel || ticket.pieceSetNoRange, '编号待补'))}</div></div>
          <div><div class="text-xs text-muted-foreground">特殊工艺</div><div>${escapeHtml(ticket.hasSpecialCraft ? formatUnknownText(ticket.specialCraftDisplayLabel, '有特殊工艺') : '无')}</div></div>
          <div><div class="text-xs text-muted-foreground">打印状态</div><div>${escapeHtml(feiTicketPrintStatusLabels[ticket.printStatus || ticket.status] || formatUnknownText(ticket.printStatus || ticket.status))}</div></div>
          <div class="flex items-center justify-start xl:justify-end"><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('fei-tickets'), {
            cutOrderId: view.row.cutOrderId,
            cutOrderNo: view.row.cutOrderNo,
          }))}">查看菲票</button></div>
        </div>
      `))}
      ${renderDetailSection('待交出仓库存', renderCompactRecordList(view.warehouseItems, '暂无入仓或待交出仓库存。', (item) => `
        <div class="grid gap-3 px-3 py-3 text-sm xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
          <div><div class="font-medium">${escapeHtml(formatUnknownText(item.warehouseItemId || item.inventoryRecordId))}</div><div class="mt-1 text-xs text-muted-foreground">铺布单：${escapeHtml(formatUnknownText(item.spreadingSessionNo || item.spreadingOrderNo))}</div></div>
          <div><div class="text-xs text-muted-foreground">数量</div><div class="font-semibold">${escapeHtml(formatUnknownNumber(item.pieceQty || item.quantity, '片'))}</div></div>
          <div><div class="text-xs text-muted-foreground">库区库位</div><div>${escapeHtml(formatUnknownText(item.zoneCode || item.warehouseArea))} / ${escapeHtml(formatUnknownText(item.locationCode))}</div></div>
          <div><div class="text-xs text-muted-foreground">暂存袋</div><div>${escapeHtml(formatUnknownText(item.bagCode))}</div></div>
          <div><div class="text-xs text-muted-foreground">交出状态</div><div>${escapeHtml(formatUnknownText(item.handoffStatus?.label || item.warehouseStatus?.label))}</div></div>
        </div>
      `))}
    </div>
  `
}

function renderCutOrderDifferencesTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  return `
    <div class="space-y-4">
      ${renderDetailSection('差异记录', renderCompactRecordList(view.differenceRows, '暂无差异记录。', (item) => `
        <div class="grid gap-3 px-3 py-3 text-sm xl:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_auto]">
          <div><div class="font-semibold">${escapeHtml(formatUnknownText(item.differenceId))}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatUnknownText(item.sourceType || item.differenceSource))}</div></div>
          <div><div class="text-xs text-muted-foreground">差异</div><div>${escapeHtml(formatUnknownText(item.differenceType || item.problemText))}</div><div class="text-xs text-muted-foreground">${escapeHtml(formatUnknownText(item.differenceLevel || item.levelLabel))}</div></div>
          <div><div class="text-xs text-muted-foreground">计划 / 实际</div><div>${escapeHtml(formatUnknownNumber(item.plannedValue, item.unit))} / ${escapeHtml(formatUnknownNumber(item.actualValue, item.unit))}</div></div>
          <div><div class="text-xs text-muted-foreground">处理状态</div><div>${escapeHtml(formatUnknownText(item.handlingStatus))}</div></div>
          <div><div class="text-xs text-muted-foreground">发现时间</div><div>${escapeHtml(formatUnknownText(item.detectedAt))}</div></div>
          <div class="flex items-center justify-start xl:justify-end"><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(buildRouteWithQuery(getCanonicalCuttingPath('spreading-list'), {
            cutOrderId: view.row.cutOrderId,
            cutOrderNo: view.row.cutOrderNo,
            spreadingOrderNo: item.spreadingOrderNo,
          }))}">查看铺布单</button></div>
        </div>
      `))}
      ${renderDetailSection('特殊工艺关联', renderCompactRecordList(view.specialProcessRows, '暂无特殊工艺记录。', (item) => `
        <div class="grid gap-3 px-3 py-3 text-sm md:grid-cols-4">
          <div><div class="font-medium">${escapeHtml(formatUnknownText(item.processNo || item.specialCraftTaskNo || item.id))}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatUnknownText(item.processType || item.craftType))}</div></div>
          <div><div class="text-xs text-muted-foreground">承接工厂</div><div>${escapeHtml(formatUnknownText(item.receiverFactoryName || item.factoryName))}</div></div>
          <div><div class="text-xs text-muted-foreground">状态</div><div>${escapeHtml(formatUnknownText(item.statusMeta?.label || item.statusLabel || item.status))}</div></div>
          <div><div class="text-xs text-muted-foreground">数量</div><div>${escapeHtml(formatUnknownNumber(item.pieceQty || item.quantity, '片'))}</div></div>
        </div>
      `))}
    </div>
  `
}

function renderCutOrderCloseRecordTab(view: ReturnType<typeof buildCutOrderDetailView>): string {
  const row = view.row
  const closeAuditRecords = getCutOrderCloseAuditRecords(row)
  const reopenAuditRecords = getCutOrderReopenAuditRecords(row)
  const resolveClosedFromStage = (record: CutOrderCloseRecord) => {
    const snapshot = record.ledgerSnapshotBeforeClose
    return snapshot.cuttingClaimedQty > 0 || snapshot.spreadingConsumedQty > 0 ? '已开工' : '未开工'
  }
  const closeEvents = closeAuditRecords.map((record) => ({
    eventType: 'close' as const,
    eventId: record.closeRecordId,
    recordNo: record.closeRecordNo,
    happenedAt: record.closedAt || record.createdAt,
    actor: record.closedBy || record.createdBy || '待补',
    actionLabel: '关闭裁片单',
    statusChange: `${resolveClosedFromStage(record)} -> 已关闭`,
    reasonLabel: record.closeReasonText || '待补',
    description: record.closeDescription || '—',
    sourceLabel: record.closeSourceType || '人工关闭',
    linkedRecordNo: record.sourceDifferenceId || '',
    record,
  }))
  const reopenEvents = reopenAuditRecords.map((record) => ({
    eventType: 'reopen' as const,
    eventId: record.reopenRecordId,
    recordNo: record.reopenRecordNo,
    happenedAt: record.reopenedAt || record.createdAt,
    actor: record.reopenedBy || record.createdBy || '待补',
    actionLabel: '重新打开裁片单',
    statusChange: `已关闭 -> ${row.currentStageLabel}`,
    reasonLabel: record.reopenReason || '—',
    description: record.reopenReason || '—',
    sourceLabel: '人工重新打开',
    linkedRecordNo: record.previousCloseRecordNo || '',
    record,
  }))
  const timelineEvents = [...closeEvents, ...reopenEvents].sort((left, right) =>
    right.happenedAt.localeCompare(left.happenedAt, 'zh-CN'),
  )
  const latestEvent = timelineEvents[0] || null

  if (!closeAuditRecords.length && !reopenAuditRecords.length && row.currentStage.key !== 'CLOSED') {
    return `
      <div class="space-y-4">
        ${renderDetailSection('关闭记录', renderEmptyDetailRecord('当前裁片单未关闭。'))}
      </div>
    `
  }

  const renderEventDetail = (event: (typeof timelineEvents)[number]) => {
    if (event.eventType === 'reopen') {
      return `
        <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div class="text-xs text-muted-foreground">关联关闭记录</div>
            <div class="mt-1 font-medium">${escapeHtml(event.linkedRecordNo || '未关联')}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">打开原因</div>
            <div class="mt-1 leading-5">${escapeHtml(event.reasonLabel)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">操作来源</div>
            <div class="mt-1">${escapeHtml(event.sourceLabel)}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">记录号</div>
            <div class="mt-1 font-medium text-emerald-700">${escapeHtml(event.recordNo)}</div>
          </div>
        </div>
      `
    }

    return `
      <div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div class="text-xs text-muted-foreground">关闭原因</div>
          <div class="mt-1 font-medium">${escapeHtml(event.reasonLabel)}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">关闭说明</div>
          <div class="mt-1 leading-5">${escapeHtml(event.description)}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">操作来源</div>
          <div class="mt-1">${escapeHtml(event.sourceLabel)}</div>
        </div>
        <div>
          <div class="text-xs text-muted-foreground">记录号</div>
          <div class="mt-1 font-medium">${escapeHtml(event.recordNo)}</div>
        </div>
      </div>
      <details class="mt-3 rounded-lg border bg-muted/20">
        <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">关闭前数量账和影响项</summary>
        <div class="space-y-3 border-t p-3">
          ${renderCloseLedgerSnapshot(event.record.ledgerSnapshotBeforeClose)}
          ${event.record.openImpactItems.length
            ? renderCloseImpactItems(event.record.openImpactItems)
            : renderEmptyDetailRecord('当前无关闭前影响项记录。')}
        </div>
      </details>
    `
  }

  const renderTimeline = () => timelineEvents.length
    ? `
      <div class="space-y-3">
        ${timelineEvents.map((event, index) => {
          const toneClass = event.eventType === 'reopen'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
          const lineClass = index === timelineEvents.length - 1 ? 'hidden' : 'absolute left-[15px] top-8 h-[calc(100%+0.75rem)] w-px bg-border'
          return `
            <article class="relative pl-10">
              <div class="${lineClass}"></div>
              <div class="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${toneClass}">
                ${event.eventType === 'reopen' ? '开' : '关'}
              </div>
              <div class="rounded-xl border bg-card p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-sm font-semibold">${escapeHtml(event.actionLabel)}</h4>
                      <span class="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(event.statusChange)}</span>
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(event.happenedAt || '待补时间')} · ${escapeHtml(event.actor)}</div>
                  </div>
                  <div class="text-right text-xs text-muted-foreground">${escapeHtml(event.recordNo)}</div>
                </div>
                <div class="mt-3 border-t pt-3">
                  ${renderEventDetail(event)}
                </div>
              </div>
            </article>
          `
        }).join('')}
      </div>
    `
    : renderEmptyDetailRecord('暂无关闭或重新打开日志。')

  return `
    <div class="space-y-4">
      ${renderDetailSection('当前状态摘要', renderInfoGrid([
        { label: '当前主状态', value: row.currentStageLabel, tone: 'strong' },
        { label: '最近动作', value: latestEvent?.actionLabel || '暂无', tone: latestEvent ? 'strong' : 'default' },
        { label: '最近操作人 / 时间', value: latestEvent ? `${latestEvent.actor} / ${latestEvent.happenedAt || '待补时间'}` : '暂无' },
        { label: '最近关联记录', value: latestEvent?.linkedRecordNo || latestEvent?.recordNo || '暂无' },
      ]))}
      ${
        row.currentStage.key === 'CLOSED'
          ? `<div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100" data-cutting-piece-action="reopen-cut-order" data-record-id="${escapeHtml(row.id)}">重新打开裁片单</button>
            </div>`
          : ''
      }
      ${renderDetailSection('操作日志', renderTimeline())}
    </div>
  `
}

function renderCutOrderDetailTabContent(view: ReturnType<typeof buildCutOrderDetailView>, activeTab: CutOrderDetailTabKey): string {
  switch (activeTab) {
    case 'material-flow':
      return renderCutOrderMaterialFlowTab(view)
    case 'marker-plans':
      return renderCutOrderMarkerPlanTab(view)
    case 'spreading':
      return renderCutOrderSpreadingTab(view)
    case 'tickets-warehouse':
      return renderCutOrderTicketsWarehouseTab(view)
    case 'differences':
      return renderCutOrderDifferencesTab(view)
    case 'close':
      return renderCutOrderCloseRecordTab(view)
    case 'overview':
    default:
      return renderCutOrderOverviewTab(view)
  }
}

function renderCutOrderDetailPanelV2(row: CutOrderRow, viewModel = getViewModel()): string {
  const activeTab = getCutOrderDetailActiveTab()
  const view = buildCutOrderDetailView(row, viewModel)
  const canEnterExecution = isCutOrderInExecutionStage(row)
  const canEnterFeiTickets = isPrintableSourceRow(row)

  return `
    <article class="space-y-4" data-testid="cut-order-detail-page">
      <section class="rounded-xl border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">裁片单详情</p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-foreground">${renderProductionObjectCodeButton({
                objectType: 'CUT_ORDER',
                objectId: row.cutOrderNo,
                label: row.cutOrderNo,
                relatedProductionOrderNo: row.productionOrderNo,
                defaultTab: 'progress',
                highlightKey: `CUT_ORDER:${row.cutOrderNo}`,
                className: 'font-mono text-blue-600 hover:underline',
              })}</h1>
              ${renderBadge(row.currentStageLabel, row.currentStage.className)}
            </div>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.materialSku)} · ${escapeHtml(row.patternFileName)} · ${escapeHtml(row.effectiveWidthText)}</p>
            ${row.closeReason ? `<p class="mt-1 text-sm text-amber-700">关闭原因：${escapeHtml(row.closeReasonText || row.closeReason)}</p>` : ''}
          </div>
          <div class="grid gap-2 text-right text-xs text-muted-foreground sm:grid-cols-3 sm:text-left">
            <div class="rounded-lg border px-3 py-2"><div>裁床已领</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(formatMaterialLedgerQty(row.claimedQty, row.availableUnit))}</div></div>
            <div class="rounded-lg border px-3 py-2"><div>已消耗</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(formatMaterialLedgerQty(row.consumedQty, row.availableUnit))}</div></div>
            <div class="rounded-lg border px-3 py-2"><div>可用余额</div><div class="mt-1 text-sm font-semibold text-blue-600">${escapeHtml(formatMaterialLedgerQty(row.availableQty, row.availableUnit))}</div></div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${canEnterExecution ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>` : ''}
          ${canEnterFeiTickets ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去打印菲票</button>` : ''}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-spreading" data-record-id="${escapeHtml(row.id)}">去铺布差异</button>
          ${row.currentStage.key === 'CLOSED' ? `<button type="button" class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100" data-cutting-piece-action="reopen-cut-order" data-record-id="${escapeHtml(row.id)}">重新打开</button>` : ''}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-close-cut-order" data-record-id="${escapeHtml(row.id)}">${row.currentStage.key === 'CLOSED' ? '查看关闭记录' : '关闭裁片单'}</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('cut-orders'))}">返回裁片单</button>
        </div>
      </section>
      ${renderCutOrderDetailTabs(row, activeTab)}
      ${renderCutOrderDetailTabContent(view, activeTab)}
    </article>
  `
}

function renderPage(): string {
  applyWebActionFromUrl()
  const viewModel = getViewModel()
  syncStateFromPath(viewModel)
  const rows = getDisplayRows(viewModel)
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'cut-orders')

  return `
    <div class="space-y-3 p-4" data-testid="cutting-cut-orders-page">
      ${renderCuttingPageHeader(meta, {
        showAliasBadge: isCuttingAliasPath(pathname),
      })}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterArea()}
      ${buildStatsCards(rows)}
      ${renderFilterStateBar()}
      ${renderTable(rows)}
    </div>
  `
}

function navigateToRecordTarget(
  recordId: string | undefined,
  target: keyof CutOrderRow['navigationPayload'] | 'markerPlan' | 'spreadingList',
): boolean {
  if (!recordId) return false
  const row = getViewModel().rowsById[recordId]
  if (!row) return false
  if ((target === 'markerPlan' || target === 'spreadingList') && !isCutOrderInExecutionStage(row)) {
    setFeedback('warning', '当前裁片单尚未完成领料，不能进入唛架或铺布执行。')
    return true
  }
  if (target === 'feiTickets' && !isPrintableSourceRow(row)) {
    setFeedback('warning', '当前裁片单尚未进入可打印阶段，不能打印菲票。')
    return true
  }
  const payload =
    target === 'markerPlan' || target === 'spreadingList'
      ? row.navigationPayload.markerSpreading
      : row.navigationPayload[target]
  const context = buildCuttingDrillContext(payload, 'cut-orders', {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    cutOrderId: row.cutOrderId,
    cutOrderNo: row.cutOrderNo,
    markerPlanNo: row.latestMarkerPlanNo || undefined,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    materialSku: row.materialSku,
    autoOpenDetail: true,
  })
  appStore.navigate(
    buildCuttingRouteWithContext(
      target === 'sameProductionOrders'
        ? 'cutOrders'
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

export function renderCraftCuttingCutOrdersPage(): string {
  return renderPage()
}

export function renderCraftCuttingCutOrderDetailPage(recordId?: string): string {
  const decodedId = decodeURIComponent(recordId || '')
  const viewModel = getViewModel()
  const row =
    viewModel.rowsById[decodedId] ||
    viewModel.rows.find(
      (item) => item.cutOrderId === decodedId || item.cutOrderNo === decodedId,
    )

  if (!row) {
    return `
      <div class="space-y-4 p-4" data-testid="cut-order-detail-page">
        <section class="rounded-xl border bg-card p-8 text-center">
          <h1 class="text-xl font-semibold text-foreground">裁片单详情</h1>
          <p class="mt-2 text-sm text-muted-foreground">未找到对应裁片单详情，请返回裁片单页面重新选择。</p>
          <button type="button" class="mt-4 rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath('cut-orders'))}">返回裁片单</button>
        </section>
      </div>
    `
  }

  return `<div class="space-y-4 p-4">${renderFeedbackBar()}${renderCutOrderDetailPanelV2(row, viewModel)}</div>`
}

export function renderCraftCuttingCutOrderClosePage(): string {
  return renderCutOrderClosePage()
}

export function handleCraftCuttingCutOrdersEvent(target: Element): boolean {
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

  const closeFieldNode = target.closest<HTMLElement>('[data-cutting-piece-close-field]')
  if (closeFieldNode) {
    const field = closeFieldNode.dataset.cuttingPieceCloseField as CloseField | undefined
    if (!field) return false
    const input = closeFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    if (field === 'closeReasonCode') {
      state.closeDraft.closeReasonCode = input.value as CutOrderCloseReasonCode
    } else {
      state.closeDraft[field] = input.value
    }
    state.closeDraft.feedback = null
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
    state.querySignature = getCanonicalCuttingPath('cut-orders')
    appStore.navigate(getCanonicalCuttingPath('cut-orders'))
    return true
  }

  if (action === 'open-detail') {
    const recordId = actionNode.dataset.recordId
    if (recordId) appStore.navigate(`/fcs/craft/cutting/cut-orders/${encodeURIComponent(recordId)}`)
    return true
  }

  if (action === 'print-task-route-card') {
    const recordId = actionNode.dataset.recordId
    const row = recordId ? getViewModel().rowsById[recordId] : null
    if (!row) return false
    appStore.navigate(buildTaskRouteCardPrintLink('CUTTING_ORDER', row.cutOrderId))
    return true
  }

  if (action === 'print-cutting-order-qr') {
    const recordId = actionNode.dataset.recordId
    const row = recordId ? getViewModel().rowsById[recordId] : null
    if (!row) return false
    appStore.navigate(buildCuttingOrderQrLabelPrintLink(row.cutOrderId))
    return true
  }

  if (action === 'web-status-action') {
    const sourceId = actionNode.dataset.sourceId
    const actionCode = actionNode.dataset.actionCode
    if (!sourceId || !actionCode) return true
    try {
      const result = executeProcessWebAction({
        sourceType: 'CUTTING_ORDER',
        sourceId,
        actionCode,
        operatorName: 'Web 端裁床操作员',
        operatedAt: '2026-04-28 10:00',
        remark: '裁片 Web 端状态操作，菲票归属仍回落裁片单',
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

  if (action === 'go-close-cut-order') {
    const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : null
    if (!row) return false
    appStore.navigate(buildRouteWithQuery(getCanonicalCuttingPath('cut-order-close'), {
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
    }))
    return true
  }

  if (action === 'reopen-cut-order') {
    const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : findClosePageRow()
    if (!row) return false
    if (row.currentStage.key !== 'CLOSED') {
      setFeedback('warning', '当前裁片单不是已关闭状态，不需要重新打开。')
      return true
    }
    const reopenedAt = nowText()
    const reopenRecord = buildCutOrderReopenRecord(row, reopenedAt)
    upsertStoredCutOrderReopenRecord(reopenRecord)
    updateCuttingOrderProgressWebStage(row.cutOrderId, {
      cuttingStage: resolveReopenedCutOrderStage(row),
      operatorName: reopenRecord.reopenedBy,
      operatedAt: reopenRecord.reopenedAt,
    })
    const message = '已重新打开裁片单，可继续针对该裁片单补料、唛架和铺布。'
    setFeedback('success', message)
    state.closeDraft.feedback = { tone: 'success', message }
    return true
  }

  if (action === 'submit-close-cut-order') {
    const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : findClosePageRow()
    if (!row) return false
    if (row.currentStage.key === 'CLOSED') {
      state.closeDraft.feedback = { tone: 'warning', message: '该裁片单已经关闭，不能重复关闭。' }
      return true
    }
    if (!state.closeDraft.closeReasonCode) {
      state.closeDraft.feedback = { tone: 'warning', message: '关闭裁片单必须选择关闭原因。' }
      return true
    }
    if (!state.closeDraft.closeDescription.trim()) {
      state.closeDraft.feedback = { tone: 'warning', message: '关闭裁片单必须填写关闭说明。' }
      return true
    }
    if (!state.closeDraft.closedBy.trim()) {
      state.closeDraft.feedback = { tone: 'warning', message: '关闭裁片单必须填写关闭人。' }
      return true
    }
    const impactContext = buildCloseImpactContext(row)
    const closedAt = nowText()
    const closeReasonText = resolveCutOrderCloseReasonText(state.closeDraft.closeReasonCode)
    const closeRecord: CutOrderCloseRecord = {
      closeRecordId: `close-${row.cutOrderId}`,
      closeRecordNo: `CLOSE-${row.cutOrderNo.replace(/^CUT-/, '')}`,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      closeReasonCode: state.closeDraft.closeReasonCode,
      closeReasonText,
      closeDescription: state.closeDraft.closeDescription.trim(),
      closedAt,
      closedBy: state.closeDraft.closedBy.trim(),
      closeSourceType: actionNode.dataset.sourceDifferenceId ? '差异确认' : '人工关闭',
      sourceDifferenceId: actionNode.dataset.sourceDifferenceId || undefined,
      linkedLedgerEventIds: [`ledger:${row.cutOrderId}:close:close-${row.cutOrderId}`],
      ledgerSnapshotBeforeClose: impactContext.ledgerSnapshot,
      openImpactItems: impactContext.impactItems,
      remainingInventorySummary: impactContext.inventorySummary,
      pendingSpecialCraftSummary: impactContext.pendingSpecialCraftSummary,
      pendingHandoverSummary: impactContext.pendingHandoverSummary,
      createdAt: closedAt,
      createdBy: state.closeDraft.closedBy.trim(),
    }
    upsertStoredCutOrderCloseRecord(closeRecord)
    updateCuttingOrderProgressWebStage(row.cutOrderId, {
      cuttingStage: '已关闭',
      operatorName: closeRecord.closedBy,
      operatedAt: closeRecord.closedAt,
      closeReasonCode: closeRecord.closeReasonCode,
      closeReasonText: closeRecord.closeReasonText,
      closeReason: closeRecord.closeDescription,
      ledgerSnapshotBeforeClose: closeRecord.ledgerSnapshotBeforeClose,
    })
    state.closeDraft.feedback = {
      tone: 'success',
      message: '已关闭裁片单并记录关闭原因；历史菲票、库存和交出记录仍保留。',
    }
    return true
  }

  if (action === 'go-marker-plan') {
    const row = actionNode.dataset.recordId ? getViewModel().rowsById[actionNode.dataset.recordId] : null
    if (!row?.batchParticipationCount) {
      setFeedback('warning', '当前没有关联的唛架方案，无法跳转。')
      return true
    }
    return navigateToRecordTarget(actionNode.dataset.recordId, 'markerPlanSources')
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

export function isCraftCuttingCutOrdersDialogOpen(): boolean {
  return state.activeOrderId !== null
}
