import { processTasks } from './process-tasks'
import { productionOrders } from './production-orders'
import {
  initialQualityInspections,
  initialDeductionBasisItems,
  QC_SEEDS,
  BASIS_SEEDS,
  seedParentTask,
  seedReworkTask,
  seedProductionOrder,
} from './store-domain-quality-seeds'

export function applyQualitySeedBootstrap() {
  if (!processTasks.find(task => task.taskId === seedParentTask.taskId)) {
    processTasks.push(seedParentTask)
  }

  if (!processTasks.find(task => task.taskId === seedReworkTask.taskId)) {
    processTasks.push(seedReworkTask)
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