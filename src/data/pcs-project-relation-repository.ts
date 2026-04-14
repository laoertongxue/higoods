import { createBootstrapProjectRelationSnapshot } from './pcs-project-relation-bootstrap.ts'
import { createTaskRelationBootstrapSnapshot } from './pcs-task-bootstrap.ts'
import { createTestingRelationBootstrapSnapshot } from './pcs-testing-relation-bootstrap.ts'
import {
  buildLiveProductLineProjectRelation,
  buildVideoRecordProjectRelation,
} from './pcs-testing-relation-normalizer.ts'
import { getLiveProductLineById } from './pcs-live-testing-repository.ts'
import { getProjectById, getProjectStoreSnapshot, listProjects } from './pcs-project-repository.ts'
import { getVideoTestRecordById } from './pcs-video-testing-repository.ts'
import type {
  ProjectRelationPendingItem,
  ProjectRelationRecord,
  ProjectRelationRole,
  ProjectRelationSourceModule,
  ProjectRelationSourceObjectType,
  ProjectRelationStoreSnapshot,
} from './pcs-project-relation-types.ts'

const PROJECT_RELATION_STORAGE_KEY = 'higood-pcs-project-relation-store-v2'
const PROJECT_RELATION_STORE_VERSION = 1

let memorySnapshot: ProjectRelationStoreSnapshot | null = null

