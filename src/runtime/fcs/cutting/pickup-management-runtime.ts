import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../../data/browser-storage.ts'
import {
  appendPickupSessionFromNode,
  buildPickupDemandFactsFromProjections,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  type MaterialPrepOrderProjection,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import type {
  PickupDemandFact,
  PickupProcessResultFact,
} from '../../../data/fcs/cutting/pickup-demand-domain.ts'
import type {
  PickupNodeProjection,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
} from '../../../data/fcs/platform-process-result-view.ts'
import {
  ensureSupplementRecordPickupSeeds,
  listSupplementRecords,
  type SupplementRecord,
} from '../../../data/fcs/cutting/supplement-records.ts'
import { assertPickupNodeHasNoOpenDiscrepancy } from '../../../data/fcs/cutting/pickup-discrepancy.ts'

export interface PickupRuntimeOverrides {
  supplementRecords?: SupplementRecord[]
  dyeResults?: PickupProcessResultFact[]
  printResults?: PickupProcessResultFact[]
}

export interface PickupRuntimeContext {
  projections: MaterialPrepOrderProjection[]
  supplementRecords: SupplementRecord[]
  dyeResults: PickupProcessResultFact[]
  printResults: PickupProcessResultFact[]
  demandFacts: PickupDemandFact[]
  activeNodes: PickupNodeProjection[]
}

export function bootstrapPickupManagementRuntimeMockData(): SupplementRecord[] {
  return ensureSupplementRecordPickupSeeds()
}

export function buildPickupRuntimeContext(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupRuntimeContext {
  const projections = listMaterialPrepOrderProjections(storage)
  const supplementRecords = overrides.supplementRecords ?? listSupplementRecords()
  const dyeResults = overrides.dyeResults ?? listPlatformDyeResultViews()
  const printResults = overrides.printResults ?? listPlatformPrintResultViews()
  const demandFacts = buildPickupDemandFactsFromProjections({
    projections,
    supplementRecords,
    dyeResults,
    printResults,
  })
  return {
    projections,
    supplementRecords,
    dyeResults,
    printResults,
    demandFacts,
    activeNodes: listActivePickupNodes(storage, demandFacts),
  }
}

export function listPickupDemandFactsRuntime(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupDemandFact[] {
  return buildPickupRuntimeContext(storage, overrides).demandFacts
}

export function listActivePickupNodesRuntime(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupNodeProjection[] {
  return buildPickupRuntimeContext(storage, overrides).activeNodes
}

export function appendPickupSessionFromNodeRuntime(
  input: Parameters<typeof appendPickupSessionFromNode>[0],
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  overrides: PickupRuntimeOverrides = {},
): PickupSession {
  assertPickupNodeHasNoOpenDiscrepancy(input.pickupNodeId, input.pickupNodeVersion, storage)
  const context = buildPickupRuntimeContext(storage, overrides)
  return appendPickupSessionFromNode(input, storage, context.demandFacts)
}
