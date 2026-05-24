import { TEST_FACTORY_ID, TEST_FACTORY_NAME, mockFactories } from './factory-mock-data.ts';
import { buildFactoryWaitHandoverStockItemFromOutboundRecord, buildFactoryWaitProcessStockItemFromInboundRecord, findFactoryInternalWarehouseByFactoryAndKind, listFactoryInternalWarehouses, listFactoryWaitHandoverStockItems, listFactoryWaitProcessStockItems, listFactoryWarehouseInboundRecords, listFactoryWarehouseNodeRows, listFactoryWarehouseOutboundRecords, listFactoryWarehouseStocktakeOrders, upsertFactoryWaitHandoverStockItem, upsertFactoryWaitProcessStockItem, upsertFactoryWarehouseInboundRecord, upsertFactoryWarehouseOutboundRecord, } from './factory-internal-warehouse.ts';
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts';
import { productionOrders } from './production-orders.ts';
import { buildSpecialCraftOperationSlug, getSpecialCraftOperationById, getSpecialCraftOperationBySlug as getOperationBySlug, listEnabledSpecialCraftOperationDefinitions, } from './special-craft-operations.ts';
import { generateSpecialCraftTaskOrdersForAllProductionOrders, getSpecialCraftGenerationBatchByProductionOrder, } from './special-craft-task-generation.ts';
const PART_NAMES = ['前片', '后片', '袖片', '领片', '门襟', '裤身片', '侧片'];
const MIN_TASK_ORDER_COUNT_PER_OPERATION = 5;
const LINKED_DEMO_STATUSES = ['待领料', '已入待加工仓', '加工中', '待交出', '已交出'];
const LINKED_DEMO_ABNORMALS = ['无异常', '无异常', '设备异常', '无异常', '无异常'];
let specialCraftTaskStore = null;
function formatDay(offsetDays = 0) {
    const date = new Date(Date.UTC(2026, 3, 23 + offsetDays, 9, 0, 0));
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
function roundQty(value) {
    return Math.round(value * 100) / 100;
}
function resolveOperationFactories(operation) {
    const matched = mockFactories.filter((factory) => factory.processAbilities.some((ability) => ability.processCode === operation.processCode
        && ability.craftCodes.includes(operation.craftCode)
        && ability.canReceiveTask !== false
        && (ability.status ?? 'ACTIVE') !== 'DISABLED'));
    const visibleFactoryIds = new Set(operation.visibleFactoryIds ?? []);
    if (visibleFactoryIds.size > 0) {
        const scoped = matched.filter((factory) => visibleFactoryIds.has(factory.id));
        if (scoped.length === 0) {
            throw new Error(`未找到特殊工艺专属工厂：${operation.operationName}`);
        }
        return scoped;
    }
    const preferred = operation.targetObject === '完整面料' || operation.targetObject === '面料'
        ? matched.filter((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
        : matched.filter((factory) => factory.factoryType === 'SATELLITE_FINISHING' || factory.factoryType === 'CENTRAL_SPECIAL');
    const pool = preferred.length > 0 ? preferred : matched;
    if (pool.length === 0) {
        throw new Error(`未找到特殊工艺执行工厂：${operation.operationName}`);
    }
    return pool;
}
function pickFactoryForOperation(operation, variantIndex) {
    const pool = resolveOperationFactories(operation);
    return pool[variantIndex % pool.length];
}
function getWarehouse(factoryId, warehouseKind) {
    const warehouse = findFactoryInternalWarehouseByFactoryAndKind(factoryId, warehouseKind);
    if (!warehouse) {
        throw new Error(`未找到仓库：${factoryId} / ${warehouseKind}`);
    }
    return warehouse;
}
function pickWarehousePosition(warehouse, preferredAreaName, seed) {
    const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) ?? warehouse.areaList[0];
    const shelf = area.shelfList[seed % area.shelfList.length];
    const location = shelf.locationList[seed % shelf.locationList.length];
    return {
        areaName: area.areaName,
        shelfNo: shelf.shelfNo,
        locationNo: location.locationNo,
        locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
    };
}
function getTaskUnit(targetObject) {
    if (targetObject === '成衣半成品')
        return '件';
    return '片';
}
function getTaskItemKind(targetObject) {
    if (targetObject === '成衣半成品')
        return '成衣半成品';
    return '裁片';
}
function getTaskItemName(operation, targetObject, partName) {
    if (targetObject === '完整面料' || targetObject === '面料') {
        return `${operation.operationName}面料批次`;
    }
    if (targetObject === '成衣半成品') {
        return `${operation.operationName}半成品工单`;
    }
    return `${partName || '裁片'}${operation.operationName}任务`;
}
function getReceiverKind(operation) {
    return operation.mustReturnToCuttingFactory ? '裁床厂' : '中转仓';
}
function getReceiverName(operation) {
    if (operation.mustReturnToCuttingFactory) {
        return TEST_FACTORY_NAME;
    }
    return '公司中转仓';
}
function resolveProductionOrderVersion(order) {
    const lastBreakdownAt = order.taskBreakdownSummary.lastBreakdownAt;
    if (lastBreakdownAt)
        return `POV-${lastBreakdownAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
    return `POV-${String(order.updatedAt || order.createdAt).replace(/[^0-9]/g, '').slice(0, 14) || 'CURRENT'}`;
}
function listLinkedProductionOrderContexts() {
    return productionOrders
        .map((order) => ({ order, snapshot: getProductionOrderTechPackSnapshot(order.productionOrderId) }))
        .filter((item) => Boolean(item.snapshot)
        && item.order.demandSnapshot.skuLines.length > 0
        && item.snapshot.patternFiles.length > 0);
}
function stableDemoHash(input) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
function mapTaskStatusToExecutionStatus(status) {
    if (status === '已入待加工仓')
        return 'IN_WAIT_PROCESS_WAREHOUSE';
    if (status === '加工中')
        return 'PROCESSING';
    if (status === '已完成')
        return 'COMPLETED';
    if (status === '待交出')
        return 'WAIT_HANDOVER';
    if (status === '已交出')
        return 'HANDED_OVER';
    if (status === '已回写')
        return 'WRITTEN_BACK';
    if (status === '差异')
        return 'DIFFERENCE';
    if (status === '异议中')
        return 'OBJECTION';
    if (status === '异常')
        return 'ABNORMAL';
    return 'WAIT_PICKUP';
}
function resolveSnapshotPatternContext(snapshot, variantIndex) {
    const patternFiles = snapshot.patternFiles.filter((file) => (file.pieceRows ?? []).length > 0);
    const patternFile = patternFiles[variantIndex % Math.max(patternFiles.length, 1)] ?? snapshot.patternFiles[0];
    const pieceRows = patternFile?.pieceRows ?? [];
    const pieceRow = pieceRows[variantIndex % Math.max(pieceRows.length, 1)];
    const allocation = pieceRow?.colorAllocations?.find((item) => Number(item.pieceCount) > 0) ?? pieceRow?.colorAllocations?.[0];
    const pieceCountPerGarment = Number(allocation?.pieceCount);
    return {
        patternFileId: patternFile?.patternFileId || patternFile?.id || `PF-${snapshot.productionOrderNo}`,
        patternFileName: patternFile?.patternFileName || patternFile?.fileName || `${snapshot.styleCode}纸样`,
        pieceRowId: pieceRow?.id || `PR-${snapshot.productionOrderNo}-${String(variantIndex + 1).padStart(2, '0')}`,
        partName: pieceRow?.name || PART_NAMES[variantIndex % PART_NAMES.length],
        pieceCountPerGarment: Number.isFinite(pieceCountPerGarment) && pieceCountPerGarment > 0 ? pieceCountPerGarment : 1,
        bundleWidthCm: pieceRow?.bundleWidthCm,
        bundleLengthCm: pieceRow?.bundleLengthCm,
    };
}
function buildLinkedDemoTaskSeed(input) {
    const { operation, operationIndex, variantIndex, context } = input;
    const { order, snapshot } = context;
    const factory = pickFactoryForOperation(operation, variantIndex);
    const orderLine = order.demandSnapshot.skuLines[(operationIndex + variantIndex) % order.demandSnapshot.skuLines.length];
    const patternContext = resolveSnapshotPatternContext(snapshot, variantIndex);
    const taskPrefix = operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'AUX' : 'SPC';
    const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4);
    const seedKey = stableDemoHash([operation.operationId, order.productionOrderId, variantIndex].join('|'));
    const taskOrderId = `${taskPrefix}-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${seedKey.slice(0, 6)}`;
    const taskOrderNo = `${taskPrefix}-${order.productionOrderNo.replace(/^PO-/, '')}-${craftShortCode}-${String(variantIndex + 1).padStart(2, '0')}`;
    const sourceTaskNo = `TASK-${taskOrderNo}`;
    const status = LINKED_DEMO_STATUSES[variantIndex % LINKED_DEMO_STATUSES.length];
    const abnormalStatus = LINKED_DEMO_ABNORMALS[variantIndex % LINKED_DEMO_ABNORMALS.length];
    const pieceCountPerGarment = operation.targetObject === '成衣半成品' ? 1 : patternContext.pieceCountPerGarment;
    const planQty = roundQty(orderLine.qty * pieceCountPerGarment);
    const receivedQty = status === '待领料' ? 0 : roundQty(planQty - (abnormalStatus === '无异常' ? 0 : Math.max(1, Math.round(planQty * 0.01))));
    const completedQty = ['已完成', '待交出', '已交出', '已回写'].includes(status)
        ? receivedQty
        : status === '加工中'
            ? roundQty(Math.max(receivedQty * 0.45, 0))
            : 0;
    const lossQty = roundQty(Math.max(receivedQty - completedQty, 0));
    const waitHandoverQty = ['待交出', '已交出', '已回写'].includes(status) ? completedQty : 0;
    const targetObject = operation.targetObject;
    const demandLine = {
        demandLineId: `${taskOrderId}-LINE-01`,
        taskOrderId,
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        patternFileId: targetObject === '成衣半成品' ? `GARMENT-${operation.operationId}` : patternContext.patternFileId,
        patternFileName: targetObject === '成衣半成品' ? '成衣半成品' : patternContext.patternFileName,
        pieceRowId: targetObject === '成衣半成品' ? `GARMENT-${operation.operationId}` : patternContext.pieceRowId,
        partName: targetObject === '成衣半成品' ? '成衣半成品' : patternContext.partName,
        colorName: orderLine.color,
        colorCode: orderLine.color,
        sizeCode: orderLine.size,
        pieceCountPerGarment,
        orderQty: orderLine.qty,
        planPieceQty: planQty,
        specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${targetObject}`,
        operationId: operation.operationId,
        operationName: operation.operationName,
        managementDomain: operation.managementDomain,
        managementDomainName: operation.managementDomainName,
        processCode: operation.processCode,
        processName: operation.processName,
        craftCode: operation.craftCode,
        craftName: operation.craftName,
        targetObject,
        unit: getTaskUnit(targetObject),
        feiTicketNos: targetObject === '成衣半成品' ? [] : [`FT-${order.productionOrderNo.replace(/^PO-/, '')}-${String(variantIndex + 1).padStart(2, '0')}`],
        bundleWidthCm: patternContext.bundleWidthCm,
        bundleLengthCm: patternContext.bundleLengthCm,
        remark: `来源生产单 ${order.productionOrderNo} / 技术包 ${snapshot.sourceTechPackVersionLabel || snapshot.versionLabel}`,
    };
    return {
        operation,
        taskOrderId,
        taskOrderNo,
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        productionOrderVersion: resolveProductionOrderVersion(order),
        techPackSnapshotId: snapshot.snapshotId,
        techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
        sourceTaskId: sourceTaskNo,
        sourceTaskNo,
        generationBatchId: `SCB-${seedKey}`,
        generationSource: 'PRODUCTION_ORDER',
        generationSourceLabel: '生产单生成',
        sourceTrigger: 'PRODUCTION_ORDER_CREATED',
        sourceTriggerLabel: '生产单自动拆分任务',
        assignmentStatus: 'ASSIGNED',
        assignmentStatusLabel: '已分配',
        executionStatus: mapTaskStatusToExecutionStatus(status),
        executionStatusLabel: status,
        demandLines: [demandLine],
        sourcePieceRowIds: [demandLine.pieceRowId],
        sourcePatternFileIds: [demandLine.patternFileId],
        sourceSpecialCraftKeys: [demandLine.specialCraftKey],
        factory,
        targetObject,
        partName: demandLine.partName,
        fabricColor: orderLine.color,
        sizeCode: orderLine.size,
        feiTicketNos: [...demandLine.feiTicketNos],
        transferBagNos: targetObject === '成衣半成品' ? [] : [`TB-${order.productionOrderNo.replace(/^PO-/, '')}-${String(variantIndex + 1).padStart(2, '0')}`],
        fabricRollNos: [],
        materialSku: orderLine.skuCode,
        unit: getTaskUnit(targetObject),
        itemName: getTaskItemName(operation, targetObject, demandLine.partName),
        itemKind: getTaskItemKind(targetObject),
        planQty,
        receivedQty,
        completedQty,
        lossQty,
        waitHandoverQty,
        status,
        abnormalStatus,
        createdAt: order.updatedAt || order.createdAt,
        dueAt: order.planEndDate || order.demandSnapshot.requiredDeliveryDate || order.updatedAt,
        receiverName: getReceiverName(operation),
        receiverKind: getReceiverKind(operation),
        sourceAction: targetObject === '成衣半成品' ? '交出接收' : '领料确认',
        sourceRecordType: targetObject === '成衣半成品' ? 'HANDOVER_RECEIVE' : 'MATERIAL_PICKUP',
        sourceRecordNo: `${targetObject === '成衣半成品' ? 'JS' : 'LL'}-${taskOrderNo}`,
        sourceObjectName: targetObject === '成衣半成品' ? '上游工厂交出' : '裁床待交出仓',
        handoverOrderId: `SC-HO-${seedKey}`,
        handoverOrderNo: `SC-HDO-${taskOrderNo}`,
        handoverRecordId: `SC-HR-${seedKey}`,
        handoverRecordNo: `SC-HDR-${taskOrderNo}`,
        handoverRecordQrValue: `SCQR-${seedKey}`,
        generationKey: seedKey,
        suggestedFactoryId: factory.id,
        suggestedFactoryName: factory.name,
        assignedFactoryId: factory.id,
        assignedFactoryName: factory.name,
        assignmentMode: '直接派单',
        remark: `由生产单 ${order.productionOrderNo} 按正式技术包 ${snapshot.sourceTechPackVersionLabel || snapshot.versionLabel} 自动拆分生成。`,
    };
}
function shouldCreateInboundRecord(status) {
    return status !== '待领料';
}
function shouldCreateWaitProcessRecord(status) {
    return ['已入待加工仓', '加工中', '差异', '异常'].includes(status);
}
function shouldCreatePendingWaitHandoverRecord(status) {
    return ['已完成', '待交出'].includes(status);
}
function shouldCreateOutboundRecord(status) {
    return ['已交出', '已回写', '差异', '异议中'].includes(status);
}
function buildInboundArtifacts(seed, positionIndex) {
    if (!shouldCreateInboundRecord(seed.status))
        return {};
    const warehouse = getWarehouse(seed.factory.id, 'WAIT_PROCESS');
    const inboundPosition = pickWarehousePosition(warehouse, seed.status === '差异' || seed.abnormalStatus === '数量差异' ? '异常区' : 'A区', positionIndex);
    const differenceQty = roundQty(seed.receivedQty - seed.planQty);
    const inboundRecord = upsertFactoryWarehouseInboundRecord({
        inboundRecordId: `SC-INB-${seed.taskOrderId}`,
        inboundRecordNo: `RK-${seed.taskOrderNo}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: seed.factory.id,
        factoryName: seed.factory.name,
        factoryKind: seed.factory.factoryType,
        processCode: seed.operation.processCode,
        processName: seed.operation.processName,
        craftCode: seed.operation.craftCode,
        craftName: seed.operation.craftName,
        sourceRecordId: `SC-SRC-${seed.taskOrderId}`,
        sourceRecordNo: seed.sourceRecordNo,
        sourceRecordType: seed.sourceRecordType,
        sourceObjectName: seed.sourceObjectName,
        taskId: seed.sourceTaskId,
        taskNo: seed.sourceTaskNo,
        itemKind: seed.itemKind,
        itemName: seed.itemName,
        materialSku: seed.materialSku,
        partName: seed.partName,
        fabricColor: seed.fabricColor,
        sizeCode: seed.sizeCode,
        feiTicketNo: seed.feiTicketNos[0],
        transferBagNo: seed.transferBagNos[0],
        fabricRollNo: seed.fabricRollNos[0],
        expectedQty: seed.planQty,
        receivedQty: seed.receivedQty,
        differenceQty,
        unit: seed.unit,
        receiverName: seed.factory.contact,
        receivedAt: seed.createdAt,
        areaName: inboundPosition.areaName,
        shelfNo: inboundPosition.shelfNo,
        locationNo: inboundPosition.locationNo,
        status: differenceQty !== 0 ? '差异待处理' : '已入库',
        abnormalReason: differenceQty !== 0 ? '数量不符' : undefined,
        photoList: differenceQty !== 0 ? ['diff-photo-1.jpg'] : [],
        remark: '由交接自动转单',
    });
    const waitProcessStockItem = shouldCreateWaitProcessRecord(seed.status)
        ? upsertFactoryWaitProcessStockItem({
            ...buildFactoryWaitProcessStockItemFromInboundRecord(inboundRecord),
            stockItemId: `SC-WPS-${seed.taskOrderId}`,
            productionOrderId: seed.productionOrderId,
            productionOrderNo: seed.productionOrderNo,
            taskId: seed.sourceTaskId,
            taskNo: seed.sourceTaskNo,
            status: differenceQty !== 0 ? '差异待处理' : '已入待加工仓',
            remark: seed.sourceAction,
        })
        : undefined;
    const linkedInbound = upsertFactoryWarehouseInboundRecord({
        ...inboundRecord,
        generatedStockItemId: waitProcessStockItem?.stockItemId,
    });
    return {
        inboundRecord: linkedInbound,
        waitProcessStockItem,
    };
}
function buildPendingWaitHandoverItem(seed, positionIndex) {
    const warehouse = getWarehouse(seed.factory.id, 'WAIT_HANDOVER');
    const position = pickWarehousePosition(warehouse, 'B区', positionIndex);
    return upsertFactoryWaitHandoverStockItem({
        stockItemId: `SC-WHS-${seed.taskOrderId}`,
        warehouseId: warehouse.warehouseId,
        factoryId: seed.factory.id,
        factoryName: seed.factory.name,
        factoryKind: seed.factory.factoryType,
        warehouseName: warehouse.warehouseName,
        processCode: seed.operation.processCode,
        processName: seed.operation.processName,
        craftCode: seed.operation.craftCode,
        craftName: seed.operation.craftName,
        taskId: seed.sourceTaskId,
        taskNo: seed.sourceTaskNo,
        productionOrderId: seed.productionOrderId,
        productionOrderNo: seed.productionOrderNo,
        itemKind: seed.itemKind,
        itemName: seed.itemName,
        materialSku: seed.materialSku,
        partName: seed.partName,
        fabricColor: seed.fabricColor,
        sizeCode: seed.sizeCode,
        feiTicketNo: seed.feiTicketNos[0],
        transferBagNo: seed.transferBagNos[0],
        fabricRollNo: seed.fabricRollNos[0],
        completedQty: seed.completedQty,
        lossQty: seed.lossQty,
        waitHandoverQty: seed.waitHandoverQty,
        unit: seed.unit,
        receiverKind: seed.receiverKind,
        receiverName: seed.receiverName,
        handoverOrderId: seed.handoverOrderId,
        handoverOrderNo: seed.handoverOrderNo,
        areaName: position.areaName,
        shelfNo: position.shelfNo,
        locationNo: position.locationNo,
        locationText: position.locationText,
        status: '待交出',
        photoList: [],
        remark: '由任务完工沉淀',
    });
}
function buildOutboundArtifacts(seed, positionIndex) {
    if (shouldCreatePendingWaitHandoverRecord(seed.status)) {
        return {
            waitHandoverStockItem: buildPendingWaitHandoverItem(seed, positionIndex),
        };
    }
    if (!shouldCreateOutboundRecord(seed.status))
        return {};
    const warehouse = getWarehouse(seed.factory.id, 'WAIT_HANDOVER');
    const outboundPosition = pickWarehousePosition(warehouse, seed.status === '差异' || seed.status === '异议中' ? '异常区' : '待确认区', positionIndex);
    const outboundQty = roundQty(seed.completedQty - seed.lossQty);
    const receiverWrittenQty = seed.status === '已回写'
        ? outboundQty
        : seed.status === '差异'
            ? roundQty(outboundQty - 6)
            : seed.status === '异议中'
                ? roundQty(outboundQty - 4)
                : undefined;
    const differenceQty = typeof receiverWrittenQty === 'number' ? roundQty(receiverWrittenQty - outboundQty) : undefined;
    const outboundStatus = seed.status === '已交出'
        ? '已出库'
        : seed.status === '已回写'
            ? '已回写'
            : seed.status === '差异'
                ? '差异'
                : '异议中';
    const outboundRecord = upsertFactoryWarehouseOutboundRecord({
        outboundRecordId: `SC-OUT-${seed.taskOrderId}`,
        outboundRecordNo: `CK-${seed.taskOrderNo}`,
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: seed.factory.id,
        factoryName: seed.factory.name,
        factoryKind: seed.factory.factoryType,
        processCode: seed.operation.processCode,
        processName: seed.operation.processName,
        craftCode: seed.operation.craftCode,
        craftName: seed.operation.craftName,
        sourceTaskId: seed.sourceTaskId,
        sourceTaskNo: seed.sourceTaskNo,
        handoverOrderId: seed.handoverOrderId,
        handoverOrderNo: seed.handoverOrderNo,
        handoverRecordId: seed.handoverRecordId,
        handoverRecordNo: seed.handoverRecordNo,
        handoverRecordQrValue: seed.handoverRecordQrValue,
        receiverKind: seed.receiverKind,
        receiverName: seed.receiverName,
        itemKind: seed.itemKind,
        itemName: seed.itemName,
        materialSku: seed.materialSku,
        partName: seed.partName,
        fabricColor: seed.fabricColor,
        sizeCode: seed.sizeCode,
        feiTicketNo: seed.feiTicketNos[0],
        transferBagNo: seed.transferBagNos[0],
        fabricRollNo: seed.fabricRollNos[0],
        outboundQty,
        receiverWrittenQty,
        differenceQty,
        unit: seed.unit,
        operatorName: seed.factory.contact,
        outboundAt: seed.createdAt,
        status: outboundStatus,
        abnormalReason: seed.status === '差异'
            ? '回写对象数量不符'
            : seed.status === '异议中'
                ? '已发起数量异议'
                : undefined,
        photoList: seed.status === '差异' || seed.status === '异议中' ? ['handover-proof-1.jpg'] : [],
        remark: '由交接自动转单',
    });
    const waitHandoverStockItem = upsertFactoryWaitHandoverStockItem({
        ...buildFactoryWaitHandoverStockItemFromOutboundRecord(outboundRecord),
        stockItemId: `SC-WHS-${seed.taskOrderId}`,
        productionOrderId: seed.productionOrderId,
        productionOrderNo: seed.productionOrderNo,
        handoverOrderId: seed.handoverOrderId,
        handoverOrderNo: seed.handoverOrderNo,
        handoverRecordId: seed.handoverRecordId,
        handoverRecordNo: seed.handoverRecordNo,
        handoverRecordQrValue: seed.handoverRecordQrValue,
        areaName: outboundPosition.areaName,
        shelfNo: outboundPosition.shelfNo,
        locationNo: outboundPosition.locationNo,
        locationText: outboundPosition.locationText,
        status: seed.status === '已交出'
            ? '已交出'
            : seed.status === '已回写'
                ? '已回写'
                : seed.status === '差异'
                    ? '差异'
                    : '异议中',
        differenceQty,
        objectionStatus: seed.status === '异议中' ? '异议中' : undefined,
        relatedWaitHandoverStockItemId: undefined,
        remark: '由交接自动转单',
    });
    const linkedOutbound = upsertFactoryWarehouseOutboundRecord({
        ...outboundRecord,
        relatedWaitHandoverStockItemId: waitHandoverStockItem.stockItemId,
    });
    return {
        outboundRecord: linkedOutbound,
        waitHandoverStockItem,
    };
}
function buildWarehouseLinks(seed, artifacts) {
    const links = [];
    if (artifacts.inboundRecord) {
        links.push({
            linkId: `${seed.taskOrderId}-WAIT_PROCESS`,
            taskOrderId: seed.taskOrderId,
            warehouseKind: '待加工仓',
            warehouseName: artifacts.inboundRecord.warehouseName,
            inboundRecordId: artifacts.inboundRecord.inboundRecordId,
            inboundRecordNo: artifacts.inboundRecord.inboundRecordNo,
            waitProcessStockItemId: artifacts.waitProcessStockItem?.stockItemId,
            status: artifacts.inboundRecord.status === '差异待处理' ? '差异' : '已入库',
        });
    }
    if (artifacts.waitHandoverStockItem) {
        links.push({
            linkId: `${seed.taskOrderId}-WAIT_HANDOVER`,
            taskOrderId: seed.taskOrderId,
            warehouseKind: '待交出仓',
            warehouseName: artifacts.waitHandoverStockItem.warehouseName,
            outboundRecordId: artifacts.outboundRecord?.outboundRecordId,
            outboundRecordNo: artifacts.outboundRecord?.outboundRecordNo,
            waitHandoverStockItemId: artifacts.waitHandoverStockItem.stockItemId,
            handoverRecordId: artifacts.waitHandoverStockItem.handoverRecordId,
            handoverRecordNo: artifacts.waitHandoverStockItem.handoverRecordNo,
            status: artifacts.waitHandoverStockItem.status === '待交出'
                ? '待交出'
                : artifacts.waitHandoverStockItem.status === '已交出'
                    ? '已出库'
                    : artifacts.waitHandoverStockItem.status,
        });
    }
    return links;
}
function createNodeRecord(seed, index, input) {
    return {
        nodeRecordId: `${seed.taskOrderId}-NODE-${String(index + 1).padStart(2, '0')}`,
        taskOrderId: seed.taskOrderId,
        ...input,
    };
}
function buildNodeRecords(seed, artifacts) {
    const rows = [];
    rows.push(createNodeRecord(seed, rows.length, {
        nodeName: '待领料',
        actionName: '来源生产单',
        beforeStatus: '待领料',
        afterStatus: '待领料',
        qty: seed.planQty,
        unit: seed.unit,
        operatorName: '系统',
        operatedAt: seed.createdAt,
        relatedRecordNo: seed.productionOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 0,
        remark: '由生产单结果沉淀为工艺加工单',
    }));
    if (artifacts.inboundRecord) {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '已入待加工仓',
            actionName: seed.sourceAction,
            beforeStatus: '待领料',
            afterStatus: '已入待加工仓',
            qty: seed.receivedQty,
            unit: seed.unit,
            operatorName: seed.factory.contact,
            operatedAt: seed.createdAt,
            relatedRecordNo: artifacts.inboundRecord.inboundRecordNo,
            relatedRecordType: '入库记录',
            photoCount: artifacts.inboundRecord.photoList.length,
            remark: '自动转单进入待加工仓',
        }));
    }
    if (['加工中', '已完成', '待交出', '已交出', '已回写', '差异', '异议中', '异常'].includes(seed.status)) {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: seed.status === '异常' ? '加工中' : '加工中',
            actionName: '开工',
            beforeStatus: '已入待加工仓',
            afterStatus: '加工中',
            qty: seed.receivedQty || seed.planQty,
            unit: seed.unit,
            operatorName: `${seed.factory.contact}组长`,
            operatedAt: formatDay(0),
            relatedRecordNo: seed.taskOrderNo,
            relatedRecordType: '任务记录',
            photoCount: 0,
            remark: '进入当前特殊工艺加工节点',
        }));
    }
    if (['已完成', '待交出', '已交出', '已回写', '差异', '异议中'].includes(seed.status)) {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '已完成',
            actionName: '完工',
            beforeStatus: '加工中',
            afterStatus: '已完成',
            qty: seed.completedQty,
            unit: seed.unit,
            operatorName: `${seed.factory.contact}组长`,
            operatedAt: formatDay(1),
            relatedRecordNo: seed.taskOrderNo,
            relatedRecordType: '任务记录',
            photoCount: 1,
            remark: '已沉淀完工数量',
        }));
    }
    if (artifacts.waitHandoverStockItem && ['已完成', '待交出'].includes(seed.status)) {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '待交出',
            actionName: '入待交出仓',
            beforeStatus: '已完成',
            afterStatus: '待交出',
            qty: seed.waitHandoverQty,
            unit: seed.unit,
            operatorName: '系统',
            operatedAt: formatDay(1),
            relatedRecordNo: artifacts.waitHandoverStockItem.handoverOrderNo || seed.handoverOrderNo,
            relatedRecordType: '任务记录',
            photoCount: 0,
            remark: '完工后沉淀到待交出仓',
        }));
    }
    if (artifacts.outboundRecord) {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '已交出',
            actionName: '交出',
            beforeStatus: '待交出',
            afterStatus: '已交出',
            qty: artifacts.outboundRecord.outboundQty,
            unit: seed.unit,
            operatorName: seed.factory.contact,
            operatedAt: formatDay(2),
            relatedRecordNo: artifacts.outboundRecord.handoverRecordNo,
            relatedRecordType: '交出记录',
            photoCount: artifacts.outboundRecord.photoList.length,
            remark: '交接提交后自动生成出库记录',
        }));
    }
    if (seed.status === '已回写') {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '已回写',
            actionName: '回写',
            beforeStatus: '已交出',
            afterStatus: '已回写',
            qty: seed.waitHandoverQty || seed.completedQty,
            unit: seed.unit,
            operatorName: seed.receiverName,
            operatedAt: formatDay(3),
            relatedRecordNo: artifacts.outboundRecord?.outboundRecordNo,
            relatedRecordType: '出库记录',
            photoCount: 0,
            remark: '接收方已完成回写',
        }));
    }
    if (seed.status === '差异') {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '差异',
            actionName: '回写',
            beforeStatus: '已交出',
            afterStatus: '差异',
            qty: Math.abs(artifacts.outboundRecord?.differenceQty || 0),
            unit: seed.unit,
            operatorName: seed.receiverName,
            operatedAt: formatDay(3),
            relatedRecordNo: artifacts.outboundRecord?.outboundRecordNo,
            relatedRecordType: '出库记录',
            photoCount: 1,
            remark: '接收方回写对象数量与交出对象数量不符',
        }));
    }
    if (seed.status === '异议中') {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '异议中',
            actionName: '发起异议',
            beforeStatus: '差异',
            afterStatus: '异议中',
            qty: Math.abs(artifacts.outboundRecord?.differenceQty || 0),
            unit: seed.unit,
            operatorName: seed.factory.contact,
            operatedAt: formatDay(4),
            relatedRecordNo: artifacts.outboundRecord?.handoverRecordNo,
            relatedRecordType: '交出记录',
            photoCount: 1,
            remark: '已发起数量异议，等待平台处理',
        }));
    }
    if (seed.abnormalStatus !== '无异常') {
        rows.push(createNodeRecord(seed, rows.length, {
            nodeName: '异常',
            actionName: '记录异常',
            beforeStatus: seed.status,
            afterStatus: seed.status,
            qty: seed.status === '待领料' ? seed.planQty : seed.receivedQty || seed.completedQty,
            unit: seed.unit,
            operatorName: `${seed.factory.contact}组长`,
            operatedAt: formatDay(2),
            relatedRecordNo: `${seed.taskOrderNo}-ABN`,
            relatedRecordType: '异常记录',
            photoCount: 1,
            remark: `已登记${seed.abnormalStatus}`,
        }));
    }
    return rows;
}
function buildAbnormalRecords(seed) {
    if (seed.abnormalStatus === '无异常')
        return [];
    return [
        {
            abnormalId: `${seed.taskOrderId}-ABN-01`,
            taskOrderId: seed.taskOrderId,
            abnormalType: seed.abnormalStatus === '其他异常' ? '其他异常' : seed.abnormalStatus,
            qty: seed.status === '待领料' ? seed.planQty : Math.max(seed.receivedQty, seed.completedQty, 1),
            unit: seed.unit,
            description: seed.abnormalStatus === '数量差异'
                ? '接收或回写对象数量不一致，需复核差异来源。'
                : seed.abnormalStatus === '设备异常'
                    ? '关键设备停机，已改排临时机台。'
                    : seed.abnormalStatus === '延期'
                        ? '上游交接延后，交期需重新确认。'
                        : seed.abnormalStatus === '破损'
                            ? '来料局部破损，已转异常区待处理。'
                            : seed.abnormalStatus === '错片'
                                ? '裁片部位错配，待复核来源菲票。'
                                : '已登记现场异常，等待处理。',
            photoCount: 1,
            reportedBy: `${seed.factory.contact}组长`,
            reportedAt: formatDay(2),
            status: seed.status === '异议中' ? '处理中' : '待处理',
        },
    ];
}
function buildTaskOrder(seed, artifacts) {
    const taskOrderId = seed.taskOrderId;
    const fallbackDemandLine = {
        demandLineId: `${taskOrderId}-LINE-01`,
        taskOrderId,
        productionOrderId: seed.productionOrderId,
        productionOrderNo: seed.productionOrderNo,
        patternFileId: `PF-${seed.operation.operationId}`,
        patternFileName: `${seed.operation.operationName}纸样`,
        pieceRowId: `PR-${taskOrderId}`,
        partName: seed.partName || seed.itemName,
        colorName: seed.fabricColor || '默认色',
        colorCode: seed.fabricColor || 'DEFAULT',
        sizeCode: seed.sizeCode || '均码',
        pieceCountPerGarment: 1,
        orderQty: seed.planQty,
        planPieceQty: seed.planQty,
        specialCraftKey: `${seed.operation.managementDomain}:${seed.operation.processCode}:${seed.operation.craftCode}`,
        operationId: seed.operation.operationId,
        operationName: seed.operation.operationName,
        managementDomain: seed.operation.managementDomain,
        managementDomainName: seed.operation.managementDomainName,
        processCode: seed.operation.processCode,
        processName: seed.operation.processName,
        craftCode: seed.operation.craftCode,
        craftName: seed.operation.craftName,
        targetObject: seed.targetObject,
        unit: seed.unit,
        feiTicketNos: [...seed.feiTicketNos],
        remark: '演示任务明细',
    };
    const demandLines = (seed.demandLines?.length ? seed.demandLines : [fallbackDemandLine]).map((line, index) => ({
        ...line,
        taskOrderId,
        demandLineId: line.demandLineId || `${taskOrderId}-LINE-${String(index + 1).padStart(2, '0')}`,
    }));
    const sourcePieceRowIds = seed.sourcePieceRowIds || [...new Set(demandLines.map((line) => line.pieceRowId))];
    const sourcePatternFileIds = seed.sourcePatternFileIds || [...new Set(demandLines.map((line) => line.patternFileId))];
    const sourceSpecialCraftKeys = seed.sourceSpecialCraftKeys || [...new Set(demandLines.map((line) => line.specialCraftKey))];
    const taskOrder = {
        taskOrderId,
        taskOrderNo: seed.taskOrderNo,
        operationId: seed.operation.operationId,
        operationName: seed.operation.operationName,
        managementDomain: seed.operation.managementDomain,
        managementDomainName: seed.operation.managementDomainName,
        processCode: seed.operation.processCode,
        processName: seed.operation.processName,
        craftCode: seed.operation.craftCode,
        craftName: seed.operation.craftName,
        factoryId: seed.factory.id,
        factoryName: seed.factory.name,
        productionOrderId: seed.productionOrderId,
        productionOrderNo: seed.productionOrderNo,
        productionOrderVersion: seed.productionOrderVersion || 'POV-SEED',
        techPackSnapshotId: seed.techPackSnapshotId || `TPS-${seed.operation.operationId}`,
        techPackVersion: seed.techPackVersion || '演示版',
        sourceTaskId: seed.sourceTaskId,
        sourceTaskNo: seed.sourceTaskNo,
        generationBatchId: seed.generationBatchId || `SCB-SEED-${seed.operation.operationId}`,
        generationSource: seed.generationSource || 'PRODUCTION_ORDER',
        generationSourceLabel: seed.generationSourceLabel || '生产单生成',
        sourceTrigger: seed.sourceTrigger || 'PRODUCTION_ORDER_CREATED',
        sourceTriggerLabel: seed.sourceTriggerLabel || '生产单生成',
        assignmentStatus: seed.assignmentStatus || 'ASSIGNED',
        assignmentStatusLabel: seed.assignmentStatusLabel || '已分配',
        executionStatus: seed.executionStatus || (seed.status === '待领料'
            ? 'WAIT_PICKUP'
            : seed.status === '已入待加工仓'
                ? 'IN_WAIT_PROCESS_WAREHOUSE'
                : seed.status === '加工中'
                    ? 'PROCESSING'
                    : seed.status === '已完成'
                        ? 'COMPLETED'
                        : seed.status === '待交出'
                            ? 'WAIT_HANDOVER'
                            : seed.status === '已交出'
                                ? 'HANDED_OVER'
                                : seed.status === '已回写'
                                    ? 'WRITTEN_BACK'
                                    : seed.status === '差异'
                                        ? 'DIFFERENCE'
                                        : seed.status === '异议中'
                                            ? 'OBJECTION'
                                            : 'ABNORMAL'),
        executionStatusLabel: seed.executionStatusLabel || seed.status,
        demandLines,
        sourcePieceRowIds,
        sourcePatternFileIds,
        sourceSpecialCraftKeys,
        targetObject: seed.targetObject,
        partName: seed.partName,
        fabricColor: seed.fabricColor,
        sizeCode: seed.sizeCode,
        feiTicketNos: [...seed.feiTicketNos],
        transferBagNos: [...seed.transferBagNos],
        fabricRollNos: [...seed.fabricRollNos],
        materialSku: seed.materialSku,
        planQty: seed.planQty,
        receivedQty: seed.receivedQty,
        completedQty: seed.completedQty,
        lossQty: seed.lossQty,
        waitHandoverQty: seed.waitHandoverQty,
        unit: seed.unit,
        status: seed.status,
        abnormalStatus: seed.abnormalStatus,
        dueAt: seed.dueAt,
        createdAt: seed.createdAt,
        updatedAt: seed.createdAt,
        waitProcessStockItemIds: artifacts.waitProcessStockItem ? [artifacts.waitProcessStockItem.stockItemId] : [],
        waitHandoverStockItemIds: artifacts.waitHandoverStockItem ? [artifacts.waitHandoverStockItem.stockItemId] : [],
        inboundRecordIds: artifacts.inboundRecord ? [artifacts.inboundRecord.inboundRecordId] : [],
        outboundRecordIds: artifacts.outboundRecord ? [artifacts.outboundRecord.outboundRecordId] : [],
        validationWarnings: [],
        isGenerated: true,
        isManualCreated: false,
        generationKey: seed.generationKey || `SEED-${taskOrderId}`,
        suggestedFactoryId: seed.suggestedFactoryId || seed.factory.id,
        suggestedFactoryName: seed.suggestedFactoryName || seed.factory.name,
        assignedFactoryId: seed.assignedFactoryId || seed.factory.id,
        assignedFactoryName: seed.assignedFactoryName || seed.factory.name,
        assignmentMode: seed.assignmentMode || '演示分配',
        nodeRecords: [],
        warehouseLinks: [],
        abnormalRecords: [],
        remark: seed.remark || '展示已由生产单沉淀后的工艺加工结果。',
    };
    taskOrder.nodeRecords = buildNodeRecords(seed, artifacts);
    taskOrder.warehouseLinks = buildWarehouseLinks(seed, artifacts);
    taskOrder.abnormalRecords = buildAbnormalRecords(seed);
    assertSpecialCraftTaskOrderValid(taskOrder);
    return taskOrder;
}
function buildLinkedSupplementTaskOrders(existingTaskOrders, operations = listEnabledSpecialCraftOperationDefinitions()) {
    const contexts = listLinkedProductionOrderContexts();
    if (contexts.length === 0)
        return [];
    const existingProductionOrderIds = new Set(existingTaskOrders.map((taskOrder) => taskOrder.productionOrderId));
    const supplementalContexts = contexts.filter((context) => !existingProductionOrderIds.has(context.order.productionOrderId));
    const candidateContexts = supplementalContexts.length > 0 ? supplementalContexts : contexts;
    const supplements = [];
    operations.forEach((operation, operationIndex) => {
        const existingForOperation = existingTaskOrders
            .filter((taskOrder) => taskOrder.operationId === operation.operationId);
        const existingKeys = new Set(existingForOperation.map((taskOrder) => `${taskOrder.productionOrderId}::${taskOrder.operationId}`));
        let candidateCursor = operationIndex * MIN_TASK_ORDER_COUNT_PER_OPERATION;
        while (existingForOperation.length + supplements.filter((taskOrder) => taskOrder.operationId === operation.operationId).length < MIN_TASK_ORDER_COUNT_PER_OPERATION) {
            const context = candidateContexts[candidateCursor % candidateContexts.length];
            candidateCursor += 1;
            const key = `${context.order.productionOrderId}::${operation.operationId}`;
            if (existingKeys.has(key) && candidateContexts.length > 1)
                continue;
            existingKeys.add(key);
            const variantIndex = existingForOperation.length
                + supplements.filter((taskOrder) => taskOrder.operationId === operation.operationId).length;
            const seed = buildLinkedDemoTaskSeed({
                operation,
                operationIndex,
                variantIndex,
                context,
            });
            const inboundArtifacts = buildInboundArtifacts(seed, operationIndex + variantIndex + 1);
            const outboundArtifacts = buildOutboundArtifacts(seed, operationIndex + variantIndex + 3);
            supplements.push(buildTaskOrder(seed, {
                ...inboundArtifacts,
                ...outboundArtifacts,
            }));
        }
    });
    return supplements;
}
function normalizeGeneratedTaskOrderForMobile(taskOrder) {
    const sourceTaskNo = taskOrder.sourceTaskNo || `TASK-${taskOrder.taskOrderNo}`;
    const sourceTaskId = taskOrder.sourceTaskId || sourceTaskNo;
    const operation = getSpecialCraftOperationById(taskOrder.operationId);
    const fallbackFactory = operation ? pickFactoryForOperation(operation, 0) : mockFactories.find((factory) => factory.id === TEST_FACTORY_ID);
    const currentFactoryIsReal = Boolean(taskOrder.factoryId && taskOrder.factoryId !== 'WAIT_ASSIGN');
    const assignedFactoryIsReal = Boolean(taskOrder.assignedFactoryId && taskOrder.assignedFactoryId !== 'WAIT_ASSIGN');
    const suggestedFactoryIsReal = Boolean(taskOrder.suggestedFactoryId && taskOrder.suggestedFactoryId !== 'WAIT_ASSIGN');
    const assignedFactoryId = (assignedFactoryIsReal ? taskOrder.assignedFactoryId : undefined)
        || (suggestedFactoryIsReal ? taskOrder.suggestedFactoryId : undefined)
        || (currentFactoryIsReal ? taskOrder.factoryId : fallbackFactory?.id)
        || TEST_FACTORY_ID;
    const assignedFactoryName = (assignedFactoryIsReal ? taskOrder.assignedFactoryName : undefined)
        || (suggestedFactoryIsReal ? taskOrder.suggestedFactoryName : undefined)
        || (currentFactoryIsReal ? taskOrder.factoryName : fallbackFactory?.name)
        || TEST_FACTORY_NAME;
    return {
        ...taskOrder,
        sourceTaskId,
        sourceTaskNo,
        factoryId: assignedFactoryId,
        factoryName: assignedFactoryName,
        generationSource: 'PRODUCTION_ORDER',
        generationSourceLabel: taskOrder.generationSourceLabel || '生产单生成',
        sourceTrigger: 'PRODUCTION_ORDER_CREATED',
        sourceTriggerLabel: taskOrder.sourceTriggerLabel || '生产单自动拆分任务',
        assignmentStatus: 'ASSIGNED',
        assignmentStatusLabel: '已分配',
        executionStatus: taskOrder.executionStatus || mapTaskStatusToExecutionStatus(taskOrder.status),
        executionStatusLabel: taskOrder.executionStatusLabel || taskOrder.status,
        assignedFactoryId,
        assignedFactoryName,
        suggestedFactoryId: taskOrder.suggestedFactoryId || assignedFactoryId,
        suggestedFactoryName: taskOrder.suggestedFactoryName || assignedFactoryName,
        assignmentMode: taskOrder.assignmentMode || '直接派单',
    };
}
function normalizeWorkOrderPartName(line, taskOrder) {
    return line.partName || taskOrder.partName || '未命名部位';
}
function buildWorkOrderKey(taskOrder, line) {
    return [
        taskOrder.taskOrderId,
        taskOrder.factoryId || 'WAIT_ASSIGN',
        normalizeWorkOrderPartName(line, taskOrder),
    ].join('::');
}
function buildWorkOrderId(taskOrder, partName, index) {
    return `${taskOrder.taskOrderId}-WO-${String(index + 1).padStart(3, '0')}-${partName}`.replace(/[^A-Za-z0-9-]/g, '');
}
function buildWorkOrdersFromTaskOrders(taskOrders) {
    const workOrders = [];
    const workOrderLines = [];
    const taskWorkOrderIds = new Map();
    taskOrders.forEach((taskOrder) => {
        const grouped = new Map();
        const lines = taskOrder.demandLines?.length
            ? taskOrder.demandLines
            : [
                {
                    demandLineId: `${taskOrder.taskOrderId}-LINE-01`,
                    taskOrderId: taskOrder.taskOrderId,
                    productionOrderId: taskOrder.productionOrderId,
                    productionOrderNo: taskOrder.productionOrderNo,
                    patternFileId: taskOrder.sourcePatternFileIds?.[0] || `PF-${taskOrder.taskOrderId}`,
                    patternFileName: `${taskOrder.operationName}纸样`,
                    pieceRowId: taskOrder.sourcePieceRowIds?.[0] || `PR-${taskOrder.taskOrderId}`,
                    partName: taskOrder.partName || '未命名部位',
                    colorName: taskOrder.fabricColor || '默认色',
                    colorCode: taskOrder.fabricColor || 'DEFAULT',
                    sizeCode: taskOrder.sizeCode || '均码',
                    pieceCountPerGarment: 1,
                    orderQty: taskOrder.planQty,
                    planPieceQty: taskOrder.planQty,
                    specialCraftKey: `${taskOrder.processCode}:${taskOrder.craftCode}`,
                    operationId: taskOrder.operationId,
                    operationName: taskOrder.operationName,
                    processCode: taskOrder.processCode,
                    processName: taskOrder.processName,
                    craftCode: taskOrder.craftCode,
                    craftName: taskOrder.craftName,
                    targetObject: taskOrder.targetObject,
                    unit: taskOrder.unit,
                    feiTicketNos: [...taskOrder.feiTicketNos],
                },
            ];
        lines.forEach((line) => {
            const key = buildWorkOrderKey(taskOrder, line);
            const list = grouped.get(key) || [];
            list.push(line);
            grouped.set(key, list);
        });
        Array.from(grouped.entries()).forEach(([, groupLines], groupIndex) => {
            const firstLine = groupLines[0];
            const partName = normalizeWorkOrderPartName(firstLine, taskOrder);
            const workOrderId = buildWorkOrderId(taskOrder, partName, groupIndex);
            const planQty = roundQty(groupLines.reduce((total, line) => total + line.planPieceQty, 0));
            const lineIds = groupLines.map((line, lineIndex) => `${workOrderId}-LINE-${String(lineIndex + 1).padStart(3, '0')}`);
            const feiTicketNos = [...new Set(groupLines.flatMap((line) => line.feiTicketNos))];
            const receivedQty = groupIndex === 0 ? taskOrder.receivedQty : 0;
            const scrapQty = groupIndex === 0 ? taskOrder.lossQty || 0 : 0;
            const damageQty = groupIndex === 0 ? taskOrder.damageQty || 0 : 0;
            const returnedQty = groupIndex === 0 ? taskOrder.returnedQty || (taskOrder.status === '已回写' ? taskOrder.waitHandoverQty : 0) : 0;
            const currentQty = groupIndex === 0
                ? taskOrder.currentQty ?? Math.max(taskOrder.completedQty || taskOrder.receivedQty || 0, 0)
                : 0;
            const workOrder = {
                workOrderId,
                workOrderNo: `${taskOrder.taskOrderNo}-部位${String(groupIndex + 1).padStart(2, '0')}`,
                taskOrderId: taskOrder.taskOrderId,
                taskOrderNo: taskOrder.taskOrderNo,
                productionOrderId: taskOrder.productionOrderId,
                productionOrderNo: taskOrder.productionOrderNo,
                operationId: taskOrder.operationId,
                operationName: taskOrder.operationName,
                processCode: taskOrder.processCode,
                processName: taskOrder.processName,
                craftCode: taskOrder.craftCode,
                craftName: taskOrder.craftName,
                factoryId: taskOrder.factoryId || 'WAIT_ASSIGN',
                factoryName: taskOrder.factoryName || '待分配',
                targetObject: taskOrder.targetObject,
                partName,
                planQty,
                receivedQty,
                scrapQty,
                damageQty,
                currentQty,
                returnedQty,
                waitReturnQty: groupIndex === 0 ? taskOrder.waitHandoverQty || 0 : 0,
                status: taskOrder.status,
                openDifferenceReportCount: taskOrder.abnormalStatus === '数量差异' || taskOrder.status === '差异' ? 1 : 0,
                openObjectionCount: taskOrder.status === '异议中' ? 1 : 0,
                feiTicketNos,
                lineIds,
                createdAt: taskOrder.createdAt,
                updatedAt: taskOrder.updatedAt || taskOrder.createdAt,
                remark: '按裁片部位拆分的工艺加工单',
            };
            workOrders.push(workOrder);
            taskWorkOrderIds.set(taskOrder.taskOrderId, [...(taskWorkOrderIds.get(taskOrder.taskOrderId) || []), workOrderId]);
            groupLines.forEach((line, lineIndex) => {
                workOrderLines.push({
                    lineId: lineIds[lineIndex],
                    workOrderId,
                    taskOrderId: taskOrder.taskOrderId,
                    demandLineId: line.demandLineId,
                    partName: line.partName,
                    colorName: line.colorName,
                    colorCode: line.colorCode,
                    sizeCode: line.sizeCode,
                    pieceCountPerGarment: line.pieceCountPerGarment,
                    orderQty: line.orderQty,
                    planPieceQty: line.planPieceQty,
                    currentQty: 0,
                    feiTicketNos: [...line.feiTicketNos],
                    bundleWidthCm: line.bundleWidthCm,
                    bundleLengthCm: line.bundleLengthCm,
                    stripCount: line.stripCount,
                    remark: line.remark,
                });
            });
        });
    });
    const syncedTaskOrders = taskOrders.map((taskOrder) => {
        const matchedWorkOrders = workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrder.taskOrderId);
        return {
            ...taskOrder,
            workOrderIds: taskWorkOrderIds.get(taskOrder.taskOrderId) || [],
            damageQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.damageQty, 0)),
            currentQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.currentQty, 0)),
            returnedQty: roundQty(matchedWorkOrders.reduce((total, workOrder) => total + workOrder.returnedQty, 0)),
            openDifferenceReportCount: matchedWorkOrders.reduce((total, workOrder) => total + workOrder.openDifferenceReportCount, 0),
            openObjectionCount: matchedWorkOrders.reduce((total, workOrder) => total + workOrder.openObjectionCount, 0),
            feiTicketNos: [...new Set([...taskOrder.feiTicketNos, ...matchedWorkOrders.flatMap((workOrder) => workOrder.feiTicketNos)])],
        };
    });
    return {
        workOrders,
        workOrderLines,
        syncedTaskOrders,
    };
}
function ensureStore() {
    if (!specialCraftTaskStore) {
        const generatedResults = generateSpecialCraftTaskOrdersForAllProductionOrders([]);
        const generatedTaskOrders = generatedResults
            .flatMap((item) => item.taskOrders)
            .map((taskOrder) => normalizeGeneratedTaskOrderForMobile(taskOrder));
        const generationBatches = generatedResults.map((item) => item.generationBatch);
        const generationErrors = generatedResults.flatMap((item) => item.errors);
        const supplementalTaskOrders = buildLinkedSupplementTaskOrders(generatedTaskOrders);
        const taskOrders = [...generatedTaskOrders, ...supplementalTaskOrders];
        const workOrderBuild = buildWorkOrdersFromTaskOrders(taskOrders);
        specialCraftTaskStore = {
            taskOrders: workOrderBuild.syncedTaskOrders,
            workOrders: workOrderBuild.workOrders,
            workOrderLines: workOrderBuild.workOrderLines,
            generationBatches,
            generationErrors,
        };
    }
    return specialCraftTaskStore;
}
function matchesKeyword(taskOrder, keyword) {
    if (!keyword)
        return true;
    const normalized = keyword.trim().toLowerCase();
    if (!normalized)
        return true;
    const tokens = [
        taskOrder.taskOrderNo,
        taskOrder.productionOrderNo,
        taskOrder.factoryName,
        taskOrder.partName,
        taskOrder.materialSku,
        ...taskOrder.feiTicketNos,
        ...taskOrder.transferBagNos,
        ...taskOrder.fabricRollNos,
    ];
    return tokens.some((token) => token?.toLowerCase().includes(normalized));
}
function withinTimeRange(dateTime, timeRange) {
    if (!timeRange || timeRange === 'ALL')
        return true;
    const current = new Date('2026-04-23T12:00:00+08:00').getTime();
    const target = new Date(dateTime.replace(' ', 'T')).getTime();
    if (!Number.isFinite(target))
        return true;
    const diff = current - target;
    if (timeRange === 'TODAY')
        return diff <= 24 * 60 * 60 * 1000;
    if (timeRange === '7D')
        return diff <= 7 * 24 * 60 * 60 * 1000;
    return diff <= 30 * 24 * 60 * 60 * 1000;
}
export function getEnabledSpecialCraftOperations() {
    return listEnabledSpecialCraftOperationDefinitions();
}
export function getSpecialCraftOperationBySlug(slug) {
    return getOperationBySlug(slug);
}
export function assertSpecialCraftTaskOrderValid(taskOrder) {
    const operation = getSpecialCraftOperationById(taskOrder.operationId);
    if (!operation || !operation.isEnabled) {
        throw new Error(`非法工艺加工单：${taskOrder.taskOrderNo}`);
    }
    if (operation.processCode !== taskOrder.processCode || operation.craftCode !== taskOrder.craftCode) {
        throw new Error(`工艺加工单编码不匹配：${taskOrder.taskOrderNo}`);
    }
    if (operation.managementDomain !== taskOrder.managementDomain) {
        throw new Error(`工艺加工单管理域不匹配：${taskOrder.taskOrderNo}`);
    }
}
export function getSpecialCraftTaskOrders(operationId, filters = {}) {
    return ensureStore().taskOrders.filter((taskOrder) => {
        if (taskOrder.operationId !== operationId)
            return false;
        if (filters.managementDomain && taskOrder.managementDomain !== filters.managementDomain)
            return false;
        if (filters.factoryId && taskOrder.factoryId !== filters.factoryId)
            return false;
        if (filters.status && filters.status !== '全部' && taskOrder.status !== filters.status)
            return false;
        if (filters.abnormalStatus && filters.abnormalStatus !== '全部' && taskOrder.abnormalStatus !== filters.abnormalStatus)
            return false;
        if (!matchesKeyword(taskOrder, filters.keyword))
            return false;
        if (!withinTimeRange(taskOrder.createdAt, filters.timeRange))
            return false;
        return true;
    });
}
export function getSpecialCraftTaskOrderById(taskOrderId) {
    return ensureStore().taskOrders.find((taskOrder) => taskOrder.taskOrderId === taskOrderId);
}
export function buildSpecialCraftTaskWorkOrders(taskOrders = listSpecialCraftTaskOrders()) {
    const result = buildWorkOrdersFromTaskOrders(taskOrders);
    return {
        workOrders: result.workOrders,
        workOrderLines: result.workOrderLines,
    };
}
export function listSpecialCraftTaskWorkOrders() {
    return [...ensureStore().workOrders];
}
export function listSpecialCraftTaskWorkOrderLines() {
    return [...ensureStore().workOrderLines];
}
export function getSpecialCraftTaskWorkOrdersByTaskOrderId(taskOrderId) {
    return ensureStore().workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrderId);
}
export function getSpecialCraftTaskWorkOrderLinesByWorkOrderId(workOrderId) {
    return ensureStore().workOrderLines.filter((line) => line.workOrderId === workOrderId);
}
export function getSpecialCraftTaskWorkOrderById(workOrderId) {
    return ensureStore().workOrders.find((workOrder) => workOrder.workOrderId === workOrderId);
}
export function getSpecialCraftTaskWorkOrderLineByDemandLineId(taskOrderId, demandLineId) {
    return ensureStore().workOrderLines.find((line) => line.taskOrderId === taskOrderId && line.demandLineId === demandLineId);
}
export function syncSpecialCraftTaskOrderAggregatesFromWorkOrders(taskOrderId) {
    const store = ensureStore();
    const taskOrderIndex = store.taskOrders.findIndex((taskOrder) => taskOrder.taskOrderId === taskOrderId);
    if (taskOrderIndex < 0)
        return undefined;
    const workOrders = store.workOrders.filter((workOrder) => workOrder.taskOrderId === taskOrderId);
    const taskOrder = store.taskOrders[taskOrderIndex];
    const nextTaskOrder = {
        ...taskOrder,
        receivedQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.receivedQty, 0)) || taskOrder.receivedQty,
        lossQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.scrapQty, 0)),
        damageQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.damageQty, 0)),
        currentQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.currentQty, 0)),
        returnedQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.returnedQty, 0)),
        waitHandoverQty: roundQty(workOrders.reduce((total, workOrder) => total + workOrder.waitReturnQty, 0)) || taskOrder.waitHandoverQty,
        openDifferenceReportCount: workOrders.reduce((total, workOrder) => total + workOrder.openDifferenceReportCount, 0),
        openObjectionCount: workOrders.reduce((total, workOrder) => total + workOrder.openObjectionCount, 0),
        feiTicketNos: [...new Set(workOrders.flatMap((workOrder) => workOrder.feiTicketNos))],
        workOrderIds: workOrders.map((workOrder) => workOrder.workOrderId),
        updatedAt: formatDay(0),
    };
    store.taskOrders[taskOrderIndex] = nextTaskOrder;
    return nextTaskOrder;
}
export function updateSpecialCraftTaskWorkOrderWebStatus(workOrderId, payload) {
    const store = ensureStore();
    const workOrderIndex = store.workOrders.findIndex((workOrder) => workOrder.workOrderId === workOrderId);
    if (workOrderIndex < 0)
        return undefined;
    const current = store.workOrders[workOrderIndex];
    const next = {
        ...current,
        status: payload.status,
        currentQty: Number.isFinite(payload.currentQty) ? Number(payload.currentQty) : current.currentQty,
        receivedQty: Number.isFinite(payload.receivedQty) ? Number(payload.receivedQty) : current.receivedQty,
        returnedQty: Number.isFinite(payload.returnedQty) ? Number(payload.returnedQty) : current.returnedQty,
        waitReturnQty: Number.isFinite(payload.waitReturnQty) ? Number(payload.waitReturnQty) : current.waitReturnQty,
        scrapQty: Number.isFinite(payload.scrapQty) ? Number(payload.scrapQty) : current.scrapQty,
        damageQty: Number.isFinite(payload.damageQty) ? Number(payload.damageQty) : current.damageQty,
        openDifferenceReportCount: payload.status === '差异' || payload.status === '异常'
            ? Math.max(current.openDifferenceReportCount, 1)
            : current.openDifferenceReportCount,
        updatedAt: payload.operatedAt || formatDay(0),
        remark: payload.remark?.trim() || current.remark,
    };
    store.workOrders[workOrderIndex] = next;
    const taskOrderIndex = store.taskOrders.findIndex((taskOrder) => taskOrder.taskOrderId === next.taskOrderId);
    if (taskOrderIndex >= 0) {
        const taskOrder = store.taskOrders[taskOrderIndex];
        store.taskOrders[taskOrderIndex] = {
            ...taskOrder,
            status: payload.status,
            executionStatus: payload.status === '已入待加工仓'
                ? 'IN_WAIT_PROCESS_WAREHOUSE'
                : payload.status === '加工中'
                    ? 'PROCESSING'
                    : payload.status === '已完成'
                        ? 'COMPLETED'
                        : payload.status === '待交出'
                            ? 'WAIT_HANDOVER'
                            : payload.status === '已交出'
                                ? 'HANDED_OVER'
                                : payload.status === '已回写'
                                    ? 'WRITTEN_BACK'
                                    : payload.status === '差异'
                                        ? 'DIFFERENCE'
                                        : payload.status === '异议中'
                                            ? 'OBJECTION'
                                            : payload.status === '异常'
                                                ? 'ABNORMAL'
                                                : 'WAIT_PICKUP',
            executionStatusLabel: payload.status,
            abnormalStatus: payload.status === '差异' ? '数量差异' : taskOrder.abnormalStatus,
            updatedAt: payload.operatedAt || formatDay(0),
        };
    }
    syncSpecialCraftTaskOrderAggregatesFromWorkOrders(next.taskOrderId);
    return store.workOrders[workOrderIndex];
}
export function getSpecialCraftWarehouseView(operationId, filters = {}) {
    const operation = getSpecialCraftOperationById(operationId);
    if (!operation) {
        throw new Error(`未找到特殊工艺运营分类：${operationId}`);
    }
    const taskOrders = getSpecialCraftTaskOrders(operationId, filters);
    const factoryIds = [...new Set(taskOrders.map((taskOrder) => taskOrder.factoryId))];
    const waitProcessItems = listFactoryWaitProcessStockItems().filter((item) => item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId));
    const waitHandoverItems = listFactoryWaitHandoverStockItems().filter((item) => item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId));
    const inboundRecords = listFactoryWarehouseInboundRecords().filter((item) => item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId));
    const outboundRecords = listFactoryWarehouseOutboundRecords().filter((item) => item.craftCode === operation.craftCode && (!filters.factoryId || item.factoryId === filters.factoryId));
    const warehouses = listFactoryInternalWarehouses().filter((warehouse) => factoryIds.includes(warehouse.factoryId));
    const nodeRows = factoryIds.flatMap((factoryId) => listFactoryWarehouseNodeRows(factoryId));
    const stocktakeOrders = listFactoryWarehouseStocktakeOrders().filter((order) => factoryIds.includes(order.factoryId));
    return {
        operation,
        factoryIds,
        waitProcessItems,
        waitHandoverItems,
        inboundRecords,
        outboundRecords,
        warehouses,
        nodeRows,
        stocktakeOrders,
    };
}
export function listSpecialCraftTaskOrders() {
    return [...ensureStore().taskOrders];
}
export function listAuxiliaryCraftTaskOrders() {
    return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === 'AUXILIARY_CRAFT_FACTORY');
}
export function listSpecialTypeCraftTaskOrders() {
    return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === 'SPECIAL_CRAFT_FACTORY');
}
export function listSpecialCraftTaskOrdersByManagementDomain(managementDomain) {
    return listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.managementDomain === managementDomain);
}
export function listSpecialCraftGenerationBatches() {
    return [...ensureStore().generationBatches];
}
export function listSpecialCraftGenerationErrors() {
    return [...ensureStore().generationErrors];
}
export function getSpecialCraftTasksByProductionOrder(productionOrderId) {
    return ensureStore().taskOrders.filter((taskOrder) => taskOrder.productionOrderId === productionOrderId);
}
export function getSpecialCraftGenerationBatchByOrderId(productionOrderId) {
    return ensureStore().generationBatches.find((item) => item.productionOrderId === productionOrderId)
        || getSpecialCraftGenerationBatchByProductionOrder(productionOrderId, ensureStore().taskOrders);
}
export function buildSpecialCraftPageTitle(operation, suffix) {
    return `${operation.operationName}${suffix}`;
}
export function getSpecialCraftOperationLabel(operation) {
    return operation.operationName;
}
export function listSpecialCraftOperationSlugs() {
    return listEnabledSpecialCraftOperationDefinitions().map((item) => buildSpecialCraftOperationSlug(item));
}
