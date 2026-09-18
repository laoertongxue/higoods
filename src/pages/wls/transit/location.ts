// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type LocationRecord = {
  locationCode: string; zone: string; status: string; bindProductionNo: string
  skuCount: number; materialQty: number; capacity: number
  lastBindTime: string; lastReleaseTime: string
}

const statusClass: Record<string, string> = {
  '空闲': 'bg-slate-100 text-slate-500', '已绑定': 'bg-blue-50 text-blue-700',
  '部分取用': 'bg-amber-50 text-amber-700', '已释放': 'bg-emerald-50 text-emerald-700', '禁用': 'bg-red-50 text-red-700',
}

const seedLocations: LocationRecord[] = [
  { locationCode: 'TR-A-01', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14955', skuCount: 1, materialQty: 3, capacity: 17, lastBindTime: '2026-07-12 16:30', lastReleaseTime: '—' },
  { locationCode: 'TR-A-02', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14956', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-13 14:10', lastReleaseTime: '—' },
  { locationCode: 'TR-A-03', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14958', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-12 17:10', lastReleaseTime: '—' },
  { locationCode: 'TR-A-04', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14963', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-15 16:20', lastReleaseTime: '—' },
  { locationCode: 'TR-A-05', zone: '中转仓货架区', status: '已绑定', bindProductionNo: 'PO14964', skuCount: 1, materialQty: 1, capacity: 19, lastBindTime: '2026-07-15 16:45', lastReleaseTime: '—' },
  ...Array.from({ length: 10 }, (_, i) => ({
    locationCode: `TR-B-${String(i + 1).padStart(2, '0')}`, zone: '中转仓货架区', status: '空闲',
    bindProductionNo: '—', skuCount: 0, materialQty: 0, capacity: 20,
    lastBindTime: '—', lastReleaseTime: '—',
  })),
]

const EVENT_PREFIX = 'wls-transit-location'
const PREFERENCE_KEY = '/wls/transit/location:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<LocationRecord>[] = [
  { key: 'locationCode', title: '库位编号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.locationCode,
    render: r => `<span class="font-mono text-xs text-slate-700 font-medium">${escapeHtml(r.locationCode)}</span>` },
  { key: 'zone', title: '所属库区', width: 140, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.zone)}</span>` },
  { key: 'status', title: '库位状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || ''}">${escapeHtml(r.status)}</span>` },
  { key: 'bindProductionNo', title: '绑定生产单', width: 120, sortable: true, sortValue: r => r.bindProductionNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.bindProductionNo)}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 80, align: 'right', sortable: true, sortValue: r => r.skuCount,
    render: r => `<span class="text-slate-600">${r.skuCount}</span>` },
  { key: 'materialQty', title: '库存数量', width: 90, align: 'right', sortable: true, sortValue: r => r.materialQty,
    render: r => `<span class="text-slate-600">${r.materialQty}</span>` },
  { key: 'capacity', title: '可用容量', width: 90, align: 'right', sortable: true, sortValue: r => r.capacity,
    render: r => `<span class="text-slate-600">${r.capacity}</span>` },
  { key: 'lastBindTime', title: '最后绑定', width: 140, sortable: true, sortValue: r => r.lastBindTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.lastBindTime)}</span>` },
  { key: 'lastReleaseTime', title: '最后释放', width: 140, sortable: true, sortValue: r => r.lastReleaseTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.lastReleaseTime)}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 ${r.materialQty > 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${r.materialQty > 0 ? 'disabled' : ''} data-${EVENT_PREFIX}-action="release">释放</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="disable">禁用</button></div>` },
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

function filteredRows(): LocationRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedLocations.filter(l => {
    if (state.statusFilter && l.status !== state.statusFilter) return false
    if (!kw) return true
    return `${l.locationCode} ${l.zone} ${l.bindProductionNo}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="库位编号 / 库区 / 绑定生产单" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">库位状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="空闲" ${state.statusFilter === '空闲' ? 'selected' : ''}>空闲</option><option value="已绑定" ${state.statusFilter === '已绑定' ? 'selected' : ''}>已绑定</option><option value="部分取用" ${state.statusFilter === '部分取用' ? 'selected' : ''}>部分取用</option><option value="已释放" ${state.statusFilter === '已释放' ? 'selected' : ''}>已释放</option><option value="禁用" ${state.statusFilter === '禁用' ? 'selected' : ''}>禁用</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓库位管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '已绑定', value: `${seedLocations.filter(l => l.status === '已绑定').length} 条` },
      { label: '空闲', value: `${seedLocations.filter(l => l.status === '空闲').length} 条` },
      { label: '库存总量', value: `${seedLocations.reduce((s, l) => s + l.materialQty, 0)}` },
    ]),
    listTitle: '库位列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无库位' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '库位列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitLocation(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitLocationEvent(target: HTMLElement, event?: Event): boolean {
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
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
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
  if (action === 'export') { return true }
  return false
}
