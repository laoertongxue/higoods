// 工序/工艺单实例 - ProcessTask

import {
  getProcessTypeByCode,
  type AssignmentMode,
  type ProcessStage,
} from './process-types.ts'
import type { OwnerSuggestion } from './routing-templates.ts'
import {
  generateTaskArtifactsForAllOrders,
  type GeneratedTaskArtifact,
} from './production-artifact-generation.ts'
import {
  buildTaskGenerationPreview,
  type CoveredProcessScope,
  type FactoryAcceptanceMode,
  type GeneratedTaskUnitPreview,
  type PdaStepTemplateCode,
  type ProductionTaskGenerationPreview,
  type ProductionTaskUnitType,
} from './production-task-generation-rules.ts'
import { buildTaskQrValue } from './task-qr.ts'
import type {
  DetailSplitDimension,
  DetailSplitMode,
  RuleSource,
} from './process-craft-dict.ts'
import {
  generateTaskDetailRowsForArtifact,
  type TaskDetailRow,
} from './task-detail-rows.ts'
import {
  OWN_WOOL_FACTORY_ID,
  OWN_WOOL_FACTORY_NAME,
} from './factory-mock-data.ts'
import type { DispatchAcceptanceSlaRuleSource } from './dispatch-acceptance-sla.ts'
import { productionOrders, type ProductionOrderStatus } from './production-orders.ts'

export type TaskAssignmentStatus = 'UNASSIGNED' | 'ASSIGNING' | 'ASSIGNED' | 'BIDDING' | 'AWARDED'
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED'
export type QtyUnit = 'PIECE' | 'BUNDLE' | 'METER'
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type OutputValueDifficulty = 'LOW' | 'MEDIUM' | 'HIGH'
export type BlockReason = 'MATERIAL' | 'CAPACITY' | 'QUALITY' | 'TECH' | 'EQUIPMENT' | 'OTHER' | 'ALLOCATION_GATE'
export type AcceptanceStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type MilestoneStatus = 'PENDING' | 'REPORTED'
export type PauseStatus = 'NONE' | 'REPORTED' | 'FOLLOWING_UP'
export type PauseReasonCode = 'CUTTING_ISSUE' | 'MATERIAL_ISSUE' | 'TECH_DOC_ISSUE' | 'EQUIPMENT_ISSUE' | 'STAFF_ISSUE' | 'OTHER'
export type MilestoneProofRequirement = 'NONE' | 'IMAGE' | 'VIDEO' | 'IMAGE_OR_VIDEO'
export type MilestoneExceptionSeverity = 'S1' | 'S2' | 'S3'
export type TaskQrStatus = 'ACTIVE' | 'VOIDED'
export type TaskHandoverAutoCreatePolicy = 'CREATE_ON_START'
export type TaskReceiverKind = 'WAREHOUSE' | 'MANAGED_POST_FACTORY'
export type TaskHandoverStatus =
  | 'NOT_CREATED'
  | 'AUTO_CREATED'
  | 'OPEN'
  | 'PARTIAL_SUBMITTED'
  | 'WAIT_RECEIVER_WRITEBACK'
  | 'PARTIAL_WRITTEN_BACK'
  | 'WRITTEN_BACK'
  | 'DIFF_WAIT_FACTORY_CONFIRM'
  | 'HAS_OBJECTION'
  | 'OBJECTION_PROCESSING'
  | 'CLOSED'

export interface TaskOutputValueSnapshot {
  outputValuePerUnit?: number
  outputValueUnit?: string
  totalOutputValue?: number
}

export interface TaskAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface TaskAttachment {
  name: string
  url: string
}

export interface StartProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

export type ExecProofFile = StartProofFile

export interface ProcessTask {
  taskId: string
  taskNo?: string
  productionOrderId: string
  seq: number
  processCode: string
  processNameZh: string
  stage: ProcessStage
  qty: number
  qtyUnit: QtyUnit
  assignmentMode: AssignmentMode
  assignmentStatus: TaskAssignmentStatus
  ownerSuggestion: OwnerSuggestion
  assignedFactoryId?: string
  tenderId?: string
  qcPoints: string[]
  taskOutputValue?: number
  difficulty?: TaskDifficulty
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: OutputValueDifficulty
  outputValueSource?: 'TECH_PACK_PROCESS_ENTRY'
  attachments: TaskAttachment[]
  status: TaskStatus
  // 直接派单信息
  assignedFactoryName?: string
  acceptDeadline?: string       // 接单截止时间
  taskDeadline?: string         // 任务截止时间
  dispatchRemark?: string       // 派单备注
  dispatchedAt?: string         // 派单时间
  dispatchedBy?: string         // 派单人
  // 价格已完成
  standardPrice?: number        // 工序标准价快照
  standardPriceCurrency?: string // 工序标准价币种（默认 IDR）
  standardPriceUnit?: string    // 工序标准价单位（默认 件）
  dispatchPrice?: number        // 直接派单价
  dispatchPriceCurrency?: string
  dispatchPriceUnit?: string
  priceDiffReason?: string      // 价格偏差原因
  // 接单状态（工厂确认）
  acceptanceStatus?: AcceptanceStatus
  acceptedAt?: string
  awardedAt?: string
  acceptedBy?: string
  dispatchAcceptanceSlaConfigId?: string
  dispatchAcceptanceSlaOverrideId?: string
  dispatchAcceptanceSlaRuleSource?: DispatchAcceptanceSlaRuleSource
  dispatchAcceptanceTimeoutHours?: number
  dispatchAcceptanceSlaLabel?: string
  startDueAt?: string
  startDueSource?: 'ACCEPTED' | 'AWARDED'
  startRiskStatus?: 'NORMAL' | 'DUE_SOON' | 'OVERDUE'
  startHeadcount?: number
  startProofFiles?: StartProofFile[]
  startOverdueExceptionId?: string | null
  // 关键节点上报（证明真开工）
  milestoneRuleType?: string
  milestoneRuleLabel?: string
  milestoneTargetQty?: number
  milestoneTargetUnit?: 'PIECE' | 'YARD'
  milestoneRequired?: boolean
  milestoneStatus?: MilestoneStatus
  milestoneReportedAt?: string | null
  milestoneReportedQty?: number | null
  milestoneProofFiles?: ExecProofFile[]
  milestoneProofRequirement?: MilestoneProofRequirement
  milestoneOverdueExceptionEnabled?: boolean
  milestoneOverdueHours?: number
  milestoneExceptionSeverity?: MilestoneExceptionSeverity
  milestoneOverdueExceptionId?: string | null
  // 上报暂停（工厂上报，平台决定是否允许继续）
  pauseStatus?: PauseStatus
  pauseReasonCode?: PauseReasonCode | null
  pauseReasonLabel?: string | null
  pauseRemark?: string | null
  pauseReportedAt?: string | null
  pauseProofFiles?: ExecProofFile[]
  pauseExceptionId?: string | null
  // 时间戳
  startedAt?: string
  finishedAt?: string
  // 生产暂停信息
  blockReason?: BlockReason
  blockRemark?: string
  blockedAt?: string
  taskQrValue?: string
  taskQrStatus?: TaskQrStatus
  handoverAutoCreatePolicy?: TaskHandoverAutoCreatePolicy
  handoverOrderId?: string
  handoverStatus?: TaskHandoverStatus
  receiverKind?: TaskReceiverKind
  receiverId?: string
  receiverName?: string
  // 上一步依赖（当前生产暂停）
  dependsOnTaskIds?: string[]
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  blockNoteZh?: string            // 开始条件中文原因（ALLOCATION_GATE 时写入）
  // 领料需求挂接（生产单管理确认后写入）
  hasMaterialRequest?: boolean
  materialRequestNo?: string
  materialMode?: 'warehouse_delivery' | 'factory_pickup'
  materialModeLabel?: '仓库配送到厂' | '工厂到仓自提'
  materialRequestStatus?: '待配料' | '待配送' | '待自提' | '已完成'
  // 质量处理关联
  parentTaskId?: string
  sourceQcId?: string
  sourceTaskId?: string              // 来源原任务ID
  sourceProductionOrderId?: string   // 来源生产单ID
  taskKind?: 'NORMAL'
  taskCategoryZh?: string            // 任务分类展示
  // 生产单任务生成规则追溯字段
  taskUnitType?: ProductionTaskUnitType
  acceptanceMode?: FactoryAcceptanceMode
  generationRuleId?: string
  generationRuleName?: string
  coveredProcesses?: CoveredProcessScope[]
  isMergedTaskUnit?: boolean
  allowAutoDispatch?: boolean
  pdaStepTemplateCode?: PdaStepTemplateCode
  handoverReceiverKind?: 'WAREHOUSE'
  handoverReceiverName?: string
  saleTypeSnapshot?: string
  // 第3步统一生成引擎追溯字段
  sourceEntryId?: string
  sourceEntryType?: 'PROCESS_BASELINE' | 'CRAFT'
  stageCode?: 'PREP' | 'PROD' | 'POST'
  stageName?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
  selectedTargetObject?: string
  taskScope?: 'EXTERNAL_TASK' | 'POST_ROLLUP_TASK'
  rolledUpChildProcessCodes?: string[]
  rolledUpChildProcessNames?: string[]
  assignmentGranularity?: 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
  ruleSource?: RuleSource
  detailSplitMode?: DetailSplitMode
  detailSplitDimensions?: DetailSplitDimension[]
  detailRows?: TaskDetailRow[]
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  splitSeq?: number
  detailRowKeys?: string[]
  isSplitResult?: boolean
  isSplitSource?: boolean
  executionEnabled?: boolean
  defaultDocType?: 'DEMAND' | 'TASK'
  taskTypeMode?: 'PROCESS' | 'CRAFT'
  isSpecialCraft?: boolean
  woolTaskType?: 'WHOLE_GARMENT' | 'PART_PANEL'
  woolKind?: 'WHOLE_GARMENT' | 'PART_PANEL'
  woolKindLabel?: string
  woolOrderId?: string
  woolOrderNo?: string
  woolDownstreamTarget?: '后道工厂' | '裁床待交出仓'
  yarnSku?: string
  yarnPlannedWeightKg?: number
  yarnReceivedWeightKg?: number
  requiresFeiTicket?: boolean
  packagingRequired?: boolean
  materialIssueMode?: 'WAREHOUSE_DELIVERY'
  mockReceiveSummary?: string
  mockExecutionSummary?: string
  mockHandoverSummary?: string
  mockStartPrerequisiteMet?: boolean
  createdAt: string
  updatedAt: string
  auditLogs: TaskAuditLog[]
}

