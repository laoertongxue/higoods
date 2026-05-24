import { getProductionOrderTechPackSnapshot } from '../../data/fcs/production-order-tech-pack-runtime.ts';
const mappingStatusLabelMap = {
    MATCHED: '已匹配',
    MISSING_TECH_PACK: '未关联技术资料',
    MISSING_SKU: '未匹配 SKU',
    MISSING_COLOR_MAPPING: '缺少颜色映射',
    MISSING_PIECE_MAPPING: '缺少裁片映射',
    MATERIAL_PENDING_CONFIRM: '面料待确认',
    SKU_SCOPE_PENDING: '待补承接范围',
};
export const productionPieceTruthCompletionMetaMap = {
    COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
    IN_PROGRESS: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
    DATA_PENDING: { label: '数据待补', className: 'bg-slate-100 text-slate-700' },
    HAS_EXCEPTION: { label: '有异常', className: 'bg-rose-100 text-rose-700' },
};
function normalizeText(value) {
    return String(value || '').trim();
}
function normalizeKey(value) {
    return normalizeText(value).toLowerCase();
}
function equalsLoose(left, right) {
    const normalizedLeft = normalizeKey(left);
    const normalizedRight = normalizeKey(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
function uniqueStrings(values) {
    return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}
function makeSkuKey(line) {
    const skuCode = normalizeKey(line.skuCode);
    if (skuCode)
        return `sku:${skuCode}`;
    return `color-size:${normalizeKey(line.color)}:${normalizeKey(line.size)}`;
}
function makePieceKey(line) {
    return [
        normalizeKey(line.cutOrderNo),
        normalizeKey(line.materialSku),
        normalizeKey(line.skuCode),
        normalizeKey(line.color),
        normalizeKey(line.size),
        normalizeKey(line.partCode || line.partName),
    ].join('::');
}
function makeCutOrderMaterialKey(line) {
    return [
        normalizeKey(line.cutOrderNo),
        normalizeKey(line.materialSku),
        normalizeKey(line.skuCode),
        normalizeKey(line.color),
        normalizeKey(line.size),
    ].join('::');
}
function getCutOrderIdentity(materialLine) {
    return {
        cutOrderId: normalizeText(materialLine.cutOrderId),
        cutOrderNo: normalizeText(materialLine.cutOrderNo),
    };
}
function getMarkerPlanRefIdentity(materialLine) {
    return {
        markerPlanId: normalizeText(materialLine.markerPlanId),
        markerPlanNo: normalizeText(materialLine.markerPlanNo),
    };
}
function lineMatchesMaterial(line, materialSku) {
    return equalsLoose(line.materialCode, materialSku) || equalsLoose(line.materialName, materialSku);
}
function resolveSkuCode(techPack, line) {
    const normalizedSkuCode = normalizeText(line.skuCode);
    if (normalizedSkuCode)
        return normalizedSkuCode;
    const mapping = resolveColorMapping(techPack, line.color);
    const skuCodes = (mapping?.lines || []).flatMap((mappingLine) => mappingLine.applicableSkuCodes || []);
    return skuCodes.find((skuCode) => equalsLoose(skuCode.split('-').pop() || '', line.size) || equalsLoose(skuCode, line.size)) || skuCodes[0] || '';
}
function resolveColorMapping(techPack, color) {
    return ((techPack.colorMaterialMappings || []).find((mapping) => equalsLoose(mapping.colorName, color) || equalsLoose(mapping.colorCode, color)) || null);
}
function buildPatternFallbackRows(techPack, mappingLine, skuCode) {
    if (!mappingLine.patternId)
        return [];
    const patternFile = techPack.patternFiles.find((pattern) => pattern.id === mappingLine.patternId);
    if (!patternFile?.pieceRows?.length)
        return [];
    return patternFile.pieceRows
        .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || pieceRow.applicableSkuCodes?.includes(skuCode))
        .map((pieceRow) => ({
        partCode: pieceRow.id || '',
        partName: pieceRow.name,
        pieceCountPerUnit: Number(pieceRow.count || 0),
        patternId: patternFile.id,
        patternName: mappingLine.patternName || patternFile.fileName || '',
    }))
        .filter((pieceRow) => pieceRow.partName && pieceRow.pieceCountPerUnit > 0);
}
function pushIssue(bucket, options) {
    const issueId = [
        options.issueType,
        options.productionOrderNo,
        options.cutOrderNo,
        options.materialSku,
        options.skuCode,
        options.color,
        options.size,
        options.partCode || options.partName,
        options.message,
    ]
        .map((value) => normalizeKey(value))
        .filter(Boolean)
        .join('::');
    if (bucket.some((item) => item.issueId === issueId))
        return;
    bucket.push({
        issueId,
        issueType: options.issueType,
        level: options.issueType === 'MAPPING_MISSING' ? 'mapping' : 'data',
        message: options.message,
        productionOrderId: options.productionOrderId,
        productionOrderNo: options.productionOrderNo,
        cutOrderId: options.cutOrderId || '',
        cutOrderNo: options.cutOrderNo || '',
        markerPlanId: options.markerPlanId || '',
        markerPlanNo: options.markerPlanNo || '',
        materialSku: options.materialSku || '',
        skuCode: options.skuCode || '',
        color: options.color || '',
        size: options.size || '',
        partCode: options.partCode || '',
        partName: options.partName || '',
    });
}
export function resolveTechPackForProduction(record) {
    const techPack = getProductionOrderTechPackSnapshot(record.productionOrderId);
    if (techPack) {
        return {
            status: 'MATCHED',
            resolvedSpuCode: normalizeText(record.techPackSpuCode) || normalizeText(record.spuCode) || techPack.styleCode,
            sourceKey: normalizeText(record.techPackSpuCode) ? 'record-tech-pack' : 'record-spu',
            techPack,
        };
    }
    return {
        status: 'MISSING',
        resolvedSpuCode: normalizeText(record.techPackSpuCode) || normalizeText(record.spuCode),
        sourceKey: 'missing',
        techPack: null,
    };
}
export function buildProductionSkuRequirements(record) {
    return (record.skuRequirementLines || [])
        .filter((line) => Number(line.plannedQty || 0) > 0)
        .map((line) => ({
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        skuCode: normalizeText(line.skuCode),
        color: normalizeText(line.color),
        size: normalizeText(line.size),
        plannedQty: Number(line.plannedQty || 0),
        techPackSpuCode: normalizeText(record.techPackSpuCode) || normalizeText(record.spuCode),
    }));
}
export function buildCutOrderSkuScopes(record) {
    const rows = [];
    record.materialLines.forEach((materialLine) => {
        const cutOrderIdentity = getCutOrderIdentity(materialLine);
        const mergeIdentity = getMarkerPlanRefIdentity(materialLine);
        (materialLine.skuScopeLines || [])
            .filter((scopeLine) => Number(scopeLine.plannedQty || 0) > 0)
            .forEach((scopeLine) => {
            rows.push({
                cutOrderId: cutOrderIdentity.cutOrderId,
                cutOrderNo: cutOrderIdentity.cutOrderNo,
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
                materialSku: normalizeText(materialLine.materialSku),
                skuCode: normalizeText(scopeLine.skuCode),
                color: normalizeText(scopeLine.color),
                size: normalizeText(scopeLine.size),
                plannedQty: Number(scopeLine.plannedQty || 0),
                markerPlanId: mergeIdentity.markerPlanId,
                markerPlanNo: mergeIdentity.markerPlanNo,
            });
        });
    });
    return rows;
}
export function buildPieceRequirementRows(record, requirements, scopes, techPackLink) {
    const rows = [];
    const materialLineByKey = new Map(record.materialLines.map((materialLine) => [makeCutOrderMaterialKey({
            cutOrderNo: getCutOrderIdentity(materialLine).cutOrderNo,
            materialSku: materialLine.materialSku,
        }), materialLine]));
    scopes.forEach((scope) => {
        const requiredGarmentQty = Number(scope.plannedQty || 0);
        const materialLine = materialLineByKey.get(makeCutOrderMaterialKey({
            cutOrderNo: scope.cutOrderNo,
            materialSku: scope.materialSku,
        })) || null;
        const pushMissingRow = (mappingStatus, options) => {
            const pieceCountPerUnit = Number(options?.pieceCountPerUnit || 0);
            rows.push({
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
                cutOrderId: scope.cutOrderId,
                cutOrderNo: scope.cutOrderNo,
                markerPlanId: scope.markerPlanId,
                markerPlanNo: scope.markerPlanNo,
                materialSku: scope.materialSku,
                skuCode: options?.skuCode || scope.skuCode,
                color: scope.color,
                size: scope.size,
                partCode: options?.partCode || '',
                partName: options?.partName || '待确认',
                pieceCountPerUnit,
                requiredGarmentQty,
                requiredPieceQty: requiredGarmentQty * pieceCountPerUnit,
                mappingStatus,
                mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
                techPackSpuCode: techPackLink.resolvedSpuCode,
                patternId: options?.patternId || '',
                patternName: options?.patternName || '',
            });
        };
        if (!techPackLink.techPack) {
            pushMissingRow('MISSING_TECH_PACK');
            return;
        }
        const skuCode = resolveSkuCode(techPackLink.techPack, {
            skuCode: scope.skuCode,
            color: scope.color,
            size: scope.size,
            plannedQty: scope.plannedQty,
        });
        if (!skuCode) {
            pushMissingRow('MISSING_SKU');
            return;
        }
        const colorMapping = resolveColorMapping(techPackLink.techPack, scope.color);
        if (!colorMapping) {
            pushMissingRow('MISSING_COLOR_MAPPING', { skuCode });
            return;
        }
        const candidateLines = colorMapping.lines.filter((line) => line.materialType === '面料' &&
            (!(line.applicableSkuCodes || []).length || line.applicableSkuCodes?.includes(skuCode)));
        if (!candidateLines.length) {
            pushMissingRow('MISSING_PIECE_MAPPING', { skuCode });
            return;
        }
        const matchedMaterialLines = materialLine
            ? candidateLines.filter((line) => lineMatchesMaterial(line, materialLine.materialSku))
            : [];
        const selectedLines = matchedMaterialLines.length ? matchedMaterialLines : candidateLines;
        const mappingStatus = matchedMaterialLines.length ? 'MATCHED' : 'MATERIAL_PENDING_CONFIRM';
        selectedLines.forEach((mappingLine) => {
            const pieceRows = mappingLine.pieceName && Number(mappingLine.pieceCountPerUnit || 0) > 0
                ? [
                    {
                        partCode: mappingLine.pieceId || '',
                        partName: mappingLine.pieceName,
                        pieceCountPerUnit: Number(mappingLine.pieceCountPerUnit || 0),
                        patternId: mappingLine.patternId || '',
                        patternName: mappingLine.patternName || '',
                    },
                ]
                : buildPatternFallbackRows(techPackLink.techPack, mappingLine, skuCode);
            if (!pieceRows.length) {
                pushMissingRow('MISSING_PIECE_MAPPING', {
                    skuCode,
                    patternId: mappingLine.patternId || '',
                    patternName: mappingLine.patternName || '',
                });
                return;
            }
            pieceRows.forEach((pieceRow) => {
                rows.push({
                    productionOrderId: record.productionOrderId,
                    productionOrderNo: record.productionOrderNo,
                    cutOrderId: scope.cutOrderId,
                    cutOrderNo: scope.cutOrderNo,
                    markerPlanId: scope.markerPlanId,
                    markerPlanNo: scope.markerPlanNo,
                    materialSku: scope.materialSku,
                    skuCode,
                    color: scope.color,
                    size: scope.size,
                    partCode: pieceRow.partCode,
                    partName: pieceRow.partName,
                    pieceCountPerUnit: pieceRow.pieceCountPerUnit,
                    requiredGarmentQty,
                    requiredPieceQty: requiredGarmentQty * pieceRow.pieceCountPerUnit,
                    mappingStatus,
                    mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
                    techPackSpuCode: techPackLink.resolvedSpuCode,
                    patternId: pieceRow.patternId,
                    patternName: pieceRow.patternName,
                });
            });
        });
    });
    requirements.forEach((requirement) => {
        const scopedQty = scopes
            .filter((scope) => makeSkuKey(scope) === makeSkuKey(requirement))
            .reduce((sum, scope) => sum + Number(scope.plannedQty || 0), 0);
        if (scopedQty !== Number(requirement.plannedQty || 0)) {
            rows.push({
                productionOrderId: requirement.productionOrderId,
                productionOrderNo: requirement.productionOrderNo,
                cutOrderId: '',
                cutOrderNo: '',
                markerPlanId: '',
                markerPlanNo: '',
                materialSku: '',
                skuCode: requirement.skuCode,
                color: requirement.color,
                size: requirement.size,
                partCode: '',
                partName: '待补承接范围',
                pieceCountPerUnit: 0,
                requiredGarmentQty: Number(requirement.plannedQty || 0),
                requiredPieceQty: 0,
                mappingStatus: 'SKU_SCOPE_PENDING',
                mappingStatusLabel: mappingStatusLabelMap.SKU_SCOPE_PENDING,
                techPackSpuCode: requirement.techPackSpuCode,
                patternId: '',
                patternName: '',
            });
        }
    });
    return rows;
}
export function buildPieceActualRows(record, requirementRows, overlaySignals = []) {
    const grouped = new Map();
    record.materialLines.forEach((materialLine) => {
        const cutOrderIdentity = getCutOrderIdentity(materialLine);
        const mergeIdentity = getMarkerPlanRefIdentity(materialLine);
        (materialLine.pieceProgressLines || []).forEach((pieceLine) => {
            const key = makePieceKey({
                cutOrderNo: cutOrderIdentity.cutOrderNo,
                materialSku: materialLine.materialSku,
                skuCode: pieceLine.skuCode,
                color: pieceLine.color,
                size: pieceLine.size,
                partCode: pieceLine.partCode || '',
                partName: pieceLine.partName,
            });
            const current = grouped.get(key);
            grouped.set(key, {
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
                cutOrderId: cutOrderIdentity.cutOrderId,
                cutOrderNo: cutOrderIdentity.cutOrderNo,
                markerPlanId: mergeIdentity.markerPlanId,
                markerPlanNo: mergeIdentity.markerPlanNo,
                materialSku: normalizeText(materialLine.materialSku),
                skuCode: normalizeText(pieceLine.skuCode),
                color: normalizeText(pieceLine.color),
                size: normalizeText(pieceLine.size),
                partCode: normalizeText(pieceLine.partCode),
                partName: normalizeText(pieceLine.partName),
                actualCutQty: (current?.actualCutQty || 0) + Number(pieceLine.actualCutQty || 0),
                inboundQty: (current?.inboundQty || 0) + Number(pieceLine.inboundQty || 0),
                sourceType: 'PIECE_PROGRESS',
                latestUpdatedAt: [current?.latestUpdatedAt, pieceLine.latestUpdatedAt].filter(Boolean).sort().at(-1) || '',
                latestOperatorName: pieceLine.latestOperatorName || current?.latestOperatorName || '',
            });
        });
    });
    const overlayByCutOrderMaterialSku = overlaySignals.reduce((result, signal) => {
        const key = makeCutOrderMaterialKey({
            cutOrderNo: signal.cutOrderNo,
            materialSku: signal.materialSku,
            skuCode: '',
            color: '',
            size: '',
        });
        result[key] = [...(result[key] || []), signal];
        return result;
    }, {});
    requirementRows
        .filter((row) => row.cutOrderNo && row.materialSku)
        .forEach((row) => {
        const pieceKey = makePieceKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
        });
        if (grouped.has(pieceKey))
            return;
        const overlayKey = makeCutOrderMaterialKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
        });
        const overlay = (overlayByCutOrderMaterialSku[overlayKey] || [])
            .slice()
            .sort((left, right) => right.latestUpdatedAt.localeCompare(left.latestUpdatedAt, 'zh-CN'))[0];
        if (!overlay)
            return;
        grouped.set(pieceKey, {
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            markerPlanId: row.markerPlanId,
            markerPlanNo: row.markerPlanNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
            actualCutQty: 0,
            inboundQty: 0,
            sourceType: 'OVERLAY_SIGNAL',
            latestUpdatedAt: overlay.latestUpdatedAt,
            latestOperatorName: overlay.latestOperatorName,
        });
    });
    return Array.from(grouped.values());
}
function buildGapStateRow(row, actual, record, materialLine, overlaySignals) {
    if (row.mappingStatus !== 'MATCHED') {
        return {
            currentStateLabel: row.mappingStatusLabel,
            nextActionLabel: row.mappingStatus === 'SKU_SCOPE_PENDING' ? '去裁片单补承接范围' : '去裁片单补映射',
        };
    }
    const overlayKey = makeCutOrderMaterialKey({
        cutOrderNo: row.cutOrderNo,
        materialSku: row.materialSku,
    });
    const relatedSignals = overlaySignals.filter((signal) => makeCutOrderMaterialKey({
        cutOrderNo: signal.cutOrderNo,
        materialSku: signal.materialSku,
    }) === overlayKey);
    const hasInboundSignal = relatedSignals.some((signal) => signal.sourceType === 'INBOUND');
    const hasHandoverSignal = relatedSignals.some((signal) => signal.sourceType === 'HANDOVER');
    const hasReplenishmentSignal = relatedSignals.some((signal) => signal.sourceType === 'REPLENISHMENT');
    const actualCutQty = Number(actual?.actualCutQty || 0);
    const inboundQty = Number(actual?.inboundQty || 0);
    const gapCutQty = Math.max(row.requiredPieceQty - actualCutQty, 0);
    const gapInboundQty = Math.max(row.requiredPieceQty - inboundQty, 0);
    if (gapCutQty > 0) {
        if (materialLine?.configStatus !== 'CONFIGURED' || materialLine?.receiveStatus !== 'RECEIVED') {
            return { currentStateLabel: '待WMS领料入仓', nextActionLabel: '去待加工仓' };
        }
        if (materialLine?.issueFlags.includes('REPLENISH_PENDING') || record.riskFlags.includes('REPLENISH_PENDING') || hasReplenishmentSignal) {
            return { currentStateLabel: '待补料', nextActionLabel: '去补料管理' };
        }
        if (!record.hasSpreadingRecord) {
            return { currentStateLabel: '待铺布', nextActionLabel: '去唛架铺布' };
        }
        return { currentStateLabel: '裁片未齐', nextActionLabel: '去唛架铺布' };
    }
    if (gapInboundQty > 0) {
        return { currentStateLabel: hasInboundSignal ? '入仓数据待补' : '裁完待入仓', nextActionLabel: '去裁片仓' };
    }
    if (hasHandoverSignal) {
        return { currentStateLabel: '已交接', nextActionLabel: '当前已齐套' };
    }
    return { currentStateLabel: '已齐套', nextActionLabel: '当前已齐套' };
}
export function buildPieceGapRows(record, requirementRows, actualRows, overlaySignals = []) {
    const actualRowMap = new Map(actualRows.map((row) => [
        makePieceKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
        }),
        row,
    ]));
    const materialLineMap = new Map(record.materialLines.map((materialLine) => [
        makeCutOrderMaterialKey({
            cutOrderNo: getCutOrderIdentity(materialLine).cutOrderNo,
            materialSku: materialLine.materialSku,
        }),
        materialLine,
    ]));
    return requirementRows.map((row) => {
        const actual = actualRowMap.get(makePieceKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
        }));
        const materialLine = materialLineMap.get(makeCutOrderMaterialKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
        })) || undefined;
        const actualCutQty = Number(actual?.actualCutQty || 0);
        const inboundQty = Number(actual?.inboundQty || 0);
        const gapCutQty = Math.max(row.requiredPieceQty - actualCutQty, 0);
        const gapInboundQty = Math.max(row.requiredPieceQty - inboundQty, 0);
        const state = buildGapStateRow(row, actual, record, materialLine, overlaySignals);
        return {
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            markerPlanId: row.markerPlanId,
            markerPlanNo: row.markerPlanNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
            requiredPieceQty: row.requiredPieceQty,
            actualCutQty,
            inboundQty,
            gapCutQty,
            gapInboundQty,
            mappingStatus: row.mappingStatus,
            mappingStatusLabel: row.mappingStatusLabel,
            currentStateLabel: state.currentStateLabel,
            nextActionLabel: state.nextActionLabel,
            latestUpdatedAt: actual?.latestUpdatedAt || '',
            latestOperatorName: actual?.latestOperatorName || '',
            pieceCountPerUnit: row.pieceCountPerUnit,
            requiredGarmentQty: row.requiredGarmentQty,
            techPackSpuCode: row.techPackSpuCode,
            patternId: row.patternId,
            patternName: row.patternName,
        };
    });
}
function buildSkuRows(gapRows) {
    const grouped = new Map();
    gapRows.forEach((row) => {
        const key = makeSkuKey(row);
        const current = grouped.get(key);
        const nextCutOrderNos = new Set([...(current?.cutOrderNos || []), row.cutOrderNo].filter(Boolean));
        const nextMaterialSkus = new Set([...(current?.materialSkus || []), row.materialSku].filter(Boolean));
        const mappingStatus = current?.mappingStatus && current.mappingStatus !== 'MATCHED' ? current.mappingStatus : row.mappingStatus;
        const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty;
        const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty;
        const currentStateLabel = mappingStatus !== 'MATCHED'
            ? row.mappingStatusLabel
            : gapCutQty > 0
                ? '未裁齐'
                : gapInboundQty > 0
                    ? '待入仓'
                    : '已齐套';
        const nextActionLabel = mappingStatus !== 'MATCHED'
            ? '去裁片单补映射'
            : gapCutQty > 0
                ? row.nextActionLabel
                : gapInboundQty > 0
                    ? '去裁片仓'
                    : '当前已齐套';
        grouped.set(key, {
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            requiredGarmentQty: (current?.requiredGarmentQty || 0) + row.requiredGarmentQty,
            requiredPieceQty: (current?.requiredPieceQty || 0) + row.requiredPieceQty,
            actualCutQty: (current?.actualCutQty || 0) + row.actualCutQty,
            inboundQty: (current?.inboundQty || 0) + row.inboundQty,
            gapCutQty,
            gapInboundQty,
            cutOrderCount: nextCutOrderNos.size,
            materialCount: nextMaterialSkus.size,
            mappingStatus,
            mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
            currentStateLabel,
            nextActionLabel,
            cutOrderNos: nextCutOrderNos,
            materialSkus: nextMaterialSkus,
        });
    });
    return Array.from(grouped.values()).map(({ cutOrderNos, materialSkus, ...row }) => row);
}
function buildCutOrderRows(gapRows) {
    const grouped = new Map();
    gapRows.forEach((row) => {
        if (!row.cutOrderNo)
            return;
        const key = `${row.cutOrderNo}::${row.materialSku}`;
        const current = grouped.get(key);
        const gapPartCount = (current?.gapPartCount || 0) + (row.gapCutQty > 0 || row.gapInboundQty > 0 || row.mappingStatus !== 'MATCHED' ? 1 : 0);
        const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty;
        const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty;
        const currentStateLabel = row.mappingStatus !== 'MATCHED'
            ? row.mappingStatusLabel
            : gapCutQty > 0
                ? '未裁齐'
                : gapInboundQty > 0
                    ? '待入仓'
                    : '已齐套';
        const nextActionLabel = row.mappingStatus !== 'MATCHED'
            ? '去裁片单补映射'
            : gapCutQty > 0
                ? row.nextActionLabel
                : gapInboundQty > 0
                    ? '去裁片仓'
                    : '当前已齐套';
        const nextSkuKeys = new Set([...(current?.skuKeys || []), row.skuCode || `${row.color}/${row.size}`].filter(Boolean));
        grouped.set(key, {
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            markerPlanId: row.markerPlanId,
            markerPlanNo: row.markerPlanNo,
            materialSku: row.materialSku,
            skuCount: nextSkuKeys.size,
            gapPartCount,
            gapCutQty,
            gapInboundQty,
            currentStateLabel,
            nextActionLabel,
            skuKeys: nextSkuKeys,
        });
    });
    return Array.from(grouped.values())
        .map(({ skuKeys, ...row }) => row)
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN'));
}
function buildMaterialRows(gapRows) {
    const grouped = new Map();
    gapRows.forEach((row) => {
        const key = row.materialSku || `${row.cutOrderNo}-unknown-material`;
        const current = grouped.get(key);
        const gapPartCount = (current?.gapPartCount || 0) + (row.gapCutQty > 0 || row.gapInboundQty > 0 || row.mappingStatus !== 'MATCHED' ? 1 : 0);
        const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty;
        const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty;
        const currentStateLabel = row.mappingStatus !== 'MATCHED'
            ? row.mappingStatusLabel
            : gapCutQty > 0
                ? '未裁齐'
                : gapInboundQty > 0
                    ? '待入仓'
                    : '已齐套';
        const nextActionLabel = row.mappingStatus !== 'MATCHED'
            ? '去裁片单补映射'
            : gapCutQty > 0
                ? row.nextActionLabel
                : gapInboundQty > 0
                    ? '去裁片仓'
                    : '当前已齐套';
        const nextCutOrderNos = new Set([...(current?.cutOrderNos || []), row.cutOrderNo].filter(Boolean));
        const nextSkuKeys = new Set([...(current?.skuKeys || []), row.skuCode || `${row.color}/${row.size}`].filter(Boolean));
        grouped.set(key, {
            materialSku: row.materialSku || '待补面料 SKU',
            cutOrderCount: nextCutOrderNos.size,
            skuCount: nextSkuKeys.size,
            gapPartCount,
            gapCutQty,
            gapInboundQty,
            currentStateLabel,
            nextActionLabel,
            cutOrderNos: nextCutOrderNos,
            skuKeys: nextSkuKeys,
        });
    });
    return Array.from(grouped.values())
        .map(({ cutOrderNos, skuKeys, ...row }) => row)
        .sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'));
}
export function buildProductionPieceTruthCompletion(result, options = {}) {
    if (result.dataIssues.length > 0 || options.hasObjectDataPending) {
        const meta = productionPieceTruthCompletionMetaMap.DATA_PENDING;
        return {
            key: 'DATA_PENDING',
            label: meta.label,
            className: meta.className,
            detailText: options.objectDataPendingReason ||
                result.dataIssues[0]?.message ||
                `数据待补 ${result.dataIssues.length} 项`,
        };
    }
    if (result.mappingIssues.length > 0) {
        const meta = productionPieceTruthCompletionMetaMap.DATA_PENDING;
        return {
            key: 'DATA_PENDING',
            label: meta.label,
            className: meta.className,
            detailText: result.mappingIssues[0]?.message || `映射缺失 ${result.mappingIssues.length} 项`,
        };
    }
    if (options.hasObjectException) {
        const meta = productionPieceTruthCompletionMetaMap.HAS_EXCEPTION;
        return {
            key: 'HAS_EXCEPTION',
            label: meta.label,
            className: meta.className,
            detailText: options.objectExceptionReason || '当前存在异常对象，暂不可判完成。',
        };
    }
    if (result.counts.gapCutQtyTotal > 0 ||
        result.counts.gapInboundQtyTotal > 0 ||
        result.counts.pendingSkuCount > 0 ||
        options.hasObjectPending) {
        const meta = productionPieceTruthCompletionMetaMap.IN_PROGRESS;
        const detailText = options.objectPendingReason ||
            (result.counts.gapCutQtyTotal > 0
                ? `仍缺裁片 ${result.counts.gapCutQtyTotal} 片`
                : result.counts.gapInboundQtyTotal > 0
                    ? `待入仓 ${result.counts.gapInboundQtyTotal} 片`
                    : `未完成 SKU ${result.counts.pendingSkuCount} 个`);
        return {
            key: 'IN_PROGRESS',
            label: meta.label,
            className: meta.className,
            detailText,
        };
    }
    const meta = productionPieceTruthCompletionMetaMap.COMPLETED;
    return {
        key: 'COMPLETED',
        label: meta.label,
        className: meta.className,
        detailText: 'SKU 与部位已齐套，当前可判完成。',
    };
}
function buildNextActionLabel(result) {
    if (result.mappingIssues.length > 0)
        return '去裁片单补映射';
    if (result.dataIssues.length > 0)
        return '去生产单进度补数据';
    const priorityRow = result.gapRows.find((row) => row.mappingStatus !== 'MATCHED') ||
        result.gapRows.find((row) => row.gapCutQty > 0) ||
        result.gapRows.find((row) => row.gapInboundQty > 0) ||
        null;
    if (priorityRow)
        return priorityRow.nextActionLabel;
    if (result.counts.pendingSkuCount > 0)
        return '继续处理';
    return '当前已齐套';
}
export function buildProductionPieceTruth(record, options = {}) {
    const overlaySignals = options.overlaySignals || [];
    const techPackLink = resolveTechPackForProduction(record);
    const requirements = buildProductionSkuRequirements(record);
    const scopes = buildCutOrderSkuScopes(record);
    const requirementRows = buildPieceRequirementRows(record, requirements, scopes, techPackLink);
    const actualRows = buildPieceActualRows(record, requirementRows, overlaySignals);
    const gapRows = buildPieceGapRows(record, requirementRows, actualRows, overlaySignals);
    const mappingIssues = [];
    const dataIssues = [];
    if (!requirements.length) {
        pushIssue(dataIssues, {
            issueType: 'DATA_PENDING',
            message: '当前生产单缺少 SKU 需求行，无法判断理论应有量。',
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
        });
    }
    if (techPackLink.status === 'MISSING') {
        pushIssue(mappingIssues, {
            issueType: 'MAPPING_MISSING',
            message: '当前生产单未关联技术资料快照，无法构建部位定义。',
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
        });
    }
    requirements.forEach((requirement) => {
        const scopedRows = scopes.filter((scope) => makeSkuKey(scope) === makeSkuKey(requirement));
        const scopedQty = scopedRows.reduce((sum, scope) => sum + Number(scope.plannedQty || 0), 0);
        if (!scopedRows.length || scopedQty !== Number(requirement.plannedQty || 0)) {
            pushIssue(dataIssues, {
                issueType: 'DATA_PENDING',
                message: `${requirement.color}/${requirement.size} 的裁片单承接范围待补齐：需求 ${requirement.plannedQty}，当前承接 ${scopedQty}`,
                productionOrderId: requirement.productionOrderId,
                productionOrderNo: requirement.productionOrderNo,
                skuCode: requirement.skuCode,
                color: requirement.color,
                size: requirement.size,
            });
        }
    });
    requirementRows
        .filter((row) => row.mappingStatus !== 'MATCHED')
        .forEach((row) => {
        pushIssue(mappingIssues, {
            issueType: 'MAPPING_MISSING',
            message: `${row.cutOrderNo || '未定位裁片单'} · ${row.color}/${row.size} · ${row.partName}：${row.mappingStatusLabel}`,
            productionOrderId: row.productionOrderId,
            productionOrderNo: row.productionOrderNo,
            cutOrderId: row.cutOrderId,
            cutOrderNo: row.cutOrderNo,
            markerPlanId: row.markerPlanId,
            markerPlanNo: row.markerPlanNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
        });
    });
    const actualRowKeys = new Set(actualRows.map((row) => makePieceKey({
        cutOrderNo: row.cutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
    })));
    gapRows.forEach((row) => {
        const actualKey = makePieceKey({
            cutOrderNo: row.cutOrderNo,
            materialSku: row.materialSku,
            skuCode: row.skuCode,
            color: row.color,
            size: row.size,
            partCode: row.partCode,
            partName: row.partName,
        });
        const overlayExists = overlaySignals.some((signal) => signal.cutOrderNo === row.cutOrderNo &&
            signal.materialSku === row.materialSku);
        if (!actualRowKeys.has(actualKey) && (record.hasSpreadingRecord || record.hasInboundRecord || overlayExists)) {
            pushIssue(dataIssues, {
                issueType: 'DATA_PENDING',
                message: `${row.cutOrderNo} · ${row.partName} 缺少部位进度，当前无法判断真实产出。`,
                productionOrderId: row.productionOrderId,
                productionOrderNo: row.productionOrderNo,
                cutOrderId: row.cutOrderId,
                cutOrderNo: row.cutOrderNo,
                markerPlanId: row.markerPlanId,
                markerPlanNo: row.markerPlanNo,
                materialSku: row.materialSku,
                skuCode: row.skuCode,
                color: row.color,
                size: row.size,
                partCode: row.partCode,
                partName: row.partName,
            });
        }
    });
    record.materialLines.forEach((materialLine) => {
        const cutOrderIdentity = getCutOrderIdentity(materialLine);
        const mergeIdentity = getMarkerPlanRefIdentity(materialLine);
        if (mergeIdentity.markerPlanNo && !mergeIdentity.markerPlanId) {
            pushIssue(dataIssues, {
                issueType: 'DATA_PENDING',
                message: `${cutOrderIdentity.cutOrderNo} 已挂唛架方案号 ${mergeIdentity.markerPlanNo}，但缺少 markerPlanId。`,
                productionOrderId: record.productionOrderId,
                productionOrderNo: record.productionOrderNo,
                cutOrderId: cutOrderIdentity.cutOrderId,
                cutOrderNo: cutOrderIdentity.cutOrderNo,
                markerPlanNo: mergeIdentity.markerPlanNo,
                materialSku: materialLine.materialSku,
            });
        }
    });
    const skuRows = buildSkuRows(gapRows);
    const cutOrderRows = buildCutOrderRows(gapRows);
    const materialRows = buildMaterialRows(gapRows);
    const counts = {
        skuTotalCount: skuRows.length,
        completedSkuCount: skuRows.filter((row) => row.mappingStatus === 'MATCHED' && row.gapCutQty === 0 && row.gapInboundQty === 0).length,
        pendingSkuCount: skuRows.filter((row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0).length,
        incompletePartCount: gapRows.filter((row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0).length,
        affectedMaterialCount: materialRows.filter((row) => row.gapPartCount > 0).length,
        cutOrderCount: cutOrderRows.length,
        mappingIssueCount: mappingIssues.length,
        dataIssueCount: dataIssues.length,
        requiredPieceQtyTotal: gapRows.reduce((sum, row) => sum + row.requiredPieceQty, 0),
        actualCutQtyTotal: gapRows.reduce((sum, row) => sum + row.actualCutQty, 0),
        inboundQtyTotal: gapRows.reduce((sum, row) => sum + row.inboundQty, 0),
        gapCutQtyTotal: gapRows.reduce((sum, row) => sum + row.gapCutQty, 0),
        gapInboundQtyTotal: gapRows.reduce((sum, row) => sum + row.gapInboundQty, 0),
    };
    const provisionalResult = {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        requirementRows,
        actualRows,
        gapRows,
        skuRows,
        cutOrderRows,
        materialRows,
        mappingIssues,
        dataIssues,
        counts,
    };
    const completionMeta = buildProductionPieceTruthCompletion(provisionalResult, options.completionOptions);
    return {
        ...provisionalResult,
        completionState: completionMeta.key,
        completionLabel: completionMeta.label,
        completionClassName: completionMeta.className,
        completionDetailText: completionMeta.detailText,
        nextActionLabel: buildNextActionLabel(provisionalResult),
        techPackLink,
    };
}
