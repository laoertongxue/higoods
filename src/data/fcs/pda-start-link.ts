import { processTasks, type ProcessTask } from './process-tasks'
import {
  getMilestoneConfigForTask,
  getMilestoneProofRequirementLabel,
  type MilestoneProofRequirement,
} from './milestone-configs'
import {
  generateCaseId,
  listProgressExceptions,
  upsertProgressExceptionCase,
  type ExceptionCase,
} from './store-domain-progress.ts'
import {
  applyPendingDispatchAutoAcceptance,
  getRuntimeTaskById,
  isRuntimeTaskExecutionTask,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from './runtime-process-tasks'
import {
  getPdaPickupHeads,
  getPdaPickupRecordsByHead,
} from './pda-handover-events'
import {
  listWarehouseInternalTransferOrdersByRuntimeTaskId,
  listWarehouseIssueOrdersByRuntimeTaskId,
  listWarehouseReturnOrdersByRuntimeTaskId,
} from './warehouse-material-execution'
import {
  getDefaultSubCategoryKeyFromReason,
  getUnifiedCategoryFromReason,
} from './progress-exception-taxonomy'
import {
  markCaseResolved,
  maybeAutoCloseResolvedCase,
} from './progress-exception-lifecycle'
import {
  isCuttingSpecialTask,
  listPdaCuttingExecutionRowsByTaskId,
} from './pda-cutting-execution-source.ts'
import { getPostFinishingTaskById } from './post-finishing-domain.ts'
import { listSpecialCraftTaskOrders } from './special-craft-task-orders.ts'
import {
  getDyeWorkOrderByTaskId,
  getDyeWorkOrderStatusLabel,
  type DyeWorkOrder,
} from './dyeing-task-domain.ts'
import {
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderStatusLabel,
  type PrintWorkOrder,
} from './printing-task-domain.ts'

export type StartDueSource = 'ACCEPTED' | 'AWARDED'
export type StartRiskStatus = 'NORMAL' | 'DUE_SOON' | 'OVERDUE'

const DEFAULT_START_DUE_HOURS = 48
const SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000

export interface TaskStartRuleState {
  required: boolean
  dueHours: number
  proofRequirement: MilestoneProofRequirement
  proofRequirementLabel: string
  ruleLabel: string
}

export interface StartPrerequisiteInfo {
  met: boolean
  type: 'PICKUP'
  conditionLabel: string
  summaryLabel: string
  statusLabel: string
  blocker: string
  hint: string
}

type RuntimeStartReadiness =
  | 'READY'
  | 'WAIT_PICKUP'
  | 'WAIT_PREV_DONE'
  | 'WAIT_INTERNAL_TRANSFER'
  | 'NO_RUNTIME_TASK'

function isCuttingReceiveReady(status: string): boolean {
  return [
    '来料已入仓',
    '已领料入仓',
    '来料已入待加工仓',
    '已入待加工仓',
    '已回执',
    '已领取',
  ].some((label) => status.includes(label))
}

function getCuttingStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo | null {
  if (!isCuttingSpecialTask(task)) return null

  const executionRows = listPdaCuttingExecutionRowsByTaskId(task.taskId)
  const cutOrderCount = new Set(executionRows.map((row) => row.cutOrderNo).filter(Boolean)).size
  if (!executionRows.length) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '已生成铺布单',
      summaryLabel: '暂无铺布单',
      statusLabel: '暂无铺布单，暂不可开工',
      blocker: '暂无铺布单，暂不可开工',
      hint: '请先检查铺布单是否已生成，并确认已绑定裁片单',
    }
  }

  const unboundRow = executionRows.find((row) => row.bindingState === 'UNBOUND')
  if (unboundRow) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '铺布单已绑定裁片单',
      summaryLabel: '待绑定裁片单',
      statusLabel: '存在未绑定铺布单，暂不可开工',
      blocker: '存在未绑定铺布单，暂不可开工',
      hint: `${unboundRow.executionOrderNo} 需要先绑定裁片单，再判断来料和开工前置`,
    }
  }

  const waitingReceiveRow = executionRows.find((row) => !isCuttingReceiveReady(row.currentReceiveStatus))
  if (waitingReceiveRow) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '裁床已领料入待加工仓',
      summaryLabel: waitingReceiveRow.currentReceiveStatus || '待裁床领料',
      statusLabel: '裁床领料未完成，暂不可开工',
      blocker: '裁床领料未完成，暂不可开工',
      hint: `${waitingReceiveRow.executionOrderNo} 需要先在交接模块完成领料入仓确认`,
    }
  }

  return {
    met: true,
    type: 'PICKUP',
    conditionLabel: '铺布单与来料已满足',
    summaryLabel: '前置已满足',
    statusLabel: '已满足开工前置，可开工',
    blocker: '已满足开工前置',
    hint:
      executionRows.length > 1
        ? `已覆盖 ${cutOrderCount} 张裁片单、${executionRows.length} 张铺布单，来料均已入仓，可开工后按唛架方案执行`
        : '铺布单已生成，来料已入仓，可开工后按唛架方案执行',
  }
}

function getPostFinishingStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo | null {
  const postTask = getPostFinishingTaskById(task.taskId)
  if (!postTask) return null

  if (postTask.currentStatus === '待上游交出') {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '上游交出记录已到位',
      summaryLabel: '待上游交出',
      statusLabel: '等待上游交出，暂不可开工',
      blocker: '等待上游交出，暂不可开工',
      hint: '请先由上游工厂发起交出，后道工厂收货后再开工',
    }
  }

  if (postTask.currentStatus === '待收货' || postTask.receivedQty <= 0) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '后道收货已入仓',
      summaryLabel: '待收货',
      statusLabel: '后道收货未完成，暂不可开工',
      blocker: '后道收货未完成，暂不可开工',
      hint: '请先在交接或仓管模块完成扫码收货，生成后道待加工库存',
    }
  }

  return {
    met: true,
    type: 'PICKUP',
    conditionLabel: '后道收货与任务已满足',
    summaryLabel: '前置已满足',
    statusLabel: '已满足开工前置，可开工',
    blocker: '已满足开工前置',
    hint: `后道已收货 ${postTask.receivedQty.toLocaleString('zh-CN')} 件，可开工后按当前节点执行${postTask.currentNode}`,
  }
}

function getSpecialCraftTaskForStart(task: ProcessTask) {
  return listSpecialCraftTaskOrders().find((taskOrder) =>
    taskOrder.taskOrderId === task.taskId ||
    taskOrder.taskOrderNo === task.taskNo ||
    taskOrder.sourceTaskId === task.taskId ||
    taskOrder.sourceTaskNo === task.taskNo,
  )
}

function getSpecialCraftStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo | null {
  const specialCraftTask = getSpecialCraftTaskForStart(task)
  if (!specialCraftTask) return null

  if (specialCraftTask.assignmentStatus !== 'ASSIGNED') {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '特殊工艺加工单已分配',
      summaryLabel: '待分配',
      statusLabel: '特殊工艺加工单未分配，暂不可开工',
      blocker: '特殊工艺加工单未分配，暂不可开工',
      hint: '该特殊工艺加工单尚未进入工厂执行链路，不应出现在 PDA 执行列表',
    }
  }

  const hasReceived =
    specialCraftTask.receivedQty > 0 ||
    Boolean(specialCraftTask.waitProcessStockItemIds?.length) ||
    ['IN_WAIT_PROCESS_WAREHOUSE', 'PROCESSING', 'COMPLETED', 'WAIT_HANDOVER', 'HANDED_OVER', 'WRITTEN_BACK'].includes(
      specialCraftTask.executionStatus || '',
    )

  if (!hasReceived) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '特殊工艺领料已入仓',
      summaryLabel: '领料记录待补',
      statusLabel: '特殊工艺领料未完成，暂不可开工',
      blocker: '特殊工艺领料未完成，暂不可开工',
      hint: '请先在交接模块完成领料入仓，再开始特殊工艺加工',
    }
  }

  return {
    met: true,
    type: 'PICKUP',
    conditionLabel: '特殊工艺领料已满足',
    summaryLabel: '前置已满足',
    statusLabel: '已满足开工前置，可开工',
    blocker: '已满足开工前置',
    hint: `${specialCraftTask.operationName} 领料已入待加工仓，可开工执行`,
  }
}

function getPrintStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo | null {
  const order = getPrintWorkOrderByTaskId(task.taskId)
  if (!order) return null

  const statusLabel = getPrintWorkOrderStatusLabel(order.status)
  const preparationHintMap: Partial<Record<PrintWorkOrder["status"], string>> = {
    WAIT_ARTWORK: `印花加工单  可先开工做花型资料核对和试印准备；实际开始印花前必须确认领料到位`,
    WAIT_COLOR_TEST: `印花加工单  可先开工做调色测试和花型试印；实际开始印花前必须确认领料到位`,
  }

  return {
    met: true,
    type: "PICKUP",
    conditionLabel: "印花加工单已接单，可先开工准备",
    summaryLabel: statusLabel,
    statusLabel: "可先开工准备，实际开始印花前需确认领料到位",
    blocker: "已满足开工前置",
    hint:
      preparationHintMap[order.status] ||
      `印花加工单  已同步到 PDA，可先开工准备；实际开始印花前必须确认领料到位`,
  }
}

function getDyeStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo | null {
  const order = getDyeWorkOrderByTaskId(task.taskId)
  if (!order) return null

  const statusLabel = getDyeWorkOrderStatusLabel(order.status)
  const preparationHintMap: Partial<Record<DyeWorkOrder["status"], string>> = {
    WAIT_SAMPLE: `染色加工单  可先开工做调色、工艺准备；实际开始染色前必须确认坯布和染化料到位`,
    SAMPLE_TESTING: `染色加工单  可继续打样、调色和工艺准备；实际开始染色前必须确认坯布和染化料到位`,
    WAIT_MATERIAL: `染色加工单  可先开工做调色、排缸准备；实际开始染色前必须确认坯布和染化料到位`,
  }

  return {
    met: true,
    type: "PICKUP",
    conditionLabel: "染色加工单已接单，可先开工准备",
    summaryLabel: statusLabel,
    statusLabel: "可先开工准备，实际开始染色前需确认坯布和染化料到位",
    blocker: "已满足开工前置",
    hint:
      preparationHintMap[order.status] ||
      `染色加工单  已同步到 PDA，可先开工准备；实际开始染色前必须确认坯布和染化料到位`,
  }
}

