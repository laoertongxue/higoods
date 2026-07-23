import { canFactorySeeSpecialCraftOperation, getSpecialCraftOperationByCraftCode, getSpecialCraftOperationById, listSpecialCraftOperationDefinitions, type SpecialCraftOperationDefinition } from './special-craft-operations.ts'
import {
  getSpecialCraftTaskOrderById,
  listSpecialCraftTaskOrders,
} from './special-craft-task-orders.ts'
import type { ProcessTask } from './process-tasks.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'

type SpecialCraftPdaTaskLike = Partial<ProcessTask> & {
  operationId?: string
  operationName?: string
  craftCode?: string
  craftName?: string
  processName?: string
  processBusinessName?: string
  sourceTaskId?: string
  sourceTaskNo?: string
  taskOrderId?: string
  taskOrderNo?: string
  workOrderId?: string
  workOrderNo?: string
}

const SPECIAL_CRAFT_TEXT_KEYWORDS = ['特殊工艺', '辅助工艺', '特种工艺', '绣花', '打揽', '打条', '压褶', '烫画', '直喷', '贝壳绣', '曲牙绣', '一字贝绣', '模板机', '激光开袋', '特种车缝', '橡筋']

function normalizeValue(value: unknown): string {
  return String(value ?? '').trim()
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => normalizeValue(value)).filter(Boolean))]
}

function getTaskRefs(task: SpecialCraftPdaTaskLike): string[] {
  return uniqueValues([
    task.taskId,
    task.taskNo,
    task.rootTaskNo,
    task.sourceTaskId,
    task.sourceTaskNo,
    task.taskOrderId,
    task.taskOrderNo,
    task.workOrderId,
    task.workOrderNo,
  ])
}

function findTaskOrderOperation(task: SpecialCraftPdaTaskLike): SpecialCraftOperationDefinition | null {
  for (const ref of getTaskRefs(task)) {
    const directOrder = getSpecialCraftTaskOrderById(ref)
    if (directOrder) return getSpecialCraftOperationById(directOrder.operationId) ?? null
  }

  const refs = new Set(getTaskRefs(task))
  const taskOrder = listSpecialCraftTaskOrders().find((item) =>
    refs.has(item.taskOrderId)
    || refs.has(item.taskOrderNo)
    || refs.has(item.sourceTaskNo)
    || refs.has(item.sourceTaskId || '')
    || item.workOrderIds?.some((workOrderId) => refs.has(workOrderId)),
  )
  if (taskOrder) return getSpecialCraftOperationById(taskOrder.operationId) ?? null

  const matchedOrder = listSpecialCraftTaskOrders().find((item) =>
    refs.has(item.taskOrderId)
    || refs.has(item.taskOrderNo),
  )
  if (matchedOrder) return getSpecialCraftOperationById(matchedOrder.operationId) ?? null

  return null
}

function findTaskWorkOrder(task: SpecialCraftPdaTaskLike) {
  const refs = new Set(getTaskRefs(task))
  for (const ref of refs) {
    const order = getSpecialCraftTaskOrderById(ref)
    if (order) return order
  }
  return listSpecialCraftTaskOrders().find((item) =>
    refs.has(item.taskOrderId)
    || refs.has(item.taskOrderNo),
  )
}

function findTextMatchedOperation(task: SpecialCraftPdaTaskLike): SpecialCraftOperationDefinition | null {
  if (task.operationId) {
    const byId = getSpecialCraftOperationById(task.operationId)
    if (byId) return byId
  }

  if (task.craftCode) {
    const byCraftCode = getSpecialCraftOperationByCraftCode(task.craftCode)
    if (byCraftCode) return byCraftCode
  }

  const text = uniqueValues([
    task.operationName,
    task.craftName,
    task.processName,
    task.processNameZh,
    task.processBusinessName,
    task.processBusinessCode,
    task.processCode,
  ]).join(' ')

  if (!text) return null

  return listSpecialCraftOperationDefinitions().find((operation) =>
    text.includes(operation.operationName)
    || text.includes(operation.craftName)
    || text.includes(operation.craftCode)
    || text.includes(operation.processCode),
  ) ?? null
}

export function resolveSpecialCraftOperationForPdaTask(
  task: SpecialCraftPdaTaskLike | null | undefined,
): SpecialCraftOperationDefinition | null {
  if (!task) return null
  return findTaskOrderOperation(task) ?? findTextMatchedOperation(task)
}

export function isSpecialCraftPdaTask(task: SpecialCraftPdaTaskLike | null | undefined): boolean {
  if (!task) return false
  if (task.taskUnitType === 'WHOLE_ORDER_TASK' || task.taskUnitType === 'COMBINED_PROCESS_TASK') return false
  if (resolveSpecialCraftOperationForPdaTask(task)) return true
  const text = uniqueValues([
    task.processCode,
    task.processBusinessCode,
    task.processNameZh,
    task.processBusinessName,
    task.craftName,
  ]).join(' ')
  return SPECIAL_CRAFT_TEXT_KEYWORDS.some((keyword) => text.includes(keyword))
}

export function isGarmentWarehouseOutboundPdaTaskForFactory(
  factoryId: string,
  task: SpecialCraftPdaTaskLike | null | undefined,
): boolean {
  if (!task) return false
  const factory = getFactoryMasterRecordById(factoryId)
  const workOrder = findTaskWorkOrder(task)
  return factory?.factoryType === 'CENTRAL_GARMENT'
    && workOrder?.targetObject === '成衣'
    && workOrder.status === '待领料'
}

export function canFactoryAccessSpecialCraftPdaTask(
  factoryId: string,
  task: SpecialCraftPdaTaskLike | null | undefined,
): boolean {
  if (!task) return false
  if (!isSpecialCraftPdaTask(task)) return true
  if (isGarmentWarehouseOutboundPdaTaskForFactory(factoryId, task)) return true
  const operation = resolveSpecialCraftOperationForPdaTask(task)
  if (!operation) return false
  return canFactorySeeSpecialCraftOperation(factoryId, operation.operationId)
}

export function filterSpecialCraftPdaTasksForFactory<T extends SpecialCraftPdaTaskLike>(
  tasks: T[],
  factoryId: string,
): T[] {
  return tasks.filter((task) => canFactoryAccessSpecialCraftPdaTask(factoryId, task))
}
