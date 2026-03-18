import {
  processTasks,
  type BlockReason,
  type ExecProofFile,
  type MilestoneStatus,
  type PauseReasonCode,
  type PauseStatus,
  type ProcessTask,
} from './process-tasks'
import {
  buildMilestoneRuleLabel,
  getMilestoneConfigByProcess,
  getMilestoneProofRequirementLabel,
  getMilestoneTargetUnitByRuleType,
  getMilestoneTargetUnitLabel,
  type MilestoneExceptionSeverity,
  type MilestoneProofRequirement,
  type MilestoneRuleType,
  type MilestoneTargetUnit,
} from './milestone-configs'
import {
  generateCaseId,
  initialExceptions,
  type ExceptionCase,
  type ReasonCode,
  type Severity,
} from './store-domain-progress'
import {
  getDefaultSubCategoryKeyFromReason,
  getUnifiedCategoryFromReason,
} from './progress-exception-taxonomy'
import {
  markCaseResolved,
  maybeAutoCloseResolvedCase,
} from './progress-exception-lifecycle'

export interface TaskMilestoneState {
  required: boolean
  ruleType: MilestoneRuleType
  ruleLabel: string
  targetQty: number
  targetUnit: MilestoneTargetUnit
  targetUnitLabel: string
  proofRequirement: MilestoneProofRequirement
  proofRequirementLabel: string
  overdueExceptionEnabled: boolean
  overdueHours: number
  exceptionSeverity: MilestoneExceptionSeverity
  status: MilestoneStatus
  reportedAt: string | null
  reportedQty: number | null
  proofFiles: ExecProofFile[]
}

export interface PauseReasonOption {
  code: PauseReasonCode
  label: string
}

export const PAUSE_REASON_OPTIONS: PauseReasonOption[] = [
  { code: 'CUTTING_ISSUE', label: '裁片问题' },
  { code: 'MATERIAL_ISSUE', label: '物料问题' },
  { code: 'TECH_DOC_ISSUE', label: '工艺资料问题' },
  { code: 'EQUIPMENT_ISSUE', label: '设备异常' },
  { code: 'STAFF_ISSUE', label: '人员异常' },
  { code: 'OTHER', label: '其他' },
]

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function mapPauseReasonToBlockReason(reasonCode: PauseReasonCode): BlockReason {
  if (reasonCode === 'MATERIAL_ISSUE') return 'MATERIAL'
  if (reasonCode === 'TECH_DOC_ISSUE') return 'TECH'
  if (reasonCode === 'EQUIPMENT_ISSUE') return 'EQUIPMENT'
  if (reasonCode === 'STAFF_ISSUE') return 'CAPACITY'
  if (reasonCode === 'CUTTING_ISSUE') return 'QUALITY'
  return 'OTHER'
}

function mapPauseReasonToExceptionReason(reasonCode: PauseReasonCode): ReasonCode {
  if (reasonCode === 'MATERIAL_ISSUE') return 'BLOCKED_MATERIAL'
  if (reasonCode === 'TECH_DOC_ISSUE') return 'BLOCKED_TECH'
  if (reasonCode === 'EQUIPMENT_ISSUE') return 'BLOCKED_EQUIPMENT'
  if (reasonCode === 'STAFF_ISSUE') return 'BLOCKED_CAPACITY'
  if (reasonCode === 'CUTTING_ISSUE') return 'BLOCKED_QUALITY'
  return 'BLOCKED_OTHER'
}

function getPauseReasonLabel(reasonCode: PauseReasonCode): string {
  return PAUSE_REASON_OPTIONS.find((item) => item.code === reasonCode)?.label || '其他'
}

function normalizeMilestoneRuleType(raw?: string): MilestoneRuleType {
  return raw === 'AFTER_N_YARD' ? 'AFTER_N_YARD' : 'AFTER_N_PIECES'
}

