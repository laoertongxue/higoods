import { listCuttingProductionOrdersWithFormalTechPack, listGeneratedCutOrderSourceRecords, } from './generated-cut-orders.ts';
export function normalizeMarkerPlanRefId(markerPlanNo) {
    return markerPlanNo.trim() ? `marker-plan-ref:${markerPlanNo.trim()}` : '';
}
export function listCuttingProductionOrderSourceRecords() {
    const productionOrderIdsWithCutOrders = new Set(listGeneratedCutOrderSourceRecords().map((record) => record.productionOrderId));
    return listCuttingProductionOrdersWithFormalTechPack()
        .filter((order) => productionOrderIdsWithCutOrders.has(order.productionOrderId))
        .map((order) => ({
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
    }));
}
export function listCutOrderSourceRecords() {
    return listGeneratedCutOrderSourceRecords();
}
