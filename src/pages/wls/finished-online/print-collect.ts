// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { renderProductCell, renderStatusBadge, renderStatusTabs, parseActionKey, type StatusTone } from './shared.ts'
import { printCollectSeed, type PrintCollectRow, type PrintCollectStatus } from './seed.ts'

const EVENT_PREFIX = 'wls-online-print-collect'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const STATUS_TONES: Record<PrintCollectStatus, StatusTone> = {
  待拣货: 'amber',
  拣货完成: 'blue',
  预售发货: 'green',
  现货发货: 'green',
}

const TAB_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: '待拣货', label: '待拣货' },
  { key: '拣货完成', label: '拣货完成' },
  { key: '预售发货', label: '预售发货' },
  { key: '现货发货', label: '现货发货' },
]

const state = {
  currentPage: 1,
  pageSize: 10,
  sort: null as StandardListSortState | null,
  keyword: '',
  carrier: '',
  status: '' as string,
}

const columns: StandardListColumn<PrintCollectRow>[] = [
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
  { key: 'carrier', title: '快递公司', width: 130, sortable: true, sortValue: r => r.carrier,
    render: r => `<span class="text-slate-600">${escapeHtml(r.carrier)}</span>` },
  { key: 'orderType', title: '订单类型', width: 110, sortable: true, sortValue: r => r.orderType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.orderType)}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => renderStatusBadge(r.status, STATUS_TONES[r.status]) },
  { key: 'time', title: '时间', width: 190,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">创建时间：</span><span>${escapeHtml(r.createdAt)}</span></div>
      <div><span class="text-slate-400">揽收时间：</span><span>${escapeHtml(r.collectedAt)}</span></div>
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

function filteredRows(): PrintCollectRow[] {
  const kw = state.keyword.trim().toLowerCase()
  return printCollectSeed.filter(r => {
    if (state.carrier && r.carrier !== state.carrier) return false
    if (state.status && r.status !== state.status) return false
    if (!kw) return true
    return `${r.outboundOrderNo} ${r.relatedOrderNo} ${r.trackingNo} ${r.product.spu} ${r.product.sku} ${r.warehouse} ${r.carrier}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 关联单号 / 跟踪单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">快递公司</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="carrier">
      <option value="">全部</option><option value="J&T Express" ${state.carrier === 'J&T Express' ? 'selected' : ''}>J&T Express</option><option value="其他" ${state.carrier === '其他' ? 'selected' : ''}>其他</option>
    </select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderTabs(): string {
  const kw = state.keyword.trim().toLowerCase()
  const carrierScoped = printCollectSeed.filter(r => {
    if (state.carrier && r.carrier !== state.carrier) return false
    if (!kw) return true
    return `${r.outboundOrderNo} ${r.relatedOrderNo} ${r.trackingNo} ${r.product.spu} ${r.product.sku}`.toLowerCase().includes(kw)
  })
  const tabs = TAB_DEFS.map(tab => ({
    key: tab.key,
    label: tab.label,
    count: tab.key === 'all' ? carrierScoped.length : carrierScoped.filter(r => r.status === tab.key).length,
  }))
  return renderStatusTabs({ prefix: EVENT_PREFIX, action: 'tab', activeKey: state.status || 'all', tabs })
}

function renderWorkspace(): string {
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '打单揽收统计',
    filtersHtml: renderFilters(),
    statusTabsHtml: renderTabs(),
    statsHtml: renderStandardListStats([
      { label: '总单量', value: `${printCollectSeed.length} 条` },
      { label: '待拣货', value: `${printCollectSeed.filter(r => r.status === '待拣货').length} 条` },
      { label: '拣货完成', value: `${printCollectSeed.filter(r => r.status === '拣货完成').length} 条` },
      { label: '已发货', value: `${printCollectSeed.filter(r => r.status === '预售发货' || r.status === '现货发货').length} 条` },
    ]),
    listTitle: '揽收统计列表',
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: preferences(), sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的单据' }),
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

export function renderWlsOnlinePrintCollect(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWlsOnlinePrintCollectEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'carrier') { state.carrier = field.value; return true }
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
  const tabKey = parseActionKey(action, 'tab')
  if (tabKey !== null) {
    state.status = tabKey === 'all' ? '' : tabKey
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
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key === key ? (state.sort.direction === 'asc' ? { key, direction: 'desc' } : null) : { key, direction: 'asc' }
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'apply-filter') {
    const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="keyword"]`)
    if (input) state.keyword = input.value
    const select = rootElement()?.querySelector<HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="carrier"]`)
    if (select) state.carrier = select.value
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.carrier = ''
    state.status = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '打单揽收统计', columns, rows: filteredRows() }); return true }
  return false
}
