// @page-pattern: list

import { DYE_FACTORY_TABS } from '../data/fcs/dye-work-order-demo-details.ts'
import { createDyeOrderDisplayColumns } from './process-work-orders/order-list-columns.ts'
import { listDyeWorkOrderOnlineRows, getDyeWorkOrderOnlineSummary, type DyeWorkOrderOnlineRow } from '../data/fcs/dye-work-order-online-view.ts'
import { renderProcessOrderStats } from '../components/ui/process-order-list-presentation.ts'

import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { listPrepProcessOrders, type PrepProcessOrderFact } from '../data/fcs/page-adapters/process-prep-pages-adapter'
import { createDyeWorkOrderFromStock } from '../data/fcs/dyeing-task-domain.ts'
import { listFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { listProcessWorkOrderStockMaterials } from '../data/fcs/process-work-order-stock.ts'
import {
  listPlatformStatusOptions,
  type PlatformProcessStatus,
} from '../data/fcs/process-platform-status-adapter.ts'
import { PROCESS_WORK_ORDER_SOURCE_LABEL, type ProcessWorkOrderSourceType } from '../data/fcs/process-work-order-domain.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../components/ui/list-table-model.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../components/ui/button.ts'
import { createProcessOrderListController } from '../components/ui/process-order-list-controller.ts'
import { getProcessWorkOrderSourceDetailRows } from './process-work-orders/process-work-order-source-view.ts'
import { renderProcessOrderTaskRelations } from './process-order-task-relations.ts'
import { ensureProductionDemandEarlyProcessAcceptanceData } from '../data/fcs/production-demand-early-process-work-orders.ts'
import { createEarlyProcessManagementState, renderEarlyProcessMatchTabs, renderEarlyProcessCreateDialog, handleEarlyProcessManagementEvent, renderEarlyProcessDetail, renderEarlyProcessCancel } from './process-work-orders/early-process-management.ts'
import { PRODUCTION_DEMAND_PROCESS_MATCH_LABEL } from '../data/fcs/process-work-order-domain.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

type SourceFilter = '' | ProcessWorkOrderSourceType
const LIST_EVENT_PREFIX = 'dye-order-list'
// The migrated seven-column layout has different keys from the former prep table.
const LIST_PREFERENCE_KEY = '/fcs/process/dye-orders:list-columns:rich-v1'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface DyeCreateForm {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  plannedQty: string
  qtyUnit: string
  factoryId: string
  plannedFinishAt: string
  processName: string
  targetColor: string
}

const factories = listFactoryMasterRecords()
  .filter((factory) => factory.status === 'active' && factory.eligibility.allowDispatch)
  .filter((factory) => factory.processAbilities.some((ability) =>
    ability.processCode === 'DYE'
    && (ability.status ?? 'ACTIVE') === 'ACTIVE'
    && ability.canReceiveTask !== false,
  ))

const defaultForm = (): DyeCreateForm => ({
  stockMaterialId: '',
  stockMaterialName: '',
  materialSku: '',
  plannedQty: '',
  qtyUnit: '米',
  factoryId: factories[0]?.id || '',
  plannedFinishAt: '2026-07-31T18:00',
  processName: '常规染色',
  targetColor: '',
})

const state = {
  keyword: '',
  receiptStatus: '', processingStatus: '', handoverStatus: '', factoryName: '',
  statusFilter: '全部' as '全部' | PlatformProcessStatus,
  sourceFilter: '' as SourceFilter,
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['dyeInfo'], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  selectedWorkOrderId: null as string | null,
  createOpen: false,
  notice: null as string | null,
  formError: null as string | null,
  form: defaultForm(),
}

function getStockMaterials(factoryId = state.form.factoryId) {
  return listProcessWorkOrderStockMaterials({ factoryId, processCode: 'DYE' })
}

export function formatDyeOrderQuantity(qty: number, unit: string): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(qty)} ${unit}`
}

const earlyState = createEarlyProcessManagementState()
let ordersSnapshot: PrepProcessOrderFact[] | undefined
let displayRows = new Map<string, DyeWorkOrderOnlineRow>()

function getOrders(): PrepProcessOrderFact[] {
  if (!ordersSnapshot) { ensureProductionDemandEarlyProcessAcceptanceData('DYE'); ordersSnapshot = listPrepProcessOrders('DYE', { includeExecutionDetails: false }); displayRows = new Map(listDyeWorkOrderOnlineRows().map(row => [row.dyeOrderId, row])) }
  return ordersSnapshot
}

function getBaseFilteredOrders(sourceOverride?: SourceFilter): PrepProcessOrderFact[] {
  const keyword = state.keyword.trim().toLowerCase()
  const sourceFilter = sourceOverride ?? state.sourceFilter
  return getOrders().filter((order) => {
    const row = displayRows.get(order.workOrderId || '')
    if (state.factoryName && order.factoryName !== state.factoryName) return false
    if (state.receiptStatus && row?.receiptStatus !== state.receiptStatus) return false
    if (state.processingStatus && row?.processingStatus !== state.processingStatus) return false
    if (state.handoverStatus && row?.handoverStatus !== state.handoverStatus) return false
    if (state.statusFilter !== '全部' && order.platformStatusLabel !== state.statusFilter) return false
    if (sourceFilter && order.sourceType !== sourceFilter) return false
    if (!keyword) return true
    return [
      order.workOrderNo,
      order.orderNo,
      order.sourceSnapshot?.productionDemandId,
      order.sourceSnapshot?.matchedProductionOrderNo,
      order.sourceSnapshot?.professionalTaskNo,
      order.factoryName,
      order.materialSku,
      order.materialName,
      order.sourceSnapshot?.targetSpuCode,
      order.sourceSnapshot?.targetSpuName,
      order.sourceSnapshot?.inputMaterialSkuCode,
      order.sourceSnapshot?.outputMaterialSkuCode,
      order.sourceProductionOrderNo,
      order.sourceProductionOrderId,
      order.stockMaterial?.materialCode,
      order.stockMaterial?.materialName,
      order.sourceSummary,
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })
}

function getFilteredOrders(sourceOverride?: SourceFilter): PrepProcessOrderFact[] {
  return getBaseFilteredOrders(sourceOverride).filter(order => !earlyState.matchStatus || order.sourceSnapshot?.matchStatus === earlyState.matchStatus)
}

function renderSourceDetail(order: PrepProcessOrderFact): string {
  return getProcessWorkOrderSourceDetailRows(order)
    .map((row) => `<div><span class="text-muted-foreground">${escapeHtml(row.label)}：</span>${escapeHtml(row.value)}</div>`)
    .join('')
}

function renderDetail(selectedWorkOrderId = state.selectedWorkOrderId): string {
  if (!selectedWorkOrderId) return ''
  const order = getOrders().find((item) => item.workOrderId === selectedWorkOrderId)
  if (!order) return ''
  const plannedQtyLabel = order.plannedQtyLabel || '计划染色数量'
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-dye-order-action="close-detail"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">平台染色加工单</p><h2 class="mt-1 text-lg font-semibold">${escapeHtml(order.orderNo)}</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-dye-order-action="close-detail">关闭</button>
      </div>
      <div class="mt-6 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        ${renderSourceDetail(order)}
        <div><span class="text-muted-foreground">工厂：</span>${escapeHtml(order.factoryName)}</div>
        <div><span class="text-muted-foreground">分配方式：</span>${escapeHtml(order.assignmentMode || '派单')}</div>
        <div><span class="text-muted-foreground">派单价格：</span>${escapeHtml(order.dispatchPriceDisplay || '1500 IDR/Yard')}</div>
        <div><span class="text-muted-foreground">${escapeHtml(plannedQtyLabel)}：</span>${escapeHtml(formatDyeOrderQuantity(order.plannedFeedQty, order.unit))}</div>
        <div><span class="text-muted-foreground">计划完成：</span>${escapeHtml(order.plannedFinishAt)}</div>
        <div><span class="text-muted-foreground">平台加工单号：</span>${escapeHtml(order.workOrderNo || order.orderNo)}</div>
      </div>
      ${renderEarlyProcessDetail(order.sourceSnapshot)}
      <div class="mt-4">${renderProcessOrderTaskRelations(order.workOrderId || order.orderNo)}</div>
      <button class="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-dye-order-action="navigate-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">打开工厂端详情</button>
    </aside>
  `
}

