import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type {
  PreProductionSampleTaskRecord,
  PreProductionSampleTaskStoreSnapshot,
} from './pcs-pre-production-sample-types.ts'

const STORAGE_KEY = 'higood-pcs-pre-production-sample-store-v1'
const STORE_VERSION = 1

let memorySnapshot: PreProductionSampleTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: PreProductionSampleTaskRecord): PreProductionSampleTaskRecord {
  return { ...task }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: PreProductionSampleTaskStoreSnapshot): PreProductionSampleTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): PreProductionSampleTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.preProductionSampleTasks.map(cloneTask),
    pendingItems: bootstrap.preProductionSamplePendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: PreProductionSampleTaskRecord): PreProductionSampleTaskRecord {
  return {
    ...cloneTask(task),
    note: task.note || '',
    sampleAssetId: task.sampleAssetId || '',
    acceptedAt: task.acceptedAt || '',
    confirmedAt: task.confirmedAt || '',
    trackingNo: task.trackingNo || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: PreProductionSampleTaskStoreSnapshot): PreProductionSampleTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): PreProductionSampleTaskStoreSnapshot {
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
    const parsed = JSON.parse(raw) as Partial<PreProductionSampleTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as PreProductionSampleTaskRecord[]) : seedSnapshot().tasks,
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

function persistSnapshot(snapshot: PreProductionSampleTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listPreProductionSampleTasks(): PreProductionSampleTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPreProductionSampleTaskById(preProductionSampleTaskId: string): PreProductionSampleTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.preProductionSampleTaskId === preProductionSampleTaskId)
  return task ? cloneTask(task) : null
}

export function listPreProductionSampleTasksByProject(projectId: string): PreProductionSampleTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listPreProductionSampleTasksByProjectNode(
  projectId: string,
  projectNodeId: string,
): PreProductionSampleTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertPreProductionSampleTask(task: PreProductionSampleTaskRecord): PreProductionSampleTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [
      normalizeTask(task),
      ...snapshot.tasks.filter((item) => item.preProductionSampleTaskId !== task.preProductionSampleTaskId),
    ],
  })
  return getPreProductionSampleTaskById(task.preProductionSampleTaskId) ?? normalizeTask(task)
}

export function updatePreProductionSampleTask(
  preProductionSampleTaskId: string,
  patch: Partial<PreProductionSampleTaskRecord>,
): PreProductionSampleTaskRecord | null {
  const current = getPreProductionSampleTaskById(preProductionSampleTaskId)
  if (!current) return null
  return upsertPreProductionSampleTask({
    ...current,
    ...patch,
    preProductionSampleTaskId: current.preProductionSampleTaskId,
    preProductionSampleTaskCode: current.preProductionSampleTaskCode,
  })
}

export function listPreProductionSampleTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertPreProductionSampleTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replacePreProductionSampleTaskStore(
  tasks: PreProductionSampleTaskRecord[],
  pendingItems: PcsTaskPendingItem[] = [],
): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetPreProductionSampleTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
