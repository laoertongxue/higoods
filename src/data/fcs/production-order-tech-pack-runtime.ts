import {
  buildCompatTechPackFromProductionSnapshot,
  cloneProductionOrderTechPackSnapshot,
} from './production-tech-pack-snapshot-builder.ts'
import type { ProductionOrderTechPackSnapshot } from './production-tech-pack-snapshot-types.ts'
import { getProductionOrderTechPackSnapshot as getOrderSnapshot } from './production-orders.ts'
import type { TechnicalQualityRule } from '../pcs-technical-data-version-types.ts'
import type {
  TechPack,
  TechPackAttachment,
  TechPackBomItem,
  TechPackColorMaterialMapping,
  TechPackPatternDesign,
  TechPackPatternFile,
  TechPackProcessEntry,
  TechPackSizeRow,
} from './tech-packs.ts'

function cloneBomItems(items: TechPackBomItem[]): TechPackBomItem[] {
  return items.map((item) => ({
    ...item,
    applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
    linkedPatternIds: [...(item.linkedPatternIds ?? [])],
    usageProcessCodes: [...(item.usageProcessCodes ?? [])],
  }))
}

function clonePatternFiles(items: TechPackPatternFile[]): TechPackPatternFile[] {
  return items.map((item) => ({
    ...item,
    pieceRows: item.pieceRows?.map((row) => ({
      ...row,
      applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
    })),
  }))
}

function cloneProcessEntries(items: TechPackProcessEntry[]): TechPackProcessEntry[] {
  return items.map((item) => ({
    ...item,
    detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
  }))
}

function cloneSizeTable(items: TechPackSizeRow[]): TechPackSizeRow[] {
  return items.map((item) => ({ ...item }))
}

function cloneQualityRules(items: TechnicalQualityRule[]): TechnicalQualityRule[] {
  return items.map((item) => ({ ...item }))
}

function cloneColorMappings(items: TechPackColorMaterialMapping[]): TechPackColorMaterialMapping[] {
  return items.map((item) => ({
    ...item,
    lines: item.lines.map((line) => ({
      ...line,
      applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
    })),
  }))
}

function clonePatternDesigns(items: TechPackPatternDesign[]): TechPackPatternDesign[] {
  return items.map((item) => ({ ...item }))
}

function cloneAttachments(items: TechPackAttachment[]): TechPackAttachment[] {
  return items.map((item) => ({ ...item }))
}

function buildCompatTechPack(snapshot: ProductionOrderTechPackSnapshot): TechPack {
  return buildCompatTechPackFromProductionSnapshot(snapshot)
}

export function getProductionOrderTechPackSnapshot(
  productionOrderId: string,
): ProductionOrderTechPackSnapshot | null {
  return cloneProductionOrderTechPackSnapshot(getOrderSnapshot(productionOrderId))
}

export function getProductionOrderCompatTechPack(productionOrderId: string): TechPack | null {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  if (!snapshot) return null
  return buildCompatTechPack(snapshot)
}

export function getProductionOrderBomItems(productionOrderId: string): TechPackBomItem[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneBomItems(snapshot.bomItems) : []
}

export function getProductionOrderPatternFiles(productionOrderId: string): TechPackPatternFile[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? clonePatternFiles(snapshot.patternFiles) : []
}

export function getProductionOrderProcessEntries(productionOrderId: string): TechPackProcessEntry[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneProcessEntries(snapshot.processEntries) : []
}

export function getProductionOrderSizeTable(productionOrderId: string): TechPackSizeRow[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneSizeTable(snapshot.sizeTable) : []
}

export function getProductionOrderQualityRules(productionOrderId: string): TechnicalQualityRule[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneQualityRules(snapshot.qualityRules) : []
}

export function getProductionOrderColorMaterialMappings(
  productionOrderId: string,
): TechPackColorMaterialMapping[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneColorMappings(snapshot.colorMaterialMappings) : []
}

export function getProductionOrderPatternDesigns(productionOrderId: string): TechPackPatternDesign[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? clonePatternDesigns(snapshot.patternDesigns) : []
}

export function getProductionOrderAttachments(productionOrderId: string): TechPackAttachment[] {
  const snapshot = getProductionOrderTechPackSnapshot(productionOrderId)
  return snapshot ? cloneAttachments(snapshot.attachments) : []
}
