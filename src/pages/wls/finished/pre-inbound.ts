// @page-pattern: list
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, renderStandardListColumnSettings, renderCapturedRowDetailDialog, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { loadListColumnPreferences, saveListColumnPreferences, normalizeListColumnPreferences, paginateStandardListRows, resetStandardListEntryTransientStateOnRouteEntry, sortStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { exportStandardListRows } from '../../../components/ui/list-export.ts'
import { showListFeedback, advanceRowStatus } from '../../../components/ui/list-feedback.ts'
import type { PreInboundOrder } from '../../../data/wls/types'
import { preInboundSeed } from '../../../data/wls/seed/raw-seed'

function statusClass(status: string): string {
  if (status === '全部收货') return 'bg-emerald-50 text-emerald-700'
  if (status === '收货中') return 'bg-blue-50 text-blue-700'
  if (status === '部分收货') return 'bg-orange-50 text-orange-700'
  return 'bg-red-50 text-red-700'
}

const EVENT_PREFIX = 'wls-pre-inbound'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/pre-inbound:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state = {
  currentPage: 1,
  sort: null as StandardListSortState | null,
  preferences: { order: [] as string[], visibleKeys: [] as string[], frozenKeys: [] as string[], pageSize: 10 } as StandardListColumnPreferences,
  preferencesLoaded: false,
  detailHtml: '',
  showColumnSettings: false,
  keyword: '',
  statusFilter: '' as string,
}

const columns: StandardListColumn<PreInboundOrder>[] = [
  { key: 'orderNos', title: '单号', width: 220, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">入库单号：</span><span class="text-slate-700">${escapeHtml(r.inboundOrderNo)}</span></div>
      <div><span class="text-slate-400">关联单号（ASN）：</span><span class="text-slate-700">${escapeHtml(r.relatedOrderNo)}</span></div>
      <div><span class="text-slate-400">跟踪单号：</span><span class="text-slate-700">${escapeHtml(r.trackingNo)}</span></div>
    </div>` },
  { key: 'spu', title: '商品SPU', width: 160,
    render: r => {
      const spus = Array.from(new Set(r.productItems.map(p => p.spu)))
      return `<div class="space-y-0.5">${spus.map(spu => {
        const skuCount = r.productItems.filter(p => p.spu === spu).length
        return `<div class="text-blue-600 text-xs">${escapeHtml(spu)}（${skuCount}个SKU）</div>`
      }).join('')}</div>`
    } },
  { key: 'sku', title: '商品SKU', width: 140,
    render: r => `<div class="space-y-0.5 text-xs">${r.productItems.slice(0, 3).map(p => `<div class="font-mono text-slate-600">${escapeHtml(p.sku)}</div>`).join('')}${r.productItems.length > 3 ? `<div class="text-slate-400">+${r.productItems.length - 3} 更多</div>` : ''}</div>` },
  { key: 'deliveryQty', title: '送货数量', width: 140,
    render: r => `<div class="space-y-0.5 text-xs">${r.productItems.slice(0, 3).map(p => {
      const packageQty = p.package_qty || 0
      const baseQty = p.base_qty || 0
      return `<div class="text-slate-600">${packageQty} ${escapeHtml(p.package_unit || '包')} / ${baseQty} ${escapeHtml(p.base_unit || '个')}</div>`
    }).join('')}</div>` },
  { key: 'receivedQty', title: '已收货数量', width: 140,
    render: r => `<div class="space-y-0.5 text-xs">${r.productItems.slice(0, 3).map(p => {
      const receivedPackage = p.received_package_qty || p.current_package_qty || 0
      const receivedBase = p.received_base_qty || p.current_base_qty || 0
      return `<div class="text-slate-600">${receivedPackage} ${escapeHtml(p.package_unit || '包')} / ${receivedBase} ${escapeHtml(p.base_unit || '个')}</div>`
    }).join('')}</div>` },
  { key: 'inboundWarehouse', title: '入库仓库', width: 160, sortable: true, sortValue: r => r.inboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.inboundWarehouse)}</span>` },
  { key: 'inboundType', title: '入库类型', width: 100, sortable: true, sortValue: r => r.inboundType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.inboundType)}</span>` },
  { key: 'deliveryUnit', title: '送货单位', width: 120, sortable: true, sortValue: r => r.deliveryUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.deliveryUnit)}</span>` },
  { key: 'ownerName', title: '货主', width: 100, sortable: true, sortValue: r => r.ownerName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.ownerName)}</span>` },
  { key: 'operatorName', title: '操作人员', width: 100, sortable: true, sortValue: r => r.operatorName || '',
    render: r => `<span class="text-slate-600">${escapeHtml(r.operatorName || '-')}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.status,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}">${escapeHtml(r.status)}</span>` },
  { key: 'time', title: '时间', width: 180,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">发货：</span><span>${escapeHtml(r.shippingTime || '-')}</span></div>
      <div><span class="text-slate-400">收货：</span><span>${escapeHtml(r.receivedTime || '-')}</span></div>
      <div><span class="text-slate-400">上架：</span><span>${escapeHtml(r.putawayTime || '-')}</span></div>
    </div>` },
  { key: 'actions', title: '操作', width: 160, required: true, actionColumn: true,
    render: r => {
      const allReceived = r.status === '全部收货'
      return `<div class="flex items-center gap-1">
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-detail" data-order-id="${escapeHtml(r.inboundOrderNo)}">查看详情</button>
        <button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 ${allReceived ? 'cursor-not-allowed opacity-50' : ''}" data-${EVENT_PREFIX}-action="start-receive" data-order-id="${escapeHtml(r.inboundOrderNo)}" ${allReceived ? 'disabled' : ''}>开始收货</button>
      </div>`
    } },
]

const columnRules = columns.map(c => ({ key: c.key, required: c.required, freezeable: c.freezeable, actionColumn: c.actionColumn }))
function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map(c => c.key),
  visibleKeys: columns.map(c => c.key),
  frozenKeys: ['orderNos'] as string[],
  pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded || typeof window === 'undefined') { state.preferencesLoaded = true; return }
  state.preferences = loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaultPreferences(), [...PAGE_SIZE_OPTIONS])
  state.preferencesLoaded = true
}

function filteredRows(): PreInboundOrder[] {
  const kw = state.keyword.trim().toLowerCase()
  return preInboundSeed.filter(o => {
    if (state.statusFilter && o.status !== state.statusFilter) return false
    if (!kw) return true
    return `${o.inboundOrderNo} ${o.relatedOrderNo} ${o.trackingNo} ${o.inboundType} ${o.inboundWarehouse} ${o.deliveryUnit} ${o.ownerName} ${o.status}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  const statusOptions = ['待收货', '收货中', '部分收货', '全部收货']
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="入库单号 / 关联单号（ASN） / 入库类型 / 跟踪单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option>${statusOptions.map(s => `<option value="${escapeHtml(s)}" ${state.statusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '成衣入库单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总入库单', value: `${preInboundSeed.length} 条` },
      { label: '待收货', value: `${preInboundSeed.filter(o => o.status === '待收货').length} 条` },
      { label: '收货中', value: `${preInboundSeed.filter(o => o.status === '收货中').length} 条` },
      { label: '全部收货', value: `${preInboundSeed.filter(o => o.status === '全部收货').length} 条` },
    ]),
    listTitle: '入库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无入库单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [state.showColumnSettings ? renderStandardListColumnSettings({ title: '入库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '', state.detailHtml].join(''),
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

export function renderFinishedPreInbound(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedPreInboundEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'view-detail') {
    const sourceRow = actionNode.closest('tr')
    state.detailHtml = sourceRow ? renderCapturedRowDetailDialog({ title: '入库单明细', sourceRow, eventPrefix: EVENT_PREFIX }) : ''
    refreshWorkspace()
    return true
  }
  if (action === 'close-detail') { state.detailHtml = ''; refreshWorkspace(); return true }
  if (action === 'start-receive') {
    const id = actionNode.dataset[`${DATASET_PREFIX}OrderId`] || actionNode.dataset.orderId || actionNode.dataset[`${DATASET_PREFIX}Id`] || actionNode.dataset.id || ''
    const row = preInboundSeed.find((item) => Object.values(item as Record<string, unknown>).includes(id) || (item as { order?: { id?: string } }).order?.id === id) as object | undefined
    if (!row) { showListFeedback('未找到该记录，请刷新后重试', 'warning'); return true }
    const no = String((row as Record<string, unknown>).orderNo ?? (row as Record<string, unknown>).qcNo ?? id)
    showListFeedback(`${no} 开始收货已受理`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '成衣入库单列表', columns, rows: filteredRows() }); return true }
  return false
}
