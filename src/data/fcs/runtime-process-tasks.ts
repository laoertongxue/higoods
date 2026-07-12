import { indonesiaFactories } from './indonesia-factories.ts'
import {
  productionOrders,
  registerProductionOrderSewingFactory,
  selectProductionOrderMainFactory,
  withdrawProductionOrderSewingFactory,
} from './production-orders.ts'
import {
  getProcessAssignmentGranularity,
  type ProcessAssignmentGranularity,
} from './process-types.ts'
import {
  calculateOutputValueTotal,
  processTasks,
  sumTaskOutputValueTotals,
  type AcceptanceStatus,
  type ProcessTask,
  type OutputValueDifficulty,
  type TaskAssignmentStatus,
  type TaskAuditLog,
} from './process-tasks.ts'
import { buildTaskQrValue } from './task-qr.ts'
import {
  KOL_GOTO_FACTORY_ID,
  KOL_GOTO_FACTORY_NAME,
  TEST_FACTORY_ID,
  TEST_FACTORY_NAME,
} from './factory-mock-data.ts'
import type { TaskDetailRow } from './task-detail-rows.ts'
import { installRuntimeTaskReadResolver } from './runtime-task-read-bridge.ts'
import { sumSewingDeliveryConfirmedReceiptQty } from './sewing-delivery-receipt-facts.ts'
import {
  listTaskAllocatableGroups,
  resolveTaskSplitDecision,
  validateAllocatableGroupAssignments,
  type TaskAllocatableGroup,
  type TaskSplitFactoryBucket,
  type TaskAllocatableGroupAssignment,
} from './task-split-dispatch.ts'
import {
  DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY,
  buildDispatchAcceptanceDeadline,
  describeDispatchAcceptanceSlaResolution,
  resolveDispatchAcceptanceSlaForTask,
  type DispatchAcceptanceSlaResolution,
  type DispatchAcceptanceSlaRuleSource,
} from './dispatch-acceptance-sla.ts'
import { listBusinessFactoryMasterRecords } from './factory-master-store.ts'
import type { Factory, FactoryProcessAbility } from './factory-types.ts'
import {
  captureSewingDeliverySlaSnapshotStore,
  classifySewingDeliverySla,
  compareSewingDeliveryDateTimes,
  createSewingDeliverySlaSnapshot,
  formatOperationLocalWallClock,
  getSewingDeliverySlaSnapshot,
  listSewingDeliverySlaSnapshotHistory,
  restoreSewingDeliverySlaSnapshotStore,
  replaceSewingDeliverySlaSnapshot,
  saveSewingDeliverySlaSnapshot,
  type SewingDeliverySlaSnapshot,
} from './sewing-delivery-sla.ts'

export type RuntimeTaskScopeType = ProcessAssignmentGranularity
export type RuntimeExecutorKind = 'EXTERNAL_FACTORY' | 'WAREHOUSE_WORKSHOP'
export type RuntimeTransitionMode = 'RETURN_TO_WAREHOUSE' | 'SAME_FACTORY_CONTINUE' | 'NOT_APPLICABLE'

export interface RuntimeTaskSkuLine {
  skuCode: string
  size: string
  color: string
  qty: number
}

export interface RuntimeProcessTask extends Omit<ProcessTask, 'taskId' | 'dependsOnTaskIds'> {
  taskId: string
  baseTaskId: string
  baseQty: number
  baseDependsOnTaskIds: string[]
  dependsOnTaskIds: string[]
  scopeType: RuntimeTaskScopeType
  scopeKey: string
  scopeLabel: string
  scopeQty: number
  assignedQty?: number
  scopeSkuLines: RuntimeTaskSkuLine[]
  scopeDetailRows: TaskDetailRow[]
  skuCode?: string
  skuColor?: string
  skuSize?: string
  executorKind?: RuntimeExecutorKind
  transitionFromPrev?: RuntimeTransitionMode
  transitionToNext?: RuntimeTransitionMode
  biddingDeadline?: string
  taskNo?: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  splitSeq?: number
  detailRowKeys?: string[]
  isSplitResult?: boolean
  isSplitSource?: boolean
  executionEnabled?: boolean
  mergeSourceTaskIds?: string[]
  mergeCreatedAt?: string
  mergeCreatedBy?: string
}

export interface ResolvedRuntimeOutputValue {
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: OutputValueDifficulty
}

export type RuntimeTaskAllocatableGroup = TaskAllocatableGroup & ResolvedRuntimeOutputValue
export type RuntimeTaskAllocatableGroupAssignment = TaskAllocatableGroupAssignment

interface RuntimeTaskOverride {
  dependsOnTaskIds?: string[]
  assignmentMode?: ProcessTask['assignmentMode']
  assignmentStatus?: TaskAssignmentStatus
  status?: ProcessTask['status']
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: OutputValueDifficulty
  assignedFactoryId?: string
  assignedFactoryName?: string
  startDueAt?: string
  acceptDeadline?: string
  taskDeadline?: string
  dispatchRemark?: string
  dispatchedAt?: string
  dispatchedBy?: string
  businessAssignedAt?: string
  assignmentOperatedAt?: string
  deliverySlaSnapshotId?: string
  standardPrice?: number
  standardPriceCurrency?: string
  standardPriceUnit?: string
  dispatchPrice?: number
  dispatchPriceCurrency?: string
  dispatchPriceUnit?: string
  priceDiffReason?: string
  acceptanceStatus?: AcceptanceStatus
  acceptedAt?: string
  acceptedBy?: string
  startedAt?: string
  finishedAt?: string
  blockReason?: ProcessTask['blockReason']
  blockRemark?: string
  blockedAt?: string
  dispatchAcceptanceSlaConfigId?: string
  dispatchAcceptanceSlaOverrideId?: string
  dispatchAcceptanceSlaRuleSource?: DispatchAcceptanceSlaRuleSource
  dispatchAcceptanceTimeoutHours?: number
  dispatchAcceptanceSlaLabel?: string
  tenderId?: string
  awardedAt?: string
  auditLogs?: TaskAuditLog[]
  updatedAt?: string
  biddingDeadline?: string
  executorKind?: RuntimeExecutorKind
  transitionFromPrev?: RuntimeTransitionMode
  transitionToNext?: RuntimeTransitionMode
  taskNo?: string
  rootTaskNo?: string
  splitGroupId?: string
  splitFromTaskNo?: string
  splitSeq?: number
  detailRowKeys?: string[]
  isSplitResult?: boolean
  isSplitSource?: boolean
  executionEnabled?: boolean
}

interface RuntimeSplitResultPlan {
  taskId: string
  taskNo: string
  splitSeq: number
  detailRowKeys: string[]
  allocatableGroupKeys: string[]
  scopeQty: number
  scopeLabel: string
  scopeSkuLines?: RuntimeTaskSkuLine[]
  scopeDetailRows?: TaskDetailRow[]
  assignmentMode: ProcessTask['assignmentMode']
  assignmentStatus: TaskAssignmentStatus
  assignedFactoryId?: string
  assignedFactoryName?: string
  tenderId?: string
}

interface RuntimeSplitFactoryPlan extends TaskSplitFactoryBucket {
  taskId: string
}

interface RuntimeTaskSplitPlan {
  sourceTaskId: string
  sourceTaskNo: string
  rootTaskNo: string
  splitGroupId: string
  createdAt: string
  createdBy: string
  results: RuntimeSplitResultPlan[]
}

export interface RuntimeFactoryAssignmentValidation {
  valid: boolean
  reason?: string
  conflictedTaskIds?: string[]
}

export interface RuntimeBatchDispatchSelectionValidation {
  valid: boolean
  reason?: string
  productionOrderId?: string
  processCode?: string
  currency?: string
  unit?: string
}

export interface RuntimeAssignmentSummaryByOrder {
  totalTasks: number
  directCount: number
  biddingCount: number
  unassignedCount: number
  directAssignedCount: number
  biddingLaunchedCount: number
  biddingAwardedCount: number
  assignedFactoryCount: number
  rejectedCount: number
  overdueAckCount: number
}

export interface RuntimeTaskSummaryByOrder {
  totalTasks: number
  normalTaskCount: number
  specialTaskCount: number
  stageCounts: Record<'PREP' | 'PROD' | 'POST', number>
}

export interface RuntimeTaskSplitResultSnapshot {
  taskId: string
  taskNo: string
  splitSeq: number
  assignedFactoryId?: string
  assignedFactoryName?: string
  scopeQty: number
  status: RuntimeProcessTask['status']
  detailRowKeys: string[]
}

export interface RuntimeTaskSplitGroupSnapshot {
  splitGroupId: string
  rootTaskNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceStatus: RuntimeProcessTask['status']
  sourceExecutionEnabled: boolean
  resultTasks: RuntimeTaskSplitResultSnapshot[]
  eventAt: string
  statusSummary: string
  factorySummary: string
}

export interface ContinuousRuntimeTaskMergeEvaluation {
  ok: boolean
  message: string
  tasks: RuntimeProcessTask[]
}

export interface RuntimeBatchDispatchInput {
  taskIds: string[]
  factoryId: string
  factoryName: string
  acceptDeadline: string
  taskDeadline: string
  remark: string
  by: string
  dispatchPrice: number
  dispatchPriceCurrency: string
  dispatchPriceUnit: string
  priceDiffReason: string
  autoAccept?: boolean
  businessAssignedAt?: string
  operatedAt?: string
}

export interface RuntimeDirectDispatchMetaInput {
  taskId: string
  factoryId: string
  factoryName: string
  acceptDeadline: string
  taskDeadline: string
  remark: string
  by: string
  dispatchPrice: number
  dispatchPriceCurrency: string
  dispatchPriceUnit: string
  priceDiffReason: string
  dispatchedAt?: string
  businessAssignedAt?: string
  operatedAt?: string
  autoAccept?: boolean
  acceptanceSla?: DispatchAcceptanceSlaResolution
  outputValuePerUnit?: number
  outputValueUnit?: string
  outputValueTotal?: number
  outputValueDifficulty?: OutputValueDifficulty
  writeBackMainFactory?: boolean
}

export interface RuntimeDirectDispatchPreparationTarget {
  task?: RuntimeProcessTask
  assignedQty?: number
  assignmentId?: string
  runtimeTaskId?: string
}

export interface PreparedRuntimeDirectDispatchMeta {
  input: RuntimeDirectDispatchMetaInput
  originalTask: RuntimeProcessTask
  operatedAt: string
  businessAssignedAt: string
  acceptanceSla: DispatchAcceptanceSlaResolution
  acceptDeadline: string
  autoAccept: boolean
  acceptedAt?: string
  acceptedBy?: string
  auditDetail: string
  deliverySlaSnapshot: SewingDeliverySlaSnapshot | null
}

export interface RuntimeDirectDispatchState {
  taskOverrides: Array<[string, RuntimeTaskOverride]>
  splitPlans: Array<[string, RuntimeTaskSplitPlan]>
  auditSeq: number
  dispatchBoardSeedReady: boolean
  productionOrders: Array<(typeof productionOrders)[number]>
  reassignedTasks: Array<[string, RuntimeProcessTask]>
}

export interface RuntimeDetailDispatchInput {
  taskId: string
  assignments: TaskAllocatableGroupAssignment[]
  by: string
}

export interface RuntimeDetailTenderInput {
  taskId: string
  by: string
}

export interface RuntimeTaskTenderAwardInput {
  taskId: string
  factoryId: string
  factoryName: string
  awardedAt: string
  awardedPrice: number
  by: string
}

export interface PreparedRuntimeTaskTenderAward {
  input: RuntimeTaskTenderAwardInput
  originalTask: RuntimeProcessTask
  requiresFactoryAcceptance: boolean
}

export interface RuntimeTaskAssignmentAcceptanceInput {
  factoryId: string
  acceptedAt: string
  acceptedBy: string
  operatedAt?: string
}

export interface RuntimeSewingTaskReassignmentInput {
  sourceTaskId: string
  targetFactoryId: string
  targetFactoryName: string
  businessAssignedAt: string
  operatedAt: string
  reason: string
  by: string
  mainFactoryId?: string
}

export interface RuntimeSewingTaskReassignmentResult {
  ok: boolean
  message: string
  assignmentId?: string
  taskId?: string
  assignedQty?: number
}

const runtimeTaskOverrides = new Map<string, RuntimeTaskOverride>()
const runtimeTaskSplitPlans = new Map<string, RuntimeTaskSplitPlan>()
const runtimeContinuousMergePlans = new Map<string, { taskIds: string[]; mergedTaskId: string; createdAt: string; createdBy: string }>()
const runtimeReassignedTasks = new Map<string, RuntimeProcessTask>()
const SEWING_DELIVERY_SLA_AUTO_ACCEPT_BY = '系统自动接单（含车缝直接派单）'
let runtimeAuditSeq = 0
let dispatchBoardSeedReady = false

export function captureRuntimeDirectDispatchState(): RuntimeDirectDispatchState {
  return {
    taskOverrides: Array.from(runtimeTaskOverrides.entries()).map(([taskId, override]) => [taskId, structuredClone(override)]),
    splitPlans: Array.from(runtimeTaskSplitPlans.entries()).map(([taskId, plan]) => [taskId, structuredClone(plan)]),
    auditSeq: runtimeAuditSeq,
    dispatchBoardSeedReady,
    productionOrders: structuredClone(productionOrders),
    reassignedTasks: Array.from(runtimeReassignedTasks.entries()).map(([id, task]) => [id, structuredClone(task)]),
  }
}

export function restoreRuntimeDirectDispatchState(state: RuntimeDirectDispatchState): void {
  runtimeTaskOverrides.clear()
  runtimeTaskSplitPlans.clear()
  state.taskOverrides.forEach(([taskId, override]) => runtimeTaskOverrides.set(taskId, structuredClone(override)))
  state.splitPlans.forEach(([taskId, plan]) => runtimeTaskSplitPlans.set(taskId, structuredClone(plan)))
  runtimeAuditSeq = state.auditSeq
  dispatchBoardSeedReady = state.dispatchBoardSeedReady
  productionOrders.splice(0, productionOrders.length, ...structuredClone(state.productionOrders))
  runtimeReassignedTasks.clear()
  state.reassignedTasks.forEach(([id, task]) => runtimeReassignedTasks.set(id, structuredClone(task)))
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateLike(value: string): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function normalizeScopeToken(raw: string): string {
  const token = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return token || 'unknown'
}

function normalizeColorLabel(color: string): string {
  const text = color.trim()
  return text || '未识别颜色'
}

function makeRuntimeAuditId(taskId: string): string {
  runtimeAuditSeq += 1
  const cleanTaskId = taskId.replace(/[^A-Za-z0-9]/g, '')
  return `RAL-${cleanTaskId}-${String(runtimeAuditSeq).padStart(6, '0')}`
}

function appendRuntimeAudit(task: RuntimeProcessTask, action: string, detail: string, by: string): TaskAuditLog[] {
  const logs = [...task.auditLogs]
  logs.push({
    id: makeRuntimeAuditId(task.taskId),
    action,
    detail,
    at: nowTimestamp(),
    by,
  })
  return logs
}

function resolveExecutorKindByFactoryId(factoryId?: string): RuntimeExecutorKind {
  if (!factoryId) return 'EXTERNAL_FACTORY'
  const factory = indonesiaFactories.find((item) => item.id === factoryId)
  if (!factory) return 'EXTERNAL_FACTORY'
  if (factory.type === 'WAREHOUSE' || factory.type === 'DISPATCH_CENTER') {
    return 'WAREHOUSE_WORKSHOP'
  }
  return 'EXTERNAL_FACTORY'
}

type RuntimeSewingTaskLike =
  Pick<RuntimeProcessTask, 'processCode' | 'processNameZh'>
  & Partial<Pick<RuntimeProcessTask, 'processBusinessCode' | 'coveredProcesses' | 'acceptanceMode' | 'taskUnitType'>>

export function isRuntimeSewingTask(task: RuntimeSewingTaskLike): boolean {
  if (task.processCode === 'SEW' || task.processBusinessCode === 'SEW' || task.processNameZh === '车缝') return true
  return Boolean(task.coveredProcesses?.some((process) => process.processCode === 'SEW' || process.processName === '车缝'))
}

export function isRuntimeIndependentSewingTask(task: RuntimeSewingTaskLike): boolean {
  if (!isRuntimeSewingTask(task)) return false
  if (
    task.taskUnitType === 'COMBINED_PROCESS_TASK'
    || task.processBusinessCode === 'COMBINED_PROCESS_TASK'
    || task.acceptanceMode === 'CONTINUOUS_PROCESS'
  ) return false
  return task.processBusinessCode === 'SEW' || task.processCode === 'SEW' || task.processNameZh === '车缝'
}

function getOrderSkuLines(productionOrderId: string): RuntimeTaskSkuLine[] {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId)
  if (!order) return []
  return order.demandSnapshot.skuLines.map((line) => ({
    skuCode: line.skuCode,
    size: line.size,
    color: line.color,
    qty: line.qty,
  }))
}

function cloneTaskDetailRows(rows: TaskDetailRow[] | undefined): TaskDetailRow[] {
  if (!rows || rows.length === 0) return []
  return rows.map((row) => ({
    ...row,
    dimensions: { ...row.dimensions },
    sourceRefs: { ...row.sourceRefs },
  }))
}

