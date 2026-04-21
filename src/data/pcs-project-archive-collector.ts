import { getProjectNodeRecordByWorkItemTypeCode } from './pcs-project-repository.ts'
import { listRevisionTasksByProject } from './pcs-revision-task-repository.ts'
import { listPlateMakingTasksByProject } from './pcs-plate-making-repository.ts'
import { listPatternTasksByProject } from './pcs-pattern-task-repository.ts'
import { listFirstSampleTasksByProject } from './pcs-first-sample-repository.ts'
import { listPreProductionSampleTasksByProject } from './pcs-pre-production-sample-repository.ts'
import { listSampleAssets } from './pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents } from './pcs-sample-ledger-repository.ts'
import type { PcsProjectRecord } from './pcs-project-types.ts'
import {
  getProjectImageAssetById,
  listProjectImageAssetsBySourceNode,
  listProjectReferenceImages,
} from './pcs-project-image-repository.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import {
  getCurrentTechPackVersionByStyleId,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
} from './pcs-technical-data-version-repository.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'
import type {
  ProjectArchiveDocumentGroup,
  ProjectArchiveDocumentRecord,
  ProjectArchiveFileRecord,
  ProjectArchiveMissingItemRecord,
  ProjectArchiveRecord,
  ProjectArchiveStatus,
} from './pcs-project-archive-types.ts'

const SAMPLE_EVENT_TYPES_FOR_ARCHIVE = new Set([
  'RECEIVE_ARRIVAL',
  'CHECKIN_VERIFY',
  'SHIP_OUT',
  'DELIVER_SIGNED',
  'RETURN_SUPPLIER',
  'DISPOSAL',
])

export const PROJECT_ARCHIVE_STATUS_LABELS: Record<ProjectArchiveStatus, string> = {
  DRAFT: '待建立',
  COLLECTING: '收集中',
  READY: '可完成归档',
  FINALIZED: '已归档',
}

export const PROJECT_ARCHIVE_GROUP_LABELS: Record<ProjectArchiveDocumentGroup, string> = {
  PROJECT_BASE: '项目基础资料',
  STYLE_ARCHIVE: '款式档案',
  TECHNICAL_DATA: '技术包版本',
  PATTERN_DRAWING: '纸样图纸',
  ARTWORK_ASSET: '花型资料',
  SAMPLE_ASSET: '样衣资料',
  REVISION_RECORD: '改版记录',
  PATTERN_RECORD: '制版记录',
  PATTERN_TASK_RECORD: '花型任务记录',
  CONCLUSION_RECORD: '结论记录',
  INSPECTION_FILE: '检测资料',
  QUOTATION_FILE: '报价资料',
  OTHER_FILE: '其他说明资料',
}

function getTechnicalNodeBinding(projectId: string, version: TechnicalDataVersionRecord) {
  if (version.createdFromTaskType === 'PLATE') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')
    return {
      projectNodeId: node?.projectNodeId || version.sourceProjectNodeId || '',
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: node?.workItemTypeName || '制版任务',
    }
  }

  if (version.createdFromTaskType === 'ARTWORK') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_ARTWORK_TASK')
    return {
      projectNodeId: node?.projectNodeId || version.sourceProjectNodeId || '',
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: node?.workItemTypeName || '花型任务',
    }
  }

  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'REVISION_TASK')
  return {
    projectNodeId: node?.projectNodeId || version.sourceProjectNodeId || '',
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: node?.workItemTypeName || '改版任务',
  }
}

function escapeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function archiveFileNameFromUrl(url: string, fallback: string): string {
  const segment = url.split('/').pop()?.split('?')[0]
  return segment && segment.trim() ? segment : fallback
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function buildDocumentId(
  projectArchiveId: string,
  sourceModule: string,
  sourceObjectType: string,
  sourceObjectId: string,
  sourceVersionId: string,
  documentCategory: string,
  manualFlag: boolean,
): string {
  return [
    'archive_doc',
    projectArchiveId,
    escapeSegment(sourceModule),
    escapeSegment(sourceObjectType),
    escapeSegment(sourceObjectId || 'none'),
    escapeSegment(sourceVersionId || 'none'),
    escapeSegment(documentCategory || 'default'),
    manualFlag ? 'manual' : 'auto',
  ].join('_')
}

function buildFileId(
  projectArchiveId: string,
  archiveDocumentId: string,
  sourceFileId: string,
  fileName: string,
): string {
  return [
    'archive_file',
    projectArchiveId,
    escapeSegment(archiveDocumentId),
    escapeSegment(sourceFileId || fileName || 'file'),
  ].join('_')
}

function createDocumentRecord(input: ProjectArchiveDocumentRecord): ProjectArchiveDocumentRecord {
  return { ...input }
}

function createFileRecord(input: ProjectArchiveFileRecord): ProjectArchiveFileRecord {
  return { ...input }
}

function pushDocumentWithFiles(
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
  document: ProjectArchiveDocumentRecord,
  nextFiles: ProjectArchiveFileRecord[] = [],
): void {
  documents.push(document)
  nextFiles.forEach((file) => files.push(file))
}

function buildProjectBaseDocuments(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
): void {
  const documentId = buildDocumentId(
    archive.projectArchiveId,
    '商品项目',
    '商品项目基础资料',
    project.projectId,
    '',
    '项目基础资料',
    false,
  )
  const referenceImages = listProjectReferenceImages(project.projectId)
  const projectFiles = referenceImages.map((image, index) => {
    const fileName = archiveFileNameFromUrl(image.imageUrl, image.imageName || `项目参考图-${index + 1}.png`)
    return createFileRecord({
      archiveFileId: buildFileId(archive.projectArchiveId, documentId, image.imageId || `${project.projectId}_${index}`, fileName),
      projectArchiveId: archive.projectArchiveId,
      archiveDocumentId: documentId,
      sourceModule: '商品项目',
      sourceObjectType: '商品项目基础资料',
      sourceObjectId: project.projectId,
      sourceFileId: image.imageId || `${project.projectId}_${index}`,
      fileName,
      fileType: fileName.split('.').pop()?.toUpperCase() || '图片',
      previewUrl: image.imageUrl,
      isPrimary: index === 0,
      sortOrder: index + 1,
      uploadedAt: image.updatedAt || project.updatedAt,
      uploadedBy: image.updatedBy || project.updatedBy,
    })
  })

  pushDocumentWithFiles(
    documents,
    files,
    createDocumentRecord({
      archiveDocumentId: documentId,
      projectArchiveId: archive.projectArchiveId,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: '',
      workItemTypeCode: '',
      workItemTypeName: '',
      sourceModule: '商品项目',
      sourceObjectType: '商品项目基础资料',
      sourceObjectId: project.projectId,
      sourceObjectCode: project.projectCode,
      sourceVersionId: '',
      sourceVersionCode: '',
      sourceVersionLabel: '',
      documentGroup: 'PROJECT_BASE',
      documentCategory: '项目基础资料',
      documentType: '项目基础信息',
      documentTitle: `${project.projectName}基础资料`,
      documentStatus: project.projectStatus,
      manualFlag: false,
      reusableFlag: true,
      fileCount: projectFiles.length,
      primaryFileId: projectFiles[0]?.archiveFileId || '',
      primaryFileName: projectFiles[0]?.fileName || '',
      previewUrl: projectFiles[0]?.previewUrl || '',
      businessDate: project.updatedAt,
      ownerName: project.ownerName,
      createdAt: archive.createdAt,
      createdBy: archive.createdBy,
      updatedAt: project.updatedAt,
      updatedBy: project.updatedBy,
      legacySourceRef: '',
    }),
    projectFiles,
  )
}

function buildStyleArchiveDocument(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  style: StyleArchiveShellRecord,
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
): void {
  const documentId = buildDocumentId(
    archive.projectArchiveId,
    '款式档案',
    '款式档案',
    style.styleId,
    '',
    '款式档案',
    false,
  )
  const imageIds = Array.from(new Set([
    style.mainImageId,
    ...(style.galleryImageIds || []),
  ].filter(Boolean)))
  const imageAssets = imageIds
    .map((imageId) => getProjectImageAssetById(imageId))
    .filter((item): item is NonNullable<ReturnType<typeof getProjectImageAssetById>> => Boolean(item))
  const imageFiles = (imageAssets.length > 0
    ? imageAssets.map((image, index) =>
        createFileRecord({
          archiveFileId: buildFileId(archive.projectArchiveId, documentId, image.imageId, image.imageName),
          projectArchiveId: archive.projectArchiveId,
          archiveDocumentId: documentId,
          sourceModule: '款式档案',
          sourceObjectType: '款式档案图片',
          sourceObjectId: style.styleId,
          sourceFileId: image.imageId,
          fileName: image.imageName || archiveFileNameFromUrl(image.imageUrl, `款式档案图-${index + 1}.png`),
          fileType: '图片',
          previewUrl: image.imageUrl,
          isPrimary: image.imageId === style.mainImageId || (!style.mainImageId && index === 0),
          sortOrder: index + 1,
          uploadedAt: image.updatedAt || style.updatedAt,
          uploadedBy: image.updatedBy || style.updatedBy,
        }),
      )
    : uniqueStrings([style.mainImageUrl, ...(style.galleryImageUrls || [])]).map((imageUrl, index) =>
        createFileRecord({
          archiveFileId: buildFileId(archive.projectArchiveId, documentId, `${style.styleId}_${index + 1}`, archiveFileNameFromUrl(imageUrl, `款式档案图-${index + 1}.png`)),
          projectArchiveId: archive.projectArchiveId,
          archiveDocumentId: documentId,
          sourceModule: '款式档案',
          sourceObjectType: '款式档案图片',
          sourceObjectId: style.styleId,
          sourceFileId: `${style.styleId}_${index + 1}`,
          fileName: archiveFileNameFromUrl(imageUrl, `款式档案图-${index + 1}.png`),
          fileType: '图片',
          previewUrl: imageUrl,
          isPrimary: imageUrl === style.mainImageUrl || (!style.mainImageUrl && index === 0),
          sortOrder: index + 1,
          uploadedAt: style.updatedAt,
          uploadedBy: style.updatedBy,
        }),
      )) as ProjectArchiveFileRecord[]

  pushDocumentWithFiles(
    documents,
    files,
    createDocumentRecord({
      archiveDocumentId: documentId,
      projectArchiveId: archive.projectArchiveId,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: style.sourceProjectNodeId || '',
      workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
      workItemTypeName: '生成款式档案',
      sourceModule: '款式档案',
      sourceObjectType: '款式档案',
      sourceObjectId: style.styleId,
      sourceObjectCode: style.styleCode,
      sourceVersionId: '',
      sourceVersionCode: '',
      sourceVersionLabel: '',
      documentGroup: 'STYLE_ARCHIVE',
      documentCategory: '款式档案',
      documentType: '款式档案壳',
      documentTitle: style.styleName,
      documentStatus: style.archiveStatus,
      manualFlag: false,
      reusableFlag: true,
      fileCount: imageFiles.length,
      primaryFileId: imageFiles.find((item) => item.isPrimary)?.archiveFileId || '',
      primaryFileName: imageFiles.find((item) => item.isPrimary)?.fileName || '',
      previewUrl: imageFiles.find((item) => item.isPrimary)?.previewUrl || '',
      businessDate: style.generatedAt,
      ownerName: style.generatedBy,
      createdAt: archive.createdAt,
      createdBy: archive.createdBy,
      updatedAt: style.updatedAt,
      updatedBy: style.updatedBy,
      legacySourceRef: style.legacyOriginProject || '',
    }),
    imageFiles,
  )
}

function buildTechnicalDocuments(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  style: StyleArchiveShellRecord,
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
): TechnicalDataVersionRecord | null {
  const versions = listTechnicalDataVersionsByStyleId(style.styleId)
  versions.forEach((version) => {
    const nodeBinding = getTechnicalNodeBinding(project.projectId, version)
    const documentId = buildDocumentId(
      archive.projectArchiveId,
      '技术包',
      '技术包版本',
      version.technicalVersionId,
      version.technicalVersionId,
      '技术包版本',
      false,
    )
    documents.push(
      createDocumentRecord({
        archiveDocumentId: documentId,
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: nodeBinding.projectNodeId,
        workItemTypeCode: nodeBinding.workItemTypeCode,
        workItemTypeName: nodeBinding.workItemTypeName,
        sourceModule: '技术包',
        sourceObjectType: '技术包版本',
        sourceObjectId: version.technicalVersionId,
        sourceObjectCode: version.technicalVersionCode,
        sourceVersionId: version.technicalVersionId,
        sourceVersionCode: version.technicalVersionCode,
        sourceVersionLabel: version.versionLabel,
        documentGroup: 'TECHNICAL_DATA',
        documentCategory: '技术包版本',
        documentType: '技术包版本',
        documentTitle: `${version.styleName} ${version.versionLabel}`,
        documentStatus: version.versionStatus,
        manualFlag: false,
        reusableFlag: version.versionStatus === 'PUBLISHED',
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: version.publishedAt || version.updatedAt || version.createdAt,
        ownerName: version.updatedBy || version.createdBy,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: version.updatedAt,
        updatedBy: version.updatedBy,
        legacySourceRef: version.legacyVersionLabel || version.legacySpuCode,
      }),
    )

    const content = getTechnicalDataVersionContent(version.technicalVersionId)
    if (!content) return

    content.patternFiles.forEach((patternFile, index) => {
      const drawingDocumentId = buildDocumentId(
        archive.projectArchiveId,
        '技术包',
        '纸样文件',
        version.technicalVersionId,
        version.technicalVersionId,
        patternFile.id || `pattern_${index + 1}`,
        false,
      )
      const archiveFile = createFileRecord({
        archiveFileId: buildFileId(
          archive.projectArchiveId,
          drawingDocumentId,
          patternFile.id || `pattern_${index + 1}`,
          patternFile.fileName,
        ),
        projectArchiveId: archive.projectArchiveId,
        archiveDocumentId: drawingDocumentId,
        sourceModule: '技术包',
        sourceObjectType: '纸样文件',
        sourceObjectId: version.technicalVersionId,
        sourceFileId: patternFile.id || `pattern_${index + 1}`,
        fileName: patternFile.fileName,
        fileType: patternFile.fileName.split('.').pop()?.toUpperCase() || '图纸',
        previewUrl: patternFile.fileUrl,
        isPrimary: true,
        sortOrder: 1,
        uploadedAt: patternFile.uploadedAt,
        uploadedBy: patternFile.uploadedBy,
      })
      pushDocumentWithFiles(
        documents,
        files,
        createDocumentRecord({
          archiveDocumentId: drawingDocumentId,
          projectArchiveId: archive.projectArchiveId,
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectNodeId: nodeBinding.projectNodeId,
          workItemTypeCode: nodeBinding.workItemTypeCode,
          workItemTypeName: nodeBinding.workItemTypeName,
          sourceModule: '技术包',
          sourceObjectType: '纸样文件',
          sourceObjectId: version.technicalVersionId,
          sourceObjectCode: version.technicalVersionCode,
          sourceVersionId: version.technicalVersionId,
          sourceVersionCode: version.technicalVersionCode,
          sourceVersionLabel: version.versionLabel,
          documentGroup: 'PATTERN_DRAWING',
          documentCategory: '纸样图纸',
          documentType: '纸样文件',
          documentTitle: patternFile.fileName,
          documentStatus: version.versionStatus,
          manualFlag: false,
          reusableFlag: version.versionStatus === 'PUBLISHED',
          fileCount: 1,
          primaryFileId: archiveFile.archiveFileId,
          primaryFileName: archiveFile.fileName,
          previewUrl: archiveFile.previewUrl,
          businessDate: patternFile.uploadedAt || version.updatedAt,
          ownerName: patternFile.uploadedBy,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          updatedAt: patternFile.uploadedAt || version.updatedAt,
          updatedBy: patternFile.uploadedBy || version.updatedBy,
          legacySourceRef: '',
        }),
        [archiveFile],
      )
    })

    content.patternDesigns.forEach((design, index) => {
      const designDocumentId = buildDocumentId(
        archive.projectArchiveId,
        '技术包',
        '花型设计',
        version.technicalVersionId,
        version.technicalVersionId,
        design.id || `design_${index + 1}`,
        false,
      )
      const designFile = createFileRecord({
        archiveFileId: buildFileId(
          archive.projectArchiveId,
          designDocumentId,
          design.id || `design_${index + 1}`,
          design.name,
        ),
        projectArchiveId: archive.projectArchiveId,
        archiveDocumentId: designDocumentId,
        sourceModule: '技术包',
        sourceObjectType: '花型设计',
        sourceObjectId: version.technicalVersionId,
        sourceFileId: design.id || `design_${index + 1}`,
        fileName: design.name,
        fileType: '图片',
        previewUrl: design.imageUrl,
        isPrimary: true,
        sortOrder: 1,
        uploadedAt: version.updatedAt,
        uploadedBy: version.updatedBy,
      })
      pushDocumentWithFiles(
        documents,
        files,
        createDocumentRecord({
          archiveDocumentId: designDocumentId,
          projectArchiveId: archive.projectArchiveId,
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectNodeId: nodeBinding.projectNodeId,
          workItemTypeCode: nodeBinding.workItemTypeCode,
          workItemTypeName: nodeBinding.workItemTypeName,
          sourceModule: '技术包',
          sourceObjectType: '花型设计',
          sourceObjectId: version.technicalVersionId,
          sourceObjectCode: version.technicalVersionCode,
          sourceVersionId: version.technicalVersionId,
          sourceVersionCode: version.technicalVersionCode,
          sourceVersionLabel: version.versionLabel,
          documentGroup: 'ARTWORK_ASSET',
          documentCategory: '花型资料',
          documentType: '花型设计',
          documentTitle: design.name,
          documentStatus: version.versionStatus,
          manualFlag: false,
          reusableFlag: version.versionStatus === 'PUBLISHED',
          fileCount: 1,
          primaryFileId: designFile.archiveFileId,
          primaryFileName: designFile.fileName,
          previewUrl: designFile.previewUrl,
          businessDate: version.updatedAt,
          ownerName: version.updatedBy,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          updatedAt: version.updatedAt,
          updatedBy: version.updatedBy,
          legacySourceRef: '',
        }),
        [designFile],
      )
    })

    content.attachments.forEach((attachment, index) => {
      const attachmentDocumentId = buildDocumentId(
        archive.projectArchiveId,
        '技术包',
        '技术包附件',
        version.technicalVersionId,
        version.technicalVersionId,
        attachment.id || `attachment_${index + 1}`,
        false,
      )
      const attachmentFile = createFileRecord({
        archiveFileId: buildFileId(
          archive.projectArchiveId,
          attachmentDocumentId,
          attachment.id || `attachment_${index + 1}`,
          attachment.fileName,
        ),
        projectArchiveId: archive.projectArchiveId,
        archiveDocumentId: attachmentDocumentId,
        sourceModule: '技术包',
        sourceObjectType: '技术包附件',
        sourceObjectId: version.technicalVersionId,
        sourceFileId: attachment.id || `attachment_${index + 1}`,
        fileName: attachment.fileName,
        fileType: attachment.fileType || '附件',
        previewUrl: attachment.downloadUrl,
        isPrimary: true,
        sortOrder: 1,
        uploadedAt: attachment.uploadedAt,
        uploadedBy: attachment.uploadedBy,
      })
      pushDocumentWithFiles(
        documents,
        files,
        createDocumentRecord({
          archiveDocumentId: attachmentDocumentId,
          projectArchiveId: archive.projectArchiveId,
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectNodeId: nodeBinding.projectNodeId,
          workItemTypeCode: nodeBinding.workItemTypeCode,
          workItemTypeName: nodeBinding.workItemTypeName,
          sourceModule: '技术包',
          sourceObjectType: '技术包附件',
          sourceObjectId: version.technicalVersionId,
          sourceObjectCode: version.technicalVersionCode,
          sourceVersionId: version.technicalVersionId,
          sourceVersionCode: version.technicalVersionCode,
          sourceVersionLabel: version.versionLabel,
          documentGroup: 'TECHNICAL_DATA',
          documentCategory: '技术包附件',
          documentType: '附件',
          documentTitle: attachment.fileName,
          documentStatus: version.versionStatus,
          manualFlag: false,
          reusableFlag: false,
          fileCount: 1,
          primaryFileId: attachmentFile.archiveFileId,
          primaryFileName: attachmentFile.fileName,
          previewUrl: attachmentFile.previewUrl,
          businessDate: attachment.uploadedAt,
          ownerName: attachment.uploadedBy,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          updatedAt: attachment.uploadedAt,
          updatedBy: attachment.uploadedBy,
          legacySourceRef: '',
        }),
        [attachmentFile],
      )
    })
  })

  return getCurrentTechPackVersionByStyleId(style.styleId)
}

function buildRevisionDocuments(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  documents: ProjectArchiveDocumentRecord[],
): void {
  listRevisionTasksByProject(project.projectId).forEach((task) => {
    documents.push(
      createDocumentRecord({
        archiveDocumentId: buildDocumentId(archive.projectArchiveId, '改版任务', '改版任务', task.revisionTaskId, '', '改版任务', false),
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceModule: '改版任务',
        sourceObjectType: '改版任务',
        sourceObjectId: task.revisionTaskId,
        sourceObjectCode: task.revisionTaskCode,
        sourceVersionId: '',
        sourceVersionCode: '',
        sourceVersionLabel: '',
        documentGroup: 'REVISION_RECORD',
        documentCategory: '改版记录',
        documentType: '改版任务',
        documentTitle: task.title,
        documentStatus: task.status,
        manualFlag: false,
        reusableFlag: true,
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: task.updatedAt,
        updatedBy: task.updatedBy,
        legacySourceRef: task.legacyUpstreamRef,
      }),
    )
  })
}

function buildPatternTaskDocuments(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  documents: ProjectArchiveDocumentRecord[],
): void {
  listPlateMakingTasksByProject(project.projectId).forEach((task) => {
    documents.push(
      createDocumentRecord({
        archiveDocumentId: buildDocumentId(archive.projectArchiveId, '制版任务', '制版任务', task.plateTaskId, '', '制版任务', false),
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceModule: '制版任务',
        sourceObjectType: '制版任务',
        sourceObjectId: task.plateTaskId,
        sourceObjectCode: task.plateTaskCode,
        sourceVersionId: task.patternVersion || '',
        sourceVersionCode: task.patternVersion || '',
        sourceVersionLabel: '',
        documentGroup: 'PATTERN_RECORD',
        documentCategory: '制版记录',
        documentType: '制版任务',
        documentTitle: task.title,
        documentStatus: task.status,
        manualFlag: false,
        reusableFlag: true,
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: task.updatedAt,
        updatedBy: task.updatedBy,
        legacySourceRef: task.legacyUpstreamRef,
      }),
    )
  })

  listPatternTasksByProject(project.projectId).forEach((task) => {
    documents.push(
      createDocumentRecord({
        archiveDocumentId: buildDocumentId(archive.projectArchiveId, '花型任务', '花型任务', task.patternTaskId, '', '花型任务', false),
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceModule: '花型任务',
        sourceObjectType: '花型任务',
        sourceObjectId: task.patternTaskId,
        sourceObjectCode: task.patternTaskCode,
        sourceVersionId: task.artworkVersion || '',
        sourceVersionCode: task.artworkVersion || '',
        sourceVersionLabel: '',
        documentGroup: 'PATTERN_TASK_RECORD',
        documentCategory: '花型任务记录',
        documentType: '花型任务',
        documentTitle: task.title,
        documentStatus: task.status,
        manualFlag: false,
        reusableFlag: true,
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: task.updatedAt,
        updatedBy: task.updatedBy,
        legacySourceRef: task.legacyUpstreamRef,
      }),
    )
  })
}

function buildSampleDocuments(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  documents: ProjectArchiveDocumentRecord[],
  files: ProjectArchiveFileRecord[],
): void {
  const sampleShootImages = listProjectImageAssetsBySourceNode(project.projectId, 'SAMPLE_SHOOT_FIT')
  if (sampleShootImages.length > 0) {
    const sampleShootNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'SAMPLE_SHOOT_FIT')
    const documentId = buildDocumentId(
      archive.projectArchiveId,
      '样衣拍摄与试穿',
      '样衣拍摄图片',
      project.projectId,
      '',
      '样衣拍摄图片',
      false,
    )
    const imageFiles = sampleShootImages.map((image, index) =>
      createFileRecord({
        archiveFileId: buildFileId(archive.projectArchiveId, documentId, image.imageId, image.imageName),
        projectArchiveId: archive.projectArchiveId,
        archiveDocumentId: documentId,
        sourceModule: '样衣拍摄与试穿',
        sourceObjectType: '样衣拍摄图片',
        sourceObjectId: project.projectId,
        sourceFileId: image.imageId,
        fileName: archiveFileNameFromUrl(image.imageUrl, image.imageName || `样衣拍摄图片-${index + 1}.png`),
        fileType: image.imageType,
        previewUrl: image.imageUrl,
        isPrimary: index === 0,
        sortOrder: index + 1,
        uploadedAt: image.updatedAt,
        uploadedBy: image.updatedBy,
      }),
    )
    pushDocumentWithFiles(
      documents,
      files,
      createDocumentRecord({
        archiveDocumentId: documentId,
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: sampleShootNode?.projectNodeId || '',
        workItemTypeCode: sampleShootNode?.workItemTypeCode || 'SAMPLE_SHOOT_FIT',
        workItemTypeName: sampleShootNode?.workItemTypeName || '样衣拍摄与试穿',
        sourceModule: '样衣拍摄与试穿',
        sourceObjectType: '样衣拍摄图片',
        sourceObjectId: project.projectId,
        sourceObjectCode: project.projectCode,
        sourceVersionId: '',
        sourceVersionCode: '',
        sourceVersionLabel: '',
        documentGroup: 'SAMPLE_ASSET',
        documentCategory: '样衣拍摄图片',
        documentType: '样衣图片',
        documentTitle: `${project.projectName}样衣拍摄图片`,
        documentStatus: sampleShootNode?.currentStatus || '已采集',
        manualFlag: false,
        reusableFlag: true,
        fileCount: imageFiles.length,
        primaryFileId: imageFiles[0]?.archiveFileId || '',
        primaryFileName: imageFiles[0]?.fileName || '',
        previewUrl: imageFiles[0]?.previewUrl || '',
        businessDate: sampleShootNode?.updatedAt || archive.updatedAt,
        ownerName: sampleShootNode?.currentOwnerName || project.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: sampleShootNode?.updatedAt || archive.updatedAt,
        updatedBy: sampleShootNode?.currentOwnerName || archive.updatedBy,
        legacySourceRef: '',
      }),
      imageFiles,
    )
  }

  listFirstSampleTasksByProject(project.projectId).forEach((task) => {
    documents.push(
      createDocumentRecord({
        archiveDocumentId: buildDocumentId(archive.projectArchiveId, '首版样衣打样', '首版样衣打样任务', task.firstSampleTaskId, '', '首版样衣打样', false),
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceModule: '首版样衣打样',
        sourceObjectType: '首版样衣打样任务',
        sourceObjectId: task.firstSampleTaskId,
        sourceObjectCode: task.firstSampleTaskCode,
        sourceVersionId: '',
        sourceVersionCode: '',
        sourceVersionLabel: '',
        documentGroup: 'SAMPLE_ASSET',
        documentCategory: '首版样衣打样',
        documentType: '样衣打样任务',
        documentTitle: task.title,
        documentStatus: task.status,
        manualFlag: false,
        reusableFlag: true,
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: task.updatedAt,
        updatedBy: task.updatedBy,
        legacySourceRef: task.legacyUpstreamRef,
      }),
    )
  })

  listPreProductionSampleTasksByProject(project.projectId).forEach((task) => {
    documents.push(
      createDocumentRecord({
        archiveDocumentId: buildDocumentId(archive.projectArchiveId, '产前版样衣', '产前版样衣任务', task.preProductionSampleTaskId, '', '产前版样衣', false),
        projectArchiveId: archive.projectArchiveId,
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: task.workItemTypeCode,
        workItemTypeName: task.workItemTypeName,
        sourceModule: '产前版样衣',
        sourceObjectType: '产前版样衣任务',
        sourceObjectId: task.preProductionSampleTaskId,
        sourceObjectCode: task.preProductionSampleTaskCode,
        sourceVersionId: '',
        sourceVersionCode: '',
        sourceVersionLabel: '',
        documentGroup: 'SAMPLE_ASSET',
        documentCategory: '产前版样衣',
        documentType: '产前版样衣任务',
        documentTitle: task.title,
        documentStatus: task.status,
        manualFlag: false,
        reusableFlag: true,
        fileCount: 0,
        primaryFileId: '',
        primaryFileName: '',
        previewUrl: '',
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        createdAt: archive.createdAt,
        createdBy: archive.createdBy,
        updatedAt: task.updatedAt,
        updatedBy: task.updatedBy,
        legacySourceRef: task.legacyUpstreamRef,
      }),
    )
  })

  listSampleAssets()
    .filter((asset) => asset.projectId === project.projectId)
    .forEach((asset) => {
      documents.push(
        createDocumentRecord({
          archiveDocumentId: buildDocumentId(archive.projectArchiveId, '样衣资产', '样衣资产', asset.sampleAssetId, '', '样衣资产', false),
          projectArchiveId: archive.projectArchiveId,
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectNodeId: asset.projectNodeId || '',
          workItemTypeCode: asset.workItemTypeCode || '',
          workItemTypeName: asset.workItemTypeName || '',
          sourceModule: '样衣资产',
          sourceObjectType: '样衣资产',
          sourceObjectId: asset.sampleAssetId,
          sourceObjectCode: asset.sampleCode,
          sourceVersionId: '',
          sourceVersionCode: '',
          sourceVersionLabel: '',
          documentGroup: 'SAMPLE_ASSET',
          documentCategory: '样衣资产',
          documentType: asset.sampleType || '样衣',
          documentTitle: asset.sampleName,
          documentStatus: asset.inventoryStatus,
          manualFlag: false,
          reusableFlag: true,
          fileCount: 0,
          primaryFileId: '',
          primaryFileName: '',
          previewUrl: '',
          businessDate: asset.updatedAt,
          ownerName: asset.updatedBy || asset.custodianName,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          updatedAt: asset.updatedAt,
          updatedBy: asset.updatedBy,
          legacySourceRef: asset.legacyProjectRef || '',
        }),
      )
    })

  listSampleLedgerEvents()
    .filter((event) => event.projectId === project.projectId && SAMPLE_EVENT_TYPES_FOR_ARCHIVE.has(event.eventType))
    .forEach((event) => {
      documents.push(
        createDocumentRecord({
          archiveDocumentId: buildDocumentId(archive.projectArchiveId, '样衣台账', '样衣台账事件', event.ledgerEventId, '', event.eventType, false),
          projectArchiveId: archive.projectArchiveId,
          projectId: project.projectId,
          projectCode: project.projectCode,
          projectNodeId: event.projectNodeId || '',
          workItemTypeCode: event.workItemTypeCode || '',
          workItemTypeName: event.workItemTypeName || '',
          sourceModule: '样衣台账',
          sourceObjectType: '样衣台账事件',
          sourceObjectId: event.ledgerEventId,
          sourceObjectCode: event.ledgerEventCode,
          sourceVersionId: '',
          sourceVersionCode: '',
          sourceVersionLabel: '',
          documentGroup: 'SAMPLE_ASSET',
          documentCategory: '样衣台账关键事件',
          documentType: event.eventName,
          documentTitle: `${event.sampleName} / ${event.eventName}`,
          documentStatus: event.inventoryStatusAfter,
          manualFlag: false,
          reusableFlag: false,
          fileCount: 0,
          primaryFileId: '',
          primaryFileName: '',
          previewUrl: '',
          businessDate: event.businessDate,
          ownerName: event.operatorName,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          updatedAt: event.businessDate,
          updatedBy: event.operatorName,
          legacySourceRef: event.legacyProjectRef || '',
        }),
      )
    })
}

