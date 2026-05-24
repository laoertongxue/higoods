export const CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY = 'cuttingWarehouseWritebackLedger';
function toArray(value) {
    return Array.isArray(value) ? value : [];
}
function toString(value) {
    return typeof value === 'string' ? value : '';
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
    const submittedAt = toString(raw.submittedAt);
    const actionAt = toString(raw.actionAt) || submittedAt;
    return {
        writebackId: toString(raw.writebackId),
        actionType: toString(raw.actionType),
        actionAt,
        submittedAt: submittedAt || actionAt,
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
        sourceChannel: 'CUTTING_WAREHOUSE_UI',
        sourceDeviceId: toString(raw.sourceDeviceId) || 'CUTTING-WAREHOUSE-DESKTOP',
        sourceRecordId: toString(raw.sourceRecordId),
        sourcePageKey: toString(raw.sourcePageKey),
        status: 'RECORDED',
    };
}
function normalizeCutPieceWarehouseWritebackRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    return {
        ...base,
        actionType: toString(record.actionType),
        warehouseRecordId: toString(record.warehouseRecordId) || base.sourceRecordId,
        zoneCode: toString(record.zoneCode),
        locationCode: toString(record.locationCode),
        handoverTarget: toString(record.handoverTarget),
        note: toString(record.note),
    };
}
function normalizeSampleWarehouseWritebackRecord(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw;
    const base = normalizeBaseRecord(record);
    if (!base.writebackId)
        return null;
    const locationType = toString(record.locationType);
    return {
        ...base,
        actionType: toString(record.actionType),
        sampleRecordId: toString(record.sampleRecordId) || base.sourceRecordId,
        locationType: (['cutting-room', 'production-center', 'factory', 'inspection'].includes(locationType) ? locationType : 'production-center'),
        holder: toString(record.holder),
        note: toString(record.note),
    };
}
export function createEmptyCuttingWarehouseWritebackStore() {
    return {
        cutPieceWritebacks: [],
        sampleWritebacks: [],
    };
}
export function serializeCuttingWarehouseWritebackStorage(store) {
    return JSON.stringify(store);
}
export function deserializeCuttingWarehouseWritebackStorage(raw) {
    if (!raw)
        return createEmptyCuttingWarehouseWritebackStore();
    try {
        const parsed = JSON.parse(raw);
        return {
            cutPieceWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.cutPieceWritebacks)
                .map((item) => normalizeCutPieceWarehouseWritebackRecord(item))
                .filter((item) => Boolean(item)))),
            sampleWritebacks: sortBySubmittedAtDesc(uniqueById(toArray(parsed.sampleWritebacks)
                .map((item) => normalizeSampleWarehouseWritebackRecord(item))
                .filter((item) => Boolean(item)))),
        };
    }
    catch {
        return createEmptyCuttingWarehouseWritebackStore();
    }
}
export function hydrateCuttingWarehouseWritebackStore(storage) {
    if (!storage)
        return createEmptyCuttingWarehouseWritebackStore();
    return deserializeCuttingWarehouseWritebackStorage(storage.getItem(CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY));
}
export function persistCuttingWarehouseWritebackStore(store, storage) {
    if (!storage)
        return;
    storage.setItem(CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY, serializeCuttingWarehouseWritebackStorage(store));
}
function appendUniqueRecord(records, record) {
    return sortBySubmittedAtDesc(uniqueById([record, ...records.filter((item) => item.writebackId !== record.writebackId)]));
}
export function appendCutPieceWarehouseWritebackRecord(record, storage) {
    const store = hydrateCuttingWarehouseWritebackStore(storage);
    const nextStore = {
        ...store,
        cutPieceWritebacks: appendUniqueRecord(store.cutPieceWritebacks, record),
    };
    persistCuttingWarehouseWritebackStore(nextStore, storage);
    return nextStore;
}
export function appendSampleWarehouseWritebackRecord(record, storage) {
    const store = hydrateCuttingWarehouseWritebackStore(storage);
    const nextStore = {
        ...store,
        sampleWritebacks: appendUniqueRecord(store.sampleWritebacks, record),
    };
    persistCuttingWarehouseWritebackStore(nextStore, storage);
    return nextStore;
}
export function listCutPieceWarehouseWritebacks(storage) {
    return hydrateCuttingWarehouseWritebackStore(storage).cutPieceWritebacks;
}
export function listSampleWarehouseWritebacks(storage) {
    return hydrateCuttingWarehouseWritebackStore(storage).sampleWritebacks;
}
