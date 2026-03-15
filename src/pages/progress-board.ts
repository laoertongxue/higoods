import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import {
  processTasks,
  type BlockReason,
  type ProcessTask,
  type TaskAssignmentStatus,
  type TaskAuditLog,
  type TaskStatus,
} from '../data/fcs/process-tasks'
import { stageLabels, type ProcessStage } from '../data/fcs/process-types'
import { productionOrders, type ProductionOrder } from '../data/fcs/production-orders'
import { indonesiaFactories } from '../data/fcs/indonesia-factories'
import { initialTenders, type Tender } from '../data/fcs/store-domain-dispatch-process'
import {
  calculateSlaDue,
  generateCaseId,
  generateNotificationId,
  generateUrgeId,
  initialExceptions,
  initialNotifications,
  initialUrges,
  type ExceptionCase,
  type ExceptionCategory,
  type Notification,
  type ReasonCode,
  type Severity,
  type UrgeLog,
  type UrgeType,
} from '../data/fcs/store-domain-progress'
import { applyQualitySeedBootstrap } from '../data/fcs/store-domain-quality-bootstrap'

applyQualitySeedBootstrap()

type TaskRiskFlag =
  | 'TECH_PACK_NOT_RELEASED'
  | 'TENDER_OVERDUE'
  | 'TENDER_NEAR_DEADLINE'
  | 'DISPATCH_REJECTED'
  | 'FACTORY_BLACKLISTED'
  | 'TASK_OVERDUE'

type PoLifecycle =
  | 'PREPARING'
  | 'PENDING_ASSIGN'
  | 'IN_EXECUTION'
  | 'PENDING_QC'
  | 'PENDING_SETTLEMENT'
  | 'CLOSED'

type TaskTabKey = 'basic' | 'assignment' | 'progress' | 'block' | 'logs'

interface PoViewRow {
  orderId: string
  spuCode: string
  spuName: string
  mainFactory: string
  qty: number
  lifecycle: PoLifecycle
  totalTasks: number
  doneTasks: number
  inProgressTasks: number
  blockedTasks: number
  unassignedTasks: number
  risks: string[]
  blockpoint: string
  nextAction: string
}

interface ProgressBoardState {
  initializedByQuery: boolean
  lastQueryKey: string

  dimension: 'task' | 'order'
  viewMode: 'list' | 'kanban'

  keyword: string
  statusFilter: string
  assignmentStatusFilter: string
  assignmentModeFilter: string
  processFilter: string
  stageFilter: string
  riskFilter: string
  factoryFilter: string

  poKeyword: string
  poLifecycleFilter: string

  selectedTaskIds: string[]

  detailTaskId: string | null
  taskDetailTab: TaskTabKey

  detailOrderId: string | null

  blockDialogTaskId: string | null
  blockReason: BlockReason
  blockRemark: string

  confirmDialogType: 'start' | 'finish' | null
  confirmTaskIds: string[]

  taskActionMenuId: string | null
  orderActionMenuId: string | null
}

const state: ProgressBoardState = {
  initializedByQuery: false,
  lastQueryKey: '',

  dimension: 'task',
  viewMode: 'list',

  keyword: '',
  statusFilter: 'ALL',
  assignmentStatusFilter: 'ALL',
  assignmentModeFilter: 'ALL',
  processFilter: 'ALL',
  stageFilter: 'ALL',
  riskFilter: 'ALL',
  factoryFilter: 'ALL',

  poKeyword: '',
  poLifecycleFilter: 'ALL',

  selectedTaskIds: [],

  detailTaskId: null,
  taskDetailTab: 'basic',

  detailOrderId: null,

  blockDialogTaskId: null,
  blockReason: 'OTHER',
  blockRemark: '',

  confirmDialogType: null,
  confirmTaskIds: [],

  taskActionMenuId: null,
  orderActionMenuId: null,
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: '待开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '暂不能继续',
  CANCELLED: '已取消',
}

const ASSIGNMENT_STATUS_LABEL: Record<TaskAssignmentStatus, string> = {
  UNASSIGNED: '待分配',
  ASSIGNING: '分配中',
  ASSIGNED: '已派单',
  BIDDING: '竞价中',
  AWARDED: '已中标',
}

const STATUS_COLOR_CLASS: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  DONE: 'bg-green-100 text-green-700 border-green-200',
  BLOCKED: 'bg-red-100 text-red-700 border-red-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

const ASSIGNMENT_STATUS_COLOR_CLASS: Record<TaskAssignmentStatus, string> = {
  UNASSIGNED: 'bg-orange-100 text-orange-700 border-orange-200',
  ASSIGNING: 'bg-amber-100 text-amber-700 border-amber-200',
  ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-200',
  BIDDING: 'bg-purple-100 text-purple-700 border-purple-200',
  AWARDED: 'bg-green-100 text-green-700 border-green-200',
}

const LIFECYCLE_LABEL: Record<PoLifecycle, string> = {
  PREPARING: '准备中',
  PENDING_ASSIGN: '待分配',
  IN_EXECUTION: '执行中',
  PENDING_QC: '待质检',
  PENDING_SETTLEMENT: '待结算',
  CLOSED: '已结案',
}

const LIFECYCLE_COLOR_CLASS: Record<PoLifecycle, string> = {
  PREPARING: 'bg-slate-100 text-slate-700 border-slate-200',
  PENDING_ASSIGN: 'bg-orange-100 text-orange-700 border-orange-200',
  IN_EXECUTION: 'bg-blue-100 text-blue-700 border-blue-200',
  PENDING_QC: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PENDING_SETTLEMENT: 'bg-purple-100 text-purple-700 border-purple-200',
  CLOSED: 'bg-green-100 text-green-700 border-green-200',
}

const LIFECYCLE_ICON: Record<PoLifecycle, string> = {
  PREPARING: 'clock',
  PENDING_ASSIGN: 'alert-circle',
  IN_EXECUTION: 'play-circle',
  PENDING_QC: 'search',
  PENDING_SETTLEMENT: 'arrow-up-right',
  CLOSED: 'check-circle-2',
}

const TASK_RISK_LABEL: Record<TaskRiskFlag, string> = {
  TECH_PACK_NOT_RELEASED: '技术包未发布',
  TENDER_OVERDUE: '竞价逾期',
  TENDER_NEAR_DEADLINE: '竞价临近截止',
  DISPATCH_REJECTED: '派单拒绝',
  FACTORY_BLACKLISTED: '工厂黑名单',
  TASK_OVERDUE: '任务逾期',
}

const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  MATERIAL: '物料问题',
  CAPACITY: '产能问题',
  QUALITY: '质量问题',
  TECH: '技术问题',
  EQUIPMENT: '设备问题',
  OTHER: '其他',
  ALLOCATION_GATE: '当前暂不能继续',
}

const BLOCK_REASON_OPTIONS: Array<{ value: BlockReason; label: string }> = [
  { value: 'MATERIAL', label: BLOCK_REASON_LABEL.MATERIAL },
  { value: 'CAPACITY', label: BLOCK_REASON_LABEL.CAPACITY },
  { value: 'QUALITY', label: BLOCK_REASON_LABEL.QUALITY },
  { value: 'TECH', label: BLOCK_REASON_LABEL.TECH },
  { value: 'EQUIPMENT', label: BLOCK_REASON_LABEL.EQUIPMENT },
  { value: 'OTHER', label: BLOCK_REASON_LABEL.OTHER },
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
  return initialTenders.find((item) => item.tenderId === tenderId)
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((task) => task.taskId === taskId)
}

function getTaskDependencies(task: ProcessTask): string[] {
  const compatTask = task as ProcessTask & {
    dependencyTaskIds?: string[]
    predecessorTaskIds?: string[]
  }

  return (
    compatTask.dependsOnTaskIds ??
    compatTask.dependencyTaskIds ??
    compatTask.predecessorTaskIds ??
    []
  )
}

function getOrderSpuCode(order: ProductionOrder | undefined, fallback: string): string {
  return order?.demandSnapshot?.spuCode ?? fallback
}

function getOrderSpuName(order: ProductionOrder | undefined): string {
  return order?.demandSnapshot?.spuName ?? ''
}

function getOrderQty(order: ProductionOrder | undefined, orderTasks: ProcessTask[]): number {
  if (order?.demandSnapshot?.skuLines?.length) {
    return order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  }
  return orderTasks.reduce((sum, task) => sum + task.qty, 0)
}

