// @page-pattern: list

import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { type StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  getPrintOrderHandoverSummary,
  getPrintWorkOrderSummary,
  listPrintWorkOrders,
  type PrintWorkOrder,
} from '../../../data/fcs/printing-task-domain.ts'
import { buildPrintingWorkOrderDetailLink, buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-mock-data.ts'
import { getStartPrerequisiteByTaskId } from '../../../data/fcs/pda-start-link.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceType,
} from '../../../data/fcs/process-work-order-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatPrintProcessQty,
  getPrintQuantityLabel,
  getPrintPrinterSummary,
  getPrintingWorkOrderSourceOptions,
  renderActionButton,
  renderWorkOrderStatusBadge,
} from './shared'
import { createProcessOrderListController } from '../../../components/ui/process-order-list-controller.ts'
import { getProcessWorkOrderSourceObject } from '../../process-work-orders/process-work-order-source-view.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const EVENT_PREFIX = 'printing-work-orders'
const PREFERENCE_KEY = '/fcs/craft/printing/work-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  sourceType: '' | ProcessWorkOrderSourceType
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
} = {
  sourceType: '',
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
}

function renderActions(order: PrintWorkOrder): string {
  return `<div class="flex flex-wrap justify-end gap-2">
    ${renderActionButton({ label: '查看详情', action: 'navigate', attrs: { href: buildPrintingWorkOrderDetailLink(order.printOrderId) } })}
    ${renderActionButton({ label: '打印任务流转卡', action: 'navigate', attrs: { href: buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId) } })}
  </div>`
}

const columns: StandardListColumn<PrintWorkOrder>[] = [
  {
    key: 'order', title: '印花单号', width: 205, required: true, freezeable: true, sortable: true,
    sortValue: (order) => order.printOrderNo,
    render: (order) => `<div class="space-y-1">
      <div class="font-mono text-xs font-medium">${renderProductionObjectCodeButton({ objectType: 'PRINT_WORK_ORDER', objectId: order.printOrderNo, label: order.printOrderNo, relatedProductionOrderNo: order.sourceProductionOrderNo || order.sourceProductionOrderId, defaultTab: 'progress', highlightKey: `PRINT_WORK_ORDER:${order.printOrderNo}`, className: 'font-mono text-blue-600 hover:underline' })}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(order.patternNo)} / ${escapeHtml(order.patternVersion)}</div>
    </div>`,
  },
  {
    key: 'task', title: '印花任务', width: 220, required: true, freezeable: true, sortable: true,
    sortValue: (order) => order.taskNo,
    render: (order) => `<div class="space-y-1"><div class="font-medium">${escapeHtml(order.taskNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.materialSku)}${order.materialColor ? ` / ${escapeHtml(order.materialColor)}` : ''}</div><div class="text-xs text-muted-foreground">来源：${escapeHtml(PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType])}</div><div class="text-xs text-muted-foreground">${escapeHtml(getProcessWorkOrderSourceObject(order))}</div></div>`,
  },
  { key: 'pattern', title: '花型', width: 130, sortable: true, sortValue: (order) => order.patternNo, render: (order) => escapeHtml(order.patternNo) },
  { key: 'material', title: '面料', width: 150, sortable: true, sortValue: (order) => order.materialSku, render: (order) => escapeHtml(order.materialSku) },
  { key: 'plannedQty', title: '计划数量', width: 165, sortable: true, align: 'right', sortValue: (order) => order.plannedQty, render: (order) => formatPrintProcessQty(order, order.plannedQty, '计划') },
  { key: 'factory', title: '印花工厂', width: 180, sortable: true, sortValue: (order) => order.printFactoryName, render: (order) => escapeHtml(formatFactoryDisplayName(order.printFactoryName, order.printFactoryId)) },
  { key: 'status', title: '当前状态', width: 125, sortable: true, sortValue: (order) => order.status, render: (order) => renderWorkOrderStatusBadge(order.status) },
  { key: 'ready', title: '开工准备', width: 185, render: (order) => { const ready = getStartPrerequisiteByTaskId(order.taskId); return `<div class="space-y-1"><div class="font-medium">${escapeHtml(ready?.statusLabel || '按加工单状态判断')}</div><div class="text-xs text-muted-foreground">领料到位后开工</div></div>` } },
  { key: 'printer', title: '打印机', width: 150, render: (order) => { const printer = getPrintPrinterSummary(order); return `<div>${escapeHtml(printer.printerNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(printer.speedText)}</div>` } },
  { key: 'completed', title: '转印完成数量', width: 175, sortable: true, align: 'right', sortValue: (order) => getPrintPrinterSummary(order).outputQty, render: (order) => { const printer = getPrintPrinterSummary(order); return `<div class="text-xs text-muted-foreground">${escapeHtml(getPrintQuantityLabel(order, '已完成', 'PRINT_FINISH_TRANSFER'))}</div><div class="font-medium">${formatPrintProcessQty(order, printer.outputQty, '已完成', 'PRINT_FINISH_TRANSFER')}</div>` } },
  { key: 'handover', title: '交出情况', width: 190, render: (order) => { const handover = getPrintOrderHandoverSummary(order.printOrderId); return `<div class="space-y-1 text-xs"><div>交出单：${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '未生成')}</div><div>待收货：${handover.pendingWritebackCount} 条</div><div>差异：${handover.diffQty}</div><div>异议：${handover.objectionCount}</div></div>` } },
  { key: 'actions', title: '操作', width: 260, required: true, actionColumn: true, render: renderActions },
]

