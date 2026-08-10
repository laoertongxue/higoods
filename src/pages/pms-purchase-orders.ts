// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import {
  cancelPurchaseOrder,
  checkPurchaseOrderCancellation,
  getPurchaseSkuReceivedQty,
  LaceDomainError,
  listAccessoryPurchaseOrders,
  listLaceProductionOrders,
  PLATFORM_ADMIN,
  PMS_BUYER,
  recordPurchaseCancellationAttempt,
  updatePurchaseOrder,
  type LaceProductionOrderView,
} from '../data/fcs/lace-factory-domain.ts'
import type { AccessoryPurchaseOrder, AccessoryPurchaseOrderLine } from '../data/fcs/lace-factory-purchase-projection.ts'
import { escapeHtml } from '../utils.ts'
import {
  formatJakartaTime,
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  nextLaceClientActionId,
  readTextField,
  renderLaceBusinessImage,
  renderLaceFeedback,
  renderLaceImagePreview,
  renderLaceStatusBadge,
} from './process-factory/accessory/lace/shared.ts'

interface PurchasePageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | AccessoryPurchaseOrder['status']
  overlay: null | { kind: 'cancel' | 'change' | 'detail'; purchaseOrderId: string; clientActionId: string }
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

interface AggregatedLine extends AccessoryPurchaseOrderLine {
  sourceLineIds: string[]
}

const EVENT_PREFIX = 'pms-lace-purchase'
const ROOT_SELECTOR = '[data-pms-lace-purchase-root]'
const state: PurchasePageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function aggregateLines(order: AccessoryPurchaseOrder): AggregatedLine[] {
  const grouped = new Map<string, AggregatedLine>()
  order.lines.forEach((line) => {
    const existing = grouped.get(line.skuId)
    if (existing) {
      existing.orderedQty += line.orderedQty
      existing.sourceLineIds.push(line.purchaseOrderLineId)
    } else grouped.set(line.skuId, { ...line, sourceLineIds: [line.purchaseOrderLineId] })
  })
  return [...grouped.values()].map((line) => ({ ...line, orderedQty: Math.round(line.orderedQty * 100) / 100 }))
}

function linkedWorkOrders(order: AccessoryPurchaseOrder): LaceProductionOrderView[] {
  return listLaceProductionOrders(PLATFORM_ADMIN).filter((workOrder) => workOrder.purchaseOrderId === order.purchaseOrderId)
}

