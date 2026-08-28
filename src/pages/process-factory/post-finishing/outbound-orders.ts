// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { type StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  normalizeListColumnPreferences,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  createProcessOrderListController,
  type ProcessOrderListControllerState,
} from '../../../components/ui/process-order-list-controller.ts'
import { buildUnifiedPrintPreviewLink } from '../../../data/fcs/print-service.ts'
import {
  getPostFinishingOutboundOrderById,
  listPostFinishingOutboundOrders,
  type PostFinishingOutboundOrder,
  type PostFinishingOutboundOrderStatus,
} from '../../../data/fcs/post-finishing-outbound-orders.ts'
import {
  buildPostFinishingOutboundOrderDetailLink,
  buildPostFinishingOutboundOrdersLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { escapeHtml } from '../../../utils.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const EVENT_PREFIX = 'post-finishing-outbound'
const PREFERENCE_KEY = '/fcs/craft/post-finishing/outbound-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface OutboundFilters {
  keyword: string
  status: '' | PostFinishingOutboundOrderStatus
  factory: string
  createdFrom: string
  createdTo: string
}

const EMPTY_FILTERS: OutboundFilters = {
  keyword: '',
  status: '',
  factory: '',
  createdFrom: '',
  createdTo: '',
}

const state: ProcessOrderListControllerState & { filters: OutboundFilters } = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['outboundOrderNo'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  filters: { ...EMPTY_FILTERS },
}

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function statusBadge(status: PostFinishingOutboundOrderStatus): string {
  return status === '已确认'
    ? renderBadge(status, 'success', 'circle-check-big')
    : renderBadge(status, 'warning', 'clock-3')
}

function renderActions(order: PostFinishingOutboundOrder): string {
  const detailHref = buildPostFinishingOutboundOrderDetailLink(order.outboundOrderId)
  const wholePrintHref = buildUnifiedPrintPreviewLink({
    documentType: 'POST_FINISHING_OUTBOUND_ORDER',
    sourceType: 'POST_FINISHING_OUTBOUND_ORDER',
    sourceId: order.outboundOrderId,
  })
  const barcodeHref = buildUnifiedPrintPreviewLink({
    documentType: 'POST_FINISHING_OUTBOUND_BARCODE',
    sourceType: 'POST_FINISHING_OUTBOUND_ORDER',
    sourceId: order.outboundOrderId,
  })
  return `<div class="flex flex-wrap justify-end gap-1.5">
    <a class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">详情</a>
    <a class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(wholePrintHref)}">打印整单</a>
    <a class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(barcodeHref)}">打印条码</a>
  </div>`
}

const columns: StandardListColumn<PostFinishingOutboundOrder>[] = [
  {
    key: 'outboundOrderNo', title: '出货单号', width: 142, required: true, freezeable: true, sortable: true,
    render: (row) => `<a class="font-medium text-blue-600 hover:underline" data-nav="${escapeHtml(buildPostFinishingOutboundOrderDetailLink(row.outboundOrderId))}">${escapeHtml(row.outboundOrderNo)}</a>`,
    sortValue: (row) => row.outboundOrderNo,
  },
  { key: 'factory', title: '工厂', width: 170, freezeable: true, sortable: true, render: (row) => escapeHtml(row.managedPostFactoryName), sortValue: (row) => row.managedPostFactoryName },
  { key: 'productionOrderNo', title: '生产单号', width: 145, sortable: true, render: (row) => escapeHtml(row.productionOrderNo), sortValue: (row) => row.productionOrderNo },
  { key: 'taskNo', title: '任务单号', width: 150, sortable: true, render: (row) => escapeHtml(row.taskNo), sortValue: (row) => row.taskNo },
  { key: 'outboundQty', title: '出库数量', width: 110, align: 'right', sortable: true, render: (row) => formatQty(row.outboundQty, row.qtyUnit), sortValue: (row) => row.outboundQty },
  { key: 'inboundQty', title: '入库数量', width: 110, align: 'right', sortable: true, render: (row) => formatQty(row.inboundQty, row.qtyUnit), sortValue: (row) => row.inboundQty },
  { key: 'status', title: '状态', width: 100, sortable: true, render: (row) => statusBadge(row.status), sortValue: (row) => row.status },
  { key: 'createdAt', title: '创建时间', width: 155, sortable: true, render: (row) => escapeHtml(row.createdAt), sortValue: (row) => row.createdAt },
  { key: 'operatorName', title: '操作人', width: 110, sortable: true, render: (row) => escapeHtml(row.operatorName), sortValue: (row) => row.operatorName },
  { key: 'actions', title: '操作', width: 255, required: true, actionColumn: true, align: 'right', render: renderActions },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))
