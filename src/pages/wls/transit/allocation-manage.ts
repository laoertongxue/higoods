// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type AllocationOrder = {
  taskNo: string; productionNo: string; receiveNo: string; inboundNo: string
  processorName: string; kitMethod: string; skuCount: number; needLocationCount: number
  needQty: number; workAreaQty: number; shelfQty: number; warehouseQty: number
  allocationType: '已收齐配料' | '未收齐配料'; cutterReceiveStatus: '已接收' | '未接收'
  taskStatus: string; generatedTime: string
}

const seedOrders: AllocationOrder[] = [
  { taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', processorName: '自有工厂A组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 8, workAreaQty: 8, shelfQty: 0, warehouseQty: 8, allocationType: '已收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 09:36' },
  { taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', processorName: '自有工厂A组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 0, workAreaQty: 0, shelfQty: 0, warehouseQty: 0, allocationType: '已收齐配料', cutterReceiveStatus: '已接收', taskStatus: '已配齐', generatedTime: '2026-07-16 09:39' },
  { taskNo: 'TR-AL-20260716-005', productionNo: 'PO14958', receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-005', processorName: '第三方工厂-恒盛', kitMethod: '已配齐（需配货）', skuCount: 2, needLocationCount: 1, needQty: 1, workAreaQty: 8, shelfQty: 1, warehouseQty: 9, allocationType: '未收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 09:43' },
  { taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', processorName: '自有工厂D组', kitMethod: '已配齐', skuCount: 2, needLocationCount: 0, needQty: 0, workAreaQty: 0, shelfQty: 0, warehouseQty: 0, allocationType: '已收齐配料', cutterReceiveStatus: '已接收', taskStatus: '已配齐', generatedTime: '2026-07-16 15:06' },
  { taskNo: 'TR-AL-20260716-010', productionNo: 'PO14963', receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-010', processorName: '自有工厂D组', kitMethod: '已配齐（需配货）', skuCount: 2, needLocationCount: 1, needQty: 1, workAreaQty: 8, shelfQty: 1, warehouseQty: 9, allocationType: '未收齐配料', cutterReceiveStatus: '未接收', taskStatus: '待配齐', generatedTime: '2026-07-16 15:13' },
]

const typeClass: Record<string, string> = { '已收齐配料': 'bg-emerald-50 text-emerald-700', '未收齐配料': 'bg-amber-50 text-amber-700' }

const EVENT_PREFIX = 'wls-transit-allocation'
const PREFERENCE_KEY = '/wls/transit/allocation-manage:list-columns'
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

const columns: StandardListColumn<AllocationOrder>[] = [
  { key: 'taskNo', title: '配料任务号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.taskNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.taskNo)}">${escapeHtml(r.taskNo)}</span>` },
  { key: 'productionNo', title: '需求单', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'receiveNo', title: '来源单', width: 180, sortable: true, sortValue: r => r.receiveNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.receiveNo)}</span>` },
  { key: 'inboundNo', title: '预入库单号', width: 180, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'processorName', title: '领料对象', width: 150, sortable: true, sortValue: r => r.processorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.processorName)}</span>` },
  { key: 'kitMethod', title: '齐套方式', width: 140, sortable: true, sortValue: r => r.kitMethod,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.kitMethod)}</span>` },
  { key: 'skuCount', title: '本批SKU数', width: 100, align: 'right', sortable: true, sortValue: r => r.skuCount,
    render: r => `<span class="text-slate-600">${r.skuCount}</span>` },
  { key: 'needLocationCount', title: '需取库位数', width: 100, align: 'right', sortable: true, sortValue: r => r.needLocationCount,
    render: r => `<span class="text-slate-600">${r.needLocationCount}</span>` },
  { key: 'needQty', title: '应取数量', width: 90, align: 'right', sortable: true, sortValue: r => r.needQty,
    render: r => `<span class="text-slate-700 font-medium">${r.needQty}</span>` },
  { key: 'workAreaQty', title: '作业区数量', width: 100, align: 'right', sortable: true, sortValue: r => r.workAreaQty,
    render: r => `<span class="text-slate-600">${r.workAreaQty}</span>` },
  { key: 'shelfQty', title: '货架数量', width: 90, align: 'right', sortable: true, sortValue: r => r.shelfQty,
    render: r => `<span class="text-slate-600">${r.shelfQty}</span>` },
  { key: 'warehouseQty', title: '仓库已有', width: 90, align: 'right', sortable: true, sortValue: r => r.warehouseQty,
    render: r => `<span class="text-slate-600">${r.warehouseQty}</span>` },
  { key: 'allocationType', title: '配料类型', width: 120, sortable: true, sortValue: r => r.allocationType,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${typeClass[r.allocationType]}">${escapeHtml(r.allocationType)}</span>` },
  { key: 'cutterReceiveStatus', title: '裁厂接收', width: 100, sortable: true, sortValue: r => r.cutterReceiveStatus,
    render: r => `<span class="text-xs ${r.cutterReceiveStatus === '已接收' ? 'text-emerald-600' : 'text-slate-400'}">${escapeHtml(r.cutterReceiveStatus)}</span>` },
  { key: 'taskStatus', title: '任务状态', width: 100, sortable: true, sortValue: r => r.taskStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.taskStatus === '已配齐' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'generatedTime', title: '生成时间', width: 140, sortable: true, sortValue: r => r.generatedTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.generatedTime)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1">${r.cutterReceiveStatus === '未接收' ? '<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-' + EVENT_PREFIX + '-action="accept">裁厂接收</button>' : ''}<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看详情</button></div>` },
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

function filteredRows(): AllocationOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.allocationType !== state.statusFilter) return false
    if (!kw) return true
    return `${o.taskNo} ${o.productionNo} ${o.receiveNo} ${o.inboundNo} ${o.processorName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="配料任务号 / 需求单 / 来源单 / 领料对象" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">配料类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="已收齐配料" ${state.statusFilter === '已收齐配料' ? 'selected' : ''}>已收齐配料</option><option value="未收齐配料" ${state.statusFilter === '未收齐配料' ? 'selected' : ''}>未收齐配料</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓配料任务管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待配齐', value: `${seedOrders.filter(o => o.taskStatus === '待配齐').length} 条` },
      { label: '已配齐', value: `${seedOrders.filter(o => o.taskStatus === '已配齐').length} 条` },
      { label: '应取总数', value: `${seedOrders.reduce((s, o) => s + o.needQty, 0)}` },
    ]),
    listTitle: '配料任务列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无配料任务' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '配料任务列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitAllocationManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitAllocationManageEvent(target: HTMLElement, event?: Event): boolean {
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
