import { listFormalFabricWarehouseRecords, } from '../../../data/fcs/cutting/warehouse-runtime.ts';
import { buildWarehouseQueryPayload } from './warehouse-shared.ts';
const numberFormatter = new Intl.NumberFormat('zh-CN');
export const fabricWarehouseMaterialMeta = {
    PRINT: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
    DYE: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
    SOLID: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
    LINING: { label: '里布', className: 'bg-amber-50 text-amber-700 border border-amber-200', widthHint: 92 },
};
export const fabricWarehouseStatusMeta = {
    READY: { label: '可用', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    PARTIAL_USED: { label: '已入待加工仓', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
    NEED_RECHECK: { label: '待审核', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
};
export function formatFabricWarehouseLength(value) {
    return `${numberFormatter.format(Math.max(value, 0))} m`;
}
function materialNameFromLabel(label) {
    const [, name] = label.split('·');
    return name?.trim() || label;
}
function buildWidthSummary(records) {
    const widths = Array.from(new Set(records.map((record) => fabricWarehouseMaterialMeta[record.materialType].widthHint)));
    return widths.map((width) => `${width} cm`).join(' / ');
}
function buildRolls(record) {
    const totalRolls = Math.max(record.configuredRollCount, 1);
    const remainingRollCount = Math.max(record.remainingRollCount, 0);
    const width = fabricWarehouseMaterialMeta[record.materialType].widthHint;
    const avgLength = Number((record.configuredLength / totalRolls).toFixed(1));
    const avgRemaining = remainingRollCount > 0 ? Number((record.remainingLength / remainingRollCount).toFixed(1)) : 0;
    return Array.from({ length: totalRolls }, (_, index) => {
        const sequence = index + 1;
        const inStock = sequence <= remainingRollCount;
        const sourceProcessType = record.materialType === 'PRINT' ? 'PRINT' : record.materialType === 'DYE' ? 'DYE' : 'RAW';
        const materialSpuNameCn = materialNameFromLabel(record.materialLabel);
        return {
            rollItemId: `${record.id}-roll-${sequence}`,
            stockItemId: record.id,
            fabricRollId: `${record.id}-roll-${sequence}`,
            fabricRollNo: `${record.materialSku}-R${String(sequence).padStart(2, '0')}`,
            rollNo: `${record.materialSku}-R${String(sequence).padStart(2, '0')}`,
            rollBarcode: `RB-${record.materialSku}-${String(sequence).padStart(3, '0')}`,
            batchNo: record.markerPlanNo || record.cutOrderNo,
            batchSeqNo: String(sequence).padStart(2, '0'),
            materialSku: record.materialSku,
            materialSpuNameCn,
            fabricColor: record.materialLabel.split('·')[1]?.trim() || '待补',
            width,
            labeledLength: avgLength,
            actualLength: inStock ? avgRemaining : avgLength,
            lengthUnit: '米',
            remainingLength: inStock ? avgRemaining : 0,
            sourceProcessType,
            sourceProcessOrderNo: sourceProcessType === 'RAW' ? record.cutOrderNo : record.cutOrderNo,
            currentAreaName: inStock ? 'A区' : '已入待加工仓',
            status: inStock ? 'IN_STOCK' : 'USED',
            locationHint: inStock ? 'A区' : '已入待加工仓',
            note: record.note,
            sourceCutOrderNo: record.cutOrderNo,
            sourceProductionOrderNo: record.productionOrderNo,
        };
    });
}
export function deriveFabricWarehouseRiskTags(records) {
    const tags = [];
    if (records.some((record) => record.fabricState === 'NEED_RECHECK')) {
        tags.push({ key: 'STOCK_RECHECK', label: '待核对', className: 'bg-rose-100 text-rose-700 border border-rose-200' });
    }
    if (records.some((record) => record.remainingLength > 0 && record.remainingLength <= 60)) {
        tags.push({ key: 'LOW_REMAINING', label: '低余量', className: 'bg-amber-100 text-amber-700 border border-amber-200' });
    }
    if (records.some((record) => !record.latestReceiveAt)) {
        tags.push({ key: 'WAITING_RECEIVE', label: '待领用', className: 'bg-sky-100 text-sky-700 border border-sky-200' });
    }
    return tags;
}
function buildStockStatus(record) {
    return record.fabricState;
}
function findBoundCutOrderRow(record, cutOrderRows) {
    return (cutOrderRows.find((row) => row.cutOrderId === record.cutOrderId) ||
        cutOrderRows.find((row) => row.cutOrderNo === record.cutOrderNo) ||
        null);
}
export function buildFabricWarehouseNavigationPayload(item) {
    return buildWarehouseQueryPayload({
        materialSku: item.materialSku,
        cutOrderId: item.cutOrderId || undefined,
        cutOrderNo: item.cutOrderNo || undefined,
        productionOrderId: item.productionOrderId || undefined,
        productionOrderNo: item.productionOrderNo || undefined,
        markerPlanId: item.markerPlanId || undefined,
        markerPlanNo: item.markerPlanNo || undefined,
    });
}
export function buildFabricWarehouseViewModel(cutOrderRows, records = listFormalFabricWarehouseRecords()) {
    const items = records
        .map((record) => {
        const row = findBoundCutOrderRow(record, cutOrderRows);
        const rolls = buildRolls(record);
        const sourceCutOrderIds = [record.cutOrderId].filter(Boolean);
        const sourceCutOrderNos = [record.cutOrderNo].filter(Boolean);
        const sourceProductionOrderNos = [record.productionOrderNo].filter(Boolean);
        const item = {
            stockItemId: record.id,
            cutOrderId: record.cutOrderId,
            cutOrderNo: record.cutOrderNo,
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
            markerPlanId: row?.activeMarkerPlanId || record.markerPlanId,
            markerPlanNo: row?.activeMarkerPlanNo || record.markerPlanNo,
            materialSku: record.materialSku,
            materialName: materialNameFromLabel(record.materialLabel),
            materialCategory: record.materialType,
            materialAttr: fabricWarehouseMaterialMeta[record.materialType].label,
            materialAlias: record.materialAlias || row?.materialAlias || '',
            materialImageUrl: record.materialImageUrl || row?.materialImageUrl || '',
            status: buildStockStatus(record),
            rollCount: rolls.length,
            configuredLengthTotal: record.configuredLength,
            remainingLengthTotal: record.remainingLength,
            widthSummary: buildWidthSummary([record]),
            sourceCutOrderIds,
            sourceCutOrderNos,
            sourceProductionOrderNos,
            lastUpdatedAt: record.latestReceiveAt || record.latestConfigAt,
            riskTags: deriveFabricWarehouseRiskTags([record]),
            rolls,
            navigationPayload: buildFabricWarehouseNavigationPayload({
                materialSku: record.materialSku,
                cutOrderId: record.cutOrderId,
                cutOrderNo: record.cutOrderNo,
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
                markerPlanId: row?.activeMarkerPlanId || record.markerPlanId,
                markerPlanNo: row?.activeMarkerPlanNo || record.markerPlanNo,
            }),
            keywordIndex: [
                record.materialSku,
                record.materialLabel,
                record.materialAlias,
                record.cutOrderId,
                record.cutOrderNo,
                record.productionOrderId,
                record.productionOrderNo,
                ...rolls.map((roll) => roll.rollNo),
            ]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase()),
        };
        return item;
    })
        .sort((left, right) => right.remainingLengthTotal - left.remainingLengthTotal ||
        left.materialSku.localeCompare(right.materialSku, 'zh-CN') ||
        left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'));
    return {
        items,
        itemsById: Object.fromEntries(items.map((item) => [item.stockItemId, item])),
        summary: summarizeFabricWarehouseStocks(items),
    };
}
export function summarizeFabricWarehouseStocks(items) {
    return {
        stockItemCount: items.length,
        rollCount: items.reduce((sum, item) => sum + item.rollCount, 0),
        configuredLengthTotal: items.reduce((sum, item) => sum + item.configuredLengthTotal, 0),
        remainingLengthTotal: items.reduce((sum, item) => sum + item.remainingLengthTotal, 0),
        lowRemainingItemCount: items.filter((item) => item.riskTags.some((tag) => tag.key === 'LOW_REMAINING')).length,
        abnormalItemCount: items.filter((item) => item.riskTags.length > 0).length,
    };
}
export function filterFabricWarehouseItems(items, filters, prefilter) {
    const keyword = filters.keyword.trim().toLowerCase();
    return items.filter((item) => {
        if (prefilter?.materialSku && item.materialSku !== prefilter.materialSku)
            return false;
        if (prefilter?.cutOrderId && item.cutOrderId !== prefilter.cutOrderId)
            return false;
        if (prefilter?.cutOrderNo && item.cutOrderNo !== prefilter.cutOrderNo)
            return false;
        if (prefilter?.productionOrderId && item.productionOrderId !== prefilter.productionOrderId)
            return false;
        if (prefilter?.productionOrderNo && item.productionOrderNo !== prefilter.productionOrderNo)
            return false;
        if (prefilter?.rollNo && !item.rolls.some((roll) => roll.rollNo === prefilter.rollNo))
            return false;
        if (filters.materialCategory !== 'ALL' && item.materialCategory !== filters.materialCategory)
            return false;
        if (filters.status !== 'ALL' && item.status !== filters.status)
            return false;
        if (filters.risk !== 'ALL' && !item.riskTags.some((tag) => tag.key === filters.risk))
            return false;
        if (filters.lowRemainingOnly && item.remainingLengthTotal > 60)
            return false;
        if (!keyword)
            return true;
        return item.keywordIndex.some((value) => value.includes(keyword));
    });
}
export function findFabricWarehouseByPrefilter(items, prefilter) {
    if (!prefilter)
        return null;
    return ((prefilter.materialSku && items.find((item) => item.materialSku === prefilter.materialSku)) ||
        (prefilter.cutOrderId && items.find((item) => item.cutOrderId === prefilter.cutOrderId)) ||
        (prefilter.cutOrderNo && items.find((item) => item.cutOrderNo === prefilter.cutOrderNo)) ||
        (prefilter.productionOrderId && items.find((item) => item.productionOrderId === prefilter.productionOrderId)) ||
        (prefilter.productionOrderNo && items.find((item) => item.productionOrderNo === prefilter.productionOrderNo)) ||
        (prefilter.rollNo && items.find((item) => item.rolls.some((roll) => roll.rollNo === prefilter.rollNo))) ||
        null);
}
