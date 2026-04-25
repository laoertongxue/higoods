import {
  getProjectById,
  getProjectNodeRecordById,
  listProjectNodes,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import {
  listProjectRelationsByProjectNode,
  listProjectRelationsBySourceObject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import {
  getFirstSampleTaskById,
  getLatestFirstSampleTaskByProjectNode,
  listFirstSampleTasks,
  updateFirstSampleTask,
  upsertFirstSampleTask,
} from './pcs-first-sample-repository.ts'
import { listPlateMakingTasksByProject } from './pcs-plate-making-repository.ts'
import { listPatternTasksByProject } from './pcs-pattern-task-repository.ts'
import { listRevisionTasksByProject } from './pcs-revision-task-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import {
  getFirstSampleCompletionMissingFields,
  getFirstSampleNodeEntryMissingFields,
  isFirstSampleCompletedStatus,
} from './pcs-sample-task-field-policy.ts'
import {
  normalizeFirstSampleTaskSourceType,
  nowTaskText,
} from './pcs-task-source-normalizer.ts'
import type { FirstSampleProjectNodeMeta, FirstSampleTaskRecord } from './pcs-first-sample-types.ts'
import type { FirstSamplePurpose, SampleMaterialMode } from './pcs-sample-chain-types.ts'
import type { PcsProjectNodeRecord, PcsProjectViewRecord } from './pcs-project-types.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'

export const FIRST_SAMPLE_FACTORY_OPTIONS = [
  { factoryId: 'factory-shenzhen-01', factoryName: '深圳工厂01' },
  { factoryId: 'factory-shenzhen-02', factoryName: '深圳工厂02' },
  { factoryId: 'factory-jakarta-01', factoryName: '雅加达工厂01' },
  { factoryId: 'factory-jakarta-02', factoryName: '雅加达工厂02' },
] as const

export interface FirstSampleProjectNodeEntryInput {
  projectId: string
  projectNodeId: string
  sourceTaskType?: string
  sourceTaskId?: string
  sourceTaskCode?: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode?: string
  sourceTechPackVersionLabel?: string
  factoryId: string
  factoryName?: string
  targetSite: string
  sampleMaterialMode: SampleMaterialMode | ''
  samplePurpose: FirstSamplePurpose | ''
  ownerName?: string
  note?: string
  operatorName: string
}

export interface FirstSampleProjectNodeDefaults {
  sourceTaskType: string
  sourceTaskId: string
  sourceTaskCode: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  ownerName: string
}

export interface FirstSampleProjectWritebackResult {
  ok: boolean
  message: string
  task: FirstSampleTaskRecord | null
  projectNode: PcsProjectNodeRecord | null
}

function normalizeTargetSite(value: string | null | undefined): string {
  if (value === '深圳' || value === '雅加达') return value
  return ''
}

function normalizeMaterialMode(value: string | null | undefined): SampleMaterialMode | '' {
  if (value === '替代布' || value === '正确布') return value
  return ''
}

function normalizeSamplePurpose(value: string | null | undefined): FirstSamplePurpose | '' {
  if (value === '首版确认' || value === '首单复用候选') return value
  return ''
}

function resolveFactoryName(factoryId: string, factoryName?: string): string {
  return factoryName || FIRST_SAMPLE_FACTORY_OPTIONS.find((item) => item.factoryId === factoryId)?.factoryName || factoryId
}

function dateKey(timestamp: string): string {
  return timestamp.slice(0, 10).replace(/-/g, '')
}

function nextFirstSampleTaskIdentity(timestamp: string): { taskId: string; taskCode: string } {
  const key = dateKey(timestamp)
  const count = listFirstSampleTasks().filter((task) => task.firstSampleTaskCode.includes(key)).length + 1
  const sequence = String(count).padStart(3, '0')
  return {
    taskId: `first_sample_${key}_${sequence}`,
    taskCode: `FS-${key}-${sequence}`,
  }
}

function sortByUpdatedAtDesc<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = left.updatedAt || left.createdAt || ''
    const rightTime = right.updatedAt || right.createdAt || ''
    return rightTime.localeCompare(leftTime)
  })
}

