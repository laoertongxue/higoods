import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { productionOrders } from '../data/fcs/production-orders'
import {
  findPdaHandoverRecord,
  followupPdaHandoverObjection,
  getPdaCompletedHeads,
  getPdaHandoutHeads,
  getPdaPickupRecordsByHead,
  getPdaPickupHeads,
  markPdaHandoutHeadCompleted,
  markPdaPickupHeadCompleted,
  resolvePdaHandoverObjection,
  writeBackHandoverRecord,
  type PdaHandoverHead,
  type PdaHandoverHeadType,
} from '../data/fcs/pda-handover-events'
import {
  getRecordReceiverWrittenAt,
  getRecordReceiverWrittenQty,
  getReceiverDisplayName,
} from '../data/fcs/task-handover-domain'
import {
  buildHandoverOrderDetailLink,
  type HandoverFocus,
  getHandoverOrderTimelineViews,
  getHandoverLedgerRows,
  getProductionOrderHandoverSummary,
  getHandoverPreviewStats,
  type HandoverLedgerRow,
  type HandoverOrderTimelineView,
  type HandoverTimelineProcessSection,
  type HandoverLedgerStatusGroup,
  type HandoverLedgerStatusTone,
} from '../data/fcs/handover-ledger-view'
import {
  buildHandoverOrderLink,
  buildProductionOrderLink,
  buildQualityRecordLink,
  buildTaskDeliveryCardPrintLink,
  buildTaskDetailLink,
} from '../data/fcs/fcs-route-links.ts'
import {
  getPostExecutionModeLabel,
  getPostProcessRouteByProductionOrderId,
  getPostRouteNodeLabel,
} from '../data/fcs/post-process-route'
import { getQcViewRows } from './qc-records/context'

type HandoverTab = 'events' | 'orders'
type DiffFilter = 'ALL' | 'YES' | 'NO'
type LedgerEventTypeFilter = 'ALL' | 'PICKUP' | 'HANDOUT' | 'WAREHOUSE' | 'OBJECTION' | 'COMPLETED'
type LedgerStatusFilter =
  | 'ALL'
  | 'PENDING_PICKUP'
  | 'PENDING_HANDOUT'
  | 'PENDING_WAREHOUSE'
  | 'HAS_OBJECTION'
  | 'OBJECTION_PROCESSING'
  | 'OBJECTION_RESOLVED'
  | 'DONE'
  | HandoverLedgerStatusGroup

interface ProgressHandoverState {
  lastQueryKey: string

  keyword: string
  filterPo: string
  filterProcess: string
  filterTaskId: string
  filterEventType: LedgerEventTypeFilter
  filterStatus: LedgerStatusFilter
  filterHasDiff: DiffFilter
  showUrlFilterBanner: boolean
  focusHint: HandoverFocus | ''
  sourceHint: string

  activeTab: HandoverTab
  timelineExpandedOrderIds: string[]
  timelineAnchorOrderId: string
  timelineAnchorTaskId: string
  timelineAnchorFocus: HandoverFocus | ''
  timelineScrollTargetOrderId: string

  ordersKeyword: string
  ordersBottleneckFilter:
    | 'ALL'
    | '待领料'
    | '待交出'
    | '待接收方回写'
    | '有异议'
    | '异议处理中'
    | '已完成'
    | '暂无事件'
  ordersObjectionFilter: 'ALL' | 'YES' | 'NO'
  ordersProcessFilter: string
  ordersPage: number
  ordersPageSize: number

  rowMenuRowId: string | null
  detailRowId: string | null

  writebackRecordId: string | null
  writebackReturnNo: string
  writebackQty: string
  writebackAt: string
  objectionRecordId: string | null
  objectionFollowUpRemark: string
}

const state: ProgressHandoverState = {
  lastQueryKey: '',

  keyword: '',
  filterPo: '',
  filterProcess: '',
  filterTaskId: '',
  filterEventType: 'ALL',
  filterStatus: 'ALL',
  filterHasDiff: 'ALL',
  showUrlFilterBanner: false,
  focusHint: '',
  sourceHint: '',

  activeTab: 'events',
  timelineExpandedOrderIds: [],
  timelineAnchorOrderId: '',
  timelineAnchorTaskId: '',
  timelineAnchorFocus: '',
  timelineScrollTargetOrderId: '',

  ordersKeyword: '',
  ordersBottleneckFilter: 'ALL',
  ordersObjectionFilter: 'ALL',
  ordersProcessFilter: '',
  ordersPage: 1,
  ordersPageSize: 10,

  rowMenuRowId: null,
  detailRowId: null,

  writebackRecordId: null,
  writebackReturnNo: '',
  writebackQty: '',
  writebackAt: getCurrentLocalDateTimeInput(),
  objectionRecordId: null,
  objectionFollowUpRemark: '',
}

const LEDGER_EVENT_FILTER_OPTIONS: Array<{ value: LedgerEventTypeFilter; label: string }> = [
  { value: 'ALL', label: '事件类型' },
  { value: 'PICKUP', label: '领料' },
  { value: 'HANDOUT', label: '交出' },
  { value: 'WAREHOUSE', label: '接收方回写' },
  { value: 'OBJECTION', label: '数量异议' },
  { value: 'COMPLETED', label: '已完成' },
]

const LEDGER_STATUS_FILTER_OPTIONS: Array<{ value: LedgerStatusFilter; label: string }> = [
  { value: 'ALL', label: '当前状态' },
  { value: 'PENDING_PICKUP', label: '待领料' },
  { value: 'PENDING_HANDOUT', label: '待交出' },
  { value: 'PENDING_WAREHOUSE', label: '待接收方回写' },
  { value: 'HAS_OBJECTION', label: '有异议' },
  { value: 'OBJECTION_PROCESSING', label: '异议处理中' },
  { value: 'OBJECTION_RESOLVED', label: '异议已处理' },
  { value: 'DONE', label: '已完成' },
]

const ORDER_BOTTLENECK_FILTER_OPTIONS: Array<{
  value:
    | 'ALL'
    | '待领料'
    | '待交出'
    | '待接收方回写'
    | '有异议'
    | '异议处理中'
    | '已完成'
    | '暂无事件'
  label: string
}> = [
  { value: 'ALL', label: '当前交接卡点' },
  { value: '待领料', label: '待领料' },
  { value: '待交出', label: '待交出' },
  { value: '待接收方回写', label: '待接收方回写' },
  { value: '有异议', label: '有异议' },
  { value: '异议处理中', label: '异议处理中' },
  { value: '已完成', label: '已完成' },
  { value: '暂无事件', label: '暂无事件' },
]

const LEDGER_STATUS_CONFIG: Record<HandoverLedgerStatusTone, { className: string; icon: string }> = {
  muted: { className: 'bg-zinc-100 text-zinc-700 border-zinc-200', icon: 'circle' },
  warning: { className: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'clock' },
  info: { className: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'activity' },
  success: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'check-circle' },
  danger: { className: 'bg-red-100 text-red-700 border-red-200', icon: 'alert-circle' },
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function getCurrentLocalDateTimeInput(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function isLedgerEventType(value: string | null): value is LedgerEventTypeFilter {
  return value === 'ALL' || value === 'PICKUP' || value === 'HANDOUT' || value === 'WAREHOUSE' || value === 'OBJECTION' || value === 'COMPLETED'
}

function isLedgerStatusFilter(value: string | null): value is LedgerStatusFilter {
  return (
    value === 'ALL' ||
    value === 'PENDING_PICKUP' ||
    value === 'PENDING_HANDOUT' ||
    value === 'PENDING_WAREHOUSE' ||
    value === 'HAS_OBJECTION' ||
    value === 'OBJECTION_PROCESSING' ||
    value === 'OBJECTION_RESOLVED' ||
    value === 'DONE' ||
    value === 'PENDING' ||
    value === 'IN_PROGRESS' ||
    value === 'EXCEPTION'
  )
}

function isHandoverFocus(value: string | null): value is HandoverFocus {
  return value === 'pickup' || value === 'handout' || value === 'warehouse-confirm' || value === 'objection'
}

function getFocusLabel(focus: HandoverFocus): string {
  if (focus === 'pickup') return '待领料'
  if (focus === 'handout') return '待交出'
  if (focus === 'warehouse-confirm') return '待接收方回写'
  return '异议处理'
}

function showProgressHandoverToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-handover-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    tone === 'error'
      ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
      : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'

  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'

    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function getOrderById(orderId: string) {
  return productionOrders.find((item) => item.productionOrderId === orderId)
}

function closeRowMenu(): void {
  state.rowMenuRowId = null
}

function getLedgerRows(): HandoverLedgerRow[] {
  return getHandoverLedgerRows()
}

function getLedgerRowById(rowId: string): HandoverLedgerRow | undefined {
  return getLedgerRows().find((row) => row.rowId === rowId)
}

function findOrderIdByTaskId(taskId: string): string {
  if (!taskId) return ''
  const row = getLedgerRows().find((item) => item.taskId === taskId)
  return row?.productionOrderId || ''
}

function getEventTypeLabel(value: LedgerEventTypeFilter): string {
  return LEDGER_EVENT_FILTER_OPTIONS.find((item) => item.value === value)?.label || value
}

function getStatusFilterLabel(value: LedgerStatusFilter): string {
  if (value === 'PENDING') return '待处理'
  if (value === 'IN_PROGRESS') return '处理中'
  if (value === 'EXCEPTION') return '异议处理中'
  return LEDGER_STATUS_FILTER_OPTIONS.find((item) => item.value === value)?.label || value
}

function matchEventTypeFilter(row: HandoverLedgerRow, filter: LedgerEventTypeFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'PICKUP') {
    return row.sourceType === 'PICKUP_HEAD' || row.sourceType === 'PICKUP_RECORD'
  }
  if (filter === 'HANDOUT') {
    return row.sourceType === 'HANDOUT_HEAD' || row.sourceType === 'HANDOUT_RECORD'
  }
  if (filter === 'WAREHOUSE') {
    return row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK' || row.eventTypeCode === 'WAREHOUSE_CONFIRMED'
  }
  if (filter === 'OBJECTION') {
    return row.eventTypeCode === 'HANDOUT_OBJECTION' || row.eventTypeCode === 'HANDOUT_OBJECTION_PROCESSING' || row.eventTypeCode === 'HANDOUT_OBJECTION_RESOLVED'
  }
  if (filter === 'COMPLETED') {
    return row.sourceType === 'COMPLETED_HEAD'
  }
  return true
}

