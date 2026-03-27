import { processTasks } from './process-tasks.ts'
import { productionOrders } from './production-orders.ts'
import {
  initialQualityInspections,
  initialDeductionBasisItems,
  initialReturnInboundBatches,
  QC_SEEDS,
  BASIS_SEEDS,
  seedParentTask,
  seedProductionOrder,
} from './store-domain-quality-seeds.ts'
import { settlementLinkedMockFactoryOutput } from './settlement-linked-mock-factory.ts'

export function applyQualitySeedBootstrap() {
  for (const task of settlementLinkedMockFactoryOutput.processTasks) {
    if (!processTasks.find((item) => item.taskId === task.taskId)) {
      processTasks.push(task)
    }
  }

  for (const order of settlementLinkedMockFactoryOutput.productionOrders) {
    if (!productionOrders.find((item) => item.productionOrderId === order.productionOrderId)) {
      productionOrders.push(order)
    }
  }

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

  for (const batch of settlementLinkedMockFactoryOutput.returnInboundBatches) {
    if (!initialReturnInboundBatches.find((item) => item.batchId === batch.batchId)) {
      initialReturnInboundBatches.push(batch)
    }
  }
}
