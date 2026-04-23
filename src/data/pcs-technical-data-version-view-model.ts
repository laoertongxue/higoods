import { getProjectById } from './pcs-project-repository.ts'
import {
  TECH_PACK_AGGREGATE_STATUS_RULES,
  resolveTechPackVersionBusinessStatus,
} from './pcs-product-lifecycle-governance.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
import { buildTechPackVersionSourceTaskSummary } from './pcs-tech-pack-task-generation.ts'
import { listTechPackVersionLogsByVersionId } from './pcs-tech-pack-version-log-repository.ts'
import { listPatternAssetsForTechPackVersions } from './pcs-pattern-library-archive-linkage.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByProjectId,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
import type { TechPackVersionLogRecord } from './pcs-tech-pack-version-log-types.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalDomainStatus,
  TechnicalVersionStatus,
} from './pcs-technical-data-version-types.ts'

export interface TechnicalVersionListItemViewModel {
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  versionStatus: TechnicalVersionStatus
  versionStatusLabel: string
  isCurrentTechPackVersion: boolean
  completenessScore: number
  missingItemNames: string[]
  sourceTaskText: string
  sourceProjectText: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  versionLogCount: number
  linkedPatternAssetCount: number
  archiveStatusText: string
  canPublish: boolean
  canActivate: boolean
}

export interface TechnicalVersionDetailViewModel {
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
  styleName: string
  sourceProjectText: string
  versionStatusLabel: string
  isCurrentTechPackVersion: boolean
  sourceTaskText: string
  canPublish: boolean
  compatibilityMode: boolean
  versionLogs: TechPackVersionLogRecord[]
  linkedPatternAssets: ReturnType<typeof listPatternAssetsForTechPackVersions>
  archiveStatusText: string
}

export function getTechnicalVersionStatusLabel(status: TechnicalVersionStatus): string {
  if (status === 'PUBLISHED') return '已发布待启用'
  if (status === 'ARCHIVED') return '已归档'
  return '草稿中'
}

export function getTechnicalVersionBusinessStatusLabel(
  record: Pick<TechnicalDataVersionRecord, 'versionStatus' | 'technicalVersionId'>,
  currentVersionId: string,
): string {
  return TECH_PACK_AGGREGATE_STATUS_RULES[
    resolveTechPackVersionBusinessStatus(record, currentVersionId)
  ].label
}

export function getTechnicalDomainStatusLabel(status: TechnicalDomainStatus): string {
  if (status === 'COMPLETE') return '已完成'
  if (status === 'DRAFT') return '草稿中'
  return '未建立'
}

export function canPublishTechnicalVersion(record: Pick<TechnicalDataVersionRecord, 'missingItemCodes'>): boolean {
  return record.missingItemCodes.length === 0
}

export function buildTechnicalVersionListByStyle(styleId: string): TechnicalVersionListItemViewModel[] {
  const style = getStyleArchiveById(styleId)
  return listTechnicalDataVersionsByStyleId(styleId).map((record) => ({
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    versionStatus: record.versionStatus,
    versionStatusLabel: getTechnicalVersionBusinessStatusLabel(record, style?.currentTechPackVersionId || ''),
    isCurrentTechPackVersion: style?.currentTechPackVersionId === record.technicalVersionId,
    completenessScore: record.completenessScore,
    missingItemNames: [...record.missingItemNames],
    sourceTaskText: buildTechPackVersionSourceTaskSummary(record).taskChainText,
    sourceProjectText: record.sourceProjectCode
      ? `${record.sourceProjectCode} · ${record.sourceProjectName}`
      : '未绑定商品项目',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    versionLogCount: listTechPackVersionLogsByVersionId(record.technicalVersionId).length,
    linkedPatternAssetCount: listPatternAssetsForTechPackVersions([record]).length,
    archiveStatusText: record.archiveCollectedFlag ? '已进入项目资料归档' : '未进入项目资料归档',
    canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
    canActivate: record.versionStatus === 'PUBLISHED' && style?.currentTechPackVersionId !== record.technicalVersionId,
  }))
}

