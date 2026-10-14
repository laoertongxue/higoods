// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { renderSimpleConfirmDialog } from '../../../components/ui/dialog.ts'
import { garmentTransferSeed, GARMENT_TRANSFER_STATUSES, GARMENT_WAREHOUSES, type GarmentTransferRow } from './seed.ts'

const statusClass: Record<string, string> = {
  待拣货: 'bg-blue-50 text-blue-700',
  待发出: 'bg-indigo-50 text-indigo-700',
  已完成: 'bg-emerald-50 text-emerald-700',
  已取消: 'bg-slate-100 text-slate-500',
  异常: 'bg-red-50 text-red-700',
}

type TabKey = 'ALL' | (typeof GARMENT_TRANSFER_STATUSES)[number]

const EVENT_PREFIX = 'wls-online-garment-transfer'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/online/garment-transfer:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  detailId: '',
  confirmRelease: false,
  tab: 'ALL' as TabKey,
  transferNo: '',
  sku: '',
  fromWarehouse: '' as string,
  toWarehouse: '' as string,
}

const columns: StandardListColumn<GarmentTransferRow>[] = [
  { key: 'select', title: '勾选', width: 50, required: true,
    render: () => `<input type="checkbox" class="h-4 w-4 rounded border-slate-300" />` },
  { key: 'transferNo', title: '调拨单号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.transferNo,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.transferNo)}</span>` },
  { key: 'fromWarehouse', title: '调出仓库', width: 150, sortable: true, sortValue: r => r.fromWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.fromWarehouse)}</span>` },
  { key: 'toWarehouse', title: '调入仓库', width: 150, sortable: true, sortValue: r => r.toWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.toWarehouse)}</span>` },
  { key: 'skuKinds', title: 'SKU种类', width: 90, align: 'right', sortable: true, sortValue: r => r.skuKinds,
    render: r => `<span class="text-slate-600">${r.skuKinds}</span>` },
  { key: 'transferQty', title: '调拨数量', width: 100, align: 'right', sortable: true, sortValue: r => r.transferQty,
    render: r => `<span class="font-medium text-slate-700">${r.transferQty}</span>` },
  { key: 'pickedQty', title: '已拣数量', width: 100, align: 'right', sortable: true, sortValue: r => r.pickedQty,
    render: r => `<span class="text-slate-600">${r.pickedQty}</span>` },
  { key: 'sentQty', title: '已发出数量', width: 110, align: 'right', sortable: true, sortValue: r => r.sentQty,
    render: r => `<span class="${r.sentQty > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}">${r.sentQty}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}">${escapeHtml(r.status)}</span>` },
  { key: 'account', title: '账号', width: 110, sortable: true, sortValue: r => r.account,
    render: r => `<span class="text-slate-600">${escapeHtml(r.account)}</span>` },
  { key: 'actions', title: '操作', width: 90, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['transferNo'] as string[],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function tabMatches(row: GarmentTransferRow): boolean {
  return state.tab === 'ALL' || row.status === state.tab
}

function filteredRows(): GarmentTransferRow[] {
  const transferNo = state.transferNo.trim().toLowerCase()
  const sku = state.sku.trim().toLowerCase()
  return garmentTransferSeed.filter(r => {
    if (!tabMatches(r)) return false
    if (state.fromWarehouse && r.fromWarehouse !== state.fromWarehouse) return false
    if (state.toWarehouse && r.toWarehouse !== state.toWarehouse) return false
    if (transferNo && !r.transferNo.toLowerCase().includes(transferNo)) return false
    if (sku && !r.id.toLowerCase().includes(sku)) return false
    return true
  })
}

function warehouseOptions(): string {
  return GARMENT_WAREHOUSES.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('')
}

function renderTabsHtml(): string {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'ALL', label: '全部' },
    ...GARMENT_TRANSFER_STATUSES.map(status => ({ key: status as TabKey, label: status })),
  ]
  return renderTabs({
    tabs: tabs.map(tab => ({
      key: tab.key,
      label: tab.label,
      count: tab.key === 'ALL' ? garmentTransferSeed.length : garmentTransferSeed.filter(r => r.status === tab.key).length,
    })),
    activeKey: state.tab,
    variant: 'pills',
    prefix: EVENT_PREFIX,
    action: 'switch-tab',
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">调拨单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.transferNo)}" placeholder="调拨单号" data-${EVENT_PREFIX}-field="transferNo"></label>
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">SKU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sku)}" placeholder="SKU" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">调出仓</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="fromWarehouse"><option value="">全部</option>${warehouseOptions()}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">调入仓</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="toWarehouse"><option value="">全部</option>${warehouseOptions()}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const detailRow = state.detailId ? garmentTransferSeed.find(r => r.id === state.detailId) : undefined
  return renderStandardListPage({
    title: '成衣调拨',
    statusTabsHtml: renderTabsHtml(),
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton('新增调拨单', { prefix: EVENT_PREFIX, action: 'create' }, 'plus')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '调拨单数', value: `${garmentTransferSeed.length} 条` },
      { label: '待拣货', value: `${garmentTransferSeed.filter(r => r.status === '待拣货').length} 条` },
      { label: '待发出', value: `${garmentTransferSeed.filter(r => r.status === '待发出').length} 条` },
      { label: '异常', value: `${garmentTransferSeed.filter(r => r.status === '异常').length} 条` },
    ]),
    listTitle: '调拨单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('释放占用', { prefix: EVENT_PREFIX, action: 'release-occupied' }, 'unlock')}${renderSecondaryButton('打印调拨单', { prefix: EVENT_PREFIX, action: 'print-transfer' }, 'printer')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的调拨单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [
      state.showColumnSettings ? renderStandardListColumnSettings({ title: '成衣仓调拨列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
      detailRow ? renderStandardRowDetailDialog({ title: '调拨单明细', columns, row: detailRow, eventPrefix: EVENT_PREFIX }) : '',
      state.confirmRelease ? renderSimpleConfirmDialog({
        prefix: EVENT_PREFIX,
        closeAction: 'cancel-confirm',
        confirmAction: 'run-release',
        title: '释放调拨占用',
        description: `将释放当前待拣货调拨单的库存占用。涉及 ${garmentTransferSeed.filter(r => r.status === '待拣货').length} 张单据，释放后单据取消。确定继续？`,
        confirmLabel: '释放占用',
        danger: true,
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

export function renderGarmentTransfer(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleGarmentTransferEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'transferNo') { state.transferNo = field.value; return true }
    if (name === 'sku') { state.sku = field.value; return true }
    if (name === 'fromWarehouse') { state.fromWarehouse = (field as HTMLSelectElement).value; return true }
    if (name === 'toWarehouse') { state.toWarehouse = (field as HTMLSelectElement).value; return true }
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
    state.transferNo = read('transferNo')
    state.sku = read('sku')
    state.fromWarehouse = read('fromWarehouse')
    state.toWarehouse = read('toWarehouse')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.transferNo = ''
    state.sku = ''
    state.fromWarehouse = ''
    state.toWarehouse = ''
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
  if (action === 'release-occupied') { state.confirmRelease = true; refreshWorkspace(); return true }
  if (action === 'create') { showListFeedback('新增调拨单为演示入口，测试环境不写入数据', 'info'); return true }
  if (action === 'cancel-confirm') { state.confirmRelease = false; refreshWorkspace(); return true }
  if (action === 'run-release') {
    let released = 0
    for (const row of garmentTransferSeed) {
      if (row.status === '待拣货') { row.status = '已取消'; released += 1 }
    }
    state.confirmRelease = false
    showListFeedback(released > 0 ? `已释放 ${released} 张调拨单的库存占用` : '当前没有待拣货调拨单可释放占用', released > 0 ? 'success' : 'info')
    refreshWorkspace()
    return true
  }
  if (action === 'print-transfer') {
    const count = filteredRows().length
    showListFeedback(count > 0 ? `已生成 ${count} 张调拨单的打印任务` : '没有可打印的调拨单', count > 0 ? 'success' : 'info')
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '成衣仓调拨', columns, rows: filteredRows() }); return true }
  return false
}
