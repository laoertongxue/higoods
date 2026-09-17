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
import { renderPrintingRelations, printingUpstreamNames, printingPatternLabel, printingMaterialCode, printingSpecification, printingInputIdentity } from './relations.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  calculateEarlyProcessPlannedQty,
  createProductionDemandEarlyProcessWorkOrder,
  ensureProductionDemandEarlyProcessAcceptanceData,
  listEarlyProcessCreateCandidates,
} from '../../../data/fcs/production-demand-early-process-work-orders.ts'
import { cancelProductionDemandPrintWorkOrder } from '../../../data/fcs/printing-task-domain.ts'
import { PRODUCTION_DEMAND_PROCESS_MATCH_LABEL, type ProductionDemandProcessMatchStatus } from '../../../data/fcs/process-work-order-domain.ts'
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
  matchStatus: '' | ProductionDemandProcessMatchStatus
  createOpen: boolean
  createDemandId: string
  createProfessionalTaskId: string
  createError: string
  feedback: string
} = {
  keyword: '', receiptStatus: '', processingStatus: '', handoverStatus: '', demandSource: '', salesType: '', factory: '', craft: '', upstream: '', receiver: '', exception: '', materialType: '', changedInput: '', creationMethod: '', hasDifference: '', supplement: '', printSide: '', stage: '', printer: '', artwork: '', timeType: 'ORDERED', dateStart: '', dateEnd: '', currentPage: 1, sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false,
  matchStatus: '', createOpen: false, createDemandId: '', createProfessionalTaskId: '', createError: '', feedback: '',
}

// Local list snapshot. Filters, sorting, selection and column preferences only
// change presentation; route entry and the public business refresh reload facts.
let listSnapshot: PrintingWorkOrderBusinessRecord[] | undefined
function listRows(): PrintingWorkOrderBusinessRecord[] {
  if (!listSnapshot) {
    ensureProductionDemandEarlyProcessAcceptanceData()
    listSnapshot = listPrintingWorkOrders()
    // Resolve each relation once on load, so filtering into a later page stays local.
    for (const order of listSnapshot) { printingUpstreamNames(order); renderPrintingRelations(order, 'upstream'); renderPrintingRelations(order, 'downstream') }
  }
  return listSnapshot
}

const selectedWorkOrderIds = new Set<string>()
let drilldownOrderIds: Set<string> | undefined
let appliedRouteQuery: string | undefined

function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  return renderPrintingObjectImage(image, size)
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
  const cancel = order.matchStatus && order.matchStatus !== 'CANCELLED'
    ? actionButton('取消提前单', 'cancel-early', order)
    : ''
  return `<div class="grid w-full grid-cols-2 gap-x-1 gap-y-0.5" data-printing-row-actions>
    <a class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" href="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}" data-printing-row-action data-nav="${escapeHtml(buildPrintingWorkOrderDetailLink(order.workOrderId))}">查看</a>
    ${actionButton('调整投入', 'change-input', order, order.output.completedQty > 0 ? '已有加工产出，不能调整投入' : '')}
    ${printAction('打印印花信息单', 'PRINTING_INFO_SHEET', order)}
    ${printAction('打印印花确认单', 'PRINTING_CONFIRMATION', order)}
    ${actionButton('产出卷条码', 'open-barcodes', order)}
    ${actionButton('日志', 'logs', order)}
    ${actionButton('编辑信息', 'edit-info', order)}${actionButton(order.remark ? '查看备注' : '备注', 'remarks', order)}${cancel}
  </div>`
}

