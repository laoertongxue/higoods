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
import { allowContinueFromPauseException, recordPauseExceptionFollowUp } from '../data/fcs/pda-exec-link'

applyQualitySeedBootstrap()

type AggregateFilter =
  | { type: 'reason'; value: string }
  | { type: 'factory'; value: string }
  | { type: 'process'; value: string }

type CaseTab = 'basic' | 'related' | 'actions' | 'assign' | 'timeline'

type SlaFilter = 'ALL' | 'OVERDUE' | 'NEAR_DUE'

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
  statusFilter: CaseStatus[]
  severityFilter: string
  categoryFilter: string
  reasonCodeFilter: string
  ownerFilter: string
  slaFilter: SlaFilter

  aggregateFilter: AggregateFilter | null

  detailCaseId: string | null
  detailTab: CaseTab

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
  statusFilter: ['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL'],
  severityFilter: 'ALL',
  categoryFilter: 'ALL',
  reasonCodeFilter: 'ALL',
  ownerFilter: 'ALL',
  slaFilter: 'ALL',

  aggregateFilter: null,

  detailCaseId: null,
  detailTab: 'basic',

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

const STATUS_COLOR_CLASS: Record<CaseStatus, string> = {
  OPEN: 'border-red-200 bg-red-100 text-red-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-100 text-blue-700',
  WAITING_EXTERNAL: 'border-yellow-200 bg-yellow-100 text-yellow-700',
  RESOLVED: 'border-green-200 bg-green-100 text-green-700',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
}

const STATUS_ICON: Record<CaseStatus, string> = {
  OPEN: 'alert-circle',
  IN_PROGRESS: 'play',
  WAITING_EXTERNAL: 'pause',
  RESOLVED: 'check-circle-2',
  CLOSED: 'x-circle',
}

const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  WAITING_EXTERNAL: '等待外部',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
}

const CATEGORY_LABEL: Record<ExceptionCategory, string> = {
  PRODUCTION_BLOCK: '生产暂不能继续',
  ASSIGNMENT: '分配异常',
  TECH_PACK: '技术包',
  HANDOVER: '交接异常',
  MATERIAL: '物料异常',
  EXECUTION: '执行异常',
}

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
  DISPATCH_REJECTED: '派单被拒',
  ACK_TIMEOUT: '接单超时',
  TECH_PACK_NOT_RELEASED: '技术包未发布',
  FACTORY_BLACKLISTED: '工厂黑名单',
  HANDOVER_DIFF: '交接差异',
  MATERIAL_NOT_READY: '物料未齐套',
  START_OVERDUE: '开工逾期',
}

function getReasonLabel(exc: ExceptionCase): string {
  return exc.reasonLabel || REASON_LABEL[exc.reasonCode] || exc.reasonCode
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
    BLOCKED: '任务暂不能继续',
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
    state.statusFilter = hasUpstream ? [] : ['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL']
    state.severityFilter = state.upstreamSeverity || 'ALL'
    state.reasonCodeFilter = state.upstreamReasonCode || 'ALL'
  } else {
    if (state.upstreamSeverity) state.severityFilter = state.upstreamSeverity
    if (state.upstreamReasonCode) state.reasonCodeFilter = state.upstreamReasonCode
  }

  if (state.upstreamCaseId) {
    state.detailCaseId = state.upstreamCaseId
    state.detailTab = 'basic'
  }
}

function getSpuFromCase(exc: ExceptionCase): string {
  if (exc.relatedOrderIds.length === 0) return '-'
  const order = getOrderById(exc.relatedOrderIds[0])
  return order?.demandSnapshot?.spuCode || '-'
}

function isCaseOverdue(exc: ExceptionCase, nowMs: number): boolean {
  const due = new Date(exc.slaDueAt.replace(' ', 'T')).getTime()
  return !Number.isNaN(due) && due < nowMs && exc.caseStatus !== 'CLOSED'
}

