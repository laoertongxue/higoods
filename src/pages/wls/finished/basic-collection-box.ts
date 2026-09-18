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

type CollectionBox = { code: string; name: string; qrCode: string; warehouse: string; type: string; businessStatus: string; creator: string; created: string; updated: string; enabled: boolean }

const statusClass = (s: string) => {
  if (s === '已集齐') return 'bg-emerald-50 text-emerald-700'
  if (s === '移出中') return 'bg-amber-50 text-amber-700'
  if (s === '集货中') return 'bg-blue-50 text-blue-700'
  return 'bg-slate-100 text-slate-500'
}

const seedBoxes: CollectionBox[] = [
  { code: 'BOX-001', name: '集货周转箱 001', qrCode: 'QR-BOX-001', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '集货中', creator: '系统管理员', created: '2026-08-20 09:00', updated: '2026-08-20 09:00', enabled: true },
  { code: 'BOX-002', name: '集货周转箱 002', qrCode: 'QR-BOX-002', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '已集齐', creator: '系统管理员', created: '2026-08-20 09:02', updated: '2026-08-20 09:02', enabled: true },
  { code: 'BOX-003', name: '备用集货箱 003', qrCode: 'QR-BOX-003', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '移出中', creator: '王敏', created: '2026-08-20 09:05', updated: '2026-08-28 15:30', enabled: false },
  { code: 'BOX-004', name: '大件集货箱 004', qrCode: 'QR-BOX-004', warehouse: '成衣仓', type: '大箱', businessStatus: '空闲', creator: '王敏', created: '2026-08-20 09:08', updated: '2026-08-20 09:08', enabled: true },
  { code: 'BOX-005', name: '集货周转箱 005', qrCode: 'QR-BOX-005', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '空闲', creator: '系统管理员', created: '2026-08-20 09:10', updated: '2026-08-20 09:10', enabled: true },
  { code: 'BOX-006', name: '集货周转箱 006', qrCode: 'QR-BOX-006', warehouse: '成衣仓', type: '普通集货箱', businessStatus: '集货中', creator: '系统管理员', created: '2026-08-20 09:12', updated: '2026-08-20 09:12', enabled: true },
]

const EVENT_PREFIX = 'wls-basic-collection-box'
const PREFERENCE_KEY = '/wls/finished/basic-collection-box:list-columns'
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

const columns: StandardListColumn<CollectionBox>[] = [
  { key: 'code', title: '集货箱号', width: 120, required: true, freezeable: true, sortable: true, sortValue: r => r.code,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.code)}</span>` },
  { key: 'name', title: '集货箱名称', width: 160, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'qrCode', title: '二维码', width: 120, sortable: true, sortValue: r => r.qrCode,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.qrCode)}</span>` },
  { key: 'warehouse', title: '所属仓库', width: 100, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'businessStatus', title: '业务状态', width: 100, sortable: true, sortValue: r => r.businessStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass(r.businessStatus)}">${escapeHtml(r.businessStatus)}</span>` },
  { key: 'creator', title: '创建人', width: 100, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.creator)}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-slate-500">${escapeHtml(r.created)}</span>` },
  { key: 'updated', title: '最后修改', width: 150, sortable: true, sortValue: r => r.updated,
    render: r => `<span class="text-slate-500">${escapeHtml(r.updated)}</span>` },
  { key: 'actions', title: '操作', width: 180, required: true, actionColumn: true,
    render: r => `<button class="text-[var(--link)] hover:underline text-xs">编辑</button><button class="text-[var(--link)] hover:underline text-xs ml-2">打印二维码</button><button class="${r.businessStatus !== '空闲' ? 'text-slate-300 cursor-not-allowed text-xs ml-2' : 'text-[var(--link)] hover:underline text-xs ml-2'}">${r.enabled ? '禁用' : '启用'}</button>` },
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

function filteredRows(): CollectionBox[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return [...seedBoxes]
  return seedBoxes.filter(b =>
    b.code.toLowerCase().includes(kw)
    || b.name.toLowerCase().includes(kw)
    || b.qrCode.toLowerCase().includes(kw)
    || b.businessStatus.toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索集货箱号 / 名称 / 二维码" data-${EVENT_PREFIX}-field="keyword"></label>
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
    title: '集货箱管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '集货中', value: `${seedBoxes.filter(b => b.businessStatus === '集货中').length} 条` },
      { label: '已集齐', value: `${seedBoxes.filter(b => b.businessStatus === '已集齐').length} 条` },
      { label: '空闲', value: `${seedBoxes.filter(b => b.businessStatus === '空闲').length} 条` },
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

export function renderBasicCollectionBox(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleBasicCollectionBoxEvent(target: HTMLElement, event?: Event): boolean {
  const root = rootElement()
  if (!root) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset.wlsBasicCollectionBoxField
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
  const action = actionNode?.dataset.wlsBasicCollectionBoxAction
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
    updateColumnPreference(action, actionNode.dataset.wlsBasicCollectionBoxColumnKey || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset.wlsBasicCollectionBoxColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') localStorage.removeItem(PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  if (action === 'apply-filter') { state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '集货箱管理', columns, rows: filteredRows() }); return true }
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