function normalizeStatusFilter(value: string | null): LedgerStatusFilter {
  if (!value) return 'ALL'
  if (isLedgerStatusFilter(value)) return value
  return 'ALL'
}

function matchStatusFilter(row: HandoverLedgerRow, filter: LedgerStatusFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'DONE') return row.statusGroup === 'DONE'
  if (filter === 'PENDING_PICKUP') {
    return row.statusCode === 'PICKUP_PENDING' || row.statusCode === 'PICKUP_RECORD_PENDING_DISPATCH' || row.statusCode === 'PICKUP_RECORD_PENDING_PICKUP'
  }
  if (filter === 'PENDING_HANDOUT') {
    return row.statusCode === 'HANDOUT_PENDING' || row.statusCode === 'HANDOUT_SUBMITTED'
  }
  if (filter === 'PENDING_WAREHOUSE') {
    return row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK' || row.statusCode === 'HANDOUT_PARTIAL_WRITTEN' || row.statusCode === 'HANDOUT_WRITTEN'
  }
  if (filter === 'HAS_OBJECTION') {
    return row.statusCode === 'HANDOUT_HAS_OBJECTION' || row.statusCode === 'HANDOUT_OBJECTION_REPORTED'
  }
  if (filter === 'OBJECTION_PROCESSING') {
    return row.statusCode === 'HANDOUT_OBJECTION_PROCESSING'
  }
  if (filter === 'OBJECTION_RESOLVED') {
    return row.statusCode === 'HANDOUT_OBJECTION_RESOLVED'
  }
  if (filter === 'PENDING' || filter === 'IN_PROGRESS' || filter === 'EXCEPTION') {
    return row.statusGroup === filter
  }
  return true
}

function hasDiffOrObjection(row: HandoverLedgerRow): boolean {
  if (typeof row.qtyDiff === 'number' && row.qtyDiff !== 0) return true
  return (
    row.statusCode === 'HANDOUT_HAS_OBJECTION' ||
    row.statusCode === 'HANDOUT_OBJECTION_REPORTED' ||
    row.statusCode === 'HANDOUT_OBJECTION_PROCESSING' ||
    row.statusCode === 'HANDOUT_OBJECTION_RESOLVED'
  )
}

function syncFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey

  const params = getCurrentSearchParams()
  const po = params.get('po') || ''
  const process = params.get('process') || ''
  const taskId = params.get('taskId') || ''
  const eventType = params.get('eventType')
  const status = params.get('status')
  const focus = params.get('focus')
  const source = params.get('source') || ''
  const tab = params.get('tab')
  const isOrdersTab = tab === 'timeline' || tab === 'orders'
  const anchorOrderId = po || findOrderIdByTaskId(taskId)

  if (isOrdersTab && (po || taskId || focus)) {
    state.filterPo = ''
    state.filterTaskId = ''
    state.filterProcess = process
    state.timelineAnchorOrderId = anchorOrderId
    state.timelineAnchorTaskId = taskId
    state.timelineAnchorFocus = isHandoverFocus(focus) ? focus : ''
    if (anchorOrderId) {
      state.timelineScrollTargetOrderId = anchorOrderId
      if (!state.timelineExpandedOrderIds.includes(anchorOrderId)) {
        state.timelineExpandedOrderIds = [...state.timelineExpandedOrderIds, anchorOrderId]
      }
    }
  } else {
    state.filterPo = po
    state.filterProcess = process
    state.filterTaskId = taskId
    state.timelineAnchorOrderId = ''
    state.timelineAnchorTaskId = ''
    state.timelineAnchorFocus = ''
  }

  state.filterEventType = isLedgerEventType(eventType) ? eventType : 'ALL'
  state.filterStatus = normalizeStatusFilter(status)
  state.focusHint = isHandoverFocus(focus) ? focus : ''
  state.sourceHint = source

  if (tab === 'timeline' || tab === 'orders') {
    state.activeTab = 'orders'
  } else if (tab === 'list' || tab === 'events') {
    state.activeTab = 'events'
  }

  if (!eventType && state.focusHint && !(isOrdersTab && (po || taskId || focus))) {
    if (state.focusHint === 'pickup') state.filterEventType = 'PICKUP'
    if (state.focusHint === 'handout') state.filterEventType = 'HANDOUT'
    if (state.focusHint === 'warehouse-confirm') {
      state.filterEventType = 'WAREHOUSE'
      if (state.filterStatus === 'ALL') state.filterStatus = 'PENDING_WAREHOUSE'
    }
    if (state.focusHint === 'objection') {
      state.filterEventType = 'OBJECTION'
      if (state.filterStatus === 'ALL') state.filterStatus = 'HAS_OBJECTION'
    }
  }

  state.showUrlFilterBanner = Boolean(
    po ||
      process ||
      taskId ||
      eventType ||
      status ||
      focus ||
      source ||
      tab ||
      state.timelineAnchorOrderId ||
      state.timelineAnchorTaskId,
  )
}

function getFilteredRows(rows: HandoverLedgerRow[]): HandoverLedgerRow[] {
  return rows.filter((row) => {
    const keyword = state.keyword.trim().toLowerCase()
    if (keyword) {
      const combined = `${row.rowId} ${row.productionOrderId} ${row.taskNo} ${row.processName} ${row.eventTypeLabel} ${row.handoverId} ${row.recordId || ''}`.toLowerCase()
      if (!combined.includes(keyword)) return false
    }

    if (state.filterPo && row.productionOrderId !== state.filterPo) return false
    if (state.filterProcess && row.processName !== state.filterProcess) return false
    if (state.filterTaskId && row.taskId !== state.filterTaskId) return false
    if (!matchEventTypeFilter(row, state.filterEventType)) return false
    if (!matchStatusFilter(row, state.filterStatus)) return false
    if (state.filterHasDiff === 'YES' && !hasDiffOrObjection(row)) return false
    if (state.filterHasDiff === 'NO' && hasDiffOrObjection(row)) return false

    return true
  })
}

function getTimelineBaseRows(rows: HandoverLedgerRow[]): HandoverLedgerRow[] {
  return rows.filter((row) => {
    if (state.filterPo && row.productionOrderId !== state.filterPo) return false
    if (state.filterTaskId && row.taskId !== state.filterTaskId) return false
    return true
  })
}

function findPdaHeadByHandoverId(handoverId: string): PdaHandoverHead | undefined {
  return [...getPdaPickupHeads(), ...getPdaHandoutHeads(), ...getPdaCompletedHeads()].find(
    (head) => head.handoverId === handoverId,
  )
}

function renderSourceFacts(row: HandoverLedgerRow): string {
  const head = findPdaHeadByHandoverId(row.handoverId)
  if (!head) {
    return `<p class="text-sm text-muted-foreground">当前未找到原始事实记录，请刷新后重试。</p>`
  }

  if (row.sourceType === 'PICKUP_HEAD' || (row.sourceType === 'COMPLETED_HEAD' && head.headType === 'PICKUP')) {
    const firstPickupRecord = getPdaPickupRecordsByHead(row.handoverId)[0]
    const pickupModeLabel = firstPickupRecord?.pickupModeLabel || '-'
    return `
      <div class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">事实来源：</span>领料单</p>
        <p><span class="text-muted-foreground">领料方式：</span>${escapeHtml(pickupModeLabel)}</p>
        <p><span class="text-muted-foreground">记录数：</span>${head.recordCount} 次</p>
        <p><span class="text-muted-foreground">累计已领：</span>${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</p>
        <p><span class="text-muted-foreground">待完成记录：</span>${head.pendingWritebackCount} 条</p>
      </div>
    `
  }

  if (row.sourceType === 'PICKUP_RECORD' && row.recordId) {
    const pickupRecord = getPdaPickupRecordsByHead(row.handoverId).find((record) => record.recordId === row.recordId)
    if (!pickupRecord) {
      return `<p class="text-sm text-muted-foreground">当前未找到对应领料记录，请刷新后重试。</p>`
    }

    return `
      <div class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">事实来源：</span>领料记录</p>
        <p><span class="text-muted-foreground">记录编号：</span>${escapeHtml(pickupRecord.recordId)}</p>
        <p><span class="text-muted-foreground">计划数量：</span>${pickupRecord.qtyExpected} ${escapeHtml(pickupRecord.qtyUnit)}</p>
        <p><span class="text-muted-foreground">实际数量：</span>${
          typeof pickupRecord.qtyActual === 'number'
            ? `${pickupRecord.qtyActual} ${escapeHtml(pickupRecord.qtyUnit)}`
            : '待确认'
        }</p>
        <p><span class="text-muted-foreground">记录时间：</span>${escapeHtml(pickupRecord.submittedAt)}</p>
      </div>
    `
  }

  if (row.sourceType === 'HANDOUT_HEAD' || (row.sourceType === 'COMPLETED_HEAD' && head.headType === 'HANDOUT')) {
    return `
      <div class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">事实来源：</span>交出单</p>
        <p><span class="text-muted-foreground">交出次数：</span>${head.recordCount} 次</p>
        <p><span class="text-muted-foreground">累计回写：</span>${head.qtyActualTotal} ${escapeHtml(head.qtyUnit)}</p>
        <p><span class="text-muted-foreground">待回写：</span>${head.pendingWritebackCount} 条</p>
        <p><span class="text-muted-foreground">异议条数：</span>${head.objectionCount} 条</p>
      </div>
    `
  }

  if (row.sourceType === 'HANDOUT_RECORD' && row.recordId) {
    const handoutRecord = findPdaHandoverRecord(row.recordId)
    if (!handoutRecord) {
      return `<p class="text-sm text-muted-foreground">当前未找到对应交出记录，请刷新后重试。</p>`
    }

    return `
      <div class="space-y-1 text-sm">
        <p><span class="text-muted-foreground">事实来源：</span>交出记录</p>
        <p><span class="text-muted-foreground">记录编号：</span>${escapeHtml(handoutRecord.recordId)}（第 ${handoutRecord.sequenceNo} 次）</p>
        <p><span class="text-muted-foreground">工厂发起：</span>${escapeHtml(handoutRecord.factorySubmittedAt)}</p>
        <p><span class="text-muted-foreground">接收方回写：</span>${
          typeof getRecordReceiverWrittenQty(handoutRecord) === 'number'
            ? `${getRecordReceiverWrittenQty(handoutRecord)} ${escapeHtml(head.qtyUnit)}`
            : '待回写'
        }</p>
        <p><span class="text-muted-foreground">异议状态：</span>${
          handoutRecord.status === 'OBJECTION_REPORTED'
            ? '已发起异议'
            : handoutRecord.status === 'OBJECTION_PROCESSING'
              ? '异议处理中'
              : handoutRecord.status === 'OBJECTION_RESOLVED'
                ? '异议已处理'
                : '无'
        }</p>
      </div>
    `
  }

  return `<p class="text-sm text-muted-foreground">当前来源明细已同步，请前往关联模块继续处理。</p>`
}

