import { buildFcsCuttingDomainSnapshot, } from '../../domain/fcs-cutting-runtime/index.ts';
const CONFIG_STATUS_LABEL = {
    NOT_CONFIGURED: '待配料',
    PARTIAL: '配料中',
    CONFIGURED: '已配料',
};
const RECEIVE_STATUS_LABEL = {
    NOT_RECEIVED: '待领料',
    PARTIAL: '部分领料',
    RECEIVED: '已领料',
};
const URGENCY_LABEL = {
    AA: '特急',
    A: '加急',
    B: '较急',
    C: '常规',
    D: '低优先',
};
function numberText(value, unit) {
    if (!Number.isFinite(value))
        return '—';
    return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`;
}
function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function findCutOrderSource(snapshot, sourceId) {
    return snapshot.cutOrders.find((record) => record.cutOrderId === sourceId || record.cutOrderNo === sourceId);
}
function findProgressRecord(snapshot, source) {
    return snapshot.progressRecords.find((record) => record.productionOrderId === source.productionOrderId);
}
function findMaterialLine(progressRecord, source) {
    return progressRecord?.materialLines.find((line) => line.cutOrderId === source.cutOrderId
        || line.cutOrderNo === source.cutOrderNo
        || line.cutPieceOrderNo === source.cutOrderNo
        || line.materialSku === source.materialSku);
}
function getCurrentStage(progressRecord, line) {
    if (progressRecord?.closeReason || progressRecord?.closedAt || /已关闭|不再补裁/.test(progressRecord?.cuttingStage || ''))
        return '已关闭';
    if (line?.receiveStatus === 'RECEIVED')
        return '已开工';
    return '未开工';
}
function buildCutOrderNodeRows(input) {
    const { source, progressRecord, line, statusSummary, relationSummary, latestActionText } = input;
    const unit = line?.materialType === 'SOLID' || line?.materialType === 'LINING' ? '米' : '件';
    const exceptionText = line?.issueFlags?.length ? `${line.issueFlags.length} 项` : '—';
    return [
        {
            rowId: `${source.cutOrderId}-prep`,
            node: '配料',
            startedAt: '—',
            finishedAt: '—',
            completedQty: numberText(line?.configuredLength, unit),
            exceptionQty: exceptionText,
            station: '—',
            operator: '—',
            remark: statusSummary,
        },
        {
            rowId: `${source.cutOrderId}-claim`,
            node: '领料',
            startedAt: '—',
            finishedAt: '—',
            completedQty: numberText(line?.receivedLength, unit),
            exceptionQty: exceptionText,
            station: '—',
            operator: '—',
            remark: latestActionText,
        },
        {
            rowId: `${source.cutOrderId}-marker-plan`,
            node: '唛架方案',
            startedAt: '—',
            finishedAt: '—',
            completedQty: numberText(source.requiredQty, '件'),
            exceptionQty: '—',
            station: '—',
            operator: '—',
            remark: relationSummary,
        },
        {
            rowId: `${source.cutOrderId}-current`,
            node: '裁片单状态',
            startedAt: '—',
            finishedAt: '—',
            completedQty: numberText(source.requiredQty, '件'),
            exceptionQty: exceptionText,
            station: '—',
            operator: progressRecord?.lastOperatorName || '—',
            remark: latestActionText,
        },
    ];
}
export function getCuttingCutOrderTaskPrintSourceById(sourceId, snapshot = buildFcsCuttingDomainSnapshot()) {
    const source = findCutOrderSource(snapshot, sourceId);
    if (!source)
        return null;
    const progressRecord = findProgressRecord(snapshot, source);
    const line = findMaterialLine(progressRecord, source);
    const prepStatusLabel = CONFIG_STATUS_LABEL[line?.configStatus || 'NOT_CONFIGURED'];
    const claimStatusLabel = RECEIVE_STATUS_LABEL[line?.receiveStatus || 'NOT_RECEIVED'];
    const currentStageLabel = getCurrentStage(progressRecord, line);
    const latestMarkerPlanNo = source.markerPlanNo || line?.markerPlanNo || '';
    const statusSummary = `${currentStageLabel} / ${prepStatusLabel} / ${claimStatusLabel}${progressRecord?.closeReason ? ` / 关闭原因：${progressRecord.closeReason}` : ''}`;
    const relationSummary = latestMarkerPlanNo ? `最新唛架方案号：${latestMarkerPlanNo}` : '当前未关联唛架方案';
    const latestActionText = line?.latestActionText
        || (progressRecord?.lastFieldUpdateAt ? `最近更新：${progressRecord.lastFieldUpdateAt}` : '当前暂无独立执行日志');
    return {
        cutOrderId: source.cutOrderId,
        cutOrderNo: source.cutOrderNo,
        productionOrderId: source.productionOrderId,
        productionOrderNo: source.productionOrderNo,
        styleCode: progressRecord?.styleCode || source.sourceTechPackSpuCode,
        spuCode: progressRecord?.spuCode || source.sourceTechPackSpuCode,
        materialSku: source.materialSku,
        materialLabel: source.materialLabel,
        materialCategory: source.materialCategory,
        orderQty: progressRecord?.orderQty || source.skuScopeLines.reduce((total, item) => total + item.plannedQty, 0),
        plannedQty: source.requiredQty,
        plannedShipDate: progressRecord?.plannedShipDate || '—',
        urgencyLabel: progressRecord ? URGENCY_LABEL[progressRecord.urgencyLevel] : '常规',
        prepStatusLabel,
        claimStatusLabel,
        currentStageLabel,
        latestMarkerPlanNo: latestMarkerPlanNo || '—',
        statusSummary,
        relationSummary,
        latestActionText,
        nodeRows: buildCutOrderNodeRows({
            source,
            progressRecord,
            line,
            statusSummary,
            relationSummary,
            latestActionText,
        }),
    };
}
function normalizeMarkerPlanRefStatus(value) {
    if (value === 'CUTTING' || value === 'DONE' || value === 'CANCELLED' || value === 'DRAFT' || value === 'READY')
        return value;
    return 'READY';
}
function getMarkerPlanRefStatusLabel(status) {
    if (status === 'CUTTING')
        return '铺布裁剪中';
    if (status === 'DONE')
        return '铺布裁剪完成';
    if (status === 'CANCELLED')
        return '已取消';
    return '待铺布裁剪';
}
function parseBatchDateFromNo(markerPlanNo) {
    const match = markerPlanNo.match(/(\d{2})(\d{2})(\d{2})/);
    if (!match)
        return '';
    return `20${match[1]}-${match[2]}-${match[3]}`;
}
function inferMarkerPlanRefStatus(rows) {
    if (rows.some((row) => /已完成|已入仓/.test(row.currentStageLabel)))
        return 'DONE';
    if (rows.some((row) => /裁片中|裁剪中|待入仓/.test(row.currentStageLabel)))
        return 'CUTTING';
    return 'READY';
}
function buildMarkerPlanRefNodeRows(batch) {
    const visibleStatus = batch.status === 'DRAFT' ? 'READY' : batch.status;
    const rows = [
        {
            rowId: `${batch.markerPlanId}-created`,
            node: '创建唛架方案',
            startedAt: batch.createdAt || '—',
            finishedAt: '—',
            completedQty: `${batch.sourceCutOrderCount} 单`,
            exceptionQty: '—',
            station: batch.plannedCuttingGroup || '—',
            operator: '—',
            remark: batch.plannedCuttingDate ? `计划裁剪日期：${batch.plannedCuttingDate}` : batch.note || '—',
        },
        {
            rowId: `${batch.markerPlanId}-ready`,
            node: '待铺布裁剪',
            startedAt: '—',
            finishedAt: '—',
            completedQty: '—',
            exceptionQty: '—',
            station: batch.plannedCuttingGroup || '—',
            operator: '—',
            remark: visibleStatus === 'READY' ? `当前状态：${batch.statusLabel}` : '已进入后续状态',
        },
    ];
    if (visibleStatus === 'CUTTING' || visibleStatus === 'DONE') {
        rows.push({
            rowId: `${batch.markerPlanId}-cutting`,
            node: '铺布裁剪中',
            startedAt: '—',
            finishedAt: '—',
            completedQty: visibleStatus === 'DONE' ? `${batch.sourceCutOrderCount} 单` : '—',
            exceptionQty: '—',
            station: batch.plannedCuttingGroup || '—',
            operator: '—',
            remark: batch.updatedAt ? `最近更新：${batch.updatedAt}` : `当前状态：${batch.statusLabel}`,
        });
    }
    if (visibleStatus === 'DONE' || visibleStatus === 'CANCELLED') {
        rows.push({
            rowId: `${batch.markerPlanId}-${visibleStatus.toLowerCase()}`,
            node: visibleStatus === 'DONE' ? '铺布裁剪完成' : '已取消',
            startedAt: '—',
            finishedAt: '—',
            completedQty: visibleStatus === 'DONE' ? `${batch.sourceCutOrderCount} 单` : '—',
            exceptionQty: '—',
            station: batch.plannedCuttingGroup || '—',
            operator: '—',
            remark: batch.updatedAt ? `最近更新：${batch.updatedAt}` : batch.note || '—',
        });
    }
    return rows;
}
function buildStoredMarkerPlanRefSource(raw) {
    const markerPlanId = typeof raw.markerPlanId === 'string' ? raw.markerPlanId : '';
    const markerPlanNo = typeof raw.markerPlanNo === 'string' ? raw.markerPlanNo : '';
    if (!markerPlanId || !markerPlanNo)
        return null;
    const status = normalizeMarkerPlanRefStatus(typeof raw.status === 'string' ? raw.status : undefined);
    const items = Array.isArray(raw.items) ? raw.items.filter((item) => Boolean(item && typeof item === 'object')) : [];
    const cutOrderNos = unique(items.map((item) => (typeof item.cutOrderNo === 'string' ? item.cutOrderNo : '')));
    const productionNos = unique(items.map((item) => (typeof item.productionOrderNo === 'string' ? item.productionOrderNo : '')));
    const materialSkus = unique(items.map((item) => (typeof item.materialSku === 'string' ? item.materialSku : '')));
    const batch = {
        markerPlanId,
        markerPlanNo,
        status,
        statusLabel: getMarkerPlanRefStatusLabel(status),
        styleCode: typeof raw.styleCode === 'string' ? raw.styleCode : '',
        spuCode: typeof raw.spuCode === 'string' ? raw.spuCode : '',
        materialSkuSummary: typeof raw.materialSkuSummary === 'string' ? raw.materialSkuSummary : materialSkus.join(' / '),
        sourceProductionOrderCount: Number(raw.sourceProductionOrderCount || productionNos.length || 0),
        sourceCutOrderCount: Number(raw.sourceCutOrderCount || cutOrderNos.length || 0),
        plannedCuttingGroup: typeof raw.plannedCuttingGroup === 'string' ? raw.plannedCuttingGroup : '',
        plannedCuttingDate: typeof raw.plannedCuttingDate === 'string' ? raw.plannedCuttingDate : '',
        note: typeof raw.note === 'string' ? raw.note : '',
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
        firstProductionOrderId: typeof items[0]?.productionOrderId === 'string' ? items[0].productionOrderId : '',
        firstProductionOrderNo: productionNos[0] || '',
        nodeRows: [],
    };
    batch.nodeRows = buildMarkerPlanRefNodeRows(batch);
    return batch;
}
export function listCuttingMarkerPlanRefTaskPrintSources(snapshot = buildFcsCuttingDomainSnapshot()) {
    const cutOrderRows = snapshot.cutOrders
        .map((source) => getCuttingCutOrderTaskPrintSourceById(source.cutOrderId, snapshot))
        .filter((source) => Boolean(source));
    const cutOrdersById = new Map(cutOrderRows.map((row) => [row.cutOrderId, row]));
    const byId = new Map();
    snapshot.markerPlanRefState.sourceRecords.forEach((record) => {
        const rows = record.sourceCutOrderIds
            .map((id) => cutOrdersById.get(id))
            .filter((row) => Boolean(row));
        if (!rows.length)
            return;
        const status = inferMarkerPlanRefStatus(rows);
        const plannedDate = parseBatchDateFromNo(record.markerPlanNo);
        const batch = {
            markerPlanId: record.markerPlanId,
            markerPlanNo: record.markerPlanNo,
            status,
            statusLabel: getMarkerPlanRefStatusLabel(status),
            styleCode: rows[0]?.styleCode || '',
            spuCode: rows[0]?.spuCode || '',
            materialSkuSummary: unique(rows.map((row) => row.materialSku)).join(' / '),
            sourceProductionOrderCount: unique(rows.map((row) => row.productionOrderId)).length,
            sourceCutOrderCount: rows.length,
            plannedCuttingGroup: '',
            plannedCuttingDate: plannedDate,
            note: '来源于裁片 runtime 主源聚合。',
            createdAt: plannedDate ? `${plannedDate} 09:00` : '',
            updatedAt: plannedDate ? `${plannedDate} 09:00` : '',
            firstProductionOrderId: rows[0]?.productionOrderId || '',
            firstProductionOrderNo: rows[0]?.productionOrderNo || '',
            nodeRows: [],
        };
        batch.nodeRows = buildMarkerPlanRefNodeRows(batch);
        byId.set(batch.markerPlanId, batch);
    });
    snapshot.markerPlanRefState.storedRecords
        .map((record) => buildStoredMarkerPlanRefSource(record))
        .filter((record) => Boolean(record))
        .forEach((record) => byId.set(record.markerPlanId, record));
    return Array.from(byId.values());
}
export function getCuttingMarkerPlanRefTaskPrintSourceById(sourceId, snapshot = buildFcsCuttingDomainSnapshot()) {
    return listCuttingMarkerPlanRefTaskPrintSources(snapshot).find((record) => record.markerPlanId === sourceId || record.markerPlanNo === sourceId) || null;
}
