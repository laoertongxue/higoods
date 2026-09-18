// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type RawIssueOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  trackingNo: string; materialCategory: string; unit: string; outboundWarehouse: string
  outboundType: string; receivingUnit: string; plannedQty: string; stockStatus: string
  availableRatio: string; factoryConfirm: string; pickingStatus: string; pdVisible: string
  hasOutbound: string; pickedQty: string; owner: string; status: string; time: string
}

const stockStatusClass: Record<string, string> = {
  '库存充足': 'bg-emerald-50 text-emerald-700',
  '库存部分充足': 'bg-orange-50 text-orange-700',
  '库存不足': 'bg-red-50 text-red-700',
}

const factoryConfirmClass: Record<string, string> = {
  '工厂确认领取': 'bg-emerald-50 text-emerald-700',
  '待工厂确认': 'bg-orange-50 text-orange-700',
  '无需确认': 'bg-slate-100 text-slate-500',
  '工厂拒绝领取': 'bg-red-50 text-red-700',
}

const statusClass: Record<string, string> = {
  '草稿': 'bg-slate-100 text-slate-500',
  '待配料': 'bg-orange-50 text-orange-700',
  '配料中': 'bg-blue-50 text-blue-700',
  '配料完成': 'bg-emerald-50 text-emerald-700',
  '已出库': 'bg-emerald-50 text-emerald-700',
  '已完结': 'bg-emerald-50 text-emerald-700',
  '少拣待确认': 'bg-orange-50 text-orange-700',
  '工厂拒绝领取': 'bg-red-50 text-red-700',
}

const categoryClass: Record<string, string> = {
  '面料': 'bg-indigo-50 text-indigo-700',
  '辅料': 'bg-teal-50 text-teal-700',
  '耗材': 'bg-amber-50 text-amber-700',
  '包材': 'bg-pink-50 text-pink-700',
  '纱线': 'bg-violet-50 text-violet-700',
}

