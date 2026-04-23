import { createProjectArchiveBootstrapSnapshot } from './pcs-project-archive-bootstrap.ts'
import type {
  ProjectArchiveDocumentRecord,
  ProjectArchiveFileRecord,
  ProjectArchiveMissingItemRecord,
  ProjectArchivePendingItem,
  ProjectArchiveRecord,
  ProjectArchiveStoreSnapshot,
} from './pcs-project-archive-types.ts'

const PROJECT_ARCHIVE_STORAGE_KEY = 'higood-pcs-project-archive-store-v1'
const PROJECT_ARCHIVE_STORE_VERSION = 1

let memorySnapshot: ProjectArchiveStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneRecord(record: ProjectArchiveRecord): ProjectArchiveRecord {
  return {
    ...record,
    currentPatternAssetIds: [...(record.currentPatternAssetIds ?? [])],
    currentPatternAssetCodes: [...(record.currentPatternAssetCodes ?? [])],
  }
}

function cloneDocument(record: ProjectArchiveDocumentRecord): ProjectArchiveDocumentRecord {
  return { ...record }
}

function cloneFile(record: ProjectArchiveFileRecord): ProjectArchiveFileRecord {
  return { ...record }
}

function cloneMissingItem(record: ProjectArchiveMissingItemRecord): ProjectArchiveMissingItemRecord {
  return { ...record }
}

function clonePendingItem(record: ProjectArchivePendingItem): ProjectArchivePendingItem {
  return { ...record }
}

function cloneSnapshot(snapshot: ProjectArchiveStoreSnapshot): ProjectArchiveStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    documents: snapshot.documents.map(cloneDocument),
    files: snapshot.files.map(cloneFile),
    missingItems: snapshot.missingItems.map(cloneMissingItem),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function emptySnapshot(): ProjectArchiveStoreSnapshot {
  return {
    version: PROJECT_ARCHIVE_STORE_VERSION,
    records: [],
    documents: [],
    files: [],
    missingItems: [],
    pendingItems: [],
  }
}

function seedSnapshot(): ProjectArchiveStoreSnapshot {
  return createProjectArchiveBootstrapSnapshot(PROJECT_ARCHIVE_STORE_VERSION)
}

function normalizeRecord(record: ProjectArchiveRecord): ProjectArchiveRecord {
  return {
    ...cloneRecord(record),
    styleId: record.styleId || '',
    styleCode: record.styleCode || '',
    styleName: record.styleName || '',
    currentTechnicalVersionId: record.currentTechnicalVersionId || '',
    currentTechnicalVersionCode: record.currentTechnicalVersionCode || '',
    currentTechnicalVersionLabel: record.currentTechnicalVersionLabel || '',
    currentPatternAssetIds: [...(record.currentPatternAssetIds ?? [])],
    currentPatternAssetCodes: [...(record.currentPatternAssetCodes ?? [])],
    currentPatternAssetCount: Number.isFinite(record.currentPatternAssetCount) ? record.currentPatternAssetCount : 0,
    currentTechPackLogCount: Number.isFinite(record.currentTechPackLogCount) ? record.currentTechPackLogCount : 0,
    closureSnapshotAt: record.closureSnapshotAt || '',
    closureSnapshotBy: record.closureSnapshotBy || '',
    archiveStatus: record.archiveStatus || 'DRAFT',
    documentCount: Number.isFinite(record.documentCount) ? record.documentCount : 0,
    fileCount: Number.isFinite(record.fileCount) ? record.fileCount : 0,
    autoCollectedCount: Number.isFinite(record.autoCollectedCount) ? record.autoCollectedCount : 0,
    manualUploadedCount: Number.isFinite(record.manualUploadedCount) ? record.manualUploadedCount : 0,
    missingItemCount: Number.isFinite(record.missingItemCount) ? record.missingItemCount : 0,
    readyForFinalize: Boolean(record.readyForFinalize),
    createdAt: record.createdAt || '',
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || '',
    updatedBy: record.updatedBy || record.createdBy || '系统初始化',
    finalizedAt: record.finalizedAt || '',
    finalizedBy: record.finalizedBy || '',
    note: record.note || '',
  }
}

