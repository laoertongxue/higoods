import { indonesiaFactories } from './indonesia-factories'
import { productionOrders } from './production-orders'
import {
  getProcessAssignmentGranularity,
  type ProcessAssignmentGranularity,
} from './process-types'
import {
  processTasks,
  type AcceptanceStatus,
  type ProcessTask,
  type TaskAssignmentStatus,
  type TaskAuditLog,
} from './process-tasks'

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
  skuCode?: string
  skuColor?: string
  skuSize?: string
  executorKind?: RuntimeExecutorKind
  transitionFromPrev?: RuntimeTransitionMode
  transitionToNext?: RuntimeTransitionMode
  biddingDeadline?: string
}

interface RuntimeTaskOverride {
  assignmentMode?: ProcessTask['assignmentMode']
  assignmentStatus?: TaskAssignmentStatus
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

const runtimeTaskOverrides = new Map<string, RuntimeTaskOverride>()
let runtimeAuditSeq = 0

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
  return `RAL-${cleanTaskId}-${Date.now()}-${runtimeAuditSeq}`
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

function buildOrderScopeTask(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask {
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
  }
}

function buildColorScopeTasks(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask[] {
  if (!skuLines.length) return [buildOrderScopeTask(baseTask, [])]

  const grouped = new Map<string, RuntimeTaskSkuLine[]>()
  for (const line of skuLines) {
    const label = normalizeColorLabel(line.color)
    const current = grouped.get(label) ?? []
    current.push(line)
    grouped.set(label, current)
  }

  return Array.from(grouped.entries()).map(([color, lines]) => {
    const qty = lines.reduce((sum, line) => sum + line.qty, 0)
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
    }
  })
}

function buildSkuScopeTasks(baseTask: ProcessTask, skuLines: RuntimeTaskSkuLine[]): RuntimeProcessTask[] {
  if (!skuLines.length) return [buildOrderScopeTask(baseTask, [])]

  return skuLines.map((line) => ({
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
  }))
}

function buildRuntimeTasksByGranularity(baseTask: ProcessTask): RuntimeProcessTask[] {
  const skuLines = getOrderSkuLines(baseTask.productionOrderId)
  const granularity = (baseTask.assignmentGranularity as ProcessAssignmentGranularity | undefined)
    ?? getProcessAssignmentGranularity(baseTask.processCode)

  if (granularity === 'SKU') return buildSkuScopeTasks(baseTask, skuLines)
  if (granularity === 'COLOR') return buildColorScopeTasks(baseTask, skuLines)
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
  const scopeRank: Record<RuntimeTaskScopeType, number> = { ORDER: 0, COLOR: 1, SKU: 2 }
  if (scopeRank[a.scopeType] !== scopeRank[b.scopeType]) {
    return scopeRank[a.scopeType] - scopeRank[b.scopeType]
  }
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
    }))
}

function buildRuntimeProcessTasksBase(): RuntimeProcessTask[] {
  const baseTasks = buildRuntimeBaseTasksFromTaskFacts()
  const expanded = baseTasks.flatMap((task) => buildRuntimeTasksByGranularity(task))
  return applyRuntimeDependencies(expanded)
}

function buildRuntimeProcessTasks(): RuntimeProcessTask[] {
  const withOverrides = applyRuntimeOverrides(buildRuntimeProcessTasksBase())
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

function getOrderIdsFromTaskIds(taskIds: string[]): string[] {
  const tasks = listRuntimeProcessTasks().filter((task) => taskIds.includes(task.taskId))
  return Array.from(new Set(tasks.map((task) => task.productionOrderId)))
}

export function listRuntimeProcessTasks(): RuntimeProcessTask[] {
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
    const task = getRuntimeTaskById(taskId)
    if (!task) continue

    updateRuntimeTaskWithAudit(
      taskId,
      {
        assignmentMode: 'DIRECT',
        assignmentStatus: 'ASSIGNED',
        assignedFactoryId: input.factoryId,
        assignedFactoryName: input.factoryName,
        acceptDeadline: input.acceptDeadline,
        taskDeadline: input.taskDeadline,
        dispatchRemark: input.remark.trim() || undefined,
        dispatchedAt: now,
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

  const orderIds = getOrderIdsFromTaskIds(input.taskIds)
  for (const orderId of orderIds) {
    recomputeRuntimeTransitionsForOrder(orderId)
  }

  return { ok: true }
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
  const tasks = listRuntimeTasksByOrder(productionOrderId)
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
  const tasks = listRuntimeTasksByOrder(productionOrderId)
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
  const tasks = listRuntimeTasksByOrder(productionOrderId)

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
