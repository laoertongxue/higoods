import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { getCuttingRuntimeStorageSignature } from '../../../data/fcs/cutting/runtime-inputs.ts';
import { mapCuttingDomainSnapshotToSummaryBuildOptions, } from './runtime-projections.ts';
let defaultExecutionPrepProjectionCache = null;
const snapshotExecutionPrepProjectionCache = new WeakMap();
export function buildExecutionPrepProjectionContext(snapshot) {
    if (!snapshot) {
        const signature = getCuttingRuntimeStorageSignature();
        if (defaultExecutionPrepProjectionCache?.signature === signature) {
            return defaultExecutionPrepProjectionCache.context;
        }
        const nextSnapshot = buildFcsCuttingDomainSnapshot();
        const context = {
            snapshot: nextSnapshot,
            sources: mapCuttingDomainSnapshotToSummaryBuildOptions(nextSnapshot),
        };
        defaultExecutionPrepProjectionCache = { signature, context };
        snapshotExecutionPrepProjectionCache.set(nextSnapshot, context);
        return context;
    }
    const cachedContext = snapshotExecutionPrepProjectionCache.get(snapshot);
    if (cachedContext) {
        return cachedContext;
    }
    const context = {
        snapshot,
        sources: mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot),
    };
    snapshotExecutionPrepProjectionCache.set(snapshot, context);
    return context;
}
export function buildProgressRecordMapByCutOrder(records) {
    const entries = records.flatMap((record) => record.materialLines.flatMap((line) => {
        const keys = Array.from(new Set([
            line.cutOrderId,
            line.cutOrderNo,
            line.cutPieceOrderNo,
        ].filter(Boolean)));
        return keys.map((key) => [key, record]);
    }));
    return Object.fromEntries(entries);
}