// 预置工序任务（base task seeds）
// 说明：这里仍然保持“整单工序任务”语义，运行时按 SKU/COLOR/ORDER 展开由 runtime-process-tasks.ts 负责。
const GENERATED_TASK_CREATED_AT = '2026-03-01 00:00:00'
const TASK_FACT_BLOCKED_ORDER_STATUSES = new Set<ProductionOrderStatus>(['DRAFT', 'READY_FOR_BREAKDOWN'])

function canOrderEnterGeneratedTaskFacts(orderId: string): boolean {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) return false
  if (!order.taskBreakdownSummary.isBrokenDown) return false
  return !TASK_FACT_BLOCKED_ORDER_STATUSES.has(order.status)
}

function isPositiveRouteNo(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function buildRouteTaskDependencyIds<T extends {
  taskId: string
  seq?: number
  routeStepNo?: number
  routeLaneNo?: number
}>(tasks: T[]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const ordered = tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      const leftHasRoute = isPositiveRouteNo(left.task.routeStepNo) && isPositiveRouteNo(left.task.routeLaneNo)
      const rightHasRoute = isPositiveRouteNo(right.task.routeStepNo) && isPositiveRouteNo(right.task.routeLaneNo)
      if (leftHasRoute && rightHasRoute) {
        const stepCompare = (left.task.routeStepNo as number) - (right.task.routeStepNo as number)
        if (stepCompare !== 0) return stepCompare
        const laneCompare = (left.task.routeLaneNo as number) - (right.task.routeLaneNo as number)
        if (laneCompare !== 0) return laneCompare
      }
      const seqCompare = (left.task.seq ?? left.index) - (right.task.seq ?? right.index)
      if (seqCompare !== 0) return seqCompare
      return left.task.taskId.localeCompare(right.task.taskId)
    })

  let index = 0
  let previousStepTasks: T[] = []
  while (index < ordered.length) {
    const current = ordered[index]
    const hasRoute = isPositiveRouteNo(current.task.routeStepNo) && isPositiveRouteNo(current.task.routeLaneNo)
    const stepNo = hasRoute ? current.task.routeStepNo : undefined
    const currentStepTasks: T[] = []
    while (index < ordered.length) {
      const item = ordered[index]
      const itemHasRoute = isPositiveRouteNo(item.task.routeStepNo) && isPositiveRouteNo(item.task.routeLaneNo)
      if (currentStepTasks.length > 0) {
        if (!hasRoute || !itemHasRoute || item.task.routeStepNo !== stepNo) break
      }
      if (!hasRoute && currentStepTasks.length > 0) break
      currentStepTasks.push(item.task)
      index += 1
      if (!hasRoute) break
    }

    const dependencies = previousStepTasks.map((task) => task.taskId)
    currentStepTasks.forEach((task) => {
      result.set(task.taskId, [...dependencies])
    })
    previousStepTasks = currentStepTasks
  }

  return result
}
const PROCESS_TASK_MOCK_PRODUCTION_ORDER_IDS = ['PO-202603-0001', 'PO-202603-0005', 'PO-202603-084']
const DEFAULT_OUTPUT_VALUE_UNIT_BY_QTY_UNIT: Record<QtyUnit, string> = {
  PIECE: '产值/件',
  BUNDLE: '产值/打',
  METER: '产值/米',
}

export interface TaskGenerationRuntimeRecord {
  productionOrderId: string
  preview: ProductionTaskGenerationPreview
  taskIds: string[]
  independentRequirementCount: number
  independentWorkOrderCount: number
  recordedAt: string
}

const taskGenerationRuntimeRecords = new Map<string, TaskGenerationRuntimeRecord>()

