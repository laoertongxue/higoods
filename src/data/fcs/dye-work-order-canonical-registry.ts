import type { ProcessWorkOrderSourceType } from './process-work-order-domain.ts'

export interface CanonicalDyeWorkOrder {
  dyeOrderId: string
  dyeOrderNo: string
  sourceType: ProcessWorkOrderSourceType
  sourceProductionOrderId?: string
  sourceProductionOrderNo?: string
  productionOrderOrderedAt?: string
  productionOrderIds?: string[]
  plannedQty: number
  qtyUnit: string
  dyeFactoryId: string
  dyeFactoryName: string
  materialId: string
  rawMaterialSku: string
  composition?: string
  targetColor: string
  dyeProcessCode: 'DYE'
  dyeProcessName: string
}

type CanonicalDyeWorkOrderReader = (dyeWorkOrderId: string) => CanonicalDyeWorkOrder | undefined

let canonicalReader: CanonicalDyeWorkOrderReader | undefined

function cloneCanonicalWorkOrder(order: CanonicalDyeWorkOrder): CanonicalDyeWorkOrder {
  return {
    dyeOrderId: order.dyeOrderId,
    dyeOrderNo: order.dyeOrderNo,
    sourceType: order.sourceType,
    sourceProductionOrderId: order.sourceProductionOrderId,
    sourceProductionOrderNo: order.sourceProductionOrderNo,
    productionOrderOrderedAt: order.productionOrderOrderedAt,
    productionOrderIds: order.productionOrderIds ? [...order.productionOrderIds] : undefined,
    plannedQty: order.plannedQty,
    qtyUnit: order.qtyUnit,
    dyeFactoryId: order.dyeFactoryId,
    dyeFactoryName: order.dyeFactoryName,
    materialId: order.materialId,
    rawMaterialSku: order.rawMaterialSku,
    composition: order.composition,
    targetColor: order.targetColor,
    dyeProcessCode: order.dyeProcessCode,
    dyeProcessName: order.dyeProcessName,
  }
}

export function registerCanonicalDyeWorkOrderReader(reader: CanonicalDyeWorkOrderReader): void {
  canonicalReader = reader
}

export function getCanonicalDyeWorkOrderById(dyeWorkOrderId: string): CanonicalDyeWorkOrder | undefined {
  const order = canonicalReader?.(dyeWorkOrderId)
  return order ? cloneCanonicalWorkOrder(order) : undefined
}
