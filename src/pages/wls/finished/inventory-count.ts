// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type InventoryCountRow = {
  countNo: string; warehouseName: string; countType: string; scope: string
  detailCount: number; status: '待盘点' | '盘点中' | '待审核' | '已完成' | '已取消'
  creator: string; updatedAt: string
}

const statusClass: Record<string, string> = {
  '已完成': 'bg-emerald-50 text-emerald-700',
  '待审核': 'bg-blue-50 text-blue-700',
  '已取消': 'bg-slate-100 text-slate-600',
  '待盘点': 'bg-amber-50 text-amber-700',
  '盘点中': 'bg-amber-50 text-amber-700',
}

const INVENTORY_COUNT_SEED: InventoryCountRow[] = (() => {
  const statuses: Array<'待盘点' | '盘点中' | '待审核' | '已完成' | '已取消'> = ['待盘点', '盘点中', '待审核', '已完成', '已取消']
  const countTypes = ['全仓', '库区', '库位', 'SKU']
  const scopes = ['成衣仓全仓', 'A区', 'B区-货架区', 'SPU-GC-10001 ~ SPU-GC-10010']
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01']
  const creators = ['张仓管', '李主管', '王组长', '赵仓管']
  const rows: InventoryCountRow[] = []
  for (let i = 0; i < 20; i++) {
    const status = statuses[i % 5]
    const dayOffset = Math.floor(i / 5)
    const baseDate = new Date(2026, 8, 18 - dayOffset, 9 + (i % 8), (i * 13) % 60)
    rows.push({
      countNo: `PD-2026082${String(i + 1).padStart(2, '0')}`,
      warehouseName: warehouses[i % warehouses.length],
      countType: countTypes[i % countTypes.length],
      scope: scopes[i % scopes.length],
      detailCount: 5 + (i * 3) % 30,
      status,
      creator: creators[i % creators.length],
      updatedAt: baseDate.toISOString().slice(0, 16).replace('T', ' '),
    })
  }
  return rows
})()

const EVENT_PREFIX = 'wls-inventory-count'
const PREFERENCE_KEY = '/wls/finished/stock/inventory-count:list-columns'
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

const columns: StandardListColumn<InventoryCountRow>[] = [
  { key: 'countNo', title: '盘点单号', width: 150, required: true, freezeable: true, sortable: true, sortValue: r => r.countNo,
    render: r => `<span class="font-medium text-slate-700">${escapeHtml(r.countNo)}</span>` },
  { key: 'warehouseName', title: '盘点仓库', width: 180, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'countType', title: '盘点类型', width: 100, sortable: true, sortValue: r => r.countType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.countType)}</span>` },
  { key: 'scope', title: '盘点范围', width: 220, sortable: true, sortValue: r => r.scope,
    render: r => `<span class="text-slate-600">${escapeHtml(r.scope)}</span>` },
  { key: 'detailCount', title: '明细行数', width: 90, align: 'center', sortable: true, sortValue: r => r.detailCount,
    render: r => `<span class="text-slate-600">${r.detailCount}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 120, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.creator)}</span>` },
  { key: 'updatedAt', title: '更新时间', width: 160, sortable: true, sortValue: r => r.updatedAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.updatedAt)}</span>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.countNo)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['countNo'] as string[],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): InventoryCountRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return INVENTORY_COUNT_SEED.filter(r => {
    if (state.statusFilter && r.status !== state.statusFilter) return false
    if (!kw) return true
    return `${r.countNo} ${r.warehouseName} ${r.countType} ${r.scope} ${r.creator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="盘点单号 / 仓库 / 创建人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待盘点" ${state.statusFilter === '待盘点' ? 'selected' : ''}>待盘点</option><option value="盘点中" ${state.statusFilter === '盘点中' ? 'selected' : ''}>盘点中</option><option value="待审核" ${state.statusFilter === '待审核' ? 'selected' : ''}>待审核</option><option value="已完成" ${state.statusFilter === '已完成' ? 'selected' : ''}>已完成</option><option value="已取消" ${state.statusFilter === '已取消' ? 'selected' : ''}>已取消</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('新建盘点单', { prefix: EVENT_PREFIX, action: 'create' }, 'plus')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '库存盘点',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总盘点单', value: `${INVENTORY_COUNT_SEED.length} 条` },
      { label: '待盘点', value: `${INVENTORY_COUNT_SEED.filter(o => o.status === '待盘点').length} 条` },
      { label: '盘点中', value: `${INVENTORY_COUNT_SEED.filter(o => o.status === '盘点中').length} 条` },
      { label: '已完成', value: `${INVENTORY_COUNT_SEED.filter(o => o.status === '已完成').length} 条` },
    ]),
    listTitle: '盘点单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无盘点记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '库存盘点列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderFinishedInventoryCount(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedInventoryCountEvent(target: HTMLElement, event?: Event): boolean {
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
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (select) state.statusFilter = select.value
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
  if (action === 'view-detail') {
    const id = actionNode.dataset[`${EVENT_PREFIX.replace(/-/g, '')}Id`] || ''
    console.log('Open inventory count detail:', id)
    return true
  }
  if (action === 'create') { console.log('Open create inventory count'); return true }
  return false
}
