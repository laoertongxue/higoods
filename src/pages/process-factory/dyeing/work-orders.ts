// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderInput } from '../../../components/ui/form.ts'
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
import {
  DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
  type DyeWorkOrderOnlineFilters,
  type DyeWorkOrderOnlineRow,
} from '../../../data/fcs/dye-work-order-online-view.ts'
import { DYE_WORK_ORDER_ONLINE_STATUSES, type DyeWorkOrderOnlineStatus } from '../../../data/fcs/dye-work-order-online-domain.ts'
import { escapeHtml } from '../../../utils.ts'

const EVENT_PREFIX = 'dye-work-orders'
const PREFERENCE_KEY = '/fcs/craft/dyeing/work-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  filters: DyeWorkOrderOnlineFilters
  selectedIds: Set<string>
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
} = {
  currentPage: 1,
  filters: { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] },
  selectedIds: new Set(),
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['dyeInfo'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
}

let columnDragEventsInstalled = false
let draggedColumnKey = ''

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function statusTone(status: DyeWorkOrderOnlineStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === '已完成') return 'success'
  if (status === '取消') return 'neutral'
  if (status === '等待处理' || status === '待审核') return 'warning'
  if (status === '染色中' || status === '部分入库') return 'info'
  return 'success'
}

function renderActions(row: DyeWorkOrderOnlineRow): string {
  return `<div class="flex flex-wrap justify-end gap-1.5">
    ${renderSecondaryButton('查看', { prefix: EVENT_PREFIX, action: 'view', payload: { id: row.dyeOrderId } })}
    ${renderPrimaryButton('编辑', { prefix: EVENT_PREFIX, action: 'edit', payload: { id: row.dyeOrderId } })}
    ${renderSecondaryButton('日志', { prefix: EVENT_PREFIX, action: 'logs', payload: { id: row.dyeOrderId } })}
    ${renderSecondaryButton('打印流程卡', { prefix: EVENT_PREFIX, action: 'print-one', payload: { id: row.dyeOrderId } }, 'printer')}
  </div>`
}