function buildConclusionDocument(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  documents: ProjectArchiveDocumentRecord[],
): void {
  const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
  if (!conclusionNode || !conclusionNode.latestResultText) return
  documents.push(
    createDocumentRecord({
      archiveDocumentId: buildDocumentId(archive.projectArchiveId, '商品项目', '测款结论', project.projectId, '', '测款结论', false),
      projectArchiveId: archive.projectArchiveId,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: conclusionNode.projectNodeId,
      workItemTypeCode: conclusionNode.workItemTypeCode,
      workItemTypeName: conclusionNode.workItemTypeName,
      sourceModule: '商品项目',
      sourceObjectType: '测款结论',
      sourceObjectId: project.projectId,
      sourceObjectCode: project.projectCode,
      sourceVersionId: '',
      sourceVersionCode: '',
      sourceVersionLabel: '',
      documentGroup: 'CONCLUSION_RECORD',
      documentCategory: '结论记录',
      documentType: conclusionNode.latestResultType || '测款结论',
      documentTitle: conclusionNode.latestResultType || `${project.projectName}结论`,
      documentStatus: conclusionNode.currentStatus,
      manualFlag: false,
      reusableFlag: true,
      fileCount: 0,
      primaryFileId: '',
      primaryFileName: '',
      previewUrl: '',
      businessDate: conclusionNode.updatedAt || project.updatedAt,
      ownerName: conclusionNode.currentOwnerName || project.ownerName,
      createdAt: archive.createdAt,
      createdBy: archive.createdBy,
      updatedAt: conclusionNode.updatedAt || project.updatedAt,
      updatedBy: project.updatedBy,
      legacySourceRef: '',
    }),
  )
}

