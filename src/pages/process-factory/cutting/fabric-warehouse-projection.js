import { buildFabricWarehouseViewModel } from './fabric-warehouse-model.ts';
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts';
export function buildFabricWarehouseProjection(options = {}) {
    const context = buildExecutionPrepProjectionContext(options.snapshot);
    const records = options.records ?? context.snapshot.warehouseState.fabricStocks;
    return {
        snapshot: context.snapshot,
        records,
        viewModel: buildFabricWarehouseViewModel(context.sources.cutOrderRows, records),
    };
}