const seedIssues: RawIssueOrder[] = [
  { id: 'PK-001', outboundOrderNo: 'YCK-FAB-REQ-20260521-001', pickOrderNo: 'JHD-FAB-REQ-20260521-001', relatedOrderNo: 'YL-FAB-REQ-20260521-001', trackingNo: 'MATWB-FAB-001', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料中', pdVisible: '是', hasOutbound: '否', pickedQty: '80 米', owner: '印尼万隆主体', status: '配料中', time: '2026-05-21 11:20' },
  { id: 'PK-002', outboundOrderNo: 'YCK-FAB-REQ-20260522-002', pickOrderNo: 'JHD-FAB-REQ-20260522-002', relatedOrderNo: 'YL-FAB-REQ-20260522-002', trackingNo: 'MATWB-FAB-002', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', plannedQty: '240 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '240 米', owner: '印尼万隆主体', status: '配料完成', time: '2026-05-22 11:30' },
  { id: 'PK-003', outboundOrderNo: 'YCK-TRM-REQ-20260523-003', pickOrderNo: 'JHD-TRM-REQ-20260523-003', relatedOrderNo: 'YL-TRM-REQ-20260523-003', trackingNo: 'MATWB-TRM-003', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '3000 颗', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '无需确认', pickingStatus: '待配料', pdVisible: '是', hasOutbound: '否', pickedQty: '0 颗', owner: '雅加达电商主体', status: '待配料', time: '2026-05-23 11:40' },
  { id: 'PK-004', outboundOrderNo: 'YCK-TRM-REQ-20260524-004', pickOrderNo: 'JHD-TRM-REQ-20260524-004', relatedOrderNo: 'YL-TRM-REQ-20260524-004', trackingNo: 'MATWB-TRM-004', materialCategory: '辅料', unit: '颗', outboundWarehouse: '中央总仓-辅料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', plannedQty: '1500 颗', stockStatus: '库存部分充足', availableRatio: '68%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 颗', owner: '印尼万隆主体', status: '草稿', time: '2026-05-24 11:50' },
  { id: 'PK-005', outboundOrderNo: 'YCK-CON-REQ-20260525-005', pickOrderNo: 'JHD-CON-REQ-20260525-005', relatedOrderNo: 'YL-CON-REQ-20260525-005', trackingNo: 'MATWB-CON-005', materialCategory: '耗材', unit: '个', outboundWarehouse: '中央总仓-耗材仓', outboundType: '原料领料出库', receivingUnit: '生产车间B', plannedQty: '480 个', stockStatus: '库存不足', availableRatio: '35%', factoryConfirm: '无需确认', pickingStatus: '少拣待确认', pdVisible: '是', hasOutbound: '否', pickedQty: '168 个', owner: '印尼万隆主体', status: '少拣待确认', time: '2026-05-25 12:00' },
  { id: 'PK-006', outboundOrderNo: 'YCK-PKG-REQ-20260526-006', pickOrderNo: 'JHD-PKG-REQ-20260526-006', relatedOrderNo: 'YL-PKG-REQ-20260526-006', trackingNo: 'MATWB-PKG-006', materialCategory: '包材', unit: '个', outboundWarehouse: '中央总仓-包材仓', outboundType: '原料领料出库', receivingUnit: '生产车间D', plannedQty: '2000 个', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '已出库', pdVisible: '是', hasOutbound: '是', pickedQty: '2000 个', owner: '雅加达电商主体', status: '已出库', time: '2026-05-26 12:10' },
  { id: 'PK-007', outboundOrderNo: 'YCK-YRN-REQ-20260527-007', pickOrderNo: 'JHD-YRN-REQ-20260527-007', relatedOrderNo: 'YL-YRN-REQ-20260527-007', trackingNo: 'MATWB-YRN-007', materialCategory: '纱线', unit: '米', outboundWarehouse: '中央总仓-纱线仓', outboundType: '原料领料出库', receivingUnit: '生产车间A', plannedQty: '600 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂拒绝领取', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '印尼万隆主体', status: '工厂拒绝领取', time: '2026-05-27 12:20' },
  { id: 'PK-008', outboundOrderNo: 'YCK-FAB-REQ-20260528-008', pickOrderNo: 'JHD-FAB-REQ-20260528-008', relatedOrderNo: 'YL-FAB-REQ-20260528-008', trackingNo: 'MATWB-FAB-008', materialCategory: '面料', unit: '米', outboundWarehouse: '中央总仓-面料仓', outboundType: '原料领料出库', receivingUnit: '生产车间C', plannedQty: '320 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '已完结', pdVisible: '是', hasOutbound: '是', pickedQty: '320 米', owner: '印尼万隆主体', status: '已完结', time: '2026-05-28 12:30' },
]

const EVENT_PREFIX = 'wls-raw-issue-list'
const PREFERENCE_KEY = '/wls/raw/issue-list:list-columns'
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

const columns: StandardListColumn<RawIssueOrder>[] = [
  { key: 'numbers', title: '单号', width: 210, required: true, freezeable: true, sortable: true, sortValue: r => r.outboundOrderNo,
    render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700 font-mono text-xs" title="${escapeHtml(r.outboundOrderNo)}">${escapeHtml(r.outboundOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.pickOrderNo)}">${escapeHtml(r.pickOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.trackingNo)}">${escapeHtml(r.trackingNo)}</span></div>` },
  { key: 'materialCategory', title: '配料单类型', width: 100, sortable: true, sortValue: r => r.materialCategory,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[r.materialCategory] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.materialCategory)}</span>` },
  { key: 'outboundWarehouse', title: '出库仓库', width: 140, sortable: true, sortValue: r => r.outboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundWarehouse)}</span>` },
  { key: 'receivingUnit', title: '收货单位', width: 120, sortable: true, sortValue: r => r.receivingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.receivingUnit)}</span>` },
  { key: 'plannedQty', title: '计划配料数量', width: 120, align: 'right', sortable: true, sortValue: r => r.plannedQty,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.plannedQty)}</span>` },
  { key: 'stockStatus', title: '库存状态', width: 110, sortable: true, sortValue: r => r.stockStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[r.stockStatus] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.stockStatus)}</span>` },
  { key: 'availableRatio', title: '整单可配比例', width: 110, align: 'right', sortable: true, sortValue: r => r.availableRatio,
    render: r => `<span class="text-slate-600">${escapeHtml(r.availableRatio)}</span>` },
  { key: 'factoryConfirm', title: '工厂确认状态', width: 130, sortable: true, sortValue: r => r.factoryConfirm,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${factoryConfirmClass[r.factoryConfirm] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.factoryConfirm)}</span>` },
  { key: 'pickedQty', title: '已配料数量', width: 110, align: 'right', sortable: true, sortValue: r => r.pickedQty,
    render: r => `<span class="text-slate-600">${escapeHtml(r.pickedQty)}</span>` },
  { key: 'owner', title: '货主', width: 120, sortable: true, sortValue: r => r.owner,
    render: r => `<span class="text-slate-600">${escapeHtml(r.owner)}</span>` },
  { key: 'status', title: '状态', width: 120, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看</button>${r.pickingStatus === '草稿' ? `<button class="rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50" data-${EVENT_PREFIX}-action="factory-confirm">工厂确认</button><button class="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50" data-${EVENT_PREFIX}-action="factory-reject">工厂拒绝</button>` : ''}</div>` },
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

function filteredRows(): RawIssueOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedIssues.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.outboundOrderNo} ${o.pickOrderNo} ${o.trackingNo} ${o.materialCategory} ${o.receivingUnit} ${o.owner}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statusCounts: Record<string, number> = {}
  seedIssues.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1 })
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 配料单号 / 跟踪单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="草稿" ${state.statusFilter === '草稿' ? 'selected' : ''}>草稿</option><option value="待配料" ${state.statusFilter === '待配料' ? 'selected' : ''}>待配料</option><option value="配料中" ${state.statusFilter === '配料中' ? 'selected' : ''}>配料中</option><option value="配料完成" ${state.statusFilter === '配料完成' ? 'selected' : ''}>配料完成</option><option value="已出库" ${state.statusFilter === '已出库' ? 'selected' : ''}>已出库</option><option value="已完结" ${state.statusFilter === '已完结' ? 'selected' : ''}>已完结</option><option value="少拣待确认" ${state.statusFilter === '少拣待确认' ? 'selected' : ''}>少拣待确认</option><option value="工厂拒绝领取" ${state.statusFilter === '工厂拒绝领取' ? 'selected' : ''}>工厂拒绝领取</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料配料单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待配料', value: `${seedIssues.filter(o => o.status === '待配料').length} 条` },
      { label: '配料中', value: `${seedIssues.filter(o => o.status === '配料中').length} 条` },
      { label: '已出库', value: `${seedIssues.filter(o => o.status === '已出库').length} 条` },
    ]),
    listTitle: '配料单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无配料单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '配料单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawIssueList(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawIssueListEvent(target: HTMLElement, event?: Event): boolean {
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
