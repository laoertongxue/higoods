import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildCraftTraceProjection,
} from './craft-trace-projection.ts'
import {
  buildCuttingTraceabilityProjectionContext,
} from './traceability-projection-helpers.ts'

export function buildFeiTicketsProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
) {
  const context = buildCuttingTraceabilityProjectionContext(snapshot)
  return {
    snapshot,
    cutOrderRows: context.cutOrderRows,
    materialPrepRows: context.materialPrepRows,
    markerPlanSources: context.markerPlanSources,
    markerStore: context.markerStore,
    ticketRecords: context.ticketRecords,
    printJobs: context.printJobs,
    transferBagStore: context.transferBagStore,
    printableViewModel: context.printableViewModel,
    craftTraceProjection: buildCraftTraceProjection(snapshot, {
      transferBagStore: context.transferBagStore,
      ticketRecords: context.ticketRecords,
    }),
  }
}