function parseDateTime(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function deriveBlockpoint(tasks: ProcessTask[]): string {
  if (tasks.some((task) => task.status === 'BLOCKED' && task.blockReason === 'QUALITY')) return '质检未已完成'
  if (tasks.some((task) => task.status === 'BLOCKED' && task.blockReason === 'MATERIAL')) return '染印回货未完成'
  if (tasks.some((task) => task.status === 'BLOCKED')) {
    return `${tasks.filter((task) => task.status === 'BLOCKED').length} 个任务暂不能继续中`
  }
  if (tasks.some((task) => task.assignmentStatus === 'UNASSIGNED')) return '后道任务未分配'
  if (tasks.some((task) => task.assignmentStatus === 'BIDDING')) return '存在竞价未定标任务'
  return '—'
}

function deriveNextAction(lifecycle: PoLifecycle, tasks: ProcessTask[]): string {
  switch (lifecycle) {
    case 'PREPARING':
      return '完成技术包并发布'
    case 'PENDING_ASSIGN':
      return `分配 ${tasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length} 个待分配任务`
    case 'IN_EXECUTION':
      if (tasks.some((task) => task.status === 'BLOCKED')) {
        return '处理暂不能继续任务后继续推进'
      }
      return '跟进执行进度并催办'
    case 'PENDING_QC':
      return '完成质检并已完成返工'
    case 'PENDING_SETTLEMENT':
      return '完成扣款对账并结算'
    case 'CLOSED':
      return '已结案，无需操作'
  }
}

function deriveLifecycle(tasks: ProcessTask[], order: ProductionOrder | undefined): PoLifecycle {
  if (tasks.length === 0) return 'PREPARING'
  if (order?.techPackSnapshot?.status !== 'RELEASED') return 'PREPARING'

  const total = tasks.length
  const done = tasks.filter((task) => task.status === 'DONE').length
  const blocked = tasks.filter((task) => task.status === 'BLOCKED').length
  const unassigned = tasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length
  const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length
  const bidding = tasks.filter((task) => task.assignmentStatus === 'BIDDING').length

  if (done === total && blocked === 0) return 'CLOSED'
  if (done / total >= 0.85) return 'PENDING_SETTLEMENT'
  if (done / total >= 0.7 || (done + blocked === total && blocked > 0 && tasks.some((task) => task.blockReason === 'QUALITY'))) {
    return 'PENDING_QC'
  }
  if (unassigned > 0 || bidding > 0) return 'PENDING_ASSIGN'
  if (inProgress > 0 || done > 0) return 'IN_EXECUTION'

  return 'PREPARING'
}

function getTaskRisks(task: ProcessTask): TaskRiskFlag[] {
  const risks: TaskRiskFlag[] = []
  const order = getOrderById(task.productionOrderId)

  if (order?.techPackSnapshot?.status !== 'RELEASED') {
    risks.push('TECH_PACK_NOT_RELEASED')
  }

  if (task.tenderId) {
    const tender = getTenderById(task.tenderId)
    if (tender) {
      const deadlineTime = parseDateTime(tender.deadline)
      const now = Date.now()
      if (tender.status === 'OVERDUE' || (!Number.isNaN(deadlineTime) && deadlineTime < now)) {
        risks.push('TENDER_OVERDUE')
      } else if (!Number.isNaN(deadlineTime) && deadlineTime - now < 24 * 60 * 60 * 1000) {
        risks.push('TENDER_NEAR_DEADLINE')
      }
    }
  }

  if (task.auditLogs.some((log) => log.action === 'REJECTED')) {
    risks.push('DISPATCH_REJECTED')
  }

  if (order?.demandSnapshot?.requiredDeliveryDate) {
    const deliveryDate = new Date(order.demandSnapshot.requiredDeliveryDate).getTime()
    if (!Number.isNaN(deliveryDate) && deliveryDate < Date.now() && task.status !== 'DONE') {
      risks.push('TASK_OVERDUE')
    }
  }

  return risks
}

function getTaskKpiStats(): {
  notStarted: number
  inProgress: number
  blocked: number
  done: number
  unassigned: number
  tenderOverdue: number
} {
  return {
    notStarted: processTasks.filter((task) => task.status === 'NOT_STARTED').length,
    inProgress: processTasks.filter((task) => task.status === 'IN_PROGRESS').length,
    blocked: processTasks.filter((task) => task.status === 'BLOCKED').length,
    done: processTasks.filter((task) => task.status === 'DONE').length,
    unassigned: processTasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length,
    tenderOverdue: processTasks.filter((task) => {
      if (!task.tenderId) return false
      const tender = getTenderById(task.tenderId)
      return tender?.status === 'OVERDUE'
    }).length,
  }
}

function getPoViewRows(): PoViewRow[] {
  const orderIds = [...new Set(processTasks.map((task) => task.productionOrderId))]

  return orderIds.map((orderId) => {
    const tasks = processTasks.filter((task) => task.productionOrderId === orderId)
    const order = getOrderById(orderId)
    const mainFactoryId = order?.mainFactoryId ?? tasks.find((task) => task.assignedFactoryId)?.assignedFactoryId
    const mainFactory = mainFactoryId ? getFactoryById(mainFactoryId)?.name ?? mainFactoryId : '未指定'
    const lifecycle = deriveLifecycle(tasks, order)

    const risks: string[] = []
    if (tasks.some((task) => task.status === 'BLOCKED')) risks.push('有暂不能继续')
    if (tasks.some((task) => getTaskRisks(task).includes('TASK_OVERDUE'))) risks.push('逾期风险')
    if (tasks.some((task) => getTaskRisks(task).includes('TENDER_OVERDUE'))) risks.push('竞价逾期')
    if (order?.techPackSnapshot?.status !== 'RELEASED') risks.push('技术包未发布')

    return {
      orderId,
      spuCode: getOrderSpuCode(order, orderId),
      spuName: getOrderSpuName(order),
      mainFactory,
      qty: getOrderQty(order, tasks),
      lifecycle,
      totalTasks: tasks.length,
      doneTasks: tasks.filter((task) => task.status === 'DONE').length,
      inProgressTasks: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      blockedTasks: tasks.filter((task) => task.status === 'BLOCKED').length,
      unassignedTasks: tasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length,
      risks,
      blockpoint: deriveBlockpoint(tasks),
      nextAction: deriveNextAction(lifecycle, tasks),
    }
  })
}

function getPoKpiStats(rows: PoViewRow[]): {
  preparing: number
  pendingAssign: number
  inExecution: number
  pendingQc: number
  pendingSettlement: number
  closed: number
} {
  return {
    preparing: rows.filter((row) => row.lifecycle === 'PREPARING').length,
    pendingAssign: rows.filter((row) => row.lifecycle === 'PENDING_ASSIGN').length,
    inExecution: rows.filter((row) => row.lifecycle === 'IN_EXECUTION').length,
    pendingQc: rows.filter((row) => row.lifecycle === 'PENDING_QC').length,
    pendingSettlement: rows.filter((row) => row.lifecycle === 'PENDING_SETTLEMENT').length,
    closed: rows.filter((row) => row.lifecycle === 'CLOSED').length,
  }
}

function getFilteredPoRows(rows: PoViewRow[]): PoViewRow[] {
  const keyword = state.poKeyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (keyword) {
      const target = `${row.orderId} ${row.spuCode} ${row.spuName} ${row.mainFactory}`.toLowerCase()
      if (!target.includes(keyword)) return false
    }

    if (state.poLifecycleFilter !== 'ALL' && row.lifecycle !== state.poLifecycleFilter) {
      return false
    }

    return true
  })
}

function getPoKanbanGroups(rows: PoViewRow[]): Record<PoLifecycle, PoViewRow[]> {
  const groups: Record<PoLifecycle, PoViewRow[]> = {
    PREPARING: [],
    PENDING_ASSIGN: [],
    IN_EXECUTION: [],
    PENDING_QC: [],
    PENDING_SETTLEMENT: [],
    CLOSED: [],
  }

  for (const row of rows) {
    groups[row.lifecycle].push(row)
  }

  return groups
}

function getFilteredTasks(): ProcessTask[] {
  const keyword = state.keyword.trim().toLowerCase()

  return processTasks.filter((task) => {
    if (keyword) {
      const order = getOrderById(task.productionOrderId)
      const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
      const target = `${task.taskId} ${task.productionOrderId} ${order?.legacyOrderNo ?? ''} ${getOrderSpuCode(order, '')} ${getOrderSpuName(order)} ${factory?.name ?? ''}`.toLowerCase()
      if (!target.includes(keyword)) return false
    }

    if (state.statusFilter !== 'ALL' && task.status !== state.statusFilter) return false
    if (state.assignmentStatusFilter !== 'ALL' && task.assignmentStatus !== state.assignmentStatusFilter) return false
    if (state.assignmentModeFilter !== 'ALL' && task.assignmentMode !== state.assignmentModeFilter) return false
    if (state.processFilter !== 'ALL' && task.processCode !== state.processFilter) return false
    if (state.stageFilter !== 'ALL' && task.stage !== state.stageFilter) return false
    if (state.factoryFilter !== 'ALL' && task.assignedFactoryId !== state.factoryFilter) return false

    if (state.riskFilter !== 'ALL') {
      const risks = getTaskRisks(task)
      if (state.riskFilter === 'blockedOnly' && task.status !== 'BLOCKED') return false
      if (state.riskFilter === 'tenderOverdueOnly' && !risks.includes('TENDER_OVERDUE')) return false
      if (state.riskFilter === 'rejectedOnly' && !risks.includes('DISPATCH_REJECTED')) return false
      if (state.riskFilter === 'taskOverdueOnly' && !risks.includes('TASK_OVERDUE')) return false
    }

    return true
  })
}

function getTaskKanbanGroups(tasks: ProcessTask[]): Record<'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE', ProcessTask[]> {
  return {
    NOT_STARTED: tasks.filter((task) => task.status === 'NOT_STARTED'),
    IN_PROGRESS: tasks.filter((task) => task.status === 'IN_PROGRESS'),
    BLOCKED: tasks.filter((task) => task.status === 'BLOCKED'),
    DONE: tasks.filter((task) => task.status === 'DONE'),
  }
}

function getUniqueFactories(): Array<{ id: string; name: string }> {
  const factoryIds = [...new Set(processTasks.filter((task) => task.assignedFactoryId).map((task) => task.assignedFactoryId as string))]
  return factoryIds.map((id) => ({ id, name: getFactoryById(id)?.name ?? id }))
}

function getExceptionsByTaskId(taskId: string): ExceptionCase[] {
  return initialExceptions.filter((item) => item.relatedTaskIds.includes(taskId))
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

  const urgeTypeLabel: Record<UrgeType, string> = {
    URGE_ASSIGN_ACK: '催确认接单',
    URGE_START: '催开工',
    URGE_FINISH: '催完工',
    URGE_UNBLOCK: '催尽快处理',
    URGE_TENDER_BID: '催报价',
    URGE_TENDER_AWARD: '催定标',
    URGE_HANDOVER_CONFIRM: '催交接确认',
    URGE_HANDOVER_EVIDENCE: '催补证据/处理差异',
    URGE_CASE_HANDLE: '去处理异常',
  }

  createNotification({
    level: 'INFO',
    title: '收到催办',
    content: `${payload.fromName}：${urgeTypeLabel[payload.urgeType]} - ${payload.message}`,
    recipientType: payload.toType,
    recipientId: payload.toId,
    recipientName: payload.toName,
    targetType: payload.targetType,
    targetId: payload.targetId,
    related: {},
    deepLink: payload.deepLink,
    createdBy: payload.fromId,
  })

  return urge
}

