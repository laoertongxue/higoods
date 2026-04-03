import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import type {
  MarkerSpreadingPrefilter,
  MarkerSpreadingStore,
} from './marker-spreading-model.ts'
import { buildMarkerSpreadingViewModel } from './marker-spreading-model.ts'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts'

export interface MarkerSpreadingProjection {
  snapshot: CuttingDomainSnapshot
  rows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  rowsById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][number]>
  mergeBatches: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['mergeBatches']
  store: MarkerSpreadingStore
  viewModel: ReturnType<typeof buildMarkerSpreadingViewModel>
}

export function buildMarkerSpreadingProjection(options: {
  snapshot?: CuttingDomainSnapshot
  prefilter?: MarkerSpreadingPrefilter | null
  store?: MarkerSpreadingStore
} = {}): MarkerSpreadingProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const store =
    options.store ??
    (context.snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore)
  const viewModel = buildMarkerSpreadingViewModel({
    rows: context.sources.materialPrepRows,
    mergeBatches: context.sources.mergeBatches,
    store,
    prefilter: options.prefilter ?? null,
  })

  return {
    snapshot: context.snapshot,
    rows: context.sources.materialPrepRows,
    rowsById: Object.fromEntries(
      context.sources.materialPrepRows.map((row) => [row.originalCutOrderId, row]),
    ),
    mergeBatches: context.sources.mergeBatches,
    store,
    viewModel,
  }
}
