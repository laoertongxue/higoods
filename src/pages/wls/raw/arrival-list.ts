// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type RawArrivalOrder = {
  arrivalNo: string; sourceNo: string; supplier: string; material: string
  spu: string; sku: string; qty: number; rolls: number
  status: '待收货' | '收货中' | '部分收货' | '已收货' | '已取消'
  createTime: string
}

const categoryColors: Record<string, string> = {
  '面料': 'bg-blue-50 text-blue-700', '辅料': 'bg-amber-50 text-amber-700',
  '线类': 'bg-emerald-50 text-emerald-700', '包材': 'bg-purple-50 text-purple-700',
}

const seedOrders: RawArrivalOrder[] = [
  { arrivalNo: 'RA-20260716-001', sourceNo: 'PO-20260710-001', supplier: '东莞纺织供应链', material: '面料', spu: 'SPU-FAB-10001', sku: 'SKU-FAB-40001', qty: 500, rolls: 10, status: '已收货', createTime: '2026-07-16 08:00' },
  { arrivalNo: 'RA-20260716-002', sourceNo: 'PO-20260710-002', supplier: '深圳辅料有限公司', material: '辅料', spu: 'SPU-ACC-10001', sku: 'SKU-ACC-40001', qty: 1000, rolls: 5, status: '收货中', createTime: '2026-07-16 08:30' },
  { arrivalNo: 'RA-20260716-003', sourceNo: 'PO-20260710-003', supplier: '广州线材厂', material: '线类', spu: 'SPU-THR-10001', sku: 'SKU-THR-40001', qty: 2000, rolls: 20, status: '待收货', createTime: '2026-07-16 09:00' },
  { arrivalNo: 'RA-20260716-004', sourceNo: 'PO-20260710-004', supplier: '东莞纺织供应链', material: '面料', spu: 'SPU-FAB-10002', sku: 'SKU-FAB-40002', qty: 300, rolls: 6, status: '部分收货', createTime: '2026-07-16 09:30' },
  { arrivalNo: 'RA-20260716-005', sourceNo: 'PO-20260710-005', supplier: '佛山包材厂', material: '包材', spu: 'SPU-PKG-10001', sku: 'SKU-PKG-40001', qty: 5000, rolls: 50, status: '已收货', createTime: '2026-07-16 10:00' },
  { arrivalNo: 'RA-20260716-006', sourceNo: 'PO-20260710-006', supplier: '深圳辅料有限公司', material: '辅料', spu: 'SPU-ACC-10002', sku: 'SKU-ACC-40002', qty: 800, rolls: 4, status: '已取消', createTime: '2026-07-16 10:30' },
  { arrivalNo: 'RA-20260716-007', sourceNo: 'PO-20260710-007', supplier: '东莞纺织供应链', material: '面料', spu: 'SPU-FAB-10003', sku: 'SKU-FAB-40003', qty: 450, rolls: 9, status: '待收货', createTime: '2026-07-16 11:00' },
  { arrivalNo: 'RA-20260716-008', sourceNo: 'PO-20260710-008', supplier: '广州线材厂', material: '线类', spu: 'SPU-THR-10002', sku: 'SKU-THR-40002', qty: 1500, rolls: 15, status: '收货中', createTime: '2026-07-16 11:30' },
  { arrivalNo: 'RA-20260716-009', sourceNo: 'PO-20260710-009', supplier: '佛山包材厂', material: '包材', spu: 'SPU-PKG-10002', sku: 'SKU-PKG-40002', qty: 3000, rolls: 30, status: '待收货', createTime: '2026-07-16 12:00' },
  { arrivalNo: 'RA-20260716-010', sourceNo: 'PO-20260710-010', supplier: '东莞纺织供应链', material: '面料', spu: 'SPU-FAB-10004', sku: 'SKU-FAB-40004', qty: 600, rolls: 12, status: '已收货', createTime: '2026-07-16 12:30' },
  { arrivalNo: 'RA-20260716-011', sourceNo: 'PO-20260710-011', supplier: '深圳辅料有限公司', material: '辅料', spu: 'SPU-ACC-10003', sku: 'SKU-ACC-40003', qty: 400, rolls: 2, status: '部分收货', createTime: '2026-07-16 13:00' },
  { arrivalNo: 'RA-20260716-012', sourceNo: 'PO-20260710-012', supplier: '广州线材厂', material: '线类', spu: 'SPU-THR-10003', sku: 'SKU-THR-40003', qty: 1200, rolls: 12, status: '待收货', createTime: '2026-07-16 13:30' },
]

const statusClass: Record<string, string> = {
  '待收货': 'bg-orange-50 text-orange-700', '收货中': 'bg-blue-50 text-blue-700',
  '部分收货': 'bg-amber-50 text-amber-700', '已收货': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const EVENT_PREFIX = 'wls-raw-arrival-list'
const PREFERENCE_KEY = '/wls/raw/arrival/list:list-columns'
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

const columns: StandardListColumn<RawArrivalOrder>[] = [
  { key: 'arrivalNo', title: '到货单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.arrivalNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.arrivalNo)}">${escapeHtml(r.arrivalNo)}</span>` },
  { key: 'sourceNo', title: '来源单号', width: 160, sortable: true, sortValue: r => r.sourceNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.sourceNo)}</span>` },
  { key: 'supplier', title: '供应商', width: 160, sortable: true, sortValue: r => r.supplier,
    render: r => `<span class="text-slate-700">${escapeHtml(r.supplier)}</span>` },
  { key: 'material', title: '物料类型', width: 100, sortable: true, sortValue: r => r.material,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${categoryColors[r.material] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.material)}</span>` },
  { key: 'spu', title: 'SPU', width: 150, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: 'SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'qty', title: '数量', width: 80, align: 'right', sortable: true, sortValue: r => r.qty,
    render: r => `<span class="text-slate-700 font-medium">${r.qty}</span>` },
  { key: 'rolls', title: '卷数', width: 70, align: 'right', sortable: true, sortValue: r => r.rolls,
    render: r => `<span class="text-slate-600">${r.rolls}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'createTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.createTime)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看</button>${r.status === '待收货' ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="receive">开始收货</button>` : ''}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['arrivalNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): RawArrivalOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.arrivalNo} ${o.sourceNo} ${o.supplier} ${o.spu} ${o.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="到货单号 / 来源单 / 供应商 / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待收货" ${state.statusFilter === '待收货' ? 'selected' : ''}>待收货</option><option value="收货中" ${state.statusFilter === '收货中' ? 'selected' : ''}>收货中</option><option value="部分收货" ${state.statusFilter === '部分收货' ? 'selected' : ''}>部分收货</option><option value="已收货" ${state.statusFilter === '已收货' ? 'selected' : ''}>已收货</option><option value="已取消" ${state.statusFilter === '已取消' ? 'selected' : ''}>已取消</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料仓到货清单',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待收货', value: `${seedOrders.filter(o => o.status === '待收货').length} 条` },
      { label: '收货中', value: `${seedOrders.filter(o => o.status === '收货中').length} 条` },
      { label: '已收货', value: `${seedOrders.filter(o => o.status === '已收货').length} 条` },
    ]),
    listTitle: '到货单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无到货记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '到货清单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawArrivalList(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawArrivalListEvent(target: HTMLElement, event?: Event): boolean {
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
