import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildCraftTraceProjection,
} from './craft-trace-projection'
import {
  buildCuttingTraceabilityProjectionContext,
} from './traceability-projection-helpers'

export function buildFeiTicketsProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
) {
  const context = buildCuttingTraceabilityProjectionContext(snapshot)
  return {
    snapshot,
    originalRows: context.originalRows,
    materialPrepRows: context.materialPrepRows,
    mergeBatches: context.mergeBatches,
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
