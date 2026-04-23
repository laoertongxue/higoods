import { techPacks } from './fcs/tech-packs.ts'
import { listStyleArchives } from './pcs-style-archive-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionPendingItem,
  TechnicalDataVersionRecord,
  TechnicalDataVersionStoreSnapshot,
  TechnicalVersionStatus,
} from './pcs-technical-data-version-types.ts'

function mapLegacyStatus(status: string): TechnicalVersionStatus {
  return status === 'RELEASED' ? 'PUBLISHED' : 'DRAFT'
}

function parseVersionNo(versionLabel: string, fallback: number): number {
  const matched = versionLabel.match(/(\d+)/)
  if (!matched) return fallback
  const value = Number.parseInt(matched[1], 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeVersionLabel(versionLabel: string, fallback: number): string {
  const trimmed = versionLabel.trim()
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'beta') {
    return `V${fallback}`
  }
  const matched = trimmed.match(/(\d+)/)
  return matched ? `V${matched[1]}` : `V${fallback}`
}

function buildContent(technicalVersionId: string, techPack: (typeof techPacks)[number]): TechnicalDataVersionContent {
  return {
    technicalVersionId,
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
    qualityRules: [],
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

function buildPendingItem(
  techPack: (typeof techPacks)[number],
  reason: string,
): TechnicalDataVersionPendingItem {
  return {
    pendingId: `tech_version_pending_${techPack.spuCode}`,
    rawTechnicalCode: techPack.spuCode,
    rawStyleField: techPack.spuCode,
    rawProjectField: '',
    rawVersionLabel: techPack.versionLabel,
    reason,
    discoveredAt: techPack.lastUpdatedAt || '',
  }
}

export function createTechnicalDataVersionBootstrapSnapshot(
  version: number,
): TechnicalDataVersionStoreSnapshot {
  const styles = listStyleArchives()
  const styleByCode = new Map(styles.map((style) => [style.styleCode, style]))
  const records: TechnicalDataVersionRecord[] = []
  const contents: TechnicalDataVersionContent[] = []
  const pendingItems: TechnicalDataVersionPendingItem[] = []

  techPacks.forEach((techPack, index) => {
    const style = styleByCode.get(techPack.spuCode)
    if (!style) {
      pendingItems.push(
        buildPendingItem(techPack, '历史技术包未匹配到正式款式档案，仅保留待补齐记录。'),
      )
      return
    }

    const technicalVersionId = `tdv_seed_${String(index + 1).padStart(3, '0')}`
    const versionNo = parseVersionNo(techPack.versionLabel, 1)
    const versionLabel = normalizeVersionLabel(techPack.versionLabel, versionNo)
    const versionStatus = mapLegacyStatus(techPack.status)

    records.push({
      technicalVersionId,
      technicalVersionCode: `TDV-LEGACY-${String(index + 1).padStart(3, '0')}`,
      versionLabel,
      versionNo,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      sourceProjectId: style.sourceProjectId || '',
      sourceProjectCode: style.sourceProjectCode || '',
      sourceProjectName: style.sourceProjectName || '',
      sourceProjectNodeId: '',
      primaryPlateTaskId: '',
      primaryPlateTaskCode: '',
      primaryPlateTaskVersion: '',
      linkedRevisionTaskIds: [],
      linkedPatternTaskIds: [],
      linkedArtworkTaskIds: [],
      createdFromTaskType: 'REVISION',
      createdFromTaskId: '',
      createdFromTaskCode: '',
      baseTechnicalVersionId: '',
      baseTechnicalVersionCode: '',
      changeScope: '改版生成',
      changeSummary: '历史技术包快照初始化导入。',
      linkedPartTemplateIds: [],
      linkedPatternLibraryVersionIds: [],
      linkedPatternAssetIds: [],
      linkedPatternAssetCodes: [],
      archiveCollectedFlag: false,
      archiveCollectedAt: '',
      versionStatus,
      bomStatus: 'EMPTY',
      patternStatus: 'EMPTY',
      processStatus: 'EMPTY',
      gradingStatus: 'EMPTY',
      qualityStatus: 'EMPTY',
      colorMaterialStatus: 'EMPTY',
      designStatus: 'EMPTY',
      attachmentStatus: 'EMPTY',
      bomItemCount: techPack.bomItems.length,
      patternFileCount: techPack.patternFiles.length,
      processEntryCount: (techPack.processEntries ?? []).length,
      gradingRuleCount: techPack.sizeTable.length,
      qualityRuleCount: 0,
      colorMaterialMappingCount: (techPack.colorMaterialMappings ?? []).length,
      designAssetCount: techPack.patternDesigns.length,
      attachmentCount: techPack.attachments.length,
      completenessScore: 0,
      missingItemCodes: [],
      missingItemNames: [],
      publishedAt: versionStatus === 'PUBLISHED' ? techPack.lastUpdatedAt : '',
      publishedBy: versionStatus === 'PUBLISHED' ? techPack.lastUpdatedBy : '',
      createdAt: techPack.lastUpdatedAt || '',
      createdBy: techPack.lastUpdatedBy || '系统初始化',
      updatedAt: techPack.lastUpdatedAt || '',
      updatedBy: techPack.lastUpdatedBy || '系统初始化',
      note: '',
      legacySpuCode: techPack.spuCode,
      legacyVersionLabel: techPack.versionLabel,
    })
    contents.push(buildContent(technicalVersionId, techPack))
  })

  return {
    version,
    records,
    contents,
    pendingItems,
  }
}
