// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../../../components/ui/list-table-model.ts'
import { renderTabs } from '../../../../components/ui/tabs.ts'
import {
  countPendingPurchaseChanges,
  listLaceProductionOrders,
  LACE_FACTORY_OPERATOR,
  LACE_FACTORY_SUPERVISOR,
  PLATFORM_ADMIN,
  startLaceProduction,
  type LaceActor,
  type LaceHandoverStatus,
  type LaceReceiptSummaryStatus,
  type LaceProductionOrderView,
  type LaceProductionStatus,
} from '../../../../data/fcs/lace-factory-domain.ts'
import { escapeHtml } from '../../../../utils.ts'
import {
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  renderLaceBusinessImage,
  renderLaceFeedback,
  renderLaceImagePreview,
  renderLaceSourceStyles,
  renderLaceStatusBadge,
} from './shared.ts'
import {
  listExecutableLaceWorkOrderActions,
  type LaceWorkOrderAction,
  type LaceWorkOrderActionKey,
} from './work-order-action-policy.ts'

type WorkOrderTaskTab = 'all' | 'purchase-change' | LaceProductionStatus

interface WorkOrderListState extends ProcessOrderListControllerState {
  actorRole: 'operator' | 'supervisor' | 'platform'
  taskTab: WorkOrderTaskTab
  keyword: string
  handoverStatus: '' | LaceHandoverStatus
  receiptStatus: '' | LaceReceiptSummaryStatus
  dueDateFrom: string
  dueDateTo: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'lace-work-orders'
const ROOT_SELECTOR = '[data-lace-work-orders-root]'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: WorkOrderListState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  actorRole: 'operator',
  taskTab: 'all',
  keyword: '',
  handoverStatus: '',
  receiptStatus: '',
  dueDateFrom: '',
  dueDateTo: '',
  feedback: '',
  feedbackOk: true,
}

function currentListActor(): LaceActor {
  if (state.actorRole === 'supervisor') return LACE_FACTORY_SUPERVISOR
  if (state.actorRole === 'platform') return PLATFORM_ADMIN
  return LACE_FACTORY_OPERATOR
}

function allRows(): LaceProductionOrderView[] {
  return listLaceProductionOrders(currentListActor())
}

function matchesTaskTab(order: LaceProductionOrderView): boolean {
  if (state.taskTab === 'all') return true
  if (state.taskTab === 'purchase-change') return order.purchaseChangeStatus === '待查看'
  return order.status === state.taskTab
}

