// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type ScoreReason = { reason: string; deduction: number }
type ScoreDetail = { item: string; score: number; maxScore: number; reasons: ScoreReason[] }
type ScoreItem = {
  fabricNo: string; fabricName: string; supplier: string; batchNo: string
  totalScore: number; scoreLevel: 'A' | 'B' | 'C' | 'D'
  details: ScoreDetail[]
}

const seedItems: ScoreItem[] = [
  { fabricNo: 'FAB-20260716-001', fabricName: '主身面料-白色', supplier: '东莞纺织供应链', batchNo: 'B-20260710-01', totalScore: 95, scoreLevel: 'A', details: [{ item: '色差', score: 28, maxScore: 30, reasons: [{ reason: '轻微色差(L*偏差0.5)', deduction: 2 }] }, { item: '克重', score: 20, maxScore: 20, reasons: [] }, { item: '幅宽', score: 18, maxScore: 20, reasons: [{ reason: '幅宽偏窄0.5cm', deduction: 2 }] }, { item: '外观', score: 29, maxScore: 30, reasons: [{ reason: '1处轻微织疵', deduction: 1 }] }] },
  { fabricNo: 'FAB-20260716-002', fabricName: '里料-黑色', supplier: '广州面料厂', batchNo: 'B-20260710-02', totalScore: 82, scoreLevel: 'B', details: [{ item: '色差', score: 25, maxScore: 30, reasons: [{ reason: '色差明显(L*偏差1.2)', deduction: 5 }] }, { item: '克重', score: 18, maxScore: 20, reasons: [{ reason: '克重偏低3%', deduction: 2 }] }, { item: '幅宽', score: 20, maxScore: 20, reasons: [] }, { item: '外观', score: 19, maxScore: 30, reasons: [{ reason: '3处织疵', deduction: 6 }, { reason: '1处油污', deduction: 5 }] }] },
  { fabricNo: 'FAB-20260716-003', fabricName: '口袋布-灰色', supplier: '深圳纺织有限公司', batchNo: 'B-20260710-03', totalScore: 68, scoreLevel: 'C', details: [{ item: '色差', score: 20, maxScore: 30, reasons: [{ reason: '色差严重(L*偏差2.0)', deduction: 10 }] }, { item: '克重', score: 15, maxScore: 20, reasons: [{ reason: '克重偏低8%', deduction: 5 }] }, { item: '幅宽', score: 18, maxScore: 20, reasons: [{ reason: '幅宽偏窄1cm', deduction: 2 }] }, { item: '外观', score: 15, maxScore: 30, reasons: [{ reason: '5处织疵', deduction: 10 }, { reason: '2处破洞', deduction: 5 }] }] },
  { fabricNo: 'FAB-20260716-004', fabricName: '袖里面料-蓝色', supplier: '东莞纺织供应链', batchNo: 'B-20260710-04', totalScore: 91, scoreLevel: 'A', details: [{ item: '色差', score: 27, maxScore: 30, reasons: [{ reason: '轻微色差', deduction: 3 }] }, { item: '克重', score: 20, maxScore: 20, reasons: [] }, { item: '幅宽', score: 20, maxScore: 20, reasons: [] }, { item: '外观', score: 24, maxScore: 30, reasons: [{ reason: '2处轻微织疵', deduction: 6 }] }] },
  { fabricNo: 'FAB-20260716-005', fabricName: '领衬面料', supplier: '佛山辅料厂', batchNo: 'B-20260710-05', totalScore: 55, scoreLevel: 'D', details: [{ item: '色差', score: 15, maxScore: 30, reasons: [{ reason: '色差严重', deduction: 15 }] }, { item: '克重', score: 12, maxScore: 20, reasons: [{ reason: '克重偏低15%', deduction: 8 }] }, { item: '幅宽', score: 15, maxScore: 20, reasons: [{ reason: '幅宽偏窄2cm', deduction: 5 }] }, { item: '外观', score: 13, maxScore: 30, reasons: [{ reason: '多处破洞', deduction: 17 }] }] },
  { fabricNo: 'FAB-20260716-006', fabricName: '面料-条纹', supplier: '广州面料厂', batchNo: 'B-20260710-06', totalScore: 88, scoreLevel: 'B', details: [{ item: '色差', score: 26, maxScore: 30, reasons: [{ reason: '轻微色差', deduction: 4 }] }, { item: '克重', score: 20, maxScore: 20, reasons: [] }, { item: '幅宽', score: 19, maxScore: 20, reasons: [{ reason: '偏窄0.3cm', deduction: 1 }] }, { item: '外观', score: 23, maxScore: 30, reasons: [{ reason: '2处织疵', deduction: 7 }] }] },
  { fabricNo: 'FAB-20260716-007', fabricName: '面料-格子', supplier: '深圳纺织有限公司', batchNo: 'B-20260710-07', totalScore: 76, scoreLevel: 'B', details: [{ item: '色差', score: 22, maxScore: 30, reasons: [{ reason: '色差偏大', deduction: 8 }] }, { item: '克重', score: 19, maxScore: 20, reasons: [{ reason: '克重偏低1%', deduction: 1 }] }, { item: '幅宽', score: 20, maxScore: 20, reasons: [] }, { item: '外观', score: 15, maxScore: 30, reasons: [{ reason: '4处织疵', deduction: 8 }, { reason: '1处污渍', deduction: 7 }] }] },
  { fabricNo: 'FAB-20260716-008', fabricName: '面料-纯色蓝', supplier: '东莞纺织供应链', batchNo: 'B-20260710-08', totalScore: 93, scoreLevel: 'A', details: [{ item: '色差', score: 28, maxScore: 30, reasons: [{ reason: '轻微色差', deduction: 2 }] }, { item: '克重', score: 20, maxScore: 20, reasons: [] }, { item: '幅宽', score: 20, maxScore: 20, reasons: [] }, { item: '外观', score: 25, maxScore: 30, reasons: [{ reason: '1处轻微织疵', deduction: 5 }] }] },
]

