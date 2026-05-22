import {
  listCutOrderSourceRecords,
} from '../../data/fcs/cutting/cut-order-source.ts'
import { listMarkerPlanRefSourceRecords } from '../../data/fcs/cutting/marker-plan-ref-source.ts'
import {
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../../data/fcs/cutting/pda-cutting-task-source.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'
import type {
  CuttingTaskRef,
  MarkerPlanRefRef,
  CutOrderRef,
  PdaCutPieceExecutionRef,
  ProductionOrderRef,
} from './types.ts'

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export function listProductionOrderRefs(): ProductionOrderRef[] {
  return productionOrders.map((order) => ({
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
  }))
}

export function listMarkerPlanRefRefs(): MarkerPlanRefRef[] {
  return listMarkerPlanRefSourceRecords().map((record) => ({
    markerPlanId: record.markerPlanId,
    markerPlanNo: record.markerPlanNo,
    sourceCutOrderIds: [...record.sourceCutOrderIds],
    sourceCutOrderNos: [...record.sourceCutOrderNos],
    sourceProductionOrderIds: [...record.sourceProductionOrderIds],
    sourceProductionOrderNos: [...record.sourceProductionOrderNos],
  }))
}

export function listCutOrderRefs(): CutOrderRef[] {
  const markerPlanRefRefs = listMarkerPlanRefRefs()
  const markerPlanNosByCutOrderId = new Map<string, string[]>()
  const markerPlanIdsByCutOrderId = new Map<string, string[]>()

  markerPlanRefRefs.forEach((batch) => {
    batch.sourceCutOrderIds.forEach((cutOrderId) => {
      markerPlanNosByCutOrderId.set(cutOrderId, unique([...(markerPlanNosByCutOrderId.get(cutOrderId) ?? []), batch.markerPlanNo]))
      markerPlanIdsByCutOrderId.set(cutOrderId, unique([...(markerPlanIdsByCutOrderId.get(cutOrderId) ?? []), batch.markerPlanId]))
    })
  })

  return listCutOrderSourceRecords().map((record) => {
    const markerPlanIds = unique([record.markerPlanId, ...(markerPlanIdsByCutOrderId.get(record.cutOrderId) ?? [])])
    const markerPlanNos = unique([record.markerPlanNo, ...(markerPlanNosByCutOrderId.get(record.cutOrderId) ?? [])])

    return {
      cutOrderId: record.cutOrderId,
      cutOrderNo: record.cutOrderNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      materialSku: record.materialSku,
      activeMarkerPlanRefId: markerPlanIds[0] ?? '',
      activeMarkerPlanRefNo: markerPlanNos[0] ?? '',
      markerPlanIds,
      markerPlanNos,
    } satisfies CutOrderRef
  })
}

export function listPdaExecutionRefs(): PdaCutPieceExecutionRef[] {
  return listPdaCuttingExecutionSourceRecords()
    .filter((record) => record.bindingState === 'BOUND')
    .map((record) => ({
      taskId: record.taskId,
      taskNo: record.taskNo,
      executionOrderId: record.executionOrderId,
      executionOrderNo: record.executionOrderNo,
      legacyCutPieceOrderNo: record.legacyCutPieceOrderNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      cutOrderId: record.cutOrderId,
      cutOrderNo: record.cutOrderNo,
      markerPlanId: record.markerPlanId,
      markerPlanNo: record.markerPlanNo,
    }))
}

export function listCuttingTaskRefs(): CuttingTaskRef[] {
  const executionsByTaskId = new Map<string, PdaCutPieceExecutionRef[]>()
  listPdaExecutionRefs().forEach((record) => {
    const current = executionsByTaskId.get(record.taskId) ?? []
    current.push(record)
    executionsByTaskId.set(record.taskId, current)
  })

  return listPdaCuttingTaskSourceRecords().map((task) => {
    const boundExecutions = executionsByTaskId.get(task.taskId) ?? []
    return {
      taskId: task.taskId,
      taskNo: task.taskNo,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
      cutOrderIds: unique(boundExecutions.map((item) => item.cutOrderId)),
      cutOrderNos: unique(boundExecutions.map((item) => item.cutOrderNo)),
      markerPlanIds: unique(boundExecutions.map((item) => item.markerPlanId)),
      markerPlanNos: unique(boundExecutions.map((item) => item.markerPlanNo)),
    }
  })
}