export function buildTechnicalVersionListByProject(projectId: string): TechnicalVersionListItemViewModel[] {
  return listTechnicalDataVersionsByProjectId(projectId).map((record) => {
    const style = getStyleArchiveById(record.styleId)
    return {
      technicalVersionId: record.technicalVersionId,
      technicalVersionCode: record.technicalVersionCode,
      versionLabel: record.versionLabel,
      versionStatus: record.versionStatus,
      versionStatusLabel: getTechnicalVersionBusinessStatusLabel(record, style?.currentTechPackVersionId || ''),
      isCurrentTechPackVersion: style?.currentTechPackVersionId === record.technicalVersionId,
      completenessScore: record.completenessScore,
      missingItemNames: [...record.missingItemNames],
      sourceTaskText: buildTechPackVersionSourceTaskSummary(record).taskChainText,
      sourceProjectText: record.sourceProjectCode
        ? `${record.sourceProjectCode} · ${record.sourceProjectName}`
        : '未绑定商品项目',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      publishedAt: record.publishedAt,
      versionLogCount: listTechPackVersionLogsByVersionId(record.technicalVersionId).length,
      linkedPatternAssetCount: listPatternAssetsForTechPackVersions([record]).length,
      archiveStatusText: record.archiveCollectedFlag ? '已进入项目资料归档' : '未进入项目资料归档',
      canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
      canActivate:
        record.versionStatus === 'PUBLISHED' && style?.currentTechPackVersionId !== record.technicalVersionId,
    }
  })
}

export function buildTechnicalVersionDetailViewModel(
  technicalVersionId: string,
): TechnicalVersionDetailViewModel | null {
  const record = getTechnicalDataVersionById(technicalVersionId)
  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!record || !content) return null
  return {
    record,
    content,
    styleName: record.styleName || getStyleArchiveById(record.styleId)?.styleName || record.styleCode,
    sourceProjectText: record.sourceProjectCode
      ? `${record.sourceProjectCode} · ${record.sourceProjectName}`
      : '未绑定商品项目',
    versionStatusLabel: getTechnicalVersionBusinessStatusLabel(
      record,
      getStyleArchiveById(record.styleId)?.currentTechPackVersionId || '',
    ),
    isCurrentTechPackVersion:
      getStyleArchiveById(record.styleId)?.currentTechPackVersionId === record.technicalVersionId,
    sourceTaskText: buildTechPackVersionSourceTaskSummary(record).taskChainText,
    canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
    compatibilityMode: false,
    versionLogs: listTechPackVersionLogsByVersionId(record.technicalVersionId),
    linkedPatternAssets: listPatternAssetsForTechPackVersions([record]),
    archiveStatusText: record.archiveCollectedFlag ? '已进入项目资料归档' : '未进入项目资料归档',
  }
}

export function resolveFcsCompatibleTechnicalVersion(spuCode: string): {
  styleId: string
  technicalVersionId: string
} | null {
  const style =
    getStyleArchiveById(spuCode) ??
    listStyleArchives().find((item) => item.styleCode === spuCode) ??
    null
  if (style) {
    const currentVersion = getCurrentTechPackVersionByStyleId(style.styleId)
    if (currentVersion) {
      return {
        styleId: style.styleId,
        technicalVersionId: currentVersion.technicalVersionId,
      }
    }
  }
  return null
}

export function buildTechnicalVersionSourceSummary(styleId: string): {
  styleCode: string
  styleName: string
  projectCode: string
  projectName: string
} | null {
  const style = getStyleArchiveById(styleId)
  if (!style) return null
  const project = style.sourceProjectId ? getProjectById(style.sourceProjectId) : null
  return {
    styleCode: style.styleCode,
    styleName: style.styleName,
    projectCode: project?.projectCode || style.sourceProjectCode || '',
    projectName: project?.projectName || style.sourceProjectName || '',
  }
}
