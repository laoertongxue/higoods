// 旧 renderer 继续承接新的 canonical 页面“裁片单（原始单）”。
// 本页主对象冻结为原始裁片单；生产单只作为来源关系，合并裁剪批次只作为执行层关联记录。
import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { buildCuttablePoolViewModel } from './cuttable-pool-model'
import {
  buildSystemSeedMergeBatches,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model'
import {
  buildOriginalCutOrderStats,
  buildOriginalCutOrderViewModel,
  filterOriginalCutOrderRows,
  findOriginalCutOrderByPrefilter,
  formatOriginalOrderCurrency,
  originalOrderCuttableMeta,
  originalOrderStageMeta,
  type OriginalCutOrderFilters,
  type OriginalCutOrderPrefilter,
  type OriginalCutOrderRow,
} from './original-orders-model'
import { configMeta, receiveMeta } from './production-progress-model'
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
}

const state: OriginalOrdersPageState = {
  filters: { ...initialFilters },
  activeOrderId: null,
  page: 1,
  pageSize: 20,
  querySignature: '',
  prefilter: null,
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
  const cuttablePoolView = buildCuttablePoolViewModel(cuttingOrderProgressRecords)
  const systemSeed = buildSystemSeedMergeBatches(Object.values(cuttablePoolView.itemsById))
  const merged = new Map(systemSeed.map((batch) => [batch.mergeBatchId, batch]))

  for (const batch of readStoredLedger()) {
    merged.set(batch.mergeBatchId, batch)
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN') ||
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
}

function getViewModel() {
  return buildOriginalCutOrderViewModel(cuttingOrderProgressRecords, getMergeBatchLedger())
}

function parsePrefilterFromPath(): OriginalCutOrderPrefilter | null {
  const params = getCurrentSearchParams()
  const nextPrefilter: OriginalCutOrderPrefilter = {}

  const productionOrderId = params.get('productionOrderId') || ''
  const productionOrderNo = params.get('productionOrderNo') || ''
  const originalCutOrderId = params.get('originalCutOrderId') || ''
  const originalCutOrderNo = params.get('originalCutOrderNo') || ''
  const mergeBatchId = params.get('mergeBatchId') || ''
  const mergeBatchNo = params.get('mergeBatchNo') || ''
  const styleCode = params.get('styleCode') || ''
  const spuCode = params.get('spuCode') || ''
  const materialSku = params.get('materialSku') || ''

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

function buildStatsCards(rows: OriginalCutOrderRow[]): string {
  const stats = buildOriginalCutOrderStats(rows)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('原始裁片单总数', stats.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('当前可裁数', stats.cuttableCount, '满足审核 / 配料 / 领料条件', 'text-emerald-600')}
      ${renderCompactKpiCard('已入批次数', stats.inBatchCount, '已进入执行层批次', 'text-violet-600')}
      ${renderCompactKpiCard('配料异常数', stats.prepExceptionCount, '审核或配料未齐', 'text-amber-600')}
      ${renderCompactKpiCard('领料异常数', stats.claimExceptionCount, '待领料或领料差异', 'text-rose-600')}
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
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress-index">返回生产单进度</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep-index">去仓库配料 / 领料</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-spreading-index">去唛架 / 铺布</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter) return labels

  if (prefilter.productionOrderNo) labels.push(`预筛：生产单 ${prefilter.productionOrderNo}`)
  if (prefilter.originalCutOrderNo) labels.push(`预筛：原始裁片单 ${prefilter.originalCutOrderNo}`)
  if (prefilter.mergeBatchNo) labels.push(`预筛：批次 ${prefilter.mergeBatchNo}`)
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
  if (state.filters.cuttableState !== 'ALL') labels.push(`可裁状态：${originalOrderCuttableMeta[state.filters.cuttableState].label}`)
  if (state.filters.prepStatus !== 'ALL') labels.push(`配料状态：${configMeta[state.filters.prepStatus].label}`)
  if (state.filters.claimStatus !== 'ALL') labels.push(`领料状态：${receiveMeta[state.filters.claimStatus].label}`)
  if (state.filters.inBatch === 'IN_BATCH') labels.push('仅看已入批次')
  if (state.filters.inBatch === 'NOT_IN_BATCH') labels.push('仅看未入批次')
  if (state.filters.riskOnly) labels.push('仅看异常项')

  return labels
}

function renderPrefilterBar(): string {
  const labels = getPrefilterLabels()
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前预筛条件',
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
          { value: 'ALL', label: '全部可裁状态' },
          ...Object.entries(originalOrderCuttableMeta).map(([value, meta]) => ({ value, label: meta.label })),
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
        ${renderFilterSelect('是否已入批次', 'inBatch', state.filters.inBatch, [
          { value: 'ALL', label: '全部' },
          { value: 'IN_BATCH', label: '仅看已入批次' },
          { value: 'NOT_IN_BATCH', label: '仅看未入批次' },
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
    return '<span class="text-xs text-muted-foreground">未参与批次</span>'
  }

  return `
    <div class="space-y-1">
      <button type="button" class="text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-piece-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}">
        ${escapeHtml(row.latestMergeBatchNo || row.mergeBatchNos[0] || '查看批次')}
      </button>
      <p class="text-xs text-muted-foreground">共参与 ${escapeHtml(String(row.batchParticipationCount))} 个批次</p>
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
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">原始裁片单主表</h2>
          <p class="mt-1 text-xs text-muted-foreground">一行一个原始裁片单，生产单仅作为来源关系，批次只作为执行层关联记录。</p>
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
                <th class="px-4 py-3 text-left font-medium">数量 / 卖价</th>
                <th class="px-4 py-3 text-left font-medium">日期信息</th>
                <th class="px-4 py-3 text-left font-medium">当前阶段</th>
                <th class="px-4 py-3 text-left font-medium">可裁状态</th>
                <th class="px-4 py-3 text-left font-medium">关联批次</th>
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
                              <div>下单 ${escapeHtml(formatCount(row.orderQty))}</div>
                              <p class="mt-1 text-xs text-muted-foreground">卖价 ${escapeHtml(formatOriginalOrderCurrency(row.sellingPrice))}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                <p>采购：${escapeHtml(formatDate(row.purchaseDate))}</p>
                                <p>下单：${escapeHtml(formatDate(row.actualOrderDate))}</p>
                                <p>发货：${escapeHtml(formatDate(row.plannedShipDate))}</p>
                              </div>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBadge(row.currentStage.label, row.currentStage.className)}
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.statusSummary)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBadge(row.cuttableState.label, row.cuttableState.className)}
                              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.cuttableState.reasonText)}</p>
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderBatchSummary(row)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              ${renderRiskTags(row.riskTags)}
                            </td>
                            <td class="px-4 py-3 align-top">
                              <div class="flex flex-wrap gap-2">
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="open-detail" data-record-id="${escapeHtml(row.id)}">查看详情</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">查看配料</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去唛架 / 铺布</button>
                                <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去菲票 / 打编号</button>
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

function renderDetailDrawer(viewModel = getViewModel()): string {
  const row = getActiveRow(viewModel)
  if (!row) return ''

  const siblingRows = viewModel.rows.filter(
    (item) => item.productionOrderId === row.productionOrderId && item.originalCutOrderId !== row.originalCutOrderId,
  )

  const batchParticipationText = row.batchParticipationCount
    ? `已参与 ${row.batchParticipationCount} 个批次，最新批次 ${row.latestMergeBatchNo || '待补'}。`
    : '当前尚未进入任何合并裁剪批次。'

  const extraButtons = `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去配料</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去铺布</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去菲票</button>
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
          { label: '下单数量', value: `${formatCount(row.orderQty)} 件` },
          { label: '采购日期', value: formatDate(row.purchaseDate) },
          { label: '实际下单日期', value: formatDate(row.actualOrderDate) },
          { label: '计划发货日期', value: formatDate(row.plannedShipDate) },
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
              ${renderBadge(row.materialAuditStatus.label, row.materialAuditStatus.className)}
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
        '批次参与记录',
        `
          <div class="space-y-3">
            ${renderInfoGrid([
              { label: '最新批次号', value: row.latestMergeBatchNo || '未入批次' },
              { label: '参与批次数', value: `${row.batchParticipationCount} 次` },
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
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted ${row.batchParticipationCount ? '' : 'pointer-events-none opacity-50'}" data-cutting-piece-action="go-merge-batches" data-record-id="${escapeHtml(row.id)}">
                查看批次
              </button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-same-production-orders" data-record-id="${escapeHtml(row.id)}">
                查看同生产单下其他原始裁片单${siblingRows.length ? `（${siblingRows.length}）` : ''}
              </button>
            </div>
          </div>
        `,
      )}

      ${renderDetailSection(
        '关联单据 / 关联入口',
        `
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-material-prep" data-record-id="${escapeHtml(row.id)}">去仓库配料 / 领料</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-marker-spreading" data-record-id="${escapeHtml(row.id)}">去唛架 / 铺布</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-fei-tickets" data-record-id="${escapeHtml(row.id)}">去菲票 / 打编号</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-replenishment" data-record-id="${escapeHtml(row.id)}">去补料管理</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-piece-action="go-production-progress" data-record-id="${escapeHtml(row.id)}">返回生产单进度</button>
          </div>
        `,
      )}

      ${renderDetailSection(
        '说明区',
        `
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>本页主体是原始裁片单，生产单只作为来源关系存在。</p>
            <p>合并裁剪批次仅作为执行上下文，不改变原始裁片单身份，也不替代原始单作为后续追溯主体。</p>
            <p>后续若从批次进入菲票 / 打编号，菲票归属仍永远回落原始裁片单。</p>
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
    </div>
  `

  return uiDetailDrawer(
    {
      title: row.originalCutOrderNo,
      subtitle: `来源生产单 ${row.productionOrderNo} · ${row.styleCode || row.spuCode || '款号待补'}`,
      closeAction: { prefix: 'cuttingPiece', action: 'close-overlay' },
      width: 'lg',
    },
    content,
    extraButtons,
  )
}

function renderPage(): string {
  const viewModel = getViewModel()
  syncStateFromPath(viewModel)
  const rows = getDisplayRows(viewModel)
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'original-orders')

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        showCompatibilityBadge: isCuttingAliasPath(pathname),
        actionsHtml: renderHeaderActions(),
      })}
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
  target: keyof OriginalCutOrderRow['navigationPayload'],
): boolean {
  if (!recordId) return false
  const row = getViewModel().rowsById[recordId]
  if (!row) return false

  const pathMap: Record<keyof OriginalCutOrderRow['navigationPayload'], string> = {
    productionProgress: getCanonicalCuttingPath('production-progress'),
    materialPrep: getCanonicalCuttingPath('material-prep'),
    markerSpreading: getCanonicalCuttingPath('marker-spreading'),
    feiTickets: getCanonicalCuttingPath('fei-tickets'),
    replenishment: getCanonicalCuttingPath('replenishment'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    sameProductionOrders: getCanonicalCuttingPath('original-orders'),
  }

  appStore.navigate(buildRouteWithQuery(pathMap[target], row.navigationPayload[target]))
  return true
}

export function renderCraftCuttingPieceOrdersPage(): string {
  return renderPage()
}

export function handleCraftCuttingPieceOrdersEvent(target: Element): boolean {
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
    state.activeOrderId = null
    state.querySignature = getCanonicalCuttingPath('original-orders')
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'open-detail') {
    state.activeOrderId = actionNode.dataset.recordId ?? null
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

  if (action === 'go-marker-spreading') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'markerSpreading')
  }

  if (action === 'go-fei-tickets') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'feiTickets')
  }

  if (action === 'go-replenishment') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'replenishment')
  }

  if (action === 'go-merge-batches') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'mergeBatches')
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

  if (action === 'go-marker-spreading-index') {
    appStore.navigate(getCanonicalCuttingPath('marker-spreading'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingPieceOrdersDialogOpen(): boolean {
  return state.activeOrderId !== null
}
