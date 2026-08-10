// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../../../components/ui/list-table-model.ts'
import {
  listLaceHandovers,
  listLaceOperationLogs,
  listLaceReceipts,
  type LaceHandoverRecord,
} from '../../../../data/fcs/lace-factory-domain.ts'
import { escapeHtml } from '../../../../utils.ts'
import {
  formatJakartaTime,
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  renderLaceBusinessImage,
  renderLaceImagePreview,
  renderLaceSourceStyles,
  renderLaceStatusBadge,
} from './shared.ts'

interface HandoverListState extends ProcessOrderListControllerState {
  keyword: string
  receiptStatus: '' | LaceHandoverRecord['receiptStatus']
  targetWarehouseName: string
  handedOverFrom: string
  handedOverTo: string
  detailHandoverId: string
}

const EVENT_PREFIX = 'lace-handovers'
const ROOT_SELECTOR = '[data-lace-handovers-root]'
const state: HandoverListState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  receiptStatus: '',
  targetWarehouseName: '',
  handedOverFrom: '',
  handedOverTo: '',
  detailHandoverId: '',
}

function jakartaDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function filteredRows(): LaceHandoverRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listLaceHandovers().filter((row) => {
    if (state.receiptStatus && row.receiptStatus !== state.receiptStatus) return false
    if (state.targetWarehouseName && row.toWarehouseName !== state.targetWarehouseName) return false
    const handoverDate = jakartaDate(row.handedOverAt)
    if (state.handedOverFrom && handoverDate < state.handedOverFrom) return false
    if (state.handedOverTo && handoverDate > state.handedOverTo) return false
    if (!keyword) return true
    return [row.handoverNo, row.workOrderNo, row.purchaseOrderNo, row.skuCode, row.materialName, row.toWarehouseName, ...row.sourceLines.flatMap((line) => [line.styleCode, line.styleName])]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<LaceHandoverRecord>[] = [
  {
    key: 'handover', title: '交出记录', width: 180, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.handoverNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.handoverNo)}</div><div class="mt-1 text-xs text-slate-500">${formatJakartaTime(row.handedOverAt)}</div>`,
  },
  {
    key: 'source', title: '生产单／采购单', width: 190,
    render: (row) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(row.workOrderId)}">${escapeHtml(row.workOrderNo)}</button><div class="mt-1 text-xs text-slate-500">采购单 ${escapeHtml(row.purchaseOrderNo)}</div>`,
  },
  {
    key: 'style', title: '款式', width: 220,
    render: (row) => renderLaceSourceStyles(row.sourceLines),
  },
  {
    key: 'material', title: '交出花边', width: 250, required: true,
    render: (row) => `<div class="flex items-center gap-3">${renderLaceBusinessImage(row.materialImageUrl, `${row.materialName}（${row.skuCode}）实物图`)}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.skuCode)}</div></div></div>`,
  },
  {
    key: 'quantity', title: '本次／前后累计', width: 220, sortable: true,
    sortValue: (row) => row.qty,
    render: (row) => `<strong>${formatLaceQty(row.qty, row.unit)}</strong><div class="mt-1 text-xs text-slate-500">${formatLaceQty(row.cumulativeBefore, row.unit)} → ${formatLaceQty(row.cumulativeAfter, row.unit)}</div>`,
  },
  {
    key: 'parties', title: '交出方／接收方', width: 240,
    render: (row) => `<div>${escapeHtml(row.fromFactoryName)}</div><div class="mt-1 text-xs text-slate-500">→ ${escapeHtml(row.toWarehouseName)}</div><div class="mt-1 text-xs">预计接收：${escapeHtml(row.expectedReceiverName)}</div>`,
  },
  {
    key: 'package', title: '送货／包装', width: 220,
    render: (row) => `<div>${escapeHtml(row.deliveryNo)} · ${row.packageCount} 包</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.packageNote || '无')}</div>`,
  },
  {
    key: 'receipt', title: 'WLS 收货', width: 120, sortable: true,
    sortValue: (row) => row.receiptStatus,
    render: (row) => renderLaceStatusBadge(row.receiptStatus, row.receiptStatus === '已收货' ? 'green' : 'yellow'),
  },
  {
    key: 'actions', title: '操作', width: 150, required: true, actionColumn: true,
    render: (row) => `<div class="flex flex-col items-start gap-1"><button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-lace-handovers-action="open-detail" data-handover-id="${escapeHtml(row.handoverId)}" data-skip-page-rerender="true">查看详情</button>${row.receiptStatus === '待收货' ? '<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/wls/accessory-receipts">前往收货</button>' : `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(row.workOrderId)}">查看来源</button>`}</div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/fcs/craft/accessory/lace/handover-records',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-lace-handovers-table-surface]',
  paginationSurfaceSelector: '[data-lace-handovers-pagination-surface]',
  overlaysSurfaceSelector: '[data-lace-handovers-column-overlays]',
  defaultFrozenKeys: ['handover'],
  columnSettingsTitle: '花边交出记录列设置',
  emptyText: '暂无花边交出记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  const warehouses = [...new Set(listLaceHandovers().map((row) => row.toWarehouseName))]
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[16rem] flex-1"><span class="mb-1 block text-xs text-slate-500">交出单／生产单／采购单／SKU</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" data-lace-handovers-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">目标仓库</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-handovers-field="targetWarehouseName" data-skip-page-rerender="true"><option value="">全部</option>${warehouses.map((value) => `<option value="${escapeHtml(value)}" ${state.targetWarehouseName === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="min-w-32"><span class="mb-1 block text-xs text-slate-500">WLS 收货</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-handovers-field="receiptStatus" data-skip-page-rerender="true"><option value="">全部</option><option value="待收货" ${state.receiptStatus === '待收货' ? 'selected' : ''}>待收货</option><option value="已收货" ${state.receiptStatus === '已收货' ? 'selected' : ''}>已收货</option></select></label><label><span class="mb-1 block text-xs text-slate-500">交出日期从</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.handedOverFrom)}" data-lace-handovers-field="handedOverFrom" data-skip-page-rerender="true"></label><label><span class="mb-1 block text-xs text-slate-500">交出日期至</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.handedOverTo)}" data-lace-handovers-field="handedOverTo" data-skip-page-rerender="true"></label><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-lace-handovers-action="apply-filters" data-skip-page-rerender="true">查询</button><button class="h-9 rounded-md border px-4 text-sm" data-lace-handovers-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function renderHandoverDetail(): string {
  if (!state.detailHandoverId) return ''
  const handover = listLaceHandovers().find((item) => item.handoverId === state.detailHandoverId)
  if (!handover) return ''
  const receipt = listLaceReceipts().find((item) => item.handoverId === handover.handoverId)
  const logs = listLaceOperationLogs({ objectId: handover.handoverId })
  return `<div class="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="花边交出记录详情"><button type="button" class="absolute inset-0 bg-black/40" data-lace-handovers-action="close-detail" data-skip-page-rerender="true" aria-label="关闭交出记录详情"></button><aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">交出记录 ${escapeHtml(handover.handoverNo)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(handover.workOrderNo)} · 采购单 ${escapeHtml(handover.purchaseOrderNo)}</p></div><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-lace-handovers-action="close-detail" data-skip-page-rerender="true">关闭</button></header><div class="flex-1 space-y-5 overflow-y-auto p-5"><section class="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><div class="flex items-center gap-3">${renderLaceBusinessImage(handover.materialImageUrl, `${handover.materialName}（${handover.skuCode}）实物图`, 'h-16 w-16')}<div><strong>${escapeHtml(handover.materialName)}</strong><div class="text-xs text-slate-500">${escapeHtml(handover.skuCode)}</div></div></div><div><span class="mb-2 block text-xs text-slate-500">关联款式来源</span>${renderLaceSourceStyles(handover.sourceLines, 'h-14 w-14')}</div></section><section class="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><div><span class="text-xs text-slate-500">本次／前后累计</span><div class="mt-1 font-semibold">${formatLaceQty(handover.qty, handover.unit)}</div><div class="text-xs text-slate-500">${formatLaceQty(handover.cumulativeBefore, handover.unit)} → ${formatLaceQty(handover.cumulativeAfter, handover.unit)}</div></div><div><span class="text-xs text-slate-500">交出／接收</span><div class="mt-1">${escapeHtml(handover.fromFactoryName)} → ${escapeHtml(handover.toWarehouseName)}</div><div class="text-xs text-slate-500">预计接收：${escapeHtml(handover.expectedReceiverName)}</div></div><div><span class="text-xs text-slate-500">送货／包装</span><div class="mt-1">${escapeHtml(handover.deliveryNo)} · ${handover.packageCount} 包</div><div class="text-xs text-slate-500">${escapeHtml(handover.packageNote || '无')}</div></div><div><span class="text-xs text-slate-500">交出人／时间</span><div class="mt-1">${escapeHtml(handover.handedOverByName)}</div><div class="text-xs text-slate-500">${formatJakartaTime(handover.handedOverAt)}</div></div></section><section class="rounded-lg border p-4"><h3 class="font-semibold">中央辅料仓收货</h3>${receipt ? `<div class="mt-3 grid gap-3 sm:grid-cols-2"><div>实际收货 <strong>${formatLaceQty(receipt.actualQty, receipt.unit)}</strong><div class="text-xs text-slate-500">${escapeHtml(receipt.differenceReason || '数量一致')}</div></div><div>${escapeHtml(receipt.receivedByName)}<div class="text-xs text-slate-500">${formatJakartaTime(receipt.receivedAt)}</div><div class="text-xs text-slate-500">${escapeHtml(receipt.warehouseName)} · ${escapeHtml(receipt.warehouseLocation)}</div><div class="text-xs text-slate-500">凭证：${escapeHtml(receipt.evidence || '无差异凭证')}</div></div></div>` : '<p class="mt-2 text-sm text-amber-800">待中央辅料仓确认实际收货。</p>'}</section><section class="rounded-lg border p-4"><h3 class="font-semibold">操作日志</h3>${logs.length ? logs.map((log) => `<div class="mt-3 border-t pt-3 text-sm"><div>${escapeHtml(log.action)} · ${formatJakartaTime(log.occurredAt)}</div><div class="text-xs text-slate-500">${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)} · ${escapeHtml(log.actorName)}</div></div>`).join('') : '<p class="mt-2 text-sm text-slate-500">暂无日志</p>'}</section></div></aside></div>`
}

