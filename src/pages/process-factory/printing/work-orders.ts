import { createPrintingOrderDisplayColumns } from '../../process-work-orders/order-list-columns.ts'
import { withProcessOrderTaskRelationRead } from '../../../data/fcs/process-order-task-links.ts'
import { buildUnifiedPrintPreviewLink } from '../../../data/fcs/print-service.ts'
import { listPrintingFactoryOptions } from '../../../data/fcs/printing-factories.ts'
import { renderPrintingObjectImage } from './presentation.ts'
import { printingProductionStage, printingIsOverdue, renderPrintingDemandSource, renderPrintingQuantityGroups } from './presentation.ts'
import { renderPrintingWorkOrderTimes, printingWorkOrderTimeGroups } from './work-order-times.ts'
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
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import { renderPrintingRelations, printingUpstreamNames, printingPatternLabel, printingMaterialCode, printingSpecification, printingInputIdentity } from './relations.ts'
import { escapeHtml } from '../../../utils.ts'
import { ensureProductionDemandEarlyProcessAcceptanceData } from '../../../data/fcs/production-demand-early-process-work-orders.ts'
import { renderPrintingDialog } from './dialogs.ts'

const EVENT_PREFIX = 'printing-work-orders'
const PREFERENCE_KEY = '/fcs/craft/printing/work-orders:input-output-v4'
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
  supplement: YesNoFilter
  printSide: string
  stage: string
  printer: string
  artwork: YesNoFilter
  timeType: string
  dateStart: string
  dateEnd: string
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  feedback: string
} = {
  keyword: '', receiptStatus: '', processingStatus: '', handoverStatus: '', demandSource: '', salesType: '', factory: '', craft: '', upstream: '', receiver: '', exception: '', materialType: '', changedInput: '', creationMethod: '', hasDifference: '', supplement: '', printSide: '', stage: '', printer: '', artwork: '', timeType: 'ORDERED', dateStart: '', dateEnd: '', currentPage: 1, sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false, feedback: '',
}

// Local list snapshot. Filters, sorting, selection and column preferences only
// change presentation; route entry and the public business refresh reload facts.
let listSnapshot: PrintingWorkOrderBusinessRecord[] | undefined
function listRows(): PrintingWorkOrderBusinessRecord[] {
  if (!listSnapshot) {
    ensureProductionDemandEarlyProcessAcceptanceData('PRINT')
    listSnapshot = listPrintingWorkOrders()
    // 关联事实按实际展示的行懒加载；首屏不预计算所有分页的上游单据。
  }
  return listSnapshot
}

const selectedWorkOrderIds = new Set<string>()
let drilldownOrderIds: Set<string> | undefined
let appliedRouteQuery: string | undefined

function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  return renderPrintingObjectImage(image, size)
}

function actionButton(label: string, action: string, order: PrintingWorkOrderBusinessRecord, disabledReason = ''): string {
  return `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:text-muted-foreground disabled:cursor-not-allowed" ${disabledReason ? `disabled title="${escapeHtml(disabledReason)}"` : ''} data-printing-row-action data-printing-action="${escapeHtml(action)}" data-work-order-id="${escapeHtml(order.workOrderId)}">${escapeHtml(label)}</button>`
}

function printAction(label: string, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION', order: PrintingWorkOrderBusinessRecord): string {
  const href = buildUnifiedPrintPreviewLink({ documentType, sourceType: 'PRINTING_WORK_ORDER', sourceId: order.workOrderId })
  return `<a class="inline-flex min-h-8 items-center justify-center rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" href="${escapeHtml(href)}" data-nav="${escapeHtml(href)}" data-printing-preview-link data-skip-page-rerender="true">${escapeHtml(label)}</a>`
}

function renderBatchPrintAction(): string {
  const label = `批量打印印花确认单（${selectedWorkOrderIds.size}）`
  if (!selectedWorkOrderIds.size) return `<button disabled class="h-9 rounded-md bg-blue-400 px-3 text-sm text-white disabled:opacity-60">${label}</button>`
  const href = buildUnifiedPrintPreviewLink({ documentType: 'PRINTING_CONFIRMATION', sourceType: 'PRINTING_WORK_ORDER', sourceId: [...selectedWorkOrderIds].join(',') })
  return `<a class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white" href="${escapeHtml(href)}" data-nav="${escapeHtml(href)}" data-printing-preview-link data-skip-page-rerender="true">${label}</a>`
}

