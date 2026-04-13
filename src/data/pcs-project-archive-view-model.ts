import { getProjectById } from './pcs-project-repository.ts'
import {
  PROJECT_ARCHIVE_GROUP_LABELS,
  PROJECT_ARCHIVE_STATUS_LABELS,
} from './pcs-project-archive-collector.ts'
import {
  getProjectArchiveById,
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchiveFilesByArchiveId,
  listProjectArchiveMissingItemsByArchiveId,
} from './pcs-project-archive-repository.ts'
import type {
  ProjectArchiveDocumentGroup,
  ProjectArchiveDocumentRecord,
  ProjectArchiveFileRecord,
  ProjectArchiveRecord,
  ProjectArchiveStatus,
} from './pcs-project-archive-types.ts'

export interface ProjectArchiveDocumentViewModel extends ProjectArchiveDocumentRecord {
  fileList: ProjectArchiveFileRecord[]
  groupLabel: string
}

export interface ProjectArchivePageViewModel {
  archive: ProjectArchiveRecord
  archiveStatusLabel: string
  projectLinkText: string
  styleLinkText: string
  technicalVersionText: string
  baseDocuments: ProjectArchiveDocumentViewModel[]
  technicalDocuments: ProjectArchiveDocumentViewModel[]
  sampleDocuments: ProjectArchiveDocumentViewModel[]
  manualDocuments: ProjectArchiveDocumentViewModel[]
  missingItems: ReturnType<typeof listProjectArchiveMissingItemsByArchiveId>
}

export interface ProjectArchiveSummaryViewModel {
  archiveId: string
  archiveNo: string
  archiveStatus: ProjectArchiveStatus
  archiveStatusLabel: string
  documentCount: number
  fileCount: number
  missingItemCount: number
  readyForFinalize: boolean
  updatedAt: string
  finalizedAt: string
}

const BASE_GROUPS: ProjectArchiveDocumentGroup[] = ['PROJECT_BASE', 'STYLE_ARCHIVE', 'CONCLUSION_RECORD', 'REVISION_RECORD']
const TECH_GROUPS: ProjectArchiveDocumentGroup[] = ['TECHNICAL_DATA', 'PATTERN_DRAWING', 'ARTWORK_ASSET', 'PATTERN_RECORD', 'PATTERN_TASK_RECORD']
const SAMPLE_GROUPS: ProjectArchiveDocumentGroup[] = ['SAMPLE_ASSET']
const MANUAL_GROUPS: ProjectArchiveDocumentGroup[] = ['INSPECTION_FILE', 'QUOTATION_FILE', 'OTHER_FILE']

export function getProjectArchiveStatusLabel(status: ProjectArchiveStatus): string {
  return PROJECT_ARCHIVE_STATUS_LABELS[status] || status
}

export function getProjectArchiveDocumentGroupLabel(group: ProjectArchiveDocumentGroup): string {
  return PROJECT_ARCHIVE_GROUP_LABELS[group] || group
}

function buildDocumentViewModels(archiveId: string): ProjectArchiveDocumentViewModel[] {
  const files = listProjectArchiveFilesByArchiveId(archiveId)
  const fileMap = new Map<string, ProjectArchiveFileRecord[]>()
  files.forEach((file) => {
    const list = fileMap.get(file.archiveDocumentId) ?? []
    list.push(file)
    fileMap.set(file.archiveDocumentId, list)
  })
  return listProjectArchiveDocumentsByArchiveId(archiveId).map((item) => ({
    ...item,
    fileList: (fileMap.get(item.archiveDocumentId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    groupLabel: getProjectArchiveDocumentGroupLabel(item.documentGroup),
  }))
}

function filterDocumentsByGroups(
  documents: ProjectArchiveDocumentViewModel[],
  groups: ProjectArchiveDocumentGroup[],
): ProjectArchiveDocumentViewModel[] {
  return documents.filter((item) => groups.includes(item.documentGroup))
}

export function buildProjectArchiveSummaryByProject(projectId: string): ProjectArchiveSummaryViewModel | null {
  const archive = getProjectArchiveByProjectId(projectId)
  if (!archive) return null
  return {
    archiveId: archive.projectArchiveId,
    archiveNo: archive.archiveNo,
    archiveStatus: archive.archiveStatus,
    archiveStatusLabel: getProjectArchiveStatusLabel(archive.archiveStatus),
    documentCount: archive.documentCount,
    fileCount: archive.fileCount,
    missingItemCount: archive.missingItemCount,
    readyForFinalize: archive.readyForFinalize,
    updatedAt: archive.updatedAt,
    finalizedAt: archive.finalizedAt,
  }
}

export function buildProjectArchivePageViewModel(projectArchiveId: string): ProjectArchivePageViewModel | null {
  const archive = getProjectArchiveById(projectArchiveId)
  if (!archive) return null
  const documents = buildDocumentViewModels(projectArchiveId)
  const project = getProjectById(archive.projectId)
  return {
    archive,
    archiveStatusLabel: getProjectArchiveStatusLabel(archive.archiveStatus),
    projectLinkText: project ? `${project.projectCode} · ${project.projectName}` : `${archive.projectCode} · ${archive.projectName}`,
    styleLinkText: archive.styleCode ? `${archive.styleCode} · ${archive.styleName}` : '暂无正式款式档案',
    technicalVersionText: archive.currentTechnicalVersionCode
      ? `${archive.currentTechnicalVersionCode} · ${archive.currentTechnicalVersionLabel || '当前生效版本'}`
      : '暂无当前生效技术包版本',
    baseDocuments: filterDocumentsByGroups(documents, BASE_GROUPS),
    technicalDocuments: filterDocumentsByGroups(documents, TECH_GROUPS),
    sampleDocuments: filterDocumentsByGroups(documents, SAMPLE_GROUPS),
    manualDocuments: filterDocumentsByGroups(documents, MANUAL_GROUPS),
    missingItems: listProjectArchiveMissingItemsByArchiveId(projectArchiveId),
  }
}