function getTaskDetailRows(baseTask: ProcessTask): TaskDetailRow[] {
  return cloneTaskDetailRows(baseTask.detailRows).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

type RuntimeOutputValueTaskLike = Pick<
  ProcessTask,
  'qty' | 'detailRows' | 'outputValuePerUnit' | 'outputValueUnit' | 'outputValueTotal' | 'outputValueDifficulty'
> &
  Partial<Pick<RuntimeProcessTask, 'scopeQty' | 'scopeDetailRows'>>

function normalizeOutputValueNumber(value: number | undefined): number | undefined {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return undefined
  return normalized
}

function resolveRuntimeTaskOutputValueQty(task: RuntimeOutputValueTaskLike): number {
  if (Number.isFinite(task.scopeQty)) {
    return Math.max(Number(task.scopeQty), 0)
  }
  return Math.max(Number(task.qty), 0)
}

function resolveRuntimeTaskOutputValueDetailRows(task: RuntimeOutputValueTaskLike): TaskDetailRow[] {
  if (task.scopeDetailRows && task.scopeDetailRows.length > 0) {
    return cloneTaskDetailRows(task.scopeDetailRows)
  }
  return cloneTaskDetailRows(task.detailRows)
}

export function resolveRuntimeTaskOutputValue(task: RuntimeOutputValueTaskLike): ResolvedRuntimeOutputValue {
  const outputValuePerUnit = normalizeOutputValueNumber(task.outputValuePerUnit)
  const outputValueUnit = task.outputValueUnit?.trim() || undefined
  const outputValueDifficulty = task.outputValueDifficulty
  const detailRows = resolveRuntimeTaskOutputValueDetailRows(task)
  const fallbackTotal =
    outputValuePerUnit && outputValueUnit
      ? calculateOutputValueTotal({
          qty: resolveRuntimeTaskOutputValueQty(task),
          detailRows,
          outputValuePerUnit,
          outputValueUnit,
        })
      : 0

  return {
    outputValuePerUnit,
    outputValueUnit,
    outputValueTotal: normalizeOutputValueNumber(task.outputValueTotal) ?? normalizeOutputValueNumber(fallbackTotal),
    outputValueDifficulty,
  }
}

export function resolveRuntimeAllocatableGroupOutputValue(
  task: RuntimeOutputValueTaskLike,
  group: Pick<TaskAllocatableGroup, 'qty' | 'detailRowKeys'>,
): ResolvedRuntimeOutputValue {
  const base = resolveRuntimeTaskOutputValue(task)
  if (!base.outputValuePerUnit || !base.outputValueUnit) {
    return {
      ...base,
      outputValueTotal: undefined,
    }
  }

  const detailRows = resolveRuntimeTaskOutputValueDetailRows(task)
  const detailRowKeySet = new Set(group.detailRowKeys ?? [])
  const scopedDetailRows =
    detailRowKeySet.size > 0 ? detailRows.filter((row) => detailRowKeySet.has(row.rowKey)) : detailRows

  return {
    ...base,
    outputValueTotal: normalizeOutputValueNumber(
      calculateOutputValueTotal({
        qty: Math.max(Number(group.qty), 0),
        detailRows: scopedDetailRows,
        outputValuePerUnit: base.outputValuePerUnit,
        outputValueUnit: base.outputValueUnit,
      }),
    ),
  }
}

function recalculateRuntimeTaskOutputValueTotal(
  task: Pick<ProcessTask, 'outputValuePerUnit' | 'outputValueUnit'>,
  scopeQty: number,
  detailRows: TaskDetailRow[],
): number {
  return calculateOutputValueTotal({
    qty: scopeQty,
    detailRows,
    outputValuePerUnit: task.outputValuePerUnit,
    outputValueUnit: task.outputValueUnit,
  })
}

function filterDetailRowsByScope(
  rows: TaskDetailRow[],
  scopeType: RuntimeTaskScopeType,
  scopeSkuLines: RuntimeTaskSkuLine[],
): TaskDetailRow[] {
  if (rows.length === 0) return []
  if (scopeType === 'ORDER') return rows

  const scopeSkuSet = new Set(scopeSkuLines.map((line) => line.skuCode))
  const scopeColorSet = new Set(scopeSkuLines.map((line) => line.color))

  return rows.filter((row) => {
    const rowSku = row.dimensions.GARMENT_SKU
    const rowColor = row.dimensions.GARMENT_COLOR

    if (scopeType === 'SKU') {
      if (rowSku && !scopeSkuSet.has(rowSku)) return false
      if (rowColor && !scopeColorSet.has(rowColor)) return false
      return true
    }

    if (scopeType === 'COLOR') {
      if (rowColor && !scopeColorSet.has(rowColor)) return false
      if (rowSku && !scopeSkuSet.has(rowSku)) return false
      return true
    }

    return true
  })
}

function getTaskNo(task: RuntimeProcessTask): string {
  return task.taskNo || task.taskId
}

function getTaskRootNo(task: RuntimeProcessTask): string {
  return task.rootTaskNo || getTaskNo(task)
}

function pickDetailRowsByKeys(rows: TaskDetailRow[], keys: string[]): TaskDetailRow[] {
  if (!keys.length) return cloneTaskDetailRows(rows)
  const keySet = new Set(keys)
  return cloneTaskDetailRows(rows).filter((row) => keySet.has(row.rowKey))
}

function deriveScopeSkuLinesByDetailRows(scopeSkuLines: RuntimeTaskSkuLine[], detailRows: TaskDetailRow[]): RuntimeTaskSkuLine[] {
  if (!detailRows.length) return [...scopeSkuLines]

  const skuSet = new Set(
    detailRows
      .map((row) => row.dimensions.GARMENT_SKU)
      .filter((sku): sku is string => Boolean(sku)),
  )
  const colorSet = new Set(
    detailRows
      .map((row) => row.dimensions.GARMENT_COLOR)
      .filter((color): color is string => Boolean(color)),
  )

  if (skuSet.size === 0 && colorSet.size === 0) return [...scopeSkuLines]

  return scopeSkuLines.filter((line) => {
    if (skuSet.size > 0 && skuSet.has(line.skuCode)) return true
    if (colorSet.size > 0 && colorSet.has(line.color)) return true
    return false
  })
}

function applyRuntimeSplitPlans(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  if (runtimeTaskSplitPlans.size === 0) return tasks

  const planBySourceTaskId = new Map(runtimeTaskSplitPlans)
  const splitResultTaskIdsBySource = new Map<string, string[]>()
  for (const plan of runtimeTaskSplitPlans.values()) {
    splitResultTaskIdsBySource.set(plan.sourceTaskId, plan.results.map((result) => result.taskId))
  }

  const expanded: RuntimeProcessTask[] = []

  for (const task of tasks) {
    const plan = planBySourceTaskId.get(task.taskId)
    if (!plan) {
      expanded.push(task)
      continue
    }

    const sourceTaskNo = getTaskNo(task)
    const sourceRootNo = getTaskRootNo(task)
    const sourceDetailRows = task.scopeDetailRows.length > 0 ? task.scopeDetailRows : task.detailRows ?? []
    const sourceDetailRowKeys = sourceDetailRows.map((row) => row.rowKey)

    expanded.push({
      ...task,
      taskNo: sourceTaskNo,
      rootTaskNo: sourceRootNo,
      splitGroupId: plan.splitGroupId,
      splitFromTaskNo: task.splitFromTaskNo,
      splitSeq: 0,
      detailRowKeys: sourceDetailRowKeys,
      isSplitResult: false,
      isSplitSource: true,
      executionEnabled: false,
      assignmentStatus: 'ASSIGNED',
      outputValueTotal: recalculateRuntimeTaskOutputValueTotal(task, task.scopeQty, sourceDetailRows),
      updatedAt: plan.createdAt,
    })

    for (const resultTask of plan.results) {
      const scopedDetailRows = resultTask.scopeDetailRows
        ? cloneTaskDetailRows(resultTask.scopeDetailRows)
        : pickDetailRowsByKeys(sourceDetailRows, resultTask.detailRowKeys)
      const scopeSkuLines = resultTask.scopeSkuLines
        ? structuredClone(resultTask.scopeSkuLines)
        : deriveScopeSkuLinesByDetailRows(task.scopeSkuLines, scopedDetailRows)
      const scopeQty = resultTask.scopeQty > 0
        ? resultTask.scopeQty
        : scopedDetailRows.reduce((sum, row) => sum + row.qty, 0)

      expanded.push({
        ...task,
        taskId: resultTask.taskId,
        taskNo: resultTask.taskNo,
        rootTaskNo: sourceRootNo,
        splitGroupId: plan.splitGroupId,
        splitFromTaskNo: sourceTaskNo,
        splitSeq: resultTask.splitSeq,
        detailRowKeys: [...resultTask.detailRowKeys],
        isSplitResult: true,
        isSplitSource: false,
        executionEnabled: true,
        assignmentMode: resultTask.assignmentMode,
        assignmentStatus: resultTask.assignmentStatus,
        assignedFactoryId: resultTask.assignedFactoryId,
        assignedFactoryName: resultTask.assignedFactoryName,
        tenderId: resultTask.tenderId,
        scopeKey: resultTask.taskNo,
        scopeLabel: resultTask.scopeLabel,
        scopeQty,
        qty: scopeQty,
        scopeSkuLines,
        scopeDetailRows: scopedDetailRows,
        detailRows: cloneTaskDetailRows(scopedDetailRows),
        outputValueTotal: recalculateRuntimeTaskOutputValueTotal(task, scopeQty, scopedDetailRows),
        updatedAt: plan.createdAt,
      })
    }
  }

  if (splitResultTaskIdsBySource.size === 0) return expanded

  return expanded.map((task) => {
    const rewrittenDepends = task.dependsOnTaskIds.flatMap((dependsTaskId) => {
      const splitResultTaskIds = splitResultTaskIdsBySource.get(dependsTaskId)
      if (!splitResultTaskIds || splitResultTaskIds.length === 0) return [dependsTaskId]
      return splitResultTaskIds
    })
    return {
      ...task,
      dependsOnTaskIds: Array.from(new Set(rewrittenDepends)),
    }
  })
}

function buildOrderScopeTask(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask {
  const detailRows = getTaskDetailRows(baseTask)
  const taskId = `${baseTask.taskId}__ORDER`
  return {
    ...baseTask,
    taskId,
    taskQrValue: baseTask.taskQrValue ? buildTaskQrValue(taskId) : undefined,
    baseTaskId: baseTask.taskId,
    baseQty: baseTask.qty,
    baseDependsOnTaskIds: [...(baseTask.dependsOnTaskIds ?? [])],
    dependsOnTaskIds: [],
    qty: baseTask.qty,
    scopeType: 'ORDER',
    scopeKey: 'ORDER',
    scopeLabel: '整单',
    scopeQty: baseTask.qty,
    scopeSkuLines: skuLines,
    scopeDetailRows: detailRows,
    outputValueTotal: recalculateRuntimeTaskOutputValueTotal(baseTask, baseTask.qty, detailRows),
  }
}

function buildColorScopeTasks(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask[] {
  if (!skuLines.length) return [buildOrderScopeTask(baseTask, [])]
  const baseDetailRows = getTaskDetailRows(baseTask)

  const grouped = new Map<string, RuntimeTaskSkuLine[]>()
  for (const line of skuLines) {
    const label = normalizeColorLabel(line.color)
    const current = grouped.get(label) ?? []
    current.push(line)
    grouped.set(label, current)
  }

  return Array.from(grouped.entries()).map(([color, lines]) => {
    const qty = lines.reduce((sum, line) => sum + line.qty, 0)
    const detailRows = filterDetailRowsByScope(baseDetailRows, 'COLOR', lines)
    const taskId = `${baseTask.taskId}__COLOR__${normalizeScopeToken(color)}`
    return {
      ...baseTask,
      taskId,
      taskQrValue: baseTask.taskQrValue ? buildTaskQrValue(taskId) : undefined,
      baseTaskId: baseTask.taskId,
      baseQty: baseTask.qty,
      baseDependsOnTaskIds: [...(baseTask.dependsOnTaskIds ?? [])],
      dependsOnTaskIds: [],
      qty,
      scopeType: 'COLOR',
      scopeKey: color,
      scopeLabel: color,
      scopeQty: qty,
      scopeSkuLines: lines,
      scopeDetailRows: detailRows,
      outputValueTotal: recalculateRuntimeTaskOutputValueTotal(baseTask, qty, detailRows),
    }
  })
}

function buildSkuScopeTasks(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask[] {
  if (!skuLines.length) return [buildOrderScopeTask(baseTask, [])]
  const baseDetailRows = getTaskDetailRows(baseTask)

  return skuLines.map((line) => {
    const detailRows = filterDetailRowsByScope(baseDetailRows, 'SKU', [line])
    const taskId = `${baseTask.taskId}__SKU__${normalizeScopeToken(line.skuCode)}`
    return {
      ...baseTask,
      taskId,
      taskQrValue: baseTask.taskQrValue ? buildTaskQrValue(taskId) : undefined,
      baseTaskId: baseTask.taskId,
      baseQty: baseTask.qty,
      baseDependsOnTaskIds: [...(baseTask.dependsOnTaskIds ?? [])],
      dependsOnTaskIds: [],
      qty: line.qty,
      scopeType: 'SKU',
      scopeKey: line.skuCode,
      scopeLabel: `${line.skuCode} / ${normalizeColorLabel(line.color)} / ${line.size || '-'}`,
      scopeQty: line.qty,
      scopeSkuLines: [line],
      skuCode: line.skuCode,
      skuColor: line.color,
      skuSize: line.size,
      scopeDetailRows: detailRows,
      outputValueTotal: recalculateRuntimeTaskOutputValueTotal(baseTask, line.qty, detailRows),
    }
  })
}

function buildRuntimeTasksByGranularity(baseTask: ProcessTask): RuntimeProcessTask[] {
  const skuLines = getOrderSkuLines(baseTask.productionOrderId)
  // 冻结规则：任务拆分仅在分配时发生。runtime 不再按粒度预拆任务。
  // assignmentGranularity 仅决定“可分配单元”边界，不决定任务是否先天拆成多条。
  const _granularity = (baseTask.assignmentGranularity as ProcessAssignmentGranularity | undefined)
    ?? getProcessAssignmentGranularity(baseTask.processCode)
  void _granularity
  return [buildOrderScopeTask(baseTask, skuLines)]
}

function findOrderScopeTask(tasks: RuntimeProcessTask[]): RuntimeProcessTask | undefined {
  return tasks.find((task) => task.scopeType === 'ORDER')
}

function getRuntimeDependencyIds(currentTask: RuntimeProcessTask, upstreamTasks: RuntimeProcessTask[]): string[] {
  if (!upstreamTasks.length) return []

  let matched: RuntimeProcessTask[] = []

  if (currentTask.scopeType === 'SKU') {
    matched = upstreamTasks.filter((task) => {
      if (task.scopeType === 'SKU') return Boolean(task.skuCode && task.skuCode === currentTask.skuCode)
      if (task.scopeType === 'COLOR') return task.scopeKey === currentTask.skuColor
      return false
    })
  } else if (currentTask.scopeType === 'COLOR') {
    matched = upstreamTasks.filter((task) => {
      if (task.scopeType === 'COLOR') return task.scopeKey === currentTask.scopeKey
      if (task.scopeType === 'SKU') return task.skuColor === currentTask.scopeKey
      return false
    })
  } else {
    matched = upstreamTasks.filter((task) => task.scopeType === 'ORDER')
  }

  if (!matched.length) {
    const orderScope = findOrderScopeTask(upstreamTasks)
    if (orderScope) matched = [orderScope]
  }

  if (!matched.length && upstreamTasks.length === 1) {
    matched = [upstreamTasks[0]]
  }

  return Array.from(new Set(matched.map((task) => task.taskId)))
}

function applyRuntimeDependencies(runtimeTasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  const tasksByBaseId = new Map<string, RuntimeProcessTask[]>()
  for (const task of runtimeTasks) {
    const current = tasksByBaseId.get(task.baseTaskId) ?? []
    current.push(task)
    tasksByBaseId.set(task.baseTaskId, current)
  }

  return runtimeTasks.map((task) => {
    const upstreamBaseIds = task.baseDependsOnTaskIds ?? []
    const runtimeDependsOn = upstreamBaseIds.flatMap((baseId) =>
      getRuntimeDependencyIds(task, tasksByBaseId.get(baseId) ?? []),
    )

    return {
      ...task,
      dependsOnTaskIds: Array.from(new Set(runtimeDependsOn)),
    }
  })
}

function applyRuntimeOverrides(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  return tasks.map((task) => {
    const override = runtimeTaskOverrides.get(task.taskId)
    if (!override) return task
    return { ...task, ...override }
  })
}

function isPositiveRouteNo(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function compareRuntimeRouteTask(a: RuntimeProcessTask, b: RuntimeProcessTask): number {
  const stepCompare = (a.routeStepNo ?? Number.MAX_SAFE_INTEGER) - (b.routeStepNo ?? Number.MAX_SAFE_INTEGER)
  if (stepCompare !== 0) return stepCompare
  const laneCompare = (a.routeLaneNo ?? Number.MAX_SAFE_INTEGER) - (b.routeLaneNo ?? Number.MAX_SAFE_INTEGER)
  if (laneCompare !== 0) return laneCompare
  return compareRuntimeTask(a, b)
}

function isContinuousMergeSourceTask(task: RuntimeProcessTask): boolean {
  return task.defaultDocType !== 'DEMAND'
    && task.taskUnitType === 'SINGLE_PROCESS_TASK'
    && !task.isSplitSource
    && !task.isSplitResult
    && task.assignmentStatus === 'UNASSIGNED'
    && task.status === 'NOT_STARTED'
}

function formatRouteStepRange(tasks: RuntimeProcessTask[]): string {
  const steps = tasks
    .map((task) => task.routeStepNo)
    .filter(isPositiveRouteNo)
    .sort((left, right) => left - right)
  if (steps.length === 0) return '未配置路线'
  const first = steps[0]
  const last = steps[steps.length - 1]
  return first === last ? `第 ${first} 步` : `第 ${first}-${last} 步`
}

function canFactoryReceiveProcessAbility(ability: FactoryProcessAbility, processCode: string): boolean {
  if (ability.status && ability.status !== 'ACTIVE') return false
  if (ability.canReceiveTask === false) return false
  return ability.processCode === processCode
    || ability.parentProcessCode === processCode
    || ability.craftCodes.includes(processCode)
}

function getRuntimeTaskFactoryAbilityCodes(task: RuntimeProcessTask): string[] {
  const codes = new Set<string>()
  if (task.processCode) codes.add(task.processCode)
  if (task.craftCode) codes.add(task.craftCode)
  for (const coveredProcess of task.coveredProcesses ?? []) {
    if (coveredProcess.processCode) codes.add(coveredProcess.processCode)
    if (coveredProcess.craftCode) codes.add(coveredProcess.craftCode)
  }
  return Array.from(codes)
}

function getRuntimeTaskProcessLabel(task: RuntimeProcessTask): string {
  const coveredNames = (task.coveredProcesses ?? [])
    .map((coveredProcess) => coveredProcess.processName || coveredProcess.craftName)
    .filter(Boolean)
  return coveredNames.length > 0
    ? Array.from(new Set(coveredNames)).join('、')
    : task.processNameZh || task.processCode
}

function canFactoryReceiveAllRuntimeTasks(factory: Factory, tasks: RuntimeProcessTask[]): boolean {
  return tasks.every((task) => {
    const abilityCodes = getRuntimeTaskFactoryAbilityCodes(task)
    if (abilityCodes.length === 0) return false
    return abilityCodes.some((processCode) =>
      factory.processAbilities.some((ability) => canFactoryReceiveProcessAbility(ability, processCode)),
    )
  })
}

function findFactoryCoveringAllRuntimeTasks(tasks: RuntimeProcessTask[]): Factory | undefined {
  if (tasks.length === 0) return undefined
  return listBusinessFactoryMasterRecords({ includeTestFactories: false })
    .find((factory) => canFactoryReceiveAllRuntimeTasks(factory, tasks))
}

function evaluateSingleFactoryCoverageForParallelGroup(groupTasks: RuntimeProcessTask[]): string | null {
  if (findFactoryCoveringAllRuntimeTasks(groupTasks)) return null

  const [firstTask] = groupTasks
  const processText = Array.from(new Set(groupTasks.map(getRuntimeTaskProcessLabel))).join('、')
  return `同一工厂不具备并行组全部工序能力：第 ${firstTask?.routeStepNo ?? '—'} 步「${firstTask?.routeParallelGroupName || firstTask?.routeParallelGroupId || '并行组'}」需要同一工厂覆盖 ${processText}。`
}

function evaluateSingleFactoryCoverageForContinuousMerge(sourceTasks: RuntimeProcessTask[]): string | null {
  if (findFactoryCoveringAllRuntimeTasks(sourceTasks)) return null

  const processText = Array.from(new Set(sourceTasks.map(getRuntimeTaskProcessLabel))).join('、')
  return `同一工厂不具备连续工序全部工序能力：冻结路线${formatRouteStepRange(sourceTasks)}需要同一工厂覆盖 ${processText}。`
}

function evaluateSelectedParallelGroups(
  selectedTasks: RuntimeProcessTask[],
  orderTasks: RuntimeProcessTask[],
): string | null {
  const selectedIds = new Set(selectedTasks.map((task) => task.taskId))
  const selectedSteps = new Map<number, RuntimeProcessTask[]>()
  const checkedParallelGroupIds = new Set<string>()
  for (const task of selectedTasks) {
    if (!isPositiveRouteNo(task.routeStepNo)) continue
    selectedSteps.set(task.routeStepNo, [...(selectedSteps.get(task.routeStepNo) ?? []), task])
  }

  for (const task of selectedTasks) {
    if ((task.routeLaneNo ?? 1) > 1 && !task.routeParallelGroupId) {
      return `并行组未选择完整：第 ${task.routeStepNo} 步第 ${task.routeLaneNo} 并行线缺少并行组信息。`
    }
    if (!task.routeParallelGroupId) continue
    const groupTasks = orderTasks.filter((item) => item.routeParallelGroupId === task.routeParallelGroupId)
    const missing = groupTasks.filter((item) => !selectedIds.has(item.taskId))
    if (missing.length > 0) {
      return `并行组未选择完整：第 ${task.routeStepNo} 步「${task.routeParallelGroupName || task.routeParallelGroupId}」需整体选择。`
    }
    if (groupTasks.some((item) => item.routeParallelAcceptanceMode !== 'WHOLE_GROUP_ALLOWED')) {
      return `该并行组未允许整体承接：第 ${task.routeStepNo} 步仍为分别承接。`
    }
    if (!checkedParallelGroupIds.has(task.routeParallelGroupId)) {
      checkedParallelGroupIds.add(task.routeParallelGroupId)
      const factoryCoverageMessage = evaluateSingleFactoryCoverageForParallelGroup(groupTasks)
      if (factoryCoverageMessage) return factoryCoverageMessage
    }
  }

  for (const [stepNo, stepTasks] of selectedSteps) {
    if (stepTasks.length <= 1) continue
    const groupIds = new Set(stepTasks.map((task) => task.routeParallelGroupId || ''))
    if (groupIds.size !== 1 || groupIds.has('')) {
      return `并行组未选择完整：第 ${stepNo} 步不能混选不同并行线。`
    }
    if (stepTasks.some((task) => task.routeParallelAcceptanceMode !== 'WHOLE_GROUP_ALLOWED')) {
      return `该并行组未允许整体承接：第 ${stepNo} 步仍为分别承接。`
    }
  }

  return null
}

function evaluateContinuousRuntimeTaskMergeWithTasks(
  taskIds: string[],
  runtimeTasks: RuntimeProcessTask[],
): ContinuousRuntimeTaskMergeEvaluation {
  const selectedIds = Array.from(new Set(taskIds.filter(Boolean)))
  const sourceTasks = selectedIds
    .map((taskId) => runtimeTasks.find((task) => task.taskId === taskId))
    .filter((task): task is RuntimeProcessTask => Boolean(task))
    .sort(compareRuntimeRouteTask)

  if (sourceTasks.length !== selectedIds.length) {
    return { ok: false, message: '所选任务已变化，请刷新任务清单后重新选择。', tasks: sourceTasks }
  }
  if (sourceTasks.length < 2) {
    return { ok: false, message: '请选择至少两个工序任务。', tasks: sourceTasks }
  }

  const productionOrderId = sourceTasks[0].productionOrderId
  if (!sourceTasks.every((task) => task.productionOrderId === productionOrderId)) {
    return { ok: false, message: '只能合并同一生产单下的连续工序任务。', tasks: sourceTasks }
  }
  if (sourceTasks.some((task) => !isContinuousMergeSourceTask(task))) {
    return { ok: false, message: '只能合并未分配、未开工、未拆分的单工序任务。', tasks: sourceTasks }
  }
  if (sourceTasks.some((task) => !isPositiveRouteNo(task.routeStepNo) || !isPositiveRouteNo(task.routeLaneNo))) {
    return { ok: false, message: '所选任务缺少冻结路线步骤或并行线，不能合并连续工序任务。', tasks: sourceTasks }
  }

  const orderRuntimeTasks = runtimeTasks
    .filter((task) => task.productionOrderId === productionOrderId)
    .sort(compareRuntimeRouteTask)
  const parallelMessage = evaluateSelectedParallelGroups(sourceTasks, orderRuntimeTasks)
  if (parallelMessage) return { ok: false, message: parallelMessage, tasks: sourceTasks }

  const steps = Array.from(new Set(sourceTasks.map((task) => task.routeStepNo as number))).sort((left, right) => left - right)
  for (let index = 1; index < steps.length; index += 1) {
    const prev = steps[index - 1]
    const next = steps[index]
    if (next - prev !== 1) {
      return { ok: false, message: `中间缺少第 ${prev + 1} 步，不能合并连续工序任务。`, tasks: sourceTasks }
    }
  }

  const factoryCoverageMessage = evaluateSingleFactoryCoverageForContinuousMerge(sourceTasks)
  if (factoryCoverageMessage) return { ok: false, message: factoryCoverageMessage, tasks: sourceTasks }

  return {
    ok: true,
    message: `已选择冻结路线${formatRouteStepRange(sourceTasks)}，可合并；连续工序任务不能按明细拆分。`,
    tasks: sourceTasks,
  }
}

function buildContinuousMergedTask(sourceTasks: RuntimeProcessTask[], mergedTaskId: string, createdAt: string, createdBy: string): RuntimeProcessTask | null {
  if (sourceTasks.length < 2) return null
  const [source] = sourceTasks
  const target = sourceTasks[sourceTasks.length - 1]
  const sourceTaskNos = sourceTasks.map((task) => task.taskNo || task.taskId)
  const routeRangeText = formatRouteStepRange(sourceTasks)
  const processName = `${sourceTasks.map((task) => task.processNameZh).join('+')}组合任务`
  const mergedTask: RuntimeProcessTask = {
    ...target,
    seq: source.seq,
    taskId: mergedTaskId,
    taskNo: mergedTaskId.replace('__ORDER', ''),
    processNameZh: processName,
    processBusinessCode: 'COMBINED_PROCESS_TASK',
    processBusinessName: processName,
    stageName: '组合工序任务',
    taskCategoryZh: processName,
    taskUnitType: 'COMBINED_PROCESS_TASK',
    acceptanceMode: 'CONTINUOUS_PROCESS',
    assignmentGranularity: 'ORDER',
    detailSplitMode: undefined,
    detailSplitDimensions: [],
    scopeType: 'ORDER',
    scopeKey: 'ORDER',
    scopeLabel: '整任务',
    routeStepNo: source.routeStepNo,
    routeLaneNo: source.routeLaneNo,
    routeParallelGroupId: source.routeParallelGroupId,
    routeParallelGroupName: source.routeParallelGroupName,
    routeParallelAcceptanceMode: source.routeParallelAcceptanceMode,
    generationRuleId: undefined,
    generationRuleName: '任务清单人工合并',
    coveredProcesses: sourceTasks.flatMap((task) => task.coveredProcesses ?? []),
    isMergedTaskUnit: true,
    allowAutoDispatch: false,
    pdaStepTemplateCode: 'SIMPLE_FIVE_STEP',
    outputValuePerUnit: undefined,
    outputValueUnit: '按覆盖工序明细计算',
    outputValueTotal: sumTaskOutputValueTotals(sourceTasks),
    detailRows: sourceTasks.flatMap((task) => task.detailRows ?? []),
    scopeDetailRows: sourceTasks.flatMap((task) => task.scopeDetailRows ?? []),
    dependsOnTaskIds: [...source.dependsOnTaskIds],
    baseDependsOnTaskIds: [...source.baseDependsOnTaskIds],
    mergeSourceTaskIds: sourceTasks.map((task) => task.taskId),
    mergeCreatedAt: createdAt,
    mergeCreatedBy: createdBy,
    mockExecutionSummary: `任务清单人工合并冻结路线${routeRangeText}后，工厂按整任务执行。`,
    mockHandoverSummary: target.handoverReceiverName ? `完成后交${target.handoverReceiverName}` : target.mockHandoverSummary,
    auditLogs: [
      ...target.auditLogs,
      buildSeedAuditLog(mergedTaskId, 'MERGE_CONTINUOUS_PROCESS', `任务清单合并 ${sourceTaskNos.join('、')}`, createdBy, createdAt),
    ],
  }
  return mergedTask
}

function applyContinuousMergePlan(tasks: RuntimeProcessTask[], plan: { taskIds: string[]; mergedTaskId: string; createdAt: string; createdBy: string }): RuntimeProcessTask[] {
  const sourceTasks = plan.taskIds
    .map((taskId) => tasks.find((task) => task.taskId === taskId))
    .filter((task): task is RuntimeProcessTask => Boolean(task))
  const mergedTask = buildContinuousMergedTask(sourceTasks, plan.mergedTaskId, plan.createdAt, plan.createdBy)
  if (!mergedTask) return tasks

  return tasks
    .filter((task) => !plan.taskIds.includes(task.taskId))
    .concat(mergedTask)
}

function applyManualContinuousMergeDemo(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  const pleatKnittingDemo = applyContinuousMergePlan(tasks, {
    taskIds: ['TASKGEN-202603-0006-001__ORDER', 'TASKGEN-202603-0006-002__ORDER'],
    mergedTaskId: 'TASKGEN-202603-0006-002__ORDER',
    createdAt: '2026-03-20 10:00:00',
    createdBy: '生产计划员',
  })
  return applyContinuousMergePlan(pleatKnittingDemo, {
    taskIds: ['TASKGEN-202603-082-002__ORDER', 'TASKGEN-202603-082-003__ORDER'],
    mergedTaskId: 'TASKGEN-202603-082-002__ORDER',
    createdAt: '2026-03-20 10:20:00',
    createdBy: '生产计划员',
  })
}

function applyRuntimeContinuousMergePlans(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  let next = tasks
  for (const plan of runtimeContinuousMergePlans.values()) {
    next = applyContinuousMergePlan(next, plan)
  }
  return next
}

function shouldUseSameFactoryContinue(upstream: RuntimeProcessTask, downstream: RuntimeProcessTask): boolean {
  if (upstream.scopeType !== 'SKU' || downstream.scopeType !== 'SKU') return false
  if (!upstream.skuCode || !downstream.skuCode) return false
  if (upstream.skuCode !== downstream.skuCode) return false
  if (!upstream.assignedFactoryId || !downstream.assignedFactoryId) return false
  if (upstream.assignedFactoryId !== downstream.assignedFactoryId) return false

  const upstreamKind = resolveExecutorKindByFactoryId(upstream.assignedFactoryId)
  const downstreamKind = resolveExecutorKindByFactoryId(downstream.assignedFactoryId)
  if (upstreamKind === 'WAREHOUSE_WORKSHOP' || downstreamKind === 'WAREHOUSE_WORKSHOP') {
    return false
  }

  return true
}

function computeTransitionsForOrder(tasks: RuntimeProcessTask[]): RuntimeProcessTask[] {
  const byId = new Map(tasks.map((task) => [task.taskId, task] as const))
  const upstreamByTaskId = new Map<string, RuntimeProcessTask[]>()
  const downstreamByTaskId = new Map<string, RuntimeProcessTask[]>()

  for (const task of tasks) {
    for (const upstreamId of task.dependsOnTaskIds) {
      const upstreamTask = byId.get(upstreamId)
      if (!upstreamTask) continue

      const upstreamList = upstreamByTaskId.get(task.taskId) ?? []
      upstreamList.push(upstreamTask)
      upstreamByTaskId.set(task.taskId, upstreamList)

      const downstreamList = downstreamByTaskId.get(upstreamTask.taskId) ?? []
      downstreamList.push(task)
      downstreamByTaskId.set(upstreamTask.taskId, downstreamList)
    }
  }

  return tasks.map((task) => {
    const upstreamTasks = upstreamByTaskId.get(task.taskId) ?? []
    const downstreamTasks = downstreamByTaskId.get(task.taskId) ?? []

    let transitionFromPrev: RuntimeTransitionMode = 'NOT_APPLICABLE'
    if (upstreamTasks.length > 0) {
      const allSameFactory = upstreamTasks.every((upstream) => shouldUseSameFactoryContinue(upstream, task))
      transitionFromPrev = allSameFactory ? 'SAME_FACTORY_CONTINUE' : 'RETURN_TO_WAREHOUSE'
    }

    let transitionToNext: RuntimeTransitionMode = 'NOT_APPLICABLE'
    if (downstreamTasks.length > 0) {
      const allSameFactory = downstreamTasks.every((downstream) => shouldUseSameFactoryContinue(task, downstream))
      transitionToNext = allSameFactory ? 'SAME_FACTORY_CONTINUE' : 'RETURN_TO_WAREHOUSE'
    }

    return {
      ...task,
      executorKind: resolveExecutorKindByFactoryId(task.assignedFactoryId),
      transitionFromPrev,
      transitionToNext,
    }
  })
}

function compareRuntimeTask(a: RuntimeProcessTask, b: RuntimeProcessTask): number {
  const orderCompare = a.productionOrderId.localeCompare(b.productionOrderId)
  if (orderCompare !== 0) return orderCompare
  if (a.seq !== b.seq) return a.seq - b.seq
  const scopeRank: Record<RuntimeTaskScopeType, number> = { ORDER: 0, COLOR: 1, SKU: 2, DETAIL: 3 }
  if (scopeRank[a.scopeType] !== scopeRank[b.scopeType]) {
    return scopeRank[a.scopeType] - scopeRank[b.scopeType]
  }
  const splitSeqA = a.splitSeq ?? 0
  const splitSeqB = b.splitSeq ?? 0
  if (splitSeqA !== splitSeqB) return splitSeqA - splitSeqB
  return a.scopeLabel.localeCompare(b.scopeLabel)
}

function buildRuntimeBaseTasksFromTaskFacts(): ProcessTask[] {
  // 第二轮整改：runtime 层不再重复构建基础任务事实，统一从 processTasks 兼容层派生。
  return processTasks
    .filter((task) => task.defaultDocType !== 'DEMAND')
    .map((task) => ({
      ...task,
      dependsOnTaskIds: [...(task.dependsOnTaskIds ?? [])],
      auditLogs: [...(task.auditLogs ?? [])],
      attachments: [...(task.attachments ?? [])],
      qcPoints: [...(task.qcPoints ?? [])],
      coveredProcesses: task.coveredProcesses?.map((item) => ({
        ...item,
        sourceArtifactIds: [...item.sourceArtifactIds],
      })),
      detailSplitDimensions: [...(task.detailSplitDimensions ?? [])],
      detailRows: cloneTaskDetailRows(task.detailRows),
      taskNo: task.taskNo ?? task.taskId,
      rootTaskNo: task.rootTaskNo ?? task.taskNo ?? task.taskId,
      splitGroupId: task.splitGroupId,
      splitFromTaskNo: task.splitFromTaskNo,
      splitSeq: task.splitSeq ?? 0,
      detailRowKeys: [...(task.detailRowKeys ?? task.detailRows?.map((row) => row.rowKey) ?? [])],
      isSplitResult: task.isSplitResult ?? false,
      isSplitSource: task.isSplitSource ?? false,
      executionEnabled: task.executionEnabled ?? true,
    }))
}

function buildRuntimeProcessTasksBase(): RuntimeProcessTask[] {
  const baseTasks = buildRuntimeBaseTasksFromTaskFacts()
  const expanded = baseTasks.flatMap((task) => buildRuntimeTasksByGranularity(task))
  return applyRuntimeDependencies(expanded)
}

function buildRuntimeProcessTasks(): RuntimeProcessTask[] {
  const baseTasks = buildRuntimeProcessTasksBase()
  const baseWithOverrides = applyRuntimeOverrides(baseTasks.concat(
    Array.from(runtimeReassignedTasks.values()).map((task) => structuredClone(task)),
  ))
  const withSplit = applyRuntimeSplitPlans(baseWithOverrides)
  const mergedTasks = applyRuntimeContinuousMergePlans(applyManualContinuousMergeDemo(applyRuntimeOverrides(withSplit)))
  const withOverrides = applyRuntimeOverrides(mergedTasks)
  const grouped = new Map<string, RuntimeProcessTask[]>()
  for (const task of withOverrides) {
    const current = grouped.get(task.productionOrderId) ?? []
    current.push(task)
    grouped.set(task.productionOrderId, current)
  }

  const result: RuntimeProcessTask[] = []
  for (const tasks of grouped.values()) {
    result.push(...computeTransitionsForOrder(tasks))
  }

  return result.sort(compareRuntimeTask)
}

function getMutableRuntimeTaskById(taskId: string): RuntimeProcessTask | null {
  return listRuntimeProcessTasks().find((task) => task.taskId === taskId) ?? null
}

function patchRuntimeTask(taskId: string, patch: RuntimeTaskOverride): RuntimeProcessTask | null {
  const current = getMutableRuntimeTaskById(taskId)
  if (!current) return null

  const override = runtimeTaskOverrides.get(taskId) ?? {}
  runtimeTaskOverrides.set(taskId, { ...override, ...patch })
  return { ...current, ...patch }
}

function updateRuntimeTaskWithAudit(
  taskId: string,
  patch: RuntimeTaskOverride,
  action: string,
  detail: string,
  by: string,
): RuntimeProcessTask | null {
  const current = getMutableRuntimeTaskById(taskId)
  if (!current) return null

  const updatedAt = nowTimestamp()
  const auditLogs = appendRuntimeAudit({ ...current, ...patch }, action, detail, by)
  return patchRuntimeTask(taskId, {
    ...patch,
    updatedAt,
    auditLogs,
  })
}

function buildSeedAuditLog(taskId: string, action: string, detail: string, by: string, at: string): TaskAuditLog {
  return {
    id: makeRuntimeAuditId(taskId),
    action,
    detail,
    at,
    by,
  }
}

function getSeedBaseAuditLogs(taskId: string): TaskAuditLog[] {
  const baseTaskId = taskId.replace(/__ORDER$/, '')
  const baseTask = processTasks.find((task) => task.taskId === baseTaskId)
  return [...(baseTask?.auditLogs ?? [])]
}

function seedRuntimeTaskOverride(
  taskId: string,
  patch: RuntimeTaskOverride,
  auditLogs: TaskAuditLog[] = [],
): void {
  runtimeTaskOverrides.set(taskId, {
    ...(runtimeTaskOverrides.get(taskId) ?? {}),
    ...patch,
    auditLogs: auditLogs.length > 0 ? auditLogs : patch.auditLogs,
  })
}

function ensureDispatchBoardSeedData(): void {
  if (dispatchBoardSeedReady) return
  dispatchBoardSeedReady = true

  const directFactorySeeds = {
    cut: { id: TEST_FACTORY_ID, name: TEST_FACTORY_NAME },
    sew: { id: 'ID-F003', name: '万隆车缝厂' },
    kolGoto: { id: KOL_GOTO_FACTORY_ID, name: KOL_GOTO_FACTORY_NAME },
    button: { id: TEST_FACTORY_ID, name: TEST_FACTORY_NAME },
    special: { id: TEST_FACTORY_ID, name: TEST_FACTORY_NAME },
    wash: { id: 'ID-F007', name: '玛琅精工车缝' },
  } as const

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0001-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.kolGoto.id,
      assignedFactoryName: directFactorySeeds.kolGoto.name,
      acceptDeadline: '2026-03-19 12:00:00',
      taskDeadline: '2026-04-02 18:00:00',
      dispatchedAt: '2026-03-18 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 15200,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      outputValuePerUnit: undefined,
      outputValueUnit: '按覆盖工序明细计算',
      outputValueTotal: 76000000,
      acceptanceStatus: 'PENDING',
      dispatchRemark: '待工厂确认',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0001-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0001-001__ORDER', 'DISPATCH', '已发起 KOL 整单直接派单，待 kol goto 确认', '跟单A', '2026-03-18 09:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.cut.id,
      assignedFactoryName: directFactorySeeds.cut.name,
      acceptDeadline: '2026-06-03 12:00:00',
      taskDeadline: '2026-06-12 18:00:00',
      dispatchedAt: '2026-03-19 10:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 8600,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      status: 'NOT_STARTED',
      dispatchRemark: '按裁片工序直接派单',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0002-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0002-001__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-19 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0002-001__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.cut.name, '2026-03-19 13:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-002__ORDER',
    {
      assignmentStatus: 'UNASSIGNED',
      taskDeadline: '2026-03-20 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0002-002__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0002-002__ORDER', 'SET_ASSIGN_MODE', '保留待分配，等待按产能日历校验后派单', '跟单A', '2026-03-19 09:20:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-003__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.button.id,
      assignedFactoryName: directFactorySeeds.button.name,
      acceptDeadline: '2026-06-03 12:00:00',
      taskDeadline: '2026-06-09 18:00:00',
      dispatchedAt: '2026-03-19 11:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 6900,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      dispatchRemark: '后道加工直接派单',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0002-003__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0002-003__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-19 11:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0002-003__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.button.name, '2026-03-19 14:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-005__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: 'ID-F013',
      assignedFactoryName: '梭罗辅料专工厂',
      startDueAt: '2026-03-18 09:00:00',
      acceptDeadline: '2026-03-18 10:00:00',
      taskDeadline: '2026-04-10 18:00:00',
      dispatchedAt: '2026-03-17 15:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 7350,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      outputValuePerUnit: 3.6,
      outputValueTotal: 9000,
      acceptanceStatus: 'ACCEPTED',
      dispatchRemark: '辅料线体可承接，但窗口余量不足 20%，保留一条紧张样例。',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0002-005__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0002-005__ORDER', 'DISPATCH', '已发起直接派单，辅料线体接近满载', '跟单A', '2026-03-17 15:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0002-005__ORDER', 'ACCEPT', '工厂已确认接单', '梭罗辅料专工厂', '2026-03-17 16:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0003-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'ASSIGNING',
      tenderId: 'TENDER-TASKGEN0003001-1001',
      biddingDeadline: '2026-03-21 12:00:00',
      taskDeadline: '2026-04-12 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0003-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0003-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-19 09:30:00'),
      buildSeedAuditLog('TASKGEN-202603-0003-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0003001-1001', '跟单A', '2026-03-19 09:35:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0004-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.kolGoto.id,
      assignedFactoryName: directFactorySeeds.kolGoto.name,
      acceptDeadline: '2026-03-18 18:00:00',
      taskDeadline: '2026-04-06 18:00:00',
      dispatchedAt: '2026-03-18 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 13800,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      acceptedAt: '2026-03-18 11:00:00',
      acceptedBy: directFactorySeeds.kolGoto.name,
      status: 'DONE',
      startedAt: '2026-03-19 08:40:00',
      finishedAt: '2026-03-25 17:30:00',
      dispatchRemark: 'KOL 小单整单直派',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0004-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'DISPATCH', '已发起 KOL 整单直接派单', '跟单A', '2026-03-18 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.kolGoto.name, '2026-03-18 11:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'FINISH', '工厂已完工', directFactorySeeds.kolGoto.name, '2026-03-25 17:30:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0003-006__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.kolGoto.id,
      assignedFactoryName: directFactorySeeds.kolGoto.name,
      acceptDeadline: '2026-03-20 12:00:00',
      taskDeadline: '2026-04-08 18:00:00',
      dispatchedAt: '2026-03-20 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 14600,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      acceptedAt: '2026-03-20 11:00:00',
      acceptedBy: directFactorySeeds.kolGoto.name,
      status: 'BLOCKED',
      startedAt: '2026-03-21 08:30:00',
      blockedAt: '2026-03-21 15:10:00',
      blockReason: 'MATERIAL',
      blockRemark: '待补辅料到厂',
      dispatchRemark: 'KOL 小单整单直派',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0003-006__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0003-006__ORDER', 'DISPATCH', '已发起 KOL 整单直接派单', '跟单A', '2026-03-20 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0003-006__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.kolGoto.name, '2026-03-20 11:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0003-006__ORDER', 'BLOCK', '生产暂停：待补辅料到厂', directFactorySeeds.kolGoto.name, '2026-03-21 15:10:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0004-007__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.kolGoto.id,
      assignedFactoryName: directFactorySeeds.kolGoto.name,
      acceptDeadline: '2026-03-18 20:00:00',
      taskDeadline: '2026-04-11 18:00:00',
      dispatchedAt: '2026-03-18 12:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 14200,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      acceptedAt: '2026-03-18 14:00:00',
      acceptedBy: directFactorySeeds.kolGoto.name,
      status: 'DONE',
      startedAt: '2026-03-19 09:15:00',
      finishedAt: '2026-03-27 16:50:00',
      dispatchRemark: 'KOL 小单整单直派',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0004-007__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0004-007__ORDER', 'DISPATCH', '已发起 KOL 整单直接派单', '跟单A', '2026-03-18 12:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-007__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.kolGoto.name, '2026-03-18 14:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-007__ORDER', 'FINISH', '工厂已完工', directFactorySeeds.kolGoto.name, '2026-03-27 16:50:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0009-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      tenderId: 'TENDER-TASKGEN0009001-1001',
      outputValuePerUnit: undefined,
      outputValueUnit: '按覆盖工序明细计算',
      outputValueTotal: 28000,
      biddingDeadline: '2026-03-22 18:00:00',
      taskDeadline: '2026-04-14 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0009-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0009-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-20 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0009-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0009001-1001', '跟单A', '2026-03-20 10:05:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'ASSIGNING',
      tenderId: 'TENDER-TASKGEN0015001-1001',
      outputValuePerUnit: undefined,
      outputValueUnit: '按覆盖工序明细计算',
      outputValueTotal: 16800,
      biddingDeadline: '2026-03-21 10:00:00',
      taskDeadline: '2026-04-01 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-19 10:30:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0015001-1001', '跟单A', '2026-03-19 10:35:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-002__ORDER',
    {
      assignmentStatus: 'UNASSIGNED',
      taskDeadline: '2026-04-12 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-002__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-002__ORDER', 'SET_ASSIGN_MODE', '设为暂不分配', '跟单A', '2026-03-20 09:40:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-005__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.kolGoto.id,
      assignedFactoryName: directFactorySeeds.kolGoto.name,
      acceptDeadline: '2026-03-18 12:00:00',
      taskDeadline: '2026-04-09 18:00:00',
      dispatchedAt: '2026-03-17 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 12400,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      acceptedAt: '2026-03-17 10:00:00',
      acceptedBy: directFactorySeeds.kolGoto.name,
      status: 'BLOCKED',
      startedAt: '2026-03-18 09:00:00',
      blockedAt: '2026-03-18 16:20:00',
      blockReason: 'TECH',
      blockRemark: '待确认工艺变更',
      dispatchRemark: 'KOL 小单整单直派',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-005__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-005__ORDER', 'DISPATCH', '已发起 KOL 整单直接派单', '跟单A', '2026-03-17 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-005__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.kolGoto.name, '2026-03-17 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-005__ORDER', 'BLOCK', '生产暂停：待确认工艺变更', directFactorySeeds.kolGoto.name, '2026-03-18 16:20:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-006__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      tenderId: 'TENDER-TASKGEN0015006-1001',
      biddingDeadline: '2026-03-21 16:00:00',
      taskDeadline: '2026-04-13 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-006__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-006__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0015006-1001', '跟单A', '2026-03-20 09:20:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-083-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      tenderId: 'TENDER-TASKGEN0083001-1001',
      biddingDeadline: '2026-03-18 17:00:00',
      taskDeadline: '2026-04-18 18:00:00',
      awardedAt: '2026-03-19 16:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-083-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-083-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-18 13:00:00'),
      buildSeedAuditLog('TASKGEN-202603-083-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0083001-1001', '跟单A', '2026-03-18 13:05:00'),
      buildSeedAuditLog('TASKGEN-202603-083-001__ORDER', 'AWARD', '已完成定标', '运营A', '2026-03-19 16:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-084-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'ASSIGNING',
      tenderId: 'TENDER-TASKGEN0084001-1001',
      biddingDeadline: '2026-03-21 20:00:00',
      taskDeadline: '2026-04-18 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-084-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-084-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-20 10:20:00'),
      buildSeedAuditLog('TASKGEN-202603-084-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0084001-1001', '跟单A', '2026-03-20 10:25:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-083-002__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      tenderId: 'TENDER-TASKGEN0083002-1001',
      assignedFactoryId: 'ID-F021',
      assignedFactoryName: 'CV Micro Sewing Jakarta Pusat',
      businessAssignedAt: '2026-07-01 09:00:00',
      assignmentOperatedAt: '2026-07-01 10:00:00',
      biddingDeadline: '2026-07-01 11:00:00',
      awardedAt: '2026-07-01 12:00:00',
      dispatchPrice: 13800,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'PENDING',
      acceptedAt: undefined,
      acceptedBy: undefined,
      taskDeadline: '2026-07-10 12:00:00',
      acceptDeadline: '2026-07-02 12:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-083-002__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-083-002__ORDER', 'BIDDING_START', '发起车缝任务竞价 TENDER-TASKGEN0083002-1001', '跟单A', '2026-07-01 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-083-002__ORDER', 'TENDER_AWARD', '已定标给 CV Micro Sewing Jakarta Pusat，等待工厂确认接单', '运营A', '2026-07-01 12:00:00'),
    ],
  )

  const delayedReceiptDemoTaskId = 'TASKGEN-202603-0015-001__ORDER'
  const delayedReceiptDemoAcceptedAt = '2026-07-01 09:00:00'
  const delayedReceiptDemoFactoryId = 'ID-F021'
  const delayedReceiptDemoFactoryName = 'CV Micro Sewing Jakarta Pusat'
  seedRuntimeTaskOverride(
    delayedReceiptDemoTaskId,
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: delayedReceiptDemoFactoryId,
      assignedFactoryName: delayedReceiptDemoFactoryName,
      businessAssignedAt: delayedReceiptDemoAcceptedAt,
      assignmentOperatedAt: '2026-07-01 10:00:00',
      dispatchedAt: delayedReceiptDemoAcceptedAt,
      dispatchedBy: '跟单A',
      acceptanceStatus: 'ACCEPTED',
      acceptedAt: delayedReceiptDemoAcceptedAt,
      acceptedBy: '系统自动接单（含车缝直接派单）',
      status: 'IN_PROGRESS',
      startedAt: '2026-07-01 10:00:00',
      taskDeadline: '2026-07-10 09:00:00',
      dispatchRemark: '含车缝接收确认延迟演示任务',
    },
    [
      ...getSeedBaseAuditLogs(delayedReceiptDemoTaskId),
      buildSeedAuditLog(delayedReceiptDemoTaskId, 'DISPATCH', '已直接派单并按业务分配时间自动接单', '跟单A', delayedReceiptDemoAcceptedAt),
      buildSeedAuditLog(delayedReceiptDemoTaskId, 'START', '工厂已开始车缝生产', delayedReceiptDemoFactoryName, '2026-07-01 10:00:00'),
    ],
  )
  if (!getSewingDeliverySlaSnapshot(delayedReceiptDemoTaskId)) {
    saveSewingDeliverySlaSnapshot(createSewingDeliverySlaSnapshot({
      assignmentId: 'ASSIGN-SLA-DELAY-DEMO-001',
      runtimeTaskId: delayedReceiptDemoTaskId,
      productionOrderId: 'PO-202603-0015',
      factoryId: delayedReceiptDemoFactoryId,
      factoryName: delayedReceiptDemoFactoryName,
      assignedQty: 1400,
      acceptedAt: delayedReceiptDemoAcceptedAt,
      slaKind: 'INDEPENDENT_SEWING',
    }))
  }

  const registeredDelayedDemoOrder = registerProductionOrderSewingFactory({
    productionOrderId: 'PO-202603-0015',
    factoryId: delayedReceiptDemoFactoryId,
    factoryName: delayedReceiptDemoFactoryName,
    by: '跟单A',
    at: delayedReceiptDemoAcceptedAt,
  })
  if (!registeredDelayedDemoOrder) throw new Error('含车缝接收确认延迟演示任务登记车缝工厂失败')

  registerProductionOrderSewingFactory({
    productionOrderId: 'PO-202603-083',
    factoryId: 'ID-F021',
    factoryName: 'CV Micro Sewing Jakarta Pusat',
    by: '运营A',
    at: '2026-07-01 12:00:00',
  })

}

function getOrderIdsFromTaskIds(taskIds: string[]): string[] {
  const tasks = listRuntimeProcessTasks().filter((task) => taskIds.includes(task.taskId))
  return Array.from(new Set(tasks.map((task) => task.productionOrderId)))
}

export function listRuntimeProcessTasks(): RuntimeProcessTask[] {
  ensureDispatchBoardSeedData()
  return buildRuntimeProcessTasks()
}

export function evaluateContinuousRuntimeTaskMerge(
  taskIds: string[],
  runtimeTasks?: RuntimeProcessTask[],
): ContinuousRuntimeTaskMergeEvaluation {
  ensureDispatchBoardSeedData()
  return evaluateContinuousRuntimeTaskMergeWithTasks(taskIds, runtimeTasks ?? buildRuntimeProcessTasks())
}

export function mergeContinuousRuntimeTasks(taskIds: string[], by = '生产计划员'): RuntimeProcessTask | null {
  const evaluation = evaluateContinuousRuntimeTaskMerge(taskIds)
  if (!evaluation.ok) return null
  const sourceTasks = evaluation.tasks

  const mergedTaskId = sourceTasks[sourceTasks.length - 1].taskId
  const createdAt = nowTimestamp()
  runtimeContinuousMergePlans.set(mergedTaskId, {
    taskIds: sourceTasks.map((task) => task.taskId),
    mergedTaskId,
    createdAt,
    createdBy: by,
  })
  return getRuntimeTaskById(mergedTaskId)
}

export function listRuntimeTasksByOrder(productionOrderId: string): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter((task) => task.productionOrderId === productionOrderId)
}

export function listRuntimeExecutionTasksByOrder(productionOrderId: string): RuntimeProcessTask[] {
  return listRuntimeTasksByOrder(productionOrderId).filter(
    (task) => isRuntimeTaskExecutionTask(task) && task.defaultDocType !== 'DEMAND',
  )
}

export function getRuntimeTaskById(taskId: string): RuntimeProcessTask | null {
  return listRuntimeProcessTasks().find((task) => task.taskId === taskId) ?? null
}

export function listRuntimeTasksByBaseTaskId(baseTaskId: string): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter((task) => task.baseTaskId === baseTaskId)
}

export function listRuntimeTasksByStage(stageCode: 'PREP' | 'PROD' | 'POST'): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter((task) => task.stageCode === stageCode)
}