function filterCases(nowMs: number): ExceptionCase[] {
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

      if (state.statusFilter.length > 0 && !state.statusFilter.includes(exc.caseStatus)) return false
      if (state.severityFilter !== 'ALL' && exc.severity !== state.severityFilter) return false
      if (state.categoryFilter !== 'ALL' && exc.category !== state.categoryFilter) return false
      if (state.reasonCodeFilter !== 'ALL' && exc.reasonCode !== state.reasonCodeFilter) return false
      if (state.ownerFilter !== 'ALL' && exc.ownerUserId !== state.ownerFilter) return false

      if (state.slaFilter === 'OVERDUE') {
        if (!isCaseOverdue(exc, nowMs)) return false
      }

      if (state.slaFilter === 'NEAR_DUE') {
        const due = new Date(exc.slaDueAt.replace(' ', 'T')).getTime()
        if (Number.isNaN(due) || exc.caseStatus === 'CLOSED') return false
        const diffHours = (due - nowMs) / (1000 * 60 * 60)
        if (diffHours < 0 || diffHours > 8) return false
      }

      if (state.aggregateFilter) {
        if (state.aggregateFilter.type === 'reason' && exc.reasonCode !== state.aggregateFilter.value) {
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
      const statusOrder: Record<CaseStatus, number> = {
        OPEN: 0,
        IN_PROGRESS: 1,
        WAITING_EXTERNAL: 2,
        RESOLVED: 3,
        CLOSED: 4,
      }

      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }

      if (statusOrder[a.caseStatus] !== statusOrder[b.caseStatus]) {
        return statusOrder[a.caseStatus] - statusOrder[b.caseStatus]
      }

      const aUpdated = new Date(a.updatedAt.replace(' ', 'T')).getTime()
      const bUpdated = new Date(b.updatedAt.replace(' ', 'T')).getTime()
      return bUpdated - aUpdated
    })
}

function getKpis(now: Date): {
  open: number
  s1: number
  overdue: number
  todayNew: number
  todayClosed: number
} {
  const all = initialExceptions
  const nowMs = now.getTime()

  const today = now.toISOString().slice(0, 10)

  return {
    open: all.filter((exc) => exc.caseStatus === 'OPEN').length,
    s1: all.filter((exc) => exc.severity === 'S1' && exc.caseStatus !== 'CLOSED').length,
    overdue: all.filter((exc) => isCaseOverdue(exc, nowMs)).length,
    todayNew: all.filter((exc) => exc.createdAt.slice(0, 10) === today).length,
    todayClosed: all.filter((exc) => exc.caseStatus === 'CLOSED' && exc.updatedAt.slice(0, 10) === today).length,
  }
}

function getAggregates(): {
  topReasons: Array<[string, number]>
  topFactories: Array<[string, number]>
  topProcesses: Array<[string, number]>
} {
  const activeCases = initialExceptions.filter((exc) => exc.caseStatus !== 'CLOSED')

  const reasonCounts: Record<string, number> = {}
  const factoryCounts: Record<string, number> = {}
  const processCounts: Record<string, number> = {}

  for (const exc of activeCases) {
    reasonCounts[exc.reasonCode] = (reasonCounts[exc.reasonCode] ?? 0) + 1

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

  const topReasons = Object.entries(reasonCounts)
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
  state.statusFilter = ['OPEN', 'IN_PROGRESS', 'WAITING_EXTERNAL']
  state.severityFilter = 'ALL'
  state.categoryFilter = 'ALL'
  state.reasonCodeFilter = 'ALL'
  state.ownerFilter = 'ALL'
  state.slaFilter = 'ALL'
  state.aggregateFilter = null
  state.showUpstreamHint = false
  state.rowActionMenuCaseId = null
  state.pauseFollowUpCaseId = null
  state.pauseFollowUpRemark = ''
  appStore.navigate('/fcs/progress/exceptions')
}

function setCaseStatus(exc: ExceptionCase, nextStatus: CaseStatus): ExceptionCase {
  const now = nowTimestamp()
  const updated: ExceptionCase = {
    ...exc,
    caseStatus: nextStatus,
    updatedAt: now,
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'STATUS_CHANGE',
        detail: `${exc.caseStatus} -> ${nextStatus}`,
        at: now,
        by: 'Admin',
      },
    ],
  }

  updateException(updated)
  return updated
}

