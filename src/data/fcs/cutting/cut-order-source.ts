import {
  listCuttingProductionOrdersWithFormalTechPack,
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'

export interface CuttingProductionOrderSourceRecord {
  productionOrderId: string
  productionOrderNo: string
}

export type CutOrderSourceRecord = GeneratedCutOrderSourceRecord

export function normalizeMarkerPlanRefId(markerPlanNo: string): string {
  return markerPlanNo.trim() ? `marker-plan-ref:${markerPlanNo.trim()}` : ''
}

export function listCuttingProductionOrderSourceRecords(): CuttingProductionOrderSourceRecord[] {
  const productionOrderIdsWithCutOrders = new Set(
    listGeneratedCutOrderSourceRecords().map((record) => record.productionOrderId),
  )

  return listCuttingProductionOrdersWithFormalTechPack()
    .filter((order) => productionOrderIdsWithCutOrders.has(order.productionOrderId))
    .map((order) => ({
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
    }))
}

export function listCutOrderSourceRecords(): CutOrderSourceRecord[] {
  return listGeneratedCutOrderSourceRecords()
}
