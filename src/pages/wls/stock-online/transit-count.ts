// @page-pattern: list
import { escapeHtml, localDateTimeText } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, renderStandardRowEditDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { transitCountSeed, TRANSIT_COUNT_STATUSES, TRANSIT_COUNT_TYPES, TRANSIT_WAREHOUSES, type TransitCountRow } from './seed.ts'

const statusClass: Record<string, string> = {
  待处理: 'bg-amber-50 text-amber-700',
  盘点中: 'bg-blue-50 text-blue-700',
  待审核: 'bg-indigo-50 text-indigo-700',
  盘点完成: 'bg-emerald-50 text-emerald-700',
  已取消: 'bg-slate-100 text-slate-500',
}

type TabKey = 'ALL' | (typeof TRANSIT_COUNT_STATUSES)[number]

const EVENT_PREFIX = 'wls-online-transit-count'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/transit-count:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  detailId: '',
  creating: false,
  tab: 'ALL' as TabKey,
  keyword: '',
  warehouseFilter: '' as string,
  typeFilter: '' as string,
}

const columns: StandardListColumn<TransitCountRow>[] = [
  { key: 'countNo', title: '单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.countNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.countNo)}</span>` },
  { key: 'warehouseName', title: '盘点仓库', width: 170, sortable: true, sortValue: r => r.warehouseName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouseName)}</span>` },
  { key: 'countType', title: '盘点类型', width: 100, sortable: true, sortValue: r => r.countType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.countType)}</span>` },
  { key: 'status', title: '盘点状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'creator', title: '创建人', width: 120, sortable: true, sortValue: r => r.creator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.creator)}</span>` },
  { key: 'createdAt', title: '时间', width: 160, sortable: true, sortValue: r => r.createdAt,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.createdAt)}</span>` },
  { key: 'actions', title: '操作', width: 90, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['countNo'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): TransitCountRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return transitCountSeed.filter(r => {
    if (state.tab !== 'ALL' && r.status !== state.tab) return false
    if (state.warehouseFilter && r.warehouseName !== state.warehouseFilter) return false
    if (state.typeFilter && r.countType !== state.typeFilter) return false
    if (!kw) return true
    return `${r.countNo} ${r.warehouseName} ${r.creator}`.toLowerCase().includes(kw)
  })
}

function renderTabsHtml(): string {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'ALL', label: '全部' },
    ...TRANSIT_COUNT_STATUSES.map(status => ({ key: status as TabKey, label: status })),
  ]
  return renderTabs({
    tabs: tabs.map(tab => ({
      key: tab.key,
      label: tab.label,
      count: tab.key === 'ALL' ? transitCountSeed.length : transitCountSeed.filter(r => r.status === tab.key).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="盘点单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库名称</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${TRANSIT_WAREHOUSES.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">盘点类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="type"><option value="">全部类型</option>${TRANSIT_COUNT_TYPES.map(t => `<option value="${escapeHtml(t)}" ${state.typeFilter === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderPrimaryButton('新建盘点单', { prefix: EVENT_PREFIX, action: 'create' }, 'plus')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? transitCountSeed.find(r => r.id === state.detailId) : undefined
  return renderStandardListPage({
    title: '中转仓盘点单',
    statusTabsHtml: renderTabsHtml(),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '盘点单数', value: `${transitCountSeed.length} 条` },
      { label: '待处理', value: `${transitCountSeed.filter(r => r.status === '待处理').length} 条` },
      { label: '盘点中', value: `${transitCountSeed.filter(r => r.status === '盘点中').length} 条` },
      { label: '待审核', value: `${transitCountSeed.filter(r => r.status === '待审核').length} 条` },
    ]),
    listTitle: '盘点单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的盘点单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: '中转仓盘点列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '盘点单明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
      state.creating ? renderStandardRowEditDialog({
        title: '新建盘点单',
        description: '选择盘点仓库与盘点类型后创建，生成后为待处理盘点单。',
        fields: [
          { key: 'warehouse', label: '盘点仓库', value: '' },
          { key: 'countType', label: '盘点类型 (全仓/库区/库位/SKU)', value: '' },
        ],
        eventPrefix: EVENT_PREFIX,
      }) : '',
    ].join(''),
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

export function renderTransitCount(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitCountEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
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
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change' && !['toggle-column-visibility', 'toggle-column-freeze'].includes(action)) return true
  if (action.startsWith('switch-tab:')) {
    state.tab = action.slice('switch-tab:'.length) as TabKey
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
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
    const root = rootElement()
    const read = (name: string) => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${name}"]`)?.value ?? ''
    state.keyword = read('keyword')
    state.warehouseFilter = read('warehouse')
    state.typeFilter = read('type')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.warehouseFilter = ''
    state.typeFilter = ''
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
  if (action === 'view-detail') { state.detailId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''; refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailId = ''; refreshWorkspace(); return true }
  if (action === 'create') { state.creating = true; refreshWorkspace(); return true }
  if (action === 'cancel-edit') { state.creating = false; refreshWorkspace(); return true }
  if (action === 'save-edit') {
    const root = rootElement()
    const pick = (key: string) => root?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit="${key}"]`)?.value.trim() || ''
    const warehouse = pick('warehouse')
    const countType = pick('countType') || '全仓'
    if (!warehouse) {
      showListFeedback('请填写盘点仓库', 'warning')
      return true
    }
    const seq = transitCountSeed.length + 1
    transitCountSeed.unshift({
      id: `TC-NEW-${seq}`,
      countNo: `PD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(seq).padStart(4, '0')}`,
      warehouseName: warehouse,
      countType,
      status: '待处理',
      creator: '当前用户',
      createdAt: localDateTimeText(),
    })
    state.creating = false
    state.tab = 'ALL'
    state.currentPage = 1
    showListFeedback(`已创建盘点单，仓库 ${warehouse}，状态待处理`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓盘点单', columns, rows: filteredRows() }); return true }
  return false
}