export function listRuntimeTasksByProcess(processCode: string): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter(
    (task) => task.processBusinessCode === processCode || task.processCode === processCode,
  )
}

function formatSplitStatusSummary(tasks: RuntimeTaskSplitResultSnapshot[]): string {
  if (tasks.length === 0) return '无拆分结果任务'
  const done = tasks.filter((task) => task.status === 'DONE').length
  const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length
  const pending = tasks.filter((task) => task.status === 'NOT_STARTED').length
  const blocked = tasks.filter((task) => task.status === 'BLOCKED').length
  const cancelled = tasks.filter((task) => task.status === 'CANCELLED').length
  const parts: string[] = []
  if (done > 0) parts.push(`已完成${done}`)
  if (inProgress > 0) parts.push(`进行中${inProgress}`)
  if (pending > 0) parts.push(`待执行${pending}`)
  if (blocked > 0) parts.push(`暂停${blocked}`)
  if (cancelled > 0) parts.push(`已取消${cancelled}`)
  return parts.length > 0 ? parts.join(' / ') : '待执行'
}

function formatSplitFactorySummary(tasks: RuntimeTaskSplitResultSnapshot[]): string {
  if (tasks.length === 0) return '-'
  const names = Array.from(
    new Set(
      tasks
        .map((task) => task.assignedFactoryName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  )
  return names.length > 0 ? names.join('、') : '-'
}

export function listRuntimeTaskSplitGroupsByOrder(productionOrderId: string): RuntimeTaskSplitGroupSnapshot[] {
  const orderTasks = listRuntimeTasksByOrder(productionOrderId)
  const grouped = new Map<string, { sourceTask?: RuntimeProcessTask; resultTasks: RuntimeProcessTask[] }>()

  for (const task of orderTasks) {
    if (!task.splitGroupId) continue
    const bucket = grouped.get(task.splitGroupId) ?? { sourceTask: undefined, resultTasks: [] }
    if (task.isSplitSource) {
      bucket.sourceTask = task
    } else if (task.isSplitResult) {
      bucket.resultTasks.push(task)
    }
    grouped.set(task.splitGroupId, bucket)
  }

  const snapshots: RuntimeTaskSplitGroupSnapshot[] = []
  for (const [splitGroupId, bucket] of grouped.entries()) {
    const sourceTask = bucket.sourceTask
    if (!sourceTask) continue

    const resultTasks = bucket.resultTasks
      .map<RuntimeTaskSplitResultSnapshot>((task) => ({
        taskId: task.taskId,
        taskNo: task.taskNo || task.taskId,
        splitSeq: task.splitSeq ?? 0,
        assignedFactoryId: task.assignedFactoryId,
        assignedFactoryName: task.assignedFactoryName,
        scopeQty: task.scopeQty,
        status: task.status,
        detailRowKeys: [...(task.detailRowKeys ?? task.scopeDetailRows.map((row) => row.rowKey))],
      }))
      .sort((a, b) => (a.splitSeq - b.splitSeq) || a.taskNo.localeCompare(b.taskNo))

    const eventAtCandidates = [
      sourceTask.updatedAt,
      sourceTask.createdAt,
      ...bucket.resultTasks.map((task) => task.updatedAt || task.createdAt),
    ].filter((value): value is string => Boolean(value))

    const eventAt = eventAtCandidates.sort((a, b) => b.localeCompare(a))[0] ?? nowTimestamp()

    snapshots.push({
      splitGroupId,
      rootTaskNo: sourceTask.rootTaskNo || sourceTask.taskNo || sourceTask.taskId,
      sourceTaskId: sourceTask.taskId,
      sourceTaskNo: sourceTask.taskNo || sourceTask.taskId,
      sourceStatus: sourceTask.status,
      sourceExecutionEnabled: isRuntimeTaskExecutionTask(sourceTask),
      resultTasks,
      eventAt,
      statusSummary: formatSplitStatusSummary(resultTasks),
      factorySummary: formatSplitFactorySummary(resultTasks),
    })
  }

  return snapshots.sort((a, b) => b.eventAt.localeCompare(a.eventAt))
}

export function isRuntimeTaskExecutionTask(task: RuntimeProcessTask): boolean {
  return task.executionEnabled !== false && task.isSplitSource !== true
}

export function listRuntimeExecutionTasks(): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))
}

