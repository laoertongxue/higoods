import { processTasks, type ProcessTask } from '../process-tasks.ts'
import {
  listRuntimeExecutionTasks,
  type RuntimeProcessTask,
} from '../runtime-process-tasks.ts'

export interface ExecutionTaskFact extends ProcessTask {
  displayStageName: string
  displayProcessName: string
  displayTaskType: string
  displayGranularity: string
}

const STAGE_LABEL_BY_CODE: Record<string, string> = {
  PREP: '准备阶段',
  PROD: '生产阶段',
  POST: '后道阶段',
}

const STAGE_LABEL_BY_LEGACY_STAGE: Record<string, string> = {
  CUTTING: '裁片阶段',
  SEWING: '生产阶段',
  POST: '后道阶段',
  SPECIAL: '特殊工艺阶段',
}

const GRANULARITY_LABEL: Record<'ORDER' | 'COLOR' | 'SKU' | 'DETAIL', string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
  DETAIL: '按明细行',
}

const syntheticTaskFacts = new Map<string, ProcessTask>()

function toTimeNumber(value: string | undefined): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRecordLike(
  value: unknown,
): Record<string, string | string[] | undefined> {
  if (!value) return {}

  if (Array.isArray(value)) {
    const normalized: Record<string, string | string[] | undefined> = {}
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue
      const keyCandidate = (entry as { key?: unknown; code?: unknown; name?: unknown }).key
        ?? (entry as { code?: unknown }).code
        ?? (entry as { name?: unknown }).name
      const valueCandidate = (entry as { value?: unknown; id?: unknown; label?: unknown }).value
        ?? (entry as { id?: unknown }).id
        ?? (entry as { label?: unknown }).label
      if (typeof keyCandidate !== 'string') continue
      if (typeof valueCandidate === 'string') {
        normalized[keyCandidate] = valueCandidate
      } else if (Array.isArray(valueCandidate)) {
        normalized[keyCandidate] = valueCandidate.filter(
          (item): item is string => typeof item === 'string',
        )
      }
    }
    return normalized
  }

  if (typeof value === 'object') {
    const normalized: Record<string, string | string[] | undefined> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === 'string') {
        normalized[key] = item
      } else if (Array.isArray(item)) {
        normalized[key] = item.filter((entry): entry is string => typeof entry === 'string')
      }
    }
    return normalized
  }

  return {}
}

function cloneDetailRows(task: RuntimeProcessTask): ProcessTask['detailRows'] {
  const rows = task.scopeDetailRows.length > 0 ? task.scopeDetailRows : task.detailRows ?? []
  return rows.map((row) => ({
    ...row,
    dimensions: normalizeRecordLike(row.dimensions) as typeof row.dimensions,
    sourceRefs: normalizeRecordLike(row.sourceRefs) as unknown as typeof row.sourceRefs,
  }))
}

function cloneCoveredProcesses(task: RuntimeProcessTask): ProcessTask['coveredProcesses'] {
  return task.coveredProcesses?.map((item) => ({
    ...item,
    sourceArtifactIds: [...item.sourceArtifactIds],
  }))
}

