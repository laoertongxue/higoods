import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { PlateMakingTaskRecord, PlateMakingTaskStoreSnapshot } from './pcs-plate-making-types.ts'

const STORAGE_KEY = 'higood-pcs-plate-making-store-v1'
const STORE_VERSION = 1

let memorySnapshot: PlateMakingTaskStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneTask(task: PlateMakingTaskRecord): PlateMakingTaskRecord {
  return {
    ...task,
    participantNames: [...task.participantNames],
    flowerImageIds: [...(task.flowerImageIds || [])],
    materialRequirementLines: (task.materialRequirementLines || []).map((line) => ({ ...line })),
    patternImageLineItems: (task.patternImageLineItems || []).map((line) => ({ ...line })),
    patternPdfFileIds: [...(task.patternPdfFileIds || [])],
    patternDxfFileIds: [...(task.patternDxfFileIds || [])],
    patternRulFileIds: [...(task.patternRulFileIds || [])],
    supportImageIds: [...(task.supportImageIds || [])],
    supportVideoIds: [...(task.supportVideoIds || [])],
    partTemplateLinks: (task.partTemplateLinks || []).map((link) => ({
      ...link,
      matchedPartNames: [...(link.matchedPartNames || [])],
    })),
  }
}

function clonePendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: PlateMakingTaskStoreSnapshot): PlateMakingTaskStoreSnapshot {
  return {
    version: snapshot.version,
    tasks: snapshot.tasks.map(cloneTask),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): PlateMakingTaskStoreSnapshot {
  const bootstrap = createTaskBootstrapSnapshot()
  return {
    version: STORE_VERSION,
    tasks: bootstrap.plateTasks.map(cloneTask),
    pendingItems: bootstrap.platePendingItems.map(clonePendingItem),
  }
}

function normalizeTask(task: PlateMakingTaskRecord): PlateMakingTaskRecord {
  return {
    ...cloneTask(task),
    participantNames: [...(task.participantNames || [])],
    productHistoryType: task.productHistoryType || '',
    patternMakerId: task.patternMakerId || '',
    patternMakerName: task.patternMakerName || '',
    sampleConfirmedAt: task.sampleConfirmedAt || '',
    urgentFlag: Boolean(task.urgentFlag),
    patternArea: task.patternArea || '',
    colorRequirementText: task.colorRequirementText || '',
    newPatternSpuCode: task.newPatternSpuCode || '',
    flowerImageIds: [...(task.flowerImageIds || [])],
    materialRequirementLines: (task.materialRequirementLines || []).map((line, index) => ({
      lineId: line.lineId || `${task.plateTaskId}_material_${index + 1}`,
      materialImageId: line.materialImageId || '',
      materialName: line.materialName || '',
      materialSku: line.materialSku || '',
      printRequirement: line.printRequirement || '',
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      amount: Number(line.amount || 0),
      note: line.note || '',
    })),
    patternImageLineItems: (task.patternImageLineItems || []).map((line, index) => ({
      lineId: line.lineId || `${task.plateTaskId}_pattern_image_${index + 1}`,
      imageId: line.imageId || '',
      materialPartName: line.materialPartName || '',
      materialDescription: line.materialDescription || '',
      pieceCount: Number(line.pieceCount || 0),
    })),
    patternPdfFileIds: [...(task.patternPdfFileIds || [])],
    patternDxfFileIds: [...(task.patternDxfFileIds || [])],
    patternRulFileIds: [...(task.patternRulFileIds || [])],
    supportImageIds: [...(task.supportImageIds || [])],
    supportVideoIds: [...(task.supportVideoIds || [])],
    partTemplateLinks: (task.partTemplateLinks || []).map((link) => ({
      templateId: link.templateId || '',
      templateCode: link.templateCode || '',
      templateName: link.templateName || '',
      matchedPartNames: [...(link.matchedPartNames || [])],
    })),
    linkedTechPackVersionId: task.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: task.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: task.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: task.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: task.linkedTechPackUpdatedAt || '',
    primaryTechPackGeneratedFlag: Boolean(task.primaryTechPackGeneratedFlag),
    primaryTechPackGeneratedAt: task.primaryTechPackGeneratedAt || '',
    acceptedAt: task.acceptedAt || '',
    confirmedAt: task.confirmedAt || '',
    note: task.note || '',
    legacyProjectRef: task.legacyProjectRef || '',
    legacyUpstreamRef: task.legacyUpstreamRef || '',
  }
}

function hydrateSnapshot(snapshot: PlateMakingTaskStoreSnapshot): PlateMakingTaskStoreSnapshot {
  return {
    version: STORE_VERSION,
    tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
    pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
  }
}

function loadSnapshot(): PlateMakingTaskStoreSnapshot {
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
    const parsed = JSON.parse(raw) as Partial<PlateMakingTaskStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as PlateMakingTaskRecord[]) : seedSnapshot().tasks,
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

function persistSnapshot(snapshot: PlateMakingTaskStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listPlateMakingTasks(): PlateMakingTaskRecord[] {
  return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getPlateMakingTaskById(plateTaskId: string): PlateMakingTaskRecord | null {
  const task = loadSnapshot().tasks.find((item) => item.plateTaskId === plateTaskId)
  return task ? cloneTask(task) : null
}

export function listPlateMakingTasksByProject(projectId: string): PlateMakingTaskRecord[] {
  return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask)
}

export function listPlateMakingTasksByProjectNode(projectId: string, projectNodeId: string): PlateMakingTaskRecord[] {
  return loadSnapshot()
    .tasks
    .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
    .map(cloneTask)
}

export function upsertPlateMakingTask(task: PlateMakingTaskRecord): PlateMakingTaskRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    tasks: [normalizeTask(task), ...snapshot.tasks.filter((item) => item.plateTaskId !== task.plateTaskId)],
  })
  return getPlateMakingTaskById(task.plateTaskId) ?? normalizeTask(task)
}

export function updatePlateMakingTask(plateTaskId: string, patch: Partial<PlateMakingTaskRecord>): PlateMakingTaskRecord | null {
  const current = getPlateMakingTaskById(plateTaskId)
  if (!current) return null
  return upsertPlateMakingTask({ ...current, ...patch, plateTaskId: current.plateTaskId, plateTaskCode: current.plateTaskCode })
}

export function listPlateMakingTaskPendingItems(): PcsTaskPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertPlateMakingTaskPendingItem(item: PcsTaskPendingItem): PcsTaskPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
  })
  return clonePendingItem(item)
}

export function replacePlateMakingTaskStore(tasks: PlateMakingTaskRecord[], pendingItems: PcsTaskPendingItem[] = []): void {
  persistSnapshot({
    version: STORE_VERSION,
    tasks,
    pendingItems,
  })
}

export function resetPlateMakingTaskRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
