import { buildExecutionPrepProjectionContext, buildProgressRecordMapByCutOrder, } from './execution-prep-projection-helpers.ts';
import { buildMaterialPrepStats } from './material-prep-model.ts';
export function buildMaterialPrepProjection(snapshot) {
    const context = buildExecutionPrepProjectionContext(snapshot);
    const rows = context.sources.materialPrepRows;
    return {
        snapshot: context.snapshot,
        rows,
        rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
        stats: buildMaterialPrepStats(rows),
        progressRecordMapByCutOrder: buildProgressRecordMapByCutOrder(context.snapshot.progressRecords),
    };
}
