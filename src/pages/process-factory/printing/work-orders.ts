import { syncProcessSelectionHeader, renderProcessOrderStats, renderProcessSelectionHeader, renderProcessFilterToggle, handleProcessFilterPresentation } from '../../../components/ui/process-order-list-presentation.ts'
import { isPrintablePrintingRoll } from '../../../data/fcs/printing-task-domain.ts'
// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
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
  PRINTING_RECEIPT_STATUSES,
  PRINTING_RECEIPT_STATUS_LABEL,
  PRINTING_PROCESSING_STATUSES,
  PRINTING_PROCESSING_STATUS_LABEL,
  formatPrintingQty,
  formatPrintingSummaryMetric,
  formatPrintingUsage,
  getPrintingWorkOrderSummary,
  isPrintingWorkOrderBusinessCompleted,
  listPrintingWorkOrders,
  type PrintingDemandSourceType,
  type PrintingHandoverStatus,
  type PrintingProcessingStatus,
  type PrintingReceiptStatus,
  type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-work-order-business.ts'
import { buildPrintingWorkOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import { renderPrintingRelations, printingUpstreamNames, printingPatternLabel, printingMaterialCode, printingSpecification, printingInputIdentity } from './relations.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPrintingDialog } from './dialogs.ts'

const EVENT_PREFIX = 'printing-work-orders'
const PREFERENCE_KEY = '/fcs/craft/printing/work-orders:input-output-v3'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

type YesNoFilter = '' | 'YES' | 'NO'

const state: {
  keyword: string
  receiptStatus: '' | PrintingReceiptStatus
  processingStatus: '' | PrintingProcessingStatus
  handoverStatus: '' | PrintingHandoverStatus
  demandSource: '' | PrintingDemandSourceType
  salesType: string
  factory: string
  craft: string
  upstream: string
  receiver: string
  exception: string
  materialType: string
  changedInput: YesNoFilter
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
  keyword: '', receiptStatus: '', processingStatus: '', handoverStatus: '', demandSource: '', salesType: '', factory: '', craft: '', upstream: '', receiver: '', exception: '', materialType: '', changedInput: '', creationMethod: '', hasDifference: '', timeType: 'ORDERED', dateStart: '', dateEnd: '', currentPage: 1, sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false,
}

// Local list snapshot. Filters, sorting, selection and column preferences only
// change presentation; route entry and the public business refresh reload facts.
let listSnapshot: PrintingWorkOrderBusinessRecord[] | undefined
function listRows(): PrintingWorkOrderBusinessRecord[] {
  if (!listSnapshot) {
    listSnapshot = listPrintingWorkOrders()
    // Resolve each relation once on load, so filtering into a later page stays local.
    for (const order of listSnapshot) { printingUpstreamNames(order); renderPrintingRelations(order, 'upstream'); renderPrintingRelations(order, 'downstream') }
  }
  return listSnapshot
}

const selectedWorkOrderIds = new Set<string>()

function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  if (!image.imageUrl) return `<span class="${size} flex shrink-0 items-center justify-center rounded border border-amber-200 bg-amber-50 p-1 text-center text-xs text-amber-800" role="img" aria-label="${escapeHtml(image.imageAlt)}：缺少对应图片">缺少对应图片</span>`
  if (/花型/.test(image.imageAlt) && /sample[.-]/.test(image.imageUrl)) return `<span class="text-xs text-amber-700">正式花型图待补充</span>`
  return `<button type="button" class="${size} shrink-0 overflow-hidden rounded-md border bg-slate-50" data-printing-action="preview-image" data-image-url="${escapeHtml(image.imageUrl)}" data-image-alt="${escapeHtml(image.imageAlt)}" aria-label="查看${escapeHtml(image.imageAlt)}大图">
    <img class="h-full w-full object-cover" src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.imageAlt)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
    <span hidden class="flex h-full w-full items-center justify-center p-1 text-[10px] text-red-600">图片加载失败</span>
  </button>`
}

function statusBadge(label: string, tone: 'blue' | 'amber' | 'green' | 'slate' | 'red'): string {
  return renderBadge(label, ({blue: 'info', amber: 'warning', green: 'success', slate: 'neutral', red: 'danger'} as const)[tone])
}

function processingBadge(status: PrintingProcessingStatus): string {
  return statusBadge(PRINTING_PROCESSING_STATUS_LABEL[status], status === 'PROCESS_COMPLETED' ? 'green' : status === 'PROCESSING' ? 'blue' : status === 'CANCELLED' ? 'red' : 'amber')
}

