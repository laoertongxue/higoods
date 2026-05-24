import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { buildProductionProgressRows, } from './production-progress-model.ts';
export function buildProductionProgressProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    const rows = buildProductionProgressRows(snapshot.progressRecords, {
        pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks,
        inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks,
        handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks,
        replenishmentFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks,
    });
    return {
        snapshot,
        rows,
        rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
    };
}
