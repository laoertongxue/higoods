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
  calculateSlaDue,
  generateCaseId,
  initialExceptions,
  type ExceptionCase,
  type ReasonCode,
  type Severity,
} from './store-domain-progress'

export interface TaskMilestoneState {
  required: boolean
  ruleType: string
  ruleLabel: string
  targetQty: number
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

function ensureMilestoneDefaults(task: ProcessTask): TaskMilestoneState {
  const impliedRequired = task.milestoneRequired ?? task.processCode === 'PROC_SEW'
  if (!impliedRequired) {
    return {
      required: false,
      ruleType: task.milestoneRuleType || 'NONE',
      ruleLabel: task.milestoneRuleLabel || '',
      targetQty: task.milestoneTargetQty || 0,
      status: 'PENDING',
      reportedAt: null,
      reportedQty: null,
      proofFiles: [],
    }
  }

  const ruleType = task.milestoneRuleType || 'SEW_FIRST_5_PIECES'
  const ruleLabel = task.milestoneRuleLabel || '完成第 5 件'
  const targetQty = task.milestoneTargetQty || 5
  const status: MilestoneStatus =
    task.milestoneStatus || (task.milestoneReportedAt ? 'REPORTED' : 'PENDING')

  return {
    required: true,
    ruleType,
    ruleLabel,
    targetQty,
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
      detail: `上报关键节点：${milestone.ruleLabel}，上报时间：${payload.reportedAt}，数量：${milestone.targetQty}，凭证：${payload.proofFiles.length}个`,
      at: now,
      by: payload.by,
    },
  ]

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

  const milestone = ensureMilestoneDefaults(task)

  return {
    caseId,
    caseStatus: 'OPEN',
    severity,
    category: 'PRODUCTION_BLOCK',
    reasonCode: mapPauseReasonToExceptionReason(payload.reasonCode),
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
    slaDueAt: calculateSlaDue(severity, createdAt),
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
      item.caseStatus !== 'CLOSED',
  )
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
  if (exc.caseStatus === 'CLOSED') return { ok: false, message: '异常已关闭' }

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

  const now = nowTimestamp()
  const updated: ExceptionCase = {
    ...exc,
    caseStatus: 'CLOSED',
    updatedAt: now,
    closedAt: now,
    closeRemark: '平台已允许继续',
    actions: [
      ...exc.actions,
      {
        id: `EA-${Date.now()}`,
        actionType: 'ALLOW_CONTINUE',
        actionDetail: '平台已允许继续',
        at: now,
        by,
      },
    ],
    auditLogs: [
      ...exc.auditLogs,
      {
        id: `EAL-${Date.now()}`,
        action: 'ALLOW_CONTINUE',
        detail: '平台已允许继续',
        at: now,
        by,
      },
    ],
  }
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
