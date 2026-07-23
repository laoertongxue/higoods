// @page-pattern: list

import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { listPrepProcessOrders, type PrepProcessOrderFact } from '../data/fcs/page-adapters/process-prep-pages-adapter'
import { createPrintWorkOrderFromStock } from '../data/fcs/printing-task-domain.ts'
import { listFactoryMasterRecords } from '../data/fcs/factory-master-store.ts'
import { listProcessWorkOrderStockMaterials } from '../data/fcs/process-work-order-stock.ts'
import {
  PLATFORM_PROCESS_STATUS_CLASS,
  listPlatformStatusOptions,
  type PlatformProcessStatus,
} from '../data/fcs/process-platform-status-adapter.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceType,
} from '../data/fcs/process-work-order-domain.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../components/ui/list-table.ts'
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
} from '../components/ui/list-table-model.ts'
import { renderTablePagination } from '../components/ui/pagination.ts'
import { renderSecondaryButton } from '../components/ui/button.ts'

type PageSize = 10 | 20 | 50
type SourceFilter = '' | ProcessWorkOrderSourceType

const LIST_EVENT_PREFIX = 'print-order-list'
const LIST_PREFERENCE_KEY = '/fcs/process/print-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface PrintCreateForm {
  stockMaterialId: string
  stockMaterialName: string
  materialSku: string
  plannedQty: string
  qtyUnit: string
  factoryId: string
  plannedFinishAt: string
  processName: string
}

const factories = listFactoryMasterRecords()
  .filter((factory) => factory.status === 'active' && factory.eligibility.allowDispatch)
  .filter((factory) => factory.processAbilities.some((ability) =>
    ability.processCode === 'PRINT'
    && (ability.status ?? 'ACTIVE') === 'ACTIVE'
    && ability.canReceiveTask !== false,
  ))

const defaultForm = (): PrintCreateForm => ({
  stockMaterialId: '',
  stockMaterialName: '',
  materialSku: '',
  plannedQty: '',
  qtyUnit: '米',
  factoryId: factories[0]?.id || '',
  plannedFinishAt: '2026-07-31T18:00',
  processName: '数码印花',
})

const state = {
  keyword: '',
  statusFilter: '全部' as '全部' | PlatformProcessStatus,
  sourceFilter: '' as SourceFilter,
  page: 1,
  pageSize: 10 as PageSize,
  sort: null as StandardListSortState | null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['orderNo'], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  selectedWorkOrderId: null as string | null,
  createOpen: false,
  notice: null as string | null,
  formError: null as string | null,
  form: defaultForm(),
}

let listColumnDragInstalled = false
let draggedListColumnKey = ''

function getStockMaterials(factoryId = state.form.factoryId) {
  return listProcessWorkOrderStockMaterials({ factoryId, processCode: 'PRINT' })
}

