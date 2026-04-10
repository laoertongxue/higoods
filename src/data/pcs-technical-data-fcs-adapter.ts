import type { TechPack } from './pcs-technical-data-runtime-source.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

function mapLegacyStatus(status: TechnicalDataVersionRecord['versionStatus']): TechPack['status'] {
  if (status === 'PUBLISHED') return 'RELEASED'
  if (status === 'ARCHIVED') return 'RELEASED'
  return 'BETA'
}

export function buildLegacyTechPackFromTechnicalVersion(
  record: TechnicalDataVersionRecord,
  content: TechnicalDataVersionContent,
): TechPack {
  const legacyCost = content.legacyCompatibleCostPayload || {}
  return {
    spuCode: record.styleCode || record.legacySpuCode,
    spuName: record.styleName,
    status: mapLegacyStatus(record.versionStatus),
    versionLabel: record.versionLabel,
    completenessScore: record.completenessScore,
    missingChecklist: [...record.missingItemNames],
    lastUpdatedAt: record.updatedAt,
    lastUpdatedBy: record.updatedBy,
    patternFiles: content.patternFiles.map((item) => ({
      ...item,
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      })),
    })),
    patternDesc: content.patternDesc,
    processes: content.processEntries.map((item, index) => ({
      id: item.id,
      seq: index + 1,
      name: item.craftName || item.processName,
      timeMinutes: item.standardTimeMinutes || 0,
      difficulty: item.difficulty || 'MEDIUM',
      qcPoint: '',
    })),
    processEntries: content.processEntries.map((item) => ({
      ...item,
      detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    })),
    sizeTable: content.sizeTable.map((item) => ({ ...item })),
    bomItems: content.bomItems.map((item) => ({
      ...item,
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
      linkedPatternIds: [...(item.linkedPatternIds ?? [])],
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
    })),
    skuCatalog: [],
    materialCostItems: Array.isArray(legacyCost.materialCostItems)
      ? legacyCost.materialCostItems.map((item) => ({ ...item }))
      : [],
    processCostItems: Array.isArray(legacyCost.processCostItems)
      ? legacyCost.processCostItems.map((item) => ({ ...item }))
      : [],
    customCostItems: Array.isArray(legacyCost.customCostItems)
      ? legacyCost.customCostItems.map((item) => ({ ...item }))
      : [],
    colorMaterialMappings: content.colorMaterialMappings.map((item) => ({
      ...item,
      lines: item.lines.map((line) => ({
        ...line,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    patternDesigns: content.patternDesigns.map((item) => ({ ...item })),
    attachments: content.attachments.map((item) => ({ ...item })),
  }
}

export function buildTechnicalContentPatchFromLegacyTechPack(
  techPack: TechPack,
): Partial<TechnicalDataVersionContent> {
  return {
    patternFiles: techPack.patternFiles.map((item) => ({
      ...item,
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      })),
    })),
    patternDesc: techPack.patternDesc || '',
    processEntries: (techPack.processEntries ?? []).map((item) => ({
      ...item,
      detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    })),
    sizeTable: techPack.sizeTable.map((item) => ({ ...item })),
    bomItems: techPack.bomItems.map((item) => ({
      ...item,
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
      linkedPatternIds: [...(item.linkedPatternIds ?? [])],
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
    })),
    colorMaterialMappings: (techPack.colorMaterialMappings ?? []).map((item) => ({
      ...item,
      lines: item.lines.map((line) => ({
        ...line,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    patternDesigns: techPack.patternDesigns.map((item) => ({ ...item })),
    attachments: techPack.attachments.map((item) => ({ ...item })),
    legacyCompatibleCostPayload: {
      materialCostItems: (techPack.materialCostItems ?? []).map((item) => ({ ...item })),
      processCostItems: (techPack.processCostItems ?? []).map((item) => ({ ...item })),
      customCostItems: (techPack.customCostItems ?? []).map((item) => ({ ...item })),
    },
  }
}
