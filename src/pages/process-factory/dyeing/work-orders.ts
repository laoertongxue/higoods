// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
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
import { renderInput } from '../../../components/ui/form.ts'
import {
  getDyeOrderHandoverSummary,
  getDyeCurrentStepLabel,
  getDyeWorkOrderSummary,
  listDyeWorkOrders,
  type DyeWorkOrder,
} from '../../../data/fcs/dyeing-task-domain.ts'
import { buildDyeWorkOrderCombinedDyeingView } from '../../../data/fcs/dye-work-order-combined-dyeing-view.ts'
import { buildDyeingWorkOrderDetailLink, buildTaskRouteCardPrintLink } from '../../../data/fcs/fcs-route-links.ts'
import { formatFactoryDisplayName } from '../../../data/fcs/factory-display-data.ts'
import { getStartPrerequisiteByTaskId } from '../../../data/fcs/pda-start-link.ts'
import { renderProductionObjectCodeButton } from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import { formatDyeQty, getDyeVatSummary, renderActionButton, renderWorkOrderStatusBadge } from './shared.ts'

const EVENT_PREFIX = 'dye-work-orders'
const PREFERENCE_KEY = '/fcs/craft/dyeing/work-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  keyword: string
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
} = {
  currentPage: 1,
  keyword: '',
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['workOrderNo'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
}

let columnDragEventsInstalled = false
let draggedColumnKey = ''

function satisfactionLabel(value: 'FULL' | 'PARTIAL' | 'UNMET'): string {
  if (value === 'FULL') return '已满足'
  if (value === 'PARTIAL') return '部分满足'
  return '未满足'
}

export function renderDyeWorkOrderCombinedDyeingCell(order: DyeWorkOrder): string {
  const projection = buildDyeWorkOrderCombinedDyeingView(order)
  if (!projection) return '<span class="text-xs text-muted-foreground">—</span>'
  if (!projection.hasCombinedDyeingHistory) {
    return '<span class="text-xs text-muted-foreground">尚未加入合并染色</span>'
  }
  const tone = projection.satisfaction === 'FULL' ? 'success' : projection.satisfaction === 'PARTIAL' ? 'warning' : 'neutral'
  const active = projection.activeTask
    ? `<div class="flex flex-wrap items-center gap-1.5">${renderBadge('已加入合并染色', 'info')}<button type="button" class="font-mono text-xs font-medium text-blue-600 hover:underline" data-dyeing-action="navigate" data-href="/fcs/craft/dyeing/combined-dyeing?taskId=${encodeURIComponent(projection.activeTask.taskId)}">${escapeHtml(projection.activeTask.taskNo)}</button></div>`
    : '<div class="text-xs text-muted-foreground">当前无活动任务，保留历史分配</div>'
  return `<div class="space-y-1.5">${active}<div class="flex flex-wrap items-center gap-1.5">${renderBadge(satisfactionLabel(projection.satisfaction), tone)}<span class="text-xs">有效 ${formatDyeQty(projection.currentEffectiveAllocationQty, order.qtyUnit)}</span><span class="text-xs text-muted-foreground">未满足 ${formatDyeQty(projection.unmetQty, order.qtyUnit)}</span></div></div>`
}

function renderOrderNo(order: DyeWorkOrder): string {
  return `<div class="space-y-1"><div class="font-mono text-xs font-medium">${renderProductionObjectCodeButton({
    objectType: 'DYE_WORK_ORDER',
    objectId: order.dyeOrderNo,
    label: order.dyeOrderNo,
    relatedProductionOrderNo: order.sourceProductionOrderNo || order.sourceProductionOrderId,
    defaultTab: 'progress',
    highlightKey: `DYE_WORK_ORDER:${order.dyeOrderNo}`,
    className: 'font-mono text-blue-600 hover:underline',
  })}</div><div class="text-[11px] text-muted-foreground">平台加工单号，只读，不可改号</div>${order.requiresWaterSoluble ? '<span class="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">需先水溶</span>' : ''}</div>`
}

function renderActions(order: DyeWorkOrder): string {
  return `<div class="flex flex-wrap justify-end gap-2">${[
    ['查看详情', buildDyeingWorkOrderDetailLink(order.dyeOrderId)],
    ['打印任务流转卡', buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)],
    ['查看配方', `${buildDyeingWorkOrderDetailLink(order.dyeOrderId)}?tab=formula`],
    ['查看统计', `${buildDyeingWorkOrderDetailLink(order.dyeOrderId)}?tab=statistics`],
  ].map(([label, href]) => renderActionButton({ label, action: 'navigate', attrs: { href } })).join('')}</div>`
}

const columns: StandardListColumn<DyeWorkOrder>[] = [
  { key: 'workOrderNo', title: '染色加工单号', width: 190, required: true, freezeable: true, sortable: true, render: renderOrderNo, sortValue: (order) => order.dyeOrderNo },
  { key: 'source', title: '来源', width: 170, required: true, freezeable: true, sortable: true, render: (order) => order.sourceType === 'STOCK' ? `<div>备货</div><div class="text-xs text-muted-foreground">${escapeHtml(order.stockMaterialName || order.stockMaterialId || '—')}</div>` : `<div>生产单</div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(order.sourceProductionOrderNo || order.sourceProductionOrderId || '—')}</div>`, sortValue: (order) => order.sourceProductionOrderNo || order.stockMaterialName },
  { key: 'combined', title: '合并染色', width: 280, required: true, sortable: true, render: renderDyeWorkOrderCombinedDyeingCell, sortValue: (order) => { const view = buildDyeWorkOrderCombinedDyeingView(order); return view?.hasCombinedDyeingHistory ? view.satisfaction : undefined } },
  { key: 'material', title: '原料面料', width: 210, sortable: true, render: (order) => `<div>${escapeHtml(order.rawMaterialSku)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.composition || '暂无数据')}</div>`, sortValue: (order) => order.rawMaterialSku },
  { key: 'color', title: '目标颜色', width: 120, sortable: true, render: (order) => `<div>${escapeHtml(order.targetColor)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.colorNo || '待确认')}</div>`, sortValue: (order) => order.targetColor },
  { key: 'plannedQty', title: '计划数量', width: 120, align: 'right', sortable: true, render: (order) => formatDyeQty(order.plannedQty, order.qtyUnit), sortValue: (order) => order.plannedQty },
  { key: 'factory', title: '染色工厂', width: 180, sortable: true, render: (order) => escapeHtml(formatFactoryDisplayName(order.dyeFactoryName, order.dyeFactoryId)), sortValue: (order) => order.dyeFactoryName },
  { key: 'status', title: '当前状态', width: 120, required: true, sortable: true, render: (order) => renderWorkOrderStatusBadge(order.status), sortValue: (order) => order.status },
  { key: 'preparation', title: '开工准备', width: 220, render: (order) => { const prerequisite = getStartPrerequisiteByTaskId(order.taskId); return `<div class="font-medium">${escapeHtml(order.requiresWaterSoluble ? getDyeCurrentStepLabel(order) : prerequisite?.statusLabel || '按加工单状态判断')}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.requiresWaterSoluble ? '同一染厂先完成水溶，再开始染色' : '实际染色前确认坯布和染化料到位')}</div>` } },
  { key: 'vat', title: '染缸', width: 110, sortable: true, render: (order) => escapeHtml(getDyeVatSummary(order).dyeVatNo), sortValue: (order) => getDyeVatSummary(order).dyeVatNo },
  { key: 'handover', title: '交出 / 收货', width: 180, render: (order) => { const handover = getDyeOrderHandoverSummary(order.dyeOrderId); return `<div>${escapeHtml(order.handoverOrderNo || order.handoverOrderId || '未生成')}</div><div class="text-xs text-muted-foreground">待收货 ${handover.pendingWritebackCount} 条 · 差异 ${handover.diffQty}</div>` } },
  { key: 'actions', title: '操作', width: 360, required: true, actionColumn: true, render: renderActions },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map((column) => column.key),
    visibleKeys: columns.map((column) => column.key),
    frozenKeys: ['workOrderNo'],
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

function filteredOrders(): DyeWorkOrder[] {
  const keyword = state.keyword.trim().toLocaleLowerCase('zh-CN')
  return listDyeWorkOrders().filter((order) => !keyword || [
    order.dyeOrderNo,
    order.sourceProductionOrderNo,
    order.stockMaterialName,
    order.rawMaterialSku,
    order.targetColor,
    order.dyeFactoryName,
  ].some((value) => value?.toLocaleLowerCase('zh-CN').includes(keyword)))
}

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"><div class="min-w-[18rem] flex-1"><label class="mb-1 block text-xs text-muted-foreground">加工单号 / 来源 / 面料 / 颜色 / 工厂</label>${renderInput({ value: state.keyword, placeholder: '输入关键词后查询', prefix: EVENT_PREFIX, field: 'keyword' })}</div>${renderSecondaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}</div>`
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const orders = filteredOrders()
  const sorted = sortStandardListRows(orders, state.sort, (order, key) => columns.find((column) => column.key === key)?.sortValue?.(order))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const summary = getDyeWorkOrderSummary()
  return renderStandardListPage({
    title: '染色加工单',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '加工单', value: summary.total },
      { label: '待排染缸', value: summary.waitVatPlanCount },
      { label: '待交出', value: summary.waitHandoverCount },
      { label: '当前筛选', value: orders.length },
    ]),
    listTitle: '染色加工单表格',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无染色加工单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '染色加工单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

export function renderCraftDyeingWorkOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  installColumnDragEvents()
  return `<div data-dye-work-orders-root data-skip-page-rerender="true"><div data-dye-work-orders-workspace>${renderWorkspace()}</div></div>`
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-dye-work-orders-root]')
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-dye-work-orders-workspace]')
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
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
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-dye-work-orders-field]')
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
  if (action === 'apply-filter') { state.keyword = root.querySelector<HTMLInputElement>('[data-dye-work-orders-field="keyword"]')?.value.trim() || ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
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
