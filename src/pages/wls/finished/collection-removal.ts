// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type RemovalLine = { sku: string; name: string; qty: number; removed: number; origin: string; recommend: string }
type RemovalTask = { id: string; orderId: string; box: string; reason: string; status: '待移出' | '移出中' | '已完成'; created: string; lines: RemovalLine[] }

const seedTasks: RemovalTask[] = [
  { id: 'CR-20260829-001', orderId: 'JH-CANCEL-001', box: 'BOX-003', reason: '订单取消', status: '待移出', created: '2026-08-29 11:10', lines: [
    { sku: 'SKU-HOOD-BLK-L', name: '黑色连帽卫衣 L', qty: 1, removed: 0, origin: 'A05-01', recommend: 'A05-01' },
    { sku: 'SKU-PANTS-BLK-L', name: '黑色休闲裤 L', qty: 1, removed: 0, origin: 'A05-02', recommend: 'A05-02' },
  ]},
  { id: 'CR-20260829-002', orderId: 'JH-TIMEOUT-002', box: 'BOX-005', reason: '集货超时', status: '待移出', created: '2026-08-29 11:30', lines: [
    { sku: 'SKU-TEE-GRY-M', name: '灰色短袖 M', qty: 2, removed: 0, origin: 'A03-04（不可用）', recommend: 'A03-06' },
  ]},
  { id: 'CR-20260828-003', orderId: 'JH-20260828-015', box: 'BOX-007', reason: '订单取消', status: '移出中', created: '2026-08-28 15:20', lines: [
    { sku: 'SKU-DRESS-RED-S', name: '红色连衣裙 S', qty: 1, removed: 1, origin: 'B02-03', recommend: 'B02-03' },
    { sku: 'SKU-SKIRT-WHT-M', name: '白色半裙 M', qty: 1, removed: 0, origin: 'B02-05', recommend: 'B02-05' },
  ]},
  { id: 'CR-20260828-004', orderId: 'JH-20260828-018', box: 'BOX-009', reason: '商品破损', status: '已完成', created: '2026-08-28 10:00', lines: [
    { sku: 'SKU-JACKET-NAV-L', name: '藏蓝夹克 L', qty: 1, removed: 1, origin: 'C03-02', recommend: 'C03-02' },
  ]},
]

function badgeClass(s: string): string {
  if (s === '已完成') return 'bg-emerald-50 text-emerald-700'
  if (s === '移出中') return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

const EVENT_PREFIX = 'wls-collection-removal'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/collection-removal:list-columns'
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

const columns: StandardListColumn<RemovalTask>[] = [
  { key: 'id', title: '移出任务号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.id,
    render: r => `<span class="font-mono text-xs text-blue-600 font-medium">${escapeHtml(r.id)}</span>` },
  { key: 'orderId', title: '订单号', width: 160, sortable: true, sortValue: r => r.orderId,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderId)}</span>` },
  { key: 'shipNo', title: '发货单号', width: 160, sortable: true, sortValue: r => r.orderId.replace('JH-', 'SO-'),
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderId.replace('JH-', 'SO-'))}</span>` },
  { key: 'box', title: '集货箱号', width: 110, sortable: true, sortValue: r => r.box,
    render: r => `<span class="font-medium text-blue-700">${escapeHtml(r.box)}</span>` },
  { key: 'skuCount', title: '箱内SKU', width: 80, align: 'center', sortable: true, sortValue: r => r.lines.length,
    render: r => `<span class="text-slate-600">${r.lines.length}</span>` },
  { key: 'totalQty', title: '箱内商品', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.qty, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.qty, 0)}</span>` },
  { key: 'removedQty', title: '已回库', width: 80, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.removed, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.removed, 0)}</span>` },
  { key: 'reason', title: '移出原因', width: 120, sortable: true, sortValue: r => r.reason,
    render: r => `<span class="text-slate-600">${escapeHtml(r.reason)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(r.status)}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.created)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ seedTasks.indexOf(r) }">查看详情</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['id'],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): RemovalTask[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedTasks.filter(t => {
    if (state.statusFilter && t.status !== state.statusFilter) return false
    if (!kw) return true
    return `${t.id} ${t.orderId} ${t.box}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="移出任务号 / 订单号 / 集货箱号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">移出状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待移出" ${state.statusFilter === '待移出' ? 'selected' : ''}>待移出</option><option value="移出中" ${state.statusFilter === '移出中' ? 'selected' : ''}>移出中</option><option value="已完成" ${state.statusFilter === '已完成' ? 'selected' : ''}>已完成</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '移出集货',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待移出', value: `${seedTasks.filter(t => t.status === '待移出').length} 个` },
      { label: '移出中', value: `${seedTasks.filter(t => t.status === '移出中').length} 个` },
      { label: '已完成', value: `${seedTasks.filter(t => t.status === '已完成').length} 个` },
    ]),
    listTitle: '移出任务列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无移出任务' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '移出任务列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedTasks[state.detailIdx] ? renderStandardRowDetailDialog({ title: '移出集货详情', columns, row: seedTasks[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderCollectionRemoval(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleCollectionRemovalEvent(target: HTMLElement, event?: Event): boolean {
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
    const statusSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (statusSelect) state.statusFilter = statusSelect.value
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
  if (action === 'export') { exportStandardListRows({ fileName: '移出集货', columns, rows: filteredRows() }); return true }
  return false
}
