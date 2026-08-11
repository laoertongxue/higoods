// @page-pattern: list

import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { type StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { createProcessOrderListController } from '../../../components/ui/process-order-list-controller.ts'
import {
  PRINTING_DEMAND_SOURCE_LABEL,
  PRINTING_HANDOVER_STATUSES,
  PRINTING_HANDOVER_STATUS_LABEL,
  PRINTING_PROCESSING_STATUSES,
  PRINTING_PROCESSING_STATUS_LABEL,
  formatPrintingQty,
  formatPrintingUsage,
  getPrintingWorkOrderSummary,
  isPrintingWorkOrderBusinessCompleted,
  listPrintingWorkOrders,
  type PrintingDemandSourceType,
  type PrintingHandoverStatus,
  type PrintingProcessingStatus,
  type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-work-order-business.ts'
import { buildPrintingWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPrintingDialog } from './dialogs.ts'

const EVENT_PREFIX = 'printing-work-orders'
const PREFERENCE_KEY = '/fcs/craft/printing/work-orders:input-output-v2'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

type YesNoFilter = '' | 'YES' | 'NO'

const state: {
  keyword: string
  processingStatus: '' | PrintingProcessingStatus
  handoverStatus: '' | PrintingHandoverStatus
  demandSource: '' | PrintingDemandSourceType
  legacyStatus: string
  salesType: string
  factory: string
  craft: string
  receiver: string
  materialType: string
  changedInput: YesNoFilter
  historicalSupplement: YesNoFilter
  creationMethod: string
  hasDifference: YesNoFilter
  timeType: 'ORDERED' | 'INPUT_RECEIVED' | 'COMPLETED' | 'HANDOVER' | 'RECEIVED'
  dateStart: string
  dateEnd: string
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
} = {
  keyword: '', processingStatus: '', handoverStatus: '', demandSource: '', legacyStatus: '', salesType: '', factory: '', craft: '', receiver: '', materialType: '', changedInput: '', historicalSupplement: '', creationMethod: '', hasDifference: '', timeType: 'ORDERED', dateStart: '', dateEnd: '', currentPage: 1, sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false,
}

const selectedWorkOrderIds = new Set<string>()

function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  return `<button type="button" class="${size} shrink-0 overflow-hidden rounded-md border bg-slate-50" data-printing-action="preview-image" data-image-url="${escapeHtml(image.imageUrl)}" data-image-alt="${escapeHtml(image.imageAlt)}" aria-label="查看${escapeHtml(image.imageAlt)}大图">
    <img class="h-full w-full object-cover" src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageAlt)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span hidden class="flex h-full w-full items-center justify-center p-1 text-[10px] text-red-600">图片加载失败</span>
  </button>`
}

function statusBadge(label: string, tone: 'blue' | 'amber' | 'green' | 'slate' | 'red'): string {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${classes[tone]}">${escapeHtml(label)}</span>`
}

function processingBadge(status: PrintingProcessingStatus): string {
  return statusBadge(PRINTING_PROCESSING_STATUS_LABEL[status], status === 'PROCESS_COMPLETED' ? 'green' : status === 'PROCESSING' ? 'blue' : status === 'CANCELLED' ? 'red' : 'amber')
}

function handoverBadge(status: PrintingHandoverStatus): string {
  return statusBadge(PRINTING_HANDOVER_STATUS_LABEL[status], status === 'RECEIVED' ? 'green' : status === 'NOT_STARTED' ? 'slate' : status === 'PARTIAL_HANDOVER' || status === 'PARTIAL_RECEIVED' ? 'amber' : 'blue')
}

function actionButton(label: string, action: string, order: PrintingWorkOrderBusinessRecord, className = ''): string {
  return `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50 ${className}" data-printing-row-action data-printing-action="${escapeHtml(action)}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function printAction(label: string, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION', order: PrintingWorkOrderBusinessRecord): string {
  return `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-printing-row-action data-printing-action="open-print" data-document-type="${documentType}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function renderActions(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="grid w-full grid-cols-2 gap-x-1 gap-y-0.5" data-printing-row-actions>
    <a class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-printing-row-action data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">详情</a>
    ${order.output.completedQty === 0 ? actionButton('调整投入', 'change-input', order) : ''}
    ${printAction('印花信息单', 'PRINTING_INFO_SHEET', order)}
    ${printAction('印花确认单', 'PRINTING_CONFIRMATION', order)}
    ${actionButton('产出卷条码', 'open-barcodes', order, 'text-amber-700 hover:bg-amber-50')}
  </div>`
}

const columns: StandardListColumn<PrintingWorkOrderBusinessRecord>[] = [
  {
    key: 'select', title: '选择', width: 64, align: 'center', required: true, leadingControlColumn: true,
    render: (order) => `<input type="checkbox" aria-label="选择 ${escapeHtml(order.printOrderNo)}" data-printing-action="toggle-select" data-work-order-id="${escapeHtml(order.workOrderId)}" ${selectedWorkOrderIds.has(order.workOrderId) ? 'checked' : ''}>`,
  },
  {
    key: 'order', title: '印花加工单', width: 220, required: true, freezeable: true, sortable: true, sortValue: (order) => order.printOrderNo,
    render: (order) => `<div class="space-y-1 text-xs"><a class="font-mono font-semibold text-blue-700" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">${escapeHtml(order.printOrderNo)}</a><p>任务：${escapeHtml(order.taskNo)}</p><p>需求：${escapeHtml(order.demandSource.demandNo || '—')} · 生产：${escapeHtml(order.demandSource.productionOrderNo || '—')}</p><p>${escapeHtml(order.salesType)} · ${escapeHtml(order.creationMethod)}</p><p class="text-slate-500">历史提示：${escapeHtml(order.legacyProgressHint)}</p>${isPrintingWorkOrderBusinessCompleted(order) ? statusBadge('业务已完成', 'green') : ''}</div>`,
  },
  {
    key: 'product', title: '商品信息', width: 190, sortable: true, sortValue: (order) => order.product.spu,
    render: (order) => `<div class="flex items-center gap-2">${imageButton(order.product)}<div class="min-w-0"><p class="font-medium">${escapeHtml(order.product.spu)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.product.productName)}</p></div></div>`,
  },
  {
    key: 'source', title: '需求来源', width: 230, sortable: true, sortValue: (order) => order.demandSource.type,
    render: (order) => `<div class="space-y-1 text-xs">${statusBadge(PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type], 'blue')}<p class="font-medium">${escapeHtml(order.demandSource.sourceLabel)}</p><p>供料：${escapeHtml(order.plannedInput.supplySource)}</p><p>${escapeHtml(order.plannedInput.sourceWarehouseName)}：${formatPrintingQty(order.plannedInput.sourceWarehouseStockQty)} Yard</p><p>待加工仓：${formatPrintingQty(order.plannedInput.pendingWarehouseStockQty)} Yard</p><p>白胚库存：${formatPrintingQty(order.plannedInput.whiteStockQty)} Yard</p></div>`,
  },
  {
    key: 'input', title: '加工投入', width: 260, required: true, sortable: true, sortValue: (order) => order.plannedInput.sku,
    render: (order) => `<div class="flex items-start gap-2">${imageButton(order.plannedInput)}<div class="min-w-0 space-y-1 text-xs"><p class="font-medium">[${order.plannedInput.objectType}] ${escapeHtml(order.plannedInput.materialName)}</p><p>SPU：${escapeHtml(order.plannedInput.spu)}</p><p class="break-all font-mono">计划：${escapeHtml(order.plannedInput.sku)}</p><p class="break-all font-mono">实际：${escapeHtml(order.actualInput.actualSku || '未接收')}</p><p>库存：${formatPrintingQty(order.plannedInput.currentStockQty)} · 待印：${formatPrintingQty(order.plannedInput.pendingPrintQty)} Yard</p>${order.inputChanges.length ? statusBadge(`已换料 ${order.inputChanges.length} 次`, 'amber') : ''}</div></div>`,
  },
  {
    key: 'requirement', title: '印花要求', width: 240, sortable: true, sortValue: (order) => order.requirement.craftName,
    render: (order) => `<div class="space-y-1 text-xs"><p class="font-medium">${escapeHtml(order.requirement.craftName)} · ${escapeHtml(order.requirement.type)}</p><p>深浅：${escapeHtml(order.requirement.shade)} · 温度：${escapeHtml(order.requirement.temperature)}</p><p>印花面别：${escapeHtml(order.requirement.printSide)}</p><div class="flex flex-wrap gap-2"><div class="flex items-center gap-1">${imageButton(order.requirement.frontPattern, 'h-9 w-9')}<span>${escapeHtml(order.requirement.frontPattern.patternNo)}</span></div>${order.requirement.insidePattern ? `<div class="flex items-center gap-1">${imageButton(order.requirement.insidePattern, 'h-9 w-9')}<span>${escapeHtml(order.requirement.insidePattern.patternNo)}</span></div>` : ''}</div></div>`,
  },
  {
    key: 'output', title: '加工产出', width: 260, required: true, sortable: true, sortValue: (order) => order.output.sku,
    render: (order) => `<div class="flex items-start gap-2">${imageButton(order.output)}<div class="min-w-0 space-y-1 text-xs"><p class="font-medium">[${order.output.objectType}] ${escapeHtml(order.output.materialName)}</p><p>SPU：${escapeHtml(order.output.spu)}</p><p class="break-all font-mono font-medium text-emerald-700">${escapeHtml(order.output.sku)}</p><p class="text-slate-500">固定产出，不随投入换料改变</p></div></div>`,
  },
  {
    key: 'quantity', title: '数量进度', width: 275, sortable: true, align: 'right', sortValue: (order) => order.plannedInput.plannedQty,
    render: (order) => `<div class="space-y-1 text-xs tabular-nums"><p>需求基数：${formatPrintingQty(order.usage.demandBaseQty)} ${escapeHtml(order.usage.demandBaseUnit)}</p><p>标准/本单用量：${formatPrintingUsage(order.usage.standardUnitUsage)} / ${formatPrintingUsage(order.usage.orderUnitUsage)}</p><p>计划投入：<b>${formatPrintingQty(order.plannedInput.plannedQty)} Yard</b></p><p>实际接收：${formatPrintingQty(order.actualInput.receivedQty)} Yard / ${order.actualInput.receivedRollCount} 卷</p><p>实际使用：${formatPrintingQty(order.actualInput.usedQty)} Yard / ${order.actualInput.usedRollCount} 卷</p><p>完成：<b>${formatPrintingQty(order.output.completedQty)} Yard / ${order.output.completedRollCount} 卷</b></p><p class="text-slate-500">历史损耗：${formatPrintingQty(order.historicalLossQty)} Yard（兼容）</p></div>`,
  },
  {
    key: 'factoryTime', title: '加工厂/时间', width: 220, sortable: true, sortValue: (order) => order.orderedAt,
    render: (order) => `<div class="space-y-1 text-xs"><p class="font-medium">${escapeHtml(order.printFactoryName)}</p><p>下单：${escapeHtml(order.orderedAt)}</p><p>投入接收：${escapeHtml(order.inputReceivedAt || '—')}</p><p>完成：${escapeHtml(order.completedAt || '—')}</p><p>交货：${escapeHtml(order.deliveryAt || '—')}</p></div>`,
  },
  { key: 'processingStatus', title: '加工状态', width: 125, required: true, sortable: true, sortValue: (order) => order.processingStatus, render: (order) => processingBadge(order.processingStatus) },
  {
    key: 'handoverStatus', title: '交出状态', width: 220, required: true, sortable: true, sortValue: (order) => order.handoverStatus,
    render: (order) => `<div class="space-y-1 text-xs">${handoverBadge(order.handoverStatus)}<p>接收人：${escapeHtml(order.handover.receiverName)}</p><p>交出单：${escapeHtml(order.handover.handoverNo || '—')}</p><p>交出/接收：${formatPrintingQty(order.handover.handedOverQty)} / ${formatPrintingQty(order.handover.receivedQty)} Yard</p><p>差异：${formatPrintingQty(order.handover.diffQty)} · 异议：${order.handover.objectionQty}</p></div>`,
  },
  {
    key: 'printInfo', title: '打印信息', width: 180,
    render: (order) => `<div class="space-y-1 text-xs"><p>打印机：${escapeHtml(order.printerNo)}</p><p>转印完成：${formatPrintingQty(order.transferCompletedQty)}</p><p>待接收：${formatPrintingQty(order.pendingWritebackQty)}</p>${order.printingDocumentsNeedReprint ? statusBadge('信息单/确认单需重印', 'amber') : ''}</div>`,
  },
  { key: 'remark', title: '备注', width: 220, render: (order) => `<p class="text-xs leading-5">${escapeHtml(order.remark || '—')}</p>` },
  { key: 'actions', title: '操作', width: 190, required: true, actionColumn: true, render: renderActions },
]

