import {
  cloneProductionOrderTechPackSnapshot,
} from './production-tech-pack-snapshot-builder.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackCutPiecePartSnapshot,
  TechPackImageSnapshot,
  TechPackPatternFileSnapshot,
  TechPackSizeMeasurementSnapshot,
} from './production-tech-pack-snapshot-types.ts'
import { getProductionOrderTechPackSnapshot as getOrderSnapshot } from './production-orders.ts'
import type {
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalPatternDesign,
  TechnicalProcessEntry,
  TechnicalSizeRow,
} from '../pcs-technical-data-version-types.ts'

function cloneBomItems(items: TechnicalBomItem[]): TechnicalBomItem[] {
  return items.map((item) => ({
    ...item,
    materialCode: item.materialCode,
    unit: item.unit,
    waterSolubleRequirement: item.waterSolubleRequirement,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function clonePatternFiles(items: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
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
  }))
}

function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    routeStepNo: item.routeStepNo,
    routeLaneNo: item.routeLaneNo,
    routeParallelGroupId: item.routeParallelGroupId,
    routeParallelGroupName: item.routeParallelGroupName,
    routeParallelAcceptanceMode: item.routeParallelAcceptanceMode,
    routeSourceKind: item.routeSourceKind,
    routeUpdatedBy: item.routeUpdatedBy,
    routeUpdatedAt: item.routeUpdatedAt,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
    supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
    linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
  }))
}

function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(items: TechnicalColorMaterialMapping[]): TechnicalColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
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
  return cloneProductionOrderTechPackSnapshot(getOrderSnapshot(productionOrderId))
}

export function getProductionOrderBomItems(productionOrderId: string): TechnicalBomItem[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneBomItems(snapshot.bomItems) : []
}

export function getProductionOrderPatternFiles(productionOrderId: string): TechPackPatternFileSnapshot[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? clonePatternFiles(snapshot.patternFiles) : []
}

export function getProductionOrderProcessEntries(productionOrderId: string): TechnicalProcessEntry[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneProcessEntries(snapshot.processEntries) : []
}

export function getProductionOrderSizeTable(productionOrderId: string): TechnicalSizeRow[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneSizeTable(snapshot.sizeTable) : []
}

export function getProductionOrderColorMaterialMappings(
  productionOrderId: string,
): TechnicalColorMaterialMapping[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneColorMappings(snapshot.colorMaterialMappings) : []
}

export function getProductionOrderPatternDesigns(productionOrderId: string): TechnicalPatternDesign[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? clonePatternDesigns(snapshot.patternDesigns) : []
}

export function getProductionOrderSizeMeasurements(
  productionOrderId: string,
): TechPackSizeMeasurementSnapshot[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneSizeMeasurements(snapshot.sizeMeasurements) : []
}

export function getProductionOrderCutPieceParts(
  productionOrderId: string,
): TechPackCutPiecePartSnapshot[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneCutPieceParts(snapshot.cutPieceParts) : []
}

export function getProductionOrderTechPackImageSnapshot(
  productionOrderId: string,
): TechPackImageSnapshot | null {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneImageSnapshot(snapshot.imageSnapshot) : null
}
