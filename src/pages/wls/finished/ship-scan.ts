// @page-pattern: list
import type { AppState } from '../../../state/store'
import { escapeHtml, localDateTimeText } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderStandardRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'

type DetailRecord = { scanTime: string; packageNo: string; shipNo: string; orderNo: string; sku: string; name: string; qty: number; result: '成功' | '异常'; exceptionReason?: string }
type ScanBatch = {
  id: string; batchNo: string; warehouse: string; express: string; operator: string
  status: string; created: string; completed: string; totalQty: number; successQty: number; exceptionQty: number
  details: DetailRecord[]
}

const exceptionLabels: Record<string, string> = {
  NOT_FOUND: '面单不存在', WRONG_WAREHOUSE: '不属于当前仓库', STATUS_DENIED: '状态不允许出库',
  ALREADY_SHIPPED: '已出库', DUPLICATE: '重复扫描', EXPRESS_MISMATCH: '快递公司不匹配',
  ORDER_CANCELLED: '订单已取消', NON_FINISHED: '非成衣仓出库', OTHER: '其他',
}

const statusLabel: Record<string, string> = {
  COMPLETED: '已完成', EXCEPTION: '有异常', IN_PROGRESS: '扫码中',
}

function badgeClass(s: string): string {
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  if (s === 'EXCEPTION') return 'bg-orange-50 text-orange-700'
  return 'bg-blue-50 text-blue-700'
}

const seedBatches: ScanBatch[] = [
  { id: 'SB-001', batchNo: 'SCAN-20260829-001', warehouse: '成衣仓', express: '顺丰速运', operator: '张伟', status: 'COMPLETED', created: '2026-08-29 09:00', completed: '2026-08-29 09:15', totalQty: 8, successQty: 8, exceptionQty: 0, details: [
    { scanTime: '09:01:12', packageNo: 'PKG-001', shipNo: 'SF-20260828-001', orderNo: 'SO-20260828-001', sku: 'SKU-DRESS-BLK-M', name: '黑色连衣裙 M', qty: 2, result: '成功' },
    { scanTime: '09:02:30', packageNo: 'PKG-002', shipNo: 'SF-20260828-002', orderNo: 'SO-20260828-002', sku: 'SKU-TEE-WHT-M', name: '白色短袖 M', qty: 1, result: '成功' },
    { scanTime: '09:04:05', packageNo: 'PKG-003', shipNo: 'SF-20260828-003', orderNo: 'SO-20260828-003', sku: 'SKU-JEAN-BLU-L', name: '蓝色牛仔裤 L', qty: 3, result: '成功' },
    { scanTime: '09:06:22', packageNo: 'PKG-004', shipNo: 'SF-20260828-004', orderNo: 'SO-20260828-004', sku: 'SKU-JACKET-KHA-S', name: '卡其夹克 S', qty: 2, result: '成功' },
  ]},
  { id: 'SB-002', batchNo: 'SCAN-20260829-002', warehouse: '成衣仓', express: '中通快递', operator: '李娜', status: 'EXCEPTION', created: '2026-08-29 09:30', completed: '-', totalQty: 5, successQty: 3, exceptionQty: 2, details: [
    { scanTime: '09:31:10', packageNo: 'PKG-005', shipNo: 'ZT-20260828-001', orderNo: 'SO-20260828-005', sku: 'SKU-HOOD-BLK-M', name: '黑色连帽卫衣 M', qty: 1, result: '成功' },
    { scanTime: '09:32:45', packageNo: 'PKG-006', shipNo: 'ZT-20260828-002', orderNo: 'SO-20260828-006', sku: 'SKU-SKIRT-GRY-M', name: '灰色百褶裙 M', qty: 2, result: '异常', exceptionReason: 'NOT_FOUND' },
    { scanTime: '09:34:20', packageNo: 'PKG-007', shipNo: 'ZT-20260828-003', orderNo: 'SO-20260828-007', sku: 'SKU-CARD-WHT-M', name: '针织开衫 米白 M', qty: 1, result: '异常', exceptionReason: 'ORDER_CANCELLED' },
    { scanTime: '09:36:00', packageNo: 'PKG-008', shipNo: 'ZT-20260828-004', orderNo: 'SO-20260828-008', sku: 'SKU-VEST-BLK-M', name: '黑色马甲 M', qty: 1, result: '成功' },
  ]},
  { id: 'SB-003', batchNo: 'SCAN-20260829-003', warehouse: '成衣仓', express: '圆通速递', operator: '张伟', status: 'IN_PROGRESS', created: '2026-08-29 10:00', completed: '-', totalQty: 3, successQty: 2, exceptionQty: 1, details: [
    { scanTime: '10:01:30', packageNo: 'PKG-009', shipNo: 'YT-20260829-001', orderNo: 'SO-20260829-001', sku: 'SKU-DRESS-RED-M', name: '红色连衣裙 M', qty: 1, result: '成功' },
    { scanTime: '10:03:15', packageNo: 'PKG-010', shipNo: 'YT-20260829-002', orderNo: 'SO-20260829-002', sku: 'SKU-PANTS-BLK-L', name: '黑色休闲裤 L', qty: 1, result: '异常', exceptionReason: 'EXPRESS_MISMATCH' },
    { scanTime: '10:05:00', packageNo: 'PKG-011', shipNo: 'YT-20260829-003', orderNo: 'SO-20260829-003', sku: 'SKU-BLOUSE-WHT-S', name: '白色衬衫 S', qty: 1, result: '成功' },
  ]},
  { id: 'SB-004', batchNo: 'SCAN-20260828-010', warehouse: '成衣仓', express: '顺丰速运', operator: '王敏', status: 'COMPLETED', created: '2026-08-28 16:00', completed: '2026-08-28 16:20', totalQty: 12, successQty: 12, exceptionQty: 0, details: [
    { scanTime: '16:01:00', packageNo: 'PKG-020', shipNo: 'SF-20260827-010', orderNo: 'SO-20260827-010', sku: 'SKU-COAT-NAVY-L', name: '藏青大衣 L', qty: 1, result: '成功' },
    { scanTime: '16:03:30', packageNo: 'PKG-021', shipNo: 'SF-20260827-011', orderNo: 'SO-20260827-011', sku: 'SKU-SHIRT-BLU-M', name: '蓝色衬衫 M', qty: 2, result: '成功' },
  ]},
  { id: 'SB-005', batchNo: 'SCAN-20260828-011', warehouse: '成衣仓', express: '韵达快递', operator: '李娜', status: 'COMPLETED', created: '2026-08-28 17:00', completed: '2026-08-28 17:10', totalQty: 6, successQty: 6, exceptionQty: 0, details: [] },
]

