// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type PutawayTask = {
  taskNo: string; productionNo: string; receiveNo: string; inboundNo: string
  sku: string; pendingQty: number; recommendedLocation: string; recommendType: string
  taskStatus: '待上架' | '已上架'
}

const seedTasks: PutawayTask[] = [
  { taskNo: 'TR-PW-20260716-002', productionNo: 'PO14955', receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', sku: 'FAB-PO14955-A', pendingQty: 5, recommendedLocation: 'TR-A-01', recommendType: '同生产单库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260716-003', productionNo: 'PO14956', receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', sku: 'FAB-PO14956-A', pendingQty: 4, recommendedLocation: 'TR-A-02', recommendType: '同生产单库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260716-011', productionNo: 'PO14964', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-011', sku: 'FAB-PO14964-A', pendingQty: 4, recommendedLocation: 'TR-A-05', recommendType: '空闲库位', taskStatus: '待上架' },
  { taskNo: 'TR-PW-20260715-010', productionNo: 'PO14940', receiveNo: 'TR-RC-20260715-001', inboundNo: 'TR-IN-20260715-010', sku: 'FAB-PO14940-A', pendingQty: 0, recommendedLocation: 'TR-B-03', recommendType: '空闲库位', taskStatus: '已上架' },
]

const EVENT_PREFIX = 'wls-transit-putaway'
const PREFERENCE_KEY = '/wls/transit/putaway-manage:list-columns'
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

const columns: StandardListColumn<PutawayTask>[] = [
  { key: 'taskNo', title: '上架任务号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.taskNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.taskNo)}</span>` },
  { key: 'productionNo', title: '需求单', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'receiveNo', title: '来源单', width: 180, sortable: true, sortValue: r => r.receiveNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.receiveNo)}</span>` },
  { key: 'inboundNo', title: '入库单号', width: 180, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'pendingQty', title: '待上架数量', width: 110, align: 'right', sortable: true, sortValue: r => r.pendingQty,
    render: r => `<span class="text-slate-700 font-medium">${r.pendingQty}</span>` },
  { key: 'recommendedLocation', title: '推荐库位', width: 120, sortable: true, sortValue: r => r.recommendedLocation,
    render: r => `<span class="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-mono">${escapeHtml(r.recommendedLocation)}</span>` },
  { key: 'recommendType', title: '推荐类型', width: 120, sortable: true, sortValue: r => r.recommendType,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.recommendType)}</span>` },
  { key: 'taskStatus', title: '任务状态', width: 100, sortable: true, sortValue: r => r.taskStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.taskStatus === '已上架' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1">${r.taskStatus === '待上架'
      ? `<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="putaway">一键完成上架</button>`
      : '<span class="text-xs text-slate-400">已完成</span>'}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['taskNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): PutawayTask[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedTasks.filter(t => {
    if (state.statusFilter && t.taskStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${t.taskNo} ${t.productionNo} ${t.receiveNo} ${t.inboundNo} ${t.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="上架任务号 / 需求单 / 来源单 / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">任务状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待上架" ${state.statusFilter === '待上架' ? 'selected' : ''}>待上架</option><option value="已上架" ${state.statusFilter === '已上架' ? 'selected' : ''}>已上架</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓上架任务管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待上架', value: `${seedTasks.filter(t => t.taskStatus === '待上架').length} 条` },
      { label: '已上架', value: `${seedTasks.filter(t => t.taskStatus === '已上架').length} 条` },
    ]),
    listTitle: '上架任务列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无上架任务' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '上架任务列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitPutawayManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitPutawayManageEvent(target: HTMLElement, event?: Event): boolean {
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
