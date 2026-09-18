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
  listWoolFactRecords,
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
import { getWoolWorkOrderReadinessProjection, readWoolQuerySnapshot as readWoolStore } from '../../../data/fcs/wool-domain/queries.ts'
import {
  buildWoolHandoverPrintLink,
  buildWoolMachineAssociationsLink,
  buildWoolWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { pieceAvailableQty } from '../../../data/fcs/wool-domain/stage-rules.ts'
import { escapeHtml } from '../../../utils.ts'
import { formatNumber, formatQty } from './shared.ts'
import { woolStageLabel, woolStagePath, renderWoolOrderIdentity, renderWoolStageInputs, renderWoolStageRequirements, renderWoolStageProgress, renderWoolStageOutputs, renderWoolStageTimes, renderWoolStageQuantities, renderWoolObjectImage, type WoolPageStage } from './stage-display.ts'

// 标准列表契约的 renderStandardListTable、renderTablePagination 由共享控制器统一调用。

const EVENT_PREFIX = 'wool-work-orders'
let currentStage: WoolPageStage = 'KNITTING'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface WoolListFilters {
  keyword: string
  productionOrderNo: string
  woolOrderNo: string
  kind: '' | WoolWorkOrder['kind']
  factory: string
  processingStatus: '' | Exclude<WoolWorkOrderTab, 'ALL'>
  yarnSku: string
  outputSku: string
  sourceCraft: string
  external: '' | 'YES' | 'NO'
  receiptState: '' | 'NONE' | 'PARTIAL' | 'RECEIVED'
  timeField: 'CREATED' | 'PLANNED_START' | 'PLANNED_COMPLETE' | 'REPORTED' | 'RECEIVED' | 'HANDOVER'
  plannedFrom: string
  plannedTo: string
}

type BusinessOverlay =
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
  outputSku: '',
  sourceCraft: '',
  external: '',
  receiptState: '',
  timeField: 'PLANNED_COMPLETE',
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
  activeTab: 'ALL',
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

export function filterWoolStageOrderRowsByKeyword(
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
    stage: currentStage,
    productionOrderNo: state.filters.productionOrderNo,
    woolOrderNo: state.filters.woolOrderNo,
    ...(state.filters.kind ? { kind: state.filters.kind } : {}),
  }
}

function receiptFilterState(order: WoolWorkOrder): 'NONE' | 'PARTIAL' | 'RECEIVED' {
  const store = readWoolStore()
  if (order.stage === 'KNITTING') {
    const projection = getWoolWorkOrderReadinessProjection(order.woolOrderId)
    if (![...projection.yarnReceiptsBySku.values()].some(item => item.isReceived)) return 'NONE'
    return [...projection.outputsBySku.values()].every(item => item.readiness.requiredYarnSkus.length > 0 && item.readiness.missingYarnSkus.length === 0) ? 'RECEIVED' : 'PARTIAL'
  }
  const received = store.pieceReceipts.filter(item => item.woolOrderId === order.woolOrderId)
  const internal = store.internalReceipts.filter(item => item.woolOrderId === order.woolOrderId)
  if (!received.length && !internal.length) return 'NONE'
  return order.outputPlanLines.every(line => getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode).reportLimitQty >= line.plannedQty) ? 'RECEIVED' : 'PARTIAL'
}

function filterTime(order: WoolWorkOrder): string {
  if (state.filters.timeField === 'CREATED') return order.createdAt
  if (state.filters.timeField === 'PLANNED_START') return order.plannedStartAt || ''
  if (state.filters.timeField === 'PLANNED_COMPLETE') return order.plannedCompletionAt
  const store = readWoolStore()
  if (state.filters.timeField === 'REPORTED') return store.processReports.filter(item => item.woolOrderId === order.woolOrderId).map(item => item.reportedAt).sort().at(-1) || ''
  if (state.filters.timeField === 'HANDOVER') return store.handovers.filter(item => item.woolOrderId === order.woolOrderId).map(item => item.handedOverAt).sort((a, b) => a.replace('T', ' ').localeCompare(b.replace('T', ' '))).at(-1) || ''
  const receivedTimes = order.stage === 'KNITTING'
    ? [...getWoolWorkOrderReadinessProjection(order.woolOrderId).yarnReceiptsBySku.values()].map(item => item.latestReceivedAt || '')
    : [...store.internalReceipts, ...store.pieceReceipts].filter(item => item.woolOrderId === order.woolOrderId).map(item => item.receivedAt)
  return receivedTimes.sort((a, b) => a.replace('T', ' ').localeCompare(b.replace('T', ' '))).at(-1) || ''
}