function createOrUpdateExceptionFromSignal(signal: {
  sourceType: 'TASK' | 'ORDER' | 'TENDER'
  sourceId: string
  reasonCode: ReasonCode
  detail?: string
}): ExceptionCase {
  const now = nowTimestamp()

  const existed = initialExceptions.find(
    (item) =>
      item.sourceType === signal.sourceType &&
      item.sourceId === signal.sourceId &&
      item.reasonCode === signal.reasonCode &&
      item.caseStatus !== 'CLOSED',
  )

  if (existed) {
    existed.updatedAt = now
    existed.detail = signal.detail || existed.detail
    existed.auditLogs = [
      ...existed.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'UPDATE',
        detail: '信号重新触发，更新异常',
        at: now,
        by: '系统',
      },
    ]
    return existed
  }

  const s1Reasons: ReasonCode[] = ['TENDER_OVERDUE', 'NO_BID', 'FACTORY_BLACKLISTED', 'HANDOVER_DIFF']
  const s2Reasons: ReasonCode[] = ['DISPATCH_REJECTED', 'ACK_TIMEOUT', 'TENDER_NEAR_DEADLINE', 'TECH_PACK_NOT_RELEASED', 'MATERIAL_NOT_READY']

  let severity: Severity = 'S3'
  if (s1Reasons.includes(signal.reasonCode)) {
    severity = 'S1'
  } else if (s2Reasons.includes(signal.reasonCode) || signal.reasonCode.startsWith('BLOCKED_')) {
    severity = 'S2'
  }

  let category: ExceptionCategory = 'PRODUCTION_BLOCK'
  if (signal.reasonCode.startsWith('BLOCKED_')) {
    category = 'PRODUCTION_BLOCK'
  } else if (['TENDER_OVERDUE', 'TENDER_NEAR_DEADLINE', 'NO_BID', 'PRICE_ABNORMAL', 'DISPATCH_REJECTED', 'ACK_TIMEOUT', 'FACTORY_BLACKLISTED'].includes(signal.reasonCode)) {
    category = 'ASSIGNMENT'
  } else if (signal.reasonCode === 'TECH_PACK_NOT_RELEASED') {
    category = 'TECH_PACK'
  } else if (signal.reasonCode === 'HANDOVER_DIFF') {
    category = 'HANDOVER'
  } else if (signal.reasonCode === 'MATERIAL_NOT_READY') {
    category = 'MATERIAL'
  }

  let relatedOrderIds: string[] = []
  let relatedTaskIds: string[] = []
  let relatedTenderIds: string[] = []

  if (signal.sourceType === 'TASK') {
    const task = getTaskById(signal.sourceId)
    relatedTaskIds = [signal.sourceId]
    if (task) {
      relatedOrderIds = [task.productionOrderId]
      if (task.tenderId) relatedTenderIds = [task.tenderId]
    }
  } else if (signal.sourceType === 'ORDER') {
    relatedOrderIds = [signal.sourceId]
    relatedTaskIds = processTasks.filter((task) => task.productionOrderId === signal.sourceId).map((task) => task.taskId)
  } else {
    const tender = getTenderById(signal.sourceId)
    relatedTenderIds = [signal.sourceId]
    if (tender) {
      relatedOrderIds = tender.productionOrderIds
      relatedTaskIds = tender.taskIds
    }
  }

  const reasonSummary: Record<ReasonCode, string> = {
    BLOCKED_MATERIAL: '物料待处理',
    BLOCKED_CAPACITY: '产能待处理',
    BLOCKED_QUALITY: '质量返工',
    BLOCKED_TECH: '工艺资料暂不能继续',
    BLOCKED_EQUIPMENT: '设备待处理',
    BLOCKED_OTHER: '其他待处理',
    TENDER_OVERDUE: '竞价已逾期',
    TENDER_NEAR_DEADLINE: '竞价即将截止',
    NO_BID: '竞价无人报价',
    PRICE_ABNORMAL: '报价异常',
    DISPATCH_REJECTED: '派单被拒',
    ACK_TIMEOUT: '派单确认超时',
    TECH_PACK_NOT_RELEASED: '技术包未发布',
    FACTORY_BLACKLISTED: '工厂黑名单',
    HANDOVER_DIFF: '交接差异',
    MATERIAL_NOT_READY: '物料未齐套',
  }

  const exception: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity,
    category,
    reasonCode: signal.reasonCode,
    sourceType: signal.sourceType,
    sourceId: signal.sourceId,
    relatedOrderIds,
    relatedTaskIds,
    relatedTenderIds,
    summary: reasonSummary[signal.reasonCode] ?? signal.reasonCode,
    detail: signal.detail ?? `${signal.sourceType} ${signal.sourceId} 触发异常：${reasonSummary[signal.reasonCode] ?? signal.reasonCode}`,
    createdAt: now,
    updatedAt: now,
    slaDueAt: calculateSlaDue(severity, now),
    tags: [],
    actions: [],
    auditLogs: [
      {
        id: `EAL-${Date.now()}`,
        action: 'CREATE',
        detail: '系统自动生成异常单',
        at: now,
        by: '系统',
      },
    ],
  }

  initialExceptions.push(exception)
  return exception
}

function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  blockReason?: BlockReason,
  blockRemark?: string,
  by: string = 'Admin',
): void {
  const index = processTasks.findIndex((task) => task.taskId === taskId)
  if (index < 0) return

  const task = processTasks[index]
  const now = nowTimestamp()

  const actionMap: Record<TaskStatus, string> = {
    NOT_STARTED: 'RESET',
    IN_PROGRESS: task.status === 'BLOCKED' ? 'UNBLOCK' : 'START',
    DONE: 'FINISH',
    BLOCKED: 'BLOCK',
    CANCELLED: 'CANCEL',
  }

  const detailMap: Record<TaskStatus, string> = {
    NOT_STARTED: '重置为未开始',
    IN_PROGRESS: task.status === 'BLOCKED' ? '恢复执行，状态改为进行中' : '标记开始',
    DONE: '标记完工',
    BLOCKED: `标记暂不能继续，原因：${blockReason ?? 'OTHER'}${blockRemark ? `，备注：${blockRemark}` : ''}`,
    CANCELLED: '取消任务',
  }

  const auditLog: TaskAuditLog = {
    id: `AL-${Date.now()}-${taskId}`,
    action: actionMap[newStatus],
    detail: detailMap[newStatus],
    at: now,
    by,
  }

  const updatedTask: ProcessTask = {
    ...task,
    status: newStatus,
    updatedAt: now,
    auditLogs: [...task.auditLogs, auditLog],
    ...(newStatus === 'IN_PROGRESS' && !task.startedAt ? { startedAt: now } : {}),
    ...(newStatus === 'DONE' ? { finishedAt: now } : {}),
    ...(newStatus === 'BLOCKED' ? { blockReason, blockRemark, blockedAt: now } : {}),
    ...(newStatus !== 'BLOCKED' ? { blockReason: undefined, blockRemark: undefined, blockedAt: undefined } : {}),
  }

  processTasks[index] = updatedTask

  const orderIndex = productionOrders.findIndex((order) => order.productionOrderId === task.productionOrderId)
  if (orderIndex < 0) return

  const order = productionOrders[orderIndex]
  const relatedTasks = processTasks.filter((item) => item.productionOrderId === task.productionOrderId)
  const doneCount = relatedTasks.filter((item) => item.status === 'DONE').length
  const inProgressCount = relatedTasks.filter((item) => item.status === 'IN_PROGRESS').length
  const blockedCount = relatedTasks.filter((item) => item.status === 'BLOCKED').length

  let nextStatus = order.status
  if (doneCount === relatedTasks.length && relatedTasks.length > 0) {
    nextStatus = 'COMPLETED'
  } else if (doneCount > 0 || inProgressCount > 0 || blockedCount > 0) {
    nextStatus = 'EXECUTING'
  }

  productionOrders[orderIndex] = {
    ...order,
    status: nextStatus,
    updatedAt: now,
    auditLogs: [
      ...order.auditLogs,
      {
        id: `AL-ORDER-${Date.now()}`,
        action: 'TASK_STATUS_WRITEBACK',
        detail: `任务 ${taskId} 状态变更为 ${newStatus}`,
        at: now,
        by: '系统',
      },
    ],
  }
}

function showProgressBoardToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'progress-board-toast-root'
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

function copyToClipboard(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showProgressBoardToast(`已复制: ${text}`)
      })
      .catch(() => {
        showProgressBoardToast('复制失败', 'error')
      })
    return
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
      showProgressBoardToast(`已复制: ${text}`)
    } catch {
      showProgressBoardToast('复制失败', 'error')
    } finally {
      textarea.remove()
    }
  }
}

function openLinkedPage(title: string, href: string): void {
  appStore.openTab({
    key: href,
    title,
    href,
    closable: true,
  })
}

function syncPresetFromQuery(): void {
  const queryKey = getCurrentQueryString()
  if (state.lastQueryKey === queryKey) return

  state.lastQueryKey = queryKey
  const params = getCurrentSearchParams()

  const presetStatus = params.get('status')
  const presetAssignmentStatus = params.get('assignmentStatus')
  const presetRisk = params.get('risk')
  const presetTaskId = params.get('taskId')
  const presetPoId = params.get('po')

  if (!state.initializedByQuery) {
    state.initializedByQuery = true
    state.statusFilter = presetStatus || 'ALL'
    state.assignmentStatusFilter = presetAssignmentStatus || 'ALL'
    state.riskFilter = presetRisk || 'ALL'
  } else {
    if (presetStatus) state.statusFilter = presetStatus
    if (presetAssignmentStatus) state.assignmentStatusFilter = presetAssignmentStatus
    if (presetRisk) state.riskFilter = presetRisk
  }

  if (presetTaskId) {
    state.dimension = 'task'
    state.keyword = presetTaskId
  }

  if (presetPoId && !presetTaskId) {
    state.dimension = 'order'
    state.poKeyword = presetPoId
  }
}

function clearTaskFilters(): void {
  state.keyword = ''
  state.statusFilter = 'ALL'
  state.assignmentStatusFilter = 'ALL'
  state.assignmentModeFilter = 'ALL'
  state.processFilter = 'ALL'
  state.stageFilter = 'ALL'
  state.riskFilter = 'ALL'
  state.factoryFilter = 'ALL'
}

function handleTaskKpiClick(type: string): void {
  clearTaskFilters()

  switch (type) {
    case 'notStarted':
      state.statusFilter = 'NOT_STARTED'
      break
    case 'inProgress':
      state.statusFilter = 'IN_PROGRESS'
      break
    case 'blocked':
      state.statusFilter = 'BLOCKED'
      break
    case 'done':
      state.statusFilter = 'DONE'
      break
    case 'unassigned':
      state.assignmentStatusFilter = 'UNASSIGNED'
      break
    case 'tenderOverdue':
      state.riskFilter = 'tenderOverdueOnly'
      break
    default:
      break
  }
}

function handlePoKpiClick(lifecycle: PoLifecycle): void {
  state.poKeyword = ''
  state.poLifecycleFilter = lifecycle
}

function setTaskSelected(taskId: string, checked: boolean): void {
  if (checked) {
    if (!state.selectedTaskIds.includes(taskId)) {
      state.selectedTaskIds = [...state.selectedTaskIds, taskId]
    }
    return
  }

  state.selectedTaskIds = state.selectedTaskIds.filter((id) => id !== taskId)
}