function filteredRows(): AccessoryPurchaseOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listAccessoryPurchaseOrders().filter((order) => {
    if (state.status && order.status !== state.status) return false
    if (!keyword) return true
    return [order.purchaseOrderNo, order.supplierName, order.buyerName, ...order.lines.flatMap((line) => [line.skuCode, line.materialName, line.styleCode, line.styleName])]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<AccessoryPurchaseOrder>[] = [
  {
    key: 'purchase', title: '采购订单', width: 190, required: true, freezeable: true, sortable: true,
    sortValue: (order) => order.purchaseOrderNo,
    render: (order) => `<div class="font-semibold">${escapeHtml(order.purchaseOrderNo)}</div><div class="mt-1 text-xs text-slate-500">V${order.version} · ${formatJakartaTime(order.orderedAt)}</div><div class="mt-1 text-xs">采购员：${escapeHtml(order.buyerName)}</div>`,
  },
  {
    key: 'supplier', title: '供应商／状态', width: 170, sortable: true,
    sortValue: (order) => order.supplierName,
    render: (order) => `<div class="font-medium">${escapeHtml(order.supplierName)}</div><div class="mt-2">${renderLaceStatusBadge(order.status, order.status === '有效' ? 'green' : order.status === '已取消' ? 'red' : 'slate')}</div>`,
  },
  {
    key: 'style', title: '需求款式', width: 240,
    render: (order) => [...new Map(order.lines.map((line) => [line.styleId, line])).values()].map((line) => `<div class="mb-2 flex items-center gap-3 last:mb-0">${renderLaceBusinessImage(line.styleImageUrl, `${line.styleName}（${line.styleCode}）款式图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(line.styleName)}</div><div class="text-xs text-slate-500">${escapeHtml(line.styleCode)}</div></div></div>`).join(''),
  },
  {
    key: 'materials', title: '采购 SKU', width: 310, required: true,
    render: (order) => aggregateLines(order).map((line) => `<div class="mb-2 flex items-center gap-3 border-b pb-2 last:mb-0 last:border-b-0 last:pb-0">${renderLaceBusinessImage(line.materialImageUrl, `${line.materialName}（${line.skuCode}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(line.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(line.skuCode)} · ${escapeHtml(line.materialType)}</div><div class="text-xs">${escapeHtml(line.specification)} · ${escapeHtml(line.color)}</div></div></div>`).join(''),
  },
  {
    key: 'quantities', title: '采购／WLS 实收', width: 220,
    render: (order) => aggregateLines(order).map((line) => `<div class="mb-2 border-b pb-2 text-xs last:mb-0 last:border-b-0 last:pb-0"><div>采购 <strong>${formatLaceQty(line.orderedQty, line.unit)}</strong></div><div class="mt-1">WLS 实收 <strong>${formatLaceQty(getPurchaseSkuReceivedQty(order.purchaseOrderId, line.skuId), line.unit)}</strong></div></div>`).join(''),
  },
  {
    key: 'delivery', title: '交期／目标仓库', width: 220, sortable: true,
    sortValue: (order) => order.lines[0]?.dueDate,
    render: (order) => aggregateLines(order).map((line) => `<div class="mb-2 border-b pb-2 text-sm last:mb-0 last:border-b-0 last:pb-0"><div>${escapeHtml(line.dueDate || '交期待补齐')}</div><div class="mt-1 text-xs ${line.targetWarehouseName ? 'text-slate-500' : 'font-medium text-red-700'}">${escapeHtml(line.targetWarehouseName || '目标仓库未指定')}</div></div>`).join(''),
  },
  {
    key: 'production', title: '花边生产关联', width: 230,
    render: (order) => {
      const workOrders = linkedWorkOrders(order)
      if (!workOrders.length) return order.lines.some((line) => line.materialType === '花边' && order.supplierId === 'SUP-RJ-001')
        ? '<span class="text-red-700">未生成：请检查来源完整性</span>'
        : '<span class="text-slate-500">不进入花边厂管理</span>'
      return workOrders.map((workOrder) => `<div class="mb-2 last:mb-0"><button class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(workOrder.workOrderId)}">${escapeHtml(workOrder.workOrderNo)}</button><div class="text-xs text-slate-500">${escapeHtml(workOrder.skuCode)} · ${escapeHtml(workOrder.status)}</div><div class="mt-1 text-[11px] text-slate-500">计划 ${formatLaceQty(workOrder.planQty, workOrder.unit)}／完工 ${formatLaceQty(workOrder.completedQty, workOrder.unit)}／交出 ${formatLaceQty(workOrder.handedOverQty, workOrder.unit)}／实收 ${formatLaceQty(workOrder.receivedQty, workOrder.unit)}</div></div>`).join('')
    },
  },
  {
    key: 'changeImpact', title: '采购版本／变更影响', width: 190,
    render: (order) => {
      const latest = [...order.changeHistory].sort((left, right) => right.toVersion - left.toVersion)[0]
      return latest
        ? `<div class="font-medium">当前 V${order.version}</div><div class="mt-1 text-xs text-amber-800">最近 V${latest.fromVersion} → V${latest.toVersion}</div><div class="mt-1 text-xs text-slate-500">${latest.fields.map((field) => field.label).join('、')}</div>`
        : `<div class="font-medium">当前 V${order.version}</div><div class="mt-1 text-xs text-slate-500">暂无采购变更</div>`
    },
  },
  {
    key: 'cancelGate', title: '取消门禁', width: 190,
    render: (order) => {
      if (order.status !== '有效') return renderLaceStatusBadge('不可重复取消', 'slate')
      const check = checkPurchaseOrderCancellation(order.purchaseOrderId)
      return check.allowed
        ? `<div>${renderLaceStatusBadge('允许取消', 'green')}</div><div class="mt-1 text-xs text-slate-500">关联生产单均为待接收或已取消</div>`
        : `<div>${renderLaceStatusBadge('禁止取消', 'red')}</div><div class="mt-1 text-xs text-red-700">${check.blockers.length} 张生产单已进入加工</div>`
    },
  },
  {
    key: 'actions', title: '操作', width: 150, required: true, actionColumn: true,
    render: (order) => `<div class="flex flex-col items-start gap-1"><button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-pms-lace-purchase-action="open-detail" data-purchase-order-id="${escapeHtml(order.purchaseOrderId)}" data-skip-page-rerender="true">关联详情</button>${order.status === '有效' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-pms-lace-purchase-action="open-change" data-purchase-order-id="${escapeHtml(order.purchaseOrderId)}" data-skip-page-rerender="true">变更采购单</button><button type="button" class="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-pms-lace-purchase-action="open-cancel" data-purchase-order-id="${escapeHtml(order.purchaseOrderId)}" data-skip-page-rerender="true">取消采购单</button>` : ''}</div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/purchase-order',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-lace-purchase-table-surface]',
  paginationSurfaceSelector: '[data-pms-lace-purchase-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-lace-purchase-column-overlays]',
  defaultFrozenKeys: ['purchase'],
  columnSettingsTitle: '采购订单列设置',
  emptyText: '当前条件下暂无采购订单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[18rem] flex-1"><span class="mb-1 block text-xs text-slate-500">采购单／供应商／SKU／款式</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" data-pms-lace-purchase-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">采购状态</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-pms-lace-purchase-field="status" data-skip-page-rerender="true"><option value="">全部</option>${['有效', '已取消', '已作废'].map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-pms-lace-purchase-action="apply-filters" data-skip-page-rerender="true">查询</button><button class="h-9 rounded-md border px-4 text-sm" data-pms-lace-purchase-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function overlayPurchaseOrder(): AccessoryPurchaseOrder | undefined {
  if (!state.overlay) return undefined
  return listAccessoryPurchaseOrders().find((order) => order.purchaseOrderId === state.overlay?.purchaseOrderId)
}

function renderOverlay(): string {
  const order = overlayPurchaseOrder()
  if (!state.overlay || !order) return ''
  const error = state.overlayError ? `<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''
  if (state.overlay.kind === 'detail') {
    const lines = aggregateLines(order)
    const workOrders = linkedWorkOrders(order)
    const check = checkPurchaseOrderCancellation(order.purchaseOrderId)
    return `<div class="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="采购订单关联详情"><button type="button" class="absolute inset-0 bg-black/40" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭采购关联详情"></button><aside class="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">采购单 ${escapeHtml(order.purchaseOrderNo)} 关联详情</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(order.supplierName)} · V${order.version} · ${escapeHtml(order.status)}</p></div><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="flex-1 space-y-5 overflow-y-auto p-5"><section><h3 class="mb-2 font-semibold">采购 SKU 与 WLS 实收</h3><div class="space-y-2">${lines.map((line) => `<article class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div class="flex items-center gap-3">${renderLaceBusinessImage(line.materialImageUrl, `${line.materialName}（${line.skuCode}）实物图`, 'h-14 w-14')}<div><strong>${escapeHtml(line.materialName)}</strong><div class="text-xs text-slate-500">${escapeHtml(line.skuCode)} · ${escapeHtml(line.specification)}</div></div></div><div class="text-right text-sm"><div>采购 <strong>${formatLaceQty(line.orderedQty, line.unit)}</strong></div><div>WLS 实收 <strong>${formatLaceQty(getPurchaseSkuReceivedQty(order.purchaseOrderId, line.skuId), line.unit)}</strong></div></div></article>`).join('')}</div></section><section><h3 class="mb-2 font-semibold">内部花边生产关联</h3>${workOrders.length ? `<div class="space-y-2">${workOrders.map((workOrder) => `<article class="rounded-md border p-3"><div class="flex flex-wrap items-center justify-between gap-3"><button class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(workOrder.workOrderId)}">${escapeHtml(workOrder.workOrderNo)}</button>${renderLaceStatusBadge(workOrder.status, workOrder.status === '已完结' ? 'green' : workOrder.status === '加工中' ? 'blue' : workOrder.status === '已取消' ? 'red' : 'slate')}</div><div class="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span>计划 <strong>${formatLaceQty(workOrder.planQty, workOrder.unit)}</strong></span><span>完工 <strong>${formatLaceQty(workOrder.completedQty, workOrder.unit)}</strong></span><span>交出 <strong>${formatLaceQty(workOrder.handedOverQty, workOrder.unit)}</strong></span><span>实收 <strong>${formatLaceQty(workOrder.receivedQty, workOrder.unit)}</strong></span></div><div class="mt-2 text-xs text-slate-500">采购变更：${escapeHtml(workOrder.purchaseChangeStatus)} · 交出：${escapeHtml(workOrder.handoverStatus)} · 收货：${escapeHtml(workOrder.receiptStatus)}</div></article>`).join('')}</div>` : '<p class="rounded-md border bg-slate-50 p-3 text-sm text-slate-500">该采购单没有花边厂生产关联。</p>'}</section><section class="rounded-md border p-4"><div class="flex items-center justify-between gap-3"><h3 class="font-semibold">采购变更影响</h3><span>当前 V${order.version}</span></div>${order.changeHistory.length ? `<div class="mt-3 space-y-2">${[...order.changeHistory].sort((left, right) => right.toVersion - left.toVersion).map((change) => `<div class="rounded-md bg-amber-50 p-3 text-sm"><strong>V${change.fromVersion} → V${change.toVersion}</strong><div class="mt-1 text-xs text-slate-600">${change.fields.map((field) => `${field.label}：${field.beforeValue} → ${field.afterValue}`).join('；')}</div></div>`).join('')}</div>` : '<p class="mt-2 text-sm text-slate-500">暂无采购变更。</p>'}</section><section class="rounded-md border p-4"><h3 class="font-semibold">取消门禁</h3>${check.allowed ? '<p class="mt-2 text-sm text-emerald-700">关联生产单均为待接收或已取消，允许取消采购单。</p>' : `<p class="mt-2 text-sm text-red-700">${check.blockers.length} 张生产单已进入加工，必须先按规则取消对应生产单。</p>`}</section></div></aside></div>`
  }
  if (state.overlay.kind === 'cancel') {
    const check = checkPurchaseOrderCancellation(order.purchaseOrderId)
    const body = check.allowed
      ? `<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">该采购单关联生产单均为待接收或已取消，允许取消。保存后，待接收的花边生产单会同步取消。</div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">取消原因</span><textarea class="min-h-24 w-full rounded-md border p-3" data-pms-lace-purchase-field="cancelReason" placeholder="必填"></textarea></label>`
      : `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>采购单不能取消</strong><p class="mt-1">关联花边生产单已进入加工。必须先按规则取消生产单，再重新提交采购取消。</p></div><div class="mt-4 space-y-2">${check.blockers.map((blocker) => `<article class="rounded-md border p-3"><div class="flex items-center justify-between"><button class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(blocker.workOrderId)}">${escapeHtml(blocker.workOrderNo)}</button>${renderLaceStatusBadge(blocker.status, blocker.status === '已完结' ? 'green' : 'blue')}</div><div class="mt-2 grid grid-cols-3 gap-2 text-xs"><span>SKU ${escapeHtml(blocker.skuCode)}</span><span>完工 ${formatLaceQty(blocker.completedQty, blocker.unit)}</span><span>交出 ${formatLaceQty(blocker.handedOverQty, blocker.unit)}</span></div></article>`).join('')}</div>`
    return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><section class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="font-semibold">取消采购单 ${escapeHtml(order.purchaseOrderNo)}</h2><p class="mt-1 text-xs text-slate-500">提交前检查该采购单全部关联花边生产单</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[65vh] overflow-y-auto p-5">${error}${body}</div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true">返回</button>${check.allowed ? '<button class="rounded-md bg-red-600 px-4 py-2 text-sm text-white" data-pms-lace-purchase-action="save-cancel" data-skip-page-rerender="true">确认取消采购单</button>' : ''}</footer></section></div>`
  }
  const lines = aggregateLines(order)
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="font-semibold">变更采购单 ${escapeHtml(order.purchaseOrderNo)}</h2><p class="mt-1 text-xs text-slate-500">当前 V${order.version}；保存后生成新版本，并让 PFOS 重新进入待查看。</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[68vh] space-y-4 overflow-y-auto p-5">${error}<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">SKU、供应商／工厂和单位属于关键身份字段，本入口不直接修改；关联生产单已进入加工时必须先取消生产单。</div><section class="space-y-2"><h3 class="font-medium">采购数量</h3>${lines.map((line) => `<label class="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><span class="flex items-center gap-3">${renderLaceBusinessImage(line.materialImageUrl, `${line.materialName}实物图`, 'h-10 w-10')}<span><strong class="block">${escapeHtml(line.materialName)}</strong><span class="text-xs text-slate-500">${escapeHtml(line.skuCode)}</span></span></span><span class="flex items-center gap-2"><input type="number" min="0.01" step="0.01" class="h-9 w-32 rounded-md border px-3" value="${line.orderedQty}" data-pms-lace-quantity-sku="${escapeHtml(line.skuId)}"><span>${escapeHtml(line.unit)}</span></span></label>`).join('')}</section><div class="grid gap-4 sm:grid-cols-2"><label><span class="mb-1 block text-xs text-slate-500">交期</span><input type="date" class="h-9 w-full rounded-md border px-3" value="${escapeHtml(lines[0]?.dueDate || '')}" data-pms-lace-purchase-field="dueDate"></label><label><span class="mb-1 block text-xs text-slate-500">目标仓库</span><select class="h-9 w-full rounded-md border bg-white px-3" data-pms-lace-purchase-field="warehouse"><option value="WLS-CENTRAL-ACCESSORY">中央仓库·辅料仓</option></select></label></div><label class="block"><span class="mb-1 block text-xs text-slate-500">采购备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-pms-lace-purchase-field="note">${escapeHtml(lines[0]?.note || '')}</textarea></label></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-pms-lace-purchase-action="close-overlay" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-pms-lace-purchase-action="save-change" data-skip-page-rerender="true">保存采购变更</button></footer></section></div>`
}

function renderOverlays(): string {
  return `<div data-pms-lace-purchase-column-overlays>${controller.renderColumnSettings()}</div>${renderOverlay()}${renderLaceImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const all = listAccessoryPurchaseOrders()
  const internalLace = all.filter((order) => order.status === '有效' && order.supplierId === 'SUP-RJ-001' && order.lines.some((line) => line.materialType === '花边')).length
  return renderStandardListPage({
    title: '采购订单',
    primaryActionsHtml: '<span class="text-sm text-slate-500">采购负责下单与变更；花边生产、交出和 WLS 实收分别留在各自系统</span>',
    feedbackHtml: renderLaceFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '有效采购单', value: `${all.filter((order) => order.status === '有效').length} 单` },
      { label: '内部花边采购', value: `${internalLace} 单` },
      { label: '取消受生产阻断', value: `${all.filter((order) => order.status === '有效' && !checkPurchaseOrderCancellation(order.purchaseOrderId).allowed).length} 单` },
    ]),
    listTitle: '采购订单列表',
    listActionsHtml: '<button class="rounded-md border px-3 py-1.5 text-sm" data-pms-lace-purchase-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-pms-lace-purchase-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-lace-purchase-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-lace-purchase-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydrateLaceSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-lace-purchase-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrateLaceSurface(surface)
}