function baseRows(): WoolListRow[] {
  const domainFilters = currentDomainFilters()
  // 先由领域过滤加工单身份，再补页面展示元数据筛选；Tab 数量随后基于同一结果计算。
  return filterWoolStageOrderRowsByKeyword(listWoolWorkOrders(domainFilters), state.filters.keyword)
    .filter((row) => includes(row.factoryName, state.filters.factory))
    .filter((row) => !state.filters.yarnSku || row.order.outputPlanLines.some((line) =>
      line.requiredYarnSkus.some((sku) => includes(sku, state.filters.yarnSku)),
    ))
    .filter(row => !state.filters.outputSku || row.order.outputPlanLines.some(line => includes(line.outputSkuCode, state.filters.outputSku)))
    .filter(row => !state.filters.sourceCraft || row.order.externalPieces.some(piece => piece.routeNodes.some(node => includes(`${node.craftName} ${node.factoryName}`, state.filters.sourceCraft))))
    .filter(row => !state.filters.external || (row.order.externalPieces.length > 0) === (state.filters.external === 'YES'))
    .filter(row => !state.filters.receiptState || receiptFilterState(row.order) === state.filters.receiptState)
    .filter(row => !state.filters.plannedFrom || filterTime(row.order).slice(0, 10) >= state.filters.plannedFrom)
    .filter(row => !state.filters.plannedTo || (Boolean(filterTime(row.order)) && filterTime(row.order).slice(0, 10) <= state.filters.plannedTo))
}

function rowsForActiveTab(): WoolListRow[] {
  return baseRows().filter((row) => state.activeTab === 'ALL' || row.tab === state.activeTab)
}