function pickProcessTaskMocks(tasks: ProcessTask[]): ProcessTask[] {
  const preferredOrder = new Map(PROCESS_TASK_MOCK_PRODUCTION_ORDER_IDS.map((orderId, index) => [orderId, index]))
  const pickedTasks = tasks.filter((task) => preferredOrder.has(task.productionOrderId))
  const scopedTasks = pickedTasks.length >= PROCESS_TASK_MOCK_PRODUCTION_ORDER_IDS.length ? pickedTasks : tasks

  return [...scopedTasks]
    .sort((a, b) => {
      const orderA = preferredOrder.get(a.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      const orderB = preferredOrder.get(b.productionOrderId) ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return a.seq - b.seq
    })
    .slice(0, PROCESS_TASK_MOCK_PRODUCTION_ORDER_IDS.length)
    .map((task, index) => ({
      ...task,
      seq: index + 1,
    }))
}

function roundOutputValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 1000) / 1000
}

function normalizeOutputValueValue(value: number | undefined): number | undefined {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined
  return roundOutputValue(normalized)
}

export function resolveOutputValueMeasureQty(input: {
  qty: number
  detailRows?: TaskDetailRow[]
  outputValueUnit?: string
}): number {
  const qty = Math.max(input.qty, 0)
  const detailRows = input.detailRows ?? []
  const normalizedUnit = input.outputValueUnit?.trim() || '产值/件'
  const detailQty = roundOutputValue(
    detailRows.reduce((sum, row) => sum + (Number.isFinite(row.qty) ? row.qty : 0), 0),
  )

  if (normalizedUnit === '产值/打') {
    return roundOutputValue(qty / 12)
  }

  if (normalizedUnit === '产值/米') {
    return detailQty > 0 ? detailQty : roundOutputValue(qty)
  }

  if (normalizedUnit === '产值/批') {
    if (detailRows.length > 0) return detailRows.length
    return qty > 0 ? 1 : 0
  }

  return roundOutputValue(qty)
}

export function calculateOutputValueTotal(input: {
  qty: number
  detailRows?: TaskDetailRow[]
  outputValuePerUnit?: number
  outputValueUnit?: string
}): number {
  const outputValuePerUnit = Number.isFinite(input.outputValuePerUnit)
    ? Number(input.outputValuePerUnit)
    : 0
  if (outputValuePerUnit <= 0) return 0
  const measureQty = resolveOutputValueMeasureQty(input)
  return roundOutputValue(measureQty * outputValuePerUnit)
}

export function resolveTaskOutputValueSnapshot(task: Pick<
  ProcessTask,
  'qty' | 'detailRows' | 'taskOutputValue' | 'outputValuePerUnit' | 'outputValueUnit' | 'outputValueTotal'
>): TaskOutputValueSnapshot {
  const outputValuePerUnit = normalizeOutputValueValue(
    Number.isFinite(task.outputValuePerUnit) ? Number(task.outputValuePerUnit) : task.taskOutputValue,
  )
  const outputValueUnit = outputValuePerUnit ? task.outputValueUnit?.trim() || '产值/件' : undefined
  const fallbackTotal =
    outputValuePerUnit && outputValueUnit
      ? calculateOutputValueTotal({
          qty: Math.max(task.qty, 0),
          detailRows: task.detailRows,
          outputValuePerUnit: outputValuePerUnit,
          outputValueUnit: outputValueUnit,
        })
      : undefined

  return {
    outputValuePerUnit,
    outputValueUnit,
    totalOutputValue: normalizeOutputValueValue(task.outputValueTotal) ?? normalizeOutputValueValue(fallbackTotal),
  }
}

export function sumTaskOutputValueTotals(
  tasks: Array<
    Pick<
      ProcessTask,
      'qty' | 'detailRows' | 'taskOutputValue' | 'outputValuePerUnit' | 'outputValueUnit' | 'outputValueTotal'
    >
  >,
): number | undefined {
  let total = 0
  let hasValue = false

  for (const task of tasks) {
    const snapshot = resolveTaskOutputValueSnapshot(task)
    if (snapshot.totalOutputValue === undefined) continue
    total += snapshot.totalOutputValue
    hasValue = true
  }

  return hasValue ? roundOutputValue(total) : undefined
}

function mapOutputValueDifficultyToTaskDifficulty(value: OutputValueDifficulty): TaskDifficulty {
  if (value === 'LOW') return 'EASY'
  if (value === 'HIGH') return 'HARD'
  return 'MEDIUM'
}

function mapTaskDifficultyToOutputValueDifficulty(value: TaskDifficulty | undefined): OutputValueDifficulty {
  if (value === 'EASY') return 'LOW'
  if (value === 'HARD') return 'HIGH'
  return 'MEDIUM'
}

export function ensureProcessTaskOutputValue(task: ProcessTask): ProcessTask {
  const outputValuePerUnit = Number.isFinite(task.outputValuePerUnit)
    ? Number(task.outputValuePerUnit)
    : Number.isFinite(task.taskOutputValue)
      ? Number(task.taskOutputValue)
      : 0
  const outputValueUnit = task.outputValueUnit?.trim()
    || DEFAULT_OUTPUT_VALUE_UNIT_BY_QTY_UNIT[task.qtyUnit]
    || '产值/件'
  const outputValueDifficulty = task.outputValueDifficulty || mapTaskDifficultyToOutputValueDifficulty(task.difficulty)
  const calculatedOutputValueTotal = calculateOutputValueTotal({
    qty: Math.max(task.qty, 0),
    detailRows: task.detailRows,
    outputValuePerUnit,
    outputValueUnit,
  })
  const outputValueTotal =
    calculatedOutputValueTotal > 0
      ? calculatedOutputValueTotal
      : normalizeOutputValueValue(task.outputValueTotal) ?? 0

  task.taskOutputValue = outputValuePerUnit
  task.outputValuePerUnit = outputValuePerUnit
  task.outputValueUnit = outputValueUnit
  task.outputValueTotal = outputValueTotal
  task.outputValueDifficulty = outputValueDifficulty
  task.difficulty = task.difficulty || mapOutputValueDifficultyToTaskDifficulty(outputValueDifficulty)

  return task
}

function mapArtifactToTaskStage(artifact: GeneratedTaskArtifact): ProcessStage {
  const mappedBySystemCode = getProcessTypeByCode(artifact.systemProcessCode)?.stage
  if (mappedBySystemCode) return mappedBySystemCode
  if (artifact.stageCode === 'PREP') return 'PREP'
  if (artifact.stageCode === 'POST') return 'POST'
  if (artifact.processCode === 'WOOL') return 'SPECIAL'
  if (artifact.processCode === 'CUT_PANEL') return 'CUTTING'
  if (artifact.isSpecialCraft || artifact.processCode === 'SPECIAL_CRAFT') return 'SPECIAL'
  return 'SEWING'
}

function toGeneratedOwnerSuggestion(artifact: GeneratedTaskArtifact): OwnerSuggestion {
  if (artifact.processCode === 'WOOL') {
    return {
      kind: 'RECOMMENDED_FACTORY_POOL',
      recommendedTier: 'CENTRAL',
      recommendedTypes: ['FINISHING'],
    }
  }

  if (artifact.isSpecialCraft) {
    return {
      kind: 'RECOMMENDED_FACTORY_POOL',
      recommendedTier: 'CENTRAL',
      recommendedTypes: ['SPECIAL_PROCESS'],
    }
  }

  if (artifact.stageCode === 'POST') {
    return {
      kind: 'RECOMMENDED_FACTORY_POOL',
      recommendedTier: 'ANY',
      recommendedTypes: ['FINISHING', 'WAREHOUSE'],
    }
  }

  return { kind: 'MAIN_FACTORY' }
}

