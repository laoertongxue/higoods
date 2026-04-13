import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { PcsProjectNodeRecord, PcsTaskPendingItem } from './pcs-project-types.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasks,
  upsertFirstSampleTask,
  upsertFirstSampleTaskPendingItem,
} from './pcs-first-sample-repository.ts'
import type { FirstSampleTaskRecord } from './pcs-first-sample-types.ts'
import {
  getPatternTaskById,
  listPatternTasks,
  upsertPatternTask,
  upsertPatternTaskPendingItem,
} from './pcs-pattern-task-repository.ts'
import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
  upsertPlateMakingTask,
  upsertPlateMakingTaskPendingItem,
} from './pcs-plate-making-repository.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import {
  getPreProductionSampleTaskById,
  listPreProductionSampleTasks,
  upsertPreProductionSampleTask,
  upsertPreProductionSampleTaskPendingItem,
} from './pcs-pre-production-sample-repository.ts'
import type { PreProductionSampleTaskRecord } from './pcs-pre-production-sample-types.ts'
import {
  getRevisionTaskById,
  listRevisionTasks,
  upsertRevisionTask,
  upsertRevisionTaskPendingItem,
} from './pcs-revision-task-repository.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import {
  nowTaskText,
  type FirstSampleTaskSourceType,
  type PatternTaskSourceType,
  type PlateMakingTaskSourceType,
  type PreProductionSampleTaskSourceType,
  type RevisionTaskSourceType,
} from './pcs-task-source-normalizer.ts'

type DownstreamTaskType = 'PATTERN' | 'PRINT' | 'SAMPLE' | 'PRE_PRODUCTION'

interface BaseTaskCreateInput {
  projectId: string
  title: string
  operatorName?: string
  ownerId?: string
  ownerName?: string
  priorityLevel?: '高' | '中' | '低'
  note?: string
}

export interface RevisionTaskCreateInput extends BaseTaskCreateInput {
  revisionTaskId?: string
  revisionTaskCode?: string
  sourceType: RevisionTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  productStyleCode?: string
  spuCode?: string
  participantNames?: string[]
  dueAt?: string
  revisionScopeCodes?: string[]
  revisionScopeNames?: string[]
  revisionVersion?: string
}

export interface PlateMakingTaskCreateInput extends BaseTaskCreateInput {
  plateTaskId?: string
  plateTaskCode?: string
  sourceType: PlateMakingTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  productStyleCode?: string
  spuCode?: string
  participantNames?: string[]
  dueAt?: string
  patternType?: string
  sizeRange?: string
  patternVersion?: string
}

export interface PatternTaskCreateInput extends BaseTaskCreateInput {
  patternTaskId?: string
  patternTaskCode?: string
  sourceType: PatternTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  productStyleCode?: string
  spuCode?: string
  artworkType?: string
  patternMode?: string
  artworkName?: string
  artworkVersion?: string
  dueAt?: string
}

export interface FirstSampleTaskCreateInput extends BaseTaskCreateInput {
  firstSampleTaskId?: string
  firstSampleTaskCode?: string
  sourceType: FirstSampleTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  factoryId?: string
  factoryName?: string
  targetSite?: string
  expectedArrival?: string
  trackingNo?: string
  sampleAssetId?: string
  sampleCode?: string
}

export interface PreProductionSampleTaskCreateInput extends BaseTaskCreateInput {
  preProductionSampleTaskId?: string
  preProductionSampleTaskCode?: string
  sourceType: PreProductionSampleTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  factoryId?: string
  factoryName?: string
  targetSite?: string
  patternVersion?: string
  artworkVersion?: string
  expectedArrival?: string
  trackingNo?: string
  sampleAssetId?: string
  sampleCode?: string
}

interface TaskWritebackSuccess<TTask> {
  ok: true
  task: TTask
  relation: ProjectRelationRecord
  message: string
}