function tabCounts(rows = baseRows()): Record<WoolWorkOrderTab, number> {
  return rows.reduce<Record<WoolWorkOrderTab, number>>((counts, row) => {
    counts.ALL += 1
    counts[row.tab] += 1
    return counts
  }, { ALL: 0, UNPROCESSED: 0, READY: 0, PROCESSING: 0, PROCESS_COMPLETE: 0, COMPLETED: 0 })
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
  const handoverCount = listWoolFactRecords({
    woolOrderId: order.woolOrderId,
    recordType: 'HANDOVER',
  }).filter(item => !(item.record as WoolHandoverRecord).automatic).length
  return `<div class="flex max-w-[360px] flex-wrap justify-end gap-1.5">
    <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolWorkOrderDetailLink(order.woolOrderId))}">查看详情</button>
    ${actions.includes('RECEIVE_YARN') || actions.includes('RECEIVE_PIECES') ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="/fcs/craft/wool/pending-receipts?workOrderId=${encodeURIComponent(order.woolOrderId)}">${order.stage === 'KNITTING' ? '确认纱线接收' : '确认外加工片回货'}</button>` : ''}
    ${actions.includes('REPORT_PROCESS') ? renderActionButton('加工填报', 'open-report', order, 'border-blue-200 text-blue-700') : ''}
    ${actions.includes('HANDOVER') ? renderActionButton('发起交出', 'open-handover', order, 'border-emerald-200 text-emerald-700') : ''}
    ${order.stage === 'KNITTING' && actions.includes('ASSOCIATE_MACHINE') ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolMachineAssociationsLink(order.woolOrderId))}">关联横机设备</button>` : ''}
    ${factCount > 0 && row.tab !== 'COMPLETED' ? renderActionButton('修改记录数量', 'open-qty-list', order) : ''}
    ${handoverCount > 0 ? `<button type="button" class="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildWoolHandoverPrintLink(order.woolOrderId))}">打印交出单</button>` : ''}
    ${actions.includes('COMPLETE') ? renderActionButton('完成加工单', 'open-complete', order, 'border-amber-200 text-amber-700') : ''}
  </div>`
}

const columns: StandardListColumn<WoolListRow>[] = [
  { key: 'order', title: '加工单／商品与需求来源', width: 280, required: true, freezeable: true, sortable: true, sortValue: row => row.order.woolOrderNo, render: row => renderWoolOrderIdentity(row.order) },
  { key: 'inputs', title: '加工投入／上游', width: 275, required: true, freezeable: true, render: row => renderWoolStageInputs(row.order) },
  { key: 'requirements', title: '加工要求', width: 230, freezeable: true, render: row => renderWoolStageRequirements(row.order) },
  { key: 'progress', title: '处理进度', width: 220, required: true, freezeable: true, sortable: true, sortValue: row => getWoolProcessingStatus(row.order.woolOrderId), render: row => renderWoolStageProgress(row.order) },
  { key: 'outputs', title: '加工产出／下游', width: 245, freezeable: true, render: row => renderWoolStageOutputs(row.order) },
  { key: 'times', title: '时间', width: 270, freezeable: true, sortable: true, sortValue: row => row.plannedCompletionAt, render: row => renderWoolStageTimes(row.order) },
  { key: 'quantities', title: '数量', width: 205, required: true, freezeable: true, sortable: true, sortValue: row => row.order.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0), render: row => renderWoolStageQuantities(row.order) },
  { key: 'actions', title: '操作', width: 225, required: true, actionColumn: true, render: renderActions },
]

const listController = createProcessOrderListController({
  state,
  columns,
  get preferenceKey() { return `${woolStagePath(currentStage)}:list-columns` },
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  eventPrefix: EVENT_PREFIX,
  rootSelector: '[data-wool-work-orders-root]',
  tableSurfaceSelector: '[data-wool-work-orders-table-surface]',
  paginationSurfaceSelector: '[data-wool-work-orders-pagination-surface]',
  overlaysSurfaceSelector: '[data-wool-work-orders-column-overlays]',
  defaultFrozenKeys: ['order'],
  get columnSettingsTitle() { return `${woolStageLabel(currentStage)}列设置` },
  emptyText: '当前条件下暂无毛织加工单',
  getRows: rowsForActiveTab,
  locallyManagedEvents: true,
})

function filterInput(label: string, field: keyof WoolListFilters, placeholder: string, type = 'text'): string {
  return `<label class="min-w-[10rem] flex-1"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input type="${type}" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(state.filters[field])}" placeholder="${escapeHtml(placeholder)}" data-wool-work-orders-field="${escapeHtml(field)}" data-skip-page-rerender="true"></label>`
}

