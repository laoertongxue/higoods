// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { escapeHtml } from '../utils.ts'
import {
  bootstrapTestingOrders,
  listTestingOrders,
  TESTING_ORDER_STEPS,
  type TestingOrderRecord,
  type TestingOrderStepKey,
} from '../data/pcs-testing-order-repository.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import { exportStandardListRows } from '../components/ui/list-export.ts'
import { renderButton } from '../components/ui/button.ts'

bootstrapTestingOrders()

interface ListState {
  search: string
  status: '全部' | '进行中' | '已结束'
}

const state: ListState = { search: '', status: '全部' }
const applied: ListState = { search: '', status: '全部' }

const TESTING_STEP_LABEL = Object.fromEntries(
  TESTING_ORDER_STEPS.map((step) => [step.key, step.title]),
) as Record<TestingOrderStepKey, string>

function statusBadge(order: TestingOrderRecord): string {
  return order.status === '已结束'
    ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">已结束</span>'
    : '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">进行中</span>'
}

function filteredOrders(): TestingOrderRecord[] {
  const keyword = applied.search.trim().toLowerCase()
  return listTestingOrders().filter((order) => {
    if (applied.status !== '全部' && order.status !== applied.status) return false
    if (!keyword) return true
    return [order.orderCode, order.styleCode, order.styleName, order.buyerName || '待分配', ...order.skuCodes]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}

const columns: StandardListColumn<TestingOrderRecord>[] = [
  {
    key: 'order',
    title: '测款单 / 款式',
    width: 240,
    required: true,
    render: (order) => `
      <div class="flex items-center gap-3">
        ${order.styleImageUrl ? `<button type="button" class="relative shrink-0 cursor-zoom-in overflow-hidden rounded-md border" data-pda-image-preview-url="${escapeHtml(order.styleImageUrl)}" data-pda-image-preview-title="${escapeHtml(`${order.styleCode} ${order.styleName}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(order.styleName)}大图">
          <img src="${escapeHtml(order.styleImageUrl)}" alt="${escapeHtml(order.styleName)}" class="h-12 w-12 object-cover" loading="lazy" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-slate-600">图片加载中</span>
        </button>` : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border text-[10px] text-red-600">缺少图片</span>'}
        <div>
          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}">${escapeHtml(order.orderCode)}</button>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(order.styleCode)} · ${escapeHtml(order.styleName)}</div>
        </div>
      </div>`,
  },
  { key: 'buyer', title: '买手', width: 110, render: (order) => escapeHtml(order.buyerName || '待分配'), sortValue: (order) => order.buyerName || '' },
  {
    key: 'sku',
    title: 'SKU',
    width: 160,
    render: (order) => escapeHtml(order.skuCodes.join('、') || '—'),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: statusBadge,
  },
  {
    key: 'step',
    title: '当前步骤',
    width: 140,
    render: (order) => escapeHtml(TESTING_STEP_LABEL[order.currentStepKey] || order.currentStepKey),
  },
  {
    key: 'bulk',
    title: '大货判断',
    width: 110,
    render: (order) => escapeHtml(order.bulkDecision || '—'),
  },
  {
    key: 'channel',
    title: '测款渠道',
    width: 160,
    render: (order) => escapeHtml(order.channelCodes.join('、') || '—'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 90,
    required: true,
    actionColumn: true,
    render: (order) =>
      `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}">查看</button>`,
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['order'],
  pageSize: 20,
}

function statsHtml(): string {
  const all = filteredOrders()
  return renderStandardListStats([
    { label: '测款单总数', value: all.length },
    { label: '进行中', value: all.filter((item) => item.status === '进行中').length },
    { label: '已结束', value: all.filter((item) => item.status === '已结束').length },
    { label: '大货待定', value: all.filter((item) => item.bulkDecision === '待定').length },
  ])
}

function filtersHtml(): string {
  return `
    <div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label class="space-y-1">
        <span class="text-xs text-slate-500">关键词</span>
        <input type="search" value="${escapeHtml(state.search)}" placeholder="单号 / 款号 / SKU / 买手" data-pcs-testing-field="search" class="h-9 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
      </label>
      <label class="space-y-1">
        <span class="text-xs text-slate-500">状态</span>
        <select data-pcs-testing-field="status" class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">
          ${['全部', '进行中', '已结束'].map((item) => `<option value="${item}" ${state.status === item ? 'selected' : ''}>${item}</option>`).join('')}
        </select>
      </label>
      <div class="flex w-full gap-2 border-t pt-3"><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" data-pcs-testing-action="query">查询</button>
      <button type="button" class="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-testing-action="reset">重置</button>
      ${renderButton({ label: '导出', action: { prefix: 'pcs-testing', action: 'export', skipPageRerender: true } })}</div>
    </div>
  `
}

for (const column of columns) {
  if (column.actionColumn) continue
  column.freezeable = true
  column.sortable = true
  column.sortValue ||= (order) => ({ order: order.orderCode, sku: order.skuCodes.join('、'), status: order.status, step: TESTING_STEP_LABEL[order.currentStepKey], bulk: order.bulkDecision, channel: order.channelCodes.join('、') })[column.key as 'order']
}
const tableState: ProcessOrderListControllerState = { currentPage: 1, sort: null, preferences, preferencesLoaded: false, showColumnSettings: false }
const table = createProcessOrderListController({ state: tableState, columns, preferenceKey: 'pcs-testing-orders-columns-v1', pageSizeOptions: [20, 50], eventPrefix: 'pcs-testing', rootSelector: '[data-pcs-testing-order-list]', tableSurfaceSelector: '[data-testing-table]', paginationSurfaceSelector: '[data-testing-pagination]', overlaysSurfaceSelector: '[data-testing-overlays]', defaultFrozenKeys: ['order'], columnSettingsTitle: '测款单列设置', emptyText: '没有匹配的测款单。', getRows: filteredOrders, locallyManagedEvents: true })

export function renderPcsTestingOrderListPage(): string {
  table.installColumnDragEvents()
  const view = table.getView()
  return `<div data-pcs-testing-order-list data-skip-page-rerender="true">${renderStandardListPage({
    title: '测款单',
    primaryActionsHtml: '<a data-nav="/pcs/testing/orders/create" href="/pcs/testing/orders/create" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">新建测款单</a>',
    filtersHtml: filtersHtml(), statsHtml: statsHtml(),
    listTitle: `测款单列表（${filteredOrders().length}）`,
    listActionsHtml: renderButton({ label: '列设置', action: { prefix: 'pcs-testing', action: 'open-column-settings', skipPageRerender: true } }),
    tableHtml: `<div data-testing-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-testing-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-testing-overlays>${table.renderColumnSettings()}</div>`,
  })}</div>`
}
function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-pcs-testing-order-list]')
  if (root) root.outerHTML = renderPcsTestingOrderListPage()
}
export function handlePcsTestingOrderInput(target: Element): boolean {
  const field = target.getAttribute('data-pcs-testing-field')
  const value = (target as HTMLInputElement).value
  if (field === 'search') state.search = value
  else if (field === 'status') state.status = value as ListState['status']
  else if (field === 'pageSize') { table.setPageSize(Number(value)); table.refresh() }
  else return false
  return true
}
export function handlePcsTestingOrderEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-pcs-testing-action]')
  if (!node) return false
  const action = node.dataset.pcsTestingAction || ''
  const key = node.dataset.pcsTestingColumnKey || node.closest<HTMLElement>('[data-column-key]')?.dataset.columnKey || ''
  if (action === 'query' || action === 'reset') {
    if (action === 'reset') { state.search = ''; state.status = '全部' }
    Object.assign(applied, state)
    tableState.currentPage = 1; refresh()
  } else if (action === 'export') exportStandardListRows({ fileName: '测款单', columns, rows: filteredOrders() })
  else if (action === 'prev-page' || action === 'next-page') { table.stepPage(action === 'prev-page' ? -1 : 1); table.refresh() }
  else if (action === 'sort-column') { table.cycleSort(key); table.refresh() }
  else if (['open-column-settings', 'close-column-settings', 'close-drawers'].includes(action)) { tableState.showColumnSettings = action === 'open-column-settings'; table.refresh({ table: false, pagination: false, overlays: true }) }
  else if (action === 'restore-column-settings') { table.restorePreferences(); table.refresh({ overlays: true }) }
  else if (action.startsWith('toggle-column-')) { table.updateColumnPreference(action, key, (node as HTMLInputElement).checked); table.refresh({ overlays: true }) }
  else return false
  return true
}
export function isPcsTestingOrderDialogOpen(): boolean { return tableState.showColumnSettings }
