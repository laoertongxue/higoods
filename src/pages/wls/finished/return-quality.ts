// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type QcLine = { sku: string; name: string; spec: string; receivedQty: number; qualityResult: '可售' | '瑕疵' | '报废' | null }
type QcOrder = {
  id: string; returnNo: string; orderNo: string; customer: string; reason: string
  created: string; receivedTime: string; totalQty: number; qcDone: number; lines: QcLine[]
}

function qualityBadgeText(r: string | null): string {
  if (r === '可售') return '可售'
  if (r === '瑕疵') return '瑕疵'
  if (r === '报废') return '报废'
  return '待选择'
}

function qualityBadgeClass(r: string | null): string {
  if (r === '可售') return 'bg-emerald-50 text-emerald-700'
  if (r === '瑕疵') return 'bg-amber-50 text-amber-700'
  if (r === '报废') return 'bg-red-50 text-red-700'
  return 'bg-slate-100 text-slate-400'
}

const seedOrders: QcOrder[] = [
  { id: 'QC-001', returnNo: 'RET-20260828-002', orderNo: 'SO-20260821-008', customer: '李四', reason: '质量问题', created: '2026-08-28 10:30', receivedTime: '2026-08-28 14:20', totalQty: 2, qcDone: 0, lines: [
    { sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', spec: '卡其/S', receivedQty: 1, qualityResult: null },
    { sku: 'SKU-PANTS-BLK-M', name: '黑色休闲裤 M', spec: '黑色/M', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-002', returnNo: 'RET-20260828-006', orderNo: 'SO-20260823-011', customer: '吴九', reason: '色差严重', created: '2026-08-28 15:00', receivedTime: '2026-08-28 16:30', totalQty: 3, qcDone: 1, lines: [
    { sku: 'SKU-DRESS-RED-M', name: '红色连衣裙 M', spec: '红色/M', receivedQty: 2, qualityResult: '瑕疵' },
    { sku: 'SKU-BLOUSE-WHT-S', name: '白色衬衫 S', spec: '白色/S', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-003', returnNo: 'RET-20260828-007', orderNo: 'SO-20260824-002', customer: '郑十', reason: '面料破损', created: '2026-08-28 16:00', receivedTime: '2026-08-28 17:10', totalQty: 1, qcDone: 0, lines: [
    { sku: 'SKU-COAT-NAVY-L', name: '藏青大衣 L', spec: '藏青/L', receivedQty: 1, qualityResult: null },
  ]},
  { id: 'QC-004', returnNo: 'RET-20260827-012', orderNo: 'SO-20260820-030', customer: '陈一一', reason: '尺码发错', created: '2026-08-27 11:00', receivedTime: '2026-08-27 15:40', totalQty: 2, qcDone: 2, lines: [
    { sku: 'SKU-TEE-BLU-M', name: '蓝色短袖 M', spec: '蓝色/M', receivedQty: 1, qualityResult: '可售' },
    { sku: 'SKU-TEE-BLU-L', name: '蓝色短袖 L', spec: '蓝色/L', receivedQty: 1, qualityResult: '可售' },
  ]},
  { id: 'QC-005', returnNo: 'RET-20260827-013', orderNo: 'SO-20260820-033', customer: '黄二二', reason: '脱线', created: '2026-08-27 14:00', receivedTime: '2026-08-27 16:50', totalQty: 4, qcDone: 2, lines: [
    { sku: 'SKU-SKIRT-PNK-S', name: '粉色半裙 S', spec: '粉色/S', receivedQty: 2, qualityResult: '报废' },
    { sku: 'SKU-CARD-BEI-M', name: '米色开衫 M', spec: '米色/M', receivedQty: 2, qualityResult: '可售' },
  ]},
]

const EVENT_PREFIX = 'wls-return-quality'
const PREFERENCE_KEY = '/wls/finished/return-quality:list-columns'
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

const columns: StandardListColumn<QcOrder>[] = [
  { key: 'returnNo', title: '退货单号', width: 170, required: true, freezeable: true, sortable: true, sortValue: r => r.returnNo,
    render: r => `<span class="font-mono text-xs text-blue-600 font-medium">${escapeHtml(r.returnNo)}</span>` },
  { key: 'orderNo', title: '原订单号', width: 160, sortable: true, sortValue: r => r.orderNo,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderNo)}</span>` },
  { key: 'customer', title: '客户', width: 100, sortable: true, sortValue: r => r.customer,
    render: r => `<span class="text-slate-600">${escapeHtml(r.customer)}</span>` },
  { key: 'reason', title: '退货原因', width: 120, sortable: true, sortValue: r => r.reason,
    render: r => `<span class="text-slate-600">${escapeHtml(r.reason)}</span>` },
  { key: 'totalQty', title: '退货数量', width: 90, align: 'right', sortable: true, sortValue: r => r.totalQty,
    render: r => `<span class="text-slate-600">${r.totalQty}</span>` },
  { key: 'qcDone', title: '质检进度', width: 100, align: 'center', sortable: true, sortValue: r => r.qcDone,
    render: r => `<span class="text-slate-600">${r.qcDone} / ${r.lines.length}</span>` },
  { key: 'qualityResult', title: '质检结果', width: 200, sortable: false,
    render: r => r.lines.map(l => `<span class="rounded-full px-2 py-0.5 text-xs ${qualityBadgeClass(l.qualityResult)}">${qualityBadgeText(l.qualityResult)}</span>`).join(' ') },
  { key: 'receivedTime', title: '收货时间', width: 150, sortable: true, sortValue: r => r.receivedTime,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.receivedTime)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="submit-qc" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">提交质检</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['returnNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): QcOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (!kw) return true
    return `${o.returnNo} ${o.orderNo} ${o.customer} ${o.reason}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="退货单号 / 原订单号 / 客户" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const pending = seedOrders.filter(o => o.qcDone < o.lines.length).length
  const done = seedOrders.filter(o => o.qcDone >= o.lines.length).length
  return renderStandardListPage({
    title: '退货质检列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待质检', value: `${pending} 条` },
      { label: '已完成质检', value: `${done} 条` },
      { label: '总退货单', value: `${seedOrders.length} 条` },
    ]),
    listTitle: '质检单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无质检记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '退货质检列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderReturnQuality(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleReturnQualityEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
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
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
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
  if (action === 'submit-qc') {
    const id = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Id`] || ''
    console.log('submit quality check:', id)
    return true
  }
  if (action === 'export') { return true }
  return false
}