function readSourceTaskFallback(project: PcsProjectViewRecord): FirstSampleProjectNodeDefaults {
  const plateTask = sortByUpdatedAtDesc(listPlateMakingTasksByProject(project.projectId))[0]
  if (plateTask) {
    return {
      sourceTaskType: '制版任务',
      sourceTaskId: plateTask.plateTaskId,
      sourceTaskCode: plateTask.plateTaskCode,
      sourceTechPackVersionId: plateTask.linkedTechPackVersionId || project.linkedTechPackVersionId || '',
      sourceTechPackVersionCode: plateTask.linkedTechPackVersionCode || project.linkedTechPackVersionCode || '',
      sourceTechPackVersionLabel: plateTask.linkedTechPackVersionLabel || project.linkedTechPackVersionLabel || '',
      ownerName: project.ownerName,
    }
  }

  const revisionTask = sortByUpdatedAtDesc(listRevisionTasksByProject(project.projectId))[0]
  if (revisionTask) {
    return {
      sourceTaskType: '改版任务',
      sourceTaskId: revisionTask.revisionTaskId,
      sourceTaskCode: revisionTask.revisionTaskCode,
      sourceTechPackVersionId: revisionTask.linkedTechPackVersionId || project.linkedTechPackVersionId || '',
      sourceTechPackVersionCode: revisionTask.linkedTechPackVersionCode || project.linkedTechPackVersionCode || '',
      sourceTechPackVersionLabel: revisionTask.linkedTechPackVersionLabel || project.linkedTechPackVersionLabel || '',
      ownerName: project.ownerName,
    }
  }

  const patternTask = sortByUpdatedAtDesc(listPatternTasksByProject(project.projectId))[0]
  if (patternTask) {
    return {
      sourceTaskType: '花型任务',
      sourceTaskId: patternTask.patternTaskId,
      sourceTaskCode: patternTask.patternTaskCode,
      sourceTechPackVersionId: patternTask.linkedTechPackVersionId || project.linkedTechPackVersionId || '',
      sourceTechPackVersionCode: patternTask.linkedTechPackVersionCode || project.linkedTechPackVersionCode || '',
      sourceTechPackVersionLabel: patternTask.linkedTechPackVersionLabel || project.linkedTechPackVersionLabel || '',
      ownerName: project.ownerName,
    }
  }

  return {
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTechPackVersionId: project.linkedTechPackVersionId || '',
    sourceTechPackVersionCode: project.linkedTechPackVersionCode || '',
    sourceTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
    ownerName: project.ownerName,
  }
}

export function resolveFirstSampleProjectNodeDefaults(projectId: string): FirstSampleProjectNodeDefaults | null {
  const project = getProjectById(projectId)
  if (!project) return null
  return readSourceTaskFallback(project)
}

function assertFirstSampleProjectNode(projectId: string, projectNodeId: string): {
  project: PcsProjectViewRecord | null
  node: PcsProjectNodeRecord | null
  error: string
} {
  const project = getProjectById(projectId)
  if (!project) {
    return { project: null, node: null, error: '未找到商品项目，不能创建首版样衣打样任务。' }
  }
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) {
    return { project, node: null, error: '未找到首版样衣打样节点，不能创建任务。' }
  }
  if (node.workItemTypeCode !== 'FIRST_SAMPLE') {
    return { project, node, error: '当前节点不是首版样衣打样，不能创建首版样衣任务。' }
  }
  return { project, node, error: '' }
}

function buildRelationId(task: FirstSampleTaskRecord): string {
  return `${task.projectId}__${task.projectNodeId}__first_sample__${task.firstSampleTaskId}`
}

function buildFirstSampleRelation(
  task: FirstSampleTaskRecord,
  operatorName: string,
  timestamp: string,
): ProjectRelationRecord {
  return {
    projectRelationId: buildRelationId(task),
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectNodeId: task.projectNodeId,
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    relationRole: '执行记录',
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: task.firstSampleTaskId,
    sourceObjectCode: task.firstSampleTaskCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: task.title,
    sourceStatus: task.status,
    businessDate: timestamp,
    ownerName: task.ownerName,
    createdAt: task.createdAt || timestamp,
    createdBy: task.createdBy || operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    note: JSON.stringify(buildFirstSampleProjectMeta(task)),
    legacyRefType: 'FIRST_SAMPLE',
    legacyRefValue: task.firstSampleTaskCode,
  }
}

