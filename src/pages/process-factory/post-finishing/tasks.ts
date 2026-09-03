// @page-pattern: list

import { renderDialog, renderFormDialog } from '../../../components/ui/dialog.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS,
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  listPostFinishingFactoryReturns,
  listPostFinishingFullFlowQcTasks,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseRecords,
  tracePostFinishingFullFlow,
  type PostFinishingAcceptanceProductionOrder,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'

const SKU_WEIGHT_STORAGE_KEY = 'higood-post-finishing-sku-weights-v1'

interface PostFinishingRootTaskRow {
  order: PostFinishingAcceptanceProductionOrder
  deliveries: PostFinishingFactoryReturnDelivery[]
  qcTasks: PostFinishingQcTask[]
  plannedQty: number
  waitProcessQty: number
  uninspectedQty: number
  inspectedQty: number
  waitHandoverQty: number
  returnCount: number
  outboundStatus: '未出库' | '待出库' | '已出库'
  weightedSkuCount: number
}

let message = ''

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string | null>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/tasks${params.size ? `?${params.toString()}` : ''}`)
}

function readSkuWeights(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SKU_WEIGHT_STORAGE_KEY) || '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'number' && value >= 0)) as Record<string, number>
  } catch {
    return {}
  }
}

function renderStyle(row: PostFinishingRootTaskRow): string {
  const sku = row.order.skus[0]
  return `<div class="flex items-center gap-3"><button type="button" class="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(`${row.order.styleNo} ${row.order.styleName}`)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${row.order.styleName} 款式图`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button><div class="min-w-0"><div class="font-mono font-semibold">${escapeHtml(row.order.styleNo)}</div><div class="mt-1 max-w-56 truncate text-xs text-muted-foreground" title="${escapeHtml(row.order.styleName)}">${escapeHtml(row.order.styleName)}</div></div></div>`
}

function renderSkuWeightsDialog(orderNo: string, weights: Record<string, number>): string {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === orderNo)
  if (!order) return ''
  const fields = order.skus.map((sku) => `<label class="flex items-center gap-3 rounded-lg border p-3"><button type="button" class="relative flex h-12 w-12 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(`${sku.skuCode} ${sku.colorName} ${sku.sizeName}`)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button><span class="min-w-0 flex-1"><span class="block truncate font-mono text-xs">${escapeHtml(sku.skuCode)}</span><span class="mt-1 block text-xs text-muted-foreground">${escapeHtml(sku.colorName)} / ${escapeHtml(sku.sizeName)}</span></span><span class="flex items-center gap-2"><input type="number" min="0" step="0.001" value="${weights[sku.skuId] ?? ''}" data-post-finishing-sku-weight="${escapeHtml(sku.skuId)}" class="h-9 w-24 rounded-md border px-2 text-right text-sm" aria-label="${escapeHtml(sku.skuCode)} 单件重量"/><span class="text-xs text-muted-foreground">kg/件</span></span></label>`).join('')
  return renderFormDialog({
    title: '设置 SKU 重量',
    description: `${order.productionOrderNo} · 重量用于现场称重核对，不改变当前 QC 后道数量流转。`,
    closeAction: { prefix: 'post-finishing-tasks', action: 'close-weight' },
    submitAction: { prefix: 'post-finishing-tasks', action: 'save-weight', label: '保存重量' },
    width: 'lg',
  }, `<div class="max-h-[60vh] space-y-2 overflow-y-auto" data-post-finishing-weight-order="${escapeHtml(order.productionOrderNo)}">${fields}</div>`)
}

function totalQuantity(lines: Array<{ registeredQty?: number; confirmedQty?: number; expectedQty?: number }>, field: 'registeredQty' | 'confirmedQty' | 'expectedQty'): number {
  return lines.reduce((sum, line) => sum + Number(line[field] || 0), 0)
}

function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—'
}

