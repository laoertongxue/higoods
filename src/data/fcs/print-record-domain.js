const printRecords = [];
function nowText() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
}
function normalizeIdPart(value) {
    return value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'PRINT';
}
function nextRecordId(documentType, sourceId) {
    return `PR-${normalizeIdPart(documentType)}-${normalizeIdPart(sourceId)}-${String(printRecords.length + 1).padStart(4, '0')}`;
}
function nextBatchId(documentType) {
    return `PB-${normalizeIdPart(documentType)}-${String(printRecords.length + 1).padStart(4, '0')}`;
}
function cloneRecord(record) {
    return { ...record };
}
export function createPrintRecord(payload) {
    const printedAt = payload.printedAt || nowText();
    const record = {
        printRecordId: payload.printRecordId || nextRecordId(payload.documentType, payload.sourceId),
        printBatchId: payload.printBatchId || nextBatchId(payload.documentType),
        documentType: payload.documentType,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        businessNo: payload.businessNo,
        templateCode: payload.templateCode,
        templateName: payload.templateName,
        paperType: payload.paperType,
        printMode: payload.printMode || '普通打印',
        printVersionNo: payload.printVersionNo || 'V1',
        printedBy: payload.printedBy || '系统预览',
        printedAt,
        copyCount: payload.copyCount ?? 1,
        pageCount: payload.pageCount ?? 1,
        itemCount: payload.itemCount ?? 1,
        qrPayloadSummary: payload.qrPayloadSummary || '',
        printStatus: payload.printStatus || '已预览',
        remark: payload.remark || '统一打印预览生成记录；浏览器真实打印完成状态由现场确认。',
    };
    printRecords.unshift(record);
    return cloneRecord(record);
}
export function createPrintRecordFromDocument(document, status = '已预览') {
    return createPrintRecord({
        documentType: document.documentType,
        sourceType: document.sourceType,
        sourceId: document.sourceId,
        businessNo: document.headerFields.find((item) => item.emphasis)?.value
            || document.headerFields[0]?.value
            || document.sourceId,
        templateCode: document.templateCode,
        templateName: document.documentTitle,
        paperType: document.paperType,
        printMode: document.printMode || '普通打印',
        printVersionNo: document.printVersionNo || 'V1',
        printedBy: document.printMeta.generatedBy,
        printedAt: document.printMeta.generatedAt,
        pageCount: document.paperType === 'A4' ? Math.max(1, document.tables.length + document.sections.length > 6 ? 2 : 1) : 1,
        itemCount: document.labelItems?.length || document.tables.reduce((sum, table) => sum + table.rows.length, 0) || 1,
        qrPayloadSummary: document.qrPayload || document.qrCodes[0]?.value || '',
        printStatus: status,
    });
}
export function listPrintRecords(filter = {}) {
    return printRecords
        .filter((record) => (filter.documentType ? record.documentType === filter.documentType : true))
        .filter((record) => (filter.sourceType ? record.sourceType === filter.sourceType : true))
        .filter((record) => (filter.sourceId ? record.sourceId === filter.sourceId : true))
        .filter((record) => (filter.printStatus ? record.printStatus === filter.printStatus : true))
        .map(cloneRecord);
}
export function getPrintRecordById(printRecordId) {
    const record = printRecords.find((item) => item.printRecordId === printRecordId);
    return record ? cloneRecord(record) : undefined;
}
export function getPrintRecordsBySource(documentType, sourceId) {
    return listPrintRecords({ documentType, sourceId });
}
export function markPrintRecordPrinted(printRecordId, payload = {}) {
    const record = printRecords.find((item) => item.printRecordId === printRecordId);
    if (!record)
        return undefined;
    record.printStatus = '已打印';
    record.printedBy = payload.printedBy || record.printedBy;
    record.printedAt = payload.printedAt || nowText();
    record.copyCount = payload.copyCount ?? record.copyCount;
    record.remark = payload.remark || '用户点击统一打印按钮，原型记录为已打印。';
    return cloneRecord(record);
}
export function createReprintRecord(sourcePrintRecordId, payload = {}) {
    const source = printRecords.find((item) => item.printRecordId === sourcePrintRecordId);
    if (!source) {
        throw new Error(`未找到原打印记录：${sourcePrintRecordId}`);
    }
    const sourcePayload = {
        documentType: source.documentType,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        businessNo: source.businessNo,
        templateCode: source.templateCode,
        templateName: source.templateName,
        paperType: source.paperType,
        printMode: source.printMode,
        printVersionNo: source.printVersionNo,
        printedBy: source.printedBy,
        printedAt: source.printedAt,
        copyCount: source.copyCount,
        pageCount: source.pageCount,
        itemCount: source.itemCount,
        qrPayloadSummary: source.qrPayloadSummary,
        printStatus: source.printStatus,
        remark: source.remark,
    };
    return createPrintRecord({
        ...sourcePayload,
        ...payload,
        documentType: payload.documentType || source.documentType,
        sourceType: payload.sourceType || source.sourceType,
        sourceId: payload.sourceId || source.sourceId,
        businessNo: payload.businessNo || source.businessNo,
        templateCode: payload.templateCode || source.templateCode,
        templateName: payload.templateName || source.templateName,
        paperType: payload.paperType || source.paperType,
        printMode: payload.printMode || '补打',
        printVersionNo: payload.printVersionNo || `${source.printVersionNo}-补打`,
        printStatus: '已补打',
        remark: payload.remark || `来源打印记录：${sourcePrintRecordId}`,
    });
}