export function buildFirstSampleProjectMeta(task: FirstSampleTaskRecord): FirstSampleProjectNodeMeta {
  return {
    sourceTaskType: task.sourceTaskType || task.upstreamObjectType || task.upstreamModule || '',
    sourceTaskId: task.sourceTaskId || task.upstreamObjectId || '',
    sourceTaskCode: task.sourceTaskCode || task.upstreamObjectCode || '',
    sourceTechPackVersionId: task.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: task.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel || '',
    factoryId: task.factoryId || '',
    factoryName: task.factoryName || '',
    targetSite: task.targetSite || '',
    sampleMaterialMode: task.sampleMaterialMode || '',
    samplePurpose: task.samplePurpose || '',
    sampleCode: task.sampleCode || '',
    sampleImageIds: [...(task.sampleImageIds || [])],
    fitConfirmationSummary: task.fitConfirmationSummary || '',
    artworkConfirmationSummary: task.artworkConfirmationSummary || '',
    productionReadinessNote: task.productionReadinessNote || '',
    reuseAsFirstOrderBasisFlag: Boolean(task.reuseAsFirstOrderBasisFlag),
    reuseAsFirstOrderBasisConfirmedAt: task.reuseAsFirstOrderBasisConfirmedAt || '',
    reuseAsFirstOrderBasisConfirmedBy: task.reuseAsFirstOrderBasisConfirmedBy || '',
    reuseAsFirstOrderBasisNote: task.reuseAsFirstOrderBasisNote || '',
    confirmedAt: task.confirmedAt || '',
    sourceType: task.sourceType || '',
    upstreamModule: task.upstreamModule || '',
    upstreamObjectType: task.upstreamObjectType || '',
    upstreamObjectId: task.upstreamObjectId || '',
    upstreamObjectCode: task.upstreamObjectCode || '',
    status: task.status || '',
  }
}

export function getFirstSampleTaskForProjectNode(
  projectId: string,
  projectNodeId: string,
): FirstSampleTaskRecord | null {
  const task = getLatestFirstSampleTaskByProjectNode(projectId, projectNodeId)
  if (task) return task

  const relation = listProjectRelationsByProjectNode(projectId, projectNodeId).find(
    (item) => item.sourceModule === '首版样衣打样' && item.sourceObjectType === '首版样衣打样任务',
  )
  return relation?.sourceObjectId ? getFirstSampleTaskById(relation.sourceObjectId) : null
}

function unlockNextProjectNode(projectId: string, currentNode: PcsProjectNodeRecord, operatorName: string, timestamp: string): void {
  const nextNode = listProjectNodes(projectId)
    .filter((node) => node.sequenceNo > currentNode.sequenceNo && node.currentStatus === '未开始')
    .sort((left, right) => left.sequenceNo - right.sequenceNo)[0]
  if (!nextNode) return
  updateProjectNodeRecord(
    projectId,
    nextNode.projectNodeId,
    {
      currentStatus: '进行中',
      pendingActionType: '待执行',
      pendingActionText: `当前请处理：${nextNode.workItemTypeName}`,
      updatedAt: timestamp,
    },
    operatorName,
  )
}

function buildNodeLatestPatch(
  task: FirstSampleTaskRecord,
  timestamp: string,
): Partial<PcsProjectNodeRecord> {
  const missing = getFirstSampleCompletionMissingFields(task)
  if (isFirstSampleCompletedStatus(task.status) && missing.length === 0) {
    return {
      currentStatus: '已完成',
      validInstanceCount: 1,
      latestInstanceId: task.firstSampleTaskId,
      latestInstanceCode: task.firstSampleTaskCode,
      latestResultType: '首版样衣打样已完成',
      latestResultText: '首版样衣打样已完成，商品项目节点同步完成。',
      pendingActionType: '',
      pendingActionText: '',
      currentIssueType: '',
      currentIssueText: '',
      updatedAt: timestamp,
      lastEventType: '首版样衣打样已完成',
      lastEventTime: timestamp,
    }
  }

  if (task.status === '待确认') {
    return {
      currentStatus: '待确认',
      validInstanceCount: 1,
      latestInstanceId: task.firstSampleTaskId,
      latestInstanceCode: task.firstSampleTaskCode,
      latestResultType: '首版样衣打样待验收',
      latestResultText: '首版样衣打样结果已提交，待在详情中完成验收。',
      pendingActionType: '完成首版样衣验收',
      pendingActionText: '请在首版样衣打样详情中填写验收结论。',
      updatedAt: timestamp,
      lastEventType: '首版样衣打样待验收',
      lastEventTime: timestamp,
    }
  }

  return {
    currentStatus: '进行中',
    validInstanceCount: 1,
    latestInstanceId: task.firstSampleTaskId,
    latestInstanceCode: task.firstSampleTaskCode,
    latestResultType: '已创建首版样衣打样任务',
    latestResultText: '已创建首版样衣打样任务，待补齐详细信息。',
    pendingActionType: '补齐首版样衣详情',
    pendingActionText: '请在首版样衣打样详情中补齐结果信息。',
    updatedAt: timestamp,
    lastEventType: '创建首版样衣打样任务',
    lastEventTime: timestamp,
  }
}

