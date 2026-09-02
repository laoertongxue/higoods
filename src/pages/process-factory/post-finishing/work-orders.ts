// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowQcTask,
  listPostFinishingDefectRecords,
  listPostFinishingFullFlowPostTasks,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingPostTask,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostStatusBadge } from './shared.ts'

interface WorkOrderRow {
  task: PostFinishingPostTask
  delivery?: PostFinishingFactoryReturnDelivery
  qcTask?: PostFinishingQcTask
  totalQty: number
  defectQty: number
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/work-orders?${params.toString()}`)
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function renderSkuLines(row: WorkOrderRow): string {
  return `<div class="space-y-2">${row.task.lines.map((line) => `<div class="flex items-center gap-2"><button type="button" class="relative flex h-10 w-10 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(`${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[8px] text-slate-500">加载中</span></button><span class="min-w-0"><span class="block font-mono text-xs">${escapeHtml(line.sku.skuCode)}</span><span class="text-[11px] text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · ${line.expectedQty} 件</span></span></div>`).join('')}</div>`
}

const columns: StandardListColumn<WorkOrderRow>[] = [
  { key: 'documents', title: '单据', width: 200, required: true, freezeable: true, render: (row) => `<div>后道：<strong class="break-all font-mono">${escapeHtml(row.task.postTaskNo)}</strong></div><div class="mt-1 text-xs">质检：<span class="font-mono text-blue-700">${escapeHtml(row.task.qcTaskNo)}</span></div><div class="mt-1 text-xs">生产：<span class="font-mono text-blue-700">${escapeHtml(row.task.productionOrderNo)}</span></div><div class="mt-1 break-all text-[11px] text-muted-foreground">第 ${row.task.returnIndex} 次回货 · ${escapeHtml(row.task.deliveryOrderNo)}</div>` },
  { key: 'factory', title: '工厂', width: 150, required: true, render: (row) => `<div><span class="text-xs text-muted-foreground">来源：</span>${escapeHtml(row.delivery?.sewingFactoryName || '—')}</div><div class="mt-1"><span class="text-xs text-muted-foreground">后道：</span>${escapeHtml(row.delivery?.managedPostFactoryName || '—')}</div>` },
  { key: 'sku', title: 'SKU 明细', width: 230, required: true, render: renderSkuLines },
  { key: 'process', title: '后道项目', width: 150, required: true, render: (row) => `<div class="flex flex-wrap gap-1">${row.task.processItems.map((item) => `<span class="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">${escapeHtml(item)}</span>`).join('')}</div>` },
  { key: 'total', title: '总数量', width: 90, required: true, align: 'center', render: (row) => `${row.totalQty} 件` },
  { key: 'defect', title: '后道不合格', width: 110, required: true, align: 'center', render: (row) => `${row.defectQty} 件` },
  { key: 'status', title: '后道状态', width: 100, required: true, render: (row) => renderPostStatusBadge(row.task.status) },
  { key: 'time', title: '时间', width: 160, required: true, render: (row) => `<div><span class="text-xs text-muted-foreground">创建：</span>${escapeHtml(row.qcTask?.completedAt ? new Date(row.qcTask.completedAt).toLocaleString('zh-CN') : '—')}</div><div class="mt-1"><span class="text-xs text-muted-foreground">开始：</span>${escapeHtml(row.task.startedAt ? new Date(row.task.startedAt).toLocaleString('zh-CN') : '—')}</div><div class="mt-1"><span class="text-xs text-muted-foreground">完成：</span>${escapeHtml(row.task.completedAt ? new Date(row.task.completedAt).toLocaleString('zh-CN') : '—')}</div>` },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => `<div class="grid grid-cols-2 gap-x-3 gap-y-2"><a data-nav="/fcs/craft/post-finishing/work-orders/${encodeURIComponent(row.task.postTaskId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">查看详情</a><a data-nav="/fcs/pda/post-finishing/execute?id=${encodeURIComponent(row.task.postTaskNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">PDA 执行（优先）</a><a data-nav="/fcs/craft/post-finishing/print?type=POST_ORDER&id=${encodeURIComponent(row.task.postTaskId)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">打印任务流转卡</a><a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(row.task.deliveryId)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">查看全流程</a></div>` },
]

export function renderPostFinishingWorkOrdersPage(): string {
  const current = query()
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const processItem = current.get('processItem') || ''
  const factory = current.get('factory') || ''
  const allTasks = listPostFinishingFullFlowPostTasks()
  const rows = allTasks.map((task): WorkOrderRow => {
    const results = task.results || task.draftLines || []
    return {
      task,
      delivery: getPostFinishingFactoryReturn(task.deliveryId),
      qcTask: getPostFinishingFullFlowQcTask(task.qcTaskId),
      totalQty: task.lines.reduce((sum, line) => sum + line.expectedQty, 0),
      defectQty: results.reduce((sum, line) => sum + line.defectQty, 0),
    }
  }).filter((row) => {
    const searchable = [row.task.postTaskNo, row.task.qcTaskNo, row.task.deliveryOrderNo, row.task.productionOrderNo, row.delivery?.sewingFactoryName, row.delivery?.managedPostFactoryName, ...row.task.processItems, ...row.task.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!status || row.task.status === status)
      && (!processItem || row.task.processItems.includes(processItem))
      && (!factory || row.delivery?.managedPostFactoryName === factory)
  })
  const defects = listPostFinishingDefectRecords({ discoveryStage: '后道' })
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['documents'], pageSize }
  const processItems = [...new Set(allTasks.flatMap((task) => task.processItems))]
  const factories = [...new Set(allTasks.map((task) => getPostFinishingFactoryReturn(task.deliveryId)?.managedPostFactoryName).filter((value): value is string => Boolean(value)))]
  return renderStandardListPage({
    title: '后道单',
    primaryActionsHtml: '<div class="flex items-center gap-3"><span class="text-xs text-muted-foreground">现场优先使用 PDA；设备不可用时可从“查看详情”进入 Web 应急处理</span><a data-nav="/fcs/pda/post-finishing/execute" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">打开 PDA 后道加工</a></div>',
    filtersHtml: `<form action="/fcs/craft/post-finishing/work-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-5"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="后道单/质检单/生产单/款式/后道项目"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待后道','后道中','后道完成'], status)}</select></label><label class="text-xs text-muted-foreground">后道项目<select name="processItem" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(processItems, processItem)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-5"><a data-nav="/fcs/craft/post-finishing/work-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '后道单', value: `${allTasks.length} 张` },
      { label: '等待后道', value: `${allTasks.filter((task) => task.status === '待后道').length} 张` },
      { label: '后道中', value: `${allTasks.filter((task) => task.status === '后道中').length} 张` },
      { label: '后道不合格记录', value: `${defects.length} 条` },
    ]),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-work-orders', emptyText: '质检确认需要后道加工后自动生成后道单。' }),
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
