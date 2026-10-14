// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type AllocationType = '货架组合配齐' | '本批直接配齐'
type AllocationStatus = '待配料' | '已配料'

type AllocationOrder = {
  taskNo: string; receiveNo: string; allocationType: AllocationType
  spu: string; sku: string
  planQty: number; actualQty: number; workAreaQty: number; shelfQty: number; warehouseQty: number
  flowStatus: string; taskStatus: AllocationStatus; generatedTime: string
}

const typeClass: Record<string, string> = {
  '货架组合配齐': 'bg-amber-50 text-amber-700', '本批直接配齐': 'bg-emerald-50 text-emerald-700',
}

const TAB_STATUSES: Array<'ALL' | AllocationStatus> = ['ALL', '待配料', '已配料']

const seedOrders: AllocationOrder[] = [
  { taskNo: 'TR-AL-20260716-001', receiveNo: 'TR-RC-20260716-001', allocationType: '本批直接配齐', spu: 'FAB-14954', sku: 'FAB-PO14954-A', planQty: 8, actualQty: 0, workAreaQty: 8, shelfQty: 0, warehouseQty: 8, flowStatus: '待接收', taskStatus: '待配料', generatedTime: '2026-07-16 09:36' },
  { taskNo: 'TR-AL-20260716-004', receiveNo: 'TR-RC-20260716-001', allocationType: '本批直接配齐', spu: 'FAB-14957', sku: 'FAB-PO14957-A', planQty: 5, actualQty: 5, workAreaQty: 0, shelfQty: 0, warehouseQty: 5, flowStatus: '已流转', taskStatus: '已配料', generatedTime: '2026-07-16 09:39' },
  { taskNo: 'TR-AL-20260716-005', receiveNo: 'TR-RC-20260716-001', allocationType: '货架组合配齐', spu: 'FAB-14958', sku: 'FAB-PO14958-A', planQty: 7, actualQty: 0, workAreaQty: 6, shelfQty: 1, warehouseQty: 7, flowStatus: '待接收', taskStatus: '待配料', generatedTime: '2026-07-16 09:43' },
  { taskNo: 'TR-AL-20260716-009', receiveNo: 'TR-RC-20260716-005', allocationType: '本批直接配齐', spu: 'FAB-14962', sku: 'FAB-PO14962-A', planQty: 6, actualQty: 6, workAreaQty: 0, shelfQty: 0, warehouseQty: 6, flowStatus: '已流转', taskStatus: '已配料', generatedTime: '2026-07-16 15:06' },
  { taskNo: 'TR-AL-20260716-010', receiveNo: 'TR-RC-20260716-005', allocationType: '货架组合配齐', spu: 'FAB-14963', sku: 'FAB-PO14963-A', planQty: 9, actualQty: 0, workAreaQty: 8, shelfQty: 1, warehouseQty: 9, flowStatus: '待接收', taskStatus: '待配料', generatedTime: '2026-07-16 15:13' },
]

const EVENT_PREFIX = 'wls-transit-allocation'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/allocation-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  detailId: '',
  confirmId: '',
  tab: 'ALL' as (typeof TAB_STATUSES)[number],
}

