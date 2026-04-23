import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import { markProjectNodeCompletedAndUnlockNext } from './pcs-project-flow-service.ts'
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
  updatePatternTask,
  upsertPatternTask,
  upsertPatternTaskPendingItem,
} from './pcs-pattern-task-repository.ts'
import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type {
  PatternTaskBuyerReviewStatus,
  PatternTaskColorDepthOption,
  PatternTaskDemandSourceType,
  PatternTaskDifficultyGrade,
  PatternTaskProcessType,
  PatternTaskTeamCode,
} from './pcs-pattern-task-types.ts'
import {
  assertPatternTaskMemberInTeam,
  getPatternTaskMember,
  getPatternTaskTeamName,
} from './pcs-pattern-task-team-config.ts'
import {
  getPatternTaskCompletionMissingFields,
  getPlateTaskCompletionMissingFields,
  getRevisionTaskCompletionMissingFields,
} from './pcs-engineering-task-field-policy.ts'
import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
  updatePlateMakingTask,
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
  updateRevisionTask,
  upsertRevisionTask,
  upsertRevisionTaskPendingItem,
} from './pcs-revision-task-repository.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import { findStyleArchiveByCode, getStyleArchiveById } from './pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import {
  nowTaskText,
  type FirstSampleTaskSourceType,
  type PatternTaskSourceType,
  type PlateMakingTaskSourceType,
  type PreProductionSampleTaskSourceType,
  type RevisionTaskSourceType,
} from './pcs-task-source-normalizer.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'

type DownstreamTaskType = 'PRINT'

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
  styleId?: string
  styleCode?: string
  styleName?: string
  referenceObjectType?: string
  referenceObjectId?: string
  referenceObjectCode?: string
  referenceObjectName?: string
  productStyleCode?: string
  spuCode?: string
  participantNames?: string[]
  dueAt?: string
  revisionScopeCodes?: string[]
  revisionScopeNames?: string[]
  revisionVersion?: string
  issueSummary?: string
  evidenceSummary?: string
  evidenceImageUrls?: string[]
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
  demandSourceType?: PatternTaskDemandSourceType
  demandSourceRefId?: string
  demandSourceRefCode?: string
  demandSourceRefName?: string
  processType?: PatternTaskProcessType
  requestQty?: number
  fabricSku?: string
  fabricName?: string
  demandImageIds?: string[]
  patternSpuCode?: string
  colorDepthOption?: PatternTaskColorDepthOption
  difficultyGrade?: PatternTaskDifficultyGrade
  assignedTeamCode?: PatternTaskTeamCode
  assignedMemberId?: string
  liveReferenceImageIds?: string[]
  imageReferenceIds?: string[]
  physicalReferenceNote?: string
  completionImageIds?: string[]
  buyerReviewStatus?: PatternTaskBuyerReviewStatus
  buyerReviewerName?: string
  buyerReviewNote?: string
  patternCategoryCode?: string
  patternStyleTags?: string[]
  hotSellerFlag?: boolean
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

function normalizePatternAssignment(input: Pick<PatternTaskCreateInput, 'assignedTeamCode' | 'assignedMemberId'>): {
  assignedTeamCode: PatternTaskTeamCode
  assignedTeamName: string
  assignedMemberId: string
  assignedMemberName: string
} {
  const assignedTeamCode = input.assignedTeamCode || 'CN_TEAM'
  const assignedMemberId = input.assignedMemberId || 'cn_bing_bing'
  assertPatternTaskMemberInTeam(assignedTeamCode, assignedMemberId)
  const member = getPatternTaskMember(assignedTeamCode, assignedMemberId)
  return {
    assignedTeamCode,
    assignedTeamName: getPatternTaskTeamName(assignedTeamCode),
    assignedMemberId,
    assignedMemberName: member?.memberName || '',
  }
}

function normalizePatternDemandSource(input: PatternTaskCreateInput): PatternTaskDemandSourceType {
  if (input.demandSourceType) return input.demandSourceType
  if (input.sourceType === '改版任务') return '改版任务'
  if (input.sourceType === '花型复用调色') return '设计师款'
  return '预售测款通过'
}

