// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type RawPutawayOrder = {
  putawayNo: string; inboundNo: string; sourceNo: string; productionNo: string
  warehouse: string; zone: string; location: string; sku: string; productName: string
  qty: number; operator: string
  status: '待上架' | '上架中' | '部分上架' | '上架完成'
  createTime: string; completeTime: string
}

const statusClass: Record<string, string> = {
  '待上架': 'bg-orange-50 text-orange-700', '上架中': 'bg-blue-50 text-blue-700',
  '部分上架': 'bg-amber-50 text-amber-700', '上架完成': 'bg-emerald-50 text-emerald-700',
}

const seedOrders: RawPutawayOrder[] = [
  { putawayNo: 'PW-20260716-001', inboundNo: 'IN-20260716-001', sourceNo: 'RC-20260716-001', productionNo: 'PO14954', warehouse: '原料仓', zone: 'A区', location: 'A-01-03', sku: 'FAB-PO14954-A', productName: '主身面料', qty: 6, operator: '仓管员-小张', status: '上架完成', createTime: '2026-07-16 09:00', completeTime: '2026-07-16 09:30' },
  { putawayNo: 'PW-20260716-002', inboundNo: 'IN-20260716-002', sourceNo: 'RC-20260716-002', productionNo: 'PO14955', warehouse: '原料仓', zone: 'A区', location: 'A-02-01', sku: 'FAB-PO14955-A', productName: '主身面料', qty: 5, operator: '仓管员-小王', status: '上架中', createTime: '2026-07-16 09:30', completeTime: '-' },
  { putawayNo: 'PW-20260716-003', inboundNo: 'IN-20260716-003', sourceNo: 'RC-20260716-003', productionNo: 'PO14956', warehouse: '原料仓', zone: 'B区', location: 'B-01-02', sku: 'FAB-PO14956-A', productName: '里料', qty: 4, operator: '仓管员-小张', status: '待上架', createTime: '2026-07-16 10:00', completeTime: '-' },
  { putawayNo: 'PW-20260716-004', inboundNo: 'IN-20260716-004', sourceNo: 'RC-20260716-001', productionNo: 'PO14957', warehouse: '原料仓', zone: 'A区', location: 'A-03-01', sku: 'FAB-PO14957-A', productName: '主身面料', qty: 5, operator: '仓管员-小王', status: '上架完成', createTime: '2026-07-16 10:30', completeTime: '2026-07-16 11:00' },
  { putawayNo: 'PW-20260716-005', inboundNo: 'IN-20260716-005', sourceNo: 'RC-20260716-004', productionNo: 'PO14958', warehouse: '原料仓', zone: 'C区', location: 'C-02-03', sku: 'FAB-PO14958-A', productName: '口袋布', qty: 6, operator: '仓管员-小张', status: '部分上架', createTime: '2026-07-16 11:00', completeTime: '-' },
  { putawayNo: 'PW-20260716-006', inboundNo: 'IN-20260716-006', sourceNo: 'RC-20260716-005', productionNo: 'PO14959', warehouse: '原料仓', zone: 'B区', location: 'B-03-02', sku: 'ACC-PO14959-B', productName: '辅料包', qty: 3, operator: '仓管员-小王', status: '待上架', createTime: '2026-07-16 11:30', completeTime: '-' },
  { putawayNo: 'PW-20260716-007', inboundNo: 'IN-20260716-007', sourceNo: 'RC-20260716-006', productionNo: 'PO14960', warehouse: '原料仓', zone: 'A区', location: 'A-04-01', sku: 'FAB-PO14960-A', productName: '袖里面料', qty: 4, operator: '仓管员-小张', status: '上架中', createTime: '2026-07-16 12:00', completeTime: '-' },
  { putawayNo: 'PW-20260716-008', inboundNo: 'IN-20260716-008', sourceNo: 'RC-20260716-007', productionNo: 'PO14961', warehouse: '原料仓', zone: 'C区', location: 'C-01-01', sku: 'FAB-PO14961-A', productName: '领衬面料', qty: 3, operator: '仓管员-小王', status: '待上架', createTime: '2026-07-16 13:00', completeTime: '-' },
]

const EVENT_PREFIX = 'wls-raw-inbound-list'
const PREFERENCE_KEY = '/wls/raw/inbound/list:list-columns'
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

const columns: StandardListColumn<RawPutawayOrder>[] = [
  { key: 'putawayNo', title: '上架单号', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.putawayNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.putawayNo)}">${escapeHtml(r.putawayNo)}</span>` },
  { key: 'inboundNo', title: '入库单号', width: 160, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'sourceNo', title: '来源单', width: 160, sortable: true, sortValue: r => r.sourceNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.sourceNo)}</span>` },
  { key: 'productionNo', title: '需求单', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'warehouse', title: '仓库', width: 100, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'zone', title: '库区', width: 80, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.zone)}</span>` },
  { key: 'location', title: '库位', width: 100, sortable: true, sortValue: r => r.location,
    render: r => `<span class="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-mono">${escapeHtml(r.location)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'productName', title: '品名', width: 120, sortable: true, sortValue: r => r.productName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productName)}</span>` },
  { key: 'qty', title: '数量', width: 70, align: 'right', sortable: true, sortValue: r => r.qty,
    render: r => `<span class="text-slate-700 font-medium">${r.qty}</span>` },
  { key: 'operator', title: '操作人', width: 120, sortable: true, sortValue: r => r.operator,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.operator)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'createTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.createTime)}</span>` },
  { key: 'completeTime', title: '完成时间', width: 150, sortable: true, sortValue: r => r.completeTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.completeTime)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['putawayNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): RawPutawayOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.putawayNo} ${o.inboundNo} ${o.sourceNo} ${o.productionNo} ${o.sku} ${o.productName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="上架单号 / 入库单 / 需求单 / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待上架" ${state.statusFilter === '待上架' ? 'selected' : ''}>待上架</option><option value="上架中" ${state.statusFilter === '上架中' ? 'selected' : ''}>上架中</option><option value="部分上架" ${state.statusFilter === '部分上架' ? 'selected' : ''}>部分上架</option><option value="上架完成" ${state.statusFilter === '上架完成' ? 'selected' : ''}>上架完成</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料仓上架单',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待上架', value: `${seedOrders.filter(o => o.status === '待上架').length} 条` },
      { label: '上架中', value: `${seedOrders.filter(o => o.status === '上架中').length} 条` },
      { label: '上架完成', value: `${seedOrders.filter(o => o.status === '上架完成').length} 条` },
    ]),
    listTitle: '上架单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无上架单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '上架单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawInboundList(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawInboundListEvent(target: HTMLElement, event?: Event): boolean {
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