const EVENT_PREFIX = 'wls-ship-scan'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/ship-scan:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  batchSeq: 0,
  detailIdx: -1,
  showColumnSettings: false,
  keyword: '',
  warehouseFilter: '' as string,
  expressFilter: '' as string,
  statusFilter: '' as string,
}

const columns: StandardListColumn<ScanBatch>[] = [
  { key: 'batchNo', title: '批次号', width: 180, required: true, freezeable: true, sortable: true, sortValue: r => r.batchNo,
    render: r => `<span class="font-mono text-xs text-blue-600" title="${escapeHtml(r.batchNo)}">${escapeHtml(r.batchNo)}</span>` },
  { key: 'warehouse', title: '仓库', width: 120, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'express', title: '快递公司', width: 130, sortable: true, sortValue: r => r.express,
    render: r => `<span class="text-slate-600">${escapeHtml(r.express)}</span>` },
  { key: 'operator', title: '操作人', width: 100, sortable: true, sortValue: r => r.operator,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operator)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${badgeClass(r.status)}">${escapeHtml(statusLabel[r.status] || r.status)}</span>` },
  { key: 'totalQty', title: '总件数', width: 90, align: 'right', sortable: true, sortValue: r => r.totalQty,
    render: r => `<span class="text-slate-600">${r.totalQty}</span>` },
  { key: 'successQty', title: '成功', width: 80, align: 'right', sortable: true, sortValue: r => r.successQty,
    render: r => `<span class="text-emerald-600">${r.successQty}</span>` },
  { key: 'exceptionQty', title: '异常', width: 80, align: 'right', sortable: true, sortValue: r => r.exceptionQty,
    render: r => `<span class="${r.exceptionQty > 0 ? 'text-orange-600 font-medium' : 'text-slate-600'}">${r.exceptionQty}</span>` },
  { key: 'created', title: '创建时间', width: 150, sortable: true, sortValue: r => r.created,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.created)}</span>` },
  { key: 'completed', title: '完成时间', width: 150, sortable: true, sortValue: r => r.completed,
    render: r => `<span class="text-slate-500 text-xs">${escapeHtml(r.completed)}</span>` },
  { key: 'actions', title: '操作', width: 120, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50" data-${EVENT_PREFIX}-action="view-detail" data-batch-id="${escapeHtml(r.id)}">查看详情</button></div>` },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