export interface ProjectArchiveAutoCollectResult {
  style: StyleArchiveShellRecord | null
  currentTechnicalVersion: TechnicalDataVersionRecord | null
  documents: ProjectArchiveDocumentRecord[]
  files: ProjectArchiveFileRecord[]
  autoCollectedCount: number
}

export function collectProjectArchiveAutoData(
  archive: ProjectArchiveRecord,
  project: PcsProjectRecord,
  style: StyleArchiveShellRecord | null,
): ProjectArchiveAutoCollectResult {
  const documents: ProjectArchiveDocumentRecord[] = []
  const files: ProjectArchiveFileRecord[] = []

  buildProjectBaseDocuments(archive, project, documents, files)
  let currentTechnicalVersion: TechnicalDataVersionRecord | null = null

  if (style) {
    buildStyleArchiveDocument(archive, project, style, documents, files)
    currentTechnicalVersion = buildTechnicalDocuments(archive, project, style, documents, files)
  }

  buildRevisionDocuments(archive, project, documents)
  buildPatternTaskDocuments(archive, project, documents)
  buildSampleDocuments(archive, project, documents, files)
  buildConclusionDocument(archive, project, documents)

  return {
    style,
    currentTechnicalVersion,
    documents,
    files,
    autoCollectedCount: documents.filter((item) => !item.manualFlag).length,
  }
}