function formatQty(qty: number, unit: string): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(qty)} ${unit}`
}

function getOrders(): PrepProcessOrderFact[] {
  return listPrepProcessOrders('PRINT')
}

function getFilteredOrders(sourceOverride?: SourceFilter): PrepProcessOrderFact[] {
  const keyword = state.keyword.trim().toLowerCase()
  const sourceFilter = sourceOverride ?? state.sourceFilter
  return getOrders().filter((order) => {
    if (state.statusFilter !== '全部' && order.platformStatusLabel !== state.statusFilter) return false
    if (sourceFilter && order.sourceType !== sourceFilter) return false
    if (!keyword) return true
    return [
      order.orderNo,
      order.factoryName,
      order.sourceProductionOrderNo,
      order.sourceProductionOrderId,
      order.stockMaterial?.materialCode,
      order.stockMaterial?.materialName,
      order.sourceSummary,
    ].some((value) => String(value || '').toLowerCase().includes(keyword))
  })
}

function renderStatus(order: PrepProcessOrderFact): string {
  const label = order.platformStatusLabel || order.status
  return `<span class="inline-flex rounded-full px-2 py-1 text-xs ${PLATFORM_PROCESS_STATUS_CLASS[label]}">${escapeHtml(label)}</span>`
}

function renderSource(order: PrepProcessOrderFact): string {
  if (order.sourceType === 'STOCK') {
    return `<div class="font-medium">${escapeHtml(PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType])}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.stockMaterial?.materialName || '-')}</div>`
  }
  if (order.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    return `<div class="font-medium">${escapeHtml(PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType])}</div><div class="mt-1 font-mono text-xs text-muted-foreground">补料单 ${escapeHtml(order.sourceSnapshot?.supplementRecordNo || '-')}</div>`
  }
  return `<div class="font-medium">${escapeHtml(PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType])}</div><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(order.sourceProductionOrderNo || order.sourceProductionOrderId || '-')}</div>`
}

function renderPlatformSyncSection(order: PrepProcessOrderFact): string {
  const followUpActionLabel = order.followUpActionLabel || '查看详情'
  return `
    <section class="rounded-lg border bg-muted/20 p-4">
      <h3 class="font-medium">平台同步结果</h3>
      <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><span class="text-muted-foreground">平台状态：</span>${escapeHtml(order.platformStatusLabel || order.status)}</div>
        <div><span class="text-muted-foreground">工厂内部状态：</span>${escapeHtml(order.factoryInternalStatusLabel || '-')}</div>
        <div><span class="text-muted-foreground">风险提示：</span>${escapeHtml(order.platformRiskLabel || '暂无风险')}</div>
        <div><span class="text-muted-foreground">下一步动作：</span>${escapeHtml(followUpActionLabel)}</div>
        <div class="sm:col-span-2"><span class="text-muted-foreground">最近同步：</span>${escapeHtml(order.latestOperationAt || order.updatedAt)} · ${escapeHtml(order.latestOperationBy || '系统')}</div>
      </div>
    </section>
  `
}

function renderSourceDetail(order: PrepProcessOrderFact): string {
  const rows = [`<div><span class="text-muted-foreground">来源：</span>${escapeHtml(PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType])}</div>`]
  if (order.sourceType === 'STOCK') {
    rows.push(`<div><span class="text-muted-foreground">备货物料：</span>${escapeHtml(order.stockMaterial?.materialName || '-')}</div>`)
    return rows.join('')
  }
  if (order.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    rows.push(`<div><span class="text-muted-foreground">补料单：</span>${escapeHtml(order.sourceSnapshot?.supplementRecordNo || '-')}</div>`)
    rows.push(`<div><span class="text-muted-foreground">原始裁片单：</span>${escapeHtml(order.sourceSnapshot?.originalCutOrderNo || '-')}</div>`)
  }
  rows.push(`<div><span class="text-muted-foreground">所属生产单：</span>${escapeHtml(order.sourceSnapshot?.productionOrderNo || order.sourceProductionOrderNo || '-')}</div>`)
  rows.push(`<div><span class="text-muted-foreground">技术包版本：</span>${escapeHtml(order.sourceSnapshot?.techPackVersionLabel || '-')}</div>`)
  rows.push(`<div><span class="text-muted-foreground">物料编码：</span>${escapeHtml(order.materialSku || '-')}</div>`)
  rows.push(`<div><span class="text-muted-foreground">物料名称：</span>${escapeHtml(order.materialName || '-')}</div>`)
  if (order.sourceSnapshot?.bomItemId) rows.push(`<div><span class="text-muted-foreground">BOM 行标识：</span>${escapeHtml(order.sourceSnapshot.bomItemId)}</div>`)
  return rows.join('')
}

function renderDetail(selectedWorkOrderId = state.selectedWorkOrderId): string {
  if (!selectedWorkOrderId) return ''
  const order = getOrders().find((item) => item.workOrderId === selectedWorkOrderId)
  if (!order) return ''
  const plannedQtyLabel = order.plannedQtyLabel || '计划加工数量'
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-print-order-action="close-detail"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">平台印花加工单</p><h2 class="mt-1 text-lg font-semibold">${escapeHtml(order.orderNo)}</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-print-order-action="close-detail">关闭</button>
      </div>
      <div class="mt-6 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
        ${renderSourceDetail(order)}
        <div><span class="text-muted-foreground">工厂：</span>${escapeHtml(order.factoryName)}</div>
        <div><span class="text-muted-foreground">${escapeHtml(plannedQtyLabel)}：</span>${escapeHtml(formatQty(order.plannedFeedQty, order.unit))}</div>
        <div><span class="text-muted-foreground">计划完成：</span>${escapeHtml(order.plannedFinishAt)}</div>
        <div><span class="text-muted-foreground">平台加工单号：</span>${escapeHtml(order.workOrderNo || order.orderNo)}</div>
      </div>
      <div class="mt-4">${renderPlatformSyncSection(order)}</div>
      <button class="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-print-order-action="navigate-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">打开工厂端详情</button>
    </aside>
  `
}

