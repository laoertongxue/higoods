import {
  getTechPackBySpuCode as getLegacyTechPackBySpuCode,
  listTechPackProcessEntries as listLegacyTechPackProcessEntries,
  resolveTechPackProcessEntryRule,
  type TechPack,
  type TechPackAssignmentGranularity,
  type TechPackBomItem,
  type TechPackColorMappingGeneratedMode,
  type TechPackColorMappingStatus,
  type TechPackColorMaterialMapping,
  type TechPackColorMaterialMappingLine,
  type TechPackDetailSplitDimension,
  type TechPackDetailSplitMode,
  type TechPackPatternFile,
  type TechPackProcessEntry,
  type TechPackProcessEntryType,
  type TechPackRuleSource,
  type TechPackSizeRow,
  type TechPackSkuLine,
} from './fcs/tech-packs.ts'
import { buildLegacyTechPackFromTechnicalVersion } from './pcs-technical-data-fcs-adapter.ts'
import {
  getEffectiveTechnicalDataVersionByStyleId,
  getTechnicalDataVersionContent,
  getTechnicalDataVersionById,
} from './pcs-technical-data-version-repository.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'

export type {
  TechPack,
  TechPackAssignmentGranularity,
  TechPackBomItem,
  TechPackColorMappingGeneratedMode,
  TechPackColorMappingStatus,
  TechPackColorMaterialMapping,
  TechPackColorMaterialMappingLine,
  TechPackDetailSplitDimension,
  TechPackDetailSplitMode,
  TechPackPatternFile,
  TechPackProcessEntry,
  TechPackProcessEntryType,
  TechPackRuleSource,
  TechPackSizeRow,
  TechPackSkuLine,
}

export { resolveTechPackProcessEntryRule }

export type TechnicalRuntimeSourceKind = 'pcs_published' | 'fcs_legacy' | 'missing'
export type TechnicalRuntimeCompatStatus = 'RELEASED' | 'BETA' | 'MISSING'
export type TechnicalMaintenanceTargetKind = 'pcs_version' | 'pcs_style' | 'fcs_compat' | 'missing'

export interface TechnicalMaintenanceTarget {
  kind: TechnicalMaintenanceTargetKind
  targetPath: string
  targetTitle: string
  message: string
}

export interface TechnicalSnapshotResolution {
  sourceKind: TechnicalRuntimeSourceKind
  status: TechnicalRuntimeCompatStatus
  styleId: string
  styleCode: string
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  compatTechPack: TechPack | null
  compatProcessEntries: TechPackProcessEntry[]
  maintenanceTarget: TechnicalMaintenanceTarget
}

function findStyleArchiveBySpuCode(spuCode: string) {
  return (
    getStyleArchiveById(spuCode) ??
    listStyleArchives().find((item) => item.styleCode === spuCode) ??
    null
  )
}

function buildMissingTarget(spuCode: string): TechnicalMaintenanceTarget {
  return {
    kind: 'missing',
    targetPath: `/fcs/tech-pack/${encodeURIComponent(spuCode)}`,
    targetTitle: `技术资料兼容查看 - ${spuCode}`,
    message: '当前无可用技术资料。',
  }
}

function buildLegacyTarget(spuCode: string): TechnicalMaintenanceTarget {
  return {
    kind: 'fcs_compat',
    targetPath: `/fcs/tech-pack/${encodeURIComponent(spuCode)}`,
    targetTitle: `技术资料兼容查看 - ${spuCode}`,
    message: '当前为历史兼容快照，请尽快在商品中心建立正式技术资料版本。',
  }
}

function buildStyleTarget(styleId: string, styleCode: string): TechnicalMaintenanceTarget {
  return {
    kind: 'pcs_style',
    targetPath: `/pcs/products/styles/${encodeURIComponent(styleId)}?tab=technical`,
    targetTitle: `款式档案 - ${styleCode}`,
    message: '已存在正式款式档案，但还没有当前生效技术资料版本，请在商品中心补建。',
  }
}

