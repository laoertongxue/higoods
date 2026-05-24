import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { mapCuttingDomainSnapshotToSummaryBuildOptions, } from './runtime-projections.ts';
export function buildCutOrdersProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot);
    const rows = sources.cutOrderRows;
    return {
        snapshot,
        sources,
        viewModel: {
            rows,
            rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
        },
    };
}