function normalizeDocument(record: ProjectArchiveDocumentRecord): ProjectArchiveDocumentRecord {
  return {
    ...cloneDocument(record),
    projectNodeId: record.projectNodeId || '',
    workItemTypeCode: record.workItemTypeCode || '',
    workItemTypeName: record.workItemTypeName || '',
    sourceVersionId: record.sourceVersionId || '',
    sourceVersionCode: record.sourceVersionCode || '',
    sourceVersionLabel: record.sourceVersionLabel || '',
    documentStatus: record.documentStatus || '',
    manualFlag: Boolean(record.manualFlag),
    reusableFlag: Boolean(record.reusableFlag),
    fileCount: Number.isFinite(record.fileCount) ? record.fileCount : 0,
    primaryFileId: record.primaryFileId || '',
    primaryFileName: record.primaryFileName || '',
    previewUrl: record.previewUrl || '',
    businessDate: record.businessDate || '',
    ownerName: record.ownerName || '',
    createdAt: record.createdAt || '',
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.createdAt || '',
    updatedBy: record.updatedBy || record.createdBy || '系统初始化',
    legacySourceRef: record.legacySourceRef || '',
  }
}

function normalizeFile(record: ProjectArchiveFileRecord): ProjectArchiveFileRecord {
  return {
    ...cloneFile(record),
    sourceFileId: record.sourceFileId || '',
    previewUrl: record.previewUrl || '',
    isPrimary: Boolean(record.isPrimary),
    sortOrder: Number.isFinite(record.sortOrder) ? record.sortOrder : 0,
    uploadedAt: record.uploadedAt || '',
    uploadedBy: record.uploadedBy || '系统初始化',
  }
}

function normalizeMissingItem(record: ProjectArchiveMissingItemRecord): ProjectArchiveMissingItemRecord {
  return {
    ...cloneMissingItem(record),
    projectNodeId: record.projectNodeId || '',
    workItemTypeCode: record.workItemTypeCode || '',
    workItemTypeName: record.workItemTypeName || '',
    status: record.status || '待补齐',
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || record.createdAt || '',
  }
}

function normalizePendingItem(record: ProjectArchivePendingItem): ProjectArchivePendingItem {
  return {
    ...clonePendingItem(record),
    rawProjectCode: record.rawProjectCode || '',
    rawSourceCode: record.rawSourceCode || '',
    sourceModule: record.sourceModule || '项目资料归档',
    sourceObjectType: record.sourceObjectType || '项目资料归档',
    reason: record.reason || '未说明原因',
    discoveredAt: record.discoveredAt || '',
  }
}

function buildDocumentKey(record: Pick<
  ProjectArchiveDocumentRecord,
  'projectArchiveId' | 'sourceModule' | 'sourceObjectType' | 'sourceObjectId' | 'sourceVersionId' | 'documentCategory' | 'manualFlag'
>): string {
  return [
    record.projectArchiveId,
    record.sourceModule,
    record.sourceObjectType,
    record.sourceObjectId,
    record.sourceVersionId || '',
    record.documentCategory,
    record.manualFlag ? 'manual' : 'auto',
  ].join('::')
}

function buildFileKey(record: Pick<ProjectArchiveFileRecord, 'projectArchiveId' | 'archiveDocumentId' | 'sourceFileId' | 'fileName'>): string {
  return [record.projectArchiveId, record.archiveDocumentId, record.sourceFileId || '', record.fileName].join('::')
}

