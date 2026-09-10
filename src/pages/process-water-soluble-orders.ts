// @page-pattern: list

import { renderBadge } from '../components/ui/badge.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderDetailDrawer, renderSimpleDrawer } from '../components/ui/drawer.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
// renderStandardListTable 和 renderTablePagination 由现有列表控制器统一渲染。
import { renderToast, renderToastContainer } from '../components/ui/toast.ts'
import { canAssignWaterSolubleFactory, assignWaterSolubleFactory, listWaterSolubleWorkOrders, type WaterSolubleWorkOrder } from '../data/fcs/water-soluble-task-domain.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from '../data/fcs/process-order-flow-contract.ts'
import { getWaterSolubleWorkOrderThreeAxisView } from '../data/fcs/process-order-three-axis-view.ts'
import { getWaterSolubleOrderImageManifest } from '../data/fcs/process-order-image-manifest.ts'
import { listBusinessFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { appStore } from '../state/store.ts'
import { escapeHtml } from '../utils.ts'

type Overlay = { type: 'detail' | 'assign'; orderId: string } | null
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const state = { keyword: '', receiptStatus: '', processingStatus: '', handoverStatus: '', factoryId: '', exception: '', currentPage: 1, sort: null as ProcessOrderListControllerState['sort'], preferences: { order: [], visibleKeys: [], frozenKeys: ['waterOrderNo'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, overlay: null as Overlay }

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('<button', '<button data-skip-page-rerender="true"')
    .replaceAll('<select', '<select data-skip-page-rerender="true"')
    .replaceAll('<input', '<input data-skip-page-rerender="true"')
}

function getOrderStyleLabel(order: WaterSolubleWorkOrder): string {
  const productionOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
  const styleCode = productionOrder?.demandSnapshot.spuCode?.trim() || ''
  const styleName = productionOrder?.demandSnapshot.spuName?.trim() || ''
  if (styleCode && styleName) return `${styleCode} / ${styleName}`
  return styleCode || styleName || '未记录'
}

function getOrderImage(order: WaterSolubleWorkOrder, kind: 'style' | 'material'): string {
  const manifest = getWaterSolubleOrderImageManifest(order.waterOrderId)
  return kind === 'style' ? manifest?.product || '' : manifest?.material || ''
}

function renderOrderObject(order: WaterSolubleWorkOrder, kind: 'style' | 'material'): string {
  const label = kind === 'style' ? getOrderStyleLabel(order) : order.materialName
  const description = kind === 'style' ? '' : `${order.materialCode} · ${order.materialSpec}`
  const imageUrl = getOrderImage(order, kind)
  const imageHtml = `<button type="button" class="relative h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-skip-page-rerender="true" data-pda-image-preview-url="${escapeHtml(imageUrl)}" data-pda-image-preview-title="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white text-[10px] text-muted-foreground">图片加载中</span></button>`
  return `<div class="flex items-start gap-2" data-water-soluble-object="${kind}">${imageHtml}<div class="min-w-0"><div class="break-words">${escapeHtml(label)}</div>${description ? `<div class="text-xs text-muted-foreground">${escapeHtml(description)}</div>` : ''}</div></div>`
}

function axisTone(status: string) {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success' as const
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger' as const
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info' as const
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning' as const
  return 'neutral' as const
}

function filteredOrders(): WaterSolubleWorkOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listWaterSolubleWorkOrders().filter((order) => {
    if (keyword && ![order.waterOrderNo, order.productionOrderNo, order.materialCode, order.materialName].some((value) => value.toLowerCase().includes(keyword))) return false
    const axes = getWaterSolubleWorkOrderThreeAxisView(order)
    if (state.receiptStatus && axes.receiptStatus !== state.receiptStatus) return false
    if (state.processingStatus && axes.processingStatus !== state.processingStatus) return false
    if (state.handoverStatus && axes.handoverStatus !== state.handoverStatus) return false
    if (state.factoryId && order.factoryId !== state.factoryId) return false
    if (state.exception === 'YES' && !order.exceptionReason) return false
    if (state.exception === 'NO' && order.exceptionReason) return false
    return true
  })
}

function renderActions(order: WaterSolubleWorkOrder): string {
  const detail = withSkipPageRerender(renderButton({ label: '查看详情', size: 'sm', action: { prefix: 'water-soluble', action: 'open-detail' }, className: `!px-2`, }))
    .replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
  const assign = order.status === 'WAIT_FACTORY_ASSIGNMENT'
    ? withSkipPageRerender(renderButton({ label: '分配染厂', size: 'sm', variant: 'primary', action: { prefix: 'water-soluble', action: 'open-assign' }, className: '!px-2' })).replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}"`)
    : ''
  const task = order.taskId
    ? withSkipPageRerender(renderButton({ label: '查看任务', size: 'sm', action: { prefix: 'water-soluble', action: 'open-task' }, className: '!px-2' }))
      .replace('<button', `<button data-task-id="${escapeHtml(order.taskId)}"`)
    : '<span class="text-xs text-muted-foreground">任务入口未就绪</span>'
  const handover = order.handoverOrderId
    ? withSkipPageRerender(renderButton({ label: '查看交接', size: 'sm', action: { prefix: 'water-soluble', action: 'open-handover' }, className: '!px-2' }))
      .replace('<button', `<button data-order-id="${escapeHtml(order.waterOrderId)}" data-handover-order-id="${escapeHtml(order.handoverOrderId)}"`)
    : ''
  return `<div class="flex min-w-[210px] flex-wrap gap-2">${detail}${assign}${task}${handover}</div>`
}

