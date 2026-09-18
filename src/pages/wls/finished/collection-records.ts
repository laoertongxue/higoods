// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type Log = { type: string; order: string; sku: string; qty: number | string; box: string; location: string; operator: string; time: string; note: string }

const seedLogs: Log[] = [
  { type: '创建拣货波次', order: 'JH-20260829-001、JH-20260829-002', sku: '-', qty: 6, box: '-', location: 'A区', operator: '仓库主管-王敏', time: '2026-08-29 10:20', note: '仅增加波次占用，库存位置未变化' },
  { type: 'PDA拣货', order: 'JH-20260829-003', sku: 'SKU-JACKET-KHA-S', qty: 1, box: '-', location: 'C01-01', operator: 'PDA操作员-张伟', time: '2026-08-29 10:40', note: '库位与SKU扫码校验通过' },
  { type: 'PDA拣货', order: 'JH-20260820-018', sku: 'SKU-CARD-WHT-M', qty: 1, box: '-', location: 'A03-08', operator: 'PDA操作员-张伟', time: '2026-08-29 09:15', note: '库位与SKU扫码校验通过' },
  { type: '交接集货区', order: 'JH-20260820-018', sku: 'SKU-CARD-WHT-M', qty: 1, box: '-', location: '集货区待分配', operator: 'PDA操作员-张伟', time: '2026-08-29 09:45', note: '来源 A03-08，正常库存减少、波次占用释放、待分配库存增加' },
  { type: '二次分拨', order: 'JH-20260829-001', sku: 'SKU-DRESS-BLK-M', qty: 2, box: 'BOX-001', location: '订单集货箱', operator: 'PDA操作员-张伟', time: '2026-08-29 10:31', note: 'SKU与集货箱扫码确认' },
  { type: '二次分拨', order: 'JH-20260829-002', sku: 'SKU-DRESS-BLK-M', qty: 2, box: 'BOX-002', location: '订单集货箱', operator: 'PDA操作员-张伟', time: '2026-08-29 10:33', note: 'SKU与集货箱扫码确认' },
  { type: '集货移出回库', order: 'JH-CANCEL-001', sku: 'SKU-HOOD-BLK-L', qty: 1, box: 'BOX-003', location: 'A05-01', operator: '张仓管', time: '2026-08-29 11:20', note: '订单取消；扫码回库' },
]

const EVENT_PREFIX = 'wls-collection-records'
const PREFERENCE_KEY = '/wls/finished/collection-records:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  typeFilter: '' as string,
}

const columns: StandardListColumn<Log>[] = [
  { key: 'type', title: '动作类型', width: 140, required: true, freezeable: true, sortable: true, sortValue: r => r.type,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.type)}</span>` },
  { key: 'order', title: '关联订单', width: 220, sortable: true, sortValue: r => r.order,
    render: r => `<span class="text-slate-600">${escapeHtml(r.order)}</span>` },
  { key: 'sku', title: 'SKU', width: 170, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'qty', title: '数量', width: 80, align: 'center', sortable: true, sortValue: r => typeof r.qty === 'number' ? r.qty : 0,
    render: r => `<span class="text-slate-600">${r.qty}</span>` },
  { key: 'box', title: '箱/波次', width: 120, sortable: true, sortValue: r => r.box,
    render: r => `<span class="text-slate-600">${escapeHtml(r.box)}</span>` },
  { key: 'location', title: '位置', width: 140, sortable: true, sortValue: r => r.location,
    render: r => `<span class="text-slate-600">${escapeHtml(r.location)}</span>` },
  { key: 'operator', title: '操作人', width: 150, sortable: true, sortValue: r => r.operator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operator)}</span>` },
  { key: 'time', title: '时间', width: 150, sortable: true, sortValue: r => r.time,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.time)}</span>` },
  { key: 'note', title: '说明', width: 300, sortable: true, sortValue: r => r.note,
    render: r => `<span class="text-slate-400">${escapeHtml(r.note)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: [] as string[],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): Log[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedLogs.filter(l => {
    if (state.typeFilter && l.type !== state.typeFilter) return false
    if (!kw) return true
    return `${l.type} ${l.order} ${l.sku} ${l.operator} ${l.note}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const types = [...new Set(seedLogs.map(l => l.type))]
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="动作类型 / 订单 / SKU / 操作人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">动作类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="type"><option value="">全部</option>${types.map(t => `<option value="${escapeHtml(t)}" ${state.typeFilter === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '集货记录',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总记录', value: `${seedLogs.length} 条` },
      { label: 'PDA拣货', value: `${seedLogs.filter(l => l.type === 'PDA拣货').length} 条` },
      { label: '二次分拨', value: `${seedLogs.filter(l => l.type === '二次分拨').length} 条` },
      { label: '交接集货区', value: `${seedLogs.filter(l => l.type === '交接集货区').length} 条` },
    ]),
    listTitle: '操作记录列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '集货记录列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderCollectionRecords(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleCollectionRecordsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'type') { state.typeFilter = (field as HTMLSelectElement).value; return true }
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
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const typeSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="type"]`)
    if (typeSelect) state.typeFilter = typeSelect.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.typeFilter = ''
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
