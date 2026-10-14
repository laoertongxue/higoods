// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  sortStandardListRows,
  loadListColumnPreferences,
  saveListColumnPreferences,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'

type Basket = { code: string; type: '拣货篮' | '集货篮'; warehouse: 'F&M WH' | 'A&C WH'; status: '启用' | '停用'; lastPrintedAt: string; createdAt: string }

const seedBaskets: Basket[] = [
  { code: 'FMW-BK-001', type: '拣货篮', warehouse: 'F&M WH', status: '启用', lastPrintedAt: '2026-09-12 09:10', createdAt: '2026-08-01 10:00' },
  { code: 'FMW-BK-002', type: '拣货篮', warehouse: 'F&M WH', status: '启用', lastPrintedAt: '2026-09-10 14:22', createdAt: '2026-08-01 10:05' },
  { code: 'FMW-CB-001', type: '集货篮', warehouse: 'F&M WH', status: '启用', lastPrintedAt: '', createdAt: '2026-08-20 11:30' },
  { code: 'ANC-BK-001', type: '拣货篮', warehouse: 'A&C WH', status: '停用', lastPrintedAt: '2026-09-08 08:40', createdAt: '2026-08-12 09:00' },
  { code: 'ANC-CB-001', type: '集货篮', warehouse: 'A&C WH', status: '启用', lastPrintedAt: '2026-09-11 16:05', createdAt: '2026-08-25 15:20' },
]

const BASKET_TYPES = ['拣货篮', '集货篮'] as const
const BASKET_TYPE_LABELS: Record<string, string> = { 拣货篮: '拣货篮', 集货篮: '集货篮' }
const BASKET_WAREHOUSES = ['F&M WH', 'A&C WH'] as const
type BasketTab = '全部' | (typeof BASKET_TYPES)[number]

const EVENT_PREFIX = 'wls-basic-basket'
const PREFERENCE_KEY = '/wls/finished/basic-basket:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  keyword: string
  tab: BasketTab
  warehouseFilter: string
  statusFilter: string
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  tab: '全部',
  warehouseFilter: '',
  statusFilter: '',
}

const columns: StandardListColumn<Basket>[] = [
  { key: 'select', title: '勾选', width: 50, required: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'code', title: '编号', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.code,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.code)}</span>` },
  { key: 'type', title: '类型', width: 100, sortable: true, sortValue: r => r.type,
    render: r => `<span class="text-slate-600">${escapeHtml(BASKET_TYPE_LABELS[r.type] || r.type)}</span>` },
  { key: 'warehouse', title: '仓库', width: 100, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'status', title: '状态', width: 90, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.status === '启用' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'lastPrintedAt', title: '最后打印时间', width: 160, sortable: true, sortValue: r => r.lastPrintedAt,
    render: r => `<span class="text-xs text-slate-500">${r.lastPrintedAt ? escapeHtml(r.lastPrintedAt) : '-'}</span>` },
  { key: 'createdAt', title: '创建时间', width: 160, sortable: true, sortValue: r => r.createdAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.createdAt)}</span>` },
  { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
    render: r => `<button class="text-[var(--link)] hover:underline text-xs">打印</button><button class="text-[var(--link)] hover:underline text-xs ml-2">${r.status === '启用' ? '停用' : '启用'}</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: [],
    pageSize: 20,
  }, [...PAGE_SIZE_OPTIONS])
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultPreferences()
  state.preferences = typeof window === 'undefined' || typeof document === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, [...PAGE_SIZE_OPTIONS])
}

function filteredRows(): Basket[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedBaskets.filter(b => {
    if (state.tab !== '全部' && b.type !== state.tab) return false
    if (state.warehouseFilter && b.warehouse !== state.warehouseFilter) return false
    if (state.statusFilter && b.status !== state.statusFilter) return false
    if (!kw) return true
    return b.code.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><p class="mb-3 text-xs text-slate-500">维护集货标签编号，支持批量添加并打印条码标签</p><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索编号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">全部仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${BASKET_WAREHOUSES.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">全部状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="启用" ${state.statusFilter === '启用' ? 'selected' : ''}>启用</option><option value="停用" ${state.statusFilter === '停用' ? 'selected' : ''}>停用</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('清除', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderTypeTabs(): string {
  const tabs: Array<{ key: BasketTab; label: string }> = [
    { key: '全部', label: '全部' },
    ...BASKET_TYPES.map(type => ({ key: type as BasketTab, label: BASKET_TYPE_LABELS[type] })),
  ]
  return renderTabs({
    tabs: tabs.map(tab => ({
      key: tab.key,
      label: tab.label,
      count: tab.key === '全部' ? seedBaskets.length : seedBaskets.filter(b => b.type === tab.key).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const rows = filteredRows()
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => {
    const col = columns.find(c => c.key === key)
    return col?.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[key]
  })
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  return renderStandardListPage({
    title: '集货标签管理',
    statusTabsHtml: renderTypeTabs(),
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('批量添加', { prefix: EVENT_PREFIX, action: 'batch-add' }, 'plus')}${renderSecondaryButton('批量打印标签', { prefix: EVENT_PREFIX, action: 'batch-print' }, 'printer')}${renderSecondaryButton('启用', { prefix: EVENT_PREFIX, action: 'batch-enable' }, 'check')}${renderSecondaryButton('停用', { prefix: EVENT_PREFIX, action: 'batch-disable' }, 'ban')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '拣货篮', value: `${seedBaskets.filter(b => b.type === '拣货篮').length} 条` },
      { label: '集货篮', value: `${seedBaskets.filter(b => b.type === '集货篮').length} 条` },
      { label: '停用', value: `${seedBaskets.filter(b => b.status === '停用').length} 条` },
    ]),
    listTitle: `共 ${rows.length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无数据' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

export function renderBasicBasket(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicBasketEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicBasketField
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      const pageSize = Number((field as HTMLSelectElement).value)
      state.preferences.pageSize = ([...PAGE_SIZE_OPTIONS] as number[]).includes(pageSize) ? pageSize as (typeof PAGE_SIZE_OPTIONS)[number] : 10
      state.currentPage = 1
      persistPreferences()
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.wlsBasicBasketAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action.startsWith('switch-tab:')) { state.tab = action.slice('switch-tab:'.length) as BasketTab; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || actionNode.dataset.column_key || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.wlsBasicBasketColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicBasketColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.warehouseFilter = ''; state.statusFilter = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'batch-add') { showListFeedback('批量添加为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'batch-print') { showListFeedback('已生成批量标签打印任务', 'success'); return true }
  if (action === 'batch-enable') { showListFeedback('已启用所选标签', 'success'); return true }
  if (action === 'batch-disable') { showListFeedback('已停用所选标签', 'success'); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '集货标签管理', columns, rows: filteredRows() }); return true }
  return false
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find(item => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) visibleKeys = visibleKeys.includes(columnKey) ? visibleKeys.filter(key => key !== columnKey) : [...visibleKeys, columnKey]
  if (action === 'toggle-column-freeze' && column.freezeable) frozenKeys = frozenKeys.includes(columnKey) ? frozenKeys.filter(key => key !== columnKey) : [...frozenKeys, columnKey]
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, [...PAGE_SIZE_OPTIONS])
  persistPreferences()
  refreshWorkspace()
}
