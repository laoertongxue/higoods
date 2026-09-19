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

type OutboundOrderStatus = '待出库' | '已出库'
type FulfillmentMode = 'SINGLE_SCAN_SHIP' | 'STANDARD_SHIP' | 'STANDARD_REVIEW_SHIP'

type OutboundOrderItem = {
  id: string; outboundOrderNo: string; reviewOrderNo: string; pickOrderNo: string; relatedOrderNo: string; trackingNo: string
  spu: string; sku: string; skuCount: number
  outboundWarehouse: string; outboundType: string; receivingUnit: string
  outboundQuantity: number; pickedQuantity: number; reviewedQuantity: number
  fulfillmentMode: FulfillmentMode; waybillPrintCount: number
  ownerName: string; operatorName: string; outboundOrderStatus: OutboundOrderStatus; stockDeducted: boolean
  createTime: string; shipDeadline: string
}

function statusBadgeClass(status: OutboundOrderStatus): string {
  return status === '待出库' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
}

function fulfillmentModeLabel(mode: FulfillmentMode): string {
  switch (mode) {
    case 'SINGLE_SCAN_SHIP': return '单件扫码发货'
    case 'STANDARD_SHIP': return '标准发货'
    case 'STANDARD_REVIEW_SHIP': return '复核发货'
  }
}

function fulfillmentModeBadgeClass(mode: FulfillmentMode): string {
  return mode === 'SINGLE_SCAN_SHIP' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
}

const OUTBOUND_ORDER_SEED: OutboundOrderItem[] = (() => {
  const statuses: OutboundOrderStatus[] = ['待出库', '已出库']
  const modes: FulfillmentMode[] = ['SINGLE_SCAN_SHIP', 'STANDARD_SHIP', 'STANDARD_REVIEW_SHIP']
  const outboundTypes = ['现货出库', '预售出库', '调拨出库']
  const warehouses = ['中央总仓-成衣仓', '成衣仓-深圳仓01', '成衣仓-武汉仓01']
  const owners = ['广州总店', '深圳分店', '武汉分店', '杭州分店', '成都分店']
  const operators = ['张伟', '李娜', '王强', '刘洋', '陈静']
  const items: OutboundOrderItem[] = []

  for (let i = 0; i < 42; i++) {
    const status = statuses[i % 2]
    const mode = modes[i % 3]
    const outboundQty = 20 + (i * 5) % 80
    const pickedQty = status === '已出库' ? outboundQty : Math.floor(outboundQty * (0.4 + (i % 5) * 0.12))
    const reviewedQty = status === '已出库' ? outboundQty : Math.min(pickedQty, Math.floor(outboundQty * 0.8))
    const stockDeducted = status === '已出库'
    const dayOffset = Math.floor(i / 7)
    const baseDate = new Date(2026, 8, 18 - dayOffset)
    const createDate = baseDate.toISOString().slice(0, 16).replace('T', ' ')
    const deadlineDate = new Date(baseDate.getTime() + 86400000 * 2).toISOString().slice(0, 16).replace('T', ' ')

    items.push({
      id: `OO-${String(i + 1).padStart(5, '0')}`,
      outboundOrderNo: `CK2026${String(6000 + i).padStart(6, '0')}`,
      reviewOrderNo: `FH2026${String(5000 + i).padStart(6, '0')}`,
      pickOrderNo: `PJ2026${String(8000 + i).padStart(6, '0')}`,
      relatedOrderNo: `SO2026${String(7000 + i).padStart(6, '0')}`,
      trackingNo: `SF${String(2000000000 + i * 54321).slice(0, 12)}`,
      spu: `SPU-GC-${String(10001 + (i % 15)).padStart(5, '0')}`,
      sku: `SKU-GC-${String(30001 + i).padStart(5, '0')}`,
      skuCount: 1 + (i % 4),
      outboundWarehouse: warehouses[i % warehouses.length],
      outboundType: outboundTypes[i % outboundTypes.length],
      receivingUnit: owners[i % owners.length],
      outboundQuantity: outboundQty,
      pickedQuantity: pickedQty,
      reviewedQuantity: reviewedQty,
      fulfillmentMode: mode,
      waybillPrintCount: mode === 'SINGLE_SCAN_SHIP' ? 0 : (status === '已出库' ? 1 : 0),
      ownerName: owners[i % owners.length],
      operatorName: operators[i % operators.length],
      outboundOrderStatus: status,
      stockDeducted,
      createTime: createDate,
      shipDeadline: deadlineDate,
    })
  }
  return items
})()