function renderCreate(): string {
  if (!state.createOpen) return ''
  const form = state.form
  const stockMaterials = getStockMaterials(form.factoryId)
  const selectedStock = stockMaterials.find((item) => item.stockMaterialId === form.stockMaterialId)
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-dye-order-action="close-create"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">固定来源：按备货创建</p><h2 class="mt-1 text-lg font-semibold">新建染色加工单</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-dye-order-action="close-create">关闭</button>
      </div>
      <p class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">生产单来源由系统自动生成，只读且不能在此手工创建。</p>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">${renderSelect('stockMaterialId', '仓库备货库存', stockMaterials.map((item) => ({ value: item.stockMaterialId, label: `${item.stockMaterialName} / ${item.materialSku} / 可用 ${item.availableQty} ${item.qtyUnit}` })), form.stockMaterialId, '请选择真实库存')}</div>
        <div class="sm:col-span-2 rounded-md border bg-muted/20 p-3 text-sm" data-dye-stock-selection-summary>${selectedStock ? `<div class="font-medium">${escapeHtml(selectedStock.stockMaterialName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(selectedStock.materialSku)} · ${escapeHtml(selectedStock.warehouseName)} · 可用 ${escapeHtml(String(selectedStock.availableQty))} ${escapeHtml(selectedStock.qtyUnit)}</div>` : '<span class="text-muted-foreground">选择库存后自动带出名称、编码、仓库与单位。</span>'}</div>
        ${renderInput('plannedQty', '计划数量', form.plannedQty, 'number', selectedStock?.availableQty)}
        <label class="block"><span class="mb-1 block text-xs text-muted-foreground">数量单位</span><input class="h-10 w-full rounded-md border bg-muted px-3 text-sm" value="${escapeHtml(form.qtyUnit)}" data-dye-stock-unit readonly /></label>
        ${renderSelect('factoryId', '染色工厂', factories.map((factory) => ({ value: factory.id, label: factory.name })), form.factoryId, undefined, false)}
        ${renderInput('plannedFinishAt', '计划完成时间', form.plannedFinishAt, 'datetime-local')}
        ${renderInput('processName', '染色工序', form.processName)}
        ${renderInput('targetColor', '目标颜色', form.targetColor)}
      </div>
      ${state.formError ? `<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-dye-create-error>${escapeHtml(state.formError)}</p>` : ''}
      <button class="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground" data-dye-order-action="submit-create">创建染色加工单</button>
    </aside>
  `
}

function renderInput(field: keyof DyeCreateForm, label: string, value: string, type = 'text', max?: number): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm" type="${type}" value="${escapeHtml(value)}" ${typeof max === 'number' ? `max="${max}"` : ''} data-skip-page-rerender="true" data-dye-create-field="${field}" /></label>`
}