function normalizeMilestoneTargetUnit(raw: string | undefined, ruleType: MilestoneRuleType): MilestoneTargetUnit {
  if (raw === 'YARD' || raw === 'PIECE') return raw
  return getMilestoneTargetUnitByRuleType(ruleType)
}

function ensureMilestoneDefaults(task: ProcessTask): TaskMilestoneState {
  const config = getMilestoneConfigByProcess(task.processCode, task.processNameZh)
  const ruleType = normalizeMilestoneRuleType(task.milestoneRuleType || config?.ruleType)
  const targetUnit = normalizeMilestoneTargetUnit(task.milestoneTargetUnit, ruleType)
  const targetUnitLabel = getMilestoneTargetUnitLabel(targetUnit)
  const impliedRequired = task.milestoneRequired ?? Boolean(config?.enabled)
  const proofRequirement = task.milestoneProofRequirement || config?.proofRequirement || 'NONE'
  const overdueExceptionEnabled =
    task.milestoneOverdueExceptionEnabled ??
    Boolean(config?.enabled && config?.overdueExceptionEnabled)
  const overdueHours = task.milestoneOverdueHours || config?.overdueHours || 48
  const exceptionSeverity = task.milestoneExceptionSeverity || config?.exceptionSeverity || 'S2'

  if (!impliedRequired) {
    return {
      required: false,
      ruleType,
      ruleLabel:
        task.milestoneRuleLabel ||
        (task.milestoneTargetQty || config?.targetQty
          ? buildMilestoneRuleLabel(ruleType, task.milestoneTargetQty || config?.targetQty || 1, targetUnit)
          : ''),
      targetQty: task.milestoneTargetQty || config?.targetQty || 0,
      targetUnit,
      targetUnitLabel,
      proofRequirement,
      proofRequirementLabel: getMilestoneProofRequirementLabel(proofRequirement),
      overdueExceptionEnabled,
      overdueHours,
      exceptionSeverity,
      status: 'PENDING',
      reportedAt: null,
      reportedQty: null,
      proofFiles: [],
    }
  }

  const targetQty = task.milestoneTargetQty || config?.targetQty || 5
  const ruleLabel =
    task.milestoneRuleLabel || config?.ruleLabel || buildMilestoneRuleLabel(ruleType, targetQty, targetUnit)
  const status: MilestoneStatus =
    task.milestoneStatus || (task.milestoneReportedAt ? 'REPORTED' : 'PENDING')

  return {
    required: true,
    ruleType,
    ruleLabel,
    targetQty,
    targetUnit,
    targetUnitLabel,
    proofRequirement,
    proofRequirementLabel: getMilestoneProofRequirementLabel(proofRequirement),
    overdueExceptionEnabled,
    overdueHours,
    exceptionSeverity,
    status,
    reportedAt: task.milestoneReportedAt || null,
    reportedQty: task.milestoneReportedQty ?? null,
    proofFiles: task.milestoneProofFiles ? [...task.milestoneProofFiles] : [],
  }
}

export function getTaskMilestoneState(task: ProcessTask): TaskMilestoneState {
  return ensureMilestoneDefaults(task)
}

export function isTaskMilestoneRequired(task: ProcessTask): boolean {
  return ensureMilestoneDefaults(task).required
}

export function isTaskMilestoneReported(task: ProcessTask): boolean {
  const milestone = ensureMilestoneDefaults(task)
  return milestone.required ? milestone.status === 'REPORTED' : true
}

export function getTaskMilestoneWarningText(task: ProcessTask): string {
  const milestone = ensureMilestoneDefaults(task)
  if (!milestone.required || milestone.status === 'REPORTED') return ''
  return milestone.ruleLabel
}

export function getTaskMilestoneProofHint(task: ProcessTask): string {
  const milestone = ensureMilestoneDefaults(task)
  return `当前要求：${milestone.ruleLabel}；凭证要求：${milestone.proofRequirementLabel}`
}