state.preferences = normalizeListColumnPreferences(columnRules, {
  order: columns.map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['outboundOrderNo'],
  pageSize: 10,
}, PAGE_SIZE_OPTIONS)

function filteredRows(): PostFinishingOutboundOrder[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  return listPostFinishingOutboundOrders().filter((order) => {
    const searchable = [
      order.outboundOrderNo,
      order.productionOrderNo,
      order.taskNo,
      order.recheckOrderNo,
      order.qcOrderNo,
      order.postOrderNo || '',
    ].join(' ').toLowerCase()
    if (keyword && !searchable.includes(keyword)) return false
    if (state.filters.status && order.status !== state.filters.status) return false
    if (state.filters.factory && order.managedPostFactoryName !== state.filters.factory) return false
    const date = order.createdAt.slice(0, 10)
    if (state.filters.createdFrom && date < state.filters.createdFrom) return false
    if (state.filters.createdTo && date > state.filters.createdTo) return false
    return true
  })
}

const controller = createProcessOrderListController<PostFinishingOutboundOrder>({
  state,
  columns,
  preferenceKey: PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-post-finishing-outbound-root]',
  tableSurfaceSelector: '[data-post-finishing-outbound-table]',
  paginationSurfaceSelector: '[data-post-finishing-outbound-pagination]',
  overlaysSurfaceSelector: '[data-post-finishing-outbound-overlays]',
  defaultFrozenKeys: ['outboundOrderNo'],
  columnSettingsTitle: '后道出货单列设置',
  emptyText: '当前筛选范围暂无后道出货单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilterField(label: string, field: keyof OutboundFilters, value: string, type = 'text'): string {
  return `<label class="min-w-[10rem] flex-1 text-sm"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input type="${escapeHtml(type)}" value="${escapeHtml(value)}" class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-post-finishing-outbound-filter="${escapeHtml(field)}"></label>`
}

function renderFilters(allRows: PostFinishingOutboundOrder[]): string {
  const factories = [...new Set(allRows.map((order) => order.managedPostFactoryName))]
  return `<div class="rounded-lg border bg-card p-3"><div class="flex flex-wrap items-end gap-3">
    ${renderFilterField('关键词', 'keyword', state.filters.keyword)}
    <label class="min-w-[8rem] text-sm"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-post-finishing-outbound-filter="status"><option value="">全部</option>${(['待确认', '已确认'] as const).map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
    <label class="min-w-[11rem] text-sm"><span class="mb-1 block text-xs text-muted-foreground">工厂</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-post-finishing-outbound-filter="factory"><option value="">全部</option>${factories.map((factory) => `<option value="${escapeHtml(factory)}" ${state.filters.factory === factory ? 'selected' : ''}>${escapeHtml(factory)}</option>`).join('')}</select></label>
    ${renderFilterField('创建开始日期', 'createdFrom', state.filters.createdFrom, 'date')}
    ${renderFilterField('创建结束日期', 'createdTo', state.filters.createdTo, 'date')}
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}
  </div><p class="mt-2 text-xs text-muted-foreground">关键词支持出货单号、生产单号、后道任务号、后道单号、质检单号和复检单号。</p></div>`
}

