import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { FirstSampleTaskRecord, FirstSampleTaskStoreSnapshot } from './pcs-first-sample-types.ts'

const STORAGE_KEY = 'higood-pcs-first-sample-store-v1'
const STORE_VERSION = 1

let memorySnapshot: FirstSampleTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: FirstSampleTaskRecord): FirstSampleTaskRecord {
  return {
    ...task,
    sampleAssetIds: [...(task.sampleAssetIds || [])],
    sampleImageIds: [...(task.sampleImageIds || [])],
  }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: FirstSampleTaskStoreSnapshot): FirstSampleTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): FirstSampleTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.firstSampleTasks.map(cloneTask),
    pendingItems: bootstrap.firstSamplePendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: FirstSampleTaskRecord): FirstSampleTaskRecord {
  const sampleAssetIds = Array.isArray(task.sampleAssetIds) ? [...task.sampleAssetIds] : []
  if (task.sampleAssetId && !sampleAssetIds.includes(task.sampleAssetId)) {
    sampleAssetIds.unshift(task.sampleAssetId)
  }
  return {
    ...cloneTask(task),
    note: task.note || '',
    sourceTechPackVersionId: task.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: task.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel || '',
    sourceTaskType: task.sourceTaskType || task.upstreamObjectType || task.upstreamModule || '',
    sourceTaskId: task.sourceTaskId || task.upstreamObjectId || '',
    sourceTaskCode: task.sourceTaskCode || task.upstreamObjectCode || '',
    sampleMaterialMode: task.sampleMaterialMode || '正确布',
    samplePurpose: task.samplePurpose || (task.reuseAsPreProductionFlag ? '产前复用候选' : '首版确认'),
    sampleAssetId: task.sampleAssetId || '',
    sampleAssetIds,
    sampleImageIds: Array.isArray(task.sampleImageIds) ? [...task.sampleImageIds] : [],
    reuseAsPreProductionFlag: Boolean(task.reuseAsPreProductionFlag),
    reuseAsPreProductionConfirmedAt: task.reuseAsPreProductionConfirmedAt || '',
    reuseAsPreProductionConfirmedBy: task.reuseAsPreProductionConfirmedBy || '',
    reuseAsPreProductionNote: task.reuseAsPreProductionNote || '',
    fitConfirmationSummary: task.fitConfirmationSummary || '',
    artworkConfirmationSummary: task.artworkConfirmationSummary || '',
    productionReadinessNote: task.productionReadinessNote || '',
    acceptedAt: task.acceptedAt || '',
    confirmedAt: task.confirmedAt || '',
    trackingNo: task.trackingNo || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: FirstSampleTaskStoreSnapshot): FirstSampleTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): FirstSampleTaskStoreSnapshot {
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
    const parsed = JSON.parse(raw) as Partial<FirstSampleTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as FirstSampleTaskRecord[]) : seedSnapshot().tasks,
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

function persistSnapshot(snapshot: FirstSampleTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listFirstSampleTasks(): FirstSampleTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getFirstSampleTaskById(firstSampleTaskId: string): FirstSampleTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.firstSampleTaskId === firstSampleTaskId)
  return task ? cloneTask(task) : null
}

export function listFirstSampleTasksByProject(projectId: string): FirstSampleTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listFirstSampleTasksByProjectNode(projectId: string, projectNodeId: string): FirstSampleTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertFirstSampleTask(task: FirstSampleTaskRecord): FirstSampleTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [normalizeTask(task), ...snapshot.tasks.filter((item) => item.firstSampleTaskId !== task.firstSampleTaskId)],
  })
  return getFirstSampleTaskById(task.firstSampleTaskId) ?? normalizeTask(task)
}

export function updateFirstSampleTask(
  firstSampleTaskId: string,
  patch: Partial<FirstSampleTaskRecord>,
): FirstSampleTaskRecord | null {
  const current = getFirstSampleTaskById(firstSampleTaskId)
  if (!current) return null
  return upsertFirstSampleTask({
    ...current,
    ...patch,
    firstSampleTaskId: current.firstSampleTaskId,
    firstSampleTaskCode: current.firstSampleTaskCode,
  })
}

export function listFirstSampleTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertFirstSampleTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replaceFirstSampleTaskStore(tasks: FirstSampleTaskRecord[], pendingItems: PcsTaskPendingItem[] = []): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetFirstSampleTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
