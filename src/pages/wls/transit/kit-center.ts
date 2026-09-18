// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type KitLine = {
  productionNo: string; receiveNo: string; inboundNo: string; sku: string; name: string
  requiredQty: number; workQty: number; shelfQty: number; availableQty: number
  missingQty: number; outboundQty: number; remainNeed: number
  receiveStatus: '缺货' | '未收齐' | '已收齐'; pickupStatus: string
}

const receiveStatusClass: Record<string, string> = {
  '缺货': 'bg-red-50 text-red-700', '未收齐': 'bg-amber-50 text-amber-700', '已收齐': 'bg-emerald-50 text-emerald-700',
}

const seedLines: KitLine[] = [
  { productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', sku: 'FAB-PO14954-A', name: '主身面料', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, outboundQty: 0, remainNeed: 6, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', sku: 'ACC-PO14954-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 0, remainNeed: 2, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', sku: 'FAB-PO14957-A', name: '主身面料', requiredQty: 5, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 0, outboundQty: 5, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', sku: 'ACC-PO14957-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 2, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', sku: 'FAB-PO14958-A', name: '主身面料', requiredQty: 7, workQty: 6, shelfQty: 1, availableQty: 7, missingQty: 0, outboundQty: 0, remainNeed: 7, receiveStatus: '未收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', sku: 'ACC-PO14958-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 0, remainNeed: 2, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'FAB-PO14955-A', name: '主身面料', requiredQty: 8, workQty: 5, shelfQty: 0, availableQty: 5, missingQty: 3, outboundQty: 0, remainNeed: 8, receiveStatus: '未收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'ACC-PO14955-B', name: '辅料包', requiredQty: 3, workQty: 3, shelfQty: 0, availableQty: 3, missingQty: 0, outboundQty: 0, remainNeed: 3, receiveStatus: '已收齐', pickupStatus: '待领料' },
  { productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'FAB-PO14956-A', name: '主身面料', requiredQty: 10, workQty: 4, shelfQty: 0, availableQty: 4, missingQty: 6, outboundQty: 0, remainNeed: 10, receiveStatus: '缺货', pickupStatus: '待领料' },
  { productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'ACC-PO14956-B', name: '辅料包', requiredQty: 3, workQty: 1, shelfQty: 0, availableQty: 1, missingQty: 2, outboundQty: 0, remainNeed: 3, receiveStatus: '缺货', pickupStatus: '待领料' },
  { productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', sku: 'FAB-PO14962-A', name: '主身面料', requiredQty: 6, workQty: 6, shelfQty: 0, availableQty: 6, missingQty: 0, outboundQty: 6, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
  { productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', sku: 'ACC-PO14962-B', name: '辅料包', requiredQty: 2, workQty: 2, shelfQty: 0, availableQty: 2, missingQty: 0, outboundQty: 2, remainNeed: 0, receiveStatus: '已收齐', pickupStatus: '已领料' },
]

const EVENT_PREFIX = 'wls-transit-kit'
const PREFERENCE_KEY = '/wls/transit/kit-center:list-columns'
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

const columns: StandardListColumn<KitLine>[] = [
  { key: 'productionNo', title: '生产单号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.productionNo)}</span>` },
  { key: 'receiveNo', title: '收货单号', width: 180, sortable: true, sortValue: r => r.receiveNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.receiveNo)}</span>` },
  { key: 'inboundNo', title: '预入库单号', width: 180, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '物料信息', width: 100, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'requiredQty', title: '原始需求', width: 90, align: 'right', sortable: true, sortValue: r => r.requiredQty,
    render: r => `<span class="text-slate-600">${r.requiredQty}</span>` },
  { key: 'workQty', title: '本批作业区', width: 100, align: 'right', sortable: true, sortValue: r => r.workQty,
    render: r => `<span class="text-slate-600">${r.workQty}</span>` },
  { key: 'shelfQty', title: '货架可用', width: 90, align: 'right', sortable: true, sortValue: r => r.shelfQty,
    render: r => `<span class="text-slate-600">${r.shelfQty}</span>` },
  { key: 'availableQty', title: '合计可用', width: 90, align: 'right', sortable: true, sortValue: r => r.availableQty,
    render: r => `<span class="text-slate-700 font-medium">${r.availableQty}</span>` },
  { key: 'missingQty', title: '缺口数量', width: 90, align: 'right', sortable: true, sortValue: r => r.missingQty,
    render: r => `<span class="${r.missingQty > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}">${r.missingQty > 0 ? r.missingQty : '—'}</span>` },
  { key: 'outboundQty', title: '已出库', width: 80, align: 'right', sortable: true, sortValue: r => r.outboundQty,
    render: r => `<span class="text-slate-600">${r.outboundQty}</span>` },
  { key: 'remainNeed', title: '未出库', width: 80, align: 'right', sortable: true, sortValue: r => r.remainNeed,
    render: r => `<span class="text-slate-600">${r.remainNeed}</span>` },
  { key: 'receiveStatus', title: '收货状态', width: 100, sortable: true, sortValue: r => r.receiveStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${receiveStatusClass[r.receiveStatus]}">${escapeHtml(r.receiveStatus)}</span>` },
  { key: 'pickupStatus', title: '领料状态', width: 90, sortable: true, sortValue: r => r.pickupStatus,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.pickupStatus)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: () => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">出入库详情</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['productionNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): KitLine[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedLines.filter(l => {
    if (state.statusFilter && l.receiveStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${l.productionNo} ${l.receiveNo} ${l.sku} ${l.name}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="生产单号 / 收货单号 / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">收货状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="缺货" ${state.statusFilter === '缺货' ? 'selected' : ''}>缺货</option><option value="未收齐" ${state.statusFilter === '未收齐' ? 'selected' : ''}>未收齐</option><option value="已收齐" ${state.statusFilter === '已收齐' ? 'selected' : ''}>已收齐</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓齐套校验中心',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '缺货', value: `${seedLines.filter(l => l.receiveStatus === '缺货').length} 条` },
      { label: '未收齐', value: `${seedLines.filter(l => l.receiveStatus === '未收齐').length} 条` },
      { label: '已收齐', value: `${seedLines.filter(l => l.receiveStatus === '已收齐').length} 条` },
    ]),
    listTitle: '齐套校验列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无齐套校验记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '齐套校验列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitKitCenter(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitKitCenterEvent(target: HTMLElement, event?: Event): boolean {
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
