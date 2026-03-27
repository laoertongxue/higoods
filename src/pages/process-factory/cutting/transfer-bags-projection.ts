import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import type { TransferBagStore } from './transfer-bags-model'
import {
  buildCraftTraceProjection,
} from './craft-trace-projection'
import {
  buildCuttingTraceabilityProjectionContext,
} from './traceability-projection-helpers'

export function buildTransferBagsProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  storeOverride?: TransferBagStore,
) {
  const context = buildCuttingTraceabilityProjectionContext(snapshot, storeOverride)
  return {
    snapshot,
    ticketRecords: context.ticketRecords,
    store: context.transferBagStore,
    viewModel: context.transferBagViewModel,
    returnViewModel: context.transferBagReturnViewModel,
    craftTraceProjection: buildCraftTraceProjection(snapshot, {
      transferBagStore: context.transferBagStore,
      ticketRecords: context.ticketRecords,
    }),
  }
}

export function buildCarrierCycleProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  carrierId: string,
  cycleId?: string,
  storeOverride?: TransferBagStore,
) {
  const projection = buildTransferBagsProjection(snapshot, storeOverride)
  const carrier = projection.store.masters.find((item) => item.carrierId === carrierId) || null
  const cycles = projection.store.usages.filter((item) => item.carrierId === carrierId)
  const cycle =
    (cycleId
      ? cycles.find((item) => item.cycleId === cycleId)
      : cycles.find((item) => item.cycleId === carrier?.currentCycleId)) ||
    cycles[0] ||
    null
  const bindings = cycle ? projection.store.bindings.filter((item) => item.cycleId === cycle.cycleId) : []
  const manifests = cycle ? projection.store.manifests.filter((item) => item.cycleId === cycle.cycleId) : []
  const craftTraceItems = bindings
    .map((binding) => projection.craftTraceProjection.itemsByTicketId[binding.feiTicketId] || null)
    .filter(Boolean)

  return {
    ...projection,
    carrier,
    cycle,
    bindings,
    manifests,
    craftTraceItems,
  }
}
