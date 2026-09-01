// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  listPostFinishingFactoryReturns,
  tracePostFinishingFullFlow,
  type PostFinishingAcceptanceProductionOrder,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { appStore } from '../../../state/store.ts'
import { renderPostStatusBadge } from './shared.ts'

interface PostFinishingRootTaskRow {
  order: PostFinishingAcceptanceProductionOrder
  returnCount: number
  completedCount: number
  currentStage: string
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/tasks?${params.toString()}`)
}

function renderStyle(row: PostFinishingRootTaskRow): string {
  const sku = row.order.skus[0]
  return `<div class="flex items-center gap-3"><button type="button" class="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(`${row.order.styleNo} ${row.order.styleName}`)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${row.order.styleName} 款式图`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button><div><div class="font-semibold">${escapeHtml(row.order.styleName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.styleNo)} · 5 个 SKU</div></div></div>`
}

const columns: StandardListColumn<PostFinishingRootTaskRow>[] = [
  { key: 'order', title: '生产单 / 后道任务', width: 300, required: true, freezeable: true, render: (row) => `<div class="font-mono font-semibold">${escapeHtml(row.order.productionOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.sewingTaskNo)} · ${escapeHtml(row.order.executionTaskId)}</div>` },
  { key: 'style', title: '款式 / SKU', width: 360, required: true, render: renderStyle },
  { key: 'factory', title: '车缝工厂 / 后道工厂', width: 330, required: true, render: (row) => `<div>${escapeHtml(row.order.sewingFactoryName)}</div><div class="mt-1 text-xs text-muted-foreground">→ ${escapeHtml(row.order.managedPostFactoryName)}</div>` },
  { key: 'returns', title: '回货进度', width: 180, required: true, align: 'center', render: (row) => `<strong>${row.returnCount} / 5 次</strong><div class="mt-1 text-xs text-muted-foreground">已收货 ${row.completedCount} 次</div>` },
  { key: 'stage', title: '当前最远环节', width: 170, required: true, render: (row) => renderPostStatusBadge(row.currentStage) },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => `<div class="flex justify-end gap-3 whitespace-nowrap"><a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns" class="text-xs text-blue-600 hover:underline">查看回货</a><a data-nav="/fcs/craft/post-finishing/audit-records?keyword=${encodeURIComponent(row.order.productionOrderNo)}" class="text-xs text-blue-600 hover:underline">查看全流程</a></div>` },
]

export function renderPostFinishingTasksPage(): string {
  const deliveries = listPostFinishingFactoryReturns()
  const keyword = query().get('keyword')?.trim().toLowerCase() || ''
  const rows = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((order): PostFinishingRootTaskRow => {
    const orderDeliveries = deliveries.filter((delivery) => delivery.productionOrderNo === order.productionOrderNo)
    const traces = orderDeliveries.map((delivery) => tracePostFinishingFullFlow(delivery.deliveryOrderNo))
    const currentStage = traces.some((trace) => trace.receipt) ? '已收货'
      : traces.some((trace) => trace.waitHandoverRecord?.status === '待交出') ? '待交出'
        : traces.some((trace) => trace.recheckOrder) ? '复检中'
          : traces.some((trace) => trace.postTask) ? '后道中'
            : traces.some((trace) => trace.qcTask) ? '质检中'
              : orderDeliveries.some((delivery) => delivery.confirmedAt) ? '待送检' : '待回货'
    return { order, returnCount: orderDeliveries.length, completedCount: traces.filter((trace) => trace.receipt).length, currentStage }
  }).filter((row) => !keyword || [row.order.productionOrderNo, row.order.styleNo, row.order.styleName, row.order.sewingFactoryName].join(' ').toLowerCase().includes(keyword))
  const pageSize = Math.max(10, Math.min(50, Number(query().get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(query().get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['order'], pageSize }
  return renderStandardListPage({
    title: '后道任务',
    filtersHtml: `<form action="/fcs/craft/post-finishing/tasks" class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"><label class="text-xs text-muted-foreground">关键词<input name="keyword" value="${escapeHtml(query().get('keyword') || '')}" class="ml-2 h-9 w-80 rounded-md border px-3 text-sm" placeholder="生产单/款号/款式/工厂"/></label><button class="ml-auto h-9 rounded-md border px-4 text-sm">查询</button></form>`,
    statsHtml: renderStandardListStats([
      { label: '后道任务', value: `${POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.length} 个生产单` },
      { label: '已登记回货', value: `${deliveries.length} / 15 次` },
      { label: '已完成收货', value: `${deliveries.filter((delivery) => tracePostFinishingFullFlow(delivery.deliveryOrderNo).receipt).length} 次` },
    ]),
    listTitle: '生产单级后道任务',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-tasks', emptyText: '暂无符合条件的后道任务。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-tasks', fieldPrefix: 'post-finishing-tasks' }),
  })
}

export function handlePostFinishingTasksEvent(target: HTMLElement, event?: Event): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/fcs/craft/post-finishing/tasks') return false
  const action = target.closest<HTMLElement>('[data-post-finishing-tasks-action]')?.dataset.postFinishingTasksAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-tasks-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
