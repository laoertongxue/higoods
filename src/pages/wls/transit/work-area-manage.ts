// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type WorkAreaRow = {
  inboundNo: string; productionNo: string; sourceNo: string; sku: string; name: string
  receivedQty: number; allocatedQty: number; putawayQty: number; outboundQty: number
  exceptionQty: number; remainQty: number; flowStatus: string; clearStatus: '已清空' | '未清空'
}

const seedRows: WorkAreaRow[] = [
  { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14954-A', name: '主身面料', receivedQty: 6, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 6, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14954-B', name: '辅料包', receivedQty: 2, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 2, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14957-A', name: '主身面料', receivedQty: 5, allocatedQty: 5, putawayQty: 0, outboundQty: 5, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
  { inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14957-B', name: '辅料包', receivedQty: 2, allocatedQty: 2, putawayQty: 0, outboundQty: 2, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
  { inboundNo: 'TR-IN-20260716-005', productionNo: 'PO14958', sourceNo: 'TR-RC-20260716-001', sku: 'FAB-PO14958-A', name: '主身面料', receivedQty: 6, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 6, flowStatus: '待出库', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-005', productionNo: 'PO14958', sourceNo: 'TR-RC-20260716-001', sku: 'ACC-PO14958-B', name: '辅料包', receivedQty: 2, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 2, flowStatus: '待出库', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', sourceNo: 'TR-RC-20260716-002', sku: 'FAB-PO14955-A', name: '主身面料', receivedQty: 5, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 5, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', sourceNo: 'TR-RC-20260716-002', sku: 'ACC-PO14955-B', name: '辅料包', receivedQty: 3, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 3, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-003', productionNo: 'PO14956', sourceNo: 'TR-RC-20260716-003', sku: 'FAB-PO14956-A', name: '主身面料', receivedQty: 4, allocatedQty: 0, putawayQty: 0, outboundQty: 0, exceptionQty: 0, remainQty: 4, flowStatus: '待上架', clearStatus: '未清空' },
  { inboundNo: 'TR-IN-20260716-009', productionNo: 'PO14962', sourceNo: 'TR-RC-20260716-005', sku: 'FAB-PO14962-A', name: '主身面料', receivedQty: 6, allocatedQty: 6, putawayQty: 0, outboundQty: 6, exceptionQty: 0, remainQty: 0, flowStatus: '已出库', clearStatus: '已清空' },
]

const flowStatusClass: Record<string, string> = {
  '已出库': 'bg-emerald-50 text-emerald-700', '待出库': 'bg-orange-50 text-orange-700',
  '已上架': 'bg-blue-50 text-blue-700', '待上架': 'bg-amber-50 text-amber-700', '-': 'bg-slate-100 text-slate-400',
}

const EVENT_PREFIX = 'wls-transit-work-area'
const PREFERENCE_KEY = '/wls/transit/work-area-manage:list-columns'
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

const columns: StandardListColumn<WorkAreaRow>[] = [
  { key: 'inboundNo', title: '入库单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'productionNo', title: '需求单', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'sourceNo', title: '来源单', width: 180, sortable: true, sortValue: r => r.sourceNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.sourceNo)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '物料名称', width: 120, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'receivedQty', title: '收货数量', width: 90, align: 'right', sortable: true, sortValue: r => r.receivedQty,
    render: r => `<span class="text-slate-600">${r.receivedQty}</span>` },
  { key: 'allocatedQty', title: '已配料', width: 80, align: 'right', sortable: true, sortValue: r => r.allocatedQty,
    render: r => `<span class="text-slate-600">${r.allocatedQty}</span>` },
  { key: 'putawayQty', title: '已上架', width: 80, align: 'right', sortable: true, sortValue: r => r.putawayQty,
    render: r => `<span class="text-slate-600">${r.putawayQty}</span>` },
  { key: 'outboundQty', title: '已出库', width: 80, align: 'right', sortable: true, sortValue: r => r.outboundQty,
    render: r => `<span class="text-slate-600">${r.outboundQty}</span>` },
  { key: 'exceptionQty', title: '异常暂存', width: 90, align: 'right', sortable: true, sortValue: r => r.exceptionQty,
    render: r => `<span class="text-right ${r.exceptionQty > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}">${r.exceptionQty > 0 ? r.exceptionQty : '—'}</span>` },
  { key: 'remainQty', title: '作业区剩余', width: 100, align: 'right', sortable: true, sortValue: r => r.remainQty,
    render: r => `<span class="text-right font-medium ${r.remainQty > 0 ? 'text-orange-600' : 'text-slate-400'}">${r.remainQty}</span>` },
  { key: 'flowStatus', title: '状态', width: 100, sortable: true, sortValue: r => r.flowStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${flowStatusClass[r.flowStatus] || flowStatusClass['-']}">${escapeHtml(r.flowStatus)}</span>` },
  { key: 'clearStatus', title: '清空状态', width: 100, sortable: true, sortValue: r => r.clearStatus,
    render: r => `<span class="text-xs ${r.clearStatus === '已清空' ? 'text-emerald-600' : 'text-orange-600'}">${escapeHtml(r.clearStatus)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-destination">查看去向</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['inboundNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): WorkAreaRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (state.statusFilter && r.flowStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${r.inboundNo} ${r.productionNo} ${r.sourceNo} ${r.sku} ${r.name}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="入库单号 / 需求单 / SKU / 物料名称" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待上架" ${state.statusFilter === '待上架' ? 'selected' : ''}>待上架</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option><option value="已出库" ${state.statusFilter === '已出库' ? 'selected' : ''}>已出库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓作业区管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '作业区剩余总量', value: `${seedRows.reduce((s, r) => s + r.remainQty, 0)}` },
      { label: '已清空', value: `${seedRows.filter(r => r.clearStatus === '已清空').length} 条` },
    ]),
    listTitle: '作业区物料列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无作业区记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '作业区列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitWorkAreaManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitWorkAreaManageEvent(target: HTMLElement, event?: Event): boolean {
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