export function createOrUpdateFirstSampleTaskFromProjectNode(
  input: FirstSampleProjectNodeEntryInput,
): FirstSampleProjectWritebackResult {
  const { project, node, error } = assertFirstSampleProjectNode(input.projectId, input.projectNodeId)
  if (!project || !node) return { ok: false, message: error, task: null, projectNode: node }

  const normalizedInput = {
    sourceTechPackVersionId: input.sourceTechPackVersionId.trim(),
    factoryId: input.factoryId.trim(),
    targetSite: normalizeTargetSite(input.targetSite),
    sampleMaterialMode: normalizeMaterialMode(input.sampleMaterialMode),
    samplePurpose: normalizeSamplePurpose(input.samplePurpose),
  }
  const missing = getFirstSampleNodeEntryMissingFields(normalizedInput)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `请先填写首版样衣必要信息：${missing.join('、')}。`,
      task: null,
      projectNode: node,
    }
  }

  const defaults = readSourceTaskFallback(project)
  const timestamp = nowTaskText()
  const existing = getFirstSampleTaskForProjectNode(project.projectId, node.projectNodeId)
  const identity = existing
    ? { taskId: existing.firstSampleTaskId, taskCode: existing.firstSampleTaskCode }
    : nextFirstSampleTaskIdentity(timestamp)
  const sourceTaskType = input.sourceTaskType || defaults.sourceTaskType
  const sourceTaskId = input.sourceTaskId || defaults.sourceTaskId
  const sourceTaskCode = input.sourceTaskCode || defaults.sourceTaskCode
  const sourceType = normalizeFirstSampleTaskSourceType(sourceTaskType)
  const factoryName = resolveFactoryName(normalizedInput.factoryId, input.factoryName)
  const ownerName = input.ownerName?.trim() || node.currentOwnerName || defaults.ownerName || project.ownerName

  const task: FirstSampleTaskRecord = {
    ...(existing || {
      firstSampleTaskId: identity.taskId,
      firstSampleTaskCode: identity.taskCode,
      title: `${project.projectName}首版样衣打样`,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sampleCode: '',
      sampleImageIds: [],
      reuseAsFirstOrderBasisFlag: false,
      reuseAsFirstOrderBasisConfirmedAt: '',
      reuseAsFirstOrderBasisConfirmedBy: '',
      reuseAsFirstOrderBasisNote: '',
      fitConfirmationSummary: '',
      artworkConfirmationSummary: '',
      productionReadinessNote: '',
      confirmedAt: '',
      status: '待处理',
      ownerId: node.currentOwnerId || project.ownerId,
      ownerName,
      priorityLevel: project.priorityLevel || '中',
      createdAt: timestamp,
      createdBy: input.operatorName,
      updatedAt: timestamp,
      updatedBy: input.operatorName,
      note: '',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: sourceTaskCode,
    }),
    firstSampleTaskId: identity.taskId,
    firstSampleTaskCode: identity.taskCode,
    title: existing?.title || `${project.projectName}首版样衣打样`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    sourceType,
    upstreamModule: sourceTaskType || '商品项目',
    upstreamObjectType: sourceTaskType || '商品项目',
    upstreamObjectId: sourceTaskId || project.projectId,
    upstreamObjectCode: sourceTaskCode || project.projectCode,
    sourceTaskType,
    sourceTaskId,
    sourceTaskCode,
    sourceTechPackVersionId: normalizedInput.sourceTechPackVersionId,
    sourceTechPackVersionCode: input.sourceTechPackVersionCode || defaults.sourceTechPackVersionCode,
    sourceTechPackVersionLabel: input.sourceTechPackVersionLabel || defaults.sourceTechPackVersionLabel,
    factoryId: normalizedInput.factoryId,
    factoryName,
    targetSite: normalizedInput.targetSite,
    sampleMaterialMode: normalizedInput.sampleMaterialMode as SampleMaterialMode,
    samplePurpose: normalizedInput.samplePurpose as FirstSamplePurpose,
    ownerName,
    note: input.note?.trim() || existing?.note || '',
    legacyProjectRef: project.projectCode,
    legacyUpstreamRef: sourceTaskCode,
    updatedAt: timestamp,
    updatedBy: input.operatorName,
  }

  const savedTask = upsertFirstSampleTask(task)
  upsertProjectRelation(buildFirstSampleRelation(savedTask, input.operatorName, timestamp))
  const projectNode = updateProjectNodeRecord(
    project.projectId,
    node.projectNodeId,
    buildNodeLatestPatch(savedTask, timestamp),
    input.operatorName,
  )
  syncProjectNodeInstanceRuntime(project.projectId, node.projectNodeId, input.operatorName, timestamp)
  return {
    ok: true,
    message: existing
      ? '已更新首版样衣必要信息，并同步商品项目节点。'
      : '已创建首版样衣打样任务，并同步商品项目节点。',
    task: savedTask,
    projectNode,
  }
}