function assignCaseOwner(exc: ExceptionCase, userId: string, userName: string): ExceptionCase {
  const now = nowTimestamp()

  const updated: ExceptionCase = {
    ...exc,
    ownerUserId: userId,
    ownerUserName: userName,
    updatedAt: now,
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'ASSIGN',
        detail: `指派给 ${userName}`,
        at: now,
        by: 'Admin',
      },
    ],
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

  const updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
    actions: [
      ...exc.actions,
      {
        id: `EA-${Date.now()}`,
        actionType: 'UNBLOCK',
        actionDetail: `恢复执行：${state.unblockRemark.trim()}`,
        at: now,
        by: 'Admin',
      },
    ],
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'UNBLOCK',
        detail: `执行恢复执行，备注：${state.unblockRemark.trim()}`,
        at: now,
        by: 'Admin',
      },
    ],
  }

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

  const updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
    actions: [
      ...exc.actions,
      {
        id: `EA-${Date.now()}`,
        actionType: 'EXTEND_TENDER',
        actionDetail: '延长竞价截止时间 24 小时',
        at: now,
        by: 'Admin',
      },
    ],
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'EXTEND_TENDER',
        detail: '执行延长竞价 24 小时',
        at: now,
        by: 'Admin',
      },
    ],
  }

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

  const result = recordPauseExceptionFollowUp(
    state.pauseFollowUpCaseId,
    state.pauseFollowUpRemark.trim(),
    'Admin',
  )
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

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderStatusBadge(caseStatus: CaseStatus): string {
  return `
    <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${STATUS_COLOR_CLASS[caseStatus]}">
      <i data-lucide="${STATUS_ICON[caseStatus]}" class="h-3 w-3"></i>
      ${CASE_STATUS_LABEL[caseStatus]}
    </span>
  `
}

