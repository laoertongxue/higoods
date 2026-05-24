import {
  listCuttingTaskRefs,
  listMarkerPlanSourceRefs,
  listCutOrderRefs,
  listPdaExecutionRefs,
  listProductionOrderRefs,
} from './repository.ts'
import type {
  CuttingCoreRegistry,
  CuttingTaskRef,
  MarkerPlanSourceRef,
  CutOrderRef,
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
  const cutOrders = listCutOrderRefs()
  const markerPlanSources = listMarkerPlanSourceRefs()
  const cuttingTasks = listCuttingTaskRefs()
  const pdaExecutions = listPdaExecutionRefs()

  const pdaExecutionsByCutOrderId: Record<string, PdaCutPieceExecutionRef[]> = {}
  pdaExecutions.forEach((record) => {
    const bucket = pdaExecutionsByCutOrderId[record.cutOrderId] ?? []
    bucket.push(record)
    pdaExecutionsByCutOrderId[record.cutOrderId] = bucket
  })

  cachedRegistry = {
    productionOrdersById: indexById(productionOrders, 'productionOrderId'),
    productionOrdersByNo: indexById(productionOrders, 'productionOrderNo'),
    cutOrdersById: indexById(cutOrders, 'cutOrderId'),
    cutOrdersByNo: indexById(cutOrders, 'cutOrderNo'),
    markerPlanSourcesById: indexById(markerPlanSources, 'markerPlanId'),
    markerPlanSourcesByNo: indexById(markerPlanSources, 'markerPlanNo'),
    cuttingTasksById: indexById(cuttingTasks, 'taskId'),
    cuttingTasksByNo: indexById(cuttingTasks, 'taskNo'),
    pdaExecutionsByTaskAndOrder: Object.fromEntries(pdaExecutions.map((record) => [buildExecutionKey(record.taskId, record.executionOrderNo), record])),
    pdaExecutionsByCutOrderId,
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

export function resolveCutOrderRef(input: { cutOrderId?: string; cutOrderNo?: string }): CutOrderRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.cutOrderId && registry.cutOrdersById[input.cutOrderId]) return registry.cutOrdersById[input.cutOrderId]
  if (input.cutOrderNo && registry.cutOrdersByNo[input.cutOrderNo]) return registry.cutOrdersByNo[input.cutOrderNo]
  return null
}

export function resolveMarkerPlanSourceRef(input: { markerPlanId?: string; markerPlanNo?: string }): MarkerPlanSourceRef | null {
  const registry = buildCuttingCoreRegistry()
  if (input.markerPlanId && registry.markerPlanSourcesById[input.markerPlanId]) return registry.markerPlanSourcesById[input.markerPlanId]
  if (input.markerPlanNo && registry.markerPlanSourcesByNo[input.markerPlanNo]) return registry.markerPlanSourcesByNo[input.markerPlanNo]
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

export function listPdaExecutionsByCutOrderId(cutOrderId: string): PdaCutPieceExecutionRef[] {
  return [...(buildCuttingCoreRegistry().pdaExecutionsByCutOrderId[cutOrderId] ?? [])]
}
