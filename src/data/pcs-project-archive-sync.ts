import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import {
  collectProjectArchiveAutoData,
  computeProjectArchiveMissingItems,
  deriveProjectArchiveState,
} from './pcs-project-archive-collector.ts'
import {
  deleteProjectArchiveDocument,
  getProjectArchiveById,
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchiveFilesByArchiveId,
  listProjectArchives,
  replaceProjectArchiveDocuments,
  replaceProjectArchiveFiles,
  replaceProjectArchiveMissingItems,
  upsertProjectArchive,
  upsertProjectArchiveDocuments,
  upsertProjectArchiveFiles,
  upsertProjectArchivePendingItem,
} from './pcs-project-archive-repository.ts'
import type {
  ProjectArchiveCreateResult,
  ProjectArchiveDocumentGroup,
  ProjectArchiveDocumentRecord,
  ProjectArchiveFileRecord,
  ProjectArchiveRecord,
} from './pcs-project-archive-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function dateKey(dateText: string): string {
  return dateText.slice(0, 10).replace(/-/g, '')
}

function buildArchiveId(sequence: number): string {
  return `project_archive_${String(sequence).padStart(4, '0')}`
}

function buildArchiveNo(datePart: string, sequence: number): string {
  return `ARC-${datePart}-${String(sequence).padStart(3, '0')}`
}

function nextArchiveIdentity(timestamp: string): { projectArchiveId: string; archiveNo: string } {
  const dayKey = dateKey(timestamp)
  const existingCount = listProjectArchives().filter((item) => dateKey(item.createdAt || item.updatedAt) === dayKey).length
  const sequence = existingCount + 1
  return {
    projectArchiveId: buildArchiveId(sequence),
    archiveNo: buildArchiveNo(dayKey, sequence),
  }
}

function buildPendingItem(projectCode: string, sourceCode: string, reason: string) {
  return {
    pendingId: `archive_pending_${projectCode || 'unknown'}_${sourceCode || 'none'}_${reason}`.replace(/[^a-zA-Z0-9]/g, '_'),
    rawProjectCode: projectCode,
    rawSourceCode: sourceCode,
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    reason,
    discoveredAt: nowText(),
  }
}

