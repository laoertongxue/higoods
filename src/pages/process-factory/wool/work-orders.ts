// @page-pattern: list

import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  resetStandardListEntryTransientStateOnRouteEntry,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { createProcessOrderListController } from '../../../components/ui/process-order-list-controller.ts'
import { renderTabs } from '../../../components/ui/tabs.ts'
import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  changeWoolFactQty,
  completeWoolWorkOrder,
  getWoolAllowedActions,
  getWoolOutputHandedOverQty,
  getWoolOutputHandoverAvailableQty,
  getWoolOutputReadiness,
  getWoolOutputReportedQty,
  getWoolOutputStockQty,
  getWoolProcessingStatus,
  getWoolWorkOrderBlockReason,
  getWoolWorkOrderTab,
  getWoolWorkOrderTabCounts,
  listWoolFactRecords,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  type WoolHandoverRecord,
  type WoolProcessReportRecord,
  type WoolQtyChangeLog,
  type WoolQtyChangeRecordType,
  type WoolWorkOrder,
  type WoolWorkOrderFilters,
  type WoolWorkOrderTab,
  type WoolYarnReceiptRecord,
} from '../../../data/fcs/wool-task-domain.ts'
import {
  buildWoolMachineAssociationsLink,
  buildWoolWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { escapeHtml } from '../../../utils.ts'
import { formatNumber, formatQty, renderKindBadge, renderStatusBadge } from './shared.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const EVENT_PREFIX = 'wool-work-orders'
const PREFERENCE_KEY = '/fcs/craft/wool/work-orders:list-columns'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface WoolListFilters {
  keyword: string
  productionOrderNo: string
  woolOrderNo: string
  kind: '' | WoolWorkOrder['kind']
  factory: string
  processingStatus: '' | 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
  yarnSku: string
  plannedFrom: string
  plannedTo: string
}

type BusinessOverlay =
  | { kind: 'receipt'; woolOrderId: string }
  | { kind: 'report'; woolOrderId: string }
  | { kind: 'handover'; woolOrderId: string }
  | { kind: 'complete'; woolOrderId: string }
  | { kind: 'qty-list'; woolOrderId: string }
  | {
      kind: 'qty-edit'
      woolOrderId: string
      recordType: WoolQtyChangeRecordType
      recordId: string
      recordLineId?: string
      currentQty: number
      unit: string
      objectSkuCode: string
    }

interface WoolListRow {
  order: WoolWorkOrder
  styleNo: string
  styleName: string
  internalStyleCode: string
  factoryName: string
  plannedCompletionAt: string
  tab: WoolWorkOrderTab
}

const DEFAULT_FILTERS: WoolListFilters = {
  keyword: '',
  productionOrderNo: '',
  woolOrderNo: '',
  kind: '',
  factory: '',
  processingStatus: '',
  yarnSku: '',
  plannedFrom: '',
  plannedTo: '',
}

const state: {
  filters: WoolListFilters
  activeTab: WoolWorkOrderTab
  currentPage: number
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlay: BusinessOverlay | null
  overlayError: string
  feedback: string
} = {
  filters: { ...DEFAULT_FILTERS },
  activeTab: 'READY',
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['order'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  overlay: null,
  overlayError: '',
  feedback: '',
}

let filterDebounce: ReturnType<typeof setTimeout> | undefined
let commandSequence = 0

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function nextCommandId(action: string, woolOrderId: string): string {
  commandSequence += 1
  return `WEB-${action}-${woolOrderId}-${Date.now()}-${commandSequence}`
}

function resolveRow(order: WoolWorkOrder): WoolListRow {
  return {
    order,
    styleNo: order.styleNo,
    styleName: order.styleName,
    internalStyleCode: order.internalStyleCode || '',
    factoryName: order.factoryName,
    plannedCompletionAt: order.plannedCompletionAt,
    tab: getWoolWorkOrderTab(order.woolOrderId),
  }
}

function includes(value: string, keyword: string): boolean {
  return !keyword.trim() || value.toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase())
}

export function filterWoolWorkOrderRowsByKeyword(
  orders: WoolWorkOrder[],
  keyword: string,
): WoolListRow[] {
  return orders
    .map(resolveRow)
    .filter((row) => includes([
      row.order.woolOrderNo,
      row.order.taskNo,
      row.order.productionOrderNo,
      row.styleNo,
      row.styleName,
      row.internalStyleCode,
      row.factoryName,
    ].join(' '), keyword))
}

function currentDomainFilters(): WoolWorkOrderFilters {
  return {
    productionOrderNo: state.filters.productionOrderNo,
    woolOrderNo: state.filters.woolOrderNo,
    ...(state.filters.kind ? { kind: state.filters.kind } : {}),
  }
}

function baseRows(): WoolListRow[] {
  const domainFilters = currentDomainFilters()
  // 先由领域过滤加工单身份，再补页面展示元数据筛选；Tab 数量随后基于同一结果计算。
  return filterWoolWorkOrderRowsByKeyword(listWoolWorkOrders(domainFilters), state.filters.keyword)
    .filter((row) => includes(row.factoryName, state.filters.factory))
    .filter((row) => !state.filters.processingStatus || getWoolProcessingStatus(row.order.woolOrderId) === state.filters.processingStatus)
    .filter((row) => !state.filters.yarnSku || row.order.outputPlanLines.some((line) =>
      line.requiredYarnSkus.some((sku) => includes(sku, state.filters.yarnSku)),
    ))
    .filter((row) => state.filters.plannedFrom === '' || row.plannedCompletionAt >= state.filters.plannedFrom)
    .filter((row) => state.filters.plannedTo === '' || row.plannedCompletionAt <= state.filters.plannedTo)
}

function rowsForActiveTab(): WoolListRow[] {
  return baseRows().filter((row) => row.tab === state.activeTab)
}

function tabCounts(rows = baseRows()): Record<WoolWorkOrderTab, number> {
  const hasPageOnlyFilter = Boolean(
    state.filters.keyword
    || state.filters.factory
    || state.filters.processingStatus
    || state.filters.yarnSku
    || state.filters.plannedFrom
    || state.filters.plannedTo,
  )
  if (!hasPageOnlyFilter) return getWoolWorkOrderTabCounts(currentDomainFilters())
  return rows.reduce<Record<WoolWorkOrderTab, number>>((counts, row) => {
    counts[row.tab] += 1
    return counts
  }, { READY: 0, NOT_READY: 0, COMPLETED: 0 })
}

function requiredYarnSummary(order: WoolWorkOrder): string {
  const requirements = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  const confirmed = new Set(order.outputPlanLines.flatMap((line) =>
    getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode).confirmedYarnSkus,
  ))
  if (requirements.length === 0) return '技术包缺少必需纱线关系'
  return `${confirmed.size}/${requirements.length} 种已确认：${requirements
    .map((sku) => `${sku}${confirmed.has(sku) ? ' ✓' : '（未接收）'}`)
    .join('、')}`
}

