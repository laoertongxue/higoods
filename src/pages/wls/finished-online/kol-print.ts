// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderDialog } from '../../../components/ui/dialog.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { renderProductCell, renderStatusBadge, type StatusTone } from './shared.ts'
import {
  kolPrintSeed,
  KOL_PICK_TYPES,
  KOL_BRANDS,
  KOL_STOCK_STATUSES,
  KOL_PLATFORMS,
  ONLINE_WAREHOUSE_OPTIONS,
  type KolPrintRow,
  type KolPrintStatus,
} from './seed.ts'

const EVENT_PREFIX = 'wls-online-kol-print'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const STATUS_TONES: Record<KolPrintStatus, StatusTone> = {
  待打单: 'amber',
  已打单: 'green',
  已取消: 'slate',
}

const state = {
  currentPage: 1,
  pageSize: 10,
  sort: null as StandardListSortState | null,
  keyword: '',
  sku: '',
  spu: '',
  collectedFrom: '',
  collectedTo: '',
  warehouse: '',
  pickType: '',
  brand: '',
  stockStatus: '',
  platform: '',
  dialogOrderId: null as string | null,
  dialogWarehouse: 'A&C WH',
}

const columns: StandardListColumn<KolPrintRow>[] = [
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
  { key: 'outboundType', title: '出库类型', width: 110, sortable: true, sortValue: r => r.outboundType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundType)}</span>` },
  { key: 'status', title: '状态', width: 110, sortable: true, sortValue: r => r.status,
    render: r => renderStatusBadge(r.status, STATUS_TONES[r.status]) },
  { key: 'time', title: '时间', width: 190,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">创建时间：</span><span>${escapeHtml(r.createdAt)}</span></div>
      <div><span class="text-slate-400">揽收时间：</span><span>${escapeHtml(r.collectedAt)}</span></div>
    </div>` },
  { key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
    render: r => `<button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="open-update-warehouse" data-${EVENT_PREFIX}-id="${escapeHtml(r.id)}">更新仓库</button>` },
]

function preferences(): StandardListColumnPreferences {
  return {
    order: columns.map(c => c.key),
    visibleKeys: columns.map(c => c.key),
    frozenKeys: ['orderNos'],
    pageSize: state.pageSize,
  }
}

function filteredRows(): KolPrintRow[] {
  const kw = state.keyword.trim().toLowerCase()
  const sku = state.sku.trim().toLowerCase()
  const spu = state.spu.trim().toLowerCase()
  return kolPrintSeed.filter(r => {
    if (state.warehouse && r.warehouse !== state.warehouse) return false
    if (state.pickType && r.pickType !== state.pickType) return false
    if (state.brand && r.brand !== state.brand) return false
    if (state.stockStatus && r.stockStatus !== state.stockStatus) return false
    if (state.platform && r.platform !== state.platform) return false
    if (sku && !r.product.sku.toLowerCase().includes(sku)) return false
    if (spu && !r.product.spu.toLowerCase().includes(spu)) return false
    if (state.collectedFrom && r.collectedAt !== '-' && r.collectedAt < state.collectedFrom.replace('T', ' ')) return false
    if (state.collectedTo && r.collectedAt !== '-' && r.collectedAt > state.collectedTo.replace('T', ' ')) return false
    if (!kw) return true
    return `${r.outboundOrderNo} ${r.relatedOrderNo} ${r.trackingNo} ${r.product.spu} ${r.product.sku}`.toLowerCase().includes(kw)
  })
}

