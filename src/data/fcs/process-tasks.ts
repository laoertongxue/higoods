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
import type {
  DetailSplitDimension,
  DetailSplitMode,
  RuleSource,
} from './process-craft-dict.ts'
import {
  generateTaskDetailRowsForArtifact,
  type TaskDetailRow,
} from './task-detail-rows.ts'

export type TaskAssignmentStatus = 'UNASSIGNED' | 'ASSIGNING' | 'ASSIGNED' | 'BIDDING' | 'AWARDED'
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' | 'CANCELLED'
export type QtyUnit = 'PIECE' | 'BUNDLE' | 'METER'
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type PublishedSamDifficulty = 'LOW' | 'MEDIUM' | 'HIGH'
export type BlockReason = 'MATERIAL' | 'CAPACITY' | 'QUALITY' | 'TECH' | 'EQUIPMENT' | 'OTHER' | 'ALLOCATION_GATE'
export type AcceptanceStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type MilestoneStatus = 'PENDING' | 'REPORTED'
export type PauseStatus = 'NONE' | 'REPORTED' | 'FOLLOWING_UP'
export type PauseReasonCode = 'CUTTING_ISSUE' | 'MATERIAL_ISSUE' | 'TECH_DOC_ISSUE' | 'EQUIPMENT_ISSUE' | 'STAFF_ISSUE' | 'OTHER'
export type MilestoneProofRequirement = 'NONE' | 'IMAGE' | 'VIDEO' | 'IMAGE_OR_VIDEO'
export type MilestoneExceptionSeverity = 'S1' | 'S2' | 'S3'

export interface TaskStandardTimeSnapshot {
  standardTimePerUnit?: number
  standardTimeUnit?: string
  totalStandardTime?: number
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
  stdTimeMinutes?: number
  difficulty?: TaskDifficulty
  publishedSamPerUnit?: number
  publishedSamUnit?: string
  publishedSamTotal?: number
  publishedSamDifficulty?: PublishedSamDifficulty
  publishedSamSource?: 'TECH_PACK_PROCESS_ENTRY'
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
  // 上一步依赖（当前生产暂停）
  dependsOnTaskIds?: string[]
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
  // 第3步统一生成引擎追溯字段
  sourceEntryId?: string
  sourceEntryType?: 'PROCESS_BASELINE' | 'CRAFT'
  stageCode?: 'PREP' | 'PROD' | 'POST'
  stageName?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
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
  createdAt: string
  updatedAt: string
  auditLogs: TaskAuditLog[]
}

// 预置工序任务（base task seeds）
// 说明：这里仍然保持“整单工序任务”语义，运行时按 SKU/COLOR/ORDER 展开由 runtime-process-tasks.ts 负责。
const GENERATED_TASK_CREATED_AT = '2026-03-01 00:00:00'
const DEFAULT_PUBLISHED_SAM_UNIT_BY_QTY_UNIT: Record<QtyUnit, string> = {
  PIECE: '分钟/件',
  BUNDLE: '分钟/打',
  METER: '分钟/米',
}

function roundPublishedSam(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 1000) / 1000
}

function normalizeStandardTimeValue(value: number | undefined): number | undefined {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined
  return roundPublishedSam(normalized)
}

export function resolvePublishedSamMeasureQty(input: {
  qty: number
  detailRows?: TaskDetailRow[]
  publishedSamUnit?: string
}): number {
  const qty = Math.max(input.qty, 0)
  const detailRows = input.detailRows ?? []
  const normalizedUnit = input.publishedSamUnit?.trim() || '分钟/件'
  const detailQty = roundPublishedSam(
    detailRows.reduce((sum, row) => sum + (Number.isFinite(row.qty) ? row.qty : 0), 0),
  )

  if (normalizedUnit === '分钟/打') {
    return roundPublishedSam(qty / 12)
  }

  if (normalizedUnit === '分钟/米') {
    return detailQty > 0 ? detailQty : roundPublishedSam(qty)
  }

  if (normalizedUnit === '分钟/批') {
    if (detailRows.length > 0) return detailRows.length
    return qty > 0 ? 1 : 0
  }

  return roundPublishedSam(qty)
}

export function calculatePublishedSamTotal(input: {
  qty: number
  detailRows?: TaskDetailRow[]
  publishedSamPerUnit?: number
  publishedSamUnit?: string
}): number {
  const publishedSamPerUnit = Number.isFinite(input.publishedSamPerUnit)
    ? Number(input.publishedSamPerUnit)
    : 0
  if (publishedSamPerUnit <= 0) return 0
  const measureQty = resolvePublishedSamMeasureQty(input)
  return roundPublishedSam(measureQty * publishedSamPerUnit)
}