export interface TestingProjectRelationCandidate {
  projectId: string
  projectCode: string
  projectName: string
  currentPhaseName: string
  eligible: boolean
  disabledReason: string
  selected: boolean
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneRelation(record: ProjectRelationRecord): ProjectRelationRecord {
  return { ...record }
}

function clonePendingItem(item: ProjectRelationPendingItem): ProjectRelationPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: ProjectRelationStoreSnapshot): ProjectRelationStoreSnapshot {
  return {
    version: snapshot.version,
    relations: snapshot.relations.map(cloneRelation),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function seedSnapshot(): ProjectRelationStoreSnapshot {
  const projectSnapshot = getProjectStoreSnapshot()
  if (projectSnapshot.projects.length === 0) {
    return {
      version: PROJECT_RELATION_STORE_VERSION,
      relations: [],
      pendingItems: [],
    }
  }
  const bootstrapSnapshot = createBootstrapProjectRelationSnapshot({
    version: PROJECT_RELATION_STORE_VERSION,
    projects: projectSnapshot.projects,
    nodes: projectSnapshot.nodes,
  })
  const taskSnapshot = createTaskRelationBootstrapSnapshot()
  const testingSnapshot = createTestingRelationBootstrapSnapshot()
  return {
    version: PROJECT_RELATION_STORE_VERSION,
    relations: dedupeRelations([...bootstrapSnapshot.relations, ...taskSnapshot.relations, ...testingSnapshot.relations]),
    pendingItems: dedupePendingItems([...bootstrapSnapshot.pendingItems, ...taskSnapshot.pendingItems, ...testingSnapshot.pendingItems]),
  }
}

function buildRelationUniqueKey(record: Pick<
  ProjectRelationRecord,
  'projectId' | 'projectNodeId' | 'relationRole' | 'sourceModule' | 'sourceObjectType' | 'sourceObjectId' | 'sourceLineId'
>): string {
  return [
    record.projectId,
    record.projectNodeId ?? '',
    record.relationRole,
    record.sourceModule,
    record.sourceObjectType,
    record.sourceObjectId,
    record.sourceLineId ?? '',
  ].join('::')
}

function normalizeRole(value: string | null | undefined): ProjectRelationRole {
  return value === '来源对象' || value === '执行记录' || value === '参考资料' ? value : '产出对象'
}

function normalizeSourceModule(value: string | null | undefined): ProjectRelationSourceModule {
  if (
    value === '渠道商品' ||
    value === '上游渠道商品同步' ||
    value === '改版任务' ||
    value === '制版任务' ||
    value === '花型任务' ||
    value === '首版样衣打样' ||
    value === '产前版样衣' ||
    value === '款式档案' ||
    value === '技术包' ||
    value === '项目资料归档' ||
    value === '样衣资产' ||
    value === '样衣台账' ||
    value === '直播' ||
    value === '短视频'
  ) {
    return value
  }
  return '样衣台账'
}

function normalizeSourceObjectType(value: string | null | undefined): ProjectRelationSourceObjectType {
  if (
    value === '渠道商品' ||
    value === '上游渠道商品同步' ||
    value === '改版任务' ||
    value === '制版任务' ||
    value === '花型任务' ||
    value === '首版样衣打样任务' ||
    value === '产前版样衣任务' ||
    value === '款式档案' ||
    value === '技术包版本' ||
    value === '项目资料归档' ||
    value === '样衣资产' ||
    value === '样衣台账事件' ||
    value === '直播商品明细' ||
    value === '短视频记录'
  ) {
    return value
  }
  return '样衣台账事件'
}

function normalizeRelation(record: ProjectRelationRecord): ProjectRelationRecord {
  return {
    ...cloneRelation(record),
    projectNodeId: record.projectNodeId || null,
    workItemTypeCode: record.workItemTypeCode || '',
    workItemTypeName: record.workItemTypeName || '',
    relationRole: normalizeRole(record.relationRole),
    sourceModule: normalizeSourceModule(record.sourceModule),
    sourceObjectType: normalizeSourceObjectType(record.sourceObjectType),
    sourceObjectId: record.sourceObjectId || '',
    sourceObjectCode: record.sourceObjectCode || '',
    sourceLineId: record.sourceLineId || null,
    sourceLineCode: record.sourceLineCode || null,
    sourceTitle: record.sourceTitle || '',
    sourceStatus: record.sourceStatus || '',
    businessDate: record.businessDate || record.updatedAt || record.createdAt || '',
    ownerName: record.ownerName || '',
    createdAt: record.createdAt || record.businessDate || '',
    createdBy: record.createdBy || '系统初始化',
    updatedAt: record.updatedAt || record.businessDate || '',
    updatedBy: record.updatedBy || '系统初始化',
    note: record.note || '',
    legacyRefType: record.legacyRefType || '',
    legacyRefValue: record.legacyRefValue || '',
  }
}

function normalizePendingItem(item: ProjectRelationPendingItem): ProjectRelationPendingItem {
  return {
    ...clonePendingItem(item),
    sourceModule: item.sourceModule || '未识别来源模块',
    sourceObjectCode: item.sourceObjectCode || '',
    rawProjectCode: item.rawProjectCode || '',
    reason: item.reason || '未提供待补齐原因。',
    discoveredAt: item.discoveredAt || '',
    sourceTitle: item.sourceTitle || '',
    legacyRefType: item.legacyRefType || '',
    legacyRefValue: item.legacyRefValue || '',
  }
}

function dedupeRelations(records: ProjectRelationRecord[]): ProjectRelationRecord[] {
  const map = new Map<string, ProjectRelationRecord>()
  records.forEach((record) => {
    const normalized = normalizeRelation(record)
    const key = buildRelationUniqueKey(normalized)
    const existing = map.get(key)
    if (!existing || normalized.updatedAt.localeCompare(existing.updatedAt) >= 0) {
      map.set(key, normalized)
    }
  })
  return Array.from(map.values()).sort((a, b) => b.businessDate.localeCompare(a.businessDate))
}

function buildPendingUniqueKey(item: Pick<
  ProjectRelationPendingItem,
  'sourceModule' | 'sourceObjectCode' | 'rawProjectCode' | 'reason'
>): string {
  return [item.sourceModule, item.sourceObjectCode, item.rawProjectCode, item.reason].join('::')
}

function dedupePendingItems(items: ProjectRelationPendingItem[]): ProjectRelationPendingItem[] {
  const map = new Map<string, ProjectRelationPendingItem>()
  items.forEach((item) => {
    const normalized = normalizePendingItem(item)
    map.set(buildPendingUniqueKey(normalized), normalized)
  })
  return Array.from(map.values()).sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
}

function mergeMissingSeedData(snapshot: ProjectRelationStoreSnapshot): ProjectRelationStoreSnapshot {
  const seeded = seedSnapshot()
  return {
    version: PROJECT_RELATION_STORE_VERSION,
    relations: dedupeRelations([...snapshot.relations, ...seeded.relations]),
    pendingItems: dedupePendingItems([...snapshot.pendingItems, ...seeded.pendingItems]),
  }
}

function hydrateSnapshot(snapshot: ProjectRelationStoreSnapshot): ProjectRelationStoreSnapshot {
  return {
    version: PROJECT_RELATION_STORE_VERSION,
    relations: dedupeRelations(Array.isArray(snapshot.relations) ? snapshot.relations : []),
    pendingItems: dedupePendingItems(Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : []),
  }
}

function loadSnapshot(): ProjectRelationStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(PROJECT_RELATION_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<ProjectRelationStoreSnapshot>
    if (!Array.isArray(parsed.relations) || !Array.isArray(parsed.pendingItems)) {
      memorySnapshot = seedSnapshot()
      localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    memorySnapshot = mergeMissingSeedData(hydrateSnapshot({
      version: PROJECT_RELATION_STORE_VERSION,
      relations: parsed.relations as ProjectRelationRecord[],
      pendingItems: parsed.pendingItems as ProjectRelationPendingItem[],
    }))
    localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = seedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

export function ensurePcsProjectFormalRelationSeedReady(): void {
  const merged = mergeMissingSeedData(loadSnapshot())
  persistSnapshot(merged)
}

function persistSnapshot(snapshot: ProjectRelationStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

function nextRelationId(): string {
  const snapshot = loadSnapshot()
  return `rel_manual_${String(snapshot.relations.length + 1).padStart(4, '0')}`
}

export function getProjectRelationStoreSnapshot(): ProjectRelationStoreSnapshot {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
}

export function listProjectRelations(): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot().relations.map(cloneRelation)
}

export function listProjectRelationsByProject(projectId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter((record) => record.projectId === projectId)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationsByProjectNode(projectId: string, projectNodeId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter((record) => record.projectId === projectId && record.projectNodeId === projectNodeId)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationsBySourceObject(input: {
  sourceModule: string
  sourceObjectType: string
  sourceObjectId: string
  sourceLineId?: string | null
}): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === input.sourceModule &&
        record.sourceObjectType === input.sourceObjectType &&
        record.sourceObjectId === input.sourceObjectId &&
        (input.sourceLineId ?? null) === (record.sourceLineId ?? null),
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationsByTaskSource(
  sourceModule: '改版任务' | '制版任务' | '花型任务' | '首版样衣打样' | '产前版样衣',
  sourceObjectId: string,
): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === sourceModule &&
        record.sourceObjectId === sourceObjectId,
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationPendingItems(): ProjectRelationPendingItem[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function listProjectRelationsByLiveProductLine(liveLineId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === '直播' &&
        record.sourceObjectType === '直播商品明细' &&
        record.sourceLineId === liveLineId,
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationsByVideoRecord(videoRecordId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === '短视频' &&
        record.sourceObjectType === '短视频记录' &&
        record.sourceObjectId === videoRecordId,
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

function sortTestingCandidates(candidates: TestingProjectRelationCandidate[]): TestingProjectRelationCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    if (a.selected !== b.selected) return a.selected ? -1 : 1
    return a.projectCode.localeCompare(b.projectCode)
  })
}

export function listLiveProductLineProjectRelationCandidates(liveLineId: string): TestingProjectRelationCandidate[] {
  const line = getLiveProductLineById(liveLineId)
  if (!line) return []
  const selectedProjectIds = new Set(listProjectRelationsByLiveProductLine(liveLineId).map((relation) => relation.projectId))
  return sortTestingCandidates(
    listProjects().map((project) => {
      const result = buildLiveProductLineProjectRelation(line, project.projectId, { operatorName: '当前用户' })
      return {
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        currentPhaseName: project.currentPhaseName,
        eligible: Boolean(result.relation),
        disabledReason: result.errorMessage || '',
        selected: selectedProjectIds.has(project.projectId),
      }
    }),
  )
}

export function listVideoRecordProjectRelationCandidates(videoRecordId: string): TestingProjectRelationCandidate[] {
  const record = getVideoTestRecordById(videoRecordId)
  if (!record) return []
  const selectedProjectIds = new Set(listProjectRelationsByVideoRecord(videoRecordId).map((relation) => relation.projectId))
  return sortTestingCandidates(
    listProjects().map((project) => {
      const result = buildVideoRecordProjectRelation(record, project.projectId, { operatorName: '当前用户' })
      return {
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        currentPhaseName: project.currentPhaseName,
        eligible: Boolean(result.relation),
        disabledReason: result.errorMessage || '',
        selected: selectedProjectIds.has(project.projectId),
      }
    }),
  )
}

export function listProjectRelationsByStyleArchive(styleId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === '款式档案' &&
        record.sourceObjectType === '款式档案' &&
        record.sourceObjectId === styleId,
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function listProjectRelationsByTechnicalVersion(technicalVersionId: string): ProjectRelationRecord[] {
  ensurePcsProjectFormalRelationSeedReady()
  return loadSnapshot()
    .relations
    .filter(
      (record) =>
        record.sourceModule === '技术包' &&
        record.sourceObjectType === '技术包版本' &&
        record.sourceObjectId === technicalVersionId,
    )
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneRelation)
}

export function upsertProjectRelation(record: ProjectRelationRecord): ProjectRelationRecord {
  const snapshot = loadSnapshot()
  const normalized = normalizeRelation({
    ...record,
    projectRelationId: record.projectRelationId || nextRelationId(),
  })
  persistSnapshot({
    ...snapshot,
    relations: [...snapshot.relations, normalized],
  })
  return cloneRelation(normalized)
}

export function upsertProjectRelations(records: ProjectRelationRecord[]): ProjectRelationRecord[] {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    relations: [...snapshot.relations, ...records.map(normalizeRelation)],
  })
  return listProjectRelations()
}

function replaceRelations(
  predicate: (record: ProjectRelationRecord) => boolean,
  nextRelations: ProjectRelationRecord[],
  nextPendingItems: ProjectRelationPendingItem[] = [],
): void {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    relations: [...snapshot.relations.filter((record) => !predicate(record)), ...nextRelations],
    pendingItems: [...snapshot.pendingItems, ...nextPendingItems],
  })
}

function removeRelations(predicate: (record: ProjectRelationRecord) => boolean): void {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    relations: snapshot.relations.filter((record) => !predicate(record)),
  })
}