function filteredRows(): LaceProductionOrderView[] {
  const keyword = state.keyword.trim().toLowerCase()
  return allRows().filter((order) => {
    if (!matchesTaskTab(order)) return false
    if (state.handoverStatus && order.handoverStatus !== state.handoverStatus) return false
    if (state.receiptStatus && order.receiptStatus !== state.receiptStatus) return false
    if (state.dueDateFrom && order.dueDate < state.dueDateFrom) return false
    if (state.dueDateTo && order.dueDate > state.dueDateTo) return false
    if (!keyword) return true
    return [order.workOrderNo, order.purchaseOrderNo, order.skuCode, order.materialName, ...order.sourceLines.flatMap((line) => [line.styleCode, line.styleName])]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

function productionBadge(status: LaceProductionStatus): string {
  if (status === '加工中') return renderLaceStatusBadge(status, 'blue')
  if (status === '已完结') return renderLaceStatusBadge(status, 'green')
  if (status === '已取消') return renderLaceStatusBadge(status, 'red')
  return renderLaceStatusBadge(status, 'slate')
}

function actionClass(action: LaceWorkOrderAction): string {
  if (action.tone === 'primary') return 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
  if (action.tone === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
  if (action.tone === 'success') return 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
  if (action.tone === 'danger') return 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
  return 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
}

function detailActionHref(order: LaceProductionOrderView, action: LaceWorkOrderActionKey): string {
  const detailPath = `/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}`
  const actorQuery = `actor=${encodeURIComponent(state.actorRole)}`
  if (action === 'view-detail') return `${detailPath}?${actorQuery}`
  if (action === 'view-change') {
    return `/fcs/craft/accessory/lace/purchase-demands?actor=${encodeURIComponent(state.actorRole)}&viewChange=1&purchaseOrderId=${encodeURIComponent(order.purchaseOrderId)}`
  }
  const queryAction: Partial<Record<LaceWorkOrderActionKey, string>> = {
    'report-completion': 'report',
    'complete-production': 'complete',
    handover: 'handover',
    'undo-completion': 'undo-complete',
    'cancel-order': 'cancel',
    'restore-order': 'restore',
  }
  return `${detailPath}?${actorQuery}&action=${encodeURIComponent(queryAction[action] ?? '')}`
}

function renderRowActions(order: LaceProductionOrderView): string {
  const actions = listExecutableLaceWorkOrderActions(order, currentListActor())
  return `<div class="flex min-w-[20rem] flex-wrap gap-1.5" data-lace-work-order-actions="${escapeHtml(order.workOrderId)}">${actions.map((action) => {
    const commonClass = `rounded-md border px-2.5 py-1.5 text-xs font-medium ${actionClass(action)}`
    if (action.key === 'start-production') {
      return `<button type="button" class="${commonClass}" data-lace-work-orders-action="start-production" data-work-order-id="${escapeHtml(order.workOrderId)}" data-skip-page-rerender="true">${escapeHtml(action.label)}</button>`
    }
    return `<button type="button" class="${commonClass}" data-nav="${escapeHtml(detailActionHref(order, action.key))}">${escapeHtml(action.label)}</button>`
  }).join('')}</div>`
}

const columns: StandardListColumn<LaceProductionOrderView>[] = [
  {
    key: 'workOrder', title: '花边生产单', width: 190, required: true, freezeable: true, sortable: true,
    sortValue: (order) => order.workOrderNo,
    render: (order) => `<button type="button" class="font-semibold text-blue-700 hover:underline" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(order.workOrderId)}">${escapeHtml(order.workOrderNo)}</button><div class="mt-1 text-xs text-slate-500">采购单 ${escapeHtml(order.purchaseOrderNo)} · V${order.purchaseVersion}</div>`,
  },
  {
    key: 'input', title: '加工投入', width: 300, required: true,
    render: (order) => order.inputLines.length > 0
      ? `<div class="space-y-2">${order.inputLines.map((line) => `<div class="flex items-center gap-2">${renderLaceBusinessImage(line.imageUrl, `${line.inputMaterialName}（${line.inputMaterialSku}）实物图`, 'h-9 w-9')}<div class="min-w-0"><div class="truncate text-xs font-medium">${escapeHtml(line.inputMaterialName)}</div><div class="text-[11px] text-slate-500">单位用量 ${line.unitUsage} ${escapeHtml(line.unit)}/${escapeHtml(order.unit)} · 计划 ${formatLaceQty(line.plannedQty, line.unit)}</div></div></div>`).join('')}</div>`
      : '<div class="text-xs text-red-700"><strong>默认投入缺失</strong><div class="mt-1">该采购需求不会生成生产单</div></div>',
  },
  {
    key: 'source', title: '需求来源', width: 300, required: true, sortable: true,
    sortValue: (order) => order.demandSource.purchaseOrderNo,
    render: (order) => `<div class="mb-2 text-xs"><strong>采购单 ${escapeHtml(order.demandSource.purchaseOrderNo)} · V${order.demandSource.purchaseVersion}</strong><div class="mt-1 text-slate-500">${escapeHtml(order.demandSource.supplierName)} · ${escapeHtml(order.demandSource.buyerName)}</div></div>${renderLaceSourceStyles(order.demandSource.sourceLines)}`,
  },
  {
    key: 'output', title: '加工产出', width: 260, required: true, sortable: true,
    sortValue: (order) => order.processingOutput.skuCode,
    render: (order) => `<div class="flex items-center gap-3">${renderLaceBusinessImage(order.processingOutput.materialImageUrl, `${order.processingOutput.materialName}（${order.processingOutput.skuCode}）实物图`)}<div><div class="font-medium">${escapeHtml(order.processingOutput.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(order.processingOutput.skuCode)}</div><div class="text-xs">${escapeHtml(order.processingOutput.specification)} · ${escapeHtml(order.processingOutput.color)}</div><div class="mt-1 text-xs text-slate-500">计划 ${formatLaceQty(order.processingOutput.planQty, order.processingOutput.unit)}</div></div></div>`,
  },
  {
    key: 'quantities', title: '计划／完工／交出／实收', width: 260, sortable: true,
    sortValue: (order) => order.planQty,
    render: (order) => `<div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums"><span>计划 <strong>${formatLaceQty(order.planQty, order.unit)}</strong></span><span>完工 <strong>${formatLaceQty(order.completedQty, order.unit)}</strong></span><span>交出 <strong>${formatLaceQty(order.handedOverQty, order.unit)}</strong></span><span>实收 <strong>${formatLaceQty(order.receivedQty, order.unit)}</strong></span></div>`,
  },
  {
    key: 'productionStatus', title: '生产状态', width: 110, sortable: true,
    sortValue: (order) => order.status,
    render: (order) => productionBadge(order.status),
  },
  {
    key: 'handoverStatus', title: '交出履约', width: 120, sortable: true,
    sortValue: (order) => order.handoverStatus,
    render: (order) => renderLaceStatusBadge(order.handoverStatus, order.handoverStatus === '已全部交出' ? 'green' : order.handoverStatus === '部分交出' ? 'yellow' : 'slate'),
  },
  {
    key: 'receiptStatus', title: '中央仓收货', width: 150, sortable: true,
    sortValue: (order) => order.receiptStatus,
    render: (order) => `<div class="space-y-1">${renderLaceStatusBadge(order.receiptStatus, order.receiptStatus === '已收货' ? 'green' : order.receiptStatus === '部分收货' ? 'yellow' : 'slate')}${order.hasReceiptDifference ? `<div>${renderLaceStatusBadge('存在收货差异', 'red')}</div>` : ''}</div>`,
  },
  {
    key: 'purchaseChange', title: '采购变更', width: 180, sortable: true,
    sortValue: (order) => order.purchaseChangeStatus,
    render: (order) => order.purchaseChangeStatus === '待查看'
      ? renderLaceStatusBadge('采购已变更 · 待查看', 'yellow')
      : order.purchaseChangeStatus === '已查看'
        ? renderLaceStatusBadge('采购变更 · 已查看', 'slate')
        : renderLaceStatusBadge('无新变更', 'slate'),
  },
  {
    key: 'due', title: '交期／去向', width: 210, sortable: true,
    sortValue: (order) => order.dueDate,
    render: (order) => `<div class="font-medium">${escapeHtml(order.dueDate)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.targetWarehouseName)}</div>`,
  },
  {
    key: 'actions', title: '操作', width: 360, required: true, actionColumn: true,
    render: renderRowActions,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/fcs/craft/accessory/lace/work-orders',
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-lace-work-orders-table-surface]',
  paginationSurfaceSelector: '[data-lace-work-orders-pagination-surface]',
  overlaysSurfaceSelector: '[data-lace-work-orders-column-overlays]',
  defaultFrozenKeys: ['workOrder'],
  columnSettingsTitle: '花边生产单列设置',
  emptyText: '当前条件下暂无花边生产单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function taskTabCount(tab: WorkOrderTaskTab, rows = allRows()): number {
  if (tab === 'all') return rows.length
  if (tab === 'purchase-change') return rows.filter((order) => order.purchaseChangeStatus === '待查看').length
  return rows.filter((order) => order.status === tab).length
}

function renderTaskTabs(): string {
  const rows = allRows()
  return renderTabs({
    tabs: [
      { key: 'all', label: '全部', count: taskTabCount('all', rows) },
      { key: 'purchase-change', label: '采购变更待查看', count: taskTabCount('purchase-change', rows) },
      { key: '待接收', label: '待接收', count: taskTabCount('待接收', rows) },
      { key: '加工中', label: '加工中', count: taskTabCount('加工中', rows) },
      { key: '已完结', label: '已完结', count: taskTabCount('已完结', rows) },
      { key: '已取消', label: '已取消', count: taskTabCount('已取消', rows) },
    ],
    activeKey: state.taskTab,
    variant: 'underline',
    prefix: EVENT_PREFIX,
    action: 'task-tab',
    className: 'overflow-x-auto',
  })
}

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[16rem] flex-1"><span class="mb-1 block text-xs text-slate-500">生产单／采购单／SKU／款式</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" placeholder="输入关键字" data-lace-work-orders-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-32"><span class="mb-1 block text-xs text-slate-500">交出履约</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-work-orders-field="handoverStatus" data-skip-page-rerender="true"><option value="">全部</option>${['未交出', '部分交出', '已全部交出'].map((value) => `<option value="${value}" ${state.handoverStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="min-w-32"><span class="mb-1 block text-xs text-slate-500">中央仓收货</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-lace-work-orders-field="receiptStatus" data-skip-page-rerender="true"><option value="">全部</option>${['未收货', '部分收货', '已收货'].map((value) => `<option value="${value}" ${state.receiptStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label><span class="mb-1 block text-xs text-slate-500">交期从</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.dueDateFrom)}" data-lace-work-orders-field="dueDateFrom" data-skip-page-rerender="true"></label><label><span class="mb-1 block text-xs text-slate-500">交期至</span><input type="date" class="h-9 rounded-md border px-2 text-sm" value="${escapeHtml(state.dueDateTo)}" data-lace-work-orders-field="dueDateTo" data-skip-page-rerender="true"></label><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-lace-work-orders-action="apply-filters" data-skip-page-rerender="true">查询</button><button type="button" class="h-9 rounded-md border px-4 text-sm" data-lace-work-orders-action="reset-filters" data-skip-page-rerender="true">重置次级筛选</button></div>`
}

function renderStats(): string {
  const rows = allRows()
  const pendingWorkOrders = rows.filter((order) => order.purchaseChangeStatus === '待查看').length
  return renderStandardListStats([
    { label: '待接收', value: `${rows.filter((order) => order.status === '待接收').length} 单` },
    { label: '加工中', value: `${rows.filter((order) => order.status === '加工中').length} 单` },
    { label: '已完结', value: `${rows.filter((order) => order.status === '已完结').length} 单` },
    { label: '采购变更待查看', value: `${countPendingPurchaseChanges(currentListActor())} 个采购单／${pendingWorkOrders} 张生产单` },
  ])
}

function currentListSummary(): string {
  const labels: Record<WorkOrderTaskTab, string> = {
    all: '全部',
    'purchase-change': '采购变更待查看',
    待接收: '待接收',
    加工中: '加工中',
    已完结: '已完结',
    已取消: '已取消',
  }
  return `${labels[state.taskTab]} · 当前筛选 ${filteredRows().length} 张`
}

function renderOverlays(): string {
  return `<div data-lace-work-orders-column-overlays>${controller.renderColumnSettings()}</div>${renderLaceImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
    title: '花边生产单',
    primaryActionsHtml: `<div class="flex flex-wrap items-center gap-3"><span class="text-sm text-slate-500">一个采购单 SKU 只对应一张生产单</span><label class="flex items-center gap-2 text-sm"><span class="text-slate-500">当前操作身份</span><select class="h-9 rounded-md border bg-white px-3" data-lace-work-orders-field="actorRole" data-skip-page-rerender="true"><option value="operator" ${state.actorRole === 'operator' ? 'selected' : ''}>${escapeHtml(LACE_FACTORY_OPERATOR.actorName)} · 业务员</option><option value="supervisor" ${state.actorRole === 'supervisor' ? 'selected' : ''}>${escapeHtml(LACE_FACTORY_SUPERVISOR.actorName)} · 主管</option><option value="platform" ${state.actorRole === 'platform' ? 'selected' : ''}>${escapeHtml(PLATFORM_ADMIN.actorName)} · 兜底</option></select></label></div>`,
    feedbackHtml: `<div data-lace-work-orders-feedback>${renderLaceFeedback(state.feedback, state.feedbackOk)}</div>`,
    filtersHtml: `<div class="space-y-3"><div data-lace-work-orders-tabs-surface>${renderTaskTabs()}</div><div data-lace-work-orders-secondary-filters>${renderFilters()}</div></div>`,
    statsHtml: `<div data-lace-work-orders-stats-surface>${renderStats()}</div>`,
    listTitle: '花边生产单列表',
    listActionsHtml: `<div class="flex flex-wrap items-center gap-3"><span class="text-sm text-slate-500" data-lace-work-orders-list-summary>${escapeHtml(currentListSummary())}</span><button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" data-lace-work-orders-action="open-column-settings" data-skip-page-rerender="true">列设置</button></div>`,
    tableHtml: `<div data-lace-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-lace-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-lace-work-orders-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function refreshListChrome(): void {
  const root = rootElement()
  if (!root) return
  const tabs = root.querySelector<HTMLElement>('[data-lace-work-orders-tabs-surface]')
  const filters = root.querySelector<HTMLElement>('[data-lace-work-orders-secondary-filters]')
  const stats = root.querySelector<HTMLElement>('[data-lace-work-orders-stats-surface]')
  const summary = root.querySelector<HTMLElement>('[data-lace-work-orders-list-summary]')
  const feedback = root.querySelector<HTMLElement>('[data-lace-work-orders-feedback]')
  if (tabs) tabs.innerHTML = renderTaskTabs()
  if (filters) filters.innerHTML = renderFilters()
  if (stats) stats.innerHTML = renderStats()
  if (summary) summary.textContent = currentListSummary()
  if (feedback) feedback.innerHTML = renderLaceFeedback(state.feedback, state.feedbackOk)
  hydrateLaceSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-lace-work-orders-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrateLaceSurface(surface)
}

export function renderLaceWorkOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-lace-work-orders-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handleLaceWorkOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-lace-work-orders-field]')
  if (field) {
    const name = field.dataset.laceWorkOrdersField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'handoverStatus') state.handoverStatus = field.value as WorkOrderListState['handoverStatus']
    if (name === 'receiptStatus') state.receiptStatus = field.value as WorkOrderListState['receiptStatus']
    if (name === 'dueDateFrom') state.dueDateFrom = field.value
    if (name === 'dueDateTo') state.dueDateTo = field.value
    if (name === 'actorRole' && event?.type === 'change') {
      state.actorRole = field.value as WorkOrderListState['actorRole']
      state.currentPage = 1
      state.feedback = `已切换为 ${currentListActor().actorName}；统计、可见生产单、动作和命令均按当前身份重新计算。`
      state.feedbackOk = true
      controller.refresh()
      refreshListChrome()
      return true
    }
    if (name === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value))
      controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-lace-work-orders-action]')
  const action = actionNode?.dataset.laceWorkOrdersAction
  if (!actionNode || !action) return false
  if (action.startsWith('task-tab:')) {
    state.taskTab = action.slice('task-tab:'.length) as WorkOrderTaskTab
    state.currentPage = 1
    controller.refresh()
    refreshListChrome()
    return true
  }
  if (action === 'start-production') {
    const workOrderId = actionNode.dataset.workOrderId || ''
    try {
      const nextOrder = startLaceProduction(workOrderId, currentListActor())
      state.feedback = `${nextOrder.workOrderNo} 已确认接收并进入“加工中”；操作日志已记录当前身份。`
      state.feedbackOk = true
    } catch (error) {
      state.feedback = `未保存：${error instanceof Error ? error.message : String(error)}。请刷新状态后重试。`
      state.feedbackOk = false
    }
    controller.refresh()
    refreshListChrome()
    return true
  }
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
    controller.updateColumnPreference(action, actionNode.dataset.laceWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-lace-work-orders-column-key]')?.dataset.laceWorkOrdersColumnKey || '', checkbox?.checked)
  }
  if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) {
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'apply-filters') {
    state.currentPage = 1
    controller.refresh()
    refreshListChrome()
    return true
  }
  if (action === 'reset-filters') {
    state.keyword = ''
    state.handoverStatus = ''
    state.receiptStatus = ''
    state.dueDateFrom = ''
    state.dueDateTo = ''
    state.currentPage = 1
    controller.refresh()
    refreshListChrome()
    return true
  }
  return false
}
