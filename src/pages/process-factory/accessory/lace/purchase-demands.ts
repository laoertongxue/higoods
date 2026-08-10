// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../../../components/ui/list-table-model.ts'
import {
  countPendingPurchaseChanges,
  getAccessoryPurchaseOrder,
  getPurchaseChangeViewStatus,
  listAccessoryPurchaseOrders,
  listLaceGenerationFailures,
  listLaceProductionOrders,
  listLacePurchaseDemands,
  markPurchaseChangeViewed,
  LACE_FACTORY_OPERATOR,
  LACE_FACTORY_SUPERVISOR,
  PLATFORM_ADMIN,
  type LaceActor,
  type LaceProductionOrderView,
  type LaceProductionStatus,
  type LacePurchaseChangeViewStatus,
} from '../../../../data/fcs/lace-factory-domain.ts'
import type {
  AccessoryPurchaseOrder,
  AccessoryPurchaseOrderLine,
  LacePurchaseProjectionFailure,
  LacePurchaseDemand,
  LacePurchaseSourceLine,
} from '../../../../data/fcs/lace-factory-purchase-projection.ts'
import { escapeHtml } from '../../../../utils.ts'
import {
  formatJakartaTime,
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  renderLaceBusinessImage,
  renderLaceFeedback,
  renderLaceImagePreview,
  renderLaceSourceStyles,
  renderLaceStatusBadge,
} from './shared.ts'

export interface PurchaseDemandRow {
  rowKey: string
  kind: 'normal' | 'failure'
  purchaseOrderId: string
  purchaseOrderNo: string
  purchaseOrderVersion: number
  orderedAt: string
  buyerName: string
  supplierName: string
  factoryName: string
  skuId: string
  skuCode: string
  materialName: string
  materialImageUrl: string
  specification: string
  color: string
  sourceLines: LacePurchaseSourceLine[]
  orderedQty?: number
  unit?: string
  dueDate?: string
  targetWarehouseName?: string
  workOrder?: LaceProductionOrderView
  changeStatus: LacePurchaseChangeViewStatus
  failureReasons: string[]
}

interface PurchaseDemandState extends ProcessOrderListControllerState {
  actorRole: 'operator' | 'supervisor' | 'platform'
  keyword: string
  changeStatus: '' | '待查看' | '已查看' | '无新变更'
  productionStatus: '' | LaceProductionStatus
  dueDateFrom: string
  dueDateTo: string
  targetWarehouseName: string
  generationResult: '' | 'linked' | 'failure'
  drawerPurchaseOrderId: string
  feedback: string
  feedbackOk: boolean
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const EVENT_PREFIX = 'lace-demand'
const ROOT_SELECTOR = '[data-lace-purchase-demands-root]'

const state: PurchaseDemandState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  actorRole: 'operator',
  keyword: '',
  changeStatus: '',
  productionStatus: '',
  dueDateFrom: '',
  dueDateTo: '',
  targetWarehouseName: '',
  generationResult: '',
  drawerPurchaseOrderId: '',
  feedback: '',
  feedbackOk: true,
}

function currentDemandActor(): LaceActor {
  if (state.actorRole === 'supervisor') return LACE_FACTORY_SUPERVISOR
  if (state.actorRole === 'platform') return PLATFORM_ADMIN
  return LACE_FACTORY_OPERATOR
}

function toNormalRow(
  demand: LacePurchaseDemand,
  workOrder: LaceProductionOrderView | undefined,
  actor: LaceActor,
): PurchaseDemandRow {
  return {
    rowKey: demand.generationKey,
    kind: 'normal',
    purchaseOrderId: demand.purchaseOrderId,
    purchaseOrderNo: demand.purchaseOrderNo,
    purchaseOrderVersion: demand.purchaseOrderVersion,
    orderedAt: demand.orderedAt,
    buyerName: demand.buyerName,
    supplierName: demand.supplierName,
    factoryName: demand.factoryName,
    skuId: demand.skuId,
    skuCode: demand.skuCode,
    materialName: demand.materialName,
    materialImageUrl: demand.materialImageUrl,
    specification: demand.specification,
    color: demand.color,
    sourceLines: demand.sourceLines,
    orderedQty: demand.orderedQty,
    unit: demand.unit,
    dueDate: demand.dueDate,
    targetWarehouseName: demand.targetWarehouseName,
    workOrder,
    changeStatus: getPurchaseChangeViewStatus(demand.purchaseOrderId, actor),
    failureReasons: [],
  }
}

