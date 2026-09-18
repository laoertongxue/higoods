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

type BarcodeRule = { id: string; name: string; objectType: string; prefix: string; dateFormat: string; serialLength: number; enabled: boolean; example: string }

const seedRules: BarcodeRule[] = [
  { id: 'BR-001', name: '出库单号规则', objectType: '出库单', prefix: 'SO', dateFormat: 'YYYYMMDD', serialLength: 4, enabled: true, example: 'SO-20260829-0001' },
  { id: 'BR-002', name: '入库单号规则', objectType: '入库单', prefix: 'SI', dateFormat: 'YYYYMMDD', serialLength: 4, enabled: true, example: 'SI-20260829-0001' },
  { id: 'BR-003', name: '波次号规则', objectType: '波次', prefix: 'WV', dateFormat: 'YYYYMMDD', serialLength: 3, enabled: true, example: 'WV-20260829-001' },
  { id: 'BR-004', name: '拣货篮编号规则', objectType: '拣货篮', prefix: 'BK', dateFormat: 'NONE', serialLength: 5, enabled: true, example: 'BK-00001' },
  { id: 'BR-005', name: '集货箱编号规则', objectType: '集货箱', prefix: 'BOX', dateFormat: 'NONE', serialLength: 3, enabled: true, example: 'BOX-001' },
  { id: 'BR-006', name: '退货单号规则', objectType: '退货单', prefix: 'RET', dateFormat: 'YYYYMMDD', serialLength: 3, enabled: false, example: 'RET-20260829-001' },
]

const EVENT_PREFIX = 'wls-basic-barcode-rule'
const PREFERENCE_KEY = '/wls/finished/basic-barcode-rule:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state: {
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  keyword: string
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<BarcodeRule>[] = [
  { key: 'name', title: '规则名称', width: 160, required: true, freezeable: true, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-700 font-medium">${escapeHtml(r.name)}</span>` },
  { key: 'objectType', title: '条码对象', width: 100, sortable: true, sortValue: r => r.objectType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.objectType)}</span>` },
  { key: 'prefix', title: '编码前缀', width: 100, sortable: true, sortValue: r => r.prefix,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.prefix)}</span>` },
  { key: 'dateFormat', title: '日期格式', width: 110, sortable: true, sortValue: r => r.dateFormat,
    render: r => `<span class="text-slate-600">${escapeHtml(r.dateFormat)}</span>` },
  { key: 'serialLength', title: '流水位数', width: 90, align: 'right', sortable: true, sortValue: r => r.serialLength,
    render: r => `<span class="text-slate-600">${r.serialLength}</span>` },
  { key: 'example', title: '示例编码', width: 200, sortable: true, sortValue: r => r.example,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.example)}</span>` },
  { key: 'enabled', title: '状态', width: 80, sortable: true, sortValue: r => r.enabled,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${r.enabled ? '启用' : '停用'}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true,
    render: r => `<button class="text-[var(--link)] hover:underline text-xs">编辑</button><button class="text-[var(--link)] hover:underline text-xs ml-2">${r.enabled ? '停用' : '启用'}</button>` },
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

function filteredRows(): BarcodeRule[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return [...seedRules]
  return seedRules.filter(r =>
    r.name.toLowerCase().includes(kw)
    || r.objectType.toLowerCase().includes(kw)
    || r.prefix.toLowerCase().includes(kw)
    || r.example.toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索规则名称 / 条码对象 / 编码前缀" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
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
    title: '条码规则管理',
    showHeader: false,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '启用', value: `${seedRules.filter(r => r.enabled).length} 条` },
      { label: '停用', value: `${seedRules.filter(r => !r.enabled).length} 条` },
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

export function renderBasicBarcodeRule(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicBarcodeRuleEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicBarcodeRuleField
    if (name === 'keyword') { state.keyword = field.value; return true }
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
  const action = actionNode?.dataset.wlsBasicBarcodeRuleAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.wlsBasicBarcodeRuleColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicBarcodeRuleColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { return true }
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
