import { productionOrders, getProductionOrderTechPackSnapshot, } from '../production-orders.ts';
function normalizeText(value) {
    return String(value || '').trim();
}
function slugToken(value) {
    return normalizeText(String(value ?? ''))
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function unique(values) {
    return Array.from(new Set(values));
}
function makeSkuKey(line) {
    return [normalizeText(line.skuCode), normalizeText(line.color), normalizeText(line.size)].join('::');
}
function toCuttingMaterialType(materialType) {
    if (materialType.includes('辅'))
        return 'LINING';
    if (materialType.includes('印'))
        return 'PRINT';
    if (materialType.includes('染'))
        return 'DYE';
    return 'SOLID';
}
function toMaterialCategory(materialType) {
    if (materialType === 'PRINT')
        return '主料';
    if (materialType === 'DYE')
        return '主料';
    if (materialType === 'LINING')
        return '里辅料';
    return '主料';
}
function findBomItem(techPack, line) {
    if (line.bomItemId) {
        const byId = techPack.bomItems.find((item) => item.id === line.bomItemId);
        if (byId)
            return byId;
    }
    if (line.materialName) {
        const byName = techPack.bomItems.find((item) => normalizeText(item.name) === normalizeText(line.materialName));
        if (byName)
            return byName;
    }
    return null;
}
function resolveMaterialSku(techPack, line, bomItem) {
    return normalizeText(line.materialCode) || normalizeText(bomItem?.id) || normalizeText(line.materialName);
}
function findLinkedPatternFiles(techPack, line, bomItem, materialSku) {
    const normalizedSku = normalizeText(materialSku).toLowerCase();
    const normalizedName = normalizeText(line.materialName || bomItem?.name).toLowerCase();
    return techPack.patternFiles.filter((pattern) => {
        const linkedSku = normalizeText(pattern.linkedMaterialSku).toLowerCase();
        const linkedName = normalizeText(pattern.linkedMaterialName).toLowerCase();
        return (pattern.linkedBomItemId === bomItem?.id
            || pattern.linkedMaterialId === bomItem?.id
            || pattern.id === line.patternId
            || (Boolean(normalizedSku) && linkedSku === normalizedSku)
            || (Boolean(normalizedName) && linkedName === normalizedName));
    });
}
function resolveMaterialAlias(techPack, line, bomItem, materialSku) {
    return unique([
        normalizeText(bomItem?.materialAlias),
        ...findLinkedPatternFiles(techPack, line, bomItem, materialSku).map((pattern) => normalizeText(pattern.linkedMaterialAlias)),
        normalizeText(bomItem?.name),
    ].filter(Boolean)).join(' / ');
}
function resolveMaterialImageUrl(techPack, line, bomItem, materialSku) {
    return (normalizeText(bomItem?.materialImageUrl)
        || findLinkedPatternFiles(techPack, line, bomItem, materialSku)
            .map((pattern) => normalizeText(pattern.imageUrl))
            .find(Boolean)
        || techPack.imageSnapshot.materialImages[0]
        || '');
}
function resolvePieceRows(techPack, line, skuCode) {
    const partName = normalizeText(line.pieceName);
    const partCode = normalizeText(line.pieceId) || partName;
    const pieceCountPerUnit = Number(line.pieceCountPerUnit || 0);
    if (partName && pieceCountPerUnit > 0) {
        return [
            {
                partCode,
                partName,
                pieceCountPerUnit,
                patternId: normalizeText(line.patternId),
                patternName: normalizeText(line.patternName),
                applicableSkuCodes: normalizeText(skuCode) ? [normalizeText(skuCode)] : [],
            },
        ];
    }
    const patternId = normalizeText(line.patternId);
    if (!patternId)
        return [];
    const patternFile = techPack.patternFiles.find((item) => item.id === patternId);
    if (!patternFile?.pieceRows?.length)
        return [];
    return patternFile.pieceRows
        .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || (skuCode && pieceRow.applicableSkuCodes?.includes(skuCode)))
        .map((pieceRow) => ({
        partCode: normalizeText(pieceRow.id) || normalizeText(pieceRow.name),
        partName: normalizeText(pieceRow.name),
        pieceCountPerUnit: Number(pieceRow.count || 0),
        patternId,
        patternName: normalizeText(line.patternName) || normalizeText(patternFile.fileName),
        applicableSkuCodes: [...(pieceRow.applicableSkuCodes || [])],
    }))
        .filter((pieceRow) => pieceRow.partName && pieceRow.pieceCountPerUnit > 0);
}
function resolvePatternKind(patternFile) {
    return normalizeText(patternFile?.patternMaterialTypeLabel) || '布料纸样';
}
function resolveEffectiveWidthValue(patternFile, materialSku, materialType) {
    const patternWidth = Number(patternFile?.widthCm || 0);
    if (patternWidth > 0)
        return patternWidth;
    if (materialType === 'LINING')
        return 92;
    const sku = materialSku.toLowerCase();
    if (sku.includes('khaki') || sku.includes('canvas') || sku.includes('navy'))
        return 145;
    return 150;
}
function resolvePatternIdentity(techPack, line, bomItem, materialSku, materialType, pieceRows) {
    const linkedPatternFiles = findLinkedPatternFiles(techPack, line, bomItem, materialSku);
    const patternFile = (line.patternId ? techPack.patternFiles.find((item) => item.id === line.patternId || item.patternFileId === line.patternId) : undefined)
        || linkedPatternFiles[0]
        || techPack.patternFiles[0];
    const patternFileId = normalizeText(line.patternId)
        || normalizeText(patternFile?.patternFileId)
        || normalizeText(patternFile?.id)
        || `pattern-${slugToken(line.patternName || materialSku)}`;
    const patternFileName = normalizeText(line.patternName)
        || normalizeText(patternFile?.patternFileName)
        || normalizeText(patternFile?.fileName)
        || `${patternFileId}.dxf`;
    const piecePartCodes = unique(pieceRows.map((row) => row.partCode).filter(Boolean));
    const piecePartNames = unique(pieceRows.map((row) => row.partName).filter(Boolean));
    return {
        patternFileId,
        patternFileName,
        patternVersion: normalizeText(patternFile?.patternVersion) || normalizeText(techPack.sourceTechPackVersionLabel) || 'v1.0',
        patternKind: resolvePatternKind(patternFile),
        effectiveWidthValue: resolveEffectiveWidthValue(patternFile, materialSku, materialType),
        effectiveWidthUnit: 'cm',
        piecePartCodes,
        piecePartNames,
    };
}
function buildGenerationKey(input) {
    return [
        input.productionOrderId,
        input.spuCode,
        input.styleId,
        input.styleCode,
        input.styleName,
        input.techPackVersionId,
        input.materialIdentity.materialSku,
        input.materialIdentity.materialName,
        input.materialIdentity.materialColor,
        input.materialIdentity.materialAlias,
        input.materialIdentity.materialUnit,
        input.patternIdentity.patternFileId,
        input.patternIdentity.patternFileName,
        input.patternIdentity.patternVersion,
        input.patternIdentity.patternKind,
        input.patternIdentity.effectiveWidthValue,
        input.patternIdentity.effectiveWidthUnit,
    ]
        .map((value) => normalizeText(String(value)).toLowerCase())
        .join('::');
}
function makeStableCutOrderId(input) {
    return [
        'cut-order',
        slugToken(input.productionOrderNo),
        slugToken(input.materialIdentity.materialSku),
        slugToken(input.patternIdentity.patternFileId),
        slugToken(input.patternIdentity.patternVersion),
        slugToken(`${input.patternIdentity.effectiveWidthValue}${input.patternIdentity.effectiveWidthUnit}`),
    ]
        .filter(Boolean)
        .join(':');
}
function makeCutOrderNo(order, index) {
    const normalizedDate = order.createdAt.slice(2, 10).replace(/-/g, '');
    const orderSuffix = order.productionOrderId.replace(/\D/g, '').slice(-3).padStart(3, '0');
    return `CUT-${normalizedDate}-${orderSuffix}-${String(index + 1).padStart(2, '0')}`;
}
function resolveProductionOrderNo(order) {
    return normalizeText(order.productionOrderNo) || normalizeText(order.productionOrderId);
}
export function hasFormalTechPackForCutting(order) {
    const snapshot = order.techPackSnapshot;
    if (!snapshot)
        return false;
    if (snapshot.status !== 'RELEASED')
        return false;
    if (!normalizeText(snapshot.sourcePublishedAt))
        return false;
    if (normalizeText(snapshot.sourceTechPackVersionLabel).includes('草稿'))
        return false;
    return true;
}
export function listCuttingProductionOrdersWithFormalTechPack() {
    const formalOrders = productionOrders.filter((order) => hasFormalTechPackForCutting(order));
    const joggerOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode === 'SPU-2024-010');
    const otherOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode !== 'SPU-2024-010');
    return [...joggerOrders, ...otherOrders].slice(0, 16);
}
function buildSkuScopeLines(order) {
    return order.demandSnapshot.skuLines.map((line) => ({
        skuCode: normalizeText(line.skuCode),
        color: normalizeText(line.color),
        size: normalizeText(line.size),
        plannedQty: Number(line.qty || 0),
    }));
}
function buildRecordsForOrder(order) {
    const techPack = getProductionOrderTechPackSnapshot(order.productionOrderId);
    if (!techPack)
        return [];
    const scopeByMaterialKey = new Map();
    const orderedMaterialKeys = [];
    for (const skuLine of order.demandSnapshot.skuLines) {
        const colorMappings = (techPack.colorMaterialMappings || []).filter((mapping) => normalizeText(mapping.colorName).toLowerCase() === normalizeText(skuLine.color).toLowerCase()
            || normalizeText(mapping.colorCode).toLowerCase() === normalizeText(skuLine.color).toLowerCase());
        for (const colorMapping of colorMappings) {
            for (const mappingLine of colorMapping.lines) {
                const applicableSkuCodes = mappingLine.applicableSkuCodes || [];
                if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(skuLine.skuCode))
                    continue;
                const bomItem = findBomItem(techPack, mappingLine);
                const materialSku = resolveMaterialSku(techPack, mappingLine, bomItem);
                if (!materialSku)
                    continue;
                const materialType = toCuttingMaterialType(mappingLine.materialType);
                const materialName = normalizeText(mappingLine.materialName) || materialSku;
                const materialColor = normalizeText(skuLine.color) || '待补颜色';
                const materialUnit = normalizeText(mappingLine.unit) || '米';
                const materialAlias = resolveMaterialAlias(techPack, mappingLine, bomItem, materialSku);
                const materialImageUrl = resolveMaterialImageUrl(techPack, mappingLine, bomItem, materialSku);
                const pieceRows = resolvePieceRows(techPack, mappingLine, skuLine.skuCode);
                const materialIdentity = {
                    materialSku,
                    materialName,
                    materialColor,
                    materialAlias: materialAlias || materialName,
                    materialImageUrl,
                    materialUnit,
                };
                const patternIdentity = resolvePatternIdentity(techPack, mappingLine, bomItem, materialSku, materialType, pieceRows);
                const generationKey = buildGenerationKey({
                    productionOrderId: order.productionOrderId,
                    spuCode: order.demandSnapshot.spuCode,
                    styleId: normalizeText(techPack.styleId),
                    styleCode: normalizeText(techPack.styleCode) || order.demandSnapshot.spuCode,
                    styleName: normalizeText(techPack.styleName) || order.demandSnapshot.spuName,
                    techPackVersionId: normalizeText(techPack.sourceTechPackVersionId) || normalizeText(techPack.versionLabel),
                    materialIdentity,
                    patternIdentity,
                });
                const materialKey = generationKey;
                if (!scopeByMaterialKey.has(materialKey)) {
                    orderedMaterialKeys.push(materialKey);
                    scopeByMaterialKey.set(materialKey, {
                        generationKey,
                        materialSku,
                        materialName,
                        materialColor,
                        materialType,
                        materialLabel: materialName,
                        materialUnit,
                        materialAlias: materialIdentity.materialAlias,
                        materialImageUrl,
                        materialIdentity,
                        patternIdentity,
                        scopeBySkuKey: new Map(),
                        pieceRows: [],
                        colors: new Set(),
                    });
                }
                const bucket = scopeByMaterialKey.get(materialKey);
                bucket.colors.add(normalizeText(skuLine.color));
                const skuKey = makeSkuKey(skuLine);
                const currentScope = bucket.scopeBySkuKey.get(skuKey);
                if (currentScope) {
                    currentScope.plannedQty += Number(skuLine.qty || 0);
                }
                else {
                    bucket.scopeBySkuKey.set(skuKey, {
                        skuCode: normalizeText(skuLine.skuCode),
                        color: normalizeText(skuLine.color),
                        size: normalizeText(skuLine.size),
                        plannedQty: Number(skuLine.qty || 0),
                    });
                }
                pieceRows.forEach((pieceRow) => {
                    const existing = bucket.pieceRows.find((item) => item.partCode === pieceRow.partCode
                        && item.patternId === pieceRow.patternId
                        && item.partName === pieceRow.partName);
                    if (existing) {
                        existing.applicableSkuCodes = unique([...existing.applicableSkuCodes, ...pieceRow.applicableSkuCodes]);
                        if (!existing.pieceCountPerUnit && pieceRow.pieceCountPerUnit) {
                            existing.pieceCountPerUnit = pieceRow.pieceCountPerUnit;
                        }
                        return;
                    }
                    bucket.pieceRows.push(pieceRow);
                });
            }
        }
    }
    return orderedMaterialKeys.map((materialKey, index) => {
        const bucket = scopeByMaterialKey.get(materialKey);
        const skuScopeLines = Array.from(bucket.scopeBySkuKey.values());
        if (bucket.pieceRows.length === 0)
            return null;
        const resolvedPieceRows = bucket.pieceRows.map((item) => ({
            ...item,
            applicableSkuCodes: [...item.applicableSkuCodes],
        }));
        const patternIdentity = {
            ...bucket.patternIdentity,
            piecePartCodes: unique(resolvedPieceRows.map((row) => row.partCode).filter(Boolean)),
            piecePartNames: unique(resolvedPieceRows.map((row) => row.partName).filter(Boolean)),
        };
        const requiredQty = skuScopeLines.reduce((sum, item) => sum + item.plannedQty, 0);
        const productionOrderNo = resolveProductionOrderNo(order);
        return {
            cutOrderId: makeStableCutOrderId({
                productionOrderNo,
                materialIdentity: bucket.materialIdentity,
                patternIdentity,
            }),
            cutOrderNo: makeCutOrderNo(order, index),
            generationKey: bucket.generationKey,
            productionOrderId: order.productionOrderId,
            productionOrderNo,
            spuCode: order.demandSnapshot.spuCode,
            styleId: normalizeText(techPack.styleId),
            styleCode: normalizeText(techPack.styleCode) || order.demandSnapshot.spuCode,
            styleName: normalizeText(techPack.styleName) || order.demandSnapshot.spuName,
            techPackVersionId: normalizeText(techPack.sourceTechPackVersionId) || normalizeText(techPack.versionLabel),
            techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || techPack.sourceTechPackVersionLabel || '-',
            materialSku: bucket.materialSku,
            materialName: bucket.materialName,
            materialColor: bucket.materialColor,
            materialType: bucket.materialType,
            materialLabel: bucket.materialLabel,
            materialCategory: toMaterialCategory(bucket.materialType),
            materialAlias: bucket.materialAlias,
            materialImageUrl: bucket.materialImageUrl,
            materialUnit: bucket.materialUnit,
            materialIdentity: { ...bucket.materialIdentity },
            patternIdentity: {
                ...patternIdentity,
                piecePartCodes: [...patternIdentity.piecePartCodes],
                piecePartNames: [...patternIdentity.piecePartNames],
            },
            markerPlanId: '',
            markerPlanNo: '',
            requiredQty,
            sourceTechPackSpuCode: order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
            colorScope: Array.from(bucket.colors.values()),
            skuScopeLines,
            pieceRows: resolvedPieceRows,
            pieceSummary: resolvedPieceRows.length > 0
                ? resolvedPieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、')
                : '待补纸样裁片映射',
        };
    }).filter((item) => Boolean(item));
}
function clonePatternIdentity(identity, overrides) {
    return {
        ...identity,
        ...overrides,
        piecePartCodes: [...(overrides.piecePartCodes ?? identity.piecePartCodes)],
        piecePartNames: [...(overrides.piecePartNames ?? identity.piecePartNames)],
    };
}
function buildScenarioRecord(seed, options) {
    const materialIdentity = options.materialIdentity ?? seed.materialIdentity;
    const generationKey = buildGenerationKey({
        productionOrderId: seed.productionOrderId,
        spuCode: seed.spuCode,
        styleId: seed.styleId,
        styleCode: seed.styleCode,
        styleName: seed.styleName,
        techPackVersionId: seed.techPackVersionId,
        materialIdentity,
        patternIdentity: options.patternIdentity,
    });
    return {
        ...seed,
        cutOrderId: makeStableCutOrderId({
            productionOrderNo: seed.productionOrderNo,
            materialIdentity,
            patternIdentity: options.patternIdentity,
        }),
        cutOrderNo: options.cutOrderNo,
        generationKey,
        materialSku: materialIdentity.materialSku,
        materialName: materialIdentity.materialName,
        materialColor: materialIdentity.materialColor,
        materialLabel: materialIdentity.materialName,
        materialAlias: materialIdentity.materialAlias,
        materialImageUrl: materialIdentity.materialImageUrl,
        materialUnit: materialIdentity.materialUnit,
        materialIdentity: { ...materialIdentity },
        patternIdentity: {
            ...options.patternIdentity,
            piecePartCodes: [...options.patternIdentity.piecePartCodes],
            piecePartNames: [...options.patternIdentity.piecePartNames],
        },
        pieceRows: options.pieceRows.map((row) => ({
            ...row,
            applicableSkuCodes: [...row.applicableSkuCodes],
        })),
        pieceSummary: options.pieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、'),
    };
}
function buildPrompt1DimensionScenarioRecords(records) {
    const scenarioRows = [];
    const blackJoggerSeed = records.find((record) => record.productionOrderNo === 'PO-202603-0101'
        && record.materialSku === 'tdv_demand_SPU_2024_010-bom-black-stretch-twill'
        && record.patternIdentity.patternFileId === 'tdv_demand_SPU_2024_010-pattern-main'
        && record.patternIdentity.effectiveWidthValue === 150);
    if (!blackJoggerSeed)
        return scenarioRows;
    const pocketPatternIdentity = clonePatternIdentity(blackJoggerSeed.patternIdentity, {
        patternFileId: 'tdv_demand_SPU_2024_010-pattern-pocket',
        patternFileName: 'SPU-2024-010-口袋布纸样.dxf',
        patternVersion: 'v1.0',
        patternKind: '布料纸样',
        effectiveWidthValue: 150,
        effectiveWidthUnit: 'cm',
        piecePartCodes: ['pocket-bag'],
        piecePartNames: ['口袋布'],
    });
    scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
        cutOrderNo: 'CUT-260306-101-03',
        patternIdentity: pocketPatternIdentity,
        pieceRows: [
            {
                partCode: 'pocket-bag',
                partName: '口袋布',
                pieceCountPerUnit: 2,
                patternId: pocketPatternIdentity.patternFileId,
                patternName: pocketPatternIdentity.patternFileName,
                applicableSkuCodes: [...blackJoggerSeed.skuScopeLines.map((line) => line.skuCode)],
            },
        ],
    }));
    const narrowWidthIdentity = clonePatternIdentity(blackJoggerSeed.patternIdentity, {
        effectiveWidthValue: 155,
        effectiveWidthUnit: 'cm',
    });
    scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
        cutOrderNo: 'CUT-260306-101-04',
        patternIdentity: narrowWidthIdentity,
        pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
            ...row,
            applicableSkuCodes: [...row.applicableSkuCodes],
        })),
    }));
    const noImageScenario = scenarioRows.find((record) => record.cutOrderNo === 'CUT-260306-101-04');
    if (noImageScenario) {
        noImageScenario.materialImageUrl = '';
        noImageScenario.materialIdentity = {
            ...noImageScenario.materialIdentity,
            materialImageUrl: '',
        };
    }
    const samePatternMaterialA = {
        ...blackJoggerSeed.materialIdentity,
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill-select-a',
        materialName: 'Black 弹力斜纹主面料 A',
        materialAlias: '技术包别名：同纸样选择 A',
        materialImageUrl: blackJoggerSeed.materialImageUrl,
    };
    scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
        cutOrderNo: 'CUT-260306-101-05',
        materialIdentity: samePatternMaterialA,
        patternIdentity: blackJoggerSeed.patternIdentity,
        pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
            ...row,
            applicableSkuCodes: [...row.applicableSkuCodes],
        })),
    }));
    const differentHistoryMaterial = {
        ...blackJoggerSeed.materialIdentity,
        materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill-history-b',
        materialName: 'Black 弹力斜纹主面料 B',
        materialAlias: '技术包别名：历史组合组 B',
        materialImageUrl: blackJoggerSeed.materialImageUrl,
    };
    scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
        cutOrderNo: 'CUT-260306-101-06',
        materialIdentity: differentHistoryMaterial,
        patternIdentity: blackJoggerSeed.patternIdentity,
        pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
            ...row,
            applicableSkuCodes: [...row.applicableSkuCodes],
        })),
    }));
    const crossOrderSeed = records.find((record) => record.productionOrderNo === 'PO-202603-0102'
        && record.patternIdentity.patternFileId === blackJoggerSeed.patternIdentity.patternFileId);
    if (crossOrderSeed) {
        const crossOrderMaterial = {
            ...crossOrderSeed.materialIdentity,
            materialSku: 'tdv_demand_SPU_2024_010-bom-cross-po-main',
            materialName: '跨生产单同纸样主面料',
            materialColor: 'Cross Black',
            materialAlias: '技术包别名：跨生产单同组',
            materialImageUrl: crossOrderSeed.materialImageUrl,
            materialUnit: blackJoggerSeed.materialIdentity.materialUnit,
        };
        scenarioRows.push(buildScenarioRecord(crossOrderSeed, {
            cutOrderNo: 'CUT-260307-102-03',
            materialIdentity: crossOrderMaterial,
            patternIdentity: clonePatternIdentity(blackJoggerSeed.patternIdentity, {
                piecePartCodes: [...blackJoggerSeed.patternIdentity.piecePartCodes],
                piecePartNames: [...blackJoggerSeed.patternIdentity.piecePartNames],
            }),
            pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
                ...row,
                applicableSkuCodes: [...crossOrderSeed.skuScopeLines.map((line) => line.skuCode)],
            })),
        }));
    }
    const existingKeys = new Set(records.map((record) => record.generationKey));
    return scenarioRows.filter((record) => !existingKeys.has(record.generationKey));
}
let cachedRecords = null;
export function listGeneratedCutOrderSourceRecords() {
    if (!cachedRecords) {
        const baseRecords = listCuttingProductionOrdersWithFormalTechPack().flatMap((order) => buildRecordsForOrder(order));
        cachedRecords = [...baseRecords, ...buildPrompt1DimensionScenarioRecords(baseRecords)];
    }
    return cachedRecords.map((record) => ({
        ...record,
        productionOrderNo: normalizeText(record.productionOrderNo) || normalizeText(record.productionOrderId),
        materialIdentity: { ...record.materialIdentity },
        patternIdentity: {
            ...record.patternIdentity,
            piecePartCodes: [...record.patternIdentity.piecePartCodes],
            piecePartNames: [...record.patternIdentity.piecePartNames],
        },
        colorScope: [...record.colorScope],
        skuScopeLines: record.skuScopeLines.map((line) => ({ ...line })),
        pieceRows: record.pieceRows.map((row) => ({ ...row, applicableSkuCodes: [...row.applicableSkuCodes] })),
    }));
}
export function getGeneratedCutOrderSourceRecordById(cutOrderId) {
    return listGeneratedCutOrderSourceRecords().find((record) => record.cutOrderId === cutOrderId || record.cutOrderNo === cutOrderId) ?? null;
}
export function resetGeneratedCutOrderSourceCache() {
    cachedRecords = null;
}
