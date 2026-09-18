// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type AccessoryTransfer = {
  transferNo: string; fromWarehouse: string; toWarehouse: string; material: string
  spu: string; sku: string; productName: string; qty: number
  status: '待出库' | '运输中' | '待签收' | '已签收' | '已取消'
  creator: string; createTime: string; completeTime: string
}

const seedOrders: AccessoryTransfer[] = [
  { transferNo: 'TR-AT-20260716-001', fromWarehouse: '原料仓A', toWarehouse: '中转仓', material: '辅料', spu: 'SPU-ACC-10001', sku: 'SKU-ACC-40001', productName: '拉链-5号-白', qty: 200, status: '已签收', creator: '原料仓文员-小王', createTime: '2026-07-16 08:30', completeTime: '2026-07-16 14:00' },
  { transferNo: 'TR-AT-20260716-002', fromWarehouse: '原料仓B', toWarehouse: '中转仓', material: '辅料', spu: 'SPU-ACC-10002', sku: 'SKU-ACC-40002', productName: '纽扣-金属银', qty: 500, status: '运输中', creator: '原料仓文员-小李', createTime: '2026-07-16 09:00', completeTime: '-' },
  { transferNo: 'TR-AT-20260716-003', fromWarehouse: '原料仓A', toWarehouse: '车间线边仓', material: '辅料', spu: 'SPU-ACC-10003', sku: 'SKU-ACC-40003', productName: '缝纫线-40S/白色', qty: 100, status: '待出库', creator: '原料仓文员-小王', createTime: '2026-07-16 09:30', completeTime: '-' },
  { transferNo: 'TR-AT-20260716-004', fromWarehouse: '原料仓C', toWarehouse: '中转仓', material: '辅料', spu: 'SPU-ACC-10004', sku: 'SKU-ACC-40004', productName: '织带-1cm-黑色', qty: 300, status: '待签收', creator: '原料仓文员-小张', createTime: '2026-07-16 10:00', completeTime: '-' },
  { transferNo: 'TR-AT-20260716-005', fromWarehouse: '原料仓B', toWarehouse: '车间线边仓', material: '辅料', spu: 'SPU-ACC-10005', sku: 'SKU-ACC-40005', productName: '标签-主标', qty: 1000, status: '已取消', creator: '原料仓文员-小李', createTime: '2026-07-16 10:30', completeTime: '-' },
  { transferNo: 'TR-AT-20260715-001', fromWarehouse: '原料仓A', toWarehouse: '中转仓', material: '辅料', spu: 'SPU-ACC-10006', sku: 'SKU-ACC-40006', productName: '吊牌-合格证', qty: 2000, status: '已签收', creator: '原料仓文员-小王', createTime: '2026-07-15 14:00', completeTime: '2026-07-15 17:30' },
]

const statusClass: Record<string, string> = {
  '待出库': 'bg-orange-50 text-orange-700', '运输中': 'bg-amber-50 text-amber-700',
  '待签收': 'bg-blue-50 text-blue-700', '已签收': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const EVENT_PREFIX = 'wls-raw-accessory-transfer'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/accessory-transfer:list-columns'
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

const columns: StandardListColumn<AccessoryTransfer>[] = [
  { key: 'transferNo', title: '调拨单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.transferNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.transferNo)}">${escapeHtml(r.transferNo)}</span>` },
  { key: 'fromWarehouse', title: '调出仓', width: 120, sortable: true, sortValue: r => r.fromWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.fromWarehouse)}</span>` },
  { key: 'toWarehouse', title: '调入仓', width: 120, sortable: true, sortValue: r => r.toWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.toWarehouse)}</span>` },
  { key: 'material', title: '物料类型', width: 100, sortable: true, sortValue: r => r.material,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.material)}</span>` },
  { key: 'spu', title: 'SPU', width: 150, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: 'SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'productName', title: '品名', width: 150, sortable: true, sortValue: r => r.productName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productName)}</span>` },
  { key: 'qty', title: '数量', width: 80, align: 'right', sortable: true, sortValue: r => r.qty,
    render: r => `<span class="text-slate-700 font-medium">${r.qty}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 130, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.creator)}</span>` },
  { key: 'createTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.createTime)}</span>` },
  { key: 'completeTime', title: '完成时间', width: 150, sortable: true, sortValue: r => r.completeTime,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.completeTime)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ seedOrders.indexOf(r) }">查看</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['transferNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): AccessoryTransfer[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.transferNo} ${o.fromWarehouse} ${o.toWarehouse} ${o.spu} ${o.sku} ${o.productName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="调拨单号 / 仓库 / SKU / 品名" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option><option value="运输中" ${state.statusFilter === '运输中' ? 'selected' : ''}>运输中</option><option value="待签收" ${state.statusFilter === '待签收' ? 'selected' : ''}>待签收</option><option value="已签收" ${state.statusFilter === '已签收' ? 'selected' : ''}>已签收</option><option value="已取消" ${state.statusFilter === '已取消' ? 'selected' : ''}>已取消</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料仓辅料调拨单',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待出库', value: `${seedOrders.filter(o => o.status === '待出库').length} 条` },
      { label: '运输中', value: `${seedOrders.filter(o => o.status === '运输中').length} 条` },
      { label: '已签收', value: `${seedOrders.filter(o => o.status === '已签收').length} 条` },
    ]),
    listTitle: '辅料调拨列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无调拨单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '辅料调拨列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedOrders[state.detailIdx] ? renderStandardRowDetailDialog({ title: '原料仓辅料调拨单详情', columns, row: seedOrders[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderRawAccessoryTransfer(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawAccessoryTransferEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'export') { exportStandardListRows({ fileName: '原料仓辅料调拨单', columns, rows: filteredRows() }); return true }
  return false
}
