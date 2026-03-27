import {
  listCuttingTaskRefs,
  listMergeBatchRefs,
  listOriginalCutOrderRefs,
  listPdaExecutionRefs,
  listProductionOrderRefs,
} from './repository.ts'
import type {
  CuttingCoreRegistry,
  CuttingTaskRef,
  MergeBatchRef,
  OriginalCutOrderRef,
  PdaCutPieceExecutionRef,
  ProductionOrderRef,
} from './types.ts'

function buildExecutionKey(taskId: string, executionOrderNo: string): string {
  return `${taskId}::${executionOrderNo}`
}

function indexById<T extends Record<string, string>>(items: T[], key: keyof T): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item[key], item]))
}

let cachedRegistry: CuttingCoreRegistry | null = null

export function buildCuttingCoreRegistry(): CuttingCoreRegistry {
  if (cachedRegistry) return cachedRegistry

  const productionOrders = listProductionOrderRefs()
  const originalCutOrders = listOriginalCutOrderRefs()
  const mergeBatches = listMergeBatchRefs()
  const cuttingTasks = listCuttingTaskRefs()
  const pdaExecutions = listPdaExecutionRefs()

  const pdaExecutionsByOriginalCutOrderId: Record<string, PdaCutPieceExecutionRef[]> = {}
  pdaExecutions.forEach((record) => {
    const bucket = pdaExecutionsByOriginalCutOrderId[record.originalCutOrderId] ?? []
    bucket.push(record)
    pdaExecutionsByOriginalCutOrderId[record.originalCutOrderId] = bucket
  })

  cachedRegistry = {
    productionOrdersById: indexById(productionOrders, 'productionOrderId'),
    productionOrdersByNo: indexById(productionOrders, 'productionOrderNo'),
    originalCutOrdersById: indexById(originalCutOrders, 'originalCutOrderId'),
    originalCutOrdersByNo: indexById(originalCutOrders, 'originalCutOrderNo'),
    mergeBatchesById: indexById(mergeBatches, 'mergeBatchId'),
    mergeBatchesByNo: indexById(mergeBatches, 'mergeBatchNo'),
    cuttingTasksById: indexById(cuttingTasks, 'taskId'),
    cuttingTasksByNo: indexById(cuttingTasks, 'taskNo'),
    pdaExecutionsByTaskAndOrder: Object.fromEntries(pdaExecutions.map((record) => [buildExecutionKey(record.taskId, record.executionOrderNo), record])),
    pdaExecutionsByOriginalCutOrderId,
  }

  return cachedRegistry
}

export function resetCuttingCoreRegistryCache(): void {
  cachedRegistry = null
}

export function resolveProductionOrderRef(input: { productionOrderId?: string; productionOrderNo?: string }): ProductionOrderRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.productionOrderId && registry.productionOrdersById[input.productionOrderId]) return registry.productionOrdersById[input.productionOrderId]
  if (input.productionOrderNo && registry.productionOrdersByNo[input.productionOrderNo]) return registry.productionOrdersByNo[input.productionOrderNo]
  return null
}

export function resolveOriginalCutOrderRef(input: { originalCutOrderId?: string; originalCutOrderNo?: string }): OriginalCutOrderRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.originalCutOrderId && registry.originalCutOrdersById[input.originalCutOrderId]) return registry.originalCutOrdersById[input.originalCutOrderId]
  if (input.originalCutOrderNo && registry.originalCutOrdersByNo[input.originalCutOrderNo]) return registry.originalCutOrdersByNo[input.originalCutOrderNo]
  return null
}

export function resolveMergeBatchRef(input: { mergeBatchId?: string; mergeBatchNo?: string }): MergeBatchRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.mergeBatchId && registry.mergeBatchesById[input.mergeBatchId]) return registry.mergeBatchesById[input.mergeBatchId]
  if (input.mergeBatchNo && registry.mergeBatchesByNo[input.mergeBatchNo]) return registry.mergeBatchesByNo[input.mergeBatchNo]
  return null
}

export function resolveCuttingTaskRef(input: { taskId?: string; taskNo?: string }): CuttingTaskRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.taskId && registry.cuttingTasksById[input.taskId]) return registry.cuttingTasksById[input.taskId]
  if (input.taskNo && registry.cuttingTasksByNo[input.taskNo]) return registry.cuttingTasksByNo[input.taskNo]
  return null
}

export function resolvePdaExecutionRef(input: {
  taskId: string
  executionOrderId?: string
  executionOrderNo?: string
  legacyCutPieceOrderNo?: string
  cutPieceOrderNo?: string
}): PdaCutPieceExecutionRef | null {
  const registry = buildCuttingCoreRegistry()
  const executionOrderNo =
    input.executionOrderNo
    || input.executionOrderId
    || input.legacyCutPieceOrderNo
    || input.cutPieceOrderNo
    || ''

  if (!executionOrderNo.trim()) return null
  return registry.pdaExecutionsByTaskAndOrder[buildExecutionKey(input.taskId, executionOrderNo)] ?? null
}

export function listPdaExecutionsByTaskId(taskId: string): PdaCutPieceExecutionRef[] {
  const registry = buildCuttingCoreRegistry()
  return Object.values(registry.pdaExecutionsByTaskAndOrder).filter((item) => item.taskId === taskId)
}

export function listPdaExecutionsByOriginalCutOrderId(originalCutOrderId: string): PdaCutPieceExecutionRef[] {
  return [...(buildCuttingCoreRegistry().pdaExecutionsByOriginalCutOrderId[originalCutOrderId] ?? [])]
}
