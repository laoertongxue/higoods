import { openDyeOutput, handleDyeOutputEvent } from './output-documents.ts'
import { syncProcessSelectionHeader, renderProcessOrderStats, renderProcessSelectionHeader, renderProcessFilterToggle, handleProcessFilterPresentation } from '../../../components/ui/process-order-list-presentation.ts'
// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderInput } from '../../../components/ui/form.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS,
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
  type DyeWorkOrderOnlineFilters,
  type DyeWorkOrderOnlineRow,
} from '../../../data/fcs/dye-work-order-online-view.ts'
import {
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderHighRiskStatusChange,
  updateDyeWorkOrderFromPfos,
  type DyeWorkOrderPfosEditInput,
} from '../../../data/fcs/dye-work-order-online-domain.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from '../../../data/fcs/process-order-flow-contract.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceType,
} from '../../../data/fcs/process-work-order-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  readDyeWorkOrderEditInput,
  renderDyeWorkOrderOverlay,
  type DyeWorkOrderOverlayState,
} from './work-order-overlays.ts'

const EVENT_PREFIX = 'dye-work-orders'
const PREFERENCE_KEY = '/fcs/craft/dyeing/work-orders:list-columns-v2'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  rowsSnapshot: DyeWorkOrderOnlineRow[] | null
  filters: DyeWorkOrderOnlineFilters
  selectedIds: Set<string>
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlay: DyeWorkOrderOverlayState
  pendingEditInput: DyeWorkOrderPfosEditInput | null
} = {
  currentPage: 1,
  rowsSnapshot: null,
  filters: { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] },
  selectedIds: new Set(),
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['dyeInfo'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  overlay: null,
  pendingEditInput: null,
}

let columnDragEventsInstalled = false
let draggedColumnKey = ''

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function formatDifference(value: number, unit: string): string {
  if (value > 0) return `多 ${formatQty(value, unit)}`
  if (value < 0) return `少 ${formatQty(Math.abs(value), unit)}`
  return '一致'
}

function pendingDyeQty(row: DyeWorkOrderOnlineRow): number {
  if (['染色完成', '待审核', '部分入库', '待人工完单', '已完成', '取消'].includes(row.status)) return 0
  return Math.max(0, row.plannedQty - row.completedQty)
}