function openOrderDetail(orderId: string): void {
  state.dimension = 'order'
  state.detailOrderId = orderId
  state.detailTaskId = null
  state.orderActionMenuId = null
  state.taskActionMenuId = null
}

function openTaskDetail(taskId: string): void {
  state.detailTaskId = taskId
  state.taskDetailTab = 'basic'
  state.taskActionMenuId = null
}

function handleBatchUrge(): void {
  const selectedTasks = processTasks.filter((task) => state.selectedTaskIds.includes(task.taskId))
  let sent = 0

  for (const task of selectedTasks) {
    if (!task.assignedFactoryId || ['DONE', 'CANCELLED'].includes(task.status)) continue

    const factory = getFactoryById(task.assignedFactoryId)
    const urgeType: UrgeType =
      task.status === 'NOT_STARTED'
        ? 'URGE_START'
        : task.status === 'BLOCKED'
          ? 'URGE_UNBLOCK'
          : 'URGE_FINISH'

    createUrge({
      urgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType: 'FACTORY',
      toId: task.assignedFactoryId,
      toName: factory?.name ?? task.assignedFactoryId,
      targetType: 'TASK',
      targetId: task.taskId,
      message: `请尽快处理任务 ${task.taskId}`,
      deepLink: {
        path: '/fcs/progress/board',
        query: { taskId: task.taskId },
      },
    })

    sent += 1
  }

  showProgressBoardToast(sent > 0 ? `已发送 ${sent} 条催办` : '没有可催办任务', sent > 0 ? 'success' : 'error')
  state.selectedTaskIds = []
}

function openBatchDialog(type: 'start' | 'finish'): void {
  const eligibleTaskIds = state.selectedTaskIds.filter((taskId) => {
    const task = getTaskById(taskId)
    if (!task) return false
    return type === 'start' ? task.status === 'NOT_STARTED' : task.status === 'IN_PROGRESS'
  })

  if (eligibleTaskIds.length === 0) {
    showProgressBoardToast('没有符合条件的任务', 'error')
    return
  }

  state.confirmDialogType = type
  state.confirmTaskIds = eligibleTaskIds
}

function confirmBatchAction(): void {
  if (!state.confirmDialogType || state.confirmTaskIds.length === 0) return

  const newStatus: TaskStatus = state.confirmDialogType === 'start' ? 'IN_PROGRESS' : 'DONE'

  for (const taskId of state.confirmTaskIds) {
    updateTaskStatus(taskId, newStatus, undefined, undefined, 'Admin')
  }

  showProgressBoardToast(`已更新 ${state.confirmTaskIds.length} 个任务`)
  state.confirmDialogType = null
  state.confirmTaskIds = []
  state.selectedTaskIds = []
}

function requestTaskStatusChange(task: ProcessTask, nextStatus: TaskStatus): void {
  if (nextStatus === 'BLOCKED') {
    state.blockDialogTaskId = task.taskId
    state.blockReason = 'OTHER'
    state.blockRemark = ''
    return
  }

  updateTaskStatus(task.taskId, nextStatus, undefined, undefined, 'Admin')
  showProgressBoardToast(`任务 ${task.taskId} 状态已更新`)
}

