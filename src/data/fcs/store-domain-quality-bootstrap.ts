import {
  initialQualityInspections,
  initialDeductionBasisItems,
  initialReturnInboundBatches,
  QC_SEEDS,
  BASIS_SEEDS,
} from './store-domain-quality-seeds.ts'
import { settlementLinkedMockFactoryOutput } from './settlement-linked-mock-factory.ts'

export function applyQualitySeedBootstrap() {
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
