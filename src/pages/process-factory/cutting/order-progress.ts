// 旧 renderer 继续承接新的 canonical 页面“生产单进度”。
// 文件名保留仅为兼容历史实现，不代表未来仍以“订单进度”作为对象命名。
import { renderDrawer as uiDrawer } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import type { CuttingCanonicalPageKey } from './meta'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import {
  auditMeta,
  buildProductionProgressRows,
  buildProductionProgressSummary,
  configMeta,
  filterProductionProgressRows,
  formatQty,
  receiveMeta,
  riskMeta,
  sortProductionProgressRows,
  stageMeta,
  type ProductionProgressFilters,
  type ProductionProgressRow,
  type ProductionProgressSortKey,
  urgencyMeta,
} from './production-progress-model'
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar,
} from './layout.helpers'

type ProductionProgressQuickFilter = 'URGENT_ONLY' | 'PREP_DELAY' | 'CLAIM_EXCEPTION' | 'CUTTING_ACTIVE'
type FilterField = 'keyword' | 'urgency' | 'stage' | 'audit' | 'config' | 'claim' | 'risk' | 'sort'

const FIELD_TO_FILTER_KEY: Record<FilterField, keyof ProductionProgressFilters> = {
  keyword: 'keyword',
  urgency: 'urgencyLevel',
  stage: 'currentStage',
  audit: 'auditStatus',
  config: 'configStatus',
  claim: 'receiveStatus',
  risk: 'riskFilter',
  sort: 'sortBy',
}

const initialFilters: ProductionProgressFilters = {
  keyword: '',
  urgencyLevel: 'ALL',
  currentStage: 'ALL',
  auditStatus: 'ALL',
  configStatus: 'ALL',
  receiveStatus: 'ALL',
  riskFilter: 'ALL',
  sortBy: 'URGENCY_THEN_SHIP',
}

interface ProductionProgressPageState {
  filters: ProductionProgressFilters
  activeQuickFilter: ProductionProgressQuickFilter | null
  activeDetailId: string | null
  page: number
  pageSize: number
}

const state: ProductionProgressPageState = {
  filters: { ...initialFilters },
  activeQuickFilter: null,
  activeDetailId: null,
  page: 1,
  pageSize: 20,
}

function getAllRows(): ProductionProgressRow[] {
  return buildProductionProgressRows(cuttingOrderProgressRecords)
}