function renderListImage(url: string, alt: string): string {
  return `<button type="button" class="relative h-10 w-10 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function axisTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success'
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger'
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info'
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning'
  return 'neutral'
}

function detailButton(row: DyeWorkOrderOnlineRow, text: string): string {
  return `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-dye-work-orders-action="view" data-id="${escapeHtml(row.dyeOrderId)}">${escapeHtml(text)}</button>`
}
function renderActions(row: DyeWorkOrderOnlineRow): string {
  return `<div class="grid grid-cols-2 gap-x-1 gap-y-0.5">${['查看','编辑','日志','打印流程卡','打印条码'].map((label,index) => `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-dye-work-orders-action="${['view','edit','logs','print-one','barcodes'][index]}" data-id="${escapeHtml(row.dyeOrderId)}">${label}</button>`).join('')}</div>`
}

const columns: StandardListColumn<DyeWorkOrderOnlineRow>[] = [
  { key: 'selection', title: '选择', width: 72, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.dyeOrderId), state.selectedIds, EVENT_PREFIX), render: row => `<input aria-label="选择 ${escapeHtml(row.workOrderNo)}" type="checkbox" ${state.selectedIds.has(row.dyeOrderId) ? 'checked' : ''} data-dye-work-orders-action="toggle-selection" data-id="${escapeHtml(row.dyeOrderId)}">` },
  {
    key: 'dyeInfo', title: '加工单／商品', width: 200, required: true, freezeable: true, sortable: true,
    sortValue: row => row.workOrderNo,
    render: row => `<div class="space-y-2"><div class="flex gap-2">${detailButton(row, row.workOrderNo)}</div><div class="flex gap-2">${renderListImage(row.productImageUrl, `${row.productCode} ${row.productName}`)}<div class="min-w-0"><div class="line-clamp-2 font-medium" title="${escapeHtml(row.productName)}">${escapeHtml(row.productName)}</div><div class="truncate text-xs text-muted-foreground" title="${escapeHtml(row.productCode)}">${escapeHtml(row.productCode)}</div><div class="text-xs">${escapeHtml(row.sourceLabel)} · ${escapeHtml(row.productionOrderNo || row.purchaseOrderNo)}</div></div></div>${row.isOverdue ? renderBadge('超期', 'danger') : ''}${row.isReplenishment ? renderBadge('补料', 'warning') : ''}</div>`,
  },
  {
    key: 'material', title: '加工投入／上游', width: 235, required: true, freezeable: true, sortable: true,
    sortValue: row => row.rawMaterialSku,
    render: row => `<div class="space-y-1 text-xs"><div class="flex gap-2">${renderListImage(row.materialImageUrl, row.materialName)}<div class="min-w-0"><div class="font-medium line-clamp-2">${escapeHtml(row.materialName)}</div>${row.rawMaterialSku !== row.materialName && !/[\u4e00-\u9fff]/.test(row.rawMaterialSku) ? `<div class="truncate text-muted-foreground" title="${escapeHtml(row.rawMaterialSku)}">${escapeHtml(row.rawMaterialSku)}</div>` : ''}</div></div><div>上游：${escapeHtml(row.upstreamName)}</div>${detailButton(row, row.receiptRecords.length ? `供料记录 ${row.receiptRecords.length} 笔` : row.inputSourceDocumentNos[0] || '来源单据待生成')}<div>计划 ${formatQty(row.plannedQty, row.qtyUnit)} · 已收 ${row.receiptKnown ? formatQty(row.receivedInputQty, row.qtyUnit) : '待补录'}</div><div>已用 ${row.usageKnown ? formatQty(row.rawMaterialQty, row.qtyUnit) : '待补录'}</div></div>`,
  },
  {
    key: 'requirement', title: '加工要求', width: 170, freezeable: true, sortable: true,
    sortValue: row => row.processName,
    render: row => `<div class="space-y-1 text-xs"><div class="font-medium">${escapeHtml(row.processName)}</div><div>目标颜色：${escapeHtml(row.colorNo)}</div><div class="text-amber-700">色样待补充</div></div>`,
  },
  {
    key: 'status', title: '处理进度', width: 132, required: true, freezeable: true,
    render: row => `<div class="space-y-2"><div><span class="mr-1 text-xs text-muted-foreground">接收</span>${renderBadge(row.receiptKnown ? row.receiptStatusLabel : '历史待补录', axisTone(row.receiptStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">加工</span>${renderBadge(row.processingStatusLabel, axisTone(row.processingStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">交出</span>${renderBadge(row.handoverStatusLabel, axisTone(row.handoverStatus))}</div></div>`,
  },
  {
    key: 'output', title: '加工产出／下游', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: row => row.completedQty,
    render: row => `<div class="space-y-1 text-xs"><div class="font-medium">目标颜色：${escapeHtml(row.colorNo)}</div><div class="text-amber-700">产出物料档案／实物图待补充</div><div>下道：${row.downstreamLinks.length ? row.downstreamLinks.map(item => item.href ? `<a class="text-blue-700 hover:underline" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` : escapeHtml(item.label)).join(' / ') : '下道工序待确定'}</div><div>接收单位：${escapeHtml(row.receiverName)}</div>${row.receiverWarehouseName && row.receiverWarehouseName !== row.receiverName ? `<div>接收仓：${escapeHtml(row.receiverWarehouseName)}</div>` : ''}<div>完成 ${formatQty(row.completedQty, row.qtyUnit)} · 已交 ${formatQty(row.handedOverQty, row.qtyUnit)}</div><div>下游已收 ${formatQty(row.downstreamReceivedQty, row.qtyUnit)}</div>${row.pendingInboundQty > 0 ? `<div class="text-amber-700">下游待接收 ${formatQty(row.pendingInboundQty, row.qtyUnit)}</div>` : ''}${detailButton(row, `交接记录 ${row.handoverRecords.length} 笔`)}</div>`,
  },
  {
    key: 'factoryTime', title: '工厂／交期', width: 155, freezeable: true, sortable: true,
    sortValue: row => row.plannedFinishAt,
    render: row => `<div class="space-y-1 text-xs"><div class="font-medium">${escapeHtml(row.factoryName || '待分配工厂')}</div><div>预计完成：${escapeHtml(row.plannedFinishAt || '待明确')}</div>${row.isOverdue ? renderBadge('已超期', 'danger') : ''}</div>`,
  },
  { key: 'actions', title: '操作', width: 176, required: true, actionColumn: true, render: renderActions },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map((column) => column.key),
    visibleKeys: columns.map((column) => column.key),
    frozenKeys: ['dyeInfo'],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultPreferences()
  state.preferences = typeof window === 'undefined' || typeof document === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, PAGE_SIZE_OPTIONS)
}

function option(value: string, current: string, label = value): string {
  return `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

function selectField(label: string, field: string, options: string[], current: string, className = 'min-w-0'): string {
  return `<label class="${className}"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="${escapeHtml(field)}">${options.map((value) => option(value, current, value || '全部')).join('')}</select></label>`
}

function sourceTypeSelectField(current: '' | ProcessWorkOrderSourceType): string {
  const options: Array<['' | ProcessWorkOrderSourceType, string]> = [
    ['', '全部'],
    ...Object.entries(PROCESS_WORK_ORDER_SOURCE_LABEL) as Array<[ProcessWorkOrderSourceType, string]>,
  ]
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">需求来源</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="sourceType">${options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`
}

function textField(label: string, field: string, value: string, placeholder = ''): string {
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-dye-work-orders-field="${escapeHtml(field)}"></label>`
}

function uniqueValues(rows: DyeWorkOrderOnlineRow[], getValue: (row: DyeWorkOrderOnlineRow) => string): string[] {
  return ['', ...new Set(rows.map(getValue).filter(Boolean))]
}

function axisStatusSelect<T extends string>(label: string, field: string, labels: Record<T, string>, current: '' | T): string {
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="${escapeHtml(field)}"><option value="">全部</option>${Object.entries(labels).map(([value, text]) => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(String(text))}</option>`).join('')}</select></label>`
}

function renderFilters(rows: DyeWorkOrderOnlineRow[]): string {
  const filters = state.filters
  const advancedCount = ['sourceType','upstreamName','receiverName','processName','materialType','colorNo','salesType','exception','startDate','endDate'].filter(key => Boolean(filters[key as keyof DyeWorkOrderOnlineFilters])).length + (filters.timeField !== 'orderedAt' ? 1 : 0)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    ${textField('综合查询', 'keyword', filters.keyword, '单号、商品、物料或交接单').replace('<label class="', '<label class="sm:col-span-2 ')}
    ${axisStatusSelect('接收状态', 'receiptStatus', PROCESS_ORDER_RECEIPT_STATUS_LABEL, filters.receiptStatus)}
    ${axisStatusSelect('加工状态', 'processingStatus', PROCESS_ORDER_PROCESSING_STATUS_LABEL, filters.processingStatus)}
    ${axisStatusSelect('交出状态', 'handoverStatus', PROCESS_ORDER_HANDOVER_STATUS_LABEL, filters.handoverStatus)}
    ${selectField('加工厂', 'factoryName', uniqueValues(rows, row => row.factoryName), filters.factoryName)}
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${sourceTypeSelectField(filters.sourceType)}
    ${selectField('上游供料方', 'upstreamName', uniqueValues(rows, row => row.upstreamName), filters.upstreamName)}
    ${selectField('下游接收方', 'receiverName', uniqueValues(rows, row => row.receiverName), filters.receiverName)}
    ${selectField('工艺', 'processName', uniqueValues(rows, row => row.processName), filters.processName)}
    ${selectField('物料类型', 'materialType', uniqueValues(rows, row => row.materialType), filters.materialType)}
    ${selectField('售卖类型', 'salesType', uniqueValues(rows, row => row.salesType), filters.salesType)}
    ${selectField('异常', 'exception', ['', '超期', '补料', '接收差异', '历史待补录'], filters.exception)}
    ${textField('目标颜色／色号', 'colorNo', filters.colorNo)}
    ${selectField('时间类型', 'timeField', ['orderedAt','plannedFinishAt','completedAt','deliveredAt'], filters.timeField).replace('>orderedAt<','>下单时间<').replace('>plannedFinishAt<','>预计完成<').replace('>completedAt<','>完成时间<').replace('>deliveredAt<','>交出时间<')}
    ${textField('开始日期', 'startDate', filters.startDate).replace('<input', '<input type="date"')}${textField('结束日期', 'endDate', filters.endDate).replace('<input', '<input type="date"')}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderProcessFilterToggle(advancedCount)}<details class="relative"><summary class="cursor-pointer whitespace-nowrap text-xs text-muted-foreground">专项导出</summary><div class="absolute left-0 top-full z-40 flex w-80 gap-2 rounded border bg-white p-2 shadow">${renderSecondaryButton('导出投入接收', { prefix: EVENT_PREFIX, action: 'export-preparation' })}${renderSecondaryButton('导出超期单', { prefix: EVENT_PREFIX, action: 'export-overdue' })}</div></details></div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderSummaryValue(items: Array<{ unit: string; qty: number }>): string {
  return items.some(item => item.qty !== 0) ? items.filter(item => item.qty !== 0).map((item) => `${item.qty.toLocaleString('zh-CN')} ${item.unit}`).join(' / ') : '0'
}

function renderDyeSummary(items: Array<{label: string; value: string | number}>): string {
  return renderProcessOrderStats(items)
}

function filteredRows(allRows: DyeWorkOrderOnlineRow[]): DyeWorkOrderOnlineRow[] {
  return filterDyeWorkOrderOnlineRows(allRows, state.filters)
}

// Query, selection and column preferences only reshape the current page data.
// Invalidate this page-local snapshot on route entry and successful data edits.
function currentRows(): DyeWorkOrderOnlineRow[] {
  return state.rowsSnapshot ??= listDyeWorkOrderOnlineRows()
}

function renderWorkspace(sourceOverride?: '' | ProcessWorkOrderSourceType): string {
  ensurePreferencesLoaded()
  const allRows = currentRows()
  const rows = sourceOverride === undefined
    ? filteredRows(allRows)
    : filterDyeWorkOrderOnlineRows(allRows, { ...state.filters, sourceType: sourceOverride })
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const summary = getDyeWorkOrderOnlineSummary(rows)
  return renderStandardListPage({
    title: '染色加工单',
    primaryActionsHtml: renderSecondaryButton('待交出列表', { prefix: EVENT_PREFIX, action: 'output-pending' }) + renderSecondaryButton('交出单据', { prefix: EVENT_PREFIX, action: 'output-documents' }) + renderPrimaryButton(`批量打印流程卡（${state.selectedIds.size}）`, { prefix: EVENT_PREFIX, action: 'batch-print' }, 'printer').replace('<button', `<button ${state.selectedIds.size ? '' : 'disabled'}`),
    filtersHtml: renderFilters(allRows),
    statsHtml: renderDyeSummary([
      { label: '加工单数', value: rows.length },
      { label: '计划投入', value: renderSummaryValue(summary.plannedQtyByUnit) },
      { label: '已接收', value: renderSummaryValue(summary.receivedQtyByUnit) },
      { label: '实际使用', value: renderSummaryValue(summary.rawMaterialQtyByUnit) },
      { label: '完成数量', value: renderSummaryValue(summary.completedQtyByUnit) },
      { label: '下游待接收', value: renderSummaryValue(summary.pendingQtyByUnit) },
    ]),
    listTitle: `共 ${rows.length} 条 · 已选 ${state.selectedIds.size} 条`,
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无染色加工单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '染色加工单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

export function renderCraftDyeingWorkOrdersPage(options: { sourceType?: '' | ProcessWorkOrderSourceType } = {}): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  state.rowsSnapshot = null
  syncOverlayFromLocation()
  installColumnDragEvents()
  return `<div data-dye-work-orders-root data-skip-page-rerender="true"><div data-dye-work-orders-workspace>${renderWorkspace(options.sourceType)}</div><div data-dye-work-orders-overlay>${state.overlay ? renderDyeWorkOrderOverlay(state.overlay) : ''}</div></div>`
}

function syncOverlayFromLocation(): void {
  if (state.overlay || typeof window === 'undefined') return
  const dyeOrderId = new URLSearchParams(window.location.search).get('dyeOrderId')
  if (dyeOrderId) state.overlay = { type: 'view', dyeOrderId }
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-dye-work-orders-root]')
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-dye-work-orders-workspace]')
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
  syncProcessSelectionHeader(region)
}

function refreshOverlay(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-dye-work-orders-overlay]')
  if (!region) return
  region.innerHTML = state.overlay ? renderDyeWorkOrderOverlay(state.overlay) : ''
  hydrateIcons(region)
}

function replaceDyeOrderQuery(dyeOrderId?: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (dyeOrderId) url.searchParams.set('dyeOrderId', dyeOrderId)
  else url.searchParams.delete('dyeOrderId')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function downloadCsv(kind: '全部' | '投入接收' | '超期未完结'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const rows = filteredRows(currentRows())
  const blob = new Blob([buildDyeWorkOrderCsv(rows, kind)], { type: 'text/csv;charset=utf-8' })
  const href = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `染色加工单-${kind}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(href)
}

function openFlowCard(ids: string[]): void {
  if (typeof window === 'undefined') return
  if (!ids.length) {
    window.alert('请先选择需要打印的染色加工单。')
    return
  }
  const href = `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=${encodeURIComponent(ids.join(','))}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

function closeOverlay(): void {
  state.overlay = null
  state.pendingEditInput = null
  replaceDyeOrderQuery()
  refreshOverlay()
}

function saveEdit(input: DyeWorkOrderPfosEditInput): void {
  const dyeOrderId = state.overlay?.dyeOrderId
  if (!dyeOrderId) return
  try {
    updateDyeWorkOrderFromPfos(dyeOrderId, input)
    state.rowsSnapshot = null
    closeOverlay()
    refreshWorkspace()
  } catch (error) {
    state.overlay = { type: 'edit', dyeOrderId, error: error instanceof Error ? error.message : '保存失败' }
    state.pendingEditInput = null
    refreshOverlay()
  }
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

function readField(root: HTMLElement, field: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-dye-work-orders-field="${field}"]`)?.value.trim() || ''
}

function readFilters(root: HTMLElement): DyeWorkOrderOnlineFilters {
  const keywordFieldLabel = readField(root, 'keywordField')
  const keywordFieldMap: Record<string, DyeWorkOrderOnlineFilters['keywordField']> = { 全部: 'all', 加工单号: 'workOrderNo', 任务单号: 'taskNo', 生产单号: 'productionOrderNo', 采购单号: 'purchaseOrderNo', 商品编码: 'productCode' }
  return {
    ...state.filters,
    keywordField: keywordFieldMap[keywordFieldLabel] || 'all',
    keyword: readField(root, 'keyword'),
    upstreamName: readField(root, 'upstreamName'),
    exception: readField(root, 'exception'),
    timeField: (readField(root, 'timeField') || 'orderedAt') as DyeWorkOrderOnlineFilters['timeField'],
    startDate: readField(root, 'startDate'),
    endDate: readField(root, 'endDate'),
    statuses: [],
    receiptStatus: readField(root, 'receiptStatus') as '' | ProcessOrderReceiptStatus,
    processingStatus: readField(root, 'processingStatus') as '' | ProcessOrderProcessingStatus,
    handoverStatus: readField(root, 'handoverStatus') as '' | ProcessOrderHandoverStatus,
    salesType: readField(root, 'salesType'),
    factoryName: readField(root, 'factoryName'),
    processName: readField(root, 'processName'),
    receiverName: readField(root, 'receiverName'),
    sourceType: readField(root, 'sourceType') as DyeWorkOrderOnlineFilters['sourceType'],
    yarn: (readField(root, 'yarn') || '全部') as DyeWorkOrderOnlineFilters['yarn'],
    replenishment: (readField(root, 'replenishment') || '全部') as DyeWorkOrderOnlineFilters['replenishment'],
    gtgInStock: (readField(root, 'gtgInStock') || '全部') as DyeWorkOrderOnlineFilters['gtgInStock'],
    materialType: readField(root, 'materialType'),
    colorNo: readField(root, 'colorNo'),
    composition: readField(root, 'composition'),
    width: readField(root, 'width'),
    weightGsm: readField(root, 'weightGsm'),
  }
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find((item) => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) visibleKeys = visibleKeys.includes(columnKey) ? visibleKeys.filter((key) => key !== columnKey) : [...visibleKeys, columnKey]
  if (action === 'toggle-column-freeze' && column.freezeable) frozenKeys = frozenKeys.includes(columnKey) ? frozenKeys.filter((key) => key !== columnKey) : [...frozenKeys, columnKey]
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, PAGE_SIZE_OPTIONS)
  persistPreferences()
  refreshWorkspace()
}

