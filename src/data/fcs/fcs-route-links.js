import { buildLegacyTaskRouteCardPrintLink, buildUnifiedPrintPreviewLink, } from './print-service.ts';
function encodeSegment(value) {
    return encodeURIComponent(value);
}
export function buildProductionOrderLink(productionOrderId) {
    return `/fcs/production/orders/${encodeSegment(productionOrderId)}`;
}
export function buildTaskDetailLink(taskId, options) {
    const params = new URLSearchParams();
    if (options?.returnTo?.trim())
        params.set('returnTo', options.returnTo.trim());
    if (options?.sourceType?.trim())
        params.set('sourceType', options.sourceType.trim());
    if (options?.sourceId?.trim())
        params.set('sourceId', options.sourceId.trim());
    if (options?.currentFactoryId?.trim())
        params.set('currentFactoryId', options.currentFactoryId.trim());
    if (options?.keyword?.trim())
        params.set('keyword', options.keyword.trim());
    if (options?.tab?.trim())
        params.set('tab', options.tab.trim());
    const query = params.toString();
    return query ? `/fcs/pda/exec/${encodeSegment(taskId)}?${query}` : `/fcs/pda/exec/${encodeSegment(taskId)}`;
}
export function buildHandoverOrderLink(handoverOrderId) {
    return `/fcs/pda/handover/${encodeSegment(handoverOrderId)}`;
}
export function buildHandoverRecordLink(handoverOrderId, handoverRecordId) {
    return `${buildHandoverOrderLink(handoverOrderId)}?recordId=${encodeSegment(handoverRecordId)}`;
}
export function buildQualityRecordLink(inspectionId) {
    return `/fcs/quality/qc-records/${encodeSegment(inspectionId)}`;
}
export function buildProductionConfirmationLink(productionOrderId) {
    return `${buildProductionOrderLink(productionOrderId)}/confirmation-print`;
}
export function buildProductionConfirmationPrintLink(productionOrderId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'PRODUCTION_CONFIRMATION',
        sourceType: 'PRODUCTION_ORDER',
        sourceId: productionOrderId,
    });
}
export function buildTaskRouteCardPrintLink(sourceType, sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'TASK_ROUTE_CARD',
        sourceType,
        sourceId,
    });
}
export { buildLegacyTaskRouteCardPrintLink };
export function buildUnifiedPrintPreviewRouteLink(input) {
    return buildUnifiedPrintPreviewLink(input);
}
export function buildTaskDeliveryCardPrintLink(handoverRecordId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'TASK_DELIVERY_CARD',
        sourceType: 'HANDOVER_RECORD',
        sourceId: handoverRecordId,
        handoverRecordId,
    });
}
export function buildMaterialPrepSlipPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'MATERIAL_PREP_SLIP',
        sourceType: 'MATERIAL_PREP_RECORD',
        sourceId,
    });
}
export function buildPickupSlipPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'PICKUP_SLIP',
        sourceType: 'PICKUP_SLIP_RECORD',
        sourceId,
    });
}
export function buildIssueSlipPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'ISSUE_SLIP',
        sourceType: 'ISSUE_SLIP_RECORD',
        sourceId,
    });
}
export function buildSupplementMaterialSlipPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'SUPPLEMENT_MATERIAL_SLIP',
        sourceType: 'SUPPLEMENT_MATERIAL_RECORD',
        sourceId,
    });
}
export function buildFeiTicketLabelPrintLink(sourceId, mode = 'first') {
    const documentType = mode === 'reprint' ? 'FEI_TICKET_REPRINT_LABEL' : mode === 'void' ? 'FEI_TICKET_VOID_LABEL' : 'FEI_TICKET_LABEL';
    return buildUnifiedPrintPreviewLink({
        documentType,
        sourceType: 'FEI_TICKET_RECORD',
        sourceId,
    });
}
export function buildTransferBagLabelPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'TRANSFER_BAG_LABEL',
        sourceType: 'TRANSFER_BAG_RECORD',
        sourceId,
    });
}
export function buildCuttingOrderQrLabelPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'CUTTING_ORDER_QR_LABEL',
        sourceType: 'CUTTING_ORDER_RECORD',
        sourceId,
    });
}
export function buildHandoverQrLabelPrintLink(handoverRecordId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'HANDOVER_QR_LABEL',
        sourceType: 'HANDOVER_RECORD',
        sourceId: handoverRecordId,
    });
}
export function buildSettlementChangeRequestPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'SETTLEMENT_CHANGE_REQUEST',
        sourceType: 'SETTLEMENT_CHANGE_REQUEST_RECORD',
        sourceId,
    });
}
export function buildHandoverDifferenceRequestPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'HANDOVER_DIFFERENCE_REQUEST',
        sourceType: 'HANDOVER_DIFFERENCE_RECORD',
        sourceId,
    });
}
export function buildQualityDeductionConfirmationPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'QUALITY_DEDUCTION_CONFIRMATION',
        sourceType: 'QUALITY_DEDUCTION_PENDING_RECORD',
        sourceId,
    });
}
export function buildQualityDisputeProcessingPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'QUALITY_DISPUTE_PROCESSING',
        sourceType: 'QUALITY_DISPUTE_RECORD',
        sourceId,
    });
}
export function buildMasterDataChangeRequestPrintLink(sourceId) {
    return buildUnifiedPrintPreviewLink({
        documentType: 'MASTER_DATA_CHANGE_REQUEST',
        sourceType: 'MASTER_DATA_CHANGE_REQUEST_RECORD',
        sourceId,
    });
}
export function buildPrintingOrderLink(printOrderId) {
    return `/fcs/craft/printing/work-orders?printOrderId=${encodeSegment(printOrderId)}`;
}
export function buildPrintingWorkOrderDetailLink(printOrderId) {
    return `/fcs/craft/printing/work-orders/${encodeSegment(printOrderId)}`;
}
export function buildDyeingOrderLink(dyeOrderId) {
    return `/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeSegment(dyeOrderId)}`;
}
export function buildDyeingWorkOrderDetailLink(dyeOrderId) {
    return `/fcs/craft/dyeing/work-orders/${encodeSegment(dyeOrderId)}`;
}
export function buildWoolWorkOrdersLink(woolOrderId) {
    const base = '/fcs/craft/wool/work-orders';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildWoolWorkOrderDetailLink(woolOrderId, tab) {
    const base = `/fcs/craft/wool/work-orders/${encodeSegment(woolOrderId)}`;
    return tab ? `${base}?tab=${encodeSegment(tab)}` : base;
}
export function buildPostFinishingTaskLink(postTaskId) {
    const base = '/fcs/craft/post-finishing/tasks';
    return postTaskId ? `${base}?taskId=${encodeSegment(postTaskId)}` : base;
}
export function buildWoolWaitProcessWarehouseLink(woolOrderId) {
    const base = '/fcs/craft/wool/wait-process-warehouse';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildWoolWaitHandoverWarehouseLink(woolOrderId) {
    const base = '/fcs/craft/wool/wait-handover-warehouse';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildWoolFeiTicketsLink(woolOrderId) {
    const base = '/fcs/craft/wool/fei-tickets';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildWoolMachineScheduleLink(woolOrderId) {
    const base = '/fcs/craft/wool/machine-schedule';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildWoolMachinesLink(machineNo) {
    const base = '/fcs/craft/wool/machines';
    return machineNo ? `${base}?machineNo=${encodeSegment(machineNo)}` : base;
}
export function buildWoolStatisticsLink(woolOrderId) {
    const base = '/fcs/craft/wool/statistics';
    return woolOrderId ? `${base}?woolOrderId=${encodeSegment(woolOrderId)}` : base;
}
export function buildPostFinishingWorkOrderDetailLink(postOrderId, tab) {
    const base = `/fcs/craft/post-finishing/work-orders/${encodeSegment(postOrderId)}`;
    return tab ? `${base}?tab=${encodeSegment(tab)}` : base;
}
export function buildPostFinishingRecheckOrderDetailLink(recheckOrderId) {
    return `/fcs/craft/post-finishing/recheck-orders/${encodeSegment(recheckOrderId)}`;
}
export function buildPostFinishingWaitProcessWarehouseLink(postOrderId) {
    const base = '/fcs/craft/post-finishing/wait-process-warehouse';
    return postOrderId ? `${base}?postOrderId=${encodeSegment(postOrderId)}` : base;
}
export function buildPostFinishingWaitHandoverWarehouseLink(postOrderId) {
    const base = '/fcs/craft/post-finishing/wait-handover-warehouse';
    return postOrderId ? `${base}?postOrderId=${encodeSegment(postOrderId)}` : base;
}
export function buildCutOrderLink(cutOrderId) {
    return `/fcs/craft/cutting/cut-orders?cutOrderId=${encodeSegment(cutOrderId)}`;
}
export function buildMaterialPrepLink(cutOrderId) {
    return `/fcs/craft/cutting/warehouse-management/wait-process?cutOrderId=${encodeSegment(cutOrderId)}`;
}
export function buildFeiTicketLink(feiTicketId) {
    return `/fcs/craft/cutting/fei-tickets?feiTicketId=${encodeSegment(feiTicketId)}`;
}
export function buildTransferBagLink(transferBagId) {
    return `/fcs/craft/cutting/transfer-bags?transferBagId=${encodeSegment(transferBagId)}`;
}
export function buildReplenishmentLink(replenishmentId) {
    return `/fcs/craft/cutting/replenishment?replenishmentId=${encodeSegment(replenishmentId)}`;
}
export function buildCapacityProfileLink(factoryId) {
    return `/fcs/factories/capacity-profile?factoryId=${encodeSegment(factoryId)}`;
}