function filteredRows(sourceType = state.sourceType): PrintWorkOrder[] {
  const rows = listPrintWorkOrders()
  return sourceType ? rows.filter((order) => order.sourceType === sourceType) : rows
}

const listController = createProcessOrderListController({
  state,
  columns,
  preferenceKey: PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-printing-work-orders-root]',
  tableSurfaceSelector: '[data-printing-work-orders-table-surface]',
  paginationSurfaceSelector: '[data-printing-work-orders-pagination-surface]',
  overlaysSurfaceSelector: '[data-printing-work-orders-overlays-surface]',
  defaultFrozenKeys: ['order'],
  columnSettingsTitle: '印花加工单列设置',
  emptyText: '暂无印花加工单',
  getRows: filteredRows,
})

function renderSourceFilter(sourceType: '' | ProcessWorkOrderSourceType): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"><label class="min-w-[11rem]"><span class="mb-1 block text-xs text-muted-foreground">加工单来源</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-printing-work-orders-field="sourceType">${getPrintingWorkOrderSourceOptions().map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === sourceType ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}</div>`
}

function renderWorkspace(sourceOverride?: '' | ProcessWorkOrderSourceType): string {
  listController.ensurePreferencesLoaded()
  const sourceType = sourceOverride ?? state.sourceType
  const view = listController.getView(filteredRows(sourceType))
  const summary = getPrintWorkOrderSummary()
  return renderStandardListPage({
    title: '印花加工单',
    filtersHtml: `<div data-printing-work-orders-filters-surface>${renderSourceFilter(sourceType)}</div>`,
    statsHtml: `<div data-printing-work-orders-stats-surface>${renderStandardListStats([
      { label: '印花任务', value: summary.total },
      { label: '待交出', value: summary.waitHandoverCount },
      { label: '交出待收货', value: summary.waitReceiveCount },
      { label: '收货差异', value: summary.handoverDifferenceCount },
    ])}</div>`,
    listTitle: '印花加工单',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    feedbackHtml: '<div data-printing-work-orders-feedback-surface></div>',
    tableHtml: `<div data-printing-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-printing-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-printing-work-orders-overlays-surface>${listController.renderColumnSettings()}</div>`,
  })
}

export function renderCraftPrintingWorkOrdersPage(options: { sourceType?: '' | ProcessWorkOrderSourceType } = {}): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  listController.installColumnDragEvents()
  return `<div data-printing-work-orders-root data-skip-page-rerender="true"><div data-printing-work-orders-workspace>${renderWorkspace(options.sourceType)}</div><div data-printing-work-orders-detail-surface></div></div>`
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-printing-work-orders-root]')
}

function refreshFilterLocally(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-printing-work-orders-filters-surface]')
  if (surface) surface.innerHTML = renderSourceFilter(state.sourceType)
}

export function handlePrintingWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-printing-work-orders-root]')
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-printing-work-orders-field]')
  if (field?.dataset.printingWorkOrdersField === 'pageSize') {
    listController.setPageSize(Number(field.value)); listController.refresh(); return true
  }
  const actionNode = target.closest<HTMLElement>('[data-printing-work-orders-action]')
  if (!actionNode) return Boolean(field)
  const action = actionNode.dataset.printingWorkOrdersAction || ''
  if (action === 'apply-filter') { state.sourceType = root.querySelector<HTMLSelectElement>('[data-printing-work-orders-field="sourceType"]')?.value as typeof state.sourceType || ''; state.currentPage = 1; listController.refresh(); return true }
  if (action === 'reset-filter') { state.sourceType = ''; state.currentPage = 1; refreshFilterLocally(); listController.refresh(); return true }
  if (action === 'prev-page' || action === 'next-page') { listController.stepPage(action === 'next-page' ? 1 : -1); listController.refresh(); return true }
  if (action === 'sort-column') { listController.cycleSort(actionNode.dataset.columnKey || ''); listController.refresh(); return true }
  if (action === 'open-column-settings') { state.showColumnSettings = true; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; listController.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { listController.updateColumnPreference(action, actionNode.dataset.printingWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-printing-work-orders-column-key]')?.dataset.printingWorkOrdersColumnKey || '', target instanceof HTMLInputElement ? target.checked : undefined); listController.refresh(); return true }
  if (action === 'restore-column-settings') { listController.restorePreferences(); listController.refresh({ overlays: true }); return true }
  return false
}
