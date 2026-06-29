import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import { findStyleArchiveByCode, findStyleArchiveByProjectId, getStyleArchiveById } from './pcs-style-archive-repository.ts'

export type EngineeringTaskFieldPolicyCode = 'REVISION_TASK' | 'PATTERN_TASK' | 'PATTERN_ARTWORK_TASK'

export interface EngineeringTaskFieldDescriptor {
  fieldKey: string
  label: string
}

export interface EngineeringTaskNodeWritebackDescriptor {
  phase: '创建后' | '提交确认后' | '驳回后' | '通过后' | '生成技术包后' | '完成后'
  resultType: string
  resultText: string
  pendingActionType: string
  pendingActionText: string
}

export interface EngineeringTaskFieldPolicy {
  workItemTypeCode: EngineeringTaskFieldPolicyCode
  taskLabel: string
  createRequiredFields: EngineeringTaskFieldDescriptor[]
  detailEditableFields: EngineeringTaskFieldDescriptor[]
  completionRequiredFields: EngineeringTaskFieldDescriptor[]
  nodeWritebacks: EngineeringTaskNodeWritebackDescriptor[]
}

const REVISION_TASK_FIELD_POLICY: EngineeringTaskFieldPolicy = {
  workItemTypeCode: 'REVISION_TASK',
  taskLabel: '改版任务',
  createRequiredFields: [
    { fieldKey: 'title', label: '任务标题' },
    { fieldKey: 'ownerName', label: '负责人' },
    { fieldKey: 'dueAt', label: '截止时间' },
    { fieldKey: 'revisionScopeCodes', label: '改版范围' },
    { fieldKey: 'baseStyleCode', label: '旧款信息' },
    { fieldKey: 'issueSummary', label: '问题点' },
    { fieldKey: 'evidenceSummary', label: '证据说明' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人' },
    { fieldKey: 'revisionVersion', label: '改版版次' },
    { fieldKey: 'sampleQty', label: '样衣数量' },
    { fieldKey: 'materialAdjustmentLines', label: '面辅料变化' },
    { fieldKey: 'newPatternSpuCode', label: '新花型 SPU' },
    { fieldKey: 'patternPieceImageIds', label: '纸样图片' },
    { fieldKey: 'patternFileIds', label: '纸样文件' },
    { fieldKey: 'liveRetestStatus', label: '回直播验证状态' },
  ],
  completionRequiredFields: [
    { fieldKey: 'baseStyleCode', label: '旧款信息' },
    { fieldKey: 'revisionScopeNames', label: '改版范围' },
    { fieldKey: 'revisionSuggestionRichText', label: '修改建议' },
    { fieldKey: 'generatedNewTechPackVersionFlag', label: '新技术包版本' },
    { fieldKey: 'liveRetestStatus', label: '回直播验证' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建改版任务',
      resultText: '已创建改版任务。',
      pendingActionType: '查看改版任务',
      pendingActionText: '查看改版任务',
    },
    {
      phase: '完成后',
      resultType: '改版任务已完成',
      resultText: '改版任务已完成，商品项目节点同步完成。',
      pendingActionType: '',
      pendingActionText: '',
    },
  ],
}

const PLATE_TASK_FIELD_POLICY: EngineeringTaskFieldPolicy = {
  workItemTypeCode: 'PATTERN_TASK',
  taskLabel: '制版任务',
  createRequiredFields: [
    { fieldKey: 'title', label: '任务标题' },
    { fieldKey: 'patternMakerName', label: '版师' },
    { fieldKey: 'dueAt', label: '截止时间' },
    { fieldKey: 'productHistoryType', label: '产品历史属性' },
    { fieldKey: 'patternArea', label: '打版区域' },
    { fieldKey: 'patternType', label: '版型类型' },
    { fieldKey: 'sizeRange', label: '尺码范围' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人' },
    { fieldKey: 'patternVersion', label: '制版版次' },
    { fieldKey: 'materialRequirementLines', label: '面辅料明细' },
    { fieldKey: 'colorRequirementText', label: '花色需求' },
    { fieldKey: 'patternImageLineItems', label: '唛架图片明细' },
    { fieldKey: 'patternPdfFileIds', label: 'PDF 文件' },
    { fieldKey: 'patternDxfFileIds', label: 'DXF 文件' },
    { fieldKey: 'patternRulFileIds', label: 'RUL 文件' },
    { fieldKey: 'partTemplateLinks', label: '部位模板关联' },
  ],
  completionRequiredFields: [
    { fieldKey: 'patternMakerName', label: '版师' },
    { fieldKey: 'productHistoryType', label: '产品历史属性' },
    { fieldKey: 'patternArea', label: '打版区域' },
    { fieldKey: 'patternDeliverables', label: '纸样资料' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建制版任务',
      resultText: '已创建制版任务。',
      pendingActionType: '查看制版任务',
      pendingActionText: '查看制版任务',
    },
    {
      phase: '提交确认后',
      resultType: '制版待样板确认',
      resultText: '制版产出已提交样板确认。',
      pendingActionType: '样板确认',
      pendingActionText: '确认制版样板',
    },
    {
      phase: '驳回后',
      resultType: '制版样板驳回',
      resultText: '制版样板已驳回，待版师调整。',
      pendingActionType: '版师调整',
      pendingActionText: '按驳回说明调整纸样',
    },
    {
      phase: '通过后',
      resultType: '制版样板通过',
      resultText: '制版样板已通过，待生成技术包版本。',
      pendingActionType: '生成技术包',
      pendingActionText: '生成制版技术包版本',
    },
    {
      phase: '生成技术包后',
      resultType: '制版技术包已生成',
      resultText: '制版技术包版本已生成，待完成任务。',
      pendingActionType: '完成制版任务',
      pendingActionText: '确认制版任务完成',
    },
    {
      phase: '完成后',
      resultType: '制版任务已完成',
      resultText: '制版任务已完成，商品项目节点同步完成。',
      pendingActionType: '',
      pendingActionText: '',
    },
  ],
}

const PATTERN_TASK_FIELD_POLICY: EngineeringTaskFieldPolicy = {
  workItemTypeCode: 'PATTERN_ARTWORK_TASK',
  taskLabel: '花型任务',
  createRequiredFields: [
    { fieldKey: 'title', label: '任务标题' },
    { fieldKey: 'dueAt', label: '截止时间' },
    { fieldKey: 'demandSourceType', label: '需求来源' },
    { fieldKey: 'processType', label: '工艺' },
    { fieldKey: 'requestQty', label: '数量' },
    { fieldKey: 'fabricSku', label: '面料' },
    { fieldKey: 'demandImageIds', label: '需求图片' },
    { fieldKey: 'assignedTeamCode', label: '团队' },
    { fieldKey: 'assignedMemberId', label: '花型师' },
  ],
  detailEditableFields: [
    { fieldKey: 'artworkVersion', label: '花型版次' },
    { fieldKey: 'difficultyGrade', label: '难易程度' },
    { fieldKey: 'colorDepthOption', label: '颜色深浅' },
    { fieldKey: 'buyerReviewStatus', label: '买手确认' },
    { fieldKey: 'completionImageIds', label: '完成确认图片' },
    { fieldKey: 'patternFileIds', label: '花型文件' },
  ],
  completionRequiredFields: [
    { fieldKey: 'artworkVersion', label: '花型版次' },
    { fieldKey: 'completionImageIds', label: '完成确认图片' },
    { fieldKey: 'patternFileIds', label: '花型文件' },
    { fieldKey: 'buyerReviewStatus', label: '买手确认通过' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建花型任务',
      resultText: '已创建花型任务。',
      pendingActionType: '查看花型任务',
      pendingActionText: '查看花型任务',
    },
    {
      phase: '完成后',
      resultType: '花型任务已完成',
      resultText: '花型任务已完成，商品项目节点同步完成。',
      pendingActionType: '',
      pendingActionText: '',
    },
  ],
}

const FIELD_POLICY_MAP: Record<EngineeringTaskFieldPolicyCode, EngineeringTaskFieldPolicy> = {
  REVISION_TASK: REVISION_TASK_FIELD_POLICY,
  PATTERN_TASK: PLATE_TASK_FIELD_POLICY,
  PATTERN_ARTWORK_TASK: PATTERN_TASK_FIELD_POLICY,
}

export function getEngineeringTaskFieldPolicy(
  workItemTypeCode: EngineeringTaskFieldPolicyCode,
): EngineeringTaskFieldPolicy {
  return FIELD_POLICY_MAP[workItemTypeCode]
}

export function getRevisionTaskCompletionMissingFields(task: RevisionTaskRecord): string[] {
  const missing: string[] = []
  if (!(task.baseStyleCode || task.styleCode || task.productStyleCode).trim()) missing.push('旧款信息')
  if ((task.revisionScopeNames || []).length === 0 && (task.revisionScopeCodes || []).length === 0) missing.push('改版范围')
  if (!(task.revisionSuggestionRichText || task.issueSummary).trim()) missing.push('修改建议')
  if (task.liveRetestRequired) {
    if (task.liveRetestStatus === '待回直播验证') missing.push('回直播验证状态')
    if ((task.liveRetestRelationIds || []).length === 0 && !task.liveRetestSummary.trim()) missing.push('回直播验证结论')
  }
  if (!task.generatedNewTechPackVersionFlag && !task.linkedTechPackVersionId) missing.push('新技术包版本')
  return missing
}

export function getPlateTaskCompletionMissingFields(task: PlateMakingTaskRecord): string[] {
  const missing = getPlateTaskTechPackMissingFields(task)
  if (!task.linkedTechPackVersionId) missing.push('技术包版本')
  return missing
}

export function getPlateTaskExecutionSubmitMissingFields(task: PlateMakingTaskRecord): string[] {
  const missing: string[] = []
  if (!(task.patternMakerName || task.ownerName).trim()) missing.push('版师')
  if (!task.productHistoryType) missing.push('产品历史属性')
  if (!task.patternArea) missing.push('打版区域')
  if (!task.patternType.trim()) missing.push('版型类型')
  if (!task.sizeRange.trim()) missing.push('尺码范围')
  const hasPatternImage = (task.patternImageLineItems || []).length > 0
  const hasPatternFile =
    (task.patternPdfFileIds || []).length > 0
    || (task.patternDxfFileIds || []).length > 0
    || (task.patternRulFileIds || []).length > 0
  if (!hasPatternImage && !hasPatternFile && !task.patternVersion.trim()) missing.push('纸样资料')
  return missing
}

export function getPlateTaskReviewMissingFields(task: PlateMakingTaskRecord): string[] {
  const missing: string[] = []
  if (task.sampleReviewStatus !== '待样板确认') missing.push('待样板确认状态')
  return missing
}

function hasPlateTaskStyleArchive(task: PlateMakingTaskRecord): boolean {
  return Boolean(
    (task.styleId && getStyleArchiveById(task.styleId)) ||
    findStyleArchiveByCode(task.styleCode || task.productStyleCode || task.spuCode || '') ||
    findStyleArchiveByProjectId(task.projectId),
  )
}

export function getPlateTaskTechPackMissingFields(task: PlateMakingTaskRecord): string[] {
  const missing = getPlateTaskExecutionSubmitMissingFields(task)
  if (task.sampleReviewStatus !== '样板已通过') missing.push('样板确认通过')
  if (!hasPlateTaskStyleArchive(task)) missing.push('正式款式档案')
  return missing
}

export function getPatternTaskCompletionMissingFields(task: PatternTaskRecord): string[] {
  const missing = getPatternTaskExecutionSubmitMissingFields(task)
  if (task.buyerReviewStatus !== '买手已通过') missing.push('买手确认通过')
  return missing
}

export function getPatternTaskExecutionSubmitMissingFields(task: PatternTaskRecord): string[] {
  const missing: string[] = []
  if (!task.artworkVersion.trim()) missing.push('花型版次')
  if ((task.completionImageIds || []).length === 0) missing.push('完成确认图片')
  if ((task.patternFileIds || []).length === 0) missing.push('花型文件')
  return missing
}