export function getStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo {
  if (task.startedAt || task.status === 'IN_PROGRESS' || task.status === 'DONE') {
    return {
      met: true,
      type: 'PICKUP',
      conditionLabel: '已进入执行',
      summaryLabel: '已开工',
      statusLabel: '已满足开工前置',
      blocker: '已满足开工前置',
      hint: `${task.processNameZh || '当前任务'}已进入执行状态，无需重复判断开工前置`,
    }
  }

  const cuttingPrerequisite = getCuttingStartPrerequisite(task)
  if (cuttingPrerequisite) return cuttingPrerequisite

  const postPrerequisite = getPostFinishingStartPrerequisite(task)
  if (postPrerequisite) return postPrerequisite

  const specialCraftPrerequisite = getSpecialCraftStartPrerequisite(task)
  if (specialCraftPrerequisite) return specialCraftPrerequisite

  const printPrerequisite = getPrintStartPrerequisite(task)
  if (printPrerequisite) return printPrerequisite

  const dyePrerequisite = getDyeStartPrerequisite(task)
  if (dyePrerequisite) return dyePrerequisite

  const mockTask = task as ProcessTask & { mockStartPrerequisiteMet?: boolean; mockReceiveSummary?: string }
  if (mockTask.mockStartPrerequisiteMet === true) {
    return {
      met: true,
      type: 'PICKUP',
      conditionLabel: '前置资料已满足',
      summaryLabel: '前置已满足',
      statusLabel: '已满足开工前置，可开工',
      blocker: '已满足开工前置',
      hint: mockTask.mockReceiveSummary || '当前 mock 任务已预置前置条件，可直接开工',
    }
  }

  const runtimeTasks = listRuntimeTasksByBaseTaskId(task.taskId).filter((runtimeTask) =>
    isRuntimeTaskExecutionTask(runtimeTask),
  )
  if (!runtimeTasks.length) {
    const processName = task.processNameZh || '当前工序'
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '任务已自动接单',
      summaryLabel: '待来料/执行明细',
      statusLabel: '待来料或执行明细同步，暂不可开工',
      blocker: '待来料或执行明细同步，暂不可开工',
      hint: `${processName}任务已进入 PDA，等待上游来料或执行明细同步后开工`,
    }
  }

  const readinessList = runtimeTasks.map((runtimeTask) => evaluateRuntimeStartReadiness(runtimeTask))
  const blocked = readinessList.find((item) => item.code !== 'READY')
  const met = !blocked
  const hasWarehouseWorkshop = runtimeTasks.some((runtimeTask) => runtimeTask.executorKind === 'WAREHOUSE_WORKSHOP')
  const hasSameFactoryContinue = runtimeTasks.some(
    (runtimeTask) => runtimeTask.transitionFromPrev === 'SAME_FACTORY_CONTINUE',
  )
  const conditionLabel = hasWarehouseWorkshop
    ? '仓内流转已到位'
    : hasSameFactoryContinue
      ? '上一工序连续流转已完成'
      : '已有领料记录'

  const statusLabel = met
    ? '已满足开工前置，可开工'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '上一工序未完成连续流转，暂不可开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '仓内流转尚未就绪，暂不可开工'
        : '尚无领料记录，暂不可开工'

  const blocker = met
    ? '已满足开工前置'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '上一工序未完成连续流转，暂不可开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '仓内流转尚未就绪，暂不可开工'
        : '尚无领料记录，暂不可开工'

  const hint = met
    ? '已满足开工前置，工厂可开始本工序'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '同厂连续工序无需重复领料，待上一工序完成后可直接开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '当前工序由仓内后道执行，需等待仓内流转到位后开工'
        : '外部工厂需先完成仓库发料领料后才能开工'

  const summaryLabel = met ? '前置已满足' : blocked?.label ?? '前置未满足'

  return {
    met,
    type: 'PICKUP',
    conditionLabel,
    summaryLabel,
    statusLabel,
    blocker,
    hint,
  }
}

export function getStartPrerequisiteByTaskId(taskId: string): StartPrerequisiteInfo | null {
  const task = processTasks.find((item) => item.taskId === taskId || item.taskNo === taskId)
  return task ? getStartPrerequisite(task) : null
}

function normalizeDueHours(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_START_DUE_HOURS
  return Math.max(1, Math.floor(value))
}

function parseDateMs(value?: string): number {
  if (!value) return Date.now()
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized).getTime()
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function addHours(value: string, hours: number): string {
  const date = new Date(parseDateMs(value) + normalizeDueHours(hours) * 60 * 60 * 1000)
  return nowTimestamp(date)
}

export function getTaskStartRuleState(task: ProcessTask): TaskStartRuleState {
  const config = getMilestoneConfigForTask(task)
  const dueHours = normalizeDueHours(config?.startDueHours)
  const proofRequirement = config?.startProofRequirement || 'NONE'
  const required = config?.startRequired ?? true

  return {
    required,
    dueHours,
    proofRequirement,
    proofRequirementLabel: getMilestoneProofRequirementLabel(proofRequirement),
    ruleLabel: required ? `要求开工，${dueHours} 小时内确认` : '不要求开工',
  }
}