function resetPagination(): void {
  state.page = 1
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildRouteWithQuery(key: CuttingCanonicalPageKey, payload?: { productionOrderId: string; productionOrderNo: string }): string {
  const pathname = getCanonicalCuttingPath(key)
  if (!payload) return pathname

  const params = new URLSearchParams()
  if (payload.productionOrderId) params.set('productionOrderId', payload.productionOrderId)
  if (payload.productionOrderNo) params.set('productionOrderNo', payload.productionOrderNo)

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function applyQuickFilter(rows: ProductionProgressRow[]): ProductionProgressRow[] {
  switch (state.activeQuickFilter) {
    case 'URGENT_ONLY':
      return rows.filter((row) => row.urgency.key === 'AA' || row.urgency.key === 'A')
    case 'PREP_DELAY':
      return rows.filter((row) => row.materialAuditSummary.key !== 'APPROVED' || row.materialPrepSummary.key !== 'CONFIGURED')
    case 'CLAIM_EXCEPTION':
      return rows.filter((row) => row.materialClaimSummary.key === 'EXCEPTION' || row.materialClaimSummary.key === 'NOT_RECEIVED')
    case 'CUTTING_ACTIVE':
      return rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND')
    default:
      return rows
  }
}

function getDisplayRows(): ProductionProgressRow[] {
  const filteredRows = filterProductionProgressRows(getAllRows(), state.filters)
  const quickFilteredRows = applyQuickFilter(filteredRows)
  return sortProductionProgressRows(quickFilteredRows, state.filters.sortBy)
}

function getQuickFilterLabel(filter: ProductionProgressQuickFilter | null): string | null {
  if (filter === 'URGENT_ONLY') return '快捷筛选：只看 AA / A 紧急'
  if (filter === 'PREP_DELAY') return '快捷筛选：只看配料异常'
  if (filter === 'CLAIM_EXCEPTION') return '快捷筛选：只看领料异常'
  if (filter === 'CUTTING_ACTIVE') return '快捷筛选：只看裁剪中'
  return null
}

function getFilterLabels(): string[] {
  const labels: string[] = []
  const quickFilterLabel = getQuickFilterLabel(state.activeQuickFilter)
  if (quickFilterLabel) labels.push(quickFilterLabel)

  if (state.filters.keyword) labels.push(`关键词：${state.filters.keyword}`)
  if (state.filters.urgencyLevel !== 'ALL') labels.push(`紧急程度：${urgencyMeta[state.filters.urgencyLevel].label}`)
  if (state.filters.currentStage !== 'ALL') labels.push(`当前阶段：${stageMeta[state.filters.currentStage].label}`)
  if (state.filters.auditStatus !== 'ALL') labels.push(`面料审核：${auditMeta[state.filters.auditStatus].label}`)
  if (state.filters.configStatus !== 'ALL') labels.push(`配料进展：${configMeta[state.filters.configStatus].label}`)
  if (state.filters.receiveStatus !== 'ALL') labels.push(`领料进展：${receiveMeta[state.filters.receiveStatus].label}`)
  if (state.filters.riskFilter !== 'ALL') {
    labels.push(state.filters.riskFilter === 'ANY' ? '风险：只看有风险' : `风险：${riskMeta[state.filters.riskFilter].label}`)
  }

  if (state.filters.sortBy !== 'URGENCY_THEN_SHIP') {
    const sortLabelMap: Record<ProductionProgressSortKey, string> = {
      URGENCY_THEN_SHIP: '默认排序',
      SHIP_DATE_ASC: '计划发货日期升序',
      ORDER_QTY_DESC: '下单数量降序',
    }
    labels.push(`排序：${sortLabelMap[state.filters.sortBy]}`)
  }

  return labels
}

function renderStatsCards(rows: ProductionProgressRow[]): string {
  const summary = buildProductionProgressSummary(rows)

  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('生产单总数', summary.totalCount, '当前筛选范围', 'text-slate-900')}
      ${renderCompactKpiCard('AA / A 紧急单', summary.urgentCount, '优先跟进交付', 'text-rose-600')}
      ${renderCompactKpiCard('配料异常单', summary.prepExceptionCount, '审核或配料未齐', 'text-amber-600')}
      ${renderCompactKpiCard('领料异常单', summary.claimExceptionCount, '待领取或现场差异', 'text-orange-600')}
      ${renderCompactKpiCard('裁剪中单数', summary.cuttingCount, '含待入仓', 'text-violet-600')}
      ${renderCompactKpiCard('已完成单数', summary.doneCount, '已收口', 'text-emerald-600')}
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
        data-cutting-progress-field="${field}"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderQuickFilterRow(): string {
  const options: Array<{ key: ProductionProgressQuickFilter; label: string; tone: 'blue' | 'amber' | 'rose' }> = [
    { key: 'URGENT_ONLY', label: '只看紧急', tone: 'rose' },
    { key: 'PREP_DELAY', label: '只看配料未齐', tone: 'amber' },
    { key: 'CLAIM_EXCEPTION', label: '只看领料异常', tone: 'rose' },
    { key: 'CUTTING_ACTIVE', label: '只看裁剪中', tone: 'blue' },
  ]

  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">快捷筛选</span>
      ${options
        .map((option) =>
          renderWorkbenchFilterChip(
            option.label,
            `data-cutting-progress-action="toggle-quick-filter" data-quick-filter="${option.key}"`,
            state.activeQuickFilter === option.key ? option.tone : 'blue',
          ),
        )
        .join('')}
    </div>
  `
}

function renderActiveStateBar(): string {
  const labels = getFilterLabels()
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前视图条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-progress-action="clear-filters"', 'blue')),
    clearAttrs: 'data-cutting-progress-action="clear-filters"',
  })
}

function renderTable(rows: ProductionProgressRow[]): string {
  const pagination = paginateItems(rows, state.page, state.pageSize)

  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">生产单主表</h2>
          <p class="mt-1 text-xs text-muted-foreground">按生产单聚合查看原始裁片单、配料、领料和阶段风险。</p>
        </div>
        <div class="text-xs text-muted-foreground">共 ${pagination.total} 条生产单</div>
      </div>
      ${renderStickyTableScroller(
        `
          <table class="w-full min-w-[1680px] text-sm">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="px-4 py-3 text-left font-medium">紧急程度</th>
                <th class="px-4 py-3 text-left font-medium">采购日期</th>
                <th class="px-4 py-3 text-left font-medium">实际下单日期</th>
                <th class="px-4 py-3 text-left font-medium">生产单号</th>
                <th class="px-4 py-3 text-left font-medium">款号 / SPU</th>
                <th class="px-4 py-3 text-left font-medium">下单数量</th>
                <th class="px-4 py-3 text-left font-medium">计划发货日期</th>
                <th class="px-4 py-3 text-left font-medium">面料审核</th>
                <th class="px-4 py-3 text-left font-medium">配料进展</th>
                <th class="px-4 py-3 text-left font-medium">领料进展</th>
                <th class="px-4 py-3 text-left font-medium">裁片单数</th>
                <th class="px-4 py-3 text-left font-medium">当前阶段</th>
                <th class="px-4 py-3 text-left font-medium">裁剪齐套汇总</th>
                <th class="px-4 py-3 text-left font-medium">风险提示</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                pagination.items.length
                  ? pagination.items
                      .map(
                        (row) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3">
                              ${renderBadge(row.urgency.label, row.urgency.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.urgency.detailText)}</div>
                            </td>
                            <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(row.purchaseDate || '-')}</td>
                            <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(row.actualOrderDate || '-')}</td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${row.id}">
                                ${escapeHtml(row.productionOrderNo)}
                              </button>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.assignedFactoryName)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || '-')}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || '-')}</div>
                            </td>
                            <td class="px-4 py-3 font-medium tabular-nums">${formatQty(row.orderQty)}</td>
                            <td class="px-4 py-3">
                              <div>${escapeHtml(row.plannedShipDateDisplay)}</div>
                              ${row.plannedShipDate ? '' : '<div class="mt-1 text-xs text-muted-foreground">待补日期</div>'}
                            </td>
                            <td class="px-4 py-3">
                              ${renderBadge(row.materialAuditSummary.label, row.materialAuditSummary.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialAuditSummary.detailText)}</div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderBadge(row.materialPrepSummary.label, row.materialPrepSummary.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialPrepSummary.detailText)}</div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderBadge(row.materialClaimSummary.label, row.materialClaimSummary.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialClaimSummary.detailText)}</div>
                            </td>
                            <td class="px-4 py-3 font-medium">${row.originalCutOrderCount}</td>
                            <td class="px-4 py-3">
                              ${renderBadge(row.currentStage.label, row.currentStage.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.rawStageText || row.currentStage.label)}</div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderBadge(row.cuttingCompletionSummary.label, row.cuttingCompletionSummary.className)}
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.cuttingCompletionSummary.detailText)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-1">
                                ${
                                  row.riskTags.length
                                    ? row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join('')
                                    : '<span class="text-xs text-muted-foreground">无风险</span>'
                                }
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-2 text-xs">
                                <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-original-orders" data-record-id="${row.id}">查看裁片单</button>
                                <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${row.id}">查看配料</button>
                                <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-cuttable-pool" data-record-id="${row.id}">去可裁排产</button>
                                <button class="rounded-md border px-2.5 py-1 hover:bg-muted" data-cutting-progress-action="go-summary" data-record-id="${row.id}">查看裁剪总结</button>
                              </div>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')
                  : '<tr><td colspan="15" class="px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无匹配生产单。</td></tr>'
              }
            </tbody>
          </table>
        `,
        'max-h-[64vh]',
      )}
      ${renderWorkbenchPagination({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        actionAttr: 'data-cutting-progress-action',
        pageAction: 'set-page',
        pageSizeAttr: 'data-cutting-progress-page-size',
      })}
    </section>
  `
}

