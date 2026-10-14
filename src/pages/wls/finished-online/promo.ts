// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { renderProductCell, renderStatusBadge, type StatusTone } from './shared.ts'
import {
  promoOrderSeed,
  SHOPEE_ORDER_TYPES,
  SHOPEE_PRINT_STATUSES,
  SHOPEE_SORT_FIELDS,
  ONLINE_WAREHOUSE_OPTIONS,
  type ShopeeOrderRow,
  type ShopeeOrderStatus,
} from './seed.ts'

const EVENT_PREFIX = 'wls-online-promo'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const STATUS_TONES: Record<ShopeeOrderStatus, StatusTone> = {
  待拣货: 'amber',
  待打单: 'amber',
  已打单: 'blue',
  已发货: 'green',
}

const SORT_KEY_MAP: Record<string, string> = {
  创建时间: 'createTime',
  拣货时间: 'pickTime',
  揽收时效: 'collectedTime',
  发货时间: 'shipTime',
}

const state = {
  currentPage: 1,
  pageSize: 10,
  sort: null as StandardListSortState | null,
  keyword: '',
  spu: '',
  sku: '',
  timeFrom: '',
  timeTo: '',
  warehouse: '',
  orderType: '',
  printStatus: '',
  sortField: '创建时间',
  sortDirection: 'desc' as 'asc' | 'desc',
  selected: new Set<string>(),
}

const columns: StandardListColumn<ShopeeOrderRow>[] = [
  { key: 'selection', title: '', width: 44, leadingControlColumn: true,
    render: r => `<input type="checkbox" class="h-4 w-4 cursor-pointer accent-blue-600" data-${EVENT_PREFIX}-field="row-select" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}" ${state.selected.has(r.id) ? 'checked' : ''}>` },
  { key: 'orderNos', title: '单号', width: 220, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">出库单号：</span><span class="text-slate-700">${escapeHtml(r.outboundOrderNo)}</span></div>
      <div><span class="text-slate-400">关联单号：</span><span class="text-slate-700">${escapeHtml(r.relatedOrderNo)}</span></div>
      <div><span class="text-slate-400">跟踪单号：</span><span class="text-slate-700">${escapeHtml(r.trackingNo)}</span></div>
    </div>` },
  { key: 'product', title: '商品信息', width: 240, required: true,
    render: r => renderProductCell(r.product) },
  { key: 'warehouse', title: '出库仓库', width: 120, sortable: true, sortValue: r => r.warehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.warehouse)}</span>` },
  { key: 'orderType', title: '订单类型', width: 110, sortable: true, sortValue: r => r.orderType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderType)}</span>` },
  { key: 'outboundQuantity', title: '出库数量', width: 100, align: 'right', sortable: true, sortValue: r => r.outboundQuantity,
    render: r => `<span class="text-slate-600">${r.outboundQuantity}</span>` },
  { key: 'waybillPrintCount', title: '面单打印次数', width: 120, align: 'center', sortable: true, sortValue: r => r.waybillPrintCount,
    render: r => `<span class="text-slate-600">${r.waybillPrintCount}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => renderStatusBadge(r.status, STATUS_TONES[r.status]) },
  { key: 'createTime', title: '创建时间', width: 150, sortable: true, sortValue: r => r.createTime,
    render: r => `<span class="text-xs text-slate-500">${escapeHtml(r.createTime)}</span>` },
  { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
    render: r => `<div class="flex items-center gap-1">
      <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="row-print" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">打印面单</button>
      <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="row-view" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">查看</button>
    </div>` },
]

function preferences(): StandardListColumnPreferences {
  return {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['orderNos'],
    pageSize: state.pageSize,
  }
}

function filteredRows(): ShopeeOrderRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const sku = state.sku.trim().toLowerCase()
  const spu = state.spu.trim().toLowerCase()
  const from = state.timeFrom.replace('T', ' ')
  const to = state.timeTo.replace('T', ' ')
  return promoOrderSeed.filter(r => {
    if (state.warehouse && r.warehouse !== state.warehouse) return false
    if (state.orderType && r.orderType !== state.orderType) return false
    if (state.printStatus === '未打印' && r.waybillPrintCount > 0) return false
    if (state.printStatus === '已打印' && r.waybillPrintCount === 0) return false
    if (sku && !r.product.sku.toLowerCase().includes(sku)) return false
    if (spu && !r.product.spu.toLowerCase().includes(spu)) return false
    if (from && r.createTime < from) return false
    if (to && r.createTime > to) return false
    if (!kw) return true
    return `${r.outboundOrderNo} ${r.relatedOrderNo} ${r.trackingNo} ${r.product.spu} ${r.product.sku}`.toLowerCase().includes(kw)
  })
}