function consistentValue(lines: AccessoryPurchaseOrderLine[], read: (line: AccessoryPurchaseOrderLine) => string): string | undefined {
  const values = [...new Set(lines.map(read))]
  return values.length === 1 && values[0].trim() ? values[0] : undefined
}

function failureSourceLines(lines: AccessoryPurchaseOrderLine[]): LacePurchaseSourceLine[] {
  return lines.map((line) => ({
    purchaseOrderLineId: line.purchaseOrderLineId,
    orderedQty: line.orderedQty,
    unit: line.unit,
    styleId: line.styleId,
    styleCode: line.styleCode,
    styleName: line.styleName,
    styleImageUrl: line.styleImageUrl,
    note: line.note,
  }))
}

export function buildLacePurchaseDemandRows(input: {
  actor: LaceActor
  demands: LacePurchaseDemand[]
  workOrders: LaceProductionOrderView[]
  purchaseOrders: AccessoryPurchaseOrder[]
  failures: LacePurchaseProjectionFailure[]
}): PurchaseDemandRow[] {
  const workOrders = new Map(input.workOrders.map((order) => [order.generationKey, order]))
  const rows = input.demands.map((demand) => toNormalRow(demand, workOrders.get(demand.generationKey), input.actor))
  const purchaseOrders = new Map(input.purchaseOrders.map((order) => [order.purchaseOrderId, order]))
  const groupedFailures = new Map<string, LacePurchaseProjectionFailure[]>()
  for (const failure of input.failures) {
    const key = `${failure.purchaseOrderId}::${failure.skuId || failure.purchaseOrderLineId}`
    groupedFailures.set(key, [...(groupedFailures.get(key) ?? []), failure])
  }
  for (const [rowKey, failures] of groupedFailures) {
    const firstFailure = failures[0]
    const purchaseOrder = purchaseOrders.get(firstFailure.purchaseOrderId)
    if (!purchaseOrder) continue
    const sourceLineIds = new Set(failures.flatMap((failure) => failure.purchaseOrderLineId.split('、')))
    const lines = purchaseOrder.lines.filter((line) => line.skuId === firstFailure.skuId || sourceLineIds.has(line.purchaseOrderLineId))
    const firstLine = lines[0]
    const unit = lines.length > 0 ? consistentValue(lines, (line) => line.unit) : undefined
    const orderedQty = unit && lines.every((line) => line.orderedQty > 0)
      ? Math.round(lines.reduce((sum, line) => sum + line.orderedQty, 0) * 100) / 100
      : undefined
    rows.push({
      rowKey,
      kind: 'failure',
      purchaseOrderId: purchaseOrder.purchaseOrderId,
      purchaseOrderNo: purchaseOrder.purchaseOrderNo,
      purchaseOrderVersion: purchaseOrder.version,
      orderedAt: purchaseOrder.orderedAt,
      buyerName: purchaseOrder.buyerName,
      supplierName: purchaseOrder.supplierName,
      factoryName: firstFailure.factoryName,
      skuId: firstFailure.skuId,
      skuCode: firstLine?.skuCode || firstFailure.skuCode,
      materialName: firstLine?.materialName || firstFailure.materialName,
      materialImageUrl: firstLine?.materialImageUrl || firstFailure.materialImageUrl,
      specification: firstLine?.specification ?? '',
      color: firstLine?.color ?? '',
      sourceLines: failureSourceLines(lines),
      orderedQty,
      unit,
      dueDate: lines.length > 0 ? consistentValue(lines, (line) => line.dueDate) : undefined,
      targetWarehouseName: lines.length > 0 && consistentValue(lines, (line) => line.targetWarehouseId)
        ? consistentValue(lines, (line) => line.targetWarehouseName)
        : undefined,
      changeStatus: getPurchaseChangeViewStatus(purchaseOrder.purchaseOrderId, input.actor),
      failureReasons: [...new Set(failures.map((failure) => failure.reason))],
    })
  }
  return rows.sort((left, right) => `${left.purchaseOrderNo}-${left.skuCode}`.localeCompare(`${right.purchaseOrderNo}-${right.skuCode}`))
}