function renderDetailDrawer(): string {
  const row = getAllRows().find((item) => item.id === state.activeDetailId)
  if (!row) return ''

  const materialPreviewRows = row.materialLines
    .map(
      (line) => `
        <tr class="border-b last:border-b-0 align-top">
          <td class="px-4 py-3 font-medium">${escapeHtml(line.cutPieceOrderNo)}</td>
          <td class="px-4 py-3">
            <div class="font-medium">${escapeHtml(line.materialSku)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialLabel)}</div>
          </td>
          <td class="px-4 py-3">${renderBadge(auditMeta[line.reviewStatus].label, auditMeta[line.reviewStatus].className)}</td>
          <td class="px-4 py-3">${renderBadge(configMeta[line.configStatus].label, configMeta[line.configStatus].className)}</td>
          <td class="px-4 py-3">${renderBadge(receiveMeta[line.receiveStatus].label, receiveMeta[line.receiveStatus].className)}</td>
          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(line.latestActionText)}</td>
        </tr>
      `,
    )
    .join('')

  const content = `
    <div class="space-y-6">
      <section class="grid gap-4 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p class="text-xs text-muted-foreground">生产单号</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(row.productionOrderNo)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">款号 / SPU</p>
          <p class="mt-1 text-sm font-semibold">${escapeHtml(row.styleCode || row.spuCode || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">款式名称</p>
          <p class="mt-1 text-sm">${escapeHtml(row.styleName || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前协调工厂</p>
          <p class="mt-1 text-sm">${escapeHtml(row.assignedFactoryName)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">采购日期</p>
          <p class="mt-1 text-sm">${escapeHtml(row.purchaseDate || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">实际下单日期</p>
          <p class="mt-1 text-sm">${escapeHtml(row.actualOrderDate || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">计划发货日期</p>
          <p class="mt-1 text-sm">${escapeHtml(row.plannedShipDateDisplay)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">下单数量</p>
          <p class="mt-1 text-sm">${formatQty(row.orderQty)}</p>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">面料审核</p>
          <div class="mt-2">${renderBadge(row.materialAuditSummary.label, row.materialAuditSummary.className)}</div>
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.materialAuditSummary.detailText)}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">配料进展</p>
          <div class="mt-2">${renderBadge(row.materialPrepSummary.label, row.materialPrepSummary.className)}</div>
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.materialPrepSummary.detailText)}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">领料进展</p>
          <div class="mt-2">${renderBadge(row.materialClaimSummary.label, row.materialClaimSummary.className)}</div>
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.materialClaimSummary.detailText)}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">当前阶段</p>
          <div class="mt-2">${renderBadge(row.currentStage.label, row.currentStage.className)}</div>
          <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.cuttingCompletionSummary.detailText)}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-semibold">原始裁片单与面料预览</h3>
            <p class="mt-1 text-xs text-muted-foreground">本页只做生产单层快速查问题，下钻明细请进入裁片单（原始单）。</p>
          </div>
          <div class="text-xs text-muted-foreground">${row.originalCutOrderCount} 个原始裁片单</div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          ${row.originalCutOrderNos.map((cutOrderNo) => `<span class="inline-flex rounded-full border px-2.5 py-1 text-xs text-slate-700">${escapeHtml(cutOrderNo)}</span>`).join('')}
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[920px] text-sm">
            <thead class="border-b bg-muted/30 text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">原始裁片单</th>
                <th class="px-4 py-3 text-left font-medium">面料 SKU</th>
                <th class="px-4 py-3 text-left font-medium">面料审核</th>
                <th class="px-4 py-3 text-left font-medium">配料进展</th>
                <th class="px-4 py-3 text-left font-medium">领料进展</th>
                <th class="px-4 py-3 text-left font-medium">最新动作</th>
              </tr>
            </thead>
            <tbody>${materialPreviewRows}</tbody>
          </table>
        </div>
      </section>

      <section class="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">风险提示</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            ${
              row.riskTags.length
                ? row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join('')
                : '<span class="text-sm text-muted-foreground">当前暂无风险标签。</span>'
            }
          </div>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近扫码时间</dt>
              <dd class="text-right">${escapeHtml(row.latestPickupScanAt ? formatDateTime(row.latestPickupScanAt) : '-')}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近现场回写</dt>
              <dd class="text-right">${escapeHtml(row.latestUpdatedAt ? formatDateTime(row.latestUpdatedAt) : '-')}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">最近操作人</dt>
              <dd class="text-right">${escapeHtml(row.latestOperatorName || '-')}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">铺布记录</dt>
              <dd class="text-right">${row.hasSpreadingRecord ? '已记录' : '未记录'}</dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">入仓记录</dt>
              <dd class="text-right">${row.hasInboundRecord ? '已回写' : '待回写'}</dd>
            </div>
          </dl>
        </article>

        <article class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold">后续入口</h3>
          <p class="mt-2 text-sm text-muted-foreground">生产单进度只承接监控与筛查，正式动作在各对象页继续完成。</p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-progress-action="go-original-orders" data-record-id="${row.id}">
              查看裁片单
            </button>
            <button class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${row.id}">
              查看配料
            </button>
            <button class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-cutting-progress-action="go-cuttable-pool" data-record-id="${row.id}">
              去可裁排产
            </button>
            <button class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" data-cutting-progress-action="go-summary" data-record-id="${row.id}">
              查看裁剪总结
            </button>
          </div>
        </article>
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: '生产单进度概览',
      subtitle: `${row.productionOrderNo} · ${row.styleName || row.assignedFactoryName}`,
      closeAction: { prefix: 'cutting-progress', action: 'close-detail' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'cutting-progress', action: 'close-detail', label: '关闭' },
      extra: `
        <div class="flex items-center gap-3">
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-original-orders" data-record-id="${row.id}">查看裁片单</button>
          <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-material-prep" data-record-id="${row.id}">查看配料</button>
        </div>
      `,
    },
  )
}

function renderActionBar(): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-cuttable-pool-index">去可裁排产</button>
      <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-progress-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

export function renderCraftCuttingOrderProgressPage(): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'production-progress')
  const rows = getDisplayRows()

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderActionBar(),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}

      ${renderStatsCards(rows)}

      ${renderStickyFilterShell(`
        <div class="space-y-3">
          ${renderQuickFilterRow()}
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label class="space-y-2 md:col-span-2 xl:col-span-2">
              <span class="text-sm font-medium text-foreground">关键词</span>
              <input
                type="text"
                value="${escapeHtml(state.filters.keyword)}"
                placeholder="支持生产单号 / 款号 / 面料 SKU"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cutting-progress-field="keyword"
              />
            </label>
            ${renderFilterSelect('紧急程度', 'urgency', state.filters.urgencyLevel, [
              { value: 'ALL', label: '全部' },
              { value: 'AA', label: 'AA 紧急' },
              { value: 'A', label: 'A 紧急' },
              { value: 'B', label: 'B 紧急' },
              { value: 'C', label: 'C 优先' },
              { value: 'D', label: 'D 常规' },
              { value: 'UNKNOWN', label: '待补日期' },
            ])}
            ${renderFilterSelect('当前阶段', 'stage', state.filters.currentStage, [
              { value: 'ALL', label: '全部' },
              { value: 'WAITING_PREP', label: '待配料' },
              { value: 'PREPPING', label: '配料中' },
              { value: 'WAITING_CLAIM', label: '待领料' },
              { value: 'CUTTING', label: '裁剪中' },
              { value: 'WAITING_INBOUND', label: '待入仓' },
              { value: 'DONE', label: '已完成' },
            ])}
            ${renderFilterSelect('面料审核', 'audit', state.filters.auditStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_REQUIRED', label: '无需审核' },
              { value: 'PENDING', label: '待审核' },
              { value: 'PARTIAL', label: '部分已审核' },
              { value: 'APPROVED', label: '全部已审核' },
            ])}
            ${renderFilterSelect('配料进展', 'config', state.filters.configStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_CONFIGURED', label: '未配置' },
              { value: 'PARTIAL', label: '部分配置' },
              { value: 'CONFIGURED', label: '已配置' },
            ])}
            ${renderFilterSelect('领料进展', 'claim', state.filters.receiveStatus, [
              { value: 'ALL', label: '全部' },
              { value: 'NOT_RECEIVED', label: '待领取' },
              { value: 'PARTIAL', label: '部分领取' },
              { value: 'RECEIVED', label: '领料成功' },
              { value: 'EXCEPTION', label: '领取异常' },
            ])}
            ${renderFilterSelect('风险状态', 'risk', state.filters.riskFilter, [
              { value: 'ALL', label: '全部' },
              { value: 'ANY', label: '仅看有风险' },
              { value: 'CONFIG_DELAY', label: '配料滞后' },
              { value: 'RECEIVE_EXCEPTION', label: '领料异常' },
              { value: 'SHIP_URGENT', label: '临近发货' },
              { value: 'DATE_MISSING', label: '日期缺失' },
              { value: 'STATUS_CONFLICT', label: '状态冲突' },
              { value: 'REPLENISH_PENDING', label: '待补料' },
            ])}
            ${renderFilterSelect('排序', 'sort', state.filters.sortBy, [
              { value: 'URGENCY_THEN_SHIP', label: '默认：紧急程度 + 发货时间' },
              { value: 'SHIP_DATE_ASC', label: '计划发货日期升序' },
              { value: 'ORDER_QTY_DESC', label: '下单数量降序' },
            ])}
          </div>
        </div>
      `)}

      ${renderActiveStateBar()}
      ${renderTable(rows)}
      ${renderDetailDrawer()}
    </div>
  `
}

