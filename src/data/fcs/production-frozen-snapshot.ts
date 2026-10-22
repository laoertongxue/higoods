// Copies already frozen production facts; this module never reads current PCS workflows.
import { cloneWebbingSpecifications } from './webbing-specifications.ts'
import type { ProductionDemand } from './production-demands.ts'
import type { DemandSnapshot } from './production-orders.ts'
import type { ProductionOrderTechPackSnapshot, ProductionTechPackColorMaterialMapping, TechPackBomItemSnapshot, TechPackCutPiecePartSnapshot, TechPackImageSnapshot, TechPackPatternFileSnapshot, TechPackSizeMeasurementSnapshot } from './production-tech-pack-snapshot-types.ts'
import type { TechnicalColorMaterialMapping, TechnicalPatternDesign, TechnicalProcessEntry, TechnicalSizeRow } from '../pcs-technical-data-version-types.ts'

export function clonePatternFiles(items: TechPackPatternFileSnapshot[]): TechPackPatternFileSnapshot[] {
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
    rulSizeList: [...(item.rulSizeList ?? [])],
    selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
    bindingStrips: item.bindingStrips?.map((strip) => ({
      ...strip,
      specialCrafts: strip.specialCrafts?.map((craft) => ({
        ...craft,
        supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
      })),
    })),
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      colorAllocations: row.colorAllocations?.map((allocation) => ({
        ...allocation,
        skuCodes: [...(allocation.skuCodes ?? [])],
      })),
      specialCrafts: row.specialCrafts?.map((craft) => ({
        ...craft,
        supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
        supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
      })),
      bundleLengthCm: row.bundleLengthCm,
      bundleWidthCm: row.bundleWidthCm,
      candidatePartNames: [...(row.candidatePartNames ?? [])],
      rawTextLabels: [...(row.rawTextLabels ?? [])],
      colorPieceQuantities: row.colorPieceQuantities?.map((quantity) => ({ ...quantity })),
    })),
  }))
}

export function cloneProcessEntries(items: TechnicalProcessEntry[]): TechnicalProcessEntry[] {
  return items.map((item) => ({
    ...item,
    webbingSpecifications: cloneWebbingSpecifications(item.webbingSpecifications),
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

export function cloneSizeTable(items: TechnicalSizeRow[]): TechnicalSizeRow[] {
  return items.map((item) => ({ ...item }))
}

export function cloneSizeMeasurements(items: TechPackSizeMeasurementSnapshot[]): TechPackSizeMeasurementSnapshot[] {
  return items.map((item) => ({ ...item }))
}

export function cloneBomItems(items: TechPackBomItemSnapshot[]): TechPackBomItemSnapshot[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

export function cloneColorMappings(items: TechnicalColorMaterialMapping[]): ProductionTechPackColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    mappingOrigin: 'TECH_PACK',
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

export function cloneSnapshotColorMappings(
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

export function clonePatternDesigns(items: TechnicalPatternDesign[]): TechnicalPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

export function cloneCutPieceParts(items: TechPackCutPiecePartSnapshot[]): TechPackCutPiecePartSnapshot[] {
  return items.map((item) => ({
    ...item,
    applicableColorList: [...item.applicableColorList],
    applicableSizeList: [...item.applicableSizeList],
    specialCrafts: item.specialCrafts?.map((craft) => ({
      ...craft,
      supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
      supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
    })),
  }))
}

export function cloneImageSnapshot(snapshot: TechPackImageSnapshot): TechPackImageSnapshot {
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

export function cloneProductionOrderTechPackSnapshot(
  snapshot: ProductionOrderTechPackSnapshot | null,
): ProductionOrderTechPackSnapshot | null {
  if (!snapshot) return null
  return {
    ...snapshot,
    garmentDifficultyGradeSourcePresent: snapshot.garmentDifficultyGradeSourcePresent ?? Boolean(snapshot.garmentDifficultyGrade),
    garmentDifficultyGrade: snapshot.garmentDifficultyGrade || 'B',
    bomItems: cloneBomItems(snapshot.bomItems),
    patternFiles: clonePatternFiles(snapshot.patternFiles),
    processEntries: cloneProcessEntries(snapshot.processEntries),
    sizeTable: cloneSizeTable(snapshot.sizeTable),
    sizeMeasurements: cloneSizeMeasurements(snapshot.sizeMeasurements),
    colorMaterialMappings: cloneSnapshotColorMappings(snapshot.colorMaterialMappings),
    cutPieceParts: cloneCutPieceParts(snapshot.cutPieceParts),
    imageSnapshot: cloneImageSnapshot(snapshot.imageSnapshot),
    onlineConfirmationFacts: snapshot.onlineConfirmationFacts
      ? JSON.parse(JSON.stringify(snapshot.onlineConfirmationFacts))
      : undefined,
    patternDesigns: clonePatternDesigns(snapshot.patternDesigns),
    linkedDesignRevisionTaskIds: [...snapshot.linkedDesignRevisionTaskIds],
    linkedPatternTaskIds: [...snapshot.linkedPatternTaskIds],
    linkedArtworkTaskIds: [...snapshot.linkedArtworkTaskIds],
  }
}

export function buildProductionOrderDemandSnapshot(demand: ProductionDemand): DemandSnapshot {
  return {
    demandId: demand.demandId,
    spuCode: demand.spuCode,
    spuName: demand.spuName,
    buyerName: demand.buyerName,
    merchandiserName: demand.merchandiserName,
    saleType: demand.saleType,
    priority: demand.priority,
    requiredDeliveryDate: demand.requiredDeliveryDate,
    constraintsNote: demand.constraintsNote,
    skuLines: demand.skuLines.map((line) => ({ ...line })),
  }
}