function renderSelect(field: keyof DyeCreateForm, label: string, options: Array<{ value: string; label: string }>, value: string, placeholder?: string, skipPageRerender = true): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" ${skipPageRerender ? 'data-skip-page-rerender="true"' : ''} data-dye-create-field="${field}">${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}${options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`
}

const displayColumns = createDyeOrderDisplayColumns(row => `<button class="text-left text-xs font-semibold text-blue-700 hover:underline" data-dye-order-action="open-detail" data-work-order-id="${escapeHtml(row.dyeOrderId)}">${escapeHtml(row.workOrderNo)}</button>`)
const listColumns: StandardListColumn<PrepProcessOrderFact>[] = [
  ...displayColumns.map(column => ({ ...column, renderHeader: undefined, sortValue: column.sortValue ? (order: PrepProcessOrderFact) => { const row = displayRows.get(order.workOrderId || ''); return row ? column.sortValue!(row) : '' } : undefined, render: (order: PrepProcessOrderFact, index: number) => { const row = displayRows.get(order.workOrderId || ''); return row ? column.render(row, index) : '<span class="text-amber-700">加工事实待补充</span>' } })),
  { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true, render: order => `<button class="text-primary hover:underline" data-dye-order-action="open-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">查看</button>${renderEarlyProcessCancel(order.workOrderId, order.sourceSnapshot)}` },
]
const listController = createProcessOrderListController({
  state,
  columns: listColumns,
  preferenceKey: LIST_PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: LIST_EVENT_PREFIX,
  rootSelector: '[data-process-dye-orders-root]',
  tableSurfaceSelector: '[data-process-dye-orders-table-surface]',
  paginationSurfaceSelector: '[data-process-dye-orders-pagination-surface]',
  overlaysSurfaceSelector: '[data-process-dye-orders-overlays]',
  defaultFrozenKeys: ['dyeInfo'],
  columnSettingsTitle: '染色加工单列设置',
  emptyText: '暂无加工单',
  getRows: getFilteredOrders,
  locallyManagedEvents: true,
})

