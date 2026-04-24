import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type {
  FirstOrderSampleTaskRecord,
  FirstOrderSampleTaskStoreSnapshot,
} from './pcs-first-order-sample-types.ts'
import { normalizeSamplePlanLines } from './pcs-sample-chain-service.ts'

const STORAGE_KEY = 'higood-pcs-first-order-sample-store-v2'
const STORE_VERSION = 2

let memorySnapshot: FirstOrderSampleTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: FirstOrderSampleTaskRecord): FirstOrderSampleTaskRecord {
  return {
    ...task,
    specialSceneReasonCodes: [...(task.specialSceneReasonCodes || [])],
    samplePlanLines: (task.samplePlanLines || []).map((line) => ({ ...line })),
  }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: FirstOrderSampleTaskStoreSnapshot): FirstOrderSampleTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): FirstOrderSampleTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.firstOrderSampleTasks.map(cloneTask),
    pendingItems: bootstrap.firstOrderSamplePendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: FirstOrderSampleTaskRecord): FirstOrderSampleTaskRecord {
  const sampleChainMode = task.sampleChainMode || '复用首版结论'
  const sourceFirstSampleCode = task.sourceFirstSampleCode || (sampleChainMode === '复用首版结论' ? task.sampleCode || '' : '')
  return {
    ...cloneTask(task),
    note: task.note || '',
    sourceTechPackVersionId: task.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: task.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel || '',
    sourceFirstSampleTaskId: task.sourceFirstSampleTaskId || (task.upstreamObjectType.includes('首版') ? task.upstreamObjectId : ''),
    sourceFirstSampleTaskCode: task.sourceFirstSampleTaskCode || (task.upstreamObjectType.includes('首版') ? task.upstreamObjectCode : ''),
    sourceFirstSampleCode,
    sampleChainMode,
    specialSceneReasonCodes: Array.isArray(task.specialSceneReasonCodes) ? [...task.specialSceneReasonCodes] : [],
    specialSceneReasonText: task.specialSceneReasonText || '',
    productionReferenceRequiredFlag: Boolean(task.productionReferenceRequiredFlag),
    chinaReviewRequiredFlag: Boolean(task.chinaReviewRequiredFlag),
    correctFabricRequiredFlag: Boolean(task.correctFabricRequiredFlag),
    samplePlanLines: normalizeSamplePlanLines(sampleChainMode, task.samplePlanLines, sourceFirstSampleCode),
    finalReferenceNote: task.finalReferenceNote || '',
    confirmedAt: task.confirmedAt || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: FirstOrderSampleTaskStoreSnapshot): FirstOrderSampleTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): FirstOrderSampleTaskStoreSnapshot {
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
    const parsed = JSON.parse(raw) as Partial<FirstOrderSampleTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as FirstOrderSampleTaskRecord[]) : seedSnapshot().tasks,
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

function persistSnapshot(snapshot: FirstOrderSampleTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listFirstOrderSampleTasks(): FirstOrderSampleTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getFirstOrderSampleTaskById(firstOrderSampleTaskId: string): FirstOrderSampleTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.firstOrderSampleTaskId === firstOrderSampleTaskId)
  return task ? cloneTask(task) : null
}

export function listFirstOrderSampleTasksByProject(projectId: string): FirstOrderSampleTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listFirstOrderSampleTasksByProjectNode(
  projectId: string,
  projectNodeId: string,
): FirstOrderSampleTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertFirstOrderSampleTask(task: FirstOrderSampleTaskRecord): FirstOrderSampleTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [
      normalizeTask(task),
      ...snapshot.tasks.filter((item) => item.firstOrderSampleTaskId !== task.firstOrderSampleTaskId),
    ],
  })
  return getFirstOrderSampleTaskById(task.firstOrderSampleTaskId) ?? normalizeTask(task)
}

export function updateFirstOrderSampleTask(
  firstOrderSampleTaskId: string,
  patch: Partial<FirstOrderSampleTaskRecord>,
): FirstOrderSampleTaskRecord | null {
  const current = getFirstOrderSampleTaskById(firstOrderSampleTaskId)
  if (!current) return null
  return upsertFirstOrderSampleTask({
    ...current,
    ...patch,
    firstOrderSampleTaskId: current.firstOrderSampleTaskId,
    firstOrderSampleTaskCode: current.firstOrderSampleTaskCode,
  })
}

export function listFirstOrderSampleTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertFirstOrderSampleTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replaceFirstOrderSampleTaskStore(
  tasks: FirstOrderSampleTaskRecord[],
  pendingItems: PcsTaskPendingItem[] = [],
): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetFirstOrderSampleTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
