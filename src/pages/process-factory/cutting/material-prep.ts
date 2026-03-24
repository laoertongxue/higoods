// 本文件继续复用旧导出名承接 canonical 页面“仓库配料 / 领料”。
// 页面主对象冻结为原始裁片单；同一码回落原始裁片单，配料 / 领料只表达仓库到裁床的准备衔接。
import { renderDetailDrawer as uiDetailDrawer, renderDialog as uiDialog, renderFormDialog as uiFormDialog } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  buildSystemSeedMergeBatches,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model'
import { getPrepQrHiddenText } from './material-prep.helpers'
import {
  buildIssueListPrintPayload,
  buildMaterialPrepNavigationPayload,
  buildMaterialPrepStats,
  buildMaterialPrepViewModel,
  buildSameCodeValue,
  deriveMaterialClaimStatus,
  deriveMaterialPrepStatus,
  deriveSchedulingStatus,
  filterMaterialPrepRows,
  findMaterialPrepRowByPrefilter,
  materialAuditMeta,
  materialClaimMeta,
  materialPrepMeta,
  materialPrepStageMeta,
  materialSchedulingMeta,
  recalculateMaterialPrepRow,
  summarizeMaterialLineItems,
  type MaterialClaimRecord,
  type MaterialPrepClaimAggregateKey,
  type MaterialPrepFilters,
  type MaterialPrepLineItem,
  type MaterialPrepPrefilter,
  type MaterialPrepRow,
  type MaterialPrepSchedulingKey,
} from './material-prep-model'
import { urgencyMeta } from './production-progress-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers'

type FilterField =
  | 'keyword'
  | 'productionOrderNo'
  | 'styleKeyword'
  | 'materialPrepStatus'
  | 'materialClaimStatus'
  | 'materialAuditStatus'
  | 'schedulingStatus'
  | 'cuttingGroup'
  | 'materialSku'

type DialogType = 'CONFIG' | 'CLAIM' | 'SCHEDULE' | 'RECORDS'
type FeedbackTone = 'success' | 'warning'
type ClaimDraftResult = MaterialClaimRecord['result']

const sourceRecordMap = new Map(
  cuttingOrderProgressRecords.flatMap((record) => record.materialLines.map((line) => [line.cutPieceOrderNo, record] as const)),
)

const initialFilters: MaterialPrepFilters = {
  keyword: '',
  productionOrderNo: '',
  styleKeyword: '',
  materialPrepStatus: 'ALL',
  materialClaimStatus: 'ALL',
  materialAuditStatus: 'ALL',
  schedulingStatus: 'ALL',
  cuttingGroup: '',
  materialSku: '',
  issuesOnly: false,
  onlyPrintable: false,
  onlyPendingScheduling: false,
}

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof MaterialPrepFilters> = {
  keyword: 'keyword',
  productionOrderNo: 'productionOrderNo',
  styleKeyword: 'styleKeyword',
  materialPrepStatus: 'materialPrepStatus',
  materialClaimStatus: 'materialClaimStatus',
  materialAuditStatus: 'materialAuditStatus',
  schedulingStatus: 'schedulingStatus',
  cuttingGroup: 'cuttingGroup',
  materialSku: 'materialSku',
}

interface MaterialPrepFeedback {
  tone: FeedbackTone
  message: string
}

interface MaterialPrepPageState {
  rows: MaterialPrepRow[]
  filters: MaterialPrepFilters
  activeOrderId: string | null
  activeDialog: DialogType | null
  page: number
  pageSize: number
  querySignature: string
  prefilter: MaterialPrepPrefilter | null
  feedback: MaterialPrepFeedback | null
  configDrafts: Record<string, string>
  claimDrafts: Record<string, string>
  claimResult: ClaimDraftResult
  claimNote: string
  scheduleDraft: string
}

const state: MaterialPrepPageState = {
  rows: [],
  filters: { ...initialFilters },
  activeOrderId: null,
  activeDialog: null,
  page: 1,
  pageSize: 20,
  querySignature: '',
  prefilter: null,
  feedback: null,
  configDrafts: {},
  claimDrafts: {},
  claimResult: 'PARTIAL',
  claimNote: '',
  scheduleDraft: '',
}

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

function nowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  const hours = `${now.getHours()}`.padStart(2, '0')
  const minutes = `${now.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function ensureRowsInitialized(): void {
  if (state.rows.length) return
  state.rows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, getMergeBatchLedger()).rows
}

function syncRowsWithLatestClaimDisputes(): void {
  if (!state.rows.length) return
  state.rows.forEach((row) => {
    recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  })
}

function resetPagination(): void {
  state.page = 1
}

function readStoredLedger(): MergeBatchRecord[] {
  try {
    return deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
  } catch {
    return []
  }
}

function getMergeBatchLedger(): MergeBatchRecord[] {
  const seedView = buildMaterialPrepViewModel(cuttingOrderProgressRecords, [])
  const systemSeed = buildSystemSeedMergeBatches(
    seedView.rows.map((row) => ({
      id: row.id,
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      styleName: row.styleName,
      orderQty: 0,
      plannedShipDate: row.plannedShipDate,
      plannedShipDateDisplay: row.plannedShipDate,
      urgencyKey: row.urgencyKey,
      urgencyLabel: row.urgencyLabel,
      materialSku: row.materialLineItems[0]?.materialSku || row.materialSkuSummary,
      materialType: '',
      materialLabel: row.materialLineItems[0]?.materialName || row.materialSkuSummary,
      materialCategory: row.materialLineItems[0]?.materialCategory || '',
      materialAuditStatus: row.materialAuditStatus.key,
      materialPrepStatus: row.materialPrepStatus.key,
      materialClaimStatus: row.materialClaimStatus.key === 'EXCEPTION' ? 'PARTIAL' : row.materialClaimStatus.key,
      currentStage: row.currentStage.label,
      cuttableState: {
        key: row.materialClaimStatus.key === 'RECEIVED' ? 'CUTTABLE' : 'NOT_READY',
        label: row.materialClaimStatus.key === 'RECEIVED' ? '可裁' : '暂不可裁',
        className: '',
        detailText: '',
        selectable: row.materialClaimStatus.key === 'RECEIVED',
        reasonText: '',
      },
      compatibilityKey: `${row.styleCode || row.spuCode}__${row.materialLineItems[0]?.materialSku || row.materialSkuSummary}`,
      batchOccupancyStatus: row.latestMergeBatchNo ? 'IN_BATCH' : 'AVAILABLE',
      mergeBatchNo: row.latestMergeBatchNo,
      latestActionText: row.latestClaimRecordSummary,
      keywordIndex: [],
    })),
  )

  const merged = new Map(systemSeed.map((batch) => [batch.mergeBatchId, batch]))
  for (const batch of readStoredLedger()) merged.set(batch.mergeBatchId, batch)
  return Array.from(merged.values()).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN') ||
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
}

function getViewModel() {
  ensureRowsInitialized()
  syncRowsWithLatestClaimDisputes()
  return {
    rows: state.rows,
    rowsById: Object.fromEntries(state.rows.map((row) => [row.id, row])),
  }
}

function parsePrefilterFromPath(): MaterialPrepPrefilter | null {
  const params = getCurrentSearchParams()
  const prefilter: MaterialPrepPrefilter = {}

  const entries: Array<[keyof MaterialPrepPrefilter, string | null]> = [
    ['productionOrderId', params.get('productionOrderId')],
    ['productionOrderNo', params.get('productionOrderNo')],
    ['originalCutOrderId', params.get('originalCutOrderId')],
    ['originalCutOrderNo', params.get('originalCutOrderNo')],
    ['styleCode', params.get('styleCode')],
    ['spuCode', params.get('spuCode')],
    ['materialSku', params.get('materialSku')],
    ['schedulingStatus', params.get('schedulingStatus')],
    ['materialPrepStatus', params.get('materialPrepStatus')],
    ['materialClaimStatus', params.get('materialClaimStatus')],
  ]

  entries.forEach(([key, value]) => {
    if (value) prefilter[key] = value as never
  })

  return Object.keys(prefilter).length ? prefilter : null
}

function syncStateFromPath(viewModel = getViewModel()): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  state.prefilter = parsePrefilterFromPath()
  state.querySignature = pathname
  resetPagination()

  const matched = findMaterialPrepRowByPrefilter(viewModel.rows, state.prefilter)
  state.activeOrderId = matched?.id ?? null
}

function getDisplayRows(viewModel = getViewModel()): MaterialPrepRow[] {
  return filterMaterialPrepRows(viewModel.rows, state.filters, state.prefilter)
}

function getActiveRow(viewModel = getViewModel()): MaterialPrepRow | null {
  if (!state.activeOrderId) return null
  return viewModel.rowsById[state.activeOrderId] ?? null
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function formatDate(value: string): string {
  return value || '待补'
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderHeaderActions(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-original-orders-index">返回裁片单（原始单）</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-marker-spreading-index">去唛架 / 铺布</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
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
      <button type="button" class="rounded-md px-2 py-1 text-xs hover:bg-black/5" data-cutting-prep-action="clear-feedback">关闭</button>
    </section>
  `
}

function buildStatsCards(rows: MaterialPrepRow[]): string {
  const stats = buildMaterialPrepStats(rows)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('原始裁片单总数', stats.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('已配置数', stats.configuredCount, '配置已齐的原始裁片单', 'text-emerald-600')}
      ${renderCompactKpiCard('部分配置数', stats.partialConfigCount, '仍待补齐配料', 'text-orange-600')}
      ${renderCompactKpiCard('待领料数', stats.waitingClaimCount, '仓库待回写领取', 'text-slate-600')}
      ${renderCompactKpiCard('领料成功数', stats.claimSuccessCount, '已完成领料准备', 'text-blue-600')}
      ${renderCompactKpiCard('领料异常数', stats.claimExceptionCount, '存在不齐 / 差异', 'text-rose-600')}
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
        data-cutting-prep-field="${field}"
      >
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
      </select>
    </label>
  `
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.productionOrderNo) labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`)
  if (prefilter.originalCutOrderNo) labels.push(`预筛：原始裁片单 ${prefilter.originalCutOrderNo}`)
  if (prefilter.styleCode) labels.push(`预筛：款号 ${prefilter.styleCode}`)
  if (prefilter.spuCode) labels.push(`预筛：SPU ${prefilter.spuCode}`)
  if (prefilter.materialSku) labels.push(`预筛：面料 ${prefilter.materialSku}`)
  if (prefilter.schedulingStatus) labels.push(`预筛：排单 ${materialSchedulingMeta[prefilter.schedulingStatus].label}`)
  if (prefilter.materialPrepStatus) labels.push(`预筛：配料 ${materialPrepMeta[prefilter.materialPrepStatus].label}`)
  if (prefilter.materialClaimStatus) labels.push(`预筛：领料 ${materialClaimMeta[prefilter.materialClaimStatus].label}`)

  return labels
}

function getFilterLabels(): string[] {
  const labels: string[] = []

  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.productionOrderNo) labels.push(`生产单：${state.filters.productionOrderNo}`)
  if (state.filters.styleKeyword) labels.push(`款号 / SPU：${state.filters.styleKeyword}`)
  if (state.filters.materialSku) labels.push(`面料：${state.filters.materialSku}`)
  if (state.filters.materialPrepStatus !== 'ALL') labels.push(`配料：${materialPrepMeta[state.filters.materialPrepStatus].label}`)
  if (state.filters.materialClaimStatus !== 'ALL') labels.push(`领料：${materialClaimMeta[state.filters.materialClaimStatus].label}`)
  if (state.filters.materialAuditStatus !== 'ALL') labels.push(`审核：${materialAuditMeta[state.filters.materialAuditStatus].label}`)
  if (state.filters.schedulingStatus !== 'ALL') labels.push(`排单：${materialSchedulingMeta[state.filters.schedulingStatus].label}`)
  if (state.filters.cuttingGroup) labels.push(`裁床组：${state.filters.cuttingGroup}`)
  if (state.filters.issuesOnly) labels.push('仅看异常项')
  if (state.filters.onlyPrintable) labels.push('仅看可打印项')
  if (state.filters.onlyPendingScheduling) labels.push('仅看待排单')

  return labels
}

