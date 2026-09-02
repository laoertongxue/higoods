// @page-pattern: list

import { renderFormDialog } from '../../../components/ui/dialog.ts'
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
import { renderPostStatusBadge } from './shared.ts'

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
  currentStage: string
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

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function sourceOptions(selected: string): string {
  return ['<option value="">全部</option>', ...Object.entries(POST_FINISHING_SEWING_TASK_TYPE_LABEL).map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)].join('')
}

const columns: StandardListColumn<PostFinishingRootTaskRow>[] = [
  { key: 'spu', title: 'SPU', width: 300, required: true, freezeable: true, render: renderStyle },
  { key: 'task', title: '后道任务', width: 260, required: true, render: (row) => `<div class="font-semibold">后道质检</div><div class="mt-1 font-mono text-xs">${escapeHtml(row.order.sewingTaskNo)}</div><div class="mt-1 text-xs text-muted-foreground">工厂：${escapeHtml(row.order.managedPostFactoryName)}</div>` },
  { key: 'production', title: '生产单信息', width: 200, required: true, render: (row) => `<div class="font-mono font-semibold text-blue-700">${escapeHtml(row.order.productionOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">技术包 v1.0</div><div class="mt-1 text-xs text-muted-foreground">售卖类型：预售</div>` },
  { key: 'planned', title: '计划数量', width: 120, required: true, align: 'center', render: (row) => `${row.plannedQty} 件` },
  { key: 'waitProcess', title: '已入待加工仓', width: 150, required: true, align: 'center', render: (row) => `${row.waitProcessQty} 件` },
  { key: 'uninspected', title: '未质检', width: 110, required: true, align: 'center', render: (row) => `${row.uninspectedQty} 件` },
  { key: 'inspected', title: '已质检', width: 110, required: true, align: 'center', render: (row) => `${row.inspectedQty} 件` },
  { key: 'handover', title: '待交出', width: 110, required: true, align: 'center', render: (row) => `${row.waitHandoverQty} 件` },
  { key: 'source', title: '上游来源', width: 170, required: true, render: (row) => escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.order.sewingTaskType]) },
  { key: 'assignment', title: '分配状态', width: 120, required: true, align: 'center', render: () => renderPostStatusBadge('已派单') },
  { key: 'weight', title: 'SKU 重量', width: 130, required: true, align: 'center', render: (row) => `<span class="${row.weightedSkuCount === row.order.skus.length ? 'text-emerald-700' : 'text-amber-700'}">${row.weightedSkuCount}/${row.order.skus.length} 已设置</span>` },
  { key: 'actions', title: '操作', width: 470, required: true, actionColumn: true, render: (row) => {
    const latestQc = [...row.qcTasks].sort((a, b) => b.returnIndex - a.returnIndex)[0]
    const qcActions = latestQc
      ? `<a data-nav="/fcs/craft/post-finishing/qc-orders?keyword=${encodeURIComponent(row.order.productionOrderNo)}" class="text-xs text-blue-600 hover:underline">查看质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_ORDER&id=${encodeURIComponent(latestQc.qcTaskNo)}" class="text-xs text-blue-600 hover:underline">打印质检单</a><a data-nav="/fcs/craft/post-finishing/print?type=QC_DETAIL&id=${encodeURIComponent(latestQc.qcTaskNo)}" class="text-xs text-blue-600 hover:underline">打印质检详情单</a>`
      : '<span class="text-xs text-muted-foreground">暂无质检单</span>'
    return `<div class="flex flex-wrap justify-end gap-x-3 gap-y-2"><a data-nav="/fcs/craft/post-finishing/audit-records?keyword=${encodeURIComponent(row.order.productionOrderNo)}" class="text-xs text-blue-600 hover:underline">查看任务</a><a data-nav="/fcs/craft/post-finishing/wait-process-warehouse?tab=returns&keyword=${encodeURIComponent(row.order.productionOrderNo)}" class="text-xs text-blue-600 hover:underline" title="仍由待加工仓执行送检后生成质检单">生成质检单</a><a data-nav="/fcs/craft/post-finishing/tasks?weightOrder=${encodeURIComponent(row.order.productionOrderNo)}" class="text-xs text-blue-600 hover:underline">设置 SKU 重量</a>${qcActions}</div>`
  } },
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
    const currentStage = traces.some((trace) => trace.receipt) ? '已收货'
      : hasWaitingOutbound ? '待交出'
        : traces.some((trace) => trace.recheckOrder) ? '复检中'
          : traces.some((trace) => trace.postTask) ? '后道中'
            : traces.some((trace) => trace.qcTask) ? '质检中'
              : orderDeliveries.some((delivery) => delivery.confirmedAt) ? '待送检' : '待回货'
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
      currentStage,
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
    title: '后道任务',
    filtersHtml: `<form action="/fcs/craft/post-finishing/tasks" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4 xl:grid-cols-7"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="后道任务/生产单号/款式/技术包版本"/></label><label class="text-xs text-muted-foreground">出库状态<select name="outboundStatus" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['未出库','待出库','已出库'], outboundStatus)}</select></label><label class="text-xs text-muted-foreground">后道来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${sourceOptions(source)}</select></label><label class="text-xs text-muted-foreground">分配状态<select name="assignment" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['已派单'], assignment)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><label class="text-xs text-muted-foreground">售卖类型<select name="saleType" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['预售'], saleType)}</select></label><div class="flex items-end justify-end gap-2 md:col-span-4 xl:col-span-7"><a data-nav="/fcs/craft/post-finishing/tasks" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '后道任务', value: `${POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS.length} 个` },
      { label: '计划数量', value: `${totalPlanned} 件` },
      { label: '未质检数量', value: `${totalUninspected} 件` },
      { label: '已入待加工仓', value: `${totalWaitProcess} 件` },
      { label: '待交出数量', value: `${totalWaitHandover} 件` },
    ]),
    listTitle: `后道任务列表 · 当前最远环节：${escapeHtml(rows[0]?.currentStage || '—')}`,
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-tasks', emptyText: '暂无符合条件的后道任务。' }),
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
