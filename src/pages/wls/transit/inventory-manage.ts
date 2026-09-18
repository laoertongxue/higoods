// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type InventoryRow = {
  locationCode: string; zone: string; sku: string; name: string
  qty: number; area: string; lastMoveTime: string
}

const areaClass: Record<string, string> = {
  '作业区': 'bg-blue-50 text-blue-700', '货架区': 'bg-emerald-50 text-emerald-700',
  '暂存区': 'bg-amber-50 text-amber-700', '仓库区': 'bg-slate-100 text-slate-500',
}

const seedRows: InventoryRow[] = [
  { locationCode: 'TR-A-01', zone: '中转仓货架区', sku: 'FAB-PO14954-A', name: '主身面料', qty: 3, area: '货架区', lastMoveTime: '2026-07-16 09:36' },
  { locationCode: 'TR-A-02', zone: '中转仓货架区', sku: 'FAB-PO14955-A', name: '主身面料', qty: 5, area: '货架区', lastMoveTime: '2026-07-16 10:46' },
  { locationCode: 'TR-A-03', zone: '中转仓货架区', sku: 'FAB-PO14956-A', name: '主身面料', qty: 4, area: '货架区', lastMoveTime: '2026-07-16 11:21' },
  { locationCode: 'TR-A-04', zone: '中转仓货架区', sku: 'FAB-PO14963-A', name: '主身面料', qty: 8, area: '货架区', lastMoveTime: '2026-07-16 15:06' },
  { locationCode: 'TR-A-05', zone: '中转仓货架区', sku: 'FAB-PO14964-A', name: '主身面料', qty: 5, area: '货架区', lastMoveTime: '2026-07-16 15:13' },
  { locationCode: 'TR-W-01', zone: '中转仓暂存区', sku: 'FAB-PO14958-A', name: '主身面料', qty: 7, area: '暂存区', lastMoveTime: '2026-07-16 09:43' },
  { locationCode: 'TR-W-02', zone: '中转仓暂存区', sku: 'FAB-PO14956-A', name: '主身面料', qty: 6, area: '暂存区', lastMoveTime: '2026-07-16 11:21' },
  { locationCode: 'TR-P-01', zone: '中转仓作业区', sku: 'FAB-PO14954-A', name: '主身面料', qty: 6, area: '作业区', lastMoveTime: '2026-07-16 09:36' },
  { locationCode: 'TR-P-02', zone: '中转仓作业区', sku: 'ACC-PO14954-B', name: '辅料包', qty: 2, area: '作业区', lastMoveTime: '2026-07-16 09:36' },
  { locationCode: 'TR-P-03', zone: '中转仓作业区', sku: 'FAB-PO14958-A', name: '主身面料', qty: 6, area: '作业区', lastMoveTime: '2026-07-16 09:43' },
]

const EVENT_PREFIX = 'wls-transit-inventory'
const PREFERENCE_KEY = '/wls/transit/inventory-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<InventoryRow>[] = [
  { key: 'locationCode', title: '库位编号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.locationCode,
    render: r => `<span class="font-mono text-xs text-slate-700 font-medium">${escapeHtml(r.locationCode)}</span>` },
  { key: 'zone', title: '所属库区', width: 130, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.zone)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '物料名称', width: 100, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'qty', title: '库存数量', width: 90, align: 'right', sortable: true, sortValue: r => r.qty,
    render: r => `<span class="font-medium text-slate-700">${r.qty}</span>` },
  { key: 'area', title: '库存区域', width: 90, sortable: true, sortValue: r => r.area,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${areaClass[r.area] || ''}">${escapeHtml(r.area)}</span>` },
  { key: 'lastMoveTime', title: '最近变动', width: 140, sortable: true, sortValue: r => r.lastMoveTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.lastMoveTime)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: () => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看明细</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['locationCode'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): InventoryRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (state.statusFilter && r.area !== state.statusFilter) return false
    if (!kw) return true
    return `${r.locationCode} ${r.zone} ${r.sku} ${r.name}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="库位编号 / 库区 / SKU / 物料名称" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">库存区域</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="作业区" ${state.statusFilter === '作业区' ? 'selected' : ''}>作业区</option><option value="货架区" ${state.statusFilter === '货架区' ? 'selected' : ''}>货架区</option><option value="暂存区" ${state.statusFilter === '暂存区' ? 'selected' : ''}>暂存区</option><option value="仓库区" ${state.statusFilter === '仓库区' ? 'selected' : ''}>仓库区</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓库存管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '库存总量', value: `${seedRows.reduce((s, r) => s + r.qty, 0)}` },
      { label: '作业区', value: `${seedRows.filter(r => r.area === '作业区').length} 条` },
      { label: '货架区', value: `${seedRows.filter(r => r.area === '货架区').length} 条` },
    ]),
    listTitle: '库存列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无库存记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '库存列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
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
  const action = actionNode?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') {
    state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1))
    refreshWorkspace()
    return true
  }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (select) state.statusFilter = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'restore-column-settings') { state.preferences = defaultPreferences(); saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences); refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  return false
}
