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
  KOL_GOTO_FACTORY_ID,
  KOL_GOTO_FACTORY_NAME,
  OWN_WOOL_FACTORY_ID,
  OWN_WOOL_FACTORY_NAME,
} from './factory-mock-data.ts'
import {
  KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR,
  KOL_GOTO_WHOLE_ORDER_PROCESS_CODE,
  KOL_GOTO_WHOLE_ORDER_TASK_NAME,
  isKolGotoProductionOrder,
  isKolGotoWholeOrderTask,
} from './kol-goto-special-flow.ts'
import type { DispatchAcceptanceSlaRuleSource } from './dispatch-acceptance-sla.ts'
import { productionOrders, type ProductionOrderStatus } from './production-orders.ts'
import type {
  ProcessWorkOrderSourceSnapshot,
  ProcessWorkOrderSourceType,
} from './process-work-order-domain.ts'
import type { WoolAllowedAction } from './wool-domain/queries.ts'

export type TaskAssignmentStatus = 'UNASSIGNED' | 'ASSIGNING' | 'ASSIGNED' | 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED'
export type QtyUnit = 'PIECE' | 'BUNDLE' | 'METER'
export type ProductionTaskUnitType = 'SINGLE_PROCESS_TASK' | 'MERGED_PRODUCTION_TASK' | 'WHOLE_ORDER_TASK'
export interface CoveredProcessScope {
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  sourceArtifactIds: string[]
}
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
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

export type ProcessTaskSourceType = ProcessWorkOrderSourceType

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
  sourceType?: ProcessTaskSourceType
  sourceSnapshot?: ProcessWorkOrderSourceSnapshot
  productionOrderId?: string
  productionOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
  seq: number
  processCode: string
  processNameZh: string
  stage: ProcessStage
  qty: number
  qtyUnit: QtyUnit
  qtyDisplayUnit?: string
  assignmentMode: AssignmentMode
  assignmentStatus: TaskAssignmentStatus
  ownerSuggestion: OwnerSuggestion
  assignedFactoryId?: string
  tenderId?: string
  qcPoints: string[]
  difficulty?: TaskDifficulty
  attachments: TaskAttachment[]
  status: TaskStatus
  // 直接派单信息
  assignedFactoryName?: string
  acceptDeadline?: string       // 接单截止时间
  taskDeadline?: string         // 任务截止时间
  dispatchRemark?: string       // 派单备注
  dispatchedAt?: string         // 派单时间
  dispatchedBy?: string         // 派单人
  businessAssignedAt?: string   // 业务实际分配时间
  assignmentOperatedAt?: string // 派单操作时间
  deliverySlaSnapshotId?: string // 含车缝交付时效快照
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
  blockNoteZh?: string            // 开始条件中文原因（ALLOCATION_GATE 时写入）
  // 接收需求挂接（生产单管理确认后写入）
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
  // 生产任务结构与实际责任范围
  taskUnitType?: ProductionTaskUnitType
  coveredProcesses?: CoveredProcessScope[]
  allowAutoDispatch?: boolean
  saleTypeSnapshot?: string
  pricingMode?: 'FIXED_TOTAL'
  fixedTotalPrice?: number
  fixedTotalPriceCurrency?: 'IDR'
  fixedTotalPriceUnit?: '整单'
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
  historicalAssignment?: boolean
  replacedByRuntimeTaskId?: string
  reassignedAt?: string
  defaultDocType?: 'DEMAND' | 'TASK'
  taskTypeMode?: 'PROCESS' | 'CRAFT'
  isSpecialCraft?: boolean
  woolTaskType?: 'WHOLE_GARMENT' | 'PART_PANEL'
  woolKind?: 'WHOLE_GARMENT' | 'PART_PANEL'
  woolKindLabel?: string
  woolOrderId?: string
  woolOrderNo?: string
  woolStyleNo?: string
  woolStyleImageUrl?: string
  woolOutputSummary?: string
  woolProcessingStatus?: 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
  woolProcessingStatusLabel?: string
  woolRequiredYarnSkus?: string[]
  woolConfirmedYarnSkus?: string[]
  woolMissingYarnSkus?: string[]
  woolReadyOutputSkuCodes?: string[]
  woolDownstreamTarget?: '后道工厂' | '裁床待交出仓'
  woolAllowedActions?: WoolAllowedAction[]
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