function renderInputMaterial(order: PrintingWorkOrderBusinessRecord): string {
  const material = printingInputIdentity(order)
  return `<div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="text-muted-foreground">${material.identityLabel}</p><p class="line-clamp-2 font-medium" title="${escapeHtml(material.materialName)}">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p>物料类型：${escapeHtml(material.objectType)}</p><p>成分：${escapeHtml(material.composition || '资料待补充')}</p><p>${escapeHtml(printingSpecification(material))}</p></div></div>`
}
function renderOrderProduct(order: PrintingWorkOrderBusinessRecord): string {
  if (order.demandSource.type === 'STOCK') {
    const actual = printingInputIdentity(order)
    const material = actual.identityLabel === '实际投入' && actual.imageUrl ? actual : { ...order.plannedInput, identityLabel: '计划备货物料' }
    return `<div class="space-y-1"><p class="font-medium">备货物料</p><div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p class="text-muted-foreground">${material.identityLabel}</p></div></div>${order.historicalInputQuantityUnknown ? '<p class="text-amber-700">实际投入待补录</p>' : ''}</div>`
  }
  return `<div class="flex gap-2">${imageButton(order.product, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2 font-medium" title="${escapeHtml(order.product.productName)}">${escapeHtml(order.product.productName)}</p><p class="truncate" title="${escapeHtml(order.product.spu)}">${escapeHtml(order.product.spu)}</p></div></div>`
}

function renderPattern(pattern: PrintingWorkOrderBusinessRecord['requirement']['frontPattern'], label: string): string {
  return `<div class="flex gap-2">${imageButton(pattern, 'h-10 w-10')}<div class="min-w-0"><p class="text-muted-foreground">${label}</p><p>${escapeHtml(printingPatternLabel(pattern.patternNo))}</p><p>${escapeHtml(pattern.patternVersion || '版本待确认')}</p></div></div>`
}

function renderArtworkTaskOutput(order: PrintingWorkOrderBusinessRecord): string {
  if (!order.professionalResultAttachments.length) return ''
  const imageCount = order.professionalResultAttachments.filter(file => file.mimeType.startsWith('image/')).length
  const fileCount = order.professionalResultAttachments.length - imageCount
  return `<div class="space-y-2 border-t pt-2"><p class="font-medium text-slate-600">花型任务产出 · ${imageCount} 张图 / ${fileCount} 个文件</p><div class="grid gap-2">${order.professionalResultAttachments.map(file => `<div class="flex items-center gap-2">${file.mimeType.startsWith('image/') ? imageButton({ imageUrl: file.dataUrl, imageAlt: file.fileName }, 'h-10 w-10') : '<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-slate-50 text-[10px]">文件</span>'}<span class="min-w-0 truncate" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span></div>`).join('')}</div></div>`
}

