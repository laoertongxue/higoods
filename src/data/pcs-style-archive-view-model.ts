import { getProjectNodeRecordByWorkItemTypeCode, listProjects } from './pcs-project-repository.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord, StyleArchiveStatusCode } from './pcs-style-archive-types.ts'

export interface StyleArchiveListItemViewModel {
  styleId: string
  styleCode: string
  styleName: string
  categoryPath: string
  styleTagsText: string
  priceRangeLabel: string
  archiveStatusCode: StyleArchiveStatusCode
  archiveStatusLabel: string
  specificationStatus: string
  techPackStatus: string
  currentTechPackVersionText: string
  costPricingStatus: string
  sourceProjectText: string
  updatedAt: string
}

export interface StyleArchiveDetailViewModel {
  style: StyleArchiveShellRecord
  categoryPath: string
  archiveStatusLabel: string
  sourceProjectText: string
  isShell: boolean
}

export interface StyleArchiveProjectOptionViewModel {
  projectId: string
  projectCode: string
  projectName: string
  label: string
}

export function getStyleArchiveStatusLabel(status: StyleArchiveStatusCode): string {
  if (status === 'ACTIVE') return '可生产'
  if (status === 'ARCHIVED') return '已归档'
  return '技术包待完善'
}

export function buildStyleArchiveCategoryPath(style: Pick<StyleArchiveShellRecord, 'categoryName' | 'subCategoryName'>): string {
  return [style.categoryName, style.subCategoryName].filter(Boolean).join(' / ') || '待补录'
}

function buildCurrentTechPackVersionText(style: Pick<
  StyleArchiveShellRecord,
  'currentTechPackVersionCode' | 'currentTechPackVersionLabel' | 'techPackVersionCount'
>): string {
  if (style.currentTechPackVersionCode && style.currentTechPackVersionLabel) {
    return `${style.currentTechPackVersionCode} · ${style.currentTechPackVersionLabel}`
  }
  if (style.currentTechPackVersionCode) return style.currentTechPackVersionCode
  if (style.currentTechPackVersionLabel) return style.currentTechPackVersionLabel
  if (style.techPackVersionCount > 0) return '尚未启用当前生效技术包'
  return '暂无当前生效技术包版本'
}

export function buildStyleArchiveListItems(): StyleArchiveListItemViewModel[] {
  return listStyleArchives().map((style) => ({
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    categoryPath: buildStyleArchiveCategoryPath(style),
    styleTagsText: style.styleTags.join('、') || '待补录',
    priceRangeLabel: style.priceRangeLabel || '待补录',
    archiveStatusCode: style.archiveStatus,
    archiveStatusLabel: getStyleArchiveStatusLabel(style.archiveStatus),
    specificationStatus: style.specificationStatus,
    techPackStatus: style.techPackStatus,
    currentTechPackVersionText: buildCurrentTechPackVersionText(style),
    costPricingStatus: style.costPricingStatus,
    sourceProjectText: style.sourceProjectCode
      ? `${style.sourceProjectCode} · ${style.sourceProjectName}`
      : style.legacyOriginProject || '无来源项目',
    updatedAt: style.updatedAt,
  }))
}

export function buildStyleArchiveDetailViewModel(styleId: string): StyleArchiveDetailViewModel | null {
  const style = getStyleArchiveById(styleId)
  if (!style) return null
  return {
    style,
    categoryPath: buildStyleArchiveCategoryPath(style),
    archiveStatusLabel: getStyleArchiveStatusLabel(style.archiveStatus),
    sourceProjectText: style.sourceProjectCode
      ? `${style.sourceProjectCode} · ${style.sourceProjectName}`
      : style.legacyOriginProject || '无来源项目',
    isShell:
      style.specificationCount === 0 &&
      style.techPackVersionCount === 0 &&
      style.costVersionCount === 0 &&
      style.archiveStatus === 'DRAFT',
  }
}

export function listStyleArchiveEligibleProjects(): StyleArchiveProjectOptionViewModel[] {
  return listProjects()
    .filter(
      (project) => {
        const node = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
        return (
          project.projectStatus !== '已终止' &&
          ['PHASE_04', 'PHASE_05'].includes(project.currentPhaseCode) &&
          !project.linkedStyleId &&
          Boolean(node) &&
          node?.currentStatus !== '已取消'
        )
      },
    )
    .map((project) => ({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      label: `${project.projectCode} · ${project.projectName}`,
    }))
}
