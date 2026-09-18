// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type RawRequisitionOrder = {
  id: string; outboundOrderNo: string; pickOrderNo: string; relatedOrderNo: string
  outboundType: string; outboundWarehouse: string; receivingUnit: string; requisitionMethod: string
  materialCategory: string; unit: string; plannedQty: string; stockStatus: string
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
  '待配料': 'bg-orange-50 text-orange-700',
  '配料中': 'bg-blue-50 text-blue-700',
  '待出库': 'bg-blue-50 text-blue-700',
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

const seedOrders: RawRequisitionOrder[] = [
  { id: 'PO-MAT-REQ-001', outboundOrderNo: 'YCK-MAT-REQ-20260520-001', pickOrderNo: 'JHD-MAT-REQ-20260520-001', relatedOrderNo: 'YL-MAT-REQ-20260520-001', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '80 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '80 米', owner: '印尼万隆主体', status: '待出库', time: '2026-05-20 09:10' },
  { id: 'PO-MAT-REQ-002', outboundOrderNo: 'YCK-MAT-REQ-20260521-002', pickOrderNo: 'JHD-MAT-REQ-20260521-002', relatedOrderNo: 'YL-MAT-REQ-20260521-002', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间B', requisitionMethod: '仓库配送到厂', materialCategory: '面料', unit: '米', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '待工厂确认', pickingStatus: '配料中', pdVisible: '是', hasOutbound: '否', pickedQty: '80 米', owner: '印尼万隆主体', status: '配料中', time: '2026-05-21 09:20' },
  { id: 'PO-MAT-REQ-003', outboundOrderNo: 'YCK-MAT-REQ-20260522-003', pickOrderNo: 'JHD-MAT-REQ-20260522-003', relatedOrderNo: 'YL-MAT-REQ-20260522-003', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-辅料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '辅料', unit: '颗', plannedQty: '2000 颗', stockStatus: '库存部分充足', availableRatio: '72%', factoryConfirm: '无需确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 颗', owner: '雅加达电商主体', status: '待配料', time: '2026-05-22 09:30' },
  { id: 'PO-MAT-REQ-004', outboundOrderNo: 'YCK-MAT-REQ-20260523-004', pickOrderNo: 'JHD-MAT-REQ-20260523-004', relatedOrderNo: 'YL-MAT-REQ-20260523-004', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-辅料仓', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', materialCategory: '辅料', unit: '颗', plannedQty: '3000 颗', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '3000 颗', owner: '印尼万隆主体', status: '已出库', time: '2026-05-23 09:40' },
  { id: 'PO-MAT-REQ-005', outboundOrderNo: 'YCK-MAT-REQ-20260524-005', pickOrderNo: 'JHD-MAT-REQ-20260524-005', relatedOrderNo: 'YL-MAT-REQ-20260524-005', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-耗材仓', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', materialCategory: '耗材', unit: '个', plannedQty: '480 个', stockStatus: '库存不足', availableRatio: '35%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 个', owner: '印尼万隆主体', status: '待配料', time: '2026-05-24 09:50' },
  { id: 'PO-MAT-REQ-006', outboundOrderNo: 'YCK-MAT-REQ-20260525-006', pickOrderNo: 'JHD-MAT-REQ-20260525-006', relatedOrderNo: 'YL-MAT-REQ-20260525-006', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-包材仓', receivingUnit: '生产车间D', requisitionMethod: '仓库配送到厂', materialCategory: '包材', unit: '个', plannedQty: '1200 个', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '无需确认', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '1200 个', owner: '雅加达电商主体', status: '部分出库', time: '2026-05-25 10:00' },
  { id: 'PO-MAT-REQ-007', outboundOrderNo: 'YCK-MAT-REQ-20260526-007', pickOrderNo: 'JHD-MAT-REQ-20260526-007', relatedOrderNo: 'YL-MAT-REQ-20260526-007', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '240 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '240 米', owner: '印尼万隆主体', status: '已出库', time: '2026-05-26 10:10' },
  { id: 'PO-MAT-REQ-008', outboundOrderNo: 'YCK-MAT-REQ-20260527-008', pickOrderNo: 'JHD-MAT-REQ-20260527-008', relatedOrderNo: 'YL-MAT-REQ-20260527-008', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-纱线仓', receivingUnit: '生产车间C', requisitionMethod: '仓库配送到厂', materialCategory: '纱线', unit: '米', plannedQty: '500 米', stockStatus: '库存部分充足', availableRatio: '60%', factoryConfirm: '待工厂确认', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '印尼万隆主体', status: '待配料', time: '2026-05-27 10:20' },
  { id: 'PO-MAT-REQ-901', outboundOrderNo: 'YCK-MAT-REQ-20260528-901', pickOrderNo: 'JHD-MAT-REQ-20260528-901', relatedOrderNo: 'YL-MAT-REQ-20260528-901', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间B', requisitionMethod: '工厂到仓自提', materialCategory: '面料', unit: '米', plannedQty: '320 米', stockStatus: '库存不足', availableRatio: '25%', factoryConfirm: '工厂拒绝领取', pickingStatus: '草稿', pdVisible: '否', hasOutbound: '否', pickedQty: '0 米', owner: '雅加达电商主体', status: '待配料', time: '2026-05-28 10:30' },
  { id: 'PO-MAT-REQ-902', outboundOrderNo: 'YCK-MAT-REQ-20260528-902', pickOrderNo: 'JHD-MAT-REQ-20260528-902', relatedOrderNo: 'YL-MAT-REQ-20260528-902', outboundType: '原料领料出库', outboundWarehouse: '中央总仓-面料仓', receivingUnit: '生产车间A', requisitionMethod: '仓库配送到厂', materialCategory: '面料', unit: '米', plannedQty: '160 米', stockStatus: '库存充足', availableRatio: '100%', factoryConfirm: '工厂确认领取', pickingStatus: '配料完成', pdVisible: '是', hasOutbound: '是', pickedQty: '80 米', owner: '印尼万隆主体', status: '部分出库', time: '2026-05-28 10:40' },
]

const EVENT_PREFIX = 'wls-raw-requisition-list'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/requisition-list:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  detailIdx: -1,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<RawRequisitionOrder>[] = [
  { key: 'numbers', title: '单号', width: 210, required: true, freezeable: true, sortable: true, sortValue: r => r.outboundOrderNo,
    render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700 font-mono text-xs" title="${escapeHtml(r.outboundOrderNo)}">${escapeHtml(r.outboundOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.pickOrderNo)}">${escapeHtml(r.pickOrderNo)}</span><span class="text-slate-400 font-mono text-[10px]" title="${escapeHtml(r.relatedOrderNo)}">${escapeHtml(r.relatedOrderNo)}</span></div>` },
  { key: 'materialCategory', title: '领料单类型', width: 100, sortable: true, sortValue: r => r.materialCategory,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${categoryClass[r.materialCategory] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.materialCategory)}</span>` },
  { key: 'outboundWarehouse', title: '出库仓库', width: 140, sortable: true, sortValue: r => r.outboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundWarehouse)}</span>` },
  { key: 'receivingUnit', title: '收货单位', width: 120, sortable: true, sortValue: r => r.receivingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.receivingUnit)}</span>` },
  { key: 'requisitionMethod', title: '领料方式', width: 120, sortable: true, sortValue: r => r.requisitionMethod,
    render: r => `<span class="text-slate-500">${escapeHtml(r.requisitionMethod)}</span>` },
  { key: 'plannedQty', title: '计划领料数量', width: 120, align: 'right', sortable: true, sortValue: r => r.plannedQty,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.plannedQty)}</span>` },
  { key: 'stockStatus', title: '库存状态', width: 110, sortable: true, sortValue: r => r.stockStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${stockStatusClass[r.stockStatus] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.stockStatus)}</span>` },
  { key: 'availableRatio', title: '整单可配比例', width: 110, align: 'right', sortable: true, sortValue: r => r.availableRatio,
    render: r => `<span class="text-slate-600">${escapeHtml(r.availableRatio)}</span>` },
  { key: 'factoryConfirm', title: '工厂确认状态', width: 130, sortable: true, sortValue: r => r.factoryConfirm,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${factoryConfirmClass[r.factoryConfirm] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.factoryConfirm)}</span>` },
  { key: 'pickingStatus', title: '配料单状态', width: 100, sortable: true, sortValue: r => r.pickingStatus,
    render: r => `<span class="text-slate-500">${escapeHtml(r.pickingStatus)}</span>` },
  { key: 'pickedQty', title: '已配料数量', width: 110, align: 'right', sortable: true, sortValue: r => r.pickedQty,
    render: r => `<span class="text-slate-600">${escapeHtml(r.pickedQty)}</span>` },
  { key: 'owner', title: '货主', width: 120, sortable: true, sortValue: r => r.owner,
    render: r => `<span class="text-slate-600">${escapeHtml(r.owner)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: (r) => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ seedOrders.indexOf(r) }">查看</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['numbers'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): RawRequisitionOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.outboundOrderNo} ${o.pickOrderNo} ${o.relatedOrderNo} ${o.materialCategory} ${o.receivingUnit} ${o.owner}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 复核单号 / 配料单号 / 关联单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待配料" ${state.statusFilter === '待配料' ? 'selected' : ''}>待配料</option><option value="配料中" ${state.statusFilter === '配料中' ? 'selected' : ''}>配料中</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option><option value="部分出库" ${state.statusFilter === '部分出库' ? 'selected' : ''}>部分出库</option><option value="已出库" ${state.statusFilter === '已出库' ? 'selected' : ''}>已出库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料领料单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待配料', value: `${seedOrders.filter(o => o.status === '待配料').length} 条` },
      { label: '配料中', value: `${seedOrders.filter(o => o.status === '配料中').length} 条` },
      { label: '已出库', value: `${seedOrders.filter(o => o.status === '已出库').length} 条` },
    ]),
    listTitle: '领料单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无领料单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '领料单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedOrders[state.detailIdx] ? renderStandardRowDetailDialog({ title: '原料领料单列表详情', columns, row: seedOrders[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderRawRequisitionList(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawRequisitionListEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
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
  if (action === 'view') { state.detailIdx = Number(actionNode.dataset[`${DATASET_PREFIX}Idx`]); refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailIdx = -1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '原料领料单列表', columns, rows: filteredRows() }); return true }
  return false
}