function allRows(): PurchaseDemandRow[] {
  const actor = currentDemandActor()
  return buildLacePurchaseDemandRows({
    actor,
    demands: listLacePurchaseDemands(actor),
    workOrders: listLaceProductionOrders(actor),
    purchaseOrders: listAccessoryPurchaseOrders(),
    failures: listLaceGenerationFailures(actor),
  })
}

function filteredRows(): PurchaseDemandRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return allRows().filter((row) => {
    if (state.changeStatus && row.changeStatus !== state.changeStatus) return false
    if (state.productionStatus && row.workOrder?.status !== state.productionStatus) return false
    if (state.generationResult === 'linked' && !row.workOrder) return false
    if (state.generationResult === 'failure' && row.kind !== 'failure') return false
    if (state.dueDateFrom && (!row.dueDate || row.dueDate < state.dueDateFrom)) return false
    if (state.dueDateTo && (!row.dueDate || row.dueDate > state.dueDateTo)) return false
    if (state.targetWarehouseName && row.targetWarehouseName !== state.targetWarehouseName) return false
    if (!keyword) return true
    return [
      row.purchaseOrderNo,
      row.skuCode,
      row.materialName,
      ...row.sourceLines.flatMap((line) => [line.styleCode, line.styleName]),
      row.factoryName,
      row.targetWarehouseName,
      row.workOrder?.workOrderNo,
      ...row.failureReasons,
    ].some((value) => value?.toLowerCase().includes(keyword))
  })
}

function changeBadge(status: LacePurchaseChangeViewStatus): string {
  if (status === '待查看') return renderLaceStatusBadge('采购已变更 · 待查看', 'yellow')
  if (status === '已查看') return renderLaceStatusBadge('采购变更 · 已查看', 'slate')
  return renderLaceStatusBadge('无新变更', 'slate')
}