function selectedTime(order: PrintingWorkOrderBusinessRecord): string {
  if (state.timeType === 'INPUT_RECEIVED') return order.inputReceivedAt || ''
  if (state.timeType === 'COMPLETED') return order.completedAt || ''
  if (state.timeType === 'HANDOVER') return order.handover.handedOverAt || ''
  if (state.timeType === 'RECEIVED') return order.handover.receivedAt || ''
  return order.orderedAt
}

function dateMatches(order: PrintingWorkOrderBusinessRecord): boolean {
  const value = selectedTime(order).slice(0, 10)
  if (state.dateStart && (!value || value < state.dateStart)) return false
  if (state.dateEnd && (!value || value > state.dateEnd)) return false
  return true
}

function textMatches(order: PrintingWorkOrderBusinessRecord): boolean {
  const keyword = state.keyword.trim().toLowerCase()
  if (!keyword) return true
  const values = [
    order.printOrderNo, order.taskNo, order.demandSource.sourceNo, order.demandSource.demandNo, order.demandSource.productionOrderNo,
    order.demandSource.purchaseOrderNo, order.demandSource.stockPlanNo, order.demandSource.supplementOrderNo, order.product.spu,
    order.plannedInput.spu, order.plannedInput.sku, order.actualInput.actualSku, order.output.sku, order.handover.handoverNo,
    ...order.barcodes.map((barcode) => barcode.barcode),
  ]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}