function resolveGeneratedTaskReceiver(artifact: GeneratedTaskArtifact): Pick<
  ProcessTask,
  'receiverKind' | 'receiverId' | 'receiverName'
> {
  if (artifact.processCode === 'WOOL') {
    if (artifact.woolTaskType === 'PART_PANEL' || artifact.craftName === '部位毛织') {
      return {
        receiverKind: 'WAREHOUSE',
        receiverId: 'WH-CUTTING-WAIT-HANDOVER',
        receiverName: '裁床待交出仓',
      }
    }

    return {
      receiverKind: 'MANAGED_POST_FACTORY',
      receiverId: 'POST-FACTORY-OWN',
      receiverName: '后道工厂',
    }
  }

  if (artifact.processCode === 'SEW') {
    return {
      receiverKind: 'MANAGED_POST_FACTORY',
      receiverId: 'POST-FACTORY-OWN',
      receiverName: '我方后道工厂',
    }
  }

  if (artifact.processCode === 'CUT_PANEL') {
    return {
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-CUT-PIECE',
      receiverName: '裁片仓',
    }
  }

  if (artifact.processCode === 'POST_FINISHING') {
    return {
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-GARMENT-HANDOFF',
      receiverName: '成衣仓交接点',
    }
  }

  return {
    receiverKind: 'WAREHOUSE',
    receiverId: 'WH-TRANSFER',
    receiverName: '中转区域',
  }
}

function resolveWoolTaskType(artifact: GeneratedTaskArtifact): 'WHOLE_GARMENT' | 'PART_PANEL' {
  if (artifact.woolTaskType) return artifact.woolTaskType
  if (artifact.craftName === '部位毛织' || artifact.taskTypeLabel === '部位毛织') return 'PART_PANEL'
  return 'WHOLE_GARMENT'
}

function isMergedTaskUnit(unit: GeneratedTaskUnitPreview | undefined): boolean {
  return unit?.taskUnitType === 'COMBINED_PROCESS_TASK' || unit?.taskUnitType === 'WHOLE_ORDER_TASK'
}

function resolveTaskUnitAcceptanceMode(unitType: ProductionTaskUnitType): FactoryAcceptanceMode {
  if (unitType === 'WHOLE_ORDER_TASK') return 'WHOLE_ORDER'
  if (unitType === 'COMBINED_PROCESS_TASK') return 'CONTINUOUS_PROCESS'
  return 'SINGLE_PROCESS'
}

function cloneCoveredProcesses(processes: CoveredProcessScope[]): CoveredProcessScope[] {
  return processes.map((item) => ({
    ...item,
    sourceArtifactIds: [...item.sourceArtifactIds],
  }))
}

function buildCoveredProcessesFromArtifact(artifact: GeneratedTaskArtifact): CoveredProcessScope[] {
  return [
    {
      processCode: artifact.processCode,
      processName: artifact.processName,
      craftCode: artifact.craftCode,
      craftName: artifact.craftName,
      sourceArtifactIds: [artifact.artifactId],
    },
  ]
}

function buildTaskUnitDetailRows(taskId: string, artifacts: GeneratedTaskArtifact[]): TaskDetailRow[] {
  return artifacts.flatMap((artifact, artifactIndex) =>
    generateTaskDetailRowsForArtifact({
      taskId,
      artifact,
    }).map((row) => ({
      ...row,
      rowKey: `${row.rowKey}__A${artifactIndex + 1}`,
      sortKey: `${String(artifactIndex + 1).padStart(2, '0')}::${row.sortKey}`,
    })),
  )
}

function getMergedTaskUnitPlannedQty(orderId: string, artifacts: GeneratedTaskArtifact[]): number {
  const orderQty = getOrderQty(orderId)
  if (orderQty > 0) return orderQty
  return Math.max(...artifacts.map((artifact) => Math.max(artifact.orderQty, 0)), 0)
}

function getMergedTaskUnitOutputValueTotal(artifacts: GeneratedTaskArtifact[]): number {
  if (artifacts.length === 0) return 0

  return roundOutputValue(artifacts.reduce((sum, artifact) => {
    const artifactRows = generateTaskDetailRowsForArtifact({
      taskId: `MERGED-VALUE-${artifact.artifactId}`,
      artifact,
    })
    const total = calculateOutputValueTotal({
      qty: Math.max(artifact.orderQty, 0),
      detailRows: artifactRows,
      outputValuePerUnit: artifact.outputValuePerUnit,
      outputValueUnit: artifact.outputValueUnit,
    })
    return sum + total
  }, 0))
}

function getMergedTaskUnitStageName(unit: GeneratedTaskUnitPreview | undefined, artifactStageName?: string): string | undefined {
  if (unit?.taskUnitType === 'WHOLE_ORDER_TASK') return '整单任务'
  if (unit?.taskUnitType === 'COMBINED_PROCESS_TASK') return '组合工序任务'
  return artifactStageName
}

function getMergedTaskUnitOutputValueUnit(unit: GeneratedTaskUnitPreview | undefined, artifactOutputValueUnit?: string): string {
  return isMergedTaskUnit(unit) ? '按覆盖工序明细计算' : artifactOutputValueUnit || '产值/件'
}

function resolveTaskUnitProcessCode(unit: GeneratedTaskUnitPreview | undefined, artifact: GeneratedTaskArtifact): string {
  if (unit?.taskUnitType === 'WHOLE_ORDER_TASK') return 'WHOLE_ORDER_TASK'
  if (unit?.taskUnitType === 'COMBINED_PROCESS_TASK') return 'COMBINED_PROCESS_TASK'
  return artifact.systemProcessCode
}

function resolveTaskUnitProcessName(unit: GeneratedTaskUnitPreview | undefined, artifact: GeneratedTaskArtifact): string {
  return unit?.taskName || artifact.processName
}

function resolveTaskUnitStage(unit: GeneratedTaskUnitPreview | undefined, artifact: GeneratedTaskArtifact): ProcessStage {
  if (isMergedTaskUnit(unit)) return 'SEWING'
  return mapArtifactToTaskStage(artifact)
}

function resolveTaskUnitReceiver(unit: GeneratedTaskUnitPreview | undefined, artifact: GeneratedTaskArtifact): Pick<
  ProcessTask,
  'receiverKind' | 'receiverId' | 'receiverName'
> {
  if (isMergedTaskUnit(unit)) {
    return {
      receiverKind: 'WAREHOUSE',
      receiverId: 'WH-TASK-GENERATION-HANDOVER',
      receiverName: unit.handoverReceiverName,
    }
  }

  return resolveGeneratedTaskReceiver(artifact)
}

type TaskEmissionArtifactLike = Pick<GeneratedTaskArtifact, 'artifactId' | 'generationSortKey' | 'sortKey'>
type TaskEmissionUnitLike = Pick<GeneratedTaskUnitPreview, 'previewUnitId' | 'sourceArtifactIds' | 'taskUnitType'>

function getTaskGenerationSortKey(artifact: TaskEmissionArtifactLike): string {
  return artifact.generationSortKey ?? artifact.sortKey
}

export interface GeneratedTaskEmissionPlan<
  TArtifact extends TaskEmissionArtifactLike = GeneratedTaskArtifact,
  TUnit extends TaskEmissionUnitLike = GeneratedTaskUnitPreview,