function resolveTaskAssignmentGranularity(task: RuntimeProcessTask): ProcessAssignmentGranularity {
  return (task.assignmentGranularity as ProcessAssignmentGranularity | undefined)
    ?? getProcessAssignmentGranularity(task.processCode)
}

export function listRuntimeTaskAllocatableGroups(taskId: string): RuntimeTaskAllocatableGroup[] {
  const task = getRuntimeTaskById(taskId)
  if (!task) return []

  const detailRows = task.scopeDetailRows.length > 0
    ? task.scopeDetailRows
    : cloneTaskDetailRows(task.detailRows)

  return listTaskAllocatableGroups({
    taskId: task.taskId,
    assignmentGranularity: resolveTaskAssignmentGranularity(task),
    detailRows,
    fallbackQty: task.scopeQty,
    fallbackScopeLabel: task.scopeLabel || '整任务',
    scopeSkuLines: task.scopeSkuLines,
  }).map((group) => ({
    ...group,
    ...resolveRuntimeAllocatableGroupOutputValue(task, group),
  }))
}

function clearRuntimeTaskSplitPlan(sourceTaskId: string): void {
  const plan = runtimeTaskSplitPlans.get(sourceTaskId)
  if (!plan) return

  for (const splitTask of plan.results) {
    runtimeTaskOverrides.delete(splitTask.taskId)
  }
  runtimeTaskSplitPlans.delete(sourceTaskId)
}