function receiptBadge(status: PrintingReceiptStatus): string {
  return statusBadge(PRINTING_RECEIPT_STATUS_LABEL[status], status === 'RECEIVED' ? 'green' : status === 'RECEIPT_DIFFERENCE' ? 'red' : status === 'WAIT_SOURCE' ? 'amber' : 'amber')
}

function handoverBadge(status: PrintingHandoverStatus): string {
  return statusBadge(PRINTING_HANDOVER_STATUS_LABEL[status], status === 'FULL_HANDOVER' ? 'green' : status === 'NOT_READY' ? 'slate' : status === 'PARTIAL_HANDOVER' ? 'amber' : 'blue')
}

function actionButton(label: string, action: string, order: PrintingWorkOrderBusinessRecord, disabledReason = ''): string {
  return `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:text-muted-foreground disabled:cursor-not-allowed" ${disabledReason ? `disabled title="${escapeHtml(disabledReason)}"` : ''} data-printing-row-action data-printing-action="${escapeHtml(action)}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function printAction(label: string, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION', order: PrintingWorkOrderBusinessRecord): string {
  return `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-printing-row-action data-printing-action="open-print" data-document-type="${documentType}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function renderActions(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="grid w-full grid-cols-2 gap-x-1 gap-y-0.5" data-printing-row-actions>
    <a class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-printing-row-action data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">查看</a>
    ${actionButton('调整投入', 'change-input', order, order.output.completedQty > 0 ? '已有加工产出，不能调整投入' : '')}
    ${printAction('印花信息单', 'PRINTING_INFO_SHEET', order)}
    ${printAction('印花确认单', 'PRINTING_CONFIRMATION', order)}
    ${actionButton('产出卷条码', 'open-barcodes', order)}
    ${actionButton('日志', 'logs', order)}
    ${actionButton('编辑信息', 'edit-info', order)}
  </div>`
}

function renderInputMaterial(order: PrintingWorkOrderBusinessRecord): string {
  const material = printingInputIdentity(order)
  return `<div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="text-muted-foreground">${material.identityLabel}</p><p class="line-clamp-2 font-medium" title="${escapeHtml(material.materialName)}">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p>${escapeHtml(printingSpecification(material))}</p></div></div>`
}
function renderOrderProduct(order: PrintingWorkOrderBusinessRecord): string {
  if (order.demandSource.type === 'STOCK') {
    const actual = printingInputIdentity(order)
    const material = actual.identityLabel === '实际投入' && actual.imageUrl ? actual : { ...order.plannedInput, identityLabel: '计划备货物料' }
    return `<div class="space-y-1"><p class="font-medium">备货物料</p><div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p class="text-muted-foreground">${material.identityLabel}</p></div></div>${order.historicalInputQuantityUnknown ? '<p class="text-amber-700">实际投入待补录</p>' : ''}</div>`
  }
  return `<div class="flex gap-2">${imageButton(order.product, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2 font-medium" title="${escapeHtml(order.product.productName)}">${escapeHtml(order.product.productName)}</p><p class="truncate" title="${escapeHtml(order.product.spu)}">${escapeHtml(order.product.spu)}</p></div></div>`
}

const columns: StandardListColumn<PrintingWorkOrderBusinessRecord>[] = [
  { key: 'selection', title: '选择', width: 72, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.workOrderId), selectedWorkOrderIds, EVENT_PREFIX), render: order => `<input type="checkbox" aria-label="选择 ${escapeHtml(order.printOrderNo)}" data-printing-action="toggle-select" data-work-order-id="${escapeHtml(order.workOrderId)}" ${selectedWorkOrderIds.has(order.workOrderId) ? 'checked' : ''}>` },
  { key: 'order', title: '加工单／商品', width: 200, required: true, freezeable: true, sortable: true, sortValue: order => order.printOrderNo,
    render: order => `<div class="space-y-2 text-xs"><div class="flex items-center gap-2"><a class="whitespace-nowrap font-semibold text-blue-700" href="${buildPrintingWorkOrderDetailLink(order.workOrderId)}" data-nav="${buildPrintingWorkOrderDetailLink(order.workOrderId)}">${escapeHtml(order.printOrderNo)}</a></div>${renderOrderProduct(order)}<p>${escapeHtml(PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type])} · ${escapeHtml(order.demandSource.sourceNo || order.demandSource.sourceLabel)}</p></div>` },
  { key: 'input', title: '加工投入／上游', freezeable: true, width: 235, required: true, sortable: true, sortValue: order => order.plannedInput.sku,
    render: order => `<div class="space-y-2 text-xs">${renderInputMaterial(order)}${renderPrintingRelations(order, 'upstream')}<p class="tabular-nums">计划 ${formatPrintingQty(order.plannedInput.plannedQty)} · 已收 ${order.historicalInputQuantityUnknown ? '待补录' : formatPrintingQty(order.actualInput.receivedQty)} · 已用 ${formatPrintingQty(order.actualInput.usedQty)} ${escapeHtml(order.plannedInput.qtyUnit)}</p>${order.inputChanges.length ? statusBadge('已换料', 'amber') : ''}</div>` },
  { key: 'requirement', title: '加工要求', freezeable: true, width: 170, sortable: true, sortValue: order => order.requirement.type,
    render: order => `<div class="space-y-2 text-xs"><p class="font-medium">${escapeHtml(order.requirement.type)} · ${escapeHtml(order.requirement.printSide)}</p><div class="flex gap-2"><div>${imageButton(order.requirement.frontPattern, 'h-9 w-9')}<p>正面</p></div><div class="min-w-0"><p>${escapeHtml(printingPatternLabel(order.requirement.frontPattern.patternNo))}</p><p class="text-amber-700">正式素材待核验</p></div></div>${order.requirement.insidePattern ? `<div class="flex gap-2"><div>${imageButton(order.requirement.insidePattern, 'h-9 w-9')}<p>反面</p></div><div class="min-w-0"><p>${escapeHtml(printingPatternLabel(order.requirement.insidePattern.patternNo))}</p><p class="text-amber-700">正式素材待核验</p></div></div>` : ''}</div>` },
  { key: 'progress', title: '处理进度', freezeable: true, width: 132, required: true,
    render: order => `<div class="space-y-2 text-xs"><p>接收 ${order.historicalInputQuantityUnknown ? statusBadge('历史待补录', 'amber') : receiptBadge(order.receiptStatus)}</p><p>加工 ${processingBadge(order.processingStatus)}</p><p>交出 ${handoverBadge(order.handoverStatus)}</p>${order.processingStatus === 'PROCESSING' && order.output.completedQty > 0 ? '<p class="text-muted-foreground">已完成部分批次</p>' : ''}</div>` },
  { key: 'output', title: '加工产出／下游', freezeable: true, width: 245, required: true, sortable: true, sortValue: order => order.output.completedQty,
    render: order => `<div class="space-y-2 text-xs"><div class="flex gap-2">${imageButton(order.output, 'h-10 w-10')}<div class="min-w-0 flex-1"><p class="text-amber-700">参考图待核验</p><p class="line-clamp-2 font-medium" title="${escapeHtml(order.output.materialName)}">${escapeHtml(order.output.materialName)}</p><p class="truncate text-muted-foreground" title="${escapeHtml(order.output.sku)}">${escapeHtml(printingMaterialCode(order.output.sku, true))}</p><p>${escapeHtml(printingSpecification(order.output))}</p></div></div>${renderPrintingRelations(order, 'downstream')}<p class="tabular-nums">完成 ${formatPrintingQty(order.output.completedQty)} · 已交 ${formatPrintingQty(order.handover.handedOverQty)} · 下游已收 ${formatPrintingQty(order.handover.receivedQty)} ${escapeHtml(order.output.qtyUnit)}</p>${order.pendingWritebackQty > 0 ? `<p class="text-amber-700">下游待接收 ${formatPrintingQty(order.pendingWritebackQty)} ${escapeHtml(order.output.qtyUnit)}</p>` : ''}${order.confirmedReceiptDifference || order.handover.objectionQty ? statusBadge('接收差异', 'amber') : ''}</div>` },
  { key: 'factoryTime', title: '工厂／交期', freezeable: true, width: 155, sortable: true, sortValue: order => order.plannedFinishAt || '',
    render: order => `<div class="space-y-2 text-xs"><p class="font-medium">${escapeHtml(order.printFactoryName)}</p><p>预计完成：${escapeHtml(order.plannedFinishAt || '待确定')}</p>${order.plannedFinishAt && order.plannedFinishAt < new Date().toISOString().slice(0,10) && !['PROCESS_COMPLETED','CANCELLED'].includes(order.processingStatus) ? statusBadge('超期', 'red') : ''}</div>` },
  { key: 'actions', title: '操作', width: 176, required: true, actionColumn: true, render: renderActions },
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
    order.plannedInput.materialName, order.output.materialName, order.requirement.frontPattern.patternNo, ...printingUpstreamNames(order), order.plannedInput.spu, order.plannedInput.sku, order.actualInput.actualSku, order.output.sku, order.handover.handoverNo,
    ...order.barcodes.map((barcode) => barcode.barcode),
  ]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}

