import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { ProductionProgressRow } from './production-progress-model.ts'
import {
  buildCuttablePoolViewModel,
  type CuttablePoolViewModel,
} from './cuttable-pool-model.ts'
import { buildProductionProgressProjection } from './production-progress-projection.ts'

export interface CuttablePoolProjection {
  snapshot: CuttingDomainSnapshot
  progressRows: ProductionProgressRow[]
  viewModel: CuttablePoolViewModel
}

export function buildCuttablePoolProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CuttablePoolProjection {
  const progressProjection = buildProductionProgressProjection(snapshot)
  return {
    snapshot,
    progressRows: progressProjection.rows,
    viewModel: buildCuttablePoolViewModel(snapshot.progressRecords, {
      progressRows: progressProjection.rows,
    }),
  }
}
