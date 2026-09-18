// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { listPmsWarehouses, syncPmsWarehouses, type PmsWarehouse } from '../../data/pms/warehouses.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { formatPmsTime, hydratePmsSurface, renderPmsFeedback, renderPmsStatusBadge } from './shared.ts'

interface WarehousePageState extends ProcessOrderListControllerState {
  keyword: string
  type: '' | PmsWarehouse['warehouseType']
  status: '' | '启用' | '停用'
  overlay: null | { warehouseCode: string }
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-wh'
const ROOT_SELECTOR = '[data-pms-wh-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

const state: WarehousePageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  type: '',
  status: '',
  overlay: null,
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsWarehouse[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsWarehouses().filter((warehouse) => {
    if (state.type && warehouse.warehouseType !== state.type) return false
    if (state.status && warehouse.status !== state.status) return false
    if (!keyword) return true
    return [warehouse.warehouseCode, warehouse.warehouseName, warehouse.city, warehouse.manager].some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<PmsWarehouse>[] = [
  {
    key: 'warehouse',
    title: '仓库',
    width: 280,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.warehouseName,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.warehouseName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.warehouseCode)} · ${escapeHtml(row.warehouseType)} · ${escapeHtml(row.warehouseAttribute)} · ${escapeHtml(row.countryOrRegion)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.address)}</div>`,
  },
  {
    key: 'manager',
    title: '负责人',
    width: 160,
    render: (row) => `<div class="text-sm">${escapeHtml(row.manager)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.phone)}</div>`,
  },
  {
    key: 'capacity',
    title: '面积',
    width: 130,
    sortable: true,
    sortValue: (row) => row.storageAreaM2,
    render: (row) => `<div class="text-sm tabular-nums">${row.storageAreaM2.toLocaleString('zh-CN')} ㎡</div>`,
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(row.status, row.status === '启用' ? 'green' : 'slate'),
  },
  {
    key: 'sync',
    title: '同步',
    width: 210,
    render: (row) => `<div class="text-sm">${escapeHtml(row.sourceSystem)} 只读引用</div><div class="mt-1 text-xs text-slate-500">同步于 ${formatPmsTime(row.syncedAt)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.remark || '—')}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    actionColumn: true,
    render: (row) => `<div class="flex items-center"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-warehouse-code="${escapeHtml(row.warehouseCode)}" data-skip-page-rerender="true">详情</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/warehouses',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-wh-table-surface]',
  paginationSurfaceSelector: '[data-pms-wh-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-wh-overlays]',
  defaultFrozenKeys: ['warehouse'],
  columnSettingsTitle: '仓库列设置',
  emptyText: '当前条件下暂无仓库',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const types: Array<'' | PmsWarehouse['warehouseType']> = ['', '面辅料仓', '加工仓', '成衣仓', '样衣仓', '中转仓', '退货仓']
  const typeOptions = types.map((value) => `<option value="${value}" ${state.type === value ? 'selected' : ''}>${value || '全部类型'}</option>`).join('')
  const statusOptions = ['', '启用', '停用'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = state.status ? 1 : 0
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="仓库编码 / 名称 / 城市 / 负责人" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="type" data-skip-page-rerender="true">${typeOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('刷新同步', { prefix: EVENT_PREFIX, action: 'sync' }, 'refresh-cw')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">仓库由 WMS 维护，采购侧只读引用</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '仓库总数', value: rows.length },
    { label: '启用仓库', value: rows.filter((row) => row.status === '启用').length },
    { label: '印尼仓库', value: rows.filter((row) => row.countryOrRegion === '印度尼西亚').length },
    { label: '总面积', value: `${rows.reduce((sum, row) => sum + row.storageAreaM2, 0).toLocaleString('zh-CN')} ㎡` },
  ])
}

function renderDetailOverlay(warehouseCode: string): string {
  const warehouse = listPmsWarehouses().find((row) => row.warehouseCode === warehouseCode)
  if (!warehouse) return ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="仓库详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[520px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(warehouse.warehouseName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(warehouse.warehouseCode)} · ${escapeHtml(warehouse.warehouseType)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <dl class="grid grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(warehouse.status, warehouse.status === '启用' ? 'green' : 'slate')}</dd></div><div><dt class="text-xs text-muted-foreground">国家/地区</dt><dd class="mt-1">${escapeHtml(warehouse.countryOrRegion)} · ${escapeHtml(warehouse.city)}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">地址</dt><dd class="mt-1">${escapeHtml(warehouse.address)}</dd></div><div><dt class="text-xs text-muted-foreground">负责人</dt><dd class="mt-1">${escapeHtml(warehouse.manager)} · ${escapeHtml(warehouse.phone)}</dd></div><div><dt class="text-xs text-muted-foreground">面积</dt><dd class="mt-1">${warehouse.storageAreaM2.toLocaleString('zh-CN')} ㎡</dd></div><div><dt class="text-xs text-muted-foreground">仓库属性 / 主体</dt><dd class="mt-1">${escapeHtml(warehouse.warehouseAttribute)} · ${escapeHtml(warehouse.ownerEntity)}</dd></div><div><dt class="text-xs text-muted-foreground">时区</dt><dd class="mt-1">${escapeHtml(warehouse.timezone)}</dd></div><div><dt class="text-xs text-muted-foreground">邮箱 / 邮编</dt><dd class="mt-1">${escapeHtml(warehouse.email || '—')} · ${escapeHtml(warehouse.postalCode || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">WMS 来源编码</dt><dd class="mt-1">${escapeHtml(warehouse.sourceWarehouseCode)}</dd></div><div><dt class="text-xs text-muted-foreground">同步状态</dt><dd class="mt-1">${renderPmsStatusBadge(warehouse.syncStatus, warehouse.syncStatus === '已同步' ? 'green' : 'yellow')}${warehouse.syncRemark ? ` · ${escapeHtml(warehouse.syncRemark)}` : ''}</dd></div><div><dt class="text-xs text-muted-foreground">可采购申请 / 下单 / 发货</dt><dd class="mt-1">${warehouse.availableForPurchaseRequest ? '是' : '否'} / ${warehouse.availableForPurchaseOrder ? '是' : '否'} / ${warehouse.availableForShipment ? '是' : '否'}</dd></div><div><dt class="text-xs text-muted-foreground">关联采购单</dt><dd class="mt-1 tabular-nums">${warehouse.relatedPurchaseOrderCount} 单</dd></div><div><dt class="text-xs text-muted-foreground">最近使用</dt><dd class="mt-1">${formatPmsTime(warehouse.recentUsedTime)}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">同步信息</dt><dd class="mt-1">${escapeHtml(warehouse.sourceSystem)} · ${formatPmsTime(warehouse.syncedAt)}</dd></div><div class="col-span-2"><dt class="text-xs text-muted-foreground">备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(warehouse.remark || '—')}</dd></div></dl>
  </div></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-wh-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return columnSettings
  return `${columnSettings}${renderDetailOverlay(state.overlay.warehouseCode)}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '仓库管理',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-wh-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-wh-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-wh-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-wh-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前条件下没有可导出的仓库。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '仓库管理.csv',
    ['仓库编码', '仓库名称', '类型', '国家/地区', '城市', '地址', '负责人', '电话', '面积(㎡)', '状态', '来源', '同步时间'],
    rows.map((row) => [row.warehouseCode, row.warehouseName, row.warehouseType, row.countryOrRegion, row.city, row.address, row.manager, row.phone, row.storageAreaM2, row.status, row.sourceSystem, row.syncedAt]),
  )
  state.feedback = `已导出 ${rows.length} 个仓库（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsWarehousesPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-wh-root data-skip-page-rerender="true"><style>[data-pms-wh-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsWarehouseOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsWarehousesEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsWhField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'type') {
      state.type = field.value as WarehousePageState['type']
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as WarehousePageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsWhAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.type = ''
    state.status = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'sync') {
    const result = syncPmsWarehouses(BUYER)
    state.feedback = `已从 WMS 同步 ${result.count} 个仓库档案（只读）。`
    state.feedbackOk = true
    refreshAll()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-wh-column-key]')?.dataset.pmsWhColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-detail') {
    state.overlay = { warehouseCode: actionNode?.dataset.warehouseCode || '' }
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    refreshOverlays()
    return true
  }
  return false
}