export function getProcessTaskQtyDisplayUnit(task: Pick<ProcessTask, 'qtyUnit' | 'qtyDisplayUnit'>): string {
  const exactUnit = task.qtyDisplayUnit?.trim()
  if (exactUnit) return exactUnit
  if (task.qtyUnit === 'PIECE') return '件'
  if (task.qtyUnit === 'BUNDLE') return '打'
  return '米'
}

export function getProcessTaskQtyDisplayMeta(
  task: Pick<ProcessTask, 'qty' | 'qtyUnit' | 'qtyDisplayUnit'>,
): { label: string; valueText: string } {
  const unitLabel = getProcessTaskQtyDisplayUnit(task)
  return {
    label: `本单计划数量（${unitLabel}）`,
    valueText: `本单计划数量：${task.qty} ${unitLabel}`,
  }
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

type TaskEmissionArtifactLike = Pick<GeneratedTaskArtifact, 'artifactId' | 'generationSortKey' | 'sortKey'>
  & Partial<Pick<GeneratedTaskArtifact, 'artifactType' | 'defaultDocType' | 'processCode'>>
type TaskEmissionUnitLike = {
  previewUnitId: string
  sourceArtifactIds: string[]
  taskUnitType: ProductionTaskUnitType
  coveredProcesses?: CoveredProcessScope[]
}

function getTaskGenerationSortKey(artifact: TaskEmissionArtifactLike): string {
  return artifact.generationSortKey ?? artifact.sortKey
}

export interface GeneratedTaskEmissionPlan<
  TArtifact extends TaskEmissionArtifactLike = GeneratedTaskArtifact,
  TUnit extends TaskEmissionUnitLike = TaskEmissionUnitLike,
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
  return unit?.taskUnitType === 'MERGED_PRODUCTION_TASK' || unit?.taskUnitType === 'WHOLE_ORDER_TASK'
}

function isStandaloneWaterSolubleTaskArtifact(artifact: TaskEmissionArtifactLike): boolean {
  return artifact.artifactType === 'TASK'
    && artifact.defaultDocType === 'TASK'
    && artifact.processCode === 'WATER_SOLUBLE'
}

function isolateStandaloneWaterSolubleArtifactsFromMergedUnits<
  TArtifact extends TaskEmissionArtifactLike,
  TUnit extends TaskEmissionUnitLike,