function renderWorkspace(): string {
  controller.ensurePreferencesLoaded()
  const allRows = listPostFinishingOutboundOrders()
  const rows = filteredRows()
  const view = controller.getView(rows)
  const outboundQty = rows.reduce((sum, order) => sum + order.outboundQty, 0)
  const inboundQty = rows.reduce((sum, order) => sum + order.inboundQty, 0)
  return renderStandardListPage({
    title: '后道出货单',
    filtersHtml: renderFilters(allRows),
    statsHtml: renderStandardListStats([
      { label: '出货单', value: `${rows.length} 张` },
      { label: '待确认', value: `${rows.filter((order) => order.status === '待确认').length} 张` },
      { label: '出库数量', value: `${outboundQty.toLocaleString('zh-CN')} 件` },
      { label: '入库数量', value: `${inboundQty.toLocaleString('zh-CN')} 件` },
    ]),
    listTitle: `后道出货单列表（${rows.length}）`,
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: `<div data-post-finishing-outbound-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-post-finishing-outbound-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-post-finishing-outbound-overlays>${controller.renderColumnSettings()}</div>`,
  })
}

function refreshWorkspace(): void {
  const root = document.querySelector<HTMLElement>('[data-post-finishing-outbound-root]')
  if (!root) return
  root.innerHTML = renderWorkspace()
  hydrateIcons(root)
}

function readFilters(root: HTMLElement): OutboundFilters {
  const value = (field: keyof OutboundFilters) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-post-finishing-outbound-filter="${field}"]`)?.value.trim() || ''
  return {
    keyword: value('keyword'),
    status: value('status') as OutboundFilters['status'],
    factory: value('factory'),
    createdFrom: value('createdFrom'),
    createdTo: value('createdTo'),
  }
}

export function handlePostFinishingOutboundOrderEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-post-finishing-outbound-root]')
  if (!root) return false
  const field = target.closest<HTMLSelectElement>('[data-post-finishing-outbound-field="pageSize"]')
  if (field) {
    controller.setPageSize(Number(field.value))
    controller.refresh()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-outbound-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.postFinishingOutboundAction || ''
  if (action === 'apply-filter') { state.filters = readFilters(root); state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.filters = { ...EMPTY_FILTERS }; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'next-page' ? 1 : -1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(actionNode.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset.postFinishingOutboundColumnKey || actionNode.closest<HTMLElement>('[data-post-finishing-outbound-column-key]')?.dataset.postFinishingOutboundColumnKey || ''
    controller.updateColumnPreference(action, key, (actionNode as HTMLInputElement).checked)
    controller.refresh({ overlays: true })
    return true
  }
  if (action === 'restore-column-settings') { controller.restorePreferences(); refreshWorkspace(); return true }
  return false
}

export function renderPostFinishingOutboundOrdersPage(): string {
  controller.installColumnDragEvents()
  return `<div data-post-finishing-outbound-root data-skip-page-rerender="true">${renderWorkspace()}</div>`
}

function renderProductCell(line: PostFinishingOutboundOrder['lines'][number]): string {
  const image = line.skuImageUrl
    ? `<button type="button" class="relative h-16 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-muted" data-post-finishing-action="zoom-image" data-zoom-url="${escapeHtml(line.skuImageUrl)}" data-zoom-label="${escapeHtml(`${line.spuName} ${line.skuCode}`)}"><img src="${escapeHtml(line.skuImageUrl)}" alt="${escapeHtml(`${line.spuName} ${line.skuCode}`)}" class="h-full w-full object-cover" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')"><span class="hidden p-1 text-[10px] text-red-700">图片加载失败</span></button>`
    : '<div class="flex h-16 w-12 shrink-0 items-center justify-center rounded border bg-muted text-[10px] text-muted-foreground">无图</div>'
  return `<div class="flex items-center gap-3">${image}<div><strong class="block">${escapeHtml(line.spuName)}</strong><span class="text-xs text-muted-foreground">${escapeHtml(line.spuCode)}</span></div></div>`
}