> {
  artifact: TArtifact
  unit?: TUnit
  unitSourceArtifacts: TArtifact[]
  taskId: string
  stableSeq: number
  seq: number
  emissionKey: string
}

function compareTaskArtifactsForGeneration(left: TaskEmissionArtifactLike, right: TaskEmissionArtifactLike): number {
  const sortCompare = getTaskGenerationSortKey(left).localeCompare(getTaskGenerationSortKey(right))
  if (sortCompare !== 0) return sortCompare
  return left.artifactId.localeCompare(right.artifactId)
}

function compareTaskArtifactsForRoute(left: TaskEmissionArtifactLike, right: TaskEmissionArtifactLike): number {
  const sortCompare = left.sortKey.localeCompare(right.sortKey)
  if (sortCompare !== 0) return sortCompare
  return compareTaskArtifactsForGeneration(left, right)
}

function isMergedTaskEmissionUnit(unit: TaskEmissionUnitLike | undefined): boolean {
  return unit?.taskUnitType === 'COMBINED_PROCESS_TASK' || unit?.taskUnitType === 'WHOLE_ORDER_TASK'
}

function getTaskEmissionKey(artifact: TaskEmissionArtifactLike, unit: TaskEmissionUnitLike | undefined): string {
  return isMergedTaskEmissionUnit(unit) ? `unit:${unit?.previewUnitId}` : `artifact:${artifact.artifactId}`
}

function buildGeneratedTaskId(orderId: string, stableSeq: number): string {
  return `TASKGEN-${orderId.replace('PO-', '')}-${String(stableSeq).padStart(3, '0')}`
}

export function buildGeneratedTaskEmissionPlans<
  TArtifact extends TaskEmissionArtifactLike,
  TUnit extends TaskEmissionUnitLike,
>(
  orderId: string,
  orderArtifacts: TArtifact[],
  generatedUnits: TUnit[],
): GeneratedTaskEmissionPlan<TArtifact, TUnit>[] {
  const findUnit = (artifact: TArtifact): TUnit | undefined =>
    generatedUnits.find((unit) => unit.sourceArtifactIds.includes(artifact.artifactId))
  const stableTaskIds = new Map<string, { taskId: string; stableSeq: number }>()

  for (const artifact of [...orderArtifacts].sort(compareTaskArtifactsForGeneration)) {
    const unit = findUnit(artifact)
    const emissionKey = getTaskEmissionKey(artifact, unit)
    if (stableTaskIds.has(emissionKey)) continue
    const stableSeq = stableTaskIds.size + 1
    stableTaskIds.set(emissionKey, {
      taskId: buildGeneratedTaskId(orderId, stableSeq),
      stableSeq,
    })
  }

  const emittedKeys = new Set<string>()
  const plans: GeneratedTaskEmissionPlan<TArtifact, TUnit>[] = []
  for (const artifact of [...orderArtifacts].sort(compareTaskArtifactsForRoute)) {
    const unit = findUnit(artifact)
    const emissionKey = getTaskEmissionKey(artifact, unit)
    if (emittedKeys.has(emissionKey)) continue
    const stableTask = stableTaskIds.get(emissionKey)
    if (!stableTask) continue
    emittedKeys.add(emissionKey)
    const unitSourceArtifacts = unit
      ? orderArtifacts
          .filter((item) => unit.sourceArtifactIds.includes(item.artifactId))
          .sort(compareTaskArtifactsForRoute)
      : [artifact]
    plans.push({
      artifact,
      unit,
      unitSourceArtifacts,
      taskId: stableTask.taskId,
      stableSeq: stableTask.stableSeq,
      seq: plans.length + 1,
      emissionKey,
    })
  }

  return plans
}