export function dispatchRuntimeTaskByDetailGroups(input: RuntimeDetailDispatchInput): {
  ok: boolean
  mode?: 'SINGLE_FACTORY' | 'MULTI_FACTORY'
  message?: string
  createdTaskIds?: string[]
  resultAssignments?: Array<{
    taskId: string
    factoryId: string
    factoryName: string
    allocationUnitId?: string
    allocationUnitLabel?: string
    detailRowKeys?: string[]
    outputValuePerUnit?: number
    outputValueUnit?: string
    outputValueTotal?: number
    outputValueDifficulty?: OutputValueDifficulty
  }>
} {
  const task = getRuntimeTaskById(input.taskId)
  if (!task) return { ok: false, message: '任务不存在或已被移除' }
  if (task.isSplitResult) return { ok: false, message: '拆分结果任务不支持再次按明细分配，请对来源任务操作' }

  const groups = listRuntimeTaskAllocatableGroups(task.taskId)
  const validation = validateAllocatableGroupAssignments(groups, input.assignments)
  if (!validation.valid) return { ok: false, message: validation.reason ?? '分配单元校验失败' }

  const assignmentGranularity = resolveTaskAssignmentGranularity(task)
  const uniqueFactoryIds = Array.from(new Set(input.assignments.map((item) => item.factoryId)))
  if (assignmentGranularity === 'ORDER' && uniqueFactoryIds.length > 1) {
    return { ok: false, message: '该任务粒度为按生产单，仅支持整任务分配给同一工厂' }
  }

  const sourceTaskNo = getTaskNo(task)
  const rootTaskNo = getTaskRootNo(task)
  const splitDecision = resolveTaskSplitDecision({
    rootTaskNo,
    sourceTaskNo,
    groups,
    assignments: input.assignments,
  })

  const baseDetailRows = task.scopeDetailRows.length > 0
    ? task.scopeDetailRows
    : cloneTaskDetailRows(task.detailRows)
  const sourceDetailRowKeys = baseDetailRows.map((row) => row.rowKey)

  if (splitDecision.mode === 'SINGLE_FACTORY') {
    clearRuntimeTaskSplitPlan(task.taskId)
    const updated = updateRuntimeTaskWithAudit(
      task.taskId,
      {
        taskNo: splitDecision.sourceTaskNo,
        rootTaskNo: splitDecision.rootTaskNo,
        splitGroupId: undefined,
        splitFromTaskNo: undefined,
        splitSeq: 0,
        detailRowKeys: splitDecision.detailRowKeys,
        isSplitResult: false,
        isSplitSource: false,
        executionEnabled: true,
        assignmentMode: 'DIRECT',
        assignmentStatus: 'ASSIGNED',
        assignedFactoryId: splitDecision.factoryId,
        assignedFactoryName: splitDecision.factoryName,
      },
      'DETAIL_DISPATCH',
      `按明细分配完成（同一工厂：${splitDecision.factoryName}），保持原任务执行`,
      input.by,
    )

    if (!updated) {
      return { ok: false, message: '更新任务分配结果失败' }
    }

    recomputeRuntimeTransitionsForOrder(task.productionOrderId)
    const resolvedTask = getRuntimeTaskById(task.taskId)
    const outputValue = resolvedTask ? resolveRuntimeTaskOutputValue(resolvedTask) : {}
    return {
      ok: true,
      mode: 'SINGLE_FACTORY',
      createdTaskIds: [],
      resultAssignments: groups.map((group) => ({
        taskId: task.taskId,
        factoryId: splitDecision.factoryId,
        factoryName: splitDecision.factoryName,
        allocationUnitId: group.groupKey,
        allocationUnitLabel: group.groupLabel,
        detailRowKeys: [...group.detailRowKeys],
        outputValuePerUnit: outputValue.outputValuePerUnit,
        outputValueUnit: outputValue.outputValueUnit,
        outputValueTotal: resolveRuntimeAllocatableGroupOutputValue(resolvedTask ?? task, group).outputValueTotal,
        outputValueDifficulty: outputValue.outputValueDifficulty,
      })),
    }
  }

  clearRuntimeTaskSplitPlan(task.taskId)

  const splitFactories: RuntimeSplitFactoryPlan[] = splitDecision.factories.map((factory) => ({
    ...factory,
    taskId: factory.taskNo,
  }))

  runtimeTaskSplitPlans.set(task.taskId, {
    sourceTaskId: task.taskId,
    sourceTaskNo: splitDecision.sourceTaskNo,
    rootTaskNo: splitDecision.rootTaskNo,
    splitGroupId: splitDecision.splitGroupId,
    createdAt: nowTimestamp(),
    createdBy: input.by,
    results: splitFactories.map((factory) => ({
      taskId: factory.taskId,
      taskNo: factory.taskNo,
      splitSeq: factory.splitSeq,
      detailRowKeys: [...factory.detailRowKeys],
      allocatableGroupKeys: [...factory.allocatableGroupKeys],
      scopeQty: factory.scopeQty,
      scopeLabel: factory.scopeLabel,
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: factory.factoryId,
      assignedFactoryName: factory.factoryName,
    })),
  })

  const sourceAuditLogs = appendRuntimeAudit(
    task,
    'DETAIL_SPLIT',
    `按明细分配到多个工厂，生成 ${splitFactories.length} 条平级任务`,
    input.by,
  )

  patchRuntimeTask(task.taskId, {
    taskNo: splitDecision.sourceTaskNo,
    rootTaskNo: splitDecision.rootTaskNo,
    splitGroupId: splitDecision.splitGroupId,
    splitFromTaskNo: undefined,
    splitSeq: 0,
    detailRowKeys: sourceDetailRowKeys,
    isSplitResult: false,
    isSplitSource: true,
    executionEnabled: false,
    assignedFactoryId: undefined,
    assignedFactoryName: undefined,
    assignmentStatus: 'ASSIGNED',
    updatedAt: nowTimestamp(),
    auditLogs: sourceAuditLogs,
  })

  for (const factory of splitFactories) {
    runtimeTaskOverrides.set(factory.taskId, {
      taskNo: factory.taskNo,
      rootTaskNo: splitDecision.rootTaskNo,
      splitGroupId: splitDecision.splitGroupId,
      splitFromTaskNo: splitDecision.sourceTaskNo,
      splitSeq: factory.splitSeq,
      detailRowKeys: [...factory.detailRowKeys],
      isSplitResult: true,
      isSplitSource: false,
      executionEnabled: true,
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: factory.factoryId,
      assignedFactoryName: factory.factoryName,
      updatedAt: nowTimestamp(),
    })
  }

  recomputeRuntimeTransitionsForOrder(task.productionOrderId)
  return {
    ok: true,
    mode: 'MULTI_FACTORY',
    createdTaskIds: splitFactories.map((factory) => factory.taskId),
    resultAssignments: splitFactories.flatMap((factory) =>
      groups
        .filter((group) => factory.allocatableGroupKeys.includes(group.groupKey))
        .map((group) => {
          const resolvedTask = getRuntimeTaskById(factory.taskId) ?? task
          const groupOutputValue = resolveRuntimeAllocatableGroupOutputValue(resolvedTask, group)
          return {
            taskId: factory.taskId,
            factoryId: factory.factoryId,
            factoryName: factory.factoryName,
            allocationUnitId: group.groupKey,
            allocationUnitLabel: group.groupLabel,
            detailRowKeys: [...group.detailRowKeys],
            outputValuePerUnit: groupOutputValue.outputValuePerUnit,
            outputValueUnit: groupOutputValue.outputValueUnit,
            outputValueTotal: groupOutputValue.outputValueTotal,
            outputValueDifficulty: groupOutputValue.outputValueDifficulty,
          }
        }),
    ),
  }
}

export interface RuntimeSewingScopeAllocationInput {
  taskId: string
  lines: Array<{ skuCode: string; qty: number }>
  by: string
  operatedAt?: string
}

/**
 * 把一个独立车缝执行范围原子分区为“本次分配范围 + 剩余范围”。
 * 分区继续使用既有 split plan，因此下游依赖会等待全部分区任务完成。
 */
