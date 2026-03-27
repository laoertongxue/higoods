import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types.ts'
import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  mapCuttingDomainSnapshotToSummaryBuildOptions,
} from './runtime-projections'
import type { CuttingSummaryBuildOptions } from './summary-model'

export interface CuttingExecutionPrepProjectionContext {
  snapshot: CuttingDomainSnapshot
  sources: CuttingSummaryBuildOptions
}

export function buildExecutionPrepProjectionContext(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): CuttingExecutionPrepProjectionContext {
  return {
    snapshot,
    sources: mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot),
  }
}

export function buildProgressRecordMapByOriginalCutOrder(
  records: CuttingOrderProgressRecord[],
): Record<string, CuttingOrderProgressRecord> {
  const entries = records.flatMap((record) =>
    record.materialLines.flatMap((line) => {
      const keys = Array.from(
        new Set([
          line.originalCutOrderId,
          line.originalCutOrderNo,
          line.cutPieceOrderNo,
        ].filter(Boolean)),
      )
      return keys.map((key) => [key, record] as const)
    }),
  )

  return Object.fromEntries(entries)
}