function reportableSummary(order: WoolWorkOrder): string {
  const readiness = order.outputPlanLines.map((line) => getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode))
  const available = readiness.filter((item) => item.canReport)
  if (available.length > 0) {
    return `${available.length}/${readiness.length} 个可填报；${available
      .map((item) => `${item.outputSkuCode} 还可 ${item.remainingReportQty}`)
      .join('、')}`
  }
  return getWoolWorkOrderBlockReason(order.woolOrderId)
}

function renderActionButton(label: string, action: string, order: WoolWorkOrder, tone = ''): string {
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted ${tone}" data-wool-work-orders-action="${escapeHtml(action)}" data-wool-order-id="${escapeHtml(order.woolOrderId)}" data-skip-page-rerender="true">${escapeHtml(label)}</button>`
}

function renderActions(row: WoolListRow): string {
  const { order } = row
  const actions = getWoolAllowedActions(order.woolOrderId)
  const factCount = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: ['YARN_RECEIPT', 'PROCESS_REPORT', 'HANDOVER'],
  }).length
  return `<div class="flex max-w-[360px] flex-wrap justify-end gap-1.5">
    <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId))}">查看详情</button>
    ${actions.includes('RECEIVE_YARN') ? renderActionButton('确认接收', 'open-receipt', order) : ''}
    ${actions.includes('REPORT_PROCESS') ? renderActionButton('加工填报', 'open-report', order, 'border-blue-200 text-blue-700') : ''}
    ${actions.includes('HANDOVER') ? renderActionButton('发起交出', 'open-handover', order, 'border-emerald-200 text-emerald-700') : ''}
    ${actions.includes('ASSOCIATE_MACHINE') ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolMachineAssociationsLink(order.woolOrderId))}">关联横机设备</button>` : ''}
    ${factCount > 0 && row.tab !== 'COMPLETED' ? renderActionButton('修改记录数量', 'open-qty-list', order) : ''}
    ${actions.includes('COMPLETE') ? renderActionButton('完成加工单', 'open-complete', order, 'border-amber-200 text-amber-700') : ''}
  </div>`
}

const columns: StandardListColumn<WoolListRow>[] = [
  {
    key: 'order', title: '毛织加工单号', width: 185, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.order.woolOrderNo,
    render: (row) => `<div><div class="font-mono text-xs font-medium text-blue-700">${escapeHtml(row.order.woolOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.order.taskNo)}</div></div>`,
  },
  {
    key: 'productionOrder', title: '生产单号', width: 155, sortable: true,
    sortValue: (row) => row.order.productionOrderNo,
    render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.order.productionOrderNo)}</span>`,
  },
  {
    key: 'style', title: '款式 / 内部货号', width: 210, required: true, freezeable: true, sortable: true,
    sortValue: (row) => `${row.styleNo} ${row.internalStyleCode}`,
    render: (row) => `<div><div class="font-medium">${escapeHtml(row.styleName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleNo)}${row.internalStyleCode ? ` / 内部货号：${escapeHtml(row.internalStyleCode)}` : ''}</div></div>`,
  },
  { key: 'kind', title: '类型', width: 110, sortable: true, sortValue: (row) => row.order.kind, render: (row) => renderKindBadge(row.order.kind) },
  {
    key: 'outputCount', title: '加工后 SKU 数', width: 125, sortable: true, align: 'right',
    sortValue: (row) => row.order.outputPlanLines.length,
    render: (row) => `${row.order.outputPlanLines.length} 个`,
  },
  {
    key: 'plan', title: '计划数量摘要', width: 200,
    render: (row) => row.order.outputPlanLines.map((line) => `${escapeHtml(line.outputSkuCode)}：${formatQty(line.plannedQty, line.qtyUnit)}`).join('<br>'),
  },
  {
    key: 'yarn', title: '纱线接收摘要', width: 300, required: true,
    render: (row) => `<span class="text-xs">${escapeHtml(requiredYarnSummary(row.order))}</span>`,
  },
  {
    key: 'reportable', title: '可填报 SKU 摘要', width: 300, required: true,
    render: (row) => `<span class="text-xs">${escapeHtml(reportableSummary(row.order))}</span>`,
  },
  {
    key: 'facts', title: '累计加工 / 累计交出', width: 210,
    render: (row) => row.order.outputPlanLines.map((line) =>
      `<div class="text-xs">${escapeHtml(line.outputSkuCode)}：${formatNumber(getWoolOutputReportedQty(row.order.woolOrderId, line.outputSkuCode))} / ${formatNumber(getWoolOutputHandedOverQty(row.order.woolOrderId, line.outputSkuCode))} ${escapeHtml(line.qtyUnit)}</div>`,
    ).join(''),
  },
  {
    key: 'machines', title: '当前关联横机', width: 150,
    render: (row) => {
      const machineIds = listWoolMachineAssociations(row.order.woolOrderId).map((item) => item.machineId)
      return escapeHtml(machineIds.length > 0 ? machineIds.join('、') : '未关联')
    },
  },
  {
    key: 'status', title: '加工状态', width: 110, sortable: true,
    sortValue: (row) => getWoolProcessingStatus(row.order.woolOrderId),
    render: (row) => renderStatusBadge(getWoolProcessingStatus(row.order.woolOrderId)),
  },
  {
    key: 'plannedCompletion', title: '计划完成时间', width: 145, sortable: true,
    sortValue: (row) => row.plannedCompletionAt,
    render: (row) => escapeHtml(row.plannedCompletionAt),
  },
  { key: 'actions', title: '操作', width: 380, required: true, actionColumn: true, render: renderActions },
]