const columns: StandardListColumn<WaterSolubleWorkOrder>[] = [
  {
    key: 'waterOrderNo', width: 190, freezeable: true, required: true, sortable: true,
    sortValue: order => order.waterOrderNo,
    title: '水溶加工单',
    render: order => `<div class="font-mono text-xs">${escapeHtml(order.waterOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.productionOrderNo)}</div><div class="mt-2">${renderOrderObject(order, 'style')}</div>`,
  },
  {
    key: 'materialName', width: 230, required: true, sortable: true,
    sortValue: order => order.materialName,
    title: '加工投入',
    render: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      return `${renderOrderObject(order, 'material')}<div class="mt-2 text-xs">计划 ${order.plannedQty.toLocaleString('zh-CN')} ${escapeHtml(order.qtyUnit)} · 已收 ${axes.receivedInputQty.toLocaleString('zh-CN')} ${escapeHtml(order.qtyUnit)}</div>`
    },
  },
  {
    key: 'source', width: 205, sortable: true,
    sortValue: order => getWaterSolubleWorkOrderThreeAxisView(order).sourceDocumentNos[0] || '',
    title: '投入来源',
    render: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      const sourceLabel = axes.sourceMode === 'CENTRAL_TRANSFER' ? '中央仓调拨' : axes.sourceMode === 'UPSTREAM_HANDOUT' ? '上游交出' : '来源待到位'
      return `<div class="text-xs"><div class="font-medium">${sourceLabel}</div><div class="mt-1 break-all text-muted-foreground">${escapeHtml(axes.sourceDocumentNos.join(' / ') || '尚无可接收单据')}</div></div>`
    },
  },
  {
    key: 'axes', width: 175, required: true, sortable: true,
    sortValue: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      return `${axes.receiptStatus}-${axes.processingStatus}-${axes.handoverStatus}`
    },
    title: '三个状态',
    render: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      return `<div class="space-y-2"><div><span class="mr-1 text-xs text-muted-foreground">接收</span>${renderBadge(PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus], axisTone(axes.receiptStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">加工</span>${renderBadge(PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus], axisTone(axes.processingStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">交出</span>${renderBadge(PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus], axisTone(axes.handoverStatus))}</div></div>`
    },
  },
  {
    key: 'requirement', width: 185, sortable: true,
    sortValue: order => order.materialSpec,
    title: '加工要求',
    render: order => `<div class="space-y-1 text-xs"><div class="font-medium">水溶</div><div>${escapeHtml(order.materialName)}</div><div class="text-muted-foreground">${escapeHtml(order.materialSpec)}</div><div>技术包 ${escapeHtml(order.techPackVersionId)}</div></div>`,
  },
  {
    key: 'output', width: 170, sortable: true,
    sortValue: order => order.completedQty,
    title: '加工产出',
    align: 'right',
    render: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      return `<div class="space-y-1 text-xs"><div>完成：${axes.completedQty.toLocaleString('zh-CN')} ${escapeHtml(order.qtyUnit)}</div><div>已交：${axes.handedOverQty.toLocaleString('zh-CN')} ${escapeHtml(order.qtyUnit)}</div><div>下游已收：${axes.downstreamReceivedQty.toLocaleString('zh-CN')} ${escapeHtml(order.qtyUnit)}</div></div>`
    },
  },
  {
    key: 'receiver', width: 230, required: true, sortable: true,
    sortValue: order => getWaterSolubleWorkOrderThreeAxisView(order).receiver.receiverName,
    title: '唯一接收方',
    render: order => {
      const axes = getWaterSolubleWorkOrderThreeAxisView(order)
      return `<div class="space-y-1 text-xs"><div class="font-medium ${axes.receiver.ready ? '' : 'text-amber-700'}">${escapeHtml(axes.receiver.receiverName)}</div><div class="text-muted-foreground">${escapeHtml(axes.receiver.receiverWarehouseName)}</div></div>`
    },
  },
  {
    key: 'factoryName', width: 160, sortable: true,
    sortValue: order => order.factoryName,
    title: '加工厂',
    render: order => escapeHtml(order.factoryName || '待分配'),
  },
  {
    key: 'exceptionReason', width: 170, sortable: true,
    sortValue: order => order.exceptionReason,
    title: '异常',
    render: order => order.exceptionReason ? renderBadge(order.exceptionReason, 'danger') : '<span class="text-muted-foreground">无</span>',
  },
  { key: 'actions', width: 240, required: true, actionColumn: true, title: '操作', render: renderActions },
]

