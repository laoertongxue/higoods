import { listCuttingTaskRefs, listMarkerPlanRefRefs, listCutOrderRefs, listPdaExecutionRefs, listProductionOrderRefs, } from './repository.ts';
function buildExecutionKey(taskId, executionOrderNo) {
    return `${taskId}::${executionOrderNo}`;
}
function indexById(items, key) {
    return Object.fromEntries(items.map((item) => [item[key], item]));
}
let cachedRegistry = null;
export function buildCuttingCoreRegistry() {
    if (cachedRegistry)
        return cachedRegistry;
    const productionOrders = listProductionOrderRefs();
    const cutOrders = listCutOrderRefs();
    const markerPlanRefs = listMarkerPlanRefRefs();
    const cuttingTasks = listCuttingTaskRefs();
    const pdaExecutions = listPdaExecutionRefs();
    const pdaExecutionsByCutOrderId = {};
    pdaExecutions.forEach((record) => {
        const bucket = pdaExecutionsByCutOrderId[record.cutOrderId] ?? [];
        bucket.push(record);
        pdaExecutionsByCutOrderId[record.cutOrderId] = bucket;
    });
    cachedRegistry = {
        productionOrdersById: indexById(productionOrders, 'productionOrderId'),
        productionOrdersByNo: indexById(productionOrders, 'productionOrderNo'),
        cutOrdersById: indexById(cutOrders, 'cutOrderId'),
        cutOrdersByNo: indexById(cutOrders, 'cutOrderNo'),
        markerPlanRefsById: indexById(markerPlanRefs, 'markerPlanId'),
        markerPlanRefsByNo: indexById(markerPlanRefs, 'markerPlanNo'),
        cuttingTasksById: indexById(cuttingTasks, 'taskId'),
        cuttingTasksByNo: indexById(cuttingTasks, 'taskNo'),
        pdaExecutionsByTaskAndOrder: Object.fromEntries(pdaExecutions.map((record) => [buildExecutionKey(record.taskId, record.executionOrderNo), record])),
        pdaExecutionsByCutOrderId,
    };
    return cachedRegistry;
}
export function resetCuttingCoreRegistryCache() {
    cachedRegistry = null;
}
export function resolveProductionOrderRef(input) {
    const registry = buildCuttingCoreRegistry();
    if (input.productionOrderId && registry.productionOrdersById[input.productionOrderId])
        return registry.productionOrdersById[input.productionOrderId];
    if (input.productionOrderNo && registry.productionOrdersByNo[input.productionOrderNo])
        return registry.productionOrdersByNo[input.productionOrderNo];
    return null;
}
export function resolveCutOrderRef(input) {
    const registry = buildCuttingCoreRegistry();
    if (input.cutOrderId && registry.cutOrdersById[input.cutOrderId])
        return registry.cutOrdersById[input.cutOrderId];
    if (input.cutOrderNo && registry.cutOrdersByNo[input.cutOrderNo])
        return registry.cutOrdersByNo[input.cutOrderNo];
    return null;
}
export function resolveMarkerPlanRefRef(input) {
    const registry = buildCuttingCoreRegistry();
    if (input.markerPlanId && registry.markerPlanRefsById[input.markerPlanId])
        return registry.markerPlanRefsById[input.markerPlanId];
    if (input.markerPlanNo && registry.markerPlanRefsByNo[input.markerPlanNo])
        return registry.markerPlanRefsByNo[input.markerPlanNo];
    return null;
}
export function resolveCuttingTaskRef(input) {
    const registry = buildCuttingCoreRegistry();
    if (input.taskId && registry.cuttingTasksById[input.taskId])
        return registry.cuttingTasksById[input.taskId];
    if (input.taskNo && registry.cuttingTasksByNo[input.taskNo])
        return registry.cuttingTasksByNo[input.taskNo];
    return null;
}
export function resolvePdaExecutionRef(input) {
    const registry = buildCuttingCoreRegistry();
    const executionOrderNo = input.executionOrderNo
        || input.executionOrderId
        || input.legacyCutPieceOrderNo
        || input.cutPieceOrderNo
        || '';
    if (!executionOrderNo.trim())
        return null;
    return registry.pdaExecutionsByTaskAndOrder[buildExecutionKey(input.taskId, executionOrderNo)] ?? null;
}
export function listPdaExecutionsByTaskId(taskId) {
    const registry = buildCuttingCoreRegistry();
    return Object.values(registry.pdaExecutionsByTaskAndOrder).filter((item) => item.taskId === taskId);
}
export function listPdaExecutionsByCutOrderId(cutOrderId) {
    return [...(buildCuttingCoreRegistry().pdaExecutionsByCutOrderId[cutOrderId] ?? [])];
}