function findRowById(recordId: string | undefined): ProductionProgressRow | undefined {
  if (!recordId) return undefined
  return getAllRows().find((row) => row.id === recordId)
}

function navigateToRecordTarget(recordId: string | undefined, key: CuttingCanonicalPageKey): boolean {
  const row = findRowById(recordId)
  if (!row) return false

  const payload =
    key === 'material-prep'
      ? row.filterPayloadForMaterialPrep
      : key === 'cuttable-pool'
        ? row.filterPayloadForCuttablePool
        : key === 'summary'
          ? row.filterPayloadForSummary
          : row.filterPayloadForOriginalOrders

  appStore.navigate(buildRouteWithQuery(key, payload))
  return true
}

export function handleCraftCuttingOrderProgressEvent(target: Element): boolean {
  const pageSizeNode = target.closest<HTMLElement>('[data-cutting-progress-page-size]')
  if (pageSizeNode) {
    const input = pageSizeNode as HTMLSelectElement
    state.pageSize = Number(input.value) || 20
    state.page = 1
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-cutting-progress-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingProgressField as FilterField | undefined
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

  const actionNode = target.closest<HTMLElement>('[data-cutting-progress-action]')
  const action = actionNode?.dataset.cuttingProgressAction
  if (!action) return false

  if (action === 'toggle-quick-filter') {
    const quickFilter = actionNode.dataset.quickFilter as ProductionProgressQuickFilter | undefined
    if (!quickFilter) return false
    state.activeQuickFilter = state.activeQuickFilter === quickFilter ? null : quickFilter
    resetPagination()
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    state.activeQuickFilter = null
    resetPagination()
    return true
  }

  if (action === 'open-detail') {
    state.activeDetailId = actionNode.dataset.recordId ?? null
    return true
  }

  if (action === 'close-detail') {
    state.activeDetailId = null
    return true
  }

  if (action === 'set-page') {
    state.page = Number(actionNode.dataset.page) || 1
    return true
  }

  if (action === 'go-original-orders') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'original-orders')
  }

  if (action === 'go-material-prep') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'material-prep')
  }

  if (action === 'go-cuttable-pool') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'cuttable-pool')
  }

  if (action === 'go-summary') {
    return navigateToRecordTarget(actionNode.dataset.recordId, 'summary')
  }

  if (action === 'go-cuttable-pool-index') {
    appStore.navigate(getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingOrderProgressDialogOpen(): boolean {
  return state.activeDetailId !== null
}
