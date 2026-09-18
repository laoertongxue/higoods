// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type TransferOrder = {
  transferNo: string; fromWarehouse: string; toWarehouse: string
  materialCount: number; packageQty: number; pickedQty: number
  sentQty: number; signedQty: number
  status: '草稿' | '待拣货' | '待发出' | '运输中' | '待签收' | '已签收' | '已取消'
  creator: string; createTime: string
}

const statusClass: Record<string, string> = {
  '草稿': 'bg-slate-100 text-slate-500', '待拣货': 'bg-blue-50 text-blue-700',
  '待发出': 'bg-indigo-50 text-indigo-700', '运输中': 'bg-amber-50 text-amber-700',
  '待签收': 'bg-orange-50 text-orange-700', '已签收': 'bg-emerald-50 text-emerald-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const seedOrders: TransferOrder[] = [
  { transferNo: 'TR-TF-20260716-001', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂A组', materialCount: 3, packageQty: 12, pickedQty: 12, sentQty: 12, signedQty: 12, status: '已签收', creator: '中转仓文员-小林', createTime: '2026-07-16 08:30' },
  { transferNo: 'TR-TF-20260716-002', fromWarehouse: '中央中转仓', toWarehouse: '第三方工厂-恒盛', materialCount: 2, packageQty: 8, pickedQty: 8, sentQty: 8, signedQty: 0, status: '运输中', creator: '中转仓文员-小林', createTime: '2026-07-16 09:15' },
  { transferNo: 'TR-TF-20260716-003', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂D组', materialCount: 4, packageQty: 15, pickedQty: 15, sentQty: 0, signedQty: 0, status: '待发出', creator: '中转仓文员-小张', createTime: '2026-07-16 10:00' },
  { transferNo: 'TR-TF-20260716-004', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂B组', materialCount: 2, packageQty: 6, pickedQty: 0, sentQty: 0, signedQty: 0, status: '待拣货', creator: '中转仓文员-小张', createTime: '2026-07-16 11:30' },
  { transferNo: 'TR-TF-20260716-005', fromWarehouse: '中央中转仓', toWarehouse: '自有工厂C组', materialCount: 1, packageQty: 3, pickedQty: 0, sentQty: 0, signedQty: 0, status: '草稿', creator: '中转仓文员-小林', createTime: '2026-07-16 13:00' },
  { transferNo: 'TR-TF-20260715-010', fromWarehouse: '中央中转仓', toWarehouse: '第三方工厂-恒盛', materialCount: 3, packageQty: 10, pickedQty: 0, sentQty: 0, signedQty: 0, status: '已取消', creator: '中转仓文员-小林', createTime: '2026-07-15 14:20' },
]

const EVENT_PREFIX = 'wls-transit-warehouse-transfer'
const PREFERENCE_KEY = '/wls/transit/warehouse-transfer:list-columns'
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

const columns: StandardListColumn<TransferOrder>[] = [
  { key: 'transferNo', title: '调拨单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.transferNo,
    render: r => `<span class="font-mono text-xs text-blue-600 cursor-pointer">${escapeHtml(r.transferNo)}</span>` },
  { key: 'fromWarehouse', title: '调出仓库', width: 130, sortable: true, sortValue: r => r.fromWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.fromWarehouse)}</span>` },
  { key: 'toWarehouse', title: '调入仓库', width: 140, sortable: true, sortValue: r => r.toWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.toWarehouse)}</span>` },
  { key: 'materialCount', title: '物料种类', width: 90, align: 'right', sortable: true, sortValue: r => r.materialCount,
    render: r => `<span class="text-slate-600">${r.materialCount}</span>` },
  { key: 'packageQty', title: '调拨数量', width: 90, align: 'right', sortable: true, sortValue: r => r.packageQty,
    render: r => `<span class="text-slate-600">${r.packageQty}</span>` },
  { key: 'pickedQty', title: '已拣数量', width: 90, align: 'right', sortable: true, sortValue: r => r.pickedQty,
    render: r => `<span class="text-slate-600">${r.pickedQty}</span>` },
  { key: 'sentQty', title: '已发出', width: 80, align: 'right', sortable: true, sortValue: r => r.sentQty,
    render: r => `<span class="text-slate-600">${r.sentQty}</span>` },
  { key: 'signedQty', title: '已签收', width: 80, align: 'right', sortable: true, sortValue: r => r.signedQty,
    render: r => `<span class="${r.signedQty > 0 ? 'text-emerald-600 font-medium' : 'text-slate-400'}">${r.signedQty}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 130, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.creator)}</span>` },
  { key: 'createTime', title: '创建时间', width: 140, sortable: true, sortValue: r => r.createTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.createTime)}</span>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true,
    render: r => {
      const btns: string[] = [`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看</button>`]
      if (r.status === '草稿') btns.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="submit">提交</button>`)
      if (r.status === '待发出') btns.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="confirm-send">确认发出</button>`)
      if (r.status === '运输中') btns.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="confirm-receive">确认收货</button>`)
      if (['草稿', '待拣货'].includes(r.status)) btns.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="cancel">取消</button>`)
      return `<div class="flex items-center gap-1">${btns.join('')}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['transferNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): TransferOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.transferNo} ${o.fromWarehouse} ${o.toWarehouse}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="调拨单号 / 调出仓 / 调入仓 / 物料SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option><option value="草稿" ${state.statusFilter === '草稿' ? 'selected' : ''}>草稿</option><option value="待拣货" ${state.statusFilter === '待拣货' ? 'selected' : ''}>待拣货</option><option value="待发出" ${state.statusFilter === '待发出' ? 'selected' : ''}>待发出</option><option value="运输中" ${state.statusFilter === '运输中' ? 'selected' : ''}>运输中</option><option value="待签收" ${state.statusFilter === '待签收' ? 'selected' : ''}>待签收</option><option value="已签收" ${state.statusFilter === '已签收' ? 'selected' : ''}>已签收</option><option value="已取消" ${state.statusFilter === '已取消' ? 'selected' : ''}>已取消</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderPrimaryButton('新增调拨单', { prefix: EVENT_PREFIX, action: 'create' })}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderFlowDescription(): string {
  return `<div class="rounded-lg border bg-white p-4"><h3 class="text-sm font-semibold text-slate-700 mb-2">调拨流程说明</h3><div class="flex items-center gap-2 text-xs text-slate-500"><span class="rounded bg-slate-100 px-2 py-1">草稿</span><span>→</span><span class="rounded bg-blue-50 px-2 py-1 text-blue-700">待拣货</span><span>→</span><span class="rounded bg-indigo-50 px-2 py-1 text-indigo-700">待发出</span><span>→</span><span class="rounded bg-amber-50 px-2 py-1 text-amber-700">运输中</span><span>→</span><span class="rounded bg-orange-50 px-2 py-1 text-orange-700">待签收</span><span>→</span><span class="rounded bg-emerald-50 px-2 py-1 text-emerald-700">已签收</span></div></div>`
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓 · 调拨管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '调拨单数', value: `${all.length} 条` },
      { label: '运输中', value: `${seedOrders.filter(o => o.status === '运输中').length} 条` },
      { label: '已签收', value: `${seedOrders.filter(o => o.status === '已签收').length} 条` },
    ]),
    listTitle: '调拨单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无调拨单' }) + renderFlowDescription(),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '调拨单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitWarehouseTransfer(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitWarehouseTransferEvent(target: HTMLElement, event?: Event): boolean {
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
