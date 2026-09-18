// @page-pattern: list
import { renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  consumePmsTransitFilter,
  describePmsTransitFilter,
  filterPmsTransitReceipts,
  getPmsTransitReceipt,
  listPmsTransitCards,
  listPmsTransitReceipts,
  type PmsTransitReceipt,
} from '../../data/pms/transit-warehouse.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import { formatPmsQty, formatPmsTime, handlePmsCommonImageEvent, hydratePmsSurface, readTextField, renderPmsBusinessImage, renderPmsFeedback, renderPmsImagePreview, renderPmsStatusBadge } from './shared.ts'

interface TransitReceiptsPageState extends ProcessOrderListControllerState {
  keyword: string
  cardFilter: string
  consumedFilter: string
  detailNo: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-trnr'
const ROOT_SELECTOR = '[data-pms-trnr-root]'

const state: TransitReceiptsPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  cardFilter: '',
  consumedFilter: '',
  detailNo: '',
  feedback: '',
  feedbackOk: true,
}

function receiptRows(): PmsTransitReceipt[] {
  return filterPmsTransitReceipts(state.cardFilter)
}

function filteredRows(): PmsTransitReceipt[] {
  const keyword = state.keyword.trim().toLowerCase()
  const rows = receiptRows()
  if (!keyword) return rows
  return rows.filter((row) => [row.receiptNo, row.productionOrderNo, row.styleName, row.styleCode, row.fromFactory, row.warehouse].some((value) => value.toLowerCase().includes(keyword)))
}

function statusTone(status: PmsTransitReceipt['status']): 'green' | 'yellow' | 'blue' | 'red' {
  if (status === '已收货') return 'green'
  if (status === '收货中') return 'blue'
  if (status === '待收货') return 'yellow'
  return 'red'
}

const columns: StandardListColumn<PmsTransitReceipt>[] = [
  {
    key: 'receipt',
    title: '收货单 / 状态',
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.receiptNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.receiptNo)}</div><div class="mt-1">${renderPmsStatusBadge(row.status, statusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">生产单 ${escapeHtml(row.productionOrderNo)}</div>`,
  },
  {
    key: 'style',
    title: '款式',
    width: 200,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.styleName,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.styleImageUrl, `${row.styleName}（${row.styleCode}）款式图`, 'h-10 w-10')}<div><div class="font-medium">${escapeHtml(row.styleName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.styleCode)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.fromFactory)} · ${escapeHtml(row.region)}</div></div></div>`,
  },
  {
    key: 'qty',
    title: '数量 / 箱数',
    width: 170,
    sortable: true,
    sortValue: (row) => row.qty,
    render: (row) => `<div class="text-sm tabular-nums">${formatPmsQty(row.qty, '件')} · ${row.boxCount} 箱</div>${row.diffQty !== 0 ? `<div class="mt-1 text-xs text-red-700">差异 ${row.diffQty > 0 ? '+' : ''}${row.diffQty} 件</div>` : ''}${row.note ? `<div class="mt-1 text-xs text-slate-500">${escapeHtml(row.note)}</div>` : ''}`,
  },
  {
    key: 'warehouse',
    title: '目的仓',
    width: 160,
    sortable: true,
    sortValue: (row) => row.warehouse,
    render: (row) => `<div class="text-sm">${escapeHtml(row.warehouse)}</div><div class="mt-1 text-xs text-slate-500">发出 ${escapeHtml(row.shippedAt)}</div><div class="mt-1 text-xs text-slate-500">收货 ${row.receivedAt ? escapeHtml(row.receivedAt) : '—'}</div>`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    actionColumn: true,
    render: (row) => `<div class="flex items-center"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-detail" data-receipt-no="${escapeHtml(row.receiptNo)}" data-skip-page-rerender="true">详情</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/transit/receipts',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-trnr-table-surface]',
  paginationSurfaceSelector: '[data-pms-trnr-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-trnr-overlays]',
  defaultFrozenKeys: ['receipt', 'style'],
  columnSettingsTitle: '中转收货单列设置',
  emptyText: '当前筛选下暂无收货单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderCards(): string {
  return `<div class="grid grid-cols-2 gap-2 md:grid-cols-7" data-pms-trnr-cards>${listPmsTransitCards()
    .map(
      (card) => `<button type="button" class="rounded-lg border px-3 py-2 text-left ${state.cardFilter === card.filter ? 'border-blue-400 bg-blue-50' : 'bg-card hover:border-blue-300'}" data-${EVENT_PREFIX}-action="apply-card" data-card-filter="${escapeHtml(card.filter)}" data-skip-page-rerender="true"><span class="block text-xs text-muted-foreground">${escapeHtml(card.label)}</span><strong class="mt-1 block text-lg tabular-nums">${card.count}</strong></button>`,
    )
    .join('')}</div>`
}