const listController = createProcessOrderListController({
  state,
  columns,
  preferenceKey: PREFERENCE_KEY,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-wool-work-orders-root]',
  tableSurfaceSelector: '[data-wool-work-orders-table-surface]',
  paginationSurfaceSelector: '[data-wool-work-orders-pagination-surface]',
  overlaysSurfaceSelector: '[data-wool-work-orders-column-overlays]',
  defaultFrozenKeys: ['order'],
  columnSettingsTitle: '毛织加工单列设置',
  emptyText: '当前条件下暂无毛织加工单',
  getRows: rowsForActiveTab,
  locallyManagedEvents: true,
})

function filterInput(label: string, field: keyof WoolListFilters, placeholder: string, type = 'text'): string {
  return `<label class="min-w-[10rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input type="${type}" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.filters[field])}" placeholder="${escapeHtml(placeholder)}" data-wool-work-orders-field="${escapeHtml(field)}" data-skip-page-rerender="true"></label>`
}

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
    ${filterInput('加工单号 / 任务号 / 款号 / 款名 / 内部货号', 'keyword', '输入关键字')}
    ${filterInput('生产单号', 'productionOrderNo', '输入生产单号')}
    ${filterInput('毛织加工单号', 'woolOrderNo', '输入毛织加工单号')}
    ${filterInput('承接工厂', 'factory', '输入工厂名称')}
    ${filterInput('必需纱线 SKU', 'yarnSku', '输入纱线 SKU')}
    ${filterInput('计划日期从', 'plannedFrom', '', 'date')}
    ${filterInput('计划日期至', 'plannedTo', '', 'date')}
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-work-orders-field="kind" data-skip-page-rerender="true"><option value="">全部类型</option><option value="WHOLE_GARMENT" ${state.filters.kind === 'WHOLE_GARMENT' ? 'selected' : ''}>整件毛织</option><option value="PART_PANEL" ${state.filters.kind === 'PART_PANEL' ? 'selected' : ''}>部位毛织</option></select></label>
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">加工状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-work-orders-field="processingStatus" data-skip-page-rerender="true"><option value="">全部状态</option><option value="UNPROCESSED" ${state.filters.processingStatus === 'UNPROCESSED' ? 'selected' : ''}>未加工</option><option value="PROCESSING" ${state.filters.processingStatus === 'PROCESSING' ? 'selected' : ''}>加工中</option><option value="COMPLETED" ${state.filters.processingStatus === 'COMPLETED' ? 'selected' : ''}>已完成</option></select></label>
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filters' }, 'rotate-ccw')}
  </div>`
}

function renderTabBar(): string {
  const counts = tabCounts()
  return renderTabs({
    tabs: [
      { key: 'READY', label: '可以开工', count: counts.READY },
      { key: 'NOT_READY', label: '不可以开工', count: counts.NOT_READY },
      { key: 'COMPLETED', label: '已完成', count: counts.COMPLETED },
    ],
    activeKey: state.activeTab,
    variant: 'underline',
    prefix: EVENT_PREFIX,
    action: 'tab',
  })
}

function renderFeedback(): string {
  return state.feedback
    ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">${escapeHtml(state.feedback)}</div>`
    : ''
}

function renderWorkspace(): string {
  listController.ensurePreferencesLoaded()
  const view = listController.getView()
  return renderStandardListPage({
    title: '毛织加工单',
    primaryActionsHtml: '',
    feedbackHtml: `<div data-wool-work-orders-feedback>${renderFeedback()}</div>`,
    filtersHtml: `<div data-wool-work-orders-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-wool-work-orders-tabs>${renderTabBar()}</div>`,
    listTitle: '毛织加工单',
    listActionsHtml: renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: `<div data-wool-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wool-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-work-orders-column-overlays>${listController.renderColumnSettings()}</div><div data-wool-work-orders-business-overlay>${renderBusinessOverlay()}</div>`,
  })
}

export function renderCraftWoolWorkOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  listController.installColumnDragEvents()
  return `<div data-wool-work-orders-root data-wool-work-orders-results data-skip-page-rerender="true">${renderWorkspace()}</div>`
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-wool-work-orders-root]')
}

function hydrateSurface(surface: HTMLElement | null | undefined): void {
  if (!surface) return
  void import('../../../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(surface))
    .catch(() => undefined)
}

function refreshResults(): void {
  const root = rootElement()
  if (!root) return
  const rows = rowsForActiveTab()
  if (state.currentPage > Math.max(1, Math.ceil(rows.length / state.preferences.pageSize))) state.currentPage = 1
  const view = listController.getView(rows)
  const table = root.querySelector<HTMLElement>('[data-wool-work-orders-table-surface]')
  const pagination = root.querySelector<HTMLElement>('[data-wool-work-orders-pagination-surface]')
  const tabs = root.querySelector<HTMLElement>('[data-wool-work-orders-tabs]')
  const feedback = root.querySelector<HTMLElement>('[data-wool-work-orders-feedback]')
  const oldScroll = table?.querySelector<HTMLElement>('[data-standard-list-scroll]')?.scrollLeft ?? 0
  if (table) table.innerHTML = view.tableHtml
  if (pagination) pagination.innerHTML = view.paginationHtml
  if (tabs) tabs.innerHTML = renderTabBar()
  if (feedback) feedback.innerHTML = renderFeedback()
  const nextScroll = table?.querySelector<HTMLElement>('[data-standard-list-scroll]')
  if (nextScroll) nextScroll.scrollLeft = oldScroll
  hydrateSurface(table)
  hydrateSurface(pagination)
  hydrateSurface(tabs)
  hydrateSurface(feedback)
}

function refreshColumnOverlay(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-work-orders-column-overlays]')
  if (surface) {
    surface.innerHTML = listController.renderColumnSettings()
    hydrateSurface(surface)
  }
}

function refreshBusinessOverlay(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wool-work-orders-business-overlay]')
  if (surface) {
    surface.innerHTML = renderBusinessOverlay()
    hydrateSurface(surface)
  }
}

