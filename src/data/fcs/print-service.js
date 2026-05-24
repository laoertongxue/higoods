function encodeParam(value) {
    return encodeURIComponent(value);
}
export function buildUnifiedPrintPreviewLink(input) {
    const params = new URLSearchParams({
        documentType: input.documentType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
    });
    if (input.handoverRecordId) {
        params.set('handoverRecordId', input.handoverRecordId);
    }
    return `/fcs/print/preview?${params.toString()}`;
}
export function buildLegacyTaskRouteCardPrintLink(sourceType, sourceId) {
    return `/fcs/print/task-route-card?sourceType=${encodeParam(sourceType)}&sourceId=${encodeParam(sourceId)}`;
}
export function createPrintDocumentId(input, templateCode) {
    return `${templateCode}-${input.sourceType}-${input.sourceId}`.replace(/[^A-Za-z0-9_-]/g, '-');
}
export function buildPrintQrPayload(input) {
    return JSON.stringify({
        documentType: input.documentType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        businessNo: input.businessNo,
        targetRoute: input.targetRoute,
        printVersionNo: input.printVersionNo || '',
        isReprint: Boolean(input.isReprint),
        isVoid: Boolean(input.isVoid),
        ...(input.extra || {}),
    });
}
export function buildPrintBarcodePayload(input) {
    return [
        input.documentType,
        input.sourceType,
        input.businessNo,
        input.printVersionNo || 'V1',
        input.sourceId,
    ].join('|');
}
export function formatPrintQty(value, unit = '') {
    const safeValue = Number.isFinite(value) ? Number(value) : 0;
    return `${safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`.trim();
}
export function getPrintGeneratedAt() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
}