export function resolveTaskStandardTimeSnapshot(task: Pick<
  ProcessTask,
  'qty' | 'detailRows' | 'stdTimeMinutes' | 'publishedSamPerUnit' | 'publishedSamUnit' | 'publishedSamTotal'
>): TaskStandardTimeSnapshot {
  const standardTimePerUnit = normalizeStandardTimeValue(
    Number.isFinite(task.publishedSamPerUnit) ? Number(task.publishedSamPerUnit) : task.stdTimeMinutes,
  )
  const standardTimeUnit = standardTimePerUnit ? task.publishedSamUnit?.trim() || '分钟/件' : undefined
  const fallbackTotal =
    standardTimePerUnit && standardTimeUnit
      ? calculatePublishedSamTotal({
          qty: Math.max(task.qty, 0),
          detailRows: task.detailRows,
          publishedSamPerUnit: standardTimePerUnit,
          publishedSamUnit: standardTimeUnit,
        })
      : undefined

  return {
    standardTimePerUnit,
    standardTimeUnit,
    totalStandardTime: normalizeStandardTimeValue(task.publishedSamTotal) ?? normalizeStandardTimeValue(fallbackTotal),
  }
}

export function sumTaskStandardTimeTotals(
  tasks: Array<
    Pick<
      ProcessTask,
      'qty' | 'detailRows' | 'stdTimeMinutes' | 'publishedSamPerUnit' | 'publishedSamUnit' | 'publishedSamTotal'
    >
  >,
): number | undefined {
  let total = 0
  let hasValue = false

  for (const task of tasks) {
    const snapshot = resolveTaskStandardTimeSnapshot(task)
    if (snapshot.totalStandardTime === undefined) continue
    total += snapshot.totalStandardTime
    hasValue = true
  }

  return hasValue ? roundPublishedSam(total) : undefined
}

function mapPublishedSamDifficultyToTaskDifficulty(value: PublishedSamDifficulty): TaskDifficulty {
  if (value === 'LOW') return 'EASY'
  if (value === 'HIGH') return 'HARD'
  return 'MEDIUM'
}

function mapTaskDifficultyToPublishedSamDifficulty(value: TaskDifficulty | undefined): PublishedSamDifficulty {
  if (value === 'EASY') return 'LOW'
  if (value === 'HARD') return 'HIGH'
  return 'MEDIUM'
}

export function ensureProcessTaskPublishedSam(task: ProcessTask): ProcessTask {
  const publishedSamPerUnit = Number.isFinite(task.publishedSamPerUnit)
    ? Number(task.publishedSamPerUnit)
    : Number.isFinite(task.stdTimeMinutes)
      ? Number(task.stdTimeMinutes)
      : 0
  const publishedSamUnit = task.publishedSamUnit?.trim()
    || DEFAULT_PUBLISHED_SAM_UNIT_BY_QTY_UNIT[task.qtyUnit]
    || '分钟/件'
  const publishedSamDifficulty = task.publishedSamDifficulty || mapTaskDifficultyToPublishedSamDifficulty(task.difficulty)
  const publishedSamTotal = calculatePublishedSamTotal({
    qty: Math.max(task.qty, 0),
    detailRows: task.detailRows,
    publishedSamPerUnit,
    publishedSamUnit,
  })

  task.stdTimeMinutes = publishedSamPerUnit
  task.publishedSamPerUnit = publishedSamPerUnit
  task.publishedSamUnit = publishedSamUnit
  task.publishedSamTotal = publishedSamTotal
  task.publishedSamDifficulty = publishedSamDifficulty
  task.difficulty = task.difficulty || mapPublishedSamDifficultyToTaskDifficulty(publishedSamDifficulty)

  return task
}

function mapArtifactToTaskStage(artifact: GeneratedTaskArtifact): ProcessStage {
  const mappedBySystemCode = getProcessTypeByCode(artifact.systemProcessCode)?.stage
  if (mappedBySystemCode) return mappedBySystemCode
  if (artifact.stageCode === 'PREP') return 'PREP'
  if (artifact.stageCode === 'POST') return 'POST'
  if (artifact.processCode === 'CUT_PANEL') return 'CUTTING'
  if (artifact.isSpecialCraft || artifact.processCode === 'SPECIAL_CRAFT') return 'SPECIAL'
  return 'SEWING'
}

