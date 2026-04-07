import { appStore } from '../../state/store.ts'
import { escapeHtml, toClassName } from '../../utils.ts'
import {
  type BlockReason,
  type ProcessTask,
  type TaskAssignmentStatus,
  type TaskAuditLog,
  type TaskStatus,
} from '../../data/fcs/process-tasks.ts'
import { stageLabels, type ProcessStage } from '../../data/fcs/process-types.ts'
import { productionOrders, type ProductionOrder } from '../../data/fcs/production-orders.ts'
import { indonesiaFactories } from '../../data/fcs/indonesia-factories.ts'
import {
  generateCaseId,
  generateNotificationId,
  generateUrgeId,
  listProgressExceptions,
  upsertProgressExceptionCase,
  initialNotifications,
  initialUrges,
  type ExceptionCase,
  type ExceptionCategory,
  type Notification,
  type ReasonCode,
  type Severity,
  type UrgeLog,
  type UrgeType,
} from '../../data/fcs/store-domain-progress.ts'
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap.ts'
import { syncPdaStartRiskAndExceptions } from '../../data/fcs/pda-start-link.ts'
import { syncMilestoneOverdueExceptions } from '../../data/fcs/pda-exec-link.ts'
import {
  buildHandoverOrderDetailLink,
  getHandoverLedgerRows,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
} from '../../data/fcs/handover-ledger-view.ts'
import {
  listMaterialRequestDraftsByOrder,
  type MaterialRequestDraft,
  type MaterialRequestRecord,
} from '../../data/fcs/material-request-drafts.ts'
import {
  listWarehouseExecutionDocsByRuntimeTaskId,
  type WarehouseExecutionDoc,
  type WarehouseIssueOrder,
} from '../../data/fcs/warehouse-material-execution.ts'
import {
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  listPdaHandoverHeads,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type PdaPickupRecord,
} from '../../data/fcs/pda-handover-events.ts'
import {
  getDefaultSubCategoryKeyFromReason,
  getUnifiedCategoryFromReason,
} from '../../data/fcs/progress-exception-taxonomy.ts'
import {
  getTaskChainTaskById,
  getTaskChainTaskDisplayName,
  getTaskChainTenderById,
  listTaskChainTasks,
  type TaskChainTender,
  resolveTaskChainTenderId,
} from '../../data/fcs/page-adapters/task-chain-pages-adapter.ts'
import { listProgressFacts, type ProgressFact } from '../../data/fcs/store-domain-progress.ts'

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

type TaskTabKey = 'basic' | 'assignment' | 'progress' | 'pickup' | 'handover' | 'block' | 'logs'

type TaskPickupStatusKey =
  | 'NOT_INVOLVED'
  | 'WAIT_REQUEST'
  | 'WAIT_PREPARE'
  | 'READY_TO_ISSUE'
  | 'WAIT_PICKUP'
  | 'RECEIVED'
  | 'DIFFERENCE'

type TaskHandoutStatusKey =
  | 'NOT_INVOLVED'
  | 'WAIT_HANDOUT'
  | 'INITIATED'
  | 'WAIT_WAREHOUSE_CONFIRM'
  | 'DISPUTE'
  | 'DONE'

type TaskSummaryTone = 'slate' | 'amber' | 'blue' | 'green' | 'red'

interface TaskPickupSummary {
  statusKey: TaskPickupStatusKey
  statusLabel: string
  tone: TaskSummaryTone
  hintText: string
  latestOccurredAt: string
  hasException: boolean
  draftRows: MaterialRequestDraft[]
  requestRows: MaterialRequestRecord[]
  executionRows: WarehouseIssueOrder[]
  pickupHeads: PdaHandoverHead[]
  pickupRecords: PdaPickupRecord[]
  canStart: boolean
  readinessLabel: string
  readinessReason: string
}

interface TaskHandoutSummary {
  statusKey: TaskHandoutStatusKey
  statusLabel: string
  tone: TaskSummaryTone
  hintText: string
  latestOccurredAt: string
  hasException: boolean
  handoutHeads: PdaHandoverHead[]
  handoutRecords: PdaHandoverRecord[]
  nextActionLabel: string
  disputeText?: string
}