function yesNoMatch(filter: YesNoFilter, yes: boolean): boolean {
  return !filter || (filter === 'YES' ? yes : !yes)
}

function filteredRows(): PrintingWorkOrderBusinessRecord[] {
  return listPrintingWorkOrders().filter((order) => (
    textMatches(order)
    && (!state.processingStatus || order.processingStatus === state.processingStatus)
    && (!state.handoverStatus || order.handoverStatus === state.handoverStatus)
    && (!state.demandSource || order.demandSource.type === state.demandSource)
    && (!state.legacyStatus || order.legacyProgressHint.includes(state.legacyStatus))
    && (!state.salesType || order.salesType === state.salesType)
    && (!state.factory || order.printFactoryName === state.factory)
    && (!state.craft || order.requirement.craftName === state.craft)
    && (!state.receiver || order.actualInput.receiverName === state.receiver || order.handover.receiverName === state.receiver)
    && (!state.materialType || order.materialType === state.materialType)
    && yesNoMatch(state.changedInput, order.inputChanges.length > 0)
    && yesNoMatch(state.historicalSupplement, order.historicalSupplement)
    && (!state.creationMethod || order.creationMethod === state.creationMethod)
    && yesNoMatch(state.hasDifference, order.handover.diffQty > 0 || order.handover.objectionQty > 0)
    && dateMatches(order)
  ))
}

