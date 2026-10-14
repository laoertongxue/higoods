// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { transitMoveSeed, TRANSIT_WAREHOUSES, type TransitMoveRow } from './seed.ts'

const statusClass: Record<string, string> = {
  待执行: 'bg-amber-50 text-amber-700',
  执行中: 'bg-blue-50 text-blue-700',
  已完成: 'bg-emerald-50 text-emerald-700',
  已取消: 'bg-slate-100 text-slate-500',
}

const EVENT_PREFIX = 'wls-online-transit-move'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/transit-move:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  detailId: '',
  moveNo: '',
  sku: '',
  warehouseFilter: '' as string,
}

const columns: StandardListColumn<TransitMoveRow>[] = [
  { key: 'moveNo', title: '移货单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.moveNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.moveNo)}</span>` },
  { key: 'warehouseName', title: '仓库', width: 160, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'fromLocation', title: '调出仓位', width: 150, sortable: true, sortValue: r => r.fromLocation,
    render: r => `<span class="text-slate-600">${escapeHtml(r.fromLocation)}</span>` },
  { key: 'toLocation', title: '调入仓位', width: 150, sortable: true, sortValue: r => r.toLocation,
    render: r => `<span class="text-slate-600">${escapeHtml(r.toLocation)}</span>` },
  { key: 'spu', title: '商品SPU', width: 150, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'moveQtyText', title: '移货数量包装/Sku', width: 150, sortable: true, sortValue: r => r.moveQtyText,
    render: r => `<span class="text-slate-600">${escapeHtml(r.moveQtyText)}</span>` },
  { key: 'createdAt', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createdAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.createdAt)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 90, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['moveNo'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): TransitMoveRow[] {
  const moveNo = state.moveNo.trim().toLowerCase()
  const sku = state.sku.trim().toLowerCase()
  return transitMoveSeed.filter(r => {
    if (state.warehouseFilter && r.warehouseName !== state.warehouseFilter) return false
    if (moveNo && !r.moveNo.toLowerCase().includes(moveNo)) return false
    if (sku && !r.sku.toLowerCase().includes(sku)) return false
    return true
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">移货单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.moveNo)}" placeholder="移货单号" data-${EVENT_PREFIX}-field="moveNo"></label>
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">物料SKU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sku)}" placeholder="物料SKU" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库名称</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${TRANSIT_WAREHOUSES.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? transitMoveSeed.find(r => r.id === state.detailId) : undefined
  return renderStandardListPage({
    title: '中转移货',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('新增移货任务', { prefix: EVENT_PREFIX, action: 'create' }, 'plus')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '移货单数', value: `${transitMoveSeed.length} 条` },
      { label: '待执行', value: `${transitMoveSeed.filter(r => r.status === '待执行').length} 条` },
      { label: '执行中', value: `${transitMoveSeed.filter(r => r.status === '执行中').length} 条` },
      { label: '已完成', value: `${transitMoveSeed.filter(r => r.status === '已完成').length} 条` },
    ]),
    listTitle: '移货单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的移货单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: '中转移货列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '移货单明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
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

export function renderTransitMove(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitMoveEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'moveNo') { state.moveNo = field.value; return true }
    if (name === 'sku') { state.sku = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
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
    state.moveNo = read('moveNo')
    state.sku = read('sku')
    state.warehouseFilter = read('warehouse')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.moveNo = ''
    state.sku = ''
    state.warehouseFilter = ''
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
  if (action === 'create') { showListFeedback('新增移货任务为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '中转移货', columns, rows: filteredRows() }); return true }
  return false
}
