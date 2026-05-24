import { listFormalSampleWarehouseRecords, } from '../../../data/fcs/cutting/warehouse-runtime.ts';
import { listSampleWarehouseWritebacks, } from '../../../data/fcs/cutting/warehouse-writeback-ledger.ts';
import { buildWarehouseQueryPayload } from './warehouse-shared.ts';
import { getBrowserLocalStorage } from '../../../data/browser-storage.ts';
export const sampleLocationTypeLabel = {
    'cutting-room': '裁床现场',
    'production-center': '生产管理中心',
    factory: '工厂',
    inspection: '抽检',
};
export const sampleWarehouseStatusMeta = {
    AVAILABLE: { label: '在仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', detailText: '当前样衣在仓，可被裁床或生产管理中心调用。' },
    BORROWED: { label: '借出中', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '当前样衣已借出，等待归还。' },
    IN_FACTORY: { label: '在工厂', className: 'bg-violet-100 text-violet-700 border border-violet-200', detailText: '当前样衣在工厂侧使用或核价。' },
    INSPECTION: { label: '抽检中', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '当前样衣正处于抽检或回流检查状态。' },
    PENDING_RETURN: { label: '待归还', className: 'bg-rose-100 text-rose-700 border border-rose-200', detailText: '当前样衣超过建议归还时间，需尽快回仓。' },
};
function createSummaryMeta(key, label, className, detailText) {
    return { key, label, className, detailText };
}
function deriveLocationType(stage) {
    if (stage === 'CUTTING')
        return 'cutting-room';
    if (stage === 'FACTORY_CHECK')
        return 'factory';
    if (stage === 'RETURN_CHECK')
        return 'inspection';
    return 'production-center';
}
function deriveStageFromWriteback(locationType, actionType) {
    if (actionType === 'SAMPLE_WAREHOUSE_RETURN')
        return 'BACK_TO_PMC';
    if (actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION')
        return 'RETURN_CHECK';
    if (locationType === 'cutting-room')
        return 'CUTTING';
    if (locationType === 'factory')
        return 'FACTORY_CHECK';
    if (locationType === 'inspection')
        return 'RETURN_CHECK';
    return 'PMC_WAREHOUSE';
}
function deriveActionText(actionType) {
    if (actionType === 'SAMPLE_WAREHOUSE_BORROW')
        return '样衣借出';
    if (actionType === 'SAMPLE_WAREHOUSE_RETURN')
        return '样衣归还';
    if (actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION')
        return '样衣进入抽检';
    return '样衣调拨位置';
}
function buildOverlaySampleRecord(writeback) {
    return {
        id: writeback.sampleRecordId,
        warehouseType: 'SAMPLE',
        bindingState: writeback.cutOrderId ? 'BOUND_FORMAL_SAMPLE_RECORD' : 'UNBOUND_FORMAL_SAMPLE_RECORD',
        cutOrderId: writeback.cutOrderId,
        cutOrderNo: writeback.cutOrderNo,
        productionOrderId: writeback.productionOrderId,
        productionOrderNo: writeback.productionOrderNo,
        sampleNo: writeback.sampleRecordId,
        sampleName: '待补样衣',
        relatedProductionOrderNo: writeback.productionOrderNo,
        relatedCutPieceOrderNo: writeback.cutOrderNo,
        currentLocationStage: deriveStageFromWriteback(writeback.locationType, writeback.actionType),
        currentHolder: writeback.holder || 'PMC 样衣仓',
        currentStatus: 'AVAILABLE',
        latestActionAt: writeback.submittedAt,
        latestActionBy: writeback.operatorName,
        nextSuggestedAction: writeback.note || '待补正式流转建议。',
        flowHistory: [],
    };
}
export function deriveSampleWarehouseStatus(record) {
    if (record.currentLocationStage === 'FACTORY_CHECK')
        return createSummaryMeta('IN_FACTORY', sampleWarehouseStatusMeta.IN_FACTORY.label, sampleWarehouseStatusMeta.IN_FACTORY.className, sampleWarehouseStatusMeta.IN_FACTORY.detailText);
    if (record.currentLocationStage === 'RETURN_CHECK' || record.currentStatus === 'CHECKING')
        return createSummaryMeta('INSPECTION', sampleWarehouseStatusMeta.INSPECTION.label, sampleWarehouseStatusMeta.INSPECTION.className, sampleWarehouseStatusMeta.INSPECTION.detailText);
    if (record.currentStatus === 'WAITING_RETURN')
        return createSummaryMeta('PENDING_RETURN', sampleWarehouseStatusMeta.PENDING_RETURN.label, sampleWarehouseStatusMeta.PENDING_RETURN.className, sampleWarehouseStatusMeta.PENDING_RETURN.detailText);
    if (record.currentStatus === 'IN_USE')
        return createSummaryMeta('BORROWED', sampleWarehouseStatusMeta.BORROWED.label, sampleWarehouseStatusMeta.BORROWED.className, sampleWarehouseStatusMeta.BORROWED.detailText);
    return createSummaryMeta('AVAILABLE', sampleWarehouseStatusMeta.AVAILABLE.label, sampleWarehouseStatusMeta.AVAILABLE.className, sampleWarehouseStatusMeta.AVAILABLE.detailText);
}
function mapFlowRecord(sampleItemId, item, index, previous) {
    const fromType = previous ? deriveLocationType(previous.stage) : deriveLocationType(item.stage);
    const toType = deriveLocationType(item.stage);
    return {
        flowRecordId: `${sampleItemId}-flow-${index + 1}`,
        sampleItemId,
        fromLocationType: fromType,
        fromLocationName: sampleLocationTypeLabel[fromType],
        toLocationType: toType,
        toLocationName: sampleLocationTypeLabel[toType],
        actionType: item.actionText,
        operatorName: item.operatedBy,
        actionAt: item.operatedAt,
        note: item.note,
    };
}
export function buildSampleFlowTimeline(record) {
    return record.flowHistory.map((item, index) => mapFlowRecord(record.id, item, index, index > 0 ? record.flowHistory[index - 1] : null));
}
function applySampleWarehouseWritebackOverlay(records, options = {}) {
    const storage = getBrowserLocalStorage() || undefined;
    const sampleWritebacks = [...(options.sampleWritebacks ?? listSampleWarehouseWritebacks(storage))]
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt, 'zh-CN'));
    const runtimeMap = new Map(records.map((record) => [
        record.id,
        {
            ...record,
            flowHistory: record.flowHistory.map((item) => ({ ...item })),
        },
    ]));
    sampleWritebacks.forEach((writeback) => {
        const current = runtimeMap.get(writeback.sampleRecordId) || buildOverlaySampleRecord(writeback);
        const next = {
            ...current,
            id: writeback.sampleRecordId,
            bindingState: writeback.cutOrderId ? 'BOUND_FORMAL_SAMPLE_RECORD' : 'UNBOUND_FORMAL_SAMPLE_RECORD',
            cutOrderId: writeback.cutOrderId,
            cutOrderNo: writeback.cutOrderNo,
            productionOrderId: writeback.productionOrderId,
            productionOrderNo: writeback.productionOrderNo,
            relatedProductionOrderNo: writeback.productionOrderNo,
            relatedCutPieceOrderNo: writeback.cutOrderNo,
            latestActionAt: writeback.submittedAt,
            latestActionBy: writeback.operatorName,
            flowHistory: current.flowHistory.map((item) => ({ ...item })),
        };
        if (writeback.actionType === 'SAMPLE_WAREHOUSE_BORROW') {
            next.currentLocationStage = deriveStageFromWriteback(writeback.locationType, writeback.actionType);
            next.currentHolder = writeback.holder || current.currentHolder;
            next.currentStatus = 'IN_USE';
            next.nextSuggestedAction = '当前为借出中样衣，使用完成后需归还样衣仓。';
        }
        else if (writeback.actionType === 'SAMPLE_WAREHOUSE_RETURN') {
            next.currentLocationStage = 'BACK_TO_PMC';
            next.currentHolder = writeback.holder || 'PMC 样衣仓';
            next.currentStatus = 'AVAILABLE';
            next.nextSuggestedAction = '样衣已归还，可再次调用。';
        }
        else if (writeback.actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION') {
            next.currentLocationStage = 'RETURN_CHECK';
            next.currentHolder = writeback.holder || '抽检组';
            next.currentStatus = 'CHECKING';
            next.nextSuggestedAction = '抽检完成后归还样衣仓。';
        }
        else {
            next.currentLocationStage = deriveStageFromWriteback(writeback.locationType, writeback.actionType);
            next.currentHolder = writeback.holder || current.currentHolder;
            if (writeback.locationType === 'factory') {
                next.currentStatus = 'WAITING_RETURN';
                next.nextSuggestedAction = '工厂使用完成后需归还样衣仓。';
            }
            else if (writeback.locationType === 'inspection') {
                next.currentStatus = 'CHECKING';
                next.nextSuggestedAction = '当前样衣在抽检流程中。';
            }
            else {
                next.currentStatus = 'AVAILABLE';
                next.nextSuggestedAction = '当前样衣位置已调拨，可继续调用。';
            }
        }
        next.flowHistory.push({
            stage: next.currentLocationStage,
            actionText: deriveActionText(writeback.actionType),
            operatedBy: writeback.operatorName,
            operatedAt: writeback.submittedAt,
            note: writeback.note,
        });
        runtimeMap.set(writeback.sampleRecordId, next);
    });
    return Array.from(runtimeMap.values());
}
export function buildSampleWarehouseNavigationPayload(item) {
    return buildWarehouseQueryPayload({
        cutOrderId: item.relatedCutOrderId,
        cutOrderNo: item.relatedCutOrderNo,
        productionOrderId: item.relatedProductionOrderId,
        productionOrderNo: item.relatedProductionOrderNo,
        materialSku: item.materialSku || undefined,
        styleCode: item.styleCode,
        sampleNo: item.sampleNo,
        holder: item.currentHolder,
        warehouseStatus: item.status.key,
    });
}
export function buildSampleWarehouseViewModel(cutOrderRows, records = listFormalSampleWarehouseRecords(), options = {}) {
    const runtimeRecords = applySampleWarehouseWritebackOverlay(records, options);
    const rowById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]));
    const rowByOrderNo = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderNo, row]));
    const findBoundCutOrderRow = (record) => rowById[record.cutOrderId] ||
        rowByOrderNo[record.cutOrderNo];
    const items = runtimeRecords
        .map((record) => {
        const row = findBoundCutOrderRow(record);
        const status = deriveSampleWarehouseStatus(record);
        const item = {
            sampleItemId: record.id,
            sampleNo: record.sampleNo,
            styleCode: row?.styleCode || '',
            spuCode: row?.spuCode || '',
            materialSku: row?.materialSku || '',
            materialAlias: row?.materialAlias || '',
            materialImageUrl: row?.materialImageUrl || '',
            color: row?.color || '待补颜色',
            size: '均码',
            currentLocationType: deriveLocationType(record.currentLocationStage),
            currentLocationName: sampleLocationTypeLabel[deriveLocationType(record.currentLocationStage)],
            currentHolder: record.currentHolder,
            status,
            lastMovedAt: record.latestActionAt,
            latestActionBy: record.latestActionBy,
            note: record.nextSuggestedAction,
            relatedProductionOrderId: record.productionOrderId,
            relatedProductionOrderNo: record.productionOrderNo,
            relatedCutOrderId: record.cutOrderId,
            relatedCutOrderNo: record.cutOrderNo,
            sampleName: record.sampleName,
            flowRecords: buildSampleFlowTimeline(record),
            navigationPayload: buildSampleWarehouseNavigationPayload({
                relatedCutOrderId: record.cutOrderId,
                relatedCutOrderNo: record.cutOrderNo,
                relatedProductionOrderId: record.productionOrderId,
                relatedProductionOrderNo: record.productionOrderNo,
                materialSku: row?.materialSku || '',
                styleCode: row?.styleCode || '',
                sampleNo: record.sampleNo,
                currentHolder: record.currentHolder,
                status,
            }),
            keywordIndex: [
                record.sampleNo,
                row?.styleCode,
                row?.spuCode,
                row?.materialSku,
                row?.materialAlias,
                row?.cutOrderId,
                row?.cutOrderNo,
                row?.productionOrderId || record.productionOrderId,
                row?.productionOrderNo || record.productionOrderNo,
                record.currentHolder,
                record.sampleName,
            ]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase()),
        };
        return item;
    })
        .sort((left, right) => right.lastMovedAt.localeCompare(left.lastMovedAt, 'zh-CN'));
    return {
        items,
        itemsById: Object.fromEntries(items.map((item) => [item.sampleItemId, item])),
        summary: {
            totalSampleCount: items.length,
            availableCount: items.filter((item) => item.status.key === 'AVAILABLE').length,
            borrowedCount: items.filter((item) => item.status.key === 'BORROWED' || item.status.key === 'PENDING_RETURN' || item.status.key === 'IN_FACTORY').length,
            inInspectionCount: items.filter((item) => item.status.key === 'INSPECTION').length,
            flowRecordCount: items.reduce((sum, item) => sum + item.flowRecords.length, 0),
        },
    };
}
export function filterSampleWarehouseItems(items, filters, prefilter) {
    const keyword = filters.keyword.trim().toLowerCase();
    return items.filter((item) => {
        if (prefilter?.cutOrderId && item.relatedCutOrderId !== prefilter.cutOrderId)
            return false;
        if (prefilter?.productionOrderId && item.relatedProductionOrderId !== prefilter.productionOrderId)
            return false;
        if (prefilter?.materialSku && item.materialSku !== prefilter.materialSku)
            return false;
        if (prefilter?.styleCode && item.styleCode !== prefilter.styleCode)
            return false;
        if (prefilter?.sampleNo && item.sampleNo !== prefilter.sampleNo)
            return false;
        if (prefilter?.holder && !item.currentHolder.includes(prefilter.holder))
            return false;
        if (prefilter?.status && item.status.key !== prefilter.status)
            return false;
        if (filters.status !== 'ALL' && item.status.key !== filters.status)
            return false;
        if (filters.locationType !== 'ALL' && item.currentLocationType !== filters.locationType)
            return false;
        if (filters.holder && !item.currentHolder.toLowerCase().includes(filters.holder.toLowerCase()))
            return false;
        if (!keyword)
            return true;
        return item.keywordIndex.some((value) => value.includes(keyword));
    });
}
export function findSampleWarehouseByPrefilter(items, prefilter) {
    if (!prefilter)
        return null;
    return ((prefilter.cutOrderId && items.find((item) => item.relatedCutOrderId === prefilter.cutOrderId)) ||
        (prefilter.productionOrderId && items.find((item) => item.relatedProductionOrderId === prefilter.productionOrderId)) ||
        (prefilter.materialSku && items.find((item) => item.materialSku === prefilter.materialSku)) ||
        (prefilter.sampleNo && items.find((item) => item.sampleNo === prefilter.sampleNo)) ||
        (prefilter.styleCode && items.find((item) => item.styleCode === prefilter.styleCode)) ||
        null);
}
