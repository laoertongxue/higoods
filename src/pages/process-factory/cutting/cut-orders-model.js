import { listGeneratedCutOrderSourceRecords, } from '../../../data/fcs/cutting/generated-cut-orders.ts';
import { buildMaterialLedgerProjectionMap, } from '../../../data/fcs/cutting/material-ledger.ts';
import { buildProductionProgressRows, configMeta, receiveMeta, urgencyMeta, } from './production-progress-model.ts';
import { buildCutOrderStartStateLookup, resolveCutOrderStartState, } from './cutting-readiness.ts';
import { deriveCuttableMarkerEligibility, } from './cuttable-marker-eligibility.ts';
const numberFormatter = new Intl.NumberFormat('zh-CN');
const currencyFormatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
export const cutOrderStageMeta = {
    NOT_STARTED: { label: '未开工', className: 'bg-slate-100 text-slate-700' },
    STARTED: { label: '已开工', className: 'bg-violet-100 text-violet-700' },
    CLOSED: { label: '已关闭', className: 'bg-zinc-100 text-zinc-700' },
};
export const cutOrderCuttableMeta = {
    CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    CLOSED: { label: '已关闭', className: 'bg-zinc-100 text-zinc-700 border border-zinc-200' },
    NOT_STARTED: { label: '未开工', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
    NO_CLAIM_RECORD: { label: '无领料记录', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
    LOCKED_BY_MARKER_PLAN: { label: '可用余额已锁定', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
    NO_AVAILABLE_BALANCE: { label: '可用余额为 0', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
    NOT_ELIGIBLE: { label: '不可进入', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
};
export const cutOrderVisibleCuttableMeta = {
    CUTTABLE: { label: '可排唛架', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    NOT_CUTTABLE: { label: '不可排唛架', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
};
export const cutOrderRiskMeta = {
    PREP_DELAY: { label: '配料数量不足', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
    CLAIM_EXCEPTION: { label: '领料差异', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
    SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
    DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
    STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
    REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
    IN_MARKER_PLAN: { label: '唛架方案占用', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
};
function materialCategoryLabel(materialType) {
    if (materialType === 'PRINT')
        return '主料';
    if (materialType === 'DYE')
        return '主料';
    if (materialType === 'LINING')
        return '里辅料';
    return '主料';
}
function formatQty(value) {
    return numberFormatter.format(value);
}
function formatDisplayDate(value) {
    return value || '—';
}
export function formatCutOrderCurrency(value) {
    if (value === null || Number.isNaN(value))
        return '待补';
    return currencyFormatter.format(value);
}
function uniqueStrings(values) {
    return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function buildProgressLineFallback(source) {
    return {
        cutOrderId: source.cutOrderId,
        cutOrderNo: source.cutOrderNo,
        cutPieceOrderNo: source.cutOrderNo,
        markerPlanId: source.markerPlanId,
        markerPlanNo: source.markerPlanNo,
        materialSku: source.materialSku,
        materialType: source.materialType,
        materialLabel: source.materialLabel,
        materialAlias: source.materialAlias,
        materialImageUrl: source.materialImageUrl,
        color: source.colorScope[0] || '待补',
        materialCategory: source.materialCategory,
        materialIdentity: { ...source.materialIdentity },
        patternIdentity: {
            ...source.patternIdentity,
            piecePartCodes: [...source.patternIdentity.piecePartCodes],
            piecePartNames: [...source.patternIdentity.piecePartNames],
        },
        reviewStatus: 'NOT_REQUIRED',
        configStatus: 'NOT_CONFIGURED',
        receiveStatus: 'NOT_RECEIVED',
        configuredRollCount: 0,
        configuredLength: 0,
        receivedRollCount: 0,
        receivedLength: 0,
        printSlipStatus: 'NOT_PRINTED',
        qrStatus: 'NOT_GENERATED',
        markerPlanOccupancyStatus: source.markerPlanNo ? 'IN_MARKER_PLAN' : 'AVAILABLE',
        skuScopeLines: source.skuScopeLines.map((line) => ({ ...line })),
        issueFlags: [],
        latestActionText: `裁片单 ${source.cutOrderNo} 已从生产单生成，待进入执行准备。`,
    };
}
function createSummaryMeta(key, label, className, detailText) {
    return { key, label, className, detailText };
}
function getBatchSortTime(batch) {
    return batch.updatedAt || batch.createdAt || '';
}
export function summarizeMarkerPlanRefParticipation(cutOrderId, ledger) {
    const matched = ledger
        .filter((batch) => batch.items.some((item) => item.cutOrderId === cutOrderId || item.cutOrderNo === cutOrderId))
        .sort((left, right) => getBatchSortTime(right).localeCompare(getBatchSortTime(left), 'zh-CN'));
    return {
        markerPlanIds: matched.map((batch) => batch.markerPlanId),
        markerPlanNos: matched.map((batch) => batch.markerPlanNo),
        latestMarkerPlanNo: matched[0]?.markerPlanNo ?? '',
        batchParticipationCount: matched.length,
        activeMarkerPlanId: matched.find((batch) => batch.status !== 'CANCELLED')?.markerPlanId ?? '',
        activeMarkerPlanNo: matched.find((batch) => batch.status !== 'CANCELLED')?.markerPlanNo ?? '',
    };
}
export function deriveCutOrderStage(record, line, startState) {
    if (record.closeReason || record.closedAt || /已关闭|不再补裁/.test(record.cuttingStage)) {
        return createSummaryMeta('CLOSED', cutOrderStageMeta.CLOSED.label, cutOrderStageMeta.CLOSED.className, record.closeReason || '该裁片单已关闭，不再继续排唛架铺布裁剪。');
    }
    if (startState.started || record.hasSpreadingRecord || record.hasInboundRecord) {
        return createSummaryMeta('STARTED', cutOrderStageMeta.STARTED.label, cutOrderStageMeta.STARTED.className, '裁床已开工；排唛架、铺布、裁剪作为子作业单独追踪。');
    }
    return createSummaryMeta('NOT_STARTED', cutOrderStageMeta.NOT_STARTED.label, cutOrderStageMeta.NOT_STARTED.className, '裁床尚未开工。');
}
function buildCutOrderMaterialQuantityLedger(source, materialLedgerProjectionMap) {
    const projection = materialLedgerProjectionMap[source.cutOrderId] || materialLedgerProjectionMap[source.cutOrderNo];
    if (projection)
        return projection;
    return {
        cutOrderId: source.cutOrderId,
        cutOrderNo: source.cutOrderNo,
        productionOrderId: source.productionOrderId,
        productionOrderNo: source.productionOrderNo,
        materialIdentity: { ...source.materialIdentity },
        patternIdentity: {
            ...source.patternIdentity,
            piecePartCodes: [...source.patternIdentity.piecePartCodes],
            piecePartNames: [...source.patternIdentity.piecePartNames],
        },
        requiredMaterialQty: 0,
        transferWarehouseAllocatedQty: 0,
        cuttingClaimedQty: 0,
        markerLockedQty: 0,
        spreadingConsumedQty: 0,
        returnedQty: 0,
        adjustmentQty: 0,
        availableQty: 0,
        unit: source.materialIdentity.materialUnit || source.materialUnit || '米',
        latestClaimEvent: null,
        events: [],
    };
}
function hasClaimRecord(line, record) {
    return Number(line.receivedLength || 0) > 0
        || Number(line.receivedRollCount || 0) > 0
        || Boolean(record.lastPickupScanAt);
}
export function deriveCutOrderCuttableState(eligibility) {
    const reasonText = eligibility.reasonTexts.join('；') || '当前不满足可排唛架判断条件。';
    if (eligibility.reasonCodes.includes('CUT_ORDER_CLOSED')) {
        return {
            ...createSummaryMeta('CLOSED', cutOrderCuttableMeta.CLOSED.label, cutOrderCuttableMeta.CLOSED.className, '该裁片单已关闭。'),
            selectable: false,
            reasonText,
        };
    }
    if (eligibility.reasonCodes.includes('NO_CLAIM_RECORD')) {
        return {
            ...createSummaryMeta('NO_CLAIM_RECORD', cutOrderCuttableMeta.NO_CLAIM_RECORD.label, cutOrderCuttableMeta.NO_CLAIM_RECORD.className, '当前还没有裁床领料记录。'),
            selectable: false,
            reasonText,
        };
    }
    if (eligibility.reasonCodes.includes('NOT_STARTED')) {
        return {
            ...createSummaryMeta('NOT_STARTED', cutOrderCuttableMeta.NOT_STARTED.label, cutOrderCuttableMeta.NOT_STARTED.className, '已领料，待裁床任务开工。'),
            selectable: false,
            reasonText,
        };
    }
    if (eligibility.reasonCodes.includes('BALANCE_LOCKED_BY_DRAFT_MARKER_PLAN') || eligibility.reasonCodes.includes('BALANCE_LOCKED_BY_EFFECTIVE_MARKER_PLAN')) {
        return {
            ...createSummaryMeta('LOCKED_BY_MARKER_PLAN', cutOrderCuttableMeta.LOCKED_BY_MARKER_PLAN.label, cutOrderCuttableMeta.LOCKED_BY_MARKER_PLAN.className, `当前 ${eligibility.lockedQty}${eligibility.availableMaterialUnit} 可用余额已被唛架方案锁定。`),
            selectable: false,
            reasonText,
        };
    }
    if (eligibility.reasonCodes.includes('NO_AVAILABLE_BALANCE')) {
        return {
            ...createSummaryMeta('NO_AVAILABLE_BALANCE', cutOrderCuttableMeta.NO_AVAILABLE_BALANCE.label, cutOrderCuttableMeta.NO_AVAILABLE_BALANCE.className, '裁床已领面料已锁定或已消耗，暂无可排唛架余额。'),
            selectable: false,
            reasonText,
        };
    }
    if (!eligibility.isEligible) {
        return {
            ...createSummaryMeta('NOT_ELIGIBLE', cutOrderCuttableMeta.NOT_ELIGIBLE.label, cutOrderCuttableMeta.NOT_ELIGIBLE.className, reasonText),
            selectable: false,
            reasonText,
        };
    }
    return {
        ...createSummaryMeta('CUTTABLE', cutOrderCuttableMeta.CUTTABLE.label, cutOrderCuttableMeta.CUTTABLE.className, '未关闭、已开工、有领料记录、有可用余额，且当前余额未被唛架方案全量锁定。'),
        selectable: true,
        reasonText: '当前裁片单满足可排唛架条件。',
    };
}
export function summarizeCutOrderRisks(record, line, cuttableState, batchParticipationCount) {
    const keys = new Set();
    if (line.configStatus === 'NOT_CONFIGURED' || line.configStatus === 'PARTIAL')
        keys.add('PREP_DELAY');
    if (line.issueFlags.includes('RECEIVE_DIFF'))
        keys.add('CLAIM_EXCEPTION');
    if (!record.plannedShipDate)
        keys.add('DATE_MISSING');
    if (record.urgencyLevel === 'AA' || record.urgencyLevel === 'A')
        keys.add('SHIP_URGENT');
    if (line.issueFlags.includes('REPLENISH_PENDING') || record.riskFlags.includes('REPLENISH_PENDING'))
        keys.add('REPLENISH_PENDING');
    if (batchParticipationCount > 0)
        keys.add('IN_MARKER_PLAN');
    if (/已完成/.test(record.cuttingStage) && !record.hasInboundRecord)
        keys.add('STATUS_CONFLICT');
    return Array.from(keys).map((key) => ({
        key,
        label: cutOrderRiskMeta[key].label,
        className: cutOrderRiskMeta[key].className,
    }));
}
export function buildCutOrderNavigationPayload(row) {
    return {
        productionProgress: {
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
        },
        materialPrep: {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
            materialSku: row.materialSku,
        },
        markerSpreading: {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            markerPlanNo: row.latestMarkerPlanNo || undefined,
            tab: 'spreadings',
        },
        feiTickets: {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
        },
        replenishment: {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            productionOrderNo: row.productionOrderNo,
        },
        markerPlanRefs: {
            markerPlanId: row.activeMarkerPlanRefId || undefined,
            markerPlanNo: row.latestMarkerPlanNo || undefined,
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
        },
        sameProductionOrders: {
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
        },
    };
}
function buildKeywordIndex(values) {
    return values
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
        .map((value) => String(value).toLowerCase());
}
function buildDateInfoLines(record) {
    return [
        { label: '需求', value: formatDisplayDate(record.purchaseDate) },
        { label: '下单', value: formatDisplayDate(record.actualOrderDate) },
        { label: '回货', value: formatDisplayDate(record.plannedShipDate) },
    ];
}
function deriveVisibleCuttableStatus(cuttableState) {
    const key = cuttableState.key === 'CUTTABLE' ? 'CUTTABLE' : 'NOT_CUTTABLE';
    const meta = cutOrderVisibleCuttableMeta[key];
    return {
        key,
        label: meta.label,
        className: meta.className,
    };
}
function buildPrepSummary(line) {
    const meta = configMeta[line.configStatus];
    const detailText = line.configStatus === 'CONFIGURED'
        ? `中转仓已配 ${formatQty(line.configuredRollCount)} 卷 / ${formatQty(line.configuredLength)} 米。`
        : line.configStatus === 'PARTIAL'
            ? `中转仓已配 ${formatQty(line.configuredRollCount)} 卷，仍有剩余待补齐。`
            : '当前尚未进入待加工仓。';
    return createSummaryMeta(line.configStatus, meta.label, meta.className, detailText);
}
function buildClaimSummary(line) {
    const meta = receiveMeta[line.receiveStatus];
    const detailText = line.receiveStatus === 'RECEIVED'
        ? `裁床已领 ${formatQty(line.receivedRollCount)} 卷 / ${formatQty(line.receivedLength)} 米。`
        : line.receiveStatus === 'PARTIAL'
            ? `裁床已领 ${formatQty(line.receivedRollCount)} 卷，仍有余量可继续领料。`
            : '当前尚未完成领料。';
    return createSummaryMeta(line.receiveStatus, meta.label, meta.className, detailText);
}
function createRow(source, record, line, progressRow, ledger, options) {
    const batchSummary = summarizeMarkerPlanRefParticipation(source.cutOrderId, ledger);
    const materialQuantityLedger = buildCutOrderMaterialQuantityLedger(source, options.materialLedgerProjectionMap);
    const eligibility = deriveCuttableMarkerEligibility({
        cutOrderId: source.cutOrderId,
        productionOrderId: source.productionOrderId,
        line,
        record,
        startState: options.startState,
        materialLedgerProjection: materialQuantityLedger,
        markerPlanOccupancy: options.markerPlanOccupancy,
    });
    const cuttableState = deriveCutOrderCuttableState(eligibility);
    const currentStage = deriveCutOrderStage(record, line, options.startState);
    const materialPrepStatus = buildPrepSummary(line);
    const materialClaimStatus = buildClaimSummary(line);
    const urgencyKey = progressRow?.urgency.key ?? 'UNKNOWN';
    const urgency = urgencyMeta[urgencyKey];
    const currentStageLabel = currentStage.label;
    const visibleCuttableStatus = deriveVisibleCuttableStatus(cuttableState);
    const markerPlanIds = options.markerPlanOccupancy?.markerPlanId
        ? uniqueStrings([options.markerPlanOccupancy.markerPlanId, ...batchSummary.markerPlanIds])
        : batchSummary.markerPlanIds;
    const markerPlanNos = options.markerPlanOccupancy?.markerPlanNo
        ? uniqueStrings([options.markerPlanOccupancy.markerPlanNo, ...batchSummary.markerPlanNos])
        : batchSummary.markerPlanNos;
    const markerPlanParticipationCount = Math.max(batchSummary.batchParticipationCount, options.markerPlanOccupancy?.markerPlanNo || options.markerPlanOccupancy?.markerPlanId ? 1 : 0);
    const activeMarkerPlanId = options.markerPlanOccupancy?.markerPlanId || batchSummary.activeMarkerPlanId;
    const activeMarkerPlanNo = options.markerPlanOccupancy?.markerPlanNo || batchSummary.activeMarkerPlanNo;
    const latestMarkerPlanNo = options.markerPlanOccupancy?.markerPlanNo || batchSummary.latestMarkerPlanNo;
    const riskTags = summarizeCutOrderRisks(record, line, cuttableState, markerPlanParticipationCount);
    const patternIdentity = line.patternIdentity || source.patternIdentity;
    const materialIdentity = line.materialIdentity || source.materialIdentity;
    const row = {
        id: source.cutOrderId,
        cutOrderId: source.cutOrderId,
        cutOrderNo: source.cutOrderNo,
        productionOrderId: source.productionOrderId,
        productionOrderNo: source.productionOrderNo,
        assignedFactoryId: '',
        assignedFactoryName: progressRow?.assignedFactoryName || '',
        styleCode: record.styleCode,
        spuCode: record.spuCode,
        styleName: record.styleName,
        color: materialIdentity.materialColor || line.color || source.colorScope[0] || '待补',
        materialSku: source.materialSku,
        materialType: source.materialType,
        materialCategory: source.materialCategory || materialCategoryLabel(source.materialType),
        materialLabel: source.materialLabel,
        materialName: materialIdentity.materialName || source.materialName || source.materialLabel,
        materialColor: materialIdentity.materialColor || source.materialColor || line.color || source.colorScope[0] || '',
        materialAlias: materialIdentity.materialAlias || source.materialAlias || line.materialAlias || '',
        materialImageUrl: materialIdentity.materialImageUrl || source.materialImageUrl || line.materialImageUrl || '',
        materialUnit: materialIdentity.materialUnit || source.materialUnit || '米',
        patternFileId: patternIdentity.patternFileId,
        patternFileName: patternIdentity.patternFileName,
        patternVersion: patternIdentity.patternVersion,
        patternKind: patternIdentity.patternKind,
        effectiveWidthText: `${patternIdentity.effectiveWidthValue}${patternIdentity.effectiveWidthUnit}`,
        piecePartNames: [...patternIdentity.piecePartNames],
        orderQty: record.orderQty,
        pieceCountText: formatQty(record.orderQty),
        plannedQty: source.requiredQty,
        receivedQty: line.receivedLength,
        materialQuantityLedger,
        purchaseDate: record.purchaseDate,
        actualOrderDate: record.actualOrderDate,
        plannedShipDate: record.plannedShipDate,
        dateInfoLines: buildDateInfoLines(record),
        sellingPrice: record.sellingPrice ?? null,
        urgencyKey,
        urgencyLabel: urgency.label,
        urgencyClassName: urgency.className,
        materialPrepStatus,
        materialClaimStatus,
        currentStage,
        currentStageLabel,
        cuttableState,
        eligibility,
        reasonTexts: [...eligibility.reasonTexts],
        currentLocks: eligibility.currentLocks.map((lock) => ({ ...lock })),
        availableQty: eligibility.availableMaterialQty,
        availableUnit: eligibility.availableMaterialUnit,
        claimedQty: eligibility.claimedQty,
        lockedQty: eligibility.lockedQty,
        consumedQty: eligibility.consumedQty,
        visibleCuttableStatus,
        markerPlanIds,
        markerPlanNos,
        latestMarkerPlanNo,
        batchParticipationCount: markerPlanParticipationCount,
        activeMarkerPlanId,
        activeMarkerPlanNo,
        closeReasonCode: record.closeReasonCode,
        closeReasonText: record.closeReasonText || '',
        closeReason: record.closeReason || '',
        closedAt: record.closedAt || '',
        closedBy: record.closedBy || '',
        ledgerSnapshotBeforeClose: record.ledgerSnapshotBeforeClose || null,
        riskTags,
        statusSummary: [
            `裁片单${currentStage.label}`,
            `可排唛架判断${visibleCuttableStatus.label}`,
        ].join(' / '),
        relationSummary: markerPlanParticipationCount
            ? `已参与 ${markerPlanParticipationCount} 个唛架方案`
            : '当前尚未进入唛架方案',
        latestActionText: line.latestActionText || record.lastFieldUpdateAt || '暂无最近执行痕迹。',
        navigationPayload: buildCutOrderNavigationPayload({
            cutOrderId: source.cutOrderId,
            cutOrderNo: source.cutOrderNo,
            productionOrderId: source.productionOrderId,
            productionOrderNo: source.productionOrderNo,
            styleCode: record.styleCode,
            spuCode: record.spuCode,
            materialSku: source.materialSku,
            activeMarkerPlanRefId: activeMarkerPlanId,
            latestMarkerPlanNo,
        }),
        keywordIndex: buildKeywordIndex([
            source.cutOrderNo,
            source.productionOrderId,
            source.productionOrderNo,
            record.styleCode,
            record.spuCode,
            record.styleName,
            source.materialSku,
            source.materialLabel,
            source.materialAlias,
            source.materialColor,
            source.materialName,
            source.patternIdentity.patternFileId,
            source.patternIdentity.patternFileName,
            source.patternIdentity.patternVersion,
            source.patternIdentity.patternKind,
            `${source.patternIdentity.effectiveWidthValue}${source.patternIdentity.effectiveWidthUnit}`,
            ...source.patternIdentity.piecePartNames,
            source.materialType,
            source.materialCategory,
            line.color,
            batchSummary.latestMarkerPlanNo,
        ]),
    };
    return row;
}
export function buildCutOrderViewModel(records, ledger = [], options = {}) {
    const startStateLookup = buildCutOrderStartStateLookup();
    const markerPlanOccupancyLookup = options.markerPlanOccupancy ?? {};
    const materialLedgerProjectionMap = buildMaterialLedgerProjectionMap();
    const progressRowMap = new Map((options.progressRows ?? buildProductionProgressRows(records)).map((row) => [row.productionOrderId, row]));
    const recordMap = new Map(records.map((record) => [record.productionOrderId, record]));
    const lineMap = new Map();
    records.forEach((record) => {
        record.materialLines.forEach((line) => {
            const key = line.cutOrderId || line.cutOrderNo || line.cutPieceOrderNo;
            if (key)
                lineMap.set(key, line);
        });
    });
    const rows = listGeneratedCutOrderSourceRecords()
        .map((source) => {
        const record = recordMap.get(source.productionOrderId);
        if (!record)
            return null;
        const line = lineMap.get(source.cutOrderId) || buildProgressLineFallback(source);
        return createRow(source, record, line, progressRowMap.get(source.productionOrderId), ledger, {
            startState: resolveCutOrderStartState(startStateLookup, {
                cutOrderId: source.cutOrderId,
                cutOrderNo: source.cutOrderNo,
                cutPieceOrderNo: line.cutPieceOrderNo,
            }),
            markerPlanOccupancy: markerPlanOccupancyLookup[source.cutOrderId] || markerPlanOccupancyLookup[source.cutOrderNo] || null,
            materialLedgerProjectionMap,
        });
    })
        .filter((row) => row !== null)
        .sort((left, right) => {
        const leftWeight = urgencyMeta[left.urgencyKey].sortWeight;
        const rightWeight = urgencyMeta[right.urgencyKey].sortWeight;
        return (rightWeight - leftWeight ||
            left.plannedShipDate.localeCompare(right.plannedShipDate, 'zh-CN') ||
            left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN') ||
            left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'));
    });
    return {
        rows,
        rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
    };
}
function matchText(value, search) {
    return value.toLowerCase().includes(search.trim().toLowerCase());
}
function applyPrefilter(rows, prefilter) {
    if (!prefilter)
        return rows;
    return rows.filter((row) => {
        if (prefilter.productionOrderId && row.productionOrderId !== prefilter.productionOrderId)
            return false;
        if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo)
            return false;
        if (prefilter.cutOrderId && row.cutOrderId !== prefilter.cutOrderId)
            return false;
        if (prefilter.cutOrderNo && row.cutOrderNo !== prefilter.cutOrderNo)
            return false;
        if (prefilter.markerPlanId && !row.markerPlanIds.includes(prefilter.markerPlanId))
            return false;
        if (prefilter.markerPlanNo && !row.markerPlanNos.includes(prefilter.markerPlanNo))
            return false;
        if (prefilter.styleCode && row.styleCode !== prefilter.styleCode)
            return false;
        if (prefilter.spuCode && row.spuCode !== prefilter.spuCode)
            return false;
        if (prefilter.materialSku && row.materialSku !== prefilter.materialSku)
            return false;
        return true;
    });
}
export function filterCutOrderRows(rows, filters, prefilter) {
    const prefilteredRows = applyPrefilter(rows, prefilter);
    return prefilteredRows.filter((row) => {
        if (filters.keyword && !row.keywordIndex.some((value) => value.includes(filters.keyword.trim().toLowerCase())))
            return false;
        if (filters.productionOrderNo && !matchText(row.productionOrderNo, filters.productionOrderNo))
            return false;
        if (filters.styleKeyword) {
            const styleNeedle = filters.styleKeyword.trim().toLowerCase();
            if (![row.styleCode, row.spuCode, row.styleName].some((value) => value.toLowerCase().includes(styleNeedle)))
                return false;
        }
        if (filters.materialSku) {
            const materialNeedle = filters.materialSku.trim().toLowerCase();
            if (![row.materialSku, row.materialCategory, row.materialLabel].some((value) => value.toLowerCase().includes(materialNeedle)))
                return false;
        }
        if (filters.currentStage !== 'ALL' && row.currentStage.key !== filters.currentStage)
            return false;
        if (filters.cuttableState !== 'ALL' && row.visibleCuttableStatus.key !== filters.cuttableState)
            return false;
        if (filters.inBatch === 'IN_MARKER_PLAN' && !row.activeMarkerPlanNo)
            return false;
        if (filters.inBatch === 'NOT_IN_MARKER_PLAN' && row.activeMarkerPlanNo)
            return false;
        if (filters.hasAvailableBalance === 'YES' && row.materialQuantityLedger.availableQty <= 0)
            return false;
        if (filters.hasAvailableBalance === 'NO' && row.materialQuantityLedger.availableQty > 0)
            return false;
        if (filters.hasCloseReason === 'YES' && !row.closeReason)
            return false;
        if (filters.hasCloseReason === 'NO' && row.closeReason)
            return false;
        if (filters.riskOnly && row.riskTags.length === 0)
            return false;
        return true;
    });
}
export function buildCutOrderStats(rows) {
    return {
        totalCount: rows.length,
        cuttableCount: rows.filter((row) => row.cuttableState.key === 'CUTTABLE').length,
        inBatchCount: rows.filter((row) => row.activeMarkerPlanNo).length,
        availableBalanceCount: rows.filter((row) => row.materialQuantityLedger.availableQty > 0).length,
        closedCount: rows.filter((row) => row.currentStage.key === 'CLOSED').length,
        noClaimRecordCount: rows.filter((row) => row.cuttableState.key === 'NO_CLAIM_RECORD').length,
    };
}
export function findCutOrderByPrefilter(rows, prefilter) {
    if (!prefilter)
        return null;
    if (prefilter.cutOrderId)
        return rows.find((row) => row.cutOrderId === prefilter.cutOrderId) ?? null;
    if (prefilter.cutOrderNo)
        return rows.find((row) => row.cutOrderNo === prefilter.cutOrderNo) ?? null;
    return null;
}