const columns: StandardListColumn<DyeWorkOrderOnlineRow>[] = [
  {
    key: 'dyeInfo', title: '染色信息', width: 205, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.workOrderNo,
    render: (row) => `<div class="space-y-1.5">
      <label class="flex items-center gap-2"><input type="checkbox" ${state.selectedIds.has(row.dyeOrderId) ? 'checked' : ''} data-dye-work-orders-action="toggle-selection" data-id="${escapeHtml(row.dyeOrderId)}"><span class="font-mono font-medium text-blue-700">${escapeHtml(row.workOrderNo)}</span></label>
      <div class="text-xs text-muted-foreground">任务单号：${escapeHtml(row.taskNo)}</div>
      <div class="text-xs text-muted-foreground">生产单号：${escapeHtml(row.productionOrderNo || '—')}</div>
      <div class="text-xs text-muted-foreground">需求单号：${escapeHtml(row.demandNo)}</div>
      <div class="flex flex-wrap gap-1">${renderBadge(row.status, statusTone(row.status))}${row.isOverdue ? renderBadge('超期未完结', 'danger') : ''}</div>
    </div>`,
  },
  {
    key: 'product', title: '商品信息', width: 190, required: true, sortable: true,
    sortValue: (row) => row.productCode,
    render: (row) => `<div class="flex gap-2"><img src="${escapeHtml(row.productImageUrl)}" alt="商品图" class="h-16 w-12 rounded border object-cover"><div><div class="font-medium">${escapeHtml(row.productCode)}</div><div class="mt-1 text-xs text-muted-foreground">销售类型：${escapeHtml(row.salesType)}</div></div></div>`,
  },
  {
    key: 'purchase', title: '采购单信息', width: 190, sortable: true,
    sortValue: (row) => row.purchaseOrderNo,
    render: (row) => `<div class="space-y-1"><div>${escapeHtml(row.purchaseOrderNo)}：${escapeHtml(row.purchaseType)}</div><div class="text-xs">面料接收人：${escapeHtml(row.receiverName || '待分配')}</div><div class="text-xs text-red-600">接收人库存：${formatQty(row.receiverInventoryQty, row.qtyUnit)}</div><div class="text-xs text-red-600">GTG 仓库存：${formatQty(row.gtgInventoryQty, row.qtyUnit)}</div></div>`,
  },
  {
    key: 'material', title: '原料/面料', width: 250, required: true, sortable: true,
    sortValue: (row) => row.rawMaterialSku,
    render: (row) => `<div class="flex gap-2"><img src="${escapeHtml(row.materialImageUrl)}" alt="面料图" class="h-16 w-12 rounded border object-cover"><div class="min-w-0"><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="break-all font-mono text-xs text-muted-foreground">原料 SKU：${escapeHtml(row.rawMaterialSku)}</div><div class="break-all font-mono text-xs text-muted-foreground">染色 SKU：${escapeHtml(row.colorSku)}</div><div class="text-xs">待染数量：${formatQty(Math.max(0, row.plannedQty - row.completedQty), row.qtyUnit)}</div></div></div>`,
  },
  {
    key: 'attributes', title: '属性信息', width: 190, sortable: true,
    sortValue: (row) => row.processName,
    render: (row) => `<div class="space-y-1 text-xs"><div>工艺名称：${escapeHtml(row.processName)}</div><div>类型：${escapeHtml(row.materialType)}</div><div>深浅：${escapeHtml(row.shade || '—')}</div><div>温度：${row.temperature ? `${row.temperature}℃` : '—'}</div><div>成分：${escapeHtml(row.composition)}</div><div>幅宽：${escapeHtml(row.width || '—')}　克重：${row.weightGsm ?? '—'}</div></div>`,
  },
  {
    key: 'factoryTime', title: '时间/加工厂', width: 205, sortable: true,
    sortValue: (row) => row.plannedFinishAt,
    render: (row) => `<div class="space-y-1 text-xs"><div>加工厂：${escapeHtml(row.factoryName || '待分配工厂')}</div><div>下单时间：${escapeHtml(row.orderedAt)}</div><div>预计完成：${escapeHtml(row.plannedFinishAt || '—')}</div><div>完成时间：${escapeHtml(row.completedAt || '—')}</div><div>交货时间：${escapeHtml(row.deliveredAt || '—')}</div></div>`,
  },
  {
    key: 'qty', title: '数量', width: 165, sortable: true, align: 'right',
    sortValue: (row) => row.plannedQty,
    render: (row) => `<div class="space-y-1 text-xs"><div>计划数量：${formatQty(row.plannedQty, row.qtyUnit)}</div><div>原料使用：${formatQty(row.rawMaterialQty, row.qtyUnit)}</div><div>原料卷数：${row.rawMaterialRollCount} 卷</div><div>备料数量：${formatQty(row.preparedQty, row.qtyUnit)}</div><div>备料重量：${row.preparedWeightKg} kg</div><div>完成数量：${formatQty(row.completedQty, row.qtyUnit)}</div><div>损耗数量：${formatQty(row.lossQty, row.qtyUnit)}</div></div>`,
  },
  {
    key: 'extra', title: '附加信息', width: 175,
    render: (row) => `<div class="space-y-1 text-xs"><div>面料接收人：${escapeHtml(row.receiverName || '—')}</div><div>交出单号：${escapeHtml(row.handoverOrderNo || '—')}</div><div>头缸/复染：${escapeHtml(row.headVatOrRedye)}</div></div>`,
  },
  {
    key: 'otherQty', title: '其他数量', width: 160, sortable: true, align: 'right',
    sortValue: (row) => row.pendingInboundQty,
    render: (row) => `<div class="space-y-1 text-xs"><div>待回写：${row.pendingWritebackQty}</div><div>差异数量：${row.differenceQty}</div><div>异议数量：${row.objectionQty}</div><div>待回货数量：${formatQty(row.pendingInboundQty, row.qtyUnit)}</div></div>`,
  },
  { key: 'remark', title: '备注', width: 190, render: (row) => `<div class="whitespace-normal text-xs">${escapeHtml(row.remark || '—')}</div>` },
  { key: 'actions', title: '操作', width: 330, required: true, actionColumn: true, render: renderActions },
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

function selectField(label: string, field: string, options: string[], current: string, className = 'min-w-[9rem]'): string {
  return `<label class="${className}"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="${escapeHtml(field)}">${options.map((value) => option(value, current)).join('')}</select></label>`
}

function textField(label: string, field: string, value: string, placeholder = ''): string {
  return `<label class="min-w-[8rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span>${renderInput({ value, placeholder, prefix: EVENT_PREFIX, field })}</label>`
}

function uniqueValues(rows: DyeWorkOrderOnlineRow[], getValue: (row: DyeWorkOrderOnlineRow) => string): string[] {
  return ['', ...new Set(rows.map(getValue).filter(Boolean))]
}

function renderFilters(rows: DyeWorkOrderOnlineRow[]): string {
  const filters = state.filters
  return `<div class="space-y-3 rounded-lg border bg-card p-3">
    <div class="flex flex-wrap items-end gap-3">
      ${selectField('查询项', 'keywordField', ['全部', '加工单号', '任务单号', '生产单号', '采购单号', '商品编码'], filters.keywordField === 'all' ? '全部' : ({ workOrderNo: '加工单号', taskNo: '任务单号', productionOrderNo: '生产单号', purchaseOrderNo: '采购单号', productCode: '商品编码' } as Record<string, string>)[filters.keywordField] || '全部')}
      ${textField('查询内容', 'keyword', filters.keyword, '请输入查询内容')}
      ${selectField('状态', 'status', ['', ...DYE_WORK_ORDER_ONLINE_STATUSES], filters.statuses[0] || '', 'min-w-[8rem]')}
      ${selectField('销售类型', 'salesType', uniqueValues(rows, (row) => row.salesType), filters.salesType)}
      ${selectField('生产工厂', 'factoryName', uniqueValues(rows, (row) => row.factoryName), filters.factoryName)}
      ${selectField('染色工艺', 'processName', uniqueValues(rows, (row) => row.processName), filters.processName)}
      ${selectField('面料接收人', 'receiverName', uniqueValues(rows, (row) => row.receiverName), filters.receiverName)}
    </div>
    <div class="flex flex-wrap items-end gap-3">
      ${selectField('是否纱线', 'yarn', ['全部', '是', '否'], filters.yarn, 'min-w-[7rem]')}
      ${selectField('是否补料', 'replenishment', ['全部', '是', '否'], filters.replenishment, 'min-w-[7rem]')}
      ${selectField('GTG仓是否有库存', 'gtgInStock', ['全部', '是', '否'], filters.gtgInStock, 'min-w-[10rem]')}
      ${selectField('物料类型', 'materialType', ['', '面料', '纱线'], filters.materialType)}
      ${textField('染色色号', 'colorNo', filters.colorNo)}
      ${textField('成分', 'composition', filters.composition)}
      ${textField('幅宽', 'width', filters.width)}
      ${textField('克重', 'weightGsm', filters.weightGsm)}
      ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}
      ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}
    </div>
  </div>`
}

function renderSummaryValue(items: Array<{ unit: string; qty: number }>): string {
  return items.length ? items.map((item) => `${item.qty.toLocaleString('zh-CN')} ${item.unit}`).join(' / ') : '0'
}

function filteredRows(allRows: DyeWorkOrderOnlineRow[]): DyeWorkOrderOnlineRow[] {
  return filterDyeWorkOrderOnlineRows(allRows, state.filters)
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const allRows = listDyeWorkOrderOnlineRows()
  const rows = filteredRows(allRows)
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const summary = getDyeWorkOrderOnlineSummary(rows)
  return renderStandardListPage({
    title: '染色加工单',
    primaryActionsHtml: `<div class="flex flex-wrap gap-2">${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('导出备料数据', { prefix: EVENT_PREFIX, action: 'export-preparation' }, 'download')}${renderSecondaryButton('导出超期未完结', { prefix: EVENT_PREFIX, action: 'export-overdue' }, 'download')}${renderPrimaryButton('批量打印染整生产流程卡', { prefix: EVENT_PREFIX, action: 'batch-print' }, 'printer')}</div>`,
    filtersHtml: renderFilters(allRows),
    statsHtml: renderStandardListStats([
      { label: '计划数量', value: renderSummaryValue(summary.plannedQtyByUnit) },
      { label: '原料使用数量', value: renderSummaryValue(summary.rawMaterialQtyByUnit) },
      { label: '完成数量', value: renderSummaryValue(summary.completedQtyByUnit) },
      { label: '损耗数量', value: renderSummaryValue(summary.lossQtyByUnit) },
      { label: '采购单数量', value: summary.purchaseOrderCount },
    ]),
    listTitle: `染色加工单（已选 ${state.selectedIds.size} 项）`,
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

function readField(root: HTMLElement, field: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-dye-work-orders-field="${field}"]`)?.value.trim() || ''
}

function readFilters(root: HTMLElement): DyeWorkOrderOnlineFilters {
  const keywordFieldLabel = readField(root, 'keywordField')
  const keywordFieldMap: Record<string, DyeWorkOrderOnlineFilters['keywordField']> = { 全部: 'all', 加工单号: 'workOrderNo', 任务单号: 'taskNo', 生产单号: 'productionOrderNo', 采购单号: 'purchaseOrderNo', 商品编码: 'productCode' }
  const status = readField(root, 'status') as DyeWorkOrderOnlineStatus | ''
  return {
    ...state.filters,
    keywordField: keywordFieldMap[keywordFieldLabel] || 'all',
    keyword: readField(root, 'keyword'),
    statuses: status ? [status] : [],
    salesType: readField(root, 'salesType'),
    factoryName: readField(root, 'factoryName'),
    processName: readField(root, 'processName'),
    receiverName: readField(root, 'receiverName'),
    yarn: readField(root, 'yarn') as DyeWorkOrderOnlineFilters['yarn'],
    replenishment: readField(root, 'replenishment') as DyeWorkOrderOnlineFilters['replenishment'],
    gtgInStock: readField(root, 'gtgInStock') as DyeWorkOrderOnlineFilters['gtgInStock'],
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
  if (action === 'apply-filter') { state.filters = readFilters(root); state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.filters = { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] }; state.currentPage = 1; refreshWorkspace(); return true }
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
  return ['view', 'edit', 'logs', 'print-one', 'export', 'export-preparation', 'export-overdue', 'batch-print'].includes(action)
}
