import { processTasks } from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import {
  initialQualityInspections,
  initialDeductionBasisItems,
  QC_SEEDS,
  BASIS_SEEDS,
  seedParentTask,
  seedProductionOrder,
} from './store-domain-quality-seeds.ts'

export function applyQualitySeedBootstrap() {
  if (!processTasks.find(task => task.taskId === seedParentTask.taskId)) {
    processTasks.push(seedParentTask)
  }

  if (!productionOrders.find(order => order.productionOrderId === seedProductionOrder.productionOrderId)) {
    productionOrders.push(seedProductionOrder)
  }

  for (const qc of QC_SEEDS) {
    if (!initialQualityInspections.find(item => item.qcId === qc.qcId)) {
      initialQualityInspections.push(qc)
    }
  }

  for (const basis of BASIS_SEEDS) {
    if (!initialDeductionBasisItems.find(item => item.basisId === basis.basisId)) {
      initialDeductionBasisItems.push(basis)
    }
  }
}
