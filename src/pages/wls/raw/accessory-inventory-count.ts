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

type CountOrder = {
  countNo: string; warehouse: string; countType: string; scope: string
  detailCount: number; status: '已完成' | '待审核' | '盘点中' | '待盘点' | '已取消'
  creator: string; updatedAt: string
}

const seedOrders: CountOrder[] = [
  { countNo: 'TR-CC-20260716-001', warehouse: '中央中转仓', countType: '全盘', scope: 'A区全部库位', detailCount: 48, status: '已完成', creator: '中转仓文员-小林', updatedAt: '2026-07-16 14:30' },
  { countNo: 'TR-CC-20260716-002', warehouse: '中央中转仓', countType: '抽盘', scope: 'B区高频物料', detailCount: 16, status: '待审核', creator: '中转仓文员-小张', updatedAt: '2026-07-16 15:00' },
  { countNo: 'TR-CC-20260716-003', warehouse: '中央中转仓', countType: '动态盘', scope: 'C区异动物料', detailCount: 8, status: '盘点中', creator: '中转仓文员-小林', updatedAt: '2026-07-16 15:20' },
  { countNo: 'TR-CC-20260716-004', warehouse: '中央中转仓', countType: '全盘', scope: 'D区全部库位', detailCount: 36, status: '待盘点', creator: '中转仓文员-小张', updatedAt: '2026-07-16 15:40' },
  { countNo: 'TR-CC-20260715-001', warehouse: '中央中转仓', countType: '抽盘', scope: 'A区辅料区', detailCount: 12, status: '已取消', creator: '中转仓文员-小林', updatedAt: '2026-07-15 17:00' },
]

const statusClass: Record<string, string> = {
  '已完成': 'bg-emerald-50 text-emerald-700', '待审核': 'bg-blue-50 text-blue-700',
  '盘点中': 'bg-amber-50 text-amber-700', '待盘点': 'bg-orange-50 text-orange-700',
  '已取消': 'bg-slate-100 text-slate-400',
}

const EVENT_PREFIX = 'wls-raw-accessory-inventory-count'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/accessory-inventory-count:list-columns'
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

const columns: StandardListColumn<CountOrder>[] = [
  { key: 'countNo', title: '盘点单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.countNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.countNo)}">${escapeHtml(r.countNo)}</span>` },
  { key: 'warehouse', title: '仓库', width: 130, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-700">${escapeHtml(r.warehouse)}</span>` },
  { key: 'countType', title: '盘点类型', width: 100, sortable: true, sortValue: r => r.countType,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.countType)}</span>` },
  { key: 'scope', title: '盘点范围', width: 160, sortable: true, sortValue: r => r.scope,
    render: r => `<span class="text-slate-600">${escapeHtml(r.scope)}</span>` },
  { key: 'detailCount', title: '明细行数', width: 90, align: 'right', sortable: true, sortValue: r => r.detailCount,
    render: r => `<span class="text-slate-700 font-medium">${r.detailCount}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 130, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.creator)}</span>` },
  { key: 'updatedAt', title: '更新时间', width: 150, sortable: true, sortValue: r => r.updatedAt,
    render: r => `<span class="text-slate-400 text-xs">${escapeHtml(r.updatedAt)}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ seedOrders.indexOf(r) }">查看</button>${r.status === '待盘点' ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="start" data-${EVENT_PREFIX}-idx="${ seedOrders.indexOf(r) }">开始盘点</button>` : ''}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['countNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): CountOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.countNo} ${o.warehouse} ${o.countType} ${o.scope} ${o.creator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="盘点单号 / 仓库 / 盘点范围" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="已完成" ${state.statusFilter === '已完成' ? 'selected' : ''}>已完成</option><option value="待审核" ${state.statusFilter === '待审核' ? 'selected' : ''}>待审核</option><option value="盘点中" ${state.statusFilter === '盘点中' ? 'selected' : ''}>盘点中</option><option value="待盘点" ${state.statusFilter === '待盘点' ? 'selected' : ''}>待盘点</option><option value="已取消" ${state.statusFilter === '已取消' ? 'selected' : ''}>已取消</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '原料仓辅料盘点单',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待盘点', value: `${seedOrders.filter(o => o.status === '待盘点').length} 条` },
      { label: '盘点中', value: `${seedOrders.filter(o => o.status === '盘点中').length} 条` },
      { label: '已完成', value: `${seedOrders.filter(o => o.status === '已完成').length} 条` },
    ]),
    listTitle: '盘点单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无盘点单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '辅料盘点单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedOrders[state.detailIdx] ? renderStandardRowDetailDialog({ title: '原料仓辅料盘点单详情', columns, row: seedOrders[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderRawAccessoryInventoryCount(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawAccessoryInventoryCountEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'start') {
    const row = seedOrders[Number(actionNode.dataset['wlsRawAccessoryInventoryCountIdx'])]
    if (row && row.status === '待盘点') {
      row.status = '盘点中'
      showListFeedback(`盘点单 ${row.countNo} 已开始盘点，共 ${row.detailCount} 条明细`)
    }
    refreshWorkspace()
    return true
  }
  if (action === 'close-detail') { state.detailIdx = -1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '原料仓辅料盘点单', columns, rows: filteredRows() }); return true }
  return false
}
