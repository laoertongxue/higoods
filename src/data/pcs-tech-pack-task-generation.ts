import { updateProjectRecord } from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import {
  getStyleArchiveById,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
import type {
  StoredTechPackSourceTaskType,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'
import { resolveTechnicalVersionProductProject } from './pcs-technical-data-version-project-source.ts'

function buildProjectRelationId(technicalVersionId: string): string {
  return `rel_tech_pack_${technicalVersionId}`
}

function getStyleTechPackStatus(
  versions: TechnicalDataVersionRecord[],
  currentTechPackVersionId: string,
): string {
  if (currentTechPackVersionId && versions.some((item) => item.technicalVersionId === currentTechPackVersionId)) {
    return '已启用'
  }
  if (versions.some((item) => item.versionStatus === 'PUBLISHED')) return '已发布待启用'
  if (versions.length > 0) return '草稿中'
  return '未建立'
}

export function writeProjectRelationFromTechPackVersion(
  record: TechnicalDataVersionRecord,
  operatorName = '当前用户',
  _sourceTaskType: StoredTechPackSourceTaskType = record.createdFromTaskType,
): void {
  const source = resolveTechnicalVersionProductProject(record)
  if (!source) return
  upsertProjectRelation({
    projectRelationId: buildProjectRelationId(record.technicalVersionId),
    projectId: source.project.projectId,
    projectCode: source.project.projectCode,
    projectNodeId: null,
    stepCode: '',
    stepName: '',
    relationRole: '产出对象',
    sourceModule: '技术包',
    sourceObjectType: '技术包版本',
    sourceObjectId: record.technicalVersionId,
    sourceObjectCode: record.technicalVersionCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.styleName} ${record.versionLabel}`,
    sourceStatus: record.versionStatus,
    businessDate: record.updatedAt,
    ownerName: operatorName,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: operatorName,
    note: '',
  })
}

export function syncStyleArchiveFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  const style = getStyleArchiveById(record.styleId)
  if (!style) return
  const versions = listTechnicalDataVersionsByStyleId(record.styleId)
  updateStyleArchive(record.styleId, {
    techPackVersionCount: versions.length,
    techPackStatus: getStyleTechPackStatus(versions, style.currentTechPackVersionId || ''),
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  })
}

export function syncProjectFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  const source = resolveTechnicalVersionProductProject(record)
  if (!source) return
  updateProjectRecord(
    source.project.projectId,
    {
      linkedTechPackVersionId: record.technicalVersionId,
      linkedTechPackVersionCode: record.technicalVersionCode,
      linkedTechPackVersionLabel: record.versionLabel,
      linkedTechPackVersionStatus: record.versionStatus,
      linkedTechPackVersionPublishedAt: record.publishedAt || '',
      updatedAt: record.updatedAt,
    },
    record.updatedBy || '当前用户',
  )
}

export function getTechPackVersionById(technicalVersionId: string): TechnicalDataVersionRecord | null {
  return getTechnicalDataVersionById(technicalVersionId)
}

export function buildTechPackVersionSourceTaskSummary(record: TechnicalDataVersionRecord): {
  primaryPlateText: string
  designRevisionTaskCount: number
  patternTaskCount: number
  artworkTaskCount: number
  taskChainText: string
} {
  const primaryPlateText = record.primaryPlateTaskCode
    ? `${record.primaryPlateTaskCode}${record.primaryPlateTaskVersion ? ` · ${record.primaryPlateTaskVersion}` : ''}`
    : '未绑定主制版任务'
  const parts = [
    record.primaryPlateTaskCode ? `主制版：${primaryPlateText}` : '',
    record.linkedArtworkTaskIds.length > 0 ? `花型任务 ${record.linkedArtworkTaskIds.length} 个` : '',
    record.linkedDesignRevisionTaskIds.length > 0
      ? `设计改款来源 ${record.linkedDesignRevisionTaskIds.length} 个`
      : '',
  ].filter(Boolean)
  return {
    primaryPlateText,
    designRevisionTaskCount: record.linkedDesignRevisionTaskIds.length,
    patternTaskCount: record.linkedPatternTaskIds.length,
    artworkTaskCount: record.linkedArtworkTaskIds.length,
    taskChainText: parts.join('；') || '未记录来源任务链',
  }
}
