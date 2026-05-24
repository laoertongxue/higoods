export const CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY = 'cuttingFeiTicketDrafts';
export const CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY = 'cuttingFeiTicketRecords';
export const CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY = 'cuttingFeiTicketPrintJobs';
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizePrintableUnitRecord(record) {
    const normalizedTraceRecord = {
        ...record,
        sourceSpreadingSessionId: typeof record.sourceSpreadingSessionId === 'string' ? record.sourceSpreadingSessionId : '',
        sourceSpreadingSessionNo: typeof record.sourceSpreadingSessionNo === 'string' ? record.sourceSpreadingSessionNo : '',
        sourceMarkerId: typeof record.sourceMarkerId === 'string' ? record.sourceMarkerId : '',
        sourceMarkerNo: typeof record.sourceMarkerNo === 'string' ? record.sourceMarkerNo : '',
        sourceMarkerPlanId: typeof record.sourceMarkerPlanId === 'string' ? record.sourceMarkerPlanId : '',
        sourceMarkerPlanNo: typeof record.sourceMarkerPlanNo === 'string' ? record.sourceMarkerPlanNo : '',
    };
    if (normalizedTraceRecord.printableUnitId &&
        normalizedTraceRecord.printableUnitNo &&
        normalizedTraceRecord.printableUnitType) {
        return normalizedTraceRecord;
    }
    if (normalizedTraceRecord.sourceContextType === 'marker-plan-ref' &&
        typeof normalizedTraceRecord.sourceMarkerPlanId === 'string' &&
        normalizedTraceRecord.sourceMarkerPlanId) {
        return {
            ...normalizedTraceRecord,
            printableUnitId: normalizedTraceRecord.printableUnitId || `marker-plan:${normalizedTraceRecord.sourceMarkerPlanId}`,
            printableUnitNo: normalizedTraceRecord.printableUnitNo || normalizedTraceRecord.sourceMarkerPlanNo || '',
            printableUnitType: normalizedTraceRecord.printableUnitType || 'MARKER_PLAN',
        };
    }
    const fallbackCutOrderId = typeof normalizedTraceRecord.cutOrderId === 'string'
        ? normalizedTraceRecord.cutOrderId
        : Array.isArray(normalizedTraceRecord.cutOrderIds)
            ? String(normalizedTraceRecord.cutOrderIds[0] || '')
            : '';
    const fallbackCutOrderNo = typeof normalizedTraceRecord.cutOrderNo === 'string'
        ? normalizedTraceRecord.cutOrderNo
        : Array.isArray(normalizedTraceRecord.cutOrderNos)
            ? String(normalizedTraceRecord.cutOrderNos[0] || '')
            : '';
    return {
        ...normalizedTraceRecord,
        printableUnitId: normalizedTraceRecord.printableUnitId || (fallbackCutOrderId ? `cut-order:${fallbackCutOrderId}` : ''),
        printableUnitNo: normalizedTraceRecord.printableUnitNo || fallbackCutOrderNo,
        printableUnitType: normalizedTraceRecord.printableUnitType || 'CUT_ORDER',
    };
}
export function deserializeFeiTicketDraftsStorage(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
export function deserializeFeiTicketRecordsStorage(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : [];
    }
    catch {
        return [];
    }
}
export function deserializeFeiTicketPrintJobsStorage(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : [];
    }
    catch {
        return [];
    }
}
export function buildStoredFeiTicketTraceMatrix(records) {
    return records
        .map((record) => normalizePrintableUnitRecord(record))
        .map((record) => ({
        printableUnitId: String(record.printableUnitId || ''),
        feiTicketId: String(record.feiTicketId || record.ticketRecordId || ''),
        feiTicketNo: String(record.feiTicketNo || record.ticketNo || ''),
        sourceSpreadingSessionId: String(record.sourceSpreadingSessionId || ''),
        sourceSpreadingSessionNo: String(record.sourceSpreadingSessionNo || ''),
        sourceMarkerId: String(record.sourceMarkerId || ''),
        sourceMarkerNo: String(record.sourceMarkerNo || ''),
        cutOrderId: String(record.cutOrderId || ''),
        cutOrderNo: String(record.cutOrderNo || ''),
        sourceMarkerPlanId: String(record.sourceMarkerPlanId || ''),
        sourceWritebackId: String(record.sourceWritebackId || ''),
        color: String(record.color || record.skuColor || ''),
        size: String(record.size || record.skuSize || ''),
        garmentQty: Number(record.garmentQty || record.qty || 0),
    }));
}