const scoreLevelClass: Record<string, string> = {
  'A': 'bg-emerald-50 text-emerald-700', 'B': 'bg-blue-50 text-blue-700',
  'C': 'bg-orange-50 text-orange-700', 'D': 'bg-red-50 text-red-700',
}

const EVENT_PREFIX = 'wls-raw-fabric-score'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/fabric-score:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  detailIdx: -1,
  showColumnSettings: false,
  keyword: '',
  levelFilter: '' as string,
  expandedKeys: new Set<string>(),
}

const columns: StandardListColumn<ScoreItem>[] = [
  { key: 'fabricNo', title: '面料编号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.fabricNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.fabricNo)}">${escapeHtml(r.fabricNo)}</span>` },
  { key: 'fabricName', title: '面料名称', width: 150, sortable: true, sortValue: r => r.fabricName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.fabricName)}</span>` },
  { key: 'supplier', title: '供应商', width: 150, sortable: true, sortValue: r => r.supplier,
    render: r => `<span class="text-slate-600">${escapeHtml(r.supplier)}</span>` },
  { key: 'batchNo', title: '批次号', width: 150, sortable: true, sortValue: r => r.batchNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.batchNo)}</span>` },
  { key: 'totalScore', title: '综合评分', width: 100, align: 'right', sortable: true, sortValue: r => r.totalScore,
    render: r => `<span class="text-slate-700 font-semibold">${r.totalScore}</span>` },
  { key: 'scoreLevel', title: '等级', width: 80, sortable: true, sortValue: r => r.scoreLevel,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${scoreLevelClass[r.scoreLevel]}">${r.scoreLevel}</span>` },
  { key: 'details', title: '评分明细', width: 300,
    render: r => `<div class="flex flex-wrap gap-1">${r.details.map(d => `<span class="rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">${escapeHtml(d.item)}: ${d.score}/${d.maxScore}</span>`).join('')}</div>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => {
      const expanded = state.expandedKeys.has(r.fabricNo)
      return `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="toggle-detail" data-row-key="${escapeHtml(r.fabricNo)}">${expanded ? '收起' : '展开'}</button><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view" data-${EVENT_PREFIX}-idx="${ seedItems.indexOf(r) }">查看</button></div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['fabricNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): ScoreItem[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedItems.filter(o => {
    if (state.levelFilter && o.scoreLevel !== state.levelFilter) return false
    if (!kw) return true
    return `${o.fabricNo} ${o.fabricName} ${o.supplier} ${o.batchNo}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="面料编号 / 名称 / 供应商 / 批次号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">等级</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="level"><option value="">全部</option><option value="A" ${state.levelFilter === 'A' ? 'selected' : ''}>A</option><option value="B" ${state.levelFilter === 'B' ? 'selected' : ''}>B</option><option value="C" ${state.levelFilter === 'C' ? 'selected' : ''}>C</option><option value="D" ${state.levelFilter === 'D' ? 'selected' : ''}>D</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderDetailSubRow(item: ScoreItem): string {
  return `<tr class="border-b bg-slate-50/50"><td colspan="${columns.length}" class="px-6 py-3"><div class="space-y-2 text-xs"><div class="font-medium text-slate-700">${escapeHtml(item.fabricName)} 评分明细</div><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">${item.details.map(d => `<div class="rounded border bg-white p-2"><div class="flex items-center justify-between"><span class="font-medium text-slate-700">${escapeHtml(d.item)}</span><span class="text-slate-500">${d.score}/${d.maxScore}</span></div>${d.reasons.length > 0 ? `<div class="mt-1 space-y-0.5 text-slate-500">${d.reasons.map(r => `<div>- ${escapeHtml(r.reason)} (-${r.deduction})</div>`).join('')}</div>` : '<div class="mt-1 text-emerald-600">无扣分</div>'}</div>`).join('')}</div></div></td></tr>`
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const tableHtml = renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无评分记录' })

  let expandedHtml = ''
  if (state.expandedKeys.size > 0) {
    const rowsWithDetails = paging.rows.filter(r => state.expandedKeys.has(r.fabricNo))
    expandedHtml = rowsWithDetails.map(r => renderDetailSubRow(r)).join('')
  }

  return renderStandardListPage({
    title: '原料仓面料评分',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: 'A级', value: `${seedItems.filter(o => o.scoreLevel === 'A').length} 条` },
      { label: 'B级', value: `${seedItems.filter(o => o.scoreLevel === 'B').length} 条` },
      { label: 'C/D级', value: `${seedItems.filter(o => o.scoreLevel === 'C' || o.scoreLevel === 'D').length} 条` },
    ]),
    listTitle: '面料评分列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: tableHtml + (expandedHtml ? `<div class="border-t border-slate-100"><table class="w-full table-fixed border-collapse" style="min-width:0"><tbody>${expandedHtml}</tbody></table></div>` : ''),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '面料评分列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedItems[state.detailIdx] ? renderStandardRowDetailDialog({ title: '原料仓面料评分详情', columns, row: seedItems[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderRawFabricScore(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawFabricScoreEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'level') { state.levelFilter = (field as HTMLSelectElement).value; return true }
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
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="level"]`)
    if (select) state.levelFilter = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.levelFilter = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'toggle-detail') {
    const key = actionNode.dataset.rowKey || ''
    if (state.expandedKeys.has(key)) state.expandedKeys.delete(key)
    else state.expandedKeys.add(key)
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
  if (action === 'view') { state.detailIdx = Number(actionNode.dataset[`${DATASET_PREFIX}Idx`]); refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailIdx = -1; refreshWorkspace(); return true }
  if (action === 'export') { exportStandardListRows({ fileName: '原料仓面料评分', columns, rows: filteredRows() }); return true }
  return false
}
