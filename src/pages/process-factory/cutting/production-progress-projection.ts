import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts'
import {
  buildProductionProgressRows,
  type ProductionProgressRow,
} from './production-progress-model.ts'

export interface ProductionProgressProjection {
  snapshot: CuttingDomainSnapshot | null
  rows: ProductionProgressRow[]
  rowsById: Record<string, ProductionProgressRow>
}

export function buildProductionProgressProjection(
  snapshot?: CuttingDomainSnapshot,
): ProductionProgressProjection {
  const rows = snapshot
    ? buildProductionProgressRows(snapshot.progressRecords, {
        pickupEvents: snapshot.pdaExecutionState.pickupEvents as never[],
        inboundEvents: snapshot.pdaExecutionState.inboundEvents as never[],
        handoverEvents: snapshot.pdaExecutionState.handoverEvents as never[],
      })
    : buildProductionProgressRows(cuttingOrderProgressRecords)

  return {
    snapshot: snapshot || null,
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
  }
}
