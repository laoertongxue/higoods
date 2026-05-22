import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
} from './runtime-projections.ts'
import type { CutOrderRow, CutOrderViewModel } from './cut-orders-model.ts'

export interface CutOrdersProjection {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
  viewModel: CutOrderViewModel
}

export function buildCutOrdersProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CutOrdersProjection {
  const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot)
  const rows = sources.cutOrderRows
  return {
    snapshot,
    sources,
    viewModel: {
      rows,
      rowsById: Object.fromEntries(rows.map((row: CutOrderRow) => [row.id, row])),
    },
  }
}