export function allocateRuntimeSewingTaskScope(input: RuntimeSewingScopeAllocationInput): RuntimeProcessTask {
  const task = getRuntimeTaskById(input.taskId)
  if (!task) throw new Error(`任务 ${input.taskId} 不存在或已被移除`)
  if (!isRuntimeTaskExecutionTask(task) || !isRuntimeIndependentSewingTask(task)) {
    throw new Error(`任务 ${input.taskId} 不是可分配的独立车缝执行任务`)
  }
  if (task.assignmentStatus !== 'UNASSIGNED') throw new Error(`任务 ${input.taskId} 已进入分配流程，不可重复分区`)
  if (!input.by.trim()) throw new Error('分区操作人不能为空')

  const availableBySku = new Map(task.scopeSkuLines.map((line) => [line.skuCode, line]))
  const requestedBySku = new Map<string, number>()
  for (const line of input.lines) {
    const skuCode = line.skuCode.trim()
    if (!skuCode || requestedBySku.has(skuCode)) throw new Error('本次分配 SKU 不能为空或重复')
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error(`${skuCode || 'SKU'} 分配数量必须为正整数`)
    const available = availableBySku.get(skuCode)
    if (!available || line.qty > available.qty) throw new Error(`${skuCode} 分配数量超过待分配数量`)
    requestedBySku.set(skuCode, line.qty)
  }
  if (requestedBySku.size === 0) throw new Error('请至少选择一个 SKU 分配数量')

  const selectedLines = task.scopeSkuLines
    .filter((line) => requestedBySku.has(line.skuCode))
    .map((line) => ({ ...line, qty: requestedBySku.get(line.skuCode)! }))
  const selectedQty = selectedLines.reduce((sum, line) => sum + line.qty, 0)
  if (selectedQty === task.scopeQty && selectedLines.length === task.scopeSkuLines.length) return task

  const runtimeState = captureRuntimeDirectDispatchState()
  try {
    let ownerPlan = Array.from(runtimeTaskSplitPlans.values()).find((plan) =>
      plan.results.some((result) => result.taskId === task.taskId),
    )
    const rootTaskId = ownerPlan?.sourceTaskId ?? task.taskId
    const rootTask = getRuntimeTaskById(rootTaskId) ?? task
    const rootNo = getTaskRootNo(rootTask)
    const sourceNo = getTaskNo(rootTask)
    const existingResults = ownerPlan?.results ?? []
    const replacementIndex = ownerPlan
      ? existingResults.findIndex((result) => result.taskId === task.taskId)
      : -1
    const retainedResults = ownerPlan
      ? existingResults.filter((result) => result.taskId !== task.taskId)
      : []
    const usedIds = new Set(existingResults.map((result) => result.taskId))
    let suffix = existingResults.length + 1
    const nextId = (kind: 'A' | 'R') => {
      let candidate = ''
      do {
        candidate = `${rootNo}-${kind}${String(suffix).padStart(2, '0')}`
        suffix += 1
      } while (usedIds.has(candidate) || getRuntimeTaskById(candidate))
      usedIds.add(candidate)
      return candidate
    }
    const detailRows = task.scopeDetailRows.length > 0 ? task.scopeDetailRows : task.detailRows
    const scopedDetailRowsForSku = (skuCode: string, qty: number, partitionTaskId: string) => detailRows
      .filter((row) => row.dimensions.GARMENT_SKU === skuCode || task.scopeSkuLines.length === 1)
      .map((row, index) => ({ ...structuredClone(row), rowKey: `${row.rowKey}__${partitionTaskId}__${index + 1}`, qty }))
    const selectedTaskId = nextId('A')
    const selectedDetailRows = selectedLines.flatMap((line) => scopedDetailRowsForSku(line.skuCode, line.qty, selectedTaskId))
    const selectedPlan: RuntimeSplitResultPlan = {
      taskId: selectedTaskId,
      taskNo: selectedTaskId,
      splitSeq: suffix,
      detailRowKeys: selectedDetailRows.map((row) => row.rowKey),
      allocatableGroupKeys: selectedLines.map((line) => line.skuCode),
      scopeQty: selectedQty,
      scopeLabel: selectedLines.map((line) => `${line.skuCode} ${line.qty}件`).join('、'),
      scopeSkuLines: selectedLines,
      scopeDetailRows: selectedDetailRows,
      assignmentMode: 'DIRECT',
      assignmentStatus: 'UNASSIGNED',
    }
    const residualPlans: RuntimeSplitResultPlan[] = task.scopeSkuLines.flatMap((line) => {
      const remainingQty = line.qty - (requestedBySku.get(line.skuCode) ?? 0)
      if (remainingQty <= 0) return []
      const residualTaskId = nextId('R')
      const residualDetailRows = scopedDetailRowsForSku(line.skuCode, remainingQty, residualTaskId)
      return [{
        taskId: residualTaskId,
        taskNo: residualTaskId,
        splitSeq: suffix,
        detailRowKeys: residualDetailRows.map((row) => row.rowKey),
        allocatableGroupKeys: [line.skuCode],
        scopeQty: remainingQty,
        scopeLabel: `${line.skuCode} 剩余 ${remainingQty}件`,
        scopeSkuLines: [{ ...line, qty: remainingQty }],
        scopeDetailRows: residualDetailRows,
        assignmentMode: 'DIRECT' as const,
        assignmentStatus: 'UNASSIGNED' as const,
      }]
    })
    const partitions = [selectedPlan, ...residualPlans]
    const rebuiltResults = ownerPlan
      ? [
          ...retainedResults.slice(0, Math.max(0, replacementIndex)),
          ...partitions,
          ...retainedResults.slice(Math.max(0, replacementIndex)),
        ]
      : partitions
    const originalTotal = existingResults.length > 0
      ? existingResults.reduce((sum, result) => sum + result.scopeQty, 0)
      : task.scopeQty
    const rebuiltTotal = rebuiltResults.reduce((sum, result) => sum + result.scopeQty, 0)
    if (originalTotal !== rebuiltTotal) throw new Error('车缝数量分区前后总范围不守恒')

    const eventAt = input.operatedAt ?? nowTimestamp()
    ownerPlan = {
      sourceTaskId: rootTaskId,
      sourceTaskNo: sourceNo,
      rootTaskNo: rootNo,
      splitGroupId: ownerPlan?.splitGroupId ?? `SG-${rootNo}-QTY-${String(Date.now()).slice(-6)}`,
      createdAt: eventAt,
      createdBy: input.by,
      results: rebuiltResults.map((result, index) => ({ ...result, splitSeq: index + 1 })),
    }
    runtimeTaskSplitPlans.set(rootTaskId, ownerPlan)
    patchRuntimeTask(rootTaskId, {
      taskNo: sourceNo,
      rootTaskNo: rootNo,
      splitGroupId: ownerPlan.splitGroupId,
      isSplitSource: true,
      executionEnabled: false,
      assignmentStatus: 'ASSIGNED',
      updatedAt: eventAt,
      auditLogs: appendRuntimeAudit(rootTask, 'QUANTITY_SPLIT', `按 SKU 数量分区，本次 ${selectedQty} 件，剩余 ${task.scopeQty - selectedQty} 件`, input.by),
    })
    const allocated = getRuntimeTaskById(selectedTaskId)
    if (!allocated || allocated.scopeQty !== selectedQty) throw new Error('车缝数量分区结果生成失败')
    recomputeRuntimeTransitionsForOrder(task.productionOrderId)
    return getRuntimeTaskById(selectedTaskId) ?? allocated
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    throw error
  }
}

export function createRuntimeTaskTenderByDetailGroups(input: RuntimeDetailTenderInput): {
  ok: boolean
  message?: string
  createdTaskIds?: string[]
} {
  const task = getRuntimeTaskById(input.taskId)
  if (!task) return { ok: false, message: '任务不存在或已被移除' }
  if (task.isSplitResult) return { ok: false, message: '拆分结果任务不支持再次按明细创建招标单，请对来源任务操作' }

  const groups = listRuntimeTaskAllocatableGroups(task.taskId)
  if (groups.length <= 1) {
    return { ok: false, message: '该任务当前不需要按明细创建招标单，请使用整任务模式' }
  }

  clearRuntimeTaskSplitPlan(task.taskId)

  const sourceTaskNo = getTaskNo(task)
  const rootTaskNo = getTaskRootNo(task)
  const splitGroupId = `SG-${rootTaskNo}-TD-${String(Date.now()).slice(-6)}`
  const eventAt = nowTimestamp()
  const sourceDetailRows = task.scopeDetailRows.length > 0 ? task.scopeDetailRows : cloneTaskDetailRows(task.detailRows)

  const resultPlans: RuntimeSplitResultPlan[] = groups.map((group, index) => {
    const splitSeq = index + 1
    const taskNo = `${rootTaskNo}-${String(splitSeq).padStart(2, '0')}`
    return {
      taskId: taskNo,
      taskNo,
      splitSeq,
      detailRowKeys: [...group.detailRowKeys],
      allocatableGroupKeys: [group.groupKey],
      scopeQty: group.qty,
      scopeLabel: group.groupLabel,
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
    }
  })

  runtimeTaskSplitPlans.set(task.taskId, {
    sourceTaskId: task.taskId,
    sourceTaskNo,
    rootTaskNo,
    splitGroupId,
    createdAt: eventAt,
    createdBy: input.by,
    results: resultPlans,
  })

  patchRuntimeTask(task.taskId, {
    taskNo: sourceTaskNo,
    rootTaskNo,
    splitGroupId,
    splitFromTaskNo: undefined,
    splitSeq: 0,
    detailRowKeys: sourceDetailRows.map((row) => row.rowKey),
    isSplitResult: false,
    isSplitSource: true,
    executionEnabled: false,
    assignmentMode: 'BIDDING',
    assignmentStatus: 'BIDDING',
    updatedAt: eventAt,
    auditLogs: appendRuntimeAudit(
      task,
      'DETAIL_TENDER_SPLIT',
      `按明细创建招标单，生成 ${resultPlans.length} 条平级竞价任务`,
      input.by,
    ),
  })

  for (const result of resultPlans) {
    runtimeTaskOverrides.set(result.taskId, {
      taskNo: result.taskNo,
      rootTaskNo,
      splitGroupId,
      splitFromTaskNo: sourceTaskNo,
      splitSeq: result.splitSeq,
      detailRowKeys: [...result.detailRowKeys],
      isSplitResult: true,
      isSplitSource: false,
      executionEnabled: true,
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      updatedAt: eventAt,
    })
  }

  recomputeRuntimeTransitionsForOrder(task.productionOrderId)
  return {
    ok: true,
    createdTaskIds: resultPlans.map((result) => result.taskId),
  }
}

export function setRuntimeTaskAssignMode(taskId: string, mode: 'BIDDING' | 'HOLD', by: string): void {
  const task = getRuntimeTaskById(taskId)
  if (!task) return

  if (mode === 'BIDDING') {
    const patch: RuntimeTaskOverride = {
      assignmentMode: 'BIDDING',
      assignmentStatus:
        task.assignmentStatus === 'UNASSIGNED' || task.assignmentStatus === 'ASSIGNED'
          ? 'BIDDING'
          : task.assignmentStatus,
    }

    updateRuntimeTaskWithAudit(taskId, patch, 'SET_ASSIGN_MODE', '设为竞价分配', by)
    recomputeRuntimeTransitionsForOrder(task.productionOrderId)
    return
  }

  updateRuntimeTaskWithAudit(
    taskId,
    {
      assignmentStatus: 'UNASSIGNED',
    },
    'SET_ASSIGN_MODE',
    '设为暂不分配',
    by,
  )
  recomputeRuntimeTransitionsForOrder(task.productionOrderId)
}

export function batchSetRuntimeTaskAssignMode(taskIds: string[], mode: 'BIDDING' | 'HOLD', by: string): void {
  for (const taskId of taskIds) {
    setRuntimeTaskAssignMode(taskId, mode, by)
  }
}

export function upsertRuntimeTaskTender(
  taskId: string,
  payload: {
    tenderId: string
    biddingDeadline: string
    taskDeadline: string
    businessAssignedAt?: string
    assignmentOperatedAt?: string
    mainFactoryId?: string
    mainFactoryName?: string
    outputValuePerUnit?: number
    outputValueUnit?: string
    outputValueTotal?: number
    outputValueDifficulty?: OutputValueDifficulty
  },
  by: string,
): RuntimeProcessTask | null {
  const task = getRuntimeTaskById(taskId)
  if (!task) return null
  const sewingDeliverySlaKind = classifySewingDeliverySla(task)
  const activeSlaSnapshot = sewingDeliverySlaKind ? getSewingDeliverySlaSnapshot(taskId) : null
  const isCleanUnassigned = task.assignmentStatus === 'UNASSIGNED'
    && !task.assignedFactoryId?.trim()
    && task.acceptanceStatus !== 'ACCEPTED'
    && !task.tenderId?.trim()
    && !activeSlaSnapshot?.active
  const isReleasedRejectedTenderUpdate = task.assignmentStatus === 'BIDDING'
    && task.acceptanceStatus === 'REJECTED'
    && !task.assignedFactoryId?.trim()
    && task.tenderId === payload.tenderId
    && !activeSlaSnapshot?.active
  if (sewingDeliverySlaKind && !isCleanUnassigned && !isReleasedRejectedTenderUpdate) {
    throw new Error(`含车缝任务 ${taskId} 已有有效分配结果，不可通过普通入口发起新竞价，请走改派`)
  }
  if (
    task.taskUnitType === 'COMBINED_PROCESS_TASK'
    && task.acceptanceMode === 'CONTINUOUS_PROCESS'
    && !isReleasedRejectedTenderUpdate
    && (task.assignmentStatus !== 'UNASSIGNED' || Boolean(task.tenderId))
  ) {
    throw new Error(`连续工序任务 ${taskId} 已有有效分配结果，不可重复发起竞价`)
  }
  const assignmentOperatedAt = payload.assignmentOperatedAt ?? formatOperationLocalWallClock()
  const businessAssignedAt = payload.businessAssignedAt ?? assignmentOperatedAt
  if (compareSewingDeliveryDateTimes(businessAssignedAt, assignmentOperatedAt) > 0) {
    throw new Error('业务分配时间不能晚于当前操作时间')
  }

  const updated = updateRuntimeTaskWithAudit(
    taskId,
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: task.assignmentStatus === 'AWARDED' ? 'AWARDED' : 'BIDDING',
      tenderId: payload.tenderId,
      biddingDeadline: payload.biddingDeadline,
      taskDeadline: payload.taskDeadline,
      businessAssignedAt,
      assignmentOperatedAt,
      outputValuePerUnit: payload.outputValuePerUnit ?? task.outputValuePerUnit,
      outputValueUnit: payload.outputValueUnit ?? task.outputValueUnit,
      outputValueTotal: payload.outputValueTotal ?? task.outputValueTotal,
      outputValueDifficulty: payload.outputValueDifficulty ?? task.outputValueDifficulty,
    },
    'BIDDING_START',
    `发起竞价 ${payload.tenderId}`,
    by,
  )

  recomputeRuntimeTransitionsForOrder(task.productionOrderId)
  return updated
}

export function prepareRuntimeTaskTenderAward(
  input: RuntimeTaskTenderAwardInput,
): PreparedRuntimeTaskTenderAward {
  const task = getRuntimeTaskById(input.taskId)
  if (!task) throw new Error(`任务 ${input.taskId} 不存在或已被移除`)
  if (task.assignmentMode !== 'BIDDING' || !task.tenderId) {
    throw new Error(`任务 ${input.taskId} 尚未发起竞价，不可定标`)
  }
  if (task.assignmentStatus === 'AWARDED') {
    throw new Error(`任务 ${input.taskId} 已定标，不可重复定标`)
  }
  if (task.assignmentStatus !== 'BIDDING' && task.assignmentStatus !== 'AWAIT_AWARD') {
    throw new Error(`任务 ${input.taskId} 当前状态不可定标`)
  }
  if (!input.factoryId.trim() || !input.factoryName.trim()) {
    throw new Error(`任务 ${input.taskId} 缺少中标工厂`)
  }
  if (!input.awardedAt.trim()) {
    throw new Error(`任务 ${input.taskId} 缺少定标时间`)
  }
  if (!Number.isFinite(input.awardedPrice) || input.awardedPrice <= 0) {
    throw new Error(`任务 ${input.taskId} 中标价格必须为正数`)
  }
  return {
    input: { ...input },
    originalTask: task,
    requiresFactoryAcceptance: classifySewingDeliverySla(task) !== null,
  }
}

export function awardRuntimeTaskTender(input: RuntimeTaskTenderAwardInput): RuntimeProcessTask {
  const preparation = prepareRuntimeTaskTenderAward(input)
  const { originalTask, requiresFactoryAcceptance } = preparation
  const runtimeState = captureRuntimeDirectDispatchState()
  try {
    const updated = updateRuntimeTaskWithAudit(
      input.taskId,
      {
        assignmentMode: 'BIDDING',
        assignmentStatus: 'AWARDED',
        assignedFactoryId: input.factoryId,
        assignedFactoryName: input.factoryName,
        awardedAt: input.awardedAt,
        dispatchPrice: input.awardedPrice,
        dispatchPriceCurrency: originalTask.standardPriceCurrency ?? 'IDR',
        dispatchPriceUnit: originalTask.standardPriceUnit ?? originalTask.qtyUnit,
        ...(requiresFactoryAcceptance
          ? {
              acceptanceStatus: 'PENDING' as const,
              acceptedAt: undefined,
              acceptedBy: undefined,
              deliverySlaSnapshotId: undefined,
            }
          : {
              acceptanceStatus: 'ACCEPTED' as const,
              acceptedAt: input.awardedAt,
              acceptedBy: input.by,
            }),
      },
      'TENDER_AWARD',
      `平台定标给 ${input.factoryName}，中标价 ${input.awardedPrice.toLocaleString()} ${originalTask.standardPriceCurrency ?? 'IDR'}/${originalTask.standardPriceUnit ?? originalTask.qtyUnit}`,
      input.by,
    )
    if (!updated) throw new Error(`任务 ${input.taskId} 定标提交失败`)
    if (!requiresFactoryAcceptance && isRuntimeSewingTask(updated)) {
      const registeredOrder = registerProductionOrderSewingFactory({
        productionOrderId: updated.productionOrderId,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        by: input.by,
        at: input.awardedAt,
      })
      if (!registeredOrder) {
        throw new Error(`车缝承接工厂登记失败：${input.factoryName}`)
      }
    }
    recomputeRuntimeTransitionsForOrder(updated.productionOrderId)
    return getRuntimeTaskById(updated.taskId) ?? updated
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    throw error
  }
}

