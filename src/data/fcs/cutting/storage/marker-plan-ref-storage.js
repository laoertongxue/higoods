export const CUTTING_SELECTED_IDS_STORAGE_KEY = 'cuttingSelectedCutOrderIds';
export const CUTTING_SELECTED_MARKER_PLAN_GROUP_KEY_STORAGE_KEY = 'cuttingSelectedMarkerPlanKey';
export const CUTTING_MARKER_PLAN_REF_LEDGER_STORAGE_KEY = 'cuttingMarkerPlanRefLedger';
export function deserializeMarkerPlanRefStorage(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((record) => {
            return Boolean(record && typeof record === 'object' && typeof record.markerPlanId === 'string' && typeof record.markerPlanNo === 'string');
        });
    }
    catch {
        return [];
    }
}