export function renderPmsPurchaseOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-lace-purchase-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handlePmsPurchaseOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-pms-lace-purchase-field]')
  if (field) {
    const name = field.dataset.pmsLacePurchaseField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'status') state.status = field.value as PurchasePageState['status']
    if (name === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value))
      controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pms-lace-purchase-action]')
  const action = actionNode?.dataset.pmsLacePurchaseAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'prev-page' ? -1 : 1)
    controller.refresh()
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-column-settings') state.showColumnSettings = true
  if (action === 'close-column-settings') state.showColumnSettings = false
  if (action === 'restore-column-settings') controller.restorePreferences()
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    controller.updateColumnPreference(action, actionNode.dataset.pmsLacePurchaseColumnKey || actionNode.closest<HTMLElement>('[data-pms-lace-purchase-column-key]')?.dataset.pmsLacePurchaseColumnKey || '', checkbox?.checked)
  }
  if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) {
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'apply-filters') {
    state.currentPage = 1
    controller.refresh()
    return true
  }
  if (action === 'reset-filters') {
    state.keyword = ''
    state.status = ''
    state.currentPage = 1
    controller.refresh()
    return true
  }
  if (action === 'open-cancel' || action === 'open-change' || action === 'open-detail') {
    if (action === 'open-cancel') recordPurchaseCancellationAttempt(actionNode.dataset.purchaseOrderId || '', PMS_BUYER)
    state.overlay = {
      kind: action === 'open-cancel' ? 'cancel' : action === 'open-change' ? 'change' : 'detail',
      purchaseOrderId: actionNode.dataset.purchaseOrderId || '',
      clientActionId: nextLaceClientActionId(action === 'open-cancel' ? 'PMS-CANCEL' : 'PMS-CHANGE'),
    }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const scope = rootElement() ?? document
  if (action === 'save-cancel' && state.overlay?.kind === 'cancel') {
    try {
      const order = overlayPurchaseOrder()
      cancelPurchaseOrder({
        purchaseOrderId: state.overlay.purchaseOrderId,
        reason: readTextField(scope, '[data-pms-lace-purchase-field="cancelReason"]'),
        clientActionId: state.overlay.clientActionId,
        actor: PMS_BUYER,
      })
      state.overlay = null
      state.feedback = `采购单 ${order?.purchaseOrderNo ?? ''} 已取消，待接收花边生产单已同步取消。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.overlayError = `未保存：${error instanceof Error ? error.message : String(error)}。请修正后重新提交。`
      refreshOverlays()
    }
    return true
  }
  if (action === 'save-change' && state.overlay?.kind === 'change') {
    try {
      const quantities: Record<string, number> = {}
      rootElement()?.querySelectorAll<HTMLInputElement>('[data-pms-lace-quantity-sku]').forEach((quantityField) => {
        quantities[quantityField.dataset.pmsLaceQuantitySku || ''] = Number(quantityField.value)
      })
      const order = updatePurchaseOrder(state.overlay.purchaseOrderId, {
        quantityBySku: quantities,
        dueDate: readTextField(scope, '[data-pms-lace-purchase-field="dueDate"]'),
        targetWarehouseId: 'WLS-CENTRAL-ACCESSORY',
        targetWarehouseName: '中央仓库·辅料仓',
        note: readTextField(scope, '[data-pms-lace-purchase-field="note"]'),
      }, state.overlay.clientActionId, PMS_BUYER)
      state.overlay = null
      state.feedback = `采购单 ${order.purchaseOrderNo} 已更新为 V${order.version}；PFOS 已重新进入待查看。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      const message = error instanceof LaceDomainError ? error.message : error instanceof Error ? error.message : String(error)
      state.overlayError = `未保存：${message}。请修正后重新提交。`
      refreshOverlays()
    }
    return true
  }
  return false
}