function requireOverlayOrder(): WoolWorkOrder | undefined {
  if (!state.overlay) return undefined
  return listWoolWorkOrders().find((item) => item.woolOrderId === state.overlay?.woolOrderId)
}

function dialog(title: string, body: string, footer: string): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-wool-business-dialog><section class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><h2 class="font-semibold">${escapeHtml(title)}</h2><button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-work-orders-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[68vh] overflow-y-auto p-4"><div data-wool-overlay-error>${renderOverlayError()}</div>${body}</div><footer class="flex justify-end gap-2 border-t px-4 py-3">${footer}</footer></section></div>`
}

function dialogFooter(saveAction: string, saveLabel: string): string {
  return `${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' })}${renderPrimaryButton(saveLabel, { prefix: EVENT_PREFIX, action: saveAction })}`
}

function renderOverlayError(): string {
  return state.overlayError
    ? `<div class="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>`
    : ''
}

function renderOrderContext(order: WoolWorkOrder): string {
  return `<section class="mb-4 rounded-md border bg-muted/20 p-3 text-xs">
    <div class="font-medium text-foreground">${escapeHtml(order.woolOrderNo)}｜${escapeHtml(order.productionOrderNo)}</div>
    <div class="mt-1 text-muted-foreground">款式：${escapeHtml(order.styleNo)} ${escapeHtml(order.styleName)}${order.internalStyleCode ? `｜内部货号：${escapeHtml(order.internalStyleCode)}` : ''}｜承接工厂：${escapeHtml(order.factoryName)}</div>
  </section>`
}

function renderHistorySummary(order: WoolWorkOrder): string {
  const receipts = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'YARN_RECEIPT' }).length
  const reports = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'PROCESS_REPORT' }).length
  const handovers = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'HANDOVER' }).length
  return `<section class="mt-4 rounded-md border p-3 text-xs"><div class="font-medium">历史摘要</div><div class="mt-1 text-muted-foreground">已确认接收 ${receipts} 次｜加工填报 ${reports} 次｜发起交出 ${handovers} 次</div></section>`
}

function proofAndRemarkFields(): string {
  return `<div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">凭证</span><textarea class="min-h-20 w-full rounded-md border p-3" placeholder="每行填写一个凭证文件名或链接" data-wool-dialog-field="proofFiles"></textarea></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wool-dialog-field="factRemark"></textarea></label></div>`
}

