import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { PatternTaskRecord, PatternTaskStoreSnapshot } from './pcs-pattern-task-types.ts'
import { getPatternTaskMember, getPatternTaskTeamName } from './pcs-pattern-task-team-config.ts'

const STORAGE_KEY = 'higood-pcs-pattern-task-store-v1'
const STORE_VERSION = 1

let memorySnapshot: PatternTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: PatternTaskRecord): PatternTaskRecord {
  return { ...task }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: PatternTaskStoreSnapshot): PatternTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): PatternTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.patternTasks.map(cloneTask),
    pendingItems: bootstrap.patternPendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: PatternTaskRecord): PatternTaskRecord {
  const assignedTeamCode = task.assignedTeamCode || 'CN_TEAM'
  const assignedMemberId = task.assignedMemberId || 'cn_bing_bing'
  const assignedMember = getPatternTaskMember(assignedTeamCode, assignedMemberId)
  const demandSourceType = task.demandSourceType || (task.sourceType === '改版任务' ? '改版任务' : '预售测款通过')
  const processType = task.processType || (task.artworkType === '烫画' ? '烫画' : '数码印')
  return {
    ...cloneTask(task),
    styleId: task.styleId || '',
    styleCode: task.styleCode || task.productStyleCode || task.spuCode || task.patternSpuCode || '',
    styleName: task.styleName || '',
    demandSourceType,
    demandSourceRefId: task.demandSourceRefId || task.upstreamObjectId || '',
    demandSourceRefCode: task.demandSourceRefCode || task.upstreamObjectCode || '',
    demandSourceRefName: task.demandSourceRefName || task.upstreamModule || '',
    processType,
    requestQty: Number(task.requestQty || 1),
    fabricSku: task.fabricSku || '',
    fabricName: task.fabricName || '待买手确认',
    demandImageIds: Array.isArray(task.demandImageIds) ? task.demandImageIds : [],
    patternSpuCode: task.patternSpuCode || task.productStyleCode || task.spuCode || '',
    colorDepthOption: task.colorDepthOption || '中间值',
    difficultyGrade: task.difficultyGrade || 'A',
    assignedTeamCode,
    assignedTeamName: task.assignedTeamName || getPatternTaskTeamName(assignedTeamCode),
    assignedMemberId,
    assignedMemberName: task.assignedMemberName || assignedMember?.memberName || '',
    assignedAt: task.assignedAt || task.acceptedAt || task.createdAt || '',
    liveReferenceImageIds: Array.isArray(task.liveReferenceImageIds) ? task.liveReferenceImageIds : [],
    imageReferenceIds: Array.isArray(task.imageReferenceIds) ? task.imageReferenceIds : [],
    physicalReferenceNote: task.physicalReferenceNote || '',
    completionImageIds: Array.isArray(task.completionImageIds) ? task.completionImageIds : [],
    buyerReviewStatus: task.buyerReviewStatus || '待买手确认',
    buyerReviewAt: task.buyerReviewAt || '',
    buyerReviewerName: task.buyerReviewerName || '',
    buyerReviewNote: task.buyerReviewNote || '',
    transferFromTeamCode: task.transferFromTeamCode || '',
    transferFromTeamName: task.transferFromTeamName || '',
    transferToTeamCode: task.transferToTeamCode || '',
    transferToTeamName: task.transferToTeamName || '',
    transferReason: task.transferReason || '',
    transferredAt: task.transferredAt || '',
    transferOperatorName: task.transferOperatorName || '',
    patternAssetId: task.patternAssetId || '',
    patternAssetCode: task.patternAssetCode || '',
    patternCategoryCode: task.patternCategoryCode || '',
    patternStyleTags: Array.isArray(task.patternStyleTags) ? task.patternStyleTags : [],
    hotSellerFlag: Boolean(task.hotSellerFlag),
    colorConfirmNote: task.colorConfirmNote || '',
    linkedTechPackVersionId: task.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: task.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: task.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: task.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: task.linkedTechPackUpdatedAt || '',
    acceptedAt: task.acceptedAt || '',
    confirmedAt: task.confirmedAt || '',
    note: task.note || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: PatternTaskStoreSnapshot): PatternTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): PatternTaskStoreSnapshot {
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
    const parsed = JSON.parse(raw) as Partial<PatternTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as PatternTaskRecord[]) : seedSnapshot().tasks,
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

function persistSnapshot(snapshot: PatternTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listPatternTasks(): PatternTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPatternTaskById(patternTaskId: string): PatternTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.patternTaskId === patternTaskId)
  return task ? cloneTask(task) : null
}

export function listPatternTasksByProject(projectId: string): PatternTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listPatternTasksByProjectNode(projectId: string, projectNodeId: string): PatternTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertPatternTask(task: PatternTaskRecord): PatternTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [normalizeTask(task), ...snapshot.tasks.filter((item) => item.patternTaskId !== task.patternTaskId)],
  })
  return getPatternTaskById(task.patternTaskId) ?? normalizeTask(task)
}

export function updatePatternTask(patternTaskId: string, patch: Partial<PatternTaskRecord>): PatternTaskRecord | null {
  const current = getPatternTaskById(patternTaskId)
  if (!current) return null
  return upsertPatternTask({ ...current, ...patch, patternTaskId: current.patternTaskId, patternTaskCode: current.patternTaskCode })
}

export function listPatternTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertPatternTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replacePatternTaskStore(tasks: PatternTaskRecord[], pendingItems: PcsTaskPendingItem[] = []): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetPatternTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