export function replaceLiveProductLineProjectRelations(
  liveLineId: string,
  projectIds: string[],
  operatorName = '当前用户',
): {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
  errors: string[]
} {
  const line = getLiveProductLineById(liveLineId)
  if (!line) {
    return {
      relations: [],
      pendingItems: [],
      errors: ['未找到对应的直播商品明细。'],
    }
  }

  const relations: ProjectRelationRecord[] = []
  const pendingItems: ProjectRelationPendingItem[] = []
  const errors: string[] = []

  projectIds.forEach((projectId) => {
    const result = buildLiveProductLineProjectRelation(line, projectId, { operatorName })
    if (result.relation) relations.push(result.relation)
    if (result.pendingItem) pendingItems.push(result.pendingItem)
    if (result.errorMessage) errors.push(result.errorMessage)
  })

  replaceRelations((record) => record.sourceModule === '直播' && record.sourceObjectType === '直播商品明细' && record.sourceLineId === liveLineId, relations, pendingItems)
  return {
    relations: listProjectRelationsByLiveProductLine(liveLineId),
    pendingItems,
    errors: Array.from(new Set(errors)),
  }
}

export function replaceVideoRecordProjectRelations(
  videoRecordId: string,
  projectIds: string[],
  operatorName = '当前用户',
): {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
  errors: string[]
} {
  const record = getVideoTestRecordById(videoRecordId)
  if (!record) {
    return {
      relations: [],
      pendingItems: [],
      errors: ['未找到对应的短视频记录。'],
    }
  }

  const relations: ProjectRelationRecord[] = []
  const pendingItems: ProjectRelationPendingItem[] = []
  const errors: string[] = []

  projectIds.forEach((projectId) => {
    const result = buildVideoRecordProjectRelation(record, projectId, { operatorName })
    if (result.relation) relations.push(result.relation)
    if (result.pendingItem) pendingItems.push(result.pendingItem)
    if (result.errorMessage) errors.push(result.errorMessage)
  })

  replaceRelations((item) => item.sourceModule === '短视频' && item.sourceObjectType === '短视频记录' && item.sourceObjectId === videoRecordId, relations, pendingItems)
  return {
    relations: listProjectRelationsByVideoRecord(videoRecordId),
    pendingItems,
    errors: Array.from(new Set(errors)),
  }
}