function axisFilter<T extends string>(label: string, field: string, values: Record<T, string>, current: string): string {
  return `<label class="space-y-1"><span class="block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="${escapeHtml(field)}"><option value="">全部</option>${Object.entries(values).map(([value, text]) => `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(String(text))}</option>`).join('')}</select></label>`
}

function renderFilters(): string {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true }).filter(factory => canAssignWaterSolubleFactory(factory.id).ok)
  return withSkipPageRerender(`<section class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
    <label class="min-w-[15rem] flex-1 space-y-1"><span class="block text-xs text-muted-foreground">加工单／生产单／物料</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="输入编号或名称" data-water-soluble-field="keyword"></label>
    ${axisFilter('接收状态', 'receiptStatus', PROCESS_ORDER_RECEIPT_STATUS_LABEL, state.receiptStatus)}
    ${axisFilter('加工状态', 'processingStatus', PROCESS_ORDER_PROCESSING_STATUS_LABEL, state.processingStatus)}
    ${axisFilter('交出状态', 'handoverStatus', PROCESS_ORDER_HANDOVER_STATUS_LABEL, state.handoverStatus)}
    <label class="space-y-1"><span class="block text-xs text-muted-foreground">加工厂</span><select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="factoryId"><option value="">全部</option>${factories.map(factory => `<option value="${escapeHtml(factory.id)}" ${state.factoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select></label>
    <label class="space-y-1"><span class="block text-xs text-muted-foreground">异常</span><select class="h-9 rounded-md border px-2 text-sm" data-water-soluble-field="exception"><option value="">全部</option><option value="YES" ${state.exception === 'YES' ? 'selected' : ''}>有异常</option><option value="NO" ${state.exception === 'NO' ? 'selected' : ''}>无异常</option></select></label>
  </section>`)
}

const listController = createProcessOrderListController({
  state, columns,
  preferenceKey: '/fcs/process/water-soluble-orders:list-columns',
  pageSizeOptions: [...PAGE_SIZE_OPTIONS], eventPrefix: 'water-soluble',
  rootSelector: '[data-testid="water-soluble-orders-page"]',
  tableSurfaceSelector: '[data-water-soluble-list-region]',
  paginationSurfaceSelector: '[data-testid="water-soluble-pagination"]',
  overlaysSurfaceSelector: '[data-water-soluble-column-overlay]',
  defaultFrozenKeys: ['waterOrderNo'], columnSettingsTitle: '水溶加工单列设置',
  emptyText: '暂无符合条件的独立水溶加工单', getRows: filteredOrders, locallyManagedEvents: true,
})

function supervisorDecisionLabel(order: WaterSolubleWorkOrder): string {
  const labels = {
    CONTINUE_PROCESSING: '继续补做',
    CONTINUE_WITH_ACTUAL_QTY: '按实际数量继续交出',
    RETURN_FOR_REWORK: '退回重做',
  } as const
  return order.supervisorDecision ? labels[order.supervisorDecision] : '未处理'
}

function renderDetail(order: WaterSolubleWorkOrder): string {
  const axes = getWaterSolubleWorkOrderThreeAxisView(order)
  const sourceLabel = axes.sourceMode === 'CENTRAL_TRANSFER' ? '中央仓调拨' : axes.sourceMode === 'UPSTREAM_HANDOUT' ? '上游交出' : '来源待到位'
  const logs = order.actionLogs.map(log => `<tr class="border-b last:border-0"><td class="px-3 py-2 text-xs">${escapeHtml(log.at)}</td><td class="px-3 py-2 text-xs font-medium">${escapeHtml(log.action)}</td><td class="px-3 py-2 text-xs">${escapeHtml(log.detail)}</td></tr>`).join('')
  const batches = (order.handoverBatches ?? []).map((batch, index) => `<tr class="border-b last:border-0"><td class="px-3 py-2 text-xs">第 ${index + 1} 批</td><td class="px-3 py-2 text-xs">${batch.handoverQty} ${escapeHtml(order.qtyUnit)}</td><td class="px-3 py-2 text-xs">${batch.receivedQty === undefined ? '待接收' : `${batch.receivedQty} ${escapeHtml(order.qtyUnit)}`}</td></tr>`).join('')
  const content = `<div class="space-y-4">
    <section class="flex flex-wrap gap-4 rounded-lg border bg-muted/20 p-4">${renderOrderObject(order, 'style')}${renderOrderObject(order, 'material')}<div class="min-w-[14rem] flex-1"><div class="font-mono font-semibold">${escapeHtml(order.waterOrderNo)}</div><div class="mt-1 text-sm text-muted-foreground">${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.taskNo)}</div><div class="mt-1 text-sm">${escapeHtml(order.factoryName || '待分配加工厂')}</div></div></section>
    <section class="grid grid-cols-3 gap-3 rounded-lg border p-4"><div><div class="mb-1 text-xs text-muted-foreground">接收状态</div>${renderBadge(PROCESS_ORDER_RECEIPT_STATUS_LABEL[axes.receiptStatus], axisTone(axes.receiptStatus))}</div><div><div class="mb-1 text-xs text-muted-foreground">加工状态</div>${renderBadge(PROCESS_ORDER_PROCESSING_STATUS_LABEL[axes.processingStatus], axisTone(axes.processingStatus))}</div><div><div class="mb-1 text-xs text-muted-foreground">交出状态</div>${renderBadge(PROCESS_ORDER_HANDOVER_STATUS_LABEL[axes.handoverStatus], axisTone(axes.handoverStatus))}</div></section>
    <section class="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><div><div class="text-xs text-muted-foreground">投入来源</div><div class="mt-1 font-medium">${sourceLabel}</div><div class="mt-1 break-all text-xs">${escapeHtml(axes.sourceDocumentNos.join(' / ') || '尚无可接收单据')}</div></div><div><div class="text-xs text-muted-foreground">唯一接收方</div><div class="mt-1 font-medium">${escapeHtml(axes.receiver.receiverName)}</div><div class="mt-1 text-xs">${escapeHtml(axes.receiver.receiverWarehouseName)}</div></div></section>
    <section class="grid gap-4 rounded-lg border p-4 sm:grid-cols-3"><div><div class="text-xs text-muted-foreground">计划投入</div><div class="mt-1 font-medium">${order.plannedQty} ${escapeHtml(order.qtyUnit)}</div></div><div><div class="text-xs text-muted-foreground">累计接收</div><div class="mt-1 font-medium">${axes.receivedInputQty} ${escapeHtml(order.qtyUnit)}</div></div><div><div class="text-xs text-muted-foreground">加工完成</div><div class="mt-1 font-medium">${axes.completedQty} ${escapeHtml(order.qtyUnit)}</div></div><div><div class="text-xs text-muted-foreground">累计交出</div><div class="mt-1 font-medium">${axes.handedOverQty} ${escapeHtml(order.qtyUnit)}</div></div><div><div class="text-xs text-muted-foreground">下游已收</div><div class="mt-1 font-medium">${axes.downstreamReceivedQty} ${escapeHtml(order.qtyUnit)}</div></div><div><div class="text-xs text-muted-foreground">加工要求</div><div class="mt-1 font-medium">水溶 · ${escapeHtml(order.materialSpec)}</div></div></section>
    <section class="overflow-hidden rounded-lg border"><div class="border-b px-4 py-3 font-semibold">交出批次</div><div class="overflow-auto"><table class="w-full min-w-[420px] text-left"><thead class="bg-muted/40"><tr><th class="px-3 py-2 text-xs">批次</th><th class="px-3 py-2 text-xs">交出数量</th><th class="px-3 py-2 text-xs">下游接收</th></tr></thead><tbody>${batches || '<tr><td colspan="3" class="px-3 py-6 text-center text-sm text-muted-foreground">尚未交出</td></tr>'}</tbody></table></div></section>
    <section class="overflow-hidden rounded-lg border"><div class="border-b px-4 py-3 font-semibold">操作记录</div><div class="max-h-64 overflow-auto"><table class="w-full min-w-[560px] text-left"><thead class="bg-muted/40"><tr><th class="px-3 py-2 text-xs">时间</th><th class="px-3 py-2 text-xs">动作</th><th class="px-3 py-2 text-xs">结果</th></tr></thead><tbody>${logs || '<tr><td colspan="3" class="px-3 py-6 text-center text-sm text-muted-foreground">暂无记录</td></tr>'}</tbody></table></div></section>
    ${order.exceptionReason ? `<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div class="font-semibold">待处理异常</div><div class="mt-1">${escapeHtml(order.exceptionReason)}</div><div class="mt-1">主管决定：${escapeHtml(supervisorDecisionLabel(order))}</div></section>` : ''}
  </div>`
  return withSkipPageRerender(renderDetailDrawer({ title: '水溶加工单详情', subtitle: order.waterOrderNo, closeAction: { prefix: 'water-soluble', action: 'close-overlay' }, width: 'lg' }, content))
}

function renderAssign(order: WaterSolubleWorkOrder): string {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .filter((factory) => canAssignWaterSolubleFactory(factory.id).ok)
  return withSkipPageRerender(renderSimpleDrawer({ prefix: 'water-soluble', closeAction: 'close-overlay', title: '分配染厂', subtitle: order.waterOrderNo, width: 'sm', content: `<p class="mb-3 text-sm text-muted-foreground">请选择具备水溶能力的染厂。</p><select class="h-10 w-full rounded-md border px-3" data-water-soluble-field="assignFactoryId"><option value="">请选择染厂</option>${factories.map((f) => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('')}</select><button class="mt-4 h-10 w-full rounded-md bg-blue-600 text-white" data-water-soluble-action="confirm-assign" data-order-id="${escapeHtml(order.waterOrderId)}">确认分配</button>` }))
}

function renderOverlay(): string {
  if (!state.overlay) return ''
  const order = listWaterSolubleWorkOrders().find((item) => item.waterOrderId === state.overlay?.orderId)
  if (!order) return ''
  return state.overlay.type === 'detail' ? renderDetail(order) : renderAssign(order)
}

export function renderProcessWaterSolubleOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, typeof document !== 'undefined' && Boolean(document.querySelector('[data-testid="water-soluble-orders-page"]')))
  listController.installColumnDragEvents()
  const view = listController.getView()
  return `<div data-testid="water-soluble-orders-page" data-skip-page-rerender="true">${renderStandardListPage({
    title: '水溶加工单',
    filtersHtml: renderFilters(), listTitle: '水溶加工单',
    listActionsHtml: withSkipPageRerender(renderButton({ label: '列设置', size: 'sm', action: { prefix: 'water-soluble', action: 'open-column-settings' } })),
    tableHtml: `<div data-water-soluble-list-region>${view.tableHtml}</div>`,
    paginationHtml: `<div data-testid="water-soluble-pagination">${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-water-soluble-column-overlay>${listController.renderColumnSettings()}</div><div data-water-soluble-overlay>${renderOverlay()}</div>${renderToastContainer('top-right')}`,
  })}</div>`
}

function refreshList(): void { listController.refresh() }

function refreshOverlay(): void { const node = document.querySelector<HTMLElement>('[data-water-soluble-overlay]'); if (node) node.innerHTML = renderOverlay() }
function showToast(message: string, ok: boolean): void { const root = document.querySelector<HTMLElement>('[data-toast-container]'); if (root) root.insertAdjacentHTML('afterbegin', renderToast({ title: ok ? '操作成功' : '无法操作', description: message, variant: ok ? 'success' : 'danger' })) }

export function handleProcessWaterSolubleOrdersEvent(target: HTMLElement): boolean {
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-water-soluble-field]')
  if (field) {
    const name = field.dataset.waterSolubleField
    if (name === 'assignFactoryId') return true
    if (name === 'keyword') state.keyword = field.value
    else if (name === 'receiptStatus') state.receiptStatus = field.value
    else if (name === 'processingStatus') state.processingStatus = field.value
    else if (name === 'handoverStatus') state.handoverStatus = field.value
    else if (name === 'factoryId') state.factoryId = field.value
    else if (name === 'exception') state.exception = field.value
    else if (name === 'pageSize') {
      const pageSize = Number(field.value)
      listController.setPageSize(pageSize)
    }
    state.currentPage = 1; refreshList(); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-water-soluble-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.waterSolubleAction || ''
  if (action === 'open-column-settings' || action === 'close-column-settings') {
    state.showColumnSettings = action === 'open-column-settings'
    listController.refresh({ table: false, pagination: false, overlays: true }); return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset.waterSolubleColumnKey || actionNode.closest<HTMLElement>('[data-water-soluble-column-key]')?.dataset.waterSolubleColumnKey || ''
    listController.updateColumnPreference(action, key, actionNode instanceof HTMLInputElement ? actionNode.checked : undefined)
    listController.refresh({ overlays: true }); return true
  }
  if (action === 'restore-column-settings') { listController.restorePreferences(); listController.refresh({ overlays: true }); return true }
  if (action === 'open-task') { const taskId = actionNode.dataset.taskId || ''; if (!taskId) return false; appStore.navigate(`/fcs/pda/exec/${encodeURIComponent(taskId)}`); return true }
  if (action === 'open-handover') { const handoverOrderId = actionNode.dataset.handoverOrderId || ''; if (!handoverOrderId) return false; appStore.navigate(`/fcs/pda/handover/${encodeURIComponent(handoverOrderId)}`); return true }
  if (action === 'open-detail' || action === 'open-assign') { state.overlay = { type: action === 'open-detail' ? 'detail' : 'assign', orderId: actionNode.dataset.orderId || '' }; refreshOverlay(); return true }
  if (action === 'close-overlay') { state.overlay = null; refreshOverlay(); return true }
  if (action === 'confirm-assign') { const factoryId = document.querySelector<HTMLSelectElement>('[data-water-soluble-field="assignFactoryId"]')?.value || ''; const result = assignWaterSolubleFactory(actionNode.dataset.orderId || '', factoryId); showToast(result.message, result.ok); if (result.ok) { state.overlay = null; refreshOverlay(); refreshList() } return true }
  if (action === 'prev-page') listController.stepPage(-1)
  else if (action === 'next-page') listController.stepPage(1)
  else if (action === 'sort-column') listController.cycleSort(actionNode.dataset.columnKey || '')
  else return false
  refreshList(); return true
}

export function isProcessWaterSolubleOrdersOverlayOpen(): boolean { return state.overlay !== null || state.showColumnSettings }
export function closeProcessWaterSolubleOrdersOverlay(): void { state.overlay = null; state.showColumnSettings = false; refreshOverlay(); listController.refresh({ table: false, pagination: false, overlays: true }) }