const columns: StandardListColumn<PrintingWorkOrderBusinessRecord>[] = [
  { key: 'selection', title: '选择', width: 72, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.workOrderId), selectedWorkOrderIds, EVENT_PREFIX), render: order => `<input type="checkbox" aria-label="选择 ${escapeHtml(order.printOrderNo)}" data-printing-action="toggle-select" data-work-order-id="${escapeHtml(order.workOrderId)}" ${selectedWorkOrderIds.has(order.workOrderId) ? 'checked' : ''}>` },
  { key: 'order', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true, sortValue: order => order.printOrderNo,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="space-y-1 pb-2"><p>加工厂：${escapeHtml(order.printFactoryName || '待分配')}</p>${renderPrintingDemandSource(order)}<p>印花加工单：<a class="font-semibold text-blue-700" href="${buildPrintingWorkOrderDetailLink(order.workOrderId)}" data-nav="${buildPrintingWorkOrderDetailLink(order.workOrderId)}">${escapeHtml(order.printOrderNo)}</a></p><p>任务单：${escapeHtml(order.taskNo)}</p>${order.productionDemandId ? `<p>生产需求单：${escapeHtml(order.productionDemandId)}</p>` : ''}<p>生产单：${escapeHtml(order.matchedProductionOrderNo || order.demandSource.productionOrderNo || '待匹配')}</p>${order.matchStatus ? `<div>${statusBadge(order.matchStatusLabel, order.matchStatus === 'MATCHED' ? 'green' : order.matchStatus === 'MATCH_FAILED' ? 'red' : order.matchStatus === 'CANCELLED' ? 'slate' : 'amber')}</div>` : ''}<p>售卖类型：${escapeHtml(order.salesType || '不适用')}</p><p>创建方式：${escapeHtml(order.creationMethod || '历史未记录')}</p></div><div class="py-2">${renderOrderProduct(order)}</div><div class="flex flex-wrap gap-1 pt-2">${printingIsOverdue(order) ? statusBadge('超期', 'red') : ''}${order.historicalSupplement || order.demandSource.supplementOrderNo || order.demandSource.type === 'SUPPLEMENT' ? statusBadge('补料', 'amber') : ''}${order.inputChanges.length ? statusBadge('已换料', 'amber') : ''}</div></div>` },
  { key: 'input', title: '加工投入／上游', freezeable: true, width: 250, required: true, sortable: true, sortValue: order => order.plannedInput.sku,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="pb-2">${renderInputMaterial(order)}</div><div class="pt-2">${renderPrintingRelations(order, 'upstream')}</div></div>` },
  { key: 'requirement', title: '加工要求', freezeable: true, width: 290, sortable: true, sortValue: order => order.requirement.craftName,
    render: order => `<div class="space-y-2 text-xs"><p>工艺：<strong>${escapeHtml(order.requirement.craftName || '待确认')}</strong></p><p>加工方式：${escapeHtml(order.requirement.type || '待确认')}</p><p>印花面别：${escapeHtml(order.requirement.printSide)}</p>${order.professionalTaskNo ? `<p>花型任务：${escapeHtml(order.professionalTaskNo)}</p>` : ''}${order.professionalResultVersion ? `<p>花型成果：${escapeHtml(order.professionalResultId || '成果')} · ${escapeHtml(order.professionalResultVersion)}</p>` : ''}${typeof order.estimatedUnitConsumption === 'number' ? `<p>预估单耗：${order.estimatedUnitConsumption}</p>` : ''}${typeof order.estimatedLossRate === 'number' ? `<p>损耗率：${(order.estimatedLossRate * 100).toFixed(2)}%</p>` : ''}${order.matchFailureReason ? `<p class="text-red-700">${escapeHtml(order.matchFailureReason)}</p>` : ''}${order.requirement.shade ? `<p>深浅：${escapeHtml(order.requirement.shade)}</p>` : ''}${order.requirement.temperature ? `<p>温度：${escapeHtml(order.requirement.temperature)}</p>` : ''}<p>设备：${escapeHtml(order.printerNo || '尚未安排')}</p>${renderArtworkTaskOutput(order)}<div class="space-y-2 border-t pt-2">${renderPattern(order.requirement.frontPattern, '正面花型')}${order.requirement.printSide === '双面' ? order.requirement.insidePattern ? renderPattern(order.requirement.insidePattern, '反面花型') : '<p class="text-amber-700">反面花型待补充</p>' : ''}</div></div>` },
  { key: 'progress', title: '处理进度', freezeable: true, width: 150, required: true,
    render: order => `<div class="space-y-2 text-xs"><p>接收 ${order.historicalInputQuantityUnknown ? statusBadge('历史待补录', 'amber') : receiptBadge(order.receiptStatus)}</p><p>加工 ${processingBadge(order.processingStatus)}</p><p class="text-muted-foreground">${escapeHtml(printingProductionStage(order))}</p><p>交出 ${handoverBadge(order.handoverStatus)}</p>${order.confirmedReceiptDifference || order.handover.objectionQty ? statusBadge('接收差异', 'amber') : ''}</div>` },
  { key: 'output', title: '加工产出／下游', freezeable: true, width: 250, required: true, sortable: true, sortValue: order => order.output.sku,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="flex gap-2 pb-2">${imageButton(order.output, 'h-10 w-10')}<div class="min-w-0"><p class="font-medium">${escapeHtml(order.output.materialName)}</p><p class="break-all text-muted-foreground">${escapeHtml(printingMaterialCode(order.output.sku, true))}</p><p>物料类型：${escapeHtml(order.output.objectType)}</p><p>成分：${escapeHtml(order.output.composition || '资料待补充')}</p><p>${escapeHtml(printingSpecification(order.output))}</p></div></div><div class="pt-2">${order.matchStatus && order.matchStatus !== 'MATCHED' ? '<p class="font-medium text-slate-500">下游</p><p class="mt-1 text-amber-700">待匹配生产单后确认下游</p>' : renderPrintingRelations(order, 'downstream')}</div></div>` },
  { key: 'time', title: '时间', freezeable: true, width: 250, sortable: true, sortValue: order => order.orderedAt, render: renderPrintingWorkOrderTimes },
  { key: 'quantity', title: '数量', freezeable: true, width: 210, sortable: true, sortValue: order => order.plannedInput.plannedQty, render: renderPrintingQuantityGroups },
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
    && (!state.matchStatus || order.matchStatus === state.matchStatus)
  ))
}

function rowsBeforeMatchStatus(): PrintingWorkOrderBusinessRecord[] {
  const previous = state.matchStatus
  state.matchStatus = ''
  const rows = filteredRows()
  state.matchStatus = previous
  return rows
}

function renderMatchTabs(): string {
  const rows = rowsBeforeMatchStatus()
  const tabs: Array<['' | ProductionDemandProcessMatchStatus, string]> = [['', '全部'], ...Object.entries(PRODUCTION_DEMAND_PROCESS_MATCH_LABEL) as Array<[ProductionDemandProcessMatchStatus, string]>]
  return `<div role="tablist" aria-label="提前加工单匹配状态" class="mb-3 flex flex-wrap gap-2">${tabs.map(([value,label]) => `<button type="button" role="tab" aria-selected="${state.matchStatus === value}" class="h-9 rounded-md border px-3 text-sm ${state.matchStatus === value ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'bg-white text-slate-600'}" data-printing-work-orders-action="match-tab" data-match-status="${value}" data-skip-page-rerender="true">${escapeHtml(label)} <span class="ml-1 tabular-nums">${value ? rows.filter(row => row.matchStatus === value).length : rows.length}</span></button>`).join('')}</div>`
}

function renderCreateDialog(): string {
  if (!state.createOpen) return ''
  const candidates = listEarlyProcessCreateCandidates('PRINT')
  const defaultCandidate = candidates.find(item => item.eligible) || candidates[0]
  const demandId = candidates.some(item => item.demand.demandId === state.createDemandId) ? state.createDemandId : defaultCandidate?.demand.demandId
  const demandCandidates = candidates.filter(item => item.demand.demandId === demandId)
  const candidate = demandCandidates.find(item => item.professionalTaskId === state.createProfessionalTaskId) || demandCandidates.find(item => item.eligible) || demandCandidates[0]
  if (!candidate) return ''
  state.createDemandId = candidate.demand.demandId
  state.createProfessionalTaskId = candidate.professionalTaskId
  const planned = candidate.eligible ? calculateEarlyProcessPlannedQty(candidate.demand.requiredQtyTotal, candidate.defaultUnitConsumption, candidate.defaultLossRate) : 0
  const demandOptions = [...new Map(candidates.map(item => [item.demand.demandId, item])).values()].map(item => `<option value="${escapeHtml(item.demand.demandId)}" ${item.demand.demandId === candidate.demand.demandId ? 'selected' : ''}>${escapeHtml(item.demand.demandId)} · ${escapeHtml(item.demand.spuName)}</option>`).join('')
  const taskOptions = demandCandidates.map(item => `<option value="${escapeHtml(item.professionalTaskId)}" ${item.professionalTaskId === candidate.professionalTaskId ? 'selected' : ''} ${item.eligible ? '' : 'disabled'}>${escapeHtml(item.professionalTaskNo)} · ${escapeHtml(item.professionalResultVersion)}${item.eligible ? '' : `（${escapeHtml(item.ineligibleReason || '不可创建')}）`}</option>`).join('')
  const attachments = candidate.professionalResultAttachments.map(file => `<article class="flex min-w-0 items-center gap-3 rounded border p-2">${file.mimeType.startsWith('image/') ? imageButton({ imageUrl: file.dataUrl, imageAlt: file.fileName }, 'h-12 w-12') : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-600">文件</span>'}<div class="min-w-0"><p class="truncate text-sm font-medium">${escapeHtml(file.fileName)}</p><p class="text-xs text-slate-500">${escapeHtml(file.mimeType)} · ${(file.sizeBytes / 1024).toFixed(0)} KB</p></div></article>`).join('')
  const imageCount = candidate.professionalResultAttachments.filter(file => file.mimeType.startsWith('image/')).length
  const fileCount = candidate.professionalResultAttachments.length - imageCount
  return `<div class="fixed inset-0 z-[120] flex items-center justify-center p-4" data-early-create-dialog><button type="button" class="absolute inset-0 bg-slate-950/55" data-printing-work-orders-action="close-create" data-skip-page-rerender="true" aria-label="关闭"></button><section class="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="text-lg font-semibold">新增印花加工单</h2><p class="mt-1 text-xs text-slate-500">手动选择生产准备花型任务；加工厂创建时必选，下游由正式生产单匹配后确认。</p></div><button type="button" class="rounded border px-3 py-1.5 text-sm" data-printing-work-orders-action="close-create" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5">${state.createError ? `<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.createError)}</p>` : ''}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm">生产需求单<select class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-demand-id">${demandOptions}</select></label><label class="text-sm">花型任务<select class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-professional-task-id">${taskOptions}</select></label><div class="rounded border p-3 text-sm"><div class="flex gap-3">${imageButton({ imageUrl: candidate.demand.imageUrl, imageAlt: candidate.demand.spuName }, 'h-12 w-12')}<div><p class="font-semibold">${escapeHtml(candidate.demand.spuName)}</p><p>${escapeHtml(candidate.demand.spuCode)}</p><p>需求：${candidate.demand.requiredQtyTotal.toLocaleString('zh-CN')} 件</p></div></div></div><div class="rounded border p-3 text-sm"><p class="font-semibold">${escapeHtml(candidate.professionalTaskNo)}</p><p>花型任务产出：${imageCount} 张花型图 · ${fileCount} 个花型文件</p><p>成果：${escapeHtml(candidate.professionalResultId)} · ${escapeHtml(candidate.professionalResultVersion)}</p><p>审核：${candidate.eligible ? `${escapeHtml(candidate.professionalResultApprovedBy)} · ${escapeHtml(candidate.professionalResultApprovedAt)}` : escapeHtml(candidate.ineligibleReason || '待审核')}</p></div><div class="md:col-span-2"><p class="mb-2 text-sm font-medium">花型图、花型文件与任务产出（${candidate.professionalResultAttachments.length}）</p><div class="grid gap-2 md:grid-cols-2">${attachments}</div></div><label class="text-sm">投入 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-input-sku" value="${escapeHtml(candidate.defaultInputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">印花后产出 SKU<input class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-output-sku" value="${escapeHtml(candidate.defaultOutputSku)}" data-skip-page-rerender="true"></label><label class="text-sm">物料名称<input class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-material-name" value="${escapeHtml(candidate.defaultMaterialName)}" data-skip-page-rerender="true"></label><label class="text-sm">目标颜色<input class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-target-color" value="${escapeHtml(candidate.defaultTargetColor)}" data-skip-page-rerender="true"></label><label class="text-sm">预估单耗<input type="number" min="0.01" step="0.01" class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-unit-consumption" value="${candidate.defaultUnitConsumption}" data-skip-page-rerender="true"></label><label class="text-sm">损耗率（%）<input type="number" min="0" step="0.1" class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-loss-rate" value="${candidate.defaultLossRate * 100}" data-skip-page-rerender="true"></label><label class="text-sm">加工厂（必选）<select required class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-factory" data-skip-page-rerender="true"><option value="" selected disabled>请选择加工厂</option>${listPrintingFactoryOptions(listRows()).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="text-sm">计划完成日期<input type="date" class="mt-1 h-10 w-full rounded border px-3" data-printing-work-orders-field="create-finish" value="${escapeHtml(candidate.demand.requiredDeliveryDate || '')}" data-skip-page-rerender="true"></label><p class="md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">下游接收方：待匹配正式生产单后确认</p></div><div class="rounded-lg bg-blue-50 px-4 py-3 text-sm"><span class="text-slate-600">计划加工数量：</span><strong data-early-planned-qty>${planned.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${escapeHtml(candidate.defaultQtyUnit)}</strong><p class="mt-1 text-xs text-slate-500">需求数量 × 预估单耗 ×（1 + 损耗率）</p></div></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button type="button" class="rounded border px-4 py-2 text-sm" data-printing-work-orders-action="close-create" data-skip-page-rerender="true">取消</button><button type="button" class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-printing-work-orders-action="submit-create" data-skip-page-rerender="true">创建印花加工单</button></footer></section></div>`
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
  const advancedCount = [state.demandSource,state.salesType,state.craft,state.upstream,state.receiver,state.materialType,state.changedInput,state.creationMethod,state.hasDifference,state.dateStart,state.dateEnd,state.exception,state.supplement,state.printSide,state.stage,state.printer,state.artwork,state.timeType === 'ORDERED' ? '' : state.timeType].filter(Boolean).length
  return `<section class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-printing-work-orders-field="keyword" value="${escapeHtml(state.keyword)}" placeholder="单号、商品、物料或花型"></label>
    ${selectField('接收状态', 'receiptStatus', state.receiptStatus, [['', '全部'], ...PRINTING_RECEIPT_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工状态', 'processingStatus', state.processingStatus, [['', '全部'], ...PRINTING_PROCESSING_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('交出状态', 'handoverStatus', state.handoverStatus, [['', '全部'], ...PRINTING_HANDOVER_STATUSES.map((item) => [item.value, item.label] as [string, string])])}
    ${selectField('加工厂', 'factory', state.factory, [['', '全部'], ...listPrintingFactoryOptions(rows).map(factory => [factory.id, factory.name] as [string, string])])}
  </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${selectField('上游供料方', 'upstream', state.upstream, uniqueOptions(rows.flatMap(printingUpstreamNames)))}
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
  return `<div class="mb-3 flex items-end gap-3 border-b bg-slate-50 px-2 pt-2"><div role="tablist" aria-label="加工厂切换" class="flex min-w-0 flex-1 flex-wrap items-end gap-1">${directTabs}${moreTab}</div><button class="mb-2 h-9 shrink-0 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white" data-printing-work-orders-action="open-create" data-skip-page-rerender="true">新增印花加工单</button></div>`
}

function renderPageActions(): string {
  return `<div class="flex flex-wrap items-center justify-end gap-2"><button class="h-9 rounded-md border px-3 text-sm" data-printing-action="open-dispatch-pending" data-skip-page-rerender="true">待交出列表</button><button class="h-9 rounded-md border px-3 text-sm" data-printing-action="open-dispatch-documents" data-skip-page-rerender="true">交出单据</button>${renderBatchPrintAction()}</div>`
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const rows = filteredRows()
  const view = listController.getView(rows)
  return renderStandardListPage({
    title: '印花加工单',
    showHeader: false,
    filtersHtml: `<div data-printing-work-orders-filters-surface>${renderFactoryTabs()}<div class="mb-3 flex justify-end">${renderPageActions()}</div>${renderMatchTabs()}${renderFilters()}</div>`,
    statsHtml: `<div data-printing-work-orders-stats-surface>${renderStats(rows)}</div>`,
    listTitle: `共 ${rows.length} 条 · 已选 ${selectedWorkOrderIds.size} 条`,
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings', skipPageRerender: true }, 'settings-2'),
    feedbackHtml: `<div data-printing-work-orders-feedback-surface>${state.feedback ? `<p class="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(state.feedback)}</p>` : ''}${drilldownOrderIds ? `<p class="mb-2 text-xs text-blue-700">统计下钻：已限定 ${drilldownOrderIds.size} 张加工单，重置可解除。</p>` : ''}</div>`,
    tableHtml: `<div data-printing-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-printing-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-printing-work-orders-overlays-surface>${listController.renderColumnSettings()}${renderCreateDialog()}</div>`,
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
  state.keyword = ''; state.receiptStatus = ''; state.processingStatus = ''; state.handoverStatus = ''; state.demandSource = ''; state.salesType = ''; state.factory = ''; state.craft = ''; state.upstream = ''; state.receiver = ''; state.exception = ''; state.materialType = ''; state.changedInput = ''; state.creationMethod = ''; state.hasDifference = ''; state.supplement = ''; state.printSide = ''; state.stage = ''; state.printer = ''; state.artwork = ''; state.timeType = 'ORDERED'; state.dateStart = ''; state.dateEnd = ''; state.currentPage = 1; state.matchStatus = ''
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
  if (field?.dataset.printingWorkOrdersField === 'create-demand-id') { state.createDemandId = field.value; state.createProfessionalTaskId = ''; state.createError = ''; refreshPrintingWorkOrderListPage(false); return true }
  if (field?.dataset.printingWorkOrdersField === 'create-professional-task-id') { state.createProfessionalTaskId = field.value; state.createError = ''; refreshPrintingWorkOrderListPage(false); return true }
  if (field?.dataset.printingWorkOrdersField === 'create-unit-consumption' || field?.dataset.printingWorkOrdersField === 'create-loss-rate') {
    const candidate = listEarlyProcessCreateCandidates('PRINT').find(item => item.professionalTaskId === (root.querySelector<HTMLSelectElement>('[data-printing-work-orders-field="create-professional-task-id"]')?.value || state.createProfessionalTaskId))
    const output = root.querySelector<HTMLElement>('[data-early-planned-qty]')
    if (candidate && output) {
      try { output.textContent = `${calculateEarlyProcessPlannedQty(candidate.demand.requiredQtyTotal, Number(root.querySelector<HTMLInputElement>('[data-printing-work-orders-field="create-unit-consumption"]')?.value), Number(root.querySelector<HTMLInputElement>('[data-printing-work-orders-field="create-loss-rate"]')?.value) / 100).toLocaleString('zh-CN',{maximumFractionDigits:2})} ${candidate.defaultQtyUnit}` }
      catch { output.textContent = '请填写有效的单耗和损耗率' }
    }
    return true
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
  if (action === 'match-tab') { state.matchStatus = (actionNode.dataset.matchStatus || '') as typeof state.matchStatus; selectedWorkOrderIds.clear(); state.currentPage = 1; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'open-create') { state.createOpen = true; state.createError = ''; state.feedback = ''; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'close-create') { state.createOpen = false; state.createError = ''; refreshPrintingWorkOrderListPage(false); return true }
  if (action === 'submit-create') {
    const get = (name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-printing-work-orders-field="${name}"]`)
    try {
      const factory = listPrintingFactoryOptions(listRows()).find(item => item.id === get('create-factory')?.value)
      const result = createProductionDemandEarlyProcessWorkOrder({ processCode: 'PRINT', productionDemandId: get('create-demand-id')?.value || state.createDemandId, professionalTaskId: get('create-professional-task-id')?.value || state.createProfessionalTaskId, inputMaterialSkuCode: get('create-input-sku')?.value || '', outputMaterialSkuCode: get('create-output-sku')?.value || '', materialName: get('create-material-name')?.value || '', materialImageUrl: '/materials/fei-ticket/blue-white-print-cotton.png', targetColor: get('create-target-color')?.value || '', estimatedUnitConsumption: Number(get('create-unit-consumption')?.value), estimatedLossRate: Number(get('create-loss-rate')?.value) / 100, qtyUnit: '米', plannedFinishAt: get('create-finish')?.value || undefined, factoryId: factory?.id || '', factoryName: factory?.name || '', operatorName: '管理员', operatorRole: '管理员' })
      state.createOpen = false; state.createError = ''; state.feedback = `已创建 ${result.workOrderNo}，计划加工 ${result.plannedQty.toLocaleString('zh-CN')} ${result.qtyUnit}。`; listSnapshot = undefined; refreshPrintingWorkOrderListPage(false)
    } catch (error) { state.createError = error instanceof Error ? error.message : '创建失败，请检查填写内容'; refreshPrintingWorkOrderListPage(false) }
    return true
  }
  if (action === 'cancel-early') {
    const reason = typeof window === 'undefined' ? '' : window.prompt('请输入取消原因（历史记录会保留）：') || ''
    if (!reason.trim()) return true
    if (typeof window !== 'undefined' && !window.confirm('确认取消这张未完成的提前印花加工单？')) return true
    try { cancelProductionDemandPrintWorkOrder(actionNode.dataset.workOrderId || '', { operatorName: '管理员', operatorRole: '管理员', reason }); state.feedback = '提前印花加工单已取消，历史和匹配记录已保留。'; listSnapshot = undefined; refreshPrintingWorkOrderListPage(false) }
    catch (error) { state.feedback = error instanceof Error ? error.message : '取消失败'; refreshPrintingWorkOrderListPage(false) }
    return true
  }
  if (action === 'factory-tab') { state.factory = actionNode.dataset.factory || ''; selectedWorkOrderIds.clear(); state.currentPage = 1; refreshPrintingWorkOrderListPage(false); return true }
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
