import { buildSampleWarehouseViewModel } from './sample-warehouse-model.ts';
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts';
export function buildSampleWarehouseProjection(options = {}) {
    const context = buildExecutionPrepProjectionContext(options.snapshot);
    const records = options.records ?? context.snapshot.warehouseState.sampleRecords;
    return {
        snapshot: context.snapshot,
        records,
        viewModel: buildSampleWarehouseViewModel(context.sources.cutOrderRows, records, {
            sampleWritebacks: options.sampleWritebacks ?? context.snapshot.warehouseState.sampleWritebacks,
        }),
    };
}