function yesNoMatch(filter: YesNoFilter, yes: boolean): boolean {
  return !filter || (filter === 'YES' ? yes : !yes)
}

function filteredRows(): PrintingWorkOrderBusinessRecord[] {
  return listRows().filter((order) => (
    textMatches(order)
    && (!state.receiptStatus || order.receiptStatus === state.receiptStatus)
    && (!state.processingStatus || order.processingStatus === state.processingStatus)
    && (!state.handoverStatus || order.handoverStatus === state.handoverStatus)
    && (!state.demandSource || order.demandSource.type === state.demandSource)
    && (!state.salesType || order.salesType === state.salesType)
    && (!state.factory || order.printFactoryName === state.factory)
    && (!state.craft || order.requirement.craftName === state.craft)
    && (!state.upstream || printingUpstreamNames(order).includes(state.upstream))
    && (!state.receiver || order.receivingTargetName === state.receiver)
    && (!state.exception || (state.exception === 'HISTORY' ? Boolean(order.historicalInputQuantityUnknown) : state.exception === 'DIFFERENCE' ? order.receiptStatus === 'RECEIPT_DIFFERENCE' || order.handover.objectionQty > 0 : Boolean(order.plannedFinishAt && order.plannedFinishAt < new Date().toISOString().slice(0,10) && !['PROCESS_COMPLETED','CANCELLED'].includes(order.processingStatus))))
    && (!state.materialType || order.materialType === state.materialType)
    && yesNoMatch(state.changedInput, order.inputChanges.length > 0)
    && (!state.creationMethod || order.creationMethod === state.creationMethod)
    && yesNoMatch(state.hasDifference, order.confirmedReceiptDifference || order.handover.objectionQty > 0)
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
  return `<label><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border bg-white px-2 text-sm" data-printing-work-orders-field="${escapeHtml(name)}">${options.map(([key, text]) => option(key, text, value)).join('')}</select></label>`
}

function uniqueOptions(values: string[]): Array<[string, string]> {
  return [['', '全部'], ...[...new Set(values.filter(Boolean))].sort().map((value) => [value, value] as [string, string])]
}

function renderFilters(): string {
  const rows = listRows()
  const advancedCount = [state.demandSource,state.salesType,state.craft,state.upstream,state.receiver,state.materialType,state.changedInput,state.creationMethod,state.hasDifference,state.dateStart,state.dateEnd,state.exception,state.timeType === 'ORDERED' ? '' : state.timeType].filter(Boolean).length
  return `<section class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-printing-work-orders-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="单号、商品、物料或花型"></label>
    ${selectField('接收状态', 'receiptStatus', state.receiptStatus, [['', '全部'], ...PRINTING_RECEIPT_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工状态', 'processingStatus', state.processingStatus, [['', '全部'], ...PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('交出状态', 'handoverStatus', state.handoverStatus, [['', '全部'], ...PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工厂', 'factory', state.factory, uniqueOptions(rows.map((row) => row.printFactoryName)))}
  </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${selectField('上游供料方', 'upstream', state.upstream, uniqueOptions(rows.flatMap(printingUpstreamNames)))}
    ${selectField('需求来源', 'demandSource', state.demandSource, [['', '全部'], ...Object.entries(PRINTING_DEMAND_SOURCE_LABEL)])}
    ${selectField('售卖类型', 'salesType', state.salesType, uniqueOptions(rows.map((row) => row.salesType)))}

    ${selectField('工艺', 'craft', state.craft, uniqueOptions(rows.map((row) => row.requirement.craftName)))}
    ${selectField('下游接收方', 'receiver', state.receiver, uniqueOptions(rows.map((row) => row.receivingTargetName)))}
    ${selectField('异常', 'exception', state.exception, [['', '全部'], ['HISTORY','历史待补录'], ['DIFFERENCE','接收差异'], ['OVERDUE','超期']])}
    ${selectField('物料类型', 'materialType', state.materialType, uniqueOptions(rows.map((row) => row.materialType)))}
    ${selectField('是否换料', 'changedInput', state.changedInput, [['', '全部'], ['YES', '已换料'], ['NO', '未换料']])}
    ${selectField('创建方式', 'creationMethod', state.creationMethod, uniqueOptions(rows.map((row) => row.creationMethod)))}
    ${selectField('差异/异议', 'hasDifference', state.hasDifference, [['', '全部'], ['YES', '存在'], ['NO', '无']])}
    ${selectField('时间类型', 'timeType', state.timeType, [['ORDERED', '下单时间'], ['INPUT_RECEIVED', '投入接收时间'], ['COMPLETED', '加工完成时间'], ['HANDOVER', '交出时间'], ['RECEIVED', '下游接收时间']])}
    <label><span class="mb-1 block text-xs text-muted-foreground">开始日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateStart" value="${escapeHtml(state.dateStart)}"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">结束日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateEnd" value="${escapeHtml(state.dateEnd)}"></label>
  </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter', skipPageRerender: true }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter', skipPageRerender: true }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: 'printing', action: 'export', skipPageRerender: true }, 'download')}${renderProcessFilterToggle(advancedCount)}</div></section>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderStats(rows: PrintingWorkOrderBusinessRecord[]): string {
  const summary = getPrintingWorkOrderSummary(rows)
  const items = [
    { label: '加工单数', value: summary.orderCount },
    { label: '计划投入', value: formatPrintingSummaryMetric(summary, 'plannedInputQty') },
    { label: '已接收', value: formatPrintingSummaryMetric(summary, 'receivedInputQty') },
    { label: '实际使用', value: formatPrintingSummaryMetric(summary, 'usedInputQty') },
    { label: '完成数量', value: formatPrintingSummaryMetric(summary, 'completedOutputQty') },
    { label: '下游待接收', value: formatPrintingSummaryMetric(summary, 'pendingReceiptQty') },
  ]
  return renderProcessOrderStats(items)
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const rows = filteredRows()
  const view = listController.getView(rows)
  return renderStandardListPage({
    title: '印花加工单',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2"><button class="h-9 rounded-md border px-3 text-sm" data-printing-action="open-dispatch-pending" data-skip-page-rerender="true">待交出列表</button><button class="h-9 rounded-md border px-3 text-sm" data-printing-action="open-dispatch-documents" data-skip-page-rerender="true">交出单据</button>` + renderPrimaryButton(`批量打印印花确认单（${selectedWorkOrderIds.size}）`, { prefix: 'printing', action: 'batch-print-confirmation', skipPageRerender: true }, 'printer').replace('<button', `<button ${selectedWorkOrderIds.size ? '' : 'disabled'}`) + '</div>',
    filtersHtml: `<div data-printing-work-orders-filters-surface>${renderFilters()}</div>`,
    statsHtml: `<div data-printing-work-orders-stats-surface>${renderStats(rows)}</div>`,
    listTitle: `共 ${rows.length} 条 · 已选 ${selectedWorkOrderIds.size} 条`,
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
  listSnapshot = undefined
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  listController.installColumnDragEvents()
  return `<div data-printing-work-orders-root data-skip-page-rerender="true"><div data-printing-work-orders-workspace>${renderWorkspace()}</div><div data-printing-dialog-surface>${renderPrintingDialog()}</div></div>`
}

export function refreshPrintingWorkOrderListPage(reloadFacts = true): void {
  if (reloadFacts) listSnapshot = undefined
  const workspace = rootElement()?.querySelector<HTMLElement>('[data-printing-work-orders-workspace]')
  if (workspace) { workspace.innerHTML = renderWorkspace(); hydrateIcons(workspace); syncProcessSelectionHeader(workspace) }
}

export function getSelectedPrintingWorkOrderIds(): string[] {
  return [...selectedWorkOrderIds]
}

export function selectFilteredPrintingWorkOrders(): void {
  filteredRows().forEach((order) => selectedWorkOrderIds.add(order.workOrderId))
  refreshPrintingWorkOrderListPage(false)
}

export function getFilteredPrintingWorkOrders(): PrintingWorkOrderBusinessRecord[] {
  return filteredRows()
}

function readFilterFields(root: HTMLElement): void {
  const get = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-printing-work-orders-field="${name}"]`)?.value || ''
  state.keyword = get('keyword')
  state.receiptStatus = get('receiptStatus') as typeof state.receiptStatus
  state.processingStatus = get('processingStatus') as typeof state.processingStatus
  state.handoverStatus = get('handoverStatus') as typeof state.handoverStatus
  state.demandSource = get('demandSource') as typeof state.demandSource
  state.salesType = get('salesType')
  state.factory = get('factory')
  state.craft = get('craft')
  state.upstream = get('upstream')
  state.receiver = get('receiver')
  state.exception = get('exception')
  state.materialType = get('materialType')
  state.changedInput = get('changedInput') as YesNoFilter
  state.creationMethod = get('creationMethod')
  state.hasDifference = get('hasDifference') as YesNoFilter
  state.timeType = (get('timeType') || 'ORDERED') as typeof state.timeType
  state.dateStart = get('dateStart')
  state.dateEnd = get('dateEnd')
}

function resetFilters(): void {
  state.keyword = ''; state.receiptStatus = ''; state.processingStatus = ''; state.handoverStatus = ''; state.demandSource = ''; state.salesType = ''; state.factory = ''; state.craft = ''; state.upstream = ''; state.receiver = ''; state.exception = ''; state.materialType = ''; state.changedInput = ''; state.creationMethod = ''; state.hasDifference = ''; state.timeType = 'ORDERED'; state.dateStart = ''; state.dateEnd = ''; state.currentPage = 1
}

export function handlePrintingWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-printing-work-orders-root]')
  if (!root) return false
  if (handleProcessFilterPresentation(root, target)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-printing-work-orders-field]')
  if (field?.dataset.printingWorkOrdersField === 'selection-scope') {
    const scope = field.value
    if (!scope) return true
    if (scope === 'clear') selectedWorkOrderIds.clear()
    else if (scope === 'all') filteredRows().forEach(row => selectedWorkOrderIds.add(row.workOrderId))
    else root.querySelectorAll<HTMLInputElement>('tbody [data-printing-action="toggle-select"]').forEach(box => selectedWorkOrderIds.add(box.dataset.workOrderId || ''))
    refreshPrintingWorkOrderListPage(false); return true
  }
  if (field?.dataset.printingWorkOrdersField === 'pageSize') {
    listController.setPageSize(Number(field.value)); listController.refresh(); syncProcessSelectionHeader(root); return true
  }
  const selectBox = target.closest<HTMLInputElement>('[data-printing-action="toggle-select"]')
  if (selectBox) {
    const id = selectBox.dataset.workOrderId || ''
    if (selectBox.checked) selectedWorkOrderIds.add(id); else selectedWorkOrderIds.delete(id)
    refreshPrintingWorkOrderListPage(false); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-printing-work-orders-action]')
  if (!actionNode) return Boolean(field)
  const action = actionNode.dataset.printingWorkOrdersAction || ''
  if (action === 'toggle-page') {
    root.querySelectorAll<HTMLInputElement>('tbody [data-printing-action="toggle-select"]').forEach(box => { const id = box.dataset.workOrderId || ''; if ((actionNode as HTMLInputElement).checked) selectedWorkOrderIds.add(id); else selectedWorkOrderIds.delete(id) })
    refreshPrintingWorkOrderListPage(false); return true
  }
  if (action === 'select-page') { root.querySelectorAll<HTMLInputElement>('[data-printing-action="toggle-select"]').forEach(box => { selectedWorkOrderIds.add(box.dataset.workOrderId || ''); box.checked = true }); refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'apply-filter') { readFilterFields(root); selectedWorkOrderIds.clear(); state.currentPage = 1; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'reset-filter') { resetFilters(); selectedWorkOrderIds.clear(); refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'prev-page' || action === 'next-page') { listController.stepPage(action === 'next-page' ? 1 : -1); listController.refresh(); syncProcessSelectionHeader(root); return true }
  if (action === 'sort-column') { listController.cycleSort(actionNode.dataset.columnKey || ''); listController.refresh(); syncProcessSelectionHeader(root); return true }
  if (action === 'open-column-settings') { state.showColumnSettings = true; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { listController.updateColumnPreference(action, actionNode.dataset.printingWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-printing-work-orders-column-key]')?.dataset.printingWorkOrdersColumnKey || '', target instanceof HTMLInputElement ? target.checked : undefined); listController.refresh({ overlays: true }); return true }
  if (action === 'restore-column-settings') { listController.restorePreferences(); listController.refresh({ overlays: true }); return true }
  return false
}

export { imageButton as renderPrintingBusinessImage }