function evaluateRuntimeStartReadiness(task: RuntimeProcessTask): { code: RuntimeStartReadiness; label: string } {
  if (task.executorKind === 'WAREHOUSE_WORKSHOP') {
    const transferDocs = listWarehouseInternalTransferOrdersByRuntimeTaskId(task.taskId)
    const hasReadyTransfer = transferDocs.some((doc) =>
      doc.status === 'RECEIVED' ||
      doc.status === 'CLOSED' ||
      doc.status === 'IN_TRANSIT' ||
      doc.lines.some((line) => line.transferredQty > 0),
    )
    return hasReadyTransfer
      ? { code: 'READY', label: '仓内流转已到位' }
      : { code: 'WAIT_INTERNAL_TRANSFER', label: '待仓内流转' }
  }

  if (task.transitionFromPrev === 'SAME_FACTORY_CONTINUE') {
    const upstreamDone = task.dependsOnTaskIds.every((upstreamTaskId) => {
      const upstreamTask = getRuntimeTaskById(upstreamTaskId)
      if (!upstreamTask) return false
      if (upstreamTask.status === 'DONE') return true
      return listWarehouseReturnOrdersByRuntimeTaskId(upstreamTask.taskId).some(
        (doc) => doc.status === 'RETURNED' || doc.status === 'CLOSED',
      )
    })
    return upstreamDone
      ? { code: 'READY', label: '同厂连续流转已就绪' }
      : { code: 'WAIT_PREV_DONE', label: '待上一工序完成' }
  }

  const issueDocs = listWarehouseIssueOrdersByRuntimeTaskId(task.taskId)
  if (!issueDocs.length) {
    return { code: 'NO_RUNTIME_TASK', label: '待仓库发料单生成' }
  }

  const pickupHeads = getPdaPickupHeads().filter((head) => head.runtimeTaskId === task.taskId)
  const hasReadyPickup = pickupHeads.some((head) => {
    if (head.summaryStatus === 'WRITTEN_BACK' || head.completionStatus === 'COMPLETED') return true
    const records = getPdaPickupRecordsByHead(head.handoverId)
    return records.some((record) => record.status === 'RECEIVED')
  })

  return hasReadyPickup ? { code: 'READY', label: '领料记录已满足' } : { code: 'WAIT_PICKUP', label: '领料记录待补' }
}

export function getStartDueBase(task: ProcessTask): { baseAt?: string; source?: StartDueSource } {
  if (task.assignmentMode === 'BIDDING') {
    const awardedAt = (task as ProcessTask & { awardedAt?: string }).awardedAt
    if (awardedAt) {
      return { baseAt: awardedAt, source: 'AWARDED' }
    }
  }

  if (task.acceptedAt) {
    return { baseAt: task.acceptedAt, source: 'ACCEPTED' }
  }

  return {}
}

export function getTaskStartDueInfo(task: ProcessTask, nowMs: number = Date.now()): {
  startDueAt?: string
  startDueSource?: StartDueSource
  startRiskStatus: StartRiskStatus
  remainingMs?: number
  prerequisiteMet: boolean
} {
  const startRule = getTaskStartRuleState(task)
  const prerequisite = getStartPrerequisite(task)
  const { baseAt, source } = getStartDueBase(task)

  if (!startRule.required || !baseAt || !source) {
    return {
      startRiskStatus: 'NORMAL',
      prerequisiteMet: prerequisite.met,
    }
  }

  const startDueAt = addHours(baseAt, startRule.dueHours)
  const dueMs = parseDateMs(startDueAt)
  const remainingMs = dueMs - nowMs

  let startRiskStatus: StartRiskStatus = 'NORMAL'
  const isNotStarted = task.status === 'NOT_STARTED' && !task.startedAt

  if (isNotStarted && prerequisite.met) {
    if (remainingMs < 0) {
      startRiskStatus = 'OVERDUE'
    } else if (remainingMs < SOON_THRESHOLD_MS) {
      startRiskStatus = 'DUE_SOON'
    }
  }

  return {
    startDueAt,
    startDueSource: source,
    startRiskStatus,
    remainingMs,
    prerequisiteMet: prerequisite.met,
  }
}

function isOpenStartOverdueException(exceptionCase: ExceptionCase): boolean {
  return (
    exceptionCase.reasonCode === 'START_OVERDUE' &&
    (exceptionCase.caseStatus === 'OPEN' || exceptionCase.caseStatus === 'IN_PROGRESS')
  )
}

function findTaskOpenStartOverdueException(taskId: string): ExceptionCase | undefined {
  return listProgressExceptions().find(
    (item) => isOpenStartOverdueException(item) && item.relatedTaskIds.includes(taskId),
  )
}

