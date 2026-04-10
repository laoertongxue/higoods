import { getProjectById } from './pcs-project-repository.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
import {
  getEffectiveTechnicalDataVersionByStyleId,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByProjectId,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
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
  effectiveFlag: boolean
  completenessScore: number
  missingItemNames: string[]
  sourceProjectText: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  canPublish: boolean
}

export interface TechnicalVersionDetailViewModel {
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
  styleName: string
  sourceProjectText: string
  versionStatusLabel: string
  canPublish: boolean
  compatibilityMode: boolean
}

export function getTechnicalVersionStatusLabel(status: TechnicalVersionStatus): string {
  if (status === 'PUBLISHED') return '已发布'
  if (status === 'ARCHIVED') return '已归档'
  return '草稿中'
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
  return listTechnicalDataVersionsByStyleId(styleId).map((record) => ({
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    versionStatus: record.versionStatus,
    versionStatusLabel: getTechnicalVersionStatusLabel(record.versionStatus),
    effectiveFlag: record.effectiveFlag,
    completenessScore: record.completenessScore,
    missingItemNames: [...record.missingItemNames],
    sourceProjectText: record.sourceProjectCode
      ? `${record.sourceProjectCode} · ${record.sourceProjectName}`
      : '未绑定商品项目',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
  }))
}

export function buildTechnicalVersionListByProject(projectId: string): TechnicalVersionListItemViewModel[] {
  return listTechnicalDataVersionsByProjectId(projectId).map((record) => ({
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    versionStatus: record.versionStatus,
    versionStatusLabel: getTechnicalVersionStatusLabel(record.versionStatus),
    effectiveFlag: record.effectiveFlag,
    completenessScore: record.completenessScore,
    missingItemNames: [...record.missingItemNames],
    sourceProjectText: record.sourceProjectCode
      ? `${record.sourceProjectCode} · ${record.sourceProjectName}`
      : '未绑定商品项目',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
  }))
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
    versionStatusLabel: getTechnicalVersionStatusLabel(record.versionStatus),
    canPublish: canPublishTechnicalVersion(record) && record.versionStatus === 'DRAFT',
    compatibilityMode: false,
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
    const effective = getEffectiveTechnicalDataVersionByStyleId(style.styleId)
    if (effective) {
      return {
        styleId: style.styleId,
        technicalVersionId: effective.technicalVersionId,
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
