import { getPdaCuttingExecutionSourceRecord } from './pda-cutting-task-source.ts';
import { getPdaCuttingTaskScenarioByTaskId } from './pda-cutting-task-scenarios.ts';
export const CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY = 'cuttingPdaExecutionWritebackLedger';
function toArray(value) {
    return Array.isArray(value) ? value : [];
}
function toString(value) {
    return typeof value === 'string' ? value : '';
}
function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}
function uniqueById(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (!item.writebackId || seen.has(item.writebackId))
            return false;
        seen.add(item.writebackId);
        return true;
    });
}
function sortBySubmittedAtDesc(items) {
    return items.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'));
}
function normalizeBaseRecord(raw) {
    const executionOrderNo = toString(raw.executionOrderNo) || toString(raw.cutPieceOrderNo);
    const submittedAt = toString(raw.submittedAt);
    const actionAt = toString(raw.actionAt) || submittedAt;
    return {
        writebackId: toString(raw.writebackId),
        actionType: toString(raw.actionType),
        actionAt,
        taskId: toString(raw.taskId),
        taskNo: toString(raw.taskNo),
        executionOrderId: toString(raw.executionOrderId) || executionOrderNo,
        executionOrderNo,
        cutPieceOrderNo: toString(raw.cutPieceOrderNo) || executionOrderNo,
        productionOrderId: toString(raw.productionOrderId),
        productionOrderNo: toString(raw.productionOrderNo),
        cutOrderId: toString(raw.cutOrderId),
        cutOrderNo: toString(raw.cutOrderNo),
        markerPlanId: toString(raw.markerPlanId),
        markerPlanNo: toString(raw.markerPlanNo),
        materialSku: toString(raw.materialSku),
        operatorAccountId: toString(raw.operatorAccountId),
        operatorName: toString(raw.operatorName),
        operatorRole: toString(raw.operatorRole),
        operatorFactoryId: toString(raw.operatorFactoryId),
        operatorFactoryName: toString(raw.operatorFactoryName),
        submittedAt: submittedAt || actionAt,
        sourceDeviceId: toString(raw.sourceDeviceId) || 'PDA-CUTTING',
        sourceChannel: 'PDA',
        sourceWritebackId: toString(raw.sourceWritebackId),
        sourceRecordId: toString(raw.sourceRecordId),
    };
}
function normalizePickupRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    return {
        ...base,
        resultLabel: toString(record.resultLabel),
        actualReceivedQtyText: toString(record.actualReceivedQtyText),
        discrepancyNote: toString(record.discrepancyNote),
        photoProofCount: toNumber(record.photoProofCount),
        claimDisputeId: toString(record.claimDisputeId),
        claimDisputeNo: toString(record.claimDisputeNo),
    };
}
function normalizeInboundRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    return {
        ...base,
        zoneCode: (['A', 'B', 'C'].includes(toString(record.zoneCode)) ? toString(record.zoneCode) : 'A'),
        locationLabel: toString(record.locationLabel),
        note: toString(record.note),
    };
}
function normalizeHandoverRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    return {
        ...base,
        targetLabel: toString(record.targetLabel),
        note: toString(record.note),
    };
}
function normalizeReplenishmentFeedbackRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    return {
        ...base,
        reasonLabel: toString(record.reasonLabel),
        note: toString(record.note),
        photoProofCount: toNumber(record.photoProofCount),
        lifecycleStatus: (() => {
            const value = toString(record.lifecycleStatus);
            return value === 'PENDING' || value === 'CLOSED' || value === 'SUBMITTED' ? value : undefined;
        })(),
        lifecycleStatusLabel: toString(record.lifecycleStatusLabel),
    };
}
function createSeedBase(input) {
    const execution = getPdaCuttingExecutionSourceRecord(input.taskId, input.executionOrderNo);
    const scenario = getPdaCuttingTaskScenarioByTaskId(input.taskId);
    if (!execution || !scenario) {
        throw new Error(`裁片 PDA 写回种子缺少任务执行对象：${input.taskId} / ${input.executionOrderNo}`);
    }
    return {
        writebackId: input.writebackId,
        actionType: input.actionType,
        actionAt: input.submittedAt,
        taskId: scenario.taskId,
        taskNo: scenario.taskNo,
        executionOrderId: execution.executionOrderId,
        executionOrderNo: execution.executionOrderNo,
        cutPieceOrderNo: execution.executionOrderNo,
        productionOrderId: execution.productionOrderId,
        productionOrderNo: execution.productionOrderNo,
        cutOrderId: execution.cutOrderId,
        cutOrderNo: execution.cutOrderNo,
        markerPlanId: execution.markerPlanId,
        markerPlanNo: execution.markerPlanNo,
        materialSku: execution.materialSku,
        operatorAccountId: `seed-${input.operatorName.toLowerCase().replace(/\s+/g, '-')}`,
        operatorName: input.operatorName,
        operatorRole: '裁片移动端操作员',
        operatorFactoryId: scenario.assignedFactoryId,
        operatorFactoryName: scenario.assignedFactoryName,
        submittedAt: input.submittedAt,
        sourceDeviceId: 'PDA-CUTTING-SEED',
        sourceChannel: 'PDA',
        sourceWritebackId: input.writebackId,
        sourceRecordId: input.sourceRecordId,
    };
}
function createSeededPdaExecutionWritebackStore() {
    const pickupWritebacks = [
        '0302',
        '0303',
        '0304',
        '0305',
        '0306',
        '0307',
        '0310',
    ].map((suffix, index) => ({
        ...createSeedBase({
            writebackId: `PDA-PICKUP-SEED-${suffix}`,
            actionType: 'PICKUP_CONFIRM',
            submittedAt: `2026-03-18 08:${String(30 + index).padStart(2, '0')}:00`,
            taskId: `TASK-CUT-PDA-${suffix === '0302' ? 'PICKED-NOT-STARTED' : suffix === '0303' ? 'WAIT-SPREAD' : suffix === '0304' ? 'SPREADING' : suffix === '0305' ? 'WAIT-CUT' : suffix === '0306' ? 'CUTTING' : suffix === '0307' ? 'CUT-DONE' : 'SYNC-FAIL'}-${suffix}`,
            executionOrderNo: `CPO-PDA-${suffix}`,
            operatorName: '裁床领料员',
            sourceRecordId: `pickup-seed-${suffix}`,
        }),
        resultLabel: '领料成功',
        actualReceivedQtyText: '卷数 2 卷 / 长度 300 米',
        discrepancyNote: '当前无差异',
        photoProofCount: 1,
        claimDisputeId: '',
        claimDisputeNo: '',
    }));
    const inboundWritebacks = [
        {
            ...createSeedBase({
                writebackId: 'PDA-INBOUND-SEED-000203',
                actionType: 'PDA_CUT_PIECE_INBOUND_CONFIRM',
                submittedAt: '2026-03-18 16:20:00',
                taskId: 'TASK-CUT-000203',
                executionOrderNo: 'CPO-20260318-C1',
                operatorName: 'Dewi Lestari',
                sourceRecordId: 'inbound-seed-000203',
            }),
            zoneCode: 'A',
            locationLabel: '待交出仓 A-01',
            note: '铺布裁剪完成后进入待交出仓。',
        },
    ];
    const handoverWritebacks = [
        {
            ...createSeedBase({
                writebackId: 'PDA-HANDOVER-SEED-000203',
                actionType: 'PDA_CUT_PIECE_HANDOVER_CONFIRM',
                submittedAt: '2026-03-18 17:10:00',
                taskId: 'TASK-CUT-000203',
                executionOrderNo: 'CPO-20260318-C1',
                operatorName: 'Dewi Lestari',
                sourceRecordId: 'handover-seed-000203',
            }),
            targetLabel: '车缝待接收位',
            note: '裁片按菲票完成交出。',
        },
    ];
    const replenishmentFeedbackWritebacks = [
        {
            ...createSeedBase({
                writebackId: 'PDA-REPLENISH-SEED-000204',
                actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
                submittedAt: '2026-03-18 14:20:00',
                taskId: 'TASK-CUT-000204',
                executionOrderNo: 'CPO-20260318-D1',
                operatorName: '裁床组长',
                sourceRecordId: 'replenishment-seed-000204',
            }),
            reasonLabel: '布卷长度差异',
            note: '铺布前发现裁床领料长度与布卷标签不一致。',
            photoProofCount: 2,
            lifecycleStatus: 'PENDING',
            lifecycleStatusLabel: '待处理',
        },
    ];
    return {
        pickupWritebacks: sortBySubmittedAtDesc(uniqueById(pickupWritebacks)),
        inboundWritebacks: sortBySubmittedAtDesc(uniqueById(inboundWritebacks)),
        handoverWritebacks: sortBySubmittedAtDesc(uniqueById(handoverWritebacks)),
        replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(uniqueById(replenishmentFeedbackWritebacks)),
    };
}
function mergeStores(primary, secondary) {
    return {
        pickupWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.pickupWritebacks, ...secondary.pickupWritebacks])),
        inboundWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.inboundWritebacks, ...secondary.inboundWritebacks])),
        handoverWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.handoverWritebacks, ...secondary.handoverWritebacks])),
        replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.replenishmentFeedbackWritebacks, ...secondary.replenishmentFeedbackWritebacks])),
    };
}
export function createEmptyPdaExecutionWritebackStore() {
    return {
        pickupWritebacks: [],
        inboundWritebacks: [],
        handoverWritebacks: [],
        replenishmentFeedbackWritebacks: [],
    };
}
export function serializePdaExecutionWritebackStorage(store) {
    return JSON.stringify(store);
}
export function deserializePdaExecutionWritebackStorage(raw) {
    const seeded = createSeededPdaExecutionWritebackStore();
    if (!raw)
        return seeded;
    try {
        const parsed = JSON.parse(raw);
        return mergeStores({
            pickupWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.pickupWritebacks).map((item) => normalizePickupRecord(item)).filter((item) => Boolean(item)))),
            inboundWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.inboundWritebacks).map((item) => normalizeInboundRecord(item)).filter((item) => Boolean(item)))),
            handoverWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.handoverWritebacks).map((item) => normalizeHandoverRecord(item)).filter((item) => Boolean(item)))),
            replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.replenishmentFeedbackWritebacks)
                .map((item) => normalizeReplenishmentFeedbackRecord(item))
                .filter((item) => Boolean(item)))),
        }, seeded);
    }
    catch {
        return seeded;
    }
}
export function hydratePdaExecutionWritebackStore(storage) {
    if (!storage)
        return createSeededPdaExecutionWritebackStore();
    return deserializePdaExecutionWritebackStorage(storage.getItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY));
}
export function persistPdaExecutionWritebackStore(store, storage) {
    if (!storage)
        return;
    storage.setItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY, serializePdaExecutionWritebackStorage(store));
}
function appendUniqueRecord(records, record) {
    return sortBySubmittedAtDesc(uniqueById([record, ...records.filter((item) => item.writebackId !== record.writebackId)]));
}
export function appendPickupWritebackRecord(record, storage) {
    const store = hydratePdaExecutionWritebackStore(storage);
    const nextStore = {
        ...store,
        pickupWritebacks: appendUniqueRecord(store.pickupWritebacks, record),
    };
    persistPdaExecutionWritebackStore(nextStore, storage);
    return nextStore;
}
export function appendInboundWritebackRecord(record, storage) {
    const store = hydratePdaExecutionWritebackStore(storage);
    const nextStore = {
        ...store,
        inboundWritebacks: appendUniqueRecord(store.inboundWritebacks, record),
    };
    persistPdaExecutionWritebackStore(nextStore, storage);
    return nextStore;
}
export function appendHandoverWritebackRecord(record, storage) {
    const store = hydratePdaExecutionWritebackStore(storage);
    const nextStore = {
        ...store,
        handoverWritebacks: appendUniqueRecord(store.handoverWritebacks, record),
    };
    persistPdaExecutionWritebackStore(nextStore, storage);
    return nextStore;
}
export function appendReplenishmentFeedbackWritebackRecord(record, storage) {
    const store = hydratePdaExecutionWritebackStore(storage);
    const nextStore = {
        ...store,
        replenishmentFeedbackWritebacks: appendUniqueRecord(store.replenishmentFeedbackWritebacks, record),
    };
    persistPdaExecutionWritebackStore(nextStore, storage);
    return nextStore;
}
export function listPdaPickupWritebacks(storage) {
    return hydratePdaExecutionWritebackStore(storage).pickupWritebacks;
}
export function listPdaPickupWritebacksByCutOrderNo(cutOrderNo, storage) {
    return listPdaPickupWritebacks(storage).filter((item) => item.cutOrderNo === cutOrderNo);
}
export function getLatestPdaPickupWritebackByCutOrderNo(cutOrderNo, storage) {
    return listPdaPickupWritebacksByCutOrderNo(cutOrderNo, storage)[0] ?? null;
}
export function listPdaInboundWritebacks(storage) {
    return hydratePdaExecutionWritebackStore(storage).inboundWritebacks;
}
export function listPdaHandoverWritebacks(storage) {
    return hydratePdaExecutionWritebackStore(storage).handoverWritebacks;
}
export function listPdaReplenishmentFeedbackWritebacks(storage) {
    return hydratePdaExecutionWritebackStore(storage).replenishmentFeedbackWritebacks;
}
