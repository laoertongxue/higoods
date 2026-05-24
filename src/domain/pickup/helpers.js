export const pickupScenarioTypeLabels = {
    COMMON: '通用领料',
    CUTTING: '裁片领料',
    PRINTING: '面料领料',
    DYEING: '面料领料',
};
export const pickupBoundObjectTypeLabels = {
    TASK: '任务级绑定',
    CUT_PIECE_ORDER: '裁片单级绑定',
    PRINT_ORDER: '印花单级绑定',
    DYE_ORDER: '染色单级绑定',
    MATERIAL_LINE: '物料行级绑定',
};
export const pickupMaterialTypeLabels = {
    GENERAL: '通用物料',
    PRINT: '面料',
    DYE: '面料',
    SOLID: '面料',
    LINING: '里布',
};
export const pickupSlipStatusLabels = {
    PENDING_PRINT: '待打印',
    READY_TO_PICKUP: '待扫码领取',
    PARTIAL_RECEIVED: '部分领取',
    RECEIVED: '领取完成',
    RECHECK_REQUIRED: '待复核',
};
export const pickupScanResultLabels = {
    NOT_SCANNED: '未扫码回写',
    MATCHED: '扫码领取成功',
    RECHECK_REQUIRED: '驳回核对',
    PHOTO_SUBMITTED: '带照片提交',
    CANCELLED: '已取消',
};
export const pickupReceiptStatusLabels = {
    NOT_SCANNED: '未回执',
    SCANNED_MATCHED: '已回执',
    SCANNED_RECHECK: '待复核',
    PHOTO_SUBMITTED: '已提交照片',
    CANCELLED: '已取消',
};
export function getLatestPickupScanRecord(records) {
    if (!records.length)
        return null;
    return [...records].sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))[0];
}
export function buildPickupEvidenceSummary(evidences) {
    const photoCount = evidences
        .filter((item) => item.evidenceType === 'PHOTO')
        .reduce((sum, item) => sum + item.count, 0);
    const manualNoteCount = evidences
        .filter((item) => item.evidenceType === 'MANUAL_NOTE')
        .reduce((sum, item) => sum + item.count, 0);
    const receiptNoteCount = evidences
        .filter((item) => item.evidenceType === 'RECEIPT_NOTE')
        .reduce((sum, item) => sum + item.count, 0);
    const latest = [...evidences].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    return {
        totalCount: evidences.reduce((sum, item) => sum + item.count, 0),
        photoCount,
        manualNoteCount,
        receiptNoteCount,
        latestEvidenceSummary: latest ? `${latest.summary}（${latest.createdAt}）` : '当前无差异凭证',
    };
}
export function derivePickupReceiptStatus(resultStatus) {
    if (resultStatus === 'MATCHED')
        return 'SCANNED_MATCHED';
    if (resultStatus === 'RECHECK_REQUIRED')
        return 'SCANNED_RECHECK';
    if (resultStatus === 'PHOTO_SUBMITTED')
        return 'PHOTO_SUBMITTED';
    if (resultStatus === 'CANCELLED')
        return 'CANCELLED';
    return 'NOT_SCANNED';
}
export function buildPickupReceiptSummary(pickupSlipNo, scanRecords, evidences) {
    const latest = getLatestPickupScanRecord(scanRecords);
    const latestResultStatus = latest?.resultStatus ?? 'NOT_SCANNED';
    const hasPhotoEvidence = evidences.some((item) => item.evidenceType === 'PHOTO' && item.count > 0);
    const needsRecheck = latestResultStatus === 'RECHECK_REQUIRED' || latestResultStatus === 'PHOTO_SUBMITTED';
    return {
        pickupSlipNo,
        latestResultStatus,
        latestResultLabel: pickupScanResultLabels[latestResultStatus],
        latestScannedAt: latest?.scannedAt ?? '-',
        latestScannedBy: latest?.scannedBy ?? '-',
        hasPhotoEvidence,
        needsRecheck,
        receiptStatus: derivePickupReceiptStatus(latestResultStatus),
    };
}
export function buildPickupResultSummary(receiptSummary) {
    const evidenceText = receiptSummary.hasPhotoEvidence ? '含照片凭证' : '无照片凭证';
    const recheckText = receiptSummary.needsRecheck ? '需复核' : '无需复核';
    return `${receiptSummary.latestResultLabel}，${evidenceText}，${recheckText}`;
}
export function buildPickupPrintVersionSummary(printVersion) {
    const latestText = printVersion.isLatestVersion ? '当前最新版本' : '历史版本';
    return `${printVersion.printVersionNo} · ${printVersion.printedAt} · 打印 ${printVersion.printCopyCount} 份 · ${latestText}`;
}
export function buildPickupQrBindingSummary(binding) {
    return `${pickupScenarioTypeLabels[binding.scenarioType]} / ${pickupBoundObjectTypeLabels[binding.boundObjectType]} / ${binding.qrCodeValue}`;
}
export function hasPickupDiscrepancy(input) {
    if ('hasDiscrepancy' in input)
        return input.hasDiscrepancy;
    if ('needsRecheck' in input)
        return input.needsRecheck;
    return input.resultStatus === 'RECHECK_REQUIRED' || input.resultStatus === 'PHOTO_SUBMITTED';
}
export function needsPickupRecheck(input) {
    if ('needsRecheck' in input)
        return input.needsRecheck;
    return input.latestScanResult === 'RECHECK_REQUIRED' || input.latestScanResult === 'PHOTO_SUBMITTED';
}
export function buildPickupScenarioDifferenceSummary(input) {
    return {
        ...input,
        summaryText: `${pickupScenarioTypeLabels[input.scenarioType]}以${pickupBoundObjectTypeLabels[input.boundObjectType]}为主对象，二维码语义为“${input.qrMeaning}”，差异处理为“${input.discrepancySupport}”，后续动作为“${input.followUpActions}”。`,
    };
}
