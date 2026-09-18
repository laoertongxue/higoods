// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardRowEditDialog, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'

type SorterGate = { machineCode: string; gateCode: string; gateName: string; usage: string; matchValue: string; isException: boolean; status: '启用' | '停用' }

const seedGates: SorterGate[] = [
  { machineCode: 'SORTER-001', gateCode: 'GATE-01', gateName: '顺丰格口', usage: '快递公司匹配', matchValue: '顺丰速运', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-02', gateName: '中通格口', usage: '快递公司匹配', matchValue: '中通快递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-03', gateName: '圆通格口', usage: '快递公司匹配', matchValue: '圆通速递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-04', gateName: '韵达格口', usage: '快递公司匹配', matchValue: '韵达快递', isException: false, status: '启用' },
  { machineCode: 'SORTER-001', gateCode: 'GATE-EX-01', gateName: '异常口', usage: '异常兜底', matchValue: '-', isException: true, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-01', gateName: '可售退货', usage: '质检结果匹配', matchValue: '可售', isException: false, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-02', gateName: '瑕疵退货', usage: '质检结果匹配', matchValue: '瑕疵', isException: false, status: '启用' },
  { machineCode: 'SORTER-002', gateCode: 'GATE-EX-02', gateName: '异常口', usage: '异常兜底', matchValue: '-', isException: true, status: '启用' },
]

const MACHINE_OPTIONS = [
  { value: 'SORTER-001', label: 'SORTER-001 快递分拣机 01' },
  { value: 'SORTER-002', label: 'SORTER-002 拒收分拣机 01' },
  { value: 'SORTER-003', label: 'SORTER-003 快递分拣机 02' },
]

const EVENT_PREFIX = 'wls-sorter-gate-config'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/sorter-gate-config:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  editIdx: -1,
  showColumnSettings: false,
  keyword: '',
  machineFilter: 'SORTER-001' as string,
}

const columns: StandardListColumn<SorterGate>[] = [
  { key: 'gateCode', title: '格口编号', width: 130, required: true, freezeable: true, sortable: true, sortValue: r => r.gateCode,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.gateCode)}">${escapeHtml(r.gateCode)}</span>` },
  { key: 'gateName', title: '格口名称', width: 140, sortable: true, sortValue: r => r.gateName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.gateName)}</span>` },
  { key: 'usage', title: '格口用途', width: 140, sortable: true, sortValue: r => r.usage,
    render: r => `<span class="text-slate-600">${escapeHtml(r.usage)}</span>` },
  { key: 'matchValue', title: '匹配值', width: 140, sortable: true, sortValue: r => r.matchValue,
    render: r => `<span class="text-slate-600">${escapeHtml(r.matchValue)}</span>` },
  { key: 'isException', title: '是否异常口', width: 110, sortable: true, sortValue: r => r.isException ? 1 : 0,
    render: r => r.isException ? '<span class="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">是</span>' : '<span class="text-slate-400">否</span>' },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.status === '启用' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${escapeHtml(r.status)}</span>` },
  { key: 'actions', title: '操作', width: 140, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="edit" data-${EVENT_PREFIX}-idx="${ seedGates.indexOf(r) }">编辑</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs ${r.isException ? 'text-orange-600 hover:bg-orange-50' : 'text-red-500 hover:bg-red-50'}" data-${EVENT_PREFIX}-action="${r.isException ? 'disable' : 'delete'}">${r.isException ? '禁用' : '删除'}</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['gateCode'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): SorterGate[] {
  return seedGates.filter(g => g.machineCode === state.machineFilter)
}

function renderFilters(): string {
  const machineOptions = MACHINE_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}" ${state.machineFilter === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label><span class="mb-1 block text-xs text-muted-foreground">选择分拣机</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="machine">${machineOptions}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '格口配置',
    primaryActionsHtml: renderPrimaryButton('新增格口', { prefix: EVENT_PREFIX, action: 'add-gate' }),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '格口数', value: `${all.length} 个` },
      { label: '异常口', value: `${all.filter(g => g.isException).length} 个` },
    ]),
    listTitle: '格口列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无格口' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '格口列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.editIdx >= 0 && seedGates[state.editIdx] ? renderStandardRowEditDialog({
      title: `编辑格口 ${seedGates[state.editIdx].gateCode}`,
      description: '匹配值决定分拣到该格口的对象，保存后立即用于分拣判定。',
      fields: [
        { key: 'gateName', label: '格口名称', value: seedGates[state.editIdx].gateName },
        { key: 'matchValue', label: '匹配值', value: seedGates[state.editIdx].matchValue },
      ],
      eventPrefix: EVENT_PREFIX,
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

export function renderSorterGateConfig(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleSorterGateConfigEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'machine') { state.machineFilter = (field as HTMLSelectElement).value; return true }
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
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="machine"]`)
    if (select) state.machineFilter = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.machineFilter = 'SORTER-001'
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
  if (action === 'edit') {
    state.editIdx = Number(actionNode.dataset['wlsSorterGateConfigIdx'])
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-edit') {
    state.editIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'save-edit') {
    const row = seedGates[state.editIdx]
    const root = rootElement()
    if (row && root) {
      const nameInput = root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit="gateName"]`)
      const matchInput = root.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit="matchValue"]`)
      if (!nameInput?.value.trim() || !matchInput?.value.trim()) {
        showListFeedback('格口名称和匹配值不能为空，请填写后保存', 'warning')
        return true
      }
      row.gateName = nameInput.value.trim()
      row.matchValue = matchInput.value.trim()
      showListFeedback(`格口 ${row.gateCode} 已保存：${row.gateName} ← ${row.matchValue}`)
    }
    state.editIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '格口配置', columns, rows: filteredRows() }); return true }
  return false
}
