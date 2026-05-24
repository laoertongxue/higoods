import { listProcessWorkOrders } from './process-work-order-domain.ts';
import { listProcessHandoverDifferenceRecords, listProcessHandoverRecords, listProcessWarehouseReviewRecords, listWaitHandoverWarehouseRecords, listWaitProcessWarehouseRecords, } from './process-warehouse-domain.ts';
import { listPostFinishingActionRecords, listPostFinishingQcOrders, listPostFinishingRecheckOrders, listPostFinishingTasks, listPostFinishingWorkOrders, } from './post-finishing-domain.ts';
import { listDyeVatSchedules } from './dyeing-task-domain.ts';
function round(value) {
    return Math.round(value * 100) / 100;
}
function parseTime(value) {
    if (!value)
        return 0;
    const timestamp = new Date(value.replace(' ', 'T')).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}
function durationHours(start, end) {
    const startAt = parseTime(start);
    const endAt = parseTime(end);
    if (!startAt || !endAt || endAt < startAt)
        return 0;
    return (endAt - startAt) / 1000 / 60 / 60;
}
function matchTimeRange(value, range) {
    if (!range || range === '30D')
        return true;
    const timestamp = parseTime(value);
    if (!timestamp)
        return true;
    const now = Date.now();
    const limit = range === 'TODAY' ? 1 : 7;
    return now - timestamp <= limit * 24 * 60 * 60 * 1000;
}
function getNodeQty(node) {
    const input = node;
    return Number(input.actualCompletedQty ?? input.outputQty ?? input.usedMaterialQty ?? 0);
}
function filterProcessOrders(type, filter = {}) {
    return listProcessWorkOrders(type).filter((order) => (!filter.workOrderId || order.workOrderId === filter.workOrderId)
        && (!filter.factoryId || order.factoryId === filter.factoryId)
        && matchTimeRange(order.updatedAt || order.createdAt, filter.timeRange));
}
function filterWarehouseRecords(craftType, filter = {}) {
    const base = {
        craftType,
        craftName: filter.craftName,
        sourceWorkOrderId: filter.workOrderId,
        targetFactoryId: filter.factoryId,
    };
    return {
        waitProcess: listWaitProcessWarehouseRecords(base).filter((record) => matchTimeRange(record.updatedAt || record.createdAt, filter.timeRange)),
        waitHandover: listWaitHandoverWarehouseRecords(base).filter((record) => matchTimeRange(record.updatedAt || record.createdAt, filter.timeRange)),
        handovers: listProcessHandoverRecords({
            craftType,
            craftName: filter.craftName,
            sourceWorkOrderId: filter.workOrderId,
        }).filter((record) => (!filter.factoryId || record.handoverFactoryId === filter.factoryId) && matchTimeRange(record.handoverAt, filter.timeRange)),
        differences: listProcessHandoverDifferenceRecords({
            craftType,
            craftName: filter.craftName,
            sourceWorkOrderId: filter.workOrderId,
        }).filter((record) => matchTimeRange(record.reportedAt, filter.timeRange)),
        reviews: listProcessWarehouseReviewRecords({
            craftType,
            craftName: filter.craftName,
            sourceWorkOrderId: filter.workOrderId,
        }).filter((record) => matchTimeRange(record.reviewedAt, filter.timeRange)),
    };
}
export function sumWarehouseQty(records, objectType, qtyField) {
    return round(records
        .filter((record) => !objectType || record.objectType === objectType)
        .reduce((sum, record) => sum + Number(record[qtyField] || 0), 0));
}
export function sumHandoverQty(records, objectType, qtyField) {
    return round(records
        .filter((record) => !objectType || record.objectType === objectType)
        .reduce((sum, record) => sum + Math.abs(Number(record[qtyField] || 0)), 0));
}
export function countByStatus(records) {
    return records.reduce((result, record) => {
        const key = record.statusLabel || record.currentStatus || record.reviewStatus || record.status || '未标记';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}
export function countByCraftType(records) {
    return records.reduce((result, record) => {
        const key = record.craftType || '未标记';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}
export function countByFactory(records) {
    return records.reduce((result, record) => {
        const key = record.factoryName || record.targetFactoryName || record.handoverFactoryName || record.factoryId || record.targetFactoryId || record.handoverFactoryId || '未标记工厂';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}
export function countByCurrentAction(records) {
    return records.reduce((result, record) => {
        const key = record.currentActionName || '未标记动作';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}
export function calcDiffRate(expectedQty, actualQty) {
    if (!expectedQty)
        return 0;
    return round(Math.abs(expectedQty - actualQty) / expectedQty * 100);
}
export function calcCompletionRate(doneQty, plannedQty) {
    if (!plannedQty)
        return 0;
    return round(doneQty / plannedQty * 100);
}
export function calcAverageDuration(nodes) {
    const durations = nodes.map((node) => durationHours(node.startedAt, node.finishedAt)).filter((value) => value > 0);
    if (!durations.length)
        return 0;
    return round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}
export function calcOverdueCount(records, hours = 48) {
    const now = Date.now();
    return records.filter((record) => {
        if (record.status === '已回写' || record.status === '已关闭')
            return false;
        const startAt = parseTime(record.handoverAt || record.inboundAt || record.updatedAt || record.createdAt);
        return startAt > 0 && now - startAt > hours * 60 * 60 * 1000;
    }).length;
}
function statusRows(counts) {
    return Object.entries(counts).map(([label, count]) => ({ label, count }));
}
function buildFactoryRows(orders, handovers, differences) {
    const rows = new Map();
    orders.forEach((order) => {
        const existing = rows.get(order.factoryId) || {
            factoryId: order.factoryId,
            factoryName: order.factoryName,
            workOrderCount: 0,
            plannedQty: 0,
            doneQty: 0,
            handoverQty: 0,
            diffQty: 0,
            completionRate: 0,
        };
        existing.workOrderCount += 1;
        existing.plannedQty += order.plannedQty;
        order.executionNodes.forEach((node) => {
            existing.doneQty += getNodeQty(node);
        });
        rows.set(order.factoryId, existing);
    });
    handovers.forEach((record) => {
        const existing = rows.get(record.handoverFactoryId) || {
            factoryId: record.handoverFactoryId,
            factoryName: record.handoverFactoryName,
            workOrderCount: 0,
            plannedQty: 0,
            doneQty: 0,
            handoverQty: 0,
            diffQty: 0,
            completionRate: 0,
        };
        existing.handoverQty += record.handoverObjectQty;
        rows.set(record.handoverFactoryId, existing);
    });
    differences.forEach((record) => {
        const order = orders.find((item) => item.workOrderId === record.sourceWorkOrderId);
        const factoryId = order?.factoryId || record.sourceWorkOrderId;
        const existing = rows.get(factoryId) || {
            factoryId,
            factoryName: order?.factoryName || record.craftName,
            workOrderCount: 0,
            plannedQty: 0,
            doneQty: 0,
            handoverQty: 0,
            diffQty: 0,
            completionRate: 0,
        };
        existing.diffQty += Math.abs(record.diffObjectQty);
        rows.set(factoryId, existing);
    });
    return Array.from(rows.values()).map((row) => ({
        ...row,
        plannedQty: round(row.plannedQty),
        doneQty: round(row.doneQty),
        handoverQty: round(row.handoverQty),
        diffQty: round(row.diffQty),
        completionRate: calcCompletionRate(row.doneQty, row.plannedQty),
    }));
}
function buildBaseStatistics(orders, records) {
    const handovers = records.handovers;
    const reviews = records.reviews;
    const differences = records.differences;
    return {
        workOrderCount: orders.length,
        statusCounts: countByStatus(orders),
        statusRows: statusRows(countByStatus(orders)),
        factoryRows: buildFactoryRows(orders, handovers, differences),
        waitProcessRecordCount: records.waitProcess.length,
        waitHandoverRecordCount: records.waitHandover.length,
        partialHandoverRecordCount: records.waitHandover.filter((record) => record.status === '已部分交出').length,
        waitWritebackHandoverCount: handovers.filter((record) => record.status === '待回写').length,
        writtenBackHandoverCount: handovers.filter((record) => record.status === '已回写').length,
        differenceHandoverCount: handovers.filter((record) => ['有差异', '平台处理中', '需重新交出'].includes(record.status)).length,
        differenceRecordCount: differences.length,
        pendingDifferenceRecordCount: differences.filter((record) => record.status === '待处理' || record.status === '处理中').length,
        reworkDifferenceRecordCount: differences.filter((record) => record.status === '需重新交出').length,
        platformProcessingDifferenceRecordCount: differences.filter((record) => record.status === '处理中').length,
        waitReviewCount: reviews.filter((record) => record.reviewStatus === '待审核' || record.reviewStatus === '数量差异').length,
        reviewPassCount: reviews.filter((record) => record.reviewStatus === '审核通过').length,
        reviewRejectCount: reviews.filter((record) => record.reviewStatus === '审核驳回').length,
        handoverAverageWritebackHours: calcAverageDuration(handovers.map((record) => ({ startedAt: record.handoverAt, finishedAt: record.receiveAt }))),
        overdueWritebackCount: calcOverdueCount(handovers.filter((record) => record.status === '待回写')),
    };
}
function nodeQty(orders, nodeNames, qtyKeys = ['outputQty', 'actualCompletedQty'], nodeCodes = []) {
    return round(orders.reduce((sum, order) => sum + order.executionNodes
        .filter((node) => nodeNames.includes(node.nodeName) || nodeCodes.includes(String(node.nodeCode || '')))
        .reduce((nodeSum, node) => {
        const item = node;
        const qty = qtyKeys.map((key) => item[key]).find((value) => typeof value === 'number');
        return nodeSum + Number(qty || 0);
    }, 0), 0));
}
function averageNodeHours(orders, nodeNames, nodeCodes = []) {
    return calcAverageDuration(orders.flatMap((order) => order.executionNodes.filter((node) => nodeNames.includes(node.nodeName) || nodeCodes.includes(String(node.nodeCode || '')))));
}
export function getPrintingExecutionStatistics(filter = {}) {
    const orders = filterProcessOrders('PRINT', filter);
    const records = filterWarehouseRecords('PRINT', filter);
    const base = buildBaseStatistics(orders, records);
    return {
        ...base,
        plannedPrintFabricMeters: round(orders.reduce((sum, order) => sum + order.plannedQty, 0)),
        printCompletedFabricMeters: nodeQty(orders, ['打印']),
        transferCompletedFabricMeters: nodeQty(orders, ['转印'], ['actualCompletedQty', 'outputQty']),
        waitProcessFabricMeters: sumWarehouseQty(records.waitProcess, '面料', 'availableObjectQty'),
        waitHandoverFabricMeters: sumWarehouseQty(records.waitHandover, '面料', 'availableObjectQty'),
        handedOverFabricMeters: sumHandoverQty(records.handovers, '面料', 'handoverObjectQty'),
        receivedFabricMeters: sumHandoverQty(records.handovers, '面料', 'receiveObjectQty'),
        diffFabricMeters: sumHandoverQty(records.handovers, '面料', 'diffObjectQty'),
        usedMaterialMeters: nodeQty(orders, ['转印'], ['usedMaterialQty']),
        printAverageHours: averageNodeHours(orders, ['打印']),
        transferAverageHours: averageNodeHours(orders, ['转印']),
    };
}
export function getPrintingDashboardMetrics(filter = {}) {
    const statistics = getPrintingExecutionStatistics(filter);
    return {
        statistics,
        statusRows: statistics.statusRows,
        factoryRows: statistics.factoryRows,
    };
}
export function getDyeingExecutionStatistics(filter = {}) {
    const orders = filterProcessOrders('DYE', filter);
    const records = filterWarehouseRecords('DYE', filter);
    const base = buildBaseStatistics(orders, records);
    const schedules = listDyeVatSchedules().filter((schedule) => orders.some((order) => order.workOrderId === schedule.dyeOrderId));
    return {
        ...base,
        plannedDyeFabricMeters: round(orders.reduce((sum, order) => sum + order.plannedQty, 0)),
        materialReadyFabricMeters: nodeQty(orders, ['备料']),
        dyeCompletedFabricMeters: nodeQty(orders, ['染色']),
        finalPackedFabricMeters: nodeQty(orders, [], ['outputQty', 'actualCompletedQty'], ['PACK']),
        waitProcessFabricMeters: sumWarehouseQty(records.waitProcess, '面料', 'availableObjectQty'),
        waitHandoverFabricMeters: sumWarehouseQty(records.waitHandover, '面料', 'availableObjectQty'),
        handedOverFabricMeters: sumHandoverQty(records.handovers, '面料', 'handoverObjectQty'),
        receivedFabricMeters: sumHandoverQty(records.handovers, '面料', 'receiveObjectQty'),
        diffFabricMeters: sumHandoverQty(records.handovers, '面料', 'diffObjectQty'),
        currentVatScheduleCount: schedules.filter((schedule) => schedule.status === 'PLANNED' || schedule.status === 'IN_USE').length,
        dyeAverageHours: averageNodeHours(orders, ['染色']),
        dehydrateAverageHours: averageNodeHours(orders, ['脱水']),
        dryAverageHours: averageNodeHours(orders, ['烘干']),
        setAverageHours: averageNodeHours(orders, ['定型']),
        rollAverageHours: averageNodeHours(orders, ['打卷']),
        packAverageHours: averageNodeHours(orders, [], ['PACK']),
    };
}
export function getDyeingDashboardMetrics(filter = {}) {
    const statistics = getDyeingExecutionStatistics(filter);
    return {
        statistics,
        statusRows: statistics.statusRows,
        factoryRows: statistics.factoryRows,
    };
}
function actionRecordsHours(records) {
    return calcAverageDuration(records.filter((record) => record.startedAt && record.finishedAt));
}
function postTaskStatusCount(tasks, status) {
    return tasks.filter((task) => task.currentStatus === status).length;
}
export function getPostFinishingExecutionStatistics(filter = {}) {
    const postTasks = listPostFinishingTasks().filter((task) => (!filter.factoryId || task.managedPostFactoryId === filter.factoryId)
        && (!filter.workOrderId || task.postTaskId === filter.workOrderId || task.postTaskNo === filter.workOrderId || task.productionOrderNo === filter.workOrderId));
    const taskOrderNos = new Set(postTasks.map((task) => task.productionOrderNo));
    const taskIds = new Set(postTasks.map((task) => task.postTaskId));
    const postOrders = listPostFinishingWorkOrders().filter((order) => (!filter.factoryId || order.currentFactoryId === filter.factoryId || order.managedPostFactoryId === filter.factoryId)
        && (!filter.workOrderId || order.postOrderId === filter.workOrderId || order.postTaskId === filter.workOrderId || order.sourceProductionOrderNo === filter.workOrderId)
        && (taskOrderNos.size === 0 || taskOrderNos.has(order.sourceProductionOrderNo)));
    const records = filterWarehouseRecords('POST_FINISHING', filter);
    const base = buildBaseStatistics([], records);
    const qcRecords = listPostFinishingQcOrders().filter((record) => (record.warehouseAllocations?.some((allocation) => taskIds.has(String(allocation.postTaskId || '')))
        || postOrders.some((order) => order.postOrderId === record.postOrderId)));
    const recheckRecords = listPostFinishingRecheckOrders().filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId));
    const postRecords = listPostFinishingActionRecords('后道').filter((record) => postOrders.some((order) => order.postOrderId === record.postOrderId));
    const lessDifferences = records.differences.filter((record) => record.differenceType === '少收');
    const moreDifferences = records.differences.filter((record) => record.differenceType === '多收');
    const taskStatusCounts = countByStatus(postTasks);
    return {
        ...base,
        workOrderCount: postTasks.length,
        statusCounts: taskStatusCounts,
        statusRows: statusRows(taskStatusCounts),
        postOrderCount: postOrders.length,
        waitReceiveTaskCount: postTaskStatusCount(postTasks, '待收货') + postTaskStatusCount(postTasks, '待上游交出'),
        receiveDoneGarmentQty: round(postTasks.reduce((sum, task) => sum + task.receivedQty, 0)),
        receiveDiffGarmentQty: round(records.differences.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
        waitPostTaskCount: postTaskStatusCount(postTasks, '待后道'),
        postDoingTaskCount: postTaskStatusCount(postTasks, '后道中'),
        postDoneTaskCount: postTasks.filter((task) => task.postDoneQty > 0).length,
        waitQcTaskCount: postTaskStatusCount(postTasks, '待质检'),
        qcDoingTaskCount: postTaskStatusCount(postTasks, '质检中'),
        qcDoneTaskCount: postTasks.filter((task) => task.qcDoneQty > 0).length,
        waitRecheckTaskCount: postTaskStatusCount(postTasks, '待复检'),
        recheckDoingTaskCount: postTaskStatusCount(postTasks, '待复检'),
        recheckDoneTaskCount: postTasks.filter((task) => task.recheckDoneQty > 0).length,
        waitHandoverTaskCount: postTaskStatusCount(postTasks, '待交出'),
        handedOverTaskCount: postTasks.filter((task) => task.waitHandoverQty <= 0 && task.recheckDoneQty > 0).length,
        completedTaskCount: postTaskStatusCount(postTasks, '已完成'),
        waitPostGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitPostQty, 0)),
        postDoneGarmentQty: round(postTasks.reduce((sum, task) => sum + task.postDoneQty, 0)),
        waitQcGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitQcQty, 0)),
        qcPassGarmentQty: round(qcRecords.reduce((sum, record) => sum + record.acceptedGarmentQty, 0)),
        qcRejectedGarmentQty: round(qcRecords.reduce((sum, record) => sum + record.rejectedGarmentQty, 0)),
        waitRecheckGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitRecheckQty, 0)),
        recheckConfirmedGarmentQty: round(postTasks.reduce((sum, task) => sum + task.recheckDoneQty, 0)),
        waitHandoverGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitHandoverQty, 0)),
        handedOverGarmentQty: sumHandoverQty(records.handovers, '成衣', 'handoverObjectQty'),
        receivedGarmentQty: sumHandoverQty(records.handovers, '成衣', 'receiveObjectQty'),
        diffGarmentQty: sumHandoverQty(records.handovers, '成衣', 'diffObjectQty'),
        dedicatedTaskCount: postTasks.length,
        postFactoryExecutedTaskCount: postTasks.filter((task) => task.postOrderCount > 0).length,
        sewingFactoryPostDoneTaskCount: postTasks.filter((task) => task.postOrderCount === 0 && task.qcDoneQty > 0).length,
        dedicatedWaitQcGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitQcQty, 0)),
        dedicatedWaitRecheckGarmentQty: round(postTasks.reduce((sum, task) => sum + task.waitRecheckQty, 0)),
        transferWaitManagedFactoryTaskCount: 0,
        transferInWaitQcGarmentQty: 0,
        transferInWaitRecheckGarmentQty: 0,
        lessReceiveGarmentQty: round(lessDifferences.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
        moreReceiveGarmentQty: round(moreDifferences.reduce((sum, record) => sum + Math.abs(record.diffObjectQty), 0)),
        postAverageHours: actionRecordsHours(postRecords),
        qcAverageHours: actionRecordsHours(qcRecords),
        recheckAverageHours: actionRecordsHours(recheckRecords),
    };
}
export function getPostFinishingDashboardMetrics(filter = {}) {
    const statistics = getPostFinishingExecutionStatistics(filter);
    return {
        statistics,
        statusRows: statistics.statusRows,
        factoryRows: statistics.factoryRows,
    };
}
