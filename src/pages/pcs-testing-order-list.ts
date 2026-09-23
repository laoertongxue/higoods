// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { escapeHtml } from '../utils.ts'
import {
  bootstrapTestingOrders,
  createTestingOrder,
  listTestingOrders,
  TESTING_ORDER_STEPS,
  type TestingOrderRecord,
  type TestingOrderStepKey,
} from '../data/pcs-testing-order-repository.ts'
import { listStyleArchives } from '../data/pcs-style-archive-repository.ts'

bootstrapTestingOrders()

interface ListState {
  search: string
  status: '全部' | '进行中' | '已结束'
  notice: string
  page: number
  pageSize: number
}

const state: ListState = { search: '', status: '全部', notice: '', page: 1, pageSize: 20 }

const TESTING_STEP_LABEL = Object.fromEntries(
  TESTING_ORDER_STEPS.map((step) => [step.key, step.title]),
) as Record<TestingOrderStepKey, string>

function statusBadge(order: TestingOrderRecord): string {
  return order.status === '已结束'
    ? '<span class="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">已结束</span>'
    : '<span class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">进行中</span>'
}

function filteredOrders(): TestingOrderRecord[] {
  const keyword = state.search.trim().toLowerCase()
  return listTestingOrders().filter((order) => {
    if (state.status !== '全部' && order.status !== state.status) return false
    if (!keyword) return true
    return [order.orderCode, order.styleCode, order.styleName, ...order.skuCodes]
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
        <button type="button" class="shrink-0 cursor-zoom-in overflow-hidden rounded-md border" data-pda-image-preview-url="${escapeHtml(order.styleImageUrl || 'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg')}" data-pda-image-preview-title="${escapeHtml(`${order.styleCode} ${order.styleName}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(order.styleName)}大图">
          <img src="${escapeHtml(order.styleImageUrl || 'https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg')}" alt="${escapeHtml(order.styleName)}" class="h-12 w-12 object-cover" loading="lazy" />
        </button>
        <div>
          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/pcs/testing/orders/${encodeURIComponent(order.testingOrderId)}">${escapeHtml(order.orderCode)}</button>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(order.styleCode)} · ${escapeHtml(order.styleName)}</div>
        </div>
      </div>`,
  },
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
  const all = listTestingOrders()
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
        <input type="search" value="${escapeHtml(state.search)}" placeholder="单号 / 款号 / SKU" data-pcs-testing-field="search" class="h-9 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400" />
      </label>
      <label class="space-y-1">
        <span class="text-xs text-slate-500">状态</span>
        <select data-pcs-testing-field="status" class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">
          ${['全部', '进行中', '已结束'].map((item) => `<option value="${item}" ${state.status === item ? 'selected' : ''}>${item}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" data-pcs-testing-action="query">查询</button>
      <button type="button" class="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-testing-action="reset">重置</button>
    </div>
  `
}

export function renderPcsTestingOrderListPage(): string {
  const filtered = filteredOrders()
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
  state.page = Math.min(Math.max(1, state.page), totalPages)
  const start = (state.page - 1) * state.pageSize
  const pageRows = filtered.slice(start, start + state.pageSize)
  const feedback = state.notice
    ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">${escapeHtml(state.notice)}</div>`
    : ''
  return `<div data-pcs-testing-order-list data-skip-page-rerender="true">${renderStandardListPage({
    title: '测款单',
    primaryActionsHtml: `<button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-testing-action="open-create">新建测款单</button>`,
    feedbackHtml: feedback,
    filtersHtml: filtersHtml(),
    statsHtml: statsHtml(),
    listTitle: `测款单列表（${filtered.length}）`,
    tableHtml: renderStandardListTable({
      columns,
      rows: pageRows,
      preferences: { ...preferences, pageSize: state.pageSize },
      sort: null,
      eventPrefix: 'pcs-testing',
      emptyText: '没有匹配的测款单。',
    }),
    paginationHtml: renderTablePagination({
      total: filtered.length,
      from: filtered.length ? start + 1 : 0,
      to: Math.min(start + state.pageSize, filtered.length),
      currentPage: state.page,
      totalPages,
      pageSize: state.pageSize,
      actionPrefix: 'pcs-testing',
      fieldPrefix: 'pcs-testing',
      pageSizeOptions: [20, 50],
    }),
  })}</div>`
}

function refresh(): void {
  const root = document.querySelector<HTMLElement>('[data-pcs-testing-order-list]')
  if (root) root.outerHTML = renderPcsTestingOrderListPage()
}

export function handlePcsTestingOrderInput(target: Element): boolean {
  const field = target.getAttribute('data-pcs-testing-field')
  if (!field) return false
  const value = (target as HTMLInputElement | HTMLSelectElement).value
  if (field === 'search') state.search = value
  else if (field === 'status') state.status = (value as ListState['status']) || '全部'
  else if (field === 'pageSize') state.pageSize = Number(value) || 20
  else return false
  state.page = 1
  if (typeof document !== 'undefined') refresh()
  return true
}

export function handlePcsTestingOrderEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-pcs-testing-action]')
  if (!node) return false
  const action = node.dataset.pcsTestingAction
  if (action === 'query') {
    state.page = 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'reset') {
    state.search = ''
    state.status = '全部'
    state.page = 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'prev-page') {
    state.page = Math.max(1, state.page - 1)
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'next-page') {
    state.page += 1
    if (typeof document !== 'undefined') refresh()
    return true
  }
  if (action === 'open-create') {
    const style = listStyleArchives()[0]
    if (!style) {
      state.notice = '暂无款式档案，无法新建测款单。'
      if (typeof document !== 'undefined') refresh()
      return true
    }
    const result = createTestingOrder({ styleId: style.styleId })
    state.notice = result.ok ? `已创建 ${result.order!.orderCode}。` : result.message || '创建失败。'
    if (typeof document !== 'undefined') refresh()
    return true
  }
  return false
}

export function isPcsTestingOrderDialogOpen(): boolean {
  return false
}
