// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type ReturnLine = { sku: string; name: string; spec: string; qty: number; receivedQty: number; defectQty: number }
type ReturnOrder = {
  id: string; returnNo: string; orderNo: string; shipNo: string; platform: string; customer: string
  status: string; reason: string; created: string; deadline: string; warehouse: string
  totalQty: number; receivedQty: number; defectQty: number; lines: ReturnLine[]
}

const statusLabel: Record<string, string> = {
  WAIT_RECEIVE: '待收货', WAIT_QC: '待质检', WAIT_INBOUND: '待入库',
  WAIT_PUTAWAY: '待上架', PARTIAL_PUTAWAY: '部分上架', COMPLETED: '已完成',
}

function badgeClass(s: string): string {
  if (['COMPLETED'].includes(s)) return 'bg-emerald-50 text-emerald-700'
  if (['WAIT_PUTAWAY', 'PARTIAL_PUTAWAY'].includes(s)) return 'bg-amber-50 text-amber-700'
  if (['WAIT_RECEIVE', 'WAIT_QC'].includes(s)) return 'bg-blue-50 text-blue-700'
  return 'bg-slate-50 text-slate-600'
}

const seedOrders: ReturnOrder[] = [
  { id: 'RO-001', returnNo: 'RET-20260828-001', orderNo: 'SO-20260820-012', shipNo: 'SF-20260825-001', platform: 'TikTok', customer: '张三', status: 'WAIT_RECEIVE', reason: '尺码不符', created: '2026-08-28 09:00', deadline: '2026-08-30 18:00', warehouse: '成衣仓', totalQty: 3, receivedQty: 0, defectQty: 0, lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', spec: '黑色/M', qty: 2, receivedQty: 0, defectQty: 0 },
    { sku: 'SKU-TEE-WHT-L', name: '白色短袖 L', spec: '白色/L', qty: 1, receivedQty: 0, defectQty: 0 },
  ]},
  { id: 'RO-002', returnNo: 'RET-20260828-002', orderNo: 'SO-20260821-008', shipNo: 'SF-20260825-002', platform: 'Shopee', customer: '李四', status: 'WAIT_QC', reason: '质量问题', created: '2026-08-28 10:30', deadline: '2026-08-30 12:00', warehouse: '成衣仓', totalQty: 2, receivedQty: 2, defectQty: 0, lines: [
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', spec: '卡其/S', qty: 1, receivedQty: 1, defectQty: 0 },
    { sku: 'SKU-PANTS-BLK-M', name: '黑色休闲裤 M', spec: '黑色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-003', returnNo: 'RET-20260828-003', orderNo: 'SO-20260822-015', shipNo: 'SF-20260826-001', platform: '独立站', customer: '王五', status: 'WAIT_INBOUND', reason: '不喜欢', created: '2026-08-28 11:00', deadline: '2026-08-31 18:00', warehouse: '成衣仓', totalQty: 1, receivedQty: 1, defectQty: 0, lines: [
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', spec: '灰色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-004', returnNo: 'RET-20260828-004', orderNo: 'SO-20260823-003', shipNo: 'SF-20260826-002', platform: 'TikTok', customer: '赵六', status: 'WAIT_PUTAWAY', reason: '发错商品', created: '2026-08-28 13:00', deadline: '2026-08-31 10:00', warehouse: '成衣仓', totalQty: 4, receivedQty: 4, defectQty: 1, lines: [
    { sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', spec: '黑色/M', qty: 2, receivedQty: 2, defectQty: 0 },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', spec: '蓝色/L', qty: 2, receivedQty: 2, defectQty: 1 },
  ]},
  { id: 'RO-005', returnNo: 'RET-20260827-010', orderNo: 'SO-20260819-022', shipNo: 'SF-20260824-005', platform: 'Shopee', customer: '孙七', status: 'COMPLETED', reason: '尺码不符', created: '2026-08-27 08:00', deadline: '2026-08-29 18:00', warehouse: '成衣仓', totalQty: 2, receivedQty: 2, defectQty: 0, lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', spec: '米白/M', qty: 1, receivedQty: 1, defectQty: 0 },
    { sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', spec: '黑色/M', qty: 1, receivedQty: 1, defectQty: 0 },
  ]},
  { id: 'RO-006', returnNo: 'RET-20260827-011', orderNo: 'SO-20260819-025', shipNo: 'SF-20260824-008', platform: '独立站', customer: '周八', status: 'PARTIAL_PUTAWAY', reason: '质量问题', created: '2026-08-27 09:30', deadline: '2026-08-30 12:00', warehouse: '成衣仓', totalQty: 3, receivedQty: 3, defectQty: 2, lines: [
    { sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', spec: '黑色/S', qty: 1, receivedQty: 1, defectQty: 1 },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', spec: '白色/M', qty: 2, receivedQty: 2, defectQty: 1 },
  ]},
]

const EVENT_PREFIX = 'wls-return-orders'
const PREFERENCE_KEY = '/wls/finished/return-orders:list-columns'
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

const columns: StandardListColumn<ReturnOrder>[] = [
  { key: 'returnNo', title: '退货单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.returnNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.returnNo)}">${escapeHtml(r.returnNo)}</span>` },
  { key: 'orderNo', title: '原订单号', width: 160, sortable: true, sortValue: r => r.orderNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderNo)}</span>` },
  { key: 'shipNo', title: '发货单号', width: 160, sortable: true, sortValue: r => r.shipNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.shipNo)}</span>` },
  { key: 'platform', title: '平台', width: 100, sortable: true, sortValue: r => r.platform,
    render: r => `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">${escapeHtml(r.platform)}</span>` },
  { key: 'customer', title: '客户', width: 100, sortable: true, sortValue: r => r.customer,
    render: r => `<span class="text-slate-600">${escapeHtml(r.customer)}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'reason', title: '退货原因', width: 120, sortable: true, sortValue: r => r.reason,
    render: r => `<span class="text-slate-600">${escapeHtml(r.reason)}</span>` },
  { key: 'totalQty', title: '应退数量', width: 90, align: 'right', sortable: true, sortValue: r => r.totalQty,
    render: r => `<span class="text-slate-600">${r.totalQty}</span>` },
  { key: 'receivedQty', title: '已收数量', width: 90, align: 'right', sortable: true, sortValue: r => r.receivedQty,
    render: r => `<span class="text-slate-600">${r.receivedQty}</span>` },
  { key: 'defectQty', title: '不良数量', width: 90, align: 'right', sortable: true, sortValue: r => r.defectQty,
    render: r => `<span class="${r.defectQty > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}">${r.defectQty}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.created)}</span>` },
  { key: 'actions', title: '操作', width: 110, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="view-detail" data-order-id="${escapeHtml(r.id)}">开始收货</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['returnNo'] as string[],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): ReturnOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.returnNo} ${o.orderNo} ${o.shipNo} ${o.customer}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statuses = Object.entries(statusLabel)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="退货单号 / 原订单号 / 发货单号 / 客户" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statuses.map(([k, v]) => `<option value="${escapeHtml(k)}" ${state.statusFilter === k ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '退货收货列表',
    primaryActionsHtml: renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download'),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待收货', value: `${seedOrders.filter(o => o.status === 'WAIT_RECEIVE').length}` },
      { label: '待质检', value: `${seedOrders.filter(o => o.status === 'WAIT_QC').length}` },
      { label: '已完成', value: `${seedOrders.filter(o => o.status === 'COMPLETED').length}` },
      { label: '总退货单', value: `${seedOrders.length}` },
    ]),
    listTitle: '退货收货列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无退货收货记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '退货收货列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderReturnOrders(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleReturnOrdersEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'view-detail') {
    const id = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}OrderId`] || ''
    console.log('view return order detail:', id)
    return true
  }
  if (action === 'export') { return true }
  return false
}
