import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildProductionProgressRows,
  type ProductionProgressRow,
} from './production-progress-model'

export interface ProductionProgressProjection {
  snapshot: CuttingDomainSnapshot
  rows: ProductionProgressRow[]
  rowsById: Record<string, ProductionProgressRow>
}

export function buildProductionProgressProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
): ProductionProgressProjection {
  const rows = buildProductionProgressRows(snapshot.progressRecords, {
    pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks as never[],
    inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks as never[],
    handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks as never[],
    replenishmentFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as never[],
  })

  return {
    snapshot,
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
  }
}