const listController = createProcessOrderListController({
  state, columns, preferenceKey: PREFERENCE_KEY, pageSizeOptions: PAGE_SIZE_OPTIONS, eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-printing-work-orders-root]', tableSurfaceSelector: '[data-printing-work-orders-table-surface]', paginationSurfaceSelector: '[data-printing-work-orders-pagination-surface]', overlaysSurfaceSelector: '[data-printing-work-orders-overlays-surface]',
  defaultFrozenKeys: ['order'], columnSettingsTitle: '印花加工单列设置', emptyText: '没有符合条件的印花加工单', getRows: filteredRows, locallyManagedEvents: true,
})

function option(value: string, label: string, selected: string): string {
  return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

function selectField(label: string, name: string, value: string, options: Array<[string, string]>): string {
  return `<label><span class="mb-1 block text-xs text-slate-500">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border bg-white px-2 text-sm" data-printing-work-orders-field="${escapeHtml(name)}">${options.map(([key, text]) => option(key, text, value)).join('')}</select></label>`
}

function uniqueOptions(values: string[]): Array<[string, string]> {
  return [['', '全部'], ...[...new Set(values.filter(Boolean))].sort().map((value) => [value, value] as [string, string])]
}

function renderFilters(): string {
  const rows = listPrintingWorkOrders()
  return `<section class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-slate-500">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-printing-work-orders-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="单号/来源/SPU/投入或产出SKU/交出单/条码"></label>
    ${selectField('加工状态', 'processingStatus', state.processingStatus, [['', '全部'], ...PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('交出状态', 'handoverStatus', state.handoverStatus, [['', '全部'], ...PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('需求来源', 'demandSource', state.demandSource, [['', '全部'], ...Object.entries(PRINTING_DEMAND_SOURCE_LABEL)])}
    ${selectField('历史状态', 'legacyStatus', state.legacyStatus, uniqueOptions(rows.map((row) => row.legacyProgressHint)))}
    ${selectField('售卖类型', 'salesType', state.salesType, uniqueOptions(rows.map((row) => row.salesType)))}
    ${selectField('加工厂', 'factory', state.factory, uniqueOptions(rows.map((row) => row.printFactoryName)))}
    ${selectField('工艺', 'craft', state.craft, uniqueOptions(rows.map((row) => row.requirement.craftName)))}
    ${selectField('接收人', 'receiver', state.receiver, uniqueOptions(rows.flatMap((row) => [row.actualInput.receiverName, row.handover.receiverName])))}
    ${selectField('物料类型', 'materialType', state.materialType, uniqueOptions(rows.map((row) => row.materialType)))}
    ${selectField('是否换料', 'changedInput', state.changedInput, [['', '全部'], ['YES', '已换料'], ['NO', '未换料']])}
    ${selectField('是否历史补料', 'historicalSupplement', state.historicalSupplement, [['', '全部'], ['YES', '是'], ['NO', '否']])}
    ${selectField('创建方式', 'creationMethod', state.creationMethod, uniqueOptions(rows.map((row) => row.creationMethod)))}
    ${selectField('差异/异议', 'hasDifference', state.hasDifference, [['', '全部'], ['YES', '存在'], ['NO', '无']])}
    ${selectField('时间类型', 'timeType', state.timeType, [['ORDERED', '下单时间'], ['INPUT_RECEIVED', '投入接收时间'], ['COMPLETED', '加工完成时间'], ['HANDOVER', '交出时间'], ['RECEIVED', '下游接收时间']])}
    <label><span class="mb-1 block text-xs text-slate-500">开始日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateStart" value="${escapeHtml(state.dateStart)}"></label>
    <label><span class="mb-1 block text-xs text-slate-500">结束日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateEnd" value="${escapeHtml(state.dateEnd)}"></label>
  </div><div class="mt-3 flex flex-wrap gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter', skipPageRerender: true }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter', skipPageRerender: true }, 'rotate-ccw')}<button class="rounded-md border px-3 py-2 text-sm" data-printing-action="export">导出</button></div></section>`
}

function renderStats(rows: PrintingWorkOrderBusinessRecord[]): string {
  const summary = getPrintingWorkOrderSummary(rows)
  const items = [
    { label: '印花加工单数量', value: summary.orderCount },
    { label: '计划投入', value: `${formatPrintingQty(summary.plannedInputQty)} Yard` },
    { label: '实际使用', value: `${formatPrintingQty(summary.usedInputQty)} Yard` },
    { label: '完成', value: `${formatPrintingQty(summary.completedOutputQty)} Yard` },
    { label: '已交出', value: `${formatPrintingQty(summary.handedOverQty)} Yard` },
    { label: '已接收', value: `${formatPrintingQty(summary.receivedQty)} Yard` },
  ]
  return `<div class="grid grid-cols-6 gap-2" data-standard-list-stats data-printing-summary-row>${items.map((item) => `
    <div class="flex h-12 min-w-0 items-center justify-between gap-1 rounded-lg border bg-card px-2" data-printing-summary-item>
      <span class="whitespace-nowrap text-[11px] text-muted-foreground">${escapeHtml(item.label)}</span>
      <strong class="whitespace-nowrap text-[13px] font-semibold tabular-nums">${escapeHtml(String(item.value))}</strong>
    </div>
  `).join('')}</div>`
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const rows = filteredRows()
  const view = listController.getView(rows)
  return renderStandardListPage({
    title: '印花加工单',
    primaryActionsHtml: `<div class="flex flex-wrap gap-2"><button class="rounded-md border px-3 py-2 text-sm" data-printing-action="select-filtered">全选当前结果</button><button class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" data-printing-action="batch-print-confirmation" ${selectedWorkOrderIds.size ? '' : 'disabled'}>批量打印印花确认单（<span data-printing-selected-count>${selectedWorkOrderIds.size}</span>）</button></div>`,
    filtersHtml: `<div data-printing-work-orders-filters-surface>${renderFilters()}</div>`,
    statsHtml: `<div data-printing-work-orders-stats-surface>${renderStats(rows)}</div>`,
    listTitle: '加工单明细',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2'),
    feedbackHtml: '<div data-printing-work-orders-feedback-surface></div>',
    tableHtml: `<div data-printing-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-printing-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-printing-work-orders-overlays-surface>${listController.renderColumnSettings()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-printing-work-orders-root]')
}

export function renderCraftPrintingWorkOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  listController.installColumnDragEvents()
  return `<div data-printing-work-orders-root data-skip-page-rerender="true"><div data-printing-work-orders-workspace>${renderWorkspace()}</div><div data-printing-dialog-surface>${renderPrintingDialog()}</div></div>`
}

export function refreshPrintingWorkOrderListPage(): void {
  const workspace = rootElement()?.querySelector<HTMLElement>('[data-printing-work-orders-workspace]')
  if (workspace) workspace.innerHTML = renderWorkspace()
}

export function getSelectedPrintingWorkOrderIds(): string[] {
  return [...selectedWorkOrderIds]
}

export function selectFilteredPrintingWorkOrders(): void {
  filteredRows().forEach((order) => selectedWorkOrderIds.add(order.workOrderId))
  refreshPrintingWorkOrderListPage()
}

export function getFilteredPrintingWorkOrders(): PrintingWorkOrderBusinessRecord[] {
  return filteredRows()
}

function readFilterFields(root: HTMLElement): void {
  const get = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-printing-work-orders-field="${name}"]`)?.value || ''
  state.keyword = get('keyword')
  state.processingStatus = get('processingStatus') as typeof state.processingStatus
  state.handoverStatus = get('handoverStatus') as typeof state.handoverStatus
  state.demandSource = get('demandSource') as typeof state.demandSource
  state.legacyStatus = get('legacyStatus')
  state.salesType = get('salesType')
  state.factory = get('factory')
  state.craft = get('craft')
  state.receiver = get('receiver')
  state.materialType = get('materialType')
  state.changedInput = get('changedInput') as YesNoFilter
  state.historicalSupplement = get('historicalSupplement') as YesNoFilter
  state.creationMethod = get('creationMethod')
  state.hasDifference = get('hasDifference') as YesNoFilter
  state.timeType = (get('timeType') || 'ORDERED') as typeof state.timeType
  state.dateStart = get('dateStart')
  state.dateEnd = get('dateEnd')
}

function resetFilters(): void {
  state.keyword = ''; state.processingStatus = ''; state.handoverStatus = ''; state.demandSource = ''; state.legacyStatus = ''; state.salesType = ''; state.factory = ''; state.craft = ''; state.receiver = ''; state.materialType = ''; state.changedInput = ''; state.historicalSupplement = ''; state.creationMethod = ''; state.hasDifference = ''; state.timeType = 'ORDERED'; state.dateStart = ''; state.dateEnd = ''; state.currentPage = 1
}

function refreshSelectionControls(): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLElement>('[data-printing-selected-count]').forEach((node) => { node.textContent = String(selectedWorkOrderIds.size) })
  const button = document.querySelector<HTMLButtonElement>('[data-printing-action="batch-print-confirmation"]')
  if (button) button.disabled = selectedWorkOrderIds.size === 0
}

export function handlePrintingWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-printing-work-orders-root]')
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-printing-work-orders-field]')
  if (field?.dataset.printingWorkOrdersField === 'pageSize') {
    listController.setPageSize(Number(field.value)); listController.refresh(); return true
  }
  const selectBox = target.closest<HTMLInputElement>('[data-printing-action="toggle-select"]')
  if (selectBox) {
    const id = selectBox.dataset.workOrderId || ''
    if (selectBox.checked) selectedWorkOrderIds.add(id); else selectedWorkOrderIds.delete(id)
    refreshSelectionControls(); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-printing-work-orders-action]')
  if (!actionNode) return Boolean(field)
  const action = actionNode.dataset.printingWorkOrdersAction || ''
  if (action === 'apply-filter') { readFilterFields(root); state.currentPage = 1; refreshPrintingWorkOrderListPage(); return true }
  if (action === 'reset-filter') { resetFilters(); selectedWorkOrderIds.clear(); refreshPrintingWorkOrderListPage(); return true }
  if (action === 'prev-page' || action === 'next-page') { listController.stepPage(action === 'next-page' ? 1 : -1); listController.refresh(); return true }
  if (action === 'sort-column') { listController.cycleSort(actionNode.dataset.columnKey || ''); listController.refresh(); return true }
  if (action === 'open-column-settings') { state.showColumnSettings = true; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { listController.updateColumnPreference(action, actionNode.dataset.printingWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-printing-work-orders-column-key]')?.dataset.printingWorkOrdersColumnKey || '', target instanceof HTMLInputElement ? target.checked : undefined); listController.refresh(); return true }
  if (action === 'restore-column-settings') { listController.restorePreferences(); listController.refresh({ overlays: true }); return true }
  return false
}
