import { buildTransferBagNavigationPayload, deriveTransferBagMasterStatus, } from './transfer-bags-model.ts';
import { buildCuttingTraceabilityId, } from '../../../data/fcs/cutting/qr-codes.ts';
const discrepancyMetaMap = {
    NONE: null,
    QTY_MISMATCH: {
        label: '数量异常',
        className: 'bg-amber-100 text-amber-700 border border-amber-200',
        detailText: '回货数量与发出清单不一致，需要留痕说明。',
    },
    DAMAGED_BAG: {
        label: '口袋损坏',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        detailText: '回仓时发现口袋损坏，需要结合袋况决定是否维修。',
    },
    LATE_RETURN: {
        label: '迟归还',
        className: 'bg-orange-100 text-orange-700 border border-orange-200',
        detailText: '回货时间晚于当前排定周期，需要保留说明。',
    },
    MISSING_RECORD: {
        label: '缺记录',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        detailText: '当前回货资料不完整，需要补录后再闭环。',
    },
};
function sortByLatest(items, key) {
    return items.slice().sort((left, right) => String(right[key] || '').localeCompare(String(left[key] || ''), 'zh-CN'));
}
function buildEmptyCollectionMap(items) {
    return items.reduce((result, item) => {
        if (!result[item.cycleId])
            result[item.cycleId] = [];
        result[item.cycleId].push(item);
        return result;
    }, {});
}
export function deriveReturnEligibility(options) {
    if (!options.usage)
        return { ok: false, reason: '当前没有可回货的使用周期。' };
    if (!options.bag)
        return { ok: false, reason: '当前使用周期缺少对应口袋主档。' };
    if (options.latestClosureResult)
        return { ok: false, reason: '当前使用周期已关闭，不能重复进入回货流程。' };
    if (!['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN', 'RETURN_INSPECTING'].includes(options.usage.usageStatus)) {
        return { ok: false, reason: '当前使用周期尚未进入可回货状态。' };
    }
    return { ok: true, reason: '' };
}
export function createReturnReceiptDraft(options) {
    return {
        returnReceiptId: `return-draft-${options.usage.cycleId}`,
        cycleId: options.usage.cycleId,
        cycleNo: options.usage.cycleNo,
        carrierId: options.usage.carrierId,
        carrierCode: options.usage.carrierCode,
        usageId: options.usage.cycleId,
        usageNo: options.usage.cycleNo,
        bagId: options.usage.carrierId,
        bagCode: options.usage.carrierCode,
        sewingTaskId: options.usage.sewingTaskId,
        sewingTaskNo: options.usage.sewingTaskNo,
        returnWarehouseName: '裁片仓返仓口',
        returnAt: options.nowText,
        returnedBy: '',
        receivedBy: '',
        returnedFinishedQty: options.bindingsCount,
        returnedTicketCountSummary: options.bindingsCount,
        returnedCutOrderCount: options.cutOrderCount,
        discrepancyType: 'NONE',
        discrepancyNote: '',
        note: '回货验收草稿已创建，等待补充返仓信息。',
    };
}
export function validateReturnReceiptPayload(options) {
    const eligibility = deriveReturnEligibility({ usage: options.usage, bag: options.bag });
    if (!eligibility.ok)
        return eligibility;
    if (!options.receipt.returnWarehouseName.trim())
        return { ok: false, reason: '请填写回货入仓点。' };
    if (!options.receipt.returnAt.trim())
        return { ok: false, reason: '请填写回货时间。' };
    if (!options.receipt.receivedBy.trim())
        return { ok: false, reason: '请填写接收人。' };
    return { ok: true, reason: '' };
}
export function deriveBagConditionDecision(options) {
    if (options.reusableDecision === 'DISABLED' || options.conditionStatus === 'SEVERE_DAMAGE' || options.damageType?.includes('报废')) {
        return {
            reusableDecision: 'DISABLED',
            nextBagStatus: 'DISABLED',
            label: '停用 / 报废',
            className: 'bg-slate-200 text-slate-700 border border-slate-300',
            detailText: '袋况严重损坏，当前轮次关闭后不再进入复用链路。',
        };
    }
    return {
        reusableDecision: 'REUSABLE',
        nextBagStatus: 'REUSABLE',
        label: '可复用',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        detailText: '回货验收已完成，当前口袋可以进入下一轮使用周期。',
    };
}
export function closeTransferBagUsageCycle(options) {
    const decision = deriveBagConditionDecision({
        conditionStatus: options.condition.conditionStatus,
        cleanlinessStatus: options.condition.cleanlinessStatus,
        damageType: options.condition.damageType,
        repairNeeded: options.condition.repairNeeded,
        reusableDecision: options.condition.reusableDecision,
    });
    const warningMessages = [];
    if (options.receipt.discrepancyType !== 'NONE') {
        warningMessages.push('本次回货存在差异，已按异常闭环记录。');
    }
    if (decision.nextBagStatus !== 'REUSABLE') {
        warningMessages.push(`当前 bag 关闭后进入“${decision.label}”状态。`);
    }
    return {
        closureId: buildCuttingTraceabilityId('closure', options.nowText, options.usage.cycleId),
        cycleId: options.usage.cycleId,
        cycleNo: options.usage.cycleNo,
        usageId: options.usage.cycleId,
        usageNo: options.usage.cycleNo,
        closedAt: options.nowText,
        closedBy: options.closedBy,
        closureStatus: warningMessages.length ? 'EXCEPTION_CLOSED' : 'CLOSED',
        nextBagStatus: decision.nextBagStatus,
        reason: warningMessages.length ? '当前使用周期在存在差异或袋况异常的前提下完成关闭。' : '当前使用周期已完成回货验收并正式关闭。',
        warningMessages,
    };
}
export function buildReuseCycleSummary(options) {
    const relatedUsages = sortByLatest(options.usages.filter((item) => item.carrierId === options.bag.carrierId), 'cycleNo');
    const relatedReceipts = sortByLatest(options.returnReceipts.filter((item) => item.carrierId === options.bag.carrierId), 'returnAt');
    const relatedClosures = sortByLatest(options.closureResults.filter((item) => relatedUsages.some((usage) => usage.cycleId === item.cycleId)), 'closedAt');
    const latestUsage = relatedUsages[0];
    const latestClosure = relatedClosures[0];
    const openUsage = relatedUsages.find((item) => !['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus));
    const latestCycleId = latestUsage?.cycleId ? latestUsage.cycleId : options.bag.latestCycleId;
    const latestCycleNo = latestUsage?.cycleNo ? latestUsage.cycleNo : options.bag.latestCycleNo;
    const currentOpenCycleId = openUsage?.cycleId ? openUsage.cycleId : '';
    return {
        cycleSummaryId: `cycle-${options.bag.carrierId}`,
        carrierId: options.bag.carrierId,
        carrierCode: options.bag.carrierCode,
        latestCycleId,
        latestCycleNo,
        bagId: options.bag.carrierId,
        bagCode: options.bag.carrierCode,
        latestUsageId: latestCycleId,
        latestUsageNo: latestCycleNo,
        totalUsageCount: relatedUsages.length,
        totalDispatchCount: relatedUsages.filter((item) => Boolean(item.dispatchAt)).length,
        totalReturnCount: relatedReceipts.length,
        lastDispatchedAt: latestUsage?.dispatchAt || '',
        lastReturnedAt: relatedReceipts[0]?.returnAt || '',
        currentReusableStatus: latestClosure?.nextBagStatus || options.bag.currentStatus,
        currentLocation: options.bag.currentLocation,
        currentOpenCycleId,
        currentOpenUsageId: currentOpenCycleId,
        note: latestClosure ? latestClosure.reason : '当前 bag 尚未形成完整回货闭环。',
    };
}
export function buildReturnExceptionMeta(discrepancyType) {
    return discrepancyMetaMap[discrepancyType] ?? null;
}
export function buildReturnNavigationPayload(options) {
    return buildTransferBagNavigationPayload({
        cutOrderNo: options.cutOrderNo,
        productionOrderNo: options.productionOrderNo,
        markerPlanNo: options.markerPlanNo,
        bagCode: options.bagCode,
        usageNo: options.usageNo,
        sewingTaskNo: options.sewingTaskNo,
    });
}
export function buildBagReturnAuditTrail(options) {
    return {
        auditTrailId: buildCuttingTraceabilityId('return-audit', options.actionAt, options.cycleId, options.action),
        cycleId: options.cycleId,
        usageId: options.cycleId,
        action: options.action,
        actionAt: options.actionAt,
        actionBy: options.actionBy,
        payloadSummary: options.payloadSummary || `${options.cycleNo || options.cycleId} ${options.action}`,
        note: options.note,
    };
}
export function buildTransferBagReturnViewModel(options) {
    const returnReceiptsByUsageId = buildEmptyCollectionMap(options.store.returnReceipts);
    const conditionRecordsByUsageId = buildEmptyCollectionMap(options.store.conditionRecords);
    const closureResultsByUsageId = buildEmptyCollectionMap(options.store.closureResults);
    const returnAuditTrailByUsageId = buildEmptyCollectionMap(options.store.returnAuditTrail);
    const waitingReturnUsages = options.baseViewModel.usages
        .map((usage) => {
        const latestReturnReceipt = sortByLatest(returnReceiptsByUsageId[usage.cycleId] || [], 'returnAt')[0] || null;
        const latestConditionRecord = sortByLatest(conditionRecordsByUsageId[usage.cycleId] || [], 'inspectedAt')[0] || null;
        const latestClosureResult = sortByLatest(closureResultsByUsageId[usage.cycleId] || [], 'closedAt')[0] || null;
        return {
            ...usage,
            bagStatusMeta: usage.bagMaster ? deriveTransferBagMasterStatus(usage.bagMaster.currentStatus) : null,
            latestReturnReceipt,
            latestConditionRecord,
            latestClosureResult,
            returnEligibility: deriveReturnEligibility({
                usage,
                bag: usage.bagMaster,
                latestClosureResult,
            }),
            returnExceptionMeta: buildReturnExceptionMeta(latestReturnReceipt?.discrepancyType || 'NONE'),
        };
    })
        .sort((left, right) => right.cycleNo.localeCompare(left.cycleNo, 'zh-CN'));
    const reuseCycles = options.store.masters
        .map((bag) => {
        const cycle = buildReuseCycleSummary({
            bag,
            usages: options.store.usages,
            returnReceipts: options.store.returnReceipts,
            closureResults: options.store.closureResults,
        });
        const latestUsage = options.store.usages.find((item) => item.cycleId === cycle.latestCycleId) || null;
        const latestReturnReceipt = sortByLatest(options.store.returnReceipts.filter((item) => item.carrierId === bag.carrierId), 'returnAt')[0] || null;
        const latestConditionRecord = sortByLatest(options.store.conditionRecords.filter((item) => item.carrierId === bag.carrierId), 'inspectedAt')[0] || null;
        return {
            ...cycle,
            latestUsage,
            latestReturnReceipt,
            latestConditionRecord,
            bagStatusMeta: deriveTransferBagMasterStatus(cycle.currentReusableStatus),
        };
    })
        .sort((left, right) => left.carrierCode.localeCompare(right.carrierCode, 'zh-CN'));
    const conditionItems = sortByLatest(options.store.conditionRecords, 'inspectedAt')
        .map((record) => ({
        ...record,
        latestUsage: options.store.usages.find((item) => item.cycleId === record.cycleId) || null,
        bagMaster: options.store.masters.find((item) => item.carrierId === record.carrierId) || null,
        decisionMeta: deriveBagConditionDecision({
            conditionStatus: record.conditionStatus,
            cleanlinessStatus: record.cleanlinessStatus,
            damageType: record.damageType,
            repairNeeded: record.repairNeeded,
            reusableDecision: record.reusableDecision,
        }),
        returnExceptionMeta: buildReturnExceptionMeta(sortByLatest(returnReceiptsByUsageId[record.cycleId] || [], 'returnAt')[0]?.discrepancyType || 'NONE'),
    }));
    return {
        summary: {
            waitingReturnUsageCount: waitingReturnUsages.filter((item) => ['DISPATCHED', 'PENDING_SIGNOFF', 'WAITING_RETURN'].includes(item.usageStatus)).length,
            inspectingUsageCount: waitingReturnUsages.filter((item) => item.usageStatus === 'RETURN_INSPECTING').length,
            closedUsageCount: waitingReturnUsages.filter((item) => ['CLOSED', 'EXCEPTION_CLOSED'].includes(item.usageStatus)).length,
            reusableBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'REUSABLE').length,
            waitingCleaningBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'WAITING_CLEANING').length,
            waitingRepairBagCount: reuseCycles.filter((item) => item.currentReusableStatus === 'WAITING_REPAIR').length,
        },
        waitingReturnUsages,
        returnReceiptsByUsageId,
        conditionRecordsByUsageId,
        closureResultsByUsageId,
        returnAuditTrailByUsageId,
        reuseCycles,
        conditionItems,
    };
}
