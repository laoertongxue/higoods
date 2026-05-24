import { buildCutPieceWarehouseViewModel } from './cut-piece-warehouse-model.ts';
import { buildCuttingTraceabilityProjectionContext } from './traceability-projection-helpers.ts';
export function buildCutPieceWarehouseProjection(options = {}) {
    const context = buildCuttingTraceabilityProjectionContext(options.snapshot);
    const records = options.records ?? context.snapshot.warehouseState.cutPieceRecords;
    return {
        snapshot: context.snapshot,
        records,
        viewModel: buildCutPieceWarehouseViewModel(context.cutOrderRows, records, {
            inboundWritebacks: context.snapshot.pdaExecutionState.inboundWritebacks,
            handoverWritebacks: context.snapshot.pdaExecutionState.handoverWritebacks,
            warehouseWritebacks: options.warehouseWritebacks ?? context.snapshot.warehouseState.cutPieceWritebacks,
            transferBagViewModel: context.transferBagViewModel,
            spreadingStore: context.spreadingStore,
        }),
    };
}