function buildRelation(archive: ProjectArchiveRecord, operatorName: string): ProjectRelationRecord {
  return {
    projectRelationId: `rel_archive_${archive.projectArchiveId}`,
    projectId: archive.projectId,
    projectCode: archive.projectCode,
    projectNodeId: getProjectNodeRecordByWorkItemTypeCode(archive.projectId, 'PROJECT_TRANSFER_PREP')?.projectNodeId || null,
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    workItemTypeName: '项目转档准备',
    relationRole: '产出对象',
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    sourceObjectId: archive.projectArchiveId,
    sourceObjectCode: archive.archiveNo,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${archive.projectName}项目资料归档`,
    sourceStatus: archive.archiveStatus,
    businessDate: archive.finalizedAt || archive.updatedAt || archive.createdAt,
    ownerName: operatorName,
    createdAt: archive.createdAt,
    createdBy: archive.createdBy,
    updatedAt: archive.updatedAt,
    updatedBy: operatorName,
    note: '',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function dedupeManualDocuments(
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
): { documents: ProjectArchiveDocumentRecord[]; files: ProjectArchiveFileRecord[] } {
  const keptDocuments: ProjectArchiveDocumentRecord[] = []
  const keptFiles: ProjectArchiveFileRecord[] = []
  const seen = new Set<string>()
  documents.forEach((document) => {
    const fileList = files.filter((file) => file.archiveDocumentId === document.archiveDocumentId)
    const key = [
      document.projectArchiveId,
      document.documentGroup,
      document.documentTitle,
      fileList.map((file) => file.fileName).sort().join('|'),
    ].join('::')
    if (seen.has(key)) return
    seen.add(key)
    keptDocuments.push(document)
    keptFiles.push(...fileList)
  })
  return { documents: keptDocuments, files: keptFiles }
}

function computeArchiveSnapshot(archive: ProjectArchiveRecord): {
  archive: ProjectArchiveRecord
  documents: ProjectArchiveDocumentRecord[]
  files: ProjectArchiveFileRecord[]
  missingItems: ReturnType<typeof computeProjectArchiveMissingItems>
} {
  const project = getProjectById(archive.projectId)
  if (!project) {
    const reason = '未找到正式商品项目，不能同步项目资料归档。'
    upsertProjectArchivePendingItem(buildPendingItem(archive.projectCode, archive.archiveNo, reason))
    throw new Error(reason)
  }

  const style = archive.styleId ? getStyleArchiveById(archive.styleId) : null
  const collected = collectProjectArchiveAutoData(archive, project, style)
  const existingManualDocuments = listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId).filter((item) => item.manualFlag)
  const existingManualFiles = listProjectArchiveFilesByArchiveId(archive.projectArchiveId).filter((item) =>
    existingManualDocuments.some((doc) => doc.archiveDocumentId === item.archiveDocumentId),
  )
  const dedupedManual = dedupeManualDocuments(existingManualDocuments, existingManualFiles)
  const nextDocuments = [...collected.documents, ...dedupedManual.documents]
  const nextFiles = [...collected.files, ...dedupedManual.files]
  const transferNodeId = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')?.projectNodeId || ''
  const missingItems = computeProjectArchiveMissingItems({
    archive,
    documents: nextDocuments,
    currentTechnicalVersion: collected.currentTechnicalVersion,
    transferNodeId,
  })
  const derived = deriveProjectArchiveState({
    archive,
    documents: nextDocuments,
    files: nextFiles,
    missingItems,
    currentTechnicalVersion: collected.currentTechnicalVersion,
  })
  return {
    archive: {
      ...archive,
      styleId: style?.styleId || '',
      styleCode: style?.styleCode || '',
      styleName: style?.styleName || '',
      ...derived,
      updatedAt: nowText(),
      updatedBy: archive.updatedBy,
    },
    documents: nextDocuments,
    files: nextFiles,
    missingItems,
  }
}

function updateProjectAndNodeFromArchive(
  archive: ProjectArchiveRecord,
  operatorName: string,
  mode: 'create' | 'sync' | 'finalize' = 'sync',
): void {
  updateProjectRecord(
    archive.projectId,
    {
      projectArchiveId: archive.projectArchiveId,
      projectArchiveNo: archive.archiveNo,
      projectArchiveStatus: archive.archiveStatus,
      projectArchiveDocumentCount: archive.documentCount,
      projectArchiveFileCount: archive.fileCount,
      projectArchiveMissingItemCount: archive.missingItemCount,
      projectArchiveUpdatedAt: archive.updatedAt,
      projectArchiveFinalizedAt: archive.finalizedAt,
      updatedAt: archive.updatedAt,
    },
    operatorName,
  )

  const node = getProjectNodeRecordByWorkItemTypeCode(archive.projectId, 'PROJECT_TRANSFER_PREP')
  if (!node) return

  if (mode === 'create') {
    updateProjectNodeRecord(
      archive.projectId,
      node.projectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: archive.projectArchiveId,
        latestInstanceCode: archive.archiveNo,
        latestResultType: '已建立项目资料归档',
        latestResultText: '已建立项目资料归档对象，正在收集资料',
        pendingActionType: '补齐归档资料',
        pendingActionText: '请补齐检测资料、报价资料及缺失项',
        updatedAt: archive.updatedAt,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(archive.projectId, node.projectNodeId, operatorName, archive.updatedAt)
    return
  }

  if (archive.archiveStatus === 'FINALIZED') {
    updateProjectNodeRecord(
      archive.projectId,
      node.projectNodeId,
      {
        currentStatus: '已完成',
        latestInstanceId: archive.projectArchiveId,
        latestInstanceCode: archive.archiveNo,
        latestResultType: '项目资料已归档',
        latestResultText: '已完成项目资料归档，形成正式研发资产',
        pendingActionType: '',
        pendingActionText: '',
        updatedAt: archive.finalizedAt || archive.updatedAt,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(
      archive.projectId,
      node.projectNodeId,
      operatorName,
      archive.finalizedAt || archive.updatedAt,
    )
    return
  }

  if (archive.missingItemCount > 0) {
    updateProjectNodeRecord(
      archive.projectId,
      node.projectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: archive.projectArchiveId,
        latestInstanceCode: archive.archiveNo,
        latestResultType: archive.documentCount > 0 ? '项目资料已同步' : '已建立项目资料归档',
        latestResultText:
          archive.documentCount > 0 ? '已同步项目资料归档对象，仍有缺失项' : '已建立项目资料归档对象，正在收集资料',
        pendingActionType: '补齐缺失资料',
        pendingActionText: '请补齐检测资料、报价资料及缺失项',
        updatedAt: archive.updatedAt,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(archive.projectId, node.projectNodeId, operatorName, archive.updatedAt)
    return
  }

  updateProjectNodeRecord(
    archive.projectId,
    node.projectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: archive.projectArchiveId,
      latestInstanceCode: archive.archiveNo,
      latestResultType: '项目资料可完成归档',
      latestResultText: '项目资料已收齐，可以完成归档',
      pendingActionType: '完成归档',
      pendingActionText: '请确认并完成项目资料归档',
      updatedAt: archive.updatedAt,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(archive.projectId, node.projectNodeId, operatorName, archive.updatedAt)
}

export function createProjectArchive(projectId: string, operatorName = '商品中心'): ProjectArchiveCreateResult {
  const project = getProjectById(projectId)
  if (!project) {
    const message = '未找到商品项目，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(projectId, '', message))
    return { ok: false, existed: false, message, archive: null }
  }

  const existingArchive =
    (project.projectArchiveId ? getProjectArchiveById(project.projectArchiveId) : null) ||
    getProjectArchiveByProjectId(project.projectId)
  if (existingArchive) {
    updateProjectAndNodeFromArchive(existingArchive, operatorName)
    return {
      ok: true,
      existed: true,
      message: '当前项目已存在正式项目资料归档对象，已进入已有归档页。',
      archive: existingArchive,
    }
  }

  if (!project.linkedStyleId) {
    const message = '当前项目尚未生成正式款式档案，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(project.projectCode, '', message))
    return { ok: false, existed: false, message, archive: null }
  }

  if (project.projectStatus === '已终止') {
    const message = '当前项目已终止，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(project.projectCode, '', message))
    return { ok: false, existed: false, message, archive: null }
  }

  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
  if (!transferNode) {
    const message = '当前项目未配置“项目转档准备”节点，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(project.projectCode, '', message))
    return { ok: false, existed: false, message, archive: null }
  }

  if (transferNode.currentStatus === '已取消') {
    const message = '当前项目节点已取消，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(project.projectCode, '', message))
    return { ok: false, existed: false, message, archive: null }
  }

  const style = getStyleArchiveById(project.linkedStyleId)
  if (!style) {
    const message = '当前项目关联的正式款式档案不存在，不能创建项目资料归档对象。'
    upsertProjectArchivePendingItem(buildPendingItem(project.projectCode, project.linkedStyleId, message))
    return { ok: false, existed: false, message, archive: null }
  }

  const timestamp = nowText()
  const identity = nextArchiveIdentity(timestamp)
  let archive = upsertProjectArchive({
    projectArchiveId: identity.projectArchiveId,
    archiveNo: identity.archiveNo,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    currentTechnicalVersionId: '',
    currentTechnicalVersionCode: '',
    currentTechnicalVersionLabel: '',
    archiveStatus: 'DRAFT',
    documentCount: 0,
    fileCount: 0,
    autoCollectedCount: 0,
    manualUploadedCount: 0,
    missingItemCount: 0,
    readyForFinalize: false,
    createdAt: timestamp,
    createdBy: operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    finalizedAt: '',
    finalizedBy: '',
    note: '',
  })

  const snapshot = computeArchiveSnapshot(archive)
  replaceProjectArchiveDocuments(archive.projectArchiveId, snapshot.documents)
  replaceProjectArchiveFiles(archive.projectArchiveId, snapshot.files)
  replaceProjectArchiveMissingItems(archive.projectArchiveId, snapshot.missingItems)
  archive = upsertProjectArchive({
    ...snapshot.archive,
    updatedBy: operatorName,
  })
  upsertProjectRelation(buildRelation(archive, operatorName))
  updateProjectAndNodeFromArchive(archive, operatorName, 'create')

  return {
    ok: true,
    existed: false,
    message: '已建立项目资料归档，已写入项目关联，已更新项目节点。',
    archive,
  }
}

export function syncProjectArchive(projectArchiveId: string, operatorName = '商品中心'): ProjectArchiveRecord {
  const current = getProjectArchiveById(projectArchiveId)
  if (!current) throw new Error('未找到项目资料归档对象。')
  const snapshot = computeArchiveSnapshot({
    ...current,
    updatedBy: operatorName,
  })
  replaceProjectArchiveDocuments(projectArchiveId, snapshot.documents)
  replaceProjectArchiveFiles(projectArchiveId, snapshot.files)
  replaceProjectArchiveMissingItems(projectArchiveId, snapshot.missingItems)
  const archive = upsertProjectArchive({
    ...snapshot.archive,
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  upsertProjectRelation(buildRelation(archive, operatorName))
  updateProjectAndNodeFromArchive(archive, operatorName)
  return archive
}

export function syncExistingProjectArchiveByProjectId(projectId: string, operatorName = '系统同步'): void {
  const archive = getProjectArchiveByProjectId(projectId)
  if (!archive) return
  try {
    syncProjectArchive(archive.projectArchiveId, operatorName)
  } catch (error) {
    console.warn('项目资料归档同步失败', error)
    upsertProjectArchivePendingItem(
      buildPendingItem(
        archive.projectCode,
        archive.archiveNo,
        error instanceof Error ? error.message : '项目资料归档自动同步失败。',
      ),
    )
  }
}

export function uploadProjectArchiveManualDocument(
  projectArchiveId: string,
  input: {
    documentGroup: Extract<ProjectArchiveDocumentGroup, 'INSPECTION_FILE' | 'QUOTATION_FILE' | 'OTHER_FILE'>
    title: string
    note: string
    files: Array<{
      fileName: string
      fileType: string
      previewUrl?: string
    }>
  },
  operatorName = '商品中心',
): ProjectArchiveRecord {
  const archive = getProjectArchiveById(projectArchiveId)
  if (!archive) throw new Error('未找到项目资料归档对象。')
  const timestamp = nowText()
  const groupLabelMap = {
    INSPECTION_FILE: '检测资料',
    QUOTATION_FILE: '报价资料',
    OTHER_FILE: '其他说明资料',
  } as const
  const existingManualDocuments = listProjectArchiveDocumentsByArchiveId(projectArchiveId).filter((item) => item.manualFlag)
  const existingManualFiles = listProjectArchiveFilesByArchiveId(projectArchiveId).filter((item) =>
    existingManualDocuments.some((doc) => doc.archiveDocumentId === item.archiveDocumentId),
  )
  const duplicateKey = [
    projectArchiveId,
    input.documentGroup,
    input.title.trim(),
    input.files.map((file) => file.fileName).sort().join('|'),
  ].join('::')
  const hasDuplicate = existingManualDocuments.some((document) => {
    const fileNames = existingManualFiles
      .filter((file) => file.archiveDocumentId === document.archiveDocumentId)
      .map((file) => file.fileName)
      .sort()
      .join('|')
    return [
      projectArchiveId,
      document.documentGroup,
      document.documentTitle.trim(),
      fileNames,
    ].join('::') === duplicateKey
  })
  if (hasDuplicate) {
    return syncProjectArchive(projectArchiveId, operatorName)
  }

  const documentId = `archive_manual_doc_${projectArchiveId}_${timestamp.replace(/[^0-9]/g, '')}`
  const fileRecords = input.files.map((file, index) => ({
    archiveFileId: `archive_manual_file_${projectArchiveId}_${timestamp.replace(/[^0-9]/g, '')}_${index + 1}`,
    projectArchiveId,
    archiveDocumentId: documentId,
    sourceModule: '项目资料归档',
    sourceObjectType: groupLabelMap[input.documentGroup],
    sourceObjectId: projectArchiveId,
    sourceFileId: `${documentId}_${index + 1}`,
    fileName: file.fileName,
    fileType: file.fileType || '文件',
    previewUrl: file.previewUrl || '',
    isPrimary: index === 0,
    sortOrder: index + 1,
    uploadedAt: timestamp,
    uploadedBy: operatorName,
  }))
  upsertProjectArchiveDocuments([
    {
      archiveDocumentId: documentId,
      projectArchiveId,
      projectId: archive.projectId,
      projectCode: archive.projectCode,
      projectNodeId: getProjectNodeRecordByWorkItemTypeCode(archive.projectId, 'PROJECT_TRANSFER_PREP')?.projectNodeId || '',
      workItemTypeCode: 'PROJECT_TRANSFER_PREP',
      workItemTypeName: '项目转档准备',
      sourceModule: '项目资料归档',
      sourceObjectType: groupLabelMap[input.documentGroup],
      sourceObjectId: projectArchiveId,
      sourceObjectCode: archive.archiveNo,
      sourceVersionId: '',
      sourceVersionCode: '',
      sourceVersionLabel: '',
      documentGroup: input.documentGroup,
      documentCategory: groupLabelMap[input.documentGroup],
      documentType: '手工上传资料',
      documentTitle: input.title.trim(),
      documentStatus: '已上传',
      manualFlag: true,
      reusableFlag: true,
      fileCount: fileRecords.length,
      primaryFileId: fileRecords[0]?.archiveFileId || '',
      primaryFileName: fileRecords[0]?.fileName || '',
      previewUrl: fileRecords[0]?.previewUrl || '',
      businessDate: timestamp,
      ownerName: operatorName,
      createdAt: timestamp,
      createdBy: operatorName,
      updatedAt: timestamp,
      updatedBy: operatorName,
      legacySourceRef: input.note.trim(),
    },
  ])
  upsertProjectArchiveFiles(fileRecords)
  return syncProjectArchive(projectArchiveId, operatorName)
}

export function deleteProjectArchiveManualDocument(
  projectArchiveId: string,
  archiveDocumentId: string,
  operatorName = '商品中心',
): ProjectArchiveRecord {
  const archive = getProjectArchiveById(projectArchiveId)
  if (!archive) throw new Error('未找到项目资料归档对象。')
  deleteProjectArchiveDocument(projectArchiveId, archiveDocumentId)
  return syncProjectArchive(projectArchiveId, operatorName)
}

export function finalizeProjectArchive(projectArchiveId: string, operatorName = '商品中心'): ProjectArchiveRecord {
  const archive = getProjectArchiveById(projectArchiveId)
  if (!archive) throw new Error('未找到项目资料归档对象。')
  const synced = syncProjectArchive(projectArchiveId, operatorName)
  if (!synced.readyForFinalize || synced.missingItemCount > 0) {
    throw new Error('当前项目资料仍有缺失项，不能完成归档。')
  }
  const finalizedAt = nowText()
  const nextArchive = upsertProjectArchive({
    ...synced,
    archiveStatus: 'FINALIZED',
    finalizedAt,
    finalizedBy: operatorName,
    updatedAt: finalizedAt,
    updatedBy: operatorName,
  })
  upsertProjectRelation(buildRelation(nextArchive, operatorName))
  updateProjectAndNodeFromArchive(nextArchive, operatorName)
  return nextArchive
}
