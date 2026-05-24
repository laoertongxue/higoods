import { inferReturnInboundProcessTypeFromTask, resolveDefaultReturnInboundQcPolicy, } from './store-domain-quality-types';
import { findReturnInboundBatchForQc, isReturnInboundInspection, resolveReturnInboundTaskId, } from './return-inbound-workflow';
import { getPostExecutionModeLabel } from './post-process-route';
export const RETURN_INBOUND_PROCESS_LABEL = {
    PRINT: '印花',
    DYE: '染色',
    CUT_PANEL: '裁片',
    SEW: '车缝',
    OTHER: '其他',
    DYE_PRINT: '染印',
};
export const RETURN_INBOUND_QC_POLICY_LABEL = {
    REQUIRED: '必检',
    OPTIONAL: '可选',
    SKIPPED: '免检',
};
export const SEW_POST_PROCESS_MODE_LABEL = {
    SEW_FACTORY_INCLUDES_POST: '车缝厂含后道',
    MANAGED_POST_FACTORY_EXECUTES: '我方后道工厂执行后道',
};
export const INSPECTION_SCENE_LABEL = {
    SEW_RETURN_RECEIVING_QC: '回货质检',
    POST_FINAL_RECHECK: '后道复检',
    PRINT_RECEIVING_QC: '印花回货质检',
    DYE_RECEIVING_QC: '染色回货质检',
    CUT_PIECE_RECEIVING_QC: '裁片回货质检',
};
export const INSPECTION_TYPE_LABEL = {
    QC: '质检',
    RECHECK: '复检',
};
export const INSPECTION_METHOD_LABEL = {
    COUNT_ONLY: '数量复核',
    SAMPLING: '抽检',
    FULL_INSPECTION: '全检',
};
export const INSPECTION_NEXT_ACTION_LABEL = {
    ENTER_POST_PROCESS: '进入后道',
    ENTER_FINAL_RECHECK: '进入复检',
    HANDOVER_FINISHED_WAREHOUSE: '交成衣仓',
    REWORK: '返工',
    WAIT_EXCEPTION_HANDLE: '待处理',
};
function normalizeQty(value) {
    if (value === undefined || value === null)
        return null;
    if (!Number.isFinite(value))
        return null;
    return Math.max(0, Math.floor(value));
}
export function resolveQcInspectionSummary(qc, batch, task) {
    const defectQty = qc.defectItems.reduce((sum, item) => sum + item.qty, 0);
    const writebackQty = (qc.writebackAvailableQty ?? 0) +
        (qc.writebackAcceptedAsDefectQty ?? 0) +
        (qc.writebackScrapQty ?? 0);
    const inspectedQty = normalizeQty(qc.inspectedQty) ??
        normalizeQty(batch?.returnedQty) ??
        normalizeQty(task?.qty) ??
        normalizeQty(writebackQty > 0 ? writebackQty : undefined) ??
        normalizeQty(qc.affectedQty) ??
        normalizeQty(defectQty) ??
        0;
    let qualifiedQty = normalizeQty(qc.qualifiedQty);
    let unqualifiedQty = normalizeQty(qc.unqualifiedQty);
    if (qc.result === 'PASS') {
        qualifiedQty = inspectedQty;
        unqualifiedQty = 0;
    }
    else {
        const derivedUnqualifiedQty = unqualifiedQty ??
            normalizeQty(qc.affectedQty) ??
            normalizeQty(defectQty) ??
            normalizeQty((qc.writebackAcceptedAsDefectQty ?? 0) + (qc.writebackScrapQty ?? 0) > 0
                ? (qc.writebackAcceptedAsDefectQty ?? 0) + (qc.writebackScrapQty ?? 0)
                : undefined) ??
            inspectedQty;
        unqualifiedQty = Math.min(derivedUnqualifiedQty, inspectedQty);
        qualifiedQty = qualifiedQty ?? Math.max(inspectedQty - unqualifiedQty, 0);
    }
    const result = unqualifiedQty <= 0
        ? 'PASS'
        : qualifiedQty > 0
            ? 'PARTIAL_PASS'
            : 'FAIL';
    return {
        inspectedQty,
        qualifiedQty,
        unqualifiedQty,
        qualifiedRate: inspectedQty > 0 ? Math.round((qualifiedQty / inspectedQty) * 1000) / 10 : 0,
        unqualifiedRate: inspectedQty > 0 ? Math.round((unqualifiedQty / inspectedQty) * 1000) / 10 : 0,
        result,
    };
}
export function getReturnInboundBatchById(batches, batchId) {
    if (!batchId)
        return null;
    return batches.find((item) => item.batchId === batchId) ?? null;
}
function resolveProcessType(qc, batch, task) {
    if (qc.returnProcessType)
        return qc.returnProcessType;
    if (batch?.processType)
        return batch.processType;
    if (qc.sourceProcessType)
        return qc.sourceProcessType;
    if (task)
        return inferReturnInboundProcessTypeFromTask(task);
    return 'OTHER';
}
export function normalizeQcForView(qc, batches, tasks) {
    const inboundBatch = findReturnInboundBatchForQc(qc, batches);
    const resolvedTaskId = resolveReturnInboundTaskId(qc, inboundBatch) ?? '';
    const task = resolvedTaskId ? tasks.find((item) => item.taskId === resolvedTaskId) ?? null : null;
    const isInbound = isReturnInboundInspection(qc);
    const processType = resolveProcessType(qc, inboundBatch, task);
    const qcPolicy = qc.qcPolicy ?? inboundBatch?.qcPolicy ?? resolveDefaultReturnInboundQcPolicy(processType);
    const processLabel = processType === 'SEW' && (qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode)
        ? getPostExecutionModeLabel(qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode)
        : RETURN_INBOUND_PROCESS_LABEL[processType];
    const inspectionSummary = resolveQcInspectionSummary(qc, inboundBatch, task);
    const receiverName = qc.receiverName ?? inboundBatch?.receiverName ?? qc.warehouseName ?? inboundBatch?.warehouseName ?? '-';
    const inspectionSceneLabel = qc.inspectionScene && qc.inspectionScene !== 'RETURN_INBOUND' ? INSPECTION_SCENE_LABEL[qc.inspectionScene] : undefined;
    const inspectionTypeLabel = qc.inspectionType ? INSPECTION_TYPE_LABEL[qc.inspectionType] : undefined;
    const inspectionMethodLabel = qc.inspectionMethod ? INSPECTION_METHOD_LABEL[qc.inspectionMethod] : undefined;
    const nextActionLabel = qc.nextAction ? INSPECTION_NEXT_ACTION_LABEL[qc.nextAction] : undefined;
    return {
        qc,
        qcId: qc.qcId,
        isReturnInbound: isInbound,
        isLegacy: !isInbound,
        batchId: qc.returnBatchId ?? (qc.refType === 'RETURN_BATCH' ? qc.refId : inboundBatch?.batchId ?? ''),
        productionOrderId: qc.productionOrderId ?? inboundBatch?.productionOrderId ?? task?.productionOrderId ?? '-',
        sourceTaskId: resolvedTaskId,
        processType,
        processLabel,
        qcPolicy,
        returnFactoryId: qc.returnFactoryId ?? inboundBatch?.returnFactoryId ?? task?.assignedFactoryId ?? '',
        returnFactoryName: qc.returnFactoryName ?? inboundBatch?.returnFactoryName ?? task?.assignedFactoryName ?? '-',
        warehouseId: qc.warehouseId ?? inboundBatch?.warehouseId ?? '',
        warehouseName: qc.warehouseName ?? inboundBatch?.warehouseName ?? '-',
        receiverName,
        inboundAt: inboundBatch?.inboundAt ?? '-',
        inboundBy: inboundBatch?.inboundBy ?? '-',
        sewPostProcessMode: qc.sewPostProcessMode ?? inboundBatch?.sewPostProcessMode,
        inspectionSceneLabel,
        inspectionTypeLabel,
        inspectionMethodLabel,
        nextActionLabel,
        declaredQty: qc.declaredQty ?? inboundBatch?.submittedQty ?? inboundBatch?.returnedQty ?? inspectionSummary.inspectedQty,
        receivedQty: qc.receivedQty ?? inboundBatch?.receiverWrittenQty ?? inspectionSummary.inspectedQty,
        sourceBusinessType: qc.sourceBusinessType ?? inboundBatch?.sourceType ?? 'OTHER',
        sourceBusinessId: qc.sourceBusinessId ?? inboundBatch?.sourceId ?? '',
        inspector: qc.inspector,
        result: inspectionSummary.result,
        status: qc.status,
        disposition: qc.disposition,
        affectedQty: qc.affectedQty,
        inspectedQty: inspectionSummary.inspectedQty,
        qualifiedQty: inspectionSummary.qualifiedQty,
        unqualifiedQty: inspectionSummary.unqualifiedQty,
        qualifiedRate: inspectionSummary.qualifiedRate,
        unqualifiedRate: inspectionSummary.unqualifiedRate,
        inspectedAt: qc.inspectedAt,
    };
}
