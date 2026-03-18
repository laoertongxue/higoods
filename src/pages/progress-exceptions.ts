import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  processTasks,
  type ProcessTask,
  type TaskAuditLog,
} from '../data/fcs/process-tasks'
import {
  processTypes,
  getProcessTypeByCode,
} from '../data/fcs/process-types'
import {
  productionOrders,
  type ProductionOrder,
} from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import {
  initialTenders,
  initialMaterialIssueSheets,
  type Tender,
} from '../data/fcs/store-domain-dispatch-process'
import {
  initialExceptions,
  initialNotifications,
  initialUrges,
  mockInternalUsers,
  generateNotificationId,
  generateUrgeId,
  type CaseStatus,
  type ExceptionCase,
  type ExceptionCategory,
  type Notification,
  type ReasonCode,
  type Severity,
  type UrgeLog,
  type UrgeType,
} from '../data/fcs/store-domain-progress'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'
import { syncPdaStartRiskAndExceptions } from '../data/fcs/pda-start-link'
import {
  allowContinueFromPauseException,
  recordPauseExceptionFollowUp,
  syncMilestoneOverdueExceptions,
} from '../data/fcs/pda-exec-link'
import {
  buildHandoverOrderDetailLink,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
} from '../data/fcs/handover-ledger-view'
import {
  CATEGORY_LABEL,
  SUB_CATEGORY_LABEL,
  getDefaultSubCategoryKeyFromReason,
  getSubCategoryOptionsByCategory,
  getUnifiedCategoryFromReason,
  inferLegacySubCategoryKey,
  isSubCategoryKey,
  type SubCategoryKey,
  type UnifiedCategory,
} from '../data/fcs/progress-exception-taxonomy'
import {
  appendCaseAction,
  appendCaseAuditLog,
  appendCaseStatusChangeAudit,
  CLOSE_REASON_LABEL,
  markCaseClosed,
  markCaseResolved,
  maybeAutoCloseResolvedCase,
  RESOLVE_RULE_LABEL,
  RESOLVE_SOURCE_LABEL,
  type CloseReasonCode,
  type ResolveRuleCode,
} from '../data/fcs/progress-exception-lifecycle'

applyQualitySeedBootstrap()

type AggregateFilter =
  | { type: 'reason'; value: SubCategoryKey }
  | { type: 'factory'; value: string }
  | { type: 'process'; value: string }

type UiCaseStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

interface ProgressExceptionsState {
  lastQueryKey: string
  initializedByQuery: boolean

  upstreamTaskId: string
  upstreamPo: string
  upstreamTenderId: string
  upstreamReasonCode: string
  upstreamSeverity: string
  upstreamCaseId: string
  showUpstreamHint: boolean

  keyword: string
  statusFilter: 'ALL' | UiCaseStatus
  severityFilter: string
  categoryFilter: 'ALL' | UnifiedCategory
  subCategoryFilter: 'ALL' | SubCategoryKey
  ownerFilter: string
  factoryFilter: string
  processFilter: string

  aggregateFilter: AggregateFilter | null

  detailCaseId: string | null
  closeDialogCaseId: string | null
  closeReason: CloseReasonCode
  closeRemark: string
  closeMergeCaseId: string
  unblockDialogCaseId: string | null
  unblockRemark: string

  pauseFollowUpCaseId: string | null
  pauseFollowUpRemark: string

  extendDialogCaseId: string | null

  rowActionMenuCaseId: string | null
}

const state: ProgressExceptionsState = {
  lastQueryKey: '',
  initializedByQuery: false,

  upstreamTaskId: '',
  upstreamPo: '',
  upstreamTenderId: '',
  upstreamReasonCode: '',
  upstreamSeverity: '',
  upstreamCaseId: '',
  showUpstreamHint: false,

  keyword: '',
  statusFilter: 'ALL',
  severityFilter: 'ALL',
  categoryFilter: 'ALL',
  subCategoryFilter: 'ALL',
  ownerFilter: 'ALL',
  factoryFilter: 'ALL',
  processFilter: 'ALL',

  aggregateFilter: null,

  detailCaseId: null,
  closeDialogCaseId: null,
  closeReason: 'RESOLVED_DONE',
  closeRemark: '',
  closeMergeCaseId: '',
  unblockDialogCaseId: null,
  unblockRemark: '',

  pauseFollowUpCaseId: null,
  pauseFollowUpRemark: '',

  extendDialogCaseId: null,

  rowActionMenuCaseId: null,
}

const SEVERITY_COLOR_CLASS: Record<Severity, string> = {
  S1: 'border-red-200 bg-red-100 text-red-700',
  S2: 'border-orange-200 bg-orange-100 text-orange-700',
  S3: 'border-slate-200 bg-slate-100 text-slate-600',
}

const STATUS_COLOR_CLASS: Record<UiCaseStatus, string> = {
  OPEN: 'border-red-200 bg-red-100 text-red-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-100 text-blue-700',
  RESOLVED: 'border-green-200 bg-green-100 text-green-700',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

const STATUS_ICON: Record<UiCaseStatus, string> = {
  OPEN: 'alert-circle',
  IN_PROGRESS: 'play',
  RESOLVED: 'check-circle-2',
  CLOSED: 'x-circle',
}

const CASE_STATUS_LABEL: Record<UiCaseStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
}

const DIRECT_CLOSE_REASON_SET = new Set<CloseReasonCode>([
  'DUPLICATE',
  'FALSE_ALARM',
  'OBJECT_INVALID',
  'MERGED',
])

const REASON_LABEL: Record<ReasonCode, string> = {
  BLOCKED_MATERIAL: '物料待处理',
  BLOCKED_CAPACITY: '产能待处理',
  BLOCKED_QUALITY: '质量待处理',
  BLOCKED_TECH: '技术待处理',
  BLOCKED_EQUIPMENT: '设备待处理',
  BLOCKED_OTHER: '其他待处理',
  TENDER_OVERDUE: '竞价逾期',
  TENDER_NEAR_DEADLINE: '竞价临近截止',
  NO_BID: '无人报价',
  PRICE_ABNORMAL: '报价异常',
  DISPATCH_REJECTED: '派单拒单',
  ACK_TIMEOUT: '接单超时',
  TECH_PACK_NOT_RELEASED: '技术包未发布',
  FACTORY_BLACKLISTED: '工厂黑名单',
  HANDOVER_DIFF: '交接差异',
  MATERIAL_NOT_READY: '物料未齐套',
  START_OVERDUE: '开工逾期',
  MILESTONE_NOT_REPORTED: '关键节点未上报',
}

function getReasonLabel(exc: ExceptionCase): string {
  return exc.reasonLabel || REASON_LABEL[exc.reasonCode] || exc.reasonCode
}

function normalizeCaseStatus(status: CaseStatus): UiCaseStatus {
  return status
}

function getUnifiedCategory(exc: ExceptionCase): UnifiedCategory {
  if (exc.unifiedCategory) return exc.unifiedCategory
  return getUnifiedCategoryFromReason(exc.reasonCode, exc.category)
}

function getSubCategoryKey(exc: ExceptionCase): SubCategoryKey {
  if (exc.subCategoryKey) return exc.subCategoryKey
  const byReason = getDefaultSubCategoryKeyFromReason(exc.reasonCode)
  if (byReason) return byReason
  const legacy = inferLegacySubCategoryKey(exc.reasonCode, exc.summary, exc.detail)
  if (legacy) return legacy
  return 'EXEC_BLOCK_OTHER'
}

function getSubCategoryLabel(exc: ExceptionCase): string {
  return SUB_CATEGORY_LABEL[getSubCategoryKey(exc)]
}

function getCaseFactoryId(exc: ExceptionCase): string {
  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (task?.assignedFactoryId) return task.assignedFactoryId
  }
  return ''
}

function getCaseFactoryName(exc: ExceptionCase): string {
  const factoryId = getCaseFactoryId(exc)
  if (factoryId) return getFactoryById(factoryId)?.name || factoryId
  return exc.linkedFactoryName || '-'
}

function getCaseProcessName(exc: ExceptionCase): string {
  const taskId = exc.relatedTaskIds[0]
  if (!taskId) return '-'
  const task = getTaskById(taskId)
  if (!task?.processCode) return '-'
  return getProcessTypeByCode(task.processCode)?.nameZh || task.processNameZh || task.processCode
}

function getRelatedObjects(exc: ExceptionCase): Array<{ typeLabel: string; id: string; kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other' }> {
  const rows: Array<{ typeLabel: string; id: string; kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other' }> = []
  const pushUnique = (typeLabel: string, id: string, kind: 'order' | 'task' | 'tender' | 'pda' | 'handover' | 'other') => {
    if (!id) return
    if (!rows.some((row) => row.typeLabel === typeLabel && row.id === id)) rows.push({ typeLabel, id, kind })
  }

  for (const orderId of exc.relatedOrderIds) pushUnique('生产单', orderId, 'order')
  for (const taskId of exc.relatedTaskIds) pushUnique('任务', taskId, 'task')
  for (const tenderId of exc.relatedTenderIds) pushUnique('招标单', tenderId, 'tender')
  if (/^PDA-/.test(exc.sourceId)) pushUnique('PDA任务', exc.sourceId, 'pda')
  if (/^HO-/.test(exc.sourceId)) pushUnique('交出单', exc.sourceId, 'handover')
  if (rows.length === 0 && exc.sourceId) pushUnique('来源单据', exc.sourceId, 'other')

  return rows
}

function getSubCategoryOptions(category: 'ALL' | UnifiedCategory): Array<{ key: SubCategoryKey; label: string }> {
  return getSubCategoryOptionsByCategory(category)
}

const OWNER_OPTIONS: Array<{ id: string; name: string }> = [
  { id: 'U002', name: '跟单A' },
  { id: 'U003', name: '跟单B' },
  { id: 'U004', name: '运营' },
  { id: 'U005', name: '管理员' },
]

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function getOrderById(orderId: string): ProductionOrder | undefined {
  return productionOrders.find((order) => order.productionOrderId === orderId)
}

function getFactoryById(factoryId: string) {
  return indonesiaFactories.find((factory) => factory.id === factoryId)
}

function getTenderById(tenderId: string): Tender | undefined {
  return initialTenders.find((tender) => tender.tenderId === tenderId)
}

function getCaseById(caseId: string): ExceptionCase | undefined {
  return initialExceptions.find((item) => item.caseId === caseId)
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((task) => task.taskId === taskId)
}

const TASK_STATUS_LABEL: Record<ProcessTask['status'], string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '生产暂停',
  CANCELLED: '已取消',
}

function getTaskStatusLabel(task?: ProcessTask): string {
  if (!task) return '-'
  return TASK_STATUS_LABEL[task.status]
}

function getMaterialIssueRows(exc: ExceptionCase) {
  return initialMaterialIssueSheets.filter((item) =>
    (exc.relatedTaskIds.length > 0 && exc.relatedTaskIds.includes(item.taskId)) ||
    (exc.relatedOrderIds.length > 0 && item.productionOrderId && exc.relatedOrderIds.includes(item.productionOrderId)),
  )
}

function getHandoverCaseSnapshot(exc: ExceptionCase): {
  orderSummary: ReturnType<typeof getProductionOrderHandoverSummary> | null
  taskSummary: ReturnType<typeof getTaskHandoverSummary> | null
} {
  const firstOrderId = exc.relatedOrderIds[0]
  const firstTaskId = exc.relatedTaskIds[0]

  return {
    orderSummary: firstOrderId ? getProductionOrderHandoverSummary(firstOrderId) : null,
    taskSummary: firstTaskId ? getTaskHandoverSummary(firstTaskId) : null,
  }
}