function hydrateInsertedIcons(root: ParentNode): void {
  void import('../components/shell.ts').then(({ hydrateIcons }) => hydrateIcons(root)).catch(() => undefined)
}

function refreshDetailLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-dye-orders-detail]')
  if (!node) return
  node.innerHTML = renderDetail()
  hydrateInsertedIcons(node)
}

function refreshCreateLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-dye-orders-create]')
  if (!node) return
  node.innerHTML = renderCreate()
  hydrateInsertedIcons(node)
}

function refreshFeedbackLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-dye-orders-feedback]')
  if (node) node.innerHTML = state.notice ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">${escapeHtml(state.notice)}</div>` : ''
}

function renderFilters(): string {
  const orders = getOrders()
  const rows = [...displayRows.values()]
  const select = (label: string, key: string, value: string, options: Array<[string, string]>) => `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select aria-label="${label}" class="h-9 w-full rounded-md border bg-white px-2 text-sm" data-dye-order-field="${key}"><option value="">全部</option>${options.map(([id, text]) => `<option value="${escapeHtml(id)}" ${value === id ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`
  return `<div data-process-dye-orders-match-tabs>${renderEarlyProcessMatchTabs(earlyState, getBaseFilteredOrders())}</div><section class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"><label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="单号、商品、物料或生产需求单" value="${escapeHtml(state.keyword)}" data-dye-order-field="keyword" /></label>${select('接收状态','receiptStatus',state.receiptStatus,[...new Map(rows.map(row => [row.receiptStatus, row.receiptStatusLabel])).entries()])}${select('加工状态','processingStatus',state.processingStatus,[...new Map(rows.map(row => [row.processingStatus, row.processingStatusLabel])).entries()])}${select('交出状态','handoverStatus',state.handoverStatus,[...new Map(rows.map(row => [row.handoverStatus, row.handoverStatusLabel])).entries()])}${select('加工厂','factoryName',state.factoryName,[...new Set(orders.map(row => row.factoryName))].map(name => [name,name]))}</div><details class="mt-3"><summary class="cursor-pointer text-sm text-muted-foreground">更多筛选</summary><div class="mt-3 grid gap-2 sm:grid-cols-3">${select('来源','sourceFilter',state.sourceFilter,Object.entries(PROCESS_WORK_ORDER_SOURCE_LABEL))}${select('平台状态','statusFilter',state.statusFilter === '全部' ? '' : state.statusFilter,listPlatformStatusOptions().map(label => [label,label]))}</div></details><div class="mt-3 flex gap-2">${renderPrimaryButton('查询', { prefix: 'dye-order', action: 'query' }, 'search')}${renderSecondaryButton('重置', { prefix: 'dye-order', action: 'reset' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: 'dye-order', action: 'export' }, 'download')}</div></section>`
}
function renderStats(): string {
  const rows = getFilteredOrders().map(order => displayRows.get(order.workOrderId || '')).filter((row): row is DyeWorkOrderOnlineRow => Boolean(row))
  const summary = getDyeWorkOrderOnlineSummary(rows)
  const qty = (values: Array<{ unit: string; qty: number }>) => values.filter(item => item.qty !== 0).map(item => `${item.qty.toLocaleString('zh-CN')} ${item.unit}`).join(' / ') || '0'
  return renderProcessOrderStats([{ label: '加工单数', value: rows.length }, { label: '计划投入', value: qty(summary.plannedQtyByUnit) }, { label: '已接收', value: qty(summary.receivedQtyByUnit) }, { label: '实际使用', value: qty(summary.rawMaterialQtyByUnit) }, { label: '完成数量', value: qty(summary.completedQtyByUnit) }, { label: '下游待接收', value: qty(summary.pendingQtyByUnit) }])
}
function getEarlyFactories() { return DYE_FACTORY_TABS.filter(item => item.id && item.id !== 'unassigned').map(item => ({ id: item.id, name: item.label })) }
function refreshEarlyDialog(): void {
  const host = document.querySelector<HTMLElement>('[data-process-dye-orders-early-create]')
  if (host) { host.innerHTML = renderEarlyProcessCreateDialog('DYE', earlyState, getEarlyFactories()); hydrateInsertedIcons(host) }
}
function refreshListSummary(): void {
  const tabs = document.querySelector<HTMLElement>('[data-process-dye-orders-match-tabs]')
  if (tabs) tabs.innerHTML = renderEarlyProcessMatchTabs(earlyState, getBaseFilteredOrders())
  const stats = document.querySelector<HTMLElement>('[data-process-dye-orders-stats]')
  if (stats) stats.innerHTML = renderStats()
  const count = document.querySelector<HTMLElement>('[data-process-dye-orders-count]')
  if (count) count.textContent = `共 ${getFilteredOrders().length} 条`
}
function exportOrders(): void {
  const rows = getFilteredOrders()
  if (!rows.length) { state.notice = '当前查询无可导出加工单'; refreshFeedbackLocally(); return }
  const csv = [['加工单号', '来源', '生产需求单', '生产单', '生产单匹配', '工厂', '计划数量', '单位', '计划完成', '平台状态'], ...rows.map(row => [row.workOrderNo || row.orderNo, row.sourceLabel, row.sourceSnapshot?.productionDemandNo || row.sourceSnapshot?.productionDemandId || '', row.sourceSnapshot?.matchedProductionOrderNo || row.sourceProductionOrderNo || '', row.sourceSnapshot?.matchStatus ? PRODUCTION_DEMAND_PROCESS_MATCH_LABEL[row.sourceSnapshot.matchStatus] : '不适用', row.factoryName, row.plannedFeedQty, row.unit, row.plannedFinishAt, row.platformStatusLabel])].map(cells => cells.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = '染色加工单.csv'; link.click(); URL.revokeObjectURL(url)
  state.notice = `已导出当前查询的 ${rows.length} 条加工单`; refreshFeedbackLocally()
}

export function renderProcessDyeOrdersPage(options: { sourceType?: SourceFilter; selectedWorkOrderId?: string | null } = {}): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, typeof document !== 'undefined' && Boolean(document.querySelector('[data-process-dye-orders-root]')))
  ordersSnapshot = undefined
  if (options.sourceType !== undefined) state.sourceFilter = options.sourceType
  listController.installColumnDragEvents()
  listController.ensurePreferencesLoaded()
  const view = listController.getView(options.sourceType === undefined ? undefined : getFilteredOrders(options.sourceType))
  return `<div data-process-dye-orders-root data-early-process-management="DYE" data-skip-page-rerender="true"><style>[data-process-dye-orders-root] [data-standard-list-scroll] td{vertical-align:top}[data-process-dye-orders-stats] [data-standard-list-stats]{display:flex;overflow-x:auto}[data-process-dye-orders-stats] [data-process-stat]{flex:1 0 max-content;min-height:48px;height:48px;gap:2px}[data-process-dye-orders-stats] [data-process-stat] strong{font-size:11px;line-height:14px;white-space:nowrap}</style>${renderStandardListPage({
    title: '染色加工单',
    primaryActionsHtml: '<div class="flex items-center gap-2"><button class="rounded-md border px-4 py-2 text-sm" data-dye-order-action="create-new">按备货创建</button><button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-early-process-action="open-create">新增染色加工单</button></div>',
    feedbackHtml: `<div data-process-dye-orders-feedback>${state.notice ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">${escapeHtml(state.notice)}</div>` : ''}</div>`,
    filtersHtml: `<div data-process-dye-orders-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-process-dye-orders-stats>${renderStats()}</div>`,
    listTitle: '染色加工单',
    listActionsHtml: `<span class="mr-3 text-sm text-muted-foreground" data-process-dye-orders-count>共 ${getFilteredOrders().length} 条</span>${renderSecondaryButton('列设置', { prefix: LIST_EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}`,
    tableHtml: `<div data-process-dye-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-process-dye-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-process-dye-orders-overlays>${listController.renderColumnSettings()}</div>`,
  })}
    <div data-process-dye-orders-detail>${renderDetail(options.selectedWorkOrderId === undefined ? state.selectedWorkOrderId : options.selectedWorkOrderId)}</div>
    <div data-process-dye-orders-create>${renderCreate()}</div>
    <div data-process-dye-orders-early-create>${renderEarlyProcessCreateDialog('DYE', earlyState, getEarlyFactories())}</div>
  </div>`
}

function submitCreate(): void {
  const form = state.form
  const result = createDyeWorkOrderFromStock({
    stockMaterialId: form.stockMaterialId,
    stockMaterialName: form.stockMaterialName,
    materialSku: form.materialSku,
    factoryId: form.factoryId,
    plannedQty: Number(form.plannedQty),
    qtyUnit: form.qtyUnit,
    plannedFinishAt: form.plannedFinishAt.replace('T', ' '),
    processName: form.processName,
    targetColor: form.targetColor,
  })
  if (!result.ok || !result.order) {
    state.formError = result.message
    return
  }
  state.notice = `已创建染色加工单 ${result.order.dyeOrderNo}`
  state.createOpen = false
  state.form = defaultForm()
  state.formError = null
  state.keyword = result.order.dyeOrderNo
  state.statusFilter = '全部'
  state.sourceFilter = ''
  state.currentPage = 1
}

export function handleProcessDyeOrdersEvent(target: HTMLElement, event?: Event): boolean {
  // Focusing a field must not rebuild its select/options or redraw the list.
  if (event?.type === 'click' && target.closest('[data-dye-order-field], [data-dye-create-field], [data-dye-order-list-field], [data-early-process-field]')) return true
  if (event?.type === 'input' && target instanceof HTMLSelectElement) return true
  if (handleEarlyProcessManagementEvent(target, { code: 'DYE', state: earlyState, factories: getEarlyFactories(), refreshDialog: refreshEarlyDialog, refreshRows: reloadFacts => { if (reloadFacts) ordersSnapshot = undefined; state.currentPage = 1; listController.refresh(); refreshListSummary(); if (reloadFacts) { const filters = document.querySelector<HTMLElement>('[data-process-dye-orders-filters]'); if (filters) filters.innerHTML = renderFilters() } }, setNotice: message => { state.notice = message; refreshFeedbackLocally() }, onCreated: result => { state.receiptStatus = ''; state.processingStatus = ''; state.handoverStatus = ''; state.factoryName = ''; state.keyword = result.workOrderNo; state.sourceFilter = ''; state.statusFilter = '全部'; earlyState.matchStatus = ''; const input = document.querySelector<HTMLInputElement>('[data-dye-order-field="keyword"]'); if (input) input.value = state.keyword } })) return true
  const createField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-dye-create-field]')
  if (createField) {
    const field = createField.dataset.dyeCreateField as keyof DyeCreateForm
    state.form[field] = createField.value
    if (field === 'factoryId' && !getStockMaterials(createField.value).some((item) => item.stockMaterialId === state.form.stockMaterialId)) {
      state.form.stockMaterialId = ''
      state.form.stockMaterialName = ''
      state.form.materialSku = ''
      state.form.qtyUnit = ''
    }
    if (field === 'stockMaterialId') {
      const selected = getStockMaterials().find((item) => item.stockMaterialId === createField.value)
      state.form.stockMaterialName = selected?.stockMaterialName || ''
      state.form.materialSku = selected?.materialSku || ''
      state.form.qtyUnit = selected?.qtyUnit || ''
      const drawer = createField.closest<HTMLElement>('aside')
      const unitInput = drawer?.querySelector<HTMLInputElement>('[data-dye-stock-unit]')
      if (unitInput) unitInput.value = selected?.qtyUnit || ''
      const qtyInput = drawer?.querySelector<HTMLInputElement>('[data-dye-create-field="plannedQty"]')
      if (qtyInput) {
        if (selected) qtyInput.max = String(selected.availableQty)
        else qtyInput.removeAttribute('max')
      }
      const summary = drawer?.querySelector<HTMLElement>('[data-dye-stock-selection-summary]')
      if (summary) summary.textContent = selected
        ? `${selected.stockMaterialName} / ${selected.materialSku} / ${selected.warehouseName} / 可用 ${selected.availableQty} ${selected.qtyUnit}`
        : '选择库存后自动带出名称、编码、仓库与单位。'
    }
    state.formError = null
    createField.closest<HTMLElement>('aside')?.querySelector('[data-dye-create-error]')?.remove()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-dye-order-field]')
  if (field) {
    if (field.dataset.dyeOrderField === 'keyword') state.keyword = field.value
    const filterKey = field.dataset.dyeOrderField
    if (filterKey === 'receiptStatus' || filterKey === 'processingStatus' || filterKey === 'handoverStatus' || filterKey === 'factoryName') state[filterKey] = field.value
    if (field.dataset.dyeOrderField === 'statusFilter') state.statusFilter = (field.value || '全部') as typeof state.statusFilter
    if (field.dataset.dyeOrderField === 'sourceFilter') state.sourceFilter = field.value as SourceFilter
    state.currentPage = 1
    listController.refresh(); refreshListSummary()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-dye-order-action]')
  const listField = target.closest<HTMLSelectElement>('[data-dye-order-list-field]')
  if (listField?.dataset.dyeOrderListField === 'pageSize') {
    const pageSize = Number(listField.value)
    listController.setPageSize(pageSize)
    listController.refresh()
    return true
  }
  const listAction = target.closest<HTMLElement>('[data-dye-order-list-action]')
  if (listAction) {
    const action = listAction.dataset.dyeOrderListAction || ''
    if (action === 'prev-page' || action === 'next-page') listController.stepPage(action === 'next-page' ? 1 : -1)
    if (action === 'sort-column') listController.cycleSort(listAction.dataset.columnKey || '')
    if (action === 'open-column-settings') {
      state.showColumnSettings = true
      listController.refresh({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'close-column-settings') {
      state.showColumnSettings = false
      listController.refresh({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = listAction.dataset.dyeOrderListColumnKey || listAction.closest<HTMLElement>('[data-dye-order-list-column-key]')?.dataset.dyeOrderListColumnKey || ''
      listController.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined)
      listController.refresh({ overlays: true })
      return true
    }
    if (action === 'restore-column-settings') listController.restorePreferences()
    listController.refresh({ overlays: state.showColumnSettings })
    return true
  }
  if (!actionNode) return Boolean(listField)
  const action = actionNode.dataset.dyeOrderAction
  if (action === 'query') { state.currentPage = 1; listController.refresh(); refreshListSummary(); return true }
  if (action === 'reset') { state.receiptStatus = ''; state.processingStatus = ''; state.handoverStatus = ''; state.factoryName = ''; state.keyword = ''; state.sourceFilter = ''; state.statusFilter = '全部'; earlyState.matchStatus = ''; state.currentPage = 1; const filters = document.querySelector<HTMLElement>('[data-process-dye-orders-filters]'); if (filters) filters.innerHTML = renderFilters(); listController.refresh(); refreshListSummary(); return true }
  if (action === 'export') { exportOrders(); return true }
  if (action === 'navigate-detail') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) appStore.navigate(`/fcs/craft/dyeing/work-orders/${encodeURIComponent(workOrderId)}`)
    return true
  }
  if (action === 'open-detail') { state.selectedWorkOrderId = actionNode.dataset.workOrderId || null; refreshDetailLocally() }
  if (action === 'close-detail') { state.selectedWorkOrderId = null; refreshDetailLocally() }
  if (action === 'create-new') { state.createOpen = true; state.notice = null; state.formError = null; refreshCreateLocally(); refreshFeedbackLocally() }
  if (action === 'close-create') { state.createOpen = false; state.form = defaultForm(); state.formError = null; refreshCreateLocally() }
  if (action === 'submit-create') { submitCreate(); ordersSnapshot = undefined; refreshListSummary(); refreshCreateLocally(); refreshFeedbackLocally(); listController.refresh() }
  if (action === 'page-prev') { listController.stepPage(-1); listController.refresh() }
  if (action === 'page-next') { listController.stepPage(1); listController.refresh() }
  if (action === 'close-all') closeProcessDyeOrdersOverlays()
  return true
}

export function isProcessDyeOrdersDialogOpen(): boolean {
  return Boolean(state.selectedWorkOrderId || state.createOpen || earlyState.createOpen)
}

export function closeProcessDyeOrdersOverlays(): boolean {
  if (!isProcessDyeOrdersDialogOpen() && !state.showColumnSettings) return false
  earlyState.createOpen = false
  state.selectedWorkOrderId = null
  state.createOpen = false
  state.formError = null
  state.showColumnSettings = false
  refreshEarlyDialog(); refreshDetailLocally(); refreshCreateLocally()
  listController.refresh({ table: false, pagination: false, overlays: true })
  return true
}
