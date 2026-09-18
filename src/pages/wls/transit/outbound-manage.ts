// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'

type OutboundRow = {
  outboundNo: string; taskNo: string; productionNo: string; sku: string; name: string
  processorName: string; outboundType: string; cutterReceived: boolean; allocationDone: boolean
  plannedQty: number; allocatedQty: number; actualOutboundQty: number
  sourceArea: string; outboundStatus: '已完成' | '待出库'
}

const seedRows: OutboundRow[] = [
  { outboundNo: 'TR-OUT-20260716-001', taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', sku: 'FAB-PO14957-A', name: '主身面料', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 5, allocatedQty: 5, actualOutboundQty: 5, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-001', taskNo: 'TR-AL-20260716-004', productionNo: 'PO14957', sku: 'ACC-PO14957-B', name: '辅料包', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 2, allocatedQty: 2, actualOutboundQty: 2, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-002', taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', sku: 'FAB-PO14962-A', name: '主身面料', processorName: '自有工厂D组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 6, allocatedQty: 6, actualOutboundQty: 6, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: 'TR-OUT-20260716-002', taskNo: 'TR-AL-20260716-009', productionNo: 'PO14962', sku: 'ACC-PO14962-B', name: '辅料包', processorName: '自有工厂D组', outboundType: '齐套出库', cutterReceived: true, allocationDone: true, plannedQty: 2, allocatedQty: 2, actualOutboundQty: 2, sourceArea: '货架库位', outboundStatus: '已完成' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', sku: 'FAB-PO14954-A', name: '主身面料', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: false, allocationDone: false, plannedQty: 6, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-001', productionNo: 'PO14954', sku: 'ACC-PO14954-B', name: '辅料包', processorName: '自有工厂A组', outboundType: '齐套出库', cutterReceived: false, allocationDone: false, plannedQty: 2, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-005', productionNo: 'PO14958', sku: 'FAB-PO14958-A', name: '主身面料', processorName: '第三方工厂-恒盛', outboundType: '自有工厂部分出库', cutterReceived: false, allocationDone: false, plannedQty: 7, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
  { outboundNo: '—', taskNo: 'TR-AL-20260716-010', productionNo: 'PO14963', sku: 'FAB-PO14963-A', name: '主身面料', processorName: '自有工厂D组', outboundType: '自有工厂部分出库', cutterReceived: false, allocationDone: false, plannedQty: 7, allocatedQty: 0, actualOutboundQty: 0, sourceArea: '待领料区/隔离区', outboundStatus: '待出库' },
]

const EVENT_PREFIX = 'wls-transit-outbound'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/transit/outbound-manage:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  confirmIdx: -1,
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<OutboundRow>[] = [
  { key: 'outboundNo', title: '出库单号', width: 200, required: true, freezeable: true, sortable: true, sortValue: r => r.outboundNo,
    render: r => `<span class="font-mono text-xs ${r.outboundNo !== '—' ? 'text-blue-600' : 'text-slate-400'}">${escapeHtml(r.outboundNo)}</span>` },
  { key: 'taskNo', title: '配料单', width: 180, sortable: true, sortValue: r => r.taskNo,
    render: r => `<span class="font-mono text-xs text-slate-500">${escapeHtml(r.taskNo)}</span>` },
  { key: 'productionNo', title: '生产单号', width: 120, sortable: true, sortValue: r => r.productionNo,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productionNo)}</span>` },
  { key: 'sku', title: 'SKU', width: 160, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'name', title: '物料名称', width: 120, sortable: true, sortValue: r => r.name,
    render: r => `<span class="text-slate-600">${escapeHtml(r.name)}</span>` },
  { key: 'processorName', title: '加工方', width: 150, sortable: true, sortValue: r => r.processorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.processorName)}</span>` },
  { key: 'outboundType', title: '出库类型', width: 140, sortable: true, sortValue: r => r.outboundType,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.outboundType)}</span>` },
  { key: 'cutterReceived', title: '裁厂接收', width: 100, sortable: true, sortValue: r => r.cutterReceived ? '已接收' : '未接收',
    render: r => `<span class="text-xs ${r.cutterReceived ? 'text-emerald-600' : 'text-slate-400'}">${r.cutterReceived ? '已接收' : '未接收'}</span>` },
  { key: 'allocationDone', title: '配料状态', width: 100, sortable: true, sortValue: r => r.allocationDone ? '已配料' : '待配料',
    render: r => `<span class="text-xs ${r.allocationDone ? 'text-emerald-600' : 'text-orange-600'}">${r.allocationDone ? '已配料' : '待配料'}</span>` },
  { key: 'plannedQty', title: '计划出库', width: 90, align: 'right', sortable: true, sortValue: r => r.plannedQty,
    render: r => `<span class="text-slate-600">${r.plannedQty}</span>` },
  { key: 'allocatedQty', title: '配料数量', width: 90, align: 'right', sortable: true, sortValue: r => r.allocatedQty,
    render: r => `<span class="text-slate-600">${r.allocatedQty}</span>` },
  { key: 'actualOutboundQty', title: '实际出库', width: 90, align: 'right', sortable: true, sortValue: r => r.actualOutboundQty,
    render: r => `<span class="text-right font-medium ${r.actualOutboundQty > 0 ? 'text-emerald-600' : 'text-slate-400'}">${r.actualOutboundQty}</span>` },
  { key: 'sourceArea', title: '来源区域', width: 140, sortable: true, sortValue: r => r.sourceArea,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.sourceArea)}</span>` },
  { key: 'outboundStatus', title: '出库状态', width: 100, sortable: true, sortValue: r => r.outboundStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${r.outboundStatus === '已完成' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}">${escapeHtml(r.outboundStatus)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => {
      const canConfirm = r.cutterReceived && r.allocationDone && r.outboundStatus === '待出库'
      return `<div class="flex items-center gap-1">${canConfirm
        ? `<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700" data-${EVENT_PREFIX}-action="confirm" data-${EVENT_PREFIX}-idx="${ seedRows.indexOf(r) }">确认出库</button>`
        : r.outboundStatus === '已完成'
          ? '<span class="text-xs text-slate-400">已完成</span>'
          : `<button class="rounded bg-blue-600 px-3 py-1 text-xs text-white opacity-40 cursor-not-allowed" disabled>确认出库</button>`}</div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['outboundNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): OutboundRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedRows.filter(r => {
    if (state.statusFilter && r.outboundStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${r.outboundNo} ${r.taskNo} ${r.productionNo} ${r.sku} ${r.name} ${r.processorName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 配料单 / 生产单 / SKU / 加工方" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">出库状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部</option><option value="已完成" ${state.statusFilter === '已完成' ? 'selected' : ''}>已完成</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '中转仓出库单管理',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '已完成', value: `${seedRows.filter(r => r.outboundStatus === '已完成').length} 条` },
      { label: '待出库', value: `${seedRows.filter(r => r.outboundStatus === '待出库').length} 条` },
    ]),
    listTitle: '出库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无出库记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '出库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.confirmIdx >= 0 && seedRows[state.confirmIdx] ? renderSimpleConfirmDialog({
      prefix: EVENT_PREFIX,
      closeAction: 'cancel-confirm',
      confirmAction: 'run-confirm',
      title: '确认出库',
      description: `确认出库单 ${seedRows[state.confirmIdx].outboundNo} 已把 ${seedRows[state.confirmIdx].allocatedQty} 件 ${seedRows[state.confirmIdx].name} 交给 ${seedRows[state.confirmIdx].processorName}？出库后库存扣减，不可撤销。`,
      confirmLabel: '确认出库',
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

export function renderTransitOutboundManage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleTransitOutboundManageEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
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
  if (action === 'confirm') {
    state.confirmIdx = Number(actionNode.dataset['wlsTransitOutboundIdx'])
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-confirm') {
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'run-confirm') {
    const row = seedRows[state.confirmIdx]
    if (row && row.outboundStatus === '待出库') {
      row.outboundStatus = '已完成'
      row.actualOutboundQty = row.allocatedQty
      row.cutterReceived = true
      showListFeedback(`出库单 ${row.outboundNo} 已出库 ${row.actualOutboundQty} 件，交由 ${row.processorName}`)
    }
    state.confirmIdx = -1
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '中转仓出库单管理', columns, rows: filteredRows() }); return true }
  return false
}
