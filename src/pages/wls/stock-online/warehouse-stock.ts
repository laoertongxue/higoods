// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowEditDialog, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { warehouseStockSeed, WAREHOUSE_STOCK_ZONES, WAREHOUSE_STOCK_WAREHOUSES, type WarehouseStockRow } from './seed.ts'

const stockTypeClass: Record<string, string> = {
  正常: 'bg-emerald-50 text-emerald-700',
  冻结: 'bg-slate-100 text-slate-600',
  次品: 'bg-red-50 text-red-700',
  待上架: 'bg-amber-50 text-amber-700',
}

const EVENT_PREFIX = 'wls-online-warehouse-stock'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/warehouse-stock:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  creating: false,
  detailId: '',
  keyword: '',
  warehouseFilter: '' as string,
  zoneFilter: '' as string,
  staleFilter: '' as string,
  minQty: '',
  maxQty: '',
}

const columns: StandardListColumn<WarehouseStockRow>[] = [
  { key: 'select', title: '勾选', width: 50, required: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'spu', title: 'SPU', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: 'SKU', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'zone', title: '库区', width: 90, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-slate-600">${escapeHtml(r.zone)}</span>` },
  { key: 'stockType', title: '库存类型', width: 100, sortable: true, sortValue: r => r.stockType,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockTypeClass[r.stockType] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.stockType)}</span>` },
  { key: 'locationCode', title: '库位', width: 120, sortable: true, sortValue: r => r.locationCode,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.locationCode)}</span>` },
  { key: 'onHand', title: '现有', width: 80, align: 'right', sortable: true, sortValue: r => r.onHand,
    render: r => `<span class="font-medium text-slate-700">${r.onHand}</span>` },
  { key: 'locked', title: '锁定', width: 80, align: 'right', sortable: true, sortValue: r => r.locked,
    render: r => `<span class="${r.locked > 0 ? 'text-red-700 font-semibold' : 'text-slate-400'}">${r.locked}</span>` },
  { key: 'available', title: '可用', width: 80, align: 'right', sortable: true, sortValue: r => r.available,
    render: r => `<span class="font-semibold text-emerald-700">${r.available}</span>` },
  { key: 'warehouseName', title: '仓库', width: 160, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'countedAt', title: '盘点时间', width: 150, sortable: true, sortValue: r => r.countedAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.countedAt)}</span>` },
  { key: 'updatedAt', title: '更新时间', width: 150, sortable: true, sortValue: r => r.updatedAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.updatedAt)}</span>` },
  { key: 'actions', title: '操作', width: 90, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['spu', 'sku'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

const STALE_DAYS = 15

function staleCutoff(): string {
  const latest = [...warehouseStockSeed].map(r => r.countedAt).sort().at(-1) || ''
  const date = new Date(latest.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  date.setDate(date.getDate() - STALE_DAYS)
  return date.toISOString().slice(0, 10)
}

function isStale(row: WarehouseStockRow): boolean {
  const cutoff = staleCutoff()
  if (!cutoff) return false
  return (row.countedAt.slice(0, 10) || '') < cutoff
}

function filteredRows(): WarehouseStockRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const min = state.minQty.trim() === '' ? null : Number(state.minQty)
  const max = state.maxQty.trim() === '' ? null : Number(state.maxQty)
  return warehouseStockSeed.filter(r => {
    if (state.warehouseFilter && r.warehouseName !== state.warehouseFilter) return false
    if (state.zoneFilter && r.zone !== state.zoneFilter) return false
    if (state.staleFilter === '仅15天未盘点' && !isStale(r)) return false
    if (min !== null && Number.isFinite(min) && r.onHand < min) return false
    if (max !== null && Number.isFinite(max) && r.onHand > max) return false
    if (!kw) return true
    return `${r.spu} ${r.sku} ${r.zone} ${r.locationCode} ${r.warehouseName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="SPU / SKU / 库区 / 库位" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${WAREHOUSE_STOCK_WAREHOUSES.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">库区类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="zone"><option value="">全部类型</option>${WAREHOUSE_STOCK_ZONES.map(z => `<option value="${escapeHtml(z)}" ${state.zoneFilter === z ? 'selected' : ''}>${escapeHtml(z)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">库存-15天未盘点</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="stale"><option value="">全部</option><option value="仅15天未盘点" ${state.staleFilter === '仅15天未盘点' ? 'selected' : ''}>仅 15 天未盘点</option></select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">数量最小</span><input type="number" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.minQty)}" placeholder="最小" data-${EVENT_PREFIX}-field="minQty"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">数量最大</span><input type="number" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.maxQty)}" placeholder="最大" data-${EVENT_PREFIX}-field="maxQty"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? warehouseStockSeed.find(r => r.id === state.detailId) : undefined
  const uniqueSkuCount = new Set(all.map(r => r.spu)).size
  const totalStock = all.reduce((sum, r) => sum + r.onHand, 0)
  const staleSkuCount = new Set(all.filter(isStale).map(r => r.spu)).size
  const fmStock = all.filter(r => r.warehouseName === 'F&M WH').reduce((sum, r) => sum + r.onHand, 0)
  const acStock = all.filter(r => r.warehouseName === 'A&C WH').reduce((sum, r) => sum + r.onHand, 0)
  return renderStandardListPage({
    title: '仓库库存管理',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('创建盘点单', { prefix: EVENT_PREFIX, action: 'create' }, 'plus')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总 SKU', value: `${uniqueSkuCount} 个` },
      { label: '总库存', value: `${totalStock} 件` },
      { label: '净增长（今日）', value: '0 件' },
      { label: '15天未盘点 SKU', value: `${staleSkuCount} 个` },
      { label: '分仓 F&M WH', value: `${fmStock} 件` },
      { label: '分仓 A&C WH', value: `${acStock} 件` },
    ]),
    listTitle: '库存列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的库存记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: '仓库库存管理列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '库存明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
      state.creating ? renderStandardRowEditDialog({
        title: '创建盘点单',
        description: '选择盘点仓库与范围后创建，生成后为待处理盘点单。',
        fields: [
          { key: 'warehouse', label: '盘点仓库', value: '' },
          { key: 'zone', label: '库区类型', value: '' },
          { key: 'scope', label: '盘点范围 (SPU/SKU/库位)', value: '' },
        ],
        eventPrefix: EVENT_PREFIX,
      }) : '',
    ].join(''),
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

export function renderWarehouseStock(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWarehouseStockEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'zone') { state.zoneFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'stale') { state.staleFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'minQty') { state.minQty = field.value; return true }
    if (name === 'maxQty') { state.maxQty = field.value; return true }
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
    const root = rootElement()
    const read = (name: string) => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${name}"]`)?.value ?? ''
    state.keyword = read('keyword')
    state.warehouseFilter = read('warehouse')
    state.zoneFilter = read('zone')
    state.staleFilter = read('stale')
    state.minQty = read('minQty')
    state.maxQty = read('maxQty')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.warehouseFilter = ''
    state.zoneFilter = ''
    state.staleFilter = ''
    state.minQty = ''
    state.maxQty = ''
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
  if (action === 'view-detail') { state.detailId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''; refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailId = ''; refreshWorkspace(); return true }
  if (action === 'create') { state.creating = true; refreshWorkspace(); return true }
  if (action === 'cancel-edit') { state.creating = false; refreshWorkspace(); return true }
  if (action === 'save-edit') {
    const root = rootElement()
    const pick = (key: string) => root?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit="${key}"]`)?.value.trim() || ''
    const warehouse = pick('warehouse')
    const scope = pick('scope')
    if (!warehouse || !scope) {
      showListFeedback('请填写盘点仓库与盘点范围', 'warning')
      return true
    }
    state.creating = false
    showListFeedback(`已创建盘点单，仓库 ${warehouse}，范围 ${scope}，状态待处理`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '仓库库存管理', columns, rows: filteredRows() }); return true }
  return false
}