function createGeneratedProcessTasksFromArtifacts(): ProcessTask[] {
  const artifacts = generateTaskArtifactsForAllOrders()
  if (!artifacts.length) return []

  const tasks: ProcessTask[] = []
  const artifactsByOrder = new Map<string, GeneratedTaskArtifact[]>()

  for (const artifact of artifacts) {
    if (!canOrderEnterGeneratedTaskFacts(artifact.orderId)) continue
    const current = artifactsByOrder.get(artifact.orderId) ?? []
    current.push(artifact)
    artifactsByOrder.set(artifact.orderId, current)
  }

  for (const [orderId, orderArtifacts] of artifactsByOrder.entries()) {
    const preview = buildTaskGenerationPreview(orderId)
    const emissionPlans = buildGeneratedTaskEmissionPlans(orderId, orderArtifacts, preview.generatedUnits)
    const currentOrderTasks: ProcessTask[] = []

    emissionPlans.forEach(({ artifact, unit, unitSourceArtifacts, taskId, seq }) => {
      const taskUnitType: ProductionTaskUnitType = unit?.taskUnitType ?? 'SINGLE_PROCESS_TASK'
      const coveredProcesses = unit ? cloneCoveredProcesses(unit.coveredProcesses) : buildCoveredProcessesFromArtifact(artifact)
      const directFactoryAssigned = Boolean(unit && !unit.allowAutoDispatch && unit.assignmentTargetFactoryId)
      const detailRows = buildTaskUnitDetailRows(taskId, unitSourceArtifacts)
      const isMerged = isMergedTaskUnit(unit)
      const outputValuePerUnit = isMerged ? undefined : artifact.outputValuePerUnit
      const outputValueUnit = getMergedTaskUnitOutputValueUnit(unit, artifact.outputValueUnit)
      const outputValueDifficulty = artifact.outputValueDifficulty
      const qty = isMerged ? getMergedTaskUnitPlannedQty(orderId, unitSourceArtifacts) : Math.max(artifact.orderQty, 0)
      const outputValueTotal = isMerged
        ? getMergedTaskUnitOutputValueTotal(unitSourceArtifacts)
        : calculateOutputValueTotal({
            qty,
            detailRows,
            outputValuePerUnit,
            outputValueUnit,
          })
      const isWool = artifact.processCode === 'WOOL'
      const woolTaskType = isWool ? resolveWoolTaskType(artifact) : undefined
      const woolKindLabel = woolTaskType === 'PART_PANEL' ? '部位毛织' : woolTaskType === 'WHOLE_GARMENT' ? '整件毛织' : undefined
      const woolDownstreamTarget = woolTaskType === 'PART_PANEL' ? '裁床待交出仓' : woolTaskType === 'WHOLE_GARMENT' ? '后道工厂' : undefined
      const woolOrderNo = isWool ? `毛织单-${orderId.replace('PO-', '')}-${String(seq).padStart(2, '0')}` : undefined
      const yarnRow = isWool ? detailRows.find((row) => row.sourceRefs.bomItemId) : undefined
      const assignmentMode: AssignmentMode = unit && !unit.allowAutoDispatch
        ? 'DIRECT'
        : artifact.isSpecialCraft
          ? 'BIDDING'
          : 'DIRECT'
      const receiver = resolveTaskUnitReceiver(unit, artifact)
      const processName = resolveTaskUnitProcessName(unit, artifact)
      const processCode = resolveTaskUnitProcessCode(unit, artifact)

      const task: ProcessTask = {
        taskId,
        taskNo: taskId,
        productionOrderId: orderId,
        seq,
        processCode,
        processNameZh: processName,
        stage: resolveTaskUnitStage(unit, artifact),
        qty,
        qtyUnit: 'PIECE',
        assignmentMode,
        assignmentStatus: directFactoryAssigned || isWool ? 'ASSIGNED' : 'UNASSIGNED',
        ownerSuggestion: toGeneratedOwnerSuggestion(artifact),
        assignedFactoryId: directFactoryAssigned ? unit?.assignmentTargetFactoryId : isWool ? OWN_WOOL_FACTORY_ID : undefined,
        assignedFactoryName: directFactoryAssigned ? unit?.assignmentTargetFactoryName : isWool ? OWN_WOOL_FACTORY_NAME : undefined,
        qcPoints: [],
        taskOutputValue: outputValuePerUnit,
        difficulty: mapOutputValueDifficultyToTaskDifficulty(outputValueDifficulty),
        outputValuePerUnit,
        outputValueUnit,
        outputValueTotal,
        outputValueDifficulty,
        outputValueSource: artifact.outputValueSource,
        attachments: [],
        status: isWool ? 'IN_PROGRESS' : 'NOT_STARTED',
        acceptanceStatus: directFactoryAssigned ? 'PENDING' : isWool ? 'ACCEPTED' : undefined,
        acceptedAt: isWool ? '2026-05-09 08:20' : undefined,
        acceptedBy: isWool ? OWN_WOOL_FACTORY_NAME : undefined,
        acceptDeadline: directFactoryAssigned ? '2026-07-01 18:00' : isWool ? '2026-05-09 10:00' : undefined,
        taskDeadline: directFactoryAssigned ? '2026-07-08 18:00' : isWool ? '2026-05-12 20:00' : undefined,
        dispatchRemark: directFactoryAssigned
          ? `${unit?.taskName || processName}由任务生成规则指定${unit?.assignmentTargetFactoryName || '承接工厂'}接单；不进入独立任务自动分配。`
          : isWool
            ? `${woolKindLabel}；染厂/面料仓送料到厂，毛织厂称重确认并上传照片/视频，完成后交${woolDownstreamTarget}`
            : undefined,
        dispatchedAt: directFactoryAssigned ? '2026-06-29 09:00' : isWool ? '2026-05-09 08:00' : undefined,
        dispatchedBy: directFactoryAssigned || isWool ? '系统' : undefined,
        startedAt: isWool ? '2026-05-09 09:00' : undefined,
        startHeadcount: isWool ? 8 : undefined,
        startProofFiles: isWool
          ? [
              {
                id: `start-${taskId}-1`,
                type: 'IMAGE',
                name: `${woolKindLabel}_开工现场.jpg`,
                uploadedAt: '2026-05-09 09:00',
              },
            ]
          : undefined,
        milestoneRequired: isWool,
        milestoneRuleType: isWool ? 'AFTER_FIRST_BATCH' : undefined,
        milestoneRuleLabel: isWool
          ? woolTaskType === 'PART_PANEL'
            ? '横机完成首批部位片后上传照片或视频'
            : '横机完成首批整件后上传照片或视频'
          : undefined,
        milestoneTargetQty: isWool ? (woolTaskType === 'PART_PANEL' ? 80 : 20) : undefined,
        milestoneTargetUnit: isWool ? 'PIECE' : undefined,
        milestoneStatus: isWool ? 'REPORTED' : undefined,
        milestoneReportedAt: isWool ? '2026-05-09 11:30' : undefined,
        milestoneReportedQty: isWool ? (woolTaskType === 'PART_PANEL' ? 86 : 24) : undefined,
        milestoneProofFiles: isWool
          ? [
              {
                id: `milestone-${taskId}-1`,
                type: 'IMAGE',
                name: `${woolKindLabel}_首批节点.jpg`,
                uploadedAt: '2026-05-09 11:30',
              },
            ]
          : undefined,
        milestoneProofRequirement: isWool ? 'IMAGE_OR_VIDEO' : undefined,
        milestoneOverdueExceptionEnabled: isWool,
        milestoneOverdueHours: isWool ? 24 : undefined,
        milestoneExceptionSeverity: isWool ? 'S2' : undefined,
        taskQrValue: buildTaskQrValue(taskId),
        taskQrStatus: 'ACTIVE',
        handoverAutoCreatePolicy: 'CREATE_ON_START',
        handoverStatus: 'NOT_CREATED',
        dependsOnTaskIds: [],
        routeStepNo: artifact.routeStepNo,
        routeLaneNo: artifact.routeLaneNo,
        routeParallelGroupId: artifact.routeParallelGroupId,
        routeParallelGroupName: artifact.routeParallelGroupName,
        routeParallelAcceptanceMode: artifact.routeParallelAcceptanceMode,
        taskKind: 'NORMAL',
        taskCategoryZh: unit?.taskName || artifact.taskTypeLabel,
        taskUnitType,
        acceptanceMode: resolveTaskUnitAcceptanceMode(taskUnitType),
        generationRuleId: preview.matchedRuleId,
        generationRuleName: preview.matchedRuleName,
        coveredProcesses,
        isMergedTaskUnit: isMerged,
        allowAutoDispatch: unit?.allowAutoDispatch ?? true,
        pdaStepTemplateCode: isMerged ? 'SIMPLE_FIVE_STEP' : 'DEFAULT_PROCESS_TASK',
        handoverReceiverKind: unit?.handoverReceiverKind,
        handoverReceiverName: unit?.handoverReceiverName,
        saleTypeSnapshot: preview.saleType,
        sourceEntryId: artifact.sourceEntryId,
        sourceEntryType: artifact.sourceEntryType,
        stageCode: artifact.stageCode,
        stageName: getMergedTaskUnitStageName(unit, artifact.stageName),
        processBusinessCode: isMerged ? taskUnitType : artifact.processCode,
        processBusinessName: processName,
        craftCode: artifact.craftCode,
        craftName: artifact.craftName,
        selectedTargetObject: artifact.selectedTargetObject,
        taskScope: artifact.taskScope,
        rolledUpChildProcessCodes: artifact.rolledUpChildProcessCodes ? [...artifact.rolledUpChildProcessCodes] : undefined,
        rolledUpChildProcessNames: artifact.rolledUpChildProcessNames ? [...artifact.rolledUpChildProcessNames] : undefined,
        assignmentGranularity: artifact.assignmentGranularity,
        ruleSource: artifact.ruleSource,
        detailSplitMode: artifact.detailSplitMode,
        detailSplitDimensions: [...artifact.detailSplitDimensions],
        detailRows,
        rootTaskNo: taskId,
        detailRowKeys: detailRows.map((row) => row.rowKey),
        isSplitResult: false,
        isSplitSource: false,
        executionEnabled: true,
        defaultDocType: artifact.defaultDocType,
        taskTypeMode: artifact.taskTypeMode,
        isSpecialCraft: artifact.isSpecialCraft,
        woolTaskType,
        woolKind: woolTaskType,
        woolKindLabel,
        woolOrderId: isWool ? taskId : undefined,
        woolOrderNo,
        woolDownstreamTarget,
        requiresFeiTicket: isWool ? artifact.requiresFeiTicket || woolTaskType === 'PART_PANEL' : artifact.requiresFeiTicket,
        packagingRequired: isWool ? Boolean(artifact.packagingRequired) : artifact.packagingRequired,
        materialIssueMode: artifact.materialIssueMode,
        yarnSku: yarnRow?.sourceRefs.bomItemId,
        yarnPlannedWeightKg: isWool ? Math.max(artifact.orderQty, 0) * (woolTaskType === 'PART_PANEL' ? 0.08 : 0.48) : undefined,
        yarnReceivedWeightKg: isWool ? Math.max(artifact.orderQty, 0) * (woolTaskType === 'PART_PANEL' ? 0.08 : 0.48) : undefined,
        mockReceiveSummary: isWool ? '染厂/面料仓送料到厂，毛织厂按 kg 称重确认，需上传照片和视频' : undefined,
        mockExecutionSummary: isMerged
          ? `按${coveredProcesses.map((item) => item.processName).join('、')}连续执行，PDA 使用领料、开工、关键节点上报、交出、完工 5 步。`
          : isWool
          ? woolTaskType === 'PART_PANEL'
            ? '横机成片后打印部位毛织菲票，不进入缝盘、熨烫、包装'
            : `横机成片后进入缝盘、熨烫${artifact.packagingRequired ? '、包装' : ''}`
          : undefined,
        mockHandoverSummary: unit ? `完成后交${unit.handoverReceiverName}` : isWool ? `完成后交${woolDownstreamTarget}` : undefined,
        mockStartPrerequisiteMet: isWool ? true : undefined,
        ...receiver,
        createdAt: GENERATED_TASK_CREATED_AT,
        updatedAt: GENERATED_TASK_CREATED_AT,
        auditLogs: [
          {
            id: `GAL-${taskId}-001`,
            action: 'GENERATE',
            detail: `按${preview.matchedRuleName || '默认按工序生成规则'}生成${processName}，覆盖工序：${coveredProcesses.map((item) => item.processName).join('、')}`,
            at: GENERATED_TASK_CREATED_AT,
            by: '系统',
          },
        ],
      }
      tasks.push(task)
      currentOrderTasks.push(task)
    })
    const dependencyMap = buildRouteTaskDependencyIds(currentOrderTasks)
    currentOrderTasks.forEach((task) => {
      task.dependsOnTaskIds = dependencyMap.get(task.taskId) ?? []
    })
  }

  return tasks
}

