import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { PatternTaskRecord, PatternTaskStoreSnapshot } from './pcs-pattern-task-types.ts'

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
  return {
    ...cloneTask(task),
    linkedTechPackVersionId: task.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: task.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: task.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: task.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: task.linkedTechPackUpdatedAt || '',
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