function renderActions(order: PrintingWorkOrderBusinessRecord): string {
  return `<div class="grid w-full grid-cols-2 gap-x-1 gap-y-0.5" data-printing-row-actions>
    <a class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-printing-row-action data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">查看</a>
    ${actionButton('调整投入', 'change-input', order, order.output.completedQty > 0 ? '已有加工产出，不能调整投入' : '')}
    ${printAction('打印印花信息单', 'PRINTING_INFO_SHEET', order)}
    ${printAction('打印印花确认单', 'PRINTING_CONFIRMATION', order)}
    ${actionButton('产出卷条码', 'open-barcodes', order)}
    ${actionButton('日志', 'logs', order)}
    ${actionButton('编辑信息', 'edit-info', order)}${actionButton(order.remark ? '查看备注' : '备注', 'remarks', order)}
  </div>`
}

const columns: StandardListColumn<PrintingWorkOrderBusinessRecord>[] = [
  { key: 'selection', title: '选择', width: 72, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.workOrderId), selectedWorkOrderIds, EVENT_PREFIX), render: order => `<input type="checkbox" aria-label="选择 ${escapeHtml(order.printOrderNo)}" data-printing-action="toggle-select" data-work-order-id="${escapeHtml(order.workOrderId)}" ${selectedWorkOrderIds.has(order.workOrderId) ? 'checked' : ''}>` },
  ...createPrintingOrderDisplayColumns(order => `<span class="inline-flex flex-wrap items-center gap-2">${renderProductionObjectCodeButton({ objectType: 'PRINT_WORK_ORDER', objectId: order.printOrderNo })}<a class="text-xs text-blue-700 underline" href="${buildPrintingWorkOrderDetailLink(order.workOrderId)}" data-nav="${buildPrintingWorkOrderDetailLink(order.workOrderId)}">详情</a></span>`),
  { key: 'actions', title: '操作', width: 176, required: true, actionColumn: true, render: renderActions },
]

function selectedTime(order: PrintingWorkOrderBusinessRecord): string {
  if (state.timeType === 'INPUT_RECEIVED') return order.inputReceivedAt || ''
  if (state.timeType === 'COMPLETED') return order.completedAt || ''
  if (state.timeType === 'HANDOVER') return order.handover.handedOverAt || ''
  if (state.timeType === 'RECEIVED') return order.handover.receivedAt || ''
  if (state.timeType.startsWith('FACT:')) return printingWorkOrderTimeGroups(order).flatMap(group => group.fields).find(([label]) => label === state.timeType.slice(5))?.[1] || ''
  return order.orderedAt
}

function dateMatches(order: PrintingWorkOrderBusinessRecord): boolean {
  const time = selectedTime(order)
  const value = /^\d{4}-\d{2}-\d{2}/.test(time) ? time.slice(0, 10) : ''
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
    order.plannedInput.materialName, order.output.materialName, order.requirement.frontPattern.patternNo, order.requirement.insidePattern?.patternNo, order.requirement.frontPattern.patternName, order.requirement.insidePattern?.patternName, ...printingUpstreamNames(order), order.plannedInput.spu, order.plannedInput.sku, order.actualInput.actualSku, order.output.sku, order.handover.handoverNo,
    ...order.barcodes.map((barcode) => barcode.barcode), ...(order.dispatchDocuments || []).map(doc => doc.id), ...((order.actualInput.receipts || []).map(receipt => receipt.upstreamRecordId)),
  ]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}

function yesNoMatch(filter: YesNoFilter, yes: boolean): boolean {
  return !filter || (filter === 'YES' ? yes : !yes)
}

