import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
} from './runtime-projections.ts'
import type { OriginalCutOrderRow, OriginalCutOrderViewModel } from './original-orders-model.ts'

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