function createStartOverdueException(task: ProcessTask, startDueAt: string, now: string): ExceptionCase {
  const reasonCode = 'START_OVERDUE'
  const exceptionCase: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'EXECUTION',
    unifiedCategory: getUnifiedCategoryFromReason(reasonCode, 'EXECUTION'),
    subCategoryKey: getDefaultSubCategoryKeyFromReason(reasonCode) || 'EXEC_START_OVERDUE',
    reasonCode,
    sourceType: 'TASK',
    sourceId: task.taskId,
    relatedOrderIds: [task.productionOrderId],
    relatedTaskIds: [task.taskId],
    relatedTenderIds: task.tenderId ? [task.tenderId] : [],
    ownerUserId: undefined,
    ownerUserName: undefined,
    summary: '开工已逾期',
    detail: `任务 ${task.taskId} 在 ${startDueAt} 前未确认开工，系统自动生成执行异常。`,
    createdAt: now,
    updatedAt: now,
    tags: ['执行异常', '开工逾期', 'PDA执行'],
    actions: [],
    auditLogs: [
      {
        id: `EAL-START-${task.taskId.replace(/[^A-Za-z0-9]/g, '').slice(-24)}-CREATE`,
        action: 'CREATE',
        detail: '系统自动生成：开工逾期',
        at: now,
        by: '系统',
      },
    ],
  }

  upsertProgressExceptionCase(exceptionCase)
  return exceptionCase
}

function replaceException(updated: ExceptionCase): void {
  upsertProgressExceptionCase(updated)
}

function resolveStartOverdueException(exceptionCase: ExceptionCase, now: string): void {
  const resolved = markCaseResolved(exceptionCase, {
    by: '系统',
    source: 'SYSTEM',
    ruleCode: 'EXEC_START_CONFIRMED',
    detail: '工厂已确认开工，系统自动判定为已解决',
    at: now,
    actionType: 'AUTO_RESOLVE',
    auditAction: 'AUTO_RESOLVE',
  })
  replaceException(maybeAutoCloseResolvedCase(resolved, '系统'))
}

export function syncPdaStartRiskAndExceptions(now: Date = new Date()): void {
  applyPendingDispatchAutoAcceptance(nowTimestamp(now))
  const nowMs = now.getTime()
  const nowAt = nowTimestamp(now)

  processTasks.forEach((task) => {
    if (!task.taskId.startsWith('PDA-EXEC-')) return

    const dueInfo = getTaskStartDueInfo(task, nowMs)
    const writableTask = task as ProcessTask & {
      awardedAt?: string
      startDueAt?: string
      startDueSource?: StartDueSource
      startRiskStatus?: StartRiskStatus
      startOverdueExceptionId?: string | null
    }

    writableTask.startDueAt = dueInfo.startDueAt
    writableTask.startDueSource = dueInfo.startDueSource
    writableTask.startRiskStatus = dueInfo.startRiskStatus

    const started = task.status !== 'NOT_STARTED' || Boolean(task.startedAt)
    const existedOpen = findTaskOpenStartOverdueException(task.taskId)

    if (!started && dueInfo.startRiskStatus === 'OVERDUE' && dueInfo.startDueAt) {
      if (existedOpen) {
        writableTask.startOverdueExceptionId = existedOpen.caseId
      } else {
        const created = createStartOverdueException(task, dueInfo.startDueAt, nowAt)
        writableTask.startOverdueExceptionId = created.caseId
      }
      return
    }

    if (started && existedOpen) {
      resolveStartOverdueException(existedOpen, nowAt)
    }

    if (started || dueInfo.startRiskStatus !== 'OVERDUE') {
      writableTask.startOverdueExceptionId = null
    }
  })
}

export function formatRemainingHours(remainingMs: number): string {
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000))
  return String(Math.max(hours, 0))
}

export function formatStartDueSourceText(source?: StartDueSource, dueHours = DEFAULT_START_DUE_HOURS): string {
  const safeDueHours = normalizeDueHours(dueHours)
  if (source === 'AWARDED') {
    return `中标后 ${safeDueHours} 小时内开工`
  }
  if (source === 'ACCEPTED') {
    return `接单后 ${safeDueHours} 小时内开工`
  }
  return '待接单/中标后开始计算'
}