function selectOptions(options: readonly string[], current: string): string {
  return options.map(option => `<option value="${escapeHtml(option)}" ${current === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 关联单号 / 跟踪单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">SPU搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.spu)}" data-${EVENT_PREFIX}-field="spu"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">SKU搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sku)}" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">开始时间</span><input type="datetime-local" class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value="${escapeHtml(state.timeFrom)}" data-${EVENT_PREFIX}-field="timeFrom"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">截止时间</span><input type="datetime-local" class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value="${escapeHtml(state.timeTo)}" data-${EVENT_PREFIX}-field="timeTo"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse">${selectOptions(ONLINE_WAREHOUSE_OPTIONS, state.warehouse || '全部仓库')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">出库类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="orderType">${selectOptions(SHOPEE_ORDER_TYPES, state.orderType || '全部出库类型')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">打印状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="printStatus">${selectOptions(SHOPEE_PRINT_STATUSES, state.printStatus || '全部打印状态')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">排序字段</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="sortField">${selectOptions(SHOPEE_SORT_FIELDS, state.sortField)}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">排序方向</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="sortDirection"><option value="desc" ${state.sortDirection === 'desc' ? 'selected' : ''}>降序</option><option value="asc" ${state.sortDirection === 'asc' ? 'selected' : ''}>升序</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('批量打印面单', { prefix: EVENT_PREFIX, action: 'bulk-print', skipPageRerender: true }, 'printer')}${renderSecondaryButton('批量标记已打单', { prefix: EVENT_PREFIX, action: 'bulk-mark-printed', skipPageRerender: true }, 'check')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '推广任务单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总任务单', value: `${promoOrderSeed.length} 条` },
      { label: '待拣货', value: `${promoOrderSeed.filter(r => r.status === '待拣货').length} 条` },
      { label: '待打单', value: `${promoOrderSeed.filter(r => r.status === '待打单').length} 条` },
      { label: '已发货', value: `${promoOrderSeed.filter(r => r.status === '已发货').length} 条` },
    ]),
    listTitle: '推广任务单列表',
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: preferences(), sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的任务单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
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

export function renderWlsOnlinePromo(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWlsOnlinePromoEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'row-select') {
      const id = field.dataset[`${DATASET_PREFIX}Id`] || ''
      if ((field as HTMLInputElement).checked) state.selected.add(id)
      else state.selected.delete(id)
      refreshWorkspace()
      return true
    }
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'spu') { state.spu = field.value; return true }
    if (name === 'sku') { state.sku = field.value; return true }
    if (name === 'timeFrom') { state.timeFrom = field.value; return true }
    if (name === 'timeTo') { state.timeTo = field.value; return true }
    if (name === 'sortField') { state.sortField = field.value; return true }
    if (name === 'sortDirection') { state.sortDirection = field.value === 'asc' ? 'asc' : 'desc'; return true }
    if (name === 'pageSize' && event?.type === 'change') {
      state.pageSize = Number(field.value) || 10
      state.currentPage = 1
      refreshWorkspace()
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change') return true
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
    const root = rootElement()
    const read = (field: string): string => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${field}"]`)?.value ?? ''
    const normalized = (value: string, all: string): string => (value === all ? '' : value)
    state.keyword = read('keyword')
    state.spu = read('spu')
    state.sku = read('sku')
    state.timeFrom = read('timeFrom')
    state.timeTo = read('timeTo')
    state.warehouse = normalized(read('warehouse'), '全部仓库')
    state.orderType = normalized(read('orderType'), '全部出库类型')
    state.printStatus = normalized(read('printStatus'), '全部打印状态')
    state.sortField = read('sortField') || '创建时间'
    state.sortDirection = read('sortDirection') === 'asc' ? 'asc' : 'desc'
    state.sort = { key: SORT_KEY_MAP[state.sortField] ?? 'createTime', direction: state.sortDirection }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.spu = ''
    state.sku = ''
    state.timeFrom = ''
    state.timeTo = ''
    state.warehouse = ''
    state.orderType = ''
    state.printStatus = ''
    state.sortField = '创建时间'
    state.sortDirection = 'desc'
    state.sort = null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'bulk-print') {
    if (state.selected.size === 0) { showListFeedback('请先勾选需要打印面单的任务单', 'warning'); return true }
    let count = 0
    state.selected.forEach(id => {
      const row = promoOrderSeed.find(r => r.id === id)
      if (!row || row.status === '已发货') return
      row.waybillPrintCount += 1
      row.status = '已打单'
      count += 1
    })
    showListFeedback(count > 0 ? `已打印 ${count} 条任务单面单` : '所选任务单均无法打印面单', count > 0 ? 'success' : 'info')
    refreshWorkspace()
    return true
  }
  if (action === 'bulk-mark-printed') {
    if (state.selected.size === 0) { showListFeedback('请先勾选需要标记的任务单', 'warning'); return true }
    let count = 0
    state.selected.forEach(id => {
      const row = promoOrderSeed.find(r => r.id === id)
      if (!row || row.status === '已打单' || row.status === '已发货') return
      row.status = '已打单'
      count += 1
    })
    showListFeedback(count > 0 ? `已标记 ${count} 条任务单为已打单` : '所选任务单均为已打单或已发货', count > 0 ? 'success' : 'info')
    refreshWorkspace()
    return true
  }
  if (action === 'row-print') {
    const row = promoOrderSeed.find(r => r.id === (actionNode.dataset[`${DATASET_PREFIX}Id`] || ''))
    if (!row) return true
    if (row.status === '已发货') { showListFeedback('任务单已发货，无需重复打印面单', 'info'); return true }
    row.waybillPrintCount += 1
    row.status = '已打单'
    showListFeedback(`${row.outboundOrderNo} 面单已打印（第 ${row.waybillPrintCount} 次）`)
    refreshWorkspace()
    return true
  }
  if (action === 'row-view') {
    const row = promoOrderSeed.find(r => r.id === (actionNode.dataset[`${DATASET_PREFIX}Id`] || ''))
    if (!row) return true
    showListFeedback(`${row.outboundOrderNo} · ${row.product.name} · 出库 ${row.outboundQuantity} 件 · ${row.status}`, 'info')
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '推广任务单列表', columns, rows: filteredRows() }); return true }
  return false
}
