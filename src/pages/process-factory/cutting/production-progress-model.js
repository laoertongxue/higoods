import { listGeneratedCutOrderSourceRecords } from '../../../data/fcs/cutting/generated-cut-orders.ts';
import { buildProductionPieceProgressViewModelFromTruth, } from './production-piece-progress.ts';
import { buildProductionPieceTruth, buildProductionPieceTruthCompletion, productionPieceTruthCompletionMetaMap, } from '../../../domain/fcs-cutting-piece-truth/index.ts';
import { listPdaPickupWritebacks, listPdaInboundWritebacks, listPdaHandoverWritebacks, listPdaReplenishmentFeedbackWritebacks, } from '../../../data/fcs/cutting/pda-execution-writeback-ledger.ts';
import { getBrowserLocalStorage } from '../../../data/browser-storage.ts';
const PRODUCTION_PROGRESS_REFERENCE_DATE = '2026-03-24';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
// 试运行规则：距离发货 8 / 10 / 13 天内分别落 AA / A / B，超出后再按订单大小划 C / D。
// 后续如业务调整紧急度阈值，应只改这组常量，不要把规则散落到页面渲染层。
export const LARGE_ORDER_QTY_THRESHOLD = 4500;
const numberFormatter = new Intl.NumberFormat('zh-CN');
export const urgencyMeta = {
    AA: { label: 'AA 紧急', className: 'bg-rose-100 text-rose-700 border border-rose-200', sortWeight: 5 },
    A: { label: 'A 紧急', className: 'bg-orange-100 text-orange-700 border border-orange-200', sortWeight: 4 },
    B: { label: 'B 紧急', className: 'bg-amber-100 text-amber-700 border border-amber-200', sortWeight: 3 },
    C: { label: 'C 优先', className: 'bg-sky-100 text-sky-700 border border-sky-200', sortWeight: 2 },
    D: { label: 'D 常规', className: 'bg-slate-100 text-slate-700 border border-slate-200', sortWeight: 1 },
    UNKNOWN: { label: '待补日期', className: 'bg-slate-100 text-slate-600 border border-slate-200', sortWeight: 0 },
};
export const configMeta = {
    NOT_CONFIGURED: { label: '无配料数量', className: 'bg-slate-100 text-slate-700' },
    PARTIAL: { label: '配料数量不足', className: 'bg-orange-100 text-orange-700' },
    CONFIGURED: { label: '有配料数量', className: 'bg-emerald-100 text-emerald-700' },
};
export const receiveMeta = {
    NOT_RECEIVED: { label: '未产生领料记录', className: 'bg-slate-100 text-slate-700' },
    PARTIAL: { label: '领料数量不足', className: 'bg-orange-100 text-orange-700' },
    RECEIVED: { label: '有领料记录', className: 'bg-emerald-100 text-emerald-700' },
    EXCEPTION: { label: '领料差异', className: 'bg-rose-100 text-rose-700' },
};
export const stageMeta = {
    WAITING_PREP: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
    PREPPING: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
    WAITING_CLAIM: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
    CUTTING: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
    WAITING_INBOUND: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
    DONE: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
};
export const completionMeta = productionPieceTruthCompletionMetaMap;
export const pieceCompletionMeta = productionPieceTruthCompletionMetaMap;
export const riskMeta = {
    CONFIG_DELAY: { label: '中转仓滞后', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
    SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
    REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
    PIECE_GAP: { label: '裁片缺口', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
};
export const shipDeltaRangeMeta = {
    BEFORE_0_3: { label: '距计划发货 0~3 天' },
    BEFORE_4_6: { label: '距计划发货 4~6 天' },
    BEFORE_7_9: { label: '距计划发货 7~9 天' },
    BEFORE_10_13: { label: '距计划发货 10~13 天' },
    BEFORE_14_PLUS: { label: '距计划发货 14 天以上' },
    OVERDUE_0_3: { label: '超计划发货 0~3 天' },
    OVERDUE_4_6: { label: '超计划发货 4~6 天' },
    OVERDUE_7_PLUS: { label: '超计划发货 7 天以上' },
    SHIP_DATE_MISSING: { label: '计划发货日期待补' },
};
export function formatQty(value) {
    return numberFormatter.format(value);
}
function formatCountSummary(done, total, suffix) {
    return `${done}/${total} ${suffix}`;
}
function parseDateOnly(value) {
    if (!value)
        return null;
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day)
        return null;
    return new Date(Date.UTC(year, month - 1, day));
}
function makeProductionProgressSkuKey(line) {
    const skuCode = String(line.skuCode || '').trim().toLowerCase();
    if (skuCode)
        return `sku:${skuCode}`;
    return `color-size:${String(line.color || '').trim().toLowerCase()}::${String(line.size || '').trim().toLowerCase()}`;
}
function makeProductionProgressCutOrderKey(line) {
    return [line.productionOrderId, line.cutOrderNo, line.materialSku].map((item) => String(item || '').trim().toLowerCase()).join('::');
}
function getDaysToShip(plannedShipDate, referenceDate = PRODUCTION_PROGRESS_REFERENCE_DATE) {
    const plannedDate = parseDateOnly(plannedShipDate);
    const reference = parseDateOnly(referenceDate);
    if (!plannedDate || !reference)
        return null;
    return Math.ceil((plannedDate.getTime() - reference.getTime()) / DAY_IN_MS);
}
function buildUrgencyView(plannedShipDate, orderQty) {
    const daysToShip = getDaysToShip(plannedShipDate);
    if (daysToShip === null) {
        const meta = urgencyMeta.UNKNOWN;
        return {
            key: 'UNKNOWN',
            label: meta.label,
            className: meta.className,
            sortWeight: meta.sortWeight,
            detailText: '计划发货日期待补',
        };
    }
    let key;
    if (daysToShip <= 8) {
        key = 'AA';
    }
    else if (daysToShip <= 10) {
        key = 'A';
    }
    else if (daysToShip <= 13) {
        key = 'B';
    }
    else if (orderQty >= LARGE_ORDER_QTY_THRESHOLD) {
        key = 'C';
    }
    else {
        key = 'D';
    }
    const meta = urgencyMeta[key];
    return {
        key,
        label: meta.label,
        className: meta.className,
        sortWeight: meta.sortWeight,
        detailText: daysToShip >= 0 ? `距计划发货 ${daysToShip} 天` : `已超计划发货 ${Math.abs(daysToShip)} 天`,
    };
}
function buildShipCountdownText(plannedShipDate) {
    const daysToShip = getDaysToShip(plannedShipDate);
    if (daysToShip === null)
        return '计划发货日期待补';
    if (daysToShip >= 0)
        return `距计划发货 ${daysToShip} 天`;
    return `已超计划发货 ${Math.abs(daysToShip)} 天`;
}
function buildShipDeltaDirection(daysToShip) {
    if (daysToShip === null)
        return 'UNKNOWN';
    if (daysToShip >= 0)
        return 'BEFORE';
    return 'OVERDUE';
}
function buildShipDeltaRange(daysToShip) {
    if (daysToShip === null)
        return 'SHIP_DATE_MISSING';
    if (daysToShip >= 0) {
        if (daysToShip <= 3)
            return 'BEFORE_0_3';
        if (daysToShip <= 6)
            return 'BEFORE_4_6';
        if (daysToShip <= 9)
            return 'BEFORE_7_9';
        if (daysToShip <= 13)
            return 'BEFORE_10_13';
        return 'BEFORE_14_PLUS';
    }
    const overdueDays = Math.abs(daysToShip);
    if (overdueDays <= 3)
        return 'OVERDUE_0_3';
    if (overdueDays <= 6)
        return 'OVERDUE_4_6';
    return 'OVERDUE_7_PLUS';
}
function buildConfigSummary(lines) {
    const configuredCount = lines.filter((line) => line.configStatus === 'CONFIGURED').length;
    const partialCount = lines.filter((line) => line.configStatus === 'PARTIAL').length;
    const total = lines.length;
    if (configuredCount === total) {
        const meta = configMeta.CONFIGURED;
        return { key: 'CONFIGURED', label: meta.label, className: meta.className, detailText: formatCountSummary(configuredCount, total, '中转仓已配') };
    }
    if (configuredCount > 0 || partialCount > 0) {
        const meta = configMeta.PARTIAL;
        return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: formatCountSummary(configuredCount + partialCount, total, '中转仓已配') };
    }
    const meta = configMeta.NOT_CONFIGURED;
    return { key: 'NOT_CONFIGURED', label: meta.label, className: meta.className, detailText: `配料数量待补 ${total} 项` };
}
function buildReceiveSummary(lines) {
    const total = lines.length;
    const receivedCount = lines.filter((line) => line.receiveStatus === 'RECEIVED').length;
    const partialCount = lines.filter((line) => line.receiveStatus === 'PARTIAL').length;
    const exceptionCount = lines.filter((line) => line.issueFlags.includes('RECEIVE_DIFF')).length;
    if (exceptionCount > 0) {
        const meta = receiveMeta.EXCEPTION;
        return {
            key: 'EXCEPTION',
            label: meta.label,
            className: meta.className,
            detailText: `异常 ${exceptionCount} 项 / 已领 ${receivedCount + partialCount}/${total}`,
        };
    }
    if (receivedCount === total) {
        const meta = receiveMeta.RECEIVED;
        return { key: 'RECEIVED', label: meta.label, className: meta.className, detailText: formatCountSummary(receivedCount, total, '裁床已领') };
    }
    if (receivedCount > 0 || partialCount > 0) {
        const meta = receiveMeta.PARTIAL;
        return { key: 'PARTIAL', label: meta.label, className: meta.className, detailText: formatCountSummary(receivedCount + partialCount, total, '已介入') };
    }
    const meta = receiveMeta.NOT_RECEIVED;
    return { key: 'NOT_RECEIVED', label: meta.label, className: meta.className, detailText: `领料记录待补 ${total} 项` };
}
function buildCurrentStage(record, prepSummary, claimSummary) {
    let key;
    const isLegacyClaimStage = record.cuttingStage.includes('待来') || record.cuttingStage.includes('来料');
    if (record.hasInboundRecord || /已完成|完成/.test(record.cuttingStage)) {
        key = 'DONE';
    }
    else if (/待入仓/.test(record.cuttingStage) || record.riskFlags.includes('INBOUND_PENDING')) {
        key = 'WAITING_INBOUND';
    }
    else if (record.hasSpreadingRecord || /裁片中|裁剪中|来料完成/.test(record.cuttingStage)) {
        key = 'CUTTING';
    }
    else if (claimSummary.key !== 'NOT_RECEIVED' || record.cuttingStage.includes('领料') || isLegacyClaimStage) {
        key = 'WAITING_CLAIM';
    }
    else if (prepSummary.key === 'PARTIAL' || record.cuttingStage.includes('配料') || /中转仓处理中/.test(record.cuttingStage)) {
        key = 'PREPPING';
    }
    else {
        key = 'WAITING_PREP';
    }
    return {
        key,
        label: stageMeta[key].label,
        className: stageMeta[key].className,
    };
}
function buildPieceTruthOverlaySignals(record, options = {}) {
    const productionOrderMatches = (value) => value.productionOrderId === record.productionOrderId || value.productionOrderNo === record.productionOrderNo;
    const toSignal = (sourceType, item) => ({
        sourceType,
        productionOrderId: item.productionOrderId,
        productionOrderNo: item.productionOrderNo,
        cutOrderId: item.cutOrderId,
        cutOrderNo: item.cutOrderNo,
        markerPlanId: item.markerPlanId,
        markerPlanNo: item.markerPlanNo,
        cutPieceOrderNo: item.cutPieceOrderNo,
        materialSku: item.materialSku,
        latestUpdatedAt: item.submittedAt,
        latestOperatorName: item.operatorName,
        note: item.note,
    });
    const storage = getBrowserLocalStorage() || undefined;
    const pickupWritebacks = options.pickupWritebacks ?? listPdaPickupWritebacks(storage);
    const inboundWritebacks = options.inboundWritebacks ?? listPdaInboundWritebacks(storage);
    const handoverWritebacks = options.handoverWritebacks ?? listPdaHandoverWritebacks(storage);
    const replenishmentFeedbackWritebacks = options.replenishmentFeedbackWritebacks ?? listPdaReplenishmentFeedbackWritebacks(storage);
    return [
        ...pickupWritebacks
            .filter(productionOrderMatches)
            .map((item) => toSignal('PICKUP', item)),
        ...inboundWritebacks
            .filter(productionOrderMatches)
            .map((item) => toSignal('INBOUND', item)),
        ...handoverWritebacks
            .filter(productionOrderMatches)
            .map((item) => toSignal('HANDOVER', item)),
        ...replenishmentFeedbackWritebacks
            .filter(productionOrderMatches)
            .map((item) => toSignal('REPLENISHMENT', item)),
    ];
}
function buildProductionCompletionSummary(truth, options) {
    const objectExceptionReason = options.claimSummary.key === 'EXCEPTION' ? options.claimSummary.detailText : undefined;
    const objectPendingReason = options.prepSummary.key !== 'CONFIGURED'
        ? options.prepSummary.detailText
        : options.claimSummary.key !== 'RECEIVED'
            ? options.claimSummary.detailText
            : options.record.riskFlags.includes('REPLENISH_PENDING')
                ? '当前仍有待补料项，需继续处理。'
                : undefined;
    const completionMeta = buildProductionPieceTruthCompletion(truth, {
        hasObjectException: Boolean(objectExceptionReason),
        hasObjectPending: Boolean(objectPendingReason),
        objectExceptionReason,
        objectPendingReason,
    });
    return {
        key: completionMeta.key,
        label: completionMeta.label,
        className: completionMeta.className,
        detailText: completionMeta.detailText,
    };
}
function buildRiskTags(record, prepSummary, urgencyKey, pieceTruth) {
    const tags = [];
    const pushRisk = (key) => {
        if (tags.some((item) => item.key === key))
            return;
        tags.push({ key, label: riskMeta[key].label, className: riskMeta[key].className });
    };
    if (prepSummary.key !== 'CONFIGURED') {
        pushRisk('CONFIG_DELAY');
    }
    if (record.riskFlags.includes('REPLENISH_PENDING')) {
        pushRisk('REPLENISH_PENDING');
    }
    if (pieceTruth.gapRows.some((row) => row.gapCutQty > 0 || row.gapInboundQty > 0)) {
        pushRisk('PIECE_GAP');
    }
    if (urgencyKey === 'AA' || urgencyKey === 'A') {
        pushRisk('SHIP_URGENT');
    }
    return tags;
}
function buildMaterialRequirementMap() {
    const requirementMap = new Map();
    listGeneratedCutOrderSourceRecords().forEach((record) => {
        const key = `${record.productionOrderId}::${record.materialSku}`.toLowerCase();
        requirementMap.set(key, (requirementMap.get(key) || 0) + Number(record.requiredQty || 0));
    });
    return requirementMap;
}
function buildSkuPieceRequirementMap() {
    const requirementMap = new Map();
    listGeneratedCutOrderSourceRecords().forEach((record) => {
        record.skuScopeLines.forEach((scopeLine) => {
            const pieceCountPerUnit = record.pieceRows
                .filter((pieceRow) => !pieceRow.applicableSkuCodes.length || pieceRow.applicableSkuCodes.includes(scopeLine.skuCode))
                .reduce((sum, pieceRow) => sum + Number(pieceRow.pieceCountPerUnit || 0), 0);
            const key = `${record.productionOrderId.toLowerCase()}::${makeProductionProgressSkuKey(scopeLine)}`;
            requirementMap.set(key, (requirementMap.get(key) || 0) + Number(scopeLine.plannedQty || 0) * pieceCountPerUnit);
        });
    });
    return requirementMap;
}
function buildCutOrderRequirementMap() {
    const requirementMap = new Map();
    listGeneratedCutOrderSourceRecords().forEach((record) => {
        const key = makeProductionProgressCutOrderKey({
            productionOrderId: record.productionOrderId,
            cutOrderNo: record.cutOrderNo,
            materialSku: record.materialSku,
        });
        const current = requirementMap.get(key) || { requiredPieceQty: 0, skuCodes: new Set() };
        record.skuScopeLines.forEach((scopeLine) => {
            const pieceCountPerUnit = record.pieceRows
                .filter((pieceRow) => !pieceRow.applicableSkuCodes.length || pieceRow.applicableSkuCodes.includes(scopeLine.skuCode))
                .reduce((sum, pieceRow) => sum + Number(pieceRow.pieceCountPerUnit || 0), 0);
            current.requiredPieceQty += Number(scopeLine.plannedQty || 0) * pieceCountPerUnit;
            if (scopeLine.skuCode)
                current.skuCodes.add(scopeLine.skuCode);
        });
        requirementMap.set(key, current);
    });
    return requirementMap;
}
function buildMaterialPrepLines(record, requirementMap) {
    const grouped = new Map();
    record.materialLines.forEach((line) => {
        const key = line.materialSku.toLowerCase();
        const requirementKey = `${record.productionOrderId}::${line.materialSku}`.toLowerCase();
        const current = grouped.get(key) || {
            materialLabel: line.materialLabel || line.materialSku,
            materialSku: line.materialSku,
            materialName: line.materialIdentity?.materialName || line.materialLabel || line.materialSku,
            materialColor: line.materialIdentity?.materialColor || line.color || '',
            materialAlias: line.materialIdentity?.materialAlias || line.materialAlias || '',
            materialImageUrl: line.materialIdentity?.materialImageUrl || line.materialImageUrl || '',
            materialUnit: line.materialIdentity?.materialUnit || '米',
            preparedQty: 0,
            totalQty: 0,
        };
        current.preparedQty += Number(line.configuredLength || 0);
        current.totalQty = Math.max(current.totalQty, Number(requirementMap.get(requirementKey) || 0), current.preparedQty, Number(line.receivedLength || 0));
        grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'));
}
function buildMaterialClaimLines(record) {
    const grouped = new Map();
    record.materialLines.forEach((line) => {
        const key = line.materialSku.toLowerCase();
        const current = grouped.get(key) || {
            materialLabel: line.materialLabel || line.materialSku,
            materialSku: line.materialSku,
            materialName: line.materialIdentity?.materialName || line.materialLabel || line.materialSku,
            materialColor: line.materialIdentity?.materialColor || line.color || '',
            materialAlias: line.materialIdentity?.materialAlias || line.materialAlias || '',
            materialImageUrl: line.materialIdentity?.materialImageUrl || line.materialImageUrl || '',
            materialUnit: line.materialIdentity?.materialUnit || '米',
            claimedQty: 0,
            preparedQty: 0,
        };
        current.claimedQty += Number(line.receivedLength || 0);
        current.preparedQty += Number(line.configuredLength || 0);
        grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'));
}
function buildProgressStateLabel(options) {
    if (!options.hasConfiguredQty && !options.hasReceivedQty && options.actualCutQty <= 0 && options.inboundQty <= 0) {
        return '配料 / 领料待补';
    }
    if (options.actualCutQty <= 0) {
        return '待铺布';
    }
    if (options.requiredPieceQty > 0 && options.actualCutQty < options.requiredPieceQty) {
        return '裁片有缺口';
    }
    if (options.requiredPieceQty > 0 && options.inboundQty < options.requiredPieceQty) {
        return options.inboundQty > 0 ? '入仓数据待补' : '裁完待入仓';
    }
    return '无缺口';
}
function resolveProgressStateClassName(label) {
    if (label === '无缺口')
        return 'text-emerald-700';
    if (label === '配料 / 领料待补' || label === '待铺布')
        return 'text-amber-700';
    return 'text-orange-700';
}
function resolveSkuProgressClassName(row) {
    if (row.mappingStatus !== 'MATCHED')
        return 'text-amber-700';
    if (row.gapCutQty > 0 || row.gapInboundQty > 0)
        return 'text-orange-700';
    return 'text-emerald-700';
}
function buildSkuProgressLines(record, truth, skuPieceRequirementMap) {
    const grouped = new Map();
    (record.skuRequirementLines || []).forEach((line) => {
        const key = makeProductionProgressSkuKey(line);
        grouped.set(key, {
            skuLabel: line.skuCode || '未命名 SKU',
            skuDetailLabel: [line.color, line.size].filter(Boolean).join(' / '),
            demandQty: Number(line.plannedQty || 0),
            cutQty: 0,
            inboundQty: 0,
            hasConfiguredQty: false,
            hasReceivedQty: false,
            requiredPieceQty: Number(skuPieceRequirementMap.get(`${record.productionOrderId.toLowerCase()}::${key}`) || 0),
        });
    });
    record.materialLines.forEach((materialLine) => {
        ;
        (materialLine.skuScopeLines || []).forEach((scopeLine) => {
            const key = makeProductionProgressSkuKey(scopeLine);
            const current = grouped.get(key);
            if (current) {
                current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0;
                current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0;
            }
        });
        (materialLine.pieceProgressLines || []).forEach((pieceLine) => {
            const key = makeProductionProgressSkuKey(pieceLine);
            const current = grouped.get(key) ||
                {
                    skuLabel: pieceLine.skuCode || '未命名 SKU',
                    skuDetailLabel: [pieceLine.color, pieceLine.size].filter(Boolean).join(' / '),
                    demandQty: 0,
                    cutQty: 0,
                    inboundQty: 0,
                    hasConfiguredQty: Number(materialLine.configuredLength || 0) > 0,
                    hasReceivedQty: Number(materialLine.receivedLength || 0) > 0,
                    requiredPieceQty: Number(skuPieceRequirementMap.get(`${record.productionOrderId.toLowerCase()}::${key}`) || 0),
                };
            current.cutQty += Number(pieceLine.actualCutQty || 0);
            current.inboundQty += Number(pieceLine.inboundQty || 0);
            current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0;
            current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0;
            grouped.set(key, current);
        });
    });
    const lines = Array.from(grouped.values())
        .map((row) => {
        const completionLabel = buildProgressStateLabel({
            requiredPieceQty: row.requiredPieceQty,
            actualCutQty: row.cutQty,
            inboundQty: row.inboundQty,
            hasConfiguredQty: row.hasConfiguredQty,
            hasReceivedQty: row.hasReceivedQty,
        });
        return {
            skuLabel: row.skuLabel,
            skuDetailLabel: row.skuDetailLabel,
            demandQty: row.demandQty,
            cutQty: row.cutQty,
            inboundQty: row.inboundQty,
            completionLabel,
            completionClassName: resolveProgressStateClassName(completionLabel),
        };
    })
        .sort((left, right) => left.skuLabel.localeCompare(right.skuLabel, 'zh-CN'));
    if (lines.length)
        return lines;
    return truth.skuRows.map((row) => {
        const detailLabel = [row.color, row.size].filter(Boolean).join(' / ');
        return {
            skuLabel: row.skuCode || '未命名 SKU',
            skuDetailLabel: detailLabel,
            demandQty: row.requiredGarmentQty,
            cutQty: row.actualCutQty,
            inboundQty: row.inboundQty,
            completionLabel: row.currentStateLabel,
            completionClassName: resolveSkuProgressClassName(row),
        };
    });
}
function buildSourceOrderProgressLines(record, cutOrderRequirementMap, truth) {
    const grouped = new Map();
    record.materialLines.forEach((materialLine) => {
        const cutOrderId = materialLine.cutOrderId || materialLine.cutOrderNo || materialLine.cutPieceOrderNo || '';
        const cutOrderNo = materialLine.cutOrderNo || materialLine.cutOrderId || materialLine.cutPieceOrderNo || '';
        const key = makeProductionProgressCutOrderKey({
            productionOrderId: record.productionOrderId,
            cutOrderNo,
            materialSku: materialLine.materialSku,
        });
        const requirement = cutOrderRequirementMap.get(key);
        const current = grouped.get(key) ||
            {
                cutOrderNo,
                cutOrderId,
                materialSku: materialLine.materialSku,
                materialName: materialLine.materialIdentity?.materialName || materialLine.materialLabel || materialLine.materialSku,
                materialColor: materialLine.materialIdentity?.materialColor || materialLine.color || '',
                materialAlias: materialLine.materialIdentity?.materialAlias || materialLine.materialAlias || '',
                materialImageUrl: materialLine.materialIdentity?.materialImageUrl || materialLine.materialImageUrl || '',
                materialUnit: materialLine.materialIdentity?.materialUnit || '米',
                patternFileName: materialLine.patternIdentity?.patternFileName || '待补纸样文件',
                patternVersion: materialLine.patternIdentity?.patternVersion || '待补',
                effectiveWidthText: materialLine.patternIdentity
                    ? `${materialLine.patternIdentity.effectiveWidthValue}${materialLine.patternIdentity.effectiveWidthUnit}`
                    : '待补',
                skuCodes: new Set(requirement ? Array.from(requirement.skuCodes) : []),
                cutQty: 0,
                inboundQty: 0,
                hasConfiguredQty: Number(materialLine.configuredLength || 0) > 0,
                hasReceivedQty: Number(materialLine.receivedLength || 0) > 0,
                requiredPieceQty: Number(requirement?.requiredPieceQty || 0),
            };
        (materialLine.skuScopeLines || []).forEach((scopeLine) => {
            if (scopeLine.skuCode)
                current.skuCodes.add(scopeLine.skuCode);
        });
        (materialLine.pieceProgressLines || []).forEach((pieceLine) => {
            current.cutQty += Number(pieceLine.actualCutQty || 0);
            current.inboundQty += Number(pieceLine.inboundQty || 0);
        });
        current.hasConfiguredQty = current.hasConfiguredQty || Number(materialLine.configuredLength || 0) > 0;
        current.hasReceivedQty = current.hasReceivedQty || Number(materialLine.receivedLength || 0) > 0;
        grouped.set(key, current);
    });
    const lines = Array.from(grouped.values())
        .map((row) => {
        const currentStateLabel = buildProgressStateLabel({
            requiredPieceQty: row.requiredPieceQty,
            actualCutQty: row.cutQty,
            inboundQty: row.inboundQty,
            hasConfiguredQty: row.hasConfiguredQty,
            hasReceivedQty: row.hasReceivedQty,
        });
        const incompletePieceQty = row.requiredPieceQty > 0
            ? Math.max(row.requiredPieceQty - Math.max(row.cutQty, row.inboundQty), row.requiredPieceQty - row.inboundQty, 0)
            : 0;
        return {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
            materialName: row.materialName,
            materialColor: row.materialColor,
            materialAlias: row.materialAlias,
            materialImageUrl: row.materialImageUrl,
            materialUnit: row.materialUnit,
            patternFileName: row.patternFileName,
            patternVersion: row.patternVersion,
            effectiveWidthText: row.effectiveWidthText,
            skuCount: row.skuCodes.size,
            incompletePieceQty,
            currentStateLabel,
        };
    })
        .filter((row) => row.cutOrderNo)
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'));
    return lines.length
        ? lines
        : truth.cutOrderRows.map((row) => {
            const materialLine = record.materialLines.find((line) => line.materialSku === row.materialSku);
            return {
                cutOrderId: materialLine?.cutOrderId || row.cutOrderNo,
                cutOrderNo: row.cutOrderNo,
                materialSku: row.materialSku,
                materialName: materialLine?.materialIdentity?.materialName || materialLine?.materialLabel || row.materialSku,
                materialColor: materialLine?.materialIdentity?.materialColor || materialLine?.color || '',
                materialAlias: materialLine?.materialIdentity?.materialAlias || materialLine?.materialAlias || '',
                materialImageUrl: materialLine?.materialIdentity?.materialImageUrl || materialLine?.materialImageUrl || '',
                materialUnit: materialLine?.materialIdentity?.materialUnit || '米',
                patternFileName: materialLine?.patternIdentity?.patternFileName || '待补纸样文件',
                patternVersion: materialLine?.patternIdentity?.patternVersion || '待补',
                effectiveWidthText: materialLine?.patternIdentity
                    ? `${materialLine.patternIdentity.effectiveWidthValue}${materialLine.patternIdentity.effectiveWidthUnit}`
                    : '待补',
                skuCount: row.skuCount,
                incompletePieceQty: Math.max(row.gapCutQty, row.gapInboundQty),
                currentStateLabel: row.currentStateLabel,
            };
        });
}
function buildPartDifferenceSummary(truth) {
    return truth.gapRows.reduce((summary, row) => {
        const pieceQty = Number(row.requiredPieceQty || 0);
        const isCompleted = row.mappingStatus === 'MATCHED' && Number(row.gapCutQty || 0) === 0 && Number(row.gapInboundQty || 0) === 0;
        if (isCompleted) {
            summary.completedPieceQty += pieceQty;
        }
        else {
            summary.incompletePieceQty += pieceQty;
        }
        return summary;
    }, { completedPieceQty: 0, incompletePieceQty: 0 });
}
function buildKeywordIndex(record, cutOrderNos, pieceTruth) {
    return [
        record.productionOrderNo,
        record.productionOrderId,
        record.spuCode,
        record.techPackSpuCode,
        record.styleCode,
        record.styleName,
        ...cutOrderNos,
        ...record.materialLines.map((line) => line.materialSku),
        ...(record.skuRequirementLines || []).flatMap((line) => [line.skuCode, line.color, line.size]),
        ...pieceTruth.gapRows.flatMap((row) => [
            row.skuCode,
            row.color,
            row.size,
            row.partName,
            row.materialSku,
            row.cutOrderNo,
            row.currentStateLabel,
            row.nextActionLabel,
        ]),
        ...pieceTruth.mappingIssues.map((issue) => issue.message),
        ...pieceTruth.dataIssues.map((issue) => issue.message),
    ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
}
export function buildProductionProgressRows(records, options = {}) {
    const materialRequirementMap = buildMaterialRequirementMap();
    const skuPieceRequirementMap = buildSkuPieceRequirementMap();
    const cutOrderRequirementMap = buildCutOrderRequirementMap();
    return records.map((record) => {
        const cutOrderNos = Array.from(new Set(record.materialLines.map((line) => line.cutOrderNo || line.cutOrderId).filter(Boolean)));
        const cutOrderIds = Array.from(new Set(record.materialLines.map((line) => line.cutOrderId || line.cutOrderNo).filter(Boolean)));
        const prepSummary = buildConfigSummary(record.materialLines);
        const claimSummary = buildReceiveSummary(record.materialLines);
        const shipDeltaDays = getDaysToShip(record.plannedShipDate);
        const shipDeltaDirection = buildShipDeltaDirection(shipDeltaDays);
        const shipDeltaRange = buildShipDeltaRange(shipDeltaDays);
        const urgency = buildUrgencyView(record.plannedShipDate, record.orderQty);
        const currentStage = buildCurrentStage(record, prepSummary, claimSummary);
        const overlaySignals = buildPieceTruthOverlaySignals(record, options);
        const pieceTruth = buildProductionPieceTruth(record, { overlaySignals });
        const pieceProgress = buildProductionPieceProgressViewModelFromTruth(pieceTruth);
        const pieceCompletionSummary = buildProductionCompletionSummary(pieceTruth, {
            prepSummary,
            claimSummary,
            record,
        });
        const cuttingCompletionSummary = pieceCompletionSummary;
        const riskTags = buildRiskTags(record, prepSummary, urgency.key, pieceTruth);
        const shipCountdownText = buildShipCountdownText(record.plannedShipDate);
        const materialPrepLines = buildMaterialPrepLines(record, materialRequirementMap);
        const materialClaimLines = buildMaterialClaimLines(record);
        const skuProgressLines = buildSkuProgressLines(record, pieceTruth, skuPieceRequirementMap);
        const sourceOrderProgressLines = buildSourceOrderProgressLines(record, cutOrderRequirementMap, pieceTruth);
        const completedSkuCount = skuProgressLines.filter((line) => line.completionLabel === '无缺口').length;
        const incompleteSkuCount = Math.max(skuProgressLines.length - completedSkuCount, 0);
        const partDifferenceSummary = buildPartDifferenceSummary(pieceTruth);
        const keywordIndex = buildKeywordIndex(record, cutOrderNos, pieceTruth);
        const priorityGapRow = pieceTruth.gapRows.find((row) => row.mappingStatus !== 'MATCHED') ||
            pieceTruth.gapRows.find((row) => row.gapCutQty > 0) ||
            pieceTruth.gapRows.find((row) => row.gapInboundQty > 0) ||
            null;
        const mappingIssueCount = pieceTruth.mappingIssues.length;
        const dataIssueCount = pieceTruth.dataIssues.length;
        return {
            id: record.id,
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
            purchaseDate: record.purchaseDate,
            actualOrderDate: record.actualOrderDate,
            plannedShipDate: record.plannedShipDate,
            plannedShipDateDisplay: record.plannedShipDate || '待补日期',
            orderQty: record.orderQty,
            spuCode: record.spuCode,
            styleCode: record.styleCode,
            styleName: record.styleName,
            cuttingTaskNo: record.cuttingTaskNo,
            assignedFactoryName: record.assignedFactoryName,
            urgency,
            shipDeltaDays,
            shipDeltaDirection,
            shipDeltaRange,
            shipCountdownText,
            materialPrepSummary: prepSummary,
            materialClaimSummary: claimSummary,
            materialPrepLines,
            materialClaimLines,
            currentStage,
            cuttingCompletionSummary,
            pieceCompletionSummary,
            pieceTruth,
            skuProgressLines,
            sourceOrderProgressLines,
            partDifferenceSummary,
            riskTags,
            cutOrderCount: cutOrderNos.length,
            cutOrderIds,
            cutOrderNos,
            techPackSpuCode: record.techPackSpuCode || '',
            skuRequirementLines: record.skuRequirementLines || [],
            pieceProgress,
            skuTotalCount: skuProgressLines.length,
            completedSkuCount,
            incompleteSkuCount,
            incompleteCutOrderCount: pieceTruth.cutOrderRows.filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '无缺口').length,
            incompletePartCount: pieceTruth.counts.incompletePartCount,
            affectedMaterialCount: pieceTruth.counts.affectedMaterialCount,
            pieceGapQty: pieceTruth.counts.gapCutQtyTotal,
            inboundGapQty: pieceTruth.counts.gapInboundQtyTotal,
            pieceMappingWarningCount: mappingIssueCount,
            pieceDataIssueCount: dataIssueCount,
            primaryGapObjectLabel: priorityGapRow?.cutOrderNo || '当前无差异对象',
            primaryGapMaterialSku: priorityGapRow?.materialSku || '—',
            primaryGapPartName: priorityGapRow?.partName || '—',
            mainNextActionLabel: pieceTruth.nextActionLabel,
            dataStateLabel: dataIssueCount > 0
                ? '数据待补'
                : mappingIssueCount > 0
                    ? '映射缺失'
                    : '正常',
            hasPieceGap: pieceTruth.gapRows.some((row) => row.gapCutQty > 0 || row.gapInboundQty > 0),
            hasMappingWarnings: mappingIssueCount > 0,
            filterPayloadForCutOrders: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            filterPayloadForMaterialPrep: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            filterPayloadForCuttablePool: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            filterPayloadForSummary: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            filterPayloadForMarkerSpreading: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            filterPayloadForFeiTickets: {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
            },
            latestUpdatedAt: record.lastFieldUpdateAt,
            latestPickupScanAt: record.lastPickupScanAt,
            latestOperatorName: record.lastOperatorName,
            rawStageText: record.cuttingStage,
            closeReasonText: record.closeReasonText || '',
            closeReason: record.closeReason || '',
            closedAt: record.closedAt || '',
            closedBy: record.closedBy || '',
            hasSpreadingRecord: record.hasSpreadingRecord,
            hasInboundRecord: record.hasInboundRecord,
            materialLines: record.materialLines,
            keywordIndex,
        };
    });
}
function compareDateString(a, b) {
    const left = parseDateOnly(a);
    const right = parseDateOnly(b);
    if (!left && !right)
        return 0;
    if (!left)
        return 1;
    if (!right)
        return -1;
    return left.getTime() - right.getTime();
}
export function sortProductionProgressRows(rows, sortBy) {
    const sorted = [...rows];
    sorted.sort((left, right) => {
        if (sortBy === 'SHIP_DATE_ASC') {
            return compareDateString(left.plannedShipDate, right.plannedShipDate) || right.urgency.sortWeight - left.urgency.sortWeight;
        }
        if (sortBy === 'ORDER_QTY_DESC') {
            return right.orderQty - left.orderQty || compareDateString(left.plannedShipDate, right.plannedShipDate);
        }
        return (right.urgency.sortWeight - left.urgency.sortWeight ||
            compareDateString(left.plannedShipDate, right.plannedShipDate) ||
            compareDateString(left.actualOrderDate, right.actualOrderDate));
    });
    return sorted;
}
export function filterProductionProgressRows(rows, filters) {
    const keyword = filters.keyword.trim().toLowerCase();
    const productionOrderKeyword = filters.productionOrderNo.trim().toLowerCase();
    return rows.filter((row) => {
        const matchesKeyword = keyword.length === 0 || row.keywordIndex.some((value) => value.includes(keyword));
        const matchesProductionOrder = productionOrderKeyword.length === 0 || row.productionOrderNo.toLowerCase().includes(productionOrderKeyword);
        const matchesUrgency = filters.urgencyLevel === 'ALL' || row.urgency.key === filters.urgencyLevel;
        const matchesShipDelta = filters.shipDeltaRange === 'ALL' || row.shipDeltaRange === filters.shipDeltaRange;
        const matchesStage = filters.currentStage === 'ALL' ||
            (filters.currentStage === 'NOT_STARTED'
                ? row.currentStage.key === 'WAITING_PREP' || row.currentStage.key === 'PREPPING' || row.currentStage.key === 'WAITING_CLAIM'
                : filters.currentStage === 'STARTED'
                    ? row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND' || row.currentStage.key === 'DONE'
                    : row.currentStage.key === filters.currentStage);
        const matchesCompletion = filters.completionState === 'ALL' || row.pieceCompletionSummary.key === filters.completionState;
        const matchesConfig = filters.configStatus === 'ALL' || row.materialPrepSummary.key === filters.configStatus;
        const matchesReceive = filters.receiveStatus === 'ALL' || row.materialClaimSummary.key === filters.receiveStatus;
        const matchesRisk = filters.riskFilter === 'ALL' ||
            (filters.riskFilter === 'ANY' ? row.riskTags.length > 0 : row.riskTags.some((tag) => tag.key === filters.riskFilter));
        return (matchesKeyword &&
            matchesProductionOrder &&
            matchesUrgency &&
            matchesShipDelta &&
            matchesStage &&
            matchesCompletion &&
            matchesConfig &&
            matchesReceive &&
            matchesRisk);
    });
}
export function buildProductionProgressSummary(rows) {
    return {
        totalCount: rows.length,
        urgentCount: rows.filter((row) => row.urgency.key === 'AA' || row.urgency.key === 'A').length,
        prepExceptionCount: rows.filter((row) => row.materialPrepSummary.key !== 'CONFIGURED').length,
        claimExceptionCount: rows.filter((row) => row.materialClaimSummary.key === 'EXCEPTION' || row.materialClaimSummary.key === 'NOT_RECEIVED').length,
        cuttingCount: rows.filter((row) => row.currentStage.key === 'CUTTING' || row.currentStage.key === 'WAITING_INBOUND' || row.currentStage.key === 'DONE').length,
        doneCount: rows.filter((row) => row.pieceCompletionSummary.key === 'COMPLETED').length,
    };
}
