import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { CuttingSummaryBuildOptions } from './summary-model'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
} from './runtime-projections.ts'
import {
  buildCuttablePoolViewModel,
  type CuttablePoolViewModel,
} from './cuttable-pool-model'

export interface MergeBatchesProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  cuttableViewModel: CuttablePoolViewModel
}

export function buildMergeBatchesProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): MergeBatchesProjection {
  const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  return {
    snapshot,
    sources,
    cuttableViewModel: buildCuttablePoolViewModel(snapshot.progressRecords, {
      progressRows: sources.productionRows,
    }),
  }
}
