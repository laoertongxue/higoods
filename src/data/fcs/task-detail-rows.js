import { DETAIL_SPLIT_DIMENSION_LABEL, } from './process-craft-dict.ts';
import { productionOrders, } from './production-orders.ts';
import { getProductionOrderTechPackSnapshot } from './production-order-tech-pack-runtime.ts';
const DIMENSION_PRIORITY = [
    'GARMENT_COLOR',
    'GARMENT_SKU',
    'PATTERN',
    'MATERIAL_SKU',
];
function uniqueStable(values) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
        if (!value || seen.has(value))
            continue;
        seen.add(value);
        result.push(value);
    }
    return result;
}
function normalizeToken(value) {
    const token = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return token || 'na';
}
function roundQty(value) {
    if (!Number.isFinite(value) || value <= 0)
        return 0;
    return Math.round(value * 1000) / 1000;
}
function formatQty(value) {
    const rounded = roundQty(value);
    if (Number.isInteger(rounded))
        return `${rounded}`;
    return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
function fallbackDimensionsByGranularity(granularity) {
    if (granularity === 'SKU' || granularity === 'DETAIL')
        return ['GARMENT_SKU'];
    if (granularity === 'COLOR')
        return ['GARMENT_COLOR', 'MATERIAL_SKU'];
    return ['PATTERN', 'MATERIAL_SKU'];
}
function resolveOrderSkuLines(orderId) {
    const order = productionOrders.find((item) => item.productionOrderId === orderId);
    if (!order)
        return [];
    return order.demandSnapshot.skuLines
        .map((line) => ({
        skuCode: line.skuCode,
        color: line.color,
        qty: line.qty,
    }))
        .sort((a, b) => a.skuCode.localeCompare(b.skuCode));
}
function resolveMaterialCandidates(bomItems, processCode, orderSkuCodes) {
    const filteredByProcess = bomItems.filter((item) => {
        if (!item.usageProcessCodes || item.usageProcessCodes.length === 0)
            return true;
        return item.usageProcessCodes.includes(processCode);
    });
    const scopedBomItems = filteredByProcess.length > 0 ? filteredByProcess : bomItems;
    const rows = scopedBomItems.map((item) => {
        const applicableSkuCodes = item.applicableSkuCodes && item.applicableSkuCodes.length > 0
            ? uniqueStable(item.applicableSkuCodes).filter((sku) => orderSkuCodes.includes(sku))
            : [...orderSkuCodes];
        const consumptionFactor = Math.max(item.unitConsumption, 0)
            * (1 + Math.max(item.lossRate, 0));
        return {
            bomItemId: item.id,
            materialCode: item.id,
            materialName: item.name,
            consumptionFactor: consumptionFactor > 0 ? consumptionFactor : 1,
            applicableSkuCodes,
        };
    });
    return rows.filter((row) => row.applicableSkuCodes.length > 0);
}
function resolvePatternCandidates(patterns, orderSkuCodes) {
    if (!patterns.length)
        return [];
    return patterns.map((pattern) => {
        const pieceIds = uniqueStable((pattern.pieceRows ?? []).map((piece) => piece.id));
        const pieceSkuCodes = uniqueStable((pattern.pieceRows ?? []).flatMap((piece) => piece.applicableSkuCodes ?? []));
        const applicableSkuCodes = pieceSkuCodes.length > 0
            ? pieceSkuCodes.filter((sku) => orderSkuCodes.includes(sku))
            : [...orderSkuCodes];
        return {
            patternId: pattern.id,
            patternName: pattern.fileName,
            linkedBomItemId: pattern.linkedBomItemId,
            applicableSkuCodes,
            pieceIds,
        };
    });
}
function sumOrderQtyBySku(orderSkuLines, skuCodes) {
    if (skuCodes.length === 0)
        return 0;
    const skuSet = new Set(skuCodes);
    return orderSkuLines
        .filter((line) => skuSet.has(line.skuCode))
        .reduce((sum, line) => sum + line.qty, 0);
}
function intersectSkuCodes(a, b) {
    const bSet = new Set(b);
    return a.filter((value) => bSet.has(value));
}
function makeRowLabel(dimensions, orderedDimensions) {
    const segments = orderedDimensions
        .map((dimension) => dimensions[dimension])
        .filter((value) => Boolean(value));
    if (segments.length > 0)
        return segments.join(' / ');
    return '默认明细行';
}
function makeRowKey(taskId, orderedDimensions, dimensions) {
    const segments = orderedDimensions.map((dimension) => `${dimension}_${normalizeToken(dimensions[dimension] ?? '-')}`);
    return `ROW-${taskId}-${segments.join('__')}`;
}
function makeSortKey(orderedDimensions, dimensions) {
    const segments = orderedDimensions.map((dimension) => normalizeToken(dimensions[dimension] ?? '-'));
    return `${orderedDimensions.join('+')}::${segments.join('::')}`;
}
function upsertRow(rowMap, taskId, orderedDimensions, dimensions, qty, sourceRefs, uom = '件') {
    const stableQty = roundQty(qty);
    if (stableQty <= 0)
        return;
    const rowKey = makeRowKey(taskId, orderedDimensions, dimensions);
    const existing = rowMap.get(rowKey);
    if (existing) {
        existing.qty = roundQty(existing.qty + stableQty);
        existing.sourceRefs = { ...existing.sourceRefs, ...sourceRefs };
        return;
    }
    rowMap.set(rowKey, {
        rowKey,
        taskId,
        rowType: 'COMPOSITE',
        rowLabel: makeRowLabel(dimensions, orderedDimensions),
        qty: stableQty,
        uom,
        dimensions,
        sourceRefs,
        sortKey: makeSortKey(orderedDimensions, dimensions),
    });
}
function isPartWoolArtifact(artifact) {
    return artifact.processCode === 'WOOL'
        && (artifact.woolTaskType === 'PART_PANEL' || artifact.craftName === '部位毛织' || artifact.taskTypeLabel === '部位毛织');
}
function isWholeWoolArtifact(artifact) {
    return artifact.processCode === 'WOOL' && !isPartWoolArtifact(artifact);
}
function buildWoolRows(input) {
    const { rowMap, taskId, dimensions, orderSkuLines, patterns, artifact, baseRefs } = input;
    if (isWholeWoolArtifact(artifact)) {
        for (const line of orderSkuLines) {
            upsertRow(rowMap, taskId, dimensions, { GARMENT_SKU: line.skuCode }, line.qty, {
                ...baseRefs,
                garmentSku: line.skuCode,
                garmentColor: line.color,
            }, '件');
        }
        return;
    }
    const woolPatterns = patterns.filter((pattern) => pattern.patternMaterialType === 'WOOL');
    for (const pattern of woolPatterns) {
        for (const piece of pattern.pieceRows ?? []) {
            const pieceName = String(piece.name || '').trim();
            if (!pieceName)
                continue;
            const allocations = piece.colorAllocations && piece.colorAllocations.length > 0
                ? piece.colorAllocations
                : [];
            for (const line of orderSkuLines) {
                const allocation = allocations.find((item) => item.skuCodes?.includes(line.skuCode) || item.colorName === line.color);
                const pieceCount = Number(allocation?.pieceCount ?? piece.count ?? 1);
                if (!Number.isFinite(pieceCount) || pieceCount <= 0)
                    continue;
                upsertRow(rowMap, taskId, dimensions, {
                    PATTERN: pieceName,
                    GARMENT_SKU: line.skuCode,
                }, line.qty * pieceCount, {
                    ...baseRefs,
                    garmentSku: line.skuCode,
                    garmentColor: line.color,
                    patternId: pattern.id,
                    pieceIds: [piece.id],
                }, '片');
            }
        }
    }
}
function buildSkuRows(rowMap, taskId, dimensions, orderSkuLines, baseRefs) {
    for (const line of orderSkuLines) {
        upsertRow(rowMap, taskId, dimensions, { GARMENT_SKU: line.skuCode }, line.qty, {
            ...baseRefs,
            garmentSku: line.skuCode,
            garmentColor: line.color,
        });
    }
}
function buildColorMaterialRows(rowMap, taskId, dimensions, orderSkuLines, materials, baseRefs) {
    const colors = uniqueStable(orderSkuLines.map((line) => line.color));
    for (const color of colors) {
        const colorSkuCodes = orderSkuLines
            .filter((line) => line.color === color)
            .map((line) => line.skuCode);
        for (const material of materials) {
            const matchedSkuCodes = intersectSkuCodes(colorSkuCodes, material.applicableSkuCodes);
            const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes);
            const qty = baseQty * material.consumptionFactor;
            upsertRow(rowMap, taskId, dimensions, {
                GARMENT_COLOR: color,
                MATERIAL_SKU: material.materialName,
            }, qty, {
                ...baseRefs,
                garmentColor: color,
                bomItemId: material.bomItemId,
            });
        }
    }
}
function buildPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs) {
    for (const pattern of patterns) {
        const scopedMaterials = pattern.linkedBomItemId
            ? materials.filter((material) => material.bomItemId === pattern.linkedBomItemId)
            : materials;
        const materialPool = scopedMaterials.length > 0 ? scopedMaterials : materials;
        for (const material of materialPool) {
            const matchedSkuCodes = intersectSkuCodes(pattern.applicableSkuCodes, material.applicableSkuCodes);
            const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes);
            const qty = baseQty * material.consumptionFactor;
            upsertRow(rowMap, taskId, dimensions, {
                PATTERN: pattern.patternName,
                MATERIAL_SKU: material.materialName,
            }, qty, {
                ...baseRefs,
                patternId: pattern.patternId,
                pieceIds: pattern.pieceIds,
                bomItemId: material.bomItemId,
            });
        }
    }
}
function buildColorPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs) {
    const colors = uniqueStable(orderSkuLines.map((line) => line.color));
    for (const color of colors) {
        const colorSkuCodes = orderSkuLines
            .filter((line) => line.color === color)
            .map((line) => line.skuCode);
        for (const pattern of patterns) {
            const scopedMaterials = pattern.linkedBomItemId
                ? materials.filter((material) => material.bomItemId === pattern.linkedBomItemId)
                : materials;
            const materialPool = scopedMaterials.length > 0 ? scopedMaterials : materials;
            for (const material of materialPool) {
                const matchedSkuCodes = intersectSkuCodes(colorSkuCodes, intersectSkuCodes(pattern.applicableSkuCodes, material.applicableSkuCodes));
                const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes);
                const qty = baseQty * material.consumptionFactor;
                upsertRow(rowMap, taskId, dimensions, {
                    GARMENT_COLOR: color,
                    PATTERN: pattern.patternName,
                    MATERIAL_SKU: material.materialName,
                }, qty, {
                    ...baseRefs,
                    garmentColor: color,
                    patternId: pattern.patternId,
                    pieceIds: pattern.pieceIds,
                    bomItemId: material.bomItemId,
                });
            }
        }
    }
}
function normalizeDimensions(dimensions) {
    const unique = uniqueStable(dimensions);
    if (unique.length === 0)
        return [];
    return [...unique].sort((a, b) => DIMENSION_PRIORITY.indexOf(a) - DIMENSION_PRIORITY.indexOf(b));
}
export function generateTaskDetailRowsForArtifact(input) {
    const { taskId, artifact } = input;
    const order = productionOrders.find((item) => item.productionOrderId === artifact.orderId);
    if (!order)
        return [];
    const techPack = getProductionOrderTechPackSnapshot(order.productionOrderId);
    if (!techPack)
        return [];
    const orderSkuLines = resolveOrderSkuLines(artifact.orderId);
    if (!orderSkuLines.length)
        return [];
    const orderSkuCodes = orderSkuLines.map((line) => line.skuCode);
    const dimensions = normalizeDimensions(artifact.detailSplitDimensions && artifact.detailSplitDimensions.length > 0
        ? artifact.detailSplitDimensions
        : fallbackDimensionsByGranularity(artifact.assignmentGranularity));
    const materials = resolveMaterialCandidates(techPack.bomItems, artifact.processCode, orderSkuCodes);
    const patterns = resolvePatternCandidates(techPack.patternFiles, orderSkuCodes);
    const rowMap = new Map();
    const baseRefs = {
        orderId: artifact.orderId,
        spuCode: techPack.styleCode,
        processCode: artifact.processCode,
        craftCode: artifact.craftCode,
        sourceEntryId: artifact.sourceEntryId,
    };
    const hasColor = dimensions.includes('GARMENT_COLOR');
    const hasSku = dimensions.includes('GARMENT_SKU');
    const hasPattern = dimensions.includes('PATTERN');
    const hasMaterial = dimensions.includes('MATERIAL_SKU');
    if (artifact.processCode === 'WOOL') {
        buildWoolRows({
            rowMap,
            taskId,
            dimensions: isPartWoolArtifact(artifact) ? ['PATTERN', 'GARMENT_SKU'] : ['GARMENT_SKU'],
            orderSkuLines,
            patterns: techPack.patternFiles,
            artifact,
            baseRefs,
        });
    }
    else if (hasSku && dimensions.length === 1) {
        buildSkuRows(rowMap, taskId, dimensions, orderSkuLines, baseRefs);
    }
    else if (hasColor && hasPattern && hasMaterial) {
        buildColorPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs);
    }
    else if (hasPattern && hasMaterial) {
        buildPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs);
    }
    else if (hasColor && hasMaterial) {
        buildColorMaterialRows(rowMap, taskId, dimensions, orderSkuLines, materials, baseRefs);
    }
    else {
        buildSkuRows(rowMap, taskId, ['GARMENT_SKU'], orderSkuLines, baseRefs);
    }
    return [...rowMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
export function formatTaskDetailDimensionsText(row) {
    const dimensions = Object.entries(row.dimensions)
        .filter((entry) => Boolean(entry[1]))
        .sort((a, b) => DIMENSION_PRIORITY.indexOf(a[0]) - DIMENSION_PRIORITY.indexOf(b[0]));
    if (dimensions.length === 0)
        return '-';
    return dimensions
        .map(([key, value]) => `${DETAIL_SPLIT_DIMENSION_LABEL[key]}：${value}`)
        .join('；');
}
export function summarizeTaskDetailRows(rows, previewCount = 2) {
    const count = rows.length;
    const totalQty = roundQty(rows.reduce((sum, row) => sum + row.qty, 0));
    const previewText = rows
        .slice(0, previewCount)
        .map((row) => `${row.rowLabel} × ${formatQty(row.qty)}${row.uom}`)
        .join('；');
    return {
        count,
        totalQty,
        previewText,
    };
}
export function getDetailSplitModeLabel(mode) {
    return mode === 'COMPOSITE' ? '组合维度' : mode;
}