function dedupeDocuments(records: ProjectArchiveDocumentRecord[]): ProjectArchiveDocumentRecord[] {
  const map = new Map<string, ProjectArchiveDocumentRecord>()
  records.forEach((record) => {
    const normalized = normalizeDocument(record)
    const key = buildDocumentKey(normalized)
    const existing = map.get(key)
    if (!existing || normalized.updatedAt.localeCompare(existing.updatedAt) >= 0) {
      map.set(key, normalized)
    }
  })
  return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function dedupeFiles(records: ProjectArchiveFileRecord[]): ProjectArchiveFileRecord[] {
  const map = new Map<string, ProjectArchiveFileRecord>()
  records.forEach((record) => {
    const normalized = normalizeFile(record)
    map.set(buildFileKey(normalized), normalized)
  })
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

function dedupeMissingItems(records: ProjectArchiveMissingItemRecord[]): ProjectArchiveMissingItemRecord[] {
  const map = new Map<string, ProjectArchiveMissingItemRecord>()
  records.forEach((record) => {
    const normalized = normalizeMissingItem(record)
    map.set(`${normalized.projectArchiveId}::${normalized.itemCode}`, normalized)
  })
  return Array.from(map.values()).sort((a, b) => a.itemCode.localeCompare(b.itemCode))
}

function dedupePendingItems(records: ProjectArchivePendingItem[]): ProjectArchivePendingItem[] {
  const map = new Map<string, ProjectArchivePendingItem>()
  records.forEach((record) => {
    const normalized = normalizePendingItem(record)
    map.set(
      [normalized.rawProjectCode, normalized.rawSourceCode, normalized.sourceModule, normalized.sourceObjectType, normalized.reason].join('::'),
      normalized,
    )
  })
  return Array.from(map.values()).sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
}

function hydrateSnapshot(snapshot: ProjectArchiveStoreSnapshot): ProjectArchiveStoreSnapshot {
  const normalized = {
    version: PROJECT_ARCHIVE_STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : [],
    documents: Array.isArray(snapshot.documents) ? snapshot.documents.map(normalizeDocument) : [],
    files: Array.isArray(snapshot.files) ? snapshot.files.map(normalizeFile) : [],
    missingItems: Array.isArray(snapshot.missingItems) ? snapshot.missingItems.map(normalizeMissingItem) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : [],
  }
  return {
    version: PROJECT_ARCHIVE_STORE_VERSION,
    records: normalized.records,
    documents: dedupeDocuments(normalized.documents),
    files: dedupeFiles(normalized.files),
    missingItems: dedupeMissingItems(normalized.missingItems),
    pendingItems: dedupePendingItems(normalized.pendingItems),
  }
}

function loadSnapshot(): ProjectArchiveStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(PROJECT_ARCHIVE_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(PROJECT_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<ProjectArchiveStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: PROJECT_ARCHIVE_STORE_VERSION,
      records: Array.isArray(parsed.records) ? (parsed.records as ProjectArchiveRecord[]) : [],
      documents: Array.isArray(parsed.documents) ? (parsed.documents as ProjectArchiveDocumentRecord[]) : [],
      files: Array.isArray(parsed.files) ? (parsed.files as ProjectArchiveFileRecord[]) : [],
      missingItems: Array.isArray(parsed.missingItems) ? (parsed.missingItems as ProjectArchiveMissingItemRecord[]) : [],
      pendingItems: Array.isArray(parsed.pendingItems) ? (parsed.pendingItems as ProjectArchivePendingItem[]) : [],
    })
    localStorage.setItem(PROJECT_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(PROJECT_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: ProjectArchiveStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(PROJECT_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function getProjectArchiveStoreSnapshot(): ProjectArchiveStoreSnapshot {
  return loadSnapshot()
}

export function listProjectArchives(): ProjectArchiveRecord[] {
  return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getProjectArchiveById(projectArchiveId: string): ProjectArchiveRecord | null {
  const record = loadSnapshot().records.find((item) => item.projectArchiveId === projectArchiveId)
  return record ? cloneRecord(record) : null
}

export function getProjectArchiveByProjectId(projectId: string): ProjectArchiveRecord | null {
  const record = loadSnapshot().records.find((item) => item.projectId === projectId)
  return record ? cloneRecord(record) : null
}

export function listProjectArchiveDocuments(): ProjectArchiveDocumentRecord[] {
  return loadSnapshot().documents.map(cloneDocument)
}

export function listProjectArchiveDocumentsByArchiveId(projectArchiveId: string): ProjectArchiveDocumentRecord[] {
  return loadSnapshot()
    .documents
    .filter((item) => item.projectArchiveId === projectArchiveId)
    .map(cloneDocument)
}

export function listProjectArchiveFiles(): ProjectArchiveFileRecord[] {
  return loadSnapshot().files.map(cloneFile)
}

export function listProjectArchiveFilesByArchiveId(projectArchiveId: string): ProjectArchiveFileRecord[] {
  return loadSnapshot()
    .files
    .filter((item) => item.projectArchiveId === projectArchiveId)
    .map(cloneFile)
}

export function listProjectArchiveFilesByDocumentId(archiveDocumentId: string): ProjectArchiveFileRecord[] {
  return loadSnapshot()
    .files
    .filter((item) => item.archiveDocumentId === archiveDocumentId)
    .map(cloneFile)
}

export function listProjectArchiveMissingItems(): ProjectArchiveMissingItemRecord[] {
  return loadSnapshot().missingItems.map(cloneMissingItem)
}

export function listProjectArchiveMissingItemsByArchiveId(projectArchiveId: string): ProjectArchiveMissingItemRecord[] {
  return loadSnapshot()
    .missingItems
    .filter((item) => item.projectArchiveId === projectArchiveId)
    .map(cloneMissingItem)
}

export function listProjectArchivePendingItems(): ProjectArchivePendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertProjectArchive(record: ProjectArchiveRecord): ProjectArchiveRecord {
  const snapshot = loadSnapshot()
  const normalized = normalizeRecord(record)
  persistSnapshot({
    ...snapshot,
    records: [normalized, ...snapshot.records.filter((item) => item.projectArchiveId !== normalized.projectArchiveId)],
  })
  return getProjectArchiveById(normalized.projectArchiveId) ?? normalized
}

export function upsertProjectArchiveDocuments(records: ProjectArchiveDocumentRecord[]): ProjectArchiveDocumentRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    documents: [...snapshot.documents, ...records.map(normalizeDocument)],
  })
  return records.map((record) => normalizeDocument(record))
}

export function upsertProjectArchiveFiles(records: ProjectArchiveFileRecord[]): ProjectArchiveFileRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    files: [...snapshot.files, ...records.map(normalizeFile)],
  })
  return records.map((record) => normalizeFile(record))
}

