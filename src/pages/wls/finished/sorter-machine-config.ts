// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type SorterMachine = {
  code: string; name: string; type: 'EXPRESS_SORT' | 'RETURN_REJECT_SORT'
  warehouse: string; identifyType: string; defaultExceptionGate: string
  gateCount: number; status: '启用' | '停用'
}

const typeLabel: Record<string, string> = { EXPRESS_SORT: '快递分拣', RETURN_REJECT_SORT: '退货拒收分拣' }

const seedMachines: SorterMachine[] = [
  { code: 'SORTER-001', name: '快递分拣机 01', type: 'EXPRESS_SORT', warehouse: '成衣仓', identifyType: 'TRACKING_NO', defaultExceptionGate: 'GATE-EX-01', gateCount: 12, status: '启用' },
  { code: 'SORTER-002', name: '拒收分拣机 01', type: 'RETURN_REJECT_SORT', warehouse: '成衣仓', identifyType: 'RETURN_NO', defaultExceptionGate: 'GATE-EX-02', gateCount: 8, status: '启用' },
  { code: 'SORTER-003', name: '快递分拣机 02', type: 'EXPRESS_SORT', warehouse: '成衣仓', identifyType: 'ORDER_NO', defaultExceptionGate: 'GATE-EX-01', gateCount: 10, status: '停用' },
]

const EVENT_PREFIX = 'wls-sorter-machine-config'
const PREFERENCE_KEY = '/wls/finished/sorter-machine-config:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
}

const columns: StandardListColumn<SorterMachine>[] = [
  { key: 'code', title: '机器编号', width: 140, required: true, freezeable: true, sortable: true, sortValue: r => r.code,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.code)}">${escapeHtml(r.code)}</span>` },
  { key: 'name', title: '机器名称', width: 160, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-700">${escapeHtml(r.name)}</span>` },
  { key: 'type', title: '机器类型', width: 140, sortable: true, sortValue: r => r.type,
    render: r => `<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">${escapeHtml(typeLabel[r.type])}</span>` },
  { key: 'warehouse', title: '所属仓库', width: 140, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'identifyType', title: '识别号码类型', width: 140, sortable: true, sortValue: r => r.identifyType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.identifyType)}</span>` },
  { key: 'defaultExceptionGate', title: '默认异常口', width: 130, sortable: true, sortValue: r => r.defaultExceptionGate,
    render: r => `<span class="text-slate-600">${escapeHtml(r.defaultExceptionGate)}</span>` },
  { key: 'gateCount', title: '格口数量', width: 100, align: 'right', sortable: true, sortValue: r => r.gateCount,
    render: r => `<span class="text-slate-600">${r.gateCount}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.status === '启用' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="edit">编辑</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="go-gate-config" data-machine-code="${escapeHtml(r.code)}">格口配置</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="go-records" data-machine-code="${escapeHtml(r.code)}">查看记录</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['code'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): SorterMachine[] {
  const kw = state.keyword.trim().toLowerCase()
  if (!kw) return seedMachines
  return seedMachines.filter(m => `${m.code} ${m.name} ${m.warehouse}`.toLowerCase().includes(kw))
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="机器编号 / 名称 / 仓库" data-${EVENT_PREFIX}-field="keyword"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '分拣机配置',
    primaryActionsHtml: renderPrimaryButton('新增分拣机', { prefix: EVENT_PREFIX, action: 'add-machine' }),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '分拣机总数', value: `${seedMachines.length} 台` },
      { label: '启用', value: `${seedMachines.filter(m => m.status === '启用').length} 台` },
      { label: '停用', value: `${seedMachines.filter(m => m.status === '停用').length} 台` },
    ]),
    listTitle: '分拣机列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无分拣机' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '分拣机列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderSorterMachineConfig(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleSorterMachineConfigEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
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
  const action = actionNode?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Action`]
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
    const key = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || actionNode.closest<HTMLElement>(`[data-${EVENT_PREFIX}-column-key]`)?.dataset[`${EVENT_PREFIX.replace(/-/g, '')}ColumnKey`] || ''
    const col = columns.find(c => c.key === key)
    if (!col || col.actionColumn) return true
    if (action === 'toggle-column-visibility' && col.required) return true
    const prop = action === 'toggle-column-freeze' ? 'frozenKeys' : 'visibleKeys'
    state.preferences[prop] = state.preferences[prop].includes(key) ? state.preferences[prop].filter(k => k !== key) : [...state.preferences[prop], key]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    refreshWorkspace()
    return true
  }
  return false
}
