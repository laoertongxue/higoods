// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type InboundLine = { sku: string; name: string; spec: string; qty: number; qualityResult: '可售' | '瑕疵' | '报废'; stockDest: string; putawayQty: number; targetLocation: string }
type InboundOrder = {
  id: string; returnNo: string; orderNo: string; customer: string; reason: string
  status: string; created: string; qcTime: string; totalQty: number; putawayQty: number; lines: InboundLine[]
}

const statusLabel: Record<string, string> = {
  WAIT_INBOUND: '待入库', WAIT_PUTAWAY: '待上架', PARTIAL_PUTAWAY: '部分上架', COMPLETED: '上架完成',
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (['WAIT_PUTAWAY', 'PARTIAL_PUTAWAY'].includes(s)) return 'bg-amber-50 text-amber-700'
  return 'bg-blue-50 text-blue-700'
}

function qualityTag(r: string): string {
  if (r === '可售') return 'bg-emerald-50 text-emerald-700'
  if (r === '瑕疵') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function stockDest(r: string): string {
  if (r === '可售') return '现货库存'
  if (r === '瑕疵') return '瑕疵库存'
  return '破损库存'
}

const seedOrders: InboundOrder[] = [
  { id: 'RI-001', returnNo: 'RET-20260828-003', orderNo: 'SO-20260822-015', customer: '王五', reason: '不喜欢', status: 'WAIT_PUTAWAY', created: '2026-08-28 11:00', qcTime: '2026-08-28 15:00', totalQty: 1, putawayQty: 0, lines: [
    { sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', spec: '灰色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A01-05' },
  ]},
  { id: 'RI-002', returnNo: 'RET-20260828-004', orderNo: 'SO-20260823-003', customer: '赵六', reason: '发错商品', status: 'WAIT_PUTAWAY', created: '2026-08-28 13:00', qcTime: '2026-08-28 16:30', totalQty: 4, putawayQty: 0, lines: [
    { sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', spec: '黑色/M', qty: 2, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A02-01' },
    { sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', spec: '蓝色/L', qty: 2, qualityResult: '瑕疵', stockDest: stockDest('瑕疵'), putawayQty: 0, targetLocation: 'D01-03' },
  ]},
  { id: 'RI-003', returnNo: 'RET-20260827-011', orderNo: 'SO-20260819-025', customer: '周八', reason: '质量问题', status: 'PARTIAL_PUTAWAY', created: '2026-08-27 09:30', qcTime: '2026-08-27 14:00', totalQty: 3, putawayQty: 1, lines: [
    { sku: 'SKU-DRESS-BLK-S', name: '黑色连衣裙 S', spec: '黑色/S', qty: 1, qualityResult: '瑕疵', stockDest: stockDest('瑕疵'), putawayQty: 1, targetLocation: 'D01-05' },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', spec: '白色/M', qty: 2, qualityResult: '报废', stockDest: stockDest('报废'), putawayQty: 0, targetLocation: 'E02-01' },
  ]},
  { id: 'RI-004', returnNo: 'RET-20260827-010', orderNo: 'SO-20260819-022', customer: '孙七', reason: '尺码不符', status: 'COMPLETED', created: '2026-08-27 08:00', qcTime: '2026-08-27 11:00', totalQty: 2, putawayQty: 2, lines: [
    { sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', spec: '米白/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 1, targetLocation: 'A03-02' },
    { sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', spec: '黑色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 1, targetLocation: 'A03-04' },
  ]},
  { id: 'RI-005', returnNo: 'RET-20260827-014', orderNo: 'SO-20260821-040', customer: '林三三', reason: '线头多', status: 'WAIT_INBOUND', created: '2026-08-27 15:00', qcTime: '2026-08-27 17:30', totalQty: 2, putawayQty: 0, lines: [
    { sku: 'SKU-SHIRT-BLU-M', name: '蓝色衬衫 M', spec: '蓝色/M', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A04-01' },
    { sku: 'SKU-SHIRT-BLU-L', name: '蓝色衬衫 L', spec: '蓝色/L', qty: 1, qualityResult: '可售', stockDest: stockDest('可售'), putawayQty: 0, targetLocation: 'A04-02' },
  ]},
]

const EVENT_PREFIX = 'wls-return-inbound'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/return-inbound:list-columns'
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

const columns: StandardListColumn<InboundOrder>[] = [
  { key: 'returnNo', title: '退货单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.returnNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.returnNo)}">${escapeHtml(r.returnNo)}</span>` },
  { key: 'orderNo', title: '原订单号', width: 160, sortable: true, sortValue: r => r.orderNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderNo)}</span>` },
  { key: 'customer', title: '客户', width: 100, sortable: true, sortValue: r => r.customer,
    render: r => `<span class="text-slate-600">${escapeHtml(r.customer)}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'totalQty', title: '总数量', width: 80, align: 'right', sortable: true, sortValue: r => r.totalQty,
    render: r => `<span class="text-slate-600">${r.totalQty}</span>` },
  { key: 'putawayProgress', title: '上架进度', width: 100, align: 'right', sortable: true, sortValue: r => r.putawayQty / Math.max(1, r.totalQty),
    render: r => `<span class="text-slate-600">${r.putawayQty} / ${r.totalQty}</span>` },
  { key: 'stockDest', title: '库存去向', width: 260,
    render: r => `<div class="space-y-1">${r.lines.map(l =>
      `<div class="flex items-center gap-2 text-xs"><span class="text-slate-600">${escapeHtml(l.name)} ×${l.qty}</span><span class="rounded-full px-1.5 py-0.5 text-[10px] ${qualityTag(l.qualityResult)}">${escapeHtml(l.qualityResult)}</span><span class="text-slate-400">→ ${escapeHtml(l.stockDest)}</span></div>`
    ).join('')}</div>` },
  { key: 'qcTime', title: '质检时间', width: 150, sortable: true, sortValue: r => r.qcTime,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.qcTime)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => r.status !== 'COMPLETED'
      ? `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="putaway" data-order-id="${escapeHtml(r.id)}">上架</button>`
      : '<span class="text-slate-400">—</span>' },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['returnNo'] as string[],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): InboundOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.returnNo} ${o.orderNo} ${o.customer}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statuses = Object.entries(statusLabel)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="退货单号 / 原订单号 / 客户" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statuses.map(([k, v]) => `<option value="${escapeHtml(k)}" ${state.statusFilter === k ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const pending = seedOrders.filter(o => ['WAIT_INBOUND', 'WAIT_PUTAWAY'].includes(o.status)).length
  const putting = seedOrders.filter(o => o.status === 'PARTIAL_PUTAWAY').length
  const done = seedOrders.filter(o => o.status === 'COMPLETED').length

  return renderStandardListPage({
    title: '退货入库列表',
    primaryActionsHtml: renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download'),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待入库', value: `${pending}` },
      { label: '部分上架', value: `${putting}` },
      { label: '上架完成', value: `${done}` },
      { label: '总入库单', value: `${seedOrders.length}` },
    ]),
    listTitle: '退货入库列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无退货入库记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '退货入库列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderReturnInbound(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleReturnInboundEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'putaway') {
    const id = actionNode.dataset[`${DATASET_PREFIX}OrderId`] || ''
    console.log('putaway return inbound:', id)
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '退货入库列表', columns, rows: filteredRows() }); return true }
  return false
}