export function renderWoolReceiptDialog(order: WoolWorkOrder): string {
  const yarns = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))]
  const receiptRecords = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: 'YARN_RECEIPT',
  }).map((item) => item.record as WoolYarnReceiptRecord)
  return dialog('确认接收纱线', `
    ${renderOrderContext(order)}
    <div class="grid gap-3 md:grid-cols-3"><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">送货单号</span><input class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="deliveryNo"></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">批次号</span><input class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="batchNo"></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">接收人</span><input class="h-9 w-full rounded-md border px-3" value="Web 端毛织仓管" data-wool-dialog-field="operator"></label></div>
    <div class="mt-4 overflow-hidden rounded-md border"><div class="grid grid-cols-[40px_1.4fr_140px_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium"><span>选择</span><span>本单必需纱线 SKU / 接收事实</span><span>实收数量（kg）</span><span>差异说明</span></div>${yarns.map((sku) => {
      const matched = receiptRecords
        .flatMap((record) => record.lines
          .filter((line) => line.yarnSkuCode === sku)
          .map((line) => ({ record, line, qty: effectiveReceiptQty(record, line.lineId) })))
        .filter((item) => item.qty > 0)
      const receivedQty = matched.reduce((sum, item) => sum + item.qty, 0)
      const batches = [...new Set(matched.map((item) => item.record.batchNo).filter(Boolean))]
      const latestAt = matched.map((item) => item.record.receivedAt).sort().at(-1) || '—'
      return `<label class="grid grid-cols-[40px_1.4fr_140px_1fr] items-center gap-3 border-b px-3 py-2 last:border-b-0"><input type="checkbox" data-wool-receipt-yarn="${escapeHtml(sku)}"><span><span class="font-medium">${escapeHtml(sku)}</span><span class="mt-1 block text-xs text-muted-foreground">累计有效接收 ${formatQty(receivedQty, 'kg')}｜批次 ${escapeHtml(batches.join('、') || '—')}｜最近接收时间 ${escapeHtml(latestAt)}</span></span><input type="number" min="0.01" step="0.01" class="h-9 rounded-md border px-3" data-wool-receipt-qty="${escapeHtml(sku)}"><input class="h-9 rounded-md border px-3" placeholder="选填" data-wool-receipt-difference="${escapeHtml(sku)}"></label>`
    }).join('') || '<div class="p-4 text-sm text-red-700">技术包未配置本单必需纱线，不能确认接收。</div>'}</div>
    ${proofAndRemarkFields()}
    ${renderHistorySummary(order)}
  `, yarns.length > 0 ? dialogFooter('save-receipt', '保存确认接收') : renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

export function renderWoolReportDialog(order: WoolWorkOrder): string {
  const readiness = order.outputPlanLines.map((line) => ({ line, readiness: getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode) }))
  const available = readiness.filter((item) => item.readiness.canReport)
  const unavailable = readiness.filter((item) => !item.readiness.canReport)
  return dialog('加工填报', `
    ${renderOrderContext(order)}
    <label class="block text-sm"><span class="mb-1 block text-xs text-muted-foreground">可填报加工后 SKU</span><select class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="outputSkuCode">${available.map(({ line, readiness: item }) => `<option value="${escapeHtml(line.outputSkuCode)}">${escapeHtml(line.outputSkuCode)}｜计划 ${line.plannedQty}${line.qtyUnit}｜上限 ${item.reportLimitQty}${line.qtyUnit}｜累计有效加工填报 ${item.reportedQty}${line.qtyUnit}｜本次最多 ${item.remainingReportQty}${line.qtyUnit}</option>`).join('')}</select></label>
    <div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">本次填报数量</span><input type="number" min="1" step="1" class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="qty"></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">填报人</span><input class="h-9 w-full rounded-md border px-3" value="Web 端毛织主管" data-wool-dialog-field="operator"></label></div>
    <section class="mt-4 rounded-md border"><h3 class="border-b px-3 py-2 text-sm font-medium">暂不可填报</h3><div class="space-y-2 p-3 text-xs">${unavailable.map(({ line, readiness: item }) => `<div><span class="font-medium">${escapeHtml(line.outputSkuCode)}</span>：累计有效加工填报 ${item.reportedQty}${line.qtyUnit}；${escapeHtml(item.missingYarnSkus.length ? `缺少 ${item.missingYarnSkus.join('、')}` : item.remainingReportQty === 0 ? '已达到计划数量的 150%' : '技术包缺少必需纱线关系')}</div>`).join('') || '<div class="text-muted-foreground">无</div>'}</div></section>
    ${proofAndRemarkFields()}
    ${renderHistorySummary(order)}
  `, available.length > 0 ? dialogFooter('save-report', '保存加工填报') : renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

export function renderWoolHandoverDialog(order: WoolWorkOrder): string {
  const available = order.outputPlanLines
    .map((line) => ({
      line,
      stock: getWoolOutputStockQty(order.woolOrderId, line.outputSkuCode),
      reported: getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode),
      handedOver: getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode),
      availableQty: getWoolOutputHandoverAvailableQty(order.woolOrderId, line.outputSkuCode),
    }))
    .filter((item) => item.availableQty > 0)
  const targetReady = Boolean(order.downstreamTarget.receiverId && order.downstreamTarget.receiverName)
  return dialog('发起交出', `
    ${renderOrderContext(order)}
    <label class="block text-sm"><span class="mb-1 block text-xs text-muted-foreground">当前有可交出余额的加工后 SKU</span><select class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="outputSkuCode">${available.map(({ line, stock, reported, handedOver, availableQty }) => `<option value="${escapeHtml(line.outputSkuCode)}">${escapeHtml(line.outputSkuCode)}｜累计有效加工填报 ${reported}${line.qtyUnit}｜累计有效交出 ${handedOver}${line.qtyUnit}｜默认库位库存 ${stock}${line.qtyUnit}｜可交出余额 ${availableQty}${line.qtyUnit}</option>`).join('')}</select></label>
    <div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">本次交出数量</span><input type="number" min="1" step="1" class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="qty"></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">交出人</span><input class="h-9 w-full rounded-md border px-3" value="Web 端毛织仓管" data-wool-dialog-field="operator"></label></div>
    <div class="mt-4 rounded-md border p-3 text-sm"><span class="text-muted-foreground">接收对象：</span><strong>${escapeHtml(targetReady ? order.downstreamTarget.receiverName : '交出去向未配置')}</strong><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.downstreamTarget.receiverId || '请先完善加工单的稳定接收方标识，不能自由填写接收对象。')}</div></div>
    ${proofAndRemarkFields()}
    ${renderHistorySummary(order)}
  `, available.length > 0 && targetReady ? dialogFooter('save-handover', '保存发起交出') : renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

function renderCompleteDialog(order: WoolWorkOrder): string {
  const receiptFacts = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'YARN_RECEIPT' })
  const reportFacts = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'PROCESS_REPORT' })
  const handoverFacts = listWoolFactRecords({ woolOrderId: order.woolOrderId, recordType: 'HANDOVER' })
  const yarnSummary = [...new Set(order.outputPlanLines.flatMap((line) => line.requiredYarnSkus))].map((sku) => {
    const matchedReceipts = receiptFacts
      .map((item) => item.record as WoolYarnReceiptRecord)
      .filter((record) => record.lines.some((line) => line.yarnSkuCode === sku))
    const received = matchedReceipts.reduce((sum, record) => {
      return sum + record.lines
        .filter((line) => line.yarnSkuCode === sku)
        .reduce((lineSum, line) => lineSum + effectiveReceiptQty(record, line.lineId), 0)
    }, 0)
    const batches = [...new Set(matchedReceipts.map((record) => record.batchNo).filter(Boolean))]
    const latest = matchedReceipts.map((record) => record.receivedAt).sort().at(-1) || '—'
    return `${sku}：${received > 0 ? '已确认' : '未接收'}，累计 ${formatNumber(received)} kg，批次 ${batches.join('、') || '—'}，最近 ${latest}`
  })
  const readinessSummary = order.outputPlanLines.map((line) => {
    const readiness = getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode)
    return `${line.outputSkuCode}：${readiness.isReady ? '纱线已齐' : `缺少 ${readiness.missingYarnSkus.join('、') || '技术包必需纱线关系'}`}`
  })
  const factBlock = (title: string, body: string) => `<section class="rounded-md border"><h3 class="border-b px-3 py-2 text-sm font-medium">${escapeHtml(title)}</h3><div class="space-y-1 p-3 text-xs">${body}</div></section>`
  return dialog('完成加工单二次确认', `
    <div class="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">系统仅展示当前业务事实，不判断该加工单是否应该完成。请业务人员核对后确认。</div>
    <div class="grid gap-3 md:grid-cols-2">
      ${factBlock('确认接收情况', yarnSummary.length ? `${yarnSummary.map((text) => `<div>${escapeHtml(text)}</div>`).join('')}<div class="mt-2 border-t pt-2">${readinessSummary.map((text) => `<div>${escapeHtml(text)}</div>`).join('')}</div>` : '<div>暂无有效确认接收</div>')}
      ${factBlock('加工填报情况', order.outputPlanLines.map((line) => {
        const reported = getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode)
        return `<div>${escapeHtml(line.outputSkuCode)}：计划 ${line.plannedQty}${line.qtyUnit} / 上限 ${Math.floor(line.plannedQty * 1.5)}${line.qtyUnit} / 累计 ${reported}${line.qtyUnit} / 与计划差异 ${reported - line.plannedQty}${line.qtyUnit}</div>`
      }).join(''))}
      ${factBlock('发起交出情况', order.outputPlanLines.map((line) => {
        const reported = getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode)
        const handedOver = getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode)
        return `<div>${escapeHtml(line.outputSkuCode)}：累计加工 ${reported}${line.qtyUnit} / 累计交出 ${handedOver}${line.qtyUnit} / 尚未交出 ${Math.max(reported - handedOver, 0)}${line.qtyUnit}</div>`
      }).join('') + `<div class="mt-2 border-t pt-2">${handoverFacts.map((item) => {
        const record = item.record as WoolHandoverRecord
        const downstream = record.downstreamReceipt?.status === 'CONFIRMED'
          ? `下游已收 ${record.downstreamReceipt.actualReceivedQty ?? 0}${record.qtyUnit}，差异 ${record.downstreamReceipt.differenceQty ?? 0}${record.qtyUnit}`
          : '下游待确认'
        return `<div>${escapeHtml(record.handoverId)}：${effectiveHandoverQty(record)}${record.qtyUnit}，${escapeHtml(downstream)}</div>`
      }).join('') || '<div>暂无交出记录</div>'}</div>`)}
      ${factBlock('待交出仓情况', order.outputPlanLines.map((line) => `<div>${escapeHtml(line.outputSkuCode)}：默认库位现存 ${getWoolOutputStockQty(order.woolOrderId, line.outputSkuCode)}${line.qtyUnit}</div>`).join(''))}
    </div>
    <label class="mt-4 block text-sm"><span class="mb-1 block text-xs text-muted-foreground">完成确认备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wool-dialog-field="remark"></textarea></label>
    <div class="mt-3 text-xs text-muted-foreground">当前共有 ${receiptFacts.length} 次接收、${reportFacts.length} 次加工填报、${handoverFacts.length} 次发起交出。确认后系统自动解除本加工单全部横机关联。</div>
  `, dialogFooter('save-complete', '确认完成加工单'))
}