function confirmTaskBlock(): void {
  if (!state.blockDialogTaskId) return

  const task = getTaskById(state.blockDialogTaskId)
  if (!task) {
    state.blockDialogTaskId = null
    return
  }

  updateTaskStatus(task.taskId, 'BLOCKED', state.blockReason, state.blockRemark, 'Admin')

  const reasonCodeMap: Record<BlockReason, ReasonCode> = {
    MATERIAL: 'BLOCKED_MATERIAL',
    CAPACITY: 'BLOCKED_CAPACITY',
    QUALITY: 'BLOCKED_QUALITY',
    TECH: 'BLOCKED_TECH',
    EQUIPMENT: 'BLOCKED_EQUIPMENT',
    OTHER: 'BLOCKED_OTHER',
    ALLOCATION_GATE: 'BLOCKED_OTHER',
  }

  createOrUpdateExceptionFromSignal({
    sourceType: 'TASK',
    sourceId: task.taskId,
    reasonCode: reasonCodeMap[state.blockReason],
    detail: state.blockRemark || `任务 ${task.taskId} 被标记为暂不能继续，原因：${BLOCK_REASON_LABEL[state.blockReason]}`,
  })

  showProgressBoardToast(`任务 ${task.taskId} 已标记为暂不能继续`)

  state.blockDialogTaskId = null
  state.blockReason = 'OTHER'
  state.blockRemark = ''
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function renderTaskRiskBadges(risks: TaskRiskFlag[]): string {
  if (!risks.length) return '<span class="text-xs text-muted-foreground">—</span>'

  const tags = risks.slice(0, 2).map((risk) => renderBadge(TASK_RISK_LABEL[risk], 'border-red-200 bg-red-100 text-red-700'))
  if (risks.length > 2) {
    tags.push(renderBadge(`+${risks.length - 2}`, 'border-border bg-background text-foreground'))
  }

  return `<div class="flex flex-wrap gap-1">${tags.join('')}</div>`
}

function renderTaskActionMenu(task: ProcessTask): string {
  const isOpen = state.taskActionMenuId === task.taskId
  const po = task.productionOrderId

  return `
    <div class="relative inline-flex" data-progress-task-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="toggle-task-menu" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-30 w-48 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-update-progress" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="search" class="mr-2 h-4 w-4"></i>更新进度
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>异常定位
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-handover" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>交接链路
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
              </button>
              <div class="my-1 h-px bg-border"></div>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生产单生命周期
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(po)}" data-progress-stop="true">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderOrderActionMenu(row: PoViewRow): string {
  const isOpen = state.orderActionMenuId === row.orderId

  return `
    <div class="relative inline-flex" data-progress-order-menu="true">
      <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="toggle-order-menu" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      ${
        isOpen
          ? `
            <div class="absolute right-0 top-9 z-30 w-44 rounded-md border bg-popover p-1 shadow-lg">
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-detail" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生命周期
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-exception" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>异常定位
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-dispatch" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
              </button>
              <button class="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted" data-progress-action="order-action-handover" data-order-id="${escapeAttr(row.orderId)}" data-progress-stop="true">
                <i data-lucide="scan-line" class="mr-2 h-4 w-4"></i>交接链路
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderTaskListView(filteredTasks: ProcessTask[]): string {
  const allSelected = filteredTasks.length > 0 && filteredTasks.every((task) => state.selectedTaskIds.includes(task.taskId))

  return `
    <section class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1650px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="w-10 px-3 py-2 font-medium">
                <input type="checkbox" class="h-4 w-4 rounded border" data-progress-action="select-all" ${allSelected ? 'checked' : ''} />
              </th>
              <th class="px-3 py-2 font-medium">任务ID</th>
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">SPU</th>
              <th class="px-3 py-2 font-medium">工序</th>
              <th class="px-3 py-2 font-medium">阶段</th>
              <th class="px-3 py-2 font-medium">数量</th>
              <th class="px-3 py-2 font-medium">分配方式</th>
              <th class="px-3 py-2 font-medium">分配状态</th>
              <th class="px-3 py-2 font-medium">执行工厂</th>
              <th class="px-3 py-2 font-medium">执行状态</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredTasks.length === 0
                ? `
                  <tr>
                    <td colspan="13" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : filteredTasks
                    .map((task) => {
                      const order = getOrderById(task.productionOrderId)
                      const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                      const risks = getTaskRisks(task)

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-progress-action="open-task-detail" data-task-id="${escapeAttr(task.taskId)}">
                          <td class="px-3 py-2" data-progress-stop="true">
                            <input
                              type="checkbox"
                              class="h-4 w-4 rounded border"
                              data-progress-action="toggle-task-select"
                              data-task-id="${escapeAttr(task.taskId)}"
                              ${state.selectedTaskIds.includes(task.taskId) ? 'checked' : ''}
                            />
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              <span class="font-mono text-xs">${escapeHtml(task.taskId)}</span>
                              <button class="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted" data-progress-action="copy-task-id" data-task-id="${escapeAttr(task.taskId)}" data-progress-stop="true">
                                <i data-lucide="copy" class="h-3 w-3"></i>
                              </button>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <button class="inline-flex items-center text-xs text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}" data-progress-stop="true">
                              ${escapeHtml(task.productionOrderId)}
                              <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                            </button>
                          </td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div class="font-medium">${escapeHtml(getOrderSpuCode(order, '-'))}</div>
                              <div class="max-w-[140px] truncate text-muted-foreground">${escapeHtml(getOrderSpuName(order) || '-')}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div>${escapeHtml(task.processNameZh)}</div>
                              <div class="text-muted-foreground">${escapeHtml(task.processCode)}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2">${renderBadge(stageLabels[task.stage as ProcessStage], 'border-border bg-background text-foreground')}</td>
                          <td class="px-3 py-2 text-xs">${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : escapeHtml(task.qtyUnit)}</td>
                          <td class="px-3 py-2">
                            ${
                              task.assignmentMode === 'DIRECT'
                                ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                                : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                            }
                          </td>
                          <td class="px-3 py-2">${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}</td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(factory?.name ?? (task.assignmentStatus === 'BIDDING' ? '待定标' : '-'))}</td>
                          <td class="px-3 py-2">${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}</td>
                          <td class="px-3 py-2">${renderTaskRiskBadges(risks)}</td>
                          <td class="px-3 py-2 text-right" data-progress-stop="true">${renderTaskActionMenu(task)}</td>
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

function renderTaskKanbanView(filteredTasks: ProcessTask[]): string {
  const groups = getTaskKanbanGroups(filteredTasks)
  const columns: Array<{ status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; icon: string; color: string }> = [
    { status: 'NOT_STARTED', icon: 'clock', color: 'text-slate-500' },
    { status: 'IN_PROGRESS', icon: 'play-circle', color: 'text-blue-500' },
    { status: 'BLOCKED', icon: 'pause', color: 'text-red-500' },
    { status: 'DONE', icon: 'check-circle-2', color: 'text-green-500' },
  ]

  return `
    <div class="grid grid-cols-4 gap-4">
      ${columns
        .map(({ status, icon, color }) => {
          const items = groups[status]
          return `
            <section class="space-y-3">
              <div class="flex items-center justify-between px-2">
                <h3 class="flex items-center gap-2 font-medium">
                  <i data-lucide="${icon}" class="h-4 w-4 ${color}"></i>
                  ${TASK_STATUS_LABEL[status]}
                </h3>
                ${renderBadge(String(items.length), 'border-border bg-background text-foreground')}
              </div>
              <div class="h-[calc(100vh-410px)] overflow-y-auto pr-1">
                <div class="space-y-2">
                  ${
                    items.length === 0
                      ? '<div class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">暂无任务</div>'
                      : items
                          .map((task) => {
                            const order = getOrderById(task.productionOrderId)
                            const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
                            const risks = getTaskRisks(task)

                            return `
                              <article class="cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition hover:shadow-md" data-progress-action="open-task-detail" data-task-id="${escapeAttr(task.taskId)}">
                                <div class="flex items-center justify-between">
                                  <span class="font-mono text-xs text-muted-foreground">${escapeHtml(task.taskId)}</span>
                                  ${
                                    task.assignmentMode === 'DIRECT'
                                      ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                                      : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                                  }
                                </div>
                                <div class="mt-2 truncate text-sm font-medium">${escapeHtml(getOrderSpuName(order) || getOrderSpuCode(order, task.productionOrderId))}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.processNameZh)}</div>
                                <div class="mt-2 flex items-center justify-between text-xs">
                                  <span class="truncate text-muted-foreground">${escapeHtml(factory?.name ?? (task.assignmentStatus === 'BIDDING' ? '待定标' : '-'))}</span>
                                  ${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}
                                </div>
                                ${
                                  risks.length > 0
                                    ? `<div class="mt-2">${renderTaskRiskBadges(risks)}</div>`
                                    : ''
                                }
                                <button class="mt-2 inline-flex h-6 w-full items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}" data-progress-stop="true">
                                  <i data-lucide="layers" class="mr-1 h-3 w-3"></i>查看生产单生命周期
                                </button>
                              </article>
                            `
                          })
                          .join('')
                  }
                </div>
              </div>
            </section>
          `
        })
        .join('')}
    </div>
  `
}

function renderTaskDimension(filteredTasks: ProcessTask[]): string {
  const kpi = getTaskKpiStats()

  return `
    <section class="space-y-4">
      <div class="grid grid-cols-6 gap-4">
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="notStarted">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待开始</span>
            <i data-lucide="clock" class="h-4 w-4 text-slate-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold">${kpi.notStarted}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="inProgress">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">进行中</span>
            <i data-lucide="play-circle" class="h-4 w-4 text-blue-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-blue-600">${kpi.inProgress}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="blocked">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">暂不能继续</span>
            <i data-lucide="pause" class="h-4 w-4 text-red-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.blocked}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="done">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">已完成</span>
            <i data-lucide="check-circle-2" class="h-4 w-4 text-green-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-green-600">${kpi.done}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="unassigned">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">待分配</span>
            <i data-lucide="alert-circle" class="h-4 w-4 text-orange-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-orange-600">${kpi.unassigned}</div>
        </button>
        <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="kpi-filter" data-kpi="tenderOverdue">
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">竞价逾期</span>
            <i data-lucide="alert-triangle" class="h-4 w-4 text-red-500"></i>
          </div>
          <div class="mt-1 text-2xl font-bold text-red-600">${kpi.tenderOverdue}</div>
        </button>
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="grid grid-cols-8 gap-3">
          <div class="col-span-2">
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="任务ID / 生产单号 / SPU / 工厂"
              value="${escapeAttr(state.keyword)}"
              data-progress-field="keyword"
            />
          </div>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="statusFilter">
            <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>全部状态</option>
            <option value="NOT_STARTED" ${state.statusFilter === 'NOT_STARTED' ? 'selected' : ''}>待开始</option>
            <option value="IN_PROGRESS" ${state.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>进行中</option>
            <option value="BLOCKED" ${state.statusFilter === 'BLOCKED' ? 'selected' : ''}>暂不能继续</option>
            <option value="DONE" ${state.statusFilter === 'DONE' ? 'selected' : ''}>已完成</option>
            <option value="CANCELLED" ${state.statusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentStatusFilter">
            <option value="ALL" ${state.assignmentStatusFilter === 'ALL' ? 'selected' : ''}>全部分配状态</option>
            <option value="UNASSIGNED" ${state.assignmentStatusFilter === 'UNASSIGNED' ? 'selected' : ''}>待分配</option>
            <option value="ASSIGNING" ${state.assignmentStatusFilter === 'ASSIGNING' ? 'selected' : ''}>分配中</option>
            <option value="ASSIGNED" ${state.assignmentStatusFilter === 'ASSIGNED' ? 'selected' : ''}>已派单</option>
            <option value="BIDDING" ${state.assignmentStatusFilter === 'BIDDING' ? 'selected' : ''}>竞价中</option>
            <option value="AWARDED" ${state.assignmentStatusFilter === 'AWARDED' ? 'selected' : ''}>已中标</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="assignmentModeFilter">
            <option value="ALL" ${state.assignmentModeFilter === 'ALL' ? 'selected' : ''}>全部分配方式</option>
            <option value="DIRECT" ${state.assignmentModeFilter === 'DIRECT' ? 'selected' : ''}>派单</option>
            <option value="BIDDING" ${state.assignmentModeFilter === 'BIDDING' ? 'selected' : ''}>竞价</option>
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="stageFilter">
            <option value="ALL" ${state.stageFilter === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${Object.entries(stageLabels)
              .map(([key, label]) => `<option value="${key}" ${state.stageFilter === key ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('')}
          </select>
          <select class="h-9 rounded-md border bg-background px-3 text-sm" data-progress-field="riskFilter">
            <option value="ALL" ${state.riskFilter === 'ALL' ? 'selected' : ''}>全部风险</option>
            <option value="blockedOnly" ${state.riskFilter === 'blockedOnly' ? 'selected' : ''}>仅暂不能继续</option>
            <option value="tenderOverdueOnly" ${state.riskFilter === 'tenderOverdueOnly' ? 'selected' : ''}>仅竞价逾期</option>
            <option value="rejectedOnly" ${state.riskFilter === 'rejectedOnly' ? 'selected' : ''}>仅派单拒绝</option>
            <option value="taskOverdueOnly" ${state.riskFilter === 'taskOverdueOnly' ? 'selected' : ''}>仅任务逾期</option>
          </select>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="reset-task-filters">重置</button>
        </div>
      </section>

      ${state.viewMode === 'list' ? renderTaskListView(filteredTasks) : renderTaskKanbanView(filteredTasks)}
    </section>
  `
}

function renderOrderListView(rows: PoViewRow[]): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1520px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">SPU</th>
              <th class="px-3 py-2 font-medium">主工厂</th>
              <th class="px-3 py-2 font-medium">生命周期</th>
              <th class="px-3 py-2 font-medium">任务进度</th>
              <th class="px-3 py-2 font-medium">执行摘要</th>
              <th class="px-3 py-2 font-medium">风险</th>
              <th class="px-3 py-2 font-medium">当前卡点</th>
              <th class="px-3 py-2 font-medium">下一动作</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                  <tr>
                    <td colspan="10" class="px-3 py-10 text-center text-muted-foreground">暂无数据</td>
                  </tr>
                `
                : rows
                    .map((row) => {
                      const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

                      return `
                        <tr class="cursor-pointer border-b hover:bg-muted/50" data-progress-action="open-order-detail" data-order-id="${escapeAttr(row.orderId)}">
                          <td class="px-3 py-2"><span class="font-mono text-xs">${escapeHtml(row.orderId)}</span></td>
                          <td class="px-3 py-2">
                            <div class="text-xs">
                              <div class="font-medium">${escapeHtml(row.spuCode)}</div>
                              <div class="max-w-[160px] truncate text-muted-foreground">${escapeHtml(row.spuName || '-')}</div>
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs">${escapeHtml(row.mainFactory)}</td>
                          <td class="px-3 py-2">${renderBadge(LIFECYCLE_LABEL[row.lifecycle], LIFECYCLE_COLOR_CLASS[row.lifecycle])}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1 text-xs">
                              <div class="text-muted-foreground">${row.doneTasks}/${row.totalTasks} 已完成</div>
                              <div class="h-1.5 w-36 overflow-hidden rounded-full bg-muted">
                                <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
                              </div>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              ${row.inProgressTasks > 0 ? renderBadge(`进行中 ${row.inProgressTasks}`, 'border-blue-200 bg-blue-100 text-blue-700') : ''}
                              ${row.blockedTasks > 0 ? renderBadge(`暂不能继续 ${row.blockedTasks}`, 'border-red-200 bg-red-100 text-red-700') : ''}
                              ${row.unassignedTasks > 0 ? renderBadge(`待分配 ${row.unassignedTasks}`, 'border-orange-200 bg-orange-100 text-orange-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap gap-1">
                              ${
                                row.risks.length === 0
                                  ? '<span class="text-xs text-muted-foreground">—</span>'
                                  : `${row.risks
                                      .slice(0, 2)
                                      .map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700'))
                                      .join('')}${
                                      row.risks.length > 2
                                        ? renderBadge(`+${row.risks.length - 2}`, 'border-border bg-background text-foreground')
                                        : ''
                                    }`
                              }
                            </div>
                          </td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(row.blockpoint)}</td>
                          <td class="px-3 py-2 text-xs font-medium text-foreground">${escapeHtml(row.nextAction)}</td>
                          <td class="px-3 py-2 text-right" data-progress-stop="true">${renderOrderActionMenu(row)}</td>
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

function renderOrderKanbanView(rows: PoViewRow[]): string {
  const groups = getPoKanbanGroups(rows)

  return `
    <div class="grid grid-cols-6 gap-3">
      ${(Object.keys(LIFECYCLE_LABEL) as PoLifecycle[])
        .map((lifecycle) => {
          const items = groups[lifecycle]

          return `
            <section class="space-y-3">
              <div class="flex items-center justify-between px-1">
                <h3 class="flex items-center gap-1.5 text-sm font-medium">
                  <i data-lucide="${LIFECYCLE_ICON[lifecycle]}" class="h-4 w-4"></i>
                  ${LIFECYCLE_LABEL[lifecycle]}
                </h3>
                ${renderBadge(String(items.length), 'border-border bg-background text-foreground')}
              </div>
              <div class="h-[calc(100vh-390px)] overflow-y-auto pr-1">
                <div class="space-y-2">
                  ${
                    items.length === 0
                      ? '<div class="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">暂无</div>'
                      : items
                          .map((row) => {
                            const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

                            return `
                              <article class="cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition hover:shadow-md" data-progress-action="open-order-detail" data-order-id="${escapeAttr(row.orderId)}">
                                <div class="font-mono text-xs text-muted-foreground">${escapeHtml(row.orderId)}</div>
                                <div class="mt-1 truncate text-sm font-medium">${escapeHtml(row.spuName || row.spuCode)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.mainFactory)}</div>
                                <div class="mt-1 text-xs text-muted-foreground">${row.qty} 件</div>
                                <div class="mt-2 space-y-1">
                                  <div class="flex justify-between text-xs text-muted-foreground">
                                    <span>任务进度</span>
                                    <span>${row.doneTasks}/${row.totalTasks}</span>
                                  </div>
                                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
                                  </div>
                                </div>
                                ${
                                  row.blockpoint !== '—'
                                    ? `<div class="mt-2 rounded bg-orange-50 px-1.5 py-1 text-xs text-orange-700">卡点：${escapeHtml(row.blockpoint)}</div>`
                                    : ''
                                }
                                ${
                                  row.risks.length > 0
                                    ? `<div class="mt-2 flex flex-wrap gap-1">${row.risks
                                        .slice(0, 2)
                                        .map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700'))
                                        .join('')}</div>`
                                    : ''
                                }
                                <div class="mt-2 text-xs font-medium text-blue-600">${escapeHtml(row.nextAction)}</div>
                              </article>
                            `
                          })
                          .join('')
                  }
                </div>
              </div>
            </section>
          `
        })
        .join('')}
    </div>
  `
}

function renderOrderDimension(rows: PoViewRow[]): string {
  const kpi = getPoKpiStats(rows)
  const filteredRows = getFilteredPoRows(rows)

  return `
    <section class="space-y-4">
      <div class="grid grid-cols-6 gap-4">
        ${[
          { key: 'PREPARING', value: kpi.preparing, label: '准备中' },
          { key: 'PENDING_ASSIGN', value: kpi.pendingAssign, label: '待分配' },
          { key: 'IN_EXECUTION', value: kpi.inExecution, label: '执行中' },
          { key: 'PENDING_QC', value: kpi.pendingQc, label: '待质检' },
          { key: 'PENDING_SETTLEMENT', value: kpi.pendingSettlement, label: '待结算' },
          { key: 'CLOSED', value: kpi.closed, label: '已结案' },
        ]
          .map((item) => {
            const lifecycle = item.key as PoLifecycle
            return `
              <button class="rounded-lg border bg-card p-4 text-left transition hover:bg-muted/40" data-progress-action="po-kpi-filter" data-lifecycle="${item.key}">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">${item.label}</span>
                  <i data-lucide="${LIFECYCLE_ICON[lifecycle]}" class="h-4 w-4"></i>
                </div>
                <div class="mt-1 text-2xl font-bold">${item.value}</div>
              </button>
            `
          })
          .join('')}
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex gap-3">
          <div class="w-full max-w-sm">
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="搜索生产单号 / SPU / 工厂"
              value="${escapeAttr(state.poKeyword)}"
              data-progress-field="poKeyword"
            />
          </div>
          <select class="h-9 w-36 rounded-md border bg-background px-3 text-sm" data-progress-field="poLifecycleFilter">
            <option value="ALL" ${state.poLifecycleFilter === 'ALL' ? 'selected' : ''}>全部阶段</option>
            ${(Object.keys(LIFECYCLE_LABEL) as PoLifecycle[])
              .map((lifecycle) => `<option value="${lifecycle}" ${state.poLifecycleFilter === lifecycle ? 'selected' : ''}>${LIFECYCLE_LABEL[lifecycle]}</option>`)
              .join('')}
          </select>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="reset-order-filters">重置</button>
        </div>
      </section>

      ${state.viewMode === 'list' ? renderOrderListView(filteredRows) : renderOrderKanbanView(filteredRows)}
    </section>
  `
}

function renderTaskDrawer(): string {
  if (!state.detailTaskId) return ''

  const task = getTaskById(state.detailTaskId)
  if (!task) return ''

  const order = getOrderById(task.productionOrderId)
  const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null
  const tender = task.tenderId ? getTenderById(task.tenderId) : undefined
  const taskRisks = getTaskRisks(task)
  const activeTab = task.status === 'BLOCKED' ? state.taskDetailTab : state.taskDetailTab === 'block' ? 'basic' : state.taskDetailTab

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-task-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[600px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="flex items-center gap-2 text-lg font-semibold">
                任务详情
                ${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}
              </h3>
              <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(task.taskId)} · ${escapeHtml(task.processNameZh)}</p>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="close-task-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
          <div class="mt-4 grid grid-cols-5 gap-1 rounded-md border p-1 text-sm">
            <button class="rounded px-2 py-1 ${activeTab === 'basic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="basic">基本信息</button>
            <button class="rounded px-2 py-1 ${activeTab === 'assignment' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="assignment">分配信息</button>
            <button class="rounded px-2 py-1 ${activeTab === 'progress' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="progress">进度操作</button>
            ${
              task.status === 'BLOCKED'
                ? `<button class="rounded px-2 py-1 ${activeTab === 'block' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="block">暂不能继续信息</button>`
                : '<span class="rounded px-2 py-1 text-center text-muted-foreground">—</span>'
            }
            <button class="rounded px-2 py-1 ${activeTab === 'logs' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-task-tab" data-tab="logs">审计日志</button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          ${
            activeTab === 'basic'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">任务ID</p>
                    <p class="font-mono">${escapeHtml(task.taskId)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">生产单号</p>
                    <button class="inline-flex items-center text-primary hover:underline" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
                      ${escapeHtml(task.productionOrderId)}
                      <i data-lucide="external-link" class="ml-1 h-3 w-3"></i>
                    </button>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">工序</p>
                    <p>${escapeHtml(task.processNameZh)} (${escapeHtml(task.processCode)})</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">阶段</p>
                    <p>${escapeHtml(stageLabels[task.stage as ProcessStage])}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">数量</p>
                    <p>${task.qty} ${task.qtyUnit === 'PIECE' ? '件' : escapeHtml(task.qtyUnit)}</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p>${task.assignmentMode === 'DIRECT' ? '派单' : '竞价'}</p>
                  </div>
                  ${
                    task.stdTimeMinutes
                      ? `<div><p class="text-xs text-muted-foreground">标准工时</p><p>${task.stdTimeMinutes} 分钟</p></div>`
                      : ''
                  }
                  ${
                    task.difficulty
                      ? `<div><p class="text-xs text-muted-foreground">难度</p><p>${task.difficulty === 'EASY' ? '简单' : task.difficulty === 'MEDIUM' ? '中等' : '困难'}</p></div>`
                      : ''
                  }
                </div>
                ${
                  task.qcPoints.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">质检点</p>
                        <div class="mt-1 flex flex-wrap gap-1">${task.qcPoints
                          .map((item) => renderBadge(item, 'border-border bg-background text-foreground'))
                          .join('')}</div>
                      </div>
                    `
                    : ''
                }
                ${
                  task.attachments.length > 0
                    ? `
                      <div>
                        <p class="text-xs text-muted-foreground">附件</p>
                        <div class="mt-1 space-y-1 text-sm">
                          ${task.attachments
                            .map((item) => `<div class="text-blue-600 hover:underline">${escapeHtml(item.name)}</div>`)
                            .join('')}
                        </div>
                      </div>
                    `
                    : ''
                }
                <div class="border-t pt-3">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-open-order" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="layers" class="mr-2 h-4 w-4"></i>查看生产单生命周期
                  </button>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'assignment'
              ? `
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">分配方式</p>
                    <p class="mt-1">${
                      task.assignmentMode === 'DIRECT'
                        ? renderBadge('派单', 'border-slate-200 bg-slate-100 text-slate-700')
                        : renderBadge('竞价', 'border-blue-200 bg-blue-100 text-blue-700')
                    }</p>
                  </div>
                  <div>
                    <p class="text-xs text-muted-foreground">分配状态</p>
                    <p class="mt-1">${renderBadge(ASSIGNMENT_STATUS_LABEL[task.assignmentStatus], ASSIGNMENT_STATUS_COLOR_CLASS[task.assignmentStatus])}</p>
                  </div>
                </div>

                ${
                  task.assignedFactoryId
                    ? `
                      <div class="text-sm">
                        <p class="text-xs text-muted-foreground">执行工厂</p>
                        <p>${escapeHtml(factory?.name ?? task.assignedFactoryId)}</p>
                      </div>
                    `
                    : ''
                }

                ${
                  task.tenderId
                    ? `
                      <div class="space-y-2 text-sm">
                        <div>
                          <p class="text-xs text-muted-foreground">竞价ID</p>
                          <p class="font-mono">${escapeHtml(task.tenderId)}</p>
                        </div>
                        ${
                          tender
                            ? `
                              <div>
                                <p class="text-xs text-muted-foreground">竞价截止时间</p>
                                <div class="flex items-center gap-2">
                                  <span>${escapeHtml(tender.deadline)}</span>
                                  ${
                                    tender.status === 'OVERDUE' || parseDateTime(tender.deadline) < Date.now()
                                      ? renderBadge('已逾期', 'border-red-200 bg-red-100 text-red-700')
                                      : ''
                                  }
                                </div>
                              </div>
                            `
                            : ''
                        }
                      </div>
                    `
                    : ''
                }

                <div class="flex flex-wrap gap-2 border-t pt-3">
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-dispatch" data-task-id="${escapeAttr(task.taskId)}" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="send" class="mr-2 h-4 w-4"></i>去任务分配
                  </button>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-material" data-po-id="${escapeAttr(task.productionOrderId)}">
                    <i data-lucide="package" class="mr-2 h-4 w-4"></i>领料进度
                  </button>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'progress'
              ? `
                <div class="text-sm">
                  <p class="text-xs text-muted-foreground">当前状态</p>
                  <div class="mt-1">${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}</div>
                </div>
                ${
                  taskRisks.length > 0
                    ? `<div><p class="text-xs text-muted-foreground">风险标签</p><div class="mt-1">${renderTaskRiskBadges(taskRisks)}</div></div>`
                    : ''
                }
                <div class="flex flex-wrap gap-2 border-t pt-3">
                  ${
                    task.status === 'NOT_STARTED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-start" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>标记开始</button>`
                      : ''
                  }
                  ${
                    task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-finish" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>标记完工</button>`
                      : ''
                  }
                  ${
                    task.status === 'NOT_STARTED' || task.status === 'IN_PROGRESS'
                      ? `<button class="inline-flex h-8 items-center rounded-md border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100" data-progress-action="task-status-block" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="pause" class="mr-1.5 h-4 w-4"></i>标记暂不能继续</button>`
                      : ''
                  }
                  ${
                    task.status === 'BLOCKED'
                      ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-unblock" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>恢复执行</button>`
                      : ''
                  }
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-status-cancel" data-task-id="${escapeAttr(task.taskId)}"><i data-lucide="x-circle" class="mr-1.5 h-4 w-4"></i>取消任务</button>
                </div>

                ${
                  task.assignedFactoryId && !['DONE', 'CANCELLED'].includes(task.status)
                    ? `
                      <div class="border-t pt-3">
                        <p class="text-xs text-muted-foreground">催办与通知</p>
                        <button class="mt-2 inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-send-urge" data-task-id="${escapeAttr(task.taskId)}">
                          <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>催办工厂
                        </button>
                      </div>
                    `
                    : ''
                }
              `
              : ''
          }

          ${
            activeTab === 'block' && task.status === 'BLOCKED'
              ? `
                <div class="space-y-4 text-sm">
                  <div>
                    <p class="text-xs text-muted-foreground">当前无法继续的原因</p>
                    <div class="mt-1">${renderBadge(BLOCK_REASON_LABEL[task.blockReason ?? 'OTHER'], 'border-red-200 bg-red-100 text-red-700')}</div>
                  </div>
                  ${
                    task.blockRemark
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">暂不能继续备注</p>
                          <div class="mt-1 rounded-md bg-muted p-2">${escapeHtml(task.blockRemark)}</div>
                        </div>
                      `
                      : ''
                  }
                  ${
                    task.blockedAt
                      ? `
                        <div>
                          <p class="text-xs text-muted-foreground">暂不能继续开始时间</p>
                          <div class="mt-1">${escapeHtml(task.blockedAt)}</div>
                        </div>
                      `
                      : ''
                  }
                  <div class="border-t pt-3">
                    <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="task-action-view-exception" data-task-id="${escapeAttr(task.taskId)}">
                      <i data-lucide="file-warning" class="mr-1.5 h-4 w-4"></i>查看异常定位
                    </button>
                  </div>
                </div>
              `
              : ''
          }

          ${
            activeTab === 'logs'
              ? `
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b bg-muted/40 text-left">
                        <th class="px-3 py-2 font-medium">动作</th>
                        <th class="px-3 py-2 font-medium">详情</th>
                        <th class="px-3 py-2 font-medium">时间</th>
                        <th class="px-3 py-2 font-medium">操作人</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        task.auditLogs.length === 0
                          ? '<tr><td colspan="4" class="px-3 py-6 text-center text-muted-foreground">暂无数据</td></tr>'
                          : task.auditLogs
                              .map(
                                (log) => `
                                  <tr class="border-b">
                                    <td class="px-3 py-2">${renderBadge(log.action, 'border-border bg-background text-foreground')}</td>
                                    <td class="px-3 py-2">${escapeHtml(log.detail)}</td>
                                    <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(log.at)}</td>
                                    <td class="px-3 py-2 text-xs">${escapeHtml(log.by)}</td>
                                  </tr>
                                `,
                              )
                              .join('')
                      }
                    </tbody>
                  </table>
                </div>
              `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderOrderDrawer(rows: PoViewRow[]): string {
  if (!state.detailOrderId) return ''

  const row = rows.find((item) => item.orderId === state.detailOrderId)
  if (!row) return ''

  const orderTasks = processTasks.filter((task) => task.productionOrderId === row.orderId)
  const progress = row.totalTasks > 0 ? Math.round((row.doneTasks / row.totalTasks) * 100) : 0

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-order-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full max-w-[560px] overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-lg font-semibold">
              <i data-lucide="layers" class="h-5 w-5"></i>
              生产单生命周期详情
              ${renderBadge(LIFECYCLE_LABEL[row.lifecycle], LIFECYCLE_COLOR_CLASS[row.lifecycle])}
            </h3>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted" data-progress-action="close-order-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <div class="space-y-5 px-6 py-5">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">生产单号</p>
              <p class="mt-0.5 font-mono">${escapeHtml(row.orderId)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">SPU</p>
              <p class="mt-0.5">${escapeHtml(row.spuCode)}</p>
              <p class="text-xs text-muted-foreground">${escapeHtml(row.spuName || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">主工厂</p>
              <p class="mt-0.5">${escapeHtml(row.mainFactory)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">数量</p>
              <p class="mt-0.5">${row.qty} 件</p>
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">任务进度</p>
            <div class="mt-1.5 space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span>${row.doneTasks}/${row.totalTasks} 已完成</span>
                <span class="text-muted-foreground">${progress}%</span>
              </div>
              <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                <span class="block h-full rounded-full bg-green-500" style="width:${progress}%"></span>
              </div>
              <div class="flex gap-3 text-xs text-muted-foreground">
                ${row.inProgressTasks > 0 ? `<span class="text-blue-600">进行中 ${row.inProgressTasks}</span>` : ''}
                ${row.blockedTasks > 0 ? `<span class="text-red-600">暂不能继续 ${row.blockedTasks}</span>` : ''}
                ${row.unassignedTasks > 0 ? `<span class="text-orange-600">待分配 ${row.unassignedTasks}</span>` : ''}
              </div>
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">风险摘要</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              ${
                row.risks.length === 0
                  ? '<span class="text-sm text-muted-foreground">无风险</span>'
                  : row.risks.map((risk) => renderBadge(risk, 'border-red-200 bg-red-100 text-red-700')).join('')
              }
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">当前卡点</p>
            <div class="mt-1.5 rounded px-3 py-2 text-sm ${row.blockpoint === '—' ? 'text-muted-foreground' : 'bg-orange-50 text-orange-700'}">${escapeHtml(row.blockpoint)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">下一步动作</p>
            <div class="mt-1.5 rounded bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600">${escapeHtml(row.nextAction)}</div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">任务清单摘要</p>
            <div class="mt-1.5 space-y-1">
              ${orderTasks
                .slice(0, 6)
                .map((task) => {
                  const factory = task.assignedFactoryId ? getFactoryById(task.assignedFactoryId) : null

                  return `
                    <div class="flex items-center justify-between border-b py-1 text-xs last:border-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-muted-foreground">${escapeHtml(task.taskId)}</span>
                        <span>${escapeHtml(task.processNameZh)}</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <span class="text-muted-foreground">${escapeHtml(factory?.name ?? '未分配')}</span>
                        ${renderBadge(TASK_STATUS_LABEL[task.status], STATUS_COLOR_CLASS[task.status])}
                      </div>
                    </div>
                  `
                })
                .join('')}
              ${
                orderTasks.length > 6
                  ? `<div class="pt-1 text-xs text-muted-foreground">... 共 ${orderTasks.length} 个任务</div>`
                  : ''
              }
            </div>
          </div>

          <div>
            <p class="text-xs text-muted-foreground">相关入口</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-view-tasks" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="clipboard-list" class="mr-1.5 h-4 w-4"></i>查看任务清单
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-exception" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="alert-triangle" class="mr-1.5 h-4 w-4"></i>异常定位
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-dispatch" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="send" class="mr-1.5 h-4 w-4"></i>去任务分配
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="order-action-handover" data-order-id="${escapeAttr(row.orderId)}">
                <i data-lucide="scan-line" class="mr-1.5 h-4 w-4"></i>交接链路
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
}

function renderBlockDialog(): string {
  if (!state.blockDialogTaskId) return ''

  const task = getTaskById(state.blockDialogTaskId)
  if (!task) return ''

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-block-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">标记暂不能继续</h3>
          <p class="text-sm text-muted-foreground">任务 ${escapeHtml(task.taskId)} - ${escapeHtml(task.processNameZh)}</p>
        </header>

        <div class="mt-4 space-y-4">
          <div>
            <label class="text-sm">当前无法继续的原因 *</label>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" data-progress-field="blockReason">
              ${BLOCK_REASON_OPTIONS.map((item) => `<option value="${item.value}" ${state.blockReason === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm">备注</label>
            <textarea class="mt-1 min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="请输入备注..." data-progress-field="blockRemark">${escapeHtml(state.blockRemark)}</textarea>
          </div>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-progress-action="close-block-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border border-red-200 bg-red-50 px-4 text-sm text-red-700 hover:bg-red-100" data-progress-action="confirm-block">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderBatchConfirmDialog(): string {
  if (!state.confirmDialogType) return ''

  const title = state.confirmDialogType === 'start' ? '批量标记开始' : '批量标记完工'
  const desc =
    state.confirmDialogType === 'start'
      ? '确认将选中的任务批量标记为进行中？'
      : '确认将选中的任务批量标记为已完成？'

  return `
    <div class="fixed inset-0 z-[60]" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-progress-action="close-batch-dialog" aria-label="关闭"></button>
      <section class="absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
        <header class="space-y-1">
          <h3 class="text-lg font-semibold">${title}</h3>
          <p class="text-sm text-muted-foreground">${desc}</p>
        </header>
        <p class="mt-4 text-sm">将更新 <strong>${state.confirmTaskIds.length}</strong> 个任务</p>
        <footer class="mt-6 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted" data-progress-action="close-batch-dialog">取消</button>
          <button class="inline-flex h-9 items-center rounded-md border bg-primary px-4 text-sm text-primary-foreground hover:opacity-90" data-progress-action="confirm-batch">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderHeader(filteredTasks: ProcessTask[]): string {
  const selectedCount = state.selectedTaskIds.length

  return `
    <header class="flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <i data-lucide="kanban-square" class="h-5 w-5"></i>
          任务进度看板
        </h1>
        <p class="text-sm text-muted-foreground">按任务/生产单双维度追踪执行进度、暂不能继续与风险</p>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.dimension === 'task' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-dimension" data-dimension="task">
            <i data-lucide="clipboard-list" class="mr-1.5 h-4 w-4"></i>任务维度
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.dimension === 'order' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-dimension" data-dimension="order">
            <i data-lucide="layers" class="mr-1.5 h-4 w-4"></i>生产单维度
          </button>
        </div>

        ${
          state.dimension === 'task' && selectedCount > 0
            ? `
              ${renderBadge(`已选择 ${selectedCount} 项`, 'border-border bg-background text-foreground')}
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-urge">
                <i data-lucide="bell" class="mr-1.5 h-4 w-4"></i>批量催办
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-start">
                <i data-lucide="play-circle" class="mr-1.5 h-4 w-4"></i>批量标记开始
              </button>
              <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="batch-finish">
                <i data-lucide="check-circle-2" class="mr-1.5 h-4 w-4"></i>批量标记完工
              </button>
            `
            : ''
        }

        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-progress-action="refresh">
          <i data-lucide="refresh-cw" class="mr-1.5 h-4 w-4"></i>刷新
        </button>

        <div class="flex rounded-md border">
          <button class="inline-flex h-8 items-center rounded-r-none px-3 text-sm ${state.viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-view" data-view="list">
            <i data-lucide="list" class="mr-1.5 h-4 w-4"></i>列表视图
          </button>
          <button class="inline-flex h-8 items-center rounded-l-none px-3 text-sm ${state.viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}" data-progress-action="switch-view" data-view="kanban">
            <i data-lucide="kanban-square" class="mr-1.5 h-4 w-4"></i>看板视图
          </button>
        </div>
      </div>
    </header>
  `
}

export function renderProgressBoardPage(): string {
  syncPresetFromQuery()

  const filteredTasks = getFilteredTasks()
  const poRows = getPoViewRows()

  return `
    <div class="space-y-4">
      ${renderHeader(filteredTasks)}
      ${state.dimension === 'task' ? renderTaskDimension(filteredTasks) : renderOrderDimension(poRows)}
      ${renderTaskDrawer()}
      ${renderOrderDrawer(poRows)}
      ${renderBlockDialog()}
      ${renderBatchConfirmDialog()}
    </div>
  `
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value
    return
  }

  if (field === 'assignmentStatusFilter' && node instanceof HTMLSelectElement) {
    state.assignmentStatusFilter = node.value
    return
  }

  if (field === 'assignmentModeFilter' && node instanceof HTMLSelectElement) {
    state.assignmentModeFilter = node.value
    return
  }

  if (field === 'stageFilter' && node instanceof HTMLSelectElement) {
    state.stageFilter = node.value
    return
  }

  if (field === 'riskFilter' && node instanceof HTMLSelectElement) {
    state.riskFilter = node.value
    return
  }

  if (field === 'poKeyword' && node instanceof HTMLInputElement) {
    state.poKeyword = node.value
    return
  }

  if (field === 'poLifecycleFilter' && node instanceof HTMLSelectElement) {
    state.poLifecycleFilter = node.value
    return
  }

  if (field === 'blockReason' && node instanceof HTMLSelectElement) {
    state.blockReason = node.value as BlockReason
    return
  }

  if (field === 'blockRemark' && node instanceof HTMLTextAreaElement) {
    state.blockRemark = node.value
  }
}

function handleTaskAction(action: string, actionNode: HTMLElement): boolean {
  const taskId = actionNode.dataset.taskId
  const poId = actionNode.dataset.poId

  if (action === 'task-action-update-progress' && taskId) {
    openTaskDetail(taskId)
    state.taskDetailTab = 'progress'
    return true
  }

  if (action === 'task-action-view-exception' && taskId) {
    const opened = getExceptionsByTaskId(taskId).filter((item) => item.caseStatus !== 'CLOSED')
    if (opened.length === 0) {
      createOrUpdateExceptionFromSignal({
        sourceType: 'TASK',
        sourceId: taskId,
        reasonCode: 'BLOCKED_OTHER',
        detail: '从任务看板手动创建异常单',
      })
    }

    openLinkedPage('异常定位', `/fcs/progress/exceptions?taskId=${encodeURIComponent(taskId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-handover' && taskId && poId) {
    openLinkedPage('交接链路', `/fcs/progress/handover?po=${encodeURIComponent(poId)}&taskId=${encodeURIComponent(taskId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-material' && poId) {
    openLinkedPage('领料进度跟踪', `/fcs/progress/material?po=${encodeURIComponent(poId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-open-order' && poId) {
    openOrderDetail(poId)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-dispatch' && taskId && poId) {
    openLinkedPage('任务分配', `/fcs/dispatch/board?po=${encodeURIComponent(poId)}&taskId=${encodeURIComponent(taskId)}`)
    state.taskActionMenuId = null
    return true
  }

  return false
}

function handleOrderAction(action: string, actionNode: HTMLElement): boolean {
  const orderId = actionNode.dataset.orderId
  if (!orderId) return false

  if (action === 'order-action-detail') {
    state.detailOrderId = orderId
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-exception') {
    openLinkedPage('异常定位', `/fcs/progress/exceptions?po=${encodeURIComponent(orderId)}`)
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-dispatch') {
    openLinkedPage('任务分配', `/fcs/dispatch/board?po=${encodeURIComponent(orderId)}`)
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-handover') {
    openLinkedPage('交接链路', `/fcs/progress/handover?po=${encodeURIComponent(orderId)}`)
    state.orderActionMenuId = null
    return true
  }

  return false
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action.startsWith('task-action-') && handleTaskAction(action, actionNode)) {
    return true
  }

  if (action.startsWith('order-action-') && handleOrderAction(action, actionNode)) {
    return true
  }

  if (action === 'switch-dimension') {
    const dimension = actionNode.dataset.dimension
    if (dimension === 'task' || dimension === 'order') {
      state.dimension = dimension
    }
    return true
  }

  if (action === 'switch-view') {
    const view = actionNode.dataset.view
    if (view === 'list' || view === 'kanban') {
      state.viewMode = view
    }
    return true
  }

  if (action === 'refresh') {
    showProgressBoardToast('数据已刷新')
    return true
  }

  if (action === 'kpi-filter') {
    const kpi = actionNode.dataset.kpi
    if (kpi) handleTaskKpiClick(kpi)
    return true
  }

  if (action === 'po-kpi-filter') {
    const lifecycle = actionNode.dataset.lifecycle as PoLifecycle | undefined
    if (lifecycle && lifecycle in LIFECYCLE_LABEL) {
      handlePoKpiClick(lifecycle)
    }
    return true
  }

  if (action === 'reset-task-filters') {
    clearTaskFilters()
    return true
  }

  if (action === 'reset-order-filters') {
    state.poKeyword = ''
    state.poLifecycleFilter = 'ALL'
    return true
  }

  if (action === 'select-all') {
    const checked = actionNode instanceof HTMLInputElement ? actionNode.checked : false
    const filtered = getFilteredTasks()

    if (checked) {
      state.selectedTaskIds = filtered.map((task) => task.taskId)
    } else {
      state.selectedTaskIds = []
    }

    return true
  }

  if (action === 'toggle-task-select') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const checked = actionNode instanceof HTMLInputElement ? actionNode.checked : false
    setTaskSelected(taskId, checked)
    return true
  }

  if (action === 'open-task-detail') {
    if (actionNode.closest('[data-progress-stop="true"]')) return false
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openTaskDetail(taskId)
    }
    return true
  }

  if (action === 'close-task-drawer') {
    state.detailTaskId = null
    return true
  }

  if (action === 'switch-task-tab') {
    const tab = actionNode.dataset.tab as TaskTabKey | undefined
    if (tab) {
      state.taskDetailTab = tab
    }
    return true
  }

  if (action === 'open-order-detail') {
    if (actionNode.closest('[data-progress-stop="true"]')) return false
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      state.detailOrderId = orderId
    }
    return true
  }

  if (action === 'close-order-drawer') {
    state.detailOrderId = null
    return true
  }

  if (action === 'order-view-tasks') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.detailOrderId = null
    state.dimension = 'task'
    state.keyword = orderId
    return true
  }

  if (action === 'copy-task-id') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      copyToClipboard(taskId)
    }
    return true
  }

  if (action === 'toggle-task-menu') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.taskActionMenuId = state.taskActionMenuId === taskId ? null : taskId
    state.orderActionMenuId = null
    return true
  }

  if (action === 'toggle-order-menu') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.orderActionMenuId = state.orderActionMenuId === orderId ? null : orderId
    state.taskActionMenuId = null
    return true
  }

  if (action === 'batch-urge') {
    handleBatchUrge()
    return true
  }

  if (action === 'batch-start') {
    openBatchDialog('start')
    return true
  }

  if (action === 'batch-finish') {
    openBatchDialog('finish')
    return true
  }

  if (action === 'confirm-batch') {
    confirmBatchAction()
    return true
  }

  if (action === 'close-batch-dialog') {
    state.confirmDialogType = null
    state.confirmTaskIds = []
    return true
  }

  if (action === 'task-status-start') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'IN_PROGRESS')
    return true
  }

  if (action === 'task-status-finish') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'DONE')
    return true
  }

  if (action === 'task-status-block') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'BLOCKED')
    return true
  }

  if (action === 'task-status-unblock') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'IN_PROGRESS')
    return true
  }

  if (action === 'task-status-cancel') {
    showProgressBoardToast('取消任务功能仅限管理员', 'error')
    return true
  }

  if (action === 'task-send-urge') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null

    if (!task || !task.assignedFactoryId || ['DONE', 'CANCELLED'].includes(task.status)) {
      showProgressBoardToast('当前任务不可催办', 'error')
      return true
    }

    const factory = getFactoryById(task.assignedFactoryId)
    const urgeType: UrgeType =
      task.status === 'NOT_STARTED'
        ? 'URGE_START'
        : task.status === 'BLOCKED'
          ? 'URGE_UNBLOCK'
          : 'URGE_FINISH'

    createUrge({
      urgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType: 'FACTORY',
      toId: task.assignedFactoryId,
      toName: factory?.name ?? task.assignedFactoryId,
      targetType: 'TASK',
      targetId: task.taskId,
      message: `请尽快处理任务 ${task.taskId}`,
      deepLink: {
        path: '/fcs/progress/board',
        query: { taskId: task.taskId },
      },
    })

    showProgressBoardToast('催办发送成功')
    return true
  }

  if (action === 'confirm-block') {
    confirmTaskBlock()
    return true
  }

  if (action === 'close-block-dialog') {
    state.blockDialogTaskId = null
    return true
  }

  return false
}

export function handleProgressBoardEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-progress-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.progressField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-progress-action]')
  if (!actionNode) {
    if (state.taskActionMenuId || state.orderActionMenuId) {
      state.taskActionMenuId = null
      state.orderActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.progressAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressBoardDialogOpen(): boolean {
  return Boolean(state.detailTaskId || state.detailOrderId || state.blockDialogTaskId || state.confirmDialogType)
}
