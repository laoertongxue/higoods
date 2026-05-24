import { getBrowserLocalStorage } from '../../browser-storage.ts';
export const CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY = 'cuttingPdaStageWritebackLedger';
function nowText(date = new Date()) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
function compactTimestamp(value) {
    return value.replace(/[^0-9]/g, '').slice(0, 14);
}
function toString(value) {
    return typeof value === 'string' ? value : '';
}
function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}
function normalizeSyncStatus(value) {
    if (value === '待同步' || value === '同步失败')
        return value;
    return '已同步';
}
function normalizeActionType(value) {
    if (value === 'START_WORK')
        return 'START_WORK';
    if (value === 'START_SPREADING')
        return 'START_SPREADING';
    if (value === 'FINISH_SPREADING')
        return 'FINISH_SPREADING';
    if (value === 'START_CUTTING')
        return 'START_CUTTING';
    if (value === 'FINISH_CUTTING')
        return 'FINISH_CUTTING';
    return 'START_WORK';
}
function actionLabel(actionType) {
    if (actionType === 'START_WORK')
        return '开工';
    if (actionType === 'START_SPREADING')
        return '开始铺布';
    if (actionType === 'FINISH_SPREADING')
        return '完成铺布';
    if (actionType === 'START_CUTTING')
        return '开始裁剪';
    return '完成裁剪';
}
function sortDesc(records) {
    return records.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'));
}
function uniqueById(records) {
    const seen = new Set();
    return records.filter((record) => {
        if (!record.writebackId || seen.has(record.writebackId))
            return false;
        seen.add(record.writebackId);
        return true;
    });
}
function normalizeRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const actionType = normalizeActionType(record.actionType);
    const writebackId = toString(record.writebackId);
    if (!writebackId)
        return null;
    return {
        writebackId,
        taskId: toString(record.taskId),
        executionOrderId: toString(record.executionOrderId),
        executionOrderNo: toString(record.executionOrderNo),
        cutOrderId: toString(record.cutOrderId),
        cutOrderNo: toString(record.cutOrderNo),
        markerPlanId: toString(record.markerPlanId),
        markerPlanNo: toString(record.markerPlanNo),
        actionType,
        actionLabel: toString(record.actionLabel) || actionLabel(actionType),
        submittedAt: toString(record.submittedAt),
        operatorName: toString(record.operatorName) || '现场操作员',
        syncStatus: normalizeSyncStatus(record.syncStatus),
        actualLayerCount: toNumber(record.actualLayerCount),
        actualSpreadLength: toNumber(record.actualSpreadLength),
        headLength: toNumber(record.headLength),
        tailLength: toNumber(record.tailLength),
        actualCutQty: toNumber(record.actualCutQty),
        actualUsage: toNumber(record.actualUsage),
        varianceFlag: Boolean(record.varianceFlag),
        note: toString(record.note),
    };
}
function createSeededStore() {
    return {
        records: [
            {
                writebackId: 'PDA-STAGE-SEED-SYNC-FAIL-0310',
                taskId: 'TASK-CUT-PDA-SYNC-FAIL-0310',
                executionOrderId: 'CPO-PDA-0310',
                executionOrderNo: 'CPO-PDA-0310',
                cutOrderId: '',
                cutOrderNo: 'CUT-260303-007-01',
                markerPlanId: '',
                markerPlanNo: '',
                actionType: 'START_SPREADING',
                actionLabel: '开始铺布',
                submittedAt: '2026-03-18 11:18:00',
                operatorName: 'Sari Wulandari',
                syncStatus: '同步失败',
                actualLayerCount: 18,
                actualSpreadLength: 36,
                varianceFlag: true,
                note: 'PDA 已提交开始铺布，但网络中断，等待重新同步。',
            },
        ],
    };
}
export function serializePdaCuttingStageWritebackStore(store) {
    return JSON.stringify(store);
}
export function deserializePdaCuttingStageWritebackStore(raw) {
    const seeded = createSeededStore();
    if (!raw)
        return seeded;
    try {
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed.records)
            ? parsed.records.map((item) => normalizeRecord(item)).filter((item) => Boolean(item))
            : [];
        return {
            records: sortDesc(uniqueById([...records, ...seeded.records])),
        };
    }
    catch {
        return seeded;
    }
}
export function hydratePdaCuttingStageWritebackStore(storage = getBrowserLocalStorage()) {
    return deserializePdaCuttingStageWritebackStore(storage?.getItem(CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY) ?? null);
}
export function persistPdaCuttingStageWritebackStore(store, storage = getBrowserLocalStorage()) {
    if (!storage)
        return;
    storage.setItem(CUTTING_PDA_STAGE_WRITEBACK_STORAGE_KEY, serializePdaCuttingStageWritebackStore(store));
}
export function appendPdaCuttingStageWritebackRecord(record, storage = getBrowserLocalStorage()) {
    const submittedAt = record.submittedAt || nowText();
    const writebackId = record.writebackId ||
        `pda-stage-${record.actionType.toLowerCase()}-${record.taskId}-${record.executionOrderId}-${compactTimestamp(submittedAt)}`;
    const nextRecord = {
        ...record,
        writebackId,
        actionLabel: record.actionLabel || actionLabel(record.actionType),
        submittedAt,
    };
    const store = hydratePdaCuttingStageWritebackStore(storage);
    persistPdaCuttingStageWritebackStore({
        records: sortDesc(uniqueById([nextRecord, ...store.records])),
    }, storage);
    return nextRecord;
}
export function listPdaCuttingStageWritebackRecords(storage = getBrowserLocalStorage()) {
    return hydratePdaCuttingStageWritebackStore(storage).records;
}
export function listPdaCuttingStageWritebacksByExecution(taskId, executionOrderId, storage = getBrowserLocalStorage()) {
    return listPdaCuttingStageWritebackRecords(storage)
        .filter((record) => record.taskId === taskId && record.executionOrderId === executionOrderId)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'));
}
export function getLatestPdaCuttingStageWritebackByExecution(taskId, executionOrderId, storage = getBrowserLocalStorage()) {
    return listPdaCuttingStageWritebacksByExecution(taskId, executionOrderId, storage)[0] ?? null;
}
