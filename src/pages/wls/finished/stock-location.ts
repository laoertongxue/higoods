// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import type { AppState } from '../../../state/store'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  sortStandardListRows,
  loadListColumnPreferences,
  saveListColumnPreferences,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type StockLocationRow = {
  id: string;
  warehouseName: string;
  warehouseZone: string;
  warehouseLocation: string;
  spu: string;
  sku: string;
  quantity: number;
  updatedAt: string;
};

const STOCK_LOCATION_SEED: StockLocationRow[] = (() => {
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01'];
  const zones = ['A区', 'B区', 'C区'];
  const locations = ['A01-01', 'A01-02', 'A02-03', 'B01-02', 'B03-01', 'C01-01', 'C02-01'];
  const rows: StockLocationRow[] = [];

  for (let i = 0; i < 40; i++) {
    const wh = warehouses[i % warehouses.length];
    const zone = zones[i % zones.length];
    const loc = locations[i % locations.length];
    const dayOffset = Math.floor(i / 10);
    const baseDate = new Date(2026, 8, 18 - dayOffset, 10 + (i % 8), (i * 7) % 60);

    rows.push({
      id: `SL-${String(i + 1).padStart(5, '0')}`,
      warehouseName: wh,
      warehouseZone: zone,
      warehouseLocation: loc,
      spu: `SPU-GC-${String(10001 + (i % 20)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(20001 + i).padStart(5, '0')}`,
      quantity: 10 + (i * 7) % 120,
      updatedAt: baseDate.toISOString().slice(0, 16).replace('T', ' '),
    });
  }
  return rows;
})();

const EVENT_PREFIX = 'wls-finished-stock-location'
const PREFERENCE_KEY = '/wls/finished/stock/location:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  keyword: string
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<StockLocationRow>[] = [
  { key: 'warehouseName', title: '仓库名称', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'warehouseZone', title: '仓库库区', width: 100, sortable: true, sortValue: r => r.warehouseZone,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseZone)}</span>` },
  { key: 'warehouseLocation', title: '仓库库位', width: 110, sortable: true, sortValue: r => r.warehouseLocation,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseLocation)}</span>` },
  { key: 'spu', title: '商品SPU', width: 160, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-[var(--link)] text-xs">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="text-slate-600 text-xs">${escapeHtml(r.sku)}</span>` },
  { key: 'quantity', title: '库存数量', width: 100, align: 'right', sortable: true, sortValue: r => r.quantity,
    render: r => `<span class="font-medium text-slate-700">${r.quantity}</span>` },
  { key: 'updatedAt', title: '更新时间', width: 160, sortable: true, sortValue: r => r.updatedAt,
    render: r => `<span class="text-slate-500">${escapeHtml(r.updatedAt)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: [],
    pageSize: 20,
  }, [...PAGE_SIZE_OPTIONS])
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultPreferences()
  state.preferences = typeof window === 'undefined' || typeof document === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, [...PAGE_SIZE_OPTIONS])
}

function filteredRows(): StockLocationRow[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return [...STOCK_LOCATION_SEED]
  return STOCK_LOCATION_SEED.filter(r =>
    r.warehouseName.toLowerCase().includes(kw)
    || r.warehouseZone.toLowerCase().includes(kw)
    || r.warehouseLocation.toLowerCase().includes(kw)
    || r.spu.toLowerCase().includes(kw)
    || r.sku.toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索仓库名称 / 库区 / 库位 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const rows = filteredRows()
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => {
    const col = columns.find(c => c.key === key)
    return col?.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[key]
  })
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const totalQty = rows.reduce((sum, r) => sum + r.quantity, 0)

  return renderStandardListPage({
    title: '仓位库存查询',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '库存总量', value: totalQty },
      { label: '仓库数', value: new Set(rows.map(r => r.warehouseName)).size },
    ]),
    listTitle: `共 ${rows.length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无数据' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

export function renderFinishedStockLocation(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedStockLocationEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsFinishedStockLocationField
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      const pageSize = Number((field as HTMLSelectElement).value)
      state.preferences.pageSize = ([...PAGE_SIZE_OPTIONS] as number[]).includes(pageSize) ? pageSize as (typeof PAGE_SIZE_OPTIONS)[number] : 10
      state.currentPage = 1
      persistPreferences()
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.wlsFinishedStockLocationAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.wlsFinishedStockLocationColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsFinishedStockLocationColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { return true }
  return false
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find(item => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) visibleKeys = visibleKeys.includes(columnKey) ? visibleKeys.filter(key => key !== columnKey) : [...visibleKeys, columnKey]
  if (action === 'toggle-column-freeze' && column.freezeable) frozenKeys = frozenKeys.includes(columnKey) ? frozenKeys.filter(key => key !== columnKey) : [...frozenKeys, columnKey]
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, [...PAGE_SIZE_OPTIONS])
  persistPreferences()
  refreshWorkspace()
}