function selectOptions(options: readonly string[], current: string): string {
  return options.map(option => `<option value="${escapeHtml(option)}" ${current === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">单号搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="搜索出库单号 / 关联单号 / 跟踪单号" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">商品SKU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.sku)}" placeholder="搜索商品SKU" data-${EVENT_PREFIX}-field="sku"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">商品SPU</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.spu)}" placeholder="搜索商品SPU" data-${EVENT_PREFIX}-field="spu"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="warehouse">${selectOptions(ONLINE_WAREHOUSE_OPTIONS, state.warehouse || '全部仓库')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">拣货类型</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="pickType">${selectOptions(KOL_PICK_TYPES, state.pickType || '全部拣货类型')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">品牌</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="brand">${selectOptions(KOL_BRANDS, state.brand || '请选择品牌')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">库存状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="stockStatus">${selectOptions(KOL_STOCK_STATUSES, state.stockStatus || '全部库存状态')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">平台</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="platform">${selectOptions(KOL_PLATFORMS, state.platform || '全部平台')}</select></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">揽收开始时间</span><input type="datetime-local" class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value="${escapeHtml(state.collectedFrom)}" data-${EVENT_PREFIX}-field="collectedFrom"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">揽收截止时间</span><input type="datetime-local" class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value="${escapeHtml(state.collectedTo)}" data-${EVENT_PREFIX}-field="collectedTo"></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('搜索', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: 'KOL待打单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总单量', value: `${kolPrintSeed.length} 条` },
      { label: '待打单', value: `${kolPrintSeed.filter(r => r.status === '待打单').length} 条` },
      { label: '已打单', value: `${kolPrintSeed.filter(r => r.status === '已打单').length} 条` },
    ]),
    listTitle: 'KOL待打单列表',
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: preferences(), sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '未找到符合条件的单据' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: renderOverlay(),
  })
}

function renderOverlay(): string {
  if (!state.dialogOrderId) return ''
  const row = kolPrintSeed.find(r => r.id === state.dialogOrderId)
  if (!row) return ''
  const options = ONLINE_WAREHOUSE_OPTIONS.slice(1).map(option => `<option value="${escapeHtml(option)}" ${state.dialogWarehouse === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')
  return renderDialog(
    {
      title: '更新出库仓库',
      description: `${row.outboundOrderNo} · 当前仓库：${row.warehouse}`,
      closeAction: { prefix: EVENT_PREFIX, action: 'cancel-update-warehouse', skipPageRerender: true },
      width: 'sm',
    },
    `<label class="block"><span class="mb-1 block text-xs text-muted-foreground">选择新仓库</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="dialogWarehouse">${options}</select></label>`,
    `<div class="flex justify-end gap-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'cancel-update-warehouse', skipPageRerender: true })}${renderPrimaryButton('确认更新', { prefix: EVENT_PREFIX, action: 'confirm-update-warehouse', skipPageRerender: true })}</div>`,
  )
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

export function renderWlsOnlineKolPrint(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWlsOnlineKolPrintEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'keyword') { state.keyword = field.value; return true }
    if (name === 'sku') { state.sku = field.value; return true }
    if (name === 'spu') { state.spu = field.value; return true }
    if (name === 'collectedFrom') { state.collectedFrom = field.value; return true }
    if (name === 'collectedTo') { state.collectedTo = field.value; return true }
    if (name === 'dialogWarehouse') { state.dialogWarehouse = field.value; return true }
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
    const readText = (field: string): string => {
      const value = read(field)
      const all = ['全部仓库', '全部拣货类型', '请选择品牌', '全部库存状态', '全部平台']
      return all.includes(value) ? '' : value
    }
    state.keyword = read('keyword')
    state.sku = read('sku')
    state.spu = read('spu')
    state.warehouse = readText('warehouse')
    state.pickType = readText('pickType')
    state.brand = readText('brand')
    state.stockStatus = readText('stockStatus')
    state.platform = readText('platform')
    state.collectedFrom = read('collectedFrom')
    state.collectedTo = read('collectedTo')
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'reset-filter') {
    state.keyword = ''
    state.sku = ''
    state.spu = ''
    state.collectedFrom = ''
    state.collectedTo = ''
    state.warehouse = ''
    state.pickType = ''
    state.brand = ''
    state.stockStatus = ''
    state.platform = ''
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-update-warehouse') {
    state.dialogOrderId = actionNode.dataset[`${DATASET_PREFIX}Id`] || ''
    const row = kolPrintSeed.find(r => r.id === state.dialogOrderId)
    state.dialogWarehouse = row?.warehouse ?? 'A&C WH'
    refreshWorkspace()
    return true
  }
  if (action === 'cancel-update-warehouse') {
    state.dialogOrderId = null
    refreshWorkspace()
    return true
  }
  if (action === 'confirm-update-warehouse') {
    const row = kolPrintSeed.find(r => r.id === state.dialogOrderId)
    if (!row) { state.dialogOrderId = null; refreshWorkspace(); return true }
    if (row.warehouse === state.dialogWarehouse) {
      showListFeedback('已选择相同仓库，未发生变更', 'info')
      state.dialogOrderId = null
      refreshWorkspace()
      return true
    }
    const from = row.warehouse
    row.warehouse = state.dialogWarehouse
    showListFeedback(`${row.outboundOrderNo} 出库仓库已更新：${from} → ${row.warehouse}`)
    state.dialogOrderId = null
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: 'KOL待打单列表', columns, rows: filteredRows() }); return true }
  return false
}