function buildMissingItem(
  archive: ProjectArchiveRecord,
  transferNodeId: string,
  reasonCode: string,
  reasonText: string,
): ProjectArchiveMissingItemRecord {
  const labelMap: Record<string, string> = {
    PROJECT_BASE: '项目基础资料',
    STYLE_ARCHIVE: '款式档案',
    TECHNICAL_VERSION: '当前生效技术包版本',
    SAMPLE_DATA: '样衣资料',
    INSPECTION_FILE: '检测资料',
    QUOTATION_FILE: '报价资料',
  }
  return {
    archiveMissingItemId: `archive_missing_${archive.projectArchiveId}_${reasonCode}`,
    projectArchiveId: archive.projectArchiveId,
    itemCode: reasonCode,
    itemName: labelMap[reasonCode] || reasonCode,
    requiredFlag: true,
    projectNodeId: transferNodeId,
    workItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    workItemTypeName: '生成款式档案',
    reasonType: '资料缺失',
    reasonText,
    status: '待补齐',
    createdAt: archive.updatedAt,
    updatedAt: archive.updatedAt,
  }
}

export function computeProjectArchiveMissingItems(input: {
  archive: ProjectArchiveRecord
  documents: ProjectArchiveDocumentRecord[]
  currentTechnicalVersion: TechnicalDataVersionRecord | null
  transferNodeId: string
}): ProjectArchiveMissingItemRecord[] {
  const { archive, documents, currentTechnicalVersion, transferNodeId } = input
  const hasGroup = (group: ProjectArchiveDocumentGroup) => documents.some((item) => item.documentGroup === group)
  const hasCategory = (group: ProjectArchiveDocumentGroup, category: string) =>
    documents.some((item) => item.documentGroup === group && item.documentCategory === category)

  const missingItems: ProjectArchiveMissingItemRecord[] = []
  if (!hasGroup('PROJECT_BASE')) {
    missingItems.push(buildMissingItem(archive, transferNodeId, 'PROJECT_BASE', '缺少项目基础资料，请补齐项目基础资料与参考附件。'))
  }
  if (!hasGroup('STYLE_ARCHIVE')) {
    missingItems.push(buildMissingItem(archive, transferNodeId, 'STYLE_ARCHIVE', '缺少正式款式档案，请先生成款式档案壳。'))
  }
  if (!currentTechnicalVersion || currentTechnicalVersion.versionStatus !== 'PUBLISHED') {
    missingItems.push(
      buildMissingItem(
        archive,
        transferNodeId,
        'TECHNICAL_VERSION',
        '缺少当前生效技术包版本，或当前版本尚未发布。',
      ),
    )
  }
  if (!hasGroup('SAMPLE_ASSET')) {
    missingItems.push(buildMissingItem(archive, transferNodeId, 'SAMPLE_DATA', '缺少样衣资料，请补齐样衣任务、样衣资产或关键样衣事件。'))
  }
  if (!hasCategory('INSPECTION_FILE', '检测资料')) {
    missingItems.push(buildMissingItem(archive, transferNodeId, 'INSPECTION_FILE', '缺少检测资料，请上传至少 1 份检测资料。'))
  }
  if (!hasCategory('QUOTATION_FILE', '报价资料')) {
    missingItems.push(buildMissingItem(archive, transferNodeId, 'QUOTATION_FILE', '缺少报价资料，请上传至少 1 份报价资料。'))
  }
  return missingItems
}