>(orderArtifacts: TArtifact[], generatedUnits: TUnit[]): TUnit[] {
  const standaloneArtifactIds = new Set(
    orderArtifacts
      .filter(isStandaloneWaterSolubleTaskArtifact)
      .map((artifact) => artifact.artifactId),
  )
  if (standaloneArtifactIds.size === 0) return generatedUnits

  return generatedUnits.map((unit) => {
    if (!isMergedTaskEmissionUnit(unit)) return unit
    const sourceArtifactIds = unit.sourceArtifactIds.filter((artifactId) => !standaloneArtifactIds.has(artifactId))
    if (sourceArtifactIds.length === unit.sourceArtifactIds.length) return unit
    const coveredProcesses = unit.coveredProcesses
      ?.map((process) => ({
        ...process,
        sourceArtifactIds: process.sourceArtifactIds.filter((artifactId) => !standaloneArtifactIds.has(artifactId)),
      }))
      .filter((process) => process.sourceArtifactIds.length > 0)
    return {
      ...unit,
      sourceArtifactIds,
      coveredProcesses,
    }
  })
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
  const isolatedGeneratedUnits = isolateStandaloneWaterSolubleArtifactsFromMergedUnits(orderArtifacts, generatedUnits)
  const findUnit = (artifact: TArtifact): TUnit | undefined =>
    isolatedGeneratedUnits.find((unit) => unit.sourceArtifactIds.includes(artifact.artifactId))
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

function buildKolGotoCoveredProcesses(orderArtifacts: GeneratedTaskArtifact[]): CoveredProcessScope[] {
  const coveredByKey = new Map<string, CoveredProcessScope>()
  orderArtifacts
    .filter((artifact) => artifact.processCode !== 'PRINT' && artifact.processCode !== 'DYE')
    .forEach((artifact) => {
      const key = `${artifact.processCode}::${artifact.craftCode || ''}`
      const current = coveredByKey.get(key)
      if (current) {
        current.sourceArtifactIds.push(artifact.artifactId)
        return
      }
      coveredByKey.set(key, {
        processCode: artifact.processCode,
        processName: artifact.processName,
        craftCode: artifact.craftCode,
        craftName: artifact.craftName,
        sourceArtifactIds: [artifact.artifactId],
      })
    })
  return [...coveredByKey.values()]
}

export function buildKolGotoWholeOrderTask(
  productionOrder: (typeof productionOrders)[number],
  createdAt = productionOrder.createdAt,
  createdBy = '系统',
): ProcessTask {
  if (!isKolGotoProductionOrder(productionOrder)) {
    throw new Error(`生产单 ${productionOrder.productionOrderId} 不是 KOL 样衣/样品小单，不能生成 KOL 整单任务`)
  }
  const orderArtifacts = generateTaskArtifactsForAllOrders()
    .filter((artifact) => artifact.orderId === productionOrder.productionOrderId)
  const wholeOrderArtifacts = orderArtifacts.filter(
    (artifact) => artifact.processCode !== 'PRINT' && artifact.processCode !== 'DYE',
  )
  const coveredProcesses = buildKolGotoCoveredProcesses(wholeOrderArtifacts)
  const taskId = `TASK-KOL-${productionOrder.productionOrderId.replace(/^PO-/, '')}`
  const detailRows = buildTaskUnitDetailRows(taskId, wholeOrderArtifacts)
  const qty = productionOrder.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`生产单 ${productionOrder.productionOrderId} 的 KOL 整单任务数量必须大于 0`)
  }
  const saleTypeSnapshot = [...new Set(productionOrder.sourceDemandSnapshots.map((snapshot) => snapshot.saleType))].join('、')

  return {
    taskId,
    taskNo: taskId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    seq: 1,
    processCode: KOL_GOTO_WHOLE_ORDER_PROCESS_CODE,
    processNameZh: KOL_GOTO_WHOLE_ORDER_TASK_NAME,
    stage: 'SEWING',
    qty,
    qtyUnit: 'PIECE',
    qtyDisplayUnit: '件',
    assignmentMode: 'DIRECT',
    assignmentStatus: 'ASSIGNED',
    ownerSuggestion: { kind: 'MAIN_FACTORY' },
    assignedFactoryId: KOL_GOTO_FACTORY_ID,
    assignedFactoryName: KOL_GOTO_FACTORY_NAME,
    qcPoints: [],
    difficulty: 'MEDIUM',
    attachments: [],
    status: 'NOT_STARTED',
    acceptanceStatus: 'ACCEPTED',
    acceptedAt: createdAt,
    acceptedBy: '系统',
    dispatchedAt: createdAt,
    dispatchedBy: '系统',
    businessAssignedAt: createdAt,
    assignmentOperatedAt: createdAt,
    taskDeadline: productionOrder.demandSnapshot.requiredDeliveryDate || undefined,
    dispatchRemark: 'KOL 样衣/样品小单生成生产单时自动分配并自动接收，仅 KOL-GOTO 可执行。',
    taskQrValue: buildTaskQrValue(taskId),
    taskQrStatus: 'ACTIVE',
    handoverStatus: 'NOT_CREATED',
    dependsOnTaskIds: [],
    taskKind: 'NORMAL',
    taskCategoryZh: KOL_GOTO_WHOLE_ORDER_TASK_NAME,
    taskUnitType: 'WHOLE_ORDER_TASK',
    coveredProcesses,
    allowAutoDispatch: false,
    saleTypeSnapshot,
    pricingMode: 'FIXED_TOTAL',
    fixedTotalPrice: KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR,
    fixedTotalPriceCurrency: 'IDR',
    fixedTotalPriceUnit: '整单',
    stageCode: 'PROD',
    stageName: '整单任务',
    processBusinessCode: KOL_GOTO_WHOLE_ORDER_PROCESS_CODE,
    processBusinessName: KOL_GOTO_WHOLE_ORDER_TASK_NAME,
    selectedTargetObject: '整张生产单',
    assignmentGranularity: 'ORDER',
    detailSplitDimensions: [],
    detailRows,
    rootTaskNo: taskId,
    detailRowKeys: detailRows.map((row) => row.rowKey),
    isSplitResult: false,
    isSplitSource: false,
    executionEnabled: true,
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    receiverKind: 'WAREHOUSE',
    receiverId: 'KOL-GARMENT-RECEIVER',
    receiverName: '成衣接收方',
    mockReceiveSummary: '系统已自动分配并接收，接单模块仅供查看。',
    mockExecutionSummary: '仅支持去加工领料、发起交出和完成；首次领料自动开工。',
    mockHandoverSummary: '可多次发起交出，交出数量即加工完成数量。',
    createdAt,
    updatedAt: createdAt,
    auditLogs: [
      {
        id: `GAL-${taskId}-001`,
        action: 'AUTO_BREAKDOWN',
        detail: `生产单自动拆解为 1 张 KOL 整单任务，固定分配 ${KOL_GOTO_FACTORY_NAME} 并自动接收。`,
        at: createdAt,
        by: createdBy,
      },
    ],
  }
}

