import { getProjectNodeRecordByWorkItemTypeCode, listProjects } from './pcs-project-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import type {
  ProjectArchivePendingItem,
  ProjectArchiveRecord,
  ProjectArchiveStoreSnapshot,
} from './pcs-project-archive-types.ts'
import { collectProjectArchiveAutoData, computeProjectArchiveMissingItems, deriveProjectArchiveState } from './pcs-project-archive-collector.ts'

function buildArchiveId(sequence: number): string {
  return `project_archive_bootstrap_${String(sequence).padStart(3, '0')}`
}

function buildArchiveNo(sequence: number): string {
  return `ARC-BOOT-${String(sequence).padStart(3, '0')}`
}

function buildPendingItem(projectCode: string, sourceCode: string, reason: string): ProjectArchivePendingItem {
  return {
    pendingId: `archive_pending_${projectCode || 'unknown'}_${sourceCode || 'none'}_${reason}`.replace(/[^a-zA-Z0-9]/g, '_'),
    rawProjectCode: projectCode,
    rawSourceCode: sourceCode,
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    reason,
    discoveredAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
}

export function createProjectArchiveBootstrapSnapshot(version: number): ProjectArchiveStoreSnapshot {
  const records: ProjectArchiveRecord[] = []
  const documents = [] as ProjectArchiveStoreSnapshot['documents']
  const files = [] as ProjectArchiveStoreSnapshot['files']
  const missingItems = [] as ProjectArchiveStoreSnapshot['missingItems']
  const pendingItems: ProjectArchivePendingItem[] = []

  listProjects().forEach((project) => {
    if (!project.linkedStyleId) return
    const style = getStyleArchiveById(project.linkedStyleId)
    if (!style) {
      pendingItems.push(
        buildPendingItem(
          project.projectCode,
          project.linkedStyleId,
          '历史项目已存在款式档案关联字段，但正式款式档案不存在，暂不能初始化项目资料归档。',
        ),
      )
      return
    }

    const archive: ProjectArchiveRecord = {
      projectArchiveId: buildArchiveId(records.length + 1),
      archiveNo: buildArchiveNo(records.length + 1),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      currentTechnicalVersionId: '',
      currentTechnicalVersionCode: '',
      currentTechnicalVersionLabel: '',
      currentPatternAssetIds: [],
      currentPatternAssetCodes: [],
      currentPatternAssetCount: 0,
      currentTechPackLogCount: 0,
      closureSnapshotAt: '',
      closureSnapshotBy: '',
      archiveStatus: 'DRAFT',
      documentCount: 0,
      fileCount: 0,
      autoCollectedCount: 0,
      manualUploadedCount: 0,
      missingItemCount: 0,
      readyForFinalize: false,
      createdAt: project.updatedAt || project.createdAt,
      createdBy: project.updatedBy || project.createdBy,
      updatedAt: project.updatedAt || project.createdAt,
      updatedBy: project.updatedBy || project.createdBy,
      finalizedAt: '',
      finalizedBy: '',
      note: '',
    }

    const collected = collectProjectArchiveAutoData(archive, project, style)
    const styleNodeId = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')?.projectNodeId || ''
    const missing = computeProjectArchiveMissingItems({
      archive,
      documents: collected.documents,
      currentTechnicalVersion: collected.currentTechnicalVersion,
      transferNodeId: styleNodeId,
    })
    const derived = deriveProjectArchiveState({
      archive,
      documents: collected.documents,
      files: collected.files,
      missingItems: missing,
      currentTechnicalVersion: collected.currentTechnicalVersion,
    })

    records.push({
      ...archive,
      ...derived,
    })
    documents.push(...collected.documents)
    files.push(...collected.files)
    missingItems.push(...missing)
  })

  return {
    version,
    records,
    documents,
    files,
    missingItems,
    pendingItems,
  }
}