function renderInput(field: keyof PrintCreateForm, label: string, value: string, type = 'text', max?: number): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><input class="h-10 w-full rounded-md border bg-background px-3 text-sm" type="${type}" value="${escapeHtml(value)}" ${typeof max === 'number' ? `max="${max}"` : ''} data-skip-page-rerender="true" data-print-create-field="${field}" /></label>`
}

function renderSelect(field: keyof PrintCreateForm, label: string, options: Array<{ value: string; label: string }>, value: string, placeholder?: string, skipPageRerender = true): string {
  return `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">${label}</span><select class="h-10 w-full rounded-md border bg-background px-3 text-sm" ${skipPageRerender ? 'data-skip-page-rerender="true"' : ''} data-print-create-field="${field}">${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}${options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select></label>`
}

function renderCreate(): string {
  if (!state.createOpen) return ''
  const form = state.form
  const stockMaterials = getStockMaterials(form.factoryId)
  const selectedStock = stockMaterials.find((item) => item.stockMaterialId === form.stockMaterialId)
  return `
    <div class="fixed inset-0 z-40 bg-black/30" data-print-order-action="close-create"></div>
    <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div><p class="text-xs text-muted-foreground">固定来源：按备货创建</p><h2 class="mt-1 text-lg font-semibold">新建印花加工单</h2></div>
        <button class="rounded-md border px-3 py-2 text-sm" data-print-order-action="close-create">关闭</button>
      </div>
      <p class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">生产单来源由系统自动生成，只读且不能在此手工创建。</p>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">${renderSelect('stockMaterialId', '仓库备货库存', stockMaterials.map((item) => ({ value: item.stockMaterialId, label: `${item.stockMaterialName} / ${item.materialSku} / 可用 ${item.availableQty} ${item.qtyUnit}` })), form.stockMaterialId, '请选择真实库存')}</div>
        <div class="sm:col-span-2 rounded-md border bg-muted/20 p-3 text-sm" data-print-stock-selection-summary>${selectedStock ? `<div class="font-medium">${escapeHtml(selectedStock.stockMaterialName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(selectedStock.materialSku)} · ${escapeHtml(selectedStock.warehouseName)} · 可用 ${escapeHtml(String(selectedStock.availableQty))} ${escapeHtml(selectedStock.qtyUnit)}</div>` : '<span class="text-muted-foreground">选择库存后自动带出名称、编码、仓库与单位。</span>'}</div>
        ${renderInput('plannedQty', '计划数量', form.plannedQty, 'number', selectedStock?.availableQty)}
        <label class="block"><span class="mb-1 block text-xs text-muted-foreground">数量单位</span><input class="h-10 w-full rounded-md border bg-muted px-3 text-sm" value="${escapeHtml(form.qtyUnit)}" data-print-stock-unit readonly /></label>
        ${renderSelect('factoryId', '印花工厂', factories.map((factory) => ({ value: factory.id, label: factory.name })), form.factoryId, undefined, false)}
        ${renderInput('plannedFinishAt', '计划完成时间', form.plannedFinishAt, 'datetime-local')}
        <div class="sm:col-span-2">${renderInput('processName', '印花工艺', form.processName)}</div>
      </div>
      ${state.formError ? `<p class="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-print-create-error>${escapeHtml(state.formError)}</p>` : ''}
      <button class="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground" data-print-order-action="submit-create">创建印花加工单</button>
    </aside>
  `
}

const listColumns: StandardListColumn<PrepProcessOrderFact>[] = [
  { key: 'orderNo', title: '平台加工单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: (order) => order.workOrderNo || order.orderNo, render: (order) => `<span class="font-mono text-xs">${escapeHtml(order.workOrderNo || order.orderNo)}</span>` },
  { key: 'source', title: '来源', width: 210, required: true, freezeable: true, sortable: true, sortValue: (order) => order.sourceLabel, render: renderSource },
  { key: 'factory', title: '工厂', width: 180, sortable: true, sortValue: (order) => order.factoryName, render: (order) => escapeHtml(order.factoryName) },
  { key: 'qty', title: '计划数量', width: 145, sortable: true, align: 'right', sortValue: (order) => order.plannedFeedQty, render: (order) => escapeHtml(formatQty(order.plannedFeedQty, order.unit)) },
  { key: 'finishAt', title: '计划完成', width: 165, sortable: true, sortValue: (order) => order.plannedFinishAt, render: (order) => escapeHtml(order.plannedFinishAt) },
  { key: 'status', title: '平台状态', width: 135, sortable: true, sortValue: (order) => order.platformStatusLabel, render: renderStatus },
  { key: 'risk', title: '风险提示', width: 180, render: (order) => escapeHtml(order.platformRiskLabel || '-') },
  { key: 'next', title: '下一步动作', width: 170, render: (order) => escapeHtml(order.followUpActionLabel || '查看详情') },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: (order) => `<button class="text-primary hover:underline" data-print-order-action="open-detail" data-work-order-id="${escapeHtml(order.workOrderId || order.orderNo)}">查看</button>` },
]
const listColumnRules = listColumns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))

function defaultListPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(listColumnRules, { order: listColumns.map((column) => column.key), visibleKeys: listColumns.map((column) => column.key), frozenKeys: ['orderNo'], pageSize: 10 }, PAGE_SIZE_OPTIONS)
}

function ensureListPreferences(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultListPreferences()
  state.preferences = typeof window === 'undefined' ? defaults : loadListColumnPreferences(window.localStorage, LIST_PREFERENCE_KEY, listColumnRules, defaults, PAGE_SIZE_OPTIONS)
}

function getListView(sourceOverride?: SourceFilter) {
  const filtered = getFilteredOrders(sourceOverride)
  const sorted = sortStandardListRows(filtered, state.sort, (row, key) => listColumns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.page, state.preferences.pageSize)
  state.page = paging.currentPage
  return {
    tableHtml: renderStandardListTable({ columns: listColumns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: LIST_EVENT_PREFIX, emptyText: '暂无加工单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: LIST_EVENT_PREFIX, fieldPrefix: LIST_EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS })
      .replace('<select ', '<select data-skip-page-rerender="true" '),
  }
}

function renderColumnSettings(): string {
  return state.showColumnSettings
    ? renderStandardListColumnSettings({ title: '印花加工单列设置', columns: listColumns, preferences: state.preferences, eventPrefix: LIST_EVENT_PREFIX, maxFrozenWidth: 520 })
    : ''
}

function hydrateInsertedIcons(root: ParentNode): void {
  void import('../components/shell.ts').then(({ hydrateIcons }) => hydrateIcons(root)).catch(() => undefined)
}

function refreshListLocally(options: { table?: boolean; pagination?: boolean; overlays?: boolean } = {}): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>('[data-process-print-orders-root]')
  if (!root) return false
  const refreshTable = options.table !== false
  const refreshPagination = options.pagination !== false
  const view = refreshTable || refreshPagination ? getListView() : null
  const table = root.querySelector<HTMLElement>('[data-process-print-orders-table-surface]')
  const pagination = root.querySelector<HTMLElement>('[data-process-print-orders-pagination-surface]')
  const overlays = root.querySelector<HTMLElement>('[data-process-print-orders-overlays]')
  const scrollLeft = table?.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft ?? 0
  if (refreshTable && table && view) {
    table.innerHTML = view.tableHtml
    const nextScroll = table.querySelector<HTMLElement>('[data-standard-list-scroll]')
    if (nextScroll) nextScroll.scrollLeft = Math.min(scrollLeft, Math.max(0, nextScroll.scrollWidth - nextScroll.clientWidth))
    hydrateInsertedIcons(table)
  }
  if (refreshPagination && pagination && view) {
    pagination.innerHTML = view.paginationHtml
    hydrateInsertedIcons(pagination)
  }
  if (options.overlays && overlays) {
    overlays.innerHTML = renderColumnSettings()
    hydrateInsertedIcons(overlays)
  }
  return true
}

function refreshDetailLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-print-orders-detail]')
  if (!node) return
  node.innerHTML = renderDetail()
  hydrateInsertedIcons(node)
}

function refreshCreateLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-print-orders-create]')
  if (!node) return
  node.innerHTML = renderCreate()
  hydrateInsertedIcons(node)
}

function refreshFeedbackLocally(): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>('[data-process-print-orders-feedback]')
  if (node) node.innerHTML = state.notice ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">${escapeHtml(state.notice)}</div>` : ''
}

export function renderProcessPrintOrdersPage(options: { sourceType?: SourceFilter; selectedWorkOrderId?: string | null } = {}): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, typeof document !== 'undefined' && Boolean(document.querySelector('[data-process-print-orders-root]')))
  installListColumnDragEvents()
  ensureListPreferences()
  const view = getListView(options.sourceType)
  const statusOptions = listPlatformStatusOptions()
  const sourceFilter = options.sourceType ?? state.sourceFilter
  return `<div data-process-print-orders-root data-skip-page-rerender="true">${renderStandardListPage({
    title: '印花加工单',
    primaryActionsHtml: '<button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" data-print-order-action="create-new">按备货创建</button>',
    feedbackHtml: `<div data-process-print-orders-feedback>${state.notice ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">${escapeHtml(state.notice)}</div>` : ''}</div>`,
    filtersHtml: `<section class="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <input class="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2" placeholder="加工单号 / 生产单号 / 备货物料 / 工厂" value="${escapeHtml(state.keyword)}" data-print-order-field="keyword" />
        <select class="h-10 rounded-md border bg-background px-3 text-sm" data-print-order-field="statusFilter"><option>全部</option>${statusOptions.map((status) => `<option ${state.statusFilter === status ? 'selected' : ''}>${status}</option>`).join('')}</select>
        <select class="h-10 rounded-md border bg-background px-3 text-sm" data-print-order-field="sourceFilter"><option value="">全部来源</option>${Object.entries(PROCESS_WORK_ORDER_SOURCE_LABEL).map(([value, label]) => `<option value="${value}" ${sourceFilter === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>
      </section>`,
    listTitle: '印花加工单',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: LIST_EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: `<div data-process-print-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-process-print-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-process-print-orders-overlays>${renderColumnSettings()}</div>`,
  })}
    <div data-process-print-orders-detail>${renderDetail(options.selectedWorkOrderId === undefined ? state.selectedWorkOrderId : options.selectedWorkOrderId)}</div>
    <div data-process-print-orders-create>${renderCreate()}</div>
  </div>`
}

function installListColumnDragEvents(): void {
  if (listColumnDragInstalled || typeof document === 'undefined') return
  listColumnDragInstalled = true
  document.addEventListener('dragstart', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-process-print-orders-root] [data-standard-list-column-drag]') : null
    if (!target) return
    draggedListColumnKey = target.dataset.dragSource || ''
    event.dataTransfer?.setData('text/plain', draggedListColumnKey)
  })
  document.addEventListener('dragover', (event) => { if (event.target instanceof Element && event.target.closest('[data-process-print-orders-root] [data-drop-target]')) event.preventDefault() })
  document.addEventListener('drop', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-process-print-orders-root] [data-drop-target]') : null
    const sourceKey = draggedListColumnKey || event.dataTransfer?.getData('text/plain') || ''
    const targetKey = target?.dataset.dropTarget || ''
    draggedListColumnKey = ''
    if (!sourceKey || !targetKey || sourceKey === targetKey) return
    const order = state.preferences.order.filter((key) => key !== 'actions' && key !== sourceKey)
    const targetIndex = order.indexOf(targetKey)
    if (targetIndex < 0) return
    event.preventDefault()
    order.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(listColumnRules, { ...state.preferences, order: [...order, 'actions'] }, PAGE_SIZE_OPTIONS)
    if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, LIST_PREFERENCE_KEY, state.preferences)
    refreshListLocally({ pagination: false, overlays: true })
  })
}