function renderOverlays(): string {
  return `<div data-lace-handovers-column-overlays>${controller.renderColumnSettings()}</div>${renderHandoverDetail()}${renderLaceImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const all = listLaceHandovers()
  return renderStandardListPage({
    title: '花边交出记录',
    primaryActionsHtml: '<span class="text-sm text-slate-500">每次交出一条记录，逐条进入中央辅料仓收货</span>',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '交出记录', value: `${all.length} 条` },
      { label: '待收货', value: `${all.filter((row) => row.receiptStatus === '待收货').length} 条` },
      { label: '已收货', value: `${all.filter((row) => row.receiptStatus === '已收货').length} 条` },
    ]),
    listTitle: '交出记录列表',
    listActionsHtml: '<button class="rounded-md border px-3 py-1.5 text-sm" data-lace-handovers-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-lace-handovers-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-lace-handovers-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-lace-handovers-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-lace-handovers-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrateLaceSurface(surface)
}

export function renderLaceHandoverRecordsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-lace-handovers-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handleLaceHandoverRecordsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.detailHandoverId) {
    state.detailHandoverId = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-lace-handovers-field]')
  if (field) {
    const name = field.dataset.laceHandoversField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'receiptStatus') state.receiptStatus = field.value as HandoverListState['receiptStatus']
    if (name === 'targetWarehouseName') state.targetWarehouseName = field.value
    if (name === 'handedOverFrom') state.handedOverFrom = field.value
    if (name === 'handedOverTo') state.handedOverTo = field.value
    if (name === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value))
      controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-lace-handovers-action]')
  const action = actionNode?.dataset.laceHandoversAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') controller.stepPage(action === 'prev-page' ? -1 : 1)
  if (action === 'sort-column') controller.cycleSort(actionNode.dataset.columnKey || '')
  if (action === 'open-column-settings') state.showColumnSettings = true
  if (action === 'close-column-settings') state.showColumnSettings = false
  if (action === 'restore-column-settings') controller.restorePreferences()
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    controller.updateColumnPreference(action, actionNode.dataset.laceHandoversColumnKey || actionNode.closest<HTMLElement>('[data-lace-handovers-column-key]')?.dataset.laceHandoversColumnKey || '', checkbox?.checked)
  }
  if (action === 'apply-filters') state.currentPage = 1
  if (action === 'open-detail') {
    state.detailHandoverId = actionNode.dataset.handoverId || ''
    refreshOverlays()
    return true
  }
  if (action === 'close-detail') {
    state.detailHandoverId = ''
    refreshOverlays()
    return true
  }
  if (action === 'reset-filters') {
    state.keyword = ''
    state.receiptStatus = ''
    state.targetWarehouseName = ''
    state.handedOverFrom = ''
    state.handedOverTo = ''
    state.currentPage = 1
  }
  if (['apply-filters', 'reset-filters'].includes(action)) controller.refresh()
  else if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) {
    refreshOverlays()
    controller.refresh()
  } else controller.refresh()
  return true
}
