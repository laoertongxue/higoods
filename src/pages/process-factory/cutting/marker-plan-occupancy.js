import { MARKER_PLAN_STORAGE_KEY, } from './marker-plan-domain.ts';
function isActiveMarkerPlanStatus(status) {
    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (!normalizedStatus)
        return true;
    return !['CANCELED', 'CANCELLED', 'DONE', 'COMPLETED', 'ARCHIVED'].includes(normalizedStatus);
}
function pickMarkerPlanNo(plan) {
    return plan.markerNo || plan.markerPlanNo || plan.schemeNo || '';
}
function addOccupancy(lookup, key, info) {
    if (!key)
        return;
    lookup[key] = info;
}
export function buildMarkerPlanOccupancyLookup(plans) {
    const lookup = {};
    plans
        .filter((plan) => isActiveMarkerPlanStatus(plan.status))
        .forEach((plan) => {
        const info = {
            markerPlanId: plan.id || plan.markerPlanId || '',
            markerPlanNo: pickMarkerPlanNo(plan),
        };
        (plan.cutOrderIds || []).forEach((id) => addOccupancy(lookup, id, info));
        (plan.cutOrderNos || []).forEach((no) => addOccupancy(lookup, no, info));
    });
    return lookup;
}
export function readStoredMarkerPlanOccupancyLookup(storage = typeof localStorage === 'undefined' ? null : localStorage) {
    if (!storage)
        return {};
    try {
        const parsed = JSON.parse(storage.getItem(MARKER_PLAN_STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed))
            return {};
        return buildMarkerPlanOccupancyLookup(parsed);
    }
    catch {
        return {};
    }
}
