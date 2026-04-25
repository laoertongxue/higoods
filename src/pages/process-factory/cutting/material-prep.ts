// 本文件继续复用旧导出名承接 canonical 页面“仓库配料领料”。
// 页面主对象冻结为原始裁片单；同一码回落原始裁片单，配料 / 领料只表达仓库到裁床的准备衔接。
import { renderDetailDrawer as uiDetailDrawer, renderDialog as uiDialog, renderFormDialog as uiFormDialog } from '../../../components/ui/index.ts'
import { listTransferMaterialAvailableLots } from '../../../data/fcs/cutting/material-prep.ts'
import {
  ACTION_PERMISSION_DENIED_TEXT,
  canConfigureFabricMaterial,
  resolveFcsDemoRole,
} from '../../../data/fcs/action-permissions.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildCuttingOrderQrLabelPrintLink,
  buildMaterialPrepSlipPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { getPrepQrHiddenText } from './material-prep.helpers.ts'
import {
  buildMaterialPrepNavigationPayload,
  buildMaterialPrepStats,
  buildSameCodeValue,
  deriveMaterialClaimStatus,
  deriveMaterialPrepStatus,
  deriveSchedulingStatus,
  filterMaterialPrepRows,
  findMaterialPrepRowByPrefilter,
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
} from './material-prep-model.ts'
import { buildMaterialPrepProjection } from './material-prep-projection.ts'
import { urgencyMeta } from './production-progress-model.ts'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta.ts'
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

type FilterField =
  | 'keyword'
  | 'productionOrderNo'
  | 'styleKeyword'
  | 'materialPrepStatus'
  | 'materialClaimStatus'
  | 'schedulingStatus'
  | 'cuttingGroup'
  | 'materialSku'

type DialogType = 'CONFIG' | 'CLAIM' | 'SCHEDULE' | 'RECORDS'
type FeedbackTone = 'success' | 'warning'
type ClaimDraftResult = 'CONFIRM' | 'REJECT' | 'EXCEPTION_SUBMIT'

let sourceRecordMap = new Map<string, import('../../../data/fcs/cutting/types.ts').CuttingOrderProgressRecord>()

