export type ProjectArchiveStatus = 'DRAFT' | 'COLLECTING' | 'READY' | 'FINALIZED'

export type ProjectArchiveDocumentGroup =
  | 'PROJECT_BASE'
  | 'STYLE_ARCHIVE'
  | 'TECHNICAL_DATA'
  | 'TECH_PACK_LOG'
  | 'PATTERN_DRAWING'
  | 'ARTWORK_ASSET'
  | 'SAMPLE_ASSET'
  | 'REVISION_RECORD'
  | 'PATTERN_RECORD'
  | 'PATTERN_TASK_RECORD'
  | 'CONCLUSION_RECORD'
  | 'INSPECTION_FILE'
  | 'QUOTATION_FILE'
  | 'OTHER_FILE'

export interface ProjectArchiveRecord {
  projectArchiveId: string
  archiveNo: string
  projectId: string
  projectCode: string
  projectName: string
  styleId: string
  styleCode: string
  styleName: string
  currentTechnicalVersionId: string
  currentTechnicalVersionCode: string
  currentTechnicalVersionLabel: string
  currentPatternAssetIds: string[]
  currentPatternAssetCodes: string[]
  currentPatternAssetCount: number
  currentTechPackLogCount: number
  closureSnapshotAt: string
  closureSnapshotBy: string
  archiveStatus: ProjectArchiveStatus
  documentCount: number
  fileCount: number
  autoCollectedCount: number
  manualUploadedCount: number
  missingItemCount: number
  readyForFinalize: boolean
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  finalizedAt: string
  finalizedBy: string
  note: string
}

export interface ProjectArchiveDocumentRecord {
  archiveDocumentId: string
  projectArchiveId: string
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceModule: string
  sourceObjectType: string
  sourceObjectId: string
  sourceObjectCode: string
  sourceVersionId: string
  sourceVersionCode: string
  sourceVersionLabel: string
  documentGroup: ProjectArchiveDocumentGroup
  documentCategory: string
  documentType: string
  documentTitle: string
  documentStatus: string
  manualFlag: boolean
  reusableFlag: boolean
  fileCount: number
  primaryFileId: string
  primaryFileName: string
  previewUrl: string
  businessDate: string
  ownerName: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  legacySourceRef: string
}

export interface ProjectArchiveFileRecord {
  archiveFileId: string
  projectArchiveId: string
  archiveDocumentId: string
  sourceModule: string
  sourceObjectType: string
  sourceObjectId: string
  sourceFileId: string
  fileName: string
  fileType: string
  previewUrl: string
  isPrimary: boolean
  sortOrder: number
  uploadedAt: string
  uploadedBy: string
}

export interface ProjectArchiveMissingItemRecord {
  archiveMissingItemId: string
  projectArchiveId: string
  itemCode: string
  itemName: string
  requiredFlag: boolean
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  reasonType: string
  reasonText: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ProjectArchivePendingItem {
  pendingId: string
  rawProjectCode: string
  rawSourceCode: string
  sourceModule: string
  sourceObjectType: string
  reason: string
  discoveredAt: string
}

export interface ProjectArchiveStoreSnapshot {
  version: number
  records: ProjectArchiveRecord[]
  documents: ProjectArchiveDocumentRecord[]
  files: ProjectArchiveFileRecord[]
  missingItems: ProjectArchiveMissingItemRecord[]
  pendingItems: ProjectArchivePendingItem[]
}

export interface ProjectArchiveCreateResult {
  ok: boolean
  existed: boolean
  message: string
  archive: ProjectArchiveRecord | null
}