function filteredRows(): PrintingWorkOrderBusinessRecord[] {
  return listRows().filter((order) => (
    textMatches(order)
    && (!drilldownOrderIds || drilldownOrderIds.has(order.workOrderId))
    && (!state.receiptStatus || order.receiptStatus === state.receiptStatus)
    && (!state.processingStatus || order.processingStatus === state.processingStatus)
    && (!state.handoverStatus || order.handoverStatus === state.handoverStatus)
    && (!state.demandSource || order.demandSource.type === state.demandSource)
    && (!state.salesType || order.salesType === state.salesType)
    && (!state.factory || order.printFactoryId === state.factory)
    && (!state.craft || order.requirement.craftName === state.craft)
    && (!state.upstream || printingUpstreamNames(order).includes(state.upstream))
    && (!state.receiver || order.receivingTargetName === state.receiver)
    && (!state.exception || (state.exception === 'HISTORY' ? Boolean(order.historicalInputQuantityUnknown) : state.exception === 'DIFFERENCE' ? order.receiptStatus === 'RECEIPT_DIFFERENCE' || order.handover.objectionQty > 0 : printingIsOverdue(order)))
    && (!state.materialType || order.materialType === state.materialType)
    && yesNoMatch(state.changedInput, order.inputChanges.length > 0)
    && (!state.creationMethod || order.creationMethod === state.creationMethod)
    && yesNoMatch(state.hasDifference, order.confirmedReceiptDifference || order.handover.objectionQty > 0)
    && yesNoMatch(state.supplement, Boolean(order.historicalSupplement || order.demandSource.supplementOrderNo || order.demandSource.type === 'SUPPLEMENT'))
    && (!state.printSide || order.requirement.printSide === state.printSide)
    && (!state.stage || printingProductionStage(order) === state.stage)
    && (!state.printer || order.printerNo === state.printer)
    && yesNoMatch(state.artwork, Boolean(order.requirement.frontPattern.imageUrl && order.requirement.frontPattern.patternVersion && (order.requirement.printSide !== '双面' || (order.requirement.insidePattern?.imageUrl && order.requirement.insidePattern.patternVersion))))
    && dateMatches(order)
  ))
}

const listController = createProcessOrderListController({
  state, columns, preferenceKey: PREFERENCE_KEY, pageSizeOptions: PAGE_SIZE_OPTIONS, eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-printing-work-orders-root]', tableSurfaceSelector: '[data-printing-work-orders-table-surface]', paginationSurfaceSelector: '[data-printing-work-orders-pagination-surface]', overlaysSurfaceSelector: '[data-printing-work-orders-overlays-surface]',
  defaultFrozenKeys: ['order'], columnSettingsTitle: '印花加工单列设置', emptyText: '没有符合条件的印花加工单', getRows: filteredRows, locallyManagedEvents: true,
})