interface TaskWritebackSuccess<TTask> {
  ok: true
  task: TTask
  relation: ProjectRelationRecord | null
  message: string
}

interface TaskWritebackFailure {
  ok: false
  message: string
  pendingItem: PcsTaskPendingItem
}

export type TaskWritebackResult<TTask> = TaskWritebackSuccess<TTask> | TaskWritebackFailure

export interface TaskCompletionResult<TTask> {
  ok: boolean
  task: TTask | null
  message: string
}

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

function syncTaskCompletionToProjectNode(
  input: {
    projectId: string
    projectNodeId: string
    workItemTypeCode: string
    workItemTypeName: string
    sourceModule: string
    sourceObjectType: string
    sourceObjectId: string
    sourceObjectCode: string
    sourceTitle: string
    sourceStatus: string
    businessDate: string
    ownerName: string
    resultType: string
    resultText: string
    operatorName: string
  },
): void {
  const project = getProjectById(input.projectId)
  if (!project || !input.projectNodeId) return

  const node =
    getProjectNodeRecordByWorkItemTypeCode(project.projectId, input.workItemTypeCode) ||
    null
  if (!node || node.projectNodeId !== input.projectNodeId) return

  upsertProjectRelation(
    relationPayload({
      projectId: input.projectId,
      projectCode: project.projectCode,
      projectNodeId: input.projectNodeId,
      workItemTypeCode: input.workItemTypeCode,
      workItemTypeName: input.workItemTypeName,
      sourceModule: input.sourceModule as ProjectRelationRecord['sourceModule'],
      sourceObjectType: input.sourceObjectType as ProjectRelationRecord['sourceObjectType'],
      sourceObjectId: input.sourceObjectId,
      sourceObjectCode: input.sourceObjectCode,
      sourceTitle: input.sourceTitle,
      sourceStatus: input.sourceStatus,
      businessDate: input.businessDate,
      ownerName: input.ownerName,
      operatorName: input.operatorName,
    }),
  )

  updateProjectNodeRecord(project.projectId, input.projectNodeId, {
    latestInstanceId: input.sourceObjectId,
    latestInstanceCode: input.sourceObjectCode,
    latestResultType: input.resultType,
    latestResultText: input.resultText,
    updatedAt: input.businessDate,
  }, input.operatorName)

  if (node.currentStatus !== '已完成' && node.currentStatus !== '已取消') {
    const completionResult = markProjectNodeCompletedAndUnlockNext(project.projectId, input.projectNodeId, {
      operatorName: input.operatorName,
      timestamp: input.businessDate,
      resultType: input.resultType,
      resultText: input.resultText,
    })
    if (!completionResult.ok) {
      updateProjectNodeRecord(
        project.projectId,
        input.projectNodeId,
        {
          currentStatus: '已完成',
          pendingActionType: '',
          pendingActionText: '',
          currentIssueType: '',
          currentIssueText: '',
          updatedAt: input.businessDate,
          lastEventType: input.resultType,
          lastEventTime: input.businessDate,
        },
        input.operatorName,
      )
      syncProjectNodeInstanceRuntime(project.projectId, input.projectNodeId, input.operatorName, input.businessDate)
    }
  } else {
    syncProjectNodeInstanceRuntime(project.projectId, input.projectNodeId, input.operatorName, input.businessDate)
  }

  syncExistingProjectArchiveByProjectId(project.projectId, input.operatorName)
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

function resolveRevisionStyle(
  input: Pick<RevisionTaskCreateInput, 'styleId' | 'styleCode' | 'productStyleCode' | 'spuCode'>,
): StyleArchiveShellRecord | null {
  if (input.styleId) return getStyleArchiveById(input.styleId)
  return (
    findStyleArchiveByCode(input.styleCode || '') ||
    findStyleArchiveByCode(input.productStyleCode || '') ||
    findStyleArchiveByCode(input.spuCode || '') ||
    null
  )
}

function hasRevisionPrintScope(input: Pick<RevisionTaskCreateInput, 'revisionScopeCodes' | 'revisionScopeNames'>): boolean {
  return Boolean(
    input.revisionScopeCodes?.includes('PRINT') ||
    input.revisionScopeNames?.some((item) => item.includes('花型')),
  )
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
  if (!alreadyExists) {
    updateProjectNodeRecord(task.projectId, node.projectNodeId, {
      latestResultType: '已创建改版任务',
      latestResultText: '已创建改版任务',
      pendingActionType: '等待改版完成',
      pendingActionText: '请推进改版任务，完成后重新进入测款',
      updatedAt: task.createdAt,
    }, task.ownerName || '当前用户')
  }
  syncProjectNodeInstanceRuntime(task.projectId, node.projectNodeId, task.ownerName || '当前用户', task.createdAt)
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
  if (!alreadyExists) {
    updateProjectNodeRecord(task.projectId, node.projectNodeId, {
      currentStatus: '进行中',
      latestResultType: input.latestResultType,
      latestResultText: input.latestResultText,
      pendingActionType: input.pendingActionType,
      pendingActionText: input.pendingActionText,
      updatedAt: task.createdAt,
    }, task.ownerName || '当前用户')
  }
  syncProjectNodeInstanceRuntime(task.projectId, node.projectNodeId, task.ownerName || '当前用户', task.createdAt)
}

export function saveRevisionTaskDraft(input: RevisionTaskCreateInput): RevisionTaskRecord {
  const now = nowTaskText()
  const taskId = input.revisionTaskId || nextCode('RTD', listRevisionTasks().length)
  const style = resolveRevisionStyle(input)
  return upsertRevisionTask({
    revisionTaskId: taskId,
    revisionTaskCode: input.revisionTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: '改版任务',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '',
    upstreamObjectType: input.upstreamObjectType || '',
    upstreamObjectId: input.upstreamObjectId || '',
    upstreamObjectCode: input.upstreamObjectCode || '',
    styleId: style?.styleId || input.styleId || '',
    styleCode: style?.styleCode || input.styleCode || input.productStyleCode || input.spuCode || '',
    styleName: style?.styleName || input.styleName || '',
    referenceObjectType: input.referenceObjectType || '',
    referenceObjectId: input.referenceObjectId || '',
    referenceObjectCode: input.referenceObjectCode || '',
    referenceObjectName: input.referenceObjectName || '',
    productStyleCode: input.productStyleCode || style?.styleCode || '',
    spuCode: input.spuCode || style?.styleCode || '',
    status: '草稿',
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    revisionScopeCodes: input.revisionScopeCodes || [],
    revisionScopeNames: input.revisionScopeNames || [],
    revisionVersion: input.revisionVersion || '',
    issueSummary: input.issueSummary || '',
    evidenceSummary: input.evidenceSummary || '',
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
    acceptedAt: '',
    confirmedAt: '',
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
  const assignment = normalizePatternAssignment(input)
  const demandSourceType = normalizePatternDemandSource(input)
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
    demandSourceType,
    demandSourceRefId: input.demandSourceRefId || input.upstreamObjectId || '',
    demandSourceRefCode: input.demandSourceRefCode || input.upstreamObjectCode || '',
    demandSourceRefName: input.demandSourceRefName || input.upstreamModule || '',
    processType: input.processType || '数码印',
    requestQty: Number(input.requestQty || 1),
    fabricSku: input.fabricSku || '',
    fabricName: input.fabricName || '',
    demandImageIds: [...(input.demandImageIds || [])],
    patternSpuCode: input.patternSpuCode || input.productStyleCode || input.spuCode || '',
    colorDepthOption: input.colorDepthOption || '中间值',
    difficultyGrade: input.difficultyGrade || 'A',
    ...assignment,
    assignedAt: now,
    liveReferenceImageIds: [...(input.liveReferenceImageIds || [])],
    imageReferenceIds: [...(input.imageReferenceIds || [])],
    physicalReferenceNote: input.physicalReferenceNote || '',
    completionImageIds: [...(input.completionImageIds || [])],
    buyerReviewStatus: input.buyerReviewStatus || '待买手确认',
    buyerReviewAt: '',
    buyerReviewerName: input.buyerReviewerName || '',
    buyerReviewNote: input.buyerReviewNote || '',
    transferFromTeamCode: '',
    transferFromTeamName: '',
    transferToTeamCode: '',
    transferToTeamName: '',
    transferReason: '',
    transferredAt: '',
    transferOperatorName: '',
    patternAssetId: '',
    patternAssetCode: '',
    patternCategoryCode: input.patternCategoryCode || '',
    patternStyleTags: [...(input.patternStyleTags || [])],
    hotSellerFlag: Boolean(input.hotSellerFlag),
    colorConfirmNote: '',
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
  const requiresProject = input.sourceType === '测款触发'
  const style = resolveRevisionStyle(input)
  let resolvedMeasureUpstreamModule = ''
  let resolvedMeasureUpstreamObjectType = ''
  let resolvedMeasureUpstreamObjectId = ''
  let resolvedMeasureUpstreamObjectCode = ''

  if (!input.issueSummary?.trim()) {
    const pendingItem = makePendingItem('改版任务', rawCode, input.projectId || '', input.upstreamObjectCode || input.upstreamObjectId || '', '请先补充问题点。')
    upsertRevisionTaskPendingItem(pendingItem)
    return { ok: false, message: pendingItem.reason, pendingItem }
  }

  if (!input.evidenceSummary?.trim()) {
    const pendingItem = makePendingItem('改版任务', rawCode, input.projectId || '', input.upstreamObjectCode || input.upstreamObjectId || '', '请先补充问题点证据。')
    upsertRevisionTaskPendingItem(pendingItem)
    return { ok: false, message: pendingItem.reason, pendingItem }
  }

  let project: NonNullable<ReturnType<typeof getProjectById>> | null = null
  let node: PcsProjectNodeRecord | null = null

  if (requiresProject) {
    const { project: matchedProject, pendingItem: projectPending } = getProjectOrPending('改版任务', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
    if (!matchedProject || projectPending) {
      upsertRevisionTaskPendingItem(projectPending!)
      return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
    }
    project = matchedProject
    const defaultUpstreamNode =
      getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION') ||
      getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'REVISION_TASK')
    resolvedMeasureUpstreamModule = input.upstreamModule || (defaultUpstreamNode ? '测款结论' : '')
    resolvedMeasureUpstreamObjectType = input.upstreamObjectType || (defaultUpstreamNode ? '项目工作项' : '')
    resolvedMeasureUpstreamObjectId = input.upstreamObjectId || defaultUpstreamNode?.projectNodeId || ''
    resolvedMeasureUpstreamObjectCode = input.upstreamObjectCode || defaultUpstreamNode?.projectNodeId || ''

    const upstreamError = ensureFormalSource('改版任务', input.sourceType, resolvedMeasureUpstreamObjectId, resolvedMeasureUpstreamObjectCode, '')
    if (upstreamError) {
      const pendingItem = makePendingItem('改版任务', rawCode, project.projectCode, resolvedMeasureUpstreamObjectCode || resolvedMeasureUpstreamObjectId || '', upstreamError)
      upsertRevisionTaskPendingItem(pendingItem)
      return { ok: false, message: upstreamError, pendingItem }
    }

    let nodeResult = getNodeOrPending('改版任务', project.projectId, project.projectCode, rawCode, 'REVISION_TASK')
    if (!nodeResult.node) {
      nodeResult = getNodeOrPending('改版任务', project.projectId, project.projectCode, rawCode, 'TEST_CONCLUSION')
    }
    if (!nodeResult.node || nodeResult.pendingItem) {
      upsertRevisionTaskPendingItem(nodeResult.pendingItem!)
      return { ok: false, message: nodeResult.pendingItem!.reason, pendingItem: nodeResult.pendingItem! }
    }
    node = nodeResult.node

    const cancelledPending = blockCancelledNode('改版任务', rawCode, project.projectCode, node)
    if (cancelledPending) {
      upsertRevisionTaskPendingItem(cancelledPending)
      return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
    }
  } else {
    if (!style) {
      const pendingItem = makePendingItem('改版任务', rawCode, '', input.styleCode || input.productStyleCode || input.spuCode || '', '当前来源必须选择正式款式档案。')
      upsertRevisionTaskPendingItem(pendingItem)
      return { ok: false, message: pendingItem.reason, pendingItem }
    }
  }

  const now = nowTaskText()
  const taskId = input.revisionTaskId || nextCode('RT', listRevisionTasks().length)
  const existing = getRevisionTaskById(taskId)
  const sourceStyleCode = style?.styleCode || project?.linkedStyleCode || input.styleCode || input.productStyleCode || input.spuCode || project?.styleNumber || ''
  const sourceStyleName = style?.styleName || input.styleName || ''
  const sourceStyleId = style?.styleId || ''
  const task = upsertRevisionTask({
    revisionTaskId: taskId,
    revisionTaskCode: input.revisionTaskCode || taskId,
    title: input.title,
    projectId: project?.projectId || '',
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    projectNodeId: node?.projectNodeId || '',
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: '改版任务',
    sourceType: input.sourceType,
    upstreamModule:
      input.sourceType === '既有商品改款'
        ? '款式档案'
        : input.sourceType === '人工创建'
          ? (input.referenceObjectId || input.referenceObjectCode || input.referenceObjectName ? '人工参考' : '人工创建')
          : resolvedMeasureUpstreamModule,
    upstreamObjectType:
      input.sourceType === '既有商品改款'
        ? '款式档案'
        : input.sourceType === '人工创建'
          ? input.referenceObjectType || ''
          : resolvedMeasureUpstreamObjectType,
    upstreamObjectId:
      input.sourceType === '既有商品改款'
        ? sourceStyleId
        : input.sourceType === '人工创建'
          ? input.referenceObjectId || input.referenceObjectCode || input.referenceObjectName || ''
          : resolvedMeasureUpstreamObjectId,
    upstreamObjectCode:
      input.sourceType === '既有商品改款'
        ? sourceStyleCode
        : input.sourceType === '人工创建'
          ? input.referenceObjectCode || input.referenceObjectId || ''
          : resolvedMeasureUpstreamObjectCode,
    styleId: sourceStyleId,
    styleCode: sourceStyleCode,
    styleName: sourceStyleName,
    referenceObjectType: input.referenceObjectType || '',
    referenceObjectId: input.referenceObjectId || '',
    referenceObjectCode: input.referenceObjectCode || '',
    referenceObjectName: input.referenceObjectName || '',
    productStyleCode: sourceStyleCode,
    spuCode: sourceStyleCode,
    status: '进行中',
    ownerId: input.ownerId || project?.ownerId || '',
    ownerName: input.ownerName || project?.ownerName || '',
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    revisionScopeCodes: input.revisionScopeCodes || [],
    revisionScopeNames: input.revisionScopeNames || [],
    revisionVersion: input.revisionVersion || '',
    issueSummary: input.issueSummary.trim(),
    evidenceSummary: input.evidenceSummary.trim(),
    evidenceImageUrls: [...(input.evidenceImageUrls || [])],
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
    legacyProjectRef: project?.projectCode || '',
    legacyUpstreamRef: input.upstreamObjectCode || input.referenceObjectCode || sourceStyleCode || '',
  })

  let relation: ProjectRelationRecord | null = null
  if (project && node) {
    relation = upsertProjectRelation(
      relationPayload({
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectNodeId: node.projectNodeId,
        workItemTypeCode: 'REVISION_TASK',
        workItemTypeName: '改版任务',
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
  }

  return {
    ok: true,
    task,
    relation,
    message: relation ? '改版任务已创建，已写项目关系，已更新项目节点。' : '改版任务已创建。',
  }
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
    acceptedAt: existing?.acceptedAt || now,
    confirmedAt: existing?.confirmedAt || '',
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
  const assignment = normalizePatternAssignment(input)
  const demandSourceType = normalizePatternDemandSource(input)
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
    demandSourceType,
    demandSourceRefId: input.demandSourceRefId || upstream.upstreamObjectId,
    demandSourceRefCode: input.demandSourceRefCode || upstream.upstreamObjectCode,
    demandSourceRefName: input.demandSourceRefName || upstream.upstreamModule,
    processType: input.processType || (input.artworkType === '烫画' ? '烫画' : '数码印'),
    requestQty: Number(input.requestQty || 1),
    fabricSku: input.fabricSku || '',
    fabricName: input.fabricName || '待买手确认',
    demandImageIds: [...(input.demandImageIds || existing?.demandImageIds || [])],
    patternSpuCode: input.patternSpuCode || input.productStyleCode || project.styleNumber || input.spuCode || '',
    colorDepthOption: input.colorDepthOption || existing?.colorDepthOption || '中间值',
    difficultyGrade: input.difficultyGrade || existing?.difficultyGrade || 'A',
    ...assignment,
    assignedAt: existing?.assignedAt || now,
    liveReferenceImageIds: [...(input.liveReferenceImageIds || existing?.liveReferenceImageIds || [])],
    imageReferenceIds: [...(input.imageReferenceIds || existing?.imageReferenceIds || [])],
    physicalReferenceNote: input.physicalReferenceNote || existing?.physicalReferenceNote || '',
    completionImageIds: [...(input.completionImageIds || existing?.completionImageIds || [])],
    buyerReviewStatus: input.buyerReviewStatus || existing?.buyerReviewStatus || '待买手确认',
    buyerReviewAt: existing?.buyerReviewAt || '',
    buyerReviewerName: input.buyerReviewerName || existing?.buyerReviewerName || '',
    buyerReviewNote: input.buyerReviewNote || existing?.buyerReviewNote || '',
    transferFromTeamCode: existing?.transferFromTeamCode || '',
    transferFromTeamName: existing?.transferFromTeamName || '',
    transferToTeamCode: existing?.transferToTeamCode || '',
    transferToTeamName: existing?.transferToTeamName || '',
    transferReason: existing?.transferReason || '',
    transferredAt: existing?.transferredAt || '',
    transferOperatorName: existing?.transferOperatorName || '',
    patternAssetId: existing?.patternAssetId || '',
    patternAssetCode: existing?.patternAssetCode || '',
    patternCategoryCode: input.patternCategoryCode || existing?.patternCategoryCode || '',
    patternStyleTags: [...(input.patternStyleTags || existing?.patternStyleTags || [])],
    hotSellerFlag: Boolean(input.hotSellerFlag ?? existing?.hotSellerFlag),
    colorConfirmNote: existing?.colorConfirmNote || '',
    artworkType: input.artworkType || '',
    patternMode: input.patternMode || '',
    artworkName: input.artworkName || '',
    artworkVersion: input.artworkVersion || '',
    linkedTechPackVersionId: existing?.linkedTechPackVersionId || '',
    linkedTechPackVersionCode: existing?.linkedTechPackVersionCode || '',
    linkedTechPackVersionLabel: existing?.linkedTechPackVersionLabel || '',
    linkedTechPackVersionStatus: existing?.linkedTechPackVersionStatus || '',
    linkedTechPackUpdatedAt: existing?.linkedTechPackUpdatedAt || '',
    acceptedAt: existing?.acceptedAt || now,
    confirmedAt: existing?.confirmedAt || '',
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
    latestResultText: '已创建花型任务，等待执行花型需求',
    pendingActionType: '执行花型任务',
    pendingActionText: '请补齐颜色确认、完成图片和买手确认',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '花型任务已创建，已写项目关系，已更新项目节点。' }
}

export function completeRevisionTaskWithProjectRelationSync(
  revisionTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<RevisionTaskRecord> {
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) return { ok: false, task: null, message: '未找到改版任务。' }
  if (!task.projectId || !task.projectNodeId) {
    return { ok: false, task, message: '当前改版任务未关联正式商品项目节点。' }
  }
  if (task.status === '已取消') return { ok: false, task, message: '当前改版任务已取消，不能完成。' }
  const missingFields = getRevisionTaskCompletionMissingFields(task)
  if (missingFields.length > 0) {
    return { ok: false, task, message: `请先在改版任务详情补齐字段：${missingFields.join('、')}。` }
  }

  const now = nowTaskText()
  const nextTask = updateRevisionTask(revisionTaskId, {
    status: '已完成',
    updatedAt: now,
    updatedBy: operatorName,
    note: task.note || '改版任务已完成。',
  })
  if (!nextTask) return { ok: false, task, message: '改版任务更新失败。' }

  syncTaskCompletionToProjectNode({
    projectId: nextTask.projectId,
    projectNodeId: nextTask.projectNodeId,
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: '改版任务',
    sourceModule: '改版任务',
    sourceObjectType: '改版任务',
    sourceObjectId: nextTask.revisionTaskId,
    sourceObjectCode: nextTask.revisionTaskCode,
    sourceTitle: nextTask.title,
    sourceStatus: nextTask.status,
    businessDate: nextTask.updatedAt,
    ownerName: nextTask.ownerName,
    resultType: '改版任务已完成',
    resultText: '改版任务已完成，商品项目节点同步完成。',
    operatorName,
  })

  return { ok: true, task: nextTask, message: '改版任务已完成，已同步商品项目节点。' }
}

export function completePlateMakingTaskWithProjectRelationSync(
  plateTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<PlateMakingTaskRecord> {
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) return { ok: false, task: null, message: '未找到制版任务。' }
  if (!task.projectId || !task.projectNodeId) {
    return { ok: false, task, message: '当前制版任务未关联正式商品项目节点。' }
  }
  if (task.status === '已取消') return { ok: false, task, message: '当前制版任务已取消，不能完成。' }
  const missingFields = getPlateTaskCompletionMissingFields(task)
  if (missingFields.length > 0) {
    return { ok: false, task, message: `请先在制版任务详情补齐字段：${missingFields.join('、')}。` }
  }

  const now = nowTaskText()
  const nextTask = updatePlateMakingTask(plateTaskId, {
    status: '已完成',
    confirmedAt: now,
    updatedAt: now,
    updatedBy: operatorName,
    note: task.note || '制版任务已完成。',
  })
  if (!nextTask) return { ok: false, task, message: '制版任务更新失败。' }

  syncTaskCompletionToProjectNode({
    projectId: nextTask.projectId,
    projectNodeId: nextTask.projectNodeId,
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceModule: '制版任务',
    sourceObjectType: '制版任务',
    sourceObjectId: nextTask.plateTaskId,
    sourceObjectCode: nextTask.plateTaskCode,
    sourceTitle: nextTask.title,
    sourceStatus: nextTask.status,
    businessDate: nextTask.updatedAt,
    ownerName: nextTask.ownerName,
    resultType: '制版任务已完成',
    resultText: '制版任务已完成，商品项目节点同步完成。',
    operatorName,
  })

  return { ok: true, task: nextTask, message: '制版任务已完成，已同步商品项目节点。' }
}

export function completePatternTaskWithProjectRelationSync(
  patternTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<PatternTaskRecord> {
  const task = getPatternTaskById(patternTaskId)
  if (!task) return { ok: false, task: null, message: '未找到花型任务。' }
  if (!task.projectId || !task.projectNodeId) {
    return { ok: false, task, message: '当前花型任务未关联正式商品项目节点。' }
  }
  if (task.status === '已取消') return { ok: false, task, message: '当前花型任务已取消，不能完成。' }
  const missingFields = getPatternTaskCompletionMissingFields(task)
  if (missingFields.length > 0) {
    return { ok: false, task, message: `请先在花型任务详情补齐字段：${missingFields.join('、')}。` }
  }

  const now = nowTaskText()
  const nextTask = updatePatternTask(patternTaskId, {
    status: '已完成',
    confirmedAt: now,
    updatedAt: now,
    updatedBy: operatorName,
    note: task.note || '花型任务已完成。',
  })
  if (!nextTask) return { ok: false, task, message: '花型任务更新失败。' }

  syncTaskCompletionToProjectNode({
    projectId: nextTask.projectId,
    projectNodeId: nextTask.projectNodeId,
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    sourceModule: '花型任务',
    sourceObjectType: '花型任务',
    sourceObjectId: nextTask.patternTaskId,
    sourceObjectCode: nextTask.patternTaskCode,
    sourceTitle: nextTask.title,
    sourceStatus: nextTask.status,
    businessDate: nextTask.updatedAt,
    ownerName: nextTask.ownerName,
    resultType: '花型任务已完成',
    resultText: '花型任务已完成，商品项目节点同步完成。',
    operatorName,
  })

  return { ok: true, task: nextTask, message: '花型任务已完成，已同步商品项目节点。' }
}

export function syncExistingProjectEngineeringTaskNodes(operatorName = '系统同步'): void {
  listRevisionTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'REVISION_TASK',
        workItemTypeName: '改版任务',
        sourceModule: '改版任务',
        sourceObjectType: '改版任务',
        sourceObjectId: task.revisionTaskId,
        sourceObjectCode: task.revisionTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '改版任务已完成',
        resultText: '改版任务已完成，商品项目节点同步完成。',
        operatorName,
      })
    })
  listPlateMakingTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'PATTERN_TASK',
        workItemTypeName: '制版任务',
        sourceModule: '制版任务',
        sourceObjectType: '制版任务',
        sourceObjectId: task.plateTaskId,
        sourceObjectCode: task.plateTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '制版任务已完成',
        resultText: '制版任务已完成，商品项目节点同步完成。',
        operatorName,
      })
    })
  listPatternTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'PATTERN_ARTWORK_TASK',
        workItemTypeName: '花型任务',
        sourceModule: '花型任务',
        sourceObjectType: '花型任务',
        sourceObjectId: task.patternTaskId,
        sourceObjectCode: task.patternTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '花型任务已完成',
        resultText: '花型任务已完成，商品项目节点同步完成。',
        operatorName,
      })
    })
  listFirstSampleTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'FIRST_SAMPLE',
        workItemTypeName: '首版样衣打样',
        sourceModule: '首版样衣打样',
        sourceObjectType: '首版样衣打样任务',
        sourceObjectId: task.firstSampleTaskId,
        sourceObjectCode: task.firstSampleTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '首版样衣打样已完成',
        resultText: '首版样衣打样已完成，商品项目节点同步完成。',
        operatorName,
      })
    })
  listPreProductionSampleTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
        workItemTypeName: '产前版样衣',
        sourceModule: '产前版样衣',
        sourceObjectType: '产前版样衣任务',
        sourceObjectId: task.preProductionSampleTaskId,
        sourceObjectCode: task.preProductionSampleTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '产前版样衣已完成',
        resultText: '产前版样衣已完成，商品项目节点同步完成。',
        operatorName,
      })
    })
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
    acceptedAt: existing?.acceptedAt || '',
    confirmedAt: existing?.confirmedAt || '',
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
    acceptedAt: existing?.acceptedAt || '',
    confirmedAt: existing?.confirmedAt || '',
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
      failureMessages: ['未找到对应改版任务，不能创建花型任务。'],
      createdTaskCodes: [],
    }
  }

  if (!revisionTask.projectId) {
    return {
      successCount: 0,
      failureMessages: ['当前改版任务未关联商品项目，不能创建花型任务。'],
      createdTaskCodes: [],
    }
  }

  if (!hasRevisionPrintScope(revisionTask)) {
    return {
      successCount: 0,
      failureMessages: ['当前改版范围未涉及花型，不能创建花型任务。'],
      createdTaskCodes: [],
    }
  }

  const existingPatternTask = listPatternTasks().find(
    (item) => item.upstreamObjectId === revisionTask.revisionTaskId || item.upstreamObjectCode === revisionTask.revisionTaskCode,
  )
  if (existingPatternTask) {
    return {
      successCount: 0,
      failureMessages: ['当前改版任务已存在花型下游任务。'],
      createdTaskCodes: [existingPatternTask.patternTaskCode],
    }
  }

  const results: Array<TaskWritebackResult<PlateMakingTaskRecord | PatternTaskRecord | FirstSampleTaskRecord | PreProductionSampleTaskRecord>> = []

  selectedTypes.forEach((type) => {
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
        demandSourceType: '改版任务',
        demandSourceRefId: revisionTask.revisionTaskId,
        demandSourceRefCode: revisionTask.revisionTaskCode,
        demandSourceRefName: revisionTask.title,
        processType: '数码印',
        requestQty: 1,
        fabricName: '待买手确认',
        demandImageIds: [...(revisionTask.evidenceImageUrls || [])],
        patternSpuCode: revisionTask.productStyleCode || revisionTask.spuCode,
        assignedTeamCode: 'CN_TEAM',
        assignedMemberId: 'cn_bing_bing',
        artworkType: '印花',
        patternMode: '定位印',
        artworkName: `${revisionTask.projectName} 花型稿`,
        note: `由改版任务 ${revisionTask.revisionTaskCode} 自动创建。`,
      }))
    }
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
