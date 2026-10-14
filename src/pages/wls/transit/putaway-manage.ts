// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'

type PutawayStatus = '待上架' | '上架完成' | '已释放' | '已出库'

type PutawayTask = {
  taskNo: string; receiveNo: string; putawayLocation: string
  spu: string; sku: string
  receivedRolls: number; receivedMeters: number; putawayQty: number
  status: PutawayStatus; time: string; warehouse: string
}

const statusClass: Record<string, string> = {
  '待上架': 'bg-orange-50 text-orange-700', '上架完成': 'bg-emerald-50 text-emerald-700',
  '已释放': 'bg-slate-100 text-slate-500', '已出库': 'bg-blue-50 text-blue-700',
}

const TAB_STATUSES: Array<'ALL' | PutawayStatus> = ['ALL', '待上架', '上架完成', '已释放', '已出库']

const seedTasks: PutawayTask[] = [
  { taskNo: 'TR-PW-20260716-002', receiveNo: 'TR-RC-20260716-002', putawayLocation: 'TR-A-01', spu: 'FAB-14955', sku: 'FAB-PO14955-A', receivedRolls: 5, receivedMeters: 100, putawayQty: 5, status: '待上架', time: '2026-07-16 11:30', warehouse: 'Hilon 中转仓' },
  { taskNo: 'TR-PW-20260716-003', receiveNo: 'TR-RC-20260716-003', putawayLocation: 'TR-A-02', spu: 'FAB-14956', sku: 'FAB-PO14956-A', receivedRolls: 4, receivedMeters: 80, putawayQty: 4, status: '待上架', time: '2026-07-16 13:10', warehouse: 'Hilon 中转仓' },
  { taskNo: 'TR-PW-20260716-011', receiveNo: 'TR-RC-20260716-005', putawayLocation: 'TR-A-05', spu: 'FAB-14964', sku: 'FAB-PO14964-A', receivedRolls: 4, receivedMeters: 60, putawayQty: 4, status: '待上架', time: '2026-07-16 15:20', warehouse: 'Hilon 中转仓' },
  { taskNo: 'TR-PW-20260716-001', receiveNo: 'TR-RC-20260716-001', putawayLocation: 'TR-A-03', spu: 'FAB-14954', sku: 'FAB-PO14954-A', receivedRolls: 6, receivedMeters: 120, putawayQty: 6, status: '上架完成', time: '2026-07-16 10:20', warehouse: 'Hilon 中转仓' },
  { taskNo: 'TR-PW-20260715-010', receiveNo: 'TR-RC-20260715-001', putawayLocation: 'TR-B-03', spu: 'FAB-14940', sku: 'FAB-PO14940-A', receivedRolls: 5, receivedMeters: 90, putawayQty: 5, status: '上架完成', time: '2026-07-15 09:05', warehouse: 'Hilon 中转仓' },
  { taskNo: 'TR-PW-20260715-009', receiveNo: 'TR-RC-20260715-002', putawayLocation: 'TR-C-02', spu: 'FAB-14941', sku: 'FAB-PO14941-A', receivedRolls: 3, receivedMeters: 55, putawayQty: 3, status: '已出库', time: '2026-07-15 14:40', warehouse: 'Hilon 中转仓' },
]

const EVENT_PREFIX = 'wls-transit-putaway'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/putaway-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  confirmIdx: -1,
  detailIdx: -1,
  showColumnSettings: false,
  keyword: '',
  skuFilter: '',
  warehouseFilter: '',
  tab: 'ALL' as (typeof TAB_STATUSES)[number],
}