function submitCreate(): void {
  const form = state.form
  const result = createPrintWorkOrderFromStock({
    stockMaterialId: form.stockMaterialId,
    stockMaterialName: form.stockMaterialName,
    materialSku: form.materialSku,
    factoryId: form.factoryId,
    plannedQty: Number(form.plannedQty),
    qtyUnit: form.qtyUnit,
    plannedFinishAt: form.plannedFinishAt.replace('T', ' '),
    processName: form.processName,
  })
  if (!result.ok || !result.order) {
    state.formError = result.message
    return
  }
  state.notice = `已创建印花加工单 ${result.order.printOrderNo}`
  state.createOpen = false
  state.form = defaultForm()
  state.formError = null
  state.page = Math.max(1, Math.ceil(getOrders().length / state.pageSize))
}

export function handleProcessPrintOrdersEvent(target: HTMLElement): boolean {
  const createField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-print-create-field]')
  if (createField) {
    const field = createField.dataset.printCreateField as keyof PrintCreateForm
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
      const unitInput = drawer?.querySelector<HTMLInputElement>('[data-print-stock-unit]')
      if (unitInput) unitInput.value = selected?.qtyUnit || ''
      const qtyInput = drawer?.querySelector<HTMLInputElement>('[data-print-create-field="plannedQty"]')
      if (qtyInput) {
        if (selected) qtyInput.max = String(selected.availableQty)
        else qtyInput.removeAttribute('max')
      }
      const summary = drawer?.querySelector<HTMLElement>('[data-print-stock-selection-summary]')
      if (summary) summary.textContent = selected
        ? `${selected.stockMaterialName} / ${selected.materialSku} / ${selected.warehouseName} / 可用 ${selected.availableQty} ${selected.qtyUnit}`
        : '选择库存后自动带出名称、编码、仓库与单位。'
    }
    state.formError = null
    createField.closest<HTMLElement>('aside')?.querySelector('[data-print-create-error]')?.remove()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-print-order-field]')
  if (field) {
    if (field.dataset.printOrderField === 'keyword') state.keyword = field.value
    if (field.dataset.printOrderField === 'statusFilter') state.statusFilter = field.value as typeof state.statusFilter
    if (field.dataset.printOrderField === 'sourceFilter') state.sourceFilter = field.value as SourceFilter
    state.page = 1
    refreshListLocally()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-print-order-action]')
  const listField = target.closest<HTMLSelectElement>('[data-print-order-list-field]')
  if (listField?.dataset.printOrderListField === 'pageSize') {
    const pageSize = Number(listField.value)
    state.preferences = { ...state.preferences, pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10 }
    state.page = 1
    if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, LIST_PREFERENCE_KEY, state.preferences)
    refreshListLocally()
    return true
  }
  const listAction = target.closest<HTMLElement>('[data-print-order-list-action]')
  if (listAction) {
    const action = listAction.dataset.printOrderListAction || ''
    if (action === 'prev-page' || action === 'next-page') state.page = Math.max(1, state.page + (action === 'next-page' ? 1 : -1))
    if (action === 'sort-column') { const key = listAction.dataset.columnKey || ''; state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null; state.page = 1 }
    if (action === 'open-column-settings') {
      state.showColumnSettings = true
      refreshListLocally({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'close-column-settings') {
      state.showColumnSettings = false
      refreshListLocally({ table: false, pagination: false, overlays: true })
      return true
    }
    if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
      const key = listAction.dataset.printOrderListColumnKey || listAction.closest<HTMLElement>('[data-print-order-list-column-key]')?.dataset.printOrderListColumnKey || ''
      const column = listColumns.find((item) => item.key === key)
      if (column && !column.actionColumn) {
        const visibleKeys = action === 'toggle-column-visibility' && !column.required
          ? (state.preferences.visibleKeys.includes(key) ? state.preferences.visibleKeys.filter((item) => item !== key) : [...state.preferences.visibleKeys, key])
          : state.preferences.visibleKeys
        const frozenKeys = action === 'toggle-column-freeze' && column.freezeable
          ? (state.preferences.frozenKeys.includes(key) ? state.preferences.frozenKeys.filter((item) => item !== key) : [...state.preferences.frozenKeys, key])
          : state.preferences.frozenKeys
        state.preferences = normalizeListColumnPreferences(listColumnRules, { ...state.preferences, visibleKeys, frozenKeys }, PAGE_SIZE_OPTIONS)
        if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, LIST_PREFERENCE_KEY, state.preferences)
      }
    }
    if (action === 'restore-column-settings') { if (typeof window !== 'undefined') clearListColumnPreferences(window.localStorage, LIST_PREFERENCE_KEY); state.preferences = defaultListPreferences(); state.sort = null; state.page = 1 }
    refreshListLocally({ overlays: state.showColumnSettings })
    return true
  }
  if (!actionNode) return Boolean(listField)
  const action = actionNode.dataset.printOrderAction
  if (action === 'navigate-detail') {
    const workOrderId = actionNode.dataset.workOrderId
    if (workOrderId) appStore.navigate(`/fcs/craft/printing/work-orders/${encodeURIComponent(workOrderId)}`)
    return true
  }
  if (action === 'open-detail') { state.selectedWorkOrderId = actionNode.dataset.workOrderId || null; refreshDetailLocally() }
  if (action === 'close-detail') { state.selectedWorkOrderId = null; refreshDetailLocally() }
  if (action === 'create-new') { state.createOpen = true; state.notice = null; state.formError = null; refreshCreateLocally(); refreshFeedbackLocally() }
  if (action === 'close-create') { state.createOpen = false; state.form = defaultForm(); state.formError = null; refreshCreateLocally() }
  if (action === 'submit-create') { submitCreate(); refreshCreateLocally(); refreshFeedbackLocally(); refreshListLocally() }
  if (action === 'page-prev') { state.page = Math.max(1, state.page - 1); refreshListLocally() }
  if (action === 'page-next') { state.page += 1; refreshListLocally() }
  if (action === 'close-all') { state.selectedWorkOrderId = null; state.createOpen = false; state.formError = null; refreshDetailLocally(); refreshCreateLocally() }
  return true
}

export function isProcessPrintOrdersDialogOpen(): boolean {
  return Boolean(state.selectedWorkOrderId || state.createOpen)
}