interface TaskBoardSummaryCache {
  allProgressFacts: ProgressFact[] | null
  progressFactsByTaskId: Map<string, ProgressFact | undefined>
  draftRowsByTaskId: Map<string, MaterialRequestDraft[]>
  executionDocsByTaskId: Map<string, WarehouseExecutionDoc[]>
  pickupHeadsByTaskId: Map<string, PdaHandoverHead[]>
  handoutHeadsByTaskId: Map<string, PdaHandoverHead[]>
  pickupRecordsByHeadId: Map<string, PdaPickupRecord[]>
  handoutRecordsByHeadId: Map<string, PdaHandoverRecord[]>
  pickupSummariesByTaskId: Map<string, TaskPickupSummary>
  handoutSummariesByTaskId: Map<string, TaskHandoutSummary>
  allHeads: PdaHandoverHead[] | null
}

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
  handoverStatusLabel: string
  handoverNextAction: string
  handoverPendingCount: number
  handoverObjectionCount: number
  handoverLatestOccurredAt: string
  handoverFocus: string
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

function createTaskBoardSummaryCache(): TaskBoardSummaryCache {
  return {
    allProgressFacts: null,
    progressFactsByTaskId: new Map(),
    draftRowsByTaskId: new Map(),
    executionDocsByTaskId: new Map(),
    pickupHeadsByTaskId: new Map(),
    handoutHeadsByTaskId: new Map(),
    pickupRecordsByHeadId: new Map(),
    handoutRecordsByHeadId: new Map(),
    pickupSummariesByTaskId: new Map(),
    handoutSummariesByTaskId: new Map(),
    allHeads: null,
  }
}

let taskBoardSummaryCache = createTaskBoardSummaryCache()

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: '待开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '生产暂停',
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
  ALLOCATION_GATE: '当前生产暂停',
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

function getTenderById(tenderId: string): TaskChainTender | undefined {
  return getTaskChainTenderById(tenderId)
}

function listBoardTasks(): ProcessTask[] {
  return listTaskChainTasks()
}

function getTaskDisplayName(task: ProcessTask): string {
  return getTaskChainTaskDisplayName(task)
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return getTaskChainTaskById(taskId)
}