function renderPrefilterBar(): string {
  const labels = getPrefilterLabels()
  if (!labels.length) return ''
  return renderWorkbenchStateBar({
    summary: '当前预筛条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-prep-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-prep-action="clear-prefilter"',
  })
}

function renderFilterStateBar(): string {
  const labels = getFilterLabels()
  if (!labels.length) return ''
  return renderWorkbenchStateBar({
    summary: '当前筛选条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-prep-action="clear-filters"', 'blue')),
    clearAttrs: 'data-cutting-prep-action="clear-filters"',
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
              data-cutting-prep-field="keyword"
            />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${renderWorkbenchFilterChip(state.filters.issuesOnly ? '仅看异常项：已开启' : '仅看异常项', 'data-cutting-prep-action="toggle-issues-only"', state.filters.issuesOnly ? 'rose' : 'blue')}
          ${renderWorkbenchFilterChip(state.filters.onlyPrintable ? '仅看可打印项：已开启' : '仅看可打印项', 'data-cutting-prep-action="toggle-printable-only"', state.filters.onlyPrintable ? 'blue' : 'blue')}
          ${renderWorkbenchFilterChip(state.filters.onlyPendingScheduling ? '仅看待排单：已开启' : '仅看待排单', 'data-cutting-prep-action="toggle-pending-scheduling"', state.filters.onlyPendingScheduling ? 'amber' : 'blue')}
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="clear-filters">重置筛选</button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">生产单号</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.productionOrderNo)}"
            placeholder="输入生产单号"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-prep-field="productionOrderNo"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">款号 / SPU</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.styleKeyword)}"
            placeholder="输入款号、SPU 或款式名称"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-prep-field="styleKeyword"
          />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">面料 SKU / 类别</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.materialSku)}"
            placeholder="输入面料 SKU、类别或颜色"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-prep-field="materialSku"
          />
        </label>
        ${renderFilterSelect('配料状态', 'materialPrepStatus', state.filters.materialPrepStatus, [
          { value: 'ALL', label: '全部配料状态' },
          ...Object.entries(materialPrepMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        ${renderFilterSelect('领料状态', 'materialClaimStatus', state.filters.materialClaimStatus, [
          { value: 'ALL', label: '全部领料状态' },
          ...Object.entries(materialClaimMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        ${renderFilterSelect('面料审核', 'materialAuditStatus', state.filters.materialAuditStatus, [
          { value: 'ALL', label: '全部审核状态' },
          ...Object.entries(materialAuditMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        ${renderFilterSelect('排单状态', 'schedulingStatus', state.filters.schedulingStatus, [
          { value: 'ALL', label: '全部排单状态' },
          ...Object.entries(materialSchedulingMeta).map(([value, meta]) => ({ value, label: meta.label })),
        ])}
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">裁床组</span>
          <input
            type="search"
            value="${escapeHtml(state.filters.cuttingGroup)}"
            placeholder="输入裁床组"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-prep-field="cuttingGroup"
          />
        </label>
      </div>
    </div>
  `)
}

function renderRiskTags(tags: MaterialPrepRow['riskTags']): string {
  if (!tags.length) return '<span class="text-xs text-muted-foreground">-</span>'

  return `
    <div class="flex flex-wrap gap-1">
      ${tags.slice(0, 3).map((tag) => renderBadge(tag.label, tag.className)).join('')}
      ${tags.length > 3 ? `<span class="text-xs text-muted-foreground">+${tags.length - 3}</span>` : ''}
    </div>
  `
}

function renderMaterialAuditCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      ${renderBadge(row.materialAuditStatus.label, row.materialAuditStatus.className)}
      <p class="text-xs text-muted-foreground">${escapeHtml(row.materialAuditStatus.detailText)}</p>
    </div>
  `
}

function renderPrepCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      ${renderBadge(row.materialPrepStatus.label, row.materialPrepStatus.className)}
      <p class="text-xs text-muted-foreground">${escapeHtml(summarizeMaterialLineItems(row.materialLineItems))}</p>
    </div>
  `
}

function renderClaimCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      ${renderBadge(row.materialClaimStatus.label, row.materialClaimStatus.className)}
      <p class="text-xs text-muted-foreground">${escapeHtml(row.latestClaimRecordSummary)}</p>
    </div>
  `
}

function renderClaimDisputeCell(row: MaterialPrepRow): string {
  if (!row.hasClaimDispute || !row.latestClaimDispute) {
    return '<div class="text-xs text-muted-foreground">暂无领料异议</div>'
  }

  return `
    <div class="space-y-1">
      <div class="flex flex-wrap items-center gap-1">
        ${renderBadge(row.claimDisputeStatusLabel, row.latestClaimDispute.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : row.latestClaimDispute.status === 'VIEWED' ? 'bg-blue-100 text-blue-700' : row.latestClaimDispute.status === 'CONFIRMED' ? 'bg-orange-100 text-orange-700' : row.latestClaimDispute.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')}
        <span class="text-xs text-muted-foreground">${escapeHtml(row.claimDisputeDiscrepancyText)}</span>
      </div>
      <p class="text-xs text-muted-foreground">${escapeHtml(row.claimDisputeSummary)}</p>
      <p class="text-xs text-muted-foreground">证据 ${escapeHtml(String(row.claimDisputeEvidenceCount))} 个 · ${escapeHtml(row.claimDisputeHandleSummary)}</p>
    </div>
  `
}

function renderSchedulingCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      ${renderBadge(row.schedulingStatus.label, row.schedulingStatus.className)}
      <p class="text-xs text-muted-foreground">${escapeHtml(row.assignedCuttingGroup || '尚未分配裁床组')}</p>
    </div>
  `
}

function renderQrCell(row: MaterialPrepRow): string {
  if (!row.shouldDisplayQr) {
    return `
      <div class="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        ${escapeHtml(row.qrHiddenHint)}
      </div>
    `
  }

  return `
    <div class="space-y-1">
      <div class="font-medium">${escapeHtml(row.sameCodeValue)}</div>
      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.qrCodeLabel)}：${escapeHtml(row.qrCodeValue)}</p>
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

function renderTable(rows: MaterialPrepRow[]): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">原始裁片单配料主表</h2>
          <p class="mt-1 text-xs text-muted-foreground">一行一个原始裁片单，同一码 / 二维码回落原始裁片单；配料与领料只表达仓库到裁床的准备衔接。</p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条原始裁片单</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full min-w-[1720px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">同一码 / 二维码</th>
              <th class="px-4 py-3 text-left font-medium">来源生产单号</th>
              <th class="px-4 py-3 text-left font-medium">款号 / SPU</th>
              <th class="px-4 py-3 text-left font-medium">面料摘要</th>
              <th class="px-4 py-3 text-left font-medium">面料审核</th>
              <th class="px-4 py-3 text-left font-medium">配料进展</th>
              <th class="px-4 py-3 text-left font-medium">领料进展</th>
              <th class="px-4 py-3 text-left font-medium">领料异议</th>
              <th class="px-4 py-3 text-left font-medium">排单状态</th>
              <th class="px-4 py-3 text-left font-medium">当前阶段</th>
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
                            <button type="button" class="text-left font-medium text-blue-600 hover:underline" data-cutting-prep-action="open-detail" data-record-id="${escapeHtml(row.id)}">
                              ${escapeHtml(row.originalCutOrderNo)}
                            </button>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.color)} · ${escapeHtml(row.urgencyLabel)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${renderQrCell(row)}
                          </td>
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-blue-600" data-cutting-prep-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">
                              ${escapeHtml(row.productionOrderNo)}
                            </button>
                            <p class="mt-1 text-xs text-muted-foreground">发货：${escapeHtml(formatDate(row.plannedShipDate))}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(row.styleCode || row.spuCode || '待补')}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '款式待补')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="font-medium">${escapeHtml(row.materialSkuSummary)}</div>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(summarizeMaterialLineItems(row.materialLineItems))}</p>
                          </td>
                          <td class="px-4 py-3 align-top">${renderMaterialAuditCell(row)}</td>
                          <td class="px-4 py-3 align-top">${renderPrepCell(row)}</td>
                          <td class="px-4 py-3 align-top">${renderClaimCell(row)}</td>
                          <td class="px-4 py-3 align-top">${renderClaimDisputeCell(row)}</td>
                          <td class="px-4 py-3 align-top">${renderSchedulingCell(row)}</td>
                          <td class="px-4 py-3 align-top">
                            ${renderBadge(row.currentStage.label, row.currentStage.className)}
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.currentStage.detailText)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">${renderRiskTags(row.riskTags)}</td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="open-detail" data-record-id="${escapeHtml(row.id)}">查看详情</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="print-issue-list" data-record-id="${escapeHtml(row.id)}">打印发料清单</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="open-records-dialog" data-record-id="${escapeHtml(row.id)}">查看领料记录</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="open-schedule-dialog" data-record-id="${escapeHtml(row.id)}">分配裁床组</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去唛架 / 铺布</button>
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
      `)}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-prep-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-prep-page-size',
      })}
    </section>
  `
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string; tone?: 'default' | 'strong' }>): string {
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

function renderMaterialLineTable(row: MaterialPrepRow): string {
  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[980px] text-sm">
        <thead class="border-b bg-muted/60 text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">materialSku</th>
            <th class="px-3 py-2 text-left font-medium">面料类别 / 属性</th>
            <th class="px-3 py-2 text-left font-medium">需求量</th>
            <th class="px-3 py-2 text-left font-medium">已配置量</th>
            <th class="px-3 py-2 text-left font-medium">已领取量</th>
            <th class="px-3 py-2 text-left font-medium">缺口量</th>
            <th class="px-3 py-2 text-left font-medium">审核状态</th>
            <th class="px-3 py-2 text-left font-medium">配料状态</th>
            <th class="px-3 py-2 text-left font-medium">领料状态</th>
            <th class="px-3 py-2 text-left font-medium">备注</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${row.materialLineItems
            .map(
              (item) => `
                <tr>
                  <td class="px-3 py-2 align-top">
                    <div class="font-medium">${escapeHtml(item.materialSku)}</div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialName)}</p>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <div>${escapeHtml(item.materialCategory)}</div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialAttr)}</p>
                  </td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.requiredQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.configuredQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.claimedQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.shortageQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">${renderBadge(item.auditStatus.label, item.auditStatus.className)}</td>
                  <td class="px-3 py-2 align-top">${renderBadge(item.linePrepStatus.label, item.linePrepStatus.className)}</td>
                  <td class="px-3 py-2 align-top">${renderBadge(item.lineClaimStatus.label, item.lineClaimStatus.className)}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(item.note || item.latestActionText || '—')}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderClaimRecords(row: MaterialPrepRow): string {
  if (!row.claimRecords.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无领料记录，后续仓库回写将在这里沉淀。</div>'
  }

  return `
    <div class="space-y-3">
      ${row.claimRecords
        .map(
          (record) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-medium">${escapeHtml(record.summary)}</div>
                <span class="text-xs text-muted-foreground">${escapeHtml(record.claimedAt || '待补时间')}</span>
              </div>
              <div class="mt-1 text-xs text-muted-foreground">操作人：${escapeHtml(record.claimedBy || '待补')}</div>
              <div class="mt-1 text-xs text-muted-foreground">说明：${escapeHtml(record.note || '—')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderDetailDrawer(viewModel = getViewModel()): string {
  const row = getActiveRow(viewModel)
  if (!row) return ''

  const extraButtons = `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="open-config-dialog" data-record-id="${escapeHtml(row.id)}">编辑配置结果</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="open-claim-dialog" data-record-id="${escapeHtml(row.id)}">记录领料结果</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="open-schedule-dialog" data-record-id="${escapeHtml(row.id)}">分配裁床组</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="print-issue-list" data-record-id="${escapeHtml(row.id)}">打印发料清单</button>
    </div>
  `

  const content = `
    <div class="space-y-4">
      ${renderDetailSection(
        '基础身份信息',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '原始裁片单号', value: row.originalCutOrderNo, tone: 'strong' },
              ...(row.shouldDisplayQr
                ? [
                    { label: '同一码', value: row.sameCodeValue, hint: '同一码始终回落原始裁片单。' },
                    { label: '二维码值', value: row.qrCodeValue, hint: row.shouldDisplayQrLabel ? row.qrCodeLabel : '' },
                  ]
                : []),
              { label: '来源生产单号', value: row.productionOrderNo },
              { label: '款号 / SPU', value: `${row.styleCode || row.spuCode} / ${row.styleName || row.spuCode}` },
              { label: '颜色', value: row.color },
              { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
              { label: '紧急程度', value: row.urgencyLabel },
              { label: '关联批次', value: row.latestMergeBatchNo || '未入批次', hint: '批次只是执行上下文，不改变原始单身份。' },
            ])}
            ${
              row.shouldDisplayQr
                ? ''
                : `
                  <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    ${escapeHtml(getPrepQrHiddenText(row.materialPrepStatus.key, 'detail'))}
                  </div>
                `
            }
          </div>
        `,
      )}

      ${renderDetailSection(
        '状态摘要',
        `
          <div class="space-y-3">
            <div class="flex flex-wrap gap-2">
              ${renderBadge(row.materialAuditStatus.label, row.materialAuditStatus.className)}
              ${renderBadge(row.materialPrepStatus.label, row.materialPrepStatus.className)}
              ${renderBadge(row.materialClaimStatus.label, row.materialClaimStatus.className)}
              ${renderBadge(row.schedulingStatus.label, row.schedulingStatus.className)}
              ${renderBadge(row.currentStage.label, row.currentStage.className)}
            </div>
            ${renderInfoGrid([
              { label: '排单状态', value: row.schedulingStatus.label, hint: row.assignedCuttingGroup || '当前尚未分配裁床组。' },
              { label: '裁床组', value: row.assignedCuttingGroup || '待排单' },
              { label: '最近领料摘要', value: row.latestClaimRecordSummary || '暂无领料记录' },
            ])}
            <div class="rounded-lg border bg-muted/10 px-3 py-3">
              <p class="text-xs text-muted-foreground">风险提示</p>
              <div class="mt-2 flex flex-wrap gap-1">
                ${row.riskTags.length ? row.riskTags.map((tag) => renderBadge(tag.label, tag.className)).join('') : '<span class="text-sm text-muted-foreground">当前未识别到异常项。</span>'}
              </div>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection('面料行项目表', renderMaterialLineTable(row))}

      ${renderDetailSection(
        '发料清单区',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '打印时间', value: row.printedAt || '未打印' },
              { label: '打印人', value: row.printedBy || '待补' },
              { label: '打印摘要', value: summarizeMaterialLineItems(row.materialLineItems) },
            ])}
            ${
              row.shouldPrintQr
                ? ''
                : `
                  <div class="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
                    ${escapeHtml(getPrepQrHiddenText(row.materialPrepStatus.key, 'print'))}
                  </div>
                `
            }
            <div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
              发料清单上的码回落原始裁片单，本清单只是仓库到裁床之间的准备单据，不会生成新的主体码。
            </div>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="print-issue-list" data-record-id="${escapeHtml(row.id)}">打印发料清单</button>
          </div>
        `,
      )}

      ${renderDetailSection('领料记录区', renderClaimRecords(row))}

      ${renderDetailSection(
        '领料异议区',
        renderClaimDisputeDetail(row),
      )}

      ${renderDetailSection(
        '关联入口区',
        `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-original-orders" data-record-id="${escapeHtml(row.id)}">去裁片单（原始单）</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去唛架 / 铺布</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回生产单进度</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-summary" data-record-id="${escapeHtml(row.id)}">查看裁剪总结</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}" ${row.latestMergeBatchNo ? '' : 'disabled'}>
              查看合并裁剪批次
            </button>
          </div>
          <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            本页主体是原始裁片单，合并裁剪批次只是执行上下文。后续若从本页进入菲票 / 打编号，菲票归属仍永远回落原始裁片单。
          </div>
        `,
      )}
    </div>
  `

  return uiDetailDrawer(
    {
      title: row.originalCutOrderNo,
      subtitle: `来源生产单 ${row.productionOrderNo} · ${row.styleCode || row.spuCode || '款号待补'}`,
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      width: 'lg',
    },
    content,
    extraButtons,
  )
}

function renderClaimDisputeEvidence(files: Array<{ fileId: string; fileName: string; fileType: 'IMAGE' | 'VIDEO'; uploadedAt: string }>): string {
  if (!files.length) {
    return '<div class="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">当前未上传该类型证据。</div>'
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${files
        .map(
          (file) => `
            <div class="rounded-md border bg-muted/10 px-3 py-2 text-xs">
              <div class="font-medium">${escapeHtml(file.fileName)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(file.fileType === 'IMAGE' ? '图片' : '视频')} · ${escapeHtml(file.uploadedAt)}</div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderClaimDisputeDetail(row: MaterialPrepRow): string {
  if (!row.latestClaimDispute) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">暂无领料异议。</div>'
  }

  const dispute = row.latestClaimDispute
  return `
    <div class="space-y-4">
      ${renderInfoGrid([
        { label: '仓库配置数量', value: `${dispute.configuredQty} 米` },
        { label: '默认应领数量', value: `${dispute.defaultClaimQty} 米` },
        { label: '实际领取数量', value: `${dispute.actualClaimQty} 米`, tone: 'strong' },
        { label: '差异数量', value: `${dispute.discrepancyQty} 米`, tone: 'strong' },
        { label: '异议状态', value: row.claimDisputeStatusLabel },
        { label: '处理结论', value: dispute.handleConclusion || '待平台处理' },
        { label: '提交人', value: dispute.submittedBy },
        { label: '提交时间', value: dispute.submittedAt },
        { label: '处理说明', value: dispute.handleNote || '待平台处理说明' },
        { label: '处理回写', value: `${dispute.writtenBackToCraft ? '已回写工艺端' : '待回写工艺端'} / ${dispute.writtenBackToPda ? '已回写移动端' : '待回写移动端'}` },
      ])}
      <div class="rounded-lg border bg-muted/10 px-3 py-3 text-sm">
        <p class="text-xs text-muted-foreground">异议原因</p>
        <p class="mt-1">${escapeHtml(dispute.disputeReason)}</p>
        <p class="mt-3 text-xs text-muted-foreground">异议说明</p>
        <p class="mt-1">${escapeHtml(dispute.disputeNote || '无')}</p>
      </div>
      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">图片证据</p>
        ${renderClaimDisputeEvidence(dispute.imageFiles)}
      </div>
      <div class="space-y-2">
        <p class="text-xs font-medium text-muted-foreground">视频证据</p>
        ${renderClaimDisputeEvidence(dispute.videoFiles)}
      </div>
    </div>
  `
}

function renderConfigDialog(viewModel = getViewModel()): string {
  if (state.activeDialog !== 'CONFIG') return ''
  const row = getActiveRow(viewModel)
  if (!row) return ''

  const content = `
    <div class="space-y-4">
      <div class="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
        当前操作对象：${escapeHtml(row.originalCutOrderNo)} · 同一码 ${escapeHtml(buildSameCodeValue(row.originalCutOrderNo))}
      </div>
      ${row.materialLineItems
        .map(
          (item) => `
            <article class="rounded-lg border px-3 py-3">
              <div class="font-medium">${escapeHtml(item.materialSku)}</div>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialName)} · 需求 ${escapeHtml(`${formatQty(item.requiredQty)} 米`)}</p>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">已配置量（米）</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.configDrafts[item.materialLineId] ?? String(item.configuredQty))}"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    data-cutting-prep-config-line-id="${item.materialLineId}"
                  />
                </label>
                <div class="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                  当前已领取 ${escapeHtml(`${formatQty(item.claimedQty)} 米`)}，缺口 ${escapeHtml(`${formatQty(item.shortageQty)} 米`)}
                </div>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `

  return uiFormDialog(
    {
      title: '编辑配置结果',
      description: '轻量回写面料行项目的配置数量，并同步刷新配料聚合状态。',
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingPrep', action: 'save-config', label: '保存配置结果' },
      width: 'lg',
    },
    content,
  )
}

function renderClaimDialog(viewModel = getViewModel()): string {
  if (state.activeDialog !== 'CLAIM') return ''
  const row = getActiveRow(viewModel)
  if (!row) return ''

  const content = `
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="fill-claim-success">回写全部领料成功</button>
      </div>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">领料结果</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-prep-claim-field="result">
          <option value="SUCCESS" ${state.claimResult === 'SUCCESS' ? 'selected' : ''}>全部领料成功</option>
          <option value="PARTIAL" ${state.claimResult === 'PARTIAL' ? 'selected' : ''}>部分领取</option>
          <option value="EXCEPTION" ${state.claimResult === 'EXCEPTION' ? 'selected' : ''}>领料不齐 / 异常</option>
        </select>
      </label>
      ${row.materialLineItems
        .map(
          (item) => `
            <article class="rounded-lg border px-3 py-3">
              <div class="font-medium">${escapeHtml(item.materialSku)}</div>
              <p class="mt-1 text-xs text-muted-foreground">需求 ${escapeHtml(`${formatQty(item.requiredQty)} 米`)} · 当前已领 ${escapeHtml(`${formatQty(item.claimedQty)} 米`)}</p>
              <label class="mt-3 block space-y-2">
                <span class="text-sm font-medium text-foreground">本次回写领取量（米）</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value="${escapeHtml(state.claimDrafts[item.materialLineId] ?? String(item.claimedQty))}"
                  class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  data-cutting-prep-claim-line-id="${item.materialLineId}"
                />
              </label>
            </article>
          `,
        )
        .join('')}
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">异常说明</span>
        <textarea
          class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="补充领料不齐、差异原因或本次回写说明"
          data-cutting-prep-claim-field="note"
        >${escapeHtml(state.claimNote)}</textarea>
      </label>
    </div>
  `

  return uiFormDialog(
    {
      title: '记录领料结果',
      description: '轻量回写领料数量与结果，不做真实扫码流程。',
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingPrep', action: 'save-claim', label: '保存领料结果' },
      width: 'lg',
    },
    content,
  )
}

function renderScheduleDialog(viewModel = getViewModel()): string {
  if (state.activeDialog !== 'SCHEDULE') return ''
  const row = getActiveRow(viewModel)
  if (!row) return ''

  const content = `
    <div class="space-y-4">
      <div class="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
        当前原始裁片单：${escapeHtml(row.originalCutOrderNo)} · 当前排单状态：${escapeHtml(row.schedulingStatus.label)}
      </div>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">裁床组</span>
        <input
          type="text"
          value="${escapeHtml(state.scheduleDraft)}"
          placeholder="例如：裁床 A-01"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-cutting-prep-schedule-field="cuttingGroup"
        />
      </label>
      <p class="text-xs text-muted-foreground">填写后自动回写为“已排单”；若清空裁床组，则回到“待排单”。</p>
    </div>
  `

  return uiFormDialog(
    {
      title: '分配裁床组',
      description: '排单状态挂在原始裁片单维度，不会影响生产单身份。',
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingPrep', action: 'save-schedule', label: '保存裁床组' },
      width: 'md',
    },
    content,
  )
}

function renderClaimRecordsDialog(viewModel = getViewModel()): string {
  if (state.activeDialog !== 'RECORDS') return ''
  const row = getActiveRow(viewModel)
  if (!row) return ''

  return uiDialog(
    {
      title: `${row.originalCutOrderNo} · 领料记录`,
      description: '仅承接当前原始裁片单的轻量领料回写记录。',
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      width: 'lg',
    },
    renderClaimRecords(row),
    `<button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-prep-action="close-overlay">关闭</button>`,
  )
}

function renderDialogs(): string {
  return `
    ${renderConfigDialog()}
    ${renderClaimDialog()}
    ${renderScheduleDialog()}
    ${renderClaimRecordsDialog()}
  `
}

function renderPage(): string {
  ensureRowsInitialized()
  const viewModel = getViewModel()
  syncStateFromPath(viewModel)
  const rows = getDisplayRows(viewModel)
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'material-prep')

  return `
    <div class="space-y-3 p-4">
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
      ${renderDialogs()}
    </div>
  `
}

function getRecordById(recordId: string | undefined): MaterialPrepRow | null {
  if (!recordId) return null
  return getViewModel().rowsById[recordId] ?? null
}

function updateRow(recordId: string | undefined, updater: (row: MaterialPrepRow) => void): boolean {
  const row = getRecordById(recordId)
  if (!row) return false
  updater(row)
  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  return true
}

function openDialog(type: DialogType, recordId: string | undefined): boolean {
  const row = getRecordById(recordId)
  if (!row) return false

  state.activeOrderId = row.id
  state.activeDialog = type
  state.configDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.configuredQty)]))
  state.claimDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.claimedQty)]))
  state.claimResult = row.materialClaimStatus.key === 'EXCEPTION' ? 'EXCEPTION' : row.materialClaimStatus.key === 'RECEIVED' ? 'SUCCESS' : 'PARTIAL'
  state.claimNote = row.claimRecords[0]?.note || ''
  state.scheduleDraft = row.assignedCuttingGroup
  return true
}

function closeOverlay(): void {
  if (state.activeDialog) {
    state.activeDialog = null
    return
  }
  state.activeOrderId = null
}

function navigateToRowTarget(
  recordId: string | undefined,
  target: keyof MaterialPrepRow['navigationPayload'],
): boolean {
  const row = getRecordById(recordId)
  if (!row) return false

  const pathMap: Record<keyof MaterialPrepRow['navigationPayload'], string> = {
    originalOrders: getCanonicalCuttingPath('original-orders'),
    markerSpreading: getCanonicalCuttingPath('marker-spreading'),
    summary: getCanonicalCuttingPath('summary'),
    productionProgress: getCanonicalCuttingPath('production-progress'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
  }

  const payload =
    target === 'markerSpreading'
      ? { ...row.navigationPayload[target], tab: 'spreadings' }
      : row.navigationPayload[target]
  appStore.navigate(buildRouteWithQuery(pathMap[target], payload))
  return true
}

function saveConfig(): boolean {
  const row = getActiveRow()
  if (!row) return false

  row.materialLineItems = row.materialLineItems.map((item) => ({
    ...item,
    configuredQty: Math.max(0, Number(state.configDrafts[item.materialLineId] || item.configuredQty) || 0),
    note: `仓库配料回写：${Math.max(0, Number(state.configDrafts[item.materialLineId] || item.configuredQty) || 0)} 米`,
    latestActionText: `已回写配料结果 ${Math.max(0, Number(state.configDrafts[item.materialLineId] || item.configuredQty) || 0)} 米。`,
  }))
  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  state.activeDialog = null
  setFeedback('success', `${row.originalCutOrderNo} 的配料结果已更新。`)
  return true
}

function saveClaim(): boolean {
  const row = getActiveRow()
  if (!row) return false

  row.materialLineItems = row.materialLineItems.map((item) => {
    const draftValue = Math.max(0, Number(state.claimDrafts[item.materialLineId] || item.claimedQty) || 0)
    const nextQty = state.claimResult === 'SUCCESS' ? item.requiredQty : draftValue
    return {
      ...item,
      claimedQty: nextQty,
      hasClaimException: state.claimResult === 'EXCEPTION',
      note: state.claimNote || item.note,
      latestActionText:
        state.claimResult === 'SUCCESS'
          ? '已回写全部领料成功。'
          : state.claimResult === 'EXCEPTION'
            ? '已回写领料不齐 / 差异。'
            : '已回写部分领取结果。',
    }
  })

  row.claimRecords.unshift({
    claimRecordId: `${row.originalCutOrderId}-${Date.now()}`,
    originalCutOrderId: row.originalCutOrderId,
    claimedAt: nowText(),
    claimedBy: '仓库配料页回写',
    result: state.claimResult,
    summary:
      state.claimResult === 'SUCCESS'
        ? '已回写全部领料成功。'
        : state.claimResult === 'EXCEPTION'
          ? '已回写领料不齐 / 异常。'
          : '已回写部分领取结果。',
    note: state.claimNote || '仓库领料结果已在原型页补录。',
  })

  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  state.activeDialog = null
  setFeedback('success', `${row.originalCutOrderNo} 的领料结果已更新。`)
  return true
}

function saveSchedule(): boolean {
  const row = getActiveRow()
  if (!row) return false

  row.assignedCuttingGroup = state.scheduleDraft.trim()
  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  state.activeDialog = null
  setFeedback('success', row.assignedCuttingGroup ? `${row.originalCutOrderNo} 已分配到 ${row.assignedCuttingGroup}。` : `${row.originalCutOrderNo} 已清空裁床组，回到待排单。`)
  return true
}

function printIssueList(recordId: string | undefined): boolean {
  const row = getRecordById(recordId)
  if (!row) return false

  const payload = buildIssueListPrintPayload(row)
  const printWindow = window.open('', '_blank', 'width=960,height=720')
  if (!printWindow) {
    setFeedback('warning', '浏览器拦截了打印窗口，请允许弹窗后重试。')
    return true
  }

  const rowsHtml = payload.materialLineItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.materialSku)}</td>
          <td>${escapeHtml(item.materialCategory)}</td>
          <td>${escapeHtml(`${formatQty(item.requiredQty)} 米`)}</td>
          <td>${escapeHtml(`${formatQty(item.configuredQty)} 米`)}</td>
          <td>${escapeHtml(`${formatQty(item.claimedQty)} 米`)}</td>
          <td>${escapeHtml(`${formatQty(item.shortageQty)} 米`)}</td>
        </tr>
      `,
    )
    .join('')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(payload.title)} - ${escapeHtml(payload.originalCutOrderNo)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 32px; color: #111827; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 20px 0; }
          .meta-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
          .label { font-size: 12px; color: #6b7280; }
          .value { margin-top: 4px; font-size: 14px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .note { margin-top: 16px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>发料清单</h1>
        <div class="meta">
          <div class="meta-item"><div class="label">原始裁片单号</div><div class="value">${escapeHtml(payload.originalCutOrderNo)}</div></div>
          <div class="meta-item"><div class="label">同一码 / 二维码</div><div class="value">${payload.shouldPrintQr ? `${escapeHtml(payload.sameCodeValue)} / ${escapeHtml(payload.qrCodeValue)}` : escapeHtml(payload.qrHiddenHint)}</div></div>
          <div class="meta-item"><div class="label">来源生产单号</div><div class="value">${escapeHtml(payload.productionOrderNo)}</div></div>
          <div class="meta-item"><div class="label">款号 / SPU</div><div class="value">${escapeHtml(`${payload.styleCode || payload.spuCode} / ${payload.styleName || payload.spuCode}`)}</div></div>
          <div class="meta-item"><div class="label">打印时间</div><div class="value">${escapeHtml(payload.printTime)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>materialSku</th>
              <th>面料类别</th>
              <th>需求量</th>
              <th>已配置量</th>
              <th>已领取量</th>
              <th>缺口量</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="note">
          发料清单上的码回落原始裁片单。本清单只承接仓库到裁床之间的物料准备，不构成新的主体单据。
        </div>
      </body>
    </html>
  `)
  printWindow.document.close()

  row.printedAt = nowText()
  row.printedBy = '仓库配料页打印'
  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  setFeedback('success', `${row.originalCutOrderNo} 已打开发料清单打印视图。`)

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 120)

  return true
}

export function renderCraftCuttingMaterialPrepPage(): string {
  return renderPage()
}

export function handleCraftCuttingMaterialPrepEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-prep-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-cutting-prep-field]')
  if (filterNode) {
    const field = filterNode.dataset.cuttingPrepField as FilterField | undefined
    if (!field) return false
    const filterKey = FIELD_TO_FILTER_KEY[field]
    const input = filterNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [filterKey]: input.value,
    }
    resetPagination()
    return true
  }

  const configFieldNode = target.closest<HTMLElement>('[data-cutting-prep-config-line-id]')
  if (configFieldNode) {
    const lineId = configFieldNode.dataset.cuttingPrepConfigLineId
    if (!lineId) return false
    const input = configFieldNode as HTMLInputElement
    state.configDrafts = {
      ...state.configDrafts,
      [lineId]: input.value,
    }
    return true
  }

  const claimFieldNode = target.closest<HTMLElement>('[data-cutting-prep-claim-line-id]')
  if (claimFieldNode) {
    const lineId = claimFieldNode.dataset.cuttingPrepClaimLineId
    if (!lineId) return false
    const input = claimFieldNode as HTMLInputElement
    state.claimDrafts = {
      ...state.claimDrafts,
      [lineId]: input.value,
    }
    return true
  }

  const claimInputNode = target.closest<HTMLElement>('[data-cutting-prep-claim-field]')
  if (claimInputNode) {
    const field = claimInputNode.dataset.cuttingPrepClaimField
    if (!field) return false
    const input = claimInputNode as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    if (field === 'result') {
      state.claimResult = input.value as ClaimDraftResult
    }
    if (field === 'note') {
      state.claimNote = input.value
    }
    return true
  }

  const scheduleFieldNode = target.closest<HTMLElement>('[data-cutting-prep-schedule-field]')
  if (scheduleFieldNode) {
    const field = scheduleFieldNode.dataset.cuttingPrepScheduleField
    if (field !== 'cuttingGroup') return false
    const input = scheduleFieldNode as HTMLInputElement
    state.scheduleDraft = input.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-prep-action]')
  const action = actionNode?.dataset.cuttingPrepAction
  if (!action) return false

  if (action === 'toggle-issues-only') {
    state.filters.issuesOnly = !state.filters.issuesOnly
    resetPagination()
    return true
  }

  if (action === 'toggle-printable-only') {
    state.filters.onlyPrintable = !state.filters.onlyPrintable
    resetPagination()
    return true
  }

  if (action === 'toggle-pending-scheduling') {
    state.filters.onlyPendingScheduling = !state.filters.onlyPendingScheduling
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
    state.activeOrderId = null
    state.querySignature = getCanonicalCuttingPath('material-prep')
    appStore.navigate(getCanonicalCuttingPath('material-prep'))
    return true
  }

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    return true
  }

  if (action === 'open-detail') {
    state.activeOrderId = actionNode.dataset.recordId ?? null
    state.activeDialog = null
    return true
  }

  if (action === 'open-config-dialog') {
    return openDialog('CONFIG', actionNode.dataset.recordId)
  }

  if (action === 'open-claim-dialog') {
    return openDialog('CLAIM', actionNode.dataset.recordId)
  }

  if (action === 'open-schedule-dialog') {
    return openDialog('SCHEDULE', actionNode.dataset.recordId)
  }

  if (action === 'open-records-dialog') {
    return openDialog('RECORDS', actionNode.dataset.recordId)
  }

  if (action === 'fill-claim-success') {
    const row = getActiveRow()
    if (!row) return false
    state.claimResult = 'SUCCESS'
    state.claimDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.requiredQty)]))
    return true
  }

  if (action === 'save-config') {
    return saveConfig()
  }

  if (action === 'save-claim') {
    return saveClaim()
  }

  if (action === 'save-schedule') {
    return saveSchedule()
  }

  if (action === 'print-issue-list') {
    return printIssueList(actionNode.dataset.recordId || state.activeOrderId || undefined)
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  if (action === 'go-original-orders') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'originalOrders')
  }

  if (action === 'go-marker-spreading') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'markerSpreading')
  }

  if (action === 'go-summary') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'summary')
  }

  if (action === 'go-production-progress') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'productionProgress')
  }

  if (action === 'go-merge-batches') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'mergeBatches')
  }

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-marker-spreading-index') {
    appStore.navigate(buildRouteWithQuery(getCanonicalCuttingPath('marker-spreading'), { tab: 'spreadings' }))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingMaterialPrepDialogOpen(): boolean {
  return state.activeOrderId !== null || state.activeDialog !== null
}
