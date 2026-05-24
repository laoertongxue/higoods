import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { buildCuttablePoolViewModel, } from './cuttable-pool-model.ts';
import { readStoredMarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts';
import { buildProductionProgressProjection } from './production-progress-projection.ts';
export function buildCuttablePoolProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    const progressProjection = buildProductionProgressProjection(snapshot);
    return {
        snapshot,
        progressRows: progressProjection.rows,
        viewModel: buildCuttablePoolViewModel(snapshot.progressRecords, {
            progressRows: progressProjection.rows,
            markerPlanOccupancy: readStoredMarkerPlanOccupancyLookup(),
        }),
    };
}
