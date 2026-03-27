import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { CuttingSummaryBuildOptions } from './summary-model'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
} from './runtime-projections'
import type { OriginalCutOrderRow, OriginalCutOrderViewModel } from './original-orders-model'

export interface OriginalOrdersProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  viewModel: OriginalCutOrderViewModel
}

export function buildOriginalOrdersProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): OriginalOrdersProjection {
  const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  const rows = sources.originalRows
  return {
    snapshot,
    sources,
    viewModel: {
      rows,
      rowsById: Object.fromEntries(rows.map((row: OriginalCutOrderRow) => [row.id, row])),
    },
  }
}
