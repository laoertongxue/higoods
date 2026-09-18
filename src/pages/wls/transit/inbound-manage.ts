// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'

type InboundRow = {
  receiveNo: string; inboundNo: string; productionNo: string
  processorType: string; processorName: string
  skuCount: number; expectedQty: number; receivedQty: number
  receiveStatus: string; kitType: string; taskStatus: string; workAreaQty: number
}

const receiveStatusClass: Record<string, string> = {
  '待收货': 'bg-orange-50 text-orange-700', '收货中': 'bg-blue-50 text-blue-700', '已收货': 'bg-emerald-50 text-emerald-700',
}

const seedRows: InboundRow[] = [
  { receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-001', productionNo: 'PO14954', processorType: '自有工厂', processorName: '自有工厂A组', skuCount: 2, expectedQty: 8, receivedQty: 8, receiveStatus: '已收货', kitType: '已配齐', taskStatus: '待配齐', workAreaQty: 8 },
  { receiveNo: 'TR-RC-20260716-001', inboundNo: 'TR-IN-20260716-004', productionNo: 'PO14957', processorType: '自有工厂', processorName: '自有工厂A组', skuCount: 2, expectedQty: 7, receivedQty: 7, receiveStatus: '已收货', kitType: '已配齐', taskStatus: '已配齐', workAreaQty: 0 },
  { receiveNo: 'TR-RC-20260716-002', inboundNo: 'TR-IN-20260716-002', productionNo: 'PO14955', processorType: '第三方工厂', processorName: '第三方工厂-恒盛', skuCount: 2, expectedQty: 11, receivedQty: 8, receiveStatus: '已收货', kitType: '未配齐', taskStatus: '待上架', workAreaQty: 8 },
  { receiveNo: 'TR-RC-20260716-003', inboundNo: 'TR-IN-20260716-003', productionNo: 'PO14956', processorType: '自有工厂', processorName: '自有工厂B组', skuCount: 3, expectedQty: 13, receivedQty: 5, receiveStatus: '收货中', kitType: '未配齐', taskStatus: '待上架', workAreaQty: 5 },
  { receiveNo: 'TR-RC-20260716-004', inboundNo: 'TR-IN-20260716-006', productionNo: 'PO14959', processorType: '自有工厂', processorName: '自有工厂C组', skuCount: 2, expectedQty: 8, receivedQty: 0, receiveStatus: '待收货', kitType: '—', taskStatus: '—', workAreaQty: 0 },
  { receiveNo: 'TR-RC-20260716-004', inboundNo: 'TR-IN-20260716-007', productionNo: 'PO14960', processorType: '自有工厂', processorName: '自有工厂C组', skuCount: 2, expectedQty: 10, receivedQty: 0, receiveStatus: '待收货', kitType: '—', taskStatus: '—', workAreaQty: 0 },
  { receiveNo: 'TR-RC-20260716-004', inboundNo: 'TR-IN-20260716-008', productionNo: 'PO14961', processorType: '自有工厂', processorName: '自有工厂C组', skuCount: 2, expectedQty: 6, receivedQty: 0, receiveStatus: '待收货', kitType: '—', taskStatus: '—', workAreaQty: 0 },
  { receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-009', productionNo: 'PO14962', processorType: '自有工厂', processorName: '自有工厂D组', skuCount: 2, expectedQty: 8, receivedQty: 8, receiveStatus: '已收货', kitType: '已配齐', taskStatus: '已配齐', workAreaQty: 0 },
  { receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-010', productionNo: 'PO14963', processorType: '自有工厂', processorName: '自有工厂D组', skuCount: 2, expectedQty: 9, receivedQty: 8, receiveStatus: '已收货', kitType: '已配齐（需配货）', taskStatus: '待配齐', workAreaQty: 6 },
  { receiveNo: 'TR-RC-20260716-005', inboundNo: 'TR-IN-20260716-011', productionNo: 'PO14964', processorType: '自有工厂', processorName: '自有工厂D组', skuCount: 2, expectedQty: 13, receivedQty: 5, receiveStatus: '已收货', kitType: '未配齐', taskStatus: '待上架', workAreaQty: 5 },
]

const EVENT_PREFIX = 'wls-transit-inbound'
const PREFERENCE_KEY = '/wls/transit/inbound-manage:list-columns'
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

const columns: StandardListColumn<InboundRow>[] = [
  { key: 'receiveNo', title: '收货单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.receiveNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.receiveNo)}">${escapeHtml(r.receiveNo)}</span>` },
  { key: 'inboundNo', title: '预入库单号', width: 180, sortable: true, sortValue: r => r.inboundNo,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.inboundNo)}</span>` },
  { key: 'productionNo', title: '生产单号', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'processorType', title: '加工方类型', width: 100, sortable: true, sortValue: r => r.processorType,
    render: r => `<span class="text-slate-500">${escapeHtml(r.processorType)}</span>` },
  { key: 'processorName', title: '加工方名称', width: 150, sortable: true, sortValue: r => r.processorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.processorName)}</span>` },
  { key: 'skuCount', title: '应收SKU数', width: 100, align: 'right', sortable: true, sortValue: r => r.skuCount,
    render: r => `<span class="text-slate-600">${r.skuCount}</span>` },
  { key: 'expectedQty', title: '应收数量', width: 90, align: 'right', sortable: true, sortValue: r => r.expectedQty,
    render: r => `<span class="text-slate-600">${r.expectedQty}</span>` },
  { key: 'receivedQty', title: '累计实收', width: 90, align: 'right', sortable: true, sortValue: r => r.receivedQty,
    render: r => `<span class="text-slate-700 font-medium">${r.receivedQty}</span>` },
  { key: 'receiveStatus', title: '收货状态', width: 100, sortable: true, sortValue: r => r.receiveStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${receiveStatusClass[r.receiveStatus] || ''}">${escapeHtml(r.receiveStatus)}</span>` },
  { key: 'kitType', title: '齐套类型', width: 120, sortable: true, sortValue: r => r.kitType,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.kitType)}</span>` },
  { key: 'taskStatus', title: '任务状态', width: 100, sortable: true, sortValue: r => r.taskStatus,
    render: r => `<span class="text-xs text-slate-600">${escapeHtml(r.taskStatus)}</span>` },
  { key: 'workAreaQty', title: '作业区剩余', width: 100, align: 'right', sortable: true, sortValue: r => r.workAreaQty,
    render: r => `<span class="text-slate-600">${r.workAreaQty}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view">查看明细</button>${r.receiveStatus !== '已收货' ? `<button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="receive">收货</button>` : ''}</div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.filter(c => c.required || c.actionColumn).map(c => c.key),
  frozenKeys: ['receiveNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): InboundRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (state.statusFilter && r.receiveStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${r.receiveNo} ${r.inboundNo} ${r.productionNo} ${r.processorName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="收货单号 / 预入库单号 / 生产单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">收货状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="待收货" ${state.statusFilter === '待收货' ? 'selected' : ''}>待收货</option><option value="收货中" ${state.statusFilter === '收货中' ? 'selected' : ''}>收货中</option><option value="已收货" ${state.statusFilter === '已收货' ? 'selected' : ''}>已收货</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓收货单管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '待收货', value: `${seedRows.filter(r => r.receiveStatus === '待收货').length} 条` },
      { label: '收货中', value: `${seedRows.filter(r => r.receiveStatus === '收货中').length} 条` },
      { label: '已收货', value: `${seedRows.filter(r => r.receiveStatus === '已收货').length} 条` },
    ]),
    listTitle: '收货单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无收货记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '收货单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderTransitInboundManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitInboundManageEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'export') { return true }
  return false
}
