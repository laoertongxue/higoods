import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types.ts'
import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import { getCuttingRuntimeStorageSignature } from '../../../data/fcs/cutting/runtime-inputs.ts'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
  mapCuttingDomainSnapshotToMarkerSpreadingBuildOptions,
  type MarkerSpreadingSummaryBuildOptions,
} from './runtime-projections.ts'
import type { CuttingSummaryBuildOptions } from './summary-model.ts'

export interface CuttingExecutionPrepProjectionContext {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
}

export interface MarkerSpreadingProjectionContext {
  snapshot: CuttingDomainSnapshot
  sources: MarkerSpreadingSummaryBuildOptions
}

let defaultExecutionPrepProjectionCache: {
  signature: string
  context: CuttingExecutionPrepProjectionContext
} | null = null
let defaultMarkerSpreadingProjectionCache: {
  signature: string
  context: MarkerSpreadingProjectionContext
} | null = null
const snapshotExecutionPrepProjectionCache = new WeakMap<CuttingDomainSnapshot, CuttingExecutionPrepProjectionContext>()
const snapshotMarkerSpreadingProjectionCache = new WeakMap<CuttingDomainSnapshot, MarkerSpreadingProjectionContext>()

export function buildExecutionPrepProjectionContext(
  snapshot?: CuttingDomainSnapshot,
): CuttingExecutionPrepProjectionContext {
  if (!snapshot) {
    const signature = getCuttingRuntimeStorageSignature()
    if (defaultExecutionPrepProjectionCache?.signature === signature) {
      return defaultExecutionPrepProjectionCache.context
    }

    const nextSnapshot = buildFcsCuttingDomainSnapshot()
    const context = {
      snapshot: nextSnapshot,
      sources: mapCuttingDomainSnapshotToSummaryBuildOptions(nextSnapshot),
    }
    defaultExecutionPrepProjectionCache = { signature, context }
    snapshotExecutionPrepProjectionCache.set(nextSnapshot, context)
    return context
  }

  const cachedContext = snapshotExecutionPrepProjectionCache.get(snapshot)
  if (cachedContext) {
    return cachedContext
  }

  const context = {
    snapshot,
    sources: mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot),
  }
  snapshotExecutionPrepProjectionCache.set(snapshot, context)
  return context
}

export function buildMarkerSpreadingProjectionContext(
  snapshot?: CuttingDomainSnapshot,
): MarkerSpreadingProjectionContext {
  if (!snapshot) {
    const signature = getCuttingRuntimeStorageSignature()
    if (defaultMarkerSpreadingProjectionCache?.signature === signature) {
      return defaultMarkerSpreadingProjectionCache.context
    }

    const nextSnapshot = buildFcsCuttingDomainSnapshot()
    const context = {
      snapshot: nextSnapshot,
      sources: mapCuttingDomainSnapshotToMarkerSpreadingBuildOptions(nextSnapshot),
    }
    defaultMarkerSpreadingProjectionCache = { signature, context }
    snapshotMarkerSpreadingProjectionCache.set(nextSnapshot, context)
    return context
  }

  const cachedContext = snapshotMarkerSpreadingProjectionCache.get(snapshot)
  if (cachedContext) {
    return cachedContext
  }

  const context = {
    snapshot,
    sources: mapCuttingDomainSnapshotToMarkerSpreadingBuildOptions(snapshot),
  }
  snapshotMarkerSpreadingProjectionCache.set(snapshot, context)
  return context
}

export function buildProgressRecordMapByCutOrder(
  records: CuttingOrderProgressRecord[],
): Record<string, CuttingOrderProgressRecord> {
  const entries = records.flatMap((record) =>
    record.materialLines.flatMap((line) => {
      const keys = Array.from(
        new Set([
          line.cutOrderId,
          line.cutOrderNo,
          line.cutPieceOrderNo,
        ].filter(Boolean)),
      )
      return keys.map((key) => [key, record] as const)
    }),
  )

  return Object.fromEntries(entries)
}