function createFallbackTask(runtimeTask: RuntimeProcessTask): ProcessTask {
  const now = runtimeTask.updatedAt || runtimeTask.createdAt || '2026-03-20 00:00:00'
  return {
    taskId: runtimeTask.taskId,
    taskNo: runtimeTask.taskNo || runtimeTask.taskId,
    productionOrderId: runtimeTask.productionOrderId,
    seq: runtimeTask.seq,
    processCode: runtimeTask.processCode,
    processNameZh: runtimeTask.processNameZh,
    stage: runtimeTask.stage,
    qty: runtimeTask.scopeQty || runtimeTask.qty,
    qtyUnit: runtimeTask.qtyUnit,
    assignmentMode: runtimeTask.assignmentMode,
    assignmentStatus: runtimeTask.assignmentStatus,
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    qcPoints: [],
    taskOutputValue: runtimeTask.outputValuePerUnit ?? runtimeTask.taskOutputValue,
    difficulty: runtimeTask.difficulty,
    outputValuePerUnit: runtimeTask.outputValuePerUnit,
    outputValueUnit: runtimeTask.outputValueUnit,
    outputValueTotal: runtimeTask.outputValueTotal,
    outputValueDifficulty: runtimeTask.outputValueDifficulty,
    outputValueSource: runtimeTask.outputValueSource,
    attachments: [],
    status: runtimeTask.status,
    assignedFactoryId: runtimeTask.assignedFactoryId,
    assignedFactoryName: runtimeTask.assignedFactoryName,
    acceptDeadline: runtimeTask.acceptDeadline,
    taskDeadline: runtimeTask.taskDeadline,
    dispatchRemark: runtimeTask.dispatchRemark,
    dispatchedAt: runtimeTask.dispatchedAt,
    dispatchedBy: runtimeTask.dispatchedBy,
    acceptanceStatus: runtimeTask.acceptanceStatus,
    acceptedAt: runtimeTask.acceptedAt,
    acceptedBy: runtimeTask.acceptedBy,
    startDueAt: runtimeTask.startDueAt,
    startDueSource: runtimeTask.startDueSource,
    startRiskStatus: runtimeTask.startRiskStatus,
    startHeadcount: runtimeTask.startHeadcount,
    startProofFiles: runtimeTask.startProofFiles ? [...runtimeTask.startProofFiles] : undefined,
    startOverdueExceptionId: runtimeTask.startOverdueExceptionId,
    milestoneRuleType: runtimeTask.milestoneRuleType,
    milestoneRuleLabel: runtimeTask.milestoneRuleLabel,
    milestoneTargetQty: runtimeTask.milestoneTargetQty,
    milestoneTargetUnit: runtimeTask.milestoneTargetUnit,
    milestoneRequired: runtimeTask.milestoneRequired,
    milestoneStatus: runtimeTask.milestoneStatus,
    milestoneReportedAt: runtimeTask.milestoneReportedAt,
    milestoneReportedQty: runtimeTask.milestoneReportedQty,
    milestoneProofFiles: runtimeTask.milestoneProofFiles ? [...runtimeTask.milestoneProofFiles] : undefined,
    milestoneProofRequirement: runtimeTask.milestoneProofRequirement,
    milestoneOverdueExceptionEnabled: runtimeTask.milestoneOverdueExceptionEnabled,
    milestoneOverdueHours: runtimeTask.milestoneOverdueHours,
    milestoneExceptionSeverity: runtimeTask.milestoneExceptionSeverity,
    milestoneOverdueExceptionId: runtimeTask.milestoneOverdueExceptionId,
    startedAt: runtimeTask.startedAt,
    finishedAt: runtimeTask.finishedAt,
    taskQrValue: runtimeTask.taskQrValue,
    taskQrStatus: runtimeTask.taskQrStatus,
    handoverAutoCreatePolicy: runtimeTask.handoverAutoCreatePolicy,
    handoverOrderId: runtimeTask.handoverOrderId,
    handoverStatus: runtimeTask.handoverStatus,
    receiverKind: runtimeTask.receiverKind,
    receiverId: runtimeTask.receiverId,
    receiverName: runtimeTask.receiverName,
    dependsOnTaskIds: [...runtimeTask.dependsOnTaskIds],
    taskCategoryZh: runtimeTask.taskCategoryZh,
    taskUnitType: runtimeTask.taskUnitType,
    acceptanceMode: runtimeTask.acceptanceMode,
    generationRuleId: runtimeTask.generationRuleId,
    generationRuleName: runtimeTask.generationRuleName,
    coveredProcesses: cloneCoveredProcesses(runtimeTask),
    isMergedTaskUnit: runtimeTask.isMergedTaskUnit,
    allowAutoDispatch: runtimeTask.allowAutoDispatch,
    pdaStepTemplateCode: runtimeTask.pdaStepTemplateCode,
    handoverReceiverKind: runtimeTask.handoverReceiverKind,
    handoverReceiverName: runtimeTask.handoverReceiverName,
    saleTypeSnapshot: runtimeTask.saleTypeSnapshot,
    stageCode: runtimeTask.stageCode,
    stageName: runtimeTask.stageName,
    processBusinessCode: runtimeTask.processBusinessCode,
    processBusinessName: runtimeTask.processBusinessName,
    craftCode: runtimeTask.craftCode,
    craftName: runtimeTask.craftName,
    selectedTargetObject: runtimeTask.selectedTargetObject,
    assignmentGranularity: runtimeTask.assignmentGranularity,
    ruleSource: runtimeTask.ruleSource,
    detailSplitMode: runtimeTask.detailSplitMode,
    detailSplitDimensions: runtimeTask.detailSplitDimensions ? [...runtimeTask.detailSplitDimensions] : [],
    detailRows: cloneDetailRows(runtimeTask),
    rootTaskNo: runtimeTask.rootTaskNo || runtimeTask.taskNo || runtimeTask.taskId,
    splitGroupId: runtimeTask.splitGroupId,
    splitFromTaskNo: runtimeTask.splitFromTaskNo,
    splitSeq: runtimeTask.splitSeq,
    detailRowKeys: runtimeTask.detailRowKeys ? [...runtimeTask.detailRowKeys] : runtimeTask.scopeDetailRows.map((row) => row.rowKey),
    isSplitResult: runtimeTask.isSplitResult,
    isSplitSource: runtimeTask.isSplitSource,
    executionEnabled: runtimeTask.executionEnabled,
    defaultDocType: runtimeTask.defaultDocType,
    taskTypeMode: runtimeTask.taskTypeMode,
    isSpecialCraft: runtimeTask.isSpecialCraft,
    woolTaskType: runtimeTask.woolTaskType,
    woolKind: runtimeTask.woolKind,
    woolKindLabel: runtimeTask.woolKindLabel,
    woolOrderId: runtimeTask.woolOrderId,
    woolOrderNo: runtimeTask.woolOrderNo,
    woolDownstreamTarget: runtimeTask.woolDownstreamTarget,
    yarnSku: runtimeTask.yarnSku,
    yarnPlannedWeightKg: runtimeTask.yarnPlannedWeightKg,
    yarnReceivedWeightKg: runtimeTask.yarnReceivedWeightKg,
    requiresFeiTicket: runtimeTask.requiresFeiTicket,
    packagingRequired: runtimeTask.packagingRequired,
    materialIssueMode: runtimeTask.materialIssueMode,
    mockReceiveSummary: runtimeTask.mockReceiveSummary,
    mockExecutionSummary: runtimeTask.mockExecutionSummary,
    mockHandoverSummary: runtimeTask.mockHandoverSummary,
    mockStartPrerequisiteMet: runtimeTask.mockStartPrerequisiteMet,
    createdAt: now,
    updatedAt: now,
    auditLogs: [...runtimeTask.auditLogs],
  }
}

