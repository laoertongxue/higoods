import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../factory-mock-data.ts';
function nowText(date = new Date()) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
function compactTimestamp(value) {
    return value.replace(/[^0-9]/g, '').slice(0, 14);
}
function normalizeNameKey(name) {
    return Array.from(name.trim())
        .map((char) => char.charCodeAt(0).toString(16))
        .join('')
        .slice(0, 16);
}
function buildSyntheticWarehouseOperatorAccountId(factoryId, operatorName) {
    return `WH-${factoryId || TEST_FACTORY_ID}-${normalizeNameKey(operatorName || '仓务操作员') || 'operator'}`;
}
export function resolvePrototypeWarehouseOperator(operatorName = '仓务操作员') {
    const normalizedName = operatorName.trim() || '仓务操作员';
    const factoryId = TEST_FACTORY_ID;
    return {
        operatorAccountId: buildSyntheticWarehouseOperatorAccountId(factoryId, normalizedName),
        operatorName: normalizedName,
        operatorRole: '仓务员',
        operatorFactoryId: factoryId,
        operatorFactoryName: TEST_FACTORY_NAME,
    };
}
export function buildCuttingWarehouseWritebackSource(sourcePageKey, sourceRecordId) {
    return {
        sourceChannel: 'CUTTING_WAREHOUSE_UI',
        sourceDeviceId: 'CUTTING-WAREHOUSE-DESKTOP',
        sourceRecordId,
        sourcePageKey,
    };
}
export function buildCuttingWarehouseWritebackId(actionType, recordId, actionAt) {
    const compactId = (recordId || 'unknown').replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'unknown';
    return `WH-${actionType}-${compactTimestamp(actionAt) || '00000000000000'}-${compactId}`;
}
export function normalizeCutPieceWarehouseWritebackInput(input) {
    const actionAt = input.actionAt || nowText();
    const operator = resolvePrototypeWarehouseOperator(input.operatorName);
    const source = buildCuttingWarehouseWritebackSource('CUT_PIECE_WAREHOUSE_PAGE', input.identity.warehouseRecordId);
    return {
        writebackId: buildCuttingWarehouseWritebackId(input.actionType, input.identity.warehouseRecordId, actionAt),
        actionType: input.actionType,
        actionAt,
        submittedAt: actionAt,
        warehouseRecordId: input.identity.warehouseRecordId,
        productionOrderId: input.identity.productionOrderId,
        productionOrderNo: input.identity.productionOrderNo,
        cutOrderId: input.identity.cutOrderId,
        cutOrderNo: input.identity.cutOrderNo,
        markerPlanId: input.identity.markerPlanId || '',
        markerPlanNo: input.identity.markerPlanNo || '',
        materialSku: input.identity.materialSku,
        zoneCode: input.zoneCode || 'UNASSIGNED',
        locationCode: input.locationCode?.trim() || '待补区域',
        handoverTarget: input.handoverTarget?.trim() || '',
        note: input.note?.trim() || '',
        operatorAccountId: operator.operatorAccountId,
        operatorName: operator.operatorName,
        operatorRole: operator.operatorRole,
        operatorFactoryId: operator.operatorFactoryId,
        operatorFactoryName: operator.operatorFactoryName,
        sourceChannel: source.sourceChannel,
        sourceDeviceId: source.sourceDeviceId,
        sourceRecordId: source.sourceRecordId,
        sourcePageKey: source.sourcePageKey,
        status: 'RECORDED',
    };
}
export function normalizeSampleWarehouseWritebackInput(input) {
    const actionAt = input.actionAt || nowText();
    const operator = resolvePrototypeWarehouseOperator(input.operatorName);
    const source = buildCuttingWarehouseWritebackSource('SAMPLE_WAREHOUSE_PAGE', input.identity.sampleRecordId);
    return {
        writebackId: buildCuttingWarehouseWritebackId(input.actionType, input.identity.sampleRecordId, actionAt),
        actionType: input.actionType,
        actionAt,
        submittedAt: actionAt,
        sampleRecordId: input.identity.sampleRecordId,
        productionOrderId: input.identity.productionOrderId,
        productionOrderNo: input.identity.productionOrderNo,
        cutOrderId: input.identity.cutOrderId,
        cutOrderNo: input.identity.cutOrderNo,
        markerPlanId: '',
        markerPlanNo: '',
        materialSku: input.identity.materialSku,
        locationType: input.locationType || 'production-center',
        holder: input.holder?.trim() || 'PMC 样衣仓',
        note: input.note?.trim() || '',
        operatorAccountId: operator.operatorAccountId,
        operatorName: operator.operatorName,
        operatorRole: operator.operatorRole,
        operatorFactoryId: operator.operatorFactoryId,
        operatorFactoryName: operator.operatorFactoryName,
        sourceChannel: source.sourceChannel,
        sourceDeviceId: source.sourceDeviceId,
        sourceRecordId: source.sourceRecordId,
        sourcePageKey: source.sourcePageKey,
        status: 'RECORDED',
    };
}