export function unlinkLiveProductLineProjectRelation(liveLineId: string, projectId: string): void {
  removeRelations(
    (record) =>
      record.sourceModule === '直播' &&
      record.sourceObjectType === '直播商品明细' &&
      record.sourceLineId === liveLineId &&
      record.projectId === projectId,
  )
}

export function unlinkVideoRecordProjectRelation(videoRecordId: string, projectId: string): void {
  removeRelations(
    (record) =>
      record.sourceModule === '短视频' &&
      record.sourceObjectType === '短视频记录' &&
      record.sourceObjectId === videoRecordId &&
      record.projectId === projectId,
  )
}

export function getProjectRelationProjectLabel(projectId: string): string {
  const project = getProjectById(projectId)
  return project ? `${project.projectCode} · ${project.projectName}` : projectId
}

export function replaceProjectRelationStore(snapshot: ProjectRelationStoreSnapshot): void {
  persistSnapshot(snapshot)
}

export function clearProjectRelationStore(): void {
  persistSnapshot({
    version: PROJECT_RELATION_STORE_VERSION,
    relations: [],
    pendingItems: [],
  })
}

export function resetProjectRelationRepository(): void {
  const snapshot = seedSnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(PROJECT_RELATION_STORAGE_KEY)
    localStorage.setItem(PROJECT_RELATION_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