function syncTaskFromRuntime(task: ProcessTask, runtimeTask: RuntimeProcessTask, forceRuntime = false): void {
  const runtimeWins = forceRuntime || toTimeNumber(task.updatedAt) <= toTimeNumber(runtimeTask.updatedAt)

  task.taskNo = runtimeTask.taskNo || runtimeTask.taskId
  task.productionOrderId = runtimeTask.productionOrderId
  task.seq = runtimeTask.seq
  task.processCode = runtimeTask.processCode
  task.processNameZh = runtimeTask.processNameZh
  task.stage = runtimeTask.stage
  task.qty = runtimeTask.scopeQty || runtimeTask.qty
  task.qtyUnit = runtimeTask.qtyUnit
  task.dependsOnTaskIds = [...runtimeTask.dependsOnTaskIds]
  task.taskOutputValue = runtimeTask.outputValuePerUnit ?? runtimeTask.taskOutputValue
  task.difficulty = runtimeTask.difficulty
  task.outputValuePerUnit = runtimeTask.outputValuePerUnit
  task.outputValueUnit = runtimeTask.outputValueUnit
  task.outputValueTotal = runtimeTask.outputValueTotal
  task.outputValueDifficulty = runtimeTask.outputValueDifficulty
  task.outputValueSource = runtimeTask.outputValueSource
  task.stageCode = runtimeTask.stageCode
  task.stageName = runtimeTask.stageName
  task.processBusinessCode = runtimeTask.processBusinessCode
  task.processBusinessName = runtimeTask.processBusinessName
  task.craftCode = runtimeTask.craftCode
  task.craftName = runtimeTask.craftName
  task.selectedTargetObject = runtimeTask.selectedTargetObject
  task.assignmentGranularity = runtimeTask.assignmentGranularity
  task.ruleSource = runtimeTask.ruleSource
  task.detailSplitMode = runtimeTask.detailSplitMode
  task.detailSplitDimensions = runtimeTask.detailSplitDimensions ? [...runtimeTask.detailSplitDimensions] : []
  task.detailRows = cloneDetailRows(runtimeTask)
  task.rootTaskNo = runtimeTask.rootTaskNo || runtimeTask.taskNo || runtimeTask.taskId
  task.splitGroupId = runtimeTask.splitGroupId
  task.splitFromTaskNo = runtimeTask.splitFromTaskNo
  task.splitSeq = runtimeTask.splitSeq
  task.detailRowKeys = runtimeTask.detailRowKeys ? [...runtimeTask.detailRowKeys] : runtimeTask.scopeDetailRows.map((row) => row.rowKey)
  task.isSplitResult = runtimeTask.isSplitResult
  task.isSplitSource = runtimeTask.isSplitSource
  task.executionEnabled = runtimeTask.executionEnabled
  task.defaultDocType = runtimeTask.defaultDocType
  task.taskTypeMode = runtimeTask.taskTypeMode
  task.isSpecialCraft = runtimeTask.isSpecialCraft
  task.taskCategoryZh = runtimeTask.taskCategoryZh
  task.taskUnitType = runtimeTask.taskUnitType
  task.acceptanceMode = runtimeTask.acceptanceMode
  task.generationRuleId = runtimeTask.generationRuleId
  task.generationRuleName = runtimeTask.generationRuleName
  task.coveredProcesses = cloneCoveredProcesses(runtimeTask)
  task.isMergedTaskUnit = runtimeTask.isMergedTaskUnit
  task.allowAutoDispatch = runtimeTask.allowAutoDispatch
  task.pdaStepTemplateCode = runtimeTask.pdaStepTemplateCode
  task.handoverReceiverKind = runtimeTask.handoverReceiverKind
  task.handoverReceiverName = runtimeTask.handoverReceiverName
  task.saleTypeSnapshot = runtimeTask.saleTypeSnapshot
  task.woolTaskType = runtimeTask.woolTaskType
  task.woolKind = runtimeTask.woolKind
  task.woolKindLabel = runtimeTask.woolKindLabel
  task.woolOrderId = runtimeTask.woolOrderId
  task.woolOrderNo = runtimeTask.woolOrderNo
  task.woolDownstreamTarget = runtimeTask.woolDownstreamTarget
  task.yarnSku = runtimeTask.yarnSku
  task.yarnPlannedWeightKg = runtimeTask.yarnPlannedWeightKg
  task.yarnReceivedWeightKg = runtimeTask.yarnReceivedWeightKg
  task.requiresFeiTicket = runtimeTask.requiresFeiTicket
  task.packagingRequired = runtimeTask.packagingRequired
  task.materialIssueMode = runtimeTask.materialIssueMode
  task.mockReceiveSummary = runtimeTask.mockReceiveSummary
  task.mockExecutionSummary = runtimeTask.mockExecutionSummary
  task.mockHandoverSummary = runtimeTask.mockHandoverSummary
  task.mockStartPrerequisiteMet = runtimeTask.mockStartPrerequisiteMet

  if (!runtimeWins) return

  task.assignmentMode = runtimeTask.assignmentMode
  task.assignmentStatus = runtimeTask.assignmentStatus
  task.assignedFactoryId = runtimeTask.assignedFactoryId
  task.assignedFactoryName = runtimeTask.assignedFactoryName
  task.acceptDeadline = runtimeTask.acceptDeadline
  task.taskDeadline = runtimeTask.taskDeadline
  task.dispatchRemark = runtimeTask.dispatchRemark
  task.dispatchedAt = runtimeTask.dispatchedAt
  task.dispatchedBy = runtimeTask.dispatchedBy
  task.standardPrice = runtimeTask.standardPrice
  task.standardPriceCurrency = runtimeTask.standardPriceCurrency
  task.standardPriceUnit = runtimeTask.standardPriceUnit
  task.dispatchPrice = runtimeTask.dispatchPrice
  task.dispatchPriceCurrency = runtimeTask.dispatchPriceCurrency
  task.dispatchPriceUnit = runtimeTask.dispatchPriceUnit
  task.priceDiffReason = runtimeTask.priceDiffReason
  task.acceptanceStatus = runtimeTask.acceptanceStatus
  task.acceptedAt = runtimeTask.acceptedAt
  task.acceptedBy = runtimeTask.acceptedBy
  task.awardedAt = runtimeTask.awardedAt
  task.status = runtimeTask.status
  task.startDueAt = runtimeTask.startDueAt
  task.startDueSource = runtimeTask.startDueSource
  task.startRiskStatus = runtimeTask.startRiskStatus
  task.startHeadcount = runtimeTask.startHeadcount
  task.startProofFiles = runtimeTask.startProofFiles ? [...runtimeTask.startProofFiles] : undefined
  task.startOverdueExceptionId = runtimeTask.startOverdueExceptionId
  task.milestoneRuleType = runtimeTask.milestoneRuleType
  task.milestoneRuleLabel = runtimeTask.milestoneRuleLabel
  task.milestoneTargetQty = runtimeTask.milestoneTargetQty
  task.milestoneTargetUnit = runtimeTask.milestoneTargetUnit
  task.milestoneRequired = runtimeTask.milestoneRequired
  task.milestoneStatus = runtimeTask.milestoneStatus
  task.milestoneReportedAt = runtimeTask.milestoneReportedAt
  task.milestoneReportedQty = runtimeTask.milestoneReportedQty
  task.milestoneProofFiles = runtimeTask.milestoneProofFiles ? [...runtimeTask.milestoneProofFiles] : undefined
  task.milestoneProofRequirement = runtimeTask.milestoneProofRequirement
  task.milestoneOverdueExceptionEnabled = runtimeTask.milestoneOverdueExceptionEnabled
  task.milestoneOverdueHours = runtimeTask.milestoneOverdueHours
  task.milestoneExceptionSeverity = runtimeTask.milestoneExceptionSeverity
  task.milestoneOverdueExceptionId = runtimeTask.milestoneOverdueExceptionId
  task.startedAt = runtimeTask.startedAt
  task.finishedAt = runtimeTask.finishedAt
  task.taskQrValue = runtimeTask.taskQrValue
  task.taskQrStatus = runtimeTask.taskQrStatus
  task.handoverAutoCreatePolicy = runtimeTask.handoverAutoCreatePolicy
  task.handoverOrderId = runtimeTask.handoverOrderId
  task.handoverStatus = runtimeTask.handoverStatus
  task.receiverKind = runtimeTask.receiverKind
  task.receiverId = runtimeTask.receiverId
  task.receiverName = runtimeTask.receiverName
  task.blockReason = runtimeTask.blockReason
  task.blockRemark = runtimeTask.blockRemark
  task.blockedAt = runtimeTask.blockedAt
  task.hasMaterialRequest = runtimeTask.hasMaterialRequest
  task.materialRequestNo = runtimeTask.materialRequestNo
  task.materialMode = runtimeTask.materialMode
  task.materialModeLabel = runtimeTask.materialModeLabel
  task.materialRequestStatus = runtimeTask.materialRequestStatus
  task.updatedAt = runtimeTask.updatedAt
  task.createdAt = runtimeTask.createdAt
  task.auditLogs = [...runtimeTask.auditLogs]
}