export function replaceProjectArchiveMissingItems(
  projectArchiveId: string,
  records: ProjectArchiveMissingItemRecord[],
): ProjectArchiveMissingItemRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    missingItems: [
      ...snapshot.missingItems.filter((item) => item.projectArchiveId !== projectArchiveId),
      ...records.map(normalizeMissingItem),
    ],
  })
  return listProjectArchiveMissingItemsByArchiveId(projectArchiveId)
}

export function replaceProjectArchiveDocuments(
  projectArchiveId: string,
  records: ProjectArchiveDocumentRecord[],
): ProjectArchiveDocumentRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    documents: [
      ...snapshot.documents.filter((item) => item.projectArchiveId !== projectArchiveId),
      ...records.map(normalizeDocument),
    ],
  })
  return listProjectArchiveDocumentsByArchiveId(projectArchiveId)
}

export function replaceProjectArchiveFiles(
  projectArchiveId: string,
  records: ProjectArchiveFileRecord[],
): ProjectArchiveFileRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    files: [
      ...snapshot.files.filter((item) => item.projectArchiveId !== projectArchiveId),
      ...records.map(normalizeFile),
    ],
  })
  return listProjectArchiveFilesByArchiveId(projectArchiveId)
}

export function upsertProjectArchivePendingItem(item: ProjectArchivePendingItem): ProjectArchivePendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
  })
  return normalizePendingItem(item)
}

export function deleteProjectArchiveDocument(projectArchiveId: string, archiveDocumentId: string): void {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    documents: snapshot.documents.filter(
      (item) => !(item.projectArchiveId === projectArchiveId && item.archiveDocumentId === archiveDocumentId),
    ),
    files: snapshot.files.filter(
      (item) => !(item.projectArchiveId === projectArchiveId && item.archiveDocumentId === archiveDocumentId),
    ),
  })
}

export function replaceProjectArchiveStore(snapshot: ProjectArchiveStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function resetProjectArchiveRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(PROJECT_ARCHIVE_STORAGE_KEY)
    localStorage.setItem(PROJECT_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