function toTimestampNumber(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function pickLatestTimestamp(values: Array<string | undefined>): string {
  return (
    values
      .filter((item): item is string => Boolean(item))
      .sort((a, b) => toTimestampNumber(b) - toTimestampNumber(a))[0] ?? ''
  )
}

function countBy<T>(rows: T[], matcher: (row: T) => boolean): number {
  return rows.filter(matcher).length
}

function getAllHandoverHeads(): PdaHandoverHead[] {
  if (!taskBoardSummaryCache.allHeads) {
    taskBoardSummaryCache.allHeads = listPdaHandoverHeads()
  }
  return taskBoardSummaryCache.allHeads
}

function getAllProgressFacts(): ProgressFact[] {
  if (!taskBoardSummaryCache.allProgressFacts) {
    taskBoardSummaryCache.allProgressFacts = listProgressFacts()
  }
  return taskBoardSummaryCache.allProgressFacts
}

function getTaskProgressFact(taskId: string): ProgressFact | undefined {
  if (!taskBoardSummaryCache.progressFactsByTaskId.has(taskId)) {
    taskBoardSummaryCache.progressFactsByTaskId.set(
      taskId,
      getAllProgressFacts().find((fact) => fact.runtimeTaskId === taskId || fact.baseTaskId === taskId),
    )
  }
  return taskBoardSummaryCache.progressFactsByTaskId.get(taskId)
}

function getTaskDraftRows(task: ProcessTask): MaterialRequestDraft[] {
  if (!taskBoardSummaryCache.draftRowsByTaskId.has(task.taskId)) {
    taskBoardSummaryCache.draftRowsByTaskId.set(
      task.taskId,
      listMaterialRequestDraftsByOrder(task.productionOrderId).filter((draft) => draft.taskId === task.taskId),
    )
  }
  return taskBoardSummaryCache.draftRowsByTaskId.get(task.taskId) ?? []
}

function getTaskExecutionDocs(taskId: string): WarehouseExecutionDoc[] {
  if (!taskBoardSummaryCache.executionDocsByTaskId.has(taskId)) {
    taskBoardSummaryCache.executionDocsByTaskId.set(taskId, listWarehouseExecutionDocsByRuntimeTaskId(taskId))
  }
  return taskBoardSummaryCache.executionDocsByTaskId.get(taskId) ?? []
}

function getTaskPickupHeads(taskId: string): PdaHandoverHead[] {
  if (!taskBoardSummaryCache.pickupHeadsByTaskId.has(taskId)) {
    taskBoardSummaryCache.pickupHeadsByTaskId.set(
      taskId,
      getAllHandoverHeads()
        .filter((head) => head.headType === 'PICKUP' && (head.runtimeTaskId === taskId || head.taskId === taskId))
        .sort(
          (a, b) =>
            toTimestampNumber(b.lastRecordAt || b.completedByWarehouseAt) -
            toTimestampNumber(a.lastRecordAt || a.completedByWarehouseAt),
        ),
    )
  }
  return taskBoardSummaryCache.pickupHeadsByTaskId.get(taskId) ?? []
}

function getTaskHandoutHeads(taskId: string): PdaHandoverHead[] {
  if (!taskBoardSummaryCache.handoutHeadsByTaskId.has(taskId)) {
    taskBoardSummaryCache.handoutHeadsByTaskId.set(
      taskId,
      getAllHandoverHeads()
        .filter((head) => head.headType === 'HANDOUT' && (head.runtimeTaskId === taskId || head.taskId === taskId))
        .sort(
          (a, b) =>
            toTimestampNumber(b.lastRecordAt || b.completedByWarehouseAt) -
            toTimestampNumber(a.lastRecordAt || a.completedByWarehouseAt),
        ),
    )
  }
  return taskBoardSummaryCache.handoutHeadsByTaskId.get(taskId) ?? []
}

function getPickupRecordsForHead(headId: string): PdaPickupRecord[] {
  if (!taskBoardSummaryCache.pickupRecordsByHeadId.has(headId)) {
    taskBoardSummaryCache.pickupRecordsByHeadId.set(headId, getPdaPickupRecordsByHead(headId))
  }
  return taskBoardSummaryCache.pickupRecordsByHeadId.get(headId) ?? []
}

function getHandoutRecordsForHead(headId: string): PdaHandoverRecord[] {
  if (!taskBoardSummaryCache.handoutRecordsByHeadId.has(headId)) {
    taskBoardSummaryCache.handoutRecordsByHeadId.set(headId, getPdaHandoverRecordsByHead(headId))
  }
  return taskBoardSummaryCache.handoutRecordsByHeadId.get(headId) ?? []
}

function getTaskPickupSummary(taskId: string): TaskPickupSummary {
  const cached = taskBoardSummaryCache.pickupSummariesByTaskId.get(taskId)
  if (cached) return cached

  const task = getTaskById(taskId)
  const fact = task ? getTaskProgressFact(task.taskId) : undefined
  const draftRows = task ? getTaskDraftRows(task) : []
  const requestRows = fact?.materialRequests ?? []
  const executionRows = getTaskExecutionDocs(taskId).filter((doc): doc is WarehouseIssueOrder => doc.docType === 'ISSUE')
  const pickupHeads = getTaskPickupHeads(taskId)
  const pickupRecords = pickupHeads.flatMap((head) => getPickupRecordsForHead(head.handoverId))
  const latestOccurredAt = pickLatestTimestamp([
    ...draftRows.map((row) => row.updatedAt),
    ...requestRows.map((row) => row.updatedAt),
    ...executionRows.map((row) => row.updatedAt),
    ...pickupHeads.map((row) => row.lastRecordAt || row.completedByWarehouseAt),
    ...pickupRecords.map(
      (row) =>
        row.finalResolvedAt ||
        row.factoryConfirmedAt ||
        row.receivedAt ||
        row.warehouseHandedAt ||
        row.submittedAt,
    ),
  ])
  const hasDifference = pickupRecords.some((record) =>
    ['OBJECTION_REPORTED', 'OBJECTION_PROCESSING', 'OBJECTION_RESOLVED'].includes(record.status),
  )
  const finalReceivedCount = countBy(
    pickupRecords,
    (record) => record.status === 'RECEIVED' || record.status === 'OBJECTION_RESOLVED',
  )
  const waitingConfirmCount = countBy(pickupRecords, (record) => record.status === 'PENDING_FACTORY_CONFIRM')
  const waitingPickupCount = countBy(pickupRecords, (record) => record.status === 'PENDING_FACTORY_PICKUP')
  const preparingCount = countBy(
    executionRows,
    (row) => row.status === 'PREPARING' || row.status === 'PARTIALLY_PREPARED',
  )
  const readyCount = countBy(
    executionRows,
    (row) => ['READY', 'ISSUED', 'IN_TRANSIT', 'RECEIVED', 'CLOSED'].includes(row.status),
  )
  const canStart = fact?.startReadiness.canStart ?? false
  const readinessLabel = canStart ? '可开工' : '暂不可开工'
  const readinessReason = fact?.startReadiness.reasonText ?? '当前任务暂无开工校验信息'

  if (!task || (!draftRows.length && !requestRows.length && !executionRows.length && !pickupHeads.length && !pickupRecords.length)) {
    const summary = {
      statusKey: 'NOT_INVOLVED',
      statusLabel: '不涉及领料',
      tone: 'slate',
      hintText: '当前任务暂无独立领料链路',
      latestOccurredAt: '',
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (hasDifference) {
    const summary = {
      statusKey: 'DIFFERENCE',
      statusLabel: '领料差异',
      tone: 'red',
      hintText: '数量不一致，待处理',
      latestOccurredAt,
      hasException: true,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (finalReceivedCount > 0 && finalReceivedCount === pickupRecords.length && pickupRecords.length > 0) {
    const summary = {
      statusKey: 'RECEIVED',
      statusLabel: '已领料',
      tone: 'green',
      hintText: `已领 ${finalReceivedCount} 张领料单`,
      latestOccurredAt,
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (!requestRows.length && draftRows.length > 0) {
    const summary = {
      statusKey: 'WAIT_REQUEST',
      statusLabel: '待生成发料单',
      tone: 'amber',
      hintText: `${draftRows.length} 张需求草稿 / 待跟单确认`,
      latestOccurredAt,
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (preparingCount > 0) {
    const summary = {
      statusKey: 'WAIT_PREPARE',
      statusLabel: '待备料',
      tone: 'amber',
      hintText: `${preparingCount} 张发料单 / 仓库备料中`,
      latestOccurredAt,
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (waitingConfirmCount > 0 || (finalReceivedCount > 0 && finalReceivedCount < pickupRecords.length)) {
    const summary = {
      statusKey: 'WAIT_PICKUP',
      statusLabel: '待领料',
      tone: 'blue',
      hintText: `${Math.max(waitingConfirmCount, pickupHeads.length || pickupRecords.length)} 张发料单 / 待工厂确认`,
      latestOccurredAt,
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (waitingPickupCount > 0 || readyCount > 0) {
    const summary = {
      statusKey: 'READY_TO_ISSUE',
      statusLabel: '已备齐待出库',
      tone: 'blue',
      hintText: '已备齐，待仓库出库',
      latestOccurredAt,
      hasException: false,
      draftRows,
      requestRows,
      executionRows,
      pickupHeads,
      pickupRecords,
      canStart,
      readinessLabel,
      readinessReason,
    }
    taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
    return summary
  }

  const summary = {
    statusKey: 'WAIT_PREPARE',
    statusLabel: '待备料',
    tone: 'amber',
    hintText: `${Math.max(requestRows.length, 1)} 张发料单 / 待仓库处理`,
    latestOccurredAt,
    hasException: false,
    draftRows,
    requestRows,
    executionRows,
    pickupHeads,
    pickupRecords,
    canStart,
    readinessLabel,
    readinessReason,
  }
  taskBoardSummaryCache.pickupSummariesByTaskId.set(taskId, summary)
  return summary
}

function getTaskHandoutSummary(taskId: string): TaskHandoutSummary {
  const cached = taskBoardSummaryCache.handoutSummariesByTaskId.get(taskId)
  if (cached) return cached

  const task = getTaskById(taskId)
  const fact = task ? getTaskProgressFact(task.taskId) : undefined
  const handoutHeads = getTaskHandoutHeads(taskId)
  const handoutRecords = handoutHeads.flatMap((head) => getHandoutRecordsForHead(head.handoverId))
  const latestOccurredAt = pickLatestTimestamp([
    ...handoutHeads.map((row) => row.lastRecordAt || row.completedByWarehouseAt),
    ...handoutRecords.map((row) => row.warehouseWrittenAt || row.factorySubmittedAt),
  ])
  const objectionRows = handoutRecords.filter((record) =>
    ['OBJECTION_REPORTED', 'OBJECTION_PROCESSING', 'OBJECTION_RESOLVED'].includes(record.status),
  )
  const completedRows = handoutRecords.filter((record) => record.status === 'WRITTEN_BACK')
  const pendingRows = handoutRecords.filter((record) => record.status === 'PENDING_WRITEBACK')
  const returnDocs = fact?.executionDocs.filter((doc) => doc.docType === 'RETURN') ?? []
  const allReturnDocsPlanned = returnDocs.length > 0 && returnDocs.every((doc) => doc.status === 'PLANNED')
  const hasSeededRecord = handoutRecords.some((record) => record.recordId.includes('SEED'))
  const disputeText =
    objectionRows[0]?.objectionReason ??
    objectionRows[0]?.objectionRemark ??
    objectionRows[0]?.resolvedRemark ??
    objectionRows[0]?.followUpRemark ??
    ''

  if (
    !task ||
    (!handoutHeads.length &&
      !handoutRecords.length &&
      (fact?.transitionToNext === 'SAME_FACTORY_CONTINUE' || fact?.transitionToNext === 'NOT_APPLICABLE'))
  ) {
    const summary = {
      statusKey: 'NOT_INVOLVED',
      statusLabel: '不涉及交出',
      tone: 'slate',
      hintText: '当前任务暂无独立交出动作',
      latestOccurredAt: '',
      hasException: false,
      handoutHeads,
      handoutRecords,
      nextActionLabel: '当前任务不涉及交出',
    }
    taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (objectionRows.length > 0 || handoutHeads.some((head) => head.summaryStatus === 'HAS_OBJECTION')) {
    const summary = {
      statusKey: 'DISPUTE',
      statusLabel: '交出异议中',
      tone: 'red',
      hintText: '数量差异待处理',
      latestOccurredAt,
      hasException: true,
      handoutHeads,
      handoutRecords,
      nextActionLabel: '先处理交出异议，再继续回写',
      disputeText,
    }
    taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (completedRows.length > 0 && completedRows.length === handoutRecords.length && handoutRecords.length > 0) {
    const summary = {
      statusKey: 'DONE',
      statusLabel: '已交出完成',
      tone: 'green',
      hintText: '已完成交出',
      latestOccurredAt,
      hasException: false,
      handoutHeads,
      handoutRecords,
      nextActionLabel: '交出已完成，无需额外处理',
    }
    taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (pendingRows.length > 0 && completedRows.length > 0) {
    const summary = {
      statusKey: 'WAIT_WAREHOUSE_CONFIRM',
      statusLabel: '待仓库确认',
      tone: 'blue',
      hintText: `${pendingRows.length} 条交出记录 / 待仓库确认`,
      latestOccurredAt,
      hasException: false,
      handoutHeads,
      handoutRecords,
      nextActionLabel: '等待仓库完成剩余回写',
    }
    taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
    return summary
  }

  if (pendingRows.length > 0 && (hasSeededRecord || !allReturnDocsPlanned)) {
    const summary = {
      statusKey: 'INITIATED',
      statusLabel: '已发起交出',
      tone: 'amber',
      hintText: `${handoutHeads.length || pendingRows.length} 张交出单 / 待仓库确认`,
      latestOccurredAt,
      hasException: false,
      handoutHeads,
      handoutRecords,
      nextActionLabel: '继续跟踪仓库回写结果',
    }
    taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
    return summary
  }

  const summary = {
    statusKey: 'WAIT_HANDOUT',
    statusLabel: '待交出',
    tone: 'amber',
    hintText: handoutHeads.length > 0 ? '已生成交出单，待工厂发起交出' : '当前任务尚未发起交出',
    latestOccurredAt,
    hasException: false,
    handoutHeads,
    handoutRecords,
    nextActionLabel: '等待工厂发起交出',
  }
  taskBoardSummaryCache.handoutSummariesByTaskId.set(taskId, summary)
  return summary
}

function resetTaskBoardSummaryCache(): void {
  taskBoardSummaryCache = createTaskBoardSummaryCache()
}

function getTaskTenderId(task: ProcessTask): string | undefined {
  return resolveTaskChainTenderId(task)
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
    return `${tasks.filter((task) => task.status === 'BLOCKED').length} 个任务生产暂停中`
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
        return '处理生产暂停任务后继续推进'
      }
      return '跟进执行进度并催办'
    case 'PENDING_QC':
      return '完成质检并已完成质量处理'
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

  const tenderId = getTaskTenderId(task)
  if (tenderId) {
    const tender = getTenderById(tenderId)
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
  const boardTasks = listBoardTasks()
  return {
    notStarted: boardTasks.filter((task) => task.status === 'NOT_STARTED').length,
    inProgress: boardTasks.filter((task) => task.status === 'IN_PROGRESS').length,
    blocked: boardTasks.filter((task) => task.status === 'BLOCKED').length,
    done: boardTasks.filter((task) => task.status === 'DONE').length,
    unassigned: boardTasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length,
    tenderOverdue: boardTasks.filter((task) => {
      const tenderId = getTaskTenderId(task)
      if (!tenderId) return false
      const tender = getTenderById(tenderId)
      return tender?.status === 'OVERDUE'
    }).length,
  }
}

function getPoViewRows(): PoViewRow[] {
  const handoverRows = getHandoverLedgerRows()
  const boardTasks = listBoardTasks()
  const orderIds = [...new Set(boardTasks.map((task) => task.productionOrderId))]

  return orderIds.map((orderId) => {
    const tasks = boardTasks.filter((task) => task.productionOrderId === orderId)
    const order = getOrderById(orderId)
    const handoverSummary = getProductionOrderHandoverSummary(orderId, handoverRows)
    const mainFactoryId = order?.mainFactoryId ?? tasks.find((task) => task.assignedFactoryId)?.assignedFactoryId
    const mainFactory = mainFactoryId ? getFactoryById(mainFactoryId)?.name ?? mainFactoryId : '未指定'
    const lifecycle = deriveLifecycle(tasks, order)

    const risks: string[] = []
    if (tasks.some((task) => task.status === 'BLOCKED')) risks.push('有生产暂停')
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
      handoverStatusLabel: handoverSummary.currentBottleneckLabel,
      handoverNextAction: handoverSummary.primaryActionHint,
      handoverPendingCount: handoverSummary.pendingCount,
      handoverObjectionCount: handoverSummary.objectionCount,
      handoverLatestOccurredAt: handoverSummary.latestOccurredAt,
      handoverFocus: handoverSummary.recommendedFocus || '',
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

  return listBoardTasks().filter((task) => {
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
  const factoryIds = [...new Set(listBoardTasks().filter((task) => task.assignedFactoryId).map((task) => task.assignedFactoryId as string))]
  return factoryIds.map((id) => ({ id, name: getFactoryById(id)?.name ?? id }))
}

function getExceptionsByTaskId(taskId: string): ExceptionCase[] {
  return listProgressExceptions().filter((item) => item.relatedTaskIds.includes(taskId))
}

function nextUrgeAuditLogId(urgeId: string, index: number): string {
  return `UAL-${urgeId}-${String(index).padStart(3, '0')}`
}

function nextExceptionAuditLogId(exception: ExceptionCase): string {
  return `EAL-${exception.caseId}-${String(exception.auditLogs.length + 1).padStart(3, '0')}`
}

function nextTaskAuditLogId(task: ProcessTask): string {
  return `AL-${task.taskId}-${String(task.auditLogs.length + 1).padStart(3, '0')}`
}

function nextOrderAuditLogId(order: ProductionOrder): string {
  return `AL-ORDER-${order.productionOrderId}-${String(order.auditLogs.length + 1).padStart(3, '0')}`
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

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

export {
  appStore,
  escapeHtml,
  toClassName,
  state,
  TASK_STATUS_LABEL,
  ASSIGNMENT_STATUS_LABEL,
  STATUS_COLOR_CLASS,
  ASSIGNMENT_STATUS_COLOR_CLASS,
  LIFECYCLE_LABEL,
  LIFECYCLE_COLOR_CLASS,
  LIFECYCLE_ICON,
  TASK_RISK_LABEL,
  BLOCK_REASON_LABEL,
  BLOCK_REASON_OPTIONS,
  stageLabels,
  productionOrders,
  indonesiaFactories,
  generateCaseId,
  generateNotificationId,
  generateUrgeId,
  listProgressExceptions,
  upsertProgressExceptionCase,
  initialNotifications,
  initialUrges,
  syncPdaStartRiskAndExceptions,
  syncMilestoneOverdueExceptions,
  buildHandoverOrderDetailLink,
  getHandoverLedgerRows,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
  getDefaultSubCategoryKeyFromReason,
  getUnifiedCategoryFromReason,
  getTaskChainTaskById,
  getTaskChainTaskDisplayName,
  getTaskChainTenderById,
  listTaskChainTasks,
  resolveTaskChainTenderId,
  nowTimestamp,
  getCurrentQueryString,
  getCurrentSearchParams,
  getOrderById,
  getFactoryById,
  getTenderById,
  listBoardTasks,
  getTaskDisplayName,
  getTaskById,
  resetTaskBoardSummaryCache,
  getTaskPickupSummary,
  getTaskHandoutSummary,
  getTaskProgressFact,
  getTaskTenderId,
  getTaskDependencies,
  getOrderSpuCode,
  getOrderSpuName,
  getOrderQty,
  parseDateTime,
  deriveBlockpoint,
  deriveNextAction,
  deriveLifecycle,
  getTaskRisks,
  getTaskKpiStats,
  getPoViewRows,
  getPoKpiStats,
  getFilteredPoRows,
  getPoKanbanGroups,
  getFilteredTasks,
  getTaskKanbanGroups,
  getUniqueFactories,
  getExceptionsByTaskId,
  nextUrgeAuditLogId,
  nextExceptionAuditLogId,
  nextTaskAuditLogId,
  nextOrderAuditLogId,
  syncPresetFromQuery,
  escapeAttr,
  renderBadge,
}

export type {
  TaskRiskFlag,
  PoLifecycle,
  TaskTabKey,
  PoViewRow,
  ProgressBoardState,
  TaskPickupSummary,
  TaskHandoutSummary,
  TaskSummaryTone,
  BlockReason,
  ProcessTask,
  TaskAssignmentStatus,
  TaskAuditLog,
  TaskStatus,
  ProcessStage,
  ProductionOrder,
  ExceptionCase,
  ExceptionCategory,
  Notification,
  ReasonCode,
  Severity,
  UrgeLog,
  UrgeType,
  TaskChainTender,
}
