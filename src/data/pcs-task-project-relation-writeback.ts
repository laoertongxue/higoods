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
  buildFirstSampleProjectMeta,
  syncFirstSampleTaskToProjectNode,
} from './pcs-first-sample-project-writeback.ts'
import {
  getPlateMakingTaskById,
  listPlateMakingTasks,
  updatePlateMakingTask,
  upsertPlateMakingTask,
  upsertPlateMakingTaskPendingItem,
} from './pcs-plate-making-repository.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { PlateMakingMaterialLine } from './pcs-plate-making-material-types.ts'
import type {
  PlateMakingPartTemplateLink,
  PlateMakingPatternArea,
  PlateMakingPatternImageLine,
  PlateMakingProductHistoryType,
} from './pcs-plate-making-pattern-file-types.ts'
import {
  getFirstOrderSampleTaskById,
  listFirstOrderSampleTasks,
  upsertFirstOrderSampleTask,
  upsertFirstOrderSampleTaskPendingItem,
} from './pcs-first-order-sample-repository.ts'
import type { FirstOrderSampleTaskRecord } from './pcs-first-order-sample-types.ts'
import {
  createDefaultSamplePlanLines,
  normalizeSamplePlanLines,
} from './pcs-sample-chain-service.ts'
import type {
  FirstSamplePurpose,
  SampleChainMode,
  SampleMaterialMode,
  SamplePlanLine,
  SampleSpecialSceneReasonCode,
} from './pcs-sample-chain-types.ts'
import {
  getRevisionTaskById,
  listRevisionTasks,
  updateRevisionTask,
  upsertRevisionTask,
  upsertRevisionTaskPendingItem,
} from './pcs-revision-task-repository.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import type { RevisionTaskMaterialLine } from './pcs-revision-task-material-types.ts'
import type { RevisionTaskLiveRetestStatus, RevisionTaskPatternArea } from './pcs-revision-task-file-types.ts'
import { findStyleArchiveByCode, getStyleArchiveById } from './pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import {
  nowTaskText,
  type FirstSampleTaskSourceType,
  type PatternTaskSourceType,
  type PlateMakingTaskSourceType,
  type FirstOrderSampleTaskSourceType,
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
  baseStyleId?: string
  baseStyleCode?: string
  baseStyleName?: string
  baseStyleImageIds?: string[]
  targetStyleCodeCandidate?: string
  targetStyleNameCandidate?: string
  targetStyleImageIds?: string[]
  sampleQty?: number
  stylePreference?: string
  patternMakerId?: string
  patternMakerName?: string
  revisionSuggestionRichText?: string
  paperPrintAt?: string
  deliveryAddress?: string
  patternArea?: RevisionTaskPatternArea
  materialAdjustmentLines?: RevisionTaskMaterialLine[]
  newPatternImageIds?: string[]
  newPatternSpuCode?: string
  patternChangeNote?: string
  patternPieceImageIds?: string[]
  patternFileIds?: string[]
  mainImageIds?: string[]
  designDraftImageIds?: string[]
  liveRetestRequired?: boolean
  liveRetestStatus?: RevisionTaskLiveRetestStatus
  liveRetestRelationIds?: string[]
  liveRetestSummary?: string
}

export interface PlateMakingTaskCreateInput extends BaseTaskCreateInput {
  plateTaskId?: string
  plateTaskCode?: string
  sourceType: PlateMakingTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  styleId?: string
  styleCode?: string
  styleName?: string
  productStyleCode?: string
  spuCode?: string
  participantNames?: string[]
  dueAt?: string
  productHistoryType?: PlateMakingProductHistoryType
  patternMakerId?: string
  patternMakerName?: string
  sampleConfirmedAt?: string
  urgentFlag?: boolean
  patternArea?: PlateMakingPatternArea
  patternType?: string
  sizeRange?: string
  patternVersion?: string
  colorRequirementText?: string
  newPatternSpuCode?: string
  flowerImageIds?: string[]
  materialRequirementLines?: PlateMakingMaterialLine[]
  patternImageLineItems?: PlateMakingPatternImageLine[]
  patternPdfFileIds?: string[]
  patternDxfFileIds?: string[]
  patternRulFileIds?: string[]
  supportImageIds?: string[]
  supportVideoIds?: string[]
  partTemplateLinks?: PlateMakingPartTemplateLink[]
}

export interface PatternTaskCreateInput extends BaseTaskCreateInput {
  patternTaskId?: string
  patternTaskCode?: string
  sourceType: PatternTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  styleId?: string
  styleCode?: string
  styleName?: string
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
  sampleCode?: string
  sourceTechPackVersionId?: string
  sourceTechPackVersionCode?: string
  sourceTechPackVersionLabel?: string
  sourceTaskType?: string
  sourceTaskId?: string
  sourceTaskCode?: string
  sampleMaterialMode?: SampleMaterialMode
  samplePurpose?: FirstSamplePurpose
  sampleImageIds?: string[]
  reuseAsFirstOrderBasisFlag?: boolean
  reuseAsFirstOrderBasisConfirmedAt?: string
  reuseAsFirstOrderBasisConfirmedBy?: string
  reuseAsFirstOrderBasisNote?: string
  fitConfirmationSummary?: string
  artworkConfirmationSummary?: string
  productionReadinessNote?: string
  confirmedAt?: string
}