const initialFilters: MaterialPrepFilters = {
  keyword: '',
  productionOrderNo: '',
  styleKeyword: '',
  materialPrepStatus: 'ALL',
  materialClaimStatus: 'ALL',
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
  drillContext: CuttingDrillContext | null
  feedback: MaterialPrepFeedback | null
  configDrafts: Record<string, string>
  claimDrafts: Record<string, string>
  claimRollDrafts: Record<string, string>
  claimResult: ClaimDraftResult
  claimNote: string
  claimPhotoDraft: string
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
  drillContext: null,
  feedback: null,
  configDrafts: {},
  claimDrafts: {},
  claimRollDrafts: {},
  claimResult: 'CONFIRM',
  claimNote: '',
  claimPhotoDraft: '',
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
  const projection = buildMaterialPrepProjection()
  state.rows = projection.rows.map((row) => ({
    ...row,
    materialLineItems: row.materialLineItems.map((item) => ({ ...item })),
    claimRecords: row.claimRecords.map((record) => ({ ...record })),
    claimDisputes: row.claimDisputes.map((record) => ({ ...record })),
    riskTags: row.riskTags.map((tag) => ({ ...tag })),
  }))
  sourceRecordMap = new Map(
    Object.entries(projection.progressRecordMapByOriginalCutOrder).flatMap(([key, record]) =>
      key ? [[key, record] as const] : [],
    ),
  )
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
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: MaterialPrepPrefilter = {}

  const entries: Array<[keyof MaterialPrepPrefilter, string | null]> = [
    ['productionOrderId', drillContext?.productionOrderId || params.get('productionOrderId')],
    ['productionOrderNo', drillContext?.productionOrderNo || params.get('productionOrderNo')],
    ['originalCutOrderId', drillContext?.originalCutOrderId || params.get('originalCutOrderId')],
    ['originalCutOrderNo', drillContext?.originalCutOrderNo || params.get('originalCutOrderNo')],
    ['styleCode', drillContext?.styleCode || params.get('styleCode')],
    ['spuCode', drillContext?.spuCode || params.get('spuCode')],
    ['materialSku', drillContext?.materialSku || params.get('materialSku')],
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

  state.drillContext = readCuttingDrillContextFromLocation(getCurrentSearchParams())
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
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-original-orders-index">返回原始裁片单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-marker-plan-index">去唛架</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-summary-index">查看裁剪总表</button>
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
  if (state.filters.schedulingStatus !== 'ALL') labels.push(`排单：${materialSchedulingMeta[state.filters.schedulingStatus].label}`)
  if (state.filters.cuttingGroup) labels.push(`裁床组：${state.filters.cuttingGroup}`)
  if (state.filters.issuesOnly) labels.push('仅看异常项')
  if (state.filters.onlyPrintable) labels.push('仅看可打印项')
  if (state.filters.onlyPendingScheduling) labels.push('仅看待排单')

  return labels
}

function renderPrefilterBar(): string {
  const labels = Array.from(new Set([...buildCuttingDrillChipLabels(state.drillContext), ...getPrefilterLabels()]))
  if (!labels.length) return ''
  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前预筛条件',
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

function renderPrepCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      <div class="flex flex-wrap gap-1">
        ${renderBadge(row.materialPrepStatus.label, row.materialPrepStatus.className)}
        ${row.hasReplenishmentPendingPrep ? renderBadge('补料待配料', 'bg-amber-100 text-amber-700') : ''}
      </div>
      <p class="text-xs text-muted-foreground">${escapeHtml(summarizeMaterialLineItems(row.materialLineItems))}</p>
      ${
        row.hasReplenishmentPendingPrep
          ? `<p class="text-xs text-amber-700">${escapeHtml(`补料待配料 ${row.replenishmentPendingPrepCount} 条`)}</p>`
          : ''
      }
    </div>
  `
}

function renderClaimCell(row: MaterialPrepRow): string {
  return `
    <div class="space-y-1">
      ${renderBadge(row.materialClaimStatus.label, row.materialClaimStatus.className)}
      <p class="text-xs text-muted-foreground">${escapeHtml(row.latestClaimRecordSummary)}</p>
      <p class="text-xs text-muted-foreground">${escapeHtml(row.materialLineItems.map((item) => `${item.claimedRollCount}/${item.configuredRollCount} 卷`).join(' · ') || '待填写实领卷数')}</p>
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
      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.qrCodeLabel)}</p>
    </div>
  `
}

function renderEmptyTableState(): string {
  return `
    <tr>
      <td colspan="13" class="px-4 py-16 text-center text-sm text-muted-foreground">暂无匹配结果</td>
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
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条原始裁片单</div>
      </div>
      ${renderStickyTableScroller(`
        <table class="w-full min-w-[1720px] text-sm">
          <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
            <tr>
              <th class="px-4 py-3 text-left font-medium">原始裁片单号</th>
              <th class="px-4 py-3 text-left font-medium">裁片单二维码</th>
              <th class="px-4 py-3 text-left font-medium">来源生产单号</th>
              <th class="px-4 py-3 text-left font-medium">款号 / SPU</th>
              <th class="px-4 py-3 text-left font-medium">面料摘要</th>
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
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-nav="${escapeHtml(buildMaterialPrepSlipPrintLink(row.id))}">打印配料单</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-nav="${escapeHtml(buildCuttingOrderQrLabelPrintLink(row.originalCutOrderId))}">打印裁片单二维码</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="open-records-dialog" data-record-id="${escapeHtml(row.id)}">查看领料记录</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="open-schedule-dialog" data-record-id="${escapeHtml(row.id)}">分配裁床组</button>
                              <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-prep-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去唛架</button>
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
            <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
            <th class="px-3 py-2 text-left font-medium">面料类型 / 颜色</th>
            <th class="px-3 py-2 text-left font-medium">需求长度</th>
            <th class="px-3 py-2 text-left font-medium">配置卷数 / 长度</th>
            <th class="px-3 py-2 text-left font-medium">实领卷数 / 长度</th>
            <th class="px-3 py-2 text-left font-medium">缺口量</th>
            <th class="px-3 py-2 text-left font-medium">来源</th>
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
                    <div>${escapeHtml(item.materialTypeName)}</div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.materialAttr)}</p>
                  </td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.requiredQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">
                    <div>${escapeHtml(`${item.configuredRollCount} 卷`)}</div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${formatQty(item.configuredQty)} 米`)}</p>
                  </td>
                  <td class="px-3 py-2 align-top">
                    <div>${escapeHtml(`${item.claimedRollCount} 卷`)}</div>
                    <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${formatQty(item.claimedQty)} 米`)}</p>
                  </td>
                  <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.shortageQty)} 米`)}</td>
                  <td class="px-3 py-2 align-top">
                    <div class="flex flex-wrap gap-1">
                      ${renderBadge(item.sourceLabel || '手动配置', item.sourceType === 'REPLENISHMENT_PENDING_PREP' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700')}
                    </div>
                    ${
                      item.sourceType === 'REPLENISHMENT_PENDING_PREP'
                        ? `
                            <p class="mt-1 text-xs text-muted-foreground">缺口成衣件数 ${escapeHtml(String(item.replenishmentPendingPrepQty || 0))} 件</p>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`来源铺布：${item.sourceSpreadingSessionId || '待补'} / 来源补料单：${item.sourceReplenishmentRequestId || '待补'}`)}</p>
                          `
                        : ''
                    }
                  </td>
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

function renderReplenishmentPendingPrepSection(row: MaterialPrepRow): string {
  if (!row.replenishmentPendingPrepItems.length) {
    return renderDetailSection(
      '补料待配料',
      '<div class="text-sm text-muted-foreground">当前没有补料审批通过后生成的待配料记录。</div>',
    )
  }

  return renderDetailSection(
    '补料待配料',
    `
      <div class="overflow-x-auto">
        <table class="w-full min-w-[920px] text-sm">
          <thead class="border-b bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">原始裁片单</th>
              <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
              <th class="px-3 py-2 text-left font-medium">颜色</th>
              <th class="px-3 py-2 text-left font-medium">缺口成衣件数（件）</th>
              <th class="px-3 py-2 text-left font-medium">来源</th>
              <th class="px-3 py-2 text-left font-medium">状态</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${row.replenishmentPendingPrepItems
              .map(
                (item) => `
                  <tr>
                    <td class="px-3 py-2 align-top">
                      <div class="font-medium">${escapeHtml(item.originalCutOrderNo || item.originalCutOrderId)}</div>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.originalCutOrderId)}</p>
                    </td>
                    <td class="px-3 py-2 align-top">${escapeHtml(item.materialSku)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(item.color || row.color || '待补')}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(`${formatQty(item.shortageGarmentQty)} 件`)}</td>
                    <td class="px-3 py-2 align-top">
                      ${renderBadge('补料待配料', 'bg-amber-100 text-amber-700')}
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '来源补料审批通过')}</p>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`来源铺布：${item.sourceSpreadingSessionId || '待补'} / 来源补料单：${item.sourceReplenishmentRequestId || '待补'}`)}</p>
                    </td>
                    <td class="px-3 py-2 align-top">${renderBadge('待配料', 'bg-orange-100 text-orange-700')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `,
  )
}

function renderTransferMaterialSection(row: MaterialPrepRow): string {
  const canConfigure = canConfigureFabricMaterial(resolveFcsDemoRole('WAREHOUSE_OPERATOR'))
  const lots = listTransferMaterialAvailableLots().filter((lot) =>
    row.materialLineItems.some(
      (item) =>
        item.materialSku === lot.materialSku &&
        ((item.sourceType === 'PRINT_REVIEW' && lot.sourceProcessType === 'PRINT') ||
          (item.sourceType === 'DYE_REVIEW' && lot.sourceProcessType === 'DYE') ||
          (item.sourceType === 'MANUAL' && lot.sourceProcessType === 'MANUAL')),
    ),
  )

  if (!lots.length) {
    return renderDetailSection(
      '中转可配置面料',
      '<div class="text-sm text-muted-foreground">暂无数据</div>',
    )
  }

  return renderDetailSection(
    '中转可配置面料',
    `
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1040px] text-sm">
          <thead class="border-b bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">来源</th>
              <th class="px-3 py-2 text-left font-medium">来源单号</th>
              <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
              <th class="px-3 py-2 text-left font-medium">布料颜色</th>
              <th class="px-3 py-2 text-left font-medium">可配置卷数</th>
              <th class="px-3 py-2 text-left font-medium">可配置长度</th>
              <th class="px-3 py-2 text-left font-medium">剩余卷数</th>
              <th class="px-3 py-2 text-left font-medium">剩余长度</th>
              <th class="px-3 py-2 text-left font-medium">状态</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${lots
              .map(
                (lot) => `
                  <tr>
                    <td class="px-3 py-2 align-top">${escapeHtml(lot.sourceProcessType === 'PRINT' ? '印花来源' : lot.sourceProcessType === 'DYE' ? '染色来源' : '手动来源')}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(lot.sourceOrderNo || '手动补充')}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(lot.materialSku)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(lot.materialColor)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(`${lot.availableRollCount} 卷`)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(`${lot.availableLength} ${lot.lengthUnit}`)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(`${lot.remainingRollCount} 卷`)}</td>
                    <td class="px-3 py-2 align-top">${escapeHtml(`${lot.remainingLength} ${lot.lengthUnit}`)}</td>
                    <td class="px-3 py-2 align-top">${renderBadge(lot.reviewStatus === 'MANUAL_READY' ? '已配置' : '待审核', lot.reviewStatus === 'MANUAL_READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}</td>
                    <td class="px-3 py-2 align-top">
                      <button
                        type="button"
                        class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        data-cutting-prep-action="open-config-dialog"
                        data-record-id="${escapeHtml(row.id)}"
                        ${canConfigure ? '' : `title="${ACTION_PERMISSION_DENIED_TEXT}" disabled`}
                      >
                        配置面料 - 布料
                      </button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `,
  )
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
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.note || '—')}</div>
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
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-cutting-prep-action="open-config-dialog" data-record-id="${escapeHtml(row.id)}" ${canConfigureFabricMaterial(resolveFcsDemoRole('WAREHOUSE_OPERATOR')) ? '' : `title="${ACTION_PERMISSION_DENIED_TEXT}" disabled`}>编辑配置结果</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="open-claim-dialog" data-record-id="${escapeHtml(row.id)}">裁床领料</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="open-schedule-dialog" data-record-id="${escapeHtml(row.id)}">分配裁床组</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(buildMaterialPrepSlipPrintLink(row.id))}">打印配料单</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(buildCuttingOrderQrLabelPrintLink(row.originalCutOrderId))}">打印裁片单二维码</button>
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
                    { label: '裁片单二维码', value: row.qrCodeLabel, hint: row.sameCodeValue },
                  ]
                : []),
              { label: '来源生产单号', value: row.productionOrderNo },
              { label: '款号 / SPU', value: `${row.styleCode || row.spuCode} / ${row.styleName || row.spuCode}` },
              { label: '颜色', value: row.color },
              { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
              { label: '紧急程度', value: row.urgencyLabel },
              { label: '关联合并裁剪批次', value: row.latestMergeBatchNo || '未关联合并裁剪批次' },
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
      ${renderTransferMaterialSection(row)}
      ${renderReplenishmentPendingPrepSection(row)}

      ${renderDetailSection(
        '配料单',
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
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildMaterialPrepSlipPrintLink(row.id))}">打印配料单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildCuttingOrderQrLabelPrintLink(row.originalCutOrderId))}">打印裁片单二维码</button>
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
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-original-orders" data-record-id="${escapeHtml(row.id)}">去来源原始裁片单</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-marker-plan" data-record-id="${escapeHtml(row.id)}">去来源唛架</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去来源铺布</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回生产单进度</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-summary" data-record-id="${escapeHtml(row.id)}">去裁剪总表</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-prep-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}">
              去来源合并裁剪批次
            </button>
          </div>
        `,
      )}
    </div>
  `

  return uiDetailDrawer(
    {
      title: row.originalCutOrderNo,
      subtitle: '',
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
        { label: '仓库配置长度（m）', value: `${dispute.configuredQty} 米` },
        { label: '默认应领长度（m）', value: `${dispute.defaultClaimQty} 米` },
        { label: '实际领取长度（m）', value: `${dispute.actualClaimQty} 米`, tone: 'strong' },
        { label: '差异长度（m）', value: `${dispute.discrepancyQty} 米`, tone: 'strong' },
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
        当前操作对象：${escapeHtml(row.originalCutOrderNo)} · 已绑定裁片单二维码
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
      description: '',
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
      <div class="rounded-lg border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
        当前操作对象：${escapeHtml(row.originalCutOrderNo)} · 已绑定裁片单二维码
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-prep-action="fill-claim-success">回填一致卷数</button>
      </div>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">领料处理</span>
        <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-prep-claim-field="result">
          <option value="CONFIRM" ${state.claimResult === 'CONFIRM' ? 'selected' : ''}>确认领料</option>
          <option value="REJECT" ${state.claimResult === 'REJECT' ? 'selected' : ''}>驳回</option>
          <option value="EXCEPTION_SUBMIT" ${state.claimResult === 'EXCEPTION_SUBMIT' ? 'selected' : ''}>异常提交</option>
        </select>
      </label>
      ${row.materialLineItems
        .map(
          (item) => `
            <article class="rounded-lg border px-3 py-3">
              <div class="font-medium">${escapeHtml(item.materialSku)}</div>
              <p class="mt-1 text-xs text-muted-foreground">配置 ${escapeHtml(`${item.configuredRollCount} 卷 / ${formatQty(item.configuredQty)} 米`)} · 当前已领 ${escapeHtml(`${item.claimedRollCount} 卷 / ${formatQty(item.claimedQty)} 米`)}</p>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">实领卷数</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.claimRollDrafts[item.materialLineId] ?? String(item.claimedRollCount))}"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    data-cutting-prep-claim-roll-line-id="${item.materialLineId}"
                  />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">实领长度</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(state.claimDrafts[item.materialLineId] ?? String(item.claimedQty))}"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    data-cutting-prep-claim-line-id="${item.materialLineId}"
                  />
                </label>
              </div>
            </article>
          `,
        )
        .join('')}
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">差异原因</span>
        <textarea
          class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="填写差异原因"
          data-cutting-prep-claim-field="note"
        >${escapeHtml(state.claimNote)}</textarea>
      </label>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">照片</span>
        <input
          type="text"
          value="${escapeHtml(state.claimPhotoDraft)}"
          placeholder="上传照片"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          data-cutting-prep-claim-field="photo"
        />
        ${state.claimResult === 'EXCEPTION_SUBMIT' && !state.claimPhotoDraft.trim() ? '<p class="text-xs text-rose-600">请上传照片</p>' : ''}
      </label>
    </div>
  `

  return uiFormDialog(
    {
      title: '裁床领料',
      description: '',
      closeAction: { prefix: 'cuttingPrep', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingPrep', action: 'save-claim', label: state.claimResult === 'CONFIRM' ? '确认领料' : state.claimResult === 'REJECT' ? '驳回' : '异常提交' },
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
    </div>
  `

  return uiFormDialog(
    {
      title: '分配裁床组',
      description: '',
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
      description: '',
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
  state.claimRollDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.claimedRollCount)]))
  state.claimResult = row.materialClaimStatus.key === 'EXCEPTION' ? 'EXCEPTION_SUBMIT' : 'CONFIRM'
  state.claimNote = row.claimRecords[0]?.note || ''
  state.claimPhotoDraft = ''
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
  target: keyof MaterialPrepRow['navigationPayload'] | 'markerPlan' | 'spreadingList',
): boolean {
  const row = getRecordById(recordId)
  if (!row) return false
  const payload =
    target === 'markerPlan' || target === 'spreadingList'
      ? row.navigationPayload.markerSpreading
      : row.navigationPayload[target]
  const context = normalizeLegacyCuttingPayload(payload, 'material-prep', {
    productionOrderNo: row.productionOrderNo,
    originalCutOrderId: row.originalCutOrderId,
    originalCutOrderNo: row.originalCutOrderNo,
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    materialSku: row.materialLineItems[0]?.materialSku || undefined,
    autoOpenDetail: true,
  })
  appStore.navigate(
    buildCuttingRouteWithContext(
      target === 'markerPlan' ? 'markerPlan' : target === 'spreadingList' ? 'spreadingList' : (target as CuttingNavigationTarget),
      context,
    ),
  )
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

  const receivedRolls = row.materialLineItems.map((item) => ({
    item,
    rollCount: Math.max(0, Number(state.claimRollDrafts[item.materialLineId] || 0) || 0),
    length: Math.max(0, Number(state.claimDrafts[item.materialLineId] || 0) || 0),
  }))
  const hasEmptyRollCount = row.materialLineItems.some(
    (item) => String(state.claimRollDrafts[item.materialLineId] ?? '').trim() === '',
  )
  if (hasEmptyRollCount) {
    setFeedback('warning', '请填写实领卷数。')
    return true
  }

  const hasRollDiff = receivedRolls.some(({ item, rollCount }) => rollCount !== item.configuredRollCount)
  if (state.claimResult === 'CONFIRM' && hasRollDiff) {
    setFeedback('warning', '实领卷数不一致，请驳回或异常提交。')
    return true
  }
  if (state.claimResult !== 'CONFIRM' && !hasRollDiff) {
    setFeedback('warning', '卷数一致时请直接确认领料。')
    return true
  }
  if (state.claimResult !== 'CONFIRM' && !state.claimNote.trim()) {
    setFeedback('warning', '请填写差异原因。')
    return true
  }
  if (state.claimResult === 'EXCEPTION_SUBMIT' && !state.claimPhotoDraft.trim()) {
    setFeedback('warning', '请上传照片。')
    return true
  }

  row.materialLineItems = row.materialLineItems.map((item) => {
    const draft = receivedRolls.find((entry) => entry.item.materialLineId === item.materialLineId)
    const nextQty = state.claimResult === 'CONFIRM' ? item.configuredQty : draft?.length || item.claimedQty
    const nextRollCount = state.claimResult === 'CONFIRM' ? item.configuredRollCount : draft?.rollCount || item.claimedRollCount
    const actionText =
      state.claimResult === 'CONFIRM'
        ? `已领料：实领 ${nextRollCount} 卷。`
        : state.claimResult === 'REJECT'
          ? `已驳回：实领 ${nextRollCount} 卷，${state.claimNote.trim()}`
          : `异常提交：实领 ${nextRollCount} 卷，已上传照片。`
    return {
      ...item,
      claimedQty: nextQty,
      claimedRollCount: nextRollCount,
      hasClaimException: state.claimResult !== 'CONFIRM',
      note: state.claimNote || item.note,
      latestActionText: actionText,
    }
  })

  row.claimRecords.unshift({
    claimRecordId: `${row.originalCutOrderId}-${Date.now()}`,
    originalCutOrderId: row.originalCutOrderId,
    claimedAt: nowText(),
    claimedBy: '仓库配料页回写',
    result: state.claimResult === 'CONFIRM' ? 'SUCCESS' : state.claimResult === 'REJECT' ? 'PARTIAL' : 'EXCEPTION',
    summary:
      state.claimResult === 'CONFIRM'
        ? '已领料'
        : state.claimResult === 'REJECT'
          ? '已驳回'
          : '异常提交',
    note:
      state.claimResult === 'EXCEPTION_SUBMIT'
        ? `${state.claimNote || '存在差异'}；照片：${state.claimPhotoDraft}`
        : state.claimNote || '仓库领料结果已在原型页补录。',
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

  row.printedAt = nowText()
  row.printedBy = '仓库配料页统一打印'
  recalculateMaterialPrepRow(row, sourceRecordMap.get(row.id))
  setFeedback('success', `${row.originalCutOrderNo} 已进入统一配料单打印预览。`)
  appStore.navigate(buildMaterialPrepSlipPrintLink(row.id))
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

  const claimRollFieldNode = target.closest<HTMLElement>('[data-cutting-prep-claim-roll-line-id]')
  if (claimRollFieldNode) {
    const lineId = claimRollFieldNode.dataset.cuttingPrepClaimRollLineId
    if (!lineId) return false
    const input = claimRollFieldNode as HTMLInputElement
    state.claimRollDrafts = {
      ...state.claimRollDrafts,
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
    if (field === 'photo') {
      state.claimPhotoDraft = input.value
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
    state.drillContext = null
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
    if (!canConfigureFabricMaterial(resolveFcsDemoRole('WAREHOUSE_OPERATOR'))) {
      setFeedback('warning', ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
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
    state.claimResult = 'CONFIRM'
    state.claimDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.configuredQty)]))
    state.claimRollDrafts = Object.fromEntries(row.materialLineItems.map((item) => [item.materialLineId, String(item.configuredRollCount)]))
    return true
  }

  if (action === 'save-config') {
    if (!canConfigureFabricMaterial(resolveFcsDemoRole('WAREHOUSE_OPERATOR'))) {
      setFeedback('warning', ACTION_PERMISSION_DENIED_TEXT)
      return true
    }
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

  if (action === 'go-marker-plan') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'markerPlan')
  }

  if (action === 'go-marker-spreading') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'spreadingList')
  }

  if (action === 'go-summary') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'summary')
  }

  if (action === 'go-production-progress') {
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'productionProgress')
  }

  if (action === 'go-merge-batches') {
    const row = getRecordById(actionNode.dataset.recordId || state.activeOrderId || undefined)
    if (!row?.latestMergeBatchNo) {
      setFeedback('warning', '当前没有关联的合并裁剪批次，无法跳转。')
      return true
    }
    return navigateToRowTarget(actionNode.dataset.recordId || state.activeOrderId || undefined, 'mergeBatches')
  }

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
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

export function isCraftCuttingMaterialPrepDialogOpen(): boolean {
  return state.activeOrderId !== null || state.activeDialog !== null
}
