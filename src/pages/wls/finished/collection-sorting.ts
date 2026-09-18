// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type DistributionLine = { sku: string; name: string; handover: number; distributed: number; exception: number }
type DistributionAllocation = { sku: string; order: string; ship: string; box: string; qty: number; operator: string; time: string }
type DistributionTask = { id: string; wave: string; area: string; frame: string; status: 'WAIT_DISTRIBUTION' | 'DISTRIBUTING' | 'COMPLETED' | 'EXCEPTION'; operator: string; created: string; started: string; completed: string; lines: DistributionLine[]; allocations: DistributionAllocation[]; exceptionNote?: string }

const statusLabel: Record<string, string> = {
  WAIT_DISTRIBUTION: '待二次分拨', DISTRIBUTING: '分拨中', COMPLETED: '已完成', EXCEPTION: '异常'
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'EXCEPTION') return 'bg-red-50 text-red-700'
  if (s === 'DISTRIBUTING') return 'bg-blue-50 text-blue-700'
  return 'bg-amber-50 text-amber-700'
}

const seedTasks: DistributionTask[] = [
  { id: 'FB-20260829-001', wave: 'JH-WAVE-20260829-004', area: 'A区', frame: 'PF-001', status: 'WAIT_DISTRIBUTION', operator: '-', created: '2026-08-29 09:45', started: '-', completed: '-', lines: [{ sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', handover: 4, distributed: 0, exception: 0 }], allocations: [] },
  { id: 'FB-20260829-002', wave: 'JH-WAVE-20260829-006', area: 'B区', frame: 'PF-003', status: 'WAIT_DISTRIBUTION', operator: '-', created: '2026-08-29 10:05', started: '-', completed: '-', lines: [{ sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', handover: 3, distributed: 0, exception: 0 }], allocations: [] },
  { id: 'FB-20260829-003', wave: 'JH-WAVE-20260829-007', area: 'A区', frame: 'PF-002', status: 'DISTRIBUTING', operator: '张伟', created: '2026-08-29 10:20', started: '2026-08-29 10:28', completed: '-', lines: [
    { sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', handover: 6, distributed: 4, exception: 0 },
    { sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', handover: 2, distributed: 1, exception: 0 },
  ], allocations: [
    { sku: 'SKU-DRESS-BLK-M', order: 'JH-20260829-001', ship: 'SO-20260829-001', box: 'BOX-001', qty: 2, operator: '张伟', time: '10:31' },
    { sku: 'SKU-DRESS-BLK-M', order: 'JH-20260829-002', ship: 'SO-20260829-004', box: 'BOX-002', qty: 2, operator: '张伟', time: '10:33' },
    { sku: 'SKU-TEE-WHT-M', order: 'JH-20260829-001', ship: 'SO-20260829-001', box: 'BOX-001', qty: 1, operator: '张伟', time: '10:35' },
  ]},
  { id: 'FB-20260829-004', wave: 'JH-WAVE-20260829-008', area: 'C区', frame: 'PF-004', status: 'DISTRIBUTING', operator: '李娜', created: '2026-08-29 10:40', started: '2026-08-29 10:48', completed: '-', lines: [{ sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', handover: 5, distributed: 3, exception: 0 }], allocations: [
    { sku: 'SKU-JACKET-KHA-S', order: 'JH-20260829-003', ship: 'SO-20260829-005', box: 'BOX-006', qty: 3, operator: '李娜', time: '10:52' },
  ]},
  { id: 'FB-20260829-005', wave: 'JH-WAVE-20260828-021', area: 'A区', frame: 'PF-001', status: 'COMPLETED', operator: '张伟', created: '2026-08-28 16:10', started: '2026-08-28 16:18', completed: '2026-08-28 16:42', lines: [{ sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', handover: 5, distributed: 5, exception: 0 }], allocations: [
    { sku: 'SKU-HOOD-BLK-M', order: 'JH-20260828-021', ship: 'SO-20260828-021', box: 'BOX-008', qty: 3, operator: '张伟', time: '16:30' },
    { sku: 'SKU-HOOD-BLK-M', order: 'JH-20260828-022', ship: 'SO-20260828-022', box: 'BOX-009', qty: 2, operator: '张伟', time: '16:42' },
  ]},
  { id: 'FB-20260829-006', wave: 'JH-WAVE-20260828-024', area: 'B区', frame: 'PF-003', status: 'COMPLETED', operator: '王敏', created: '2026-08-28 17:00', started: '2026-08-28 17:06', completed: '2026-08-28 17:25', lines: [{ sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', handover: 4, distributed: 4, exception: 0 }], allocations: [
    { sku: 'SKU-JEAN-BLU-L', order: 'JH-20260828-024', ship: 'SO-20260828-024', box: 'BOX-010', qty: 4, operator: '王敏', time: '17:25' },
  ]},
  { id: 'FB-20260829-007', wave: 'JH-WAVE-20260829-009', area: 'C区', frame: 'PF-004', status: 'EXCEPTION', operator: '李娜', created: '2026-08-29 11:00', started: '2026-08-29 11:08', completed: '-', lines: [{ sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', handover: 3, distributed: 1, exception: 2 }], allocations: [
    { sku: 'SKU-VEST-BLK-M', order: 'JH-20260829-004', ship: 'SO-20260829-003', box: 'BOX-011', qty: 1, operator: '李娜', time: '11:12' },
  ], exceptionNote: '剩余 2 件暂无有效集货订单可匹配' },
]

const EVENT_PREFIX = 'wls-collection-sorting'
const PREFERENCE_KEY = '/wls/finished/collection-sorting:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<DistributionTask>[] = [
  { key: 'id', title: '二次分拨任务号', width: 190, required: true, freezeable: true, sortable: true, sortValue: r => r.id,
    render: r => `<span class="font-mono text-xs text-blue-600 font-medium">${escapeHtml(r.id)}</span>` },
  { key: 'wave', title: '关联拣货波次', width: 200, sortable: true, sortValue: r => r.wave,
    render: r => `<span class="text-slate-600">${escapeHtml(r.wave)}</span>` },
  { key: 'frame', title: '拣货框', width: 100, sortable: true, sortValue: r => r.frame,
    render: r => `<span class="font-medium text-blue-700">${escapeHtml(r.frame)}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 80, align: 'center', sortable: true, sortValue: r => r.lines.length,
    render: r => `<span class="text-slate-600">${r.lines.length}</span>` },
  { key: 'handover', title: '交接总数量', width: 100, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.handover, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.handover, 0)}</span>` },
  { key: 'distributed', title: '已分拨数量', width: 100, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.distributed, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.distributed, 0)}</span>` },
  { key: 'pending', title: '待分拨数量', width: 100, align: 'center', sortable: true, sortValue: r => { const h = r.lines.reduce((s, l) => s + l.handover, 0); const d = r.lines.reduce((s, l) => s + l.distributed, 0); const e = r.lines.reduce((s, l) => s + l.exception, 0); return Math.max(0, h - d - e) },
    render: r => { const h = r.lines.reduce((s, l) => s + l.handover, 0); const d = r.lines.reduce((s, l) => s + l.distributed, 0); const e = r.lines.reduce((s, l) => s + l.exception, 0); return `<span class="text-slate-600">${Math.max(0, h - d - e)}</span>` } },
  { key: 'exception', title: '异常数量', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.exception, 0),
    render: r => `<span class="${r.lines.reduce((s, l) => s + l.exception, 0) > 0 ? 'text-red-600 font-medium' : 'text-slate-600'}">${r.lines.reduce((s, l) => s + l.exception, 0)}</span>` },
  { key: 'orderCount', title: '涉及订单数', width: 100, align: 'center', sortable: true, sortValue: r => new Set(r.allocations.map(a => a.order)).size,
    render: r => `<span class="text-slate-600">${new Set(r.allocations.map(a => a.order)).size}</span>` },
  { key: 'boxCount', title: '涉及集货箱数', width: 110, align: 'center', sortable: true, sortValue: r => new Set(r.allocations.map(a => a.box)).size,
    render: r => `<span class="text-slate-600">${new Set(r.allocations.map(a => a.box)).size}</span>` },
  { key: 'status', title: '分拨状态', width: 120, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'operator', title: '操作人', width: 100, sortable: true, sortValue: r => r.operator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operator)}</span>` },
  { key: 'started', title: '开始时间', width: 150, sortable: true, sortValue: r => r.started,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.started)}</span>` },
  { key: 'completed', title: '完成时间', width: 150, sortable: true, sortValue: r => r.completed,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.completed)}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.created)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看详情</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['id'],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): DistributionTask[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedTasks.filter(t => {
    if (state.statusFilter && t.status !== state.statusFilter) return false
    if (!kw) return true
    return `${t.id} ${t.wave} ${t.operator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="分拨任务号 / 波次号 / 操作人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">分拨状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option>${Object.entries(statusLabel).map(([k, v]) => `<option value="${k}" ${state.statusFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '二次分拨列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待二次分拨', value: `${seedTasks.filter(t => t.status === 'WAIT_DISTRIBUTION').length} 个` },
      { label: '分拨中', value: `${seedTasks.filter(t => t.status === 'DISTRIBUTING').length} 个` },
      { label: '已完成', value: `${seedTasks.filter(t => t.status === 'COMPLETED').length} 个` },
      { label: '异常', value: `${seedTasks.filter(t => t.status === 'EXCEPTION').length} 个` },
    ]),
    listTitle: '分拨任务列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无分拨任务' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '分拨任务列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderCollectionSorting(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleCollectionSortingEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'status') { state.statusFilter = (field as HTMLSelectElement).value; return true }
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
    const statusSelect = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (statusSelect) state.statusFilter = statusSelect.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.statusFilter = ''
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
  if (action === 'export') { return true }
  return false
}
