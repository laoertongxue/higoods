// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type RawOutboundOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  trackingNo: string; materialCategory: string; unit: string; outboundWarehouse: string
  outboundType: string; receivingUnit: string; requisitionMethod: string; plannedQty: string
  stockStatus: string; pickedQty: string; owner: string; status: string; time: string
}

const stockStatusClass: Record<string, string> = {
  '库存充足': 'bg-emerald-50 text-emerald-700',
  '库存部分充足': 'bg-orange-50 text-orange-700',
  '库存不足': 'bg-red-50 text-red-700',
}

const statusClass: Record<string, string> = {
  '待出库': 'bg-orange-50 text-orange-700',
  '部分出库': 'bg-blue-50 text-blue-700',
  '已出库': 'bg-emerald-50 text-emerald-700',
}

const categoryClass: Record<string, string> = {
  '面料': 'bg-indigo-50 text-indigo-700',
  '辅料': 'bg-teal-50 text-teal-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-pink-50 text-pink-700',
  '纱线': 'bg-violet-50 text-violet-700',
}

const seedOutbounds: RawOutboundOrder[] = [
  { id: 'OB-FAB-001', outboundOrderNo: 'YCK-FAB-REQ-20260521-001', pickOrderNo: 'JHD-FAB-REQ-20260521-001', relatedOrderNo: 'YL-FAB-REQ-20260521-001', trackingNo: 'MATWB-FAB-001', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '160 米', stockStatus: '库存充足', pickedQty: '160 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-21 14:20' },
  { id: 'OB-FAB-002', outboundOrderNo: 'YCK-FAB-REQ-20260522-002', pickOrderNo: 'JHD-FAB-REQ-20260522-002', relatedOrderNo: 'YL-FAB-REQ-20260522-002', trackingNo: 'MATWB-FAB-002', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', requisitionMethod: '仓库配送到厂', plannedQty: '240 米', stockStatus: '库存充足', pickedQty: '240 米', owner: '印尼万隆主体', status: '已出库', time: '2026-05-22 14:30' },
  { id: 'OB-TRM-001', outboundOrderNo: 'YCK-TRM-REQ-20260523-001', pickOrderNo: 'JHD-TRM-REQ-20260523-001', relatedOrderNo: 'YL-TRM-REQ-20260523-001', trackingNo: 'MATWB-TRM-001', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '3000 颗', stockStatus: '库存充足', pickedQty: '1500 颗', owner: '雅加达电商主体', status: '部分出库', time: '2026-05-23 14:40' },
  { id: 'OB-TRM-002', outboundOrderNo: 'YCK-TRM-REQ-20260524-002', pickOrderNo: 'JHD-TRM-REQ-20260524-002', relatedOrderNo: 'YL-TRM-REQ-20260524-002', trackingNo: 'MATWB-TRM-002', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', plannedQty: '1500 颗', stockStatus: '库存充足', pickedQty: '1500 颗', owner: '印尼万隆主体', status: '已出库', time: '2026-05-24 14:50' },
  { id: 'OB-CON-001', outboundOrderNo: 'YCK-CON-REQ-20260525-001', pickOrderNo: 'JHD-CON-REQ-20260525-001', relatedOrderNo: 'YL-CON-REQ-20260525-001', trackingNo: 'MATWB-CON-001', materialCategory: '耗材', unit: '个', outboundWarehouse: '中央总仓-耗材仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', plannedQty: '480 个', stockStatus: '库存不足', pickedQty: '0 个', owner: '印尼万隆主体', status: '待出库', time: '2026-05-25 15:00' },
  { id: 'OB-PKG-001', outboundOrderNo: 'YCK-PKG-REQ-20260526-001', pickOrderNo: 'JHD-PKG-REQ-20260526-001', relatedOrderNo: 'YL-PKG-REQ-20260526-001', trackingNo: 'MATWB-PKG-001', materialCategory: '包材', unit: '个', outboundWarehouse: '中央总仓-包材仓', outboundType: '原料领料出库', receivingUnit: '生产车间D', requisitionMethod: '仓库配送到厂', plannedQty: '2000 个', stockStatus: '库存充足', pickedQty: '2000 个', owner: '雅加达电商主体', status: '已出库', time: '2026-05-26 15:10' },
  { id: 'OB-YRN-001', outboundOrderNo: 'YCK-YRN-REQ-20260527-001', pickOrderNo: 'JHD-YRN-REQ-20260527-001', relatedOrderNo: 'YL-YRN-REQ-20260527-001', trackingNo: 'MATWB-YRN-001', materialCategory: '纱线', unit: '米', outboundWarehouse: '中央总仓-纱线仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', plannedQty: '600 米', stockStatus: '库存部分充足', pickedQty: '360 米', owner: '印尼万隆主体', status: '部分出库', time: '2026-05-27 15:20' },
  { id: 'OB-FAB-003', outboundOrderNo: 'YCK-FAB-REQ-20260528-003', pickOrderNo: 'JHD-FAB-REQ-20260528-003', relatedOrderNo: 'YL-FAB-REQ-20260528-003', trackingNo: 'MATWB-FAB-003', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', plannedQty: '320 米', stockStatus: '库存充足', pickedQty: '0 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-28 15:30' },
]

const EVENT_PREFIX = 'wls-raw-outbound-list'
const PREFERENCE_KEY = '/wls/raw/outbound-list:list-columns'
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

const columns: StandardListColumn<RawOutboundOrder>[] = [
  { key: 'numbers', title: '单号', width: 210, required: true, freezeable: true, sortable: true, sortValue: r => r.outboundOrderNo,
    render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700 font-mono text-xs" title="${escapeHtml(r.outboundOrderNo)}">${escapeHtml(r.outboundOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.pickOrderNo)}">${escapeHtml(r.pickOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.trackingNo)}">${escapeHtml(r.trackingNo)}</span></div>` },
  { key: 'materialCategory', title: '出库单类型', width: 100, sortable: true, sortValue: r => r.materialCategory,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[r.materialCategory] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.materialCategory)}</span>` },
  { key: 'outboundWarehouse', title: '出库仓库', width: 140, sortable: true, sortValue: r => r.outboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundWarehouse)}</span>` },
  { key: 'outboundType', title: '出库类型', width: 120, sortable: true, sortValue: r => r.outboundType,
    render: r => `<span class="text-slate-500">${escapeHtml(r.outboundType)}</span>` },
  { key: 'receivingUnit', title: '收货单位', width: 120, sortable: true, sortValue: r => r.receivingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.receivingUnit)}</span>` },
  { key: 'requisitionMethod', title: '领料方式', width: 120, sortable: true, sortValue: r => r.requisitionMethod,
    render: r => `<span class="text-slate-500">${escapeHtml(r.requisitionMethod)}</span>` },
  { key: 'plannedQty', title: '计划出库数量', width: 120, align: 'right', sortable: true, sortValue: r => r.plannedQty,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.plannedQty)}</span>` },
  { key: 'stockStatus', title: '库存状态', width: 110, sortable: true, sortValue: r => r.stockStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[r.stockStatus] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.stockStatus)}</span>` },
  { key: 'pickedQty', title: '已配料数量', width: 110, align: 'right', sortable: true, sortValue: r => r.pickedQty,
    render: r => `<span class="text-slate-600">${escapeHtml(r.pickedQty)}</span>` },
  { key: 'owner', title: '货主', width: 120, sortable: true, sortValue: r => r.owner,
    render: r => `<span class="text-slate-600">${escapeHtml(r.owner)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'time', title: '时间', width: 140, sortable: true, sortValue: r => r.time,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.time)}</span>` },
  { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1">${r.status === '待出库'
      ? `<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="confirm-outbound">确认出库</button>`
      : `<button class="rounded border border-slate-200 px-3 py-1 text-xs text-slate-400 cursor-not-allowed" disabled>确认出库</button>`}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['numbers'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): RawOutboundOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOutbounds.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.outboundOrderNo} ${o.pickOrderNo} ${o.trackingNo} ${o.materialCategory} ${o.receivingUnit} ${o.owner}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 配料单号 / 跟踪单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option><option value="部分出库" ${state.statusFilter === '部分出库' ? 'selected' : ''}>部分出库</option><option value="已出库" ${state.statusFilter === '已出库' ? 'selected' : ''}>已出库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料出库单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待出库', value: `${seedOutbounds.filter(o => o.status === '待出库').length} 条` },
      { label: '部分出库', value: `${seedOutbounds.filter(o => o.status === '部分出库').length} 条` },
      { label: '已出库', value: `${seedOutbounds.filter(o => o.status === '已出库').length} 条` },
    ]),
    listTitle: '出库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无出库记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '出库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawOutboundList(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawOutboundListEvent(target: HTMLElement, event?: Event): boolean {
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