function refreshList(options?: Parameters<typeof listController.refresh>[0]): boolean {
  return withProcessOrderTaskRelationRead(() => listController.refresh(options))
}


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
  const advancedCount = [state.demandSource,state.salesType,state.craft,state.upstream,state.receiver,state.materialType,state.changedInput,state.creationMethod,state.hasDifference,state.dateStart,state.dateEnd,state.exception,state.supplement,state.printSide,state.stage,state.printer,state.artwork,state.timeType === 'ORDERED' ? '' : state.timeType].filter(Boolean).length
  return `<section class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-printing-work-orders-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="单号、商品、物料或花型"></label>
    ${selectField('接收状态', 'receiptStatus', state.receiptStatus, [['', '全部'], ...PRINTING_RECEIPT_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工状态', 'processingStatus', state.processingStatus, [['', '全部'], ...PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('交出状态', 'handoverStatus', state.handoverStatus, [['', '全部'], ...PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工厂', 'factory', state.factory, [['', '全部'], ...listPrintingFactoryOptions(rows).map(factory => [factory.id, factory.name] as [string, string])])}
  </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${selectField('上游供料方', 'upstream', state.upstream, advancedCount ? uniqueOptions(rows.flatMap(printingUpstreamNames)) : [['', '全部']])}
    ${selectField('需求来源', 'demandSource', state.demandSource, [['', '全部'], ...Object.entries(PRINTING_DEMAND_SOURCE_LABEL)])}
    ${selectField('售卖类型', 'salesType', state.salesType, uniqueOptions(rows.map((row) => row.salesType)))}

    ${selectField('工艺', 'craft', state.craft, uniqueOptions(rows.map((row) => row.requirement.craftName)))}
    ${selectField('下游接收方', 'receiver', state.receiver, uniqueOptions(rows.map((row) => row.receivingTargetName)))}
    ${selectField('印花面别', 'printSide', state.printSide, [['','全部'],['单面','单面'],['双面','双面']])}
    ${selectField('生产环节', 'stage', state.stage, uniqueOptions(rows.map(printingProductionStage)))}
    ${selectField('打印设备', 'printer', state.printer, uniqueOptions(rows.map(row => row.printerNo)))}
    ${selectField('花型资料', 'artwork', state.artwork, [['','全部'],['YES','资料齐备'],['NO','待补充']])}
    ${selectField('是否补料', 'supplement', state.supplement, [['','全部'],['YES','补料'],['NO','非补料']])}
    ${selectField('异常', 'exception', state.exception, [['', '全部'], ['HISTORY','历史待补录'], ['DIFFERENCE','接收差异'], ['OVERDUE','超期']])}
    ${selectField('物料类型', 'materialType', state.materialType, uniqueOptions(rows.map((row) => row.materialType)))}
    ${selectField('是否换料', 'changedInput', state.changedInput, [['', '全部'], ['YES', '已换料'], ['NO', '未换料']])}
    ${selectField('创建方式', 'creationMethod', state.creationMethod, uniqueOptions(rows.map((row) => row.creationMethod)))}
    ${selectField('差异/异议', 'hasDifference', state.hasDifference, [['', '全部'], ['YES', '存在'], ['NO', '无']])}
    ${selectField('时间类型', 'timeType', state.timeType, [['ORDERED', '加工单创建'], ['FACT:需求创建', '需求创建'], ['FACT:生产单生成', '生产单生成'], ['FACT:待接收生成', '待接收生成'], ['FACT:上游发出', '上游发出'], ['FACT:计划完成', '计划完成'], ['FACT:实际开工', '实际开工'], ['FACT:打印完成', '打印完成'], ['FACT:转印完成', '转印完成'], ['FACT:首次建交出单', '交出单创建'], ['FACT:工厂扫齐卷', '工厂扫齐卷'], ['INPUT_RECEIVED', '投入接收时间'], ['COMPLETED', '加工完成时间'], ['HANDOVER', '交出时间'], ['RECEIVED', '下游接收时间']])}
    <label><span class="mb-1 block text-xs text-muted-foreground">开始日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateStart" value="${escapeHtml(state.dateStart)}"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">结束日期</span><input type="date" class="h-9 w-full rounded-md border px-2 text-sm" data-printing-work-orders-field="dateEnd" value="${escapeHtml(state.dateEnd)}"></label>
  </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter', skipPageRerender: true }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter', skipPageRerender: true }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: 'printing', action: 'export', skipPageRerender: true }, 'download')}${renderProcessFilterToggle(advancedCount, 'button')}</div></section>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderStats(rows: PrintingWorkOrderBusinessRecord[]): string {
  const summary = getPrintingWorkOrderSummary(rows)
  const items = [
    { label: '加工单数', value: summary.orderCount },
    { label: '计划投入', value: formatPrintingSummaryMetric(summary, 'plannedInputQty') },
    { label: '本厂实收', value: formatPrintingSummaryMetric(summary, 'receivedInputQty') },
    { label: '实际使用', value: formatPrintingSummaryMetric(summary, 'usedInputQty') },
    { label: '完成数量', value: formatPrintingSummaryMetric(summary, 'completedOutputQty') },
    { label: '下游待接收', value: formatPrintingSummaryMetric(summary, 'pendingReceiptQty') },
  ]
  return renderProcessOrderStats(items) + (summary.unknownInputCount ? `<p class="mt-1 text-xs text-amber-700">${summary.unknownInputCount} 张历史单的实收数量未记录，实收统计仅包含已知数据。</p>` : '')
}

const DIRECT_FACTORY_TAB_COUNT = 5

function renderFactoryTabs(): string {
  const rows = listRows()
  const factories = [{id:'', name:'全部加工厂'}, ...listPrintingFactoryOptions(rows)]
  const directFactories = factories.slice(0, DIRECT_FACTORY_TAB_COUNT)
  const overflowFactories = factories.slice(DIRECT_FACTORY_TAB_COUNT)
  const overflowFactory = overflowFactories.find(factory => factory.id === state.factory)
  const directTabs = directFactories.map(factory => `<button type="button" role="tab" aria-selected="${state.factory === factory.id}" class="rounded-t-md border px-4 py-3 text-sm ${state.factory === factory.id ? 'border-t-2 border-t-blue-600 bg-white font-semibold text-blue-700' : 'text-slate-500 hover:bg-white'}" data-printing-work-orders-action="factory-tab" data-factory="${escapeHtml(factory.id)}">${escapeHtml(factory.name)} <span class="text-xs">${factory.id ? rows.filter(row => row.printFactoryId === factory.id).length : rows.length}</span></button>`).join('')
  const moreTab = overflowFactories.length
    ? `<details class="group relative -mb-px" aria-label="更多加工厂">
        <summary class="flex h-[46px] min-w-32 cursor-pointer list-none items-center justify-between gap-3 rounded-t-md border bg-white px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${overflowFactory ? 'border-t-2 border-t-blue-600 text-blue-700' : 'text-slate-500'}">
          <span class="max-w-44 truncate">${escapeHtml(overflowFactory?.name || '更多')}</span>
          <i data-lucide="chevron-down" class="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"></i>
        </summary>
        <div class="absolute right-0 z-30 mt-1 min-w-56 overflow-hidden rounded-lg border bg-white py-1 shadow-xl">
          ${overflowFactories.map(factory => `<button type="button" class="flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm hover:bg-slate-50 ${state.factory === factory.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700'}" data-printing-work-orders-action="factory-tab" data-factory="${escapeHtml(factory.id)}"><span>${escapeHtml(factory.name)}</span><span class="text-xs tabular-nums text-slate-500">${rows.filter(row => row.printFactoryId === factory.id).length}</span></button>`).join('')}
        </div>
      </details>`
    : ''
  return `<div class="mb-3 flex items-end gap-3 border-b bg-slate-50 px-2 pt-2"><div role="tablist" aria-label="加工厂切换" class="flex min-w-0 flex-1 flex-wrap items-end gap-1">${directTabs}${moreTab}</div></div>`
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const rows = filteredRows()
  const view = withProcessOrderTaskRelationRead(() => listController.getView(rows))
  return renderStandardListPage({
    title: '印花加工单',
    showHeader: false,
    filtersHtml: `<div data-printing-work-orders-filters-surface>${renderFactoryTabs()}${renderFilters()}</div>`,
    statsHtml: `<div data-printing-work-orders-stats-surface>${renderStats(rows)}</div>`,
    listTitle: `共 ${rows.length} 条 · 已选 ${selectedWorkOrderIds.size} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderBatchPrintAction()}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2')}</div>`,
    feedbackHtml: `<div data-printing-work-orders-feedback-surface>${state.feedback ? `<p class="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(state.feedback)}</p>` : ''}${drilldownOrderIds ? `<p class="mb-2 text-xs text-blue-700">统计下钻：已限定 ${drilldownOrderIds.size} 张加工单，重置可解除。</p>` : ''}</div>`,
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
  if (typeof window !== 'undefined' && appliedRouteQuery !== window.location.search) {
    appliedRouteQuery = window.location.search
    resetFilters()
    const params = new URLSearchParams(appliedRouteQuery)
    state.factory = listPrintingFactoryOptions(listRows()).find(factory => factory.id === params.get('factoryId'))?.id || ''
    state.demandSource = (params.get('demandSource') || '') as typeof state.demandSource
    state.materialType = params.get('materialType') || ''
    state.dateStart = params.get('dateFrom') || ''; state.dateEnd = params.get('dateTo') || ''
    if (params.has('workOrderIds')) drilldownOrderIds = new Set((params.get('workOrderIds') || '').split(',').filter(Boolean))
  }
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  listController.installColumnDragEvents()
  return `<div data-printing-work-orders-root data-skip-page-rerender="true"><style>[data-printing-work-orders-root] [data-standard-list-scroll] td{vertical-align:top}[data-printing-work-orders-root] [data-standard-list-stats]{display:flex;overflow-x:auto}[data-printing-work-orders-root] [data-process-stat]{min-height:48px;height:48px;gap:2px;flex:1 0 max-content}[data-printing-work-orders-root] [data-process-stat] strong{white-space:nowrap;font-size:11px;line-height:14px}</style><div data-printing-work-orders-workspace>${renderWorkspace()}</div><div data-printing-dialog-surface>${renderPrintingDialog()}</div></div>`
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
  state.supplement = get('supplement') as YesNoFilter; state.printSide = get('printSide'); state.stage = get('stage'); state.printer = get('printer'); state.artwork = get('artwork') as YesNoFilter
  state.timeType = (get('timeType') || 'ORDERED') as typeof state.timeType
  state.dateStart = get('dateStart')
  state.dateEnd = get('dateEnd')
}