interface EditableFact {
  recordType: WoolQtyChangeRecordType
  recordId: string
  recordLineId?: string
  objectSkuCode: string
  currentQty: number
  unit: string
  locked?: boolean
}

function editableFacts(order: WoolWorkOrder): EditableFact[] {
  const records = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: ['YARN_RECEIPT', 'PROCESS_REPORT', 'HANDOVER'],
  })
  const result: EditableFact[] = []
  for (const item of records) {
    if (item.recordType === 'YARN_RECEIPT') {
      const record = item.record as WoolYarnReceiptRecord
      result.push(...record.lines.map((line) => ({
        recordType: 'YARN_RECEIPT' as const,
        recordId: record.receiptId,
        recordLineId: line.lineId,
        objectSkuCode: line.yarnSkuCode,
        currentQty: effectiveReceiptQty(record, line.lineId),
        unit: line.qtyUnit,
      })))
      continue
    }
    if (item.recordType === 'PROCESS_REPORT') {
      const record = item.record as WoolProcessReportRecord
      result.push({
        recordType: 'PROCESS_REPORT' as const,
        recordId: record.reportId,
        objectSkuCode: record.outputSkuCode,
        currentQty: effectiveReportQty(record),
        unit: order.outputPlanLines.find((line) => line.outputSkuCode === record.outputSkuCode)?.qtyUnit || '件',
      })
      continue
    }
    const record = item.record as WoolHandoverRecord
    result.push({
      recordType: 'HANDOVER' as const,
      recordId: record.handoverId,
      objectSkuCode: record.outputSkuCode,
      currentQty: effectiveHandoverQty(record),
      unit: record.qtyUnit,
      locked: record.downstreamReceipt?.status === 'CONFIRMED',
    })
  }
  return result
}

function effectiveReceiptQty(record: WoolYarnReceiptRecord, lineId: string): number {
  const line = record.lines.find((item) => item.lineId === lineId)!
  const changes = listWoolFactRecords({ woolOrderId: record.woolOrderId, recordType: 'QTY_CHANGE' })
    .map((item) => item.record as WoolQtyChangeLog)
    .filter((item) => item.recordType === 'YARN_RECEIPT' && item.recordId === record.receiptId && item.recordLineId === lineId)
  return changes.reduce((_qty, change) => change.afterQty, line.receivedQty)
}

function effectiveReportQty(record: WoolProcessReportRecord): number {
  const changes = listWoolFactRecords({ woolOrderId: record.woolOrderId, recordType: 'QTY_CHANGE' })
    .map((item) => item.record as WoolQtyChangeLog)
    .filter((item) => item.recordType === 'PROCESS_REPORT' && item.recordId === record.reportId)
  return changes.reduce((_qty, change) => change.afterQty, record.reportedQty)
}

function effectiveHandoverQty(record: WoolHandoverRecord): number {
  const changes = listWoolFactRecords({ woolOrderId: record.woolOrderId, recordType: 'QTY_CHANGE' })
    .map((item) => item.record as WoolQtyChangeLog)
    .filter((item) => item.recordType === 'HANDOVER' && item.recordId === record.handoverId)
  return changes.reduce((_qty, change) => change.afterQty, record.handoverQty)
}

