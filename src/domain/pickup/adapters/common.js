import { buildPickupEvidenceSummary, buildPickupReceiptSummary } from '../helpers';
export function buildCommonPickupSlip(seed, scanRecords, evidences) {
    return {
        pickupSlipNo: seed.pickupSlipNo,
        scenarioType: 'COMMON',
        sourceTaskType: seed.task.taskType,
        sourceTaskNo: seed.task.taskNo,
        productionOrderNo: seed.task.productionOrderId,
        boundObjectType: 'TASK',
        boundObjectNo: seed.task.taskNo,
        factoryType: seed.task.factoryType,
        factoryName: seed.task.assignedFactoryName,
        materialSku: seed.materialSku,
        materialType: seed.materialType,
        plannedQtySummary: seed.plannedQtySummary,
        configuredQtySummary: seed.configuredQtySummary,
        receivedQtySummary: seed.receivedQtySummary,
        currentStatus: seed.currentStatus,
        latestPrintVersionNo: seed.latestPrintVersionNo,
        latestQrCodeValue: seed.latestQrCodeValue,
        latestScanResult: seed.latestScanResult,
        hasDiscrepancy: seed.latestScanResult === 'RECHECK_REQUIRED' || seed.latestScanResult === 'PHOTO_SUBMITTED',
        evidenceSummary: buildPickupEvidenceSummary(evidences),
        createdAt: seed.createdAt,
        updatedAt: seed.updatedAt,
    };
}
export function buildCommonQrBinding(seed, generatedBy) {
    return {
        qrCodeValue: seed.latestQrCodeValue,
        boundObjectType: 'TASK',
        boundObjectNo: seed.task.taskNo,
        scenarioType: 'COMMON',
        reusePolicy: 'REUSE_BY_BOUND_OBJECT',
        generatedAt: seed.createdAt,
        generatedBy,
        status: 'ACTIVE',
        latestPrintVersionNo: seed.latestPrintVersionNo,
    };
}
export function buildCommonScanSummary(seed, scanRecords, evidences) {
    return buildPickupReceiptSummary(seed.pickupSlipNo, scanRecords, evidences);
}