export function renderPostFinishingOutboundOrderDetailPage(id: string): string {
  const order = getPostFinishingOutboundOrderById(id)
  if (!order) return `<section class="p-6"><h1 class="text-xl font-semibold">未找到后道出货单</h1><p class="mt-2 text-sm text-muted-foreground">${escapeHtml(id)}</p><a class="mt-4 inline-flex rounded-md border px-3 py-2 text-sm" data-nav="${buildPostFinishingOutboundOrdersLink()}">返回列表</a></section>`
  const wholePrintHref = buildUnifiedPrintPreviewLink({ documentType: 'POST_FINISHING_OUTBOUND_ORDER', sourceType: 'POST_FINISHING_OUTBOUND_ORDER', sourceId: order.outboundOrderId })
  const barcodeHref = buildUnifiedPrintPreviewLink({ documentType: 'POST_FINISHING_OUTBOUND_BARCODE', sourceType: 'POST_FINISHING_OUTBOUND_ORDER', sourceId: order.outboundOrderId })
  const facts = [
    ['出货单号', order.outboundOrderNo], ['状态', order.status], ['工厂', order.managedPostFactoryName], ['来源动作', order.sourceActionLabel],
    ['出库仓', order.sourceWarehouseName], ['接收仓', order.targetWarehouseName], ['生产单号', order.productionOrderNo], ['任务单号', order.taskNo],
    ['来源对象', order.sourceObjectLabel], ['创建时间', order.createdAt], ['操作人', order.operatorName], ['数量', formatQty(order.outboundQty, order.qtyUnit)],
  ]
  return `<section class="space-y-4 p-4" data-post-finishing-outbound-detail-root>
    <header class="flex flex-wrap items-center justify-between gap-3"><div><button type="button" class="mb-2 text-sm text-blue-600 hover:underline" data-nav="${buildPostFinishingOutboundOrdersLink()}">← 返回后道出货单</button><div class="flex items-center gap-3"><h1 class="text-xl font-semibold">后道出货单 ${escapeHtml(order.outboundOrderNo)}</h1>${statusBadge(order.status)}</div></div><div class="flex flex-wrap gap-2"><a class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-nav="${escapeHtml(wholePrintHref)}">打印整单</a><a class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(barcodeHref)}">打印条码</a></div></header>
    <section class="rounded-lg border bg-card p-4"><h2 class="font-semibold">出货信息</h2><dl class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">${facts.map(([label, value]) => `<div class="rounded-md border bg-background p-3"><dt class="text-xs text-muted-foreground">${escapeHtml(label)}</dt><dd class="mt-1 text-sm font-medium">${escapeHtml(value)}</dd></div>`).join('')}</dl></section>
    <section class="overflow-hidden rounded-lg border bg-card"><header class="border-b px-4 py-3"><h2 class="font-semibold">出货明细</h2></header><div class="overflow-x-auto"><table class="min-w-[1080px] w-full text-sm"><thead class="bg-muted/50 text-xs text-muted-foreground"><tr>${['序号', '图片 / 名称', '类型', 'SKU', '颜色', '尺码', '计划数量', '已入库数量', '单位'].map((title) => `<th class="px-3 py-2 text-left">${title}</th>`).join('')}</tr></thead><tbody>${order.lines.map((line, index) => `<tr class="border-t"><td class="px-3 py-3">${index + 1}</td><td class="px-3 py-3">${renderProductCell(line)}</td><td class="px-3 py-3">${line.itemType}</td><td class="px-3 py-3 font-medium">${escapeHtml(line.skuCode)}${line.originalSkuCode ? `<div class="mt-1 text-xs text-muted-foreground">原记录：${escapeHtml(line.originalSkuCode)}</div>` : ''}</td><td class="px-3 py-3">${escapeHtml(line.colorName)}</td><td class="px-3 py-3">${escapeHtml(line.sizeName)}</td><td class="px-3 py-3 text-right">${line.plannedQty.toLocaleString('zh-CN')}</td><td class="px-3 py-3 text-right">${line.inboundQty.toLocaleString('zh-CN')}</td><td class="px-3 py-3">${escapeHtml(line.qtyUnit)}</td></tr>`).join('')}</tbody></table></div></section>
  </section>`
}
