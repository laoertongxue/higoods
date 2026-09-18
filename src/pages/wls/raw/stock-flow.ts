// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type FlowRecord = {
  id: string; time: string; warehouse: string; spu: string; sku: string
  packageUnit: string; productName: string; bizNo: string; docType: string
  actionType: string; totalChange: string; totalBefore: string; totalAfter: string
  spotChange: string; spotBefore: string; spotAfter: string
  location: string; operator: string; operateTime: string; remark: string
}

const actionTypeClass: Record<string, string> = {
  '收货入库': 'bg-emerald-50 text-emerald-700',
  '上架入库': 'bg-blue-50 text-blue-700',
  '销售出库': 'bg-orange-50 text-orange-700',
  '盘盈': 'bg-teal-50 text-teal-700',
  '移货': 'bg-slate-100 text-slate-600',
  '手工调整': 'bg-purple-50 text-purple-700',
  '退货入库': 'bg-cyan-50 text-cyan-700',
}

const seedFlows: FlowRecord[] = [
  { id: 'FL-001', time: '2026-05-30 14:20', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'YRK-FAB-20260530-103', docType: '收货单', actionType: '收货入库', totalChange: '+12 卷', totalBefore: '88 卷', totalAfter: '100 卷', spotChange: '+12 卷', spotBefore: '88 卷', spotAfter: '100 卷', location: 'FAB-A-01', operator: 'Rina', operateTime: '2026-05-30 14:20', remark: '' },
  { id: 'FL-002', time: '2026-05-30 14:30', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'SJ-FAB-20260530-001', docType: '上架单', actionType: '上架入库', totalChange: '+12 卷', totalBefore: '100 卷', totalAfter: '112 卷', spotChange: '+12 卷', spotBefore: '100 卷', spotAfter: '112 卷', location: 'FAB-A-01', operator: 'Rina', operateTime: '2026-05-30 14:30', remark: '' },
  { id: 'FL-003', time: '2026-05-30 15:00', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1002', sku: 'SKU-FAB-50003', packageUnit: '卷', productName: '精梳棉T恤面料', bizNo: 'JHD-FAB-20260530-002', docType: '拣货单', actionType: '销售出库', totalChange: '-5 卷', totalBefore: '45 卷', totalAfter: '40 卷', spotChange: '-5 卷', spotBefore: '45 卷', spotAfter: '40 卷', location: 'FAB-A-03', operator: 'Dian', operateTime: '2026-05-30 15:00', remark: '领料出库' },
  { id: 'FL-004', time: '2026-05-30 15:10', warehouse: '中央总仓-辅料仓', spu: 'SPU-TRM-1001', sku: 'SKU-TRM-50001', packageUnit: '包', productName: '树脂纽扣-12mm', bizNo: 'YRK-TRM-20260530-103', docType: '收货单', actionType: '收货入库', totalChange: '+6 包', totalBefore: '24 包', totalAfter: '30 包', spotChange: '+6 包', spotBefore: '24 包', spotAfter: '30 包', location: 'TRM-A-01', operator: 'VM', operateTime: '2026-05-30 15:10', remark: '' },
  { id: 'FL-005', time: '2026-05-30 15:20', warehouse: '中央总仓-辅料仓', spu: 'SPU-TRM-1002', sku: 'SKU-TRM-50002', packageUnit: '包', productName: '金属拉链-20cm', bizNo: 'PD-TRM-20260530-001', docType: '盘点单', actionType: '盘盈', totalChange: '+2 包', totalBefore: '16 包', totalAfter: '18 包', spotChange: '+2 包', spotBefore: '16 包', spotAfter: '18 包', location: 'TRM-A-02', operator: 'Rina', operateTime: '2026-05-30 15:20', remark: '盘点差异' },
  { id: 'FL-006', time: '2026-05-30 15:30', warehouse: '中央总仓-耗材仓', spu: 'SPU-CON-1001', sku: 'SKU-CON-50001', packageUnit: '箱', productName: '缝纫线-白色', bizNo: 'DB-CON-20260530-001', docType: '移货单', actionType: '移货', totalChange: '0 箱', totalBefore: '24 箱', totalAfter: '24 箱', spotChange: '0 箱', spotBefore: '24 箱', spotAfter: '24 箱', location: 'CON-A-01 → CON-A-03', operator: 'Dian', operateTime: '2026-05-30 15:30', remark: '库位调整' },
  { id: 'FL-007', time: '2026-05-30 15:40', warehouse: '中央总仓-包材仓', spu: 'SPU-PKG-1001', sku: 'SKU-PKG-50001', packageUnit: '包', productName: '快递袋-中号', bizNo: 'YCK-PKG-20260530-001', docType: '出库单', actionType: '销售出库', totalChange: '-10 包', totalBefore: '50 包', totalAfter: '40 包', spotChange: '-10 包', spotBefore: '50 包', spotAfter: '40 包', location: 'PKG-A-01', operator: 'VM', operateTime: '2026-05-30 15:40', remark: '领料出库' },
  { id: 'FL-008', time: '2026-05-30 16:00', warehouse: '中央总仓-纱线仓', spu: 'SPU-YRN-1001', sku: 'SKU-YRN-50001', packageUnit: '卷', productName: '涤纶缝纫线-40S', bizNo: 'TZ-20260530-001', docType: '调整单', actionType: '手工调整', totalChange: '-1 卷', totalBefore: '16 卷', totalAfter: '15 卷', spotChange: '-1 卷', spotBefore: '16 卷', spotAfter: '15 卷', location: 'YRN-A-01', operator: '仓库主管', operateTime: '2026-05-30 16:00', remark: '破损报废' },
  { id: 'FL-009', time: '2026-05-30 16:10', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1003', sku: 'SKU-FAB-50004', packageUnit: '卷', productName: '磨毛保暖面料', bizNo: 'TH-FAB-20260530-001', docType: '收货单', actionType: '退货入库', totalChange: '+3 卷', totalBefore: '17 卷', totalAfter: '20 卷', spotChange: '+3 卷', spotBefore: '17 卷', spotAfter: '20 卷', location: 'FAB-B-01', operator: 'Rina', operateTime: '2026-05-30 16:10', remark: '生产退料' },
  { id: 'FL-010', time: '2026-05-30 16:20', warehouse: '中央总仓-面料仓', spu: 'SPU-FAB-1001', sku: 'SKU-FAB-50001', packageUnit: '卷', productName: '莫代尔打底面料', bizNo: 'JHD-FAB-20260530-003', docType: '拣货单', actionType: '销售出库', totalChange: '-8 卷', totalBefore: '112 卷', totalAfter: '104 卷', spotChange: '-8 卷', spotBefore: '112 卷', spotAfter: '104 卷', location: 'FAB-A-01', operator: 'Dian', operateTime: '2026-05-30 16:20', remark: '领料出库' },
]

const EVENT_PREFIX = 'wls-raw-stock-flow'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/raw/stock-flow:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  actionTypeFilter: '' as string,
}

function changeColor(val: string): string {
  return val.startsWith('+') ? 'text-emerald-600' : val.startsWith('-') ? 'text-red-600' : 'text-slate-500'
}

const columns: StandardListColumn<FlowRecord>[] = [
  { key: 'time', title: '发生时间', width: 140, required: true, freezeable: true, sortable: true, sortValue: r => r.time,
    render: r => `<span class="text-slate-400 text-xs whitespace-nowrap">${escapeHtml(r.time)}</span>` },
  { key: 'warehouse', title: '仓库名称', width: 140, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600 text-xs whitespace-nowrap">${escapeHtml(r.warehouse)}</span>` },
  { key: 'spu', title: '商品SPU', width: 120, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="font-mono text-xs text-blue-600">${escapeHtml(r.spu)}</span>` },
  { key: 'sku', title: '商品SKU', width: 120, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'packageUnit', title: '包装单位', width: 80, sortable: true, sortValue: r => r.packageUnit,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.packageUnit)}</span>` },
  { key: 'productName', title: '商品名称', width: 140, sortable: true, sortValue: r => r.productName,
    render: r => `<span class="text-slate-700">${escapeHtml(r.productName)}</span>` },
  { key: 'bizNo', title: '业务单号', width: 170, sortable: true, sortValue: r => r.bizNo,
    render: r => `<span class="text-blue-600 text-xs font-mono">${escapeHtml(r.bizNo)}</span>` },
  { key: 'docType', title: '单据类型', width: 80, sortable: true, sortValue: r => r.docType,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.docType)}</span>` },
  { key: 'actionType', title: '动作类型', width: 100, sortable: true, sortValue: r => r.actionType,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${actionTypeClass[r.actionType] || 'bg-slate-100 text-slate-600'}">${escapeHtml(r.actionType)}</span>` },
  { key: 'totalChange', title: '总库存变动', width: 100, align: 'right', sortable: true, sortValue: r => r.totalChange,
    render: r => `<span class="font-medium whitespace-nowrap ${changeColor(r.totalChange)}">${escapeHtml(r.totalChange)}</span>` },
  { key: 'totalBefore', title: '总库存变动前', width: 100, align: 'right', sortable: true, sortValue: r => r.totalBefore,
    render: r => `<span class="text-slate-500 whitespace-nowrap">${escapeHtml(r.totalBefore)}</span>` },
  { key: 'totalAfter', title: '总库存变动后', width: 100, align: 'right', sortable: true, sortValue: r => r.totalAfter,
    render: r => `<span class="text-slate-700 font-medium whitespace-nowrap">${escapeHtml(r.totalAfter)}</span>` },
  { key: 'location', title: '库位', width: 140, sortable: true, sortValue: r => r.location,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.location)}</span>` },
  { key: 'operator', title: '操作人', width: 90, sortable: true, sortValue: r => r.operator,
    render: r => `<span class="text-slate-600 text-xs">${escapeHtml(r.operator)}</span>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['time'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): FlowRecord[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedFlows.filter(f => {
    if (state.actionTypeFilter && f.actionType !== state.actionTypeFilter) return false
    if (!kw) return true
    return `${f.bizNo} ${f.spu} ${f.sku} ${f.productName} ${f.operator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="单号 / SPU / SKU / 商品名称 / 操作人" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">动作类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="actionType"><option value="">全部</option><option value="收货入库" ${state.actionTypeFilter === '收货入库' ? 'selected' : ''}>收货入库</option><option value="上架入库" ${state.actionTypeFilter === '上架入库' ? 'selected' : ''}>上架入库</option><option value="销售出库" ${state.actionTypeFilter === '销售出库' ? 'selected' : ''}>销售出库</option><option value="盘盈" ${state.actionTypeFilter === '盘盈' ? 'selected' : ''}>盘盈</option><option value="移货" ${state.actionTypeFilter === '移货' ? 'selected' : ''}>移货</option><option value="手工调整" ${state.actionTypeFilter === '手工调整' ? 'selected' : ''}>手工调整</option><option value="退货入库" ${state.actionTypeFilter === '退货入库' ? 'selected' : ''}>退货入库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '库存流水查询',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '记录数', value: `${all.length} 条` },
      { label: '入库', value: `${seedFlows.filter(f => f.actionType === '收货入库' || f.actionType === '上架入库' || f.actionType === '退货入库').length} 条` },
      { label: '出库', value: `${seedFlows.filter(f => f.actionType === '销售出库').length} 条` },
      { label: '调整', value: `${seedFlows.filter(f => f.actionType === '盘盈' || f.actionType === '移货' || f.actionType === '手工调整').length} 条` },
    ]),
    listTitle: '流水列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无流水记录' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '流水列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '',
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

export function renderRawStockFlow(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleRawStockFlowEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'actionType') { state.actionTypeFilter = (field as HTMLSelectElement).value; return true }
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
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="actionType"]`)
    if (select) state.actionTypeFilter = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.actionTypeFilter = ''
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
  if (action === 'export') { exportStandardListRows({ fileName: '库存流水查询', columns, rows: filteredRows() }); return true }
  return false
}