function parseTimestampToMs(value: string): number {
  const parsed = Date.parse(value.replace(' ', 'T'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function getRelatedTasks(exc: ExceptionCase): ProcessTask[] {
  return exc.relatedTaskIds.map((taskId) => getTaskById(taskId)).filter((task): task is ProcessTask => Boolean(task))
}

function getRelatedTenders(exc: ExceptionCase): Tender[] {
  return exc.relatedTenderIds.map((tenderId) => getTenderById(tenderId)).filter((tender): tender is Tender => Boolean(tender))
}

interface ResolveJudgeResult {
  resolved: boolean
  ruleText: string
  currentResultText: string
  resolvedDetail: string
  resolvedRuleCode: ResolveRuleCode
}

function getResolveJudgeResult(exc: ExceptionCase): ResolveJudgeResult {
  const unifiedCategory = getUnifiedCategory(exc)
  const relatedTasks = getRelatedTasks(exc)
  const relatedOrders = exc.relatedOrderIds.map((orderId) => getOrderById(orderId)).filter((order): order is ProductionOrder => Boolean(order))
  const relatedTenders = getRelatedTenders(exc)

  if (unifiedCategory === 'ASSIGNMENT') {
    const hasAcceptedTask = relatedTasks.some((task) => task.acceptanceStatus === 'ACCEPTED')
    const hasAwardedTask = relatedTasks.some((task) => task.assignmentStatus === 'AWARDED')
    const allTenderAwarded = relatedTenders.length > 0 && relatedTenders.every((tender) => tender.status === 'AWARDED')

    const resolved = hasAcceptedTask || hasAwardedTask || allTenderAwarded

    return {
      resolved,
      ruleText: '任务已真正落实承接方（接单成功/竞价定标）后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：任务已落实承接方，可进入关闭流程。'
        : '当前未满足：任务尚未真正落实承接方，请继续推进分配或接单。',
      resolvedDetail: '任务已真正落实承接方，系统自动判定为已解决',
      resolvedRuleCode: 'ASSIGNMENT_TARGET_SECURED',
    }
  }

  if (unifiedCategory === 'EXECUTION') {
    if (exc.reasonCode === 'START_OVERDUE') {
      const resolved = relatedTasks.some((task) => Boolean(task.startedAt))
      return {
        resolved,
        ruleText: '工厂确认开工后，系统自动判定为已解决。',
        currentResultText: resolved
          ? '当前已满足：任务已确认开工，可进入关闭流程。'
          : '当前未满足：任务仍未开工，请先推动工厂确认开工。',
        resolvedDetail: '工厂已确认开工，系统自动判定为已解决',
        resolvedRuleCode: 'EXEC_START_CONFIRMED',
      }
    }

    if (exc.reasonCode === 'MILESTONE_NOT_REPORTED') {
      const resolved = relatedTasks.some(
        (task) => task.milestoneStatus === 'REPORTED' || Boolean(task.milestoneReportedAt),
      )
      return {
        resolved,
        ruleText: '关键节点按规则完成上报后，系统自动判定为已解决。',
        currentResultText: resolved
          ? '当前已满足：任务已补报关键节点，可进入关闭流程。'
          : '当前未满足：关键节点仍未上报，请先在 PDA 侧完成节点上报。',
        resolvedDetail: '任务已补报关键节点，系统自动判定为已解决',
        resolvedRuleCode: 'EXEC_MILESTONE_REPORTED',
      }
    }

    const resolved =
      relatedTasks.length > 0 &&
      relatedTasks.every((task) => task.status !== 'BLOCKED' && task.pauseStatus !== 'REPORTED' && task.pauseStatus !== 'FOLLOWING_UP')

    return {
      resolved,
      ruleText: '平台允许继续且任务恢复执行后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：任务已恢复进行中，可进入关闭流程。'
        : '当前未满足：任务仍处于生产暂停，请先处理暂停原因并允许继续。',
      resolvedDetail: '任务已恢复可执行状态，系统自动判定为已解决',
      resolvedRuleCode: 'EXEC_RESUMED',
    }
  }

  if (unifiedCategory === 'TECH_PACK') {
    const resolved = relatedOrders.length > 0 && relatedOrders.every((order) => order.techPackSnapshot.status === 'RELEASED')
    return {
      resolved,
      ruleText: '技术包发布并可正常使用后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：技术包已发布，可进入关闭流程。'
        : '当前未满足：技术包仍未发布或资料未补齐，请先处理技术包。',
      resolvedDetail: '技术包已发布并可用于生产，系统自动判定为已解决',
      resolvedRuleCode: 'TECH_PACK_RELEASED',
    }
  }

  if (unifiedCategory === 'MATERIAL') {
    const rows = getMaterialIssueRows(exc)
    const isSatisfied = rows.every((row) => row.status === 'ISSUED' || row.issuedQty >= row.requestedQty)
    const resolved = rows.length > 0 && isSatisfied
    return {
      resolved,
      ruleText: '领料记录满足或领料链路闭合后，系统自动判定为已解决。',
      currentResultText: resolved
        ? '当前已满足：领料记录已满足，可进入关闭流程。'
        : '当前未满足：仍有领料缺口或未闭合记录，请继续推进领料。',
      resolvedDetail: '领料记录已满足并闭合，系统自动判定为已解决',
      resolvedRuleCode: 'MATERIAL_SATISFIED',
    }
  }

  const { orderSummary, taskSummary } = getHandoverCaseSnapshot(exc)
  const resolved = taskSummary
    ? taskSummary.processStatusLabel === '已完成'
    : Boolean(orderSummary && !orderSummary.hasOpenIssue)

  return {
    resolved,
    ruleText: '交出差异/数量异议处理完成并闭合后，系统自动判定为已解决。',
    currentResultText: resolved
      ? '当前已满足：交出记录已闭合，可进入关闭流程。'
      : '当前未满足：仍有数量差异或异议未处理，请继续跟进交出处理。',
    resolvedDetail: '交出差异/异议已处理完成，系统自动判定为已解决',
    resolvedRuleCode: 'HANDOUT_ISSUE_CLOSED',
  }
}

function syncExceptionResolvedByBusiness(): void {
  const now = nowTimestamp()

  for (const exc of initialExceptions) {
    const uiStatus = normalizeCaseStatus(exc.caseStatus)
    if (uiStatus === 'RESOLVED' || uiStatus === 'CLOSED') continue

    const judge = getResolveJudgeResult(exc)
    if (!judge.resolved) continue

    const resolved = markCaseResolved(exc, {
      by: '系统',
      source: 'SYSTEM',
      ruleCode: judge.resolvedRuleCode,
      detail: judge.resolvedDetail,
      at: now,
      actionType: 'AUTO_RESOLVE',
      auditAction: 'AUTO_RESOLVE',
    })
    const closedIfNeeded = maybeAutoCloseResolvedCase(resolved, '系统')
    updateException(closedIfNeeded)
  }
}

function updateException(updated: ExceptionCase): void {
  const index = initialExceptions.findIndex((item) => item.caseId === updated.caseId)
  if (index >= 0) {
    initialExceptions[index] = updated
  }
}

function updateTaskStatus(taskId: string, newStatus: ProcessTask['status'], by: string = 'Admin'): void {
  const index = processTasks.findIndex((task) => task.taskId === taskId)
  if (index < 0) return

  const task = processTasks[index]
  const now = nowTimestamp()

  const actionMap: Record<ProcessTask['status'], string> = {
    NOT_STARTED: 'RESET',
    IN_PROGRESS: task.status === 'BLOCKED' ? 'UNBLOCK' : 'START',
    DONE: 'FINISH',
    BLOCKED: 'BLOCK',
    CANCELLED: 'CANCEL',
  }

  const detailMap: Record<ProcessTask['status'], string> = {
    NOT_STARTED: '重置为未开始',
    IN_PROGRESS: task.status === 'BLOCKED' ? '恢复执行并继续推进' : '任务开始执行',
    DONE: '任务已完工',
    BLOCKED: '任务生产暂停',
    CANCELLED: '任务已取消',
  }

  const taskAudit: TaskAuditLog = {
    id: `AL-${Date.now()}-${taskId}`,
    action: actionMap[newStatus],
    detail: detailMap[newStatus],
    at: now,
    by,
  }

  processTasks[index] = {
    ...task,
    status: newStatus,
    updatedAt: now,
    ...(newStatus === 'IN_PROGRESS' ? { blockReason: undefined, blockRemark: undefined, blockedAt: undefined } : {}),
    auditLogs: [...task.auditLogs, taskAudit],
  }
}

function extendTenderDeadline(tenderId: string, hours: number = 24): void {
  const index = initialTenders.findIndex((item) => item.tenderId === tenderId)
  if (index < 0) return

  const tender = initialTenders[index]
  const now = nowTimestamp()
  const deadline = new Date(tender.deadline.replace(' ', 'T'))
  deadline.setHours(deadline.getHours() + hours)

  initialTenders[index] = {
    ...tender,
    deadline: deadline.toISOString().replace('T', ' ').slice(0, 19),
    status: 'OPEN',
    updatedAt: now,
    auditLogs: [
      ...tender.auditLogs,
      {
        id: `TAL-${Date.now()}`,
        action: 'EXTEND',
        detail: `竞价截止时间延长 ${hours} 小时`,
        at: now,
        by: 'Admin',
      },
    ],
  }
}

function createNotification(payload: Omit<Notification, 'notificationId' | 'createdAt'>): Notification {
  const notification: Notification = {
    ...payload,
    notificationId: generateNotificationId(),
    createdAt: nowTimestamp(),
  }

  initialNotifications.push(notification)
  return notification
}

function createUrge(payload: Omit<UrgeLog, 'urgeId' | 'createdAt' | 'status' | 'auditLogs'>): UrgeLog {
  const createdAt = nowTimestamp()

  const urge: UrgeLog = {
    ...payload,
    urgeId: generateUrgeId(),
    createdAt,
    status: 'SENT',
    auditLogs: [
      {
        id: `UAL-${Date.now()}`,
        action: 'SEND',
        detail: '发送催办',
        at: createdAt,
        by: payload.fromName,
      },
    ],
  }

  initialUrges.push(urge)

  createNotification({
    level: 'INFO',
    title: '收到催办',
    content: `${payload.fromName}：请尽快处理 ${payload.targetId}`,
    recipientType: payload.toType,
    recipientId: payload.toId,
    recipientName: payload.toName,
    targetType: payload.targetType,
    targetId: payload.targetId,
    related: { caseId: payload.targetType === 'CASE' ? payload.targetId : undefined },
    deepLink: payload.deepLink,
    createdBy: payload.fromId,
  })

  return urge
}

function showProgressExceptionsToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-exceptions-toast-root'
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
      if (root && root.childElementCount === 0) root.remove()
    }, 180)
  }, 2400)
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function hasUpstreamFilter(): boolean {
  return Boolean(
    state.upstreamTaskId ||
      state.upstreamPo ||
      state.upstreamTenderId ||
      state.upstreamReasonCode ||
      state.upstreamSeverity ||
      state.upstreamCaseId,
  )
}

function syncFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey
  const params = getCurrentSearchParams()

  state.upstreamTaskId = params.get('taskId') || ''
  state.upstreamPo = params.get('po') || ''
  state.upstreamTenderId = params.get('tenderId') || ''
  state.upstreamReasonCode = params.get('reasonCode') || ''
  state.upstreamSeverity = params.get('severity') || ''
  state.upstreamCaseId = params.get('caseId') || ''

  const hasUpstream = hasUpstreamFilter()
  state.showUpstreamHint = hasUpstream

  if (!state.initializedByQuery) {
    state.initializedByQuery = true
    state.statusFilter = 'ALL'
    state.severityFilter = state.upstreamSeverity || 'ALL'
    state.subCategoryFilter = 'ALL'
  } else {
    if (state.upstreamSeverity) state.severityFilter = state.upstreamSeverity
  }

  if (state.upstreamReasonCode) {
    const reasonCode = state.upstreamReasonCode as ReasonCode
    const key = getDefaultSubCategoryKeyFromReason(reasonCode)
    if (key) state.subCategoryFilter = key
  }

  if (state.upstreamCaseId) {
    state.detailCaseId = state.upstreamCaseId
  }
}

function getSpuFromCase(exc: ExceptionCase): string {
  if (exc.relatedOrderIds.length === 0) return '-'
  const order = getOrderById(exc.relatedOrderIds[0])
  return order?.demandSnapshot?.spuCode || '-'
}

function filterCases(): ExceptionCase[] {
  const queryTaskId = state.upstreamTaskId
  const queryPo = state.upstreamPo
  const queryTenderId = state.upstreamTenderId
  const queryCaseId = state.upstreamCaseId

  return initialExceptions
    .filter((exc) => {
      if (queryTaskId && !exc.relatedTaskIds.includes(queryTaskId)) return false
      if (queryPo && !exc.relatedOrderIds.includes(queryPo)) return false
      if (queryTenderId && !exc.relatedTenderIds.includes(queryTenderId)) return false
      if (queryCaseId && exc.caseId !== queryCaseId) return false

      if (state.keyword.trim()) {
        const kw = state.keyword.trim().toLowerCase()
        const spuCode = getSpuFromCase(exc)
        const matched =
          exc.caseId.toLowerCase().includes(kw) ||
          exc.relatedOrderIds.some((id) => id.toLowerCase().includes(kw)) ||
          exc.relatedTaskIds.some((id) => id.toLowerCase().includes(kw)) ||
          exc.summary.toLowerCase().includes(kw) ||
          spuCode.toLowerCase().includes(kw)

        if (!matched) return false
      }

      if (state.statusFilter !== 'ALL' && normalizeCaseStatus(exc.caseStatus) !== state.statusFilter) return false
      if (state.severityFilter !== 'ALL' && exc.severity !== state.severityFilter) return false
      if (state.categoryFilter !== 'ALL' && getUnifiedCategory(exc) !== state.categoryFilter) return false
      if (state.subCategoryFilter !== 'ALL' && getSubCategoryKey(exc) !== state.subCategoryFilter) return false
      if (state.ownerFilter !== 'ALL' && exc.ownerUserId !== state.ownerFilter) return false
      if (state.factoryFilter !== 'ALL' && getCaseFactoryId(exc) !== state.factoryFilter) return false
      if (state.processFilter !== 'ALL') {
        const taskId = exc.relatedTaskIds[0]
        const task = taskId ? getTaskById(taskId) : undefined
        if (!task?.processCode || task.processCode !== state.processFilter) return false
      }

      if (state.aggregateFilter) {
        if (state.aggregateFilter.type === 'reason' && getSubCategoryKey(exc) !== state.aggregateFilter.value) {
          return false
        }

        if (state.aggregateFilter.type === 'factory') {
          const hitFactory = exc.relatedTaskIds.some((taskId) => {
            const task = getTaskById(taskId)
            return task?.assignedFactoryId === state.aggregateFilter?.value
          })
          if (!hitFactory) return false
        }

        if (state.aggregateFilter.type === 'process') {
          const hitProcess = exc.relatedTaskIds.some((taskId) => {
            const task = getTaskById(taskId)
            return task?.processCode === state.aggregateFilter?.value
          })
          if (!hitProcess) return false
        }
      }

      return true
    })
    .sort((a, b) => {
      const severityOrder: Record<Severity, number> = { S1: 0, S2: 1, S3: 2 }
      const statusOrder: Record<UiCaseStatus, number> = {
        OPEN: 0,
        IN_PROGRESS: 1,
        RESOLVED: 2,
        CLOSED: 3,
      }

      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }

      const aStatus = normalizeCaseStatus(a.caseStatus)
      const bStatus = normalizeCaseStatus(b.caseStatus)
      if (statusOrder[aStatus] !== statusOrder[bStatus]) {
        return statusOrder[aStatus] - statusOrder[bStatus]
      }

      const aUpdated = new Date(a.updatedAt.replace(' ', 'T')).getTime()
      const bUpdated = new Date(b.updatedAt.replace(' ', 'T')).getTime()
      return bUpdated - aUpdated
    })
}

function getKpis(now: Date): {
  open: number
  inProgress: number
  s1: number
  todayNew: number
  todayClosed: number
} {
  const all = initialExceptions
  const today = now.toISOString().slice(0, 10)

  return {
    open: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'OPEN').length,
    inProgress: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'IN_PROGRESS').length,
    s1: all.filter((exc) => exc.severity === 'S1' && normalizeCaseStatus(exc.caseStatus) !== 'CLOSED').length,
    todayNew: all.filter((exc) => exc.createdAt.slice(0, 10) === today).length,
    todayClosed: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'CLOSED' && (exc.closedAt || '').slice(0, 10) === today).length,
  }
}

