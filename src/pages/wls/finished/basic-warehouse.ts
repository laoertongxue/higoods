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

type Warehouse = { code: string; name: string; type: '自建' | '合作'; businessType: string; contact: string; country: string; timezone: string; manager: string; enabled: boolean; subjects: string[] }

const seedWarehouses: Warehouse[] = [
  { code: 'WH-FINISHED', name: '成衣仓', type: '自建', businessType: '成衣仓储', contact: '王仓管', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '王敏', enabled: true, subjects: ['HiGood 中国'] },
  { code: 'WH-TRANSIT', name: '中转仓', type: '合作', businessType: '中转仓储', contact: '李经理', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '李强', enabled: true, subjects: ['HiGood 中国', '顺达物流'] },
  { code: 'WH-RAW', name: '原料仓', type: '自建', businessType: '原料仓储', contact: '赵主管', country: '中国', timezone: 'Asia/Shanghai (UTC+8)', manager: '赵刚', enabled: true, subjects: ['HiGood 中国'] },
  { code: 'WH-ID', name: '印尼成品仓', type: '合作', businessType: '成衣仓储', contact: 'Budi', country: '印度尼西亚', timezone: 'Asia/Jakarta (UTC+7)', manager: 'Budi Santoso', enabled: false, subjects: ['PT HiGood Indonesia'] },
]

const EVENT_PREFIX = 'wls-basic-warehouse'
const PREFERENCE_KEY = '/wls/finished/basic/warehouse:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

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

const columns: StandardListColumn<Warehouse>[] = [
  { key: 'code', title: '仓库编码', width: 130, required: true, freezeable: true, sortable: true, sortValue: r => r.code,
    render: r => `<span class="font-medium text-[var(--link)]">${escapeHtml(r.code)}</span>` },
  { key: 'name', title: '仓库名称', width: 130, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-700">${escapeHtml(r.name)}</span>` },
  { key: 'type', title: '类型', width: 80, sortable: true, sortValue: r => r.type,
    render: r => `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">${escapeHtml(r.type)}</span>` },
  { key: 'businessType', title: '属性', width: 100, sortable: true, sortValue: r => r.businessType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.businessType)}</span>` },
  { key: 'subjects', title: '所属主体', width: 180, sortable: true, sortValue: r => r.subjects.join(','),
    render: r => `<span class="text-slate-600">${escapeHtml(r.subjects.join(', '))}</span>` },
  { key: 'contact', title: '联系人', width: 100, sortable: true, sortValue: r => r.contact,
    render: r => `<span class="text-slate-600">${escapeHtml(r.contact)}</span>` },
  { key: 'country', title: '国家', width: 110, sortable: true, sortValue: r => r.country,
    render: r => `<span class="text-slate-600">${escapeHtml(r.country)}</span>` },
  { key: 'timezone', title: '时区', width: 180, sortable: true, sortValue: r => r.timezone,
    render: r => `<span class="text-slate-500">${escapeHtml(r.timezone)}</span>` },
  { key: 'enabled', title: '启用', width: 70, sortable: true, sortValue: r => r.enabled,
    render: r => `<label class="relative inline-flex cursor-items-center"><input type="checkbox" ${r.enabled ? 'checked' : ''} class="peer sr-only" disabled /><span class="h-5 w-9 rounded-full ${r.enabled ? 'bg-[var(--link)]' : 'bg-slate-200'} after:absolute after:${r.enabled ? 'left-[18px]' : 'left-[2px]'} after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all"></span></label>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: () => `<button class="text-[var(--link)] hover:underline text-xs">修改</button><button class="text-red-500 hover:underline text-xs ml-2">删除</button>` },
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

function filteredRows(): Warehouse[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return [...seedWarehouses]
  return seedWarehouses.filter(w =>
    w.code.toLowerCase().includes(kw)
    || w.name.toLowerCase().includes(kw)
    || w.contact.toLowerCase().includes(kw)
    || w.country.toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="按仓库编码 / 名称搜索" data-${EVENT_PREFIX}-field="keyword"></label>
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
    title: '仓库管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '自建', value: `${seedWarehouses.filter(w => w.type === '自建').length} 条` },
      { label: '合作', value: `${seedWarehouses.filter(w => w.type === '合作').length} 条` },
      { label: '启用', value: `${seedWarehouses.filter(w => w.enabled).length} 条` },
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

export function renderBasicWarehouse(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicWarehouseEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicWarehouseField
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
  const action = actionNode?.dataset.wlsBasicWarehouseAction
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
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
    updateColumnPreference(action, actionNode.dataset.wlsBasicWarehouseColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicWarehouseColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '仓库管理', columns, rows: filteredRows() }); return true }
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
