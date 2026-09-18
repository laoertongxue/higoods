// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type WaveLine = { location: string; zone: string; sku: string; name: string; available: number; qty: number; picked: number; short: number; status: string }
type Wave = { id: string; zone: string; orderIds: string[]; status: string; operator?: string; receiveTime?: string; creator: string; created: string; frame?: string; lines: WaveLine[] }

const statusLabel: Record<string, string> = {
  WAIT_RECEIVE: '待领取', PICKING: '拣货中', WAIT_HANDOVER: '待交接', COMPLETED: '已完成', CANCELLED: '已作废'
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'PICKING') return 'bg-blue-50 text-blue-700'
  if (s === 'WAIT_HANDOVER') return 'bg-amber-50 text-amber-700'
  if (s === 'CANCELLED') return 'bg-gray-100 text-gray-500'
  return 'bg-blue-50 text-blue-700'
}

const seedWaves: Wave[] = [
  { id: 'JH-WAVE-20260829-001', zone: 'A区', orderIds: ['JH-20260829-001', 'JH-20260829-002'], status: 'WAIT_RECEIVE', creator: '仓库主管-王敏', created: '2026-08-29 10:20', lines: [
    { location: 'A01-01', zone: 'A区', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', available: 8, qty: 5, picked: 0, short: 0, status: '待拣' },
    { location: 'A02-03', zone: 'A区', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', available: 4, qty: 1, picked: 0, short: 0, status: '待拣' },
  ]},
  { id: 'JH-WAVE-20260829-002', zone: 'B区', orderIds: ['JH-20260829-002'], status: 'WAIT_RECEIVE', creator: '仓库主管-王敏', created: '2026-08-29 10:20', lines: [
    { location: 'B03-01', zone: 'B区', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', available: 5, qty: 2, picked: 0, short: 0, status: '待拣' },
  ]},
  { id: 'JH-WAVE-20260829-003', zone: 'C区', orderIds: ['JH-20260829-003'], status: 'PICKING', operator: 'PDA操作员-张伟', receiveTime: '2026-08-29 10:35', frame: 'PF-004', creator: '仓库主管-王敏', created: '2026-08-29 10:25', lines: [
    { location: 'C01-01', zone: 'C区', sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', available: 6, qty: 2, picked: 1, short: 0, status: '拣货中' },
  ]},
  { id: 'JH-WAVE-20260829-004', zone: 'A区', orderIds: ['JH-20260820-018'], status: 'WAIT_HANDOVER', operator: 'PDA操作员-张伟', receiveTime: '2026-08-29 09:10', frame: 'PF-001', creator: '仓库主管-王敏', created: '2026-08-29 09:00', lines: [
    { location: 'A03-08', zone: 'A区', sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', available: 5, qty: 1, picked: 1, short: 0, status: '已拣' },
  ]},
  { id: 'JH-WAVE-20260828-020', zone: 'A区', orderIds: ['JH-20260828-020'], status: 'COMPLETED', operator: 'PDA操作员-张伟', receiveTime: '2026-08-28 14:10', frame: 'PF-001', creator: '仓库主管-王敏', created: '2026-08-28 14:00', lines: [
    { location: 'A01-05', zone: 'A区', sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', available: 10, qty: 3, picked: 3, short: 0, status: '已拣' },
  ]},
]

const EVENT_PREFIX = 'wls-collection-picking'
const PREFERENCE_KEY = '/wls/finished/collection-picking:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<Wave>[] = [
  { key: 'id', title: '波次号', width: 200, required: true, freezeable: true, sortable: true, sortValue: r => r.id,
    render: r => `<span class="font-mono text-xs text-blue-600 font-medium">${escapeHtml(r.id)}</span>` },
  { key: 'zone', title: '库区', width: 80, sortable: true, sortValue: r => r.zone,
    render: r => `<span class="text-slate-600">${escapeHtml(r.zone)}</span>` },
  { key: 'frame', title: '拣货框', width: 100, sortable: true, sortValue: r => r.frame || '',
    render: r => `<span class="font-medium text-blue-700">${r.frame ? escapeHtml(r.frame) : '-'}</span>` },
  { key: 'orderCount', title: '关联订单数', width: 100, align: 'center', sortable: true, sortValue: r => r.orderIds.length,
    render: r => `<span class="text-slate-600">${r.orderIds.length}</span>` },
  { key: 'skuCount', title: 'SKU数', width: 80, align: 'center', sortable: true, sortValue: r => r.lines.length,
    render: r => `<span class="text-slate-600">${r.lines.length}</span>` },
  { key: 'totalQty', title: '应拣数量', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.qty, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.qty, 0)}</span>` },
  { key: 'totalPicked', title: '已拣数量', width: 90, align: 'center', sortable: true, sortValue: r => r.lines.reduce((s, l) => s + l.picked, 0),
    render: r => `<span class="text-slate-600">${r.lines.reduce((s, l) => s + l.picked, 0)}</span>` },
  { key: 'operator', title: '领取人', width: 140, sortable: true, sortValue: r => r.operator || '',
    render: r => `<span class="text-slate-600">${r.operator ? escapeHtml(r.operator) : '-'}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 140, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.creator)}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.created)}</span>` },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true,
    render: r => {
      const btns = [`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看详情</button>`]
      btns.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="print">打印</button>`)
      if (r.status === 'WAIT_RECEIVE') btns.push(`<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-400" data-${EVENT_PREFIX}-action="void">作废</button>`)
      if (r.status === 'WAIT_HANDOVER') btns.push(`<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="handover">确认交接</button>`)
      return `<div class="flex items-center gap-1">${btns.join('')}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['id'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): Wave[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedWaves.filter(w => {
    if (state.statusFilter && w.status !== state.statusFilter) return false
    if (!kw) return true
    return `${w.id} ${w.zone} ${w.creator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="波次号 / 库区 / 创建人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option>${Object.entries(statusLabel).map(([k, v]) => `<option value="${k}" ${state.statusFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '集货拣货波次',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总波次', value: `${seedWaves.length} 个` },
      { label: '待领取', value: `${seedWaves.filter(w => w.status === 'WAIT_RECEIVE').length} 个` },
      { label: '拣货中', value: `${seedWaves.filter(w => w.status === 'PICKING').length} 个` },
      { label: '已完成', value: `${seedWaves.filter(w => w.status === 'COMPLETED').length} 个` },
    ]),
    listTitle: '波次列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无波次' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '波次列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderCollectionPicking(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleCollectionPickingEvent(target: HTMLElement, event?: Event): boolean {
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
    const key = actionNode.dataset.columnKey || ''
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
  return false
}