function getAggregates(): {
  topReasons: Array<[SubCategoryKey, number]>
  topFactories: Array<[string, number]>
  topProcesses: Array<[string, number]>
} {
  const activeCases = initialExceptions.filter((exc) => normalizeCaseStatus(exc.caseStatus) !== 'CLOSED')

  const reasonCounts: Partial<Record<SubCategoryKey, number>> = {}
  const factoryCounts: Record<string, number> = {}
  const processCounts: Record<string, number> = {}

  for (const exc of activeCases) {
    const subKey = getSubCategoryKey(exc)
    reasonCounts[subKey] = (reasonCounts[subKey] ?? 0) + 1

    for (const taskId of exc.relatedTaskIds) {
      const task = getTaskById(taskId)
      if (task?.assignedFactoryId) {
        factoryCounts[task.assignedFactoryId] = (factoryCounts[task.assignedFactoryId] ?? 0) + 1
      }
      if (task?.processCode) {
        processCounts[task.processCode] = (processCounts[task.processCode] ?? 0) + 1
      }
    }
  }

  const topReasons = (Object.entries(reasonCounts) as Array<[SubCategoryKey, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topFactories = Object.entries(factoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topProcesses = Object.entries(processCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return {
    topReasons,
    topFactories,
    topProcesses,
  }
}

function clearFilters(): void {
  state.keyword = ''
  state.statusFilter = 'ALL'
  state.severityFilter = 'ALL'
  state.categoryFilter = 'ALL'
  state.subCategoryFilter = 'ALL'
  state.ownerFilter = 'ALL'
  state.factoryFilter = 'ALL'
  state.processFilter = 'ALL'
  state.aggregateFilter = null
  state.showUpstreamHint = false
  state.rowActionMenuCaseId = null
  state.pauseFollowUpCaseId = null
  state.pauseFollowUpRemark = ''
  appStore.navigate('/fcs/progress/exceptions')
}

function assignCaseOwner(exc: ExceptionCase, userId: string, userName: string): ExceptionCase {
  const now = nowTimestamp()
  const currentStatus = normalizeCaseStatus(exc.caseStatus)
  const promoteToInProgress = currentStatus === 'OPEN'

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: promoteToInProgress ? 'IN_PROGRESS' : exc.caseStatus,
    ownerUserId: userId,
    ownerUserName: userName,
    updatedAt: now,
  }

  updated = appendCaseAction(updated, {
    actionType: 'ASSIGN_OWNER',
    actionDetail: `指派责任人：${userName}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'ASSIGN',
    detail: `指派给 ${userName}`,
    at: now,
    by: 'Admin',
  })
  if (promoteToInProgress) {
    updated = appendCaseAction(updated, {
      actionType: 'FOLLOW_UP',
      actionDetail: '指派责任人后自动转为处理中',
      at: now,
      by: 'Admin',
    })
    updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')
  }

  updateException(updated)
  return updated
}

function confirmUnblock(): void {
  if (!state.unblockDialogCaseId) return

  const exc = getCaseById(state.unblockDialogCaseId)
  if (!exc) {
    state.unblockDialogCaseId = null
    state.unblockRemark = ''
    return
  }

  if (!state.unblockRemark.trim()) {
    showProgressExceptionsToast('请填写处理备注', 'error')
    return
  }

  const now = nowTimestamp()

  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (task?.status === 'BLOCKED') {
      updateTaskStatus(taskId, 'IN_PROGRESS')
    }
  }

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
  }
  updated = appendCaseAction(updated, {
    actionType: 'UNBLOCK',
    actionDetail: `恢复执行：${state.unblockRemark.trim()}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'UNBLOCK',
    detail: `执行恢复执行，备注：${state.unblockRemark.trim()}`,
    at: now,
    by: 'Admin',
  })
  updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')

  updateException(updated)
  showProgressExceptionsToast('已恢复执行')
  state.unblockDialogCaseId = null
  state.unblockRemark = ''
}

function confirmExtendTender(): void {
  if (!state.extendDialogCaseId) return

  const exc = getCaseById(state.extendDialogCaseId)
  if (!exc) {
    state.extendDialogCaseId = null
    return
  }

  const now = nowTimestamp()

  for (const tenderId of exc.relatedTenderIds) {
    extendTenderDeadline(tenderId, 24)
  }

  let updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
  }
  updated = appendCaseAction(updated, {
    actionType: 'EXTEND_TENDER',
    actionDetail: '延长竞价截止时间 24 小时',
    at: now,
    by: 'Admin',
  })
  updated = appendCaseAuditLog(updated, {
    action: 'EXTEND_TENDER',
    detail: '执行延长竞价 24 小时',
    at: now,
    by: 'Admin',
  })
  updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')

  updateException(updated)
  showProgressExceptionsToast('已延长竞价 24 小时')
  state.extendDialogCaseId = null
}

function confirmPauseFollowUp(): void {
  if (!state.pauseFollowUpCaseId) return
  if (!state.pauseFollowUpRemark.trim()) {
    showProgressExceptionsToast('请填写跟进备注', 'error')
    return
  }

  const exc = getCaseById(state.pauseFollowUpCaseId)
  if (!exc) {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
    return
  }

  const remark = state.pauseFollowUpRemark.trim()
  let result: { ok: boolean; message: string }

  if (exc.sourceType === 'FACTORY_PAUSE_REPORT') {
    result = recordPauseExceptionFollowUp(exc.caseId, remark, 'Admin')
  } else {
    const now = nowTimestamp()
    const shouldPromote = normalizeCaseStatus(exc.caseStatus) === 'OPEN'
    let updated: ExceptionCase = {
      ...exc,
      caseStatus: shouldPromote ? 'IN_PROGRESS' : exc.caseStatus,
      updatedAt: now,
    }
    updated = appendCaseAction(updated, {
      actionType: 'FOLLOW_UP',
      actionDetail: `记录跟进：${remark}`,
      at: now,
      by: 'Admin',
    })
    updated = appendCaseAuditLog(updated, {
      action: 'FOLLOW_UP',
      detail: `记录跟进：${remark}`,
      at: now,
      by: 'Admin',
    })
    if (shouldPromote) {
      updated = appendCaseStatusChangeAudit(updated, exc.caseStatus, 'IN_PROGRESS', now, 'Admin')
    }
    updateException(updated)
    result = { ok: true, message: '已记录跟进' }
  }

  showProgressExceptionsToast(result.message, result.ok ? 'success' : 'error')
  if (result.ok) {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
  }
}

function confirmPauseAllowContinue(caseId: string): void {
  const result = allowContinueFromPauseException(caseId, 'Admin')
  showProgressExceptionsToast(result.message, result.ok ? 'success' : 'error')
}

function openCloseDialog(caseId: string): void {
  state.closeDialogCaseId = caseId
  state.closeReason = 'RESOLVED_DONE'
  state.closeRemark = ''
  state.closeMergeCaseId = ''
}

function closeCloseDialog(): void {
  state.closeDialogCaseId = null
  state.closeReason = 'RESOLVED_DONE'
  state.closeRemark = ''
  state.closeMergeCaseId = ''
}

function confirmCloseException(): void {
  if (!state.closeDialogCaseId) return

  const exc = getCaseById(state.closeDialogCaseId)
  if (!exc) {
    closeCloseDialog()
    return
  }

  const reason = state.closeReason
  const remark = state.closeRemark.trim()
  const mergedCaseId = state.closeMergeCaseId.trim()
  const uiStatus = normalizeCaseStatus(exc.caseStatus)

  if (reason === 'RESOLVED_DONE' && uiStatus !== 'RESOLVED') {
    showProgressExceptionsToast('仅已解决异常可按“已解决后关闭”关闭', 'error')
    return
  }

  if (DIRECT_CLOSE_REASON_SET.has(reason) && !remark) {
    showProgressExceptionsToast('请补充关闭备注，说明关闭依据', 'error')
    return
  }

  if ((reason === 'DUPLICATE' || reason === 'MERGED') && !mergedCaseId && !remark) {
    showProgressExceptionsToast('请填写关联异常号或关闭备注', 'error')
    return
  }

  const now = nowTimestamp()
  const closeDetail = [
    `关闭异常：${CLOSE_REASON_LABEL[reason]}`,
    mergedCaseId ? `关联异常 ${mergedCaseId}` : '',
    remark ? `备注：${remark}` : '',
  ]
    .filter(Boolean)
    .join('，')

  updateException(
    markCaseClosed(exc, {
      by: 'Admin',
      reasonCode: reason,
      detail: closeDetail,
      mergedCaseId: mergedCaseId || undefined,
      at: now,
      actionType: 'CLOSE_EXCEPTION',
      auditAction: 'CLOSE_EXCEPTION',
    }),
  )

  showProgressExceptionsToast('异常已关闭')
  closeCloseDialog()
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderStatusBadge(caseStatus: CaseStatus): string {
  const uiStatus = normalizeCaseStatus(caseStatus)
  return `
    <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${STATUS_COLOR_CLASS[uiStatus]}">
      <i data-lucide="${STATUS_ICON[uiStatus]}" class="h-3 w-3"></i>
      ${CASE_STATUS_LABEL[uiStatus]}
    </span>
  `
}

function renderActionMenu(exc: ExceptionCase): string {
  const isOpen = state.rowActionMenuCaseId === exc.caseId
  const firstTaskId = exc.relatedTaskIds[0] || ''
  const firstOrderId = exc.relatedOrderIds[0] || ''
  const isPauseReport = exc.sourceType === 'FACTORY_PAUSE_REPORT'
  const unifiedCategory = getUnifiedCategory(exc)

  return `
    <div class="relative inline-flex" data-pe-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-pe-action="toggle-row-menu" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
              ? `
            <div class="absolute right-0 top-9 z-30 w-52 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-view" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>处理
              </button>

              ${
                isPauseReport && exc.caseStatus !== 'CLOSED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-pause-followup" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="message-square" class="mr-2 h-4 w-4"></i>记录跟进</button>`
                  : ''
              }

              ${
                isPauseReport && exc.caseStatus !== 'CLOSED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-pause-continue" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="play" class="mr-2 h-4 w-4"></i>允许继续</button>`
                  : ''
              }

              ${
                !isPauseReport && exc.reasonCode.startsWith('BLOCKED_')
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-unblock" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="play" class="mr-2 h-4 w-4"></i>恢复执行</button>`
                  : ''
              }

              ${
                ['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(exc.reasonCode) && exc.relatedTenderIds.length > 0
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-extend" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="clock" class="mr-2 h-4 w-4"></i>延长竞价</button>`
                  : ''
              }

              ${
                ['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(exc.reasonCode)
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-reassign" data-task-id="${escapeAttr(firstTaskId)}" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true"><i data-lucide="send" class="mr-2 h-4 w-4"></i>重新分配</button>`
                  : ''
              }

              ${
                exc.reasonCode === 'TECH_PACK_NOT_RELEASED'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-tech-pack" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true"><i data-lucide="file-text" class="mr-2 h-4 w-4"></i>进入技术包</button>`
                  : ''
              }

              <div class="my-1 h-px bg-border"></div>
              ${
                unifiedCategory === 'MATERIAL'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-material" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true"><i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料进度</button>`
                  : ''
              }
              ${
                unifiedCategory === 'HANDOUT'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}" data-pe-stop="true"><i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>查看交接链路</button>`
                  : ''
              }
              ${
                unifiedCategory === 'HANDOUT'
                  ? `<button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-handover-objection" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}" data-pe-stop="true"><i data-lucide="alert-circle" class="mr-2 h-4 w-4"></i>查看数量异议</button>`
                  : ''
              }
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderHeader(): string {
  return `
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">异常定位与处理</h1>
        <p class="text-sm text-muted-foreground">按异常分类定位问题，并联动处理</p>
        <p class="mt-1 text-xs text-muted-foreground">严重度口径：S1 已影响当前生产或交付，需要优先处理；S2 问题已成立，需要尽快处理；S3 为预警或轻度问题，需要持续跟进。</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>
        <button class="inline-flex h-8 cursor-not-allowed items-center rounded-md border px-3 text-sm text-muted-foreground" disabled>
          <i data-lucide="download" class="mr-1.5 h-4 w-4"></i>导出
        </button>
      </div>
    </header>
  `
}

function renderUpstreamHint(): string {
  if (!state.showUpstreamHint || !hasUpstreamFilter()) return ''

  return `
    <section class="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
      <div class="flex flex-wrap items-center gap-2 text-sm text-blue-700">
        <i data-lucide="alert-circle" class="h-4 w-4"></i>
        <span>来自上一步筛选：</span>
        ${state.upstreamTaskId ? renderBadge(`任务: ${state.upstreamTaskId}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamPo ? renderBadge(`生产单: ${state.upstreamPo}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamTenderId ? renderBadge(`招标单: ${state.upstreamTenderId}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamReasonCode ? renderBadge(`原因: ${REASON_LABEL[state.upstreamReasonCode as ReasonCode] || state.upstreamReasonCode}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamSeverity ? renderBadge(`严重度: ${state.upstreamSeverity}`, 'border-blue-200 bg-white text-blue-700') : ''}
        ${state.upstreamCaseId ? renderBadge(`异常号: ${state.upstreamCaseId}`, 'border-blue-200 bg-white text-blue-700') : ''}
      </div>
      <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-blue-700 hover:bg-blue-100" data-pe-action="clear-filters">
        <i data-lucide="x" class="mr-1 h-4 w-4"></i>清除筛选
      </button>
    </section>
  `
}

function renderKpiCards(kpis: { open: number; inProgress: number; s1: number; todayNew: number; todayClosed: number }): string {
  return `
    <section class="grid grid-cols-5 gap-4">
      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-open">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">待处理</p>
            <p class="text-2xl font-bold text-red-600">${kpis.open}</p>
          </div>
          <i data-lucide="alert-circle" class="h-8 w-8 text-red-200"></i>
        </div>
      </button>

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-in-progress">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">处理中</p>
            <p class="text-2xl font-bold text-blue-600">${kpis.inProgress}</p>
          </div>
          <i data-lucide="play" class="h-8 w-8 text-blue-200"></i>
        </div>
      </button>

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-s1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">S1 异常</p>
            <p class="text-2xl font-bold text-red-600">${kpis.s1}</p>
          </div>
          <i data-lucide="alert-triangle" class="h-8 w-8 text-red-200"></i>
        </div>
      </button>

      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">今日新增</p>
            <p class="text-2xl font-bold">${kpis.todayNew}</p>
          </div>
          <i data-lucide="plus" class="h-8 w-8 text-slate-200"></i>
        </div>
      </article>

      <article class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">今日关闭</p>
            <p class="text-2xl font-bold text-green-600">${kpis.todayClosed}</p>
          </div>
          <i data-lucide="check-circle-2" class="h-8 w-8 text-green-200"></i>
        </div>
      </article>
    </section>
  `
}

function renderAggregateCards(aggregates: {
  topReasons: Array<[SubCategoryKey, number]>
  topFactories: Array<[string, number]>
  topProcesses: Array<[string, number]>
}): string {
  return `
    <section class="grid grid-cols-3 gap-4">
      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常原因 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topReasons.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topReasons
                  .map(
                    ([key, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-reason" data-value="${escapeAttr(key)}">
                        <span class="truncate">${escapeHtml(SUB_CATEGORY_LABEL[key])}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常工厂 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topFactories.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topFactories
                  .map(
                    ([factoryId, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-factory" data-value="${escapeAttr(factoryId)}">
                        <span class="truncate">${escapeHtml(getFactoryById(factoryId)?.name || factoryId)}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>

      <article class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3 text-sm font-medium">异常工艺 TOP5</header>
        <div class="space-y-1 px-4 py-3">
          ${
            aggregates.topProcesses.length === 0
              ? '<p class="text-sm text-muted-foreground">暂无数据</p>'
              : aggregates.topProcesses
                  .map(
                    ([processCode, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-process" data-value="${escapeAttr(processCode)}">
                        <span class="truncate">${escapeHtml(getProcessTypeByCode(processCode)?.nameZh || processCode)}</span>
                        ${renderBadge(String(count), 'border-border bg-background text-foreground')}
                      </button>
                    `,
                  )
                  .join('')
          }
        </div>
      </article>
    </section>
  `
}

function renderCategoryQuickSwitch(): string {
  const options: Array<{ key: 'ALL' | UnifiedCategory; label: string }> = [
    { key: 'ALL', label: '全部' },
    { key: 'ASSIGNMENT', label: '分配异常' },
    { key: 'EXECUTION', label: '执行异常' },
    { key: 'TECH_PACK', label: '技术包异常' },
    { key: 'MATERIAL', label: '领料异常' },
    { key: 'HANDOUT', label: '交出异常' },
  ]

  return `
    <section class="rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center gap-2">
        ${options
          .map((item) => {
            const active = state.categoryFilter === item.key
            return `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="quick-category" data-category="${item.key}">${item.label}</button>`
          })
          .join('')}
      </div>
    </section>
  `
}

function getFactoryFilterOptions(): Array<{ id: string; name: string }> {
  const map = new Map<string, string>()
  for (const exc of initialExceptions) {
    const factoryId = getCaseFactoryId(exc)
    if (!factoryId) continue
    map.set(factoryId, getFactoryById(factoryId)?.name || factoryId)
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

function getProcessFilterOptions(): Array<{ code: string; name: string }> {
  const map = new Map<string, string>()
  for (const exc of initialExceptions) {
    const taskId = exc.relatedTaskIds[0]
    if (!taskId) continue
    const task = getTaskById(taskId)
    if (!task?.processCode) continue
    map.set(task.processCode, getProcessTypeByCode(task.processCode)?.nameZh || task.processNameZh || task.processCode)
  }
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

function renderFilters(): string {
  const subCategoryOptions = getSubCategoryOptions(state.categoryFilter)
  const factoryOptions = getFactoryFilterOptions()
  const processOptions = getProcessFilterOptions()

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[220px] flex-1">
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="异常单号 / 生产单 / 任务 / SPU / 摘要"
            value="${escapeAttr(state.keyword)}"
            data-pe-field="keyword"
          />
        </div>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="severityFilter">
          <option value="ALL" ${state.severityFilter === 'ALL' ? 'selected' : ''}>全部严重度</option>
          <option value="S1" ${state.severityFilter === 'S1' ? 'selected' : ''}>S1</option>
          <option value="S2" ${state.severityFilter === 'S2' ? 'selected' : ''}>S2</option>
          <option value="S3" ${state.severityFilter === 'S3' ? 'selected' : ''}>S3</option>
        </select>

        <select class="h-9 w-[130px] rounded-md border bg-background px-3 text-sm" data-pe-field="categoryFilter">
          <option value="ALL" ${state.categoryFilter === 'ALL' ? 'selected' : ''}>全部分类</option>
          <option value="ASSIGNMENT" ${state.categoryFilter === 'ASSIGNMENT' ? 'selected' : ''}>分配异常</option>
          <option value="EXECUTION" ${state.categoryFilter === 'EXECUTION' ? 'selected' : ''}>执行异常</option>
          <option value="TECH_PACK" ${state.categoryFilter === 'TECH_PACK' ? 'selected' : ''}>技术包异常</option>
          <option value="MATERIAL" ${state.categoryFilter === 'MATERIAL' ? 'selected' : ''}>领料异常</option>
          <option value="HANDOUT" ${state.categoryFilter === 'HANDOUT' ? 'selected' : ''}>交出异常</option>
        </select>

        <select class="h-9 w-[170px] rounded-md border bg-background px-3 text-sm" data-pe-field="subCategoryFilter">
          <option value="ALL" ${state.subCategoryFilter === 'ALL' ? 'selected' : ''}>全部二级分类</option>
          ${subCategoryOptions
            .map((option) => `<option value="${option.key}" ${state.subCategoryFilter === option.key ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="statusFilter">
          <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
          <option value="OPEN" ${state.statusFilter === 'OPEN' ? 'selected' : ''}>待处理</option>
          <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>处理中</option>
          <option value="RESOLVED" ${state.statusFilter === 'RESOLVED' ? 'selected' : ''}>已解决</option>
          <option value="CLOSED" ${state.statusFilter === 'CLOSED' ? 'selected' : ''}>已关闭</option>
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="ownerFilter">
          <option value="ALL" ${state.ownerFilter === 'ALL' ? 'selected' : ''}>全部责任人</option>
          ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${state.ownerFilter === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <select class="h-9 w-[160px] rounded-md border bg-background px-3 text-sm" data-pe-field="factoryFilter">
          <option value="ALL" ${state.factoryFilter === 'ALL' ? 'selected' : ''}>全部工厂</option>
          ${factoryOptions.map((item) => `<option value="${item.id}" ${state.factoryFilter === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <select class="h-9 w-[140px] rounded-md border bg-background px-3 text-sm" data-pe-field="processFilter">
          <option value="ALL" ${state.processFilter === 'ALL' ? 'selected' : ''}>全部工序</option>
          ${processOptions.map((item) => `<option value="${item.code}" ${state.processFilter === item.code ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>

        <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="clear-filters">重置</button>
      </div>

      ${
        state.aggregateFilter
          ? `
            <div class="mt-2 flex items-center gap-2">
              <span class="text-sm text-muted-foreground">聚合筛选：</span>
              ${renderBadge(
                state.aggregateFilter.type === 'reason'
                  ? SUB_CATEGORY_LABEL[state.aggregateFilter.value]
                  : state.aggregateFilter.type === 'factory'
                    ? getFactoryById(state.aggregateFilter.value)?.name || state.aggregateFilter.value
                    : getProcessTypeByCode(state.aggregateFilter.value)?.nameZh || state.aggregateFilter.value,
                'border-border bg-background text-foreground',
              )}
              <button class="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted" data-pe-action="clear-aggregate"><i data-lucide="x" class="h-3 w-3"></i></button>
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderTable(cases: ExceptionCase[]): string {
  const emptyText = state.upstreamTaskId
    ? '当前任务暂无异常，可继续在任务页跟进'
    : '暂无数据'

  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-2 text-sm text-muted-foreground">共 ${cases.length} 条</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1760px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="w-[130px] px-3 py-2 font-medium">异常号</th>
              <th class="w-[80px] px-3 py-2 font-medium">严重度</th>
              <th class="w-[110px] px-3 py-2 font-medium">状态</th>
              <th class="w-[120px] px-3 py-2 font-medium">一级分类</th>
              <th class="w-[170px] px-3 py-2 font-medium">二级分类</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="w-[130px] px-3 py-2 font-medium">工厂</th>
              <th class="w-[120px] px-3 py-2 font-medium">工序</th>
              <th class="w-[110px] px-3 py-2 font-medium">SPU</th>
              <th class="w-[100px] px-3 py-2 font-medium">责任人</th>
              <th class="w-[145px] px-3 py-2 font-medium">最近更新</th>
              <th class="w-[90px] px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              cases.length === 0
                ? `<tr><td colspan="12" class="px-3 py-10 text-center text-muted-foreground">${emptyText}</td></tr>`
                : cases
                    .slice(0, 20)
                    .map((exc) => {
                      const firstOrderId = exc.relatedOrderIds[0] || ''
                      const firstTaskId = exc.relatedTaskIds[0] || ''
                      const unifiedCategory = getUnifiedCategory(exc)
                      const subCategory = getSubCategoryLabel(exc)
                      const relatedObjects = getRelatedObjects(exc)
                      const processName = getCaseProcessName(exc)
                      const linkedFactory = getCaseFactoryName(exc)

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-pe-action="open-detail" data-case-id="${escapeAttr(exc.caseId)}">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(exc.caseId)}</td>
                          <td class="px-3 py-2">${renderBadge(exc.severity, SEVERITY_COLOR_CLASS[exc.severity])}</td>
                          <td class="px-3 py-2">${renderStatusBadge(exc.caseStatus)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(CATEGORY_LABEL[unifiedCategory])}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(subCategory)}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1">
                              ${relatedObjects
                                .slice(0, 3)
                                .map((item) => `<div class="text-xs text-muted-foreground">${escapeHtml(item.typeLabel)}：${escapeHtml(item.id)}</div>`)
                                .join('')}
                              ${relatedObjects.length > 3 ? `<div class="text-xs text-muted-foreground">+${relatedObjects.length - 3} 条</div>` : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(linkedFactory)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(processName)}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(getSpuFromCase(exc))}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(exc.ownerUserName || '-')}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(exc.updatedAt.slice(5, 16))}</td>
                          <td class="px-3 py-2 text-right" data-pe-stop="true">
                            <div class="flex items-center justify-end gap-2">
                              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-detail" data-case-id="${escapeAttr(exc.caseId)}" data-pe-stop="true">处理</button>
                              ${renderActionMenu(exc)}
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderBasicTab(detailCase: ExceptionCase): string {
  const unifiedCategory = getUnifiedCategory(detailCase)
  const subCategory = getSubCategoryLabel(detailCase)
  const resolvedStateLabel = detailCase.resolvedAt ? '已解决' : '未解决'
  const resolvedRuleLabel = detailCase.resolvedRuleCode ? RESOLVE_RULE_LABEL[detailCase.resolvedRuleCode] : '-'
  const resolvedSourceLabel = detailCase.resolvedSource ? RESOLVE_SOURCE_LABEL[detailCase.resolvedSource] : '-'
  const closeReasonLabel = detailCase.closeReasonCode ? CLOSE_REASON_LABEL[detailCase.closeReasonCode] : '-'

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">异常号</p>
          <p class="font-medium">${escapeHtml(detailCase.caseId)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">状态</p>
          <p class="font-medium">${escapeHtml(CASE_STATUS_LABEL[normalizeCaseStatus(detailCase.caseStatus)])}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">一级分类</p>
          <p class="font-medium">${escapeHtml(CATEGORY_LABEL[unifiedCategory])}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">二级分类</p>
          <p class="font-medium">${escapeHtml(subCategory)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">来源</p>
          <p class="font-medium">${escapeHtml(detailCase.sourceType)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">当前责任人</p>
          <p class="font-medium">${escapeHtml(detailCase.ownerUserName || '-')}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">创建时间</p>
          <p class="font-medium">${escapeHtml(detailCase.createdAt)}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">最近更新时间</p>
          <p class="font-medium">${escapeHtml(detailCase.updatedAt)}</p>
        </div>
      </div>

      <div class="rounded-md border bg-muted/20 p-3">
        <p class="mb-2 text-xs font-medium text-muted-foreground">处理结果</p>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">解决状态</p>
            <p class="font-medium">${escapeHtml(resolvedStateLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决规则</p>
            <p class="font-medium">${escapeHtml(resolvedRuleLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决来源</p>
            <p class="font-medium">${escapeHtml(resolvedSourceLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决人</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedBy || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决时间</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedAt || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭原因</p>
            <p class="font-medium">${escapeHtml(closeReasonLabel)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭人</p>
            <p class="font-medium">${escapeHtml(detailCase.closedBy || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关闭时间</p>
            <p class="font-medium">${escapeHtml(detailCase.closedAt || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">关联异常号</p>
            <p class="font-medium">${escapeHtml(detailCase.mergedCaseId || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">解决说明</p>
            <p class="font-medium">${escapeHtml(detailCase.resolvedDetail || '-')}</p>
          </div>
          <div class="col-span-2">
            <p class="text-xs text-muted-foreground">关闭说明</p>
            <p class="font-medium">${escapeHtml(detailCase.closeDetail || detailCase.closeRemark || '-')}</p>
          </div>
        </div>
      </div>

      <div class="border-t pt-3">
        <p class="text-xs text-muted-foreground">摘要</p>
        <p class="font-medium">${escapeHtml(detailCase.summary)}</p>
      </div>

      <div>
        <p class="text-xs text-muted-foreground">详情</p>
        <p class="whitespace-pre-wrap text-sm text-muted-foreground">${escapeHtml(detailCase.detail)}</p>
      </div>

      ${
        detailCase.tags.length > 0
          ? `<div><p class="text-xs text-muted-foreground">标签</p><div class="mt-1 flex flex-wrap gap-1">${detailCase.tags
              .map((tag) => renderBadge(tag, 'border-border bg-background text-foreground'))
              .join('')}</div></div>`
          : ''
      }
    </div>
  `
}

function renderRelatedTab(detailCase: ExceptionCase): string {
  const firstOrderId = detailCase.relatedOrderIds[0] || ''
  const firstTaskId = detailCase.relatedTaskIds[0] || ''
  const relatedObjects = getRelatedObjects(detailCase)

  return `
    <div class="space-y-4">
      <div class="rounded-md border p-3">
        <p class="text-xs text-muted-foreground">关联对象</p>
        <div class="mt-2 space-y-1">
          ${
            relatedObjects.length > 0
              ? relatedObjects
                  .map((item) => `<p class="text-sm"><span class="text-muted-foreground">${escapeHtml(item.typeLabel)}：</span><span class="font-medium">${escapeHtml(item.id)}</span></p>`)
                  .join('')
              : '<p class="text-sm text-muted-foreground">暂无关联对象</p>'
          }
        </div>
      </div>

      <div class="border-t pt-3">
        <p class="text-xs text-muted-foreground">快捷跳转</p>
        <div class="mt-2 flex flex-wrap gap-2">
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}"><i data-lucide="file-text" class="mr-1 h-4 w-4"></i>技术包</button>`
              : ''
          }
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}"><i data-lucide="scan-line" class="mr-1 h-4 w-4"></i>查看交接链路</button>`
              : ''
          }
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}"><i data-lucide="package" class="mr-1 h-4 w-4"></i>领料进度</button>`
              : ''
          }
        </div>
      </div>
    </div>
  `
}

function renderSourceTab(detailCase: ExceptionCase): string {
  const firstOrderId = detailCase.relatedOrderIds[0] || '-'
  const firstTaskId = detailCase.relatedTaskIds[0] || '-'
  const firstTenderId = detailCase.relatedTenderIds[0] || '-'
  const unifiedCategory = getUnifiedCategory(detailCase)
  const task = firstTaskId !== '-' ? getTaskById(firstTaskId) : undefined
  const order = firstOrderId !== '-' ? getOrderById(firstOrderId) : undefined
  const tender = firstTenderId !== '-' ? getTenderById(firstTenderId) : undefined
  const materialRows = getMaterialIssueRows(detailCase)
  const { orderSummary: handoverOrderSummary, taskSummary: handoverTaskSummary } = getHandoverCaseSnapshot(detailCase)

  const renderKv = (label: string, value: string): string => `
    <div class="rounded-md border bg-background px-3 py-2">
      <p class="text-[11px] text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm">${escapeHtml(value || '-')}</p>
    </div>
  `

  const formatMilestoneSnapshot = (snapshot?: ExceptionCase['milestoneSnapshot']): string => {
    if (!snapshot?.required) return '无强制关键节点'
    const statusLabel = snapshot.status === 'REPORTED' ? '已上报' : '待上报'
    const fallbackRule =
      snapshot.targetQty && snapshot.targetQty > 0
        ? `完成第 ${snapshot.targetQty} ${snapshot.targetUnit === 'YARD' ? 'Yard' : '件'}后上报`
        : '已配置关键节点'
    const ruleText = snapshot.ruleLabel || fallbackRule
    return `${ruleText} / ${statusLabel}`
  }

  if (unifiedCategory === 'ASSIGNMENT') {
    return `
      <div class="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p class="text-sm font-medium text-blue-700">分配异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('招标单号', firstTenderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('分配方式', tender ? '竞价' : '派单')}
          ${renderKv('竞价状态', tender?.status || '-')}
          ${renderKv('竞价截止', tender?.deadline || '-')}
          ${renderKv('当前失败原因', getSubCategoryLabel(detailCase))}
          ${renderKv(
            '任务是否仍未分出',
            task ? (task.assignmentStatus === 'UNASSIGNED' || !task.assignedFactoryId ? '是' : '否') : '是',
          )}
        </div>
        <p class="text-xs text-muted-foreground">
          候选工厂：${
            tender?.invitedFactoryIds?.length
              ? escapeHtml(
                  tender.invitedFactoryIds
                    .slice(0, 4)
                    .map((id) => getFactoryById(id)?.name || id)
                    .join('、'),
                )
              : '暂无候选工厂信息'
          }
        </p>
      </div>
    `
  }

  if (unifiedCategory === 'EXECUTION') {
    return `
      <div class="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p class="text-sm font-medium text-amber-700">执行异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('PDA任务号', detailCase.sourceId.startsWith('PDA-') ? detailCase.sourceId : '-')}
          ${renderKv('工厂', getCaseFactoryName(detailCase))}
          ${renderKv('当前工序', getCaseProcessName(detailCase))}
          ${renderKv('任务状态', getTaskStatusLabel(task))}
          ${renderKv('当前问题', getSubCategoryLabel(detailCase))}
        </div>
        ${
          detailCase.reasonCode === 'START_OVERDUE'
            ? `
              <div class="grid grid-cols-2 gap-2">
                ${renderKv('接单时间', task?.acceptedAt || '-')}
                ${renderKv('中标时间', task?.awardedAt || '-')}
                ${renderKv('开工时限', task?.startDueAt || '-')}
                ${renderKv('是否已开工', task?.startedAt ? '已开工' : '未开工')}
              </div>
            `
            : ''
        }
        ${
          detailCase.sourceType === 'FACTORY_PAUSE_REPORT'
            ? `
              <div class="grid grid-cols-2 gap-2">
                ${renderKv('暂停原因', detailCase.pauseReasonLabel || getReasonLabel(detailCase))}
                ${renderKv('上报时间', detailCase.pauseReportedAt || '-')}
              </div>
              <p class="text-sm text-muted-foreground">暂停说明：${escapeHtml(detailCase.pauseRemark || '—')}</p>
              <p class="text-xs text-muted-foreground">
                暂停凭证：${detailCase.pauseProofFiles?.length || 0} 个 ｜ 关键节点：${
                  formatMilestoneSnapshot(detailCase.milestoneSnapshot)
                }
              </p>
            `
            : ''
        }
      </div>
    `
  }

  if (unifiedCategory === 'TECH_PACK') {
    return `
      <div class="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <p class="text-sm font-medium text-purple-700">技术包异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('技术包状态', getSubCategoryLabel(detailCase))}
          ${renderKv('技术包版本', order?.techPackSnapshot?.versionLabel || '-')}
          ${renderKv('是否已发布', /未发布|缺失/.test(getSubCategoryLabel(detailCase)) ? '否' : '待确认')}
          ${renderKv('影响 SPU', order?.demandSnapshot.spuCode || '-')}
        </div>
        <p class="text-sm text-muted-foreground">来源说明：${escapeHtml(detailCase.detail)}</p>
      </div>
    `
  }

  if (unifiedCategory === 'MATERIAL') {
    const totalRequested = materialRows.reduce((sum, row) => sum + row.requestedQty, 0)
    const totalIssued = materialRows.reduce((sum, row) => sum + row.issuedQty, 0)
    return `
      <div class="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
        <p class="text-sm font-medium text-teal-700">领料异常来源明细</p>
        <div class="grid grid-cols-2 gap-2">
          ${renderKv('生产单号', firstOrderId)}
          ${renderKv('任务号', firstTaskId)}
          ${renderKv('异常类型', getSubCategoryLabel(detailCase))}
          ${renderKv('领料记录数', String(materialRows.length))}
          ${renderKv('累计需求数量', `${totalRequested || 0}`)}
          ${renderKv('累计已领数量', `${totalIssued || 0}`)}
        </div>
        ${
          materialRows.length > 0
            ? `
              <div class="space-y-1 rounded-md border bg-background p-2">
                ${materialRows
                  .slice(0, 3)
                  .map((row) => `<p class="text-xs text-muted-foreground">${escapeHtml(row.issueId)}｜${escapeHtml(row.materialSummaryZh)}｜${row.issuedQty}/${row.requestedQty}</p>`)
                  .join('')}
                ${materialRows.length > 3 ? `<p class="text-xs text-muted-foreground">还有 ${materialRows.length - 3} 条记录</p>` : ''}
              </div>
            `
            : '<p class="text-xs text-muted-foreground">暂无领料记录，当前异常由任务链路自动沉淀。</p>'
        }
      </div>
    `
  }

  return `
    <div class="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
      <p class="text-sm font-medium text-cyan-700">交出异常来源明细</p>
      <p class="text-xs text-cyan-700">交接链路情况</p>
      <div class="grid grid-cols-2 gap-2">
        ${renderKv('生产单号', firstOrderId)}
        ${renderKv('任务号', firstTaskId)}
        ${renderKv('异常类型', getSubCategoryLabel(detailCase))}
        ${renderKv('当前交接状态', handoverTaskSummary?.processStatusLabel || handoverOrderSummary?.currentBottleneckLabel || '暂无交接事件')}
        ${renderKv('当前卡点', handoverOrderSummary?.currentBottleneckLabel || '暂无卡点')}
        ${renderKv('下一步', handoverTaskSummary?.nextActionHint || handoverOrderSummary?.currentBottleneckHint || '当前暂无处理动作')}
      </div>
      <div class="rounded-md border bg-background p-2 text-xs text-muted-foreground">
        <p>最近事件时间：${escapeHtml(handoverTaskSummary?.latestOccurredAt || handoverOrderSummary?.latestOccurredAt || '-')}</p>
        <p class="mt-1">待处理节点：${handoverOrderSummary?.pendingCount || 0} ｜ 异议节点：${handoverOrderSummary?.objectionCount || 0}</p>
        <p class="mt-1">说明：当前交接情况来自交接链路事实台帐，可直接跳转查看明细记录。</p>
      </div>
    </div>
  `
}

function renderActionsTab(detailCase: ExceptionCase): string {
  const firstTaskId = detailCase.relatedTaskIds[0] || ''
  const firstOrderId = detailCase.relatedOrderIds[0] || ''
  const firstTenderId = detailCase.relatedTenderIds[0] || ''
  const unifiedCategory = getUnifiedCategory(detailCase)
  const uiStatus = normalizeCaseStatus(detailCase.caseStatus)
  const canUrge = Boolean(detailCase.ownerUserId && (uiStatus === 'OPEN' || uiStatus === 'IN_PROGRESS'))
  const judge = getResolveJudgeResult(detailCase)
  const processingCards: string[] = []
  const linkCards: string[] = []

  if (unifiedCategory === 'ASSIGNMENT') {
    if (['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(detailCase.reasonCode) && detailCase.relatedTenderIds.length > 0) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-extend-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="clock" class="h-5 w-5 text-blue-600"></i>
            <div>
              <p class="font-medium">延长竞价</p>
              <p class="text-xs text-muted-foreground">将关联竞价统一延长 24 小时</p>
            </div>
          </div>
        </button>
      `)
    }
    if (['TENDER_OVERDUE', 'NO_BID', 'DISPATCH_REJECTED', 'ACK_TIMEOUT'].includes(detailCase.reasonCode)) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="row-reassign" data-task-id="${escapeAttr(firstTaskId)}" data-order-id="${escapeAttr(firstOrderId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="send" class="h-5 w-5 text-orange-600"></i>
            <div>
              <p class="font-medium">重新分配</p>
              <p class="text-xs text-muted-foreground">进入任务分配页面处理派单/竞价</p>
            </div>
          </div>
        </button>
      `)
    }
    if (canUrge) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="urge-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="bell" class="h-5 w-5 text-amber-600"></i>
            <div>
              <p class="font-medium">催接单</p>
              <p class="text-xs text-muted-foreground">提醒责任人尽快推进分配处理</p>
            </div>
          </div>
        </button>
      `)
    }
    if (firstTenderId) {
      linkCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-tender" data-tender-id="${escapeAttr(firstTenderId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="file-search" class="h-5 w-5 text-blue-600"></i>
            <div>
              <p class="font-medium">查看招标单</p>
              <p class="text-xs text-muted-foreground">查看竞价与派单上下文</p>
            </div>
          </div>
        </button>
      `)
    }
    if (firstTaskId) {
      linkCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-task" data-task-id="${escapeAttr(firstTaskId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="list-checks" class="h-5 w-5 text-indigo-600"></i>
            <div>
              <p class="font-medium">查看任务</p>
              <p class="text-xs text-muted-foreground">查看任务当前分配状态</p>
            </div>
          </div>
        </button>
      `)
    }
  }

  if (unifiedCategory === 'EXECUTION' && detailCase.reasonCode === 'START_OVERDUE') {
    if (canUrge) {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="urge-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="bell" class="h-5 w-5 text-amber-600"></i>
            <div>
              <p class="font-medium">催办</p>
              <p class="text-xs text-muted-foreground">提醒责任人推动工厂尽快开工</p>
            </div>
          </div>
        </button>
      `)
    }
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="go-start" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">去开工</p>
            <p class="text-xs text-muted-foreground">进入 PDA 执行详情补齐开工信息</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-blue-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看工厂端当前任务状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'EXECUTION' && detailCase.sourceType === 'FACTORY_PAUSE_REPORT') {
    if (uiStatus !== 'CLOSED') {
      processingCards.push(`
        <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="pause-allow-continue" data-case-id="${escapeAttr(detailCase.caseId)}">
          <div class="flex items-center gap-2">
            <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
            <div>
              <p class="font-medium">允许继续</p>
              <p class="text-xs text-muted-foreground">恢复执行并判定为已解决</p>
            </div>
          </div>
        </button>
      `)
    }
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-detail" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="clipboard-list" class="h-5 w-5 text-blue-600"></i>
          <div>
            <p class="font-medium">查看暂停详情</p>
            <p class="text-xs text-muted-foreground">查看暂停原因、说明与凭证</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-indigo-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看工厂暂停任务状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (
    unifiedCategory === 'EXECUTION' &&
    detailCase.sourceType !== 'FACTORY_PAUSE_REPORT' &&
    detailCase.reasonCode.startsWith('BLOCKED_') &&
    uiStatus !== 'CLOSED'
  ) {
    processingCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-unblock-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">恢复执行</p>
            <p class="text-xs text-muted-foreground">确认处理结果后恢复任务继续执行</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'EXECUTION' && firstTaskId && detailCase.sourceType !== 'FACTORY_PAUSE_REPORT' && detailCase.reasonCode !== 'START_OVERDUE') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="goto-pda-task" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="smartphone" class="h-5 w-5 text-indigo-600"></i>
          <div>
            <p class="font-medium">查看 PDA 任务</p>
            <p class="text-xs text-muted-foreground">查看执行进度与当前现场状态</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'TECH_PACK') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="h-5 w-5 text-purple-600"></i>
          <div>
            <p class="font-medium">查看技术包</p>
            <p class="text-xs text-muted-foreground">查看技术包状态与版本信息</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="edit-3" class="h-5 w-5 text-purple-600"></i>
          <div>
            <p class="font-medium">去技术包处理</p>
            <p class="text-xs text-muted-foreground">前往技术包页面补充并发布</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'HANDOUT') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="scan-line" class="h-5 w-5 text-cyan-600"></i>
          <div>
            <p class="font-medium">查看交接链路</p>
            <p class="text-xs text-muted-foreground">查看交出头、交出记录、仓库确认和异议处理</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-handover-objection" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="alert-circle" class="h-5 w-5 text-amber-600"></i>
          <div>
            <p class="font-medium">查看数量异议</p>
            <p class="text-xs text-muted-foreground">查看异议状态并联动平台处理</p>
          </div>
        </div>
      </button>
    `)
  }

  if (unifiedCategory === 'MATERIAL') {
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="package" class="h-5 w-5 text-teal-600"></i>
          <div>
            <p class="font-medium">查看领料进度</p>
            <p class="text-xs text-muted-foreground">联动物料齐套状态与缺口</p>
          </div>
        </div>
      </button>
    `)
    linkCards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="list" class="h-5 w-5 text-teal-600"></i>
          <div>
            <p class="font-medium">查看领料详情</p>
            <p class="text-xs text-muted-foreground">查看领料记录与未闭合项</p>
          </div>
        </div>
      </button>
    `)
  }

  return `
    <div class="space-y-4">
      <div class="rounded-md border p-3">
        <p class="text-sm font-medium">处理动作</p>
        <div class="mt-3 grid grid-cols-2 gap-3">
          ${
            processingCards.length > 0
              ? processingCards.join('')
              : '<div class="col-span-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前异常暂无专项处理动作</div>'
          }
        </div>
      </div>

      <div class="rounded-md border p-3">
        <p class="text-sm font-medium">去业务页处理</p>
        <div class="mt-3 grid grid-cols-2 gap-3">
          ${
            linkCards.length > 0
              ? linkCards.join('')
              : '<div class="col-span-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前异常暂无业务页入口</div>'
          }
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-md border p-3">
          <p class="text-sm">指派责任人</p>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-action="assign-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
            <option value="">选择责任人</option>
            ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${detailCase.ownerUserId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>

        <div class="rounded-md border p-3">
          <p class="text-sm">记录跟进</p>
          ${
            uiStatus === 'CLOSED'
              ? '<p class="mt-2 text-xs text-muted-foreground">异常已关闭，跟进动作已停用。</p>'
              : `
                <p class="mt-1 text-xs text-muted-foreground">用于同步处理进展，待处理异常会自动转为处理中。</p>
                <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-pause-followup-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
                  <i data-lucide="message-square" class="mr-1.5 h-4 w-4"></i>记录跟进
                </button>
              `
          }
        </div>
      </div>

      <div class="rounded-md border p-3">
        <p class="text-sm">关闭异常</p>
        ${
          uiStatus === 'CLOSED'
            ? '<p class="mt-2 text-xs text-muted-foreground">当前异常已关闭。</p>'
            : `
              <p class="mt-1 text-xs text-muted-foreground">关闭时需填写原因。已解决异常可常规关闭，误报/重复/并单/业务对象失效可直接关闭。</p>
              <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="open-close-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
                <i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>关闭异常
              </button>
            `
        }
      </div>

      <div class="rounded-md border border-blue-200 bg-blue-50 p-3">
        <p class="text-sm font-medium text-blue-700">解决判定</p>
        <p class="mt-1 text-xs text-blue-700">规则：${escapeHtml(judge.ruleText)}</p>
        <p class="mt-1 text-xs text-blue-700">当前结果：${escapeHtml(judge.currentResultText)}</p>
      </div>
    </div>
  `
}

function renderTimelineTab(detailCase: ExceptionCase): string {
  const renderAuditDetail = (detail: string): string =>
    escapeHtml(detail)
      .replaceAll('PRODUCTION_BLOCK', 'EXECUTION')

  const timelineItems = [
    ...detailCase.actions.map((item) => ({
      id: `A-${item.id}`,
      at: item.at,
      by: item.by,
      action: item.actionType,
      detail: item.actionDetail,
      tone: 'action' as const,
    })),
    ...detailCase.auditLogs.map((item) => ({
      id: `L-${item.id}`,
      at: item.at,
      by: item.by,
      action: item.action,
      detail: item.detail,
      tone: 'log' as const,
    })),
  ].sort((a, b) => parseTimestampToMs(b.at) - parseTimestampToMs(a.at))

  return `
    <div class="space-y-2">
      ${
        timelineItems.length === 0
          ? '<p class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无操作日志</p>'
          : timelineItems
              .map(
                (item) => `
                  <div class="rounded-md border px-3 py-2">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-sm font-medium">${escapeHtml(item.action)}</p>
                      <span class="text-xs text-muted-foreground">${escapeHtml(item.at)}</span>
                    </div>
                    <p class="mt-1 text-sm text-muted-foreground">${item.tone === 'log' ? renderAuditDetail(item.detail) : escapeHtml(item.detail)}</p>
                    <p class="mt-1 text-xs text-muted-foreground">操作人：${escapeHtml(item.by)}</p>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailCaseId) return ''

  const detailCase = getCaseById(state.detailCaseId)
  if (!detailCase) return ''

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[680px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between gap-3">
            <h3 class="flex items-center gap-2 text-lg font-semibold">
              异常详情 - ${escapeHtml(detailCase.caseId)}
              ${renderBadge(detailCase.severity, SEVERITY_COLOR_CLASS[detailCase.severity])}
              ${renderStatusBadge(detailCase.caseStatus)}
            </h3>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-pe-action="close-detail" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">基础信息</h4>
            ${renderBasicTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">关联对象</h4>
            ${renderRelatedTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">来源明细</h4>
            ${renderSourceTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">处理动作</h4>
            ${renderActionsTab(detailCase)}
          </section>

          <section class="space-y-3 rounded-lg border p-4">
            <h4 class="text-sm font-semibold">操作日志</h4>
            ${renderTimelineTab(detailCase)}
          </section>
        </div>
      </section>
    </div>
  `
}

function renderCloseDialog(): string {
  if (!state.closeDialogCaseId) return ''

  const exc = getCaseById(state.closeDialogCaseId)
  if (!exc) return ''
  const uiStatus = normalizeCaseStatus(exc.caseStatus)

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-close-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">关闭异常</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)} 当前状态：${escapeHtml(CASE_STATUS_LABEL[uiStatus])}</p>
        </header>

        <div class="mt-4 space-y-3">
          <div>
            <label class="text-sm">关闭原因 *</label>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-field="closeReason">
              ${Object.entries(CLOSE_REASON_LABEL)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${state.closeReason === value ? 'selected' : ''}>${escapeHtml(label)}</option>`,
                )
                .join('')}
            </select>
          </div>

          ${
            state.closeReason === 'DUPLICATE' || state.closeReason === 'MERGED'
              ? `
                <div>
                  <label class="text-sm">关联异常号（选填）</label>
                  <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="例如 EX-202603-0008" data-pe-field="closeMergeCaseId" value="${escapeAttr(state.closeMergeCaseId)}" />
                </div>
              `
              : ''
          }

          <div>
            <label class="text-sm">关闭备注${DIRECT_CLOSE_REASON_SET.has(state.closeReason) ? ' *' : ''}</label>
            <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写关闭依据..." data-pe-field="closeRemark">${escapeHtml(state.closeRemark)}</textarea>
          </div>

          <p class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            关闭规则：已解决后可常规关闭；误报、重复异常、并入其他异常、业务对象失效可直接关闭。
          </p>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-close-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-close-exception">确认关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderUnblockDialog(): string {
  if (!state.unblockDialogCaseId) return ''

  const exc = getCaseById(state.unblockDialogCaseId)
  if (!exc) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-unblock-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">确认恢复执行</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：将解除关联生产暂停任务并转为处理中。</p>
        </header>

        <div class="mt-4">
          <label class="text-sm">处理备注 *</label>
          <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写处理备注..." data-pe-field="unblockRemark">${escapeHtml(state.unblockRemark)}</textarea>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-unblock-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-unblock">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderExtendDialog(): string {
  if (!state.extendDialogCaseId) return ''

  const exc = getCaseById(state.extendDialogCaseId)
  if (!exc) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-extend-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">确认延长竞价</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：将关联竞价统一延长 24 小时。</p>
        </header>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-extend-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-extend-dialog">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderPauseFollowUpDialog(): string {
  if (!state.pauseFollowUpCaseId) return ''

  const exc = getCaseById(state.pauseFollowUpCaseId)
  if (!exc) return ''
  const isPauseReport = exc.sourceType === 'FACTORY_PAUSE_REPORT'

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-pause-followup-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">记录跟进</h3>
          <p class="text-sm text-muted-foreground">
            异常 ${escapeHtml(exc.caseId)}：${isPauseReport ? '记录平台跟进信息，任务继续保持生产暂停。' : '记录当前处理进展并同步状态。'}
          </p>
        </header>

        <div class="mt-4">
          <label class="text-sm">跟进备注 *</label>
          <textarea class="mt-1 min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请填写跟进内容..." data-pe-field="pauseFollowUpRemark">${escapeHtml(state.pauseFollowUpRemark)}</textarea>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-pe-action="close-pause-followup-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-pe-action="confirm-pause-followup">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderProgressExceptionsPage(): string {
  syncPdaStartRiskAndExceptions()
  syncMilestoneOverdueExceptions()
  syncFromQuery()
  syncExceptionResolvedByBusiness()

  const now = new Date()
  const filtered = filterCases()
  const kpis = getKpis(now)
  const aggregates = getAggregates()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderUpstreamHint()}
      ${renderKpiCards(kpis)}
      ${renderAggregateCards(aggregates)}
      ${renderCategoryQuickSwitch()}
      ${renderFilters()}
      ${renderTable(filtered)}
      ${renderDetailDrawer()}
      ${renderCloseDialog()}
      ${renderUnblockDialog()}
      ${renderExtendDialog()}
      ${renderPauseFollowUpDialog()}
    </div>
  `
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'severityFilter' && node instanceof HTMLSelectElement) {
    state.severityFilter = node.value
    return
  }

  if (field === 'categoryFilter' && node instanceof HTMLSelectElement) {
    state.categoryFilter = node.value as 'ALL' | UnifiedCategory
    const currentSubCategoryOptions = getSubCategoryOptions(state.categoryFilter)
    if (
      state.subCategoryFilter !== 'ALL' &&
      !currentSubCategoryOptions.some((option) => option.key === state.subCategoryFilter)
    ) {
      state.subCategoryFilter = 'ALL'
    }
    return
  }

  if (field === 'subCategoryFilter' && node instanceof HTMLSelectElement) {
    state.subCategoryFilter = node.value as 'ALL' | SubCategoryKey
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value as 'ALL' | UiCaseStatus
    return
  }

  if (field === 'ownerFilter' && node instanceof HTMLSelectElement) {
    state.ownerFilter = node.value
    return
  }

  if (field === 'factoryFilter' && node instanceof HTMLSelectElement) {
    state.factoryFilter = node.value
    return
  }

  if (field === 'processFilter' && node instanceof HTMLSelectElement) {
    state.processFilter = node.value
    return
  }

  if (field === 'unblockRemark' && node instanceof HTMLTextAreaElement) {
    state.unblockRemark = node.value
    return
  }

  if (field === 'pauseFollowUpRemark' && node instanceof HTMLTextAreaElement) {
    state.pauseFollowUpRemark = node.value
    return
  }

  if (field === 'closeReason' && node instanceof HTMLSelectElement) {
    state.closeReason = node.value as CloseReasonCode
    return
  }

  if (field === 'closeRemark' && node instanceof HTMLTextAreaElement) {
    state.closeRemark = node.value
    return
  }

  if (field === 'closeMergeCaseId' && node instanceof HTMLInputElement) {
    state.closeMergeCaseId = node.value
  }
}

function handleRowAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'row-view') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.detailCaseId = caseId
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-unblock') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.unblockDialogCaseId = caseId
    state.unblockRemark = ''
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-pause-followup') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.pauseFollowUpCaseId = caseId
    state.pauseFollowUpRemark = ''
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-pause-continue') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    confirmPauseAllowContinue(caseId)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-extend') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.extendDialogCaseId = caseId
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-reassign') {
    const taskId = actionNode.dataset.taskId || ''
    const orderId = actionNode.dataset.orderId || ''
    openLinkedPage('任务分配', `/fcs/dispatch/board?taskId=${encodeURIComponent(taskId)}&po=${encodeURIComponent(orderId)}`)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-tech-pack') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    const exc = getCaseById(caseId)
    if (!exc) return true
    const firstOrder = exc.relatedOrderIds[0] ? getOrderById(exc.relatedOrderIds[0]) : null
    if (firstOrder) {
      openLinkedPage('技术包', `/fcs/tech-pack/${encodeURIComponent(firstOrder.demandSnapshot.spuCode)}`)
    }
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-material') {
    const orderId = actionNode.dataset.orderId || ''
    const title = orderId ? `领料进度-${orderId}` : '领料进度'
    const href = `/fcs/progress/material${orderId ? `?po=${encodeURIComponent(orderId)}` : ''}`
    openLinkedPage(title, href)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-handover') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    const summary = getProductionOrderHandoverSummary(orderId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: summary.recommendedFocus,
        source: '异常定位',
      }),
    )
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-handover-objection') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    openLinkedPage(
      '数量异议',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: 'objection',
        source: '异常定位',
      }),
    )
    state.rowActionMenuCaseId = null
    return true
  }

  return false
}

function handleDrawerAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'drawer-tech-pack') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    const exc = getCaseById(caseId)
    if (!exc) return true
    const firstOrder = exc.relatedOrderIds[0] ? getOrderById(exc.relatedOrderIds[0]) : null
    if (firstOrder) {
      openLinkedPage('技术包', `/fcs/tech-pack/${encodeURIComponent(firstOrder.demandSnapshot.spuCode)}`)
    }
    return true
  }

  if (action === 'drawer-view-handover') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    const summary = getProductionOrderHandoverSummary(orderId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: summary.recommendedFocus,
        source: '异常定位',
      }),
    )
    return true
  }

  if (action === 'drawer-view-handover-objection') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    openLinkedPage(
      '数量异议',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: 'objection',
        source: '异常定位',
      }),
    )
    return true
  }

  if (action === 'drawer-view-material') {
    const orderId = actionNode.dataset.orderId || ''
    const title = orderId ? `领料进度-${orderId}` : '领料进度'
    openLinkedPage(title, `/fcs/progress/material${orderId ? `?po=${encodeURIComponent(orderId)}` : ''}`)
    return true
  }

  return false
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action.startsWith('row-') && handleRowAction(action, actionNode)) {
    return true
  }

  if (action.startsWith('drawer-') && handleDrawerAction(action, actionNode)) {
    return true
  }

  if (action === 'refresh') {
    showProgressExceptionsToast('刷新完成')
    return true
  }

  if (action === 'clear-filters') {
    clearFilters()
    return true
  }

  if (action === 'kpi-open') {
    state.statusFilter = 'OPEN'
    state.severityFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-in-progress') {
    state.statusFilter = 'IN_PROGRESS'
    state.severityFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-s1') {
    state.severityFilter = 'S1'
    state.statusFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'quick-category') {
    const category = actionNode.dataset.category as 'ALL' | UnifiedCategory | undefined
    if (!category) return true
    state.categoryFilter = category
    const currentSubCategoryOptions = getSubCategoryOptions(state.categoryFilter)
    if (
      state.subCategoryFilter !== 'ALL' &&
      !currentSubCategoryOptions.some((option) => option.key === state.subCategoryFilter)
    ) {
      state.subCategoryFilter = 'ALL'
    }
    state.aggregateFilter = null
    return true
  }

  if (action === 'aggregate-reason') {
    const value = actionNode.dataset.value
    if (value && isSubCategoryKey(value)) {
      state.aggregateFilter = { type: 'reason', value }
    }
    return true
  }

  if (action === 'aggregate-factory') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'factory', value }
    }
    return true
  }

  if (action === 'aggregate-process') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'process', value }
    }
    return true
  }

  if (action === 'clear-aggregate') {
    state.aggregateFilter = null
    return true
  }

  if (action === 'open-detail') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.detailCaseId = caseId
      state.rowActionMenuCaseId = null
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailCaseId = null
    closeCloseDialog()
    return true
  }

  if (action === 'toggle-row-menu') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.rowActionMenuCaseId = state.rowActionMenuCaseId === caseId ? null : caseId
    return true
  }

  if (action === 'goto-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      openLinkedPage(`生产单 ${orderId}`, `/fcs/production/orders/${encodeURIComponent(orderId)}`)
    }
    return true
  }

  if (action === 'goto-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('任务进度', `/fcs/progress/board?taskId=${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'goto-tender') {
    const tenderId = actionNode.dataset.tenderId
    if (tenderId) {
      openLinkedPage('任务分配', `/fcs/dispatch/board?tenderId=${encodeURIComponent(tenderId)}`)
    }
    return true
  }

  if (action === 'go-start') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('执行（PDA）', `/fcs/pda/exec/${encodeURIComponent(taskId)}?action=start`)
    }
    return true
  }

  if (action === 'goto-pda-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('执行（PDA）', `/fcs/pda/exec/${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'assign-owner') {
    const caseId = actionNode.dataset.caseId
    if (!caseId || !(actionNode instanceof HTMLSelectElement)) return true

    const userId = actionNode.value
    const user = OWNER_OPTIONS.find((item) => item.id === userId)
    const exc = getCaseById(caseId)
    if (!exc || !user) return true
    if (exc.ownerUserId === user.id) return true

    assignCaseOwner(exc, user.id, user.name)
    showProgressExceptionsToast(`已指派给 ${user.name}`)
    return true
  }

  if (action === 'open-close-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) openCloseDialog(caseId)
    return true
  }

  if (action === 'close-close-dialog') {
    closeCloseDialog()
    return true
  }

  if (action === 'confirm-close-exception') {
    confirmCloseException()
    return true
  }

  if (action === 'status-change') {
    showProgressExceptionsToast('请使用分类专项动作或关闭异常流程处理状态', 'error')
    return true
  }

  if (action === 'urge-owner') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true

    const exc = getCaseById(caseId)
    if (!exc || !exc.ownerUserId) return true

    const owner = mockInternalUsers.find((item) => item.id === exc.ownerUserId)
    if (!owner) return true

    createUrge({
      urgeType: 'URGE_CASE_HANDLE',
      fromType: 'INTERNAL_USER',
      fromId: 'U001',
      fromName: '管理员',
      toType: 'INTERNAL_USER',
      toId: owner.id,
      toName: owner.name,
      targetType: 'CASE',
      targetId: exc.caseId,
      message: `请尽快处理异常单 ${exc.caseId}`,
      deepLink: {
        path: '/fcs/progress/exceptions',
        query: { caseId: exc.caseId },
      },
    })

    showProgressExceptionsToast('催办发送成功')
    return true
  }

  if (action === 'open-unblock-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.unblockDialogCaseId = caseId
      state.unblockRemark = ''
    }
    return true
  }

  if (action === 'close-unblock-dialog') {
    state.unblockDialogCaseId = null
    state.unblockRemark = ''
    return true
  }

  if (action === 'confirm-unblock') {
    confirmUnblock()
    return true
  }

  if (action === 'open-extend-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.extendDialogCaseId = caseId
    }
    return true
  }

  if (action === 'close-extend-dialog') {
    state.extendDialogCaseId = null
    return true
  }

  if (action === 'confirm-extend-dialog') {
    confirmExtendTender()
    return true
  }

  if (action === 'open-pause-followup-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.pauseFollowUpCaseId = caseId
      state.pauseFollowUpRemark = ''
    }
    return true
  }

  if (action === 'close-pause-followup-dialog') {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
    return true
  }

  if (action === 'confirm-pause-followup') {
    confirmPauseFollowUp()
    return true
  }

  if (action === 'pause-allow-continue') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      confirmPauseAllowContinue(caseId)
    }
    return true
  }

  return false
}

export function handleProgressExceptionsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pe-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.peField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pe-action]')
  if (!actionNode) {
    if (state.rowActionMenuCaseId) {
      state.rowActionMenuCaseId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.peAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressExceptionsDialogOpen(): boolean {
  return Boolean(
    state.detailCaseId ||
      state.closeDialogCaseId ||
      state.unblockDialogCaseId ||
      state.extendDialogCaseId ||
      state.pauseFollowUpCaseId,
  )
}
