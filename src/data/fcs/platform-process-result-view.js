import { TEST_FACTORY_DISPLAY_NAME, TEST_FACTORY_ID, TEST_FACTORY_NAME } from './factory-mock-data.ts';
import { buildDyeingWorkOrderDetailLink, buildPostFinishingWorkOrderDetailLink, buildPrintingWorkOrderDetailLink, buildTaskDetailLink, } from './fcs-route-links.ts';
import { listProcessWorkOrders, } from './process-work-order-domain.ts';
import { getPlatformStatusForProcessWorkOrder, listPlatformStatusOptions, mapCraftStatusToPlatformStatus, } from './process-platform-status-adapter.ts';
import { formatProcessQuantityWithUnit, getQuantityLabel, } from './process-quantity-labels.ts';
import { getDifferenceRecordsByWorkOrderId, getHandoverRecordsByWorkOrderId, getReviewRecordsByWorkOrderId, getWarehouseRecordsByWorkOrderId, listProcessHandoverDifferenceRecords, listProcessHandoverRecords, listProcessWarehouseRecords, listProcessWarehouseReviewRecords, } from './process-warehouse-domain.ts';
import { getProcessActionOperationRecordsBySource, getProcessActionOperationRecordsByTask, } from './process-action-writeback-service.ts';
import { cloneCutPieceOrderRecords } from './cutting/cut-piece-orders.ts';
import { listSpreadingResultGeneratedFeiTicketsByCutOrderId } from './cutting/generated-fei-tickets.ts';
import { buildSpecialCraftOperationSlug, getSpecialCraftOperationById, } from './special-craft-operations.ts';
import { listSpecialCraftTaskWorkOrders, } from './special-craft-task-orders.ts';
import { getPostFinishingFlowText, listPostFinishingWorkOrders, } from './post-finishing-domain.ts';
const STATUS_CODE_BY_LABEL = {
    待下发: 'WAIT_RELEASE',
    待接单: 'WAIT_ACCEPT',
    待开工: 'WAIT_START',
    准备中: 'PREPARING',
    加工中: 'PROCESSING',
    待交出: 'WAIT_DELIVERY',
    交出待收货: 'WAIT_WRITEBACK',
    收货确认中: 'RECEIPT_CONFIRMING',
    部分交出: 'PARTIAL_HANDOVER',
    全部交出: 'FULL_HANDOVER',
    收货差异: 'HANDOVER_DIFFERENCE',
    异常: 'EXCEPTION',
    已完成: 'COMPLETED',
    已关闭: 'CLOSED',
};
const PROCESS_NAME = {
    PRINT: '印花',
    DYE: '染色',
    CUTTING: '裁片',
    SPECIAL_CRAFT: '特殊工艺',
    POST_FINISHING: '后道',
};
function normalizeSourceType(value) {
    if (value === 'PRINT' || value === 'PRINTING_WORK_ORDER')
        return 'PRINT';
    if (value === 'DYE' || value === 'DYEING_WORK_ORDER')
        return 'DYE';
    if (value === 'CUTTING' || value === 'CUTTING_ORDER')
        return 'CUTTING';
    if (value === 'SPECIAL_CRAFT')
        return 'SPECIAL_CRAFT';
    if (value === 'POST_FINISHING' || value === 'POST_FINISHING_WORK_ORDER')
        return 'POST_FINISHING';
    return undefined;
}
function roundQty(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
function latestByTime(records, getTime) {
    return [...records].sort((left, right) => getTime(right).localeCompare(getTime(left), 'zh-CN'))[0];
}
function uniqueStrings(values) {
    return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}
function resolveFacts(sourceType, sourceId, taskId) {
    const processSourceType = sourceType;
    const byWorkOrder = {
        warehouses: getWarehouseRecordsByWorkOrderId(sourceId),
        handovers: getHandoverRecordsByWorkOrderId(sourceId),
        reviews: getReviewRecordsByWorkOrderId(sourceId),
        differences: getDifferenceRecordsByWorkOrderId(sourceId),
    };
    const byTask = taskId
        ? {
            warehouses: listProcessWarehouseRecords({ craftType: sourceType, sourceTaskId: taskId }),
            handovers: listProcessHandoverRecords({ craftType: sourceType }).filter((item) => item.sourceTaskId === taskId),
            reviews: listProcessWarehouseReviewRecords({ craftType: sourceType }).filter((item) => byWorkOrder.handovers.some((handover) => handover.handoverRecordId === item.handoverRecordId)),
            differences: listProcessHandoverDifferenceRecords({ craftType: sourceType }).filter((item) => byWorkOrder.handovers.some((handover) => handover.handoverRecordId === item.handoverRecordId)),
        }
        : { warehouses: [], handovers: [], reviews: [], differences: [] };
    return {
        warehouses: [...byWorkOrder.warehouses, ...byTask.warehouses].filter((record, index, list) => list.findIndex((item) => item.warehouseRecordId === record.warehouseRecordId) === index),
        handovers: [...byWorkOrder.handovers, ...byTask.handovers].filter((record, index, list) => list.findIndex((item) => item.handoverRecordId === record.handoverRecordId) === index),
        reviews: [...byWorkOrder.reviews, ...byTask.reviews].filter((record, index, list) => list.findIndex((item) => item.reviewRecordId === record.reviewRecordId) === index),
        differences: [...byWorkOrder.differences, ...byTask.differences].filter((record, index, list) => list.findIndex((item) => item.differenceRecordId === record.differenceRecordId) === index),
        operations: [
            ...getProcessActionOperationRecordsBySource(processSourceType, sourceId),
            ...(taskId ? getProcessActionOperationRecordsByTask(taskId) : []),
        ].filter((record, index, list) => list.findIndex((item) => item.operationRecordId === record.operationRecordId) === index),
    };
}
function hasOpenDifference(facts) {
    return facts.differences.some((record) => !['已关闭', '已确认差异'].includes(record.status))
        || facts.handovers.some((record) => Math.abs(Number(record.diffObjectQty || 0)) > 0 || ['有差异', '平台处理中', '需重新交出', '收货差异'].includes(record.status))
        || facts.reviews.some((record) => record.reviewStatus.includes('差异') || record.reviewStatus.includes('驳回'));
}
function hasPendingReceipt(facts) {
    return facts.handovers.some((record) => Number(record.handoverObjectQty || 0) > 0
        && Number(record.receiveObjectQty || 0) <= 0
        && !record.receiveAt);
}
function hasPendingReceiptConfirm(facts) {
    return facts.reviews.some((record) => !record.reviewedAt && !record.reviewStatus.includes('通过'));
}
function deriveStatusLabel(base, facts) {
    if (['待交出', '交出待收货', '部分交出', '全部交出', '收货差异'].includes(base))
        return base;
    if (hasOpenDifference(facts))
        return '收货差异';
    if (hasPendingReceipt(facts))
        return '交出待收货';
    if (hasPendingReceiptConfirm(facts))
        return '收货确认中';
    if (facts.warehouses.some((record) => record.recordType === 'WAIT_HANDOVER' && Number(record.availableObjectQty || record.plannedObjectQty || 0) > 0))
        return '待交出';
    return base;
}
function buildPlatformMeta(statusLabel, processType, internalStatus) {
    const mapped = mapCraftStatusToPlatformStatus({
        sourceType: 'PLATFORM_PROCESS_RESULT_VIEW',
        sourceId: `${processType}-${internalStatus}`,
        processType,
        craftStatusLabel: statusLabel,
        status: statusLabel,
    });
    if (statusLabel === '待交出') {
        return {
            ...mapped,
            platformRiskLabel: '工厂已完成加工，待交出',
            platformActionHint: '跟进工厂交出',
            platformOwnerHint: '工艺工厂',
        };
    }
    if (statusLabel === '交出待收货') {
        return {
            ...mapped,
            platformRiskLabel: '接收方尚未确认收货',
            platformActionHint: '跟进接收方确认收货',
            platformOwnerHint: '接收方 / 仓库',
        };
    }
    if (statusLabel === '收货确认中') {
        return {
            ...mapped,
            platformRiskLabel: '接收方正在确认收货数量',
            platformActionHint: '跟进收货确认',
            platformOwnerHint: '接收方 / 仓库',
        };
    }
    if (statusLabel === '部分交出') {
        return {
            ...mapped,
            platformRiskLabel: '接收方已确认部分收货',
            platformActionHint: '继续交出剩余数量',
            platformOwnerHint: '工艺工厂 / 接收方',
        };
    }
    if (statusLabel === '全部交出') {
        return {
            ...mapped,
            platformRiskLabel: '接收方已确认全部收货',
            platformActionHint: '查看交出和收货记录',
            platformOwnerHint: '平台',
        };
    }
    if (statusLabel === '收货差异') {
        return {
            ...mapped,
            platformRiskLabel: '交出数量与实收数量存在差异',
            platformActionHint: '处理收货差异',
            platformOwnerHint: '平台 / 接收方 / 工艺工厂',
        };
    }
    if (statusLabel === '异常') {
        return {
            ...mapped,
            platformRiskLabel: '存在异常，需要处理',
            platformActionHint: '处理异常',
            platformOwnerHint: '平台',
        };
    }
    if (statusLabel === '加工中') {
        return {
            ...mapped,
            platformRiskLabel: '工厂内部加工中',
            platformActionHint: '跟进加工进度',
            platformOwnerHint: '工艺工厂',
        };
    }
    return mapped;
}
function resolveFollowUp(statusLabel, hasHandoverRecord) {
    if (statusLabel === '待交出')
        return { code: 'FOLLOW_FACTORY_HANDOVER', label: '跟进工厂交出', canFollow: true };
    if (statusLabel === '交出待收货')
        return { code: 'FOLLOW_RECEIVER_RECEIPT', label: '跟进接收方确认收货', canFollow: true };
    if (statusLabel === '收货确认中')
        return { code: 'FOLLOW_RECEIPT_CONFIRM', label: '跟进收货确认', canFollow: true };
    if (statusLabel === '部分交出')
        return { code: 'FOLLOW_REMAINING_HANDOVER', label: '继续交出剩余数量', canFollow: true };
    if (statusLabel === '收货差异')
        return { code: 'PROCESS_RECEIPT_DIFFERENCE', label: '处理收货差异', canFollow: true };
    if (statusLabel === '异常')
        return { code: 'PROCESS_EXCEPTION', label: '处理异常', canFollow: true };
    if (statusLabel === '全部交出')
        return { code: hasHandoverRecord ? 'VIEW_HANDOVER_RECORD' : 'VIEW_DETAIL', label: hasHandoverRecord ? '查看交出记录' : '查看详情', canFollow: false };
    if (statusLabel === '已完成')
        return { code: hasHandoverRecord ? 'VIEW_HANDOVER_RECORD' : 'VIEW_DETAIL', label: hasHandoverRecord ? '查看交出记录' : '查看详情', canFollow: false };
    if (statusLabel === '已关闭')
        return { code: 'VIEW_DETAIL', label: '查看详情', canFollow: false };
    if (statusLabel === '准备中')
        return { code: 'FOLLOW_PREPARATION', label: '跟进工艺准备', canFollow: true };
    if (statusLabel === '加工中')
        return { code: 'FOLLOW_PROCESSING', label: '跟进加工进度', canFollow: true };
    return { code: 'VIEW_CRAFT_DETAIL', label: '查看工艺详情', canFollow: false };
}
function getQtyUnit(value) {
    if (value === '米' || value === '卷' || value === '片' || value === '件' || value === '张' || value === '包' || value === '箱' || value === '个')
        return value;
    return '个';
}
function quantityField(processType, sourceId, objectType, qtyUnit, qtyPurpose, value, options = {}) {
    const context = {
        processType,
        sourceType: processType,
        sourceId,
        objectType,
        qtyUnit,
        qtyPurpose,
        isPiecePrinting: options.isPiecePrinting,
        isFabricPrinting: options.isFabricPrinting,
    };
    const label = getQuantityLabel(context);
    return {
        label,
        value: roundQty(value),
        unit: qtyUnit,
        text: `${label}：${formatProcessQuantityWithUnit(value, context)}`,
    };
}
function buildQuantityFields(input) {
    return [
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '计划', input.plannedObjectQty, input),
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '已完成', input.completedObjectQty, input),
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '待交出', input.waitHandoverObjectQty, input),
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '已交出', input.handedOverObjectQty, input),
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '实收', input.writtenBackObjectQty, input),
        quantityField(input.processType, input.sourceId, input.objectType, input.qtyUnit, '差异', input.diffObjectQty, input),
    ];
}
function buildCommonResult(input) {
    const waitHandoverRecords = input.facts.warehouses.filter((record) => record.recordType === 'WAIT_HANDOVER');
    const waitProcessRecords = input.facts.warehouses.filter((record) => record.recordType === 'WAIT_PROCESS');
    const waitHandoverObjectQty = roundQty(waitHandoverRecords.reduce((sum, record) => sum + (record.availableObjectQty || record.plannedObjectQty || 0), 0));
    const handedOverObjectQty = roundQty(input.facts.handovers.reduce((sum, record) => sum + record.handoverObjectQty, 0));
    const writtenBackObjectQty = roundQty(input.facts.handovers.reduce((sum, record) => sum + record.receiveObjectQty, 0));
    const diffObjectQty = roundQty(Math.abs(input.facts.differences.reduce((sum, record) => sum + record.diffObjectQty, 0))
        || Math.abs(input.facts.handovers.reduce((sum, record) => sum + record.diffObjectQty, 0)));
    const completedObjectQty = roundQty(input.completedObjectQty ?? Math.max(waitHandoverObjectQty, handedOverObjectQty, writtenBackObjectQty, 0));
    const latestWarehouse = latestByTime(input.facts.warehouses, (record) => record.updatedAt || record.createdAt);
    const latestHandover = latestByTime(input.facts.handovers, (record) => record.receiveAt || record.handoverAt);
    const latestReview = latestByTime(input.facts.reviews, (record) => record.reviewedAt || record.reviewRecordNo);
    const latestDifference = latestByTime(input.facts.differences, (record) => record.handledAt || record.reportedAt);
    const latestOperation = latestByTime(input.facts.operations, (record) => record.operatedAt);
    const platformStatusLabel = deriveStatusLabel(input.baseStatusLabel, input.facts);
    const platformMeta = buildPlatformMeta(platformStatusLabel, input.sourceType, input.internalStatusLabel);
    const followUp = resolveFollowUp(platformStatusLabel, input.facts.handovers.length > 0);
    return {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        processType: input.sourceType,
        processName: input.processName || PROCESS_NAME[input.sourceType],
        workOrderNo: input.workOrderNo,
        productionOrderNo: input.productionOrderNo,
        factoryId: input.factoryId || TEST_FACTORY_ID,
        factoryName: input.factoryName || TEST_FACTORY_NAME,
        factoryDisplayName: `${input.factoryName || TEST_FACTORY_NAME}（${input.factoryId || TEST_FACTORY_ID}）`,
        assignmentMode: input.assignmentMode,
        dispatchPriceDisplay: input.dispatchPriceDisplay,
        platformStatusCode: STATUS_CODE_BY_LABEL[platformStatusLabel] || platformMeta.platformStatusCode,
        platformStatusLabel,
        factoryInternalStatusLabel: input.internalStatusLabel,
        platformRiskLevel: platformMeta.platformRiskLevel,
        platformRiskLabel: platformMeta.platformRiskLabel,
        platformActionHint: platformMeta.platformActionHint,
        platformOwnerHint: platformMeta.platformOwnerHint,
        objectType: input.objectType,
        plannedObjectQty: roundQty(input.plannedObjectQty),
        completedObjectQty,
        waitHandoverObjectQty,
        handedOverObjectQty,
        writtenBackObjectQty,
        diffObjectQty,
        qtyUnit: input.qtyUnit,
        quantityDisplayFields: buildQuantityFields({
            processType: input.sourceType,
            sourceId: input.sourceId,
            objectType: input.objectType,
            qtyUnit: input.qtyUnit,
            plannedObjectQty: input.plannedObjectQty,
            completedObjectQty,
            waitHandoverObjectQty,
            handedOverObjectQty,
            writtenBackObjectQty,
            diffObjectQty,
            isPiecePrinting: input.isPiecePrinting,
            isFabricPrinting: input.isFabricPrinting,
        }),
        latestWarehouseRecordId: latestWarehouse?.warehouseRecordId || '',
        latestHandoverRecordId: latestHandover?.handoverRecordId || '',
        latestReviewRecordId: latestReview?.reviewRecordId || '',
        latestDifferenceRecordId: latestDifference?.differenceRecordId || '',
        latestOperationRecordId: latestOperation?.operationRecordId || '',
        latestOperationChannel: latestOperation?.sourceChannel || '',
        latestOperationAt: latestOperation?.operatedAt || '',
        latestOperationBy: latestOperation?.operatorName || '',
        hasWaitProcessRecord: waitProcessRecords.length > 0,
        hasWaitHandoverRecord: waitHandoverRecords.length > 0,
        hasHandoverRecord: input.facts.handovers.length > 0,
        hasReviewRecord: input.facts.reviews.length > 0,
        hasDifferenceRecord: input.facts.differences.length > 0,
        canPlatformFollowUp: followUp.canFollow,
        followUpActionCode: followUp.code,
        followUpActionLabel: followUp.label,
        detailLink: input.detailLink,
        craftDetailLink: input.craftDetailLink,
        mobileTaskLink: input.mobileTaskLink || (input.taskId ? buildTaskDetailLink(input.taskId, {
            currentFactoryId: TEST_FACTORY_ID,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            keyword: input.taskNo || input.taskId,
        }) : ''),
    };
}
function buildPrintOrDyeView(order) {
    const baseStatus = getPlatformStatusForProcessWorkOrder(order);
    const sourceType = order.processType;
    const facts = resolveFacts(sourceType, order.workOrderId, order.taskId);
    const latestExecutionQty = order.executionNodes.reduce((sum, record) => {
        const qty = 'completedQty' in record ? Number(record.completedQty || 0) : 0;
        return sum + qty;
    }, 0);
    const plannedRollCount = order.printPayload?.plannedRollCount || order.dyePayload?.plannedRollCount || 0;
    const view = buildCommonResult({
        sourceType,
        sourceId: order.workOrderId,
        workOrderNo: order.workOrderNo,
        productionOrderNo: order.productionOrderIds[0] || '暂无生产单',
        factoryId: order.factoryId,
        factoryName: order.factoryName,
        assignmentMode: order.assignmentMode,
        dispatchPriceDisplay: order.dispatchPriceDisplay,
        internalStatusLabel: order.statusLabel,
        baseStatusLabel: baseStatus.platformStatusLabel,
        objectType: order.objectType === '面料' ? '面料' : '裁片',
        qtyUnit: getQtyUnit(order.plannedUnit),
        plannedObjectQty: order.plannedQty,
        completedObjectQty: latestExecutionQty,
        detailLink: sourceType === 'PRINT' ? `/fcs/process/print-orders?workOrderId=${encodeURIComponent(order.workOrderId)}` : `/fcs/process/dye-orders?workOrderId=${encodeURIComponent(order.workOrderId)}`,
        craftDetailLink: sourceType === 'PRINT' ? buildPrintingWorkOrderDetailLink(order.workOrderId) : buildDyeingWorkOrderDetailLink(order.workOrderId),
        taskId: order.taskId,
        taskNo: order.taskNo,
        isPiecePrinting: order.isPiecePrinting,
        isFabricPrinting: order.isFabricPrinting,
        facts,
    });
    if (sourceType === 'DYE' && plannedRollCount > 0) {
        view.quantityDisplayFields.push({
            label: '卷数',
            value: plannedRollCount,
            unit: '卷',
            text: `卷数：${plannedRollCount} 卷`,
        });
    }
    return view;
}
function buildCuttingView(record) {
    const sourceId = record.cutOrderId || record.id;
    const facts = resolveFacts('CUTTING', sourceId, record.cuttingTaskNo);
    const mapped = mapCraftStatusToPlatformStatus({
        sourceType: 'CUTTING_ORDER',
        sourceId,
        processType: 'CUTTING',
        craftStatusLabel: record.currentStage,
        status: record.currentStage,
    });
    const feiTickets = listSpreadingResultGeneratedFeiTicketsByCutOrderId(sourceId);
    const view = buildCommonResult({
        sourceType: 'CUTTING',
        sourceId,
        processName: '裁片',
        workOrderNo: record.cutOrderNo || record.cutPieceOrderNo,
        productionOrderNo: record.productionOrderNo,
        factoryId: TEST_FACTORY_ID,
        factoryName: TEST_FACTORY_NAME,
        internalStatusLabel: record.currentStage,
        baseStatusLabel: mapped.platformStatusLabel,
        objectType: '裁片',
        qtyUnit: '片',
        plannedObjectQty: record.markerInfo.totalPieces || record.orderQty,
        completedObjectQty: record.hasInboundRecord ? record.markerInfo.totalPieces : 0,
        detailLink: `/fcs/progress/board?sourceId=${encodeURIComponent(sourceId)}`,
        craftDetailLink: `/fcs/process-factory/cutting/cut-orders?cutOrderId=${encodeURIComponent(sourceId)}`,
        mobileTaskLink: buildTaskDetailLink(record.cuttingTaskNo, {
            currentFactoryId: TEST_FACTORY_ID,
            sourceType: 'CUTTING',
            sourceId,
            keyword: record.cuttingTaskNo,
        }),
        taskId: record.cuttingTaskNo,
        taskNo: record.cuttingTaskNo,
        facts,
    });
    const feiTicketCount = uniqueStrings([
        ...feiTickets.map((item) => item.feiTicketNo),
        ...facts.warehouses.flatMap((item) => item.relatedFeiTicketIds),
        ...facts.handovers.flatMap((item) => item.relatedFeiTicketIds),
        ...facts.differences.flatMap((item) => item.relatedFeiTicketIds),
    ]).length;
    view.quantityDisplayFields.push({
        label: '关联菲票数量',
        value: feiTicketCount,
        unit: '张',
        text: `关联菲票数量：${feiTicketCount} 张`,
    });
    return view;
}
function buildCuttingWarehouseResultView(sourceId) {
    const facts = resolveFacts('CUTTING', sourceId);
    const latestWarehouse = latestByTime(facts.warehouses, (record) => record.updatedAt || record.createdAt);
    const latestHandover = latestByTime(facts.handovers, (record) => record.receiveAt || record.handoverAt);
    const internalStatusLabel = hasOpenDifference(facts)
        ? '收货差异'
        : latestHandover && hasPendingReceipt(facts)
            ? '交出待收货'
            : facts.warehouses.some((record) => record.recordType === 'WAIT_HANDOVER')
                ? '待交出'
                : '已入仓';
    const mapped = mapCraftStatusToPlatformStatus({
        sourceType: 'CUTTING_ORDER',
        sourceId,
        processType: 'CUTTING',
        craftStatusLabel: internalStatusLabel,
        status: internalStatusLabel,
    });
    const feiTicketCount = uniqueStrings([
        ...facts.warehouses.flatMap((item) => item.relatedFeiTicketIds),
        ...facts.handovers.flatMap((item) => item.relatedFeiTicketIds),
        ...facts.differences.flatMap((item) => item.relatedFeiTicketIds),
    ]).length;
    const plannedQty = latestWarehouse?.plannedObjectQty || latestHandover?.handoverObjectQty || 0;
    const view = buildCommonResult({
        sourceType: 'CUTTING',
        sourceId,
        processName: '裁片',
        workOrderNo: latestWarehouse?.sourceWorkOrderNo || latestHandover?.sourceWorkOrderNo || sourceId,
        productionOrderNo: latestWarehouse?.sourceProductionOrderNo || latestHandover?.sourceProductionOrderNo || '暂无生产单',
        factoryId: latestWarehouse?.sourceFactoryId || TEST_FACTORY_ID,
        factoryName: latestWarehouse?.sourceFactoryName || TEST_FACTORY_NAME,
        internalStatusLabel,
        baseStatusLabel: mapped.platformStatusLabel,
        objectType: '裁片',
        qtyUnit: '片',
        plannedObjectQty: plannedQty,
        completedObjectQty: plannedQty,
        detailLink: `/fcs/progress/board?sourceId=${encodeURIComponent(sourceId)}`,
        craftDetailLink: `/fcs/process-factory/cutting/cut-orders?cutOrderId=${encodeURIComponent(sourceId)}`,
        facts,
    });
    view.quantityDisplayFields.push({
        label: '关联菲票数量',
        value: feiTicketCount,
        unit: '张',
        text: `关联菲票数量：${feiTicketCount} 张`,
    });
    return view;
}
function buildSpecialCraftView(workOrder) {
    const operation = getSpecialCraftOperationById(workOrder.operationId);
    const slug = operation ? buildSpecialCraftOperationSlug(operation) : buildSpecialCraftOperationSlug(workOrder.operationId);
    const facts = resolveFacts('SPECIAL_CRAFT', workOrder.workOrderId, workOrder.workOrderNo);
    const mapped = mapCraftStatusToPlatformStatus({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: workOrder.workOrderId,
        processType: 'SPECIAL_CRAFT',
        craftStatusLabel: workOrder.status,
        status: workOrder.status,
    });
    const view = buildCommonResult({
        sourceType: 'SPECIAL_CRAFT',
        sourceId: workOrder.workOrderId,
        processName: workOrder.operationName || workOrder.craftName || '特殊工艺',
        workOrderNo: workOrder.workOrderNo,
        productionOrderNo: workOrder.productionOrderNo,
        factoryId: workOrder.factoryId || TEST_FACTORY_ID,
        factoryName: workOrder.factoryName || TEST_FACTORY_NAME,
        internalStatusLabel: workOrder.status,
        baseStatusLabel: mapped.platformStatusLabel,
        objectType: '裁片',
        qtyUnit: '片',
        plannedObjectQty: workOrder.planQty,
        completedObjectQty: workOrder.returnedQty || workOrder.currentQty,
        detailLink: `/fcs/progress/board?sourceId=${encodeURIComponent(workOrder.workOrderId)}`,
        craftDetailLink: `/fcs/process-factory/special-craft/${slug}/work-orders/${encodeURIComponent(workOrder.workOrderId)}`,
        mobileTaskLink: buildTaskDetailLink(workOrder.workOrderNo, {
            currentFactoryId: TEST_FACTORY_ID,
            sourceType: 'SPECIAL_CRAFT',
            sourceId: workOrder.workOrderId,
            keyword: workOrder.workOrderNo,
        }),
        taskId: workOrder.workOrderNo,
        taskNo: workOrder.workOrderNo,
        facts,
    });
    view.quantityDisplayFields.unshift({
        label: '特殊工艺名称',
        value: 0,
        unit: '个',
        text: `特殊工艺名称：${workOrder.operationName || workOrder.craftName}`,
    });
    view.quantityDisplayFields.push({
        label: '绑定菲票数量',
        value: workOrder.feiTicketNos.length,
        unit: '张',
        text: `绑定菲票数量：${workOrder.feiTicketNos.length} 张`,
    });
    return view;
}
function buildPostFinishingView(order) {
    const facts = resolveFacts('POST_FINISHING', order.postOrderId, order.sourceTaskId);
    const mapped = mapCraftStatusToPlatformStatus({
        sourceType: 'POST_FINISHING_WORK_ORDER',
        sourceId: order.postOrderId,
        processType: 'POST_FINISHING',
        craftStatusLabel: order.currentStatus,
        status: order.currentStatus,
    });
    const completedQty = order.recheckAction.confirmedGarmentQty ||
        order.recheckAction.acceptedGarmentQty ||
        order.postAction.completedPostGarmentQty ||
        order.qcAction.passedGarmentQty ||
        order.receiveAction.receivedGarmentQty ||
        0;
    const view = buildCommonResult({
        sourceType: 'POST_FINISHING',
        sourceId: order.postOrderId,
        processName: '后道',
        workOrderNo: order.postOrderNo,
        productionOrderNo: order.sourceProductionOrderNo,
        factoryId: order.managedPostFactoryId || TEST_FACTORY_ID,
        factoryName: order.managedPostFactoryName || TEST_FACTORY_NAME,
        internalStatusLabel: order.currentStatus,
        baseStatusLabel: mapped.platformStatusLabel,
        objectType: '成衣',
        qtyUnit: '件',
        plannedObjectQty: order.plannedGarmentQty,
        completedObjectQty: completedQty,
        detailLink: `/fcs/progress/board?sourceId=${encodeURIComponent(order.postOrderId)}`,
        craftDetailLink: buildPostFinishingWorkOrderDetailLink(order.postOrderId, 'base'),
        mobileTaskLink: buildTaskDetailLink(order.sourceTaskId, {
            currentFactoryId: TEST_FACTORY_ID,
            sourceType: 'POST_FINISHING_WORK_ORDER',
            sourceId: order.postOrderId,
            keyword: order.postOrderNo,
        }),
        taskId: order.sourceTaskId,
        taskNo: order.postOrderNo,
        facts,
    });
    view.quantityDisplayFields.unshift({
        label: '当前流程类型',
        value: 0,
        unit: '个',
        text: `当前流程类型：${getPostFinishingFlowText(order)}`,
    });
    view.quantityDisplayFields.push({
        label: '接收成衣件数',
        value: order.receiveAction.receivedGarmentQty || order.receiveAction.acceptedGarmentQty || 0,
        unit: '件',
        text: `接收成衣件数：${order.receiveAction.receivedGarmentQty || order.receiveAction.acceptedGarmentQty || 0} 件`,
    }, {
        label: '质检通过成衣件数',
        value: order.qcAction.passedGarmentQty || order.qcAction.acceptedGarmentQty || 0,
        unit: '件',
        text: `质检通过成衣件数：${order.qcAction.passedGarmentQty || order.qcAction.acceptedGarmentQty || 0} 件`,
    }, {
        label: '复检确认成衣件数',
        value: order.recheckAction.confirmedGarmentQty || order.recheckAction.acceptedGarmentQty || 0,
        unit: '件',
        text: `复检确认成衣件数：${order.recheckAction.confirmedGarmentQty || order.recheckAction.acceptedGarmentQty || 0} 件`,
    });
    return view;
}
function matchesFilter(view, filter) {
    if (filter.sourceType && view.sourceType !== filter.sourceType)
        return false;
    if (filter.processType && view.processType !== filter.processType)
        return false;
    if (filter.sourceId && view.sourceId !== filter.sourceId)
        return false;
    if (filter.platformStatusLabel && view.platformStatusLabel !== filter.platformStatusLabel)
        return false;
    if (filter.hasDifferenceRecord !== undefined && view.hasDifferenceRecord !== filter.hasDifferenceRecord)
        return false;
    if (filter.taskId && !view.mobileTaskLink.includes(filter.taskId) && view.latestOperationRecordId !== filter.taskId)
        return false;
    return true;
}
function cloneView(view) {
    return {
        ...view,
        quantityDisplayFields: view.quantityDisplayFields.map((item) => ({ ...item })),
    };
}
export function listPlatformPrintResultViews(filter = {}) {
    return listProcessWorkOrders('PRINT')
        .map(buildPrintOrDyeView)
        .filter((view) => matchesFilter(view, { ...filter, sourceType: 'PRINT' }))
        .map(cloneView);
}
export function listPlatformDyeResultViews(filter = {}) {
    return listProcessWorkOrders('DYE')
        .map(buildPrintOrDyeView)
        .filter((view) => matchesFilter(view, { ...filter, sourceType: 'DYE' }))
        .map(cloneView);
}
export function listPlatformCuttingResultViews(filter = {}) {
    const baseViews = cloneCutPieceOrderRecords().map(buildCuttingView);
    const baseSourceIds = new Set(baseViews.map((view) => view.sourceId));
    const supplementalSourceIds = uniqueStrings([
        ...listProcessWarehouseRecords({ craftType: 'CUTTING' }).map((record) => record.sourceWorkOrderId),
        ...listProcessHandoverRecords({ craftType: 'CUTTING' }).map((record) => record.sourceWorkOrderId),
        ...listProcessWarehouseReviewRecords({ craftType: 'CUTTING' }).map((record) => record.sourceWorkOrderId),
        ...listProcessHandoverDifferenceRecords({ craftType: 'CUTTING' }).map((record) => record.sourceWorkOrderId),
    ]).filter((sourceId) => !baseSourceIds.has(sourceId));
    return [
        ...baseViews,
        ...supplementalSourceIds.map(buildCuttingWarehouseResultView),
    ]
        .filter((view) => matchesFilter(view, { ...filter, sourceType: 'CUTTING' }))
        .map(cloneView);
}
export function listPlatformSpecialCraftResultViews(filter = {}) {
    return listSpecialCraftTaskWorkOrders()
        .map(buildSpecialCraftView)
        .filter((view) => matchesFilter(view, { ...filter, sourceType: 'SPECIAL_CRAFT' }))
        .map(cloneView);
}
export function listPlatformPostFinishingResultViews(filter = {}) {
    return listPostFinishingWorkOrders()
        .map(buildPostFinishingView)
        .filter((view) => matchesFilter(view, { ...filter, sourceType: 'POST_FINISHING' }))
        .map(cloneView);
}
export function listPlatformProcessResultViews(filter = {}) {
    const views = [
        ...listPlatformPrintResultViews(filter.sourceType && filter.sourceType !== 'PRINT' ? { ...filter, sourceType: undefined } : filter),
        ...listPlatformDyeResultViews(filter.sourceType && filter.sourceType !== 'DYE' ? { ...filter, sourceType: undefined } : filter),
        ...listPlatformCuttingResultViews(filter.sourceType && filter.sourceType !== 'CUTTING' ? { ...filter, sourceType: undefined } : filter),
        ...listPlatformSpecialCraftResultViews(filter.sourceType && filter.sourceType !== 'SPECIAL_CRAFT' ? { ...filter, sourceType: undefined } : filter),
        ...listPlatformPostFinishingResultViews(filter.sourceType && filter.sourceType !== 'POST_FINISHING' ? { ...filter, sourceType: undefined } : filter),
    ];
    return views
        .filter((view) => matchesFilter(view, filter))
        .map(cloneView);
}
export function getPlatformProcessResultView(sourceType, sourceId) {
    const normalized = normalizeSourceType(sourceType);
    if (!normalized)
        return undefined;
    return listPlatformProcessResultViews({ sourceType: normalized, sourceId })[0];
}
export function getPlatformRiskSummary(filter = {}) {
    const views = listPlatformProcessResultViews(filter);
    return {
        totalCount: views.length,
        riskCount: views.filter((view) => view.platformRiskLevel !== '无风险').length,
        exceptionCount: views.filter((view) => view.platformStatusLabel === '异常').length,
        waitHandoverCount: views.filter((view) => view.platformStatusLabel === '待交出').length,
        waitReceiveCount: views.filter((view) => view.platformStatusLabel === '交出待收货').length,
        receiptConfirmCount: views.filter((view) => view.platformStatusLabel === '收货确认中').length,
        partialHandoverCount: views.filter((view) => view.platformStatusLabel === '部分交出').length,
        receiptDifferenceCount: views.filter((view) => view.platformStatusLabel === '收货差异').length,
        allowedPlatformStatuses: listPlatformStatusOptions(),
    };
}
export function getPlatformFollowUpTasks(filter = {}) {
    return listPlatformProcessResultViews(filter)
        .filter((view) => view.canPlatformFollowUp || ['待交出', '交出待收货', '收货确认中', '部分交出', '收货差异', '异常'].includes(view.platformStatusLabel))
        .map(cloneView);
}
export const PLATFORM_PROCESS_RESULT_VIEW_SOURCE = '平台侧同步看结果';
export const PLATFORM_PROCESS_RESULT_VIEW_FACTORY = TEST_FACTORY_DISPLAY_NAME;
