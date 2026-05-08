import {
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from './generated-original-cut-orders.ts'

export interface CuttingProductionOrderSourceRecord {
  productionOrderId: string
  productionOrderNo: string
}

export type OriginalCutOrderSourceRecord = GeneratedOriginalCutOrderSourceRecord

export function normalizeMergeBatchId(mergeBatchNo: string): string {
  return mergeBatchNo.trim() ? `merge-batch:${mergeBatchNo.trim()}` : ''
}

export function listCuttingProductionOrderSourceRecords(): CuttingProductionOrderSourceRecord[] {
  const productionOrderIdsWithOriginalCutOrders = new Set(
    listGeneratedOriginalCutOrderSourceRecords().map((record) => record.productionOrderId),
  )

  return listCuttingProductionOrdersWithFormalTechPack()
    .filter((order) => productionOrderIdsWithOriginalCutOrders.has(order.productionOrderId))
    .map((order) => ({
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
    }))
}

export function listOriginalCutOrderSourceRecords(): OriginalCutOrderSourceRecord[] {
  return listGeneratedOriginalCutOrderSourceRecords()
}
