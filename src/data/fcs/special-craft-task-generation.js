import { mockFactories } from './factory-mock-data.ts';
import { getProductionOrderTechPackSnapshot, } from './production-order-tech-pack-runtime.ts';
import { productionOrders } from './production-orders.ts';
import { getProcessCraftByCode, normalizeSpecialCraftTargetObjectLabel, } from './process-craft-dict.ts';
import { getDefaultSpecialCraftTargetObject, getSpecialCraftOperationByCraftCode, isSpecialCraftTargetObjectSupported, listEnabledAuxiliaryCraftOperationDefinitions, listEnabledSpecialCraftOperationDefinitions, listEnabledSpecialTypeCraftOperationDefinitions, } from './special-craft-operations.ts';
function toTimestamp(dateTime) {
    if (!dateTime)
        return 0;
    return new Date(dateTime.replace(' ', 'T')).getTime() || 0;
}
function unique(items) {
    return Array.from(new Set(items));
}
function stableHash(input) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
function normalizeText(value) {
    return String(value || '').trim();
}
function buildBlockingError(input) {
    const key = [
        input.productionOrderId,
        input.patternFileId,
        input.pieceRowId,
        input.operationName,
        input.errorType,
        input.colorName,
        input.sizeCode,
    ].join('|');
    return {
        errorId: `SCERR-${stableHash(key)}`,
        ...input,
    };
}
function resolveProductionOrderVersion(order) {
    const lastBreakdownAt = normalizeText(order.taskBreakdownSummary.lastBreakdownAt);
    if (lastBreakdownAt) {
        return `POV-${lastBreakdownAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
    }
    const updatedAt = normalizeText(order.updatedAt || order.createdAt);
    if (updatedAt) {
        return `POV-${updatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
    }
    return 'POV-CURRENT';
}
function resolveProductionOrderNo(order) {
    return normalizeText(order.productionOrderNo) || normalizeText(order.productionOrderId) || 'UNKNOWN-PO';
}
function resolveSuggestedFactory(operation, targetObject = operation.targetObject) {
    const matched = mockFactories
        .filter((factory) => factory.processAbilities.some((ability) => ability.processCode === operation.processCode
        && ability.craftCodes.includes(operation.craftCode)
        && ability.canReceiveTask !== false
        && (ability.status ?? 'ACTIVE') !== 'DISABLED'))
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
    const visibleFactoryIds = new Set(operation.visibleFactoryIds ?? []);
    if (visibleFactoryIds.size > 0) {
        const scoped = matched.find((factory) => visibleFactoryIds.has(factory.id));
        if (scoped) {
            return {
                suggestedFactoryId: scoped.id,
                suggestedFactoryName: scoped.name,
            };
        }
    }
    const preferred = targetObject === '完整面料' || targetObject === '面料'
        ? matched.find((factory) => factory.factoryType === 'CENTRAL_DENIM_WASH')
        : matched.find((factory) => factory.factoryType === 'CENTRAL_SPECIAL' || factory.factoryType === 'SATELLITE_FINISHING');
    const resolved = preferred || matched[0];
    if (!resolved)
        return {};
    return {
        suggestedFactoryId: resolved.id,
        suggestedFactoryName: resolved.name,
    };
}
function getQtyMatrixBySku(order) {
    return new Map(order.demandSnapshot.skuLines.map((line) => [line.skuCode, line]));
}
function getQtyMatrixByColorSize(order) {
    return new Map(order.demandSnapshot.skuLines.map((line) => [`${line.color}::${line.size}`, line]));
}
function isForbiddenSpecialCraft(operation) {
    return operation.craftName === '印花' || operation.craftName === '染色';
}
function getTaskPrefixByOperation(operation) {
    return operation.managementDomain === 'AUXILIARY_CRAFT_FACTORY' ? 'AUX' : 'SPC';
}
function resolveSelectedTargetObject(selectedTargetObject, operation) {
    const normalized = normalizeSpecialCraftTargetObjectLabel(selectedTargetObject);
    if (normalized && isSpecialCraftTargetObjectSupported(operation, normalized)) {
        return normalized;
    }
    return getDefaultSpecialCraftTargetObject(operation);
}
function getDemandLineUnit(targetObject) {
    if (targetObject === '已裁部位' || targetObject === '裁片')
        return '片';
    if (targetObject === '完整面料' || targetObject === '面料')
        return '米';
    return '件';
}
function validateSpecialCraftReference(order, snapshot, patternFileId, pieceRowId, partName, processCode, craftCode, selectedTargetObject, colorName = '', sizeCode = '') {
    const operation = getSpecialCraftOperationByCraftCode(craftCode);
    if (!operation || !operation.isEnabled) {
        return {
            error: buildBlockingError({
                productionOrderId: order.productionOrderId,
                productionOrderNo: resolveProductionOrderNo(order),
                patternFileId,
                pieceRowId,
                partName,
                colorName,
                sizeCode,
                operationName: normalizeText(operation?.operationName || craftCode || processCode || '特殊工艺'),
                errorType: '特殊工艺未启用',
                errorMessage: '特殊工艺未启用',
                blocking: true,
            }),
        };
    }
    const craftDefinition = getProcessCraftByCode(craftCode);
    if (!craftDefinition || !craftDefinition.isActive || !craftDefinition.isSpecialCraft || craftDefinition.processCode !== 'SPECIAL_CRAFT') {
        return {
            error: buildBlockingError({
                productionOrderId: order.productionOrderId,
                productionOrderNo: resolveProductionOrderNo(order),
                patternFileId,
                pieceRowId,
                partName,
                colorName,
                sizeCode,
                operationName: operation.operationName,
                errorType: '特殊工艺字典缺失',
                errorMessage: '特殊工艺字典缺失',
                blocking: true,
            }),
        };
    }
    if (operation.processCode !== processCode || isForbiddenSpecialCraft(operation)) {
        return {
            error: buildBlockingError({
                productionOrderId: order.productionOrderId,
                productionOrderNo: resolveProductionOrderNo(order),
                patternFileId,
                pieceRowId,
                partName,
                colorName,
                sizeCode,
                operationName: operation.operationName,
                errorType: '特殊工艺未启用',
                errorMessage: '特殊工艺未启用',
                blocking: true,
            }),
        };
    }
    const resolvedTargetObject = resolveSelectedTargetObject(selectedTargetObject, operation);
    if (!resolvedTargetObject) {
        return {
            error: buildBlockingError({
                productionOrderId: order.productionOrderId,
                productionOrderNo: resolveProductionOrderNo(order),
                patternFileId,
                pieceRowId,
                partName,
                colorName,
                sizeCode,
                operationName: operation.operationName,
                errorType: '作用对象缺失',
                errorMessage: '作用对象缺失',
                blocking: true,
            }),
        };
    }
    return { operation, selectedTargetObject: resolvedTargetObject };
}
export function validateSpecialCraftDemandLine(demandLine) {
    const errors = [];
    if (!normalizeText(demandLine.partName)) {
        errors.push(buildBlockingError({
            productionOrderId: demandLine.productionOrderId,
            productionOrderNo: demandLine.productionOrderNo,
            patternFileId: demandLine.patternFileId,
            pieceRowId: demandLine.pieceRowId,
            partName: demandLine.partName,
            colorName: demandLine.colorName,
            sizeCode: demandLine.sizeCode,
            operationName: demandLine.operationName,
            errorType: '裁片部位缺失',
            errorMessage: '裁片部位缺失',
            blocking: true,
        }));
    }
    if (!Number.isFinite(demandLine.pieceCountPerGarment) || demandLine.pieceCountPerGarment <= 0) {
        errors.push(buildBlockingError({
            productionOrderId: demandLine.productionOrderId,
            productionOrderNo: demandLine.productionOrderNo,
            patternFileId: demandLine.patternFileId,
            pieceRowId: demandLine.pieceRowId,
            partName: demandLine.partName,
            colorName: demandLine.colorName,
            sizeCode: demandLine.sizeCode,
            operationName: demandLine.operationName,
            errorType: '裁片颜色片数缺失',
            errorMessage: '裁片颜色片数缺失',
            blocking: true,
        }));
    }
    if (demandLine.planPieceQty !== demandLine.pieceCountPerGarment * demandLine.orderQty) {
        errors.push(buildBlockingError({
            productionOrderId: demandLine.productionOrderId,
            productionOrderNo: demandLine.productionOrderNo,
            patternFileId: demandLine.patternFileId,
            pieceRowId: demandLine.pieceRowId,
            partName: demandLine.partName,
            colorName: demandLine.colorName,
            sizeCode: demandLine.sizeCode,
            operationName: demandLine.operationName,
            errorType: '裁片颜色片数缺失',
            errorMessage: '计划片数计算错误',
            blocking: true,
        }));
    }
    return errors;
}
export function buildSpecialCraftTaskDemandLinesFromProductionOrder(input) {
    const { productionOrder } = input;
    const productionOrderNo = resolveProductionOrderNo(productionOrder);
    const techPackSnapshot = input.techPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId);
    const enabledOperations = input.specialCraftOperations ?? listEnabledSpecialCraftOperationDefinitions();
    const operationIdSet = new Set(enabledOperations.map((item) => item.operationId));
    const demandLines = [];
    const errors = [];
    const warnings = [];
    if (!techPackSnapshot) {
        warnings.push(`生产单 ${productionOrderNo} 缺少技术包快照`);
        return { demandLines, errors, warnings };
    }
    const skuMatrixBySku = getQtyMatrixBySku(productionOrder);
    const skuMatrixByColorSize = getQtyMatrixByColorSize(productionOrder);
    techPackSnapshot.patternFiles.forEach((patternFile) => {
        const patternFileId = patternFile.patternFileId || patternFile.id;
        const patternFileName = patternFile.patternFileName || patternFile.fileName || patternFileId;
        const pieceRows = patternFile.pieceRows ?? [];
        pieceRows.forEach((pieceRow) => {
            const partName = normalizeText(pieceRow.name);
            const specialCrafts = pieceRow.specialCrafts ?? [];
            if (specialCrafts.length === 0)
                return;
            if (!partName) {
                specialCrafts.forEach((craft) => {
                    errors.push(buildBlockingError({
                        productionOrderId: productionOrder.productionOrderId,
                        productionOrderNo,
                        patternFileId,
                        pieceRowId: pieceRow.id,
                        partName: '',
                        operationName: normalizeText(craft.displayName || craft.craftName || craft.craftCode),
                        errorType: '裁片部位缺失',
                        errorMessage: '裁片部位缺失',
                        blocking: true,
                    }));
                });
                return;
            }
            const colorAllocations = pieceRow.colorAllocations ?? [];
            if (colorAllocations.length === 0) {
                specialCrafts.forEach((craft) => {
                    errors.push(buildBlockingError({
                        productionOrderId: productionOrder.productionOrderId,
                        productionOrderNo,
                        patternFileId,
                        pieceRowId: pieceRow.id,
                        partName,
                        operationName: normalizeText(craft.displayName || craft.craftName || craft.craftCode),
                        errorType: '裁片颜色片数缺失',
                        errorMessage: '裁片颜色片数缺失',
                        blocking: true,
                    }));
                });
                return;
            }
            specialCrafts.forEach((craft) => {
                const reference = validateSpecialCraftReference(productionOrder, techPackSnapshot, patternFileId, pieceRow.id, partName, craft.processCode, craft.craftCode, craft.selectedTargetObject);
                if (reference.error) {
                    errors.push(reference.error);
                    return;
                }
                const operation = reference.operation;
                if (!operation || !operationIdSet.has(operation.operationId))
                    return;
                const selectedTargetObject = reference.selectedTargetObject || operation.targetObject;
                colorAllocations.forEach((allocation) => {
                    const pieceCountPerGarment = Number(allocation.pieceCount);
                    if (!Number.isFinite(pieceCountPerGarment) || pieceCountPerGarment <= 0) {
                        errors.push(buildBlockingError({
                            productionOrderId: productionOrder.productionOrderId,
                            productionOrderNo,
                            patternFileId,
                            pieceRowId: pieceRow.id,
                            partName,
                            colorName: allocation.colorName,
                            operationName: operation.operationName,
                            errorType: '裁片颜色片数缺失',
                            errorMessage: '裁片颜色片数缺失',
                            blocking: true,
                        }));
                        return;
                    }
                    const candidateOrderLines = (allocation.skuCodes && allocation.skuCodes.length > 0
                        ? allocation.skuCodes
                            .map((skuCode) => skuMatrixBySku.get(skuCode))
                            .filter((line) => Boolean(line))
                        : productionOrder.demandSnapshot.skuLines.filter((line) => line.color === allocation.colorName))
                        .filter((line) => !patternFile.selectedSizeCodes?.length || patternFile.selectedSizeCodes.includes(line.size));
                    if (candidateOrderLines.length === 0) {
                        warnings.push(`${productionOrderNo} / ${patternFileName} / ${partName} / ${allocation.colorName} 未匹配到生产数量`);
                        return;
                    }
                    candidateOrderLines.forEach((orderLine) => {
                        const matchedOrderLine = skuMatrixByColorSize.get(`${orderLine.color}::${orderLine.size}`) ?? orderLine;
                        const orderQty = Number(matchedOrderLine.qty);
                        if (!Number.isFinite(orderQty) || orderQty <= 0) {
                            return;
                        }
                        const demandLine = {
                            demandLineId: `SCDL-${stableHash([productionOrder.productionOrderId, pieceRow.id, operation.operationId, selectedTargetObject, orderLine.skuCode].join('|'))}`,
                            taskOrderId: '',
                            productionOrderId: productionOrder.productionOrderId,
                            productionOrderNo,
                            patternFileId,
                            patternFileName,
                            pieceRowId: pieceRow.id,
                            partName,
                            colorName: orderLine.color,
                            colorCode: allocation.colorCode || orderLine.color,
                            sizeCode: orderLine.size,
                            pieceCountPerGarment,
                            orderQty,
                            planPieceQty: pieceCountPerGarment * orderQty,
                            specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${selectedTargetObject}`,
                            operationId: operation.operationId,
                            operationName: operation.operationName,
                            managementDomain: operation.managementDomain,
                            managementDomainName: operation.managementDomainName,
                            processCode: operation.processCode,
                            processName: operation.processName,
                            craftCode: operation.craftCode,
                            craftName: operation.craftName,
                            targetObject: selectedTargetObject,
                            unit: getDemandLineUnit(selectedTargetObject),
                            feiTicketNos: [],
                            bundleLengthCm: pieceRow.bundleLengthCm,
                            bundleWidthCm: pieceRow.bundleWidthCm,
                            remark: '',
                        };
                        errors.push(...validateSpecialCraftDemandLine(demandLine));
                        demandLines.push(demandLine);
                    });
                });
            });
        });
    });
    techPackSnapshot.processEntries
        .filter((entry) => entry.processCode === 'SPECIAL_CRAFT')
        .filter((entry) => Boolean(entry.craftCode))
        .filter((entry) => normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject) === '成衣半成品')
        .forEach((entry) => {
        const craftCode = normalizeText(entry.craftCode);
        const entryId = normalizeText(entry.id) || craftCode;
        const partName = '成衣半成品';
        const patternFileId = `GARMENT-${entryId}`;
        const pieceRowId = `GARMENT-${entryId}`;
        const reference = validateSpecialCraftReference(productionOrder, techPackSnapshot, patternFileId, pieceRowId, partName, entry.processCode, craftCode, entry.selectedTargetObject);
        if (reference.error) {
            errors.push(reference.error);
            return;
        }
        const operation = reference.operation;
        if (!operation || !operationIdSet.has(operation.operationId))
            return;
        const selectedTargetObject = reference.selectedTargetObject || operation.targetObject;
        productionOrder.demandSnapshot.skuLines.forEach((orderLine) => {
            const orderQty = Number(orderLine.qty);
            if (!Number.isFinite(orderQty) || orderQty <= 0)
                return;
            const demandLine = {
                demandLineId: `SCDL-${stableHash([productionOrder.productionOrderId, entryId, operation.operationId, selectedTargetObject, orderLine.skuCode].join('|'))}`,
                taskOrderId: '',
                productionOrderId: productionOrder.productionOrderId,
                productionOrderNo,
                patternFileId,
                patternFileName: '成衣半成品',
                pieceRowId,
                partName,
                colorName: orderLine.color,
                colorCode: orderLine.color,
                sizeCode: orderLine.size,
                pieceCountPerGarment: 1,
                orderQty,
                planPieceQty: orderQty,
                specialCraftKey: `${operation.managementDomain}:${operation.processCode}:${operation.craftCode}:${selectedTargetObject}`,
                operationId: operation.operationId,
                operationName: operation.operationName,
                managementDomain: operation.managementDomain,
                managementDomainName: operation.managementDomainName,
                processCode: operation.processCode,
                processName: operation.processName,
                craftCode: operation.craftCode,
                craftName: operation.craftName,
                targetObject: selectedTargetObject,
                unit: getDemandLineUnit(selectedTargetObject),
                feiTicketNos: [],
                remark: entry.remark || '纯色 T-shirt 成衣半成品烫画，按 SKU 件数执行。',
            };
            errors.push(...validateSpecialCraftDemandLine(demandLine));
            demandLines.push(demandLine);
        });
    });
    return {
        demandLines,
        errors,
        warnings: unique(warnings),
    };
}
function summarizeSingleValue(values, multipleLabel) {
    const normalized = unique(values.map((item) => normalizeText(item)).filter(Boolean));
    if (normalized.length === 0)
        return '';
    if (normalized.length === 1)
        return normalized[0];
    return multipleLabel;
}
export function getSpecialCraftGenerationKey(input) {
    const signature = input.demandLines
        .map((line) => [
        line.patternFileId,
        line.pieceRowId,
        line.partName,
        line.colorName,
        line.sizeCode,
        line.pieceCountPerGarment,
        line.orderQty,
        line.planPieceQty,
    ].join(':'))
        .sort()
        .join('|');
    return stableHash([
        input.productionOrderId,
        input.productionOrderVersion,
        input.techPackSnapshotId,
        input.managementDomain,
        input.operationId,
        input.targetObject,
        signature,
    ].join('::'));
}
function buildInitialNodeRecord(taskOrder) {
    return {
        nodeRecordId: `${taskOrder.taskOrderId}-NODE-01`,
        taskOrderId: taskOrder.taskOrderId,
        nodeName: '待领料',
        actionName: '生产单生成',
        beforeStatus: '待领料',
        afterStatus: '待领料',
        qty: taskOrder.planQty,
        unit: taskOrder.unit,
        operatorName: '系统',
        operatedAt: taskOrder.createdAt,
        relatedRecordNo: taskOrder.productionOrderNo,
        relatedRecordType: '任务记录',
        photoCount: 0,
        remark: '由生产单生成时根据技术包快照自动生成。',
    };
}
function buildTaskOrderId(order, operation, generationKey, index) {
    const prefix = getTaskPrefixByOperation(operation);
    return `${prefix}-TASK-${order.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${operation.operationId.slice(-4)}-${generationKey.slice(0, 6)}-${String(index + 1).padStart(2, '0')}`;
}
function buildTaskOrderNo(order, operation, index) {
    const orderNo = resolveProductionOrderNo(order).replace(/^PO-/, '');
    const craftShortCode = operation.craftCode.replace('CRAFT_', '').replace(/^0+/, '').slice(-4) || operation.operationId.slice(-4);
    return `${getTaskPrefixByOperation(operation)}-${orderNo}-${craftShortCode}-${String(index + 1).padStart(2, '0')}`;
}
function mergeDemandLinesIntoTaskOrder(input) {
    const { order, snapshot, operation, demandLines, generationBatchId, generationKey, taskIndex, existingTask } = input;
    const planQty = demandLines.reduce((sum, line) => sum + line.planPieceQty, 0);
    const sourcePieceRowIds = unique(demandLines.map((line) => line.pieceRowId));
    const sourcePatternFileIds = unique(demandLines.map((line) => line.patternFileId));
    const sourceSpecialCraftKeys = unique(demandLines.map((line) => line.specialCraftKey));
    const partName = summarizeSingleValue(demandLines.map((line) => line.partName), `${sourcePieceRowIds.length}个部位`);
    const fabricColor = summarizeSingleValue(demandLines.map((line) => line.colorName), '多颜色');
    const sizeCode = summarizeSingleValue(demandLines.map((line) => line.sizeCode), '多尺码');
    const targetObject = demandLines[0]?.targetObject || operation.targetObject;
    const { suggestedFactoryId, suggestedFactoryName } = resolveSuggestedFactory(operation, targetObject);
    const productionOrderVersion = resolveProductionOrderVersion(order);
    const productionOrderNo = resolveProductionOrderNo(order);
    const taskOrder = {
        taskOrderId: existingTask?.taskOrderId || buildTaskOrderId(order, operation, generationKey, taskIndex),
        taskOrderNo: existingTask?.taskOrderNo || buildTaskOrderNo(order, operation, taskIndex),
        operationId: operation.operationId,
        operationName: operation.operationName,
        managementDomain: operation.managementDomain,
        managementDomainName: operation.managementDomainName,
        processCode: operation.processCode,
        processName: operation.processName,
        craftCode: operation.craftCode,
        craftName: operation.craftName,
        factoryId: existingTask?.factoryId || 'WAIT_ASSIGN',
        factoryName: existingTask?.factoryName || '待分配',
        productionOrderId: order.productionOrderId,
        productionOrderNo,
        productionOrderVersion,
        techPackSnapshotId: snapshot.snapshotId,
        techPackVersion: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
        sourceTaskId: existingTask?.sourceTaskId,
        sourceTaskNo: existingTask?.sourceTaskNo,
        targetObject,
        partName,
        fabricColor,
        sizeCode,
        feiTicketNos: [],
        transferBagNos: [],
        fabricRollNos: [],
        materialSku: summarizeSingleValue(demandLines.map((line) => line.patternFileName), ''),
        planQty,
        receivedQty: existingTask?.receivedQty || 0,
        completedQty: existingTask?.completedQty || 0,
        lossQty: existingTask?.lossQty || 0,
        waitHandoverQty: existingTask?.waitHandoverQty || 0,
        unit: demandLines[0]?.unit || '片',
        status: existingTask?.status || '待领料',
        abnormalStatus: existingTask?.abnormalStatus || '无异常',
        dueAt: order.planEndDate || order.demandSnapshot.requiredDeliveryDate || order.updatedAt,
        createdAt: order.updatedAt || order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
        generationBatchId,
        generationSource: 'PRODUCTION_ORDER',
        generationSourceLabel: '生产单生成',
        sourceTrigger: 'PRODUCTION_ORDER_CREATED',
        sourceTriggerLabel: '生产单生成',
        assignmentStatus: existingTask?.assignmentStatus || 'WAIT_ASSIGN',
        assignmentStatusLabel: existingTask?.assignmentStatusLabel || '待分配',
        executionStatus: existingTask?.executionStatus || 'WAIT_PICKUP',
        executionStatusLabel: existingTask?.executionStatusLabel || '待领料',
        demandLines: demandLines.map((line) => ({
            ...line,
            taskOrderId: existingTask?.taskOrderId || buildTaskOrderId(order, operation, generationKey, taskIndex),
        })),
        sourcePieceRowIds,
        sourcePatternFileIds,
        sourceSpecialCraftKeys,
        waitProcessStockItemIds: existingTask?.waitProcessStockItemIds || [],
        waitHandoverStockItemIds: existingTask?.waitHandoverStockItemIds || [],
        inboundRecordIds: existingTask?.inboundRecordIds || [],
        outboundRecordIds: existingTask?.outboundRecordIds || [],
        validationWarnings: existingTask?.validationWarnings || [],
        isGenerated: true,
        isManualCreated: false,
        generationKey,
        suggestedFactoryId,
        suggestedFactoryName,
        assignedFactoryId: existingTask?.assignedFactoryId || existingTask?.factoryId || 'WAIT_ASSIGN',
        assignedFactoryName: existingTask?.assignedFactoryName || existingTask?.factoryName || '待分配',
        assignmentMode: existingTask?.assignmentMode,
        nodeRecords: existingTask?.nodeRecords?.length ? existingTask.nodeRecords : [],
        warehouseLinks: existingTask?.warehouseLinks?.length ? existingTask.warehouseLinks : [],
        abnormalRecords: existingTask?.abnormalRecords?.length ? existingTask.abnormalRecords : [],
        remark: existingTask?.remark || '由生产单生成时根据技术包快照自动生成。',
    };
    if (taskOrder.nodeRecords.length === 0) {
        taskOrder.nodeRecords = [buildInitialNodeRecord(taskOrder)];
    }
    if (taskOrder.warehouseLinks.length === 0) {
        taskOrder.warehouseLinks = [];
    }
    if (taskOrder.abnormalRecords.length === 0) {
        taskOrder.abnormalRecords = [];
    }
    return taskOrder;
}
export function validateSpecialCraftTaskGenerationResult(result) {
    const taskIds = new Set();
    result.taskOrders.forEach((taskOrder) => {
        if (taskIds.has(taskOrder.taskOrderId)) {
            throw new Error(`工艺加工单重复：${taskOrder.taskOrderId}`);
        }
        taskIds.add(taskOrder.taskOrderId);
        const operation = getSpecialCraftOperationByCraftCode(taskOrder.craftCode);
        if (!operation || operation.managementDomain !== taskOrder.managementDomain) {
            throw new Error(`工艺加工单管理域错误：${taskOrder.taskOrderNo}`);
        }
    });
}
export function generateSpecialCraftTaskOrdersFromProductionOrder(input) {
    const { productionOrder } = input;
    const techPackSnapshot = input.techPackSnapshot ?? getProductionOrderTechPackSnapshot(productionOrder.productionOrderId);
    const existingGeneratedTasks = input.existingGeneratedTasks ?? [];
    const productionOrderVersion = resolveProductionOrderVersion(productionOrder);
    const generationBatchId = `SCB-${stableHash([productionOrder.productionOrderId, productionOrderVersion, techPackSnapshot?.snapshotId || 'NOSNAPSHOT'].join('|'))}`;
    const generatedAt = productionOrder.updatedAt || productionOrder.createdAt;
    if (!techPackSnapshot) {
        const generationBatch = {
            generationBatchId,
            productionOrderId: productionOrder.productionOrderId,
            productionOrderNo: resolveProductionOrderNo(productionOrder),
            productionOrderVersion,
            techPackSnapshotId: '',
            techPackVersion: '',
            generatedAt,
            generatedBy: '系统',
            generatedTaskOrderIds: [],
            generatedLineCount: 0,
            status: '已跳过',
            errorList: [],
            warningList: ['生产单缺少技术包快照'],
        };
        return {
            taskOrders: [],
            generationBatch,
            errors: [],
            warnings: ['生产单缺少技术包快照'],
            demandLines: [],
        };
    }
    const { demandLines, errors, warnings } = buildSpecialCraftTaskDemandLinesFromProductionOrder({
        productionOrder,
        techPackSnapshot,
        specialCraftOperations: input.specialCraftOperations,
    });
    const blockingErrors = errors.filter((item) => item.blocking);
    if (blockingErrors.length > 0) {
        const generationBatch = {
            generationBatchId,
            productionOrderId: productionOrder.productionOrderId,
            productionOrderNo: resolveProductionOrderNo(productionOrder),
            productionOrderVersion,
            techPackSnapshotId: techPackSnapshot.snapshotId,
            techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
            generatedAt,
            generatedBy: '系统',
            generatedTaskOrderIds: [],
            generatedLineCount: demandLines.length,
            status: '生成失败',
            errorList: blockingErrors,
            warningList: warnings,
        };
        return {
            taskOrders: [],
            generationBatch,
            errors: blockingErrors,
            warnings,
            demandLines,
        };
    }
    if (demandLines.length === 0) {
        const generationBatch = {
            generationBatchId,
            productionOrderId: productionOrder.productionOrderId,
            productionOrderNo: resolveProductionOrderNo(productionOrder),
            productionOrderVersion,
            techPackSnapshotId: techPackSnapshot.snapshotId,
            techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
            generatedAt,
            generatedBy: '系统',
            generatedTaskOrderIds: [],
            generatedLineCount: 0,
            status: '已跳过',
            errorList: [],
            warningList: warnings,
        };
        return {
            taskOrders: [],
            generationBatch,
            errors: [],
            warnings,
            demandLines,
        };
    }
    const grouped = new Map();
    demandLines.forEach((line) => {
        const operation = getSpecialCraftOperationByCraftCode(line.craftCode);
        if (!operation)
            return;
        const key = [line.productionOrderId, line.managementDomain, line.operationId, line.targetObject, 'WAIT_ASSIGN'].join('::');
        const current = grouped.get(key);
        if (current) {
            current.demandLines.push(line);
            return;
        }
        grouped.set(key, {
            operation,
            demandLines: [line],
        });
    });
    const existingByGenerationKey = new Map(existingGeneratedTasks.map((task) => [task.generationKey, task]));
    const existingByOrder = existingGeneratedTasks.filter((task) => task.productionOrderId === productionOrder.productionOrderId);
    const taskOrders = Array.from(grouped.values()).map(({ operation, demandLines: groupDemandLines }, index) => {
        const generationKey = getSpecialCraftGenerationKey({
            productionOrderId: productionOrder.productionOrderId,
            productionOrderVersion,
            techPackSnapshotId: techPackSnapshot.snapshotId,
            managementDomain: operation.managementDomain,
            operationId: operation.operationId,
            targetObject: groupDemandLines[0]?.targetObject || operation.targetObject,
            demandLines: groupDemandLines,
        });
        const existingTask = existingByGenerationKey.get(generationKey);
        return mergeDemandLinesIntoTaskOrder({
            order: productionOrder,
            snapshot: techPackSnapshot,
            operation,
            demandLines: groupDemandLines,
            generationBatchId,
            generationKey,
            taskIndex: index,
            existingTask,
        });
    });
    if (existingByOrder.some((task) => !taskOrders.some((item) => item.generationKey === task.generationKey) && itemHasExecution(task))) {
        warnings.push('工艺加工单已有执行记录，需人工处理');
    }
    const generationBatch = {
        generationBatchId,
        productionOrderId: productionOrder.productionOrderId,
        productionOrderNo: resolveProductionOrderNo(productionOrder),
        productionOrderVersion,
        techPackSnapshotId: techPackSnapshot.snapshotId,
        techPackVersion: techPackSnapshot.sourceTechPackVersionLabel || techPackSnapshot.versionLabel,
        generatedAt,
        generatedBy: '系统',
        generatedTaskOrderIds: taskOrders.map((task) => task.taskOrderId),
        generatedLineCount: demandLines.length,
        status: '已生成',
        errorList: [],
        warningList: unique(warnings),
    };
    const result = {
        taskOrders,
        generationBatch,
        errors: [],
        warnings: unique(warnings),
        demandLines,
    };
    validateSpecialCraftTaskGenerationResult(result);
    return result;
}
export function generateAuxiliaryCraftTaskOrdersFromProductionOrder(input) {
    return generateSpecialCraftTaskOrdersFromProductionOrder({
        ...input,
        specialCraftOperations: listEnabledAuxiliaryCraftOperationDefinitions(),
    });
}
export function generateSpecialTypeCraftTaskOrdersFromProductionOrder(input) {
    return generateSpecialCraftTaskOrdersFromProductionOrder({
        ...input,
        specialCraftOperations: listEnabledSpecialTypeCraftOperationDefinitions(),
    });
}
function itemHasExecution(task) {
    return task.executionStatus !== 'WAIT_PICKUP'
        || task.inboundRecordIds.length > 0
        || task.outboundRecordIds.length > 0
        || task.waitProcessStockItemIds.length > 0
        || task.waitHandoverStockItemIds.length > 0;
}
export function attachSpecialCraftTasksToProductionArtifacts(input) {
    const productionOrder = productionOrders.find((item) => item.productionOrderId === input.orderId);
    if (!productionOrder) {
        return {
            orderId: input.orderId,
            artifacts: input.artifacts,
            specialCraftTaskOrders: [],
            specialCraftGenerationBatch: {
                generationBatchId: `SCB-${stableHash(input.orderId)}`,
                productionOrderId: input.orderId,
                productionOrderNo: input.orderId,
                productionOrderVersion: 'POV-CURRENT',
                techPackSnapshotId: '',
                techPackVersion: '',
                generatedAt: '',
                generatedBy: '系统',
                generatedTaskOrderIds: [],
                generatedLineCount: 0,
                status: '已跳过',
                errorList: [],
                warningList: ['未找到生产单'],
            },
            specialCraftGenerationErrors: [],
            specialCraftGenerationWarnings: ['未找到生产单'],
        };
    }
    const result = generateSpecialCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks: input.existingGeneratedTasks,
    });
    return {
        orderId: input.orderId,
        artifacts: input.artifacts,
        specialCraftTaskOrders: result.taskOrders,
        specialCraftGenerationBatch: result.generationBatch,
        specialCraftGenerationErrors: result.errors,
        specialCraftGenerationWarnings: result.warnings,
    };
}
export function getGeneratedSpecialCraftTasksByProductionOrder(productionOrderId, existingGeneratedTasks = []) {
    const productionOrder = productionOrders.find((item) => item.productionOrderId === productionOrderId);
    if (!productionOrder)
        return [];
    return generateSpecialCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks,
    }).taskOrders;
}
export function getSpecialCraftGenerationBatchByProductionOrder(productionOrderId, existingGeneratedTasks = []) {
    const productionOrder = productionOrders.find((item) => item.productionOrderId === productionOrderId);
    if (!productionOrder)
        return undefined;
    return generateSpecialCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks,
    }).generationBatch;
}
export function generateSpecialCraftTaskOrdersForAllProductionOrders(existingGeneratedTasks = []) {
    return productionOrders.map((productionOrder) => generateSpecialCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks,
    }));
}
export function generateAuxiliaryCraftTaskOrdersForAllProductionOrders(existingGeneratedTasks = []) {
    return productionOrders.map((productionOrder) => generateAuxiliaryCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks,
    }));
}
export function generateSpecialTypeCraftTaskOrdersForAllProductionOrders(existingGeneratedTasks = []) {
    return productionOrders.map((productionOrder) => generateSpecialTypeCraftTaskOrdersFromProductionOrder({
        productionOrder,
        existingGeneratedTasks,
    }));
}