function createInitialProcessTasks(): ProcessTask[] {
  const generatedTasks = createGeneratedProcessTasksFromArtifacts()
  // processTasks 仅作为“任务单兼容层”，主来源必须是统一生成引擎的 TASK 产物。
  // 字典中每个活跃工艺至少保留 3 条由生产单 + 技术包快照派生的 mock。
  if (!generatedTasks.length) return []
  return generatedTasks.map((task) => ensureProcessTaskOutputValue(task))
}

export const processTasks: ProcessTask[] = createInitialProcessTasks()

function getOrderQty(orderId: string): number {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return order?.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0) ?? 0
}

function buildTaskFromRuntimePreviewUnit(
  preview: ProductionTaskGenerationPreview,
  unit: GeneratedTaskUnitPreview,
  index: number,
): ProcessTask {
  const artifacts = generateTaskArtifactsForAllOrders().filter((artifact) => unit.sourceArtifactIds.includes(artifact.artifactId))
  const primaryArtifact = artifacts[0]
  const taskId = `TASKGEN-RUNTIME-${preview.productionOrderId.replace('PO-', '')}-${String(index + 1).padStart(3, '0')}`
  const detailRows = artifacts.length ? buildTaskUnitDetailRows(taskId, artifacts) : []
  const isMerged = isMergedTaskUnit(unit)
  const assignmentMode: AssignmentMode = unit.allowAutoDispatch ? 'DIRECT' : 'DIRECT'
  const directFactoryAssigned = Boolean(!unit.allowAutoDispatch && unit.assignmentTargetFactoryId)
  const outputValuePerUnit = isMerged ? undefined : primaryArtifact?.outputValuePerUnit
  const outputValueUnit = getMergedTaskUnitOutputValueUnit(unit, primaryArtifact?.outputValueUnit)
  const outputValueDifficulty = primaryArtifact?.outputValueDifficulty ?? 'MEDIUM'
  const qty = isMerged ? getMergedTaskUnitPlannedQty(preview.productionOrderId, artifacts) : Math.max(primaryArtifact?.orderQty ?? getOrderQty(preview.productionOrderId), 0)
  const outputValueTotal = isMerged
    ? getMergedTaskUnitOutputValueTotal(artifacts)
    : calculateOutputValueTotal({
        qty,
        detailRows,
        outputValuePerUnit,
        outputValueUnit,
      })
  const receiver = resolveTaskUnitReceiver(unit, primaryArtifact ?? {
    processCode: unit.taskUnitType,
    processName: unit.taskName,
  } as GeneratedTaskArtifact)

  return ensureProcessTaskOutputValue({
    taskId,
    taskNo: taskId,
    productionOrderId: preview.productionOrderId,
    seq: index + 1,
    processCode: resolveTaskUnitProcessCode(unit, primaryArtifact ?? {
      systemProcessCode: unit.taskUnitType,
    } as GeneratedTaskArtifact),
    processNameZh: unit.taskName,
    stage: resolveTaskUnitStage(unit, primaryArtifact ?? {
      processCode: unit.taskUnitType,
      stageCode: 'PROD',
      isSpecialCraft: false,
    } as GeneratedTaskArtifact),
    qty,
    qtyUnit: 'PIECE',
    assignmentMode,
    assignmentStatus: directFactoryAssigned ? 'ASSIGNED' : 'UNASSIGNED',
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: directFactoryAssigned ? unit.assignmentTargetFactoryId : undefined,
    assignedFactoryName: directFactoryAssigned ? unit.assignmentTargetFactoryName : undefined,
    qcPoints: [],
    taskOutputValue: outputValuePerUnit,
    difficulty: mapOutputValueDifficultyToTaskDifficulty(outputValueDifficulty),
    outputValuePerUnit,
    outputValueUnit,
    outputValueTotal,
    outputValueDifficulty,
    outputValueSource: primaryArtifact?.outputValueSource,
    attachments: [],
    status: 'NOT_STARTED',
    acceptanceStatus: directFactoryAssigned ? 'PENDING' : undefined,
    acceptDeadline: directFactoryAssigned ? '2026-07-01 18:00' : undefined,
    taskDeadline: directFactoryAssigned ? '2026-07-08 18:00' : undefined,
    dispatchRemark: `${unit.taskName}由生产单任务生成规则生成；${unit.allowAutoDispatch ? '进入独立任务自动分配' : '由指定承接工厂处理，不进入独立任务自动分配'}。`,
    dispatchedAt: directFactoryAssigned ? '2026-06-30 09:00' : undefined,
    dispatchedBy: directFactoryAssigned ? '系统' : undefined,
    taskQrValue: buildTaskQrValue(taskId),
    taskQrStatus: 'ACTIVE',
    handoverAutoCreatePolicy: 'CREATE_ON_START',
    handoverStatus: 'NOT_CREATED',
    dependsOnTaskIds: [],
    routeStepNo: primaryArtifact?.routeStepNo,
    routeLaneNo: primaryArtifact?.routeLaneNo,
    routeParallelGroupId: primaryArtifact?.routeParallelGroupId,
    routeParallelGroupName: primaryArtifact?.routeParallelGroupName,
    routeParallelAcceptanceMode: primaryArtifact?.routeParallelAcceptanceMode,
    taskKind: 'NORMAL',
    taskCategoryZh: unit.taskName,
    taskUnitType: unit.taskUnitType,
    acceptanceMode: resolveTaskUnitAcceptanceMode(unit.taskUnitType),
    generationRuleId: preview.matchedRuleId,
    generationRuleName: preview.matchedRuleName,
    coveredProcesses: cloneCoveredProcesses(unit.coveredProcesses),
    isMergedTaskUnit: isMerged,
    allowAutoDispatch: unit.allowAutoDispatch,
    pdaStepTemplateCode: isMerged ? 'SIMPLE_FIVE_STEP' : 'DEFAULT_PROCESS_TASK',
    handoverReceiverKind: unit.handoverReceiverKind,
    handoverReceiverName: unit.handoverReceiverName,
    saleTypeSnapshot: preview.saleType,
    sourceEntryId: primaryArtifact?.sourceEntryId,
    sourceEntryType: primaryArtifact?.sourceEntryType,
    stageCode: primaryArtifact?.stageCode,
    stageName: getMergedTaskUnitStageName(unit, primaryArtifact?.stageName),
    processBusinessCode: isMerged ? unit.taskUnitType : primaryArtifact?.processCode,
    processBusinessName: unit.taskName,
    craftCode: primaryArtifact?.craftCode,
    craftName: primaryArtifact?.craftName,
    selectedTargetObject: primaryArtifact?.selectedTargetObject,
    taskScope: primaryArtifact?.taskScope,
    rolledUpChildProcessCodes: primaryArtifact?.rolledUpChildProcessCodes ? [...primaryArtifact.rolledUpChildProcessCodes] : undefined,
    rolledUpChildProcessNames: primaryArtifact?.rolledUpChildProcessNames ? [...primaryArtifact.rolledUpChildProcessNames] : undefined,
    assignmentGranularity: primaryArtifact?.assignmentGranularity,
    ruleSource: primaryArtifact?.ruleSource,
    detailSplitMode: primaryArtifact?.detailSplitMode,
    detailSplitDimensions: primaryArtifact?.detailSplitDimensions ? [...primaryArtifact.detailSplitDimensions] : [],
    detailRows,
    rootTaskNo: taskId,
    detailRowKeys: detailRows.map((row) => row.rowKey),
    isSplitResult: false,
    isSplitSource: false,
    executionEnabled: true,
    defaultDocType: 'TASK',
    taskTypeMode: primaryArtifact?.taskTypeMode,
    isSpecialCraft: primaryArtifact?.isSpecialCraft,
    mockReceiveSummary: isMerged ? `${unit.taskName}已生成，覆盖工序只展示不拆分。` : undefined,
    mockExecutionSummary: isMerged ? '按领料、开工、关键节点上报、交出、完工 5 步执行。' : undefined,
    mockHandoverSummary: `完成后交${unit.handoverReceiverName}`,
    mockStartPrerequisiteMet: isMerged,
    ...receiver,
    createdAt: GENERATED_TASK_CREATED_AT,
    updatedAt: GENERATED_TASK_CREATED_AT,
    auditLogs: [
      {
        id: `GAL-${taskId}-001`,
        action: 'GENERATE',
        detail: `确认拆解后生成${unit.taskName}，覆盖工序：${unit.coveredProcesses.map((item) => item.processName).join('、')}`,
        at: GENERATED_TASK_CREATED_AT,
        by: '系统',
      },
    ],
  })
}