function installColumnDragEvents(): void {
  if (columnDragEventsInstalled || typeof document === 'undefined') return
  columnDragEventsInstalled = true
  document.addEventListener('dragstart', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dye-work-orders-root] [data-standard-list-column-drag]') : null
    if (!target) return
    draggedColumnKey = target.dataset.dragSource || ''
    event.dataTransfer?.setData('text/plain', draggedColumnKey)
  })
  document.addEventListener('dragover', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-dye-work-orders-root] [data-drop-target]')) event.preventDefault()
  })
  document.addEventListener('drop', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dye-work-orders-root] [data-drop-target]') : null
    const sourceKey = draggedColumnKey || event.dataTransfer?.getData('text/plain') || ''
    const targetKey = target?.dataset.dropTarget || ''
    draggedColumnKey = ''
    if (!sourceKey || !targetKey || sourceKey === targetKey) return
    const regularOrder = state.preferences.order.filter((key) => key !== 'actions' && key !== sourceKey)
    const targetIndex = regularOrder.indexOf(targetKey)
    if (targetIndex < 0) return
    event.preventDefault()
    regularOrder.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, order: [...regularOrder, 'actions'] }, PAGE_SIZE_OPTIONS)
    persistPreferences()
    refreshWorkspace()
  })
}

export function handleDyeWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-dye-work-orders-root]')
  if (!root) return false
  if (handleDyeOutputEvent(target)) {
    if (target.closest<HTMLElement>('[data-dye-output-action]')?.dataset.dyeOutputAction === 'confirm') { state.rowsSnapshot = null; refreshWorkspace() }
    return true
  }
  const outputAction = target.closest<HTMLElement>('[data-dye-work-orders-action]')
  const outputKey = outputAction?.dataset.dyeWorkOrdersAction
  if (outputKey === 'barcodes' || outputKey === 'output-pending' || outputKey === 'output-documents') { openDyeOutput(outputKey === 'barcodes' ? 'barcodes' : outputKey === 'output-pending' ? 'pending' : 'documents', outputAction?.dataset.id); return true }
  if (handleProcessFilterPresentation(root, target)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-dye-work-orders-field]')
  if (field?.dataset.dyeWorkOrdersField === 'selection-scope') {
    const scope = field.value
    if (!scope) return true
    const rows = sortStandardListRows(filteredRows(currentRows()), state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
    if (scope === 'clear') state.selectedIds.clear()
    else (scope === 'page' ? paginateStandardListRows(rows, state.currentPage, state.preferences.pageSize).rows : rows).forEach(row => state.selectedIds.add(row.dyeOrderId))
    refreshWorkspace(); return true
  }
  if (field?.dataset.dyeWorkOrdersField === 'pageSize') {
    const pageSize = Number(field.value)
    state.preferences = { ...state.preferences, pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10 }
    state.currentPage = 1
    persistPreferences()
    refreshWorkspace()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-dye-work-orders-action]')
  if (!actionNode) return Boolean(field)
  const action = actionNode.dataset.dyeWorkOrdersAction || ''
  if (action === 'view' || action === 'edit' || action === 'logs') {
    const dyeOrderId = actionNode.dataset.id || ''
    if (!dyeOrderId) return true
    state.overlay = { type: action, dyeOrderId, ...(action === 'logs' ? { logPage: 1 } : {}) }
    state.pendingEditInput = null
    replaceDyeOrderQuery(dyeOrderId)
    refreshOverlay()
    return true
  }
  if (action === 'close-overlay') { closeOverlay(); return true }
  if (action === 'save-edit') {
    const dyeOrderId = state.overlay?.dyeOrderId
    if (!dyeOrderId) return true
    try {
      const input = readDyeWorkOrderEditInput(root)
      const current = getDyeWorkOrderOnlineRecord(dyeOrderId)
      if (isDyeWorkOrderHighRiskStatusChange(current.status, input.status)) {
        state.pendingEditInput = input
        state.overlay = { type: 'edit', dyeOrderId, confirmHighRisk: true, targetStatus: input.status }
        refreshOverlay()
      } else saveEdit(input)
    } catch (error) {
      state.overlay = { type: 'edit', dyeOrderId, error: error instanceof Error ? error.message : '请检查填写内容' }
      refreshOverlay()
    }
    return true
  }
  if (action === 'confirm-high-risk') {
    if (state.pendingEditInput) saveEdit(state.pendingEditInput)
    return true
  }
  if (action === 'cancel-high-risk') {
    if (state.overlay) state.overlay = { type: 'edit', dyeOrderId: state.overlay.dyeOrderId }
    state.pendingEditInput = null
    refreshOverlay()
    return true
  }
  if (action === 'prev-log-page' || action === 'next-log-page') {
    if (state.overlay?.type === 'logs') {
      const current = state.overlay.logPage || 1
      state.overlay = { ...state.overlay, logPage: Math.max(1, current + (action === 'next-log-page' ? 1 : -1)) }
      refreshOverlay()
    }
    return true
  }
  if (action === 'export') { downloadCsv('全部'); return true }
  if (action === 'export-preparation') { downloadCsv('投入接收'); return true }
  if (action === 'export-overdue') { downloadCsv('超期未完结'); return true }
  if (action === 'print-one') { openFlowCard([actionNode.dataset.id || ''].filter(Boolean)); return true }
  if (action === 'batch-print') { openFlowCard([...state.selectedIds]); return true }
  if (action === 'apply-filter') { state.selectedIds.clear(); state.filters = readFilters(root); state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.selectedIds.clear(); state.filters = { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] }; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'toggle-page') {
    root.querySelectorAll<HTMLInputElement>('tbody [data-dye-work-orders-action="toggle-selection"]').forEach(box => { const id = box.dataset.id || ''; if ((actionNode as HTMLInputElement).checked) state.selectedIds.add(id); else state.selectedIds.delete(id) })
    refreshWorkspace(); return true
  }
  if (action === 'select-page' || action === 'select-all' || action === 'clear-selection') {
    const rows = sortStandardListRows(filteredRows(currentRows()), state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
    state.selectedIds = new Set(action === 'clear-selection' ? [] : (action === 'select-page' ? paginateStandardListRows(rows, state.currentPage, state.preferences.pageSize).rows : rows).map(row => row.dyeOrderId))
    refreshWorkspace(); return true
  }
  if (action === 'toggle-selection') {
    const id = actionNode.dataset.id || ''
    if (state.selectedIds.has(id)) state.selectedIds.delete(id); else state.selectedIds.add(id)
    refreshWorkspace()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.dyeWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-dye-work-orders-column-key]')?.dataset.dyeWorkOrdersColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') clearListColumnPreferences(window.localStorage, PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  return false
}