function renderFilters(): string {
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar>
    <div data-${EVENT_PREFIX}-card-surface>${renderCards()}</div>
    <div class="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="收货单 / 生产单 / 款式 / 工厂 / 仓库" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div>
    <div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
      ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
      ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
      ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    </div>
  </div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '收货单', value: rows.length },
    { label: '待收货', value: rows.filter((row) => row.status === '待收货').length },
    { label: '收货中', value: rows.filter((row) => row.status === '收货中').length },
    { label: '已收货', value: rows.filter((row) => row.status === '已收货').length },
    { label: '异常差异', value: formatPmsQty(rows.reduce((sum, row) => sum + Math.abs(row.diffQty), 0), '件') },
  ])
}

function renderDetailOverlay(receiptNo: string): string {
  const receipt = getPmsTransitReceipt(receiptNo)
  if (!receipt) return ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="收货单详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[560px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div class="flex items-center gap-3">${renderPmsBusinessImage(receipt.styleImageUrl, `${receipt.styleName}（${receipt.styleCode}）款式图`, 'h-12 w-12')}<div><h2 class="font-semibold">${escapeHtml(receipt.receiptNo)}</h2><p class="mt-1 text-xs text-slate-500">生产单 ${escapeHtml(receipt.productionOrderNo)} · ${renderPmsStatusBadge(receipt.status, statusTone(receipt.status))}</p></div></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <dl class="grid grid-cols-2 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">款式</dt><dd class="mt-1">${escapeHtml(receipt.styleName)} · ${escapeHtml(receipt.styleCode)}</dd></div><div><dt class="text-xs text-muted-foreground">数量</dt><dd class="mt-1 tabular-nums">${formatPmsQty(receipt.qty, '件')} · ${receipt.boxCount} 箱</dd></div><div><dt class="text-xs text-muted-foreground">来源工厂</dt><dd class="mt-1">${escapeHtml(receipt.fromFactory)}</dd></div><div><dt class="text-xs text-muted-foreground">地区 / 目的仓</dt><dd class="mt-1">${escapeHtml(receipt.region)} · ${escapeHtml(receipt.warehouse)}</dd></div><div><dt class="text-xs text-muted-foreground">发出时间</dt><dd class="mt-1">${escapeHtml(receipt.shippedAt)}</dd></div><div><dt class="text-xs text-muted-foreground">收货时间</dt><dd class="mt-1">${receipt.receivedAt ? escapeHtml(receipt.receivedAt) : '—'}</dd></div><div><dt class="text-xs text-muted-foreground">差异</dt><dd class="mt-1 ${receipt.diffQty !== 0 ? 'text-red-700' : 'text-emerald-700'}">${receipt.diffQty === 0 ? '无差异' : `${receipt.diffQty > 0 ? '多' : '少'} ${Math.abs(receipt.diffQty)} 件`}</dd></div><div><dt class="text-xs text-muted-foreground">备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(receipt.note || '—')}</dd></div></dl>
    <p class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-slate-600">原型只展示收货事实与差异，不在此页修改生产单或库存。</p>
  </div></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-trnr-column-overlays>${controller.renderColumnSettings()}</div>`
  const imagePreview = renderPmsImagePreview()
  if (!state.detailNo) return `${columnSettings}${imagePreview}`
  return `${columnSettings}${renderDetailOverlay(state.detailNo)}${imagePreview}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const banner = state.consumedFilter
    ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">已按看板筛选：<strong>${escapeHtml(describePmsTransitFilter(state.consumedFilter))}</strong></div>`
    : ''
  return renderStandardListPage({
      showHeader: false,
    title: '中转收货单列表',
    feedbackHtml: `${banner}${renderPmsFeedback(state.feedback, state.feedbackOk)}`,
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-trnr-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-trnr-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-trnr-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-trnr-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前筛选下没有可导出的收货单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '中转收货单.csv',
    ['收货单', '生产单', '款式', '款号', '数量', '箱数', '来源工厂', '地区', '目的仓', '状态', '发出时间', '收货时间', '差异', '备注'],
    rows.map((row) => [row.receiptNo, row.productionOrderNo, row.styleName, row.styleCode, row.qty, row.boxCount, row.fromFactory, row.region, row.warehouse, row.status, row.shippedAt, row.receivedAt, row.diffQty, row.note]),
  )
  state.feedback = `已导出 ${rows.length} 条收货单（当前筛选条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

export function renderPmsTransitReceiptsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  const filter = consumePmsTransitFilter()
  if (filter !== '') {
    state.consumedFilter = filter
    state.cardFilter = filter
  }
  controller.installColumnDragEvents()
  return `<div data-pms-trnr-root data-skip-page-rerender="true"><style>[data-pms-trnr-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsTransitReceiptOverlays(): boolean {
  if (state.detailNo) {
    state.detailNo = ''
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsTransitReceiptsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.detailNo) {
    state.detailNo = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    state.keyword = field.value
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsTrnrAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.consumedFilter = ''
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.cardFilter = ''
    state.consumedFilter = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'apply-card') {
    state.cardFilter = actionNode?.dataset.cardFilter || ''
    state.consumedFilter = ''
    state.currentPage = 1
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-trnr-column-key]')?.dataset.pmsTrnrColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-detail') {
    state.detailNo = actionNode?.dataset.receiptNo || ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.detailNo = ''
    refreshOverlays()
    return true
  }
  return false
}