const columns: StandardListColumn<PurchaseDemandRow>[] = [
  {
    key: 'purchase', title: '采购需求', width: 210, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.purchaseOrderNo,
    render: (row) => `<div class="space-y-1"><div class="font-semibold text-slate-900">采购单 ${escapeHtml(row.purchaseOrderNo)}</div><div class="text-xs text-slate-500">V${row.purchaseOrderVersion} · ${formatJakartaTime(row.orderedAt)}</div><div class="text-xs">采购员：${escapeHtml(row.buyerName)}</div></div>`,
  },
  {
    key: 'style', title: '款式', width: 230, required: true,
    render: (row) => row.sourceLines.length > 0
      ? renderLaceSourceStyles(row.sourceLines)
      : '<span class="font-medium text-red-700">款式资料待补齐</span>',
  },
  {
    key: 'material', title: '花边 SKU', width: 260, required: true, sortable: true,
    sortValue: (row) => row.skuCode,
    render: (row) => `<div class="flex items-center gap-3">${renderLaceBusinessImage(row.materialImageUrl, `${row.materialName}（${row.skuCode || 'SKU 待补齐'}）实物图`)}<div><div class="font-medium">${escapeHtml(row.materialName || '物料名称待补齐')}</div><div class="text-xs text-slate-500">${escapeHtml(row.skuCode || 'SKU 编码待补齐')}</div><div class="text-xs">${escapeHtml([row.specification, row.color].filter(Boolean).join(' · ') || '规格／颜色待补齐')}</div></div></div>`,
  },
  {
    key: 'quantity', title: '采购数量', width: 130, align: 'right', sortable: true,
    sortValue: (row) => row.orderedQty ?? -1,
    render: (row) => `${row.orderedQty !== undefined && row.unit ? `<strong class="tabular-nums">${escapeHtml(formatLaceQty(row.orderedQty, row.unit))}</strong>` : '<span class="font-medium text-red-700">待 PMS 补齐</span>'}<div class="mt-1 text-xs text-slate-500">${row.sourceLines.length} 条来源行</div>`,
  },
  {
    key: 'delivery', title: '交期／目标仓库', width: 220, sortable: true,
    sortValue: (row) => row.dueDate ?? '',
    render: (row) => `<div class="font-medium">${row.dueDate ? escapeHtml(row.dueDate) : '<span class="text-red-700">交期待补齐</span>'}</div><div class="mt-1 text-xs ${row.targetWarehouseName ? 'text-slate-500' : 'font-medium text-red-700'}">${row.targetWarehouseName ? escapeHtml(row.targetWarehouseName) : '目标仓库待补齐'}</div>`,
  },
  {
    key: 'factory', title: '供应商／承接工厂', width: 190,
    render: (row) => `<div>${escapeHtml(row.supplierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.factoryName)}</div>`,
  },
  {
    key: 'change', title: '采购变更', width: 180, sortable: true,
    sortValue: (row) => row.changeStatus,
    render: (row) => changeBadge(row.changeStatus),
  },
  {
    key: 'workOrder', title: '生产单／生成结果', width: 300,
    render: (row) => row.workOrder
      ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(row.workOrder.workOrderId)}">${escapeHtml(row.workOrder.workOrderNo)}</button><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.workOrder.status)}</div>`
      : row.kind === 'failure'
        ? `<div class="space-y-1.5">${renderLaceStatusBadge('自动生成异常', 'red')}<ul class="space-y-1 text-xs text-red-700">${row.failureReasons.map((reason) => `<li>• ${escapeHtml(reason)}</li>`).join('')}</ul><p class="text-xs text-slate-500">PMS 采购人员补齐来源后，系统按同一采购单 ID＋SKU ID 安全重试。</p></div>`
        : '<span class="text-amber-700">等待系统自动生成</span>',
  },
  {
    key: 'actions', title: '操作', width: 180, required: true, actionColumn: true,
    render: (row) => `<div class="flex flex-col items-start gap-1">${row.changeStatus !== '无新变更' ? `<button type="button" class="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100" data-lace-demand-action="view-change" data-purchase-order-id="${escapeHtml(row.purchaseOrderId)}" data-skip-page-rerender="true">查看变更</button>` : ''}${row.workOrder ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(row.workOrder.workOrderId)}">查看生产单</button>` : ''}${row.kind === 'failure' ? `<button type="button" class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-nav="/pms/purchase-order?keyword=${encodeURIComponent(row.purchaseOrderNo)}">前往 PMS 修复</button>` : ''}</div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/fcs/craft/accessory/lace/purchase-demands',
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-lace-demand-table-surface]',
  paginationSurfaceSelector: '[data-lace-demand-pagination-surface]',
  overlaysSurfaceSelector: '[data-lace-demand-column-overlays]',
  defaultFrozenKeys: ['purchase'],
  columnSettingsTitle: '花边采购需求列设置',
  emptyText: '当前条件下暂无花边采购需求',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  const warehouses = [...new Set(allRows().map((row) => row.targetWarehouseName).filter((value): value is string => Boolean(value)))]
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[16rem] flex-1"><span class="mb-1 block text-xs text-slate-500">采购单／SKU／款式／生产单</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="输入关键字" data-lace-demand-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-28"><span class="mb-1 block text-xs text-slate-500">采购状态</span><select class="h-9 w-full rounded-md border bg-slate-50 px-3 text-sm" disabled title="本页仅投影有效采购需求"><option>有效</option></select></label><label class="min-w-36"><span class="mb-1 block text-xs text-slate-500">自动生成结果</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-demand-field="generationResult" data-skip-page-rerender="true"><option value="">全部</option><option value="linked" ${state.generationResult === 'linked' ? 'selected' : ''}>已关联生产单</option><option value="failure" ${state.generationResult === 'failure' ? 'selected' : ''}>自动生成异常</option></select></label><label class="min-w-32"><span class="mb-1 block text-xs text-slate-500">采购变更</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-demand-field="changeStatus" data-skip-page-rerender="true"><option value="">全部</option>${['待查看', '已查看', '无新变更'].map((value) => `<option value="${value}" ${state.changeStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="min-w-32"><span class="mb-1 block text-xs text-slate-500">关联生产状态</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-demand-field="productionStatus" data-skip-page-rerender="true"><option value="">全部</option>${['待接收', '加工中', '已完结', '已取消'].map((value) => `<option value="${value}" ${state.productionStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">目标仓库</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-demand-field="targetWarehouseName" data-skip-page-rerender="true"><option value="">全部</option>${warehouses.map((value) => `<option value="${escapeHtml(value)}" ${state.targetWarehouseName === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label><span class="mb-1 block text-xs text-slate-500">交期从</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.dueDateFrom)}" data-lace-demand-field="dueDateFrom" data-skip-page-rerender="true"></label><label><span class="mb-1 block text-xs text-slate-500">交期至</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.dueDateTo)}" data-lace-demand-field="dueDateTo" data-skip-page-rerender="true"></label><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-lace-demand-action="apply-filters" data-skip-page-rerender="true">查询</button><button type="button" class="h-9 rounded-md border px-4 text-sm hover:bg-slate-50" data-lace-demand-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function renderChangeDrawer(): string {
  if (!state.drawerPurchaseOrderId) return ''
  const purchaseOrder = getAccessoryPurchaseOrder(state.drawerPurchaseOrderId)
  if (!purchaseOrder) return ''
  const change = [...purchaseOrder.changeHistory].sort((left, right) => right.toVersion - left.toVersion)[0]
  if (!change) return ''
  const workOrders = listLaceProductionOrders(currentDemandActor()).filter((order) => order.purchaseOrderId === purchaseOrder.purchaseOrderId)
  return `<div class="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="采购变更详情"><button type="button" class="absolute inset-0 bg-black/40" data-lace-demand-action="close-change" data-skip-page-rerender="true" aria-label="关闭采购变更详情"></button><aside class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl"><header class="flex items-start justify-between border-b p-5"><div><h2 class="text-lg font-semibold">采购单 ${escapeHtml(purchaseOrder.purchaseOrderNo)} 变更详情</h2><p class="mt-1 text-sm text-slate-500">V${change.fromVersion} → V${change.toVersion} · ${escapeHtml(change.changedByName)} · ${formatJakartaTime(change.changedAt)}</p><p class="mt-1 text-xs text-amber-800">已查看仅表示业务人员看过完整对比，不表示审批或接受。</p></div><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-lace-demand-action="close-change" data-skip-page-rerender="true">关闭</button></header><div class="flex-1 space-y-5 overflow-y-auto p-5"><section><h3 class="mb-2 font-semibold">变更前后</h3><div class="overflow-hidden rounded-md border"><table class="w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-3 py-2">字段</th><th class="px-3 py-2">变更前</th><th class="px-3 py-2">变更后</th></tr></thead><tbody>${change.fields.map((field) => `<tr class="border-t"><td class="px-3 py-3 font-medium">${escapeHtml(field.label)}</td><td class="px-3 py-3 text-slate-500">${escapeHtml(field.beforeValue)}</td><td class="px-3 py-3 font-medium text-amber-900">${escapeHtml(field.afterValue)}</td></tr>`).join('')}</tbody></table></div></section><section><h3 class="mb-2 font-semibold">受影响花边生产单</h3><div class="space-y-2">${workOrders.map((order) => `<article class="rounded-md border p-3"><div class="flex items-center justify-between gap-3"><button class="font-medium text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}">${escapeHtml(order.workOrderNo)}</button>${renderLaceStatusBadge(order.status, order.status === '已完结' ? 'green' : order.status === '加工中' ? 'blue' : order.status === '已取消' ? 'red' : 'slate')}</div><div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4"><span>计划 ${formatLaceQty(order.planQty, order.unit)}</span><span>完工 ${formatLaceQty(order.completedQty, order.unit)}</span><span>交出 ${formatLaceQty(order.handedOverQty, order.unit)}</span><span>实收 ${formatLaceQty(order.receivedQty, order.unit)}</span></div></article>`).join('')}</div></section></div></aside></div>`
}

