import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildExecutionPrepProjectionContext,
  buildProgressRecordMapByOriginalCutOrder,
} from './execution-prep-projection-helpers'
import { buildMaterialPrepStats } from './material-prep-model'

export interface MaterialPrepProjection {
  snapshot: CuttingDomainSnapshot
  rows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  rowsById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][number]>
  stats: ReturnType<typeof buildMaterialPrepStats>
  progressRecordMapByOriginalCutOrder: Record<string, import('../../../data/fcs/cutting/types.ts').CuttingOrderProgressRecord>
}

export function buildMaterialPrepProjection(
  snapshot?: CuttingDomainSnapshot,
): MaterialPrepProjection {
  const context = buildExecutionPrepProjectionContext(snapshot)
  const rows = context.sources.materialPrepRows
  return {
    snapshot: context.snapshot,
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
    stats: buildMaterialPrepStats(rows),
    progressRecordMapByOriginalCutOrder: buildProgressRecordMapByOriginalCutOrder(context.snapshot.progressRecords),
  }
}