function buildVersionTarget(styleId: string, technicalVersionId: string, technicalVersionCode: string): TechnicalMaintenanceTarget {
  return {
    kind: 'pcs_version',
    targetPath: `/pcs/products/styles/${encodeURIComponent(styleId)}/technical-data/${encodeURIComponent(technicalVersionId)}`,
    targetTitle: `技术资料版本 - ${technicalVersionCode}`,
    message: '当前为兼容查看入口，请在商品中心维护技术资料版本。',
  }
}

export function resolveTechnicalSnapshotBySpuCode(spuCode: string): TechnicalSnapshotResolution {
  const style = findStyleArchiveBySpuCode(spuCode)
  if (style) {
    const effective = getEffectiveTechnicalDataVersionByStyleId(style.styleId)
    if (effective) {
      const record = getTechnicalDataVersionById(effective.technicalVersionId)
      const content = getTechnicalDataVersionContent(effective.technicalVersionId)
      if (record && content) {
        const compatTechPack = buildLegacyTechPackFromTechnicalVersion(record, content)
        return {
          sourceKind: 'pcs_published',
          status: 'RELEASED',
          styleId: style.styleId,
          styleCode: style.styleCode,
          technicalVersionId: record.technicalVersionId,
          technicalVersionCode: record.technicalVersionCode,
          versionLabel: record.versionLabel,
          compatTechPack,
          compatProcessEntries: (compatTechPack.processEntries ?? []).map((item) =>
            resolveTechPackProcessEntryRule(item),
          ),
          maintenanceTarget: buildVersionTarget(
            style.styleId,
            record.technicalVersionId,
            record.technicalVersionCode,
          ),
        }
      }
    }
  }

  const legacyTechPack = getLegacyTechPackBySpuCode(spuCode)
  if (legacyTechPack) {
    return {
      sourceKind: 'fcs_legacy',
      status: legacyTechPack.status === 'RELEASED' ? 'RELEASED' : 'BETA',
      styleId: style?.styleId || '',
      styleCode: style?.styleCode || spuCode,
      technicalVersionId: '',
      technicalVersionCode: '',
      versionLabel: legacyTechPack.versionLabel || '',
      compatTechPack: legacyTechPack,
      compatProcessEntries: listLegacyTechPackProcessEntries(spuCode),
      maintenanceTarget: style
        ? buildStyleTarget(style.styleId, style.styleCode)
        : buildLegacyTarget(spuCode),
    }
  }

  return {
    sourceKind: 'missing',
    status: 'MISSING',
    styleId: style?.styleId || '',
    styleCode: style?.styleCode || spuCode,
    technicalVersionId: '',
    technicalVersionCode: '',
    versionLabel: '',
    compatTechPack: null,
    compatProcessEntries: [],
    maintenanceTarget: style
      ? buildStyleTarget(style.styleId, style.styleCode)
      : buildMissingTarget(spuCode),
  }
}

export function getTechnicalSnapshotBySpuCode(spuCode: string): TechnicalSnapshotResolution {
  return resolveTechnicalSnapshotBySpuCode(spuCode)
}

export function getCompatTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return resolveTechnicalSnapshotBySpuCode(spuCode).compatTechPack ?? undefined
}

export function listTechnicalProcessEntriesBySpuCode(spuCode: string): TechPackProcessEntry[] {
  return resolveTechnicalSnapshotBySpuCode(spuCode).compatProcessEntries.map((item) => ({ ...item }))
}

export function getTechnicalMaintenanceTargetBySpuCode(spuCode: string): TechnicalMaintenanceTarget {
  return resolveTechnicalSnapshotBySpuCode(spuCode).maintenanceTarget
}

export function getTechnicalAvailabilityBySpuCode(spuCode: string): {
  sourceKind: TechnicalRuntimeSourceKind
  status: TechnicalRuntimeCompatStatus
  available: boolean
  maintenanceTarget: TechnicalMaintenanceTarget
} {
  const resolution = resolveTechnicalSnapshotBySpuCode(spuCode)
  return {
    sourceKind: resolution.sourceKind,
    status: resolution.status,
    available: resolution.status !== 'MISSING',
    maintenanceTarget: resolution.maintenanceTarget,
  }
}
