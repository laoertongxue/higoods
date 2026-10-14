// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

type InventoryStatus = '待上架' | '已上架' | '已出库'

type InventoryRow = {
  productionNo: string; sku: string; zone: string; location: string
  pendingQty: number; shelfQty: number; outboundQty: number
  warehouse: string; status: InventoryStatus; updateTime: string
}

const statusClass: Record<string, string> = {
  '待上架': 'bg-orange-50 text-orange-700', '已上架': 'bg-emerald-50 text-emerald-700', '已出库': 'bg-blue-50 text-blue-700',
}

const TAB_STATUSES: Array<'ALL' | InventoryStatus> = ['ALL', '待上架', '已上架', '已出库']

const seedRows: InventoryRow[] = [
  { productionNo: 'PO14954', sku: 'FAB-PO14954-A', zone: '中转仓货架区', location: 'TR-A-03', pendingQty: 0, shelfQty: 6, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '已上架', updateTime: '2026-07-16 10:20' },
  { productionNo: 'PO14955', sku: 'FAB-PO14955-A', zone: '中转仓货架区', location: 'TR-A-01', pendingQty: 5, shelfQty: 0, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '待上架', updateTime: '2026-07-16 11:30' },
  { productionNo: 'PO14956', sku: 'FAB-PO14956-A', zone: '中转仓货架区', location: 'TR-A-02', pendingQty: 4, shelfQty: 0, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '待上架', updateTime: '2026-07-16 13:10' },
  { productionNo: 'PO14957', sku: 'FAB-PO14957-A', zone: '中转仓货架区', location: 'TR-A-04', pendingQty: 0, shelfQty: 0, outboundQty: 5, warehouse: 'Hilon 中转仓', status: '已出库', updateTime: '2026-07-16 15:06' },
  { productionNo: 'PO14962', sku: 'FAB-PO14962-A', zone: '中转仓货架区', location: 'TR-A-06', pendingQty: 0, shelfQty: 0, outboundQty: 6, warehouse: 'Hilon 中转仓', status: '已出库', updateTime: '2026-07-16 15:40' },
  { productionNo: 'PO14963', sku: 'FAB-PO14963-A', zone: '中转仓货架区', location: 'TR-A-07', pendingQty: 0, shelfQty: 8, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '已上架', updateTime: '2026-07-16 16:01' },
  { productionNo: 'PO14964', sku: 'FAB-PO14964-A', zone: '中转仓货架区', location: 'TR-A-05', pendingQty: 4, shelfQty: 0, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '待上架', updateTime: '2026-07-16 15:20' },
  { productionNo: 'PO14958', sku: 'FAB-PO14958-A', zone: '中转仓暂存区', location: 'TR-W-01', pendingQty: 7, shelfQty: 0, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '待上架', updateTime: '2026-07-16 09:43' },
  { productionNo: 'PO14959', sku: 'FAB-PO14959-A', zone: '中转仓暂存区', location: 'TR-W-02', pendingQty: 6, shelfQty: 0, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '待上架', updateTime: '2026-07-16 13:10' },
  { productionNo: 'PO14940', sku: 'FAB-PO14940-A', zone: '中转仓货架区', location: 'TR-B-03', pendingQty: 0, shelfQty: 5, outboundQty: 0, warehouse: 'Hilon 中转仓', status: '已上架', updateTime: '2026-07-15 09:05' },
]

const EVENT_PREFIX = 'wls-transit-inventory'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/inventory-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  detailIdx: -1,
  showColumnSettings: false,
  keyword: '',
  tab: 'ALL' as (typeof TAB_STATUSES)[number],
}

const columns: StandardListColumn<InventoryRow>[] = [
  { key: 'productionNo', title: '生产单号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'sku', title: 'SKU', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'zone', title: '库区', width: 130, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.zone)}</span>` },
  { key: 'location', title: '库位', width: 100, sortable: true, sortValue: r => r.location,
    render: r => `<span class="font-mono text-xs text-slate-700">${escapeHtml(r.location)}</span>` },
  { key: 'pendingQty', title: '待上架数量', width: 100, align: 'right', sortable: true, sortValue: r => r.pendingQty,
    render: r => `<span class="${r.pendingQty > 0 ? 'font-medium text-orange-600' : 'text-slate-400'}">${r.pendingQty}</span>` },
  { key: 'shelfQty', title: '货架数量', width: 100, align: 'right', sortable: true, sortValue: r => r.shelfQty,
    render: r => `<span class="font-medium text-slate-700">${r.shelfQty}</span>` },
  { key: 'outboundQty', title: '出库数量', width: 100, align: 'right', sortable: true, sortValue: r => r.outboundQty,
    render: r => `<span class="text-slate-600">${r.outboundQty}</span>` },
  { key: 'warehouse', title: '仓库', width: 130, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.warehouse)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'updateTime', title: '更新时间', width: 140, sortable: true, sortValue: r => r.updateTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.updateTime)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-barcode" data-${EVENT_PREFIX}-idx="${ seedRows.indexOf(r) }">查看条码</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['productionNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(r: InventoryRow): boolean {
  return state.tab === 'ALL' || r.status === state.tab
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: TAB_STATUSES.map(status => ({
      key: status,
      label: status === 'ALL' ? '全部' : status,
      count: status === 'ALL' ? seedRows.length : seedRows.filter(r => r.status === status).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): InventoryRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (!tabMatches(r)) return false
    if (!kw) return true
    return `${r.productionNo} ${r.sku} ${r.zone} ${r.location}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="生产单号 / SKU / 库位" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓库存查询',
    description: '按生产单、SKU、库位查看中转仓库位库存（独立于旧中转库存）',
    statusTabsHtml: renderTabsHtml(),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待上架', value: `${seedRows.filter(r => r.status === '待上架').length} 条` },
      { label: '已上架', value: `${seedRows.filter(r => r.status === '已上架').length} 条` },
      { label: '已出库', value: `${seedRows.filter(r => r.status === '已出库').length} 条` },
    ]),
    listTitle: '库存列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的库存记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '库存列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedRows[state.detailIdx] ? renderStandardRowDetailDialog({ title: '中转仓库存详情', columns, row: seedRows[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

export function renderTransitInventoryManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitInventoryManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.preferences.pageSize = Number((field as HTMLSelectElement).value)
      state.currentPage = 1
      saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as (typeof TAB_STATUSES)[number]
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${DATASET_PREFIX}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${DATASET_PREFIX}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  if (action === 'view-barcode') { const row = seedRows[Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])]; if (row) showListFeedback(`SKU ${row.sku} 的条码为演示内容`, 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓库存查询', columns, rows: filteredRows() }); return true }
  return false
}
