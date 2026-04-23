import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { RevisionTaskRecord, RevisionTaskStoreSnapshot } from './pcs-revision-task-types.ts'

const STORAGE_KEY = 'higood-pcs-revision-task-store-v2'
const STORE_VERSION = 2

let memorySnapshot: RevisionTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: RevisionTaskRecord): RevisionTaskRecord {
  return {
    ...task,
    participantNames: [...(task.participantNames || [])],
    revisionScopeCodes: [...(task.revisionScopeCodes || [])],
    revisionScopeNames: [...(task.revisionScopeNames || [])],
    evidenceImageUrls: [...(task.evidenceImageUrls || [])],
    baseStyleImageIds: [...(task.baseStyleImageIds || [])],
    targetStyleImageIds: [...(task.targetStyleImageIds || [])],
    materialAdjustmentLines: (task.materialAdjustmentLines || []).map((line) => ({ ...line })),
    newPatternImageIds: [...(task.newPatternImageIds || [])],
    patternPieceImageIds: [...(task.patternPieceImageIds || [])],
    patternFileIds: [...(task.patternFileIds || [])],
    mainImageIds: [...(task.mainImageIds || [])],
    designDraftImageIds: [...(task.designDraftImageIds || [])],
    liveRetestRelationIds: [...(task.liveRetestRelationIds || [])],
  }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: RevisionTaskStoreSnapshot): RevisionTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): RevisionTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.revisionTasks.map(cloneTask),
    pendingItems: bootstrap.revisionPendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: RevisionTaskRecord): RevisionTaskRecord {
  return {
    ...cloneTask(task),
    styleId: task.styleId || '',
    styleCode: task.styleCode || task.productStyleCode || task.spuCode || '',
    styleName: task.styleName || '',
    referenceObjectType: task.referenceObjectType || '',
    referenceObjectId: task.referenceObjectId || '',
    referenceObjectCode: task.referenceObjectCode || '',
    referenceObjectName: task.referenceObjectName || '',
    participantNames: [...(task.participantNames || [])],
    revisionScopeCodes: [...(task.revisionScopeCodes || [])],
    revisionScopeNames: [...(task.revisionScopeNames || [])],
    issueSummary: task.issueSummary || '',
    evidenceSummary: task.evidenceSummary || '',
    evidenceImageUrls: [...(task.evidenceImageUrls || [])],
    baseStyleId: task.baseStyleId || task.styleId || '',
    baseStyleCode: task.baseStyleCode || task.styleCode || task.productStyleCode || '',
    baseStyleName: task.baseStyleName || task.styleName || '',
    baseStyleImageIds: [...(task.baseStyleImageIds || [])],
    targetStyleCodeCandidate: task.targetStyleCodeCandidate || '',
    targetStyleNameCandidate: task.targetStyleNameCandidate || '',
    targetStyleImageIds: [...(task.targetStyleImageIds || [])],
    sampleQty: Number(task.sampleQty || 0),
    stylePreference: task.stylePreference || '',
    patternMakerId: task.patternMakerId || '',
    patternMakerName: task.patternMakerName || task.ownerName || '',
    revisionSuggestionRichText: task.revisionSuggestionRichText || task.issueSummary || '',
    paperPrintAt: task.paperPrintAt || '',
    deliveryAddress: task.deliveryAddress || '',
    patternArea: task.patternArea || '',
    materialAdjustmentLines: (task.materialAdjustmentLines || []).map((line) => ({ ...line })),
    newPatternImageIds: [...(task.newPatternImageIds || [])],
    newPatternSpuCode: task.newPatternSpuCode || '',
    patternChangeNote: task.patternChangeNote || '',
    patternPieceImageIds: [...(task.patternPieceImageIds || [])],
    patternFileIds: [...(task.patternFileIds || [])],
    mainImageIds: [...(task.mainImageIds || task.evidenceImageUrls || [])],
    designDraftImageIds: [...(task.designDraftImageIds || [])],
    liveRetestRequired: Boolean(task.liveRetestRequired),
    liveRetestStatus: task.liveRetestStatus || (task.liveRetestRequired ? '待回直播验证' : '不需要'),
    liveRetestRelationIds: [...(task.liveRetestRelationIds || [])],
    liveRetestSummary: task.liveRetestSummary || '',
    linkedTechPackVersionId: task.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: task.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: task.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: task.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: task.linkedTechPackUpdatedAt || '',
    generatedNewTechPackVersionFlag: Boolean(task.generatedNewTechPackVersionFlag),
    generatedNewTechPackVersionAt: task.generatedNewTechPackVersionAt || '',
    note: task.note || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: RevisionTaskStoreSnapshot): RevisionTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): RevisionTaskStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<RevisionTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as RevisionTaskRecord[]) : seedSnapshot().tasks,
      pendingItems: Array.isArray(parsed.pendingItems) ? (parsed.pendingItems as PcsTaskPendingItem[]) : seedSnapshot().pendingItems,
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: RevisionTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listRevisionTasks(): RevisionTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getRevisionTaskById(revisionTaskId: string): RevisionTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.revisionTaskId === revisionTaskId)
  return task ? cloneTask(task) : null
}

export function listRevisionTasksByProject(projectId: string): RevisionTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listRevisionTasksByProjectNode(projectId: string, projectNodeId: string): RevisionTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertRevisionTask(task: RevisionTaskRecord): RevisionTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [normalizeTask(task), ...snapshot.tasks.filter((item) => item.revisionTaskId !== task.revisionTaskId)],
  })
  return getRevisionTaskById(task.revisionTaskId) ?? normalizeTask(task)
}

export function updateRevisionTask(revisionTaskId: string, patch: Partial<RevisionTaskRecord>): RevisionTaskRecord | null {
  const current = getRevisionTaskById(revisionTaskId)
  if (!current) return null
  return upsertRevisionTask({ ...current, ...patch, revisionTaskId: current.revisionTaskId, revisionTaskCode: current.revisionTaskCode })
}

export function listRevisionTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertRevisionTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replaceRevisionTaskStore(tasks: RevisionTaskRecord[], pendingItems: PcsTaskPendingItem[] = []): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetRevisionTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