function renderFilters(): string {
  return `<div class="space-y-3 rounded-lg border bg-card p-3">
    <div class="flex flex-wrap items-end gap-3">
    ${filterInput('加工单号 / 任务号 / 款号 / 款名 / 内部货号', 'keyword', '输入关键字')}
    ${filterInput('承接工厂', 'factory', '输入工厂名称')}
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-work-orders-field="kind" data-skip-page-rerender="true"><option value="">全部类型</option><option value="WHOLE_GARMENT" ${state.filters.kind === 'WHOLE_GARMENT' ? 'selected' : ''}>整件毛织</option><option value="PART_PANEL" ${state.filters.kind === 'PART_PANEL' ? 'selected' : ''}>部位毛织</option></select></label>
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">加工状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wool-work-orders-field="processingStatus" data-skip-page-rerender="true"><option value="">全部状态</option>${[['UNPROCESSED', '未加工'], ['READY', '待开工'], ['PROCESSING', '加工中'], ['PROCESS_COMPLETE', '加工完成'], ['COMPLETED', '已完成']].map(([key, label]) => `<option value="${key}" ${state.filters.processingStatus === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <div class="flex items-center gap-2 border-t pt-3">${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filters' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}</div>
    <details class="text-sm"><summary class="cursor-pointer text-blue-700">更多筛选</summary><div class="mt-3 flex flex-wrap items-end gap-3">
    ${filterInput('生产单号', 'productionOrderNo', '输入生产单号')}
    ${filterInput(woolStageLabel(currentStage) + '号', 'woolOrderNo', '输入加工单号')}
    ${currentStage === 'KNITTING' ? filterInput('必需纱线 SKU', 'yarnSku', '输入纱线 SKU') : ''}
    ${filterInput('产出 SKU', 'outputSku', '输入颜色尺码 SKU')}
    ${currentStage === 'LINKING' ? filterInput('来源工艺／工厂', 'sourceCraft', '输入工艺或工厂名称') : ''}
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">是否外加工</span><select class="h-9 w-full rounded border px-3 text-sm" data-wool-work-orders-field="external" data-skip-page-rerender="true">${[['', '全部'], ['YES', '需要外加工'], ['NO', '无外加工']].map(([key, label]) => `<option value="${key}" ${state.filters.external === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="min-w-[12rem]"><span class="mb-1 block text-xs text-muted-foreground">投入接收情况</span><select class="h-9 w-full rounded border px-3 text-sm" data-wool-work-orders-field="receiptState" data-skip-page-rerender="true">${[['', '全部'], ['NONE', '尚未接收'], ['PARTIAL', '已部分接收'], ['RECEIVED', currentStage === 'KNITTING' ? '必需纱线种类已具备' : '回货可支撑计划数量']].map(([key, label]) => `<option value="${key}" ${state.filters.receiptState === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <label class="min-w-[9rem]"><span class="mb-1 block text-xs text-muted-foreground">时间字段</span><select class="h-9 w-full rounded border px-3 text-sm" data-wool-work-orders-field="timeField" data-skip-page-rerender="true">${[['CREATED', '单据创建'], ['PLANNED_START', '计划开始'], ['PLANNED_COMPLETE', '计划完成'], ['REPORTED', '最近加工'], ['RECEIVED', '最近接收'], ['HANDOVER', '最近交出']].map(([key, label]) => `<option value="${key}" ${state.filters.timeField === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    ${filterInput('时间从', 'plannedFrom', '', 'date')}
    ${filterInput('时间至', 'plannedTo', '', 'date')}
    </div></details>
  </div>`
}

function renderTabBar(): string {
  const counts = tabCounts()
  return renderTabs({
    tabs: [
      { key: 'ALL', label: '全部加工单', count: counts.ALL },
      { key: 'UNPROCESSED', label: '未加工', count: counts.UNPROCESSED },
      { key: 'READY', label: '待开工', count: counts.READY },
      { key: 'PROCESSING', label: '加工中', count: counts.PROCESSING },
      { key: 'PROCESS_COMPLETE', label: '加工完成', count: counts.PROCESS_COMPLETE },
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
    title: woolStageLabel(currentStage),
    primaryActionsHtml: '',
    feedbackHtml: `<div data-wool-work-orders-feedback>${renderFeedback()}</div>`,
    filtersHtml: `<div data-wool-work-orders-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-wool-work-orders-tabs>${renderTabBar()}</div>`,
    listTitle: woolStageLabel(currentStage),
    listActionsHtml: `<span class="text-xs text-muted-foreground" data-wool-work-orders-total>共 ${rowsForActiveTab().length} 条</span>` + renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2'),
    tableHtml: `<div data-wool-work-orders-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wool-work-orders-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wool-work-orders-column-overlays>${listController.renderColumnSettings()}</div><div data-wool-work-orders-business-overlay>${renderBusinessOverlay()}</div>`,
  })
}

export function renderCraftWoolStageOrdersPage(stage: WoolPageStage = 'KNITTING'): string {
  const nextStage = typeof window !== 'undefined' && window.location.pathname.includes('/linking-orders') ? 'LINKING' : stage
  if (nextStage !== currentStage) {
    currentStage = nextStage
    state.filters = { ...DEFAULT_FILTERS }
    state.activeTab = 'ALL'
    state.preferencesLoaded = false
    state.currentPage = 1
    state.overlay = null
    state.feedback = ''
  }
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
  const total = root.querySelector<HTMLElement>('[data-wool-work-orders-total]')
  if (total) total.textContent = `共 ${rows.length} 条`
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
  return `<section class="mb-4 flex gap-3 rounded-md border bg-muted/20 p-3 text-xs">${renderWoolObjectImage(order.styleImageUrl, order.styleNo + ' 款式图')}<div>
    <div class="font-medium text-foreground">${escapeHtml(order.woolOrderNo)}｜${escapeHtml(order.productionOrderNo)}</div>
    <div class="mt-1 text-muted-foreground">款式：${escapeHtml(order.styleNo)} ${escapeHtml(order.styleName)}${order.internalStyleCode ? `｜内部货号：${escapeHtml(order.internalStyleCode)}` : ''}｜承接工厂：${escapeHtml(order.factoryName)}</div></div>
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

export function renderWoolReportDialog(order: WoolWorkOrder): string {
  const readiness = order.outputPlanLines.map((line) => ({ line, readiness: getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode) }))
  const available = readiness.filter((item) => item.readiness.canReport)
  const unavailable = readiness.filter((item) => !item.readiness.canReport)
  return dialog('加工填报', `
    ${renderOrderContext(order)}
    <label class="block text-sm"><span class="mb-1 block text-xs text-muted-foreground">可填报加工后 SKU</span><select class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="outputSkuCode">${available.map(({ line, readiness: item }) => `<option value="${escapeHtml(line.outputSkuCode)}">${escapeHtml(line.outputSkuCode)}｜计划 ${line.plannedQty}${line.qtyUnit}｜上限 ${item.reportLimitQty}${line.qtyUnit}｜累计有效加工填报 ${item.reportedQty}${line.qtyUnit}｜本次最多 ${item.remainingReportQty}${line.qtyUnit}</option>`).join('')}</select></label>
    <div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">本次填报数量</span><input type="number" min="1" step="1" class="h-9 w-full rounded-md border px-3" data-wool-dialog-field="qty"></label><label class="text-sm"><span class="mb-1 block text-xs text-muted-foreground">填报人</span><input class="h-9 w-full rounded-md border px-3" value="Web 端毛织主管" data-wool-dialog-field="operator"></label></div>
    <section class="mt-4 rounded-md border"><h3 class="border-b px-3 py-2 text-sm font-medium">暂不可填报</h3><div class="space-y-2 p-3 text-xs">${unavailable.map(({ line, readiness: item }) => `<div><span class="font-medium">${escapeHtml(line.outputSkuCode)}</span>：累计有效加工填报 ${item.reportedQty}${line.qtyUnit}；${escapeHtml(item.missingYarnSkus.length ? `缺少 ${item.missingYarnSkus.join('、')}` : item.remainingReportQty === 0 ? (order.stage === 'KNITTING' ? '已达到横机填报上限' : '暂无可缝盘余额') : (order.stage === 'LINKING' ? '未具备可缝盘数量，或由横机自动填报' : '技术包缺少必需纱线关系'))}</div>`).join('') || '<div class="text-muted-foreground">无</div>'}</div></section>
    ${proofAndRemarkFields()}
    ${renderHistorySummary(order)}
  `, available.length > 0 ? dialogFooter('save-report', '保存加工填报') : renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
}

export function renderWoolHandoverDialog(order: WoolWorkOrder): string {
  if (order.stage === 'KNITTING') {
    const store = readWoolStore()
    const available = order.externalPieces.filter(piece => pieceAvailableQty(store, order, piece.pieceKey) > 0 && piece.routeNodes[0]?.factoryId)
    return dialog('横机外发片交出', `${renderOrderContext(order)}<p class="mb-3 text-sm text-muted-foreground">仅交出需要辅助／特种工艺的片。接收厂由该片技术包路线的首工艺派工决定。</p><label class="block text-sm">外发片与首工艺厂<select class="mt-1 h-10 w-full rounded border px-3" data-wool-dialog-field="pieceKey">${available.map(piece => `<option value="${escapeHtml(piece.pieceKey)}">${escapeHtml(piece.pieceName)} · ${escapeHtml(piece.skuCode)} · ${escapeHtml(piece.routeNodes[0].craftName)} → ${escapeHtml(piece.routeNodes[0].factoryName)} · 可交 ${pieceAvailableQty(store, order, piece.pieceKey)} 片</option>`).join('')}</select></label><div class="mt-3 grid gap-3 md:grid-cols-2"><label class="text-sm">本次交出片数<input type="number" min="1" step="1" class="mt-1 h-9 w-full rounded border px-3" data-wool-dialog-field="qty"></label><label class="text-sm">交出人<input class="mt-1 h-9 w-full rounded border px-3" value="Web 端毛织仓管" data-wool-dialog-field="operator"></label></div>${proofAndRemarkFields()}${renderHistorySummary(order)}`, available.length ? dialogFooter('save-handover', '确认交出外发片') : renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
  }
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
  const stageLabel = woolStageLabel(order.stage)
  return dialog(`${stageLabel}完单确认`, `
    ${renderOrderContext(order)}
    <div class="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">请核对全部 SKU 达到计划量，实际产出已交出且下游接收／差异已闭合。确认后该阶段不可继续填报。${order.stage === 'KNITTING' ? '横机完单只核对首工艺厂接收，不等待外加工回货或缝盘完单，并解除本单设备关联。' : ''}</div>
    <div class="grid gap-3 md:grid-cols-2"><section class="rounded border p-3"><h3 class="mb-3 font-medium">阶段数量</h3>${renderWoolStageQuantities(order)}</section><section class="rounded border p-3"><h3 class="mb-3 font-medium">投入与上游</h3>${renderWoolStageInputs(order)}</section><section class="rounded border p-3"><h3 class="mb-3 font-medium">加工与交接</h3>${renderWoolStageProgress(order)}${renderWoolStageOutputs(order)}</section><section class="rounded border p-3"><h3 class="mb-3 font-medium">时间核对</h3>${renderWoolStageTimes(order)}</section></div>
    <label class="mt-4 block text-sm"><span class="mb-1 block text-xs text-muted-foreground">完成确认备注</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wool-dialog-field="remark"></textarea></label>
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
    if (item.recordType === 'YARN_RECEIPT') continue // 人工收货只从统一收货入口修正。
    if (item.recordType === 'PROCESS_REPORT') {
      const record = item.record as WoolProcessReportRecord
      result.push({
        recordType: 'PROCESS_REPORT' as const,
        recordId: record.reportId,
        objectSkuCode: record.outputSkuCode,
        currentQty: effectiveReportQty(record),
        unit: order.outputPlanLines.find((line) => line.outputSkuCode === record.outputSkuCode)?.qtyUnit || '件',
        locked: Boolean(record.sourceReportId),
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
      locked: record.automatic || record.downstreamReceipt?.status === 'CONFIRMED',
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
  const labels: Record<WoolQtyChangeRecordType, string> = { YARN_RECEIPT: '纱线接收', PROCESS_REPORT: '加工填报', HANDOVER: '发起交出' }
  return dialog('修改记录数量', `<div class="overflow-hidden rounded-md border">${rows.map((row) => `<div class="grid grid-cols-[110px_1fr_120px_90px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"><span>${labels[row.recordType]}</span><span>${escapeHtml(row.objectSkuCode)}<span class="ml-2 text-xs text-muted-foreground">${escapeHtml(row.recordId)}</span></span><span>${formatQty(row.currentQty, row.unit)}</span>${row.locked ? '<span class="text-xs text-muted-foreground">自动来源／下游已确认</span>' : `<button type="button" class="rounded-md border px-2 py-1 text-xs" data-wool-work-orders-action="open-qty-edit" data-record-type="${row.recordType}" data-record-id="${escapeHtml(row.recordId)}" data-record-line-id="${escapeHtml(row.recordLineId || '')}" data-object-sku-code="${escapeHtml(row.objectSkuCode)}" data-current-qty="${row.currentQty}" data-unit="${escapeHtml(row.unit)}" data-skip-page-rerender="true">修改数量</button>`}</div>`).join('') || '<div class="p-4 text-sm text-muted-foreground">暂无可修改记录</div>'}</div>`, renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }))
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
    return Math.max(0, getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode).reportLimitQty - otherReportedQty)
  }
  if (overlay.recordType === 'HANDOVER') {
    const handover = readWoolStore().handovers.find(item => item.handoverId === overlay.recordId)
    if (handover?.pieceKey) return overlay.currentQty + pieceAvailableQty(readWoolStore(), order, handover.pieceKey)
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
  const pieceKey = order.stage === 'KNITTING' ? readDialogField('pieceKey') : undefined
  const piece = order.externalPieces.find(item => item.pieceKey === pieceKey)
  const outputSkuCode = piece?.skuCode || readDialogField('outputSkuCode')
  const handoverQty = Number(readDialogField('qty'))
  const availableQty = pieceKey ? pieceAvailableQty(readWoolStore(), order, pieceKey) : getWoolOutputHandoverAvailableQty(order.woolOrderId, outputSkuCode)
  if (handoverQty > availableQty) { showOverlayError(`最多可交出 ${availableQty}${pieceKey ? '片' : '件'}，请调整本次交出数量。`); return }
  runCommand(() => addWoolHandover(order.woolOrderId, {
    commandId: nextCommandId('HANDOVER', order.woolOrderId), pieceKey, outputSkuCode, handoverQty,
    proofFiles: readProofFiles(), remark: readDialogField('factRemark'), handedOverAt: nowText(), handedOverBy: readDialogField('operator'),
  }), order.stage === 'KNITTING' ? '外发片已交出至对应首工艺厂，等待接收确认。' : '最终交出已保存，等待指定下游接收。')
}

function saveComplete(order: WoolWorkOrder): void {
  runCommand(() => completeWoolWorkOrder(order.woolOrderId, {
    commandId: nextCommandId('COMPLETE', order.woolOrderId),
    completedAt: nowText(),
    completedBy: 'Web 端毛织主管',
    remark: readDialogField('remark'),
  }), order.stage === 'KNITTING' ? '横机加工单已完成，当前横机关联已解除。' : '缝盘加工单已完成。')
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

function exportCurrentRows(): void {
  const rows = rowsForActiveTab()
  if (!rows.length) { state.feedback = '当前查询条件下没有可导出的加工单。'; refreshResults(); return }
  const htmlText = (value: string) => { const node = document.createElement('div'); node.innerHTML = value.replace(/<\/(?:div|section)>/g, '</div>\n'); return node.textContent?.trim() || '' }
  const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`
  const exportColumns = columns.filter(column => column.key !== 'actions')
  const csv = [exportColumns.map(column => csvCell(column.title)).join(','), ...rows.map(row => exportColumns.map(column => csvCell(htmlText(column.render(row, 0)))).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `${woolStageLabel(currentStage)}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  state.feedback = `已导出当前查询条件下全部 ${rows.length} 条加工单。`; refreshResults()
}

export async function handleCraftWoolStageOrdersEvent(target: HTMLElement): Promise<boolean> {
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
    if (name === 'processingStatus') state.activeTab = (field.value || 'ALL') as WoolWorkOrderTab
    if (field instanceof HTMLInputElement && ['keyword', 'productionOrderNo', 'woolOrderNo', 'factory', 'yarnSku', 'outputSku', 'sourceCraft'].includes(name)) {
      if (filterDebounce) clearTimeout(filterDebounce)
      filterDebounce = setTimeout(refreshResults, 40)
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
    state.filters.processingStatus = state.activeTab === 'ALL' ? '' : state.activeTab
    const statusField = root.querySelector<HTMLSelectElement>('[data-wool-work-orders-field="processingStatus"]')
    if (statusField) statusField.value = state.filters.processingStatus
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
  if (action === 'query') { state.currentPage = 1; refreshResults(); return true }
  if (action === 'export') { exportCurrentRows(); return true }
  if (action === 'reset-filters') {
    state.filters = { ...DEFAULT_FILTERS }
    state.activeTab = 'ALL'
    state.currentPage = 1
    const filters = root.querySelector<HTMLElement>('[data-wool-work-orders-filters]')
    if (filters) filters.innerHTML = renderFilters()
    refreshResults()
    return true
  }
  if (action === 'open-report' && order) openOverlay('report', order.woolOrderId)
  if (action === 'open-handover' && order) openOverlay('handover', order.woolOrderId)
  if (action === 'open-complete' && order) openOverlay('complete', order.woolOrderId)
  if (action === 'open-qty-list' && order) openOverlay('qty-list', order.woolOrderId)
  if (['open-report', 'open-handover', 'open-complete', 'open-qty-list'].includes(action)) return true
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
  if (action === 'save-report') saveReport(order)
  if (action === 'save-handover') saveHandover(order)
  if (action === 'save-complete') saveComplete(order)
  if (action === 'save-qty' && state.overlay?.kind === 'qty-edit') saveQty(state.overlay)
  return true
}