const OPERATION_LOGS = [
  { id: 'L001', operatedAt: '2026-09-18 14:32', source: 'Web', orderNo: 'CK2026006001', action: '确认发货', operator: '张伟', remark: '面单已打印' },
  { id: 'L002', operatedAt: '2026-09-18 14:15', source: 'PDA', orderNo: 'CK2026006005', action: '拣货完成', operator: '李娜', remark: '-' },
  { id: 'L003', operatedAt: '2026-09-18 13:50', source: 'Web', orderNo: 'CK2026006012', action: '复核通过', operator: '王强', remark: '-' },
  { id: 'L004', operatedAt: '2026-09-18 13:22', source: 'Web', orderNo: 'CK2026006018', action: '生成拣货单', operator: '刘洋', remark: '波次 W20260918-03' },
  { id: 'L005', operatedAt: '2026-09-18 12:45', source: 'PDA', orderNo: 'CK2026006022', action: '扫码拣货', operator: '陈静', remark: '3/8 件' },
]

const STATUS_ORDER: readonly string[] = ['待出库', '已出库']

const EVENT_PREFIX = 'wls-outbound-orders'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const PREFERENCE_KEY = '/wls/finished/outbound-orders:list-columns'
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

const columns: StandardListColumn<OutboundOrderItem>[] = [
  { key: 'orderNos', title: '单号', width: 220, required: true, freezeable: true,
    render: r => `<div class="space-y-0.5 text-xs">
      <div><span class="text-slate-400">出库单号：</span><span class="text-slate-700">${escapeHtml(r.outboundOrderNo)}</span></div>
      <div><span class="text-slate-400">复核单号：</span><span class="text-slate-700">${escapeHtml(r.reviewOrderNo)}</span></div>
      <div><span class="text-slate-400">拣货单号：</span><span class="text-slate-700">${escapeHtml(r.pickOrderNo)}</span></div>
      <div><span class="text-slate-400">跟踪单号：</span><span class="text-slate-700">${escapeHtml(r.trackingNo)}</span></div>
    </div>` },
  { key: 'spu', title: '商品SPU', width: 160, sortable: true, sortValue: r => r.spu,
    render: r => `<span class="text-blue-600">${escapeHtml(r.spu)}（${r.skuCount}个SKU）</span>` },
  { key: 'sku', title: '商品SKU', width: 150, sortable: true, sortValue: r => r.sku,
    render: r => `<span class="font-mono text-xs text-slate-600">${escapeHtml(r.sku)}</span>` },
  { key: 'outboundWarehouse', title: '出库仓库', width: 160, sortable: true, sortValue: r => r.outboundWarehouse,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundWarehouse)}</span>` },
  { key: 'outboundType', title: '出库类型', width: 100, sortable: true, sortValue: r => r.outboundType,
    render: r => `<span class="text-slate-600">${escapeHtml(r.outboundType)}</span>` },
  { key: 'receivingUnit', title: '收货单位', width: 120, sortable: true, sortValue: r => r.receivingUnit,
    render: r => `<span class="text-slate-600">${escapeHtml(r.receivingUnit)}</span>` },
  { key: 'pickedQuantity', title: '拣货数量', width: 90, align: 'right', sortable: true, sortValue: r => r.pickedQuantity,
    render: r => `<span class="text-slate-600">${r.pickedQuantity}</span>` },
  { key: 'reviewedQuantity', title: '复核数量', width: 90, align: 'right', sortable: true, sortValue: r => r.reviewedQuantity,
    render: r => `<span class="text-slate-600">${r.reviewedQuantity}</span>` },
  { key: 'fulfillmentMode', title: '履约模式', width: 120, sortable: true, sortValue: r => r.fulfillmentMode,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${fulfillmentModeBadgeClass(r.fulfillmentMode)}">${escapeHtml(fulfillmentModeLabel(r.fulfillmentMode))}</span>` },
  { key: 'waybillPrintCount', title: '面单打印次数', width: 110, align: 'center', sortable: true, sortValue: r => r.waybillPrintCount,
    render: r => `<span class="text-slate-600">${r.waybillPrintCount}</span>` },
  { key: 'ownerName', title: '货主', width: 100, sortable: true, sortValue: r => r.ownerName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.ownerName)}</span>` },
  { key: 'operatorName', title: '操作人员', width: 100, sortable: true, sortValue: r => r.operatorName,
    render: r => `<span class="text-slate-600">${escapeHtml(r.operatorName)}</span>` },
  { key: 'status', title: '状态', width: 100, sortable: true, sortValue: r => r.outboundOrderStatus,
    render: r => `<span class="rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(r.outboundOrderStatus)}">${escapeHtml(r.outboundOrderStatus)}</span>` },
  { key: 'time', title: '时间', width: 180,
    render: r => `<div class="space-y-0.5 text-xs text-slate-500">
      <div><span class="text-slate-400">创建时间：</span><span>${escapeHtml(r.createTime)}</span></div>
      <div><span class="text-slate-400">发货截止：</span><span>${escapeHtml(r.shipDeadline)}</span></div>
    </div>` },
  { key: 'actions', title: '操作', width: 200, required: true, actionColumn: true,
    render: r => {
      if (r.fulfillmentMode === 'SINGLE_SCAN_SHIP') {
        return `<div class="flex items-center gap-1"><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">${r.stockDeducted ? '已发货' : '待发货'}</span><span class="text-[10px] text-slate-400">自动打包机</span></div>`
      }
      if (r.fulfillmentMode === 'STANDARD_SHIP') {
        const disabled = r.stockDeducted || r.pickedQuantity < r.outboundQuantity
        return `<div class="flex flex-wrap items-center gap-1">
          <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="generate-pick" data-order-id="${escapeHtml(r.id)}">生成/打印拣货单</button>
          <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="view-pick-progress" data-order-id="${escapeHtml(r.id)}">查看拣货进度</button>
          <button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 ${disabled ? 'cursor-not-allowed opacity-50' : ''}" data-${EVENT_PREFIX}-action="confirm-ship" data-order-id="${escapeHtml(r.id)}" ${disabled ? 'disabled' : ''}>Web打印面单/确认发货</button>
        </div>`
      }
      const disabled = r.stockDeducted
      return `<div class="flex items-center gap-1">
        <button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="review" data-order-id="${escapeHtml(r.id)}">复核</button>
        <button class="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 ${disabled ? 'cursor-not-allowed opacity-50' : ''}" data-${EVENT_PREFIX}-action="confirm-ship" data-order-id="${escapeHtml(r.id)}" ${disabled ? 'disabled' : ''}>Web打印面单/确认发货</button>
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

function filteredRows(): OutboundOrderItem[] {
  const kw = state.keyword.trim().toLowerCase()
  return OUTBOUND_ORDER_SEED.filter(o => {
    if (state.statusFilter && o.outboundOrderStatus !== state.statusFilter) return false
    if (!kw) return true
    return `${o.outboundOrderNo} ${o.reviewOrderNo} ${o.pickOrderNo} ${o.relatedOrderNo} ${o.trackingNo} ${o.spu} ${o.sku} ${o.outboundWarehouse} ${o.ownerName}`.toLowerCase().includes(kw)
  })
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="sm:col-span-3"><span class="mb-1 block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="出库单号 / 复核单号 / 拣货单号 / 关联单号 / 跟踪单号 / SPU / SKU" data-${EVENT_PREFIX}-field="keyword"></label>
    <label><span class="mb-1 block text-xs text-muted-foreground">状态</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="status"><option value="">全部状态</option><option value="待出库" ${state.statusFilter === '待出库' ? 'selected' : ''}>待出库</option><option value="已出库" ${state.statusFilter === '已出库' ? 'selected' : ''}>已出库</option></select></label>
    </div><div class="mt-3 flex w-full flex-wrap items-center gap-2">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderOperationLogs(): string {
  return `<div class="rounded-lg border bg-slate-50 p-3">
    <div class="mb-2 text-sm font-medium text-slate-800">出库操作日志</div>
    <div class="max-h-[180px] space-y-1 overflow-auto text-xs">
      ${OPERATION_LOGS.map(log => `<div class="rounded border border-slate-200 bg-white px-2 py-1">[${escapeHtml(log.operatedAt)}] ${escapeHtml(log.source)} / ${escapeHtml(log.orderNo)} / ${escapeHtml(log.action)} / ${escapeHtml(log.operator)} / ${escapeHtml(log.remark)}</div>`).join('')}
    </div>
  </div>`
}

function renderWorkspace(): string {
  ensurePreferencesLoaded()
  const all = filteredRows()
  const sorted = sortStandardListRows(all, state.sort, (row, key) => columns.find(c => c.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  return renderStandardListPage({
    title: '出库单列表',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '总出库单', value: `${OUTBOUND_ORDER_SEED.length} 条` },
      { label: '待出库', value: `${OUTBOUND_ORDER_SEED.filter(o => o.outboundOrderStatus === '待出库').length} 条` },
      { label: '已出库', value: `${OUTBOUND_ORDER_SEED.filter(o => o.outboundOrderStatus === '已出库').length} 条` },
    ]),
    listTitle: '出库单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无出库单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: [...PAGE_SIZE_OPTIONS] }),
    overlaysHtml: [(state.showColumnSettings ? renderStandardListColumnSettings({ title: '出库单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 400 }) : '') + renderOperationLogs(), state.detailHtml].join(''),
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

export function renderFinishedOutboundOrders(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  ensurePreferencesLoaded()
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleFinishedOutboundOrdersEvent(target: HTMLElement, event?: Event): boolean {
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
  if (action === 'view-pick-progress') {
    const sourceRow = actionNode.closest('tr')
    state.detailHtml = sourceRow ? renderCapturedRowDetailDialog({ title: '出库单明细', sourceRow, eventPrefix: EVENT_PREFIX }) : ''
    refreshWorkspace()
    return true
  }
  if (action === 'close-detail') { state.detailHtml = ''; refreshWorkspace(); return true }
  if (action === 'generate-pick' || action === 'confirm-ship' || action === 'review') {
    const id = actionNode.dataset[`${DATASET_PREFIX}OrderId`] || actionNode.dataset.orderId || actionNode.dataset[`${DATASET_PREFIX}Id`] || actionNode.dataset.id || ''
    const row = filteredRows().find((item) => Object.values(item as Record<string, unknown>).includes(id) || (item as { order?: { id?: string } }).order?.id === id) as object | undefined
    if (!row) { showListFeedback('未找到该记录，请刷新后重试', 'warning'); return true }
    const moved = advanceRowStatus(row, STATUS_ORDER)
    if (!moved) {
      showListFeedback('该单据已处于最终状态，无需重复已提交', 'info')
      return true
    }
    const no = String((row as Record<string, unknown>).orderNo ?? (row as Record<string, unknown>).inboundOrderNo ?? (row as Record<string, unknown>).outboundOrderNo ?? (row as Record<string, unknown>).returnNo ?? (row as Record<string, unknown>).qcNo ?? id)
    showListFeedback(`${no} 已提交完成，状态：${moved.from} → ${moved.to}`)
    refreshWorkspace()
    return true
  }
  if (action === 'export') { exportStandardListRows({ fileName: '出库单列表', columns, rows: filteredRows() }); return true }
  return false
}
