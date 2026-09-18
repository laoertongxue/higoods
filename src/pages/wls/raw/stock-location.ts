// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type StockLocationRow = {
  warehouse: string; zone: string; location: string
  spu: string; sku: string; qty: string; updatedAt: string
}

const seedRows: StockLocationRow[] = [
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-01', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', qty: '12 卷 / 960 米', updatedAt: '2026-05-30 14:20' },
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-02', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50002', qty: '8 卷 / 640 米', updatedAt: '2026-05-30 14:25' },
  { warehouse: '中央总仓-面料仓', zone: '面料区A', location: 'FAB-A-03', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50003', qty: '5 卷 / 400 米', updatedAt: '2026-05-30 14:30' },
  { warehouse: '中央总仓-面料仓', zone: '面料区B', location: 'FAB-B-01', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50004', qty: '20 卷 / 1600 米', updatedAt: '2026-05-30 15:00' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料货架区', location: 'TRM-A-01', spu: 'SPU-TRM-1001', sku: 'SKU-TRM-50001', qty: '30 包 / 15000 颗', updatedAt: '2026-05-30 13:10' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料货架区', location: 'TRM-A-02', spu: 'SPU-TRM-1002', sku: 'SKU-TRM-50002', qty: '18 包 / 9000 颗', updatedAt: '2026-05-30 13:15' },
  { warehouse: '中央总仓-辅料仓', zone: '辅料暂存区', location: 'TRM-T-01', spu: 'SPU-TRM-1003', sku: 'SKU-TRM-50003', qty: '6 包 / 3000 颗', updatedAt: '2026-05-30 13:20' },
  { warehouse: '中央总仓-耗材仓', zone: '耗材区', location: 'CON-A-01', spu: 'SPU-CON-1001', sku: 'SKU-CON-50001', qty: '24 箱 / 2880 个', updatedAt: '2026-05-30 12:00' },
  { warehouse: '中央总仓-耗材仓', zone: '耗材区', location: 'CON-A-02', spu: 'SPU-CON-1002', sku: 'SKU-CON-50002', qty: '10 箱 / 1200 个', updatedAt: '2026-05-30 12:05' },
  { warehouse: '中央总仓-包材仓', zone: '包材区', location: 'PKG-A-01', spu: 'SPU-PKG-1001', sku: 'SKU-PKG-50001', qty: '40 包 / 8000 个', updatedAt: '2026-05-30 11:30' },
  { warehouse: '中央总仓-纱线仓', zone: '纱线区', location: 'YRN-A-01', spu: 'SPU-YRN-1001', sku: 'SKU-YRN-50001', qty: '15 卷 / 1200 米', updatedAt: '2026-05-30 10:40' },
  { warehouse: '中央总仓-纱线仓', zone: '纱线区', location: 'YRN-A-02', spu: 'SPU-YRN-1002', sku: 'SKU-YRN-50002', qty: '8 卷 / 640 米', updatedAt: '2026-05-30 10:45' },
]

const EVENT_PREFIX = 'wls-raw-stock-location'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/stock-location:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<StockLocationRow>[] = [
  { key: 'warehouse', title: '仓库名称', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.warehouse)}</span>` },
  { key: 'zone', title: '仓库库区', width: 120, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-slate-600">${escapeHtml(r.zone)}</span>` },
  { key: 'location', title: '仓库库位', width: 110, sortable: true, sortValue: r => r.location,
    render: r => `<span class="font-mono text-xs text-slate-700">${escapeHtml(r.location)}</span>` },
  { key: 'spu', title: '商品SPU', width: 130, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-blue-600 text-xs font-mono">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 130, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="text-slate-600 text-xs font-mono">${escapeHtml(r.sku)}</span>` },
  { key: 'qty', title: '库存数量', width: 140, align: 'right', sortable: true, sortValue: r => r.qty,
    render: r => `<span class="text-slate-700 font-medium whitespace-nowrap">${escapeHtml(r.qty)}</span>` },
  { key: 'updatedAt', title: '更新时间', width: 140, sortable: true, sortValue: r => r.updatedAt,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.updatedAt)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['warehouse'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): StockLocationRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (!kw) return true
    return `${r.warehouse} ${r.zone} ${r.location} ${r.spu} ${r.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="仓库名称 / 库区 / 库位 / 商品SPU / 商品SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '仓位库存查询',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '仓库数', value: `${new Set(seedRows.map(r => r.warehouse)).size} 个` },
      { label: '库区数', value: `${new Set(seedRows.map(r => r.zone)).size} 个` },
    ]),
    listTitle: '库存分布',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无仓位库存记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '仓位库存列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawStockLocation(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawStockLocationEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'export') { exportStandardListRows({ fileName: '仓位库存查询', columns, rows: filteredRows() }); return true }
  return false
}