function renderActionMenu(exc: ExceptionCase): string {
  const isOpen = state.rowActionMenuCaseId === exc.caseId
  const firstTaskId = exc.relatedTaskIds[0] || ''
  const firstOrderId = exc.relatedOrderIds[0] || ''
  const isPauseReport = exc.sourceType === 'FACTORY_PAUSE_REPORT'

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
                <i data-lucide="eye" class="mr-2 h-4 w-4"></i>${isPauseReport ? '处理' : '查看详情'}
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
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-pe-action="row-material" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true">
                <i data-lucide="package" class="mr-2 h-4 w-4"></i>查看领料进度
              </button>
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
        <h1 class="text-xl font-semibold">异常定位</h1>
        <p class="text-sm text-muted-foreground">按严重度、SLA、聚合维度定位异常并联动处置</p>
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

function renderKpiCards(kpis: { open: number; s1: number; overdue: number; todayNew: number; todayClosed: number }): string {
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

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-s1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">S1 异常</p>
            <p class="text-2xl font-bold text-red-600">${kpis.s1}</p>
          </div>
          <i data-lucide="alert-triangle" class="h-8 w-8 text-red-200"></i>
        </div>
      </button>

      <button class="rounded-lg border bg-card p-4 text-left hover:border-primary" data-pe-action="kpi-overdue">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-muted-foreground">SLA 逾期</p>
            <p class="text-2xl font-bold text-orange-600">${kpis.overdue}</p>
          </div>
          <i data-lucide="clock" class="h-8 w-8 text-orange-200"></i>
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
  topReasons: Array<[string, number]>
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
                    ([code, count]) => `
                      <button class="flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted" data-pe-action="aggregate-reason" data-value="${escapeAttr(code)}">
                        <span class="truncate">${escapeHtml(REASON_LABEL[code as ReasonCode] || code)}</span>
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

function renderFilters(): string {
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
          <option value="PRODUCTION_BLOCK" ${state.categoryFilter === 'PRODUCTION_BLOCK' ? 'selected' : ''}>生产暂不能继续</option>
          <option value="ASSIGNMENT" ${state.categoryFilter === 'ASSIGNMENT' ? 'selected' : ''}>分配异常</option>
          <option value="EXECUTION" ${state.categoryFilter === 'EXECUTION' ? 'selected' : ''}>执行异常</option>
          <option value="TECH_PACK" ${state.categoryFilter === 'TECH_PACK' ? 'selected' : ''}>技术包</option>
          <option value="HANDOVER" ${state.categoryFilter === 'HANDOVER' ? 'selected' : ''}>交接异常</option>
          <option value="MATERIAL" ${state.categoryFilter === 'MATERIAL' ? 'selected' : ''}>物料异常</option>
        </select>

        <select class="h-9 w-[140px] rounded-md border bg-background px-3 text-sm" data-pe-field="slaFilter">
          <option value="ALL" ${state.slaFilter === 'ALL' ? 'selected' : ''}>全部 SLA</option>
          <option value="OVERDUE" ${state.slaFilter === 'OVERDUE' ? 'selected' : ''}>仅逾期</option>
          <option value="NEAR_DUE" ${state.slaFilter === 'NEAR_DUE' ? 'selected' : ''}>8小时内到期</option>
        </select>

        <select class="h-9 w-[120px] rounded-md border bg-background px-3 text-sm" data-pe-field="ownerFilter">
          <option value="ALL" ${state.ownerFilter === 'ALL' ? 'selected' : ''}>全部责任人</option>
          ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${state.ownerFilter === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
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
                  ? REASON_LABEL[state.aggregateFilter.value as ReasonCode] || state.aggregateFilter.value
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

function renderTable(cases: ExceptionCase[], nowMs: number): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-2 text-sm text-muted-foreground">共 ${cases.length} 条</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1520px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="w-[130px] px-3 py-2 font-medium">异常号</th>
              <th class="w-[80px] px-3 py-2 font-medium">严重度</th>
              <th class="w-[110px] px-3 py-2 font-medium">状态</th>
              <th class="w-[110px] px-3 py-2 font-medium">分类</th>
              <th class="px-3 py-2 font-medium">原因码</th>
              <th class="px-3 py-2 font-medium">关联对象</th>
              <th class="w-[110px] px-3 py-2 font-medium">SPU</th>
              <th class="w-[90px] px-3 py-2 font-medium">责任人</th>
              <th class="w-[150px] px-3 py-2 font-medium">SLA 截止</th>
              <th class="w-[90px] px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              cases.length === 0
                ? '<tr><td colspan="10" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td></tr>'
                : cases
                    .slice(0, 20)
                    .map((exc) => {
                      const overdue = isCaseOverdue(exc, nowMs)
                      const firstOrderId = exc.relatedOrderIds[0] || ''
                      const firstTaskId = exc.relatedTaskIds[0] || ''
                      const linkedFactory = exc.linkedFactoryName || '-'

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-pe-action="open-detail" data-case-id="${escapeAttr(exc.caseId)}">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(exc.caseId)}</td>
                          <td class="px-3 py-2">${renderBadge(exc.severity, SEVERITY_COLOR_CLASS[exc.severity])}</td>
                          <td class="px-3 py-2">${renderStatusBadge(exc.caseStatus)}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(CATEGORY_LABEL[exc.category])}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(getReasonLabel(exc))}</td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              ${
                                firstOrderId
                                  ? `<button class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-muted" data-pe-action="goto-order" data-order-id="${escapeAttr(firstOrderId)}" data-pe-stop="true">${escapeHtml(firstOrderId)}</button>`
                                  : ''
                              }
                              ${
                                firstTaskId
                                  ? `<button class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs hover:bg-muted" data-pe-action="goto-task" data-task-id="${escapeAttr(firstTaskId)}" data-pe-stop="true">${escapeHtml(firstTaskId)}</button>`
                                  : ''
                              }
                              ${
                                exc.sourceType === 'FACTORY_PAUSE_REPORT'
                                  ? `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground">工厂：${escapeHtml(linkedFactory)}</span>`
                                  : ''
                              }
                            </div>
                          </td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(getSpuFromCase(exc))}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(exc.ownerUserName || '-')}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1 text-xs">
                              <span>${escapeHtml(exc.slaDueAt.slice(5, 16))}</span>
                              ${overdue ? renderBadge('逾期', 'border-red-200 bg-red-100 text-red-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2 text-right" data-pe-stop="true">${renderActionMenu(exc)}</td>
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

function renderBasicTab(detailCase: ExceptionCase, nowMs: number): string {
  const overdue = isCaseOverdue(detailCase, nowMs)

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground">分类</p>
          <p class="font-medium">${escapeHtml(CATEGORY_LABEL[detailCase.category])}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">原因码</p>
          <p class="font-medium">${escapeHtml(getReasonLabel(detailCase))}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">SLA 截止</p>
          <p class="flex items-center gap-2 font-medium">
            ${escapeHtml(detailCase.slaDueAt)}
            ${overdue ? renderBadge('逾期', 'border-red-200 bg-red-100 text-red-700') : ''}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground">时间</p>
          <p class="text-sm">创建: ${escapeHtml(detailCase.createdAt)}</p>
          <p class="text-sm">更新: ${escapeHtml(detailCase.updatedAt)}</p>
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
        detailCase.sourceType === 'FACTORY_PAUSE_REPORT'
          ? `
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p class="text-xs text-amber-700">工厂上报暂停信息</p>
              <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span class="text-xs text-muted-foreground">工厂</span>
                <span class="text-xs font-medium">${escapeHtml(detailCase.linkedFactoryName || '-')}</span>
                <span class="text-xs text-muted-foreground">暂停原因</span>
                <span class="text-xs font-medium">${escapeHtml(detailCase.pauseReasonLabel || getReasonLabel(detailCase))}</span>
                <span class="text-xs text-muted-foreground">上报时间</span>
                <span class="text-xs font-medium">${escapeHtml(detailCase.pauseReportedAt || '-')}</span>
                <span class="text-xs text-muted-foreground">现场说明</span>
                <span class="text-xs">${escapeHtml(detailCase.pauseRemark || '—')}</span>
              </div>
              ${
                detailCase.pauseProofFiles && detailCase.pauseProofFiles.length > 0
                  ? `
                    <div class="mt-3">
                      <p class="text-xs text-muted-foreground">现场凭证（${detailCase.pauseProofFiles.length}）</p>
                      <div class="mt-1 space-y-1">
                        ${detailCase.pauseProofFiles
                          .map(
                            (file) => `
                              <div class="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                                <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-3.5 w-3.5 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
                                <span class="truncate">${escapeHtml(file.name)}</span>
                                <span class="ml-auto text-muted-foreground">${escapeHtml(file.uploadedAt)}</span>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                  : '<p class="mt-2 text-xs text-muted-foreground">暂无现场凭证</p>'
              }
              ${
                detailCase.milestoneSnapshot?.required
                  ? `<p class="mt-3 text-xs text-muted-foreground">关键节点：${escapeHtml(detailCase.milestoneSnapshot.ruleLabel || '已配置')}｜状态：${detailCase.milestoneSnapshot.status === 'REPORTED' ? '已上报' : '待上报'}${detailCase.milestoneSnapshot.reportedAt ? `｜时间：${escapeHtml(detailCase.milestoneSnapshot.reportedAt)}` : ''}</p>`
                  : '<p class="mt-3 text-xs text-muted-foreground">关键节点：当前任务无强制关键节点上报</p>'
              }
            </div>
          `
          : ''
      }

      ${
        detailCase.tags.length > 0
          ? `<div><p class="text-xs text-muted-foreground">标签</p><div class="mt-1 flex flex-wrap gap-1">${detailCase.tags
              .map((tag) => renderBadge(tag, 'border-border bg-background text-foreground'))
              .join('')}</div></div>`
          : ''
      }

      ${
        detailCase.reasonCode.startsWith('MATERIAL_') || detailCase.reasonCode === 'BLOCKED_MATERIAL'
          ? `
            <div class="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div class="flex items-center gap-2 text-sm font-medium text-teal-700">
                <i data-lucide="package" class="h-4 w-4"></i>
                建议进入领料进度联动处置
              </div>
              <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-white" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(detailCase.relatedOrderIds[0] || '')}">
                <i data-lucide="package" class="mr-1.5 h-4 w-4"></i>查看领料进度
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderRelatedTab(detailCase: ExceptionCase): string {
  const firstOrderId = detailCase.relatedOrderIds[0] || ''
  const firstTaskId = detailCase.relatedTaskIds[0] || ''

  return `
    <div class="space-y-4">
      ${
        detailCase.relatedOrderIds.length > 0
          ? `
            <div>
              <p class="text-xs text-muted-foreground">关联生产单</p>
              <div class="mt-1 flex flex-wrap gap-2">
                ${detailCase.relatedOrderIds
                  .map(
                    (orderId) =>
                      `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="goto-order" data-order-id="${escapeAttr(orderId)}">${escapeHtml(orderId)}<i data-lucide="external-link" class="ml-1 h-3 w-3"></i></button>`,
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      ${
        detailCase.relatedTaskIds.length > 0
          ? `
            <div>
              <p class="text-xs text-muted-foreground">关联任务</p>
              <div class="mt-1 flex flex-wrap gap-2">
                ${detailCase.relatedTaskIds
                  .map(
                    (taskId) =>
                      `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="goto-task" data-task-id="${escapeAttr(taskId)}">${escapeHtml(taskId)}<i data-lucide="external-link" class="ml-1 h-3 w-3"></i></button>`,
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      ${
        detailCase.relatedTenderIds.length > 0
          ? `
            <div>
              <p class="text-xs text-muted-foreground">关联招标单</p>
              <div class="mt-1 flex flex-wrap gap-2">
                ${detailCase.relatedTenderIds
                  .map(
                    (tenderId) =>
                      `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="goto-tender" data-tender-id="${escapeAttr(tenderId)}">${escapeHtml(tenderId)}<i data-lucide="external-link" class="ml-1 h-3 w-3"></i></button>`,
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      <div class="border-t pt-3">
        <p class="text-xs text-muted-foreground">快捷跳转</p>
        <div class="mt-2 flex flex-wrap gap-2">
          ${
            firstOrderId
              ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}"><i data-lucide="file-text" class="mr-1 h-4 w-4"></i>技术包</button>`
              : ''
          }
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}"><i data-lucide="scan-line" class="mr-1 h-4 w-4"></i>交接链路</button>
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="drawer-view-material" data-order-id="${escapeAttr(firstOrderId)}"><i data-lucide="package" class="mr-1 h-4 w-4"></i>领料进度</button>
        </div>
      </div>
    </div>
  `
}

function renderActionsTab(detailCase: ExceptionCase): string {
  const firstTaskId = detailCase.relatedTaskIds[0] || ''
  const firstOrderId = detailCase.relatedOrderIds[0] || ''

  const cards: string[] = []

  if (detailCase.sourceType === 'FACTORY_PAUSE_REPORT' && detailCase.caseStatus !== 'CLOSED') {
    cards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-pause-followup-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="message-square" class="h-5 w-5 text-blue-600"></i>
          <div>
            <p class="font-medium">记录跟进</p>
            <p class="text-xs text-muted-foreground">记录平台处理进展，任务仍保持暂不能继续</p>
          </div>
        </div>
      </button>
    `)
    cards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="pause-allow-continue" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">允许继续</p>
            <p class="text-xs text-muted-foreground">关闭当前异常并恢复工厂任务到进行中</p>
          </div>
        </div>
      </button>
    `)
  }

  if (detailCase.reasonCode.startsWith('BLOCKED_') && detailCase.sourceType !== 'FACTORY_PAUSE_REPORT') {
    cards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="open-unblock-dialog" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="play" class="h-5 w-5 text-green-600"></i>
          <div>
            <p class="font-medium">恢复执行</p>
            <p class="text-xs text-muted-foreground">恢复执行并恢复任务执行</p>
          </div>
        </div>
      </button>
    `)
  }

  if (['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE'].includes(detailCase.reasonCode) && detailCase.relatedTenderIds.length > 0) {
    cards.push(`
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
    cards.push(`
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

  if (detailCase.reasonCode === 'TECH_PACK_NOT_RELEASED') {
    cards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-tech-pack" data-case-id="${escapeAttr(detailCase.caseId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="h-5 w-5 text-purple-600"></i>
          <div>
            <p class="font-medium">进入技术包</p>
            <p class="text-xs text-muted-foreground">前往技术包完善并发布</p>
          </div>
        </div>
      </button>
    `)
  }

  if (['HANDOVER_DIFF', 'BLOCKED_MATERIAL'].includes(detailCase.reasonCode)) {
    cards.push(`
      <button class="rounded-lg border p-4 text-left hover:border-primary" data-pe-action="drawer-view-handover" data-order-id="${escapeAttr(firstOrderId)}" data-task-id="${escapeAttr(firstTaskId)}">
        <div class="flex items-center gap-2">
          <i data-lucide="scan-line" class="h-5 w-5 text-cyan-600"></i>
          <div>
            <p class="font-medium">查看交接链路</p>
            <p class="text-xs text-muted-foreground">定位差异交接节点并已完成</p>
          </div>
        </div>
      </button>
    `)
  }

  if (['MATERIAL_NOT_READY', 'BLOCKED_MATERIAL'].includes(detailCase.reasonCode)) {
    cards.push(`
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
  }

  return `
    <div class="grid grid-cols-2 gap-3">
      ${cards.length > 0 ? cards.join('') : '<div class="col-span-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">当前异常无可执行处置动作</div>'}
    </div>
  `
}

function renderAssignTab(detailCase: ExceptionCase): string {
  const canUrge = Boolean(detailCase.ownerUserId && !['RESOLVED', 'CLOSED'].includes(detailCase.caseStatus))
  const isPauseReport = detailCase.sourceType === 'FACTORY_PAUSE_REPORT'

  return `
    <div class="space-y-4">
      <div>
        <p class="text-sm">指派责任人</p>
        <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-pe-action="assign-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
          <option value="">选择责任人</option>
          ${OWNER_OPTIONS.map((item) => `<option value="${item.id}" ${detailCase.ownerUserId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>
      </div>

      <div class="border-t pt-3">
        <p class="text-sm">状态流转</p>
        ${
          isPauseReport
            ? '<p class="mt-2 text-xs text-muted-foreground">工厂上报暂停异常请在“处置动作”中使用“记录跟进 / 允许继续”处理。</p>'
            : `
                <div class="mt-2 flex flex-wrap gap-2">
                  ${
                    detailCase.caseStatus === 'OPEN'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="status-change" data-case-id="${escapeAttr(detailCase.caseId)}" data-status="IN_PROGRESS">转处理中</button>`
                      : ''
                  }
                  ${
                    detailCase.caseStatus === 'IN_PROGRESS'
                      ? `
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="status-change" data-case-id="${escapeAttr(detailCase.caseId)}" data-status="WAITING_EXTERNAL">转等待外部</button>
                        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="status-change" data-case-id="${escapeAttr(detailCase.caseId)}" data-status="RESOLVED">转已解决</button>
                      `
                      : ''
                  }
                  ${
                    detailCase.caseStatus === 'WAITING_EXTERNAL'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="status-change" data-case-id="${escapeAttr(detailCase.caseId)}" data-status="IN_PROGRESS">转处理中</button>`
                      : ''
                  }
                  ${
                    detailCase.caseStatus === 'RESOLVED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="status-change" data-case-id="${escapeAttr(detailCase.caseId)}" data-status="CLOSED">转已关闭</button>`
                      : ''
                  }
                </div>
              `
        }
      </div>

      ${
        canUrge
          ? `
            <div class="border-t pt-3">
              <p class="text-sm">催办责任人</p>
              <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pe-action="urge-owner" data-case-id="${escapeAttr(detailCase.caseId)}">
                <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催办责任人
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderTimelineTab(detailCase: ExceptionCase): string {
  return `
    <div class="space-y-4">
      ${
        detailCase.actions.length > 0
          ? `
            <div>
              <p class="text-xs text-muted-foreground">处置动作</p>
              <div class="mt-2 max-h-[200px] space-y-2 overflow-y-auto pr-2">
                ${detailCase.actions
                  .map(
                    (action) => `
                      <div class="border-l-2 border-blue-200 pl-3 text-sm">
                        <p class="font-medium">${escapeHtml(action.actionType)}</p>
                        <p class="text-muted-foreground">${escapeHtml(action.actionDetail)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(action.at)} by ${escapeHtml(action.by)}</p>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      <div>
        <p class="text-xs text-muted-foreground">审计日志</p>
        <div class="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-2">
          ${detailCase.auditLogs
            .map(
              (log) => `
                <div class="border-l-2 border-slate-200 pl-3 text-sm">
                  <p class="font-medium">${escapeHtml(log.action)}</p>
                  <p class="text-muted-foreground">${escapeHtml(log.detail)}</p>
                  <p class="text-xs text-muted-foreground">${escapeHtml(log.at)} by ${escapeHtml(log.by)}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    </div>
  `
}

function renderDetailDrawer(nowMs: number): string {
  if (!state.detailCaseId) return ''

  const detailCase = getCaseById(state.detailCaseId)
  if (!detailCase) return ''

  const tab = state.detailTab

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-detail" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[600px] overflow-y-auto border-l bg-background shadow-2xl">
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
          <div class="mt-4 grid grid-cols-5 gap-1 rounded-md border p-1 text-sm">
            <button class="rounded px-2 py-1 ${tab === 'basic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="switch-tab" data-tab="basic">基本信息</button>
            <button class="rounded px-2 py-1 ${tab === 'related' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="switch-tab" data-tab="related">关联对象</button>
            <button class="rounded px-2 py-1 ${tab === 'actions' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="switch-tab" data-tab="actions">处置动作</button>
            <button class="rounded px-2 py-1 ${tab === 'assign' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="switch-tab" data-tab="assign">指派流转</button>
            <button class="rounded px-2 py-1 ${tab === 'timeline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-pe-action="switch-tab" data-tab="timeline">时间线</button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          ${tab === 'basic' ? renderBasicTab(detailCase, nowMs) : ''}
          ${tab === 'related' ? renderRelatedTab(detailCase) : ''}
          ${tab === 'actions' ? renderActionsTab(detailCase) : ''}
          ${tab === 'assign' ? renderAssignTab(detailCase) : ''}
          ${tab === 'timeline' ? renderTimelineTab(detailCase) : ''}
        </div>
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
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：将解除关联暂不能继续任务并转为处理中。</p>
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

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-pe-action="close-pause-followup-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">记录跟进</h3>
          <p class="text-sm text-muted-foreground">异常 ${escapeHtml(exc.caseId)}：记录平台跟进信息，任务继续保持暂不能继续。</p>
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
  syncFromQuery()

  const now = new Date()
  const nowMs = now.getTime()
  const filtered = filterCases(nowMs)
  const kpis = getKpis(now)
  const aggregates = getAggregates()

  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderUpstreamHint()}
      ${renderKpiCards(kpis)}
      ${renderAggregateCards(aggregates)}
      ${renderFilters()}
      ${renderTable(filtered, nowMs)}
      ${renderDetailDrawer(nowMs)}
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
    state.categoryFilter = node.value
    return
  }

  if (field === 'slaFilter' && node instanceof HTMLSelectElement) {
    state.slaFilter = node.value as SlaFilter
    return
  }

  if (field === 'ownerFilter' && node instanceof HTMLSelectElement) {
    state.ownerFilter = node.value
    return
  }

  if (field === 'unblockRemark' && node instanceof HTMLTextAreaElement) {
    state.unblockRemark = node.value
    return
  }

  if (field === 'pauseFollowUpRemark' && node instanceof HTMLTextAreaElement) {
    state.pauseFollowUpRemark = node.value
  }
}

function handleRowAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'row-view') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.detailCaseId = caseId
    state.detailTab = 'basic'
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
    openLinkedPage('交接链路', `/fcs/progress/handover?po=${encodeURIComponent(orderId)}&taskId=${encodeURIComponent(taskId)}`)
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
    state.statusFilter = ['OPEN']
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-s1') {
    state.severityFilter = 'S1'
    state.statusFilter = []
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-overdue') {
    state.slaFilter = 'OVERDUE'
    state.statusFilter = []
    state.aggregateFilter = null
    return true
  }

  if (action === 'aggregate-reason') {
    const value = actionNode.dataset.value
    if (value) {
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
    if (actionNode.closest('[data-pe-stop="true"]')) return false
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.detailCaseId = caseId
      state.detailTab = 'basic'
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailCaseId = null
    return true
  }

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as CaseTab | undefined
    if (tab) {
      state.detailTab = tab
    }
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

  if (action === 'status-change') {
    const caseId = actionNode.dataset.caseId
    const nextStatus = actionNode.dataset.status as CaseStatus | undefined
    if (!caseId || !nextStatus) return true

    const exc = getCaseById(caseId)
    if (!exc) return true
    if (exc.sourceType === 'FACTORY_PAUSE_REPORT') {
      showProgressExceptionsToast('请使用“记录跟进 / 允许继续”处理工厂暂停异常', 'error')
      return true
    }

    setCaseStatus(exc, nextStatus)
    showProgressExceptionsToast(`状态已更新为 ${CASE_STATUS_LABEL[nextStatus]}`)
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
  return Boolean(state.detailCaseId || state.unblockDialogCaseId || state.extendDialogCaseId || state.pauseFollowUpCaseId)
}