interface TaskWritebackFailure {
  ok: false
  message: string
  pendingItem: PcsTaskPendingItem
}

export type TaskWritebackResult<TTask> = TaskWritebackSuccess<TTask> | TaskWritebackFailure

export interface RevisionDownstreamCreateResult {
  successCount: number
  failureMessages: string[]
  createdTaskCodes: string[]
}

function dateKey(): string {
  return nowTaskText().slice(0, 10).replace(/-/g, '')
}

function nextCode(prefix: string, currentCount: number): string {
  return `${prefix}-${dateKey()}-${String(currentCount + 1).padStart(3, '0')}`
}

function makePendingItem(
  taskType: string,
  rawTaskCode: string,
  rawProjectField: string,
  rawSourceField: string,
  reason: string,
): PcsTaskPendingItem {
  return {
    pendingId: `${taskType}_${rawTaskCode || 'empty'}_${dateKey()}_${reason}`.replace(/[^a-zA-Z0-9]/g, '_'),
    taskType,
    rawTaskCode,
    rawProjectField,
    rawSourceField,
    reason,
    discoveredAt: nowTaskText(),
  }
}

function makeRelationId(projectId: string, projectNodeId: string, sourceModule: string, sourceObjectId: string): string {
  return `rel_${projectId}_${projectNodeId}_${sourceModule}_${sourceObjectId}`.replace(/[^a-zA-Z0-9]/g, '_')
}

function getProjectOrPending(
  taskType: string,
  projectId: string,
  taskCode: string,
  rawSourceField: string,
): { project: NonNullable<ReturnType<typeof getProjectById>> | null; pendingItem: PcsTaskPendingItem | null } {
  const project = getProjectById(projectId)
  if (project) return { project, pendingItem: null }
  return {
    project: null,
    pendingItem: makePendingItem(taskType, taskCode, projectId, rawSourceField, '当前商品项目不存在，不能正式创建任务。'),
  }
}

function getNodeOrPending(
  taskType: string,
  projectId: string,
  projectCode: string,
  taskCode: string,
  workItemTypeCode: string,
): { node: PcsProjectNodeRecord | null; pendingItem: PcsTaskPendingItem | null } {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (node) return { node, pendingItem: null }
  return {
    node: null,
    pendingItem: makePendingItem(taskType, taskCode, projectCode, workItemTypeCode, '当前项目未配置对应项目节点，不能正式创建任务。'),
  }
}

function blockCancelledNode(
  taskType: string,
  taskCode: string,
  projectCode: string,
  node: PcsProjectNodeRecord,
): PcsTaskPendingItem | null {
  if (node.currentStatus !== '已取消') return null
  return makePendingItem(taskType, taskCode, projectCode, node.workItemTypeCode, `当前项目节点已取消，不能创建对应${taskType}。`)
}

function resolveUpstreamForProjectTemplate(project: NonNullable<ReturnType<typeof getProjectById>>) {
  return {
    upstreamModule: '项目模板',
    upstreamObjectType: '模板阶段',
    upstreamObjectId: project.templateId,
    upstreamObjectCode: project.templateVersion,
  }
}

function ensureFormalSource(
  taskType: string,
  sourceType: string,
  upstreamObjectId: string,
  upstreamObjectCode: string,
  fallbackSourceField: string,
): string | null {
  if (sourceType === '人工创建' || sourceType === '项目模板阶段' || sourceType === '既有商品改款' || sourceType === '既有商品二次开发' || sourceType === '花型复用调色') {
    return null
  }
  if (upstreamObjectId || upstreamObjectCode || fallbackSourceField) {
    return null
  }
  return `${taskType}缺少正式来源对象，当前不能正式创建。`
}