export function syncFirstSampleTaskToProjectNode(input: {
  firstSampleTaskId: string
  operatorName: string
}): FirstSampleProjectWritebackResult {
  const task = getFirstSampleTaskById(input.firstSampleTaskId)
  if (!task) {
    return { ok: false, message: '未找到首版样衣打样任务，不能同步商品项目节点。', task: null, projectNode: null }
  }
  const { project, node, error } = assertFirstSampleProjectNode(task.projectId, task.projectNodeId)
  if (!project || !node) return { ok: false, message: error, task, projectNode: node }

  const timestamp = nowTaskText()
  upsertProjectRelation(buildFirstSampleRelation(task, input.operatorName, timestamp))
  const projectNode = updateProjectNodeRecord(
    project.projectId,
    node.projectNodeId,
    buildNodeLatestPatch(task, timestamp),
    input.operatorName,
  )
  syncProjectNodeInstanceRuntime(project.projectId, node.projectNodeId, input.operatorName, timestamp)
  if (isFirstSampleCompletedStatus(task.status) && getFirstSampleCompletionMissingFields(task).length === 0) {
    unlockNextProjectNode(project.projectId, node, input.operatorName, timestamp)
  }
  return {
    ok: true,
    message: '已同步首版样衣打样任务到商品项目节点。',
    task,
    projectNode,
  }
}

export function updateFirstSampleTaskDetailAndSync(
  firstSampleTaskId: string,
  patch: Partial<FirstSampleTaskRecord>,
  operatorName = '当前用户',
): FirstSampleProjectWritebackResult {
  const current = getFirstSampleTaskById(firstSampleTaskId)
  if (!current) {
    return { ok: false, message: '未找到首版样衣打样任务，不能保存详情。', task: null, projectNode: null }
  }
  const normalizedPatch: Partial<FirstSampleTaskRecord> = {
    ...patch,
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  }
  if (Array.isArray(patch.sampleImageIds)) {
    normalizedPatch.sampleImageIds = [...patch.sampleImageIds]
  }
  const updated = updateFirstSampleTask(firstSampleTaskId, normalizedPatch)
  if (!updated) {
    return { ok: false, message: '首版样衣打样任务保存失败。', task: null, projectNode: null }
  }
  return syncFirstSampleTaskToProjectNode({
    firstSampleTaskId: updated.firstSampleTaskId,
    operatorName,
  })
}

export function findFirstSampleTaskRelations(firstSampleTaskId: string): ProjectRelationRecord[] {
  return listProjectRelationsBySourceObject({
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: firstSampleTaskId,
  })
}
