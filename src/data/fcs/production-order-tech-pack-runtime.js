import { cloneProductionOrderTechPackSnapshot, } from './production-tech-pack-snapshot-builder.ts';
import { getProductionOrderTechPackSnapshot as getOrderSnapshot } from './production-orders.ts';
function cloneBomItems(items) {
    return items.map((item) => ({
        ...item,
        applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
        linkedPatternIds: [...(item.linkedPatternIds ?? [])],
        usageProcessCodes: [...(item.usageProcessCodes ?? [])],
    }));
}
function clonePatternFiles(items) {
    return items.map((item) => ({
        ...item,
        selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
        rulSizeList: [...(item.rulSizeList ?? [])],
        pieceRows: item.pieceRows?.map((row) => ({
            ...row,
            applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
            candidatePartNames: [...(row.candidatePartNames ?? [])],
            rawTextLabels: [...(row.rawTextLabels ?? [])],
            colorAllocations: row.colorAllocations?.map((allocation) => ({
                ...allocation,
                skuCodes: [...(allocation.skuCodes ?? [])],
            })),
            specialCrafts: row.specialCrafts?.map((craft) => ({
                ...craft,
                selectedTargetObject: craft.selectedTargetObject,
                supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
                supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
            })),
            bundleLengthCm: row.bundleLengthCm,
            bundleWidthCm: row.bundleWidthCm,
        })),
    }));
}
function cloneProcessEntries(items) {
    return items.map((item) => ({
        ...item,
        detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
        supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
        visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
    }));
}
function cloneSizeTable(items) {
    return items.map((item) => ({ ...item }));
}
function cloneQualityRules(items) {
    return items.map((item) => ({ ...item }));
}
function cloneColorMappings(items) {
    return items.map((item) => ({
        ...item,
        lines: item.lines.map((line) => ({
            ...line,
            applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
        })),
    }));
}
function clonePatternDesigns(items) {
    return items.map((item) => ({ ...item }));
}
function cloneAttachments(items) {
    return items.map((item) => ({ ...item }));
}
function cloneSizeMeasurements(items) {
    return items.map((item) => ({ ...item }));
}
function cloneCutPieceParts(items) {
    return items.map((item) => ({
        ...item,
        applicableColorList: [...item.applicableColorList],
        applicableSizeList: [...item.applicableSizeList],
        specialCrafts: item.specialCrafts?.map((craft) => ({
            ...craft,
            selectedTargetObject: craft.selectedTargetObject,
            supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
            supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
        })),
    }));
}
function cloneImageSnapshot(snapshot) {
    return {
        productImages: [...snapshot.productImages],
        styleImages: [...snapshot.styleImages],
        sampleImages: [...snapshot.sampleImages],
        materialImages: [...snapshot.materialImages],
        accessoryImages: [...snapshot.accessoryImages],
        patternImages: [...snapshot.patternImages],
        markerImages: [...snapshot.markerImages],
        artworkImages: [...snapshot.artworkImages],
    };
}
export function getProductionOrderTechPackSnapshot(productionOrderId) {
    return cloneProductionOrderTechPackSnapshot(getOrderSnapshot(productionOrderId));
}
export function getProductionOrderBomItems(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneBomItems(snapshot.bomItems) : [];
}
export function getProductionOrderPatternFiles(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? clonePatternFiles(snapshot.patternFiles) : [];
}
export function getProductionOrderProcessEntries(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneProcessEntries(snapshot.processEntries) : [];
}
export function getProductionOrderSizeTable(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneSizeTable(snapshot.sizeTable) : [];
}
export function getProductionOrderQualityRules(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneQualityRules(snapshot.qualityRules) : [];
}
export function getProductionOrderColorMaterialMappings(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneColorMappings(snapshot.colorMaterialMappings) : [];
}
export function getProductionOrderPatternDesigns(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? clonePatternDesigns(snapshot.patternDesigns) : [];
}
export function getProductionOrderAttachments(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneAttachments(snapshot.attachments) : [];
}
export function getProductionOrderSizeMeasurements(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneSizeMeasurements(snapshot.sizeMeasurements) : [];
}
export function getProductionOrderCutPieceParts(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneCutPieceParts(snapshot.cutPieceParts) : [];
}
export function getProductionOrderTechPackImageSnapshot(productionOrderId) {
    const snapshot = getProductionOrderTechPackSnapshot(productionOrderId);
    return snapshot ? cloneImageSnapshot(snapshot.imageSnapshot) : null;
}