function renderOverlays(): string {
  return `<div data-lace-demand-column-overlays>${controller.renderColumnSettings()}</div>${renderChangeDrawer()}${renderLaceImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const actor = currentDemandActor()
  const pendingCount = countPendingPurchaseChanges(actor)
  const rows = allRows()
  return `${renderStandardListPage({
    title: '花边采购需求',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-3"><span class="text-sm text-slate-500">当前工厂：Renda Jaya 花边厂</span><label class="flex items-center gap-2 text-sm"><span class="text-slate-500">当前查看身份</span><select class="h-9 rounded-md border bg-white px-3" data-lace-demand-field="actorRole" data-skip-page-rerender="true"><option value="operator" ${state.actorRole === 'operator' ? 'selected' : ''}>${escapeHtml(LACE_FACTORY_OPERATOR.actorName)} · 业务员</option><option value="supervisor" ${state.actorRole === 'supervisor' ? 'selected' : ''}>${escapeHtml(LACE_FACTORY_SUPERVISOR.actorName)} · 主管</option><option value="platform" ${state.actorRole === 'platform' ? 'selected' : ''}>${escapeHtml(PLATFORM_ADMIN.actorName)} · 兜底</option></select></label></div>`,
    feedbackHtml: `<div data-lace-demand-feedback>${renderLaceFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '采购需求 SKU', value: `${rows.length} 个` },
      { label: '采购变更待查看', value: `${pendingCount} 单` },
    ]),
    listTitle: `采购需求列表 · 采购变更待查看 ${pendingCount} 单`,
    listActionsHtml: '<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" data-lace-demand-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-lace-demand-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-lace-demand-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-lace-demand-overlays>${renderOverlays()}</div>`,
  })}`
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
  const surface = rootElement()?.querySelector<HTMLElement>('[data-lace-demand-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrateLaceSurface(surface)
}

export function renderLacePurchaseDemandsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  if (typeof window !== 'undefined') {
    const params = new URL(window.location.href).searchParams
    const requestedActor = params.get('actor')
    if (requestedActor === 'operator' || requestedActor === 'supervisor' || requestedActor === 'platform') state.actorRole = requestedActor
    const requestedPurchaseOrderId = params.get('viewChange') === '1' ? params.get('purchaseOrderId') ?? '' : ''
    if (requestedPurchaseOrderId) {
      markPurchaseChangeViewed(requestedPurchaseOrderId, currentDemandActor())
      state.drawerPurchaseOrderId = requestedPurchaseOrderId
      state.feedback = `${currentDemandActor().actorName} 正在查看采购单 ${getAccessoryPurchaseOrder(requestedPurchaseOrderId)?.purchaseOrderNo ?? ''} 的完整变更；仅表示已查看。`
      state.feedbackOk = true
    }
  }
  controller.installColumnDragEvents()
  return `<div data-lace-purchase-demands-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handleLacePurchaseDemandsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-lace-demand-field]')
  if (field) {
    const name = field.dataset.laceDemandField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'changeStatus') state.changeStatus = field.value as PurchaseDemandState['changeStatus']
    if (name === 'productionStatus') state.productionStatus = field.value as PurchaseDemandState['productionStatus']
    if (name === 'dueDateFrom') state.dueDateFrom = field.value
    if (name === 'dueDateTo') state.dueDateTo = field.value
    if (name === 'targetWarehouseName') state.targetWarehouseName = field.value
    if (name === 'generationResult') state.generationResult = field.value as PurchaseDemandState['generationResult']
    if (name === 'actorRole' && event?.type === 'change') {
      state.actorRole = field.value as PurchaseDemandState['actorRole']
      state.drawerPurchaseOrderId = ''
      state.feedback = `已切换为 ${currentDemandActor().actorName}，采购变更待查看按当前用户重新计算。`
      state.feedbackOk = true
      refreshAll()
    }
    if (name === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value))
      controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-lace-demand-action]')
  const action = actionNode?.dataset.laceDemandAction
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
    controller.updateColumnPreference(
      action,
      actionNode.dataset.laceDemandColumnKey || actionNode.closest<HTMLElement>('[data-lace-demand-column-key]')?.dataset.laceDemandColumnKey || '',
      checkbox?.checked,
    )
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
    state.changeStatus = ''
    state.productionStatus = ''
    state.dueDateFrom = ''
    state.dueDateTo = ''
    state.targetWarehouseName = ''
    state.generationResult = ''
    state.currentPage = 1
    controller.refresh()
    return true
  }
  if (action === 'view-change') {
    const purchaseOrderId = actionNode.dataset.purchaseOrderId || ''
    const actor = currentDemandActor()
    markPurchaseChangeViewed(purchaseOrderId, actor)
    state.drawerPurchaseOrderId = purchaseOrderId
    state.feedback = `${actor.actorName} 已查看采购单 ${getAccessoryPurchaseOrder(purchaseOrderId)?.purchaseOrderNo ?? ''} 的当前变更版本`
    state.feedbackOk = true
    refreshAll()
    return true
  }
  if (action === 'close-change') {
    state.drawerPurchaseOrderId = ''
    refreshOverlays()
    return true
  }
  return false
}