export function recordTaskGenerationPreview(preview: ProductionTaskGenerationPreview): TaskGenerationRuntimeRecord {
  const existing = taskGenerationRuntimeRecords.get(preview.productionOrderId)
  if (existing) return existing

  const existingTasks = processTasks.filter((task) =>
    task.productionOrderId === preview.productionOrderId
    && task.generationRuleId === preview.matchedRuleId,
  )
  if (existingTasks.length > 0) {
    const record: TaskGenerationRuntimeRecord = {
      productionOrderId: preview.productionOrderId,
      preview,
      taskIds: existingTasks.map((task) => task.taskId),
      independentRequirementCount: preview.independentDemandObjects.length,
      independentWorkOrderCount: 0,
      recordedAt: GENERATED_TASK_CREATED_AT,
    }
    taskGenerationRuntimeRecords.set(preview.productionOrderId, record)
    return record
  }

  const tasks = preview.generatedUnits.map((unit, index) => buildTaskFromRuntimePreviewUnit(preview, unit, index))
  processTasks.push(...tasks)
  const record: TaskGenerationRuntimeRecord = {
    productionOrderId: preview.productionOrderId,
    preview,
    taskIds: tasks.map((task) => task.taskId),
    independentRequirementCount: preview.independentDemandObjects.length,
    independentWorkOrderCount: 0,
    recordedAt: GENERATED_TASK_CREATED_AT,
  }
  taskGenerationRuntimeRecords.set(preview.productionOrderId, record)
  return record
}

export function listTaskGenerationRuntimeRecords(): TaskGenerationRuntimeRecord[] {
  return Array.from(taskGenerationRuntimeRecords.values()).map((record) => ({
    ...record,
    taskIds: [...record.taskIds],
    preview: {
      ...record.preview,
      generatedUnits: record.preview.generatedUnits.map((unit) => ({
        ...unit,
        coveredProcesses: cloneCoveredProcesses(unit.coveredProcesses),
        sourceArtifactIds: [...unit.sourceArtifactIds],
        independentProcessCodes: [...unit.independentProcessCodes],
        pdaSteps: [...unit.pdaSteps],
      })),
      independentDemandObjects: record.preview.independentDemandObjects.map((item) => ({
        ...item,
        sourceArtifactIds: [...item.sourceArtifactIds],
      })),
      blockedReasons: [...record.preview.blockedReasons],
      warnings: [...record.preview.warnings],
    },
  }))
}

// 根据生产单ID获取任务列表
export function getTasksByOrderId(productionOrderId: string): ProcessTask[] {
  return processTasks.filter(t => t.productionOrderId === productionOrderId).sort((a, b) => a.seq - b.seq)
}

// 获取任务汇总
export function getTasksSummary(productionOrderId: string): { directCount: number; biddingCount: number; totalTasks: number; unassignedCount: number } {
  const tasks = getTasksByOrderId(productionOrderId)
  return {
    directCount: tasks.filter(t => t.assignmentMode === 'DIRECT').length,
    biddingCount: tasks.filter(t => t.assignmentMode === 'BIDDING').length,
    totalTasks: tasks.length,
    unassignedCount: tasks.filter(t => t.assignmentStatus === 'UNASSIGNED').length,
  }
}

// 构造任务ID
export function generateTaskId(orderId: string, seq: number): string {
  const orderNum = orderId.replace('PO-', '')
  return `TASK-${orderNum}-${String(seq).padStart(3, '0')}`
}

// 添加任务
export function addTask(task: ProcessTask): void {
  processTasks.push(ensureProcessTaskOutputValue(task))
}

// 批量添加任务
export function addTasks(tasks: ProcessTask[]): void {
  processTasks.push(...tasks.map((task) => ensureProcessTaskOutputValue(task)))
}