export function buildGeneratedProcessTasksFromArtifacts(
  includeOrderIds: ReadonlySet<string> = new Set(),
): ProcessTask[] {
  const artifacts = generateTaskArtifactsForAllOrders()
  if (!artifacts.length) return []

  const tasks: ProcessTask[] = []
  const artifactsByOrder = new Map<string, GeneratedTaskArtifact[]>()

  for (const artifact of artifacts) {
    const productionOrder = productionOrders.find((order) => order.productionOrderId === artifact.orderId)
    if (!productionOrder) continue
    if (
      !canOrderEnterGeneratedTaskFacts(artifact.orderId)
      && !isKolGotoProductionOrder(productionOrder)
      && !includeOrderIds.has(artifact.orderId)
    ) continue
    const current = artifactsByOrder.get(artifact.orderId) ?? []
    current.push(artifact)
    artifactsByOrder.set(artifact.orderId, current)
  }

  for (const [orderId, orderArtifacts] of artifactsByOrder.entries()) {
    const productionOrder = productionOrders.find((order) => order.productionOrderId === orderId)
    if (!productionOrder) continue
    if (isKolGotoProductionOrder(productionOrder)) {
      tasks.push(buildKolGotoWholeOrderTask(productionOrder, productionOrder.createdAt, '系统'))
      continue
    }

    const emissionPlans = buildGeneratedTaskEmissionPlans(orderId, orderArtifacts, [])
    const currentOrderTasks: ProcessTask[] = []
    emissionPlans.forEach(({ artifact, unitSourceArtifacts, taskId, seq }) => {
      const coveredProcesses = buildCoveredProcessesFromArtifact(artifact)
      const detailRows = buildTaskUnitDetailRows(taskId, unitSourceArtifacts)
      const qty = Math.max(artifact.orderQty, 0)
      const isWool = artifact.processCode === 'WOOL'
      const woolTaskType = isWool ? resolveWoolTaskType(artifact) : undefined
      const woolKindLabel = woolTaskType === 'PART_PANEL' ? '部位毛织' : woolTaskType === 'WHOLE_GARMENT' ? '整件毛织' : undefined
      const woolDownstreamTarget = woolTaskType === 'PART_PANEL' ? '裁床待交出仓' : woolTaskType === 'WHOLE_GARMENT' ? '后道工厂' : undefined
      const woolOrderNo = isWool ? `毛织单-${orderId.replace('PO-', '')}-${String(seq).padStart(2, '0')}` : undefined
      const assignmentMode: AssignmentMode = artifact.isSpecialCraft ? 'BIDDING' : 'DIRECT'
      const receiver = resolveGeneratedTaskReceiver(artifact)
      const processName = artifact.processName
      const processCode = artifact.systemProcessCode
      const standardPrice = resolveGeneratedTaskStandardPrice(processCode)

      const task: ProcessTask = {
        taskId,
        taskNo: taskId,
        productionOrderId: orderId,
        productionOrderNo: productionOrder.productionOrderNo,
        seq,
        processCode,
        processNameZh: processName,
        stage: mapArtifactToTaskStage(artifact),
        qty,
        qtyUnit: 'PIECE',
        assignmentMode,
        assignmentStatus: isWool ? 'ASSIGNED' : 'UNASSIGNED',
        ownerSuggestion: toGeneratedOwnerSuggestion(artifact),
        assignedFactoryId: isWool ? OWN_WOOL_FACTORY_ID : undefined,
        assignedFactoryName: isWool ? OWN_WOOL_FACTORY_NAME : undefined,
        qcPoints: [],
        difficulty: 'MEDIUM',
        attachments: [],
        status: 'NOT_STARTED',
        standardPrice,
        standardPriceCurrency: 'IDR',
        standardPriceUnit: '件',
        acceptanceStatus: isWool ? 'ACCEPTED' : undefined,
        acceptedAt: isWool ? '2026-05-09 08:20' : undefined,
        acceptedBy: isWool ? OWN_WOOL_FACTORY_NAME : undefined,
        acceptDeadline: isWool ? '2026-05-09 10:00' : undefined,
        taskDeadline: isWool ? '2026-05-12 20:00' : undefined,
        dispatchRemark: isWool
          ? `${woolKindLabel}已分配至毛织工厂；上游任务接单仅用于协作，执行进度以毛织加工单事实为准。`
          : undefined,
        dispatchedAt: isWool ? '2026-05-09 08:00' : undefined,
        dispatchedBy: isWool ? '系统' : undefined,
        taskQrValue: buildTaskQrValue(taskId),
        taskQrStatus: 'ACTIVE',
        handoverAutoCreatePolicy: isWool ? undefined : 'CREATE_ON_START',
        handoverStatus: 'NOT_CREATED',
        dependsOnTaskIds: [],
        routeStepNo: artifact.routeStepNo,
        routeLaneNo: artifact.routeLaneNo,
        routeParallelGroupId: artifact.routeParallelGroupId,
        routeParallelGroupName: artifact.routeParallelGroupName,
        taskKind: 'NORMAL',
        taskCategoryZh: artifact.taskTypeLabel,
        taskUnitType: 'SINGLE_PROCESS_TASK',
        coveredProcesses,
        allowAutoDispatch: true,
        saleTypeSnapshot: productionOrder.demandSnapshot.saleType || '',
        sourceEntryId: artifact.sourceEntryId,
        sourceEntryType: artifact.sourceEntryType,
        stageCode: artifact.stageCode,
        stageName: artifact.stageName,
        processBusinessCode: artifact.processCode,
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
        requiresFeiTicket: isWool ? undefined : artifact.requiresFeiTicket,
        packagingRequired: isWool ? undefined : artifact.packagingRequired,
        materialIssueMode: artifact.materialIssueMode,
        yarnSku: undefined,
        yarnPlannedWeightKg: undefined,
        yarnReceivedWeightKg: undefined,
        mockReceiveSummary: undefined,
        mockExecutionSummary: undefined,
        mockHandoverSummary: undefined,
        mockStartPrerequisiteMet: undefined,
        ...receiver,
        createdAt: GENERATED_TASK_CREATED_AT,
        updatedAt: GENERATED_TASK_CREATED_AT,
        auditLogs: [
          {
            id: `GAL-${taskId}-001`,
            action: 'GENERATE',
            detail: `从统一 TASK 产物生成${processName}，覆盖工序：${coveredProcesses.map((item) => item.processName).join('、')}`,
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
  const generatedTasks = buildGeneratedProcessTasksFromArtifacts()
  // processTasks 仅作为“任务单兼容层”，主来源必须是统一生成引擎的 TASK 产物。
  // 字典中每个活跃工艺至少保留 3 条由生产单 + 技术包快照派生的 mock。
  if (!generatedTasks.length) return []
  return generatedTasks
}

export const processTasks: ProcessTask[] = createInitialProcessTasks()

export type ProcessTaskStoreSnapshot = ProcessTask[]

export function captureProcessTaskStore(): ProcessTaskStoreSnapshot {
  return structuredClone(processTasks)
}

export function restoreProcessTaskStore(snapshot: ProcessTaskStoreSnapshot): void {
  processTasks.splice(0, processTasks.length, ...structuredClone(snapshot))
  notifyProcessTasksMutated()
}

export function upsertKolGotoWholeOrderTask(
  productionOrder: (typeof productionOrders)[number],
  createdAt: string,
  createdBy = '系统',
): ProcessTask {
  const expectedTaskId = `TASK-KOL-${productionOrder.productionOrderId.replace(/^PO-/, '')}`
  const existing = processTasks.find((task) => task.taskId === expectedTaskId)
    ?? processTasks.find((task) =>
      task.productionOrderId === productionOrder.productionOrderId
      && task.taskUnitType === 'WHOLE_ORDER_TASK',
    )
  if (existing) {
    if (!isKolGotoWholeOrderTask(existing, productionOrder)) {
      throw new Error(`生产单 ${productionOrder.productionOrderId} 已存在不符合 KOL 整单结构的任务 ${existing.taskId}`)
    }
    return existing
  }

  const task = buildKolGotoWholeOrderTask(productionOrder, createdAt, createdBy)
  processTasks.push(task)
  notifyProcessTasksMutated()
  return task
}

export function buildProcessTasksForProductionOrder(
  productionOrder: (typeof productionOrders)[number],
  createdAt: string,
  createdBy = '系统',
): ProcessTask[] {
  if (isKolGotoProductionOrder(productionOrder)) {
    return [buildKolGotoWholeOrderTask(productionOrder, createdAt, createdBy)]
  }

  return buildGeneratedProcessTasksFromArtifacts(new Set([productionOrder.productionOrderId]))
    .filter((task) => task.productionOrderId === productionOrder.productionOrderId)
    .map((task) => ({
      ...task,
      createdAt,
      updatedAt: createdAt,
      auditLogs: task.auditLogs.map((log, index) => index === 0
        ? { ...log, at: createdAt, by: createdBy }
        : log),
    }))
}

export function upsertProcessTasksForProductionOrder(
  productionOrder: (typeof productionOrders)[number],
  createdAt: string,
  createdBy = '系统',
): ProcessTask[] {
  if (isKolGotoProductionOrder(productionOrder)) {
    return [upsertKolGotoWholeOrderTask(productionOrder, createdAt, createdBy)]
  }
  const existing = processTasks.filter((task) => task.productionOrderId === productionOrder.productionOrderId)
  if (existing.length > 0) return existing

  const tasks = buildProcessTasksForProductionOrder(productionOrder, createdAt, createdBy)
  if (tasks.length === 0) return []
  processTasks.push(...tasks)
  notifyProcessTasksMutated()
  return tasks
}

export function updateKolGotoWholeOrderTaskExecution(
  taskId: string,
  patch: Partial<Pick<ProcessTask, 'status' | 'startedAt' | 'finishedAt' | 'handoverOrderId' | 'handoverStatus'>>,
  audit: { action: string; detail: string; at: string; by: string },
): ProcessTask {
  const task = processTasks.find((item) => item.taskId === taskId)
  if (!isKolGotoWholeOrderTask(task)) {
    throw new Error(`任务 ${taskId} 不是可更新的 KOL-GOTO 整单任务`)
  }
  Object.assign(task, patch, { updatedAt: audit.at })
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-${taskId}-${audit.action}-${task.auditLogs.length + 1}`,
      ...audit,
    },
  ]
  notifyProcessTasksMutated()
  return structuredClone(task)
}

let processTasksMutatedListener: (() => void) | null = null

export function setProcessTasksMutatedListener(listener: (() => void) | null): void {
  processTasksMutatedListener = listener
}

function notifyProcessTasksMutated(): void {
  processTasksMutatedListener?.()
}

function resolveGeneratedTaskStandardPrice(processCode: string): number | undefined {
  const prices: Record<string, number> = {
    PROC_CUT: 1000,
    PROC_SEW: 1200,
    PROC_IRON_PACK: 2000,
    PROC_LASER_CUT: 1600,
    PROC_SPECIAL_CRAFT: 1800,
    PROC_KUNTIAO: 1500,
    PROC_DALAN: 1600,
    PROC_TANHUA: 1700,
    PROC_DIRECT_PRINT: 2200,
    PROC_DATIAO: 1600,
    PROC_EMBROIDER: 2400,
    PROC_SHELL_EMBROIDER: 2600,
    PROC_PLEAT: 2100,
    PROC_WOOL: 3000,
  }
  return prices[processCode]
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
  processTasks.push(task)
  notifyProcessTasksMutated()
}

// 批量添加任务
export function addTasks(tasks: ProcessTask[]): void {
  processTasks.push(...tasks)
  notifyProcessTasksMutated()
}