function renderCurrentStatusText(row: HandoverLedgerRow): string {
  if (row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK') return '接收方还未回写实收数量，先等待回写。'
  if (row.statusCode === 'HANDOUT_OBJECTION_REPORTED') return '工厂已发起异议，待平台跟进。'
  if (row.statusCode === 'HANDOUT_OBJECTION_PROCESSING') return '平台正在跟进异议，等待处理结论。'
  if (row.statusCode === 'HANDOUT_OBJECTION_RESOLVED') return '异议已处理完成，可继续关注是否完成。'
  if (row.statusCode === 'PICKUP_PENDING') return '当前任务还没开始领料，先推进领料。'
  if (row.statusCode === 'HANDOUT_PENDING') return '当前任务还没发起交出记录，先推进交出。'
  if (row.statusCode === 'HEAD_COMPLETED') return '当前交接已关闭，这条链路无需额外处理。'
  return '当前状态正常，按下一步建议继续跟进。'
}

function buildExceptionHrefByRow(row: HandoverLedgerRow): string {
  const params = new URLSearchParams()
  params.set('po', row.productionOrderId)
  if (row.taskId) {
    params.set('taskId', row.taskId)
  }
  if (row.statusGroup === 'EXCEPTION') {
    params.set('reasonCode', 'HANDOVER_DIFF')
  }
  return `/fcs/progress/exceptions?${params.toString()}`
}

function renderBadge(label: string, className: string, icon?: string): string {
  return `
    <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">
      ${icon ? `<i data-lucide="${icon}" class="h-3 w-3"></i>` : ''}
      <span class="${icon ? 'ml-1' : ''}">${escapeHtml(label)}</span>
    </span>
  `
}

function renderStatusBadge(row: HandoverLedgerRow): string {
  const config = LEDGER_STATUS_CONFIG[row.statusTone]
  return renderBadge(row.statusLabel, config.className, config.icon)
}

function renderHeader(): string {
  return `
    <header class="flex items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="scan-line" class="h-5 w-5"></i>
          交接链路追踪
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex rounded-md border">
          <button
            class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.activeTab === 'events' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
            data-handover-action="switch-dimension"
            data-dimension="events"
          >
            <i data-lucide="list" class="mr-1.5 h-4 w-4"></i>事件维度
          </button>
          <button
            class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.activeTab === 'orders' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
            data-handover-action="switch-dimension"
            data-dimension="orders"
          >
            <i data-lucide="layers" class="mr-1.5 h-4 w-4"></i>生产单维度
          </button>
        </div>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="export">
          <i data-lucide="download" class="mr-1.5 h-4 w-4"></i>导出
        </button>
      </div>
    </header>
  `
}

function renderUrlBanner(): string {
  if (!state.showUrlFilterBanner) return ''

  return `
    <section class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
      <div class="flex flex-wrap items-center gap-2 text-sm text-blue-700">
        <i data-lucide="alert-triangle" class="h-4 w-4"></i>
        <span>来自其他页面的筛选条件</span>
        ${state.filterPo ? renderBadge(`生产单: ${state.filterPo}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.filterProcess ? renderBadge(`工序: ${state.filterProcess}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.filterTaskId ? renderBadge(`任务: ${state.filterTaskId}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${
          state.timelineAnchorOrderId
            ? renderBadge(`定位生产单: ${state.timelineAnchorOrderId}`, 'bg-white text-blue-700 border-blue-200')
            : ''
        }
        ${
          state.timelineAnchorTaskId
            ? renderBadge(`定位任务: ${state.timelineAnchorTaskId}`, 'bg-white text-blue-700 border-blue-200')
            : ''
        }
        ${state.filterEventType !== 'ALL' ? renderBadge(`类型: ${getEventTypeLabel(state.filterEventType)}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.filterStatus !== 'ALL' ? renderBadge(`状态: ${getStatusFilterLabel(state.filterStatus)}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.focusHint ? renderBadge(`聚焦: ${getFocusLabel(state.focusHint)}`, 'bg-white text-blue-700 border-blue-200') : ''}
        ${state.sourceHint ? renderBadge(`来源: ${state.sourceHint}`, 'bg-white text-blue-700 border-blue-200') : ''}
      </div>
      <button class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-white hover:bg-blue-100" data-handover-action="clear-filters" aria-label="清除筛选">
        <i data-lucide="x" class="h-4 w-4"></i>
      </button>
    </section>
  `
}

function renderEventsPreviewCards(rows: HandoverLedgerRow[]): string {
  const stats = getHandoverPreviewStats(rows)

  return `
    <section class="grid gap-4 md:grid-cols-4">
      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterEventType === 'PICKUP' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-preview-filter"
        data-filter-type="PICKUP"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="package" class="h-4 w-4 text-amber-500"></i>
          待领料
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.pendingPickupHeads}</p>
      </button>

      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterEventType === 'HANDOUT' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-preview-filter"
        data-filter-type="HANDOUT"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="truck" class="h-4 w-4 text-blue-500"></i>
          待交出
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.pendingHandoutHeads}</p>
      </button>

      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterEventType === 'WAREHOUSE' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-preview-filter"
        data-filter-type="WAREHOUSE"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="clipboard-check" class="h-4 w-4 text-yellow-500"></i>
          待接收方回写
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.pendingWarehouseConfirm}</p>
      </button>

      <button
        class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40 ${state.filterEventType === 'OBJECTION' ? 'ring-2 ring-primary' : ''}"
        data-handover-action="toggle-preview-filter"
        data-filter-type="OBJECTION"
      >
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="alert-circle" class="h-4 w-4 text-red-500"></i>
          待处理异议
        </p>
        <p class="mt-2 text-2xl font-bold text-red-600">${stats.pendingObjections}</p>
      </button>
    </section>
  `
}

function getProductionOrderFilterOptions(rows: HandoverLedgerRow[]): string[] {
  const orderIds = new Set<string>()
  rows.forEach((row) => orderIds.add(row.productionOrderId))
  return Array.from(orderIds).sort((a, b) => a.localeCompare(b))
}

function getProcessFilterOptions(rows: HandoverLedgerRow[]): string[] {
  const processes = new Set<string>()
  rows.forEach((row) => {
    if (row.processName) processes.add(row.processName)
  })
  return Array.from(processes).sort((a, b) => a.localeCompare(b))
}

function renderEventsFilters(rows: HandoverLedgerRow[]): string {
  const orderOptions = getProductionOrderFilterOptions(rows)
  const processOptions = getProcessFilterOptions(rows)

  return `
    <section class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
      <div class="min-w-[220px] flex-1">
        <div class="relative">
          <i data-lucide="search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
            placeholder="搜索生产单/任务/工序/记录编号"
            value="${escapeAttr(state.keyword)}"
            data-handover-field="keyword"
          />
        </div>
      </div>

      <select class="h-9 w-[210px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterPo">
        <option value="">生产单</option>
        ${orderOptions
          .map(
            (item) =>
              `<option value="${escapeAttr(item)}" ${state.filterPo === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
          )
          .join('')}
      </select>

      <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterProcess">
        <option value="">工序工艺</option>
        ${processOptions
          .map(
            (item) =>
              `<option value="${escapeAttr(item)}" ${state.filterProcess === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
          )
          .join('')}
      </select>

      <select class="h-9 w-[190px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterEventType">
        ${LEDGER_EVENT_FILTER_OPTIONS.map((item) => `<option value="${item.value}" ${state.filterEventType === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
      </select>

      <select class="h-9 w-[190px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterStatus">
        ${LEDGER_STATUS_FILTER_OPTIONS.map((item) => `<option value="${item.value}" ${state.filterStatus === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
      </select>

      <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-handover-field="filterHasDiff">
        <option value="ALL" ${state.filterHasDiff === 'ALL' ? 'selected' : ''}>差异/异议</option>
        <option value="YES" ${state.filterHasDiff === 'YES' ? 'selected' : ''}>有差异/异议</option>
        <option value="NO" ${state.filterHasDiff === 'NO' ? 'selected' : ''}>无差异/异议</option>
      </select>

      <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="clear-filters">重置</button>
    </section>
  `
}

function renderRowActionMenu(row: HandoverLedgerRow): string {
  const isOpen = state.rowMenuRowId === row.rowId
  const canWriteback = row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK' && Boolean(row.recordId)
  const canHandleObjection =
    (row.statusCode === 'HANDOUT_OBJECTION_REPORTED' || row.statusCode === 'HANDOUT_OBJECTION_PROCESSING') &&
    Boolean(row.recordId)
  const canMarkPickupComplete = row.sourceType === 'PICKUP_HEAD'
  const canMarkHandoutComplete = row.sourceType === 'HANDOUT_HEAD'
  const canPrintDeliveryCard = row.sourceType === 'HANDOUT_RECORD' && Boolean(row.recordId)

  let primaryAction = ''
  if (canWriteback) {
    primaryAction = `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-writeback-dialog" data-record-id="${escapeAttr(
      row.recordId || '',
    )}"><i data-lucide="clipboard-check" class="mr-2 h-4 w-4"></i>接收方回写</button>`
  } else if (canHandleObjection) {
    primaryAction = `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-objection-dialog" data-record-id="${escapeAttr(
      row.recordId || '',
    )}"><i data-lucide="message-square" class="mr-2 h-4 w-4"></i>处理异议</button>`
  } else if (canMarkPickupComplete) {
    primaryAction = `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="mark-pickup-complete" data-handover-id="${escapeAttr(
      row.handoverId,
    )}"><i data-lucide="check-check" class="mr-2 h-4 w-4"></i>标记领料完成</button>`
  } else if (canMarkHandoutComplete) {
    primaryAction = `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="mark-handout-complete" data-handover-id="${escapeAttr(
      row.handoverId,
    )}"><i data-lucide="check-check" class="mr-2 h-4 w-4"></i>标记交出完成</button>`
  }

  return `
    <div class="relative inline-flex" data-handover-stop="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-handover-action="toggle-row-menu" data-row-id="${escapeAttr(row.rowId)}">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-20 min-w-[180px] rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="open-detail" data-row-id="${escapeAttr(row.rowId)}">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>查看详情
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="goto-task" data-task-id="${escapeAttr(row.taskId)}">
                <i data-lucide="list-checks" class="mr-2 h-4 w-4"></i>去任务看板
              </button>
              ${
                canPrintDeliveryCard
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="print-delivery-card" data-handover-id="${escapeAttr(row.handoverId)}" data-record-id="${escapeAttr(row.recordId || '')}">
                      <i data-lucide="printer" class="mr-2 h-4 w-4"></i>打印任务交货卡
                    </button>`
                  : ''
              }
              ${primaryAction}
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-handover-action="view-exception" data-row-id="${escapeAttr(row.rowId)}">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>去异常定位与处理
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderLedgerTable(rows: HandoverLedgerRow[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">事件类型</th>
              <th class="px-3 py-2 font-medium">生产单</th>
              <th class="px-3 py-2 font-medium">关联任务/工序</th>
              <th class="px-3 py-2 font-medium">数量情况</th>
              <th class="px-3 py-2 font-medium">当前状态</th>
              <th class="px-3 py-2 font-medium">来源模块</th>
              <th class="px-3 py-2 font-medium">下一步</th>
              <th class="px-3 py-2 font-medium">发生时间</th>
              <th class="px-3 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-3 py-10 text-center text-muted-foreground">当前筛选条件下暂无交接事件</td>
                  </tr>
                `
                : rows
                    .map(
                      (row) => `
                        <tr class="border-b">
                          <td class="px-3 py-2">
                            <div class="inline-flex items-center gap-1.5 text-xs">
                              <i data-lucide="workflow" class="h-3.5 w-3.5 text-muted-foreground"></i>
                              <span>${escapeHtml(row.eventTypeLabel)}</span>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <button class="inline-flex items-center text-xs text-primary hover:underline" data-handover-action="goto-order" data-order-id="${escapeAttr(row.productionOrderId)}">
                              ${escapeHtml(row.productionOrderId)}
                            </button>
                          </td>
                          <td class="px-3 py-2 text-xs">
                            <div>
                              <button class="inline-flex items-center text-primary hover:underline" data-handover-action="goto-task" data-task-id="${escapeAttr(row.taskId)}">${escapeHtml(row.taskNo)}</button>
                            </div>
                            <div class="text-muted-foreground">${escapeHtml(row.processName)}</div>
                          </td>
                          <td class="px-3 py-2 text-xs">
                            <div>${escapeHtml(row.qtySummary)}</div>
                            <div class="text-muted-foreground">${escapeHtml(row.directionLabel)}</div>
                          </td>
                          <td class="px-3 py-2">${renderStatusBadge(row)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(row.sourceModuleLabel)}</td>
                          <td class="px-3 py-2 text-xs">
                            <span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-muted-foreground">${escapeHtml(row.nextActionHint)}</span>
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(row.occurredAt || '-')}</td>
                          <td class="px-3 py-2 text-right">${renderRowActionMenu(row)}</td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderEventsDimension(rows: HandoverLedgerRow[], allRows: HandoverLedgerRow[]): string {
  return `
    <div class="space-y-4">
      ${renderEventsPreviewCards(allRows)}
      ${renderEventsFilters(allRows)}
      ${renderLedgerTable(rows)}
    </div>
  `
}

function isToday(value: string): boolean {
  const time = parseDateMs(value)
  if (!Number.isFinite(time)) return false
  const now = new Date()
  const target = new Date(time)
  return (
    now.getFullYear() === target.getFullYear() &&
    now.getMonth() === target.getMonth() &&
    now.getDate() === target.getDate()
  )
}

function getOrdersPreviewStats(views: HandoverOrderTimelineView[]): {
  totalOrders: number
  pendingOrders: number
  objectionOrders: number
  todayOrders: number
} {
  return {
    totalOrders: views.length,
    pendingOrders: views.filter((view) => view.pendingCount > 0 || view.currentBottleneckLabel !== '全部完成').length,
    objectionOrders: views.filter((view) => view.objectionCount > 0).length,
    todayOrders: views.filter((view) => isToday(view.latestOccurredAt)).length,
  }
}

function renderOrdersPreviewCards(views: HandoverOrderTimelineView[]): string {
  const stats = getOrdersPreviewStats(views)
  return `
    <section class="grid gap-4 md:grid-cols-4">
      <article class="rounded-lg border bg-card p-4">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="layers" class="h-4 w-4 text-blue-500"></i>
          有交接事件的生产单
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.totalOrders}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="timer" class="h-4 w-4 text-amber-500"></i>
          有待处理交接事件
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.pendingOrders}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="alert-circle" class="h-4 w-4 text-red-500"></i>
          有异议生产单
        </p>
        <p class="mt-2 text-2xl font-bold text-red-600">${stats.objectionOrders}</p>
      </article>
      <article class="rounded-lg border bg-card p-4">
        <p class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <i data-lucide="calendar-days" class="h-4 w-4 text-emerald-500"></i>
          今日有新增交接事件
        </p>
        <p class="mt-2 text-2xl font-bold">${stats.todayOrders}</p>
      </article>
    </section>
  `
}

function getOrderProcessFilterOptions(views: HandoverOrderTimelineView[]): string[] {
  const options = new Set<string>()
  views.forEach((view) => {
    view.processSections.forEach((section) => {
      if (section.processName && section.processName !== '未识别工序') {
        options.add(section.processName)
      }
    })
  })
  return Array.from(options).sort((a, b) => a.localeCompare(b))
}

function getFilteredOrderViews(
  views: HandoverOrderTimelineView[],
  rows: HandoverLedgerRow[],
): HandoverOrderTimelineView[] {
  return views.filter((view) => {
    const latestEvent = getLatestOrderEvent(view.productionOrderId, rows)
    const keyword = state.ordersKeyword.trim().toLowerCase()
    if (keyword) {
      const processText = view.processSections.map((section) => section.processName).join(' ')
      const combined = `${view.productionOrderNo} ${latestEvent?.eventTypeLabel || ''} ${view.currentBottleneckLabel} ${processText}`.toLowerCase()
      if (!combined.includes(keyword)) return false
    }

    if (state.ordersBottleneckFilter !== 'ALL' && view.currentBottleneckLabel !== state.ordersBottleneckFilter) {
      return false
    }

    if (state.ordersObjectionFilter === 'YES' && view.objectionCount <= 0) return false
    if (state.ordersObjectionFilter === 'NO' && view.objectionCount > 0) return false

    if (state.ordersProcessFilter) {
      const matched = view.processSections.some((section) => section.processName === state.ordersProcessFilter)
      if (!matched) return false
    }

    return true
  })
}

function renderOrdersFilters(views: HandoverOrderTimelineView[]): string {
  const processOptions = getOrderProcessFilterOptions(views)

  return `
    <section class="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
      <div class="min-w-[240px] flex-1">
        <div class="relative">
          <i data-lucide="search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
          <input
            class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
            placeholder="搜索生产单号/工序/最近交接事件"
            value="${escapeAttr(state.ordersKeyword)}"
            data-handover-field="ordersKeyword"
          />
        </div>
      </div>

      <select class="h-9 w-[190px] rounded-md border bg-background px-3 text-sm" data-handover-field="ordersBottleneckFilter">
        ${ORDER_BOTTLENECK_FILTER_OPTIONS.map((item) => `<option value="${item.value}" ${state.ordersBottleneckFilter === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
      </select>

      <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-handover-field="ordersObjectionFilter">
        <option value="ALL" ${state.ordersObjectionFilter === 'ALL' ? 'selected' : ''}>异议状态</option>
        <option value="YES" ${state.ordersObjectionFilter === 'YES' ? 'selected' : ''}>有异议</option>
        <option value="NO" ${state.ordersObjectionFilter === 'NO' ? 'selected' : ''}>无异议</option>
      </select>

      <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-handover-field="ordersProcessFilter">
        <option value="">工序工艺</option>
        ${processOptions
          .map(
            (item) =>
              `<option value="${escapeAttr(item)}" ${state.ordersProcessFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`,
          )
          .join('')}
      </select>

      <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="clear-orders-filters">重置</button>
    </section>
  `
}

function renderOrdersPagination(total: number, totalPages: number): string {
  if (total === 0) return ''
  return `
    <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span>共 ${total} 条，当前第 ${state.ordersPage} / ${totalPages} 页，每页 ${state.ordersPageSize} 条</span>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-handover-action="orders-prev-page"
          ${state.ordersPage <= 1 ? 'disabled' : ''}
        >
          上一页
        </button>
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          data-handover-action="orders-next-page"
          ${state.ordersPage >= totalPages ? 'disabled' : ''}
        >
          下一页
        </button>
      </div>
    </div>
  `
}

function renderOrdersDimension(rows: HandoverLedgerRow[]): string {
  const timelineViews = getHandoverOrderTimelineViews(rows)
  const filteredViews = getFilteredOrderViews(timelineViews, rows)
  const total = filteredViews.length
  const totalPages = Math.max(1, Math.ceil(total / state.ordersPageSize))
  if (state.ordersPage > totalPages) state.ordersPage = totalPages
  if (state.ordersPage < 1) state.ordersPage = 1
  const pageStart = (state.ordersPage - 1) * state.ordersPageSize
  const pageViews = filteredViews.slice(pageStart, pageStart + state.ordersPageSize)

  return `
    <section class="space-y-4">
      ${renderOrdersPreviewCards(timelineViews)}
      ${renderOrdersFilters(timelineViews)}
      ${renderOrdersTable(pageViews, rows)}
      ${renderOrdersPagination(total, totalPages)}
    </section>
  `
}

function renderTimelineProcessStatusBadge(section: HandoverTimelineProcessSection): string {
  const className =
    section.processStatusTone === 'success'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : section.processStatusTone === 'warning'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : section.processStatusTone === 'danger'
          ? 'bg-red-100 text-red-700 border-red-200'
          : section.processStatusTone === 'info'
            ? 'bg-blue-100 text-blue-700 border-blue-200'
            : 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(
    section.processStatusLabel,
  )}</span>`
}

function buildDefaultExpandedOrderIds(views: HandoverOrderTimelineView[]): string[] {
  const defaultIds = views
    .filter((view) => view.pendingCount > 0 || view.objectionCount > 0 || view.currentBottleneckLabel !== '全部完成')
    .map((view) => view.productionOrderId)

  if (defaultIds.length > 0) return defaultIds
  return views.slice(0, 2).map((view) => view.productionOrderId)
}

function ensureTimelineExpandedState(views: HandoverOrderTimelineView[]): void {
  const validOrderIds = new Set(views.map((view) => view.productionOrderId))
  const normalized = state.timelineExpandedOrderIds.filter((id) => validOrderIds.has(id))

  if (normalized.length === 0 && views.length > 0) {
    state.timelineExpandedOrderIds = buildDefaultExpandedOrderIds(views)
  } else {
    state.timelineExpandedOrderIds = normalized
  }

  if (state.timelineAnchorOrderId && validOrderIds.has(state.timelineAnchorOrderId)) {
    if (!state.timelineExpandedOrderIds.includes(state.timelineAnchorOrderId)) {
      state.timelineExpandedOrderIds = [...state.timelineExpandedOrderIds, state.timelineAnchorOrderId]
    }
  }
}

function isTimelineSectionFocused(view: HandoverOrderTimelineView, section: HandoverTimelineProcessSection): boolean {
  if (state.timelineAnchorOrderId && state.timelineAnchorOrderId !== view.productionOrderId) return false

  if (state.timelineAnchorTaskId && section.taskId === state.timelineAnchorTaskId) {
    return true
  }

  const focus = state.timelineAnchorFocus
  if (!focus) return false

  if (focus === 'pickup') return section.processStatusLabel === '待领料'
  if (focus === 'handout') return section.processStatusLabel === '待交出' || section.processStatusLabel === '已领料待交出'
  if (focus === 'warehouse-confirm') return section.processStatusLabel === '待接收方回写'
  if (focus === 'objection') return section.processStatusLabel === '有异议' || section.processStatusLabel === '异议处理中'
  return false
}

function renderTimelineSection(view: HandoverOrderTimelineView, section: HandoverTimelineProcessSection): string {
  const processName = section.processName || '未识别工序'
  const processTitle = processName === '未识别工序' ? processName : `${section.seq}. ${processName}`
  const focused = isTimelineSectionFocused(view, section)

  return `
    <section class="rounded-lg border bg-background p-3 ${focused ? 'ring-1 ring-blue-400 bg-blue-50/30' : ''}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-sm font-medium">${escapeHtml(processTitle)}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(section.taskNo)}</p>
        </div>
        ${renderTimelineProcessStatusBadge(section)}
      </div>
      <p class="mt-2 text-xs text-muted-foreground">下一步：${escapeHtml(section.nextActionHint)}</p>

      ${
        section.events.length === 0
          ? '<div class="mt-3 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">当前工序暂无领料或交出事件</div>'
          : `
            <div class="mt-3 space-y-2">
              ${section.events
                .map(
                  (event) => `
                    <button
                      class="w-full rounded-md border bg-muted/20 p-2 text-left transition hover:bg-muted/40"
                      data-handover-action="open-detail"
                      data-row-id="${escapeAttr(event.rowId)}"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <p class="inline-flex items-center gap-1.5 text-xs font-medium">
                            <i data-lucide="workflow" class="h-3.5 w-3.5 text-muted-foreground"></i>
                            ${escapeHtml(event.eventTypeLabel)}
                            ${renderStatusBadge(event)}
                          </p>
                          <p class="mt-1 text-xs">${escapeHtml(event.qtySummary)}</p>
                          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(event.sourceModuleLabel)} · ${escapeHtml(event.nextActionHint)}</p>
                        </div>
                        <div class="shrink-0 text-right text-xs text-muted-foreground">${escapeHtml(event.occurredAt || '-')}</div>
                      </div>
                    </button>
                  `,
                )
                .join('')}
            </div>
          `
      }
    </section>
  `
}

function renderTimelineOrderCard(view: HandoverOrderTimelineView): string {
  const order = getOrderById(view.productionOrderId)
  const isExpanded = state.timelineExpandedOrderIds.includes(view.productionOrderId)
  const isHighlighted = Boolean(state.timelineAnchorOrderId && state.timelineAnchorOrderId === view.productionOrderId)

  return `
    <article
      id="handover-timeline-order-${escapeAttr(view.productionOrderId)}"
      data-handover-timeline-order="${escapeAttr(view.productionOrderId)}"
      class="overflow-hidden rounded-lg border bg-card ${isHighlighted ? 'ring-1 ring-blue-400' : ''}"
    >
      <div class="space-y-4 border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-sm font-medium">${escapeHtml(view.productionOrderNo)} 生产单维度</p>
            <p class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(order?.demandSnapshot.spuName || '')}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">最近事件：${escapeHtml(view.latestOccurredAt || '-')}</span>
            <button
              class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
              data-handover-action="toggle-timeline-order"
              data-order-id="${escapeAttr(view.productionOrderId)}"
            >
              ${isExpanded ? '收起' : '展开'}
            </button>
          </div>
        </div>
        <div class="grid gap-2 text-xs sm:grid-cols-4">
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground">当前卡点</p>
            <p class="mt-1 font-medium">${escapeHtml(view.currentBottleneckLabel)}</p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground">工序数 / 事件数</p>
            <p class="mt-1 font-medium">${view.processSections.length} / ${view.totalEventCount}</p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground">待处理工序</p>
            <p class="mt-1 font-medium">${view.pendingCount}</p>
          </div>
          <div class="rounded-md border bg-muted/20 px-3 py-2">
            <p class="text-muted-foreground">异议工序</p>
            <p class="mt-1 font-medium">${view.objectionCount}</p>
          </div>
        </div>
        <p class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          下一步：${escapeHtml(view.currentBottleneckHint)}
        </p>
      </div>

      ${
        isExpanded
          ? `
            <div class="space-y-4 p-4">
              ${view.processSections.map((section) => renderTimelineSection(view, section)).join('')}
            </div>
          `
          : ''
      }
    </article>
  `
}

function scheduleTimelineAnchorScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (state.activeTab !== 'orders') return
  const orderId = state.timelineScrollTargetOrderId
  if (!orderId) return

  state.timelineScrollTargetOrderId = ''

  window.setTimeout(() => {
    const selector = `[data-handover-order-card="${orderId}"]`
    const target = document.querySelector<HTMLElement>(selector)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 60)
}

function getLatestOrderEvent(orderId: string, rows: HandoverLedgerRow[]): HandoverLedgerRow | undefined {
  return rows
    .filter((row) => row.productionOrderId === orderId)
    .sort((a, b) => parseDateMs(b.occurredAt) - parseDateMs(a.occurredAt))[0]
}

function getOrderProcessSummary(view: HandoverOrderTimelineView): string {
  const processNames = Array.from(
    new Set(
      view.processSections
        .filter((section) => section.eventCount > 0)
        .map((section) => section.processName)
        .filter(Boolean),
    ),
  )
  if (processNames.length === 0) return '暂无交接工序'
  if (processNames.length <= 3) return processNames.join(' / ')
  return `${processNames.slice(0, 3).join(' / ')} 等${processNames.length}道工序`
}

function renderOrderBottleneckBadge(label: string): string {
  const className =
    label === '有异议'
      ? 'bg-red-100 text-red-700 border-red-200'
      : label === '异议处理中'
        ? 'bg-orange-100 text-orange-700 border-orange-200'
        : label === '待接收方回写'
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : label === '待交出' || label === '待领料'
            ? 'bg-blue-100 text-blue-700 border-blue-200'
            : label === '已完成'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getReceivingQcHref(productionOrderId: string): string {
  const row = getQcViewRows().find(
    (item) => item.productionOrderId === productionOrderId && item.qc.inspectionScene !== 'POST_FINAL_RECHECK',
  )
  return row ? buildQualityRecordLink(row.qcId) : ''
}

function getFinalRecheckHref(productionOrderId: string): string {
  const row = getQcViewRows().find(
    (item) => item.productionOrderId === productionOrderId && item.qc.inspectionScene === 'POST_FINAL_RECHECK',
  )
  return row ? buildQualityRecordLink(row.qcId) : ''
}

function resolveRouteStageLabel(params: {
  currentNode: string
  requiresPostExecution: boolean
  stage: 'receivingQc' | 'postExecution' | 'finalRecheck' | 'warehouseHandover'
}): string {
  const { currentNode, requiresPostExecution, stage } = params

  if (stage === 'receivingQc') {
    if (currentNode === 'WAIT_RECEIVING_QC') return '待回货质检'
    if (currentNode === 'WAIT_SEW_HANDOVER' || currentNode === 'WAIT_RECEIVER_WRITEBACK') return '未开始'
    return '已完成'
  }

  if (stage === 'postExecution') {
    if (!requiresPostExecution) return '车缝厂已含后道'
    if (currentNode === 'WAIT_POST_EXECUTION') return '待后道'
    if (currentNode === 'WAIT_SEW_HANDOVER' || currentNode === 'WAIT_RECEIVER_WRITEBACK' || currentNode === 'WAIT_RECEIVING_QC') {
      return '未开始'
    }
    return '已完成'
  }

  if (stage === 'finalRecheck') {
    if (currentNode === 'WAIT_FINAL_RECHECK') return '待复检'
    if (currentNode === 'WAIT_WAREHOUSE_HANDOVER' || currentNode === 'CLOSED') return '已完成'
    return '未开始'
  }

  if (currentNode === 'WAIT_WAREHOUSE_HANDOVER') return '待交成衣仓'
  if (currentNode === 'CLOSED') return '已关闭'
  return '未开始'
}

function renderPostRouteSummary(orderId: string): string {
  const route = getPostProcessRouteByProductionOrderId(orderId)
  if (!route) return '<span class="text-xs text-muted-foreground">后道路由：未配置</span>'
  const receivingQcHref = getReceivingQcHref(orderId)
  const finalRecheckHref = getFinalRecheckHref(orderId)

  const modeLabel = getPostExecutionModeLabel(route.postExecutionMode)
  const currentNodeLabel = getPostRouteNodeLabel(route.currentNode)

  return `
    <div class="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="font-medium text-foreground">后道路由：${escapeHtml(modeLabel)}</span>
        <span class="text-muted-foreground">接收方：${escapeHtml(route.managedPostFactoryName)}</span>
        <span class="text-muted-foreground">当前节点：${escapeHtml(currentNodeLabel)}</span>
      </div>
      <div class="grid gap-2 text-xs md:grid-cols-4">
        <div class="rounded-md border bg-white px-3 py-2">
          <p class="text-muted-foreground">回货质检</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'receivingQc' }))}</p>
          ${
            receivingQcHref
              ? `<button type="button" class="mt-2 inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted" data-handover-action="open-quality-record" data-title="质检记录" data-href="${escapeAttr(receivingQcHref)}">质检记录</button>`
              : ''
          }
        </div>
        <div class="rounded-md border bg-white px-3 py-2">
          <p class="text-muted-foreground">后道状态</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'postExecution' }))}</p>
        </div>
        <div class="rounded-md border bg-white px-3 py-2">
          <p class="text-muted-foreground">后道复检</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'finalRecheck' }))}</p>
          ${
            finalRecheckHref
              ? `<button type="button" class="mt-2 inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted" data-handover-action="open-quality-record" data-title="复检记录" data-href="${escapeAttr(finalRecheckHref)}">复检记录</button>`
              : ''
          }
        </div>
        <div class="rounded-md border bg-white px-3 py-2">
          <p class="text-muted-foreground">成衣仓交接</p>
          <p class="mt-1 font-medium text-foreground">${escapeHtml(resolveRouteStageLabel({ currentNode: route.currentNode, requiresPostExecution: route.requiresPostExecution, stage: 'warehouseHandover' }))}</p>
        </div>
      </div>
    </div>
  `
}

function renderTimelineOrderSummaryCard(view: HandoverOrderTimelineView, rows: HandoverLedgerRow[]): string {
  const latestEvent = getLatestOrderEvent(view.productionOrderId, rows)
  const summary = getProductionOrderHandoverSummary(view.productionOrderId, rows)
  const highlighted = state.timelineAnchorOrderId && state.timelineAnchorOrderId === view.productionOrderId
  const focus =
    highlighted && state.timelineAnchorFocus
      ? state.timelineAnchorFocus
      : summary.recommendedFocus || ''
  const taskId = highlighted ? state.timelineAnchorTaskId : ''

  return `
    <tr
      id="handover-order-${escapeAttr(view.productionOrderId)}"
      data-handover-order-card="${escapeAttr(view.productionOrderId)}"
      class="border-b last:border-0 ${highlighted ? 'bg-blue-50/40' : ''}"
    >
      <td class="px-3 py-3">
        <button class="inline-flex items-center text-sm font-medium text-primary hover:underline" data-handover-action="goto-order" data-order-id="${escapeAttr(view.productionOrderId)}">
          ${escapeHtml(view.productionOrderNo)}
        </button>
        <p class="mt-1 text-xs text-muted-foreground">工序数 / 事件数：${view.processSections.length} / ${view.totalEventCount}</p>
      </td>
      <td class="px-3 py-3 text-xs">
        <p>${escapeHtml(latestEvent?.eventTypeLabel || '暂无事件')}</p>
        <p class="mt-1 text-muted-foreground">${escapeHtml(latestEvent?.occurredAt || '-')}</p>
      </td>
      <td class="px-3 py-3">${renderOrderBottleneckBadge(view.currentBottleneckLabel)}</td>
      <td class="px-3 py-3 text-sm">${view.pendingCount}</td>
      <td class="px-3 py-3 text-sm ${view.objectionCount > 0 ? 'text-red-600 font-medium' : ''}">${view.objectionCount}</td>
      <td class="px-3 py-3 text-xs text-muted-foreground">
        <div class="space-y-2">
          <div>${escapeHtml(getOrderProcessSummary(view))}</div>
          ${renderPostRouteSummary(view.productionOrderId)}
        </div>
      </td>
      <td class="px-3 py-3 text-xs">
        <span class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-muted-foreground">${escapeHtml(
          summary.primaryActionHint || view.currentBottleneckHint,
        )}</span>
      </td>
      <td class="px-3 py-3 text-right">
        <button
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
          data-handover-action="open-order-detail"
          data-order-id="${escapeAttr(view.productionOrderId)}"
          data-task-id="${escapeAttr(taskId)}"
          data-focus="${escapeAttr(focus)}"
        >
          查看交接详情
        </button>
      </td>
    </tr>
  `
}

function renderOrdersTable(views: HandoverOrderTimelineView[], rows: HandoverLedgerRow[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b text-left text-muted-foreground">
              <th class="px-3 py-2 font-medium">生产单</th>
              <th class="px-3 py-2 font-medium">最近交接事件</th>
              <th class="px-3 py-2 font-medium">当前交接卡点</th>
              <th class="px-3 py-2 font-medium">待处理交接事件</th>
              <th class="px-3 py-2 font-medium">异议事件数</th>
              <th class="px-3 py-2 font-medium">当前涉及工序</th>
              <th class="px-3 py-2 font-medium">下一步</th>
              <th class="px-3 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              views.length === 0
                ? '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选范围下暂无生产单交接事件</td></tr>'
                : views.map((view) => renderTimelineOrderSummaryCard(view, rows)).join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderTimelineTab(rows: HandoverLedgerRow[]): string {
  const timelineViews = getHandoverOrderTimelineViews(rows)

  return `
    <section class="space-y-4">
      ${renderOrdersTable(timelineViews, rows)}
    </section>
  `
}

function renderDetailDrawer(rows: HandoverLedgerRow[]): string {
  if (!state.detailRowId) return ''

  const row = rows.find((item) => item.rowId === state.detailRowId)
  if (!row) return ''

  const canWriteback = row.statusCode === 'HANDOUT_RECORD_PENDING_WRITEBACK' && Boolean(row.recordId)
  const canHandleObjection =
    (row.statusCode === 'HANDOUT_OBJECTION_REPORTED' || row.statusCode === 'HANDOUT_OBJECTION_PROCESSING') &&
    Boolean(row.recordId)
  const headType: PdaHandoverHeadType | null = row.sourceType === 'PICKUP_HEAD' ? 'PICKUP' : row.sourceType === 'HANDOUT_HEAD' ? 'HANDOUT' : null
  const sourceTypeLabel =
    row.sourceType === 'PICKUP_HEAD'
      ? '领料单'
      : row.sourceType === 'PICKUP_RECORD'
        ? '领料记录'
        : row.sourceType === 'HANDOUT_HEAD'
          ? '交出单'
          : row.sourceType === 'HANDOUT_RECORD'
            ? '交出记录'
            : '完成记录'

  const directActions: string[] = []
  if (canWriteback) {
    directActions.push(
      `<button class="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-700 hover:bg-emerald-100" data-handover-action="open-writeback-dialog" data-record-id="${escapeAttr(
        row.recordId || '',
      )}">接收方回写</button>`,
    )
  }
  if (canHandleObjection) {
    directActions.push(
      `<button class="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100" data-handover-action="open-objection-dialog" data-record-id="${escapeAttr(
        row.recordId || '',
      )}">处理异议</button>`,
    )
  }
  if (headType === 'PICKUP') {
    directActions.push(
      `<button class="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-700 hover:bg-emerald-100" data-handover-action="mark-pickup-complete" data-handover-id="${escapeAttr(
        row.handoverId,
      )}">标记领料完成</button>`,
    )
  }
  if (headType === 'HANDOUT') {
    directActions.push(
      `<button class="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-700 hover:bg-emerald-100" data-handover-action="mark-handout-complete" data-handover-id="${escapeAttr(
        row.handoverId,
      )}">标记交出完成</button>`,
    )
  }
  if (row.sourceType === 'HANDOUT_RECORD' && row.recordId) {
    directActions.push(
      `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="print-delivery-card" data-handover-id="${escapeAttr(
        row.handoverId,
      )}" data-record-id="${escapeAttr(row.recordId)}">打印任务交货卡</button>`,
    )
  }

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-lg font-semibold">交接事件详情</h3>
              <p class="font-mono text-xs text-muted-foreground">${escapeHtml(row.rowId)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-handover-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </header>

        <div class="space-y-5 px-5 py-5">
          <section class="space-y-3">
            <h4 class="text-sm font-medium">基础信息</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-muted-foreground">事件类型</p>
                <p>${escapeHtml(row.eventTypeLabel)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">当前状态</p>
                <p>${renderStatusBadge(row)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">来源模块</p>
                <p>${escapeHtml(row.sourceModuleLabel)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">事实类型</p>
                <p>${escapeHtml(sourceTypeLabel)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">发生时间</p>
                <p>${escapeHtml(row.occurredAt || '-')}</p>
              </div>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">关联对象</h4>
            <div class="space-y-1 text-sm">
              <p>生产单：${escapeHtml(row.productionOrderId)}</p>
              <p>任务：${escapeHtml(row.taskNo)}</p>
              <p>工序：${escapeHtml(row.processName)}</p>
              <p>交出单：${escapeHtml(row.handoverId)}</p>
              ${row.recordId ? `<p>交接记录：${escapeHtml(row.recordId)}</p>` : ''}
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">事实来源</h4>
            <div class="rounded-md border bg-muted/20 p-3">
              ${renderSourceFacts(row)}
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">数量信息</h4>
            <div class="rounded-md border bg-muted/20 p-3 text-sm">
              <p><span class="text-muted-foreground">流向：</span>${escapeHtml(row.directionLabel)}</p>
              <p class="mt-1"><span class="text-muted-foreground">数量情况：</span>${escapeHtml(row.qtySummary)}</p>
              ${
                typeof row.qtyDiff === 'number'
                  ? `<p class="mt-1"><span class="text-muted-foreground">数量差异：</span>${row.qtyDiff === 0 ? '无差异' : `${row.qtyDiff > 0 ? '-' : '+'}${Math.abs(row.qtyDiff)}`}</p>`
                  : ''
              }
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">当前状态</h4>
            <div class="rounded-md border bg-muted/20 p-3 text-sm">
              <p>${renderStatusBadge(row)}</p>
              <p class="mt-2 text-muted-foreground">${escapeHtml(renderCurrentStatusText(row))}</p>
            </div>
          </section>

          <section class="space-y-3 border-t pt-4">
            <h4 class="text-sm font-medium">下一步怎么做</h4>
            <div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              ${escapeHtml(row.nextActionHint)}
            </div>
          </section>

          <section class="space-y-2 border-t pt-4">
            <h4 class="text-sm font-medium">处理动作</h4>
            ${
              directActions.length > 0
                ? `
                  <div class="space-y-2">
                    <p class="text-xs text-muted-foreground">可以直接处理</p>
                    <div class="flex flex-wrap gap-2">${directActions.join('')}</div>
                  </div>
                `
                : ''
            }

            <div class="space-y-2">
              <p class="text-xs text-muted-foreground">去业务页面处理</p>
              <div class="flex flex-wrap gap-2">
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="open-pda-detail" data-handover-id="${escapeAttr(row.handoverId)}">查看交出详情</button>
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="goto-order" data-order-id="${escapeAttr(row.productionOrderId)}">去生产单</button>
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="goto-task" data-task-id="${escapeAttr(row.taskId)}">去任务看板</button>
                <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-handover-action="view-exception" data-row-id="${escapeAttr(row.rowId)}">去异常定位与处理</button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  `
}

function renderWritebackDialog(): string {
  if (!state.writebackRecordId) return ''

  const record = findPdaHandoverRecord(state.writebackRecordId)
  if (!record) return ''

  const head = findPdaHeadByHandoverId(record.handoverId)
  if (!head) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-writeback-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header>
          <h3 class="text-lg font-semibold">接收方回写</h3>
        </header>

        <div class="mt-4 space-y-2 text-sm">
          <p><span class="text-muted-foreground">生产单：</span>${escapeHtml(head.productionOrderNo)}</p>
          <p><span class="text-muted-foreground">任务：</span>${escapeHtml(head.taskNo)} / ${escapeHtml(head.processName)}</p>
          <p><span class="text-muted-foreground">发起工厂：</span>${escapeHtml(head.sourceFactoryName)}</p>
          <p><span class="text-muted-foreground">接收方：</span>${escapeHtml(getReceiverDisplayName(head))}</p>
          <p><span class="text-muted-foreground">工厂发起时间：</span>${escapeHtml(record.factorySubmittedAt)}</p>
        </div>

        <div class="mt-4 grid gap-3">
          <label class="space-y-1">
            <span class="text-sm">回写备注</span>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="可填写差异原因或备注"
              value="${escapeAttr(state.writebackReturnNo)}"
              data-handover-field="writebackReturnNo"
            />
          </label>
          <label class="space-y-1">
            <span class="text-sm">实收数量 *</span>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              placeholder="请输入实收数量"
              value="${escapeAttr(state.writebackQty)}"
              data-handover-field="writebackQty"
            />
          </label>
          <label class="space-y-1">
            <span class="text-sm">回写时间 *</span>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="datetime-local"
              value="${escapeAttr(state.writebackAt)}"
              data-handover-field="writebackAt"
            />
          </label>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="close-writeback-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-handover-action="confirm-writeback" data-record-id="${escapeAttr(record.recordId)}">确认回写</button>
        </footer>
      </section>
    </div>
  `
}

function renderObjectionDialog(): string {
  if (!state.objectionRecordId) return ''

  const record = findPdaHandoverRecord(state.objectionRecordId)
  if (!record) return ''

  const head = findPdaHeadByHandoverId(record.handoverId)
  if (!head) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-handover-action="close-objection-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-6 left-1/2 w-full max-w-2xl -translate-x-1/2 overflow-y-auto rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">处理数量异议</h3>
          <p class="text-sm text-muted-foreground">记录平台跟进或处理结果</p>
        </header>

        <div class="mt-4 space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div><span class="text-muted-foreground">生产单号：</span>${escapeHtml(head.productionOrderNo)}</div>
            <div><span class="text-muted-foreground">任务号：</span>${escapeHtml(head.taskNo)}</div>
            <div><span class="text-muted-foreground">工厂：</span>${escapeHtml(head.sourceFactoryName)}</div>
            <div><span class="text-muted-foreground">当前工序：</span>${escapeHtml(head.processName)}</div>
            <div><span class="text-muted-foreground">交出记录：</span>${escapeHtml(record.recordId)}（第 ${record.sequenceNo} 次）</div>
            <div><span class="text-muted-foreground">发起时间：</span>${escapeHtml(record.factorySubmittedAt)}</div>
          </div>

          <div class="rounded-md border bg-muted/20 p-3">
            <p><span class="text-muted-foreground">工厂交出说明：</span>${escapeHtml(record.factoryRemark || '—')}</p>
            <p class="mt-1"><span class="text-muted-foreground">工厂交出凭证：</span>${record.factoryProofFiles.length} 个</p>
            <p class="mt-1"><span class="text-muted-foreground">接收方回写数量：</span>${
              typeof getRecordReceiverWrittenQty(record) === 'number' ? `${getRecordReceiverWrittenQty(record)} ${escapeHtml(head.qtyUnit)}` : '—'
            }</p>
            <p class="mt-1"><span class="text-muted-foreground">异议原因：</span>${escapeHtml(record.objectionReason || '—')}</p>
            <p class="mt-1"><span class="text-muted-foreground">异议说明：</span>${escapeHtml(record.objectionRemark || '—')}</p>
            <p class="mt-1"><span class="text-muted-foreground">异议凭证：</span>${record.objectionProofFiles?.length ?? 0} 个</p>
            ${
              record.followUpRemark
                ? `<p class="mt-1"><span class="text-muted-foreground">平台跟进：</span>${escapeHtml(record.followUpRemark)}</p>`
                : ''
            }
            ${
              record.resolvedRemark
                ? `<p class="mt-1"><span class="text-muted-foreground">处理结果：</span>${escapeHtml(record.resolvedRemark)}</p>`
                : ''
            }
          </div>

          <label class="space-y-1">
            <span class="text-sm">跟进 / 处理备注</span>
            <textarea
              class="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="填写平台跟进情况或处理结果"
              data-handover-field="objectionFollowUpRemark"
            >${escapeHtml(state.objectionFollowUpRemark)}</textarea>
          </label>
        </div>

        <footer class="mt-6 flex flex-wrap justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="close-objection-dialog">关闭</button>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-handover-action="submit-objection-followup" data-record-id="${escapeAttr(record.recordId)}">记录跟进</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-handover-action="submit-objection-resolve" data-record-id="${escapeAttr(record.recordId)}">处理完成</button>
        </footer>
      </section>
    </div>
  `
}

function renderPage(): string {
  syncFromQuery()

  const rows = getLedgerRows()
  const filteredRows = getFilteredRows(rows)
  const orderRows = getTimelineBaseRows(rows)

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderUrlBanner()}
      ${state.activeTab === 'events' ? renderEventsDimension(filteredRows, rows) : renderOrdersDimension(orderRows)}
      ${renderDetailDrawer(rows)}
      ${renderWritebackDialog()}
      ${renderObjectionDialog()}
    </div>
  `
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'filterEventType' && node instanceof HTMLSelectElement) {
    state.filterEventType = isLedgerEventType(node.value) ? node.value : 'ALL'
    return
  }

  if (field === 'filterPo' && node instanceof HTMLSelectElement) {
    state.filterPo = node.value
    return
  }

  if (field === 'filterProcess' && node instanceof HTMLSelectElement) {
    state.filterProcess = node.value
    return
  }

  if (field === 'filterStatus' && node instanceof HTMLSelectElement) {
    state.filterStatus = normalizeStatusFilter(node.value)
    return
  }

  if (field === 'filterHasDiff' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'YES' || node.value === 'NO') {
      state.filterHasDiff = node.value
    }
    return
  }

  if (field === 'ordersKeyword' && node instanceof HTMLInputElement) {
    state.ordersKeyword = node.value
    state.ordersPage = 1
    return
  }

  if (field === 'ordersBottleneckFilter' && node instanceof HTMLSelectElement) {
    state.ordersBottleneckFilter = (node.value || 'ALL') as ProgressHandoverState['ordersBottleneckFilter']
    state.ordersPage = 1
    return
  }

  if (field === 'ordersObjectionFilter' && node instanceof HTMLSelectElement) {
    if (node.value === 'ALL' || node.value === 'YES' || node.value === 'NO') {
      state.ordersObjectionFilter = node.value
      state.ordersPage = 1
    }
    return
  }

  if (field === 'ordersProcessFilter' && node instanceof HTMLSelectElement) {
    state.ordersProcessFilter = node.value
    state.ordersPage = 1
    return
  }

  if (field === 'writebackReturnNo' && node instanceof HTMLInputElement) {
    state.writebackReturnNo = node.value
    return
  }

  if (field === 'writebackQty' && node instanceof HTMLInputElement) {
    state.writebackQty = node.value
    return
  }

  if (field === 'writebackAt' && node instanceof HTMLInputElement) {
    state.writebackAt = node.value
    return
  }

  if (field === 'objectionFollowUpRemark' && node instanceof HTMLTextAreaElement) {
    state.objectionFollowUpRemark = node.value
  }
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'switch-dimension') {
    const dimension = actionNode.dataset.dimension
    if (dimension === 'events' || dimension === 'orders') {
      state.activeTab = dimension
    }
    return true
  }

  if (action === 'switch-tab') {
    const tab = (actionNode.dataset.tab || '').trim()
    if (tab === 'events' || tab === 'list') {
      state.activeTab = 'events'
      return true
    }
    if (tab === 'orders' || tab === 'timeline') {
      state.activeTab = 'orders'
      return true
    }
    // 兜底：即使 data-tab 异常，也按按钮文案判断，避免点击失效
    const label = (actionNode.textContent || '').trim()
    if (label.includes('事件维度')) {
      state.activeTab = 'events'
      return true
    }
    if (label.includes('生产单维度')) {
      state.activeTab = 'orders'
      return true
    }
    return true
  }

  if (action === 'refresh') {
    showProgressHandoverToast('数据已刷新')
    return true
  }

  if (action === 'export') {
    showProgressHandoverToast('导出功能已触发（原型演示）')
    return true
  }

  if (action === 'clear-filters') {
    state.keyword = ''
    state.filterPo = ''
    state.filterProcess = ''
    state.filterTaskId = ''
    state.filterEventType = 'ALL'
    state.filterStatus = 'ALL'
    state.filterHasDiff = 'ALL'
    state.showUrlFilterBanner = false
    state.focusHint = ''
    state.sourceHint = ''
    state.timelineAnchorOrderId = ''
    state.timelineAnchorTaskId = ''
    state.timelineAnchorFocus = ''
    state.timelineScrollTargetOrderId = ''
    state.timelineExpandedOrderIds = []
    appStore.navigate('/fcs/progress/handover')
    return true
  }

  if (action === 'clear-orders-filters') {
    state.ordersKeyword = ''
    state.ordersBottleneckFilter = 'ALL'
    state.ordersObjectionFilter = 'ALL'
    state.ordersProcessFilter = ''
    state.ordersPage = 1
    return true
  }

  if (action === 'orders-prev-page') {
    state.ordersPage = Math.max(1, state.ordersPage - 1)
    return true
  }

  if (action === 'orders-next-page') {
    state.ordersPage += 1
    return true
  }

  if (action === 'toggle-preview-filter') {
    const filterType = actionNode.dataset.filterType
    if (isLedgerEventType(filterType) && filterType !== 'ALL') {
      state.filterEventType = state.filterEventType === filterType ? 'ALL' : filterType
    }
    return true
  }

  if (action === 'toggle-row-menu') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return true
    state.rowMenuRowId = state.rowMenuRowId === rowId ? null : rowId
    return true
  }

  if (action === 'open-detail') {
    const rowId = actionNode.dataset.rowId
    if (rowId) {
      state.detailRowId = rowId
    }
    closeRowMenu()
    return true
  }

  if (action === 'print-delivery-card') {
    const recordId = actionNode.dataset.recordId
    if (recordId) {
      openLinkedPage('任务交货卡', buildTaskDeliveryCardPrintLink(recordId))
    }
    closeRowMenu()
    return true
  }

  if (action === 'close-detail') {
    state.detailRowId = null
    return true
  }

  if (action === 'open-pda-detail') {
    const handoverId = actionNode.dataset.handoverId
    if (handoverId) {
      const head = findPdaHeadByHandoverId(handoverId)
      const detailTitle = head?.headType === 'PICKUP' ? `领料详情 ${handoverId}` : `交出单详情 ${handoverId}`
      openLinkedPage(detailTitle, buildHandoverOrderLink(handoverId))
    }
    return true
  }

  if (action === 'mark-pickup-complete') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true
    const result = markPdaPickupHeadCompleted(handoverId, nowTimestamp())
    if (!result.ok) {
      showProgressHandoverToast(result.message, 'error')
      return true
    }
    showProgressHandoverToast(`仓库已发起领料完成：${handoverId}`)
    return true
  }

  if (action === 'mark-handout-complete') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true
    const result = markPdaHandoutHeadCompleted(handoverId, nowTimestamp())
    if (!result.ok) {
      showProgressHandoverToast(result.message, 'error')
      return true
    }
    showProgressHandoverToast(`交出单已关闭：${handoverId}`)
    return true
  }

  if (action === 'open-writeback-dialog') {
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaHandoverRecord(recordId) : undefined
    if (!record) return true

    state.writebackRecordId = record.recordId
    state.writebackReturnNo = record.receiverRemark || record.diffReason || ''
    state.writebackQty =
      typeof getRecordReceiverWrittenQty(record) === 'number'
        ? String(getRecordReceiverWrittenQty(record))
        : String(record.submittedQty ?? record.plannedQty ?? '')
    state.writebackAt = getRecordReceiverWrittenAt(record)
      ? getRecordReceiverWrittenAt(record)!.replace(' ', 'T').slice(0, 16)
      : getCurrentLocalDateTimeInput()
    return true
  }

  if (action === 'close-writeback-dialog') {
    state.writebackRecordId = null
    state.writebackReturnNo = ''
    state.writebackQty = ''
    state.writebackAt = getCurrentLocalDateTimeInput()
    return true
  }

  if (action === 'confirm-writeback') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const qty = Number(state.writebackQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      showProgressHandoverToast('请填写正确的回写数量', 'error')
      return true
    }
    if (!state.writebackAt) {
      showProgressHandoverToast('请填写回写时间', 'error')
      return true
    }

    const currentRecord = findPdaHandoverRecord(recordId)
    if (!currentRecord) {
      showProgressHandoverToast('当前记录无法回写，请刷新后重试', 'error')
      return true
    }
    const submittedQty = currentRecord.submittedQty ?? currentRecord.plannedQty ?? 0
    if (qty !== submittedQty && !state.writebackReturnNo.trim()) {
      showProgressHandoverToast('数量有差异时请填写差异原因', 'error')
      return true
    }

    const updated = writeBackHandoverRecord({
      handoverRecordId: recordId,
      receiverWrittenQty: qty,
      receiverWrittenAt: `${state.writebackAt.replace('T', ' ')}:00`,
      receiverWrittenBy: '接收方扫码员',
      receiverRemark: state.writebackReturnNo.trim() || undefined,
      diffReason: qty === submittedQty ? undefined : state.writebackReturnNo.trim() || '接收方实收数量与工厂交出数量不一致',
    })

    if (!updated) {
      showProgressHandoverToast('当前记录无法回写，请刷新后重试', 'error')
      return true
    }

    state.writebackRecordId = null
    state.writebackReturnNo = ''
    state.writebackQty = ''
    state.writebackAt = getCurrentLocalDateTimeInput()
    showProgressHandoverToast(`接收方回写完成：${updated.recordId}`)
    return true
  }

  if (action === 'open-objection-dialog') {
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaHandoverRecord(recordId) : undefined
    if (!record) return true
    state.objectionRecordId = record.recordId
    state.objectionFollowUpRemark = record.followUpRemark || record.resolvedRemark || ''
    return true
  }

  if (action === 'close-objection-dialog') {
    state.objectionRecordId = null
    state.objectionFollowUpRemark = ''
    return true
  }

  if (action === 'submit-objection-followup') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const remark = state.objectionFollowUpRemark.trim() || '平台已记录跟进：已联系工厂与仓库核对数量'
    const updated = followupPdaHandoverObjection(recordId, remark)
    if (!updated) {
      showProgressHandoverToast('当前记录暂不可记录跟进', 'error')
      return true
    }
    state.objectionRecordId = null
    state.objectionFollowUpRemark = ''
    showProgressHandoverToast('异议已记录跟进')
    return true
  }

  if (action === 'submit-objection-resolve') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const remark = state.objectionFollowUpRemark.trim() || '平台已完成处理并归档'
    const updated = resolvePdaHandoverObjection(recordId, remark)
    if (!updated) {
      showProgressHandoverToast('当前记录暂不可处理完成', 'error')
      return true
    }
    state.objectionRecordId = null
    state.objectionFollowUpRemark = ''
    showProgressHandoverToast('异议处理完成，已同步工厂端')
    return true
  }

  if (action === 'view-exception') {
    const rowId = actionNode.dataset.rowId
    const row = rowId ? getLedgerRowById(rowId) : undefined
    if (row) {
      openLinkedPage('异常定位与处理', buildExceptionHrefByRow(row))
    }
    closeRowMenu()
    return true
  }

  if (action === 'goto-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      openLinkedPage(`生产单 ${orderId}`, buildProductionOrderLink(orderId))
    }
    return true
  }

  if (action === 'goto-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('任务详情', buildTaskDetailLink(taskId))
    }
    return true
  }

  if (action === 'open-quality-record') {
    const href = actionNode.dataset.href
    if (href) {
      openLinkedPage(actionNode.dataset.title || '质检记录', href)
    }
    return true
  }

  if (action === 'open-order-detail') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      const focusValue = actionNode.dataset.focus
      const focus = isHandoverFocus(focusValue) ? focusValue : undefined
      const taskId = actionNode.dataset.taskId || ''
      openLinkedPage(
        `交接详情-${orderId}`,
        buildHandoverOrderDetailLink({
          productionOrderId: orderId,
          tab: 'process',
          taskId: taskId || undefined,
          focus,
          source: '交接链路跟踪',
        }),
      )
    }
    return true
  }

  if (action === 'toggle-timeline-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      if (state.timelineExpandedOrderIds.includes(orderId)) {
        state.timelineExpandedOrderIds = state.timelineExpandedOrderIds.filter((id) => id !== orderId)
      } else {
        state.timelineExpandedOrderIds = [...state.timelineExpandedOrderIds, orderId]
      }
    }
    return true
  }

  return false
}

export function renderProgressHandoverPage(): string {
  const html = renderPage()
  scheduleTimelineAnchorScroll()
  return html
}

export function handleProgressHandoverEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-handover-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.handoverField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-handover-action]')
  if (!actionNode) {
    if (state.rowMenuRowId) {
      closeRowMenu()
      return true
    }
    return false
  }

  const action = actionNode.dataset.handoverAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressHandoverDialogOpen(): boolean {
  return Boolean(state.detailRowId || state.writebackRecordId || state.objectionRecordId)
}
