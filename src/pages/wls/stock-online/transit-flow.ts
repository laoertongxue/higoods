// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn, type StandardListHeaderGroup } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { transitFlowSeed, TRANSIT_FLOW_TYPES, type TransitFlowRow } from './seed.ts'

const EVENT_PREFIX = 'wls-online-transit-flow'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/transit-flow:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  detailId: '',
  keyword: '',
  typeFilter: '' as string,
}

function beforeAfter(before: number, after: number): string {
  const delta = after - before
  const cls = delta > 0 ? 'text-emerald-700 font-semibold' : delta < 0 ? 'text-red-700 font-semibold' : 'text-slate-700'
  return `<span class="${cls}">${after}</span>`
}

const columns: StandardListColumn<TransitFlowRow>[] = [
  { key: 'businessNo', title: '业务单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.businessNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.businessNo)}</span>` },
  { key: 'flowType', title: '流水类型', width: 100, required: true, freezeable: true, sortable: true, sortValue: r => r.flowType,
    render: r => `<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(r.flowType)}</span>` },
  { key: 'spu', title: '商品SPU', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'opQty', title: '操作数量', width: 90, align: 'right', sortable: true, sortValue: r => r.opQty,
    render: r => `<span class="font-medium text-slate-700">${r.opQty}</span>` },
  { key: 'spotBefore', title: '变更前现货', width: 100, align: 'right', sortable: true, sortValue: r => r.spotBefore,
    render: r => `<span class="text-slate-500">${r.spotBefore}</span>` },
  { key: 'spotAfter', title: '变更后现货', width: 100, align: 'right', sortable: true, sortValue: r => r.spotAfter,
    render: r => beforeAfter(r.spotBefore, r.spotAfter) },
  { key: 'transitBefore', title: '变更前在途', width: 100, align: 'right', sortable: true, sortValue: r => r.transitBefore,
    render: r => `<span class="text-slate-500">${r.transitBefore}</span>` },
  { key: 'transitAfter', title: '变更后在途', width: 100, align: 'right', sortable: true, sortValue: r => r.transitAfter,
    render: r => beforeAfter(r.transitBefore, r.transitAfter) },
  { key: 'availableBefore', title: '变更前可售', width: 100, align: 'right', sortable: true, sortValue: r => r.availableBefore,
    render: r => `<span class="text-slate-500">${r.availableBefore}</span>` },
  { key: 'availableAfter', title: '变更后可售', width: 100, align: 'right', sortable: true, sortValue: r => r.availableAfter,
    render: r => beforeAfter(r.availableBefore, r.availableAfter) },
  { key: 'lockedBefore', title: '变更前锁定', width: 100, align: 'right', sortable: true, sortValue: r => r.lockedBefore,
    render: r => `<span class="text-slate-500">${r.lockedBefore}</span>` },
  { key: 'lockedAfter', title: '变更后锁定', width: 100, align: 'right', sortable: true, sortValue: r => r.lockedAfter,
    render: r => beforeAfter(r.lockedBefore, r.lockedAfter) },
  { key: 'shippedBefore', title: '变更前已出库', width: 110, align: 'right', sortable: true, sortValue: r => r.shippedBefore,
    render: r => `<span class="text-slate-500">${r.shippedBefore}</span>` },
  { key: 'shippedAfter', title: '变更后已出库', width: 110, align: 'right', sortable: true, sortValue: r => r.shippedAfter,
    render: r => beforeAfter(r.shippedBefore, r.shippedAfter) },
  { key: 'operatorName', title: '操作人', width: 100, sortable: true, sortValue: r => r.operatorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operatorName)}</span>` },
  { key: 'operateTime', title: '操作时间', width: 150, sortable: true, sortValue: r => r.operateTime,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.operateTime)}</span>` },
  { key: 'remark', title: '备注', width: 200, sortable: true, sortValue: r => r.remark,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.remark || '-')}</span>` },
]

const headerGroups: StandardListHeaderGroup[] = [
  { key: 'spot', title: '现货', columnKeys: ['spotBefore', 'spotAfter'] },
  { key: 'transit', title: '在途', columnKeys: ['transitBefore', 'transitAfter'] },
  { key: 'available', title: '可售', columnKeys: ['availableBefore', 'availableAfter'] },
  { key: 'locked', title: '锁定', columnKeys: ['lockedBefore', 'lockedAfter'] },
  { key: 'shipped', title: '已出库', columnKeys: ['shippedBefore', 'shippedAfter'] },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['businessNo', 'flowType'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): TransitFlowRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const types = state.typeFilter.split(',').map(s => s.trim()).filter(Boolean)
  return transitFlowSeed.filter(r => {
    if (types.length && !types.includes(r.flowType)) return false
    if (!kw) return true
    return `${r.businessNo} ${r.spu} ${r.sku} ${r.flowType}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="业务单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">流水类型（多选）</span><select multiple class="h-28 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" data-${EVENT_PREFIX}-field="type">${TRANSIT_FLOW_TYPES.map(t => `<option value="${escapeHtml(t)}" ${state.typeFilter.split(',').includes(t) ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? transitFlowSeed.find(r => r.id === state.detailId) : undefined
  return renderStandardListPage({
    title: '库存流水查询',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '流水记录', value: `${transitFlowSeed.length} 条` },
      { label: '入库类', value: `${transitFlowSeed.filter(r => r.flowType.includes('入库')).length} 条` },
      { label: '盘点类', value: `${transitFlowSeed.filter(r => r.flowType.includes('盘点')).length} 条` },
      { label: '手动入库', value: `${transitFlowSeed.filter(r => r.flowType === '手动入库').length} 条` },
    ]),
    listTitle: '流水记录列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, headerGroups, emptyText: '未找到符合条件的流水记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: '中转库存流水列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 600 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '流水明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
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

export function renderTransitFlow(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitFlowEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'type') {
      const select = field as HTMLSelectElement
      state.typeFilter = select.multiple ? [...select.selectedOptions].map(o => o.value).join(',') : select.value
      return true
    }
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
    const typeSelect = root?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="type"]`)
    state.keyword = read('keyword')
    state.typeFilter = typeSelect ? [...typeSelect.selectedOptions].map(o => o.value).join(',') : ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.typeFilter = ''
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
  if (action === 'export') { exportStandardListRows({ fileName: '中转库存流水查询', columns, rows: filteredRows() }); return true }
  return false
}
