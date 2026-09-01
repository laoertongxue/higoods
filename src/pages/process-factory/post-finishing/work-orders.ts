// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { listPostFinishingDefectRecords, listPostFinishingFullFlowPostTasks, type PostFinishingPostTask } from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { appStore } from '../../../state/store.ts'
import { renderPostStatusBadge } from './shared.ts'

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/work-orders?${params.toString()}`)
}

const columns: StandardListColumn<PostFinishingPostTask>[] = [
  { key: 'order', title: '后道单 / 根送货单', width: 330, required: true, freezeable: true, render: (task) => `<div class="font-mono font-semibold">${escapeHtml(task.postTaskNo)}</div><div class="mt-1 font-mono text-xs text-blue-700">${escapeHtml(task.deliveryOrderNo)}</div>` },
  { key: 'source', title: '生产单 / 质检任务', width: 330, required: true, render: (task) => `<div>${escapeHtml(task.productionOrderNo)}</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(task.qcTaskNo)} · 第 ${task.returnIndex} 次回货</div>` },
  { key: 'style', title: '款式 / SKU', width: 360, required: true, render: (task) => { const sku = task.lines[0]?.sku; return sku ? `<div class="flex items-center gap-3"><button type="button" class="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(`${sku.spuCode} ${sku.spuName}`)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} 款式图`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button><div><div class="font-medium">${escapeHtml(sku.spuName)}</div><div class="mt-1 text-xs text-muted-foreground">${task.lines.length} SKU · ${task.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件</div></div></div>` : '—' } },
  { key: 'status', title: '状态', width: 150, required: true, render: (task) => renderPostStatusBadge(task.status) },
  { key: 'recheck', title: '下游复检单', width: 220, required: true, render: (task) => `<span class="font-mono text-xs">${escapeHtml(task.recheckOrderNo || '待生成')}</span>` },
  { key: 'actions', title: '操作', width: 300, required: true, actionColumn: true, render: (task) => `<div class="flex justify-end gap-3 whitespace-nowrap"><a data-nav="/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(task.postTaskId)}" class="text-xs text-blue-600 hover:underline">打印后道加工单</a><a data-nav="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(task.postTaskNo)}" class="text-xs text-blue-600 hover:underline">PDA执行</a><a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(task.deliveryId)}" class="text-xs text-blue-600 hover:underline">查看全流程</a></div>` },
]

export function renderPostFinishingWorkOrdersPage(): string {
  const keyword = query().get('keyword')?.toLowerCase() || ''
  const allTasks = listPostFinishingFullFlowPostTasks()
  const tasks = allTasks.filter((task) => !keyword || [task.postTaskNo, task.qcTaskNo, task.deliveryOrderNo, task.productionOrderNo].join(' ').toLowerCase().includes(keyword))
  const defects = listPostFinishingDefectRecords({ discoveryStage: '后道' })
  const pageSize = Math.max(10, Math.min(50, Number(query().get('pageSize') || 20)))
  const slice = paginateStandardListRows(tasks, Number(query().get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['order'], pageSize }
  return renderStandardListPage({
    title: '后道单',
    primaryActionsHtml: '<a data-nav="/fcs/pda/post-finishing/execute" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">打开 PDA 后道加工</a>',
    filtersHtml: `<form action="/fcs/craft/post-finishing/work-orders" class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"><label class="text-xs text-muted-foreground">关键词<input name="keyword" value="${escapeHtml(query().get('keyword') || '')}" class="ml-2 h-9 w-96 rounded-md border px-3 text-sm" placeholder="后道单/质检任务/送货单/生产单"/></label><button class="ml-auto h-9 rounded-md border px-4 text-sm">查询</button></form>`,
    statsHtml: renderStandardListStats([
      { label: '后道单', value: `${allTasks.length} 张` },
      { label: '待加工', value: `${allTasks.filter((task) => task.status === '待后道').length} 张` },
      { label: '加工中', value: `${allTasks.filter((task) => task.status === '后道中').length} 张` },
      { label: '后道瑕疵记录', value: `${defects.length} 条` },
    ]),
    listTitle: '后道单列表',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-work-orders', emptyText: '质检选择“需要后道加工”后自动生成后道单。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-work-orders', fieldPrefix: 'post-finishing-work-orders' }),
  })
}

export function handlePostFinishingWorkOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/fcs/craft/post-finishing/work-orders') return false
  const action = target.closest<HTMLElement>('[data-post-finishing-work-orders-action]')?.dataset.postFinishingWorkOrdersAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-work-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
