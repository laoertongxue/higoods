import { indonesiaFactories } from './indonesia-factories.ts'
import { productionOrders } from './production-orders.ts'
import {
  getProcessAssignmentGranularity,
  type ProcessAssignmentGranularity,
} from './process-types.ts'
import {
  calculatePublishedSamTotal,
  processTasks,
  type AcceptanceStatus,
  type ProcessTask,
  type TaskAssignmentStatus,
  type TaskAuditLog,
} from './process-tasks.ts'
import type { TaskDetailRow } from './task-detail-rows.ts'
import {
  listTaskAllocatableGroups,
  resolveTaskSplitDecision,
  validateAllocatableGroupAssignments,
  type TaskAllocatableGroup,
  type TaskSplitFactoryBucket,
  type TaskAllocatableGroupAssignment,
} from './task-split-dispatch.ts'

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
}

export type RuntimeTaskAllocatableGroup = TaskAllocatableGroup
export type RuntimeTaskAllocatableGroupAssignment = TaskAllocatableGroupAssignment

interface RuntimeTaskOverride {
  assignmentMode?: ProcessTask['assignmentMode']
  assignmentStatus?: TaskAssignmentStatus
  status?: ProcessTask['status']
  assignedFactoryId?: string
  assignedFactoryName?: string
  acceptDeadline?: string
  taskDeadline?: string
  dispatchRemark?: string
  dispatchedAt?: string
  dispatchedBy?: string
  standardPrice?: number
  standardPriceCurrency?: string
  standardPriceUnit?: string
  dispatchPrice?: number
  dispatchPriceCurrency?: string
  dispatchPriceUnit?: string
  priceDiffReason?: string
  acceptanceStatus?: AcceptanceStatus
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

const runtimeTaskOverrides = new Map<string, RuntimeTaskOverride>()
const runtimeTaskSplitPlans = new Map<string, RuntimeTaskSplitPlan>()
let runtimeAuditSeq = 0
let dispatchBoardSeedReady = false

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

function recalculateRuntimeTaskPublishedSamTotal(
  task: Pick<ProcessTask, 'publishedSamPerUnit' | 'publishedSamUnit'>,
  scopeQty: number,
  detailRows: TaskDetailRow[],
): number {
  return calculatePublishedSamTotal({
    qty: scopeQty,
    detailRows,
    publishedSamPerUnit: task.publishedSamPerUnit,
    publishedSamUnit: task.publishedSamUnit,
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
      publishedSamTotal: recalculateRuntimeTaskPublishedSamTotal(task, task.scopeQty, sourceDetailRows),
      updatedAt: plan.createdAt,
    })

    for (const resultTask of plan.results) {
      const scopedDetailRows = pickDetailRowsByKeys(sourceDetailRows, resultTask.detailRowKeys)
      const scopeSkuLines = deriveScopeSkuLinesByDetailRows(task.scopeSkuLines, scopedDetailRows)
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
        publishedSamTotal: recalculateRuntimeTaskPublishedSamTotal(task, scopeQty, scopedDetailRows),
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
  return {
    ...baseTask,
    taskId: `${baseTask.taskId}__ORDER`,
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
    publishedSamTotal: recalculateRuntimeTaskPublishedSamTotal(baseTask, baseTask.qty, detailRows),
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
    return {
      ...baseTask,
      taskId: `${baseTask.taskId}__COLOR__${normalizeScopeToken(color)}`,
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
      publishedSamTotal: recalculateRuntimeTaskPublishedSamTotal(baseTask, qty, detailRows),
    }
  })
}

function buildSkuScopeTasks(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask[] {
  if (!skuLines.length) return [buildOrderScopeTask(baseTask, [])]
  const baseDetailRows = getTaskDetailRows(baseTask)

  return skuLines.map((line) => {
    const detailRows = filterDetailRowsByScope(baseDetailRows, 'SKU', [line])
    return {
      ...baseTask,
      taskId: `${baseTask.taskId}__SKU__${normalizeScopeToken(line.skuCode)}`,
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
      publishedSamTotal: recalculateRuntimeTaskPublishedSamTotal(baseTask, line.qty, detailRows),
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
  const baseWithOverrides = applyRuntimeOverrides(buildRuntimeProcessTasksBase())
  const withSplit = applyRuntimeSplitPlans(baseWithOverrides)
  const withOverrides = applyRuntimeOverrides(withSplit)
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
    cut: { id: 'ID-F002', name: '泗水裁片厂' },
    sew: { id: 'ID-F003', name: '万隆车缝厂' },
    button: { id: 'ID-F005', name: '日惹包装厂' },
    special: { id: 'ID-F010', name: '雅加达绣花专工厂' },
    wash: { id: 'ID-F007', name: '玛琅精工车缝' },
  } as const

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0001-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.sew.id,
      assignedFactoryName: directFactorySeeds.sew.name,
      acceptDeadline: '2026-03-19 12:00:00',
      taskDeadline: '2026-04-02 18:00:00',
      dispatchedAt: '2026-03-18 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 15200,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'PENDING',
      dispatchRemark: '待工厂确认',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0001-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0001-001__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-18 09:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.cut.id,
      assignedFactoryName: directFactorySeeds.cut.name,
      acceptDeadline: '2026-04-03 12:00:00',
      taskDeadline: '2026-04-08 18:00:00',
      dispatchedAt: '2026-03-19 10:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 8600,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      dispatchRemark: '按裁片工序直接派单',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0002-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0002-001__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-19 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0002-001__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.cut.name, '2026-03-19 13:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0002-003__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.button.id,
      assignedFactoryName: directFactorySeeds.button.name,
      acceptDeadline: '2026-04-03 12:00:00',
      taskDeadline: '2026-04-09 18:00:00',
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
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      tenderId: 'TENDER-TASKGEN0004001-1001',
      biddingDeadline: '2026-03-18 18:00:00',
      taskDeadline: '2026-04-10 18:00:00',
      awardedAt: '2026-03-19 10:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0004-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-18 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0004001-1001', '跟单A', '2026-03-18 09:05:00'),
      buildSeedAuditLog('TASKGEN-202603-0004-001__ORDER', 'AWARD', '已完成定标', '运营A', '2026-03-19 10:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0005-001__ORDER',
    {
      assignmentStatus: 'UNASSIGNED',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0005-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0005-001__ORDER', 'SET_ASSIGN_MODE', '设为暂不分配', '跟单A', '2026-03-19 15:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0006-001__ORDER',
    {
      assignmentStatus: 'UNASSIGNED',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0006-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0006-001__ORDER', 'SET_ASSIGN_MODE', '设为暂不分配', '跟单A', '2026-03-19 15:30:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0008-001__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.sew.id,
      assignedFactoryName: directFactorySeeds.sew.name,
      acceptDeadline: '2026-04-04 12:00:00',
      taskDeadline: '2026-04-11 18:00:00',
      dispatchedAt: '2026-03-20 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 14600,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      dispatchRemark: '常规车缝直派',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0008-001__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0008-001__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-20 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0008-001__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.sew.name, '2026-03-20 11:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0009-001__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      tenderId: 'TENDER-TASKGEN0009001-1001',
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
      biddingDeadline: '2026-03-21 10:00:00',
      taskDeadline: '2026-04-12 18:00:00',
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
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-002__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-002__ORDER', 'SET_ASSIGN_MODE', '设为暂不分配', '跟单A', '2026-03-20 09:40:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-004__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      tenderId: 'TENDER-TASKGEN0015004-1001',
      biddingDeadline: '2026-03-22 12:00:00',
      taskDeadline: '2026-04-15 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-004__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-004__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0015004-1001', '跟单A', '2026-03-20 09:10:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-005__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'BIDDING',
      tenderId: 'TENDER-TASKGEN0015005-1001',
      biddingDeadline: '2026-03-19 18:00:00',
      taskDeadline: '2026-04-11 18:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-005__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-005__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0015005-1001', '跟单A', '2026-03-18 11:00:00'),
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
    'TASKGEN-202603-0015-007__ORDER',
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: directFactorySeeds.wash.id,
      assignedFactoryName: directFactorySeeds.wash.name,
      acceptDeadline: '2026-03-18 12:00:00',
      taskDeadline: '2026-03-19 18:00:00',
      dispatchedAt: '2026-03-17 09:00:00',
      dispatchedBy: '跟单A',
      dispatchPrice: 12400,
      dispatchPriceCurrency: 'IDR',
      dispatchPriceUnit: '件',
      acceptanceStatus: 'ACCEPTED',
      status: 'IN_PROGRESS',
      dispatchRemark: '已接单，执行超期',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-007__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-007__ORDER', 'DISPATCH', '已发起直接派单，待工厂确认', '跟单A', '2026-03-17 09:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-007__ORDER', 'ACCEPT', '工厂已确认接单', directFactorySeeds.wash.name, '2026-03-17 10:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-007__ORDER', 'START', '已开工执行', directFactorySeeds.wash.name, '2026-03-18 09:00:00'),
    ],
  )

  seedRuntimeTaskOverride(
    'TASKGEN-202603-0015-008__ORDER',
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: 'AWARDED',
      tenderId: 'TENDER-TASKGEN0015008-1001',
      biddingDeadline: '2026-03-18 20:00:00',
      taskDeadline: '2026-04-11 18:00:00',
      awardedAt: '2026-03-19 11:00:00',
    },
    [
      ...getSeedBaseAuditLogs('TASKGEN-202603-0015-008__ORDER'),
      buildSeedAuditLog('TASKGEN-202603-0015-008__ORDER', 'SET_ASSIGN_MODE', '设为竞价分配', '跟单A', '2026-03-18 12:00:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-008__ORDER', 'BIDDING_START', '发起竞价 TENDER-TASKGEN0015008-1001', '跟单A', '2026-03-18 12:05:00'),
      buildSeedAuditLog('TASKGEN-202603-0015-008__ORDER', 'AWARD', '已完成定标', '运营A', '2026-03-19 11:00:00'),
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
}

function getOrderIdsFromTaskIds(taskIds: string[]): string[] {
  const tasks = listRuntimeProcessTasks().filter((task) => taskIds.includes(task.taskId))
  return Array.from(new Set(tasks.map((task) => task.productionOrderId)))
}

export function listRuntimeProcessTasks(): RuntimeProcessTask[] {
  ensureDispatchBoardSeedData()
  return buildRuntimeProcessTasks()
}

export function listRuntimeTasksByOrder(productionOrderId: string): RuntimeProcessTask[] {
  return listRuntimeProcessTasks().filter((task) => task.productionOrderId === productionOrderId)
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
  })
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
  resultAssignments?: Array<{ taskId: string; factoryId: string; factoryName: string }>
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
    return {
      ok: true,
      mode: 'SINGLE_FACTORY',
      createdTaskIds: [],
      resultAssignments: [
        {
          taskId: task.taskId,
          factoryId: splitDecision.factoryId,
          factoryName: splitDecision.factoryName,
        },
      ],
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
    resultAssignments: splitFactories.map((factory) => ({
      taskId: factory.taskId,
      factoryId: factory.factoryId,
      factoryName: factory.factoryName,
    })),
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
  },
  by: string,
): RuntimeProcessTask | null {
  const task = getRuntimeTaskById(taskId)
  if (!task) return null

  const updated = updateRuntimeTaskWithAudit(
    taskId,
    {
      assignmentMode: 'BIDDING',
      assignmentStatus: task.assignmentStatus === 'AWARDED' ? 'AWARDED' : 'BIDDING',
      tenderId: payload.tenderId,
      biddingDeadline: payload.biddingDeadline,
      taskDeadline: payload.taskDeadline,
    },
    'BIDDING_START',
    `发起竞价 ${payload.tenderId}`,
    by,
  )

  recomputeRuntimeTransitionsForOrder(task.productionOrderId)
  return updated
}

export function validateRuntimeBatchDispatchSelection(taskIds: string[]): RuntimeBatchDispatchSelectionValidation {
  const selected = taskIds
    .map((taskId) => getRuntimeTaskById(taskId))
    .filter((task): task is RuntimeProcessTask => Boolean(task))

  if (selected.length === 0) {
    return { valid: false, reason: '请选择至少一条任务后再派单' }
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

  const now = nowTimestamp()

  for (const taskId of input.taskIds) {
    applyRuntimeDirectDispatchMeta({
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
      dispatchedAt: now,
    })
  }

  const orderIds = getOrderIdsFromTaskIds(input.taskIds)
  for (const orderId of orderIds) {
    recomputeRuntimeTransitionsForOrder(orderId)
  }

  return { ok: true }
}

export function applyRuntimeDirectDispatchMeta(input: {
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
}): RuntimeProcessTask | null {
  return updateRuntimeTaskWithAudit(
    input.taskId,
    {
      assignmentMode: 'DIRECT',
      assignmentStatus: 'ASSIGNED',
      assignedFactoryId: input.factoryId,
      assignedFactoryName: input.factoryName,
      acceptDeadline: input.acceptDeadline,
      taskDeadline: input.taskDeadline,
      dispatchRemark: input.remark.trim() || undefined,
      dispatchedAt: input.dispatchedAt ?? nowTimestamp(),
      dispatchedBy: input.by,
      dispatchPrice: input.dispatchPrice,
      dispatchPriceCurrency: input.dispatchPriceCurrency,
      dispatchPriceUnit: input.dispatchPriceUnit,
      priceDiffReason: input.priceDiffReason.trim() || undefined,
      acceptanceStatus: 'PENDING',
    },
    'DISPATCH',
    '已发起直接派单，待工厂确认',
    input.by,
  )
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