const columns: StandardListColumn<PutawayTask>[] = [
  { key: 'orderNo', title: '单号', width: 250, required: true, freezeable: true, sortable: true, sortValue: r => r.taskNo,
    render: r => `<div class="space-y-0.5">
      <div class="font-mono text-xs font-medium text-blue-600" title="${escapeHtml(r.taskNo)}">${escapeHtml(r.taskNo)}</div>
      <div class="font-mono text-[11px] text-slate-500">收货 ${escapeHtml(r.receiveNo)}</div>
    </div>` },
  { key: 'putawayLocation', title: '上架库位', width: 120, sortable: true, sortValue: r => r.putawayLocation,
    render: r => `<span class="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">${escapeHtml(r.putawayLocation)}</span>` },
  { key: 'fabricInfo', title: '面料信息', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<div class="space-y-0.5"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.spu)}</div><div class="font-mono text-[11px] text-slate-500">${escapeHtml(r.sku)}</div></div>` },
  { key: 'receivedQty', title: '收货数量 (卷/M)', width: 150, align: 'right', sortable: true, sortValue: r => r.receivedMeters,
    render: r => `<span class="tabular-nums text-slate-600">${r.receivedRolls} 卷 / ${r.receivedMeters} M</span>` },
  { key: 'putawayQty', title: '上架数量', width: 100, align: 'right', sortable: true, sortValue: r => r.putawayQty,
    render: r => `<span class="font-medium text-slate-700">${r.putawayQty}</span>` },
  { key: 'status', title: '上架状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'time', title: '时间', width: 140, sortable: true, sortValue: r => r.time,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.time)}</span>` },
  { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true,
    render: r => {
      const idx = seedTasks.indexOf(r)
      const buttons = [
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ idx }">查看详情</button>`,
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-log" data-${EVENT_PREFIX}-idx="${ idx }">查看日志</button>`,
      ]
      if (r.status === '待上架') buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="putaway" data-${EVENT_PREFIX}-idx="${ idx }">一键上架</button>`)
      return `<div class="flex flex-wrap items-center gap-1">${buttons.join('')}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['orderNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(t: PutawayTask): boolean {
  return state.tab === 'ALL' || t.status === state.tab
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: TAB_STATUSES.map(status => ({
      key: status,
      label: status === 'ALL' ? '全部' : status,
      count: status === 'ALL' ? seedTasks.length : seedTasks.filter(t => t.status === status).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): PutawayTask[] {
  const kw = state.keyword.trim().toLowerCase()
  const sku = state.skuFilter.trim().toLowerCase()
  return seedTasks.filter(t => {
    if (!tabMatches(t)) return false
    if (state.warehouseFilter && t.warehouse !== state.warehouseFilter) return false
    if (sku && !t.sku.toLowerCase().includes(sku)) return false
    if (!kw) return true
    return `${t.taskNo} ${t.receiveNo}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="上架单号 / 收货单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">SKU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.skuFilter)}" placeholder="SKU" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部</option><option value="Hilon 中转仓" ${state.warehouseFilter === 'Hilon 中转仓' ? 'selected' : ''}>Hilon 中转仓</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓上架单管理',
    description: '上架单管理列表，支持按单号、仓库、SKU、状态筛选',
    statusTabsHtml: renderTabsHtml(),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待上架', value: `${seedTasks.filter(t => t.status === '待上架').length} 条` },
      { label: '上架完成', value: `${seedTasks.filter(t => t.status === '上架完成').length} 条` },
      { label: '已出库', value: `${seedTasks.filter(t => t.status === '已出库').length} 条` },
    ]),
    listTitle: '上架单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的上架单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '上架单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedTasks[state.detailIdx] ? renderStandardRowDetailDialog({ title: '中转仓上架单详情', columns, row: seedTasks[state.detailIdx], eventPrefix: EVENT_PREFIX }) : '', state.confirmIdx >= 0 && seedTasks[state.confirmIdx] ? renderSimpleConfirmDialog({
      prefix: EVENT_PREFIX,
      closeAction: 'cancel-confirm',
      confirmAction: 'run-confirm',
      title: '确认上架',
      description: `确认将上架单 ${seedTasks[state.confirmIdx].taskNo} 的 ${seedTasks[state.confirmIdx].putawayQty} 件 ${seedTasks[state.confirmIdx].sku} 上架到 ${seedTasks[state.confirmIdx].putawayLocation}？`,
      confirmLabel: '确认上架',
    }) : ''].join(''),
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

export function renderTransitPutawayManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitPutawayManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'sku') { state.skuFilter = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
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
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as (typeof TAB_STATUSES)[number]
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
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
    state.skuFilter = read('sku')
    state.warehouseFilter = read('warehouse')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.skuFilter = ''
    state.warehouseFilter = ''
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
  if (action === 'view-log') { const row = seedTasks[Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])]; if (row) showListFeedback(`上架单 ${row.taskNo} 的操作日志为演示内容`, 'info'); return true }
  if (action === 'putaway') {
    state.confirmIdx = Number(actionNode.dataset[`${DATASET_PREFIX}Idx`])
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-confirm') {
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'run-confirm') {
    const row = seedTasks[state.confirmIdx]
    if (row && row.status === '待上架') {
      row.status = '上架完成'
      row.putawayQty = row.receivedRolls
      showListFeedback(`上架单 ${row.taskNo} 已完成，${row.sku} 已入位 ${row.putawayLocation}`)
    }
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓上架单管理', columns, rows: filteredRows() }); return true }
  return false
}