function relationPayload(input: {
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceModule: ProjectRelationRecord['sourceModule']
  sourceObjectType: ProjectRelationRecord['sourceObjectType']
  sourceObjectId: string
  sourceObjectCode: string
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  operatorName: string
}): ProjectRelationRecord {
  return {
    projectRelationId: makeRelationId(input.projectId, input.projectNodeId, input.sourceModule, input.sourceObjectId),
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeName,
    relationRole: '产出对象',
    sourceModule: input.sourceModule,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceObjectCode: input.sourceObjectCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: input.sourceTitle,
    sourceStatus: input.sourceStatus,
    businessDate: input.businessDate,
    ownerName: input.ownerName,
    createdAt: input.businessDate,
    createdBy: input.operatorName,
    updatedAt: input.businessDate,
    updatedBy: input.operatorName,
    note: '',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

function updateRevisionNode(node: PcsProjectNodeRecord, task: RevisionTaskRecord, alreadyExists: boolean): void {
  if (alreadyExists) return
  updateProjectNodeRecord(task.projectId, node.projectNodeId, {
    latestInstanceId: task.revisionTaskId,
    latestInstanceCode: task.revisionTaskCode,
    validInstanceCount: (node.validInstanceCount || 0) + 1,
    latestResultType: '已创建改版任务',
    latestResultText: '已根据测款结论创建改版任务',
    pendingActionType: '等待改版完成',
    pendingActionText: '请推进改版任务，完成后重新进入测款',
    updatedAt: task.createdAt,
  }, task.ownerName || '当前用户')
}

function updateTaskNode(
  node: PcsProjectNodeRecord,
  task: PlateMakingTaskRecord | PatternTaskRecord | FirstSampleTaskRecord | PreProductionSampleTaskRecord,
  input: {
    latestInstanceId: string
    latestInstanceCode: string
    latestResultType: string
    latestResultText: string
    pendingActionType: string
    pendingActionText: string
  },
  alreadyExists: boolean,
): void {
  if (alreadyExists) return
  updateProjectNodeRecord(task.projectId, node.projectNodeId, {
    currentStatus: '进行中',
    latestInstanceId: input.latestInstanceId,
    latestInstanceCode: input.latestInstanceCode,
    validInstanceCount: (node.validInstanceCount || 0) + 1,
    latestResultType: input.latestResultType,
    latestResultText: input.latestResultText,
    pendingActionType: input.pendingActionType,
    pendingActionText: input.pendingActionText,
    updatedAt: task.createdAt,
  }, task.ownerName || '当前用户')
}

export function saveRevisionTaskDraft(input: RevisionTaskCreateInput): RevisionTaskRecord {
  const now = nowTaskText()
  const taskId = input.revisionTaskId || nextCode('RTD', listRevisionTasks().length)
  return upsertRevisionTask({
    revisionTaskId: taskId,
    revisionTaskCode: input.revisionTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemTypeName: '测款结论判定',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    productStyleCode: input.productStyleCode || '',
    spuCode: input.spuCode || '',
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    revisionScopeCodes: input.revisionScopeCodes || [],
    revisionScopeNames: input.revisionScopeNames || [],
    revisionVersion: input.revisionVersion || '',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    createdAt: now,
    createdBy: input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

export function savePlateMakingTaskDraft(input: PlateMakingTaskCreateInput): PlateMakingTaskRecord {
  const now = nowTaskText()
  const taskId = input.plateTaskId || nextCode('PTD', listPlateMakingTasks().length)
  return upsertPlateMakingTask({
    plateTaskId: taskId,
    plateTaskCode: input.plateTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    productStyleCode: input.productStyleCode || '',
    spuCode: input.spuCode || '',
    patternType: input.patternType || '',
    sizeRange: input.sizeRange || '',
    patternVersion: input.patternVersion || '',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: now,
    createdBy: input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

export function savePatternTaskDraft(input: PatternTaskCreateInput): PatternTaskRecord {
  const now = nowTaskText()
  const taskId = input.patternTaskId || nextCode('ATD', listPatternTasks().length)
  return upsertPatternTask({
    patternTaskId: taskId,
    patternTaskCode: input.patternTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    productStyleCode: input.productStyleCode || '',
    spuCode: input.spuCode || '',
    artworkType: input.artworkType || '',
    patternMode: input.patternMode || '',
    artworkName: input.artworkName || '',
    artworkVersion: input.artworkVersion || '',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: now,
    createdBy: input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

function buildFirstSampleCode(targetSite: string, count: number): string {
  return `SY-${targetSite === '雅加达' ? 'JKT' : 'SZ'}-${String(count + 21).padStart(5, '0')}`
}

export function saveFirstSampleTaskDraft(input: FirstSampleTaskCreateInput): FirstSampleTaskRecord {
  const now = nowTaskText()
  const taskId = input.firstSampleTaskId || nextCode('FSD', listFirstSampleTasks().length)
  return upsertFirstSampleTask({
    firstSampleTaskId: taskId,
    firstSampleTaskCode: input.firstSampleTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    expectedArrival: input.expectedArrival || '',
    trackingNo: input.trackingNo || '',
    sampleAssetId: input.sampleAssetId || '',
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listFirstSampleTasks().length),
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    priorityLevel: input.priorityLevel || '中',
    createdAt: now,
    createdBy: input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

export function savePreProductionSampleTaskDraft(input: PreProductionSampleTaskCreateInput): PreProductionSampleTaskRecord {
  const now = nowTaskText()
  const taskId = input.preProductionSampleTaskId || nextCode('PPD', listPreProductionSampleTasks().length)
  return upsertPreProductionSampleTask({
    preProductionSampleTaskId: taskId,
    preProductionSampleTaskCode: input.preProductionSampleTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    workItemTypeName: '产前版样衣',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    patternVersion: input.patternVersion || '',
    artworkVersion: input.artworkVersion || '',
    expectedArrival: input.expectedArrival || '',
    trackingNo: input.trackingNo || '',
    sampleAssetId: input.sampleAssetId || '',
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listPreProductionSampleTasks().length + 50),
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    priorityLevel: input.priorityLevel || '中',
    createdAt: now,
    createdBy: input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

export function createRevisionTaskWithProjectRelation(input: RevisionTaskCreateInput): TaskWritebackResult<RevisionTaskRecord> {
  const rawCode = input.revisionTaskCode || input.revisionTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('改版任务', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertRevisionTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const upstreamError = ensureFormalSource('改版任务', input.sourceType, input.upstreamObjectId || '', input.upstreamObjectCode || '', '')
  if (upstreamError) {
    const pendingItem = makePendingItem('改版任务', rawCode, project.projectCode, input.upstreamObjectCode || input.upstreamObjectId || '', upstreamError)
    upsertRevisionTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('改版任务', project.projectId, project.projectCode, rawCode, 'TEST_CONCLUSION')
  if (!node || nodePending) {
    upsertRevisionTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('改版任务', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertRevisionTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.revisionTaskId || nextCode('RT', listRevisionTasks().length)
  const existing = getRevisionTaskById(taskId)
  const task = upsertRevisionTask({
    revisionTaskId: taskId,
    revisionTaskCode: input.revisionTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'TEST_CONCLUSION',
    workItemTypeName: '测款结论判定',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    productStyleCode: input.productStyleCode || project.styleNumber || '',
    spuCode: input.spuCode || '',
    status: '进行中',
    ownerId: input.ownerId || project.ownerId,
    ownerName: input.ownerName || project.ownerName,
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    revisionScopeCodes: input.revisionScopeCodes || [],
    revisionScopeNames: input.revisionScopeNames || [],
    revisionVersion: input.revisionVersion || '',
    linkedTechPackVersionId: existing?.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: existing?.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: existing?.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: existing?.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: existing?.linkedTechPackUpdatedAt || '',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })

  const relation = upsertProjectRelation(
    relationPayload({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'TEST_CONCLUSION',
      workItemTypeName: '测款结论判定',
      sourceModule: '改版任务',
      sourceObjectType: '改版任务',
      sourceObjectId: task.revisionTaskId,
      sourceObjectCode: task.revisionTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateRevisionNode(node, task, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '项目已创建改版任务，已写项目关系，已更新项目节点。' }
}

function resolvePlateUpstream(project: NonNullable<ReturnType<typeof getProjectById>>, input: PlateMakingTaskCreateInput) {
  if (input.sourceType === '项目模板阶段') return resolveUpstreamForProjectTemplate(project)
  if (input.sourceType === '既有商品二次开发') {
    return {
      upstreamModule: '既有商品',
      upstreamObjectType: '商品档案',
      upstreamObjectId: input.productStyleCode || project.styleNumber || project.projectId,
      upstreamObjectCode: input.spuCode || input.productStyleCode || project.styleNumber || project.projectCode,
    }
  }
  return {
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
  }
}

export function createPlateMakingTaskWithProjectRelation(
  input: PlateMakingTaskCreateInput,
): TaskWritebackResult<PlateMakingTaskRecord> {
  const rawCode = input.plateTaskCode || input.plateTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('制版任务', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertPlateMakingTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const upstream = resolvePlateUpstream(project, input)
  const upstreamError = ensureFormalSource('制版任务', input.sourceType, upstream.upstreamObjectId, upstream.upstreamObjectCode, input.productStyleCode || input.spuCode || '')
  if (upstreamError) {
    const pendingItem = makePendingItem('制版任务', rawCode, project.projectCode, upstream.upstreamObjectCode || upstream.upstreamObjectId || '', upstreamError)
    upsertPlateMakingTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('制版任务', project.projectId, project.projectCode, rawCode, 'PATTERN_TASK')
  if (!node || nodePending) {
    upsertPlateMakingTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('制版任务', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertPlateMakingTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.plateTaskId || nextCode('PT', listPlateMakingTasks().length)
  const existing = getPlateMakingTaskById(taskId)
  const task = upsertPlateMakingTask({
    plateTaskId: taskId,
    plateTaskCode: input.plateTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceType: input.sourceType,
    ...upstream,
    productStyleCode: input.productStyleCode || project.styleNumber || '',
    spuCode: input.spuCode || '',
    patternType: input.patternType || '',
    sizeRange: input.sizeRange || '',
    patternVersion: input.patternVersion || '',
    linkedTechPackVersionId: existing?.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: existing?.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: existing?.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: existing?.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: existing?.linkedTechPackUpdatedAt || '',
    status: '进行中',
    ownerId: input.ownerId || project.ownerId,
    ownerName: input.ownerName || project.ownerName,
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })

  const relation = upsertProjectRelation(
    relationPayload({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: '制版任务',
      sourceModule: '制版任务',
      sourceObjectType: '制版任务',
      sourceObjectId: task.plateTaskId,
      sourceObjectCode: task.plateTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateTaskNode(node, task, {
    latestInstanceId: task.plateTaskId,
    latestInstanceCode: task.plateTaskCode,
    latestResultType: '已创建制版任务',
    latestResultText: '已创建制版任务，等待输出纸样与版本',
    pendingActionType: '输出纸样版本',
    pendingActionText: '请推进制版并输出纸样版本',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '制版任务已创建，已写项目关系，已更新项目节点。' }
}

function resolvePatternUpstream(project: NonNullable<ReturnType<typeof getProjectById>>, input: PatternTaskCreateInput) {
  if (input.sourceType === '项目模板阶段') return resolveUpstreamForProjectTemplate(project)
  if (input.sourceType === '花型复用调色') {
    return {
      upstreamModule: '花型库',
      upstreamObjectType: '花型资产',
      upstreamObjectId: input.artworkName || project.projectId,
      upstreamObjectCode: input.artworkVersion || input.artworkName || project.projectCode,
    }
  }
  return {
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
  }
}

export function createPatternTaskWithProjectRelation(input: PatternTaskCreateInput): TaskWritebackResult<PatternTaskRecord> {
  const rawCode = input.patternTaskCode || input.patternTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('花型任务', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertPatternTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const upstream = resolvePatternUpstream(project, input)
  const upstreamError = ensureFormalSource('花型任务', input.sourceType, upstream.upstreamObjectId, upstream.upstreamObjectCode, input.artworkName || '')
  if (upstreamError) {
    const pendingItem = makePendingItem('花型任务', rawCode, project.projectCode, upstream.upstreamObjectCode || upstream.upstreamObjectId || '', upstreamError)
    upsertPatternTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('花型任务', project.projectId, project.projectCode, rawCode, 'PATTERN_ARTWORK_TASK')
  if (!node || nodePending) {
    upsertPatternTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('花型任务', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertPatternTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.patternTaskId || nextCode('AT', listPatternTasks().length)
  const existing = getPatternTaskById(taskId)
  const task = upsertPatternTask({
    patternTaskId: taskId,
    patternTaskCode: input.patternTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    sourceType: input.sourceType,
    ...upstream,
    productStyleCode: input.productStyleCode || project.styleNumber || '',
    spuCode: input.spuCode || '',
    artworkType: input.artworkType || '',
    patternMode: input.patternMode || '',
    artworkName: input.artworkName || '',
    artworkVersion: input.artworkVersion || '',
    linkedTechPackVersionId: existing?.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: existing?.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: existing?.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: existing?.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: existing?.linkedTechPackUpdatedAt || '',
    status: '进行中',
    ownerId: input.ownerId || project.ownerId,
    ownerName: input.ownerName || project.ownerName,
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })

  const relation = upsertProjectRelation(
    relationPayload({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: '花型任务',
      sourceModule: '花型任务',
      sourceObjectType: '花型任务',
      sourceObjectId: task.patternTaskId,
      sourceObjectCode: task.patternTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateTaskNode(node, task, {
    latestInstanceId: task.patternTaskId,
    latestInstanceCode: task.patternTaskCode,
    latestResultType: '已创建花型任务',
    latestResultText: '已创建花型任务，等待输出花型版本',
    pendingActionType: '输出花型版本',
    pendingActionText: '请推进花型任务并输出花型版本',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '花型任务已创建，已写项目关系，已更新项目节点。' }
}

export function createFirstSampleTaskWithProjectRelation(
  input: FirstSampleTaskCreateInput,
): TaskWritebackResult<FirstSampleTaskRecord> {
  const rawCode = input.firstSampleTaskCode || input.firstSampleTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('首版样衣打样', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertFirstSampleTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const upstreamError = ensureFormalSource('首版样衣打样', input.sourceType, input.upstreamObjectId || '', input.upstreamObjectCode || '', '')
  if (upstreamError) {
    const pendingItem = makePendingItem('首版样衣打样', rawCode, project.projectCode, input.upstreamObjectCode || input.upstreamObjectId || '', upstreamError)
    upsertFirstSampleTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('首版样衣打样', project.projectId, project.projectCode, rawCode, 'FIRST_SAMPLE')
  if (!node || nodePending) {
    upsertFirstSampleTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('首版样衣打样', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertFirstSampleTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.firstSampleTaskId || nextCode('FS', listFirstSampleTasks().length)
  const existing = getFirstSampleTaskById(taskId)
  const task = upsertFirstSampleTask({
    firstSampleTaskId: taskId,
    firstSampleTaskCode: input.firstSampleTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'FIRST_SAMPLE',
    workItemTypeName: '首版样衣打样',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    expectedArrival: input.expectedArrival || '',
    trackingNo: input.trackingNo || '',
    sampleAssetId: input.sampleAssetId || '',
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listFirstSampleTasks().length),
    status: '待发样',
    ownerId: input.ownerId || project.ownerId,
    ownerName: input.ownerName || project.ownerName,
    priorityLevel: input.priorityLevel || '中',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })

  const relation = upsertProjectRelation(
    relationPayload({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sourceModule: '首版样衣打样',
      sourceObjectType: '首版样衣打样任务',
      sourceObjectId: task.firstSampleTaskId,
      sourceObjectCode: task.firstSampleTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateTaskNode(node, task, {
    latestInstanceId: task.firstSampleTaskId,
    latestInstanceCode: task.firstSampleTaskCode,
    latestResultType: '已创建首版样衣打样任务',
    latestResultText: '已创建首版样衣打样任务，等待安排发样',
    pendingActionType: '安排发样',
    pendingActionText: '请安排首版样衣发样',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '首版样衣打样任务已创建，已写项目关系，已更新项目节点。' }
}

export function createPreProductionSampleTaskWithProjectRelation(
  input: PreProductionSampleTaskCreateInput,
): TaskWritebackResult<PreProductionSampleTaskRecord> {
  const rawCode = input.preProductionSampleTaskCode || input.preProductionSampleTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('产前版样衣', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertPreProductionSampleTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const upstreamError = ensureFormalSource('产前版样衣', input.sourceType, input.upstreamObjectId || '', input.upstreamObjectCode || '', '')
  if (upstreamError) {
    const pendingItem = makePendingItem('产前版样衣', rawCode, project.projectCode, input.upstreamObjectCode || input.upstreamObjectId || '', upstreamError)
    upsertPreProductionSampleTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('产前版样衣', project.projectId, project.projectCode, rawCode, 'PRE_PRODUCTION_SAMPLE')
  if (!node || nodePending) {
    upsertPreProductionSampleTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('产前版样衣', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertPreProductionSampleTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.preProductionSampleTaskId || nextCode('PP', listPreProductionSampleTasks().length)
  const existing = getPreProductionSampleTaskById(taskId)
  const task = upsertPreProductionSampleTask({
    preProductionSampleTaskId: taskId,
    preProductionSampleTaskCode: input.preProductionSampleTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    workItemTypeName: '产前版样衣',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    patternVersion: input.patternVersion || '',
    artworkVersion: input.artworkVersion || '',
    expectedArrival: input.expectedArrival || '',
    trackingNo: input.trackingNo || '',
    sampleAssetId: input.sampleAssetId || '',
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listPreProductionSampleTasks().length + 50),
    status: '待发样',
    ownerId: input.ownerId || project.ownerId,
    ownerName: input.ownerName || project.ownerName,
    priorityLevel: input.priorityLevel || '中',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })

  const relation = upsertProjectRelation(
    relationPayload({
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
      workItemTypeName: '产前版样衣',
      sourceModule: '产前版样衣',
      sourceObjectType: '产前版样衣任务',
      sourceObjectId: task.preProductionSampleTaskId,
      sourceObjectCode: task.preProductionSampleTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateTaskNode(node, task, {
    latestInstanceId: task.preProductionSampleTaskId,
    latestInstanceCode: task.preProductionSampleTaskCode,
    latestResultType: '已创建产前版样衣任务',
    latestResultText: '已创建产前版样衣任务，等待安排发样',
    pendingActionType: '安排发样',
    pendingActionText: '请安排产前版样衣发样',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '产前版样衣任务已创建，已写项目关系，已更新项目节点。' }
}

export function createDownstreamTasksFromRevision(
  revisionTaskId: string,
  selectedTypes: DownstreamTaskType[],
): RevisionDownstreamCreateResult {
  const revisionTask = getRevisionTaskById(revisionTaskId)
  if (!revisionTask) {
    return {
      successCount: 0,
      failureMessages: ['未找到对应改版任务，不能创建下游任务。'],
      createdTaskCodes: [],
    }
  }

  const results: Array<TaskWritebackResult<PlateMakingTaskRecord | PatternTaskRecord | FirstSampleTaskRecord | PreProductionSampleTaskRecord>> = []

  selectedTypes.forEach((type) => {
    if (type === 'PATTERN') {
      results.push(createPlateMakingTaskWithProjectRelation({
        projectId: revisionTask.projectId,
        title: `制版-${revisionTask.projectName}`,
        sourceType: '改版任务',
        upstreamModule: '改版任务',
        upstreamObjectType: '改版任务',
        upstreamObjectId: revisionTask.revisionTaskId,
        upstreamObjectCode: revisionTask.revisionTaskCode,
        ownerId: revisionTask.ownerId,
        ownerName: revisionTask.ownerName,
        priorityLevel: revisionTask.priorityLevel,
        dueAt: revisionTask.dueAt,
        productStyleCode: revisionTask.productStyleCode,
        spuCode: revisionTask.spuCode,
        patternType: revisionTask.revisionScopeNames.includes('版型结构') ? '版型改版' : '常规制版',
        sizeRange: '待补充',
        note: `由改版任务 ${revisionTask.revisionTaskCode} 自动创建。`,
      }))
      return
    }

    if (type === 'PRINT') {
      results.push(createPatternTaskWithProjectRelation({
        projectId: revisionTask.projectId,
        title: `花型-${revisionTask.projectName}`,
        sourceType: '改版任务',
        upstreamModule: '改版任务',
        upstreamObjectType: '改版任务',
        upstreamObjectId: revisionTask.revisionTaskId,
        upstreamObjectCode: revisionTask.revisionTaskCode,
        ownerId: revisionTask.ownerId,
        ownerName: revisionTask.ownerName,
        priorityLevel: revisionTask.priorityLevel,
        dueAt: revisionTask.dueAt,
        productStyleCode: revisionTask.productStyleCode,
        spuCode: revisionTask.spuCode,
        artworkType: '印花',
        patternMode: '定位印',
        artworkName: `${revisionTask.projectName} 花型稿`,
        note: `由改版任务 ${revisionTask.revisionTaskCode} 自动创建。`,
      }))
      return
    }

    if (type === 'SAMPLE') {
      results.push(createFirstSampleTaskWithProjectRelation({
        projectId: revisionTask.projectId,
        title: `首版样衣打样-${revisionTask.projectName}`,
        sourceType: '改版任务',
        upstreamModule: '改版任务',
        upstreamObjectType: '改版任务',
        upstreamObjectId: revisionTask.revisionTaskId,
        upstreamObjectCode: revisionTask.revisionTaskCode,
        ownerId: revisionTask.ownerId,
        ownerName: revisionTask.ownerName,
        priorityLevel: revisionTask.priorityLevel,
        targetSite: '深圳',
        factoryName: '深圳工厂01',
        note: `由改版任务 ${revisionTask.revisionTaskCode} 自动创建。`,
      }))
      return
    }

    results.push(createPreProductionSampleTaskWithProjectRelation({
      projectId: revisionTask.projectId,
      title: `产前版样衣-${revisionTask.projectName}`,
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: revisionTask.revisionTaskId,
      upstreamObjectCode: revisionTask.revisionTaskCode,
      ownerId: revisionTask.ownerId,
      ownerName: revisionTask.ownerName,
      priorityLevel: revisionTask.priorityLevel,
      targetSite: '深圳',
      factoryName: '深圳工厂02',
      note: `由改版任务 ${revisionTask.revisionTaskCode} 自动创建。`,
    }))
  })

  return {
    successCount: results.filter((item) => item.ok).length,
    failureMessages: results.filter((item) => !item.ok).map((item) => item.message),
    createdTaskCodes: results.filter((item): item is TaskWritebackSuccess<any> => item.ok).map((item) => {
      const task = item.task as any
      return (
        task.plateTaskCode ||
        task.patternTaskCode ||
        task.firstSampleTaskCode ||
        task.preProductionSampleTaskCode ||
        ''
      )
    }).filter(Boolean),
  }
}
