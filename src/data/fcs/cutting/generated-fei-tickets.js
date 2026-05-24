import { getProductionOrderTechPackSnapshot, } from '../production-orders.ts';
import { listGeneratedCutOrderSourceRecords, } from './generated-cut-orders.ts';
import { encodeFeiTicketQr } from './qr-codes.ts';
import { createEmptyStore, CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, deserializeMarkerSpreadingStorage, } from '../../../pages/process-factory/cutting/marker-spreading-model.ts';
import { listSpreadingDifferencesBySpreadingOrder, } from './spreading-differences.ts';
export const FEI_TICKET_SOURCE_BASIS = '实际裁剪产出';
export const FEI_TICKET_SOURCE_BASIS_TYPE = 'ACTUAL_CUTTING_OUTPUT';
export const FEI_TICKET_WAITING_SOURCE_BASIS_TYPE = 'WAITING_ACTUAL_CUTTING_OUTPUT';
function normalizeText(value) {
    return String(value || '').trim();
}
function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function normalizeBusinessText(value, defaultText) {
    return normalizeText(value) || defaultText;
}
function formatPieceSetRange(start, end) {
    const safeStart = Math.max(Math.floor(start || 1), 1);
    const safeEnd = Math.max(Math.floor(end || safeStart), safeStart);
    return safeStart === safeEnd ? String(safeStart) : `${safeStart}-${safeEnd}`;
}
function compareFeiRecords(left, right) {
    const orderCompare = left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN');
    if (orderCompare !== 0)
        return orderCompare;
    const sessionCompare = left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN');
    if (sessionCompare !== 0)
        return sessionCompare;
    return left.feiTicketNo.localeCompare(right.feiTicketNo, 'zh-CN');
}
function compareOutputLines(left, right) {
    return (left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.fabricRollNo.localeCompare(right.fabricRollNo, 'zh-CN')
        || left.fabricColor.localeCompare(right.fabricColor, 'zh-CN')
        || left.sizeCode.localeCompare(right.sizeCode, 'zh-CN')
        || left.bundleNo.localeCompare(right.bundleNo, 'zh-CN')
        || left.partName.localeCompare(right.partName, 'zh-CN'));
}
const feiTicketGenerationReasonTextMap = {
    SPREADING_ORDER_NOT_FOUND: '铺布单不存在',
    SPREADING_NOT_CUT_DONE: '铺布单尚未完成裁剪',
    MISSING_ACTUAL_OUTPUT: '缺少实际裁剪产出',
    ACTUAL_OUTPUT_ZERO: '实际裁片数量为 0',
    MISSING_CUT_ORDER: '缺少裁片单',
    MISSING_MATERIAL_IDENTITY: '缺少面料信息',
    MISSING_PATTERN_IDENTITY: '缺少纸样信息',
    DIFFERENCE_PENDING: '差异尚未处理',
    FEI_TICKET_ALREADY_GENERATED: '已生成菲票',
};
function hasMaterialIdentity(identity) {
    return Boolean(normalizeText(identity?.materialSku)
        && normalizeText(identity?.materialName)
        && normalizeText(identity?.materialColor));
}
function hasPatternIdentity(identity) {
    return Boolean(normalizeText(identity?.patternFileId)
        && normalizeText(identity?.patternFileName)
        && normalizeText(identity?.patternVersion));
}
function hasPendingBlockingDifference(differences) {
    return differences.some((difference) => difference.differenceLevel === '需处理' &&
        (difference.handlingStatus === '待处理' || difference.handlingStatus === '处理中'));
}
function resolveDifferenceHandlingStatusForSession(session) {
    const differences = listSpreadingDifferencesBySpreadingOrder(session.spreadingSessionId, {
        sessions: [session],
    });
    if (!differences.length)
        return '无差异';
    if (hasPendingBlockingDifference(differences))
        return '待处理';
    if (differences.some((difference) => difference.handlingStatus === '仅记录'))
        return '仅记录差异';
    return '继续补排';
}
function hasBlockingDifferenceForFeiGeneration(session) {
    return resolveDifferenceHandlingStatusForSession(session) === '待处理';
}
export function evaluateFeiTicketGenerationEligibility(output) {
    const reasonCodes = [];
    if (!output) {
        reasonCodes.push('MISSING_ACTUAL_OUTPUT');
        return {
            sourceOutputId: '',
            canGenerate: false,
            reasonCodes,
            reasonTexts: reasonCodes.map((code) => feiTicketGenerationReasonTextMap[code]),
        };
    }
    if (!normalizeText(output.spreadingOrderId))
        reasonCodes.push('SPREADING_ORDER_NOT_FOUND');
    if (!normalizeText(output.cuttingCompletedAt))
        reasonCodes.push('SPREADING_NOT_CUT_DONE');
    if (normalizePositiveInteger(output.actualPieceQty) <= 0)
        reasonCodes.push('ACTUAL_OUTPUT_ZERO');
    if (!normalizeText(output.cutOrderId))
        reasonCodes.push('MISSING_CUT_ORDER');
    if (!hasMaterialIdentity(output.materialIdentity))
        reasonCodes.push('MISSING_MATERIAL_IDENTITY');
    if (!hasPatternIdentity(output.patternIdentity))
        reasonCodes.push('MISSING_PATTERN_IDENTITY');
    if (output.differenceHandlingStatus === '待处理' || output.differenceHandlingStatus === '需要补录') {
        reasonCodes.push('DIFFERENCE_PENDING');
    }
    if (output.generatedFeiTicketIds.length)
        reasonCodes.push('FEI_TICKET_ALREADY_GENERATED');
    return {
        sourceOutputId: output.outputId,
        canGenerate: reasonCodes.length === 0,
        reasonCodes,
        reasonTexts: reasonCodes.map((code) => feiTicketGenerationReasonTextMap[code]),
    };
}
function resolveSecondaryCrafts(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    const processEntries = snapshot?.processEntries || [];
    const secondaryCrafts = unique(processEntries
        .filter((entry) => entry.isSpecialCraft)
        .map((entry) => normalizeText(entry.craftName) || normalizeText(entry.processName))
        .filter(Boolean));
    return {
        secondaryCrafts,
        craftSequenceVersion: `${normalizeText(snapshot?.sourceTechPackVersionLabel) || 'v0'}:${secondaryCrafts.length || 0}`,
    };
}
function buildFallbackSkuScope(record) {
    if (record.skuScopeLines.length)
        return record.skuScopeLines;
    return [
        {
            skuCode: record.cutOrderNo,
            color: record.colorScope[0] || '待补颜色',
            size: '均码',
            plannedQty: Math.max(record.requiredQty, 1),
        },
    ];
}
function buildFallbackPieceRows(record) {
    if (record.pieceRows.length)
        return record.pieceRows;
    return [
        {
            partCode: record.materialSku,
            partName: record.pieceSummary || '整单裁片',
            pieceCountPerUnit: 1,
            patternId: '',
            patternName: '',
            applicableSkuCodes: [],
        },
    ];
}
function buildFeiTicketNo(cutOrderNo, sequenceNo) {
    return `FT-${cutOrderNo}-${String(sequenceNo).padStart(3, '0')}`;
}
function normalizePositiveInteger(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(Math.round(value), 0);
}
function hasActualCutOutput(session) {
    const sessionActual = normalizePositiveInteger((session.actualCutGarmentQty ?? session.actualCutPieceQty) || 0);
    if (sessionActual > 0)
        return true;
    return (session.rolls || []).some((roll) => normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0) > 0 ||
        normalizePositiveInteger(roll.layerCount || 0) > 0);
}
function isReadyForFeiGeneration(session) {
    if (session.status !== 'DONE')
        return false;
    if (session.cuttingStatus !== 'CUTTING_DONE')
        return false;
    if (!hasActualCutOutput(session))
        return false;
    if (hasBlockingDifferenceForFeiGeneration(session))
        return false;
    const warning = session.replenishmentWarning;
    if (!warning)
        return true;
    if (warning.suggestedAction === '无需补料')
        return true;
    return Boolean(warning.handled);
}
function resolveSourceRecordForLine(sourceRecords, line) {
    return (sourceRecords.find((record) => record.cutOrderId === line.cutOrderId &&
        normalizeText(record.materialSku) === normalizeText(line.materialSku)) ||
        sourceRecords.find((record) => record.cutOrderId === line.cutOrderId) ||
        null);
}
function resolveColorScopedSkuLines(sourceRecord, color) {
    const scoped = buildFallbackSkuScope(sourceRecord).filter((line) => normalizeText(line.color) === normalizeText(color));
    return scoped.length ? scoped : buildFallbackSkuScope(sourceRecord);
}
function splitGarmentQtyBySize(skuScopeLines, targetGarmentQty) {
    const normalizedTarget = normalizePositiveInteger(targetGarmentQty);
    if (!normalizedTarget)
        return [];
    const normalizedLines = (skuScopeLines.length ? skuScopeLines : buildFallbackSkuScope({
        cutOrderId: '',
        cutOrderNo: '',
        productionOrderId: '',
        productionOrderNo: '',
        materialSku: '',
        colorScope: ['待补颜色'],
        skuScopeLines: [],
        pieceRows: [],
        requiredQty: normalizedTarget,
        pieceSummary: '',
        sourceTechPackSpuCode: '',
    })).map((line, index) => ({
        skuCode: normalizeText(line.skuCode) || `SKU-${index + 1}`,
        color: normalizeText(line.color) || '待补颜色',
        size: normalizeText(line.size) || '均码',
        plannedQty: Math.max(Number(line.plannedQty || 0), 0),
    }));
    const plannedTotal = normalizedLines.reduce((sum, line) => sum + line.plannedQty, 0);
    if (plannedTotal <= 0) {
        return [
            {
                skuCode: normalizedLines[0]?.skuCode || 'SKU-001',
                color: normalizedLines[0]?.color || '待补颜色',
                size: normalizedLines[0]?.size || '均码',
                garmentQty: normalizedTarget,
            },
        ];
    }
    const rawRows = normalizedLines.map((line, index) => {
        const rawQty = (line.plannedQty / plannedTotal) * normalizedTarget;
        const floorQty = Math.floor(rawQty);
        return {
            index,
            skuCode: line.skuCode,
            color: line.color,
            size: line.size,
            floorQty,
            fraction: rawQty - floorQty,
        };
    });
    let remainder = normalizedTarget - rawRows.reduce((sum, row) => sum + row.floorQty, 0);
    rawRows
        .slice()
        .sort((left, right) => right.fraction - left.fraction || right.floorQty - left.floorQty || left.index - right.index)
        .forEach((row) => {
        if (remainder <= 0)
            return;
        rawRows[row.index] = {
            ...rawRows[row.index],
            floorQty: rawRows[row.index].floorQty + 1,
        };
        remainder -= 1;
    });
    return rawRows
        .filter((row) => row.floorQty > 0)
        .map((row) => ({
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        garmentQty: row.floorQty,
    }));
}
function buildBundleNo(index) {
    return `BUNDLE-${String(index + 1).padStart(3, '0')}`;
}
function readStoredMarkerSpreadingStore() {
    const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
        ? localStorage
        : null;
    if (!storage)
        return createEmptyStore();
    const raw = storage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY);
    if (!raw)
        return createEmptyStore();
    try {
        return deserializeMarkerSpreadingStorage(raw);
    }
    catch {
        return createEmptyStore();
    }
}
function buildCompletedSpreadingSeedStore(sourceRecords) {
    const seedRecords = ['CUT-260307-102-01', 'CUT-260307-102-02']
        .map((cutOrderNo) => sourceRecords.find((record) => record.cutOrderNo === cutOrderNo || record.cutOrderId === cutOrderNo))
        .filter((record) => Boolean(record));
    if (!seedRecords.length)
        return createEmptyStore();
    const sessionId = 'spreading-session-marker-plan-ref-marker-plan-ref-mb-030102-02-planned-100-actual-80-c';
    const sessionNo = 'PB-2440';
    const markerPlanId = seedRecords[0]?.markerPlanId || 'marker-plan-ref:MB-030102-02';
    const markerPlanNo = seedRecords[0]?.markerPlanNo || 'MB-030102-02';
    const completedAt = '2026-03-14 20:00';
    const actualCutQuantities = [557, 613];
    const rolls = seedRecords.map((record, index) => {
        const color = record.colorScope[0] || (index === 0 ? 'Navy' : 'Khaki');
        const layerCount = index === 0 ? 50 : 30;
        return {
            rollRecordId: `roll-step12-${record.cutOrderId}`,
            rollNo: `ROLL-STEP12-${index + 1}`,
            materialSku: record.materialSku,
            color,
            planUnitId: `plan-unit-step12-${record.cutOrderId}`,
            layerCount,
            actualCutGarmentQty: actualCutQuantities[index] || 0,
            actualCutPieceQty: actualCutQuantities[index] || 0,
            actualLength: index === 0 ? 35 : 31,
        };
    });
    const session = {
        spreadingSessionId: sessionId,
        sessionNo,
        status: 'DONE',
        cuttingStatus: 'CUTTING_DONE',
        cutOrderIds: seedRecords.map((record) => record.cutOrderId),
        cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
        contextType: 'marker-plan-ref',
        markerPlanId,
        markerPlanNo,
        sourceMarkerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
        sourceMarkerNo: 'A-1',
        markerId: 'seed-marker-marker-plan-ref-marker-plan-ref:MB-030102-02',
        markerNo: 'A-1',
        plannedLayers: 100,
        actualLayers: 80,
        actualCutPieceQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
        actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
        planUnits: seedRecords.map((record, index) => ({
            planUnitId: `plan-unit-step12-${record.cutOrderId}`,
            materialSku: record.materialSku,
            color: record.colorScope[0] || '',
            garmentQtyPerUnit: index === 0 ? 18 : 9,
            plannedRepeatCount: 100,
            plannedCutGarmentQty: index === 0 ? 1800 : 900,
        })),
        rolls,
        completionLinkage: {
            linkedCutOrderIds: seedRecords.map((record) => record.cutOrderId),
            linkedCutOrderNos: seedRecords.map((record) => record.cutOrderNo),
            completedAt,
            completedBy: '现场主管',
            generatedWarning: false,
        },
        replenishmentWarning: {
            warningId: `warning-${sessionId}`,
            spreadingSessionId: sessionId,
            sessionNo,
            cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
            productionOrderNos: unique(seedRecords.map((record) => record.productionOrderNo)),
            materialSku: seedRecords.map((record) => record.materialSku).join(' / '),
            materialAttr: '',
            requiredQty: 0,
            actualCutQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
            actualCutGarmentQty: actualCutQuantities.reduce((sum, value) => sum + value, 0),
            shortageQty: 0,
            varianceLength: 0,
            warningLevel: '低',
            suggestedAction: '无需补料',
            handled: true,
            lines: seedRecords.map((record, index) => ({
                lineId: `spread-warning-line-step12-${index + 1}`,
                cutOrderId: record.cutOrderId,
                cutOrderNo: record.cutOrderNo,
                materialSku: record.materialSku,
                color: record.colorScope[0] || '',
                actualCutGarmentQty: actualCutQuantities[index] || 0,
            })),
            createdAt: completedAt,
            note: 'prototype：计划 100 层，按实际实铺 80 层完成裁剪。',
        },
        completedAt,
        completedBy: '现场主管',
        updatedAt: completedAt,
        updatedBy: '现场主管',
    };
    const cleanSessionId = 'spreading-session-fei-actual-output-ready-001';
    const cleanSessionNo = 'PB-2450';
    const cleanCompletedAt = '2026-03-20 17:40';
    const cleanActualCutQuantities = [620, 580];
    const cleanRolls = seedRecords.map((record, index) => {
        const color = record.colorScope[0] || (index === 0 ? 'Navy' : 'Khaki');
        return {
            rollRecordId: `roll-fei-ready-${record.cutOrderId}`,
            rollNo: `ROLL-FEI-READY-${index + 1}`,
            materialSku: record.materialSku,
            color,
            planUnitId: `plan-unit-fei-ready-${record.cutOrderId}`,
            layerCount: 60,
            actualCutGarmentQty: cleanActualCutQuantities[index] || 0,
            actualCutPieceQty: cleanActualCutQuantities[index] || 0,
            actualLength: index === 0 ? 72 : 68,
        };
    });
    const cleanSession = {
        spreadingSessionId: cleanSessionId,
        sessionNo: cleanSessionNo,
        status: 'DONE',
        cuttingStatus: 'CUTTING_DONE',
        cutOrderIds: seedRecords.map((record) => record.cutOrderId),
        cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
        contextType: 'marker-plan-ref',
        markerPlanId,
        markerPlanNo,
        sourceMarkerId: 'seed-marker-fei-ready-bed-B-1',
        sourceMarkerNo: 'B-1',
        markerId: 'seed-marker-fei-ready-bed-B-1',
        markerNo: 'B-1',
        plannedLayers: 60,
        actualLayers: 60,
        actualCutPieceQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
        actualCutGarmentQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
        totalActualLength: 140,
        theoreticalSpreadTotalLength: 140,
        planUnits: seedRecords.map((record, index) => ({
            planUnitId: `plan-unit-fei-ready-${record.cutOrderId}`,
            materialSku: record.materialSku,
            color: record.colorScope[0] || '',
            garmentQtyPerUnit: 10,
            plannedRepeatCount: 60,
            plannedCutGarmentQty: cleanActualCutQuantities[index] || 0,
        })),
        rolls: cleanRolls,
        completionLinkage: {
            linkedCutOrderIds: seedRecords.map((record) => record.cutOrderId),
            linkedCutOrderNos: seedRecords.map((record) => record.cutOrderNo),
            completedAt: cleanCompletedAt,
            completedBy: '裁剪组长',
            generatedWarning: false,
        },
        replenishmentWarning: {
            warningId: `warning-${cleanSessionId}`,
            spreadingSessionId: cleanSessionId,
            sessionNo: cleanSessionNo,
            cutOrderNos: seedRecords.map((record) => record.cutOrderNo),
            productionOrderNos: unique(seedRecords.map((record) => record.productionOrderNo)),
            materialSku: seedRecords.map((record) => record.materialSku).join(' / '),
            materialAttr: '',
            requiredQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
            actualCutQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
            actualCutGarmentQty: cleanActualCutQuantities.reduce((sum, value) => sum + value, 0),
            shortageQty: 0,
            varianceLength: 0,
            warningLevel: '低',
            suggestedAction: '无需补料',
            handled: true,
            lines: seedRecords.map((record, index) => ({
                lineId: `spread-warning-line-fei-ready-${index + 1}`,
                cutOrderId: record.cutOrderId,
                cutOrderNo: record.cutOrderNo,
                materialSku: record.materialSku,
                color: record.colorScope[0] || '',
                actualCutGarmentQty: cleanActualCutQuantities[index] || 0,
            })),
            createdAt: cleanCompletedAt,
            note: 'prototype：实际裁剪产出已确认，无关键差异。',
        },
        completedAt: cleanCompletedAt,
        completedBy: '裁剪组长',
        updatedAt: cleanCompletedAt,
        updatedBy: '裁剪组长',
    };
    return {
        markers: [],
        sessions: [session, cleanSession],
    };
}
function readMarkerSpreadingStoreForFeiTickets(sourceRecords) {
    const store = readStoredMarkerSpreadingStore();
    const prototypeStore = buildCompletedSpreadingSeedStore(sourceRecords);
    const markersById = new Map();
    prototypeStore.markers.forEach((marker) => markersById.set(marker.markerId, marker));
    store.markers.forEach((marker) => markersById.set(marker.markerId, marker));
    const sessionsById = new Map();
    prototypeStore.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session));
    store.sessions.forEach((session) => sessionsById.set(session.spreadingSessionId, session));
    return {
        markers: Array.from(markersById.values()),
        sessions: Array.from(sessionsById.values()),
    };
}
function findPieceRowsForSku(sourceRecord, skuCode) {
    const pieceRows = buildFallbackPieceRows(sourceRecord);
    const matched = pieceRows.filter((pieceRow) => {
        if (!pieceRow.applicableSkuCodes.length)
            return true;
        return pieceRow.applicableSkuCodes.includes(skuCode);
    });
    return matched.length ? matched : pieceRows;
}
function listSessionSourceRecords(session, sourceRecords) {
    const cutOrderIds = new Set([
        ...(session.cutOrderIds || []),
        ...(session.completionLinkage?.linkedCutOrderIds || []),
    ].map(normalizeText).filter(Boolean));
    const cutOrderNos = new Set((session.completionLinkage?.linkedCutOrderNos || []).map(normalizeText).filter(Boolean));
    const matched = sourceRecords.filter((record) => cutOrderIds.has(record.cutOrderId) ||
        cutOrderNos.has(record.cutOrderNo));
    if (matched.length)
        return matched;
    const sessionMaterialSkus = new Set([
        ...(session.planUnits || []).map((unit) => unit.materialSku),
        ...(session.rolls || []).map((roll) => roll.materialSku),
        session.materialSkuSummary || '',
    ].map(normalizeText).filter(Boolean));
    const sessionColors = new Set([
        ...(session.planUnits || []).map((unit) => unit.color),
        ...(session.rolls || []).map((roll) => roll.color || ''),
        ...(session.colorSummary || '').split('/'),
    ].map(normalizeText).filter(Boolean));
    return sourceRecords.filter((record) => {
        const materialMatched = sessionMaterialSkus.has(normalizeText(record.materialSku));
        const colorMatched = record.colorScope.some((color) => sessionColors.has(normalizeText(color)));
        return materialMatched && colorMatched;
    });
}
function findSourceRecordForRoll(session, sourceRecords, roll) {
    const candidates = listSessionSourceRecords(session, sourceRecords);
    if (!candidates.length)
        return null;
    const rollMaterialSku = normalizeText(roll.materialSku);
    const rollColor = normalizeText(roll.color || '');
    return (candidates.find((record) => normalizeText(record.materialSku) === rollMaterialSku &&
        record.colorScope.some((color) => normalizeText(color) === rollColor)) ||
        candidates.find((record) => normalizeText(record.materialSku) === rollMaterialSku) ||
        candidates.find((record) => record.colorScope.some((color) => normalizeText(color) === rollColor)) ||
        candidates[0] ||
        null);
}
function deriveRollActualGarmentQty(session, roll) {
    const explicitQty = normalizePositiveInteger((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0);
    if (explicitQty > 0)
        return explicitQty;
    const planUnit = (session.planUnits || []).find((unit) => unit.planUnitId === roll.planUnitId) || session.planUnits?.[0] || null;
    return normalizePositiveInteger(Number(roll.layerCount || 0) * Number(planUnit?.garmentQtyPerUnit || 0));
}
function buildFallbackOutputSourceLines(session, sourceRecords) {
    return (session.rolls || [])
        .map((roll) => {
        const sourceRecord = findSourceRecordForRoll(session, sourceRecords, roll);
        const actualCutGarmentQty = deriveRollActualGarmentQty(session, roll);
        if (!sourceRecord || !actualCutGarmentQty)
            return null;
        return {
            cutOrderId: sourceRecord.cutOrderId,
            cutOrderNo: sourceRecord.cutOrderNo,
            materialSku: normalizeText(roll.materialSku) || sourceRecord.materialSku,
            color: normalizeText(roll.color || '') || sourceRecord.colorScope[0] || '待补颜色',
            actualCutGarmentQty,
            rollRecordId: roll.rollRecordId,
        };
    })
        .filter((line) => Boolean(line));
}
function listOutputSourceLinesForSession(session, sourceRecords) {
    const warningLines = (session.replenishmentWarning?.lines || [])
        .map((line) => ({
        cutOrderId: line.cutOrderId,
        cutOrderNo: line.cutOrderNo,
        materialSku: line.materialSku,
        color: line.color,
        actualCutGarmentQty: normalizePositiveInteger(line.actualCutGarmentQty || 0),
    }))
        .filter((line) => line.actualCutGarmentQty > 0);
    return warningLines.length ? warningLines : buildFallbackOutputSourceLines(session, sourceRecords);
}
function buildSpreadingPieceOutputLinesFromSessions(sourceRecords) {
    const store = readMarkerSpreadingStoreForFeiTickets(sourceRecords);
    const outputLines = [];
    store.sessions
        .filter(isReadyForFeiGeneration)
        .forEach((session) => {
        const outputSourceLines = listOutputSourceLinesForSession(session, sourceRecords);
        outputSourceLines.forEach((line, lineIndex) => {
            const sourceRecord = resolveSourceRecordForLine(sourceRecords, line);
            const roll = (line.rollRecordId ? session.rolls.find((item) => item.rollRecordId === line.rollRecordId) : null) ||
                session.rolls.find((item) => normalizeText(item.materialSku) === normalizeText(line.materialSku)
                    && normalizeText(item.color) === normalizeText(line.color)) || session.rolls[0] || null;
            if (!sourceRecord || !roll)
                return;
            const splitRows = splitGarmentQtyBySize(resolveColorScopedSkuLines(sourceRecord, line.color), line.actualCutGarmentQty);
            splitRows.forEach((sizeRow, sizeIndex) => {
                const bundleNo = buildBundleNo(sizeIndex);
                const pieceSetNoStart = 1;
                const pieceSetNoEnd = Math.max(sizeRow.garmentQty, 1);
                const pieceSetNoRange = formatPieceSetRange(pieceSetNoStart, pieceSetNoEnd);
                findPieceRowsForSku(sourceRecord, sizeRow.skuCode).forEach((pieceRow, partIndex) => {
                    outputLines.push({
                        outputLineId: [
                            session.spreadingSessionId,
                            normalizeText(roll.rollRecordId) || `roll-${lineIndex + 1}`,
                            normalizeText(sizeRow.size) || `size-${sizeIndex + 1}`,
                            normalizeText(pieceRow.partCode) || `part-${partIndex + 1}`,
                            bundleNo,
                        ].join('__'),
                        spreadingSessionId: session.spreadingSessionId,
                        sourceSpreadingSessionNo: session.sessionNo || session.spreadingSessionId,
                        sourceMarkerId: session.sourceMarkerId || session.markerId || '',
                        sourceMarkerNo: session.sourceMarkerNo || session.markerNo || session.sourceBedNo || session.sourceSchemeNo || session.markerId || '',
                        sourceMarkerLineItemId: `${session.spreadingSessionId}-${lineIndex + 1}`,
                        cutOrderId: sourceRecord.cutOrderId,
                        cutOrderNo: sourceRecord.cutOrderNo,
                        markerPlanId: session.markerPlanId || sourceRecord.markerPlanId || '',
                        markerPlanNo: session.markerPlanNo || sourceRecord.markerPlanNo || '',
                        productionOrderId: sourceRecord.productionOrderId,
                        productionOrderNo: sourceRecord.productionOrderNo,
                        fabricRollId: roll.rollRecordId,
                        fabricRollNo: normalizeBusinessText(roll.rollNo, '待补卷号'),
                        fabricColor: normalizeBusinessText(line.color || roll.color, '待补颜色'),
                        materialSku: normalizeBusinessText(line.materialSku, sourceRecord.materialSku),
                        garmentSkuId: normalizeBusinessText(sizeRow.skuCode, sourceRecord.cutOrderNo),
                        garmentColor: normalizeBusinessText(sizeRow.color, line.color || roll.color || '待补颜色'),
                        sizeCode: normalizeBusinessText(sizeRow.size, '均码'),
                        partCode: normalizeBusinessText(pieceRow.partCode, pieceRow.partName),
                        partName: normalizeBusinessText(pieceRow.partName, '整单裁片'),
                        pieceCountPerGarment: Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
                        bundleNo,
                        bundleQty: Math.max(sizeRow.garmentQty, 1),
                        pieceSetNoStart,
                        pieceSetNoEnd,
                        pieceSetNoRange,
                        bundleTicketType: '扎束菲票',
                        layerCount: Math.max(Number(roll.layerCount || 0), 1),
                        actualCutPieceQty: Math.max(sizeRow.garmentQty, 1) * Math.max(Number(pieceRow.pieceCountPerUnit || 0), 1),
                        actualCutGarmentQty: Math.max(sizeRow.garmentQty, 1),
                        sourceBasis: FEI_TICKET_SOURCE_BASIS,
                        sourceBasisType: FEI_TICKET_SOURCE_BASIS_TYPE,
                        createdBy: session.completedBy || session.updatedBy || '裁床组长',
                        createdAt: session.completedAt || session.updatedAt || '',
                    });
                });
            });
        });
    });
    return outputLines;
}
function buildCuttingActualOutputFromLine(line, sourceRecord) {
    const outputNo = `OUT-${line.cutOrderNo}-${line.sourceSpreadingSessionNo}-${line.sizeCode}-${line.partCode}`.replace(/\s+/g, '-');
    return {
        outputId: line.outputLineId,
        outputNo,
        productionOrderId: line.productionOrderId,
        productionOrderNo: line.productionOrderNo,
        cutOrderId: line.cutOrderId,
        cutOrderNo: line.cutOrderNo,
        markerPlanId: line.markerPlanId || '',
        markerPlanNo: line.markerPlanNo || '',
        markerNumber: line.sourceMarkerNo || '',
        bedNo: line.sourceMarkerNo || '',
        spreadingOrderId: line.spreadingSessionId,
        spreadingOrderNo: line.sourceSpreadingSessionNo,
        materialIdentity: sourceRecord?.materialIdentity || {
            materialSku: line.materialSku,
            materialName: line.materialSku,
            materialColor: line.fabricColor,
            materialAlias: line.materialSku,
            materialImageUrl: '',
            materialUnit: '米',
        },
        patternIdentity: sourceRecord?.patternIdentity || {
            patternFileId: '',
            patternFileName: '待补纸样文件',
            patternVersion: '待补',
            patternKind: '待补纸样类型',
            effectiveWidthValue: 0,
            effectiveWidthUnit: 'cm',
            piecePartCodes: [],
            piecePartNames: [],
        },
        spuId: sourceRecord?.spuId || sourceRecord?.spuCode || '',
        spuCode: sourceRecord?.spuCode || '',
        styleId: sourceRecord?.styleId || '',
        styleName: sourceRecord?.styleName || '',
        color: line.fabricColor,
        size: line.sizeCode,
        partCode: line.partCode,
        partName: line.partName,
        plannedGarmentQty: sourceRecord?.requiredQty || line.actualCutGarmentQty,
        plannedPieceQty: sourceRecord?.requiredQty || line.actualCutPieceQty,
        actualGarmentQty: line.actualCutGarmentQty,
        actualPieceQty: line.actualCutPieceQty,
        actualLayerCount: line.layerCount,
        actualMaterialUsage: 0,
        actualMaterialUsageUnit: sourceRecord?.materialIdentity.materialUnit || '米',
        cuttingCompletedAt: line.createdAt,
        cuttingCompletedBy: line.createdBy,
        differenceHandlingStatus: '无差异',
        canGenerateFeiTicket: true,
        generatedFeiTicketIds: [],
    };
}
export function listCuttingActualOutputs(sourceRecords = listGeneratedCutOrderSourceRecords()) {
    return listSpreadingPieceOutputLines(sourceRecords).map((line) => {
        const sourceRecord = sourceRecords.find((record) => record.cutOrderId === line.cutOrderId && record.productionOrderId === line.productionOrderId)
            || sourceRecords.find((record) => record.cutOrderId === line.cutOrderId)
            || null;
        const output = buildCuttingActualOutputFromLine(line, sourceRecord);
        const eligibility = evaluateFeiTicketGenerationEligibility(output);
        return {
            ...output,
            canGenerateFeiTicket: eligibility.canGenerate,
        };
    });
}
function cloneActualOutput(output, overrides) {
    return {
        ...output,
        ...overrides,
        materialIdentity: {
            ...output.materialIdentity,
            ...(overrides.materialIdentity || {}),
        },
        patternIdentity: {
            ...output.patternIdentity,
            ...(overrides.patternIdentity || {}),
            piecePartCodes: [...(overrides.patternIdentity?.piecePartCodes || output.patternIdentity.piecePartCodes)],
            piecePartNames: [...(overrides.patternIdentity?.piecePartNames || output.patternIdentity.piecePartNames)],
        },
        generatedFeiTicketIds: [...(overrides.generatedFeiTicketIds || output.generatedFeiTicketIds)],
    };
}
export function listFeiTicketGenerationEligibilityRows() {
    const baseOutput = listCuttingActualOutputs()[0];
    if (!baseOutput) {
        const eligibility = evaluateFeiTicketGenerationEligibility(null);
        return [{ scenarioLabel: '缺少实际裁剪产出', output: null, eligibility }];
    }
    const rows = [
        { scenarioLabel: '已裁剪且有实际裁剪产出', output: baseOutput },
        {
            scenarioLabel: '铺布单未裁剪',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__not-cut`,
                spreadingOrderId: `${baseOutput.spreadingOrderId}-not-cut`,
                cuttingCompletedAt: '',
                actualPieceQty: Math.max(baseOutput.actualPieceQty, 1),
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '实际裁片数量为 0',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__zero-output`,
                actualPieceQty: 0,
                actualGarmentQty: 0,
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '缺少裁片单',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__missing-cut-order`,
                cutOrderId: '',
                cutOrderNo: '',
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '缺少面料或纸样',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__missing-identity`,
                materialIdentity: {
                    ...baseOutput.materialIdentity,
                    materialSku: '',
                    materialName: '',
                    materialColor: '',
                },
                patternIdentity: {
                    ...baseOutput.patternIdentity,
                    patternFileId: '',
                    patternFileName: '',
                    patternVersion: '',
                },
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '差异尚未处理',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__pending-difference`,
                differenceHandlingStatus: '待处理',
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '差异已处理为仅记录差异',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__record-only`,
                differenceHandlingStatus: '仅记录差异',
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '差异已处理为继续补排',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__continue-recut`,
                differenceHandlingStatus: '继续补排',
                generatedFeiTicketIds: [],
            }),
        },
        {
            scenarioLabel: '同一实际裁剪产出已生成菲票',
            output: cloneActualOutput(baseOutput, {
                outputId: `${baseOutput.outputId}__already-generated`,
                generatedFeiTicketIds: [`ticket-${baseOutput.outputId}`],
            }),
        },
    ];
    return rows.map((row) => ({
        scenarioLabel: row.scenarioLabel,
        output: row.output,
        eligibility: evaluateFeiTicketGenerationEligibility(row.output),
    }));
}
function buildFeiRecordsFromSpreadingSessions(sourceRecords) {
    const outputLines = listSpreadingPieceOutputLines(sourceRecords);
    const secondaryCraftMetaByProductionOrderId = new Map();
    const records = outputLines.map((line, index) => {
        const sourceRecord = sourceRecords.find((item) => item.cutOrderId === line.cutOrderId && item.productionOrderId === line.productionOrderId)
            || sourceRecords.find((item) => item.cutOrderId === line.cutOrderId)
            || null;
        const sourceTechPackSpuCode = sourceRecord?.sourceTechPackSpuCode || '';
        const secondaryCraftMeta = secondaryCraftMetaByProductionOrderId.get(line.productionOrderId)
            || resolveSecondaryCrafts(line.productionOrderId);
        secondaryCraftMetaByProductionOrderId.set(line.productionOrderId, secondaryCraftMeta);
        const sequenceNo = index + 1;
        const feiTicketId = line.outputLineId;
        const feiTicketNo = buildFeiTicketNo(line.cutOrderNo, sequenceNo);
        const pieceScope = unique([line.fabricRollNo, line.fabricColor, line.sizeCode, line.partName]);
        const pieceGroup = normalizeText(line.partName) || normalizeText(line.partCode) || '整单裁片';
        const bundleScope = `${line.fabricRollNo}-${line.fabricColor}-${line.sizeCode}-${line.bundleNo}`;
        const qty = Math.max(line.bundleQty, 1);
        const materialIdentity = sourceRecord?.materialIdentity || {
            materialSku: line.materialSku,
            materialName: line.materialSku,
            materialColor: line.fabricColor,
            materialAlias: line.materialSku,
            materialImageUrl: '',
            materialUnit: '米',
        };
        const patternIdentity = sourceRecord?.patternIdentity || {
            patternFileId: '',
            patternFileName: '待补纸样文件',
            patternVersion: '待补',
            patternKind: '待补纸样类型',
            effectiveWidthValue: 0,
            effectiveWidthUnit: 'cm',
            piecePartCodes: [],
            piecePartNames: [],
        };
        const encoded = encodeFeiTicketQr({
            feiTicketId,
            feiTicketNo,
            cutOrderId: line.cutOrderId,
            cutOrderNo: line.cutOrderNo,
            productionOrderId: line.productionOrderId,
            productionOrderNo: line.productionOrderNo,
            sourceOutputLineId: line.outputLineId,
            fabricRollId: line.fabricRollId,
            fabricRollNo: line.fabricRollNo,
            fabricColor: line.fabricColor,
            materialSku: line.materialSku,
            garmentSkuId: line.garmentSkuId,
            garmentColor: line.garmentColor,
            pieceScope,
            pieceGroup,
            bundleScope,
            skuColor: line.fabricColor,
            skuSize: line.sizeCode,
            partCode: line.partCode,
            partName: line.partName,
            bundleNo: line.bundleNo,
            bundleQty: line.bundleQty,
            pieceSetNoStart: line.pieceSetNoStart,
            pieceSetNoEnd: line.pieceSetNoEnd,
            pieceSetNoRange: line.pieceSetNoRange,
            bundleTicketType: line.bundleTicketType,
            actualCutPieceQty: line.actualCutPieceQty,
            qty,
            secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
            craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
            currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
            issuedAt: line.createdAt,
        });
        return {
            feiTicketId,
            feiTicketNo,
            sourceOutputLineId: line.outputLineId,
            sourceSpreadingSessionId: line.spreadingSessionId,
            sourceSpreadingSessionNo: line.sourceSpreadingSessionNo,
            sourceMarkerId: line.sourceMarkerId,
            sourceMarkerNo: line.sourceMarkerNo,
            cutOrderId: line.cutOrderId,
            cutOrderNo: line.cutOrderNo,
            productionOrderId: line.productionOrderId,
            productionOrderNo: line.productionOrderNo,
            sourceMarkerPlanId: line.markerPlanId || '',
            sourceMarkerPlanNo: line.markerPlanNo || '',
            fabricRollId: line.fabricRollId,
            fabricRollNo: line.fabricRollNo,
            fabricColor: line.fabricColor,
            materialSku: line.materialSku,
            materialIdentity,
            patternIdentity,
            garmentSkuId: line.garmentSkuId,
            garmentColor: line.garmentColor,
            pieceScope,
            pieceGroup,
            bundleScope,
            skuCode: line.garmentSkuId,
            skuColor: line.fabricColor,
            skuSize: line.sizeCode,
            partCode: line.partCode,
            partName: line.partName,
            bundleNo: line.bundleNo,
            bundleQty: line.bundleQty,
            pieceSetNoStart: line.pieceSetNoStart,
            pieceSetNoEnd: line.pieceSetNoEnd,
            pieceSetNoRange: line.pieceSetNoRange,
            bundleTicketType: line.bundleTicketType,
            actualCutPieceQty: line.actualCutPieceQty,
            printStatus: 'WAIT_PRINT',
            qty,
            garmentQty: Math.max(line.actualCutGarmentQty, 1),
            sourceTraceCompleteness: 'COMPLETE',
            secondaryCrafts: secondaryCraftMeta.secondaryCrafts,
            craftSequenceVersion: secondaryCraftMeta.craftSequenceVersion,
            currentCraftStage: secondaryCraftMeta.secondaryCrafts[0] || '',
            sourceTechPackSpuCode,
            sourceBasis: FEI_TICKET_SOURCE_BASIS,
            sourceBasisType: FEI_TICKET_SOURCE_BASIS_TYPE,
            markerNumber: line.sourceMarkerNo,
            bedNo: line.sourceMarkerNo,
            spreadingOrderId: line.spreadingSessionId,
            spreadingOrderNo: line.sourceSpreadingSessionNo,
            issuedAt: line.createdAt,
            qrPayload: encoded.payload,
            qrValue: encoded.qrValue,
        };
    });
    return records;
}
function buildGeneratedFeiTicketDataset(records) {
    const generatedFeiTickets = [...records].sort(compareFeiRecords);
    return {
        generatedFeiTickets,
        feiTicketsById: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketId, record])),
        feiTicketsByNo: Object.fromEntries(generatedFeiTickets.map((record) => [record.feiTicketNo, record])),
        feiTicketsByProductionOrderId: generatedFeiTickets.reduce((acc, record) => {
            if (!acc[record.productionOrderId])
                acc[record.productionOrderId] = [];
            acc[record.productionOrderId].push(record);
            return acc;
        }, {}),
        spreadingResultFeiTicketsByProductionOrderId: generatedFeiTickets.reduce((acc, record) => {
            if (record.sourceBasisType !== FEI_TICKET_SOURCE_BASIS_TYPE)
                return acc;
            if (!acc[record.productionOrderId])
                acc[record.productionOrderId] = [];
            acc[record.productionOrderId].push(record);
            return acc;
        }, {}),
        feiTicketsByCutOrderId: generatedFeiTickets.reduce((acc, record) => {
            if (!acc[record.cutOrderId])
                acc[record.cutOrderId] = [];
            acc[record.cutOrderId].push(record);
            return acc;
        }, {}),
        feiTicketsBySpreadingSessionId: generatedFeiTickets.reduce((acc, record) => {
            if (!record.sourceSpreadingSessionId)
                return acc;
            if (!acc[record.sourceSpreadingSessionId])
                acc[record.sourceSpreadingSessionId] = [];
            acc[record.sourceSpreadingSessionId].push(record);
            return acc;
        }, {}),
    };
}
export function listSpreadingPieceOutputLines(sourceRecords = listGeneratedCutOrderSourceRecords()) {
    const generatedLines = buildSpreadingPieceOutputLinesFromSessions(sourceRecords);
    const lineMap = new Map();
    generatedLines.forEach((line) => {
        if (!lineMap.has(line.outputLineId)) {
            lineMap.set(line.outputLineId, line);
        }
    });
    return Array.from(lineMap.values()).sort(compareOutputLines);
}
let computingGeneratedFeiTicketDataset = false;
const EMPTY_GENERATED_FEI_TICKET_DATASET = buildGeneratedFeiTicketDataset([]);
let generatedFeiTicketDatasetCache = null;
function getGeneratedFeiTicketRuntimeSignature() {
    const storage = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
        ? localStorage
        : null;
    if (!storage)
        return '';
    return [
        'cuttingMarkerSpreadingLedger',
        'cuttingMarkerPlanRefLedger',
    ]
        .map((key) => `${key}:${storage.getItem(key) || ''}`)
        .join('\n');
}
function buildGeneratedFeiTicketDatasetSignature(sourceRecords) {
    const sourceSignature = sourceRecords
        .map((record) => [
        record.cutOrderId,
        record.cutOrderNo,
        record.productionOrderNo,
        record.materialSku,
        record.patternIdentity.patternFileId,
        record.patternIdentity.patternVersion,
        record.patternIdentity.effectiveWidthValue,
        record.requiredQty,
    ].join(':'))
        .join('|');
    return `${sourceSignature}\n${getGeneratedFeiTicketRuntimeSignature()}`;
}
function getGeneratedFeiTicketDataset() {
    const sourceRecords = listGeneratedCutOrderSourceRecords();
    if (computingGeneratedFeiTicketDataset)
        return EMPTY_GENERATED_FEI_TICKET_DATASET;
    const signature = buildGeneratedFeiTicketDatasetSignature(sourceRecords);
    if (generatedFeiTicketDatasetCache?.signature === signature) {
        return generatedFeiTicketDatasetCache.dataset;
    }
    computingGeneratedFeiTicketDataset = true;
    try {
        const spreadingDrivenFeiTickets = buildFeiRecordsFromSpreadingSessions(sourceRecords);
        const dataset = buildGeneratedFeiTicketDataset(spreadingDrivenFeiTickets);
        generatedFeiTicketDatasetCache = { signature, dataset };
        return dataset;
    }
    finally {
        computingGeneratedFeiTicketDataset = false;
    }
}
function cloneGeneratedFeiRecord(record) {
    return {
        ...record,
        materialIdentity: { ...record.materialIdentity },
        patternIdentity: {
            ...record.patternIdentity,
            piecePartCodes: [...record.patternIdentity.piecePartCodes],
            piecePartNames: [...record.patternIdentity.piecePartNames],
        },
        pieceScope: [...record.pieceScope],
        secondaryCrafts: [...record.secondaryCrafts],
        qrPayload: {
            ...record.qrPayload,
            pieceScope: [...record.qrPayload.pieceScope],
            secondaryCrafts: [...record.qrPayload.secondaryCrafts],
        },
    };
}
export function listGeneratedFeiTickets() {
    return getGeneratedFeiTicketDataset().generatedFeiTickets.map((record) => cloneGeneratedFeiRecord(record));
}
export function listSpreadingResultGeneratedFeiTickets() {
    return listGeneratedFeiTickets().filter((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE);
}
export function listActualCuttingOutputGeneratedFeiTickets() {
    return listSpreadingResultGeneratedFeiTickets();
}
export function listGeneratedFeiTicketsByCutOrderId(cutOrderId) {
    return (getGeneratedFeiTicketDataset().feiTicketsByCutOrderId[cutOrderId] || []).map((record) => cloneGeneratedFeiRecord(record));
}
export function listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId) {
    return listGeneratedFeiTicketsByCutOrderId(cutOrderId).filter((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE);
}
export function listActualCuttingOutputGeneratedFeiTicketsByCutOrderId(cutOrderId) {
    return listSpreadingResultGeneratedFeiTicketsByCutOrderId(cutOrderId);
}
export function listGeneratedFeiTicketsBySpreadingSessionId(spreadingSessionId) {
    return (getGeneratedFeiTicketDataset().feiTicketsBySpreadingSessionId[spreadingSessionId] || []).map((record) => cloneGeneratedFeiRecord(record));
}
export function getFeiTicketById(feiTicketId) {
    const record = getGeneratedFeiTicketDataset().feiTicketsById[feiTicketId];
    return record ? cloneGeneratedFeiRecord(record) : null;
}
export function getFeiTicketByNo(feiTicketNo) {
    const record = getGeneratedFeiTicketDataset().feiTicketsByNo[feiTicketNo];
    return record ? cloneGeneratedFeiRecord(record) : null;
}
export function getGeneratedFeiTicketMapByCutOrderId() {
    return Object.fromEntries(Object.entries(getGeneratedFeiTicketDataset().feiTicketsByCutOrderId).map(([key, records]) => [
        key,
        records.map((record) => cloneGeneratedFeiRecord(record)),
    ]));
}
export function listGeneratedFeiTicketsByProductionOrderId(productionOrderId) {
    return (getGeneratedFeiTicketDataset().feiTicketsByProductionOrderId[productionOrderId] || [])
        .map((record) => cloneGeneratedFeiRecord(record));
}
export function listSpreadingResultGeneratedFeiTicketsByProductionOrderId(productionOrderId) {
    return (getGeneratedFeiTicketDataset().spreadingResultFeiTicketsByProductionOrderId[productionOrderId] || [])
        .map((record) => cloneGeneratedFeiRecord(record));
}
export function buildGeneratedFeiTicketTraceMatrix(records = listGeneratedFeiTickets()) {
    const store = readMarkerSpreadingStoreForFeiTickets(listGeneratedCutOrderSourceRecords());
    const sessionById = Object.fromEntries(store.sessions.map((session) => [session.spreadingSessionId, session]));
    return records
        .map((record) => {
        const session = sessionById[record.sourceSpreadingSessionId];
        return {
            feiTicketId: record.feiTicketId,
            feiTicketNo: record.feiTicketNo,
            sourceOutputLineId: record.sourceOutputLineId,
            sourceSpreadingSessionId: record.sourceSpreadingSessionId,
            sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
            sourceMarkerId: record.sourceMarkerId,
            sourceMarkerNo: record.sourceMarkerNo,
            sourceMarkerPlanId: record.sourceMarkerPlanId,
            sourceMarkerPlanNo: record.sourceMarkerPlanNo,
            cutOrderId: record.cutOrderId,
            cutOrderNo: record.cutOrderNo,
            fabricRollNo: record.fabricRollNo,
            fabricColor: record.fabricColor,
            materialSku: record.materialSku,
            color: record.skuColor,
            size: record.skuSize,
            partName: record.partName,
            bundleNo: record.bundleNo,
            bundleQty: record.bundleQty,
            pieceSetNoStart: record.pieceSetNoStart,
            pieceSetNoEnd: record.pieceSetNoEnd,
            pieceSetNoRange: record.pieceSetNoRange,
            bundleTicketType: record.bundleTicketType,
            garmentQty: record.garmentQty,
            sourceBasis: record.sourceBasis,
            sourceBasisType: record.sourceBasisType,
            sourceTraceCompleteness: record.sourceTraceCompleteness,
            sourceWritebackId: session?.sourceWritebackId || '',
        };
    })
        .sort((left, right) => left.sourceSpreadingSessionNo.localeCompare(right.sourceSpreadingSessionNo, 'zh-CN')
        || left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.size.localeCompare(right.size, 'zh-CN'));
}
export function buildSpreadingDrivenFeiTicketTraceMatrix(records = listGeneratedFeiTickets()) {
    return buildGeneratedFeiTicketTraceMatrix(records).filter((record) => record.sourceBasisType === FEI_TICKET_SOURCE_BASIS_TYPE && Boolean(record.sourceSpreadingSessionId));
}
