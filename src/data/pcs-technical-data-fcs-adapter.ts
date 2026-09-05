import type { TechPack } from './fcs/tech-packs.ts'
import type {
  DetailSplitDimension,
  SpecialCraftTargetObjectLabel,
  SpecialCraftVisibleFactoryType,
} from './fcs/process-craft-dict.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

function mapLegacyStatus(status: TechnicalDataVersionRecord['versionStatus']): TechPack['status'] {
  if (status === 'PUBLISHED') return 'ENABLED'
  if (status === 'ARCHIVED') return 'DISABLED'
  return 'DRAFT'
}

const DETAIL_SPLIT_DIMENSIONS = new Set<DetailSplitDimension>(['PATTERN', 'MATERIAL_SKU', 'GARMENT_COLOR', 'GARMENT_SKU'])
const SPECIAL_CRAFT_VISIBLE_FACTORY_TYPES = new Set<SpecialCraftVisibleFactoryType>([
  'CENTRAL_SPECIAL',
  'SATELLITE_FINISHING',
  'CENTRAL_CUTTING',
  'CENTRAL_AUX',
])

function isDetailSplitDimension(value: string): value is DetailSplitDimension {
  return DETAIL_SPLIT_DIMENSIONS.has(value as DetailSplitDimension)
}

function normalizeTargetObjectLabel(value: SpecialCraftTargetObjectLabel | undefined): SpecialCraftTargetObjectLabel {
  return value ?? '已裁部位'
}

function isSpecialCraftVisibleFactoryType(value: string): value is SpecialCraftVisibleFactoryType {
  return SPECIAL_CRAFT_VISIBLE_FACTORY_TYPES.has(value as SpecialCraftVisibleFactoryType)
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
      patternMakerInfoStatus: item.patternMakerInfoStatus === '已完成' ? '已解析' : item.patternMakerInfoStatus,
      bindingStrips: item.bindingStrips?.map((strip) => ({
        ...strip,
        bindingStripNo: strip.bindingStripNo || strip.bindingStripId,
        specialCrafts: strip.specialCrafts?.map((craft) => ({
          ...craft,
          selectedTargetObject: normalizeTargetObjectLabel(craft.selectedTargetObject),
          supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
          supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
        })),
      })),
      patternTotalPieceQty: item.patternTotalPieceQty,
      pieceInstanceTotal: item.pieceInstanceTotal,
      specialCraftConfiguredPieceTotal: item.specialCraftConfiguredPieceTotal,
      specialCraftUnconfiguredPieceTotal: item.specialCraftUnconfiguredPieceTotal,
      selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        parsedQuantity: row.parsedQuantity,
        totalPieceQty: row.totalPieceQty,
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
        colorAllocations: row.colorAllocations?.map((allocation) => ({
          ...allocation,
          skuCodes: [...(allocation.skuCodes ?? [])],
        })),
        colorPieceQuantities: row.colorPieceQuantities?.map((quantity) => ({ ...quantity })),
        specialCrafts: row.specialCrafts?.map((craft) => ({
          ...craft,
          selectedTargetObject: normalizeTargetObjectLabel(craft.selectedTargetObject),
          supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
          supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
        })),
      })),
      pieceInstances: item.pieceInstances?.map((instance) => ({
        ...instance,
        specialCraftAssignments: instance.specialCraftAssignments.map((assignment) => ({
          ...assignment,
          targetObject: assignment.targetObject === 'BINDING_STRIP' ? undefined : assignment.targetObject,
          targetObjectName: assignment.targetObjectName === '捆条' ? undefined : assignment.targetObjectName,
        })),
      })),
    })),
    patternDesc: content.patternDesc,
    processes: content.processEntries.map((item, index) => ({
      id: item.id,
      seq: index + 1,
      name: item.craftName || item.processName,
      difficulty: item.difficulty || 'MEDIUM',
      qcPoint: '',
    })),
    processEntries: content.processEntries.map((item) => ({
      ...item,
      ruleSource: item.ruleSource === 'INHERIT_PROCESS' || item.ruleSource === 'OVERRIDE_CRAFT'
        ? item.ruleSource
        : undefined,
      detailSplitMode: item.detailSplitMode === 'COMPOSITE' ? 'COMPOSITE' : undefined,
      detailSplitDimensions: [...(item.detailSplitDimensions ?? [])].filter(isDetailSplitDimension),
      supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
      supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
      linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
      linkedPatternIds: [...(item.linkedPatternIds ?? [])],
      visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])].filter(isSpecialCraftVisibleFactoryType),
    })),
    sizeTable: content.sizeTable.map((item) => ({ ...item })),
    bomItems: content.bomItems.map((item) => ({
      ...item,
      type: item.type === '纱线' ? '其他' : item.type,
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
      patternTotalPieceQty: item.patternTotalPieceQty,
      pieceInstanceTotal: item.pieceInstanceTotal,
      specialCraftConfiguredPieceTotal: item.specialCraftConfiguredPieceTotal,
      specialCraftUnconfiguredPieceTotal: item.specialCraftUnconfiguredPieceTotal,
      selectedSizeCodes: [...(item.selectedSizeCodes ?? [])],
      pieceRows: item.pieceRows?.map((row) => ({
        ...row,
        parsedQuantity: row.parsedQuantity,
        totalPieceQty: row.totalPieceQty,
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
        colorAllocations: row.colorAllocations?.map((allocation) => ({
          ...allocation,
          skuCodes: [...(allocation.skuCodes ?? [])],
        })),
        colorPieceQuantities: row.colorPieceQuantities?.map((quantity) => ({ ...quantity })),
        specialCrafts: row.specialCrafts?.map((craft) => ({
          ...craft,
          supportedTargetObjects: [...(craft.supportedTargetObjects ?? [])],
          supportedTargetObjectLabels: [...(craft.supportedTargetObjectLabels ?? [])],
        })),
      })),
      pieceInstances: item.pieceInstances?.map((instance) => ({
        ...instance,
        specialCraftAssignments: instance.specialCraftAssignments.map((assignment) => ({ ...assignment })),
      })),
    })),
    patternDesc: techPack.patternDesc || '',
    processEntries: (techPack.processEntries ?? []).map((item) => ({
      ...item,
      detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
      supportedTargetObjects: [...(item.supportedTargetObjects ?? [])],
      supportedTargetObjectLabels: [...(item.supportedTargetObjectLabels ?? [])],
      linkedBomItemIds: [...(item.linkedBomItemIds ?? [])],
      linkedPatternIds: [...(item.linkedPatternIds ?? [])],
      visibleFactoryTypes: [...(item.visibleFactoryTypes ?? [])],
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
