import { listWaterSolubleWorkOrders } from './water-soluble-task-domain.ts'
import type { ProcessWorkOrderRelationSource } from './process-work-order-domain.ts'

export function listWaterSolubleRelationSources(): ProcessWorkOrderRelationSource[] {
  return listWaterSolubleWorkOrders().map((order): ProcessWorkOrderRelationSource => ({
    taskId: order.taskId, taskNo: order.taskNo, factoryId: order.factoryId || '', factoryName: order.factoryName || '待分配染厂',
    sourceArtifactIds: [order.sourceArtifactId],
    workOrderId: order.waterOrderId,
    workOrderNo: order.waterOrderNo,
    processType: 'WATER_SOLUBLE',
    sourceType: 'PRODUCTION_ORDER',
    sourceSnapshot: {
      sourceType: 'PRODUCTION_ORDER',
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      techPackVersionId: order.techPackVersionId,
      bomItemId: order.bomItemId,
    },
    sourceProductionOrderId: order.productionOrderId,
    sourceProductionOrderNo: order.productionOrderNo,
    objectType: 'BOM 物料',
    materialSku: order.materialCode,
    materialName: order.materialName,
    plannedQty: order.plannedQty,
    plannedUnit: order.qtyUnit,
  }))
}
