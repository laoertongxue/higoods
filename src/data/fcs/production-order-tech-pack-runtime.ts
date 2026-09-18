import type {
  ProductionOrderTechPackSnapshot,
  ProductionTechPackColorMaterialMapping,
  TechPackCutPiecePartSnapshot,
  TechPackImageSnapshot,
  TechPackPatternFileSnapshot,
  TechPackSizeMeasurementSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import { productionOrders, getProductionOrderTechPackSnapshot as getOrderSnapshot } from './production-orders.ts'
import type {
  TechnicalBomItem,
  TechnicalPatternDesign,
  TechnicalProcessEntry,
  TechnicalSizeRow,
} from '../pcs-technical-data-version-types.ts'

function cloneBomItems(items: TechnicalBomItem[]): TechnicalBomItem[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function clonePatternFiles(items: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
  return items.map((item) => ({
    ...item,
    prjFile: item.prjFile ? { ...item.prjFile } : undefined,
    markerImage: item.markerImage ? { ...item.markerImage } : undefined,
    dxfFile: item.dxfFile ? { ...item.dxfFile } : undefined,
    rulFile: item.rulFile ? { ...item.rulFile } : undefined,
    duplicateWarningReasons: item.duplicateWarningReasons ? [...item.duplicateWarningReasons] : undefined,
    pieceInstances: item.pieceInstances?.map((instance) => ({
      ...instance,
      specialCraftAssignments: instance.specialCraftAssignments.map((assignment) => ({ ...assignment })),
    })),
    bindingStrips: item.bindingStrips?.map((strip) => ({
      ...strip,
      specialCrafts: strip.specialCrafts?.map((craft) => ({
        ...craft,
        supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
      })),
    })),
    selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
    rulSizeList: [...(item.rulSizeList ?? [])],
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      candidatePartNames: [...(row.candidatePartNames ?? [])],
      rawTextLabels: [...(row.rawTextLabels ?? [])],
      colorPieceQuantities: row.colorPieceQuantities?.map((quantity) => ({ ...quantity })),
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
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    routeStepNo: item.routeStepNo,
    routeLaneNo: item.routeLaneNo,
    routeParallelGroupId: item.routeParallelGroupId,
    routeParallelGroupName: item.routeParallelGroupName,
    routeSourceKind: item.routeSourceKind,
    routeObjectKey: item.routeObjectKey,
    inputObjectType: item.inputObjectType,
    outputObjectType: item.outputObjectType,
    routeUpdatedBy: item.routeUpdatedBy,
    routeUpdatedAt: item.routeUpdatedAt,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
    supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
    linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    consumedBomItemIds: [...(item.consumedBomItemIds ?? [])],
    predecessorEntryIds: item.predecessorEntryIds ? [...item.predecessorEntryIds] : undefined,
    visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
  }))
}

function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(
  items: ProductionTechPackColorMaterialMapping[],
): ProductionTechPackColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    mappingOrigin: item.mappingOrigin,
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

function clonePatternDesigns(items: TechnicalPatternDesign[]): TechnicalPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

function cloneSizeMeasurements(items: TechPackSizeMeasurementSnapshot[]): TechPackSizeMeasurementSnapshot[] {
  return items.map((item) => ({ ...item }))
}

function cloneCutPieceParts(items: TechPackCutPiecePartSnapshot[]): TechPackCutPiecePartSnapshot[] {
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
  }))
}

function cloneImageSnapshot(snapshot: TechPackImageSnapshot): TechPackImageSnapshot {
  return {
    productImages: [...snapshot.productImages],
    styleImages: [...snapshot.styleImages],
    sampleImages: [...snapshot.sampleImages],
    materialImages: [...snapshot.materialImages],
    accessoryImages: [...snapshot.accessoryImages],
    patternImages: [...snapshot.patternImages],
    markerImages: [...snapshot.markerImages],
    artworkImages: [...snapshot.artworkImages],
  }
}

export function getProductionOrderTechPackSnapshot(
  productionOrderId: string,
): ProductionOrderTechPackSnapshot | null {
  // The order accessor already returns an isolated snapshot; do not clone it twice.
  return getOrderSnapshot(productionOrderId)
}

// Only these private reads use the stored reference. Each public subset accessor
// clones its own section, and every call resolves the current binding without a cache.
function findStoredSnapshot(productionOrderId: string): ProductionOrderTechPackSnapshot | null {
  return productionOrders.find((order) => order.productionOrderId === productionOrderId)?.techPackSnapshot ?? null
}

export function getProductionOrderBomItems(productionOrderId: string): TechnicalBomItem[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneBomItems(snapshot.bomItems) : []
}

export function getProductionOrderPatternFiles(productionOrderId: string): TechPackPatternFileSnapshot[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? clonePatternFiles(snapshot.patternFiles) : []
}

export function getProductionOrderProcessEntries(productionOrderId: string): TechnicalProcessEntry[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneProcessEntries(snapshot.processEntries) : []
}

export function getProductionOrderSizeTable(productionOrderId: string): TechnicalSizeRow[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneSizeTable(snapshot.sizeTable) : []
}

export function getProductionOrderColorMaterialMappings(
  productionOrderId: string,
): ProductionTechPackColorMaterialMapping[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneColorMappings(snapshot.colorMaterialMappings) : []
}

export function getProductionOrderPatternDesigns(productionOrderId: string): TechnicalPatternDesign[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? clonePatternDesigns(snapshot.patternDesigns) : []
}

export function getProductionOrderSizeMeasurements(
  productionOrderId: string,
): TechPackSizeMeasurementSnapshot[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneSizeMeasurements(snapshot.sizeMeasurements) : []
}

export function getProductionOrderCutPieceParts(
  productionOrderId: string,
): TechPackCutPiecePartSnapshot[] {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneCutPieceParts(snapshot.cutPieceParts) : []
}

export function getProductionOrderTechPackImageSnapshot(
  productionOrderId: string,
): TechPackImageSnapshot | null {
  const snapshot = findStoredSnapshot(productionOrderId)
  return snapshot ? cloneImageSnapshot(snapshot.imageSnapshot) : null
}
