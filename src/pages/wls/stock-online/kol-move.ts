// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { kolMoveSeed, KOL_MOVE_STATUSES, type KolMoveRow } from './seed.ts'

const statusClass: Record<string, string> = {
  待处理: 'bg-amber-50 text-amber-700',
  已生成移货单: 'bg-blue-50 text-blue-700',
  已驳回: 'bg-red-50 text-red-700',
  已完成: 'bg-emerald-50 text-emerald-700',
}

const EVENT_PREFIX = 'wls-online-kol-move'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/kol-move:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  detailId: '',
  keyword: '',
  statusFilter: '' as string,
  startDate: '',
  endDate: '',
}

const columns: StandardListColumn<KolMoveRow>[] = [
  { key: 'applyNo', title: 'ID', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.applyNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.applyNo)}</span>` },
  { key: 'applyInfo', title: '申请信息', width: 200, sortable: true, sortValue: r => `${r.applicant} ${r.applyTime}`,
    render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.applicant)}</span><span class="text-xs text-slate-400">${escapeHtml(r.applyTime)}</span></div>` },
  { key: 'productInfo', title: '商品信息', width: 240, sortable: true, sortValue: r => `${r.productName} ${r.spu} ${r.sku}`,
    render: r => `<div class="flex flex-col gap-0.5"><span class="text-slate-700">${escapeHtml(r.productName)}</span><span class="font-mono text-xs text-slate-500">${escapeHtml(r.spu)} / ${escapeHtml(r.sku)}</span></div>` },
  { key: 'applyQty', title: '申请数量', width: 100, align: 'right', sortable: true, sortValue: r => r.applyQty,
    render: r => `<span class="font-medium text-slate-700">${r.applyQty}</span>` },
  { key: 'status', title: '状态', width: 120, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'remark', title: '备注', width: 180, sortable: true, sortValue: r => r.remark,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.remark || '-')}</span>` },
  { key: 'actions', title: '操作', width: 90, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['applyNo'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): KolMoveRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const start = state.startDate.trim()
  const end = state.endDate.trim()
  return kolMoveSeed.filter(r => {
    if (state.statusFilter && r.status !== state.statusFilter) return false
    const day = r.applyTime.slice(0, 10)
    if (start && day < start) return false
    if (end && day > end) return false
    if (!kw) return true
    return `${r.applyNo} ${r.spu} ${r.sku} ${r.applicant} ${r.productName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="申请单号 / SPU / 申请人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option>${KOL_MOVE_STATUSES.map(s => `<option value="${escapeHtml(s)}" ${state.statusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">开始时间</span><input type="date" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.startDate)}" data-${EVENT_PREFIX}-field="startDate"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">结束时间</span><input type="date" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.endDate)}" data-${EVENT_PREFIX}-field="endDate"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? kolMoveSeed.find(r => r.id === state.detailId) : undefined
  return renderStandardListPage({
    title: 'KOL移货申请',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('发起移货申请', { prefix: EVENT_PREFIX, action: 'apply-move' }, 'plus')}${renderSecondaryButton('发起退还申请', { prefix: EVENT_PREFIX, action: 'apply-return' }, 'rotate-ccw')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '申请单数', value: `${kolMoveSeed.length} 条` },
      { label: '待处理', value: `${kolMoveSeed.filter(r => r.status === '待处理').length} 条` },
      { label: '已生成移货单', value: `${kolMoveSeed.filter(r => r.status === '已生成移货单').length} 条` },
      { label: '已驳回', value: `${kolMoveSeed.filter(r => r.status === '已驳回').length} 条` },
    ]),
    listTitle: '移货申请列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的移货申请' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: 'KOL移货申请列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '移货申请明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
    ].join(''),
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

export function renderKolMove(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleKolMoveEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'startDate') { state.startDate = field.value; return true }
    if (name === 'endDate') { state.endDate = field.value; return true }
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
    const root = rootElement()
    const read = (name: string) => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${name}"]`)?.value ?? ''
    state.keyword = read('keyword')
    state.statusFilter = read('status')
    state.startDate = read('startDate')
    state.endDate = read('endDate')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = ''
    state.startDate = ''
    state.endDate = ''
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
  if (action === 'view-detail') { state.detailId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''; refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailId = ''; refreshWorkspace(); return true }
  if (action === 'apply-move') { showListFeedback('发起移货申请为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'apply-return') { showListFeedback('发起退还申请为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: 'KOL移货申请', columns, rows: filteredRows() }); return true }
  return false
}
