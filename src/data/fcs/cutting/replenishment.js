import { readMarkerSpreadingPrototypeData } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts';
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts';
export const replenishmentSuggestionRecords = [
    {
        id: 'rep-001',
        replenishmentNo: 'RP-202603-018-01',
        cutPieceOrderNo: 'CP-202603-018-01',
        productionOrderNo: 'PO-202603-018',
        materialSku: 'ML-PRINT-240311-01',
        materialType: 'PRINT',
        materialLabel: '面料 · 玫瑰满印布',
        suggestionCreatedAt: '2026-03-22 10:35',
        suggestionSourceTypes: ['SPREADING', 'RECEIVE_DISCREPANCY'],
        shortageReasonType: 'LENGTH_SHORTAGE',
        riskLevel: 'HIGH',
        reviewStatus: 'PENDING',
        reviewerName: '',
        reviewedAt: '',
        reviewComment: '',
        requiredQty: 124,
        theoreticalYieldQty: 122,
        predictedActualQty: 108,
        gapQty: 16,
        suggestedReplenishRollCount: 2,
        suggestedReplenishLength: 86,
        configStatus: 'PARTIAL',
        receiveStatus: 'PARTIAL',
        configuredLength: 650,
        receivedLength: 430,
        latestReceiveAt: '2026-03-20 14:12',
        latestReceiveBy: '黄秀娟',
        markerSizeMixSummary: 'S×30 / M×36 / L×32 / XL×18 / 2XL×8',
        markerTotalPieces: 124,
        markerNetLength: 12.8,
        perPieceConsumption: 0.103,
        spreadingLayerCount: 82,
        fabricHeadLength: 3.2,
        fabricTailLength: 2.6,
        hasMarkerImage: true,
        spreadingRecordCount: 2,
        totalSpreadLength: 442.7,
        latestSpreadingAt: '2026-03-21 09:45',
        latestSpreadingBy: '郑海燕',
        hasExecutionDiscrepancy: true,
        impactFlags: ['RECONFIG_REQUIRED', 'RERECEIVE_REQUIRED', 'PENDING_PREP_REQUIRED'],
        impactPreview: {
            requiresReconfig: true,
            requiresRereceive: true,
            requiresPendingPrep: true,
            impactDescription: '当前领料差异与铺布长度缺口叠加，若补料通过，需要中转仓重新补配并补打领料单。',
            nextSuggestedActionText: '优先由中转仓补齐 2 卷，裁床领料后进入待加工仓。',
        },
        linkedDocumentSummaries: [
            { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-018-01', status: '裁片执行中', createdAt: '2026-03-18 09:10', summaryText: '已维护排唛架方案并有 2 条铺布记录。' },
            { docType: 'CONFIG_BATCH', docNo: 'CFG-018-03', status: '待补齐', createdAt: '2026-03-20 08:45', summaryText: '最新补配 4 卷 / 220 米，尚未完全覆盖缺口。' },
            { docType: 'PICKUP_RECORD', docNo: 'RCV-018-01', status: '驳回核对', createdAt: '2026-03-20 14:12', summaryText: '现场少领 2 卷，当前存在执行差异。' },
            { docType: 'REPLENISHMENT_REVIEW', docNo: '—', status: '待审核', createdAt: '-', summaryText: '等待运营审核是否生效。' },
        ],
        note: '审批通过后进入待加工仓。',
    },
    {
        id: 'rep-002',
        replenishmentNo: 'RP-202603-024-02',
        cutPieceOrderNo: 'CP-202603-024-02',
        productionOrderNo: 'PO-202603-024',
        materialSku: 'ML-LIN-240320-09',
        materialType: 'LINING',
        materialLabel: '里布 · 涤纶里布 150D',
        suggestionCreatedAt: '2026-03-22 10:30',
        suggestionSourceTypes: ['MARKER', 'MANUAL_REVIEW'],
        shortageReasonType: 'YIELD_RISK',
        riskLevel: 'MEDIUM',
        reviewStatus: 'NEED_MORE_INFO',
        reviewerName: '陈秋颖',
        reviewedAt: '2026-03-22 11:10',
        reviewComment: '需先补齐里布审核卷数，再确认是否按样衣参考追加 1 卷。',
        requiredQty: 46,
        theoreticalYieldQty: 46,
        predictedActualQty: 42,
        gapQty: 4,
        suggestedReplenishRollCount: 1,
        suggestedReplenishLength: 38,
        configStatus: 'NOT_CONFIGURED',
        receiveStatus: 'NOT_RECEIVED',
        configuredLength: 0,
        receivedLength: 0,
        latestReceiveAt: '',
        latestReceiveBy: '',
        markerSizeMixSummary: 'S×12 / M×12 / L×10 / XL×8 / 2XL×4',
        markerTotalPieces: 46,
        markerNetLength: 6.4,
        perPieceConsumption: 0.139,
        spreadingLayerCount: 64,
        fabricHeadLength: 2.1,
        fabricTailLength: 1.8,
        hasMarkerImage: false,
        spreadingRecordCount: 0,
        totalSpreadLength: 0,
        latestSpreadingAt: '',
        latestSpreadingBy: '',
        hasExecutionDiscrepancy: false,
        impactFlags: ['RECONFIG_REQUIRED'],
        impactPreview: {
            requiresReconfig: true,
            requiresRereceive: false,
            requiresPendingPrep: true,
            impactDescription: '当前建议主要用于补充里布准备，若审核通过，需要重新回到中转仓配料页完成配置。',
            nextSuggestedActionText: '先补齐审核卷数，再决定是否补里布 1 卷。',
        },
        linkedDocumentSummaries: [
            { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-024-02', status: '待维护排唛架方案', createdAt: '2026-03-21 09:50', summaryText: '里布裁片单已维护尺码配比，但方案图或唛架明细图未生成。' },
            { docType: 'CONFIG_BATCH', docNo: '—', status: '未配置', createdAt: '-', summaryText: '当前尚未产生中转仓配料数量。' },
            { docType: 'PICKUP_RECORD', docNo: '—', status: '暂无', createdAt: '-', summaryText: '尚未有来料扫码记录。' },
            { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-024-02', status: '待补充说明', createdAt: '2026-03-22 11:10', summaryText: '等待补充里布审核依据后再决定。' },
        ],
        note: '当前不单独创建补料配置流，只在审核后提示返回中转仓配料页处理。',
    },
    {
        id: 'rep-003',
        replenishmentNo: 'RP-202603-031-01',
        cutPieceOrderNo: 'CP-202603-031-01',
        productionOrderNo: 'PO-202603-031',
        materialSku: 'ML-PRINT-240327-08',
        materialType: 'PRINT',
        materialLabel: '面料 · 复古花叶提花',
        suggestionCreatedAt: '2026-03-22 12:05',
        suggestionSourceTypes: ['SPREADING', 'EXECUTION_RISK'],
        shortageReasonType: 'LENGTH_SHORTAGE',
        riskLevel: 'HIGH',
        reviewStatus: 'APPROVED',
        reviewerName: '陆嘉敏',
        reviewedAt: '2026-03-22 13:20',
        reviewComment: '同意补 1 卷，审批通过后统一由中转仓配料、裁床领料入待加工仓。',
        requiredQty: 96,
        theoreticalYieldQty: 96,
        predictedActualQty: 88,
        gapQty: 8,
        suggestedReplenishRollCount: 1,
        suggestedReplenishLength: 52,
        configStatus: 'CONFIGURED',
        receiveStatus: 'PARTIAL',
        configuredLength: 290,
        receivedLength: 238,
        latestReceiveAt: '2026-03-22 11:18',
        latestReceiveBy: '郑海燕',
        markerSizeMixSummary: 'S×24 / M×28 / L×26 / XL×12 / 2XL×6',
        markerTotalPieces: 96,
        markerNetLength: 10.2,
        perPieceConsumption: 0.106,
        spreadingLayerCount: 76,
        fabricHeadLength: 2.8,
        fabricTailLength: 2.2,
        hasMarkerImage: true,
        spreadingRecordCount: 1,
        totalSpreadLength: 177.8,
        latestSpreadingAt: '2026-03-22 10:55',
        latestSpreadingBy: '郑海燕',
        hasExecutionDiscrepancy: true,
        impactFlags: ['RECONFIG_REQUIRED', 'RERECEIVE_REQUIRED', 'PENDING_PREP_REQUIRED'],
        impactPreview: {
            requiresReconfig: true,
            requiresRereceive: true,
            requiresPendingPrep: true,
            impactDescription: '该差异处理已通过，后续需由中转仓补配并重新领料后进入待加工仓。',
            nextSuggestedActionText: '回到中转仓配料页新增补配数量，并继续裁床领料。',
        },
        linkedDocumentSummaries: [
            { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-031-01', status: '裁片执行中', createdAt: '2026-03-22 08:35', summaryText: '方案图和唛架明细图已生成，现场已有 1 条铺布记录。' },
            { docType: 'CONFIG_BATCH', docNo: 'CFG-031-02', status: '已完成', createdAt: '2026-03-22 08:40', summaryText: '本批次补齐剩余 5 卷 / 290 米。' },
            { docType: 'PICKUP_RECORD', docNo: 'RCV-031-01', status: '已提交照片', createdAt: '2026-03-22 11:18', summaryText: '现场少领 1 卷，已提交 3 张差异照片。' },
            { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-031-01', status: '已通过', createdAt: '2026-03-22 13:20', summaryText: '已生效，待回到中转仓配料继续处理。' },
        ],
        note: '该建议已生效，唯一 follow-up 是在原裁片任务下生成补料配料数量。',
    },
    {
        id: 'rep-004',
        replenishmentNo: 'RP-202603-031-03',
        cutPieceOrderNo: 'CP-202603-031-02',
        productionOrderNo: 'PO-202603-031',
        materialSku: 'ML-SOLID-240327-21',
        materialType: 'SOLID',
        materialLabel: '面料 · 水洗白府绸',
        suggestionCreatedAt: '2026-03-22 15:10',
        suggestionSourceTypes: ['RECEIVE_DISCREPANCY'],
        shortageReasonType: 'RECEIVE_GAP',
        riskLevel: 'LOW',
        reviewStatus: 'REJECTED',
        reviewerName: '陆嘉敏',
        reviewedAt: '2026-03-22 15:45',
        reviewComment: '复核后确认为扫描漏记，不需要补料，维持当前入仓节奏。',
        requiredQty: 70,
        theoreticalYieldQty: 70,
        predictedActualQty: 69,
        gapQty: 1,
        suggestedReplenishRollCount: 0,
        suggestedReplenishLength: 0,
        configStatus: 'CONFIGURED',
        receiveStatus: 'RECEIVED',
        configuredLength: 360,
        receivedLength: 360,
        latestReceiveAt: '2026-03-22 13:10',
        latestReceiveBy: '郑海燕',
        markerSizeMixSummary: 'S×16 / M×20 / L×20 / XL×10 / 2XL×4',
        markerTotalPieces: 70,
        markerNetLength: 8.4,
        perPieceConsumption: 0.12,
        spreadingLayerCount: 58,
        fabricHeadLength: 1.9,
        fabricTailLength: 1.6,
        hasMarkerImage: true,
        spreadingRecordCount: 2,
        totalSpreadLength: 270,
        latestSpreadingAt: '2026-03-22 14:30',
        latestSpreadingBy: '郑海燕',
        hasExecutionDiscrepancy: false,
        impactFlags: [],
        impactPreview: {
            requiresReconfig: false,
            requiresRereceive: false,
            requiresPendingPrep: false,
            impactDescription: '该建议已驳回，不需要补料，也不会触发后续中转仓配料调整。',
            nextSuggestedActionText: '维持当前入仓与汇总节奏，记录审核意见即可。',
        },
        linkedDocumentSummaries: [
            { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-031-02', status: '已入仓', createdAt: '2026-03-22 15:20', summaryText: '该裁片单已完成入裁片仓。' },
            { docType: 'CONFIG_BATCH', docNo: 'CFG-031-03', status: '已完成', createdAt: '2026-03-22 09:00', summaryText: '整单一次发齐。' },
            { docType: 'PICKUP_RECORD', docNo: 'RCV-031-02', status: '匹配', createdAt: '2026-03-22 13:10', summaryText: '裁床领料与待加工仓一致。' },
            { docType: 'REPLENISHMENT_REVIEW', docNo: 'RV-202603-031-03', status: '已驳回', createdAt: '2026-03-22 15:45', summaryText: '复核确认无需补料。' },
        ],
        note: '该单仅保留审核痕迹，用于总结页汇总补料驳回次数。',
    },
    {
        id: 'rep-005',
        replenishmentNo: 'RP-202603-044-01',
        cutPieceOrderNo: 'CP-202603-044-01',
        productionOrderNo: 'PO-202603-044',
        materialSku: 'ML-DYE-240331-06',
        materialType: 'DYE',
        materialLabel: '面料 · 雾蓝细斜布',
        suggestionCreatedAt: '2026-03-22 16:00',
        suggestionSourceTypes: ['EXECUTION_RISK', 'MARKER'],
        shortageReasonType: 'MANUAL_REVIEW',
        riskLevel: 'MEDIUM',
        reviewStatus: 'PENDING',
        reviewerName: '',
        reviewedAt: '',
        reviewComment: '',
        requiredQty: 88,
        theoreticalYieldQty: 88,
        predictedActualQty: 82,
        gapQty: 6,
        suggestedReplenishRollCount: 1,
        suggestedReplenishLength: 40,
        configStatus: 'PARTIAL',
        receiveStatus: 'NOT_RECEIVED',
        configuredLength: 180,
        receivedLength: 0,
        latestReceiveAt: '',
        latestReceiveBy: '',
        markerSizeMixSummary: 'S×18 / M×22 / L×24 / XL×16 / 2XL×8',
        markerTotalPieces: 88,
        markerNetLength: 9.1,
        perPieceConsumption: 0.104,
        spreadingLayerCount: 69,
        fabricHeadLength: 2.4,
        fabricTailLength: 1.9,
        hasMarkerImage: false,
        spreadingRecordCount: 0,
        totalSpreadLength: 0,
        latestSpreadingAt: '',
        latestSpreadingBy: '',
        hasExecutionDiscrepancy: false,
        impactFlags: ['RECONFIG_REQUIRED', 'PENDING_PREP_REQUIRED'],
        impactPreview: {
            requiresReconfig: true,
            requiresRereceive: false,
            requiresPendingPrep: true,
            impactDescription: '若确认仍需补裁，等待裁床再次领料；有领料余额后再补排唛架。',
            nextSuggestedActionText: '先确认是否继续补裁，再根据已领余额补排唛架或关闭裁片单。',
        },
        linkedDocumentSummaries: [
            { docType: 'CUT_PIECE_ORDER', docNo: 'CP-202603-044-01', status: '待铺布', createdAt: '2026-03-22 09:30', summaryText: '当前只有唛架摘要，尚无铺布记录。' },
            { docType: 'CONFIG_BATCH', docNo: 'CFG-044-01', status: '部分配置', createdAt: '2026-03-22 10:20', summaryText: '当前仅配置 180 米，低于理论需求。' },
            { docType: 'PICKUP_RECORD', docNo: '—', status: '未入待加工仓', createdAt: '-', summaryText: '尚无扫码领取记录。' },
            { docType: 'REPLENISHMENT_REVIEW', docNo: '—', status: '待审核', createdAt: '-', summaryText: '待确认是否生成补料配料数量。' },
        ],
        note: '该建议重点在于提醒补料后需回中转仓配料，不在本步分流其它工艺页面。',
    },
];
export function cloneReplenishmentSuggestionRecords() {
    return replenishmentSuggestionRecords.map((record) => ({
        ...record,
        suggestionSourceTypes: [...record.suggestionSourceTypes],
        impactFlags: [...record.impactFlags],
        impactPreview: { ...record.impactPreview },
        linkedDocumentSummaries: record.linkedDocumentSummaries.map((doc) => ({ ...doc })),
    }));
}
function resolveReplenishmentSourceCutOrder(suggestion, sourceRecords) {
    const byExactNo = sourceRecords.find((record) => record.cutOrderNo === suggestion.cutPieceOrderNo)
        || sourceRecords.find((record) => record.cutOrderNo === suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-'));
    if (byExactNo)
        return byExactNo;
    const sameProductionOrder = sourceRecords.filter((record) => record.productionOrderNo === suggestion.productionOrderNo);
    if (!sameProductionOrder.length)
        return null;
    return (sameProductionOrder
        .slice()
        .sort((left, right) => {
        const score = (record) => {
            let value = 0;
            if (record.materialSku === suggestion.materialSku)
                value += 32;
            if (record.materialType === suggestion.materialType)
                value += 20;
            if (record.materialLabel === suggestion.materialLabel)
                value += 12;
            if (record.requiredQty === suggestion.requiredQty)
                value += 8;
            if (record.markerPlanId)
                value += 2;
            return value;
        };
        return score(right) - score(left) || right.cutOrderNo.localeCompare(left.cutOrderNo, 'zh-CN');
    })[0] || null);
}
function pickReplenishmentSourceSession(suggestion, sourceCutOrderId, sessions) {
    const scoreSession = (session) => {
        let value = 0;
        if (sourceCutOrderId && session.cutOrderIds.includes(sourceCutOrderId))
            value += 40;
        if ((session.completionLinkage?.linkedCutOrderNos || []).includes(suggestion.cutPieceOrderNo))
            value += 20;
        if ((session.completionLinkage?.linkedCutOrderNos || []).includes(suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-')))
            value += 18;
        if (session.materialSkuSummary?.includes(suggestion.materialSku))
            value += 12;
        if (suggestion.reviewStatus === 'PENDING' && session.prototypeLifecycleOverrides?.replenishmentStatusLabel === '待补料确认')
            value += 24;
        if (suggestion.reviewStatus === 'APPROVED' && session.replenishmentWarning?.handled)
            value += 18;
        if (session.status === 'DONE')
            value += 8;
        if (session.sourceMarkerId || session.markerId)
            value += 2;
        return value;
    };
    const directMatchedSessions = sessions.filter((session) => session.cutOrderIds.includes(sourceCutOrderId)
        || (session.completionLinkage?.linkedCutOrderNos || []).includes(suggestion.cutPieceOrderNo)
        || (session.completionLinkage?.linkedCutOrderNos || []).includes(suggestion.cutPieceOrderNo.replace(/^CP-/, 'CUT-')));
    const rankedSessions = (directMatchedSessions.length ? directMatchedSessions : sessions)
        .slice()
        .sort((left, right) => {
        return scoreSession(right) - scoreSession(left) || right.updatedAt.localeCompare(left.updatedAt, 'zh-CN');
    });
    const best = rankedSessions[0] || null;
    if (!best)
        return null;
    const threshold = directMatchedSessions.length ? 18 : 24;
    return scoreSession(best) >= threshold ? best : null;
}
function isPendingReplenishmentSession(session) {
    return session.prototypeLifecycleOverrides?.replenishmentStatusLabel === '待补料确认';
}
function isHandledReplenishmentSession(session) {
    return Boolean(session.replenishmentWarning?.handled) || session.status === 'DONE';
}
function buildReplenishmentSourceSessionMap(records, sessions) {
    const cutOrderSourceRecords = listGeneratedCutOrderSourceRecords();
    const usedSessionIds = new Set();
    const sessionBySuggestionId = new Map();
    const pendingPool = sessions.filter(isPendingReplenishmentSession);
    const handledPool = sessions.filter(isHandledReplenishmentSession);
    records.forEach((record) => {
        const sourceCutOrder = resolveReplenishmentSourceCutOrder(record, cutOrderSourceRecords);
        const directSession = pickReplenishmentSourceSession(record, sourceCutOrder?.cutOrderId || '', sessions);
        if (directSession && !usedSessionIds.has(directSession.spreadingSessionId)) {
            sessionBySuggestionId.set(record.id, directSession);
            usedSessionIds.add(directSession.spreadingSessionId);
            return;
        }
        const pool = record.reviewStatus === 'APPROVED' ? handledPool : pendingPool;
        const fallbackSession = pool.find((session) => !usedSessionIds.has(session.spreadingSessionId) && session.materialSkuSummary?.includes(record.materialSku))
            || pool.find((session) => !usedSessionIds.has(session.spreadingSessionId))
            || null;
        if (!fallbackSession)
            return;
        sessionBySuggestionId.set(record.id, fallbackSession);
        usedSessionIds.add(fallbackSession.spreadingSessionId);
    });
    return sessionBySuggestionId;
}
export function buildSeedReplenishmentPendingPrepFollowups(records = cloneReplenishmentSuggestionRecords()) {
    const cutOrderSourceRecords = listGeneratedCutOrderSourceRecords();
    const { store } = readMarkerSpreadingPrototypeData();
    const sessionBySuggestionId = buildReplenishmentSourceSessionMap(records, store.sessions);
    return records
        .filter((record) => record.reviewStatus === 'APPROVED')
        .map((record, index) => {
        const sourceCutOrder = resolveReplenishmentSourceCutOrder(record, cutOrderSourceRecords);
        const sourceSession = sessionBySuggestionId.get(record.id)
            || pickReplenishmentSourceSession(record, sourceCutOrder?.cutOrderId || '', store.sessions);
        const sourceColor = sourceCutOrder?.colorScope[0] || sourceSession?.colorSummary?.split(' / ')[0] || '';
        return {
            followupId: `pending-prep-${record.id}`,
            suggestionId: record.id,
            sourceReplenishmentRequestId: record.id,
            sourceSpreadingSessionId: sourceSession?.spreadingSessionId || '',
            sourceMarkerId: sourceSession?.sourceMarkerId || sourceSession?.markerId || '',
            sourceMarkerNo: sourceSession?.sourceMarkerNo || sourceSession?.markerNo || '',
            cutOrderId: sourceCutOrder?.cutOrderId
                || sourceSession?.cutOrderIds?.[0]
                || `cut-order-${index + 1}`,
            cutOrderNo: sourceCutOrder?.cutOrderNo
                || sourceSession?.cutOrderNos?.[0]
                || record.cutPieceOrderNo,
            materialSku: record.materialSku,
            color: sourceColor,
            shortageGarmentQty: Math.max(record.gapQty, 0),
            status: 'PENDING_PREP',
            createdAt: record.reviewedAt || record.suggestionCreatedAt,
            createdBy: record.reviewerName || '补料审核',
            note: '补料审批通过后生成待加工仓记录。',
        };
    })
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN'));
}
export function buildReplenishmentFlowTraceMatrix(records = cloneReplenishmentSuggestionRecords(), pendingPrepFollowups = buildSeedReplenishmentPendingPrepFollowups(records)) {
    const cutOrderSourceRecords = listGeneratedCutOrderSourceRecords();
    const pendingPrepBySuggestionId = new Map(pendingPrepFollowups.map((record) => [record.suggestionId, record]));
    const { store } = readMarkerSpreadingPrototypeData();
    const sessionBySuggestionId = buildReplenishmentSourceSessionMap(records, store.sessions);
    return records
        .map((record) => {
        const sourceCutOrder = resolveReplenishmentSourceCutOrder(record, cutOrderSourceRecords);
        const sourceSession = sessionBySuggestionId.get(record.id)
            || pickReplenishmentSourceSession(record, sourceCutOrder?.cutOrderId || '', store.sessions);
        const pendingPrep = pendingPrepBySuggestionId.get(record.id) || null;
        const sourceColor = sourceCutOrder?.colorScope[0]
            || pendingPrep?.color
            || sourceSession?.colorSummary?.split(' / ')[0]
            || '';
        return {
            suggestionId: record.id,
            replenishmentRequestId: record.id,
            replenishmentNo: record.replenishmentNo,
            reviewStatus: record.reviewStatus,
            cutOrderId: sourceCutOrder?.cutOrderId
                || pendingPrep?.cutOrderId
                || sourceSession?.cutOrderIds?.[0]
                || '',
            cutOrderNo: sourceCutOrder?.cutOrderNo
                || pendingPrep?.cutOrderNo
                || sourceSession?.cutOrderNos?.[0]
                || record.cutPieceOrderNo,
            materialSku: record.materialSku,
            color: sourceColor,
            shortageGarmentQty: Math.max(record.gapQty, 0),
            sourceSpreadingSessionId: sourceSession?.spreadingSessionId || pendingPrep?.sourceSpreadingSessionId || '',
            sourceSpreadingSessionNo: sourceSession?.sessionNo || sourceSession?.spreadingSessionId || '',
            sourceMarkerId: sourceSession?.sourceMarkerId || sourceSession?.markerId || pendingPrep?.sourceMarkerId || '',
            sourceMarkerNo: sourceSession?.sourceMarkerNo || sourceSession?.markerNo || pendingPrep?.sourceMarkerNo || '',
            markerPlanId: sourceSession?.markerPlanId || sourceCutOrder?.markerPlanId || '',
            markerPlanNo: sourceSession?.markerPlanNo || sourceCutOrder?.markerPlanNo || '',
            sourceWritebackId: sourceSession?.sourceWritebackId || '',
            pendingPrepFollowupId: pendingPrep?.followupId || '',
        };
    })
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.materialSku.localeCompare(right.materialSku, 'zh-CN')
        || left.color.localeCompare(right.color, 'zh-CN')
        || left.replenishmentNo.localeCompare(right.replenishmentNo, 'zh-CN'));
}