export function acceptRuntimeTaskAssignment(
  taskId: string,
  input: RuntimeTaskAssignmentAcceptanceInput,
): RuntimeProcessTask {
  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`任务 ${taskId} 不存在或已被移除`)
  if (!input.factoryId.trim()) throw new Error(`任务 ${taskId} 缺少当前操作工厂`)
  if (!task.assignedFactoryId || !task.assignedFactoryName) {
    throw new Error(`任务 ${taskId} 尚未确定承接工厂，不可接单`)
  }
  if (input.factoryId !== task.assignedFactoryId) {
    throw new Error(`当前工厂不是任务 ${taskId} 的中标工厂，无权确认接单`)
  }
  if (task.acceptanceStatus === 'ACCEPTED') throw new Error(`任务 ${taskId} 已接单，不可重复接单`)
  if (task.acceptanceStatus === 'REJECTED') throw new Error(`任务 ${taskId} 已拒单，拒单后不可接单`)
  if (task.assignmentStatus !== 'ASSIGNED' && task.assignmentStatus !== 'AWARDED') {
    throw new Error(`任务 ${taskId} 未分配或未定标，不可接单`)
  }
  if (!input.acceptedAt.trim() || !input.acceptedBy.trim()) {
    throw new Error(`任务 ${taskId} 缺少接单时间或接单人`)
  }
  const operatedAt = input.operatedAt ?? formatOperationLocalWallClock()
  let acceptedBeforeAward = false
  let acceptedAfterOperation = false
  try {
    acceptedBeforeAward = Boolean(task.awardedAt) && compareSewingDeliveryDateTimes(input.acceptedAt, task.awardedAt!) < 0
    acceptedAfterOperation = compareSewingDeliveryDateTimes(input.acceptedAt, operatedAt) > 0
  } catch {
    throw new Error(`任务 ${taskId} 接单时间或操作时间格式无效`)
  }
  if (acceptedBeforeAward) throw new Error(`任务 ${taskId} 接单时间不能早于定标时间`)
  if (acceptedAfterOperation) throw new Error(`任务 ${taskId} 接单时间不能晚于当前操作时间`)

  const slaKind = classifySewingDeliverySla(task)
  const snapshotSequence = listSewingDeliverySlaSnapshotHistory(taskId).length + 1
  const deliverySlaSnapshot = slaKind
    ? createSewingDeliverySlaSnapshot({
        assignmentId: `${taskId}-${input.acceptedAt.replace(/\D/g, '')}-${String(snapshotSequence).padStart(3, '0')}`,
        runtimeTaskId: taskId,
        productionOrderId: task.productionOrderId,
        factoryId: task.assignedFactoryId,
        factoryName: task.assignedFactoryName,
        assignedQty: task.scopeQty,
        acceptedAt: input.acceptedAt,
        slaKind,
      })
    : null
  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  try {
    const updated = updateRuntimeTaskWithAudit(
      taskId,
      {
        acceptanceStatus: 'ACCEPTED',
        acceptedAt: input.acceptedAt,
        acceptedBy: input.acceptedBy,
        deliverySlaSnapshotId: deliverySlaSnapshot?.snapshotId,
        taskDeadline: deliverySlaSnapshot?.milestones.at(-1)?.deadlineAt ?? task.taskDeadline,
      },
      'ACCEPT_TASK',
      deliverySlaSnapshot
        ? '中标工厂确认接单，按实际接单时间生成含车缝交付时效快照。'
        : '工厂确认接单。',
      input.acceptedBy,
    )
    if (!updated) throw new Error(`任务 ${taskId} 接单提交失败`)
    if (isRuntimeSewingTask(updated)) {
      const registeredOrder = registerProductionOrderSewingFactory({
        productionOrderId: updated.productionOrderId,
        factoryId: task.assignedFactoryId,
        factoryName: task.assignedFactoryName,
        by: input.acceptedBy,
        at: input.acceptedAt,
      })
      if (!registeredOrder) {
        throw new Error(`车缝承接工厂登记失败：${task.assignedFactoryName}`)
      }
    }
    if (deliverySlaSnapshot) saveSewingDeliverySlaSnapshot(deliverySlaSnapshot)
    recomputeRuntimeTransitionsForOrder(updated.productionOrderId)
    return getRuntimeTaskById(updated.taskId) ?? updated
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
    throw error
  }
}

export interface RuntimeTaskAssignmentRejectionInput {
  factoryId: string
  reason: string
  rejectedAt: string
  rejectedBy: string
}

export function rejectRuntimeTaskAssignment(
  taskId: string,
  input: RuntimeTaskAssignmentRejectionInput,
): RuntimeProcessTask {
  const task = getRuntimeTaskById(taskId)
  if (!task) throw new Error(`任务 ${taskId} 不存在或已被移除`)
  if (task.acceptanceStatus === 'REJECTED') throw new Error(`任务 ${taskId} 已拒单，不可重复拒单`)
  if (task.acceptanceStatus !== 'PENDING' || (task.assignmentStatus !== 'ASSIGNED' && task.assignmentStatus !== 'AWARDED')) {
    throw new Error(`任务 ${taskId} 不是待接单状态，不可拒单`)
  }
  if (!task.assignedFactoryId || input.factoryId !== task.assignedFactoryId) {
    throw new Error(`当前工厂不是任务 ${taskId} 的承接工厂，无权拒单`)
  }
  const reason = input.reason.trim()
  const rejectedBy = input.rejectedBy.trim()
  if (!reason || !rejectedBy || !input.rejectedAt.trim()) throw new Error('拒单原因、拒单人和拒单时间不能为空')

  const runtimeState = captureRuntimeDirectDispatchState()
  try {
    const returnsToTender = task.assignmentMode === 'BIDDING' && Boolean(task.tenderId)
    const auditLogs: TaskAuditLog[] = [...task.auditLogs, {
      id: makeRuntimeAuditId(taskId),
      action: 'REJECT_TASK',
      detail: `工厂拒绝接单，原因：${reason}`,
      at: input.rejectedAt,
      by: rejectedBy,
    }]
    const updated = patchRuntimeTask(taskId, {
      assignmentStatus: returnsToTender ? 'BIDDING' : 'UNASSIGNED',
      assignedFactoryId: undefined,
      assignedFactoryName: undefined,
      awardedAt: undefined,
      dispatchPrice: undefined,
      dispatchPriceCurrency: undefined,
      dispatchPriceUnit: undefined,
      priceDiffReason: undefined,
      acceptDeadline: undefined,
      dispatchedAt: undefined,
      dispatchedBy: undefined,
      businessAssignedAt: returnsToTender ? task.businessAssignedAt : undefined,
      assignmentOperatedAt: returnsToTender ? task.assignmentOperatedAt : undefined,
      deliverySlaSnapshotId: undefined,
      acceptanceStatus: 'REJECTED',
      acceptedAt: undefined,
      acceptedBy: undefined,
      updatedAt: input.rejectedAt,
      auditLogs,
    })
    if (!updated) throw new Error(`任务 ${taskId} 拒单提交失败`)
    return getRuntimeTaskById(taskId) ?? updated
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    throw error
  }
}

export function validateRuntimeBatchDispatchSelection(taskIds: string[]): RuntimeBatchDispatchSelectionValidation {
  const selected = taskIds
    .map((taskId) => getRuntimeTaskById(taskId))
    .filter((task): task is RuntimeProcessTask => Boolean(task))

  if (selected.length === 0) {
    return { valid: false, reason: '请选择至少一条任务后再派单' }
  }

  if (selected.length !== taskIds.length) {
    return { valid: false, reason: '部分任务不存在或已被移除，请刷新后重新选择' }
  }

  if (selected.some((task) => !isRuntimeTaskExecutionTask(task))) {
    return { valid: false, reason: '拆分来源任务不可直接派单，请选择可执行任务' }
  }

  const orderIds = new Set(selected.map((task) => task.productionOrderId))
  if (orderIds.size > 1) {
    return { valid: false, reason: '批量直接派单仅支持同一生产单' }
  }

  const processCodes = new Set(selected.map((task) => task.processCode))
  if (processCodes.size > 1) {
    return { valid: false, reason: '批量直接派单仅支持同一工序' }
  }

  const currencies = new Set(selected.map((task) => task.standardPriceCurrency ?? 'IDR'))
  if (currencies.size > 1) {
    return { valid: false, reason: '批量直接派单要求标准价币种一致' }
  }

  const units = new Set(selected.map((task) => task.standardPriceUnit ?? '件'))
  if (units.size > 1) {
    return { valid: false, reason: '批量直接派单要求标准价单位一致' }
  }

  return {
    valid: true,
    productionOrderId: selected[0].productionOrderId,
    processCode: selected[0].processCode,
    currency: selected[0].standardPriceCurrency ?? 'IDR',
    unit: selected[0].standardPriceUnit ?? '件',
  }
}

export function validateRuntimeFactoryAssignment(input: {
  taskIds: string[]
  factoryId: string
}): RuntimeFactoryAssignmentValidation {
  const targetTasks = input.taskIds
    .map((taskId) => getRuntimeTaskById(taskId))
    .filter((task): task is RuntimeProcessTask => Boolean(task))

  if (targetTasks.length === 0) return { valid: true }

  const affectedOrders = new Set(targetTasks.map((task) => task.productionOrderId))
  for (const orderId of affectedOrders) {
    const orderTasks = listRuntimeTasksByOrder(orderId)

    const assignedToFactory = orderTasks.filter(
      (task) => task.assignedFactoryId === input.factoryId || input.taskIds.includes(task.taskId),
    )

    const skuScoped = assignedToFactory.filter((task) => task.scopeType === 'SKU' && Boolean(task.skuCode))
    if (skuScoped.length === 0) continue

    const skuSet = new Set(skuScoped.map((task) => task.skuCode))
    const processSet = new Set(skuScoped.map((task) => task.processCode))

    // 规则2：同工厂在同一生产单内，若跨多个工序，则必须是同一SKU。
    if (skuSet.size > 1 && processSet.size > 1) {
      return {
        valid: false,
        reason: '同一工厂跨工序承接时必须保持同一SKU，请调整分配组合',
        conflictedTaskIds: skuScoped.map((task) => task.taskId),
      }
    }
  }

  return { valid: true }
}

export function batchDispatchRuntimeTasks(input: RuntimeBatchDispatchInput): {
  ok: boolean
  message?: string
} {
  const selectionValidation = validateRuntimeBatchDispatchSelection(input.taskIds)
  if (!selectionValidation.valid) {
    return { ok: false, message: selectionValidation.reason }
  }

  const factoryValidation = validateRuntimeFactoryAssignment({
    taskIds: input.taskIds,
    factoryId: input.factoryId,
  })
  if (!factoryValidation.valid) {
    return { ok: false, message: factoryValidation.reason }
  }

  const operatedAt = input.operatedAt ?? formatOperationLocalWallClock()
  const businessAssignedAt = input.businessAssignedAt ?? operatedAt
  let preparations: PreparedRuntimeDirectDispatchMeta[]
  try {
    preparations = input.taskIds.map((taskId) => {
      const task = getRuntimeTaskById(taskId)
      const outputValue = task ? resolveRuntimeTaskOutputValue(task) : {}
      return prepareRuntimeDirectDispatchMeta({
        taskId,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        acceptDeadline: input.acceptDeadline,
        taskDeadline: input.taskDeadline,
        remark: input.remark,
        by: input.by,
        dispatchPrice: input.dispatchPrice,
        dispatchPriceCurrency: input.dispatchPriceCurrency,
        dispatchPriceUnit: input.dispatchPriceUnit,
        priceDiffReason: input.priceDiffReason,
        operatedAt,
        businessAssignedAt,
        autoAccept: input.autoAccept,
        ...outputValue,
      })
    })
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '直接派单前置校验失败' }
  }

  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  try {
    for (const preparation of preparations) {
      if (!commitPreparedRuntimeDirectDispatchMeta(preparation)) {
        throw new Error(`任务 ${preparation.input.taskId} 直接派单提交失败`)
      }
    }

    const orderIds = getOrderIdsFromTaskIds(input.taskIds)
    for (const orderId of orderIds) {
      recomputeRuntimeTransitionsForOrder(orderId)
    }
    return { ok: true }
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
    return { ok: false, message: error instanceof Error ? error.message : '直接派单提交失败' }
  }
}

export function prepareRuntimeDirectDispatchMeta(
  input: RuntimeDirectDispatchMetaInput,
  target: RuntimeDirectDispatchPreparationTarget = {},
): PreparedRuntimeDirectDispatchMeta {
  const originalTask = target.task ?? getRuntimeTaskById(input.taskId)
  if (!originalTask) throw new Error(`任务 ${input.taskId} 不存在或已被移除`)
  const sewingDeliverySlaKind = classifySewingDeliverySla(originalTask)
  const activeSlaSnapshot = sewingDeliverySlaKind ? getSewingDeliverySlaSnapshot(originalTask.taskId) : null
  if (
    sewingDeliverySlaKind
    && (
      originalTask.assignmentStatus !== 'UNASSIGNED'
      || Boolean(originalTask.assignedFactoryId?.trim())
      || originalTask.acceptanceStatus === 'ACCEPTED'
      || Boolean(originalTask.tenderId?.trim())
      || Boolean(activeSlaSnapshot?.active)
    )
  ) {
    throw new Error(`含车缝任务 ${input.taskId} 已有有效分配结果，不可通过普通入口覆盖，请走改派`)
  }
  if (
    originalTask.taskUnitType === 'COMBINED_PROCESS_TASK'
    && originalTask.acceptanceMode === 'CONTINUOUS_PROCESS'
    && (
      originalTask.assignmentStatus !== 'UNASSIGNED'
      || Boolean(originalTask.assignedFactoryId?.trim())
      || originalTask.acceptanceStatus === 'ACCEPTED'
      || Boolean(originalTask.tenderId?.trim())
    )
  ) {
    throw new Error(`连续工序任务 ${input.taskId} 已有有效分配结果，不可通过普通入口覆盖`)
  }

  const operatedAt = input.operatedAt ?? input.dispatchedAt ?? formatOperationLocalWallClock()
  const businessAssignedAt = input.businessAssignedAt ?? operatedAt
  if (compareSewingDeliveryDateTimes(businessAssignedAt, operatedAt) > 0) {
    throw new Error('业务分配时间不能晚于当前操作时间')
  }

  const assignedQty = target.assignedQty ?? originalTask.scopeQty
  const runtimeTaskId = target.runtimeTaskId ?? originalTask.taskId
  const snapshotSequence = listSewingDeliverySlaSnapshotHistory(runtimeTaskId).length + 1
  const assignmentId = target.assignmentId
    ?? `${runtimeTaskId}-${operatedAt.replace(/\D/g, '')}-${String(snapshotSequence).padStart(3, '0')}`
  const deliverySlaSnapshot = sewingDeliverySlaKind
    ? createSewingDeliverySlaSnapshot({
        assignmentId,
        runtimeTaskId,
        productionOrderId: originalTask.productionOrderId,
        factoryId: input.factoryId,
        factoryName: input.factoryName,
        assignedQty,
        acceptedAt: businessAssignedAt,
        slaKind: sewingDeliverySlaKind,
      })
    : null
  const containsSewing = isRuntimeSewingTask(originalTask)
  const acceptanceSla =
    input.acceptanceSla
    ?? resolveDispatchAcceptanceSlaForTask(
      originalTask,
      input.factoryId,
      input.factoryName,
      operatedAt,
    )
  const acceptDeadline = input.acceptDeadline || buildDispatchAcceptanceDeadline(operatedAt, acceptanceSla)
  const autoAccept = Boolean(containsSewing || input.autoAccept || acceptanceSla.autoAccept)
  const acceptedAt = autoAccept ? (containsSewing ? businessAssignedAt : operatedAt) : undefined
  const acceptedBy = containsSewing
    ? SEWING_DELIVERY_SLA_AUTO_ACCEPT_BY
    : autoAccept
      ? DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY
      : undefined
  const auditDetail = deliverySlaSnapshot
    ? '含车缝任务直接派单后，系统按业务分配时间自动接单并生成交付时效快照。'
    : containsSewing
      ? '含车缝任务直接派单后，系统按业务分配时间自动接单。'
    : autoAccept
      ? `${describeDispatchAcceptanceSlaResolution(acceptanceSla)}，派单后系统自动接单。`
      : `${describeDispatchAcceptanceSlaResolution(acceptanceSla)}，已发起直接派单，待工厂确认。`
  return {
    input,
    originalTask,
    operatedAt,
    businessAssignedAt,
    acceptanceSla,
    acceptDeadline,
    autoAccept,
    acceptedAt,
    acceptedBy,
    auditDetail,
    deliverySlaSnapshot,
  }
}