function resetFilters(): void {
  drilldownOrderIds = undefined
  state.keyword = ''; state.receiptStatus = ''; state.processingStatus = ''; state.handoverStatus = ''; state.demandSource = ''; state.salesType = ''; state.factory = ''; state.craft = ''; state.upstream = ''; state.receiver = ''; state.exception = ''; state.materialType = ''; state.changedInput = ''; state.creationMethod = ''; state.hasDifference = ''; state.supplement = ''; state.printSide = ''; state.stage = ''; state.printer = ''; state.artwork = ''; state.timeType = 'ORDERED'; state.dateStart = ''; state.dateEnd = ''; state.currentPage = 1
}

export function handlePrintingWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-printing-work-orders-root]')
  if (!root) return false
  if (target.closest('[data-process-filter-toggle]')) {
    const upstream = root.querySelector<HTMLSelectElement>('[data-printing-work-orders-field="upstream"]')
    if (upstream && upstream.options.length === 1) {
      for (const [value, label] of uniqueOptions(listRows().flatMap(printingUpstreamNames)).slice(1)) {
        upstream.add(new Option(label, value))
      }
    }
  }
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
    listController.setPageSize(Number(field.value)); refreshList(); syncProcessSelectionHeader(root); return true
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
  if (action === 'factory-tab') { state.factory = actionNode.dataset.factory || ''; selectedWorkOrderIds.clear(); state.currentPage = 1; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'toggle-page') {
    root.querySelectorAll<HTMLInputElement>('tbody [data-printing-action="toggle-select"]').forEach(box => { const id = box.dataset.workOrderId || ''; if ((actionNode as HTMLInputElement).checked) selectedWorkOrderIds.add(id); else selectedWorkOrderIds.delete(id) })
    refreshPrintingWorkOrderListPage(false); return true
  }
  if (action === 'select-page') { root.querySelectorAll<HTMLInputElement>('[data-printing-action="toggle-select"]').forEach(box => { selectedWorkOrderIds.add(box.dataset.workOrderId || ''); box.checked = true }); refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'apply-filter') { readFilterFields(root); selectedWorkOrderIds.clear(); state.currentPage = 1; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'reset-filter') { resetFilters(); selectedWorkOrderIds.clear(); refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'prev-page' || action === 'next-page') { listController.stepPage(action === 'next-page' ? 1 : -1); refreshList(); syncProcessSelectionHeader(root); return true }
  if (action === 'sort-column') { listController.cycleSort(actionNode.dataset.columnKey || ''); refreshList(); syncProcessSelectionHeader(root); return true }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshList({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshList({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { listController.updateColumnPreference(action, actionNode.dataset.printingWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-printing-work-orders-column-key]')?.dataset.printingWorkOrdersColumnKey || '', target instanceof HTMLInputElement ? target.checked : undefined); refreshList({ overlays: true }); return true }
  if (action === 'restore-column-settings') { listController.restorePreferences(); refreshList({ overlays: true }); return true }
  return false
}

export { imageButton as renderPrintingBusinessImage }