function renderRelatedRecordsDialog(
  order: PostFinishingAcceptanceProductionOrder,
  kind: 'returns' | 'qc',
  deliveries: PostFinishingFactoryReturnDelivery[],
  qcTasks: PostFinishingQcTask[],
): string {
  const closeAction = { prefix: 'post-finishing-tasks', action: 'close-related-dialog' }
  const sortedDeliveries = [...deliveries].sort((a, b) => a.returnIndex - b.returnIndex)
  const sortedQcTasks = [...qcTasks].sort((a, b) => a.returnIndex - b.returnIndex)
  const content = kind === 'returns'
    ? `<div class="max-h-[65vh] overflow-y-auto" data-testid="post-production-task-return-dialog"><div class="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">同一后道生产任务可分多次回货；每次回货独立保留送货单、数量、确认结果和状态。</div><div class="overflow-x-auto rounded-lg border"><table class="min-w-[760px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">回货批次</th><th class="px-3 py-2">送货单号</th><th class="px-3 py-2">来源工厂</th><th class="px-3 py-2">登记 / 确认 / 差异</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">确认时间</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${sortedDeliveries.map((delivery) => {
        const registeredQty = totalQuantity(delivery.lines, 'registeredQty')
        const confirmedQty = totalQuantity(delivery.lines, 'confirmedQty')
        const differenceQty = confirmedQty - registeredQty
        return `<tr><td class="px-3 py-3 font-medium">第 ${delivery.returnIndex} 次</td><td class="px-3 py-3 font-mono text-xs">${escapeHtml(delivery.deliveryOrderNo)}</td><td class="px-3 py-3 text-xs">${escapeHtml(delivery.sewingFactoryName)}</td><td class="px-3 py-3 whitespace-nowrap">${registeredQty} / ${delivery.confirmedAt ? confirmedQty : '待确认'} / <span class="${differenceQty === 0 ? 'text-emerald-700' : 'text-amber-700'}">${delivery.confirmedAt ? `${differenceQty > 0 ? '+' : ''}${differenceQty}` : '—'}</span> 件</td><td class="px-3 py-3">${renderPostStatusBadge(delivery.status)}</td><td class="px-3 py-3 whitespace-nowrap text-xs">${escapeHtml(formatTime(delivery.confirmedAt))}</td><td class="px-3 py-3"><a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(delivery.deliveryId)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">查看回货详情</a></td></tr>`
      }).join('') || '<tr><td colspan="7" class="px-4 py-10 text-center text-muted-foreground">该后道生产任务暂无回货记录。</td></tr>'}</tbody></table></div></div>`
    : `<div class="max-h-[65vh] overflow-y-auto" data-testid="post-production-task-qc-dialog"><div class="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">每次回货最终确认时自动生成且只生成一张质检单；单号按“生产单号-最大序号 + 1”生成，不允许人工修改。待加工仓送检只完成库存交接，不会再次建单或改号。</div><div class="overflow-x-auto rounded-lg border"><table class="min-w-[780px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">回货批次</th><th class="px-3 py-2">质检单号</th><th class="px-3 py-2">关联送货单</th><th class="px-3 py-2">质检数量</th><th class="px-3 py-2">质检人 / 状态</th><th class="px-3 py-2">生成时间</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${sortedQcTasks.map((task) => `<tr><td class="px-3 py-3 font-medium">第 ${task.returnIndex} 次</td><td class="px-3 py-3 font-mono text-xs font-semibold text-blue-700">${escapeHtml(task.qcTaskNo)}</td><td class="px-3 py-3 font-mono text-xs">${escapeHtml(task.deliveryOrderNo)}</td><td class="px-3 py-3 whitespace-nowrap">${totalQuantity(task.lines, 'expectedQty')} 件</td><td class="px-3 py-3"><div>${escapeHtml(task.status === '待送检' ? '尚未送检' : task.claimedBy?.actorName || '待领取')}</div><div class="mt-1">${renderPostStatusBadge(task.status)}</div></td><td class="px-3 py-3 whitespace-nowrap text-xs">${escapeHtml(formatTime(task.createdAt))}</td><td class="px-3 py-3"><div class="flex flex-col gap-1">${task.status === '待送检' ? `<a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&deliveryId=${encodeURIComponent(task.deliveryId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">去待加工仓送检</a>` : `<a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">查看质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">打印质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(task.qcTaskNo)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">打印质检详情单</a>`}</div></td></tr>`).join('') || '<tr><td colspan="7" class="px-4 py-10 text-center text-muted-foreground">该后道生产任务暂无质检单。</td></tr>'}</tbody></table></div></div>`
  const footer = `<button type="button" class="inline-flex h-9 items-center rounded-md border px-4 text-sm" data-post-finishing-tasks-action="close-related-dialog">关闭</button>`
  return `<div data-post-production-task-related-dialog data-skip-page-rerender="true">${renderDialog({
    title: kind === 'returns' ? '回货记录' : '质检单',
    description: `${order.productionOrderNo} · ${order.styleNo} · ${kind === 'returns' ? sortedDeliveries.length : sortedQcTasks.length} 条`,
    closeAction,
    width: 'lg',
  }, content, footer)}</div>`
}

function openRelatedRecordsDialog(orderNo: string, kind: 'returns' | 'qc'): void {
  const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === orderNo)
  if (!order) return
  document.querySelector('[data-post-production-task-related-dialog]')?.remove()
  const deliveries = listPostFinishingFactoryReturns().filter((item) => item.productionOrderNo === orderNo)
  const qcTasks = listPostFinishingFullFlowQcTasks().filter((item) => item.productionOrderNo === orderNo)
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', renderRelatedRecordsDialog(order, kind, deliveries, qcTasks))
  const dialog = host.querySelector<HTMLElement>('[data-post-production-task-related-dialog]')
  if (dialog) void import('../../../components/shell.ts').then(({ hydrateIcons }) => hydrateIcons(dialog))
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function sourceOptions(selected: string): string {
  return ['<option value="">全部</option>', ...Object.entries(POST_FINISHING_SEWING_TASK_TYPE_LABEL).map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)].join('')
}

const columns: StandardListColumn<PostFinishingRootTaskRow>[] = [
  { key: 'spu', title: 'SPU', width: 210, required: true, freezeable: true, render: renderStyle },
  { key: 'task', title: '后道生产任务', width: 190, required: true, render: (row) => `<div class="font-semibold">生产单级全流程</div><div class="mt-1 font-mono text-xs">来源任务：${escapeHtml(row.order.sewingTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">后道工厂：${escapeHtml(row.order.managedPostFactoryName)}</div>` },
  { key: 'production', title: '生产单信息', width: 180, required: true, render: (row) => `<div class="font-mono font-semibold text-blue-700">${escapeHtml(row.order.productionOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">技术包 v1.0</div><div class="mt-1 text-xs text-muted-foreground">售卖类型：预售</div>` },
  { key: 'planned', title: '计划数量', width: 96, required: true, align: 'center', render: (row) => `${row.plannedQty} 件` },
  { key: 'waitProcess', title: '已入待加工仓', width: 116, required: true, align: 'center', render: (row) => `${row.waitProcessQty} 件` },
  { key: 'uninspected', title: '未质检', width: 88, required: true, align: 'center', render: (row) => `${row.uninspectedQty} 件` },
  { key: 'inspected', title: '已质检', width: 88, required: true, align: 'center', render: (row) => `${row.inspectedQty} 件` },
  { key: 'handover', title: '待交出', width: 88, required: true, align: 'center', render: (row) => `${row.waitHandoverQty} 件` },
  { key: 'source', title: '上游来源', width: 130, required: true, render: (row) => escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.order.sewingTaskType]) },
  { key: 'assignment', title: '分配状态', width: 104, required: true, align: 'center', render: () => renderPostStatusBadge('已派单') },
  { key: 'weight', title: 'SKU 重量', width: 112, required: true, align: 'center', render: (row) => `<span class="${row.weightedSkuCount === row.order.skus.length ? 'text-emerald-700' : 'text-amber-700'}">${row.weightedSkuCount}/${row.order.skus.length} 已设置</span>` },
  { key: 'actions', title: '操作', width: 220, required: true, actionColumn: true, render: (row) => `<div class="grid grid-cols-2 gap-x-3 gap-y-2"><a data-nav="/fcs/dispatch/workbench?search_field=task&keyword=${encodeURIComponent(row.order.sewingTaskNo)}&source=post-finishing" class="whitespace-nowrap text-xs text-blue-600 hover:underline">查看来源任务</a><button type="button" data-skip-page-rerender="true" data-post-finishing-tasks-action="view-return-records" data-production-order-no="${escapeHtml(row.order.productionOrderNo)}" class="whitespace-nowrap text-left text-xs text-blue-600 hover:underline">回货记录（${row.deliveries.length}）</button><button type="button" data-skip-page-rerender="true" data-post-finishing-tasks-action="view-qc-orders" data-production-order-no="${escapeHtml(row.order.productionOrderNo)}" class="whitespace-nowrap text-left text-xs text-blue-600 hover:underline">质检单（${row.qcTasks.length}）</button><a data-nav="/fcs/craft/post-finishing/tasks?weightOrder=${encodeURIComponent(row.order.productionOrderNo)}" class="whitespace-nowrap text-xs text-blue-600 hover:underline">设置 SKU 重量</a></div>` },
]

export function renderPostFinishingTasksPage(): string {
  const current = query()
  const deliveries = listPostFinishingFactoryReturns()
  const qcTasks = listPostFinishingFullFlowQcTasks()
  const waitProcessRecords = listPostFinishingWaitProcessWarehouseRecords()
  const waitHandoverRecords = listPostFinishingWaitHandoverWarehouseRecords()
  const skuWeights = readSkuWeights()
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const outboundStatus = current.get('outboundStatus') || ''
  const source = current.get('source') || ''
  const assignment = current.get('assignment') || ''
  const factory = current.get('factory') || ''
  const saleType = current.get('saleType') || ''
  const rows = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((order): PostFinishingRootTaskRow => {
    const orderDeliveries = deliveries.filter((delivery) => delivery.productionOrderNo === order.productionOrderNo)
    const orderQcTasks = qcTasks.filter((task) => task.productionOrderNo === order.productionOrderNo)
    const traces = orderDeliveries.map((delivery) => tracePostFinishingFullFlow(delivery.deliveryOrderNo))
    const orderWaitHandover = waitHandoverRecords.filter((record) => record.productionOrderNo === order.productionOrderNo)
    const hasCompletedOutbound = traces.some((trace) => trace.receipt || trace.waitHandoverRecord?.status === '已交出')
    const hasWaitingOutbound = orderWaitHandover.some((record) => record.status === '待交出')
    const rowOutboundStatus: PostFinishingRootTaskRow['outboundStatus'] = hasCompletedOutbound ? '已出库' : hasWaitingOutbound ? '待出库' : '未出库'
    return {
      order,
      deliveries: orderDeliveries,
      qcTasks: orderQcTasks,
      plannedQty: order.skus.reduce((sum, sku) => sum + sku.plannedQty, 0),
      waitProcessQty: waitProcessRecords.filter((record) => record.productionOrderNo === order.productionOrderNo).reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.confirmedQty, 0), 0),
      uninspectedQty: orderQcTasks.filter((task) => task.status !== '质检完成').reduce((sum, task) => sum + task.lines.reduce((lineSum, line) => lineSum + line.expectedQty, 0), 0),
      inspectedQty: orderQcTasks.filter((task) => task.status === '质检完成').reduce((sum, task) => sum + (task.results || []).reduce((lineSum, line) => lineSum + line.expectedQty, 0), 0),
      waitHandoverQty: orderWaitHandover.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.availableQty, 0), 0),
      returnCount: orderDeliveries.length,
      outboundStatus: rowOutboundStatus,
      weightedSkuCount: order.skus.filter((sku) => typeof skuWeights[sku.skuId] === 'number').length,
    }
  }).filter((row) => {
    const searchable = [row.order.productionOrderNo, row.order.sewingTaskNo, row.order.styleNo, row.order.styleName, row.order.managedPostFactoryName, ...row.order.skus.map((sku) => sku.skuCode)].join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!outboundStatus || row.outboundStatus === outboundStatus)
      && (!source || row.order.sewingTaskType === source)
      && (!assignment || assignment === '已派单')
      && (!factory || row.order.managedPostFactoryName === factory)
      && (!saleType || saleType === '预售')
  })
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['spu'], pageSize }
  const factories = [...new Set(POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.map((order) => order.managedPostFactoryName))]
  const totalPlanned = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.reduce((sum, order) => sum + order.skus.reduce((skuSum, sku) => skuSum + sku.plannedQty, 0), 0)
  const totalWaitProcess = waitProcessRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.confirmedQty, 0), 0)
  const totalUninspected = qcTasks.filter((task) => task.status !== '质检完成').reduce((sum, task) => sum + task.lines.reduce((lineSum, line) => lineSum + line.expectedQty, 0), 0)
  const totalWaitHandover = waitHandoverRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + line.availableQty, 0), 0)
  return `${renderStandardListPage({
    title: '后道生产任务',
    primaryActionsHtml: `<div class="flex flex-wrap items-center justify-end gap-3"><span class="text-xs text-muted-foreground">一张后道生产任务对应一个生产单，可关联多次回货和多张质检单</span>${renderPostFinishingQcPrintActions()}</div>`,
    filtersHtml: `<form action="/fcs/craft/post-finishing/tasks" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4 xl:grid-cols-7"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="后道生产任务/生产单号/款式/技术包版本"/></label><label class="text-xs text-muted-foreground">出库状态<select name="outboundStatus" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['未出库','待出库','已出库'], outboundStatus)}</select></label><label class="text-xs text-muted-foreground">后道来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${sourceOptions(source)}</select></label><label class="text-xs text-muted-foreground">分配状态<select name="assignment" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['已派单'], assignment)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><label class="text-xs text-muted-foreground">售卖类型<select name="saleType" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['预售'], saleType)}</select></label><div class="flex items-end justify-end gap-2 md:col-span-4 xl:col-span-7"><a data-nav="/fcs/craft/post-finishing/tasks" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '后道生产任务', value: `${POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.length} 个` },
      { label: '计划数量', value: `${totalPlanned} 件` },
      { label: '未质检数量', value: `${totalUninspected} 件` },
      { label: '已入待加工仓', value: `${totalWaitProcess} 件` },
      { label: '待交出数量', value: `${totalWaitHandover} 件` },
    ]),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-tasks', emptyText: '暂无符合条件的后道生产任务。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-tasks', fieldPrefix: 'post-finishing-tasks' }),
  })}${message ? `<div class="fixed bottom-5 right-5 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow">${escapeHtml(message)}</div>` : ''}${current.get('weightOrder') ? renderSkuWeightsDialog(current.get('weightOrder') || '', skuWeights) : ''}`
}

export function handlePostFinishingTasksEvent(target: HTMLElement, event?: Event): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/fcs/craft/post-finishing/tasks') return false
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-tasks-action]')
  const action = actionNode?.dataset.postFinishingTasksAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))) })
    return true
  }
  if (action === 'close-weight') {
    navigate({ weightOrder: null })
    return true
  }
  if (action === 'view-return-records' || action === 'view-qc-orders') {
    openRelatedRecordsDialog(actionNode?.dataset.productionOrderNo || '', action === 'view-return-records' ? 'returns' : 'qc')
    return true
  }
  if (action === 'close-related-dialog') {
    target.closest('[data-post-production-task-related-dialog]')?.remove()
    return true
  }
  if (action === 'save-weight') {
    const orderNo = document.querySelector<HTMLElement>('[data-post-finishing-weight-order]')?.dataset.postFinishingWeightOrder || ''
    const order = POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.find((item) => item.productionOrderNo === orderNo)
    if (!order) return true
    const weights = readSkuWeights()
    document.querySelectorAll<HTMLInputElement>('[data-post-finishing-sku-weight]').forEach((input) => {
      const skuId = input.dataset.postFinishingSkuWeight || ''
      const value = input.value.trim()
      if (!value) delete weights[skuId]
      else {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed >= 0) weights[skuId] = parsed
      }
    })
    window.localStorage.setItem(SKU_WEIGHT_STORAGE_KEY, JSON.stringify(weights))
    message = `${order.productionOrderNo} 的 SKU 重量已保存。`
    navigate({ weightOrder: null })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-tasks-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