const defaultPreferences = (): StandardListColumnPreferences => ({
  order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['batchNo'],
  pageSize: PAGE_SIZE_OPTIONS[0],
})

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): ScanBatch[] {
  const kw = state.keyword.trim().toLowerCase()
  return seedBatches.filter(b => {
    if (state.warehouseFilter && b.warehouse !== state.warehouseFilter) return false
    if (state.expressFilter && b.express !== state.expressFilter) return false
    if (state.statusFilter && b.status !== state.statusFilter) return false
    if (!kw) return true
    return `${b.batchNo} ${b.warehouse} ${b.express} ${b.operator}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const warehouses = [...new Set(seedBatches.map(b => b.warehouse))]
  const expresses = [...new Set(seedBatches.map(b => b.express))]
  const statuses = Object.entries(statusLabel)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="批次号 / 运单号 / 包裹号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse"><option value="">全部仓库</option>${warehouses.map(w => `<option value="${escapeHtml(w)}" ${state.warehouseFilter === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">快递公司</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="express"><option value="">全部快递</option>${expresses.map(e => `<option value="${escapeHtml(e)}" ${state.expressFilter === e ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statuses.map(([k, v]) => `<option value="${escapeHtml(k)}" ${state.statusFilter === k ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage

  const todayBatches = seedBatches.length
  const todayQty = seedBatches.reduce((s, b) => s + b.totalQty, 0)
  const successQty = seedBatches.reduce((s, b) => s + b.successQty, 0)
  const exceptionQty = seedBatches.reduce((s, b) => s + b.exceptionQty, 0)

  return renderStandardListPage({
    title: '扫码出库',
    primaryActionsHtml: `<div class="flex gap-2">${renderSecondaryButton('新建扫码批次', { prefix: EVENT_PREFIX, action: 'new-batch' })}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '今日扫码批次', value: `${todayBatches}` },
      { label: '今日扫码件数', value: `${todayQty}` },
      { label: '成功出库', value: `${successQty}` },
      { label: '异常数量', value: `${exceptionQty}` },
    ]),
    listTitle: '扫码批次列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无扫码批次' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '扫码出库列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailIdx >= 0 && seedBatches[state.detailIdx] ? renderStandardRowDetailDialog({ title: '扫码出库详情', columns, row: seedBatches[state.detailIdx], eventPrefix: EVENT_PREFIX }) : ''].join(''),
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

export function renderShipScan(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleShipScanEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'warehouse') { state.warehouseFilter = (field as HTMLSelectElement).value; return true }
    if (name === 'express') { state.expressFilter = (field as HTMLSelectElement).value; return true }
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
    const warehouse = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="warehouse"]`)
    if (warehouse) state.warehouseFilter = warehouse.value
    const express = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="express"]`)
    if (express) state.expressFilter = express.value
    const status = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="status"]`)
    if (status) state.statusFilter = status.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.warehouseFilter = ''
    state.expressFilter = ''
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
  if (action === 'view-detail') { state.detailIdx = Number(actionNode.dataset[`${DATASET_PREFIX}Idx`]); refreshWorkspace(); return true }
  if (action === 'close-detail') { state.detailIdx = -1; refreshWorkspace(); return true }
  if (action === 'new-batch') {
    state.batchSeq += 1
    const batchNo = `SHIP-SCAN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(seedBatches.length + 1).padStart(3, '0')}`
    seedBatches.unshift({ id: `nb-${state.batchSeq}`, batchNo, warehouse: '中央总仓-成衣仓', express: '顺丰', operator: '当前用户', status: '进行中', created: localDateTimeText(), completed: '', totalQty: 0, successQty: 0, exceptionQty: 0, details: [] })
    state.keyword = ''
    state.statusFilter = ''
    state.currentPage = 1
    showListFeedback(`已创建扫码批次 ${batchNo}，请扫描面单开始出库`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '扫码出库', columns, rows: filteredRows() }); return true }
  return false
}