export function isTaskMilestoneProofSatisfied(task: ProcessTask, proofFiles: ExecProofFile[]): boolean {
  const milestone = ensureMilestoneDefaults(task)
  if (!milestone.required) return true
  if (milestone.proofRequirement === 'NONE') return true
  if (milestone.proofRequirement === 'IMAGE') {
    return proofFiles.some((file) => file.type === 'IMAGE')
  }
  if (milestone.proofRequirement === 'VIDEO') {
    return proofFiles.some((file) => file.type === 'VIDEO')
  }
  return proofFiles.some((file) => file.type === 'IMAGE' || file.type === 'VIDEO')
}

export function reportTaskMilestone(
  taskId: string,
  payload: { reportedAt: string; proofFiles: ExecProofFile[]; by: string },
): { ok: boolean; message: string } {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!task) return { ok: false, message: '任务不存在' }
  if (task.status !== 'IN_PROGRESS') return { ok: false, message: '仅进行中任务可上报关键节点' }

  const milestone = ensureMilestoneDefaults(task)
  if (!milestone.required) return { ok: false, message: '当前任务无需关键节点上报' }
  if (milestone.status === 'REPORTED') return { ok: false, message: '关键节点已上报' }

  const now = nowTimestamp()
  task.milestoneRequired = true
  task.milestoneRuleType = milestone.ruleType
  task.milestoneRuleLabel = milestone.ruleLabel
  task.milestoneTargetQty = milestone.targetQty
  task.milestoneTargetUnit = milestone.targetUnit
  task.milestoneProofRequirement = milestone.proofRequirement
  task.milestoneOverdueExceptionEnabled = milestone.overdueExceptionEnabled
  task.milestoneOverdueHours = milestone.overdueHours
  task.milestoneExceptionSeverity = milestone.exceptionSeverity
  task.milestoneStatus = 'REPORTED'
  task.milestoneReportedAt = payload.reportedAt
  task.milestoneReportedQty = milestone.targetQty
  task.milestoneProofFiles = [...payload.proofFiles]
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-MILESTONE-${Date.now()}`,
      action: 'REPORT_MILESTONE',
      detail: `上报关键节点：${milestone.ruleLabel}，上报时间：${payload.reportedAt}，数量：${milestone.targetQty} ${milestone.targetUnitLabel}，凭证：${payload.proofFiles.length}个`,
      at: now,
      by: payload.by,
    },
  ]
  syncMilestoneOverdueExceptions()

  return { ok: true, message: '关键节点已上报' }
}

function getTaskById(taskId: string): ProcessTask | undefined {
  return processTasks.find((item) => item.taskId === taskId)
}

function getCaseById(caseId: string): ExceptionCase | undefined {
  return initialExceptions.find((item) => item.caseId === caseId)
}

function updateCase(updated: ExceptionCase): void {
  const index = initialExceptions.findIndex((item) => item.caseId === updated.caseId)
  if (index >= 0) initialExceptions[index] = updated
}

function createPauseException(task: ProcessTask, payload: {
  reasonCode: PauseReasonCode
  reasonLabel: string
  remark: string
  reportedAt: string
  proofFiles: ExecProofFile[]
  by: string
}): ExceptionCase {
  const createdAt = nowTimestamp()
  const caseId = generateCaseId()
  const severity: Severity = payload.reasonCode === 'EQUIPMENT_ISSUE' ? 'S1' : 'S2'
  const reasonCode = mapPauseReasonToExceptionReason(payload.reasonCode)

  const milestone = ensureMilestoneDefaults(task)

  return {
    caseId,
    caseStatus: 'OPEN',
    severity,
    category: 'EXECUTION',
    unifiedCategory: getUnifiedCategoryFromReason(reasonCode, 'EXECUTION'),
    subCategoryKey: getDefaultSubCategoryKeyFromReason(reasonCode) || 'EXEC_BLOCK_OTHER',
    reasonCode,
    reasonLabel: payload.reasonLabel,
    sourceType: 'FACTORY_PAUSE_REPORT',
    sourceId: task.taskId,
    sourceSystem: 'FCS',
    sourceModule: 'PDA_EXEC',
    relatedOrderIds: [task.productionOrderId],
    relatedTaskIds: [task.taskId],
    relatedTenderIds: task.tenderId ? [task.tenderId] : [],
    linkedProductionOrderNo: task.productionOrderId,
    linkedTaskNo: task.taskId,
    summary: `${task.processNameZh}任务上报暂停`,
    detail: `工厂上报暂停。原因：${payload.reasonLabel}。说明：${payload.remark || '—'}`,
    createdAt,
    updatedAt: createdAt,
    tags: ['工厂上报', '暂停'],
    linkedFactoryName: task.assignedFactoryName || task.assignedFactoryId || '-',
    pauseReportedAt: payload.reportedAt,
    pauseReasonLabel: payload.reasonLabel,
    pauseRemark: payload.remark,
    pauseProofFiles: [...payload.proofFiles],
    milestoneSnapshot: milestone.required
      ? {
          required: true,
          ruleLabel: milestone.ruleLabel,
          targetQty: milestone.targetQty,
          targetUnit: milestone.targetUnit,
          status: milestone.status,
          reportedAt: milestone.reportedAt,
        }
      : { required: false },
    actions: [
      {
        id: `EA-${Date.now()}`,
        actionType: 'REPORT_PAUSE',
        actionDetail: `工厂上报暂停：${payload.reasonLabel}`,
        at: createdAt,
        by: payload.by,
      },
    ],
    auditLogs: [
      {
        id: `EAL-${Date.now()}`,
        action: 'CREATE',
        detail: '工厂端 PDA 上报暂停，系统自动生成异常单',
        at: createdAt,
        by: '系统',
      },
    ],
  }
}

function getActivePauseException(taskId: string): ExceptionCase | undefined {
  return initialExceptions.find(
    (item) =>
      item.sourceType === 'FACTORY_PAUSE_REPORT' &&
      item.relatedTaskIds.includes(taskId) &&
      (item.caseStatus === 'OPEN' || item.caseStatus === 'IN_PROGRESS'),
  )
}

function addHours(baseAt: string, hours: number): string {
  const date = new Date(baseAt.replace(' ', 'T'))
  date.setHours(date.getHours() + hours)
  return nowTimestamp(date)
}

function isOpenMilestoneOverdueException(exceptionCase: ExceptionCase): boolean {
  return (
    exceptionCase.reasonCode === 'MILESTONE_NOT_REPORTED' &&
    (exceptionCase.caseStatus === 'OPEN' || exceptionCase.caseStatus === 'IN_PROGRESS')
  )
}

function findTaskOpenMilestoneOverdueException(taskId: string): ExceptionCase | undefined {
  return initialExceptions.find(
    (item) => isOpenMilestoneOverdueException(item) && item.relatedTaskIds.includes(taskId),
  )
}

function createMilestoneOverdueException(
  task: ProcessTask,
  milestone: TaskMilestoneState,
  overdueAt: string,
  now: string,
): ExceptionCase {
  const caseId = generateCaseId()
  const reasonCode = 'MILESTONE_NOT_REPORTED'
  return {
    caseId,
    caseStatus: 'OPEN',
    severity: milestone.exceptionSeverity,
    category: 'EXECUTION',
    unifiedCategory: getUnifiedCategoryFromReason(reasonCode, 'EXECUTION'),
    subCategoryKey: getDefaultSubCategoryKeyFromReason(reasonCode) || 'EXEC_MILESTONE_NOT_REPORTED',
    reasonCode,
    sourceType: 'TASK',
    sourceId: task.taskId,
    sourceSystem: 'FCS',
    sourceModule: 'PDA_EXEC',
    relatedOrderIds: [task.productionOrderId],
    relatedTaskIds: [task.taskId],
    relatedTenderIds: task.tenderId ? [task.tenderId] : [],
    linkedProductionOrderNo: task.productionOrderId,
    linkedTaskNo: task.taskId,
    summary: '关键节点未上报',
    detail: `${task.processNameZh}任务已开工，按“${milestone.ruleLabel}”要求应在 ${overdueAt} 前完成节点上报，当前仍未上报。`,
    createdAt: now,
    updatedAt: now,
    tags: ['执行异常', '关键节点未上报', 'PDA执行'],
    actions: [],
    auditLogs: [
      {
        id: `EAL-${Date.now()}`,
        action: 'CREATE',
        detail: '系统自动生成：关键节点未上报',
        at: now,
        by: '系统',
      },
    ],
  }
}

function resolveMilestoneOverdueException(exceptionCase: ExceptionCase, now: string): void {
  const resolved = markCaseResolved(exceptionCase, {
    by: '系统',
    source: 'SYSTEM',
    ruleCode: 'EXEC_MILESTONE_REPORTED',
    detail: '任务已补报关键节点，系统自动判定为已解决',
    at: now,
    actionType: 'AUTO_RESOLVE',
    auditAction: 'AUTO_RESOLVE',
  })
  updateCase(maybeAutoCloseResolvedCase(resolved, '系统'))
}

export function syncMilestoneOverdueExceptions(now: Date = new Date()): void {
  const nowMs = now.getTime()
  const nowAt = nowTimestamp(now)

  processTasks.forEach((task) => {
    if (!task.taskId.startsWith('PDA-EXEC-')) return

    const milestone = ensureMilestoneDefaults(task)
    const writableTask = task as ProcessTask & { milestoneOverdueExceptionId?: string | null }
    const activeException = findTaskOpenMilestoneOverdueException(task.taskId)

    if (
      task.startedAt &&
      milestone.required &&
      milestone.overdueExceptionEnabled &&
      milestone.status !== 'REPORTED'
    ) {
      const overdueAt = addHours(task.startedAt, milestone.overdueHours)
      const overdueMs = new Date(overdueAt.replace(' ', 'T')).getTime()
      if (Number.isFinite(overdueMs) && nowMs >= overdueMs) {
        if (activeException) {
          writableTask.milestoneOverdueExceptionId = activeException.caseId
        } else {
          const created = createMilestoneOverdueException(task, milestone, overdueAt, nowAt)
          initialExceptions.push(created)
          writableTask.milestoneOverdueExceptionId = created.caseId
        }
        return
      }
    }

    if (milestone.status === 'REPORTED' && activeException) {
      resolveMilestoneOverdueException(activeException, nowAt)
    }
    if (!activeException || milestone.status === 'REPORTED') {
      writableTask.milestoneOverdueExceptionId = null
    }
  })
}

export function reportTaskPause(
  taskId: string,
  payload: {
    reasonCode: PauseReasonCode
    reasonLabel?: string
    remark: string
    reportedAt: string
    proofFiles: ExecProofFile[]
    by: string
  },
): { ok: boolean; message: string; caseId?: string } {
  const task = getTaskById(taskId)
  if (!task) return { ok: false, message: '任务不存在' }
  if (task.status !== 'IN_PROGRESS') return { ok: false, message: '仅进行中任务可上报暂停' }

  const existing = getActivePauseException(taskId)
  if (existing) return { ok: false, message: '当前任务已上报暂停，待平台处理' }

  const now = nowTimestamp()
  const reasonLabel = payload.reasonLabel || getPauseReasonLabel(payload.reasonCode)
  const exception = createPauseException(task, {
    ...payload,
    reasonLabel,
  })
  initialExceptions.unshift(exception)

  task.status = 'BLOCKED'
  task.blockReason = mapPauseReasonToBlockReason(payload.reasonCode)
  task.blockRemark = payload.remark || reasonLabel
  task.blockedAt = payload.reportedAt
  task.pauseStatus = 'REPORTED'
  task.pauseReasonCode = payload.reasonCode
  task.pauseReasonLabel = reasonLabel
  task.pauseRemark = payload.remark || null
  task.pauseReportedAt = payload.reportedAt
  task.pauseProofFiles = [...payload.proofFiles]
  task.pauseExceptionId = exception.caseId
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-PAUSE-${Date.now()}`,
      action: 'REPORT_PAUSE',
      detail: `上报暂停，原因：${reasonLabel}，上报时间：${payload.reportedAt}，凭证：${payload.proofFiles.length}个`,
      at: now,
      by: payload.by,
    },
  ]

  return { ok: true, message: '已上报暂停，待平台处理', caseId: exception.caseId }
}

