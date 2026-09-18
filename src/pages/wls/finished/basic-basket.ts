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

type Basket = { code: string; qrCode: string; name: string; type: string; warehouse: string; status: 'IDLE' | 'DISABLED' | 'IN_USE'; currentWave?: string; currentOutbound?: string; currentTask?: string; lastBind?: string; lastRelease?: string }

const statusLabel: Record<string, string> = { IDLE: '空闲', DISABLED: '已禁用', IN_USE: '使用中' }
function statusClass(s: string): string {
  if (s === 'IDLE') return 'bg-emerald-50 text-emerald-700'
  if (s === 'IN_USE') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

const seedBaskets: Basket[] = [
  { code: 'WH-FINISHED-BK-001', qrCode: 'QR-BK-001', name: 'A区拣货篮 01', type: '标准篮', warehouse: '成衣仓', status: 'IN_USE', currentWave: 'JH-WAVE-20260829-004', currentOutbound: 'SO-20260820-018', currentTask: 'PK-20260829-010', lastBind: '2026-08-29 09:10', lastRelease: '2026-08-28 17:30' },
  { code: 'WH-FINISHED-BK-002', qrCode: 'QR-BK-002', name: 'A区拣货篮 02', type: '标准篮', warehouse: '成衣仓', status: 'IDLE', lastBind: '2026-08-28 16:00', lastRelease: '2026-08-28 16:45' },
  { code: 'WH-FINISHED-BK-003', qrCode: 'QR-BK-003', name: 'B区拣货篮 03', type: '标准篮', warehouse: '成衣仓', status: 'IDLE', lastBind: '2026-08-28 15:00', lastRelease: '2026-08-28 15:40' },
  { code: 'WH-FINISHED-BK-004', qrCode: 'QR-BK-004', name: 'C区拣货篮 04', type: '大篮', warehouse: '成衣仓', status: 'IN_USE', currentWave: 'JH-WAVE-20260829-003', currentOutbound: 'SO-20260829-005', currentTask: 'PK-20260829-008', lastBind: '2026-08-29 10:25', lastRelease: '2026-08-28 18:00' },
  { code: 'WH-FINISHED-BK-005', qrCode: 'QR-BK-005', name: '备用拣货篮 05', type: '标准篮', warehouse: '成衣仓', status: 'DISABLED', lastRelease: '2026-08-27 12:00' },
]

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
} = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<Basket>[] = [
  { key: 'code', title: '拣货篮编号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.code,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.code)}</span>` },
  { key: 'qrCode', title: '二维码', width: 120, sortable: true, sortValue: r => r.qrCode,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.qrCode)}</span>` },
  { key: 'name', title: '名称', width: 140, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'type', title: '类型', width: 80, sortable: true, sortValue: r => r.type,
    render: r => `<span class="text-slate-600">${escapeHtml(r.type)}</span>` },
  { key: 'warehouse', title: '所属仓库', width: 100, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'status', title: '状态', width: 90, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}">${escapeHtml(statusLabel[r.status])}</span>` },
  { key: 'currentWave', title: '当前波次', width: 200, sortable: true, sortValue: r => r.currentWave ?? '',
    render: r => `<span class="text-slate-600">${r.currentWave ? escapeHtml(r.currentWave) : '-'}</span>` },
  { key: 'currentOutbound', title: '当前出库单', width: 170, sortable: true, sortValue: r => r.currentOutbound ?? '',
    render: r => `<span class="text-slate-600">${r.currentOutbound ? escapeHtml(r.currentOutbound) : '-'}</span>` },
  { key: 'currentTask', title: '当前拣货任务', width: 160, sortable: true, sortValue: r => r.currentTask ?? '',
    render: r => `<span class="text-slate-600">${r.currentTask ? escapeHtml(r.currentTask) : '-'}</span>` },
  { key: 'lastBind', title: '最近绑定', width: 150, sortable: true, sortValue: r => r.lastBind ?? '',
    render: r => `<span class="text-slate-500">${r.lastBind ? escapeHtml(r.lastBind) : '-'}</span>` },
  { key: 'lastRelease', title: '最近释放', width: 150, sortable: true, sortValue: r => r.lastRelease ?? '',
    render: r => `<span class="text-slate-500">${r.lastRelease ? escapeHtml(r.lastRelease) : '-'}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<button class="text-[var(--link)] hover:underline text-xs">打印</button><button class="${r.status === 'IN_USE' ? 'text-slate-300 cursor-not-allowed text-xs' : 'text-[var(--link)] hover:underline text-xs'} ml-2">${r.status === 'DISABLED' ? '启用' : '禁用'}</button>` },
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
  if (!kw) return [...seedBaskets]
  return seedBaskets.filter(b =>
    b.code.toLowerCase().includes(kw)
    || b.qrCode.toLowerCase().includes(kw)
    || b.name.toLowerCase().includes(kw)
    || (b.currentWave ?? '').toLowerCase().includes(kw)
    || (b.currentOutbound ?? '').toLowerCase().includes(kw)
  )
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">综合查询</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索篮号 / 二维码 / 当前波次 / 当前出库单" data-${EVENT_PREFIX}-field="keyword"></label>
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
    title: '拣货篮管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${rows.length} 条` },
      { label: '使用中', value: `${seedBaskets.filter(b => b.status === 'IN_USE').length} 条` },
      { label: '空闲', value: `${seedBaskets.filter(b => b.status === 'IDLE').length} 条` },
      { label: '已禁用', value: `${seedBaskets.filter(b => b.status === 'DISABLED').length} 条` },
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
  if (action === 'reset-filter') { state.keyword = ''; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '拣货篮管理', columns, rows: filteredRows() }); return true }
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