const columns: StandardListColumn<AllocationOrder>[] = [
  { key: 'select', title: '勾选', width: 50, required: true, leadingControlColumn: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'orderNo', title: '单号', width: 250, required: true, freezeable: true, sortable: true, sortValue: r => r.taskNo,
    render: r => `<div class="space-y-0.5">
      <div class="font-mono text-xs font-medium text-blue-600" title="${escapeHtml(r.taskNo)}">${escapeHtml(r.taskNo)}</div>
      <div class="font-mono text-[11px] text-slate-500">收货 ${escapeHtml(r.receiveNo)}</div>
    </div>` },
  { key: 'allocationType', title: '配料类型', width: 120, sortable: true, sortValue: r => r.allocationType,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${typeClass[r.allocationType]}">${escapeHtml(r.allocationType)}</span>` },
  { key: 'fabricInfo', title: '面料信息', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<div class="space-y-0.5"><div class="font-mono text-xs text-slate-700">${escapeHtml(r.spu)}</div><div class="font-mono text-[11px] text-slate-500">${escapeHtml(r.sku)}</div></div>` },
  { key: 'planQty', title: '计划数量', width: 90, align: 'right', sortable: true, sortValue: r => r.planQty,
    render: r => `<span class="text-slate-600">${r.planQty}</span>` },
  { key: 'actualQty', title: '实际配料数量', width: 120, align: 'right', sortable: true, sortValue: r => r.actualQty,
    render: r => `<span class="font-medium text-slate-700">${r.actualQty}</span>` },
  { key: 'workAreaQty', title: '作业区数量', width: 100, align: 'right', sortable: true, sortValue: r => r.workAreaQty,
    render: r => `<span class="text-slate-600">${r.workAreaQty}</span>` },
  { key: 'shelfQty', title: '货架数量', width: 90, align: 'right', sortable: true, sortValue: r => r.shelfQty,
    render: r => `<span class="text-slate-600">${r.shelfQty}</span>` },
  { key: 'warehouseQty', title: '仓库已有数量', width: 120, align: 'right', sortable: true, sortValue: r => r.warehouseQty,
    render: r => `<span class="text-slate-600">${r.warehouseQty}</span>` },
  { key: 'flowStatus', title: '流转状态', width: 100, sortable: true, sortValue: r => r.flowStatus,
    render: r => `<span class="text-xs ${r.flowStatus === '已流转' ? 'text-emerald-600' : 'text-slate-400'}">${escapeHtml(r.flowStatus)}</span>` },
  { key: 'taskStatus', title: '任务状态', width: 100, sortable: true, sortValue: r => r.taskStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.taskStatus === '已配料' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'generatedTime', title: '生成时间', width: 140, sortable: true, sortValue: r => r.generatedTime,
    render: r => `<span class="text-xs text-slate-400">${escapeHtml(r.generatedTime)}</span>` },
  { key: 'actions', title: '操作', width: 240, required: true, actionColumn: true,
    render: r => {
      const buttons = [
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-id="${escapeHtml(r.taskNo)}">查看详情</button>`,
        `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-log" data-${EVENT_PREFIX}-id="${escapeHtml(r.taskNo)}">查看日志</button>`,
      ]
      if (r.taskStatus === '待配料') buttons.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="complete-allocation" data-${EVENT_PREFIX}-id="${escapeHtml(r.taskNo)}">完成配料</button>`)
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

function tabMatches(o: AllocationOrder): boolean {
  return state.tab === 'ALL' || o.taskStatus === state.tab
}

function renderTabsHtml(): string {
  return renderTabs({
    tabs: TAB_STATUSES.map(status => ({
      key: status,
      label: status === 'ALL' ? '全部' : status,
      count: status === 'ALL' ? seedOrders.length : seedOrders.filter(o => o.taskStatus === status).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function filteredRows(): AllocationOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedOrders.filter(o => {
    if (!tabMatches(o)) return false
    if (!kw) return true
    return `${o.taskNo} ${o.receiveNo} ${o.spu} ${o.sku}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="配料单号 / 收货单号 / 预入库单号 / 生产单号" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = seedOrders.find((order) => order.taskNo === state.detailId)
  const confirmRow = seedOrders.find((order) => order.taskNo === state.confirmId)
  return renderStandardListPage({
    title: '中转配料单管理',
    description: '中转调配配料单列表（收货配齐后生成），支持按配料单号、收货单号、预入库单号、生产单号、状态筛选',
    statusTabsHtml: renderTabsHtml(),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待配料', value: `${seedOrders.filter(o => o.taskStatus === '待配料').length} 条` },
      { label: '已配料', value: `${seedOrders.filter(o => o.taskStatus === '已配料').length} 条` },
    ]),
    listTitle: '配料单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的配料单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: `${state.showColumnSettings ? renderStandardListColumnSettings({ title: '配料单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : ''}${
      detailRow
        ? renderStandardRowDetailDialog({ title: `配料单详情 · ${detailRow.taskNo}`, columns, row: detailRow, eventPrefix: EVENT_PREFIX })
        : ''
    }${
      confirmRow
        ? renderSimpleConfirmDialog({
            prefix: EVENT_PREFIX,
            closeAction: 'cancel-confirm',
            confirmAction: 'run-confirm',
            title: '确认完成配料',
            description: `确认完成配料单 ${confirmRow.taskNo} 的 ${confirmRow.planQty} 件 ${confirmRow.sku} 配料？完成后方可生成出库单。`,
            confirmLabel: '确认完成配料',
          })
        : ''
    }`,
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

export function renderTransitAllocationManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitAllocationManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
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
  if (action === 'complete-allocation') {
    state.confirmId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-confirm') {
    state.confirmId = ''
    refreshWorkspace()
    return true
  }
  if (action === 'run-confirm') {
    const row = seedOrders.find((order) => order.taskNo === state.confirmId)
    if (row) {
      row.taskStatus = '已配料'
      row.actualQty = row.planQty
      row.flowStatus = '已流转'
      showListFeedback(`配料单 ${row.taskNo} 已完成配料 ${row.actualQty} 件`)
    }
    state.confirmId = ''
    refreshWorkspace()
    return true
  }
  if (action === 'view') {
    state.detailId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''
    refreshWorkspace()
    return true
  }
  if (action === 'close-detail') {
    state.detailId = ''
    refreshWorkspace()
    return true
  }
  if (action === 'view-log') { const row = seedOrders.find((order) => order.taskNo === (actionNode.dataset[`${DATASET_PREFIX}Id`] || '')); if (row) showListFeedback(`配料单 ${row.taskNo} 的操作日志为演示内容`, 'info'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '中转配料单', columns, rows: filteredRows() }); return true }
  return false
}
