import { productionOrders } from '../production-orders.ts';
import { listGeneratedProductionDemandArtifacts } from '../production-artifact-generation.ts';
import { listProgressExceptions, listProgressFacts, listProgressMaterialStatementDrafts, } from '../store-domain-progress.ts';
import { listExecutionTaskFacts } from './task-execution-adapter.ts';
function resolveOrderFactoryId(orderId) {
    const order = productionOrders.find((item) => item.productionOrderId === orderId);
    return order?.mainFactoryId;
}
function toLegacyQcResult(exception) {
    if (exception.reasonCode === 'MATERIAL_QTY_SHORT'
        || exception.reasonCode === 'HANDOUT_DIFF'
        || exception.reasonCode === 'HANDOUT_PENDING_CHECK') {
        return 'FAIL';
    }
    return 'PASS';
}
export function listLegacyLikeProcessTasksForTailPages() {
    return listExecutionTaskFacts().filter((task) => task.defaultDocType !== 'DEMAND');
}
export function listLegacyLikeExceptionsForTailPages() {
    return listProgressExceptions();
}
export function listLegacyLikeQualityInspectionsForTailPages() {
    return listProgressExceptions()
        .map((exception) => {
        const productionOrderId = exception.relatedOrderIds[0] ?? '';
        const status = exception.caseStatus === 'CLOSED' ? 'CLOSED' : 'SUBMITTED';
        const liabilityStatus = exception.caseStatus === 'IN_PROGRESS'
            ? 'DISPUTED'
            : exception.caseStatus === 'RESOLVED' || exception.caseStatus === 'CLOSED'
                ? 'CONFIRMED'
                : 'DRAFT';
        return {
            qcId: `QC-${exception.caseId}`,
            productionOrderId,
            status,
            liabilityStatus,
            result: toLegacyQcResult(exception),
            createdAt: exception.createdAt,
            updatedAt: exception.updatedAt ?? exception.createdAt,
        };
    })
        .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
}
export function listLegacyLikeDeductionBasisForTailPages() {
    return listLegacyLikeQualityInspectionsForTailPages().map((qc) => {
        const factoryId = resolveOrderFactoryId(qc.productionOrderId);
        const status = qc.liabilityStatus === 'DISPUTED'
            ? 'DISPUTED'
            : qc.liabilityStatus === 'CONFIRMED'
                ? 'CONFIRMED'
                : 'DRAFT';
        const settlementReady = status === 'CONFIRMED';
        return {
            basisId: `BAS-${qc.qcId}`,
            status,
            settlementReady,
            settlementFreezeReason: status === 'DISPUTED' ? '争议冻结，待仲裁结论' : undefined,
            sourceRefId: qc.qcId,
            sourceId: qc.qcId,
            factoryId,
            createdAt: qc.createdAt,
            updatedAt: qc.updatedAt ?? qc.createdAt,
        };
    });
}
export function listLegacyLikeDyePrintOrdersForTailPages() {
    const demandArtifacts = listGeneratedProductionDemandArtifacts()
        .filter((item) => item.processCode === 'PRINT' || item.processCode === 'DYE')
        .sort((a, b) => a.artifactId.localeCompare(b.artifactId));
    const exceptions = listProgressExceptions();
    return demandArtifacts.map((artifact) => {
        const orderId = artifact.orderId;
        const openMaterialException = exceptions.some((exception) => exception.caseStatus !== 'CLOSED'
            && exception.caseStatus !== 'RESOLVED'
            && exception.relatedOrderIds.includes(orderId)
            && (exception.reasonCode === 'MATERIAL_NOT_READY'
                || exception.reasonCode === 'MATERIAL_PREP_PENDING'
                || exception.reasonCode === 'MATERIAL_QTY_SHORT'));
        const handoutDiffCount = exceptions.filter((exception) => exception.relatedOrderIds.includes(orderId)
            && exception.reasonCode === 'HANDOUT_DIFF'
            && exception.caseStatus !== 'CLOSED').length;
        const availableQty = openMaterialException ? 0 : Math.max(artifact.orderQty, 0);
        const returnedFailQty = handoutDiffCount * 10;
        return {
            dpId: `DPO-${artifact.orderId}-${artifact.processCode}`,
            productionOrderId: artifact.orderId,
            processorFactoryId: resolveOrderFactoryId(orderId),
            availableQty,
            returnedFailQty,
            returnBatches: [{ batchId: `RTB-${artifact.artifactId}` }],
        };
    });
}
export function listLegacyLikeStatementDraftsForTailPages() {
    return listProgressMaterialStatementDrafts().map((draft) => ({
        statementId: draft.materialStatementId,
        status: draft.status,
        itemBasisIds: draft.items.map((item) => `BAS-${item.taskId}`),
        totalAmount: draft.totalIssuedQty * 12 + draft.totalRequestedQty * 3,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt ?? draft.createdAt,
    }));
}
export function listLegacyLikeSettlementBatchesForTailPages() {
    return listLegacyLikeStatementDraftsForTailPages()
        .filter((statement) => statement.status === 'CONFIRMED' || statement.status === 'CLOSED')
        .map((statement, index) => ({
        batchId: `STB-${String(index + 1).padStart(3, '0')}`,
        status: statement.status === 'CLOSED' ? 'COMPLETED' : 'PROCESSING',
        totalAmount: statement.totalAmount,
        createdAt: statement.createdAt,
        updatedAt: statement.updatedAt,
    }));
}
export function getTailPageTaskFactsByOrder(orderId) {
    return listProgressFacts().filter((fact) => fact.productionOrderId === orderId);
}