function renderQtyListDialog(order: WoolWorkOrder): string {
  const rows = editableFacts(order)
  const labels: Record<WoolQtyChangeRecordType, string> = { YARN_RECEIPT: '确认接收', PROCESS_REPORT: '加工填报', HANDOVER: '发起交出' }
  return dialog('修改记录数量', `<div class="overflow-hidden rounded-md border">${rows.map((row) => `<div class="grid grid-cols-[110px_1fr_120px_90px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"><span>${labels[row.recordType]}</span><span>${escapeHtml(row.objectSkuCode)}<span class="ml-2 text-xs text-muted-foreground">${escapeHtml(row.recordId)}</span></span><span>${formatQty(row.currentQty, row.unit)}</span>${row.locked ? '<span class="text-xs text-muted-foreground">下游已确认</span>' : `<button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-work-orders-action="open-qty-edit" data-record-type="${row.recordType}" data-record-id="${escapeHtml(row.recordId)}" data-record-line-id="${escapeHtml(row.recordLineId || '')}" data-object-sku-code="${escapeHtml(row.objectSkuCode)}" data-current-qty="${row.currentQty}" data-unit="${escapeHtml(row.unit)}" data-skip-page-rerender="true">修改数量</button>`}</div>`).join('') || '<div class="p-4 text-sm text-muted-foreground">暂无可修改记录</div>'}</div>`, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

function resolveEditableFactMax(
  order: WoolWorkOrder,
  overlay: Extract<BusinessOverlay, { kind: 'qty-edit' }>,
): number | undefined {
  if (overlay.recordType === 'PROCESS_REPORT') {
    const line = order.outputPlanLines.find((item) => item.outputSkuCode === overlay.objectSkuCode)
    if (!line) return undefined
    const otherReportedQty = editableFacts(order)
      .filter((item) =>
        item.recordType === 'PROCESS_REPORT'
        && item.objectSkuCode === overlay.objectSkuCode
        && item.recordId !== overlay.recordId,
      )
      .reduce((sum, item) => sum + item.currentQty, 0)
    return Math.max(0, Math.floor(line.plannedQty * 1.5) - otherReportedQty)
  }
  if (overlay.recordType === 'HANDOVER') {
    return overlay.currentQty
      + getWoolOutputHandoverAvailableQty(order.woolOrderId, overlay.objectSkuCode)
  }
  return undefined
}

function renderQtyEditDialog(overlay: Extract<BusinessOverlay, { kind: 'qty-edit' }>): string {
  const order = listWoolWorkOrders().find((item) => item.woolOrderId === overlay.woolOrderId)
  const maxQty = order ? resolveEditableFactMax(order, overlay) : undefined
  return dialog('修改数量', `<div class="rounded-md border p-3 text-sm"><div>对象 SKU：<strong>${escapeHtml(overlay.objectSkuCode)}</strong></div><div class="mt-1">当前数量：${formatQty(overlay.currentQty, overlay.unit)}</div>${maxQty === undefined ? '' : `<div class="mt-1 text-xs text-muted-foreground">本记录最多可修改为 ${formatQty(maxQty, overlay.unit)}</div>`}</div><label class="mt-4 block text-sm"><span class="mb-1 block text-xs text-muted-foreground">修改后数量</span><input type="number" min="0.01" ${maxQty === undefined ? '' : `max="${maxQty}"`} step="${overlay.unit === 'kg' ? '0.01' : '1'}" class="h-9 w-full rounded-md border px-3" value="${overlay.currentQty}" data-wool-dialog-field="qty"></label><label class="mt-3 block text-sm"><span class="mb-1 block text-xs text-muted-foreground">修改原因（必填）</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wool-dialog-field="reason"></textarea></label>`, dialogFooter('save-qty', '保存数量修改'))
}

function renderBusinessOverlay(): string {
  const order = requireOverlayOrder()
  if (!state.overlay || !order) return ''
  if (state.overlay.kind === 'receipt') return renderWoolReceiptDialog(order)
  if (state.overlay.kind === 'report') return renderWoolReportDialog(order)
  if (state.overlay.kind === 'handover') return renderWoolHandoverDialog(order)
  if (state.overlay.kind === 'complete') return renderCompleteDialog(order)
  if (state.overlay.kind === 'qty-list') return renderQtyListDialog(order)
  return renderQtyEditDialog(state.overlay)
}

function readDialogField(name: string): string {
  return rootElement()?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-wool-dialog-field="${name}"]`)?.value.trim() || ''
}

function readProofFiles(): string[] {
  return readDialogField('proofFiles')
    .split(/[\n,，]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function showOverlayError(message: string): void {
  state.overlayError = message
  const errorSurface = rootElement()?.querySelector<HTMLElement>('[data-wool-overlay-error]')
  if (errorSurface) errorSurface.innerHTML = renderOverlayError()
}

function runCommand(action: () => void, successMessage: string): void {
  try {
    action()
    state.feedback = successMessage
    state.overlayError = ''
    state.overlay = null
    refreshBusinessOverlay()
    refreshResults()
  } catch (error) {
    showOverlayError(error instanceof Error ? error.message : '操作未保存，请检查填写内容后重试。')
  }
}

function openOverlay(kind: BusinessOverlay['kind'], woolOrderId: string): void {
  if (kind === 'qty-edit') return
  state.overlay = { kind, woolOrderId } as BusinessOverlay
  state.overlayError = ''
  refreshBusinessOverlay()
}

function updateFilterField(field: keyof WoolListFilters, value: string): void {
  state.filters = { ...state.filters, [field]: value }
  state.currentPage = 1
}

function saveReceipt(order: WoolWorkOrder): void {
  const root = rootElement()
  const selected = Array.from(root?.querySelectorAll<HTMLInputElement>('[data-wool-receipt-yarn]:checked') ?? [])
  const lines = selected.map((checkbox) => {
    const yarnSkuCode = checkbox.dataset.woolReceiptYarn || ''
    const qty = Number(root?.querySelector<HTMLInputElement>(`[data-wool-receipt-qty="${CSS.escape(yarnSkuCode)}"]`)?.value || 0)
    const differenceNote = root?.querySelector<HTMLInputElement>(
      `[data-wool-receipt-difference="${CSS.escape(yarnSkuCode)}"]`,
    )?.value.trim()
    return { yarnSkuCode, receivedQty: qty, differenceNote }
  })
  runCommand(() => addWoolYarnReceipt(order.woolOrderId, {
    commandId: nextCommandId('RECEIPT', order.woolOrderId),
    deliveryNo: readDialogField('deliveryNo'),
    batchNo: readDialogField('batchNo'),
    proofFiles: readProofFiles(),
    remark: readDialogField('factRemark'),
    receivedAt: nowText(),
    receivedBy: readDialogField('operator'),
    lines,
  }), '确认接收已保存，纱线已进入默认库位。')
}

function saveReport(order: WoolWorkOrder): void {
  const outputSkuCode = readDialogField('outputSkuCode')
  const qty = Number(readDialogField('qty'))
  const readiness = getWoolOutputReadiness(order.woolOrderId, outputSkuCode)
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  if (qty > readiness.remainingReportQty) {
    const unit = line?.qtyUnit || '件'
    showOverlayError(`最多还可填报 ${readiness.remainingReportQty}${unit}，请将本次数量改为 ${readiness.remainingReportQty}${unit}以内。`)
    return
  }
  runCommand(() => addWoolProcessReport(order.woolOrderId, {
    commandId: nextCommandId('REPORT', order.woolOrderId),
    outputSkuCode,
    reportedQty: qty,
    proofFiles: readProofFiles(),
    remark: readDialogField('factRemark'),
    reportedAt: nowText(),
    reportedBy: readDialogField('operator'),
  }), '加工填报已保存，产出已进入对应默认库位。')
}

function saveHandover(order: WoolWorkOrder): void {
  const outputSkuCode = readDialogField('outputSkuCode')
  const handoverQty = Number(readDialogField('qty'))
  const line = order.outputPlanLines.find((item) => item.outputSkuCode === outputSkuCode)
  const availableQty = getWoolOutputHandoverAvailableQty(order.woolOrderId, outputSkuCode)
  if (handoverQty > availableQty) {
    showOverlayError(`最多可交出 ${availableQty}${line?.qtyUnit || '件'}，请调整本次交出数量。`)
    return
  }
  runCommand(() => addWoolHandover(order.woolOrderId, {
    commandId: nextCommandId('HANDOVER', order.woolOrderId),
    outputSkuCode,
    handoverQty,
    proofFiles: readProofFiles(),
    remark: readDialogField('factRemark'),
    handedOverAt: nowText(),
    handedOverBy: readDialogField('operator'),
  }), '发起交出已保存，库存已从对应默认库位扣减。')
}

function saveComplete(order: WoolWorkOrder): void {
  runCommand(() => completeWoolWorkOrder(order.woolOrderId, {
    commandId: nextCommandId('COMPLETE', order.woolOrderId),
    completedAt: nowText(),
    completedBy: 'Web 端毛织主管',
    remark: readDialogField('remark'),
  }), '加工单已完成，当前横机关联已自动解除。')
}

function saveQty(overlay: Extract<BusinessOverlay, { kind: 'qty-edit' }>): void {
  const order = listWoolWorkOrders().find((item) => item.woolOrderId === overlay.woolOrderId)
  const afterQty = Number(readDialogField('qty'))
  const maxQty = order ? resolveEditableFactMax(order, overlay) : undefined
  if (maxQty !== undefined && afterQty > maxQty) {
    showOverlayError(`该记录最多可修改为 ${maxQty}${overlay.unit}。`)
    return
  }
  runCommand(() => changeWoolFactQty({
    commandId: nextCommandId('CHANGE-QTY', overlay.recordId),
    recordType: overlay.recordType,
    recordId: overlay.recordId,
    recordLineId: overlay.recordLineId,
    afterQty,
    reason: readDialogField('reason'),
    changedAt: nowText(),
    changedBy: 'Web 端毛织主管',
  }), '记录数量已修改，库存已按新旧差额同步。')
}

export async function handleCraftWoolEvent(target: HTMLElement): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-wool-work-orders-root]')
  if (!root) return false

  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wool-work-orders-field]')
  if (field?.dataset.woolWorkOrdersField) {
    const name = field.dataset.woolWorkOrdersField as keyof WoolListFilters | 'pageSize'
    if (name === 'pageSize') {
      listController.setPageSize(Number(field.value))
      listController.refresh()
      return true
    }
    updateFilterField(name, field.value)
    if (field instanceof HTMLInputElement && ['keyword', 'productionOrderNo', 'woolOrderNo', 'factory', 'yarnSku'].includes(name)) {
      if (filterDebounce) clearTimeout(filterDebounce)
      filterDebounce = setTimeout(refreshResults, 180)
    } else {
      refreshResults()
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-wool-work-orders-action]')
  const action = actionNode?.dataset.woolWorkOrdersAction
  if (!actionNode || !action) return false
  const woolOrderId = actionNode.dataset.woolOrderId || state.overlay?.woolOrderId || ''
  const order = listWoolWorkOrders().find((item) => item.woolOrderId === woolOrderId)

  if (action.startsWith('tab:')) {
    state.activeTab = action.slice(4) as WoolWorkOrderTab
    state.currentPage = 1
    refreshResults()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    listController.stepPage(action === 'prev-page' ? -1 : 1)
    listController.refresh()
    return true
  }
  if (action === 'sort-column') {
    listController.cycleSort(actionNode.dataset.columnKey || '')
    listController.refresh()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshColumnOverlay()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshColumnOverlay()
    return true
  }
  if (action === 'restore-column-settings') {
    listController.restorePreferences()
    refreshColumnOverlay()
    listController.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    listController.updateColumnPreference(
      action,
      actionNode.dataset.woolWorkOrdersColumnKey
        || actionNode.closest<HTMLElement>('[data-wool-work-orders-column-key]')?.dataset.woolWorkOrdersColumnKey
        || '',
      checkbox?.checked,
    )
    refreshColumnOverlay()
    listController.refresh()
    return true
  }
  if (action === 'reset-filters') {
    state.filters = { ...DEFAULT_FILTERS }
    state.currentPage = 1
    const filters = root.querySelector<HTMLElement>('[data-wool-work-orders-filters]')
    if (filters) filters.innerHTML = renderFilters()
    refreshResults()
    return true
  }
  if (action === 'open-receipt' && order) openOverlay('receipt', order.woolOrderId)
  if (action === 'open-report' && order) openOverlay('report', order.woolOrderId)
  if (action === 'open-handover' && order) openOverlay('handover', order.woolOrderId)
  if (action === 'open-complete' && order) openOverlay('complete', order.woolOrderId)
  if (action === 'open-qty-list' && order) openOverlay('qty-list', order.woolOrderId)
  if (['open-receipt', 'open-report', 'open-handover', 'open-complete', 'open-qty-list'].includes(action)) return true
  if (action === 'open-qty-edit' && state.overlay) {
    state.overlay = {
      kind: 'qty-edit',
      woolOrderId: state.overlay.woolOrderId,
      recordType: actionNode.dataset.recordType as WoolQtyChangeRecordType,
      recordId: actionNode.dataset.recordId || '',
      recordLineId: actionNode.dataset.recordLineId || undefined,
      currentQty: Number(actionNode.dataset.currentQty || 0),
      unit: actionNode.dataset.unit || '',
      objectSkuCode: actionNode.dataset.objectSkuCode || '',
    }
    state.overlayError = ''
    refreshBusinessOverlay()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshBusinessOverlay()
    return true
  }
  if (!order) return true
  if (action === 'save-receipt') saveReceipt(order)
  if (action === 'save-report') saveReport(order)
  if (action === 'save-handover') saveHandover(order)
  if (action === 'save-complete') saveComplete(order)
  if (action === 'save-qty' && state.overlay?.kind === 'qty-edit') saveQty(state.overlay)
  return true
}