function toGeneratedOwnerSuggestion(artifact: GeneratedTaskArtifact): OwnerSuggestion {
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

function createGeneratedProcessTasksFromArtifacts(): ProcessTask[] {
  const artifacts = generateTaskArtifactsForAllOrders()
  if (!artifacts.length) return []

  const tasks: ProcessTask[] = []
  const artifactsByOrder = new Map<string, GeneratedTaskArtifact[]>()

  for (const artifact of artifacts) {
    const current = artifactsByOrder.get(artifact.orderId) ?? []
    current.push(artifact)
    artifactsByOrder.set(artifact.orderId, current)
  }

  for (const [orderId, orderArtifacts] of artifactsByOrder.entries()) {
    orderArtifacts.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    const generatedIds: string[] = []

    orderArtifacts.forEach((artifact, index) => {
      const seq = index + 1
      const taskId = `TASKGEN-${orderId.replace('PO-', '')}-${String(seq).padStart(3, '0')}`
      const detailRows = generateTaskDetailRowsForArtifact({
        taskId,
        artifact,
      })
      const publishedSamPerUnit = artifact.publishedSamPerUnit
      const publishedSamUnit = artifact.publishedSamUnit
      const publishedSamDifficulty = artifact.publishedSamDifficulty
      const publishedSamTotal = calculatePublishedSamTotal({
        qty: Math.max(artifact.orderQty, 0),
        detailRows,
        publishedSamPerUnit,
        publishedSamUnit,
      })
      generatedIds.push(taskId)
      const prevTaskId = generatedIds[index - 1]
      const assignmentMode: AssignmentMode = artifact.isSpecialCraft ? 'BIDDING' : 'DIRECT'

      tasks.push({
        taskId,
        taskNo: taskId,
        productionOrderId: orderId,
        seq,
        processCode: artifact.systemProcessCode,
        processNameZh: artifact.processName,
        stage: mapArtifactToTaskStage(artifact),
        qty: Math.max(artifact.orderQty, 0),
        qtyUnit: 'PIECE',
        assignmentMode,
        assignmentStatus: 'UNASSIGNED',
        ownerSuggestion: toGeneratedOwnerSuggestion(artifact),
        qcPoints: [],
        stdTimeMinutes: publishedSamPerUnit,
        difficulty: mapPublishedSamDifficultyToTaskDifficulty(publishedSamDifficulty),
        publishedSamPerUnit,
        publishedSamUnit,
        publishedSamTotal,
        publishedSamDifficulty,
        publishedSamSource: artifact.publishedSamSource,
        attachments: [],
        status: 'NOT_STARTED',
        dependsOnTaskIds: prevTaskId ? [prevTaskId] : [],
        taskKind: 'NORMAL',
        taskCategoryZh: artifact.taskTypeLabel,
        sourceEntryId: artifact.sourceEntryId,
        sourceEntryType: artifact.sourceEntryType,
        stageCode: artifact.stageCode,
        stageName: artifact.stageName,
        processBusinessCode: artifact.processCode,
        processBusinessName: artifact.processName,
        craftCode: artifact.craftCode,
        craftName: artifact.craftName,
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
        createdAt: GENERATED_TASK_CREATED_AT,
        updatedAt: GENERATED_TASK_CREATED_AT,
        auditLogs: [
          {
            id: `GAL-${taskId}-001`,
            action: 'GENERATE',
            detail: `由技术包配置 ${artifact.sourceEntryId} 统一生成`,
            at: GENERATED_TASK_CREATED_AT,
            by: '系统',
          },
        ],
      })
    })
  }

  return tasks
}

function createInitialProcessTasks(): ProcessTask[] {
  const generatedTasks = createGeneratedProcessTasksFromArtifacts()
  // 第二轮整改：processTasks 仅作为“任务单兼容层”，主来源必须是统一生成引擎的 TASK 产物。
  // 不再将 legacy seed 无感混入主列表，避免页面出现新旧任务事实混杂。
  if (!generatedTasks.length) return []
  return generatedTasks.map((task) => ensureProcessTaskPublishedSam(task))
}

export const processTasks: ProcessTask[] = createInitialProcessTasks()

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

// 生成任务ID
export function generateTaskId(orderId: string, seq: number): string {
  const orderNum = orderId.replace('PO-', '')
  return `TASK-${orderNum}-${String(seq).padStart(3, '0')}`
}

// 添加任务
export function addTask(task: ProcessTask): void {
  processTasks.push(ensureProcessTaskPublishedSam(task))
}

// 批量添加任务
export function addTasks(tasks: ProcessTask[]): void {
  processTasks.push(...tasks.map((task) => ensureProcessTaskPublishedSam(task)))
}
