import {
  listOriginalCutOrderSourceRecords,
} from '../../data/fcs/cutting/original-cut-order-source.ts'
import { listMergeBatchSourceRecords } from '../../data/fcs/cutting/merge-batch-source.ts'
import {
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../../data/fcs/cutting/pda-cutting-task-source.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'
import type {
  CuttingTaskRef,
  MergeBatchRef,
  OriginalCutOrderRef,
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

export function listMergeBatchRefs(): MergeBatchRef[] {
  return listMergeBatchSourceRecords().map((record) => ({
    mergeBatchId: record.mergeBatchId,
    mergeBatchNo: record.mergeBatchNo,
    sourceOriginalCutOrderIds: [...record.sourceOriginalCutOrderIds],
    sourceOriginalCutOrderNos: [...record.sourceOriginalCutOrderNos],
    sourceProductionOrderIds: [...record.sourceProductionOrderIds],
    sourceProductionOrderNos: [...record.sourceProductionOrderNos],
  }))
}

export function listOriginalCutOrderRefs(): OriginalCutOrderRef[] {
  const mergeBatchRefs = listMergeBatchRefs()
  const mergeBatchNosByOriginalId = new Map<string, string[]>()
  const mergeBatchIdsByOriginalId = new Map<string, string[]>()

  mergeBatchRefs.forEach((batch) => {
    batch.sourceOriginalCutOrderIds.forEach((originalCutOrderId) => {
      mergeBatchNosByOriginalId.set(originalCutOrderId, unique([...(mergeBatchNosByOriginalId.get(originalCutOrderId) ?? []), batch.mergeBatchNo]))
      mergeBatchIdsByOriginalId.set(originalCutOrderId, unique([...(mergeBatchIdsByOriginalId.get(originalCutOrderId) ?? []), batch.mergeBatchId]))
    })
  })

  return listOriginalCutOrderSourceRecords().map((record) => {
    const mergeBatchIds = unique([record.mergeBatchId, ...(mergeBatchIdsByOriginalId.get(record.originalCutOrderId) ?? [])])
    const mergeBatchNos = unique([record.mergeBatchNo, ...(mergeBatchNosByOriginalId.get(record.originalCutOrderId) ?? [])])

    return {
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      materialSku: record.materialSku,
      activeMergeBatchId: mergeBatchIds[0] ?? '',
      activeMergeBatchNo: mergeBatchNos[0] ?? '',
      mergeBatchIds,
      mergeBatchNos,
    } satisfies OriginalCutOrderRef
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
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      mergeBatchId: record.mergeBatchId,
      mergeBatchNo: record.mergeBatchNo,
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
      originalCutOrderIds: unique(boundExecutions.map((item) => item.originalCutOrderId)),
      originalCutOrderNos: unique(boundExecutions.map((item) => item.originalCutOrderNo)),
      mergeBatchIds: unique(boundExecutions.map((item) => item.mergeBatchId)),
      mergeBatchNos: unique(boundExecutions.map((item) => item.mergeBatchNo)),
    }
  })
}