function commitPreparedRuntimeDirectDispatchMeta(
  preparation: PreparedRuntimeDirectDispatchMeta,
): RuntimeProcessTask | null {
  const {
    input,
    operatedAt,
    businessAssignedAt,
    acceptanceSla,
    acceptDeadline,
    autoAccept,
    acceptedAt,
    acceptedBy,
    auditDetail,
    deliverySlaSnapshot,
  } = preparation
  const updated = updateRuntimeTaskWithAudit(
    input.taskId,
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: input.factoryId,
      assignedFactoryName: input.factoryName,
      acceptDeadline,
      taskDeadline: deliverySlaSnapshot?.milestones.at(-1)?.deadlineAt ?? input.taskDeadline,
      dispatchRemark: input.remark.trim() || undefined,
      dispatchedAt: operatedAt,
      dispatchedBy: input.by,
      businessAssignedAt,
      assignmentOperatedAt: operatedAt,
      deliverySlaSnapshotId: deliverySlaSnapshot?.snapshotId,
      dispatchPrice: input.dispatchPrice,
      dispatchPriceCurrency: input.dispatchPriceCurrency,
      dispatchPriceUnit: input.dispatchPriceUnit,
      priceDiffReason: input.priceDiffReason.trim() || undefined,
      acceptanceStatus: autoAccept ? 'ACCEPTED' : 'PENDING',
      acceptedAt,
      acceptedBy,
      dispatchAcceptanceSlaConfigId: acceptanceSla.configId,
      dispatchAcceptanceSlaOverrideId: acceptanceSla.overrideId,
      dispatchAcceptanceSlaRuleSource: acceptanceSla.ruleSource,
      dispatchAcceptanceTimeoutHours: acceptanceSla.acceptTimeoutHours ?? undefined,
      dispatchAcceptanceSlaLabel: describeDispatchAcceptanceSlaResolution(acceptanceSla),
      outputValuePerUnit: input.outputValuePerUnit,
      outputValueUnit: input.outputValueUnit,
      outputValueTotal: input.outputValueTotal,
      outputValueDifficulty: input.outputValueDifficulty,
    },
    'DISPATCH',
    auditDetail,
    input.by,
  )

  if (updated && isRuntimeSewingTask(updated)) {
    const registeredOrder = registerProductionOrderSewingFactory({
      productionOrderId: updated.productionOrderId,
      factoryId: input.factoryId,
      factoryName: input.factoryName,
      by: input.by,
      at: operatedAt,
    })
    if (!registeredOrder) {
      throw new Error(`车缝承接工厂登记失败：${input.factoryName || input.factoryId}`)
    }
    if (input.writeBackMainFactory === true) {
      const selectedOrder = selectProductionOrderMainFactory({
        productionOrderId: updated.productionOrderId,
        factoryId: input.factoryId,
        by: input.by,
        at: operatedAt,
        reason: '按明细派单时明确指定该车缝承接工厂为生产单主工厂。',
      })
      if (!selectedOrder) {
        throw new Error(`生产单主工厂选择失败：${input.factoryName || input.factoryId}`)
      }
    }
  }

  if (updated && deliverySlaSnapshot) {
    saveSewingDeliverySlaSnapshot(deliverySlaSnapshot)
  }

  return updated
}

export function applyRuntimeDirectDispatchMeta(input: RuntimeDirectDispatchMetaInput): RuntimeProcessTask | null {
  const runtimeState = captureRuntimeDirectDispatchState()
  const snapshotState = captureSewingDeliverySlaSnapshotStore()
  try {
    return commitPreparedRuntimeDirectDispatchMeta(prepareRuntimeDirectDispatchMeta(input))
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(snapshotState)
    throw error
  }
}

export function reassignRuntimeSewingTask(
  input: RuntimeSewingTaskReassignmentInput,
): RuntimeSewingTaskReassignmentResult {
  const runtimeState = captureRuntimeDirectDispatchState()
  const slaState = captureSewingDeliverySlaSnapshotStore()
  const reject = (message: string): RuntimeSewingTaskReassignmentResult => {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(slaState)
    return { ok: false, message }
  }
  const source = getRuntimeTaskById(input.sourceTaskId)
  const snapshot = getSewingDeliverySlaSnapshot(input.sourceTaskId)
  if (!source || classifySewingDeliverySla(source) === null || !snapshot?.active) {
    return reject('原任务没有生效中的含车缝分配，不可改派')
  }
  if (!input.targetFactoryId.trim() || !input.targetFactoryName.trim()) {
    return reject('请选择目标工厂')
  }
  if (input.targetFactoryId === source.assignedFactoryId) {
    return reject('目标工厂不能与原工厂相同')
  }
  if (!input.reason.trim() || !input.by.trim()) return reject('请填写改派原因和操作人')
  if (compareSewingDeliveryDateTimes(input.businessAssignedAt, input.operatedAt) > 0) {
    return reject('业务分配时间不能晚于当前操作时间')
  }
  const confirmedReceivedQty = sumSewingDeliveryConfirmedReceiptQty(input.sourceTaskId, input.operatedAt)
  const remainingQty = Math.max(snapshot.assignedQty - confirmedReceivedQty, 0)
  if (remainingQty <= 0) return reject('原任务已全部实收，无剩余数量可改派')

  const sequence = listSewingDeliverySlaSnapshotHistory(input.sourceTaskId).length + 1
  const assignmentId = `${input.sourceTaskId}-REASSIGN-${input.operatedAt.replace(/\D/g, '')}-${String(sequence).padStart(3, '0')}`
  const newTaskId = `${input.sourceTaskId}__R${String(sequence).padStart(2, '0')}`
  if (runtimeReassignedTasks.has(newTaskId)) return reject('该任务已完成本次改派，请勿重复提交')
  const replacement = createSewingDeliverySlaSnapshot({
    assignmentId,
    runtimeTaskId: newTaskId,
    productionOrderId: source.productionOrderId,
    factoryId: input.targetFactoryId,
    factoryName: input.targetFactoryName,
    assignedQty: remainingQty,
    acceptedAt: input.businessAssignedAt,
    slaKind: classifySewingDeliverySla(source)!,
  })
  try {
    const auditDetail = `车缝任务改派：${source.assignedFactoryName ?? '原工厂'} → ${input.targetFactoryName}；原因：${input.reason.trim()}`
    const newTask: RuntimeProcessTask = {
      ...structuredClone(source),
      taskId: newTaskId,
      taskNo: `${source.taskNo ?? source.taskId}-改派${sequence}`,
      scopeQty: remainingQty,
      assignedQty: remainingQty,
      qty: remainingQty,
      baseQty: remainingQty,
      assignedFactoryId: input.targetFactoryId,
      assignedFactoryName: input.targetFactoryName,
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      acceptanceStatus: 'ACCEPTED',
      status: 'NOT_STARTED',
      acceptedAt: input.businessAssignedAt,
      acceptedBy: SEWING_DELIVERY_SLA_AUTO_ACCEPT_BY,
      businessAssignedAt: input.businessAssignedAt,
      assignmentOperatedAt: input.operatedAt,
      dispatchedAt: input.operatedAt,
      dispatchedBy: input.by,
      deliverySlaSnapshotId: replacement.snapshotId,
      taskDeadline: replacement.milestones.at(-1)?.deadlineAt,
      auditLogs: appendRuntimeAudit(source, 'REASSIGN_IN', auditDetail, input.by),
      executionEnabled: true,
      startedAt: undefined,
      finishedAt: undefined,
      startHeadcount: undefined,
      startProofFiles: undefined,
      startOverdueExceptionId: undefined,
      milestoneStatus: undefined,
      milestoneReportedAt: undefined,
      milestoneReportedQty: undefined,
      milestoneProofFiles: undefined,
      milestoneOverdueExceptionId: undefined,
      pauseStatus: undefined,
      pauseReasonCode: undefined,
      pauseReasonLabel: undefined,
      pauseRemark: undefined,
      pauseReportedAt: undefined,
      pauseProofFiles: undefined,
      pauseExceptionId: undefined,
      blockReason: undefined,
      blockRemark: undefined,
      blockedAt: undefined,
      handoverOrderId: undefined,
      handoverStatus: 'NOT_CREATED',
      taskQrValue: buildTaskQrValue(newTaskId),
      taskQrStatus: 'ACTIVE',
    }
    runtimeReassignedTasks.set(newTaskId, newTask)
    const oldUpdated = updateRuntimeTaskWithAudit(
      source.taskId,
      { executionEnabled: false },
      'REASSIGN_OUT',
      auditDetail,
      input.by,
    )
    if (!oldUpdated) throw new Error('原任务改派状态保存失败')
    for (const downstream of listRuntimeProcessTasks()) {
      if (downstream.taskId === newTaskId || !downstream.dependsOnTaskIds.includes(source.taskId)) continue
      const nextDependsOnTaskIds = Array.from(new Set(
        downstream.dependsOnTaskIds.map((taskId) => taskId === source.taskId ? newTaskId : taskId),
      ))
      if (!updateRuntimeTaskWithAudit(
        downstream.taskId,
        { dependsOnTaskIds: nextDependsOnTaskIds },
        'REASSIGN_DEPENDENCY',
        `上游任务改派，依赖由 ${source.taskId} 切换为 ${newTaskId}。`,
        input.by,
      )) throw new Error(`下游任务 ${downstream.taskId} 依赖换绑失败`)
    }
    if (!registerProductionOrderSewingFactory({
      productionOrderId: source.productionOrderId,
      factoryId: input.targetFactoryId,
      factoryName: input.targetFactoryName,
      by: input.by,
      at: input.operatedAt,
    })) throw new Error('新车缝承接工厂登记失败')

    replaceSewingDeliverySlaSnapshot(source.taskId, replacement)

    const activeFactoryIds = Array.from(new Set(
      listRuntimeProcessTasks()
        .filter((task) => task.productionOrderId === source.productionOrderId)
        .filter((task) => task.taskId !== source.taskId && task.executionEnabled !== false)
        .filter((task) => task.status !== 'CANCELLED' && task.acceptanceStatus === 'ACCEPTED')
        .filter((task) => {
          if (classifySewingDeliverySla(task) === null || !task.assignedFactoryId) return false
          const activeSnapshot = getSewingDeliverySlaSnapshot(task.taskId)
          return Boolean(activeSnapshot?.active && activeSnapshot.factoryId === task.assignedFactoryId)
        })
        .map((task) => task.assignedFactoryId!),
    ))
    if (!withdrawProductionOrderSewingFactory({
      productionOrderId: source.productionOrderId,
      factoryId: source.assignedFactoryId ?? snapshot.factoryId,
      remainingActiveFactoryIds: activeFactoryIds,
      mainFactoryId: input.mainFactoryId,
      reason: input.reason,
      by: input.by,
      at: input.operatedAt,
    })) throw new Error('主工厂候选需要明确选择后才能完成改派')
    recomputeRuntimeTransitionsForOrder(source.productionOrderId)
    return { ok: true, message: '改派成功', assignmentId, taskId: newTaskId, assignedQty: remainingQty }
  } catch (error) {
    restoreRuntimeDirectDispatchState(runtimeState)
    restoreSewingDeliverySlaSnapshotStore(slaState)
    return { ok: false, message: error instanceof Error ? error.message : '改派失败' }
  }
}

const disposeRuntimeTaskReadResolver = installRuntimeTaskReadResolver(
  (taskId) => getRuntimeTaskById(taskId),
  import.meta.url,
)
import.meta.hot?.dispose(disposeRuntimeTaskReadResolver)

function parseRuntimeDateLike(value: string): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

export function applyPendingDispatchAutoAcceptance(now: string = nowTimestamp()): {
  acceptedCount: number
  taskIds: string[]
} {
  const nowMs = parseRuntimeDateLike(now)
  if (!Number.isFinite(nowMs)) return { acceptedCount: 0, taskIds: [] }

  const acceptedTaskIds: string[] = []
  for (const task of listRuntimeProcessTasks()) {
    if (task.assignmentMode !== 'DIRECT') continue
    if (task.assignmentStatus !== 'ASSIGNED') continue
    if (task.acceptanceStatus !== 'PENDING') continue
    if (!task.acceptDeadline) continue

    const deadlineMs = parseRuntimeDateLike(task.acceptDeadline)
    if (!Number.isFinite(deadlineMs) || deadlineMs > nowMs) continue

    const updated = updateRuntimeTaskWithAudit(
      task.taskId,
      {
        acceptanceStatus: 'ACCEPTED',
        acceptedAt: now,
        acceptedBy: DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY,
      },
      'AUTO_ACCEPT_BY_SLA',
      `接单时效到期，系统自动接单。${task.dispatchAcceptanceSlaLabel || ''}`.trim(),
      DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY,
    )
    if (updated) acceptedTaskIds.push(task.taskId)
  }

  return { acceptedCount: acceptedTaskIds.length, taskIds: acceptedTaskIds }
}

export function recomputeRuntimeTransitionsForOrder(productionOrderId: string): RuntimeProcessTask[] {
  const tasks = listRuntimeTasksByOrder(productionOrderId)
  const recomputed = computeTransitionsForOrder(tasks)

  for (const task of recomputed) {
    const override = runtimeTaskOverrides.get(task.taskId) ?? {}
    runtimeTaskOverrides.set(task.taskId, {
      ...override,
      executorKind: task.executorKind,
      transitionFromPrev: task.transitionFromPrev,
      transitionToNext: task.transitionToNext,
    })
  }

  return listRuntimeTasksByOrder(productionOrderId)
}

export function getRuntimeAssignmentSummaryByOrder(productionOrderId: string): RuntimeAssignmentSummaryByOrder {
  const tasks = listRuntimeTasksByOrder(productionOrderId).filter((task) => isRuntimeTaskExecutionTask(task))
  const now = Date.now()

  const totalTasks = tasks.length
  const directCount = tasks.filter((task) => task.assignmentMode === 'DIRECT').length
  const biddingCount = tasks.filter((task) => task.assignmentMode === 'BIDDING').length
  const unassignedCount = tasks.filter((task) => task.assignmentStatus === 'UNASSIGNED').length

  const directAssignedCount = tasks.filter(
    (task) => task.assignmentMode === 'DIRECT' && task.assignmentStatus === 'ASSIGNED',
  ).length

  const biddingLaunchedCount = tasks.filter(
    (task) =>
      task.assignmentMode === 'BIDDING' &&
      (task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING' || task.assignmentStatus === 'AWARDED'),
  ).length

  const biddingAwardedCount = tasks.filter((task) => task.assignmentStatus === 'AWARDED').length

  const assignedFactoryCount = new Set(
    tasks
      .filter((task) => task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED')
      .map((task) => task.assignedFactoryId)
      .filter((factoryId): factoryId is string => Boolean(factoryId)),
  ).size

  const rejectedCount = tasks.filter((task) => task.acceptanceStatus === 'REJECTED').length

  const overdueAckCount = tasks.filter((task) => {
    if (task.assignmentMode !== 'DIRECT') return false
    if (task.assignmentStatus !== 'ASSIGNED') return false
    if (task.acceptanceStatus === 'ACCEPTED') return false
    if (!task.acceptDeadline) return false
    const deadlineMs = parseDateLike(task.acceptDeadline)
    return Number.isFinite(deadlineMs) && deadlineMs < now
  }).length

  return {
    totalTasks,
    directCount,
    biddingCount,
    unassignedCount,
    directAssignedCount,
    biddingLaunchedCount,
    biddingAwardedCount,
    assignedFactoryCount,
    rejectedCount,
    overdueAckCount,
  }
}

export function getRuntimeTaskCountByOrder(productionOrderId: string): number {
  return getRuntimeAssignmentSummaryByOrder(productionOrderId).totalTasks
}

export function getRuntimeOrderOutputValueTotal(productionOrderId: string): number | undefined {
  return sumTaskOutputValueTotals(listRuntimeExecutionTasksByOrder(productionOrderId))
}

export function getRuntimeTaskSummaryByOrder(productionOrderId: string): RuntimeTaskSummaryByOrder {
  const tasks = listRuntimeTasksByOrder(productionOrderId).filter((task) => isRuntimeTaskExecutionTask(task))
  const totalTasks = tasks.length
  const specialTaskCount = tasks.filter((task) => Boolean(task.isSpecialCraft)).length
  const normalTaskCount = totalTasks - specialTaskCount

  const stageCounts: RuntimeTaskSummaryByOrder['stageCounts'] = {
    PREP: 0,
    PROD: 0,
    POST: 0,
  }

  for (const task of tasks) {
    const stageCode = task.stageCode
    if (stageCode === 'PREP' || stageCode === 'PROD' || stageCode === 'POST') {
      stageCounts[stageCode] += 1
    }
  }

  return {
    totalTasks,
    normalTaskCount,
    specialTaskCount,
    stageCounts,
  }
}

export function getRuntimeBiddingSummaryByOrder(productionOrderId: string): {
  activeTenderCount: number
  nearestDeadline?: string
  overdueTenderCount: number
} {
  const tasks = listRuntimeTasksByOrder(productionOrderId).filter((task) => isRuntimeTaskExecutionTask(task))

  const biddingTasks = tasks.filter((task) => task.assignmentMode === 'BIDDING')
  const activeTasks = biddingTasks.filter((task) => task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING')

  const now = Date.now()
  const deadlines = activeTasks
    .map((task) => task.biddingDeadline ?? task.taskDeadline)
    .filter((value): value is string => Boolean(value))

  const overdueTenderCount = deadlines.filter((deadline) => {
    const ms = parseDateLike(deadline)
    return Number.isFinite(ms) && ms < now
  }).length

  const futureDeadlines = deadlines
    .map((deadline) => ({ deadline, ms: parseDateLike(deadline) }))
    .filter((item) => Number.isFinite(item.ms) && item.ms >= now)
    .sort((a, b) => a.ms - b.ms)

  return {
    activeTenderCount: activeTasks.length,
    nearestDeadline: futureDeadlines[0]?.deadline,
    overdueTenderCount,
  }
}
