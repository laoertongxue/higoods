// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type ExceptionRecord = {
  id: string; time: string; machineCode: string; machineName: string; machineType: string
  scanCode: string; identifyType: string; matchValue: string; targetGate: string
  exceptionType: string; reason: string; weight: string; handled: boolean; handler?: string; handleTime?: string
}

const exceptionTypeLabel: Record<string, string> = {
  NO_MATCH: '无匹配格口', CODE_INVALID: '编码格式无效', DUPLICATE: '重复扫描',
  WEIGHT_OVER: '超重', MULTI_MATCH: '多格口匹配', GATE_FULL: '格口已满',
  NETWORK_ERROR: '网络异常', OTHER: '其他',
}

const seedRecords: ExceptionRecord[] = [
  { id: 'EX-001', time: '2026-08-29 09:15:30', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'SF2026082900001', identifyType: '运单号', matchValue: '-', targetGate: 'GATE-EX-01', exceptionType: 'NO_MATCH', reason: '快递公司不在格口配置中', weight: '1.2kg', handled: true, handler: '张伟', handleTime: '2026-08-29 09:20:00' },
  { id: 'EX-002', time: '2026-08-29 10:02:15', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'INVALID-CODE', identifyType: '运单号', matchValue: '-', targetGate: 'GATE-EX-01', exceptionType: 'CODE_INVALID', reason: '条码无法识别', weight: '0.8kg', handled: false },
  { id: 'EX-003', time: '2026-08-29 10:30:00', machineCode: 'SORTER-002', machineName: '拒收分拣机 01', machineType: '退货拒收分拣', scanCode: 'RET-20260829-005', identifyType: '退货单号', matchValue: '-', targetGate: 'GATE-EX-02', exceptionType: 'WEIGHT_OVER', reason: '包裹重量超出格口承载', weight: '12.5kg', handled: false },
  { id: 'EX-004', time: '2026-08-28 16:45:00', machineCode: 'SORTER-001', machineName: '快递分拣机 01', machineType: '快递分拣', scanCode: 'ZT2026082800055', identifyType: '运单号', matchValue: '中通快递', targetGate: 'GATE-02', exceptionType: 'GATE_FULL', reason: '中通格口已满，需人工清口', weight: '0.5kg', handled: true, handler: '李娜', handleTime: '2026-08-28 16:50:00' },
]

const EVENT_PREFIX = 'wls-sorter-records'
const PREFERENCE_KEY = '/wls/finished/sorter-records:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  machineTypeFilter: '' as string,
  exceptionTypeFilter: '' as string,
  handledFilter: '' as string,
}

const columns: StandardListColumn<ExceptionRecord>[] = [
  { key: 'time', title: '异常时间', width: 160, sortable: true, sortValue: r => r.time,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.time)}</span>` },
  { key: 'machineCode', title: '机器编号', width: 130, required: true, freezeable: true, sortable: true, sortValue: r => r.machineCode,
    render: r => `<span class="font-mono text-xs font-medium text-slate-700">${escapeHtml(r.machineCode)}</span>` },
  { key: 'machineName', title: '机器名称', width: 150, sortable: true, sortValue: r => r.machineName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.machineName)}</span>` },
  { key: 'machineType', title: '机器类型', width: 130, sortable: true, sortValue: r => r.machineType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.machineType)}</span>` },
  { key: 'scanCode', title: '扫描号码', width: 170, sortable: true, sortValue: r => r.scanCode,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.scanCode)}</span>` },
  { key: 'identifyType', title: '识别类型', width: 110, sortable: true, sortValue: r => r.identifyType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.identifyType)}</span>` },
  { key: 'targetGate', title: '目标异常口', width: 130, sortable: true, sortValue: r => r.targetGate,
    render: r => `<span class="text-slate-600">${escapeHtml(r.targetGate)}</span>` },
  { key: 'exceptionType', title: '异常类型', width: 130, sortable: true, sortValue: r => r.exceptionType,
    render: r => `<span class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">${escapeHtml(exceptionTypeLabel[r.exceptionType] || r.exceptionType)}</span>` },
  { key: 'reason', title: '异常原因', width: 200, sortable: true, sortValue: r => r.reason,
    render: r => `<span class="text-slate-600">${escapeHtml(r.reason)}</span>` },
  { key: 'weight', title: '重量', width: 80, sortable: true, sortValue: r => r.weight,
    render: r => `<span class="text-slate-600">${escapeHtml(r.weight)}</span>` },
  { key: 'handled', title: '处理状态', width: 100, sortable: true, sortValue: r => r.handled ? 1 : 0,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.handled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${r.handled ? '已处理' : '未处理'}</span>` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="view">查看详情</button>${!r.handled ? `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="mark-handled">标记已处理</button>` : ''}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['machineCode'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): ExceptionRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRecords.filter(r => {
    if (state.machineTypeFilter && r.machineType !== state.machineTypeFilter) return false
    if (state.exceptionTypeFilter && r.exceptionType !== state.exceptionTypeFilter) return false
    if (state.handledFilter === 'handled' && !r.handled) return false
    if (state.handledFilter === 'unhandled' && r.handled) return false
    if (!kw) return true
    return `${r.scanCode} ${r.machineCode} ${r.machineName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const machineTypes = [...new Set(seedRecords.map(r => r.machineType))]
  const exceptionTypes = Object.values(exceptionTypeLabel)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="扫描号码 / 机器编号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">机器类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="machineType"><option value="">全部机器类型</option>${machineTypes.map(t => `<option value="${escapeHtml(t)}" ${state.machineTypeFilter === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">异常类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="exceptionType"><option value="">全部异常类型</option>${exceptionTypes.map(v => `<option value="${escapeHtml(v)}" ${state.exceptionTypeFilter === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">处理状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="handled"><option value="">全部处理状态</option><option value="handled" ${state.handledFilter === 'handled' ? 'selected' : ''}>已处理</option><option value="unhandled" ${state.handledFilter === 'unhandled' ? 'selected' : ''}>未处理</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '分拣异常记录',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总异常数', value: `${seedRecords.length} 条` },
      { label: '未处理', value: `${seedRecords.filter(r => !r.handled).length} 条` },
      { label: '已处理', value: `${seedRecords.filter(r => r.handled).length} 条` },
    ]),
    listTitle: '异常记录列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无异常记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '异常记录列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderSorterRecords(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleSorterRecordsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'machineType') { state.machineTypeFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'exceptionType') { state.exceptionTypeFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'handled') { state.handledFilter = (field as HTMLSelectElement).value; return true }
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
    const machineType = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="machineType"]`)
    if (machineType) state.machineTypeFilter = machineType.value
    const exceptionType = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="exceptionType"]`)
    if (exceptionType) state.exceptionTypeFilter = exceptionType.value
    const handled = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="handled"]`)
    if (handled) state.handledFilter = handled.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.machineTypeFilter = ''
    state.exceptionTypeFilter = ''
    state.handledFilter = ''
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
