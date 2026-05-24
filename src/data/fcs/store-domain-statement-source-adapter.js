import { getFactoryByCode, getFactoryById } from './indonesia-factories.ts';
import { buildDeductionEntryHrefByBasisId } from './quality-chain-adapter.ts';
import { getPreSettlementLedgerById, listPreSettlementLedgers, listStatementEligiblePreSettlementLedgers, tracePreSettlementLedgerSource, } from './pre-settlement-ledger-repository.ts';
import { processTasks } from './process-tasks.ts';
import { productionOrders } from './production-orders.ts';
import { initialStatementDrafts } from './store-domain-settlement-seeds.ts';
const SOURCE_LABEL_ZH = {
    TASK_EARNING: '任务收入流水',
    QUALITY_DEDUCTION: '质量扣款流水',
};
const LEDGER_STATUS_ZH = {
    OPEN: '待入对账单',
    IN_STATEMENT: '已入对账单',
    IN_PREPAYMENT_BATCH: '已入预付款批次',
    PREPAID: '已预付',
    RESERVED_FOR_FINAL_SETTLEMENT: '保留到后续分账',
};
const PARTY_TYPE_ZH = {
    FACTORY: '工厂',
    PROCESSOR: '加工方',
    SUPPLIER: '供应商',
    GROUP_INTERNAL: '内部主体',
    INTERNAL: '内部主体',
    OTHER: '其他',
};
function buildPartyLabel(type, id) {
    if (!type || !id)
        return '-';
    if (type === 'FACTORY') {
        const factory = getFactoryById(id) ?? getFactoryByCode(id);
        if (factory)
            return factory.name;
    }
    return `${PARTY_TYPE_ZH[type] ?? type} / ${id}`;
}
function maskBankAccountNo(accountNo) {
    const raw = accountNo.replace(/\s+/g, '');
    if (raw.length <= 8)
        return raw;
    return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`;
}
function getTaskSnapshot(taskId) {
    if (!taskId)
        return null;
    return processTasks.find((item) => item.taskId === taskId) ?? null;
}
function getProductionOrderSnapshot(productionOrderId) {
    if (!productionOrderId)
        return null;
    return productionOrders.find((item) => item.productionOrderId === productionOrderId) ?? null;
}
function normalizeSettlementPartyId(partyId) {
    const factory = getFactoryById(partyId) ?? getFactoryByCode(partyId);
    return factory?.id ?? partyId;
}
function isSameSettlementParty(left, right) {
    return normalizeSettlementPartyId(left) === normalizeSettlementPartyId(right);
}
function normalizeLedgerPriceSource(priceSourceType) {
    if (priceSourceType === 'BID')
        return 'BIDDING';
    if (priceSourceType === 'DISPATCH')
        return 'DISPATCH';
    return 'OTHER_COMPAT';
}
function buildTaskLedgerHref(ledger) {
    if (ledger.taskId)
        return `/fcs/pda/task-receive/${encodeURIComponent(ledger.taskId)}`;
    if (ledger.returnInboundBatchId)
        return `/fcs/pda/task-receive/${encodeURIComponent(ledger.returnInboundBatchId)}`;
    return '/fcs/settlement/adjustments';
}
function buildQualityLedgerHref(ledger) {
    const trace = tracePreSettlementLedgerSource(ledger.ledgerId);
    if (trace?.pendingDeductionRecord?.basisId) {
        return buildDeductionEntryHrefByBasisId(trace.pendingDeductionRecord.basisId);
    }
    if (ledger.qcRecordId) {
        return `/fcs/quality/qc-records/${encodeURIComponent(ledger.qcRecordId)}`;
    }
    return '/fcs/quality/qc-records';
}
function getStatementBindingMap() {
    const map = new Map();
    for (const statement of initialStatementDrafts) {
        if (statement.status === 'CLOSED')
            continue;
        for (const item of statement.items) {
            const bindingKey = item.sourceItemId ?? item.basisId;
            if (bindingKey) {
                map.set(bindingKey, statement.statementId);
            }
        }
        for (const sourceId of statement.itemSourceIds ?? []) {
            if (!map.has(sourceId))
                map.set(sourceId, statement.statementId);
        }
    }
    return map;
}
function sortSourceItems(items) {
    return [...items].sort((left, right) => {
        const leftCycle = left.settlementCycleEndAt ?? '';
        const rightCycle = right.settlementCycleEndAt ?? '';
        if (leftCycle !== rightCycle)
            return leftCycle < rightCycle ? 1 : -1;
        const leftTime = left.occurredAt ?? left.createdAt ?? '';
        const rightTime = right.occurredAt ?? right.createdAt ?? '';
        return leftTime < rightTime ? 1 : leftTime > rightTime ? -1 : 0;
    });
}
function mapLedgerToStatementSourceItem(ledger, bindingMap) {
    const trace = tracePreSettlementLedgerSource(ledger.ledgerId);
    const alreadyBoundStatementId = ledger.statementId ?? bindingMap.get(ledger.ledgerId);
    const canEnterStatement = ledger.status === 'OPEN' && !alreadyBoundStatementId;
    if (ledger.ledgerType === 'TASK_EARNING') {
        return {
            sourceItemId: ledger.ledgerId,
            ledgerNo: ledger.ledgerNo,
            sourceType: 'TASK_EARNING',
            sourceLabelZh: SOURCE_LABEL_ZH.TASK_EARNING,
            direction: 'INCOME',
            settlementPartyType: 'FACTORY',
            settlementPartyId: ledger.factoryId,
            settlementPartyLabel: buildPartyLabel('FACTORY', ledger.factoryId),
            productionOrderId: ledger.productionOrderId,
            productionOrderNo: ledger.productionOrderNo,
            taskId: ledger.taskId,
            taskNo: ledger.taskNo,
            qty: ledger.qty,
            amount: ledger.settlementAmount,
            currency: ledger.settlementCurrency,
            sourceStatus: ledger.status,
            sourceStatusZh: LEDGER_STATUS_ZH[ledger.status],
            occurredAt: ledger.occurredAt,
            createdAt: ledger.occurredAt,
            updatedAt: ledger.occurredAt,
            routeToSource: buildTaskLedgerHref(ledger),
            canEnterStatement,
            alreadyBoundStatementId,
            sourceReason: ledger.sourceReason ?? '按派单价或竞价中标价与回货数量生成正式任务收入流水',
            remark: ledger.remark,
            settlementCycleId: ledger.settlementCycleId,
            settlementCycleLabel: ledger.settlementCycleLabel,
            settlementCycleStartAt: ledger.settlementCycleStartAt,
            settlementCycleEndAt: ledger.settlementCycleEndAt,
            statementLineGrainType: 'RETURN_INBOUND_BATCH',
            returnInboundBatchId: ledger.returnInboundBatchId,
            returnInboundBatchNo: ledger.returnInboundBatchNo,
            returnInboundQty: ledger.qty,
            qcRecordId: undefined,
            pendingDeductionRecordId: undefined,
            disputeId: undefined,
            processLabel: trace?.qcRecord?.processLabel,
            pricingSourceType: normalizeLedgerPriceSource(ledger.priceSourceType),
            pricingSourceRefId: ledger.sourceRefId,
            settlementUnitPrice: ledger.unitPrice,
            earningAmount: ledger.settlementAmount,
            qualityDeductionAmount: 0,
            carryOverAdjustmentAmount: 0,
            otherAdjustmentAmount: 0,
            netAmount: ledger.settlementAmount,
        };
    }
    return {
        sourceItemId: ledger.ledgerId,
        ledgerNo: ledger.ledgerNo,
        sourceType: 'QUALITY_DEDUCTION',
        sourceLabelZh: SOURCE_LABEL_ZH.QUALITY_DEDUCTION,
        direction: 'DEDUCTION',
        settlementPartyType: 'FACTORY',
        settlementPartyId: ledger.factoryId,
        settlementPartyLabel: buildPartyLabel('FACTORY', ledger.factoryId),
        productionOrderId: ledger.productionOrderId,
        productionOrderNo: ledger.productionOrderNo,
        taskId: ledger.taskId,
        taskNo: ledger.taskNo,
        qty: ledger.qty,
        amount: ledger.settlementAmount,
        currency: ledger.settlementCurrency,
        sourceStatus: ledger.status,
        sourceStatusZh: LEDGER_STATUS_ZH[ledger.status],
        occurredAt: ledger.occurredAt,
        createdAt: ledger.occurredAt,
        updatedAt: ledger.occurredAt,
        routeToSource: buildQualityLedgerHref(ledger),
        canEnterStatement,
        alreadyBoundStatementId,
        sourceReason: ledger.sourceReason ?? '正式质量扣款流水',
        remark: ledger.remark,
        settlementCycleId: ledger.settlementCycleId,
        settlementCycleLabel: ledger.settlementCycleLabel,
        settlementCycleStartAt: ledger.settlementCycleStartAt,
        settlementCycleEndAt: ledger.settlementCycleEndAt,
        statementLineGrainType: ledger.returnInboundBatchId ? 'RETURN_INBOUND_BATCH' : 'NON_BATCH_QUALITY',
        returnInboundBatchId: ledger.returnInboundBatchId,
        returnInboundBatchNo: ledger.returnInboundBatchNo,
        returnInboundQty: ledger.qty,
        qcRecordId: ledger.qcRecordId,
        pendingDeductionRecordId: ledger.pendingDeductionRecordId,
        disputeId: ledger.disputeId,
        processLabel: trace?.qcRecord?.processLabel,
        pricingSourceType: trace?.task ? 'OTHER_COMPAT' : 'NONE',
        pricingSourceRefId: ledger.sourceRefId,
        settlementUnitPrice: undefined,
        earningAmount: 0,
        qualityDeductionAmount: ledger.settlementAmount,
        carryOverAdjustmentAmount: 0,
        otherAdjustmentAmount: 0,
        netAmount: -ledger.settlementAmount,
    };
}
function summarizeStatementLines(items) {
    return {
        totalQty: items.reduce((sum, item) => sum + (item.returnInboundQty ?? item.deductionQty ?? 0), 0),
        totalEarningAmount: items.reduce((sum, item) => sum + (item.earningAmount ?? 0), 0),
        totalDeductionAmount: items.reduce((sum, item) => sum + (item.qualityDeductionAmount ?? 0), 0),
        netPayableAmount: items.reduce((sum, item) => sum + (item.netAmount ?? item.deductionAmount ?? 0), 0),
    };
}
function getStatementSourceTypeSummary(items) {
    const summaryMap = new Map();
    for (const item of items) {
        const label = item.sourceLabelZh ?? SOURCE_LABEL_ZH[item.sourceItemType] ?? item.sourceItemType;
        summaryMap.set(label, (summaryMap.get(label) ?? 0) + 1);
    }
    return Array.from(summaryMap.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([label, count]) => `${label} ${count}条`)
        .join(' / ');
}
function getStatementLineTypeZh(item) {
    if (item.statementLineGrainType === 'RETURN_INBOUND_BATCH')
        return '回货批次行';
    if (item.statementLineGrainType === 'NON_BATCH_QUALITY')
        return '质量扣款流水行';
    if (item.statementLineGrainType === 'NON_BATCH_ADJUSTMENT')
        return '兼容来源行';
    return '其它来源行';
}
function buildStatementDetailLine(item) {
    const task = getTaskSnapshot(item.taskId);
    const order = getProductionOrderSnapshot(item.productionOrderId);
    const sourceTypeZh = item.sourceLabelZh ?? SOURCE_LABEL_ZH[item.sourceItemType] ?? item.sourceItemType;
    return {
        ...item,
        lineTypeZh: getStatementLineTypeZh(item),
        sourceTypeZh,
        productionOrderNoDisplay: item.productionOrderNo ?? order?.legacyOrderNo ?? item.productionOrderId ?? '-',
        taskNoDisplay: item.taskNo ?? task?.taskNo ?? item.taskId ?? '-',
        routeToSourceResolved: item.routeToSource ?? '/fcs/settlement/statements',
    };
}
export function listStatementSourceItems() {
    const bindingMap = getStatementBindingMap();
    return sortSourceItems(listPreSettlementLedgers().map((ledger) => mapLedgerToStatementSourceItem(ledger, bindingMap)));
}
export function listStatementBuildScopes() {
    const scopeMap = new Map();
    for (const item of listStatementEligiblePreSettlementLedgers().map((ledger) => mapLedgerToStatementSourceItem(ledger, new Map()))) {
        const key = `${normalizeSettlementPartyId(item.settlementPartyId)}__${item.settlementCycleId}`;
        const existed = scopeMap.get(key);
        if (existed) {
            existed.candidateCount += 1;
            if (item.sourceType === 'TASK_EARNING')
                existed.earningLedgerCount += 1;
            if (item.sourceType === 'QUALITY_DEDUCTION')
                existed.deductionLedgerCount += 1;
            existed.totalQty += item.qty;
            existed.totalEarningAmount += item.earningAmount;
            existed.totalDeductionAmount += item.qualityDeductionAmount;
            existed.netPayableAmount += item.netAmount;
            continue;
        }
        scopeMap.set(key, {
            settlementPartyType: String(item.settlementPartyType),
            settlementPartyId: item.settlementPartyId,
            settlementPartyLabel: item.settlementPartyLabel,
            settlementCycleId: item.settlementCycleId,
            settlementCycleLabel: item.settlementCycleLabel,
            settlementCycleStartAt: item.settlementCycleStartAt,
            settlementCycleEndAt: item.settlementCycleEndAt,
            candidateCount: 1,
            earningLedgerCount: item.sourceType === 'TASK_EARNING' ? 1 : 0,
            deductionLedgerCount: item.sourceType === 'QUALITY_DEDUCTION' ? 1 : 0,
            totalQty: item.qty,
            totalEarningAmount: item.earningAmount,
            totalDeductionAmount: item.qualityDeductionAmount,
            netPayableAmount: item.netAmount,
        });
    }
    return [...scopeMap.values()].sort((left, right) => {
        if (left.settlementCycleEndAt !== right.settlementCycleEndAt) {
            return left.settlementCycleEndAt < right.settlementCycleEndAt ? 1 : -1;
        }
        return left.settlementPartyLabel.localeCompare(right.settlementPartyLabel, 'zh-CN');
    });
}
export function listStatementBuildCandidates(settlementPartyId, settlementCycleId) {
    return listStatementSourceItems().filter((item) => item.canEnterStatement &&
        item.settlementPartyType === 'FACTORY' &&
        isSameSettlementParty(item.settlementPartyId, settlementPartyId) &&
        item.settlementCycleId === settlementCycleId);
}
export function listStatementEligibleLedgers(settlementPartyId, settlementCycleId) {
    return listStatementBuildCandidates(settlementPartyId, settlementCycleId);
}
export function toStatementDraftItemFromSource(item) {
    return {
        ledgerNo: item.ledgerNo,
        sourceItemId: item.sourceItemId,
        sourceItemType: item.sourceType,
        direction: item.direction,
        sourceLabelZh: item.sourceLabelZh,
        sourceRefLabel: item.sourceItemId,
        routeToSource: item.routeToSource,
        settlementPartyType: item.settlementPartyType,
        settlementPartyId: item.settlementPartyId,
        basisId: item.sourceItemId,
        deductionQty: item.qty,
        deductionAmount: item.netAmount,
        currency: item.currency,
        remark: item.remark,
        sourceType: item.sourceType,
        productionOrderId: item.productionOrderId,
        productionOrderNo: item.productionOrderNo,
        taskId: item.taskId,
        taskNo: item.taskNo,
        settlementCycleId: item.settlementCycleId,
        settlementCycleLabel: item.settlementCycleLabel,
        settlementCycleStartAt: item.settlementCycleStartAt,
        settlementCycleEndAt: item.settlementCycleEndAt,
        statementLineGrainType: item.statementLineGrainType,
        returnInboundBatchId: item.returnInboundBatchId,
        returnInboundBatchNo: item.returnInboundBatchNo,
        returnInboundQty: item.returnInboundQty,
        qcRecordId: item.qcRecordId,
        pendingDeductionRecordId: item.pendingDeductionRecordId,
        disputeId: item.disputeId,
        processLabel: item.processLabel,
        pricingSourceType: item.pricingSourceType === 'OTHER_COMPAT'
            ? 'NONE'
            : item.pricingSourceType,
        pricingSourceRefId: item.pricingSourceRefId,
        settlementUnitPrice: item.settlementUnitPrice,
        earningAmount: item.earningAmount,
        qualityDeductionAmount: item.qualityDeductionAmount,
        carryOverAdjustmentAmount: item.carryOverAdjustmentAmount,
        otherAdjustmentAmount: item.otherAdjustmentAmount,
        netAmount: item.netAmount,
        occurredAt: item.occurredAt ?? item.createdAt,
    };
}
export function buildStatementDraftLines(settlementPartyId, settlementCycleId) {
    return listStatementBuildCandidates(settlementPartyId, settlementCycleId)
        .map((item) => toStatementDraftItemFromSource(item))
        .sort((left, right) => {
        const leftIsBatch = left.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1;
        const rightIsBatch = right.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? 0 : 1;
        if (leftIsBatch !== rightIsBatch)
            return leftIsBatch - rightIsBatch;
        return (left.returnInboundBatchNo ?? left.sourceRefLabel ?? '').localeCompare(right.returnInboundBatchNo ?? right.sourceRefLabel ?? '', 'zh-CN');
    });
}
export function getStatementListItems() {
    return [...initialStatementDrafts]
        .filter((draft) => draft.settlementPartyType === 'FACTORY')
        .sort((left, right) => {
        const leftCycle = left.settlementCycleEndAt ?? '';
        const rightCycle = right.settlementCycleEndAt ?? '';
        if (leftCycle !== rightCycle)
            return leftCycle < rightCycle ? 1 : -1;
        return left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0;
    })
        .map((draft) => {
        const totals = summarizeStatementLines(draft.items);
        return {
            statementId: draft.statementId,
            statementNo: draft.statementNo ?? draft.statementId,
            settlementPartyType: draft.settlementPartyType,
            settlementPartyId: draft.settlementPartyId,
            settlementPartyLabel: draft.factoryName ?? buildPartyLabel(draft.settlementPartyType, draft.settlementPartyId),
            settlementCycleId: draft.settlementCycleId,
            settlementCycleLabel: draft.settlementCycleLabel,
            settlementCycleEndAt: draft.settlementCycleEndAt,
            currency: draft.settlementCurrency ?? draft.settlementProfileSnapshot.settlementConfigSnapshot.currency,
            status: draft.status,
            factoryFeedbackStatus: draft.factoryFeedbackStatus,
            itemCount: draft.itemCount,
            totalQty: draft.totalQty,
            totalEarningAmount: draft.totalEarningAmount ?? totals.totalEarningAmount,
            totalDeductionAmount: draft.totalDeductionAmount ?? totals.totalDeductionAmount,
            netPayableAmount: draft.netPayableAmount ?? totals.netPayableAmount,
            createdAt: draft.createdAt,
            settlementProfileVersionNo: draft.settlementProfileVersionNo,
            maskedAccountTail: maskBankAccountNo(draft.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo),
            hasFactoryAppeal: Boolean(draft.factoryAppealRecord || draft.appealRecords?.length),
            prepaymentBatchId: draft.prepaymentBatchId,
            prepaymentBatchNo: draft.prepaymentBatchNo,
            prepaymentBatchStatus: draft.prepaymentBatchStatus,
            readyForPrepaymentAt: draft.readyForPrepaymentAt,
        };
    });
}
export function getStatementDetailViewModel(statementId) {
    const draft = initialStatementDrafts.find((item) => item.statementId === statementId);
    if (!draft)
        return null;
    const lines = draft.items
        .map((item) => buildStatementDetailLine(item))
        .sort((left, right) => {
        const leftBatch = left.returnInboundBatchNo ?? '';
        const rightBatch = right.returnInboundBatchNo ?? '';
        if (left.statementLineGrainType !== right.statementLineGrainType) {
            return left.statementLineGrainType === 'RETURN_INBOUND_BATCH' ? -1 : 1;
        }
        if (leftBatch !== rightBatch)
            return leftBatch.localeCompare(rightBatch, 'zh-CN');
        return left.sourceItemId.localeCompare(right.sourceItemId, 'zh-CN');
    });
    const totals = summarizeStatementLines(lines);
    return {
        draft,
        settlementPartyLabel: draft.factoryName ?? buildPartyLabel(draft.settlementPartyType, draft.settlementPartyId),
        maskedAccountNo: maskBankAccountNo(draft.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo),
        totalEarningAmount: draft.totalEarningAmount ?? totals.totalEarningAmount,
        totalQualityDeductionAmount: draft.totalDeductionAmount ?? totals.totalDeductionAmount,
        netPayableAmount: draft.netPayableAmount ?? totals.netPayableAmount,
        totalQty: draft.totalQty ?? totals.totalQty,
        hasFactoryAppeal: Boolean(draft.factoryAppealRecord || draft.appealRecords?.length),
        sourceTypeSummary: getStatementSourceTypeSummary(draft.items),
        lines,
        earningLines: lines.filter((item) => item.sourceItemType === 'TASK_EARNING'),
        deductionLines: lines.filter((item) => item.sourceItemType === 'QUALITY_DEDUCTION'),
    };
}
export function getStatementSourceItemById(sourceItemId) {
    const direct = listStatementSourceItems().find((item) => item.sourceItemId === sourceItemId);
    if (direct)
        return direct;
    const ledger = getPreSettlementLedgerById(sourceItemId);
    if (!ledger)
        return undefined;
    return mapLedgerToStatementSourceItem(ledger, getStatementBindingMap());
}
