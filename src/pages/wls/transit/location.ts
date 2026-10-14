// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type LocationStatus = '空闲' | '占用'

type LocationRecord = {
  locationCode: string; zone: string; status: LocationStatus; bindProductionNo: string
  skuCount: number; lastBindTime: string; warehouse: string
}

const statusClass: Record<string, string> = {
  '空闲': 'bg-slate-100 text-slate-500', '占用': 'bg-blue-50 text-blue-700',
}

const TAB_STATUSES: Array<'ALL' | LocationStatus> = ['ALL', '空闲', '占用']

const seedLocations: LocationRecord[] = [
  { locationCode: 'TR-A-01', zone: '中转仓货架区', status: '占用', bindProductionNo: 'PO14955', skuCount: 1, lastBindTime: '2026-07-12 16:30', warehouse: 'Hilon 中转仓' },
  { locationCode: 'TR-A-02', zone: '中转仓货架区', status: '占用', bindProductionNo: 'PO14956', skuCount: 1, lastBindTime: '2026-07-13 14:10', warehouse: 'Hilon 中转仓' },
  { locationCode: 'TR-A-03', zone: '中转仓货架区', status: '占用', bindProductionNo: 'PO14958', skuCount: 1, lastBindTime: '2026-07-12 17:10', warehouse: 'Hilon 中转仓' },
  { locationCode: 'TR-A-04', zone: '中转仓货架区', status: '占用', bindProductionNo: 'PO14963', skuCount: 1, lastBindTime: '2026-07-15 16:20', warehouse: 'Hilon 中转仓' },
  ...Array.from({ length: 11 }, (_, i) => ({
    locationCode: `TR-B-${String(i + 1).padStart(2, '0')}`, zone: '中转仓货架区', status: '空闲' as LocationStatus,
    bindProductionNo: '—', skuCount: 0, lastBindTime: '—', warehouse: 'Hilon 中转仓',
  })),
]

const EVENT_PREFIX = 'wls-transit-location'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/location:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  tab: 'ALL' as (typeof TAB_STATUSES)[number],
}

const columns: StandardListColumn<LocationRecord>[] = [
  { key: 'locationCode', title: '库位编号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.locationCode,
    render: r => `<span class="font-mono text-xs font-medium text-slate-700">${escapeHtml(r.locationCode)}</span>` },
  { key: 'zone', title: '所属库区', width: 140, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.zone)}</span>` },
  { key: 'status', title: '库位状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'bindProductionNo', title: '绑定生产单号', width: 130, sortable: true, sortValue: r => r.bindProductionNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.bindProductionNo)}</span>` },
  { key: 'lastBindTime', title: '最后绑定时间', width: 150, sortable: true, sortValue: r => r.lastBindTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.lastBindTime)}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 80, align: 'right', sortable: true, sortValue: r => r.skuCount,
    render: r => `<span class="text-slate-600">${r.skuCount}</span>` },
  { key: 'warehouse', title: '仓库', width: 140, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.warehouse)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['locationCode'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(l: LocationRecord): boolean {
  return state.tab === 'ALL' || l.status === state.tab
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: TAB_STATUSES.map(status => ({
      key: status,
      label: status === 'ALL' ? '全部' : status,
      count: status === 'ALL' ? seedLocations.length : seedLocations.filter(l => l.status === status).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): LocationRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedLocations.filter(l => {
    if (!tabMatches(l)) return false
    if (!kw) return true
    return `${l.locationCode} ${l.zone} ${l.bindProductionNo}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="库位编号 / 库区 / 绑定生产单号" data-${EVENT_PREFIX}-field="keyword"></label>
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
    description: '查看中转仓存储库位占用情况，数据来自库位主数据与上架库存汇总',
    statusTabsHtml: renderTabsHtml(),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '空闲', value: `${seedLocations.filter(l => l.status === '空闲').length} 条` },
      { label: '占用', value: `${seedLocations.filter(l => l.status === '占用').length} 条` },
    ]),
    listTitle: '库位列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的库位' }),
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
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓库位管理', columns, rows: filteredRows() }); return true }
  return false
}