export function deriveProjectArchiveState(input: {
  archive: ProjectArchiveRecord
  documents: ProjectArchiveDocumentRecord[]
  files: ProjectArchiveFileRecord[]
  missingItems: ProjectArchiveMissingItemRecord[]
  currentTechnicalVersion: TechnicalDataVersionRecord | null
}): Pick<
  ProjectArchiveRecord,
  | 'archiveStatus'
  | 'documentCount'
  | 'fileCount'
  | 'autoCollectedCount'
  | 'manualUploadedCount'
  | 'missingItemCount'
  | 'readyForFinalize'
  | 'currentTechnicalVersionId'
  | 'currentTechnicalVersionCode'
  | 'currentTechnicalVersionLabel'
> {
  const { documents, files, missingItems, currentTechnicalVersion } = input
  const documentCount = documents.length
  const fileCount = files.length
  const autoCollectedCount = documents.filter((item) => !item.manualFlag).length
  const manualUploadedCount = documents.filter((item) => item.manualFlag).length
  const missingItemCount = missingItems.length
  const readyForFinalize = missingItemCount === 0 && Boolean(input.archive.styleId) && Boolean(currentTechnicalVersion)

  const archiveStatus: ProjectArchiveStatus =
    input.archive.archiveStatus === 'FINALIZED'
      ? 'FINALIZED'
      : documentCount === 0
        ? 'DRAFT'
        : missingItemCount > 0
          ? 'COLLECTING'
          : 'READY'

  return {
    archiveStatus,
    documentCount,
    fileCount,
    autoCollectedCount,
    manualUploadedCount,
    missingItemCount,
    readyForFinalize,
    currentTechnicalVersionId: currentTechnicalVersion?.technicalVersionId || '',
    currentTechnicalVersionCode: currentTechnicalVersion?.technicalVersionCode || '',
    currentTechnicalVersionLabel: currentTechnicalVersion?.versionLabel || '',
  }
}