export interface FirstOrderSampleTaskCreateInput extends BaseTaskCreateInput {
  firstOrderSampleTaskId?: string
  firstOrderSampleTaskCode?: string
  sourceType: FirstOrderSampleTaskSourceType
  upstreamModule?: string
  upstreamObjectType?: string
  upstreamObjectId?: string
  upstreamObjectCode?: string
  factoryId?: string
  factoryName?: string
  targetSite?: string
  patternVersion?: string
  artworkVersion?: string
  sampleCode?: string
  sourceTechPackVersionId?: string
  sourceTechPackVersionCode?: string
  sourceTechPackVersionLabel?: string
  sourceFirstSampleTaskId?: string
  sourceFirstSampleTaskCode?: string
  sourceFirstSampleCode?: string
  sampleChainMode?: SampleChainMode
  specialSceneReasonCodes?: SampleSpecialSceneReasonCode[]
  specialSceneReasonText?: string
  productionReferenceRequiredFlag?: boolean
  chinaReviewRequiredFlag?: boolean
  correctFabricRequiredFlag?: boolean
  samplePlanLines?: SamplePlanLine[]
  finalReferenceNote?: string
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

function plateExecutionFields(input: PlateMakingTaskCreateInput, existing?: PlateMakingTaskRecord | null) {
  return {
    productHistoryType: input.productHistoryType ?? existing?.productHistoryType ?? '',
    patternMakerId: input.patternMakerId ?? existing?.patternMakerId ?? '',
    patternMakerName: input.patternMakerName ?? existing?.patternMakerName ?? '',
    sampleConfirmedAt: input.sampleConfirmedAt ?? existing?.sampleConfirmedAt ?? '',
    urgentFlag: input.urgentFlag ?? existing?.urgentFlag ?? false,
    patternArea: input.patternArea ?? existing?.patternArea ?? '',
    colorRequirementText: input.colorRequirementText ?? existing?.colorRequirementText ?? '',
    newPatternSpuCode: input.newPatternSpuCode ?? existing?.newPatternSpuCode ?? '',
    flowerImageIds: [...(input.flowerImageIds ?? existing?.flowerImageIds ?? [])],
    materialRequirementLines: (input.materialRequirementLines ?? existing?.materialRequirementLines ?? []).map((line) => ({ ...line })),
    patternImageLineItems: (input.patternImageLineItems ?? existing?.patternImageLineItems ?? []).map((line) => ({ ...line })),
    patternPdfFileIds: [...(input.patternPdfFileIds ?? existing?.patternPdfFileIds ?? [])],
    patternDxfFileIds: [...(input.patternDxfFileIds ?? existing?.patternDxfFileIds ?? [])],
    patternRulFileIds: [...(input.patternRulFileIds ?? existing?.patternRulFileIds ?? [])],
    supportImageIds: [...(input.supportImageIds ?? existing?.supportImageIds ?? [])],
    supportVideoIds: [...(input.supportVideoIds ?? existing?.supportVideoIds ?? [])],
    partTemplateLinks: (input.partTemplateLinks ?? existing?.partTemplateLinks ?? []).map((link) => ({
      ...link,
      matchedPartNames: [...(link.matchedPartNames || [])],
    })),
    primaryTechPackGeneratedFlag: existing?.primaryTechPackGeneratedFlag ?? false,
    primaryTechPackGeneratedAt: existing?.primaryTechPackGeneratedAt ?? '',
  }
}

function revisionExecutionFields(input: RevisionTaskCreateInput, existing?: RevisionTaskRecord | null) {
  const sourceStyleId = input.baseStyleId ?? existing?.baseStyleId ?? input.styleId ?? ''
  const sourceStyleCode = input.baseStyleCode ?? existing?.baseStyleCode ?? input.styleCode ?? input.productStyleCode ?? input.spuCode ?? ''
  const sourceStyleName = input.baseStyleName ?? existing?.baseStyleName ?? input.styleName ?? ''
  return {
    baseStyleId: sourceStyleId,
    baseStyleCode: sourceStyleCode,
    baseStyleName: sourceStyleName,
    baseStyleImageIds: [...(input.baseStyleImageIds ?? existing?.baseStyleImageIds ?? [])],
    targetStyleCodeCandidate: input.targetStyleCodeCandidate ?? existing?.targetStyleCodeCandidate ?? '',
    targetStyleNameCandidate: input.targetStyleNameCandidate ?? existing?.targetStyleNameCandidate ?? '',
    targetStyleImageIds: [...(input.targetStyleImageIds ?? existing?.targetStyleImageIds ?? [])],
    sampleQty: Number(input.sampleQty ?? existing?.sampleQty ?? 0),
    stylePreference: input.stylePreference ?? existing?.stylePreference ?? '',
    patternMakerId: input.patternMakerId ?? existing?.patternMakerId ?? '',
    patternMakerName: input.patternMakerName ?? existing?.patternMakerName ?? input.ownerName ?? '',
    revisionSuggestionRichText: input.revisionSuggestionRichText ?? existing?.revisionSuggestionRichText ?? input.issueSummary ?? '',
    paperPrintAt: input.paperPrintAt ?? existing?.paperPrintAt ?? '',
    deliveryAddress: input.deliveryAddress ?? existing?.deliveryAddress ?? '',
    patternArea: input.patternArea ?? existing?.patternArea ?? '',
    materialAdjustmentLines: (input.materialAdjustmentLines ?? existing?.materialAdjustmentLines ?? []).map((line) => ({ ...line })),
    newPatternImageIds: [...(input.newPatternImageIds ?? existing?.newPatternImageIds ?? [])],
    newPatternSpuCode: input.newPatternSpuCode ?? existing?.newPatternSpuCode ?? '',
    patternChangeNote: input.patternChangeNote ?? existing?.patternChangeNote ?? '',
    patternPieceImageIds: [...(input.patternPieceImageIds ?? existing?.patternPieceImageIds ?? [])],
    patternFileIds: [...(input.patternFileIds ?? existing?.patternFileIds ?? [])],
    mainImageIds: [...(input.mainImageIds ?? existing?.mainImageIds ?? input.evidenceImageUrls ?? [])],
    designDraftImageIds: [...(input.designDraftImageIds ?? existing?.designDraftImageIds ?? [])],
    liveRetestRequired: input.liveRetestRequired ?? existing?.liveRetestRequired ?? false,
    liveRetestStatus: input.liveRetestStatus ?? existing?.liveRetestStatus ?? (input.liveRetestRequired ? '待回直播验证' : '不需要'),
    liveRetestRelationIds: [...(input.liveRetestRelationIds ?? existing?.liveRetestRelationIds ?? [])],
    liveRetestSummary: input.liveRetestSummary ?? existing?.liveRetestSummary ?? '',
    generatedNewTechPackVersionFlag: existing?.generatedNewTechPackVersionFlag ?? false,
    generatedNewTechPackVersionAt: existing?.generatedNewTechPackVersionAt ?? '',
  }
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
  if (sourceType === '人工创建') {
    return fallbackSourceField ? null : `${taskType}缺少正式来源对象，当前不能正式创建。`
  }
  if (sourceType === '项目模板阶段' || sourceType === '既有商品改款' || sourceType === '既有商品二次开发' || sourceType === '花型复用调色') {
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

function resolvePlateStyle(
  input: Pick<PlateMakingTaskCreateInput, 'styleId' | 'styleCode' | 'productStyleCode' | 'spuCode'>,
): StyleArchiveShellRecord | null {
  if (input.styleId) return getStyleArchiveById(input.styleId)
  return (
    findStyleArchiveByCode(input.styleCode || '') ||
    findStyleArchiveByCode(input.productStyleCode || '') ||
    findStyleArchiveByCode(input.spuCode || '') ||
    null
  )
}

function resolvePatternStyle(
  input: Pick<PatternTaskCreateInput, 'styleId' | 'styleCode' | 'productStyleCode' | 'spuCode' | 'patternSpuCode'>,
): StyleArchiveShellRecord | null {
  if (input.styleId) return getStyleArchiveById(input.styleId)
  return (
    findStyleArchiveByCode(input.styleCode || '') ||
    findStyleArchiveByCode(input.patternSpuCode || '') ||
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
      pendingActionType: '查看改版任务',
      pendingActionText: '查看改版任务',
      updatedAt: task.createdAt,
    }, task.ownerName || '当前用户')
  }
  syncProjectNodeInstanceRuntime(task.projectId, node.projectNodeId, task.ownerName || '当前用户', task.createdAt)
}

function updateTaskNode(
  node: PcsProjectNodeRecord,
  task: PlateMakingTaskRecord | PatternTaskRecord | FirstSampleTaskRecord | FirstOrderSampleTaskRecord,
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
    evidenceImageUrls: [...(input.evidenceImageUrls || [])],
    ...revisionExecutionFields(input),
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
  const style = resolvePlateStyle(input)
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
    styleId: style?.styleId || input.styleId || '',
    styleCode: style?.styleCode || input.styleCode || input.productStyleCode || input.spuCode || '',
    styleName: style?.styleName || input.styleName || '',
    productStyleCode: input.productStyleCode || style?.styleCode || '',
    spuCode: input.spuCode || style?.styleCode || '',
    ...plateExecutionFields(input),
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
  const style = resolvePatternStyle(input)
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
    styleId: style?.styleId || input.styleId || '',
    styleCode: style?.styleCode || input.styleCode || input.productStyleCode || input.spuCode || input.patternSpuCode || '',
    styleName: style?.styleName || input.styleName || '',
    productStyleCode: input.productStyleCode || style?.styleCode || '',
    spuCode: input.spuCode || style?.styleCode || '',
    demandSourceType,
    demandSourceRefId: input.demandSourceRefId || input.upstreamObjectId || '',
    demandSourceRefCode: input.demandSourceRefCode || input.upstreamObjectCode || '',
    demandSourceRefName: input.demandSourceRefName || input.upstreamModule || '',
    processType: input.processType || '数码印',
    requestQty: Number(input.requestQty || 1),
    fabricSku: input.fabricSku || '',
    fabricName: input.fabricName || '',
    demandImageIds: [...(input.demandImageIds || [])],
    patternSpuCode: input.patternSpuCode || style?.styleCode || input.productStyleCode || input.spuCode || '',
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
  return `FS-RESULT-${targetSite === '雅加达' ? 'JKT' : 'SZ'}-${String(count + 21).padStart(4, '0')}`
}

function buildFirstOrderSampleCode(targetSite: string, count: number): string {
  return `FO-RESULT-${targetSite === '雅加达' ? 'JKT' : 'SZ'}-${String(count + 51).padStart(4, '0')}`
}

function firstSampleChainFields(
  input: FirstSampleTaskCreateInput,
  existing?: FirstSampleTaskRecord | null,
): Pick<FirstSampleTaskRecord,
  'sourceTechPackVersionId' | 'sourceTechPackVersionCode' | 'sourceTechPackVersionLabel' | 'sourceTaskType' | 'sourceTaskId' | 'sourceTaskCode' | 'sampleMaterialMode' | 'samplePurpose' | 'sampleImageIds' | 'reuseAsFirstOrderBasisFlag' | 'reuseAsFirstOrderBasisConfirmedAt' | 'reuseAsFirstOrderBasisConfirmedBy' | 'reuseAsFirstOrderBasisNote' | 'fitConfirmationSummary' | 'artworkConfirmationSummary' | 'productionReadinessNote' | 'confirmedAt'
> {
  const reuseFlag = Boolean(input.reuseAsFirstOrderBasisFlag ?? existing?.reuseAsFirstOrderBasisFlag)
  return {
    sourceTechPackVersionId: input.sourceTechPackVersionId || existing?.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: input.sourceTechPackVersionCode || existing?.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: input.sourceTechPackVersionLabel || existing?.sourceTechPackVersionLabel || '',
    sourceTaskType: input.sourceTaskType || existing?.sourceTaskType || input.upstreamObjectType || input.upstreamModule || '',
    sourceTaskId: input.sourceTaskId || existing?.sourceTaskId || input.upstreamObjectId || '',
    sourceTaskCode: input.sourceTaskCode || existing?.sourceTaskCode || input.upstreamObjectCode || '',
    sampleMaterialMode: input.sampleMaterialMode || existing?.sampleMaterialMode || '正确布',
    samplePurpose: input.samplePurpose || existing?.samplePurpose || (reuseFlag ? '首单复用候选' : '首版确认'),
    sampleImageIds: [...(input.sampleImageIds || existing?.sampleImageIds || [])],
    reuseAsFirstOrderBasisFlag: reuseFlag,
    reuseAsFirstOrderBasisConfirmedAt: input.reuseAsFirstOrderBasisConfirmedAt || existing?.reuseAsFirstOrderBasisConfirmedAt || '',
    reuseAsFirstOrderBasisConfirmedBy: input.reuseAsFirstOrderBasisConfirmedBy || existing?.reuseAsFirstOrderBasisConfirmedBy || '',
    reuseAsFirstOrderBasisNote: input.reuseAsFirstOrderBasisNote || existing?.reuseAsFirstOrderBasisNote || '',
    fitConfirmationSummary: input.fitConfirmationSummary || existing?.fitConfirmationSummary || '',
    artworkConfirmationSummary: input.artworkConfirmationSummary || existing?.artworkConfirmationSummary || '',
    productionReadinessNote: input.productionReadinessNote || existing?.productionReadinessNote || '',
    confirmedAt: input.confirmedAt || existing?.confirmedAt || '',
  }
}

function resolveSourceFirstSample(
  input: FirstOrderSampleTaskCreateInput,
  projectId: string,
): Pick<FirstOrderSampleTaskRecord, 'sourceFirstSampleTaskId' | 'sourceFirstSampleTaskCode' | 'sourceFirstSampleCode'> {
  const fromInput = {
    sourceFirstSampleTaskId: input.sourceFirstSampleTaskId || '',
    sourceFirstSampleTaskCode: input.sourceFirstSampleTaskCode || '',
    sourceFirstSampleCode: input.sourceFirstSampleCode || '',
  }
  if (fromInput.sourceFirstSampleTaskId || fromInput.sourceFirstSampleTaskCode || fromInput.sourceFirstSampleCode) return fromInput
  const matched = listFirstSampleTasks()
    .filter((task) => task.projectId === projectId)
    .find(
      (task) =>
        task.firstSampleTaskId === input.upstreamObjectId ||
        task.firstSampleTaskCode === input.upstreamObjectCode ||
        task.workItemTypeCode === 'FIRST_SAMPLE',
    )
  return {
    sourceFirstSampleTaskId: matched?.firstSampleTaskId || (input.upstreamObjectType?.includes('首版') ? input.upstreamObjectId || '' : ''),
    sourceFirstSampleTaskCode: matched?.firstSampleTaskCode || (input.upstreamObjectType?.includes('首版') ? input.upstreamObjectCode || '' : ''),
    sourceFirstSampleCode: matched?.sampleCode || '',
  }
}

function firstOrderChainFields(
  input: FirstOrderSampleTaskCreateInput,
  projectId: string,
  existing?: FirstOrderSampleTaskRecord | null,
): Pick<FirstOrderSampleTaskRecord,
  'sourceTechPackVersionId' | 'sourceTechPackVersionCode' | 'sourceTechPackVersionLabel' | 'sourceFirstSampleTaskId' | 'sourceFirstSampleTaskCode' | 'sourceFirstSampleCode' | 'sampleChainMode' | 'specialSceneReasonCodes' | 'specialSceneReasonText' | 'productionReferenceRequiredFlag' | 'chinaReviewRequiredFlag' | 'correctFabricRequiredFlag' | 'samplePlanLines' | 'finalReferenceNote'
> {
  const sourceFirst = resolveSourceFirstSample(input, projectId)
  const sampleChainMode = input.sampleChainMode || existing?.sampleChainMode || '复用首版结论'
  const defaultLines = createDefaultSamplePlanLines(sampleChainMode, sourceFirst.sourceFirstSampleCode)
  return {
    sourceTechPackVersionId: input.sourceTechPackVersionId || existing?.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: input.sourceTechPackVersionCode || existing?.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: input.sourceTechPackVersionLabel || existing?.sourceTechPackVersionLabel || '',
    ...sourceFirst,
    sampleChainMode,
    specialSceneReasonCodes: [...(input.specialSceneReasonCodes || existing?.specialSceneReasonCodes || [])],
    specialSceneReasonText: input.specialSceneReasonText || existing?.specialSceneReasonText || '',
    productionReferenceRequiredFlag: Boolean(input.productionReferenceRequiredFlag ?? existing?.productionReferenceRequiredFlag),
    chinaReviewRequiredFlag: Boolean(input.chinaReviewRequiredFlag ?? existing?.chinaReviewRequiredFlag),
    correctFabricRequiredFlag: Boolean(input.correctFabricRequiredFlag ?? existing?.correctFabricRequiredFlag),
    samplePlanLines: normalizeSamplePlanLines(
      sampleChainMode,
      input.samplePlanLines || existing?.samplePlanLines || defaultLines,
      sourceFirst.sourceFirstSampleCode,
    ),
    finalReferenceNote: input.finalReferenceNote || existing?.finalReferenceNote || '',
  }
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
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listFirstSampleTasks().length),
    ...firstSampleChainFields(input),
    confirmedAt: '',
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

export function saveFirstOrderSampleTaskDraft(input: FirstOrderSampleTaskCreateInput): FirstOrderSampleTaskRecord {
  const now = nowTaskText()
  const taskId = input.firstOrderSampleTaskId || nextCode('PPD', listFirstOrderSampleTasks().length)
  return upsertFirstOrderSampleTask({
    firstOrderSampleTaskId: taskId,
    firstOrderSampleTaskCode: input.firstOrderSampleTaskCode || taskId,
    title: input.title,
    projectId: input.projectId || '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'FIRST_ORDER_SAMPLE',
    workItemTypeName: '首单样衣打样',
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
    sampleCode: input.sampleCode || buildFirstOrderSampleCode(input.targetSite || '深圳', listFirstOrderSampleTasks().length),
    ...firstOrderChainFields(input, input.projectId || ''),
    confirmedAt: '',
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
      const pendingItem = makePendingItem('改版任务', rawCode, '', input.styleCode || input.productStyleCode || input.spuCode || '', '请选择正式款式档案。')
      upsertRevisionTaskPendingItem(pendingItem)
      return { ok: false, message: pendingItem.reason, pendingItem }
    }
    const upstreamError = ensureFormalSource(
      '改版任务',
      input.sourceType,
      input.referenceObjectId || input.referenceObjectCode || '',
      input.referenceObjectCode || input.referenceObjectName || '',
      input.referenceObjectId || input.referenceObjectCode || input.referenceObjectName || '',
    )
    if (upstreamError) {
      const pendingItem = makePendingItem('改版任务', rawCode, '', input.styleCode || input.productStyleCode || input.spuCode || '', upstreamError)
      upsertRevisionTaskPendingItem(pendingItem)
      return { ok: false, message: upstreamError, pendingItem }
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
    issueSummary: (input.issueSummary || '').trim(),
    evidenceSummary: (input.evidenceSummary || '').trim(),
    evidenceImageUrls: [...(input.evidenceImageUrls || [])],
    ...revisionExecutionFields(
      {
        ...input,
        baseStyleId: input.baseStyleId || sourceStyleId,
        baseStyleCode: input.baseStyleCode || sourceStyleCode,
        baseStyleName: input.baseStyleName || sourceStyleName,
      },
      existing,
    ),
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

function createPlateMakingTaskStandalone(
  input: PlateMakingTaskCreateInput,
): TaskWritebackResult<PlateMakingTaskRecord> {
  const rawCode = input.plateTaskCode || input.plateTaskId || input.title
  const style = resolvePlateStyle(input)
  if (!style) {
    const pendingItem = makePendingItem('制版任务', rawCode, '', input.styleCode || input.productStyleCode || input.spuCode || '', '请选择正式款式档案。')
    upsertPlateMakingTaskPendingItem(pendingItem)
    return { ok: false, message: pendingItem.reason, pendingItem }
  }
  const upstreamError = ensureFormalSource('制版任务', input.sourceType, input.upstreamObjectId || '', input.upstreamObjectCode || '', style.styleCode)
  if (upstreamError) {
    const pendingItem = makePendingItem('制版任务', rawCode, '', style.styleCode, upstreamError)
    upsertPlateMakingTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const now = nowTaskText()
  const taskId = input.plateTaskId || nextCode('PT', listPlateMakingTasks().length)
  const existing = getPlateMakingTaskById(taskId)
  const task = upsertPlateMakingTask({
    plateTaskId: taskId,
    plateTaskCode: input.plateTaskCode || taskId,
    title: input.title,
    projectId: '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '款式档案',
    upstreamObjectType: input.upstreamObjectType || '款式档案',
    upstreamObjectId: input.upstreamObjectId || style.styleId,
    upstreamObjectCode: input.upstreamObjectCode || style.styleCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    productStyleCode: input.productStyleCode || style.styleCode,
    spuCode: input.spuCode || style.styleCode,
    ...plateExecutionFields(input, existing),
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
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    participantNames: input.participantNames || [],
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: style.styleCode,
  })

  return { ok: true, task, relation: null, message: '制版任务已创建。' }
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
    styleId: input.styleId || '',
    styleCode: input.styleCode || input.productStyleCode || project.styleNumber || '',
    styleName: input.styleName || '',
    productStyleCode: input.productStyleCode || project.styleNumber || '',
    spuCode: input.spuCode || '',
    ...plateExecutionFields(input, existing),
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
    latestResultText: '已创建制版任务',
    pendingActionType: '查看制版任务',
    pendingActionText: '查看制版任务',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '制版任务已创建，已写项目关系，已更新项目节点。' }
}

export function createPlateMakingTask(
  input: PlateMakingTaskCreateInput,
): TaskWritebackResult<PlateMakingTaskRecord> {
  if (input.projectId) return createPlateMakingTaskWithProjectRelation(input)
  return createPlateMakingTaskStandalone(input)
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
    styleId: input.styleId || '',
    styleCode: input.styleCode || input.patternSpuCode || input.productStyleCode || project.styleNumber || '',
    styleName: input.styleName || '',
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
    latestResultText: '已创建花型任务',
    pendingActionType: '查看花型任务',
    pendingActionText: '查看花型任务',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '花型任务已创建，已写项目关系，已更新项目节点。' }
}

function createPatternTaskStandalone(input: PatternTaskCreateInput): TaskWritebackResult<PatternTaskRecord> {
  const rawCode = input.patternTaskCode || input.patternTaskId || input.title
  const style = resolvePatternStyle(input)
  if (!style) {
    const pendingItem = makePendingItem('花型任务', rawCode, '', input.styleCode || input.patternSpuCode || input.productStyleCode || input.spuCode || '', '请选择正式款式档案。')
    upsertPatternTaskPendingItem(pendingItem)
    return { ok: false, message: pendingItem.reason, pendingItem }
  }
  const upstreamError = ensureFormalSource('花型任务', input.sourceType, input.upstreamObjectId || '', input.upstreamObjectCode || '', style.styleCode)
  if (upstreamError) {
    const pendingItem = makePendingItem('花型任务', rawCode, '', style.styleCode, upstreamError)
    upsertPatternTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
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
    projectId: '',
    projectCode: '',
    projectName: '',
    projectNodeId: '',
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || '款式档案',
    upstreamObjectType: input.upstreamObjectType || '款式档案',
    upstreamObjectId: input.upstreamObjectId || style.styleId,
    upstreamObjectCode: input.upstreamObjectCode || style.styleCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    productStyleCode: input.productStyleCode || style.styleCode,
    spuCode: input.spuCode || style.styleCode,
    demandSourceType,
    demandSourceRefId: input.demandSourceRefId || input.upstreamObjectId || style.styleId,
    demandSourceRefCode: input.demandSourceRefCode || input.upstreamObjectCode || style.styleCode,
    demandSourceRefName: input.demandSourceRefName || input.upstreamModule || style.styleName,
    processType: input.processType || (input.artworkType === '烫画' ? '烫画' : '数码印'),
    requestQty: Number(input.requestQty || 1),
    fabricSku: input.fabricSku || '',
    fabricName: input.fabricName || '待买手确认',
    demandImageIds: [...(input.demandImageIds || existing?.demandImageIds || [])],
    patternSpuCode: input.patternSpuCode || style.styleCode,
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
    ownerId: input.ownerId || '',
    ownerName: input.ownerName || '',
    priorityLevel: input.priorityLevel || '中',
    dueAt: input.dueAt || '',
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || input.operatorName || '当前用户',
    updatedAt: now,
    updatedBy: input.operatorName || '当前用户',
    note: input.note || '',
    legacyProjectRef: '',
    legacyUpstreamRef: style.styleCode,
  })

  return { ok: true, task, relation: null, message: '花型任务已创建。' }
}

export function createPatternTask(input: PatternTaskCreateInput): TaskWritebackResult<PatternTaskRecord> {
  if (input.projectId) return createPatternTaskWithProjectRelation(input)
  return createPatternTaskStandalone(input)
}

export function createRevisionTask(input: RevisionTaskCreateInput): TaskWritebackResult<RevisionTaskRecord> {
  return createRevisionTaskWithProjectRelation(input)
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
    return { ok: false, task, message: `缺少字段：${missingFields.join('、')}。` }
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

export function completeRevisionTask(
  revisionTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<RevisionTaskRecord> {
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) return { ok: false, task: null, message: '未找到改版任务。' }
  if (task.projectId && task.projectNodeId) return completeRevisionTaskWithProjectRelationSync(revisionTaskId, operatorName)
  if (task.status === '已取消') return { ok: false, task, message: '当前改版任务已取消，不能完成。' }
  const missing = getRevisionTaskCompletionMissingFields(task)
  if (missing.length > 0) return { ok: false, task, message: `缺少字段：${missing.join('、')}。` }
  const nextTask = updateRevisionTask(revisionTaskId, {
    status: '已完成',
    confirmedAt: nowTaskText(),
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  })
  return nextTask ? { ok: true, task: nextTask, message: '改版任务已完成。' } : { ok: false, task, message: '改版任务完成失败。' }
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
    return { ok: false, task, message: `缺少字段：${missingFields.join('、')}。` }
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

export function completePlateMakingTask(
  plateTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<PlateMakingTaskRecord> {
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) return { ok: false, task: null, message: '未找到制版任务。' }
  if (task.projectId && task.projectNodeId) return completePlateMakingTaskWithProjectRelationSync(plateTaskId, operatorName)
  if (task.status === '已取消') return { ok: false, task, message: '当前制版任务已取消，不能完成。' }
  const missing = getPlateTaskCompletionMissingFields(task)
  if (missing.length > 0) return { ok: false, task, message: `缺少字段：${missing.join('、')}。` }
  const nextTask = updatePlateMakingTask(plateTaskId, {
    status: '已完成',
    confirmedAt: nowTaskText(),
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  })
  return nextTask ? { ok: true, task: nextTask, message: '制版任务已完成。' } : { ok: false, task, message: '制版任务完成失败。' }
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
    return { ok: false, task, message: `缺少字段：${missingFields.join('、')}。` }
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

export function completePatternTask(
  patternTaskId: string,
  operatorName = '当前用户',
): TaskCompletionResult<PatternTaskRecord> {
  const task = getPatternTaskById(patternTaskId)
  if (!task) return { ok: false, task: null, message: '未找到花型任务。' }
  if (task.projectId && task.projectNodeId) return completePatternTaskWithProjectRelationSync(patternTaskId, operatorName)
  if (task.status === '已取消') return { ok: false, task, message: '当前花型任务已取消，不能完成。' }
  const missing = getPatternTaskCompletionMissingFields(task)
  if (missing.length > 0) return { ok: false, task, message: `缺少字段：${missing.join('、')}。` }
  const nextTask = updatePatternTask(patternTaskId, {
    status: '已完成',
    confirmedAt: nowTaskText(),
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  })
  return nextTask ? { ok: true, task: nextTask, message: '花型任务已完成。' } : { ok: false, task, message: '花型任务完成失败。' }
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
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已通过')
    .forEach((task) => {
      syncFirstSampleTaskToProjectNode({
        firstSampleTaskId: task.firstSampleTaskId,
        operatorName,
      })
    })
  listFirstOrderSampleTasks()
    .filter((task) => task.projectId && task.projectNodeId && task.status === '已完成')
    .forEach((task) => {
      syncTaskCompletionToProjectNode({
        projectId: task.projectId,
        projectNodeId: task.projectNodeId,
        workItemTypeCode: 'FIRST_ORDER_SAMPLE',
        workItemTypeName: '首单样衣打样',
        sourceModule: '首单样衣打样',
        sourceObjectType: '首单样衣打样任务',
        sourceObjectId: task.firstOrderSampleTaskId,
        sourceObjectCode: task.firstOrderSampleTaskCode,
        sourceTitle: task.title,
        sourceStatus: task.status,
        businessDate: task.updatedAt || task.createdAt,
        ownerName: task.ownerName,
        resultType: '首单样衣打样已完成',
        resultText: '首单样衣打样已完成，商品项目节点同步完成。',
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

  const manualProjectSource = input.sourceType === '人工创建'
  const upstreamError = ensureFormalSource(
    '首版样衣打样',
    input.sourceType,
    input.upstreamObjectId || '',
    input.upstreamObjectCode || '',
    manualProjectSource ? project.projectCode : '',
  )
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
    upstreamModule: input.upstreamModule || (manualProjectSource ? '商品项目' : ''),
    upstreamObjectType: input.upstreamObjectType || (manualProjectSource ? '商品项目' : ''),
    upstreamObjectId: input.upstreamObjectId || (manualProjectSource ? project.projectId : ''),
    upstreamObjectCode: input.upstreamObjectCode || (manualProjectSource ? project.projectCode : ''),
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    sampleCode: input.sampleCode || buildFirstSampleCode(input.targetSite || '深圳', listFirstSampleTasks().length),
    ...firstSampleChainFields(input, existing),
    status: '待处理',
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

  const relation = upsertProjectRelation({
    ...relationPayload({
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
    relationRole: '执行记录',
    note: JSON.stringify(buildFirstSampleProjectMeta(task)),
  })

  updateTaskNode(node, task, {
    latestInstanceId: task.firstSampleTaskId,
    latestInstanceCode: task.firstSampleTaskCode,
    latestResultType: '已创建首版样衣打样任务',
    latestResultText: '已创建首版样衣打样任务，待补齐详细信息',
    pendingActionType: '补齐首版样衣详情',
    pendingActionText: '请在首版样衣打样详情中补齐结果信息',
  }, Boolean(existing))
  syncFirstSampleTaskToProjectNode({
    firstSampleTaskId: task.firstSampleTaskId,
    operatorName: input.operatorName || '当前用户',
  })
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '首版样衣打样任务已创建，已写项目关系，已更新项目节点。' }
}

export function createFirstOrderSampleTaskWithProjectRelation(
  input: FirstOrderSampleTaskCreateInput,
): TaskWritebackResult<FirstOrderSampleTaskRecord> {
  const rawCode = input.firstOrderSampleTaskCode || input.firstOrderSampleTaskId || input.title
  const { project, pendingItem: projectPending } = getProjectOrPending('首单样衣打样', input.projectId, rawCode, input.upstreamObjectCode || input.upstreamObjectId || '')
  if (!project || projectPending) {
    upsertFirstOrderSampleTaskPendingItem(projectPending!)
    return { ok: false, message: projectPending!.reason, pendingItem: projectPending! }
  }

  const manualProjectSource = input.sourceType === '人工创建'
  const upstreamError = ensureFormalSource(
    '首单样衣打样',
    input.sourceType,
    input.upstreamObjectId || '',
    input.upstreamObjectCode || '',
    manualProjectSource ? project.projectCode : '',
  )
  if (upstreamError) {
    const pendingItem = makePendingItem('首单样衣打样', rawCode, project.projectCode, input.upstreamObjectCode || input.upstreamObjectId || '', upstreamError)
    upsertFirstOrderSampleTaskPendingItem(pendingItem)
    return { ok: false, message: upstreamError, pendingItem }
  }

  const { node, pendingItem: nodePending } = getNodeOrPending('首单样衣打样', project.projectId, project.projectCode, rawCode, 'FIRST_ORDER_SAMPLE')
  if (!node || nodePending) {
    upsertFirstOrderSampleTaskPendingItem(nodePending!)
    return { ok: false, message: nodePending!.reason, pendingItem: nodePending! }
  }

  const cancelledPending = blockCancelledNode('首单样衣打样', rawCode, project.projectCode, node)
  if (cancelledPending) {
    upsertFirstOrderSampleTaskPendingItem(cancelledPending)
    return { ok: false, message: cancelledPending.reason, pendingItem: cancelledPending }
  }

  const now = nowTaskText()
  const taskId = input.firstOrderSampleTaskId || nextCode('PP', listFirstOrderSampleTasks().length)
  const existing = getFirstOrderSampleTaskById(taskId)
  const task = upsertFirstOrderSampleTask({
    firstOrderSampleTaskId: taskId,
    firstOrderSampleTaskCode: input.firstOrderSampleTaskCode || taskId,
    title: input.title,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'FIRST_ORDER_SAMPLE',
    workItemTypeName: '首单样衣打样',
    sourceType: input.sourceType,
    upstreamModule: input.upstreamModule || (manualProjectSource ? '商品项目' : ''),
    upstreamObjectType: input.upstreamObjectType || (manualProjectSource ? '商品项目' : ''),
    upstreamObjectId: input.upstreamObjectId || (manualProjectSource ? project.projectId : ''),
    upstreamObjectCode: input.upstreamObjectCode || (manualProjectSource ? project.projectCode : ''),
    factoryId: input.factoryId || '',
    factoryName: input.factoryName || '',
    targetSite: input.targetSite || '深圳',
    patternVersion: input.patternVersion || '',
    artworkVersion: input.artworkVersion || '',
    sampleCode: input.sampleCode || buildFirstOrderSampleCode(input.targetSite || '深圳', listFirstOrderSampleTasks().length),
    ...firstOrderChainFields(input, project.projectId, existing),
    confirmedAt: existing?.confirmedAt || '',
    status: '待处理',
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
      workItemTypeCode: 'FIRST_ORDER_SAMPLE',
      workItemTypeName: '首单样衣打样',
      sourceModule: '首单样衣打样',
      sourceObjectType: '首单样衣打样任务',
      sourceObjectId: task.firstOrderSampleTaskId,
      sourceObjectCode: task.firstOrderSampleTaskCode,
      sourceTitle: task.title,
      sourceStatus: task.status,
      businessDate: task.createdAt,
      ownerName: task.ownerName,
      operatorName: input.operatorName || '当前用户',
    }),
  )

  updateTaskNode(node, task, {
    latestInstanceId: task.firstOrderSampleTaskId,
    latestInstanceCode: task.firstOrderSampleTaskCode,
    latestResultType: '已创建首单样衣打样任务',
    latestResultText: '已创建首单样衣打样任务，等待开始打样',
    pendingActionType: '开始打样',
    pendingActionText: '请开始首单样衣打样',
  }, Boolean(existing))
  syncExistingProjectArchiveByProjectId(task.projectId, task.updatedBy)
  return { ok: true, task, relation, message: '首单样衣打样任务已创建，已写项目关系，已更新项目节点。' }
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

  const results: Array<TaskWritebackResult<PlateMakingTaskRecord | PatternTaskRecord | FirstSampleTaskRecord | FirstOrderSampleTaskRecord>> = []

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
        task.firstOrderSampleTaskCode ||
        ''
      )
    }).filter(Boolean),
  }
}