export function recordPauseExceptionFollowUp(
  caseId: string,
  remark: string,
  by: string,
): { ok: boolean; message: string } {
  const exc = getCaseById(caseId)
  if (!exc || exc.sourceType !== 'FACTORY_PAUSE_REPORT') return { ok: false, message: '异常不存在' }
  if (exc.caseStatus === 'CLOSED' || exc.caseStatus === 'RESOLVED') return { ok: false, message: '异常已结束' }

  const now = nowTimestamp()
  const updated: ExceptionCase = {
    ...exc,
    caseStatus: 'IN_PROGRESS',
    updatedAt: now,
    followUpRemark: remark,
    actions: [
      ...exc.actions,
      {
        id: `EA-${Date.now()}`,
        actionType: 'FOLLOW_UP_EXCEPTION',
        actionDetail: `平台已记录跟进：${remark}`,
        at: now,
        by,
      },
    ],
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'FOLLOW_UP_EXCEPTION',
        detail: `平台已记录跟进：${remark}`,
        at: now,
        by,
      },
    ],
  }
  updateCase(updated)

  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (!task) continue
    task.pauseStatus = 'FOLLOWING_UP'
    task.updatedAt = now
  }

  return { ok: true, message: '已记录跟进' }
}

export function allowContinueFromPauseException(
  caseId: string,
  by: string,
): { ok: boolean; message: string } {
  const exc = getCaseById(caseId)
  if (!exc || exc.sourceType !== 'FACTORY_PAUSE_REPORT') return { ok: false, message: '异常不存在' }
  if (exc.caseStatus === 'CLOSED') return { ok: false, message: '异常已关闭' }
  if (exc.caseStatus === 'RESOLVED') return { ok: false, message: '异常已解决' }

  const now = nowTimestamp()
  const updated = markCaseResolved(exc, {
    by,
    source: 'USER',
    ruleCode: 'EXEC_ALLOW_CONTINUE',
    detail: '平台已允许继续，异常判定为已解决',
    at: now,
    actionType: 'ALLOW_CONTINUE',
    auditAction: 'ALLOW_CONTINUE',
  })
  updateCase(updated)

  for (const taskId of exc.relatedTaskIds) {
    const task = getTaskById(taskId)
    if (!task) continue
    task.status = 'IN_PROGRESS'
    task.pauseStatus = 'NONE'
    task.pauseExceptionId = null
    task.blockReason = undefined
    task.blockRemark = undefined
    task.blockedAt = undefined
    task.updatedAt = now
    task.auditLogs = [
      ...task.auditLogs,
      {
        id: `AL-CONTINUE-${Date.now()}`,
        action: 'ALLOW_CONTINUE',
        detail: '平台已允许继续',
        at: now,
        by,
      },
    ]
  }

  return { ok: true, message: '已允许继续，任务恢复进行中' }
}

export function getPauseHandleStatus(task: ProcessTask): { label: string; className: string } {
  const pauseStatus: PauseStatus = task.pauseStatus || 'NONE'
  if (pauseStatus === 'FOLLOWING_UP') {
    return { label: '平台跟进中', className: 'text-blue-700 bg-blue-50 border-blue-200' }
  }
  if (pauseStatus === 'REPORTED') {
    return { label: '待平台处理', className: 'text-amber-700 bg-amber-50 border-amber-200' }
  }
  return { label: '未上报暂停', className: 'text-muted-foreground bg-muted border-border' }
}
