export const CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY = 'cuttingReplenishmentReviews';
export const CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY = 'cuttingReplenishmentImpactPlans';
export const CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY = 'cuttingReplenishmentAuditTrail';
export const CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY = 'cuttingReplenishmentFollowupActions';
export const CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY = 'cuttingReplenishmentPendingPrepFollowups';
function parseArray(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item) && typeof item === 'object') : [];
    }
    catch {
        return [];
    }
}
export const deserializeReplenishmentReviewsStorage = parseArray;
export const deserializeReplenishmentImpactPlansStorage = parseArray;
export const deserializeReplenishmentAuditTrailStorage = parseArray;
export const deserializeReplenishmentActionsStorage = parseArray;
function normalizePendingPrepRecord(record) {
    const followupId = String(record.followupId || '').trim();
    const cutOrderId = String(record.cutOrderId || '').trim();
    const materialSku = String(record.materialSku || '').trim();
    if (!followupId || !cutOrderId || !materialSku)
        return null;
    return {
        followupId,
        suggestionId: String(record.suggestionId || '').trim(),
        sourceReplenishmentRequestId: String(record.sourceReplenishmentRequestId || record.suggestionId || '').trim(),
        sourceSpreadingSessionId: String(record.sourceSpreadingSessionId || '').trim(),
        sourceMarkerId: String(record.sourceMarkerId || '').trim(),
        sourceMarkerNo: String(record.sourceMarkerNo || '').trim(),
        cutOrderId,
        cutOrderNo: String(record.cutOrderNo || cutOrderId).trim(),
        materialSku,
        color: String(record.color || '').trim(),
        shortageGarmentQty: Number(record.shortageGarmentQty || 0),
        status: 'PENDING_PREP',
        createdAt: String(record.createdAt || '').trim(),
        createdBy: String(record.createdBy || '').trim(),
        note: String(record.note || '').trim(),
    };
}
export function serializeReplenishmentPendingPrepStorage(records) {
    return JSON.stringify(records);
}
export function deserializeReplenishmentPendingPrepStorage(raw) {
    return parseArray(raw)
        .map(normalizePendingPrepRecord)
        .filter((record) => Boolean(record));
}
export function buildReplenishmentPendingPrepTraceMatrix(records) {
    return records
        .map((record) => ({
        followupId: record.followupId,
        sourceReplenishmentRequestId: record.sourceReplenishmentRequestId,
        sourceSpreadingSessionId: record.sourceSpreadingSessionId,
        sourceMarkerId: record.sourceMarkerId,
        sourceMarkerNo: record.sourceMarkerNo,
        cutOrderId: record.cutOrderId,
        cutOrderNo: record.cutOrderNo,
        materialSku: record.materialSku,
        color: record.color,
        shortageGarmentQty: record.shortageGarmentQty,
        status: record.status,
    }))
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN'));
}