function resolveProcessName(task: ProcessTask): string {
  return task.processBusinessName || task.processNameZh || task.processCode
}

function resolveTaskTypeName(task: ProcessTask): string {
  if (task.taskCategoryZh) return task.taskCategoryZh
  if (task.isSpecialCraft) return task.craftName || resolveProcessName(task)
  return resolveProcessName(task)
}

export function getTaskStageDisplayName(task: ProcessTask): string {
  if (task.stageName) return task.stageName
  if (task.stageCode && STAGE_LABEL_BY_CODE[task.stageCode]) return STAGE_LABEL_BY_CODE[task.stageCode]
  return STAGE_LABEL_BY_LEGACY_STAGE[task.stage] || task.stage
}

export function getTaskProcessDisplayName(task: ProcessTask): string {
  return task.isSpecialCraft ? resolveTaskTypeName(task) : resolveProcessName(task)
}

export function getTaskTypeDisplayName(task: ProcessTask): string {
  return resolveTaskTypeName(task)
}

export function getTaskGranularityDisplayName(task: ProcessTask): string {
  const granularity = task.assignmentGranularity
  if (granularity && GRANULARITY_LABEL[granularity]) return GRANULARITY_LABEL[granularity]
  return '-'
}

export function listExecutionTaskFacts(): ProcessTask[] {
  const runtimeTasks = listRuntimeExecutionTasks().filter((task) => task.defaultDocType !== 'DEMAND')
  const runtimeTaskIds = new Set(runtimeTasks.map((task) => task.taskId))
  const facts: ProcessTask[] = []

  for (const key of syntheticTaskFacts.keys()) {
    if (!runtimeTaskIds.has(key)) syntheticTaskFacts.delete(key)
  }

  for (const runtimeTask of runtimeTasks) {
    const directBase = processTasks.find((task) => task.taskId === runtimeTask.taskId)
    if (directBase) {
      syncTaskFromRuntime(directBase, runtimeTask)
      facts.push(directBase)
      continue
    }

    const synthetic = syntheticTaskFacts.get(runtimeTask.taskId) ?? createFallbackTask(runtimeTask)
    syncTaskFromRuntime(synthetic, runtimeTask, true)
    syntheticTaskFacts.set(runtimeTask.taskId, synthetic)
    facts.push(synthetic)
  }

  return facts.sort((a, b) => {
    if (a.productionOrderId !== b.productionOrderId) {
      return a.productionOrderId.localeCompare(b.productionOrderId)
    }
    if (a.seq !== b.seq) return a.seq - b.seq
    const splitSeqA = a.splitSeq ?? 0
    const splitSeqB = b.splitSeq ?? 0
    if (splitSeqA !== splitSeqB) return splitSeqA - splitSeqB
    return (a.taskNo || a.taskId).localeCompare(b.taskNo || b.taskId)
  })
}

export function getExecutionTaskFactById(taskId: string): ProcessTask | null {
  return listExecutionTaskFacts().find((task) => task.taskId === taskId) ?? null
}

export function toExecutionTaskFact(task: ProcessTask): ExecutionTaskFact {
  return {
    ...task,
    displayStageName: getTaskStageDisplayName(task),
    displayProcessName: getTaskProcessDisplayName(task),
    displayTaskType: getTaskTypeDisplayName(task),
    displayGranularity: getTaskGranularityDisplayName(task),
  }
}
